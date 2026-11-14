import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFormFields } from "@/lib/forms";

type Context = { params: Promise<{ slug: string }> };
type UploadedFile = { fieldId: string; extension: string; bytes: Buffer };
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_BODY_BYTES = MAX_FILE_SIZE * MAX_FILES + 1024 * 1024;
const rateBuckets = new Map<string, { started: number; count: number }>();
const RATE_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT = 5;

function isAllowedContent(bytes: Buffer) {
  const pngEnd = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  if (bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.subarray(-12).equals(pngEnd)) return "png";
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) return "jpg";
  if (bytes.length >= 14 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6)) && bytes[bytes.length - 1] === 0x3b) return "gif";
  if (bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && bytes.readUInt32LE(4) + 8 === bytes.length) return "webp";
  if (bytes.length >= 12 && bytes.subarray(0, 5).toString("ascii") === "%PDF-" && bytes.subarray(-1024).toString("latin1").includes("%%EOF")) return "pdf";
  if (bytes.length > 0 && !bytes.includes(0)) {
    const text = new TextDecoder("utf-8", { fatal: true });
    try {
      const decoded = text.decode(bytes);
      if (!decoded.trim() || /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(decoded)) return null;
      return "csv";
    } catch {
      return null;
    }
  }
  return null;
}

function checkRate(ip: string) {
  const now = Date.now();
  if (rateBuckets.size > 10_000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.started >= RATE_WINDOW) rateBuckets.delete(key);
    }
  }
  const key = rateBuckets.size >= 10_000 && !rateBuckets.has(ip) ? "__overflow__" : ip;
  const previous = rateBuckets.get(key);
  if (!previous || now - previous.started >= RATE_WINDOW) {
    rateBuckets.set(key, { started: now, count: 1 });
    return true;
  }
  if (previous.count >= RATE_LIMIT) return false;
  previous.count += 1;
  return true;
}

function validateValue(type: string, value: unknown, options: string[] = []) {
  if (["multi-select"].includes(type)) {
    return Array.isArray(value) && value.every((item) => typeof item === "string" && options.includes(item));
  }
  if (["dropdown", "radio", "multiple-choice"].includes(type)) {
    return typeof value === "string" && options.includes(value);
  }
  if (type === "checkbox") return typeof value === "boolean";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "telephone") return typeof value === "string" && /^[+\d().\-\s]{3,32}$/.test(value);
  return typeof value === "string" && value.length <= 5000;
}

export async function POST(request: NextRequest, context: Context) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") || "unknown";
  if (!checkRate(ip)) return NextResponse.json({ success: false, message: "Too many submissions. Please try again later." }, { status: 429 });

  let writtenDirectory = "";
  try {
    const { slug } = await context.params;
    const form = await prisma.form.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null } });
    if (!form) return NextResponse.json({ success: false, message: "This form is unavailable." }, { status: 404 });

    const fields = getFormFields(form.fields);
    if (!fields.length && Array.isArray(form.fields) && form.fields.length) {
      return NextResponse.json({ success: false, message: "This form has invalid field configuration." }, { status: 500 });
    }
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, message: "Submission is too large." }, { status: 413 });
    }
    const body = await request.formData();
    if (String(body.get("_website") || "").trim()) return NextResponse.json({ success: false, message: "Submission not accepted." }, { status: 400 });
    const rawData = body.get("data");
    if (typeof rawData !== "string" || rawData.length > 100_000) {
      return NextResponse.json({ success: false, message: "Invalid form response." }, { status: 400 });
    }
    let values: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawData);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      values = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, message: "Invalid form response." }, { status: 400 });
    }

    const fieldIds = new Set(fields.map((field) => field.id));
    if (Object.keys(values).some((key) => !fieldIds.has(key))) {
      return NextResponse.json({ success: false, message: "Unexpected form field." }, { status: 400 });
    }
    for (const field of fields) {
      const value = values[field.id];
      if (["file", "image"].includes(field.type) && value !== undefined) {
        return NextResponse.json({ success: false, message: `Invalid value for ${field.label}.` }, { status: 400 });
      }
      if (field.required && !["file", "image"].includes(field.type) && (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))) {
        return NextResponse.json({ success: false, message: `${field.label} is required.` }, { status: 400 });
      }
      if (field.required && field.type === "checkbox" && value !== true) {
        return NextResponse.json({ success: false, message: `${field.label} is required.` }, { status: 400 });
      }
      if (value !== undefined && value !== null && value !== "" && !validateValue(field.type, value, field.options ?? [])) {
        return NextResponse.json({ success: false, message: `Please check ${field.label}.` }, { status: 400 });
      }
      if (typeof value === "string" && value.length > 5000) {
        return NextResponse.json({ success: false, message: `${field.label} is too long.` }, { status: 400 });
      }
    }

    const acceptedFiles: UploadedFile[] = [];
    for (const [key, entry] of body.entries()) {
      if (key === "data" || key === "_website") continue;
      if (!(entry instanceof File)) return NextResponse.json({ success: false, message: "Unexpected form field." }, { status: 400 });
      if (entry.size === 0) continue;
      if (!key.startsWith("file:")) return NextResponse.json({ success: false, message: "Unexpected file field." }, { status: 400 });
      const fieldId = key.slice(5);
      const field = fields.find((candidate) => candidate.id === fieldId);
      if (!field || !["file", "image"].includes(field.type)) return NextResponse.json({ success: false, message: "Unexpected file field." }, { status: 400 });
      if (entry.size > MAX_FILE_SIZE) return NextResponse.json({ success: false, message: "Each file must be 10 MB or smaller." }, { status: 400 });
      if (acceptedFiles.length >= MAX_FILES) return NextResponse.json({ success: false, message: "A maximum of 5 files may be uploaded." }, { status: 400 });
      const bytes = Buffer.from(await entry.arrayBuffer());
      const extension = isAllowedContent(bytes);
      if (!extension || (field.type === "image" && !["png", "jpg", "gif", "webp"].includes(extension))) {
        return NextResponse.json({ success: false, message: "Only genuine image, PDF, and CSV files are accepted." }, { status: 400 });
      }
      acceptedFiles.push({ fieldId, extension, bytes });
    }
    for (const field of fields) {
      if (field.required && ["file", "image"].includes(field.type) && !acceptedFiles.some((file) => file.fieldId === field.id)) {
        return NextResponse.json({ success: false, message: `${field.label} is required.` }, { status: 400 });
      }
    }
    const totalBytes = acceptedFiles.reduce((sum, file) => sum + file.bytes.length, 0);
    if (totalBytes > MAX_FILE_SIZE * MAX_FILES) return NextResponse.json({ success: false, message: "Submission is too large." }, { status: 413 });

    const submissionId = randomUUID();
    const filesDirectory = path.join(process.cwd(), "public", "uploads", "forms", submissionId);
    const storedFiles: Array<{ fieldId: string; name: string; url: string; size: number }> = [];
    if (acceptedFiles.length) {
      await mkdir(filesDirectory, { recursive: true });
      writtenDirectory = filesDirectory;
      for (const file of acceptedFiles) {
        const name = `${randomUUID()}.${file.extension}`;
        await writeFile(path.join(filesDirectory, name), file.bytes, { flag: "wx" });
        storedFiles.push({ fieldId: file.fieldId, name, url: `/api/public/forms/files/${submissionId}/${name}`, size: file.bytes.length });
      }
    }
    const data = { ...values, _files: storedFiles };
    const submission = await prisma.formSubmission.create({
      data: { id: submissionId, formId: form.id, data: data as Prisma.InputJsonValue },
      select: { id: true },
    });
    return NextResponse.json({ success: true, message: String(form.settings && typeof form.settings === "object" && !Array.isArray(form.settings) ? (form.settings as Record<string, unknown>).successMessage || "Thank you. Your response has been received." : "Thank you. Your response has been received."), submissionId: submission.id }, { status: 201 });
  } catch (error) {
    if (writtenDirectory) await rm(writtenDirectory, { recursive: true, force: true }).catch(() => undefined);
    console.error("Form submission failed:", error);
    return NextResponse.json({ success: false, message: "We could not save your response. Please try again." }, { status: 500 });
  }
}
