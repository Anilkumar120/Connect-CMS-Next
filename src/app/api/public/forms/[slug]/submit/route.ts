
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getFormFields } from "@/lib/forms";

type Context = {
  params: Promise<{ slug: string }>;
};

type UploadedFile = {
  fieldId: string;
  extension: string;
  bytes: Buffer;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_BODY_BYTES =
  MAX_FILE_SIZE * MAX_FILES + 1024 * 1024;

const RATE_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT = 5;

const rateBuckets = new Map<
  string,
  { started: number; count: number }
>();

const STRUCTURAL_FIELDS = [
  "html",
  "divider",
  "section",
  "page-break",
];

function isAllowedContent(bytes: Buffer): string | null {
  const pngEnd = Buffer.from([
    0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]);

  // PNG
  if (
    bytes.length >= 45 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([
        137, 80, 78, 71, 13, 10, 26, 10,
      ])
    ) &&
    bytes.subarray(-12).equals(pngEnd)
  ) {
    return "png";
  }

  // JPEG
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes.subarray(-2).equals(
      Buffer.from([0xff, 0xd9])
    )
  ) {
    return "jpg";
  }

  // GIF
  if (
    bytes.length >= 14 &&
    ["GIF87a", "GIF89a"].includes(
      bytes.toString("ascii", 0, 6)
    ) &&
    bytes[bytes.length - 1] === 0x3b
  ) {
    return "gif";
  }

  // WEBP
  if (
    bytes.length >= 20 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP" &&
    bytes.readUInt32LE(4) + 8 === bytes.length
  ) {
    return "webp";
  }

  // PDF
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 5).toString("ascii") === "%PDF-" &&
    bytes
      .subarray(-1024)
      .toString("latin1")
      .includes("%%EOF")
  ) {
    return "pdf";
  }

  // CSV / text
  if (bytes.length > 0 && !bytes.includes(0)) {
    try {
      const decoder = new TextDecoder("utf-8", {
        fatal: true,
      });

      const decoded = decoder.decode(bytes);

      if (
        !decoded.trim() ||
        /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(
          decoded
        )
      ) {
        return null;
      }

      return "csv";
    } catch {
      return null;
    }
  }

  return null;
}

function checkRate(ip: string): boolean {
  const now = Date.now();

  if (rateBuckets.size > 10_000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.started >= RATE_WINDOW) {
        rateBuckets.delete(key);
      }
    }
  }

  const key =
    rateBuckets.size >= 10_000 &&
    !rateBuckets.has(ip)
      ? "__overflow__"
      : ip;

  const previous = rateBuckets.get(key);

  if (
    !previous ||
    now - previous.started >= RATE_WINDOW
  ) {
    rateBuckets.set(key, {
      started: now,
      count: 1,
    });

    return true;
  }

  if (previous.count >= RATE_LIMIT) {
    return false;
  }

  previous.count += 1;
  return true;
}

function validateValue(
  type: string,
  value: unknown,
  options: string[] = []
): boolean {
  // Multi select
  if (type === "multi-select") {
    return (
      Array.isArray(value) &&
      value.every(
        (item) =>
          typeof item === "string" &&
          options.includes(item)
      )
    );
  }

  // Dropdown and radio
  if (
    ["dropdown", "radio", "multiple-choice"].includes(type)
  ) {
    return (
      typeof value === "string" &&
      options.includes(value)
    );
  }

  // Checkbox and consent
  if (["checkbox", "consent"].includes(type)) {
    return typeof value === "boolean";
  }

  // Number
  if (type === "number") {
    return (
      typeof value === "number" &&
      Number.isFinite(value)
    );
  }

  // Rating: 1 to 5
  if (type === "rating") {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 5
    );
  }

  // Scale: 1 to 10
  if (type === "scale") {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 10
    );
  }

  if (
    typeof value !== "string" ||
    value.length > 5000
  ) {
    return false;
  }

  // Email
  if (type === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  // Telephone
  if (type === "telephone") {
    return /^[+\d().\-\s]{3,32}$/.test(value);
  }

  // URL
  if (type === "url") {
    try {
      const parsed = new URL(value);

      return (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:"
      );
    } catch {
      return false;
    }
  }

  // Date
  if (type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(
      `${value}T00:00:00.000Z`
    );

    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }

  // Time
  if (type === "time") {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  // Date and time
  if (type === "datetime") {
    return (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
      !Number.isNaN(new Date(value).getTime())
    );
  }

  // Text, paragraph, name, address, hidden,
  // city, state, country, postal-code, signature.
  return true;
}

export async function POST(
  request: NextRequest,
  context: Context
) {
  const ip =
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRate(ip)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Too many submissions. Please try again later.",
      },
      { status: 429 }
    );
  }

  let writtenDirectory = "";

  try {
    const { slug } = await context.params;

    const form = await prisma.form.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        deletedAt: null,
      },
    });

    if (!form) {
      return NextResponse.json(
        {
          success: false,
          message: "This form is unavailable.",
        },
        { status: 404 }
      );
    }

    const fields = getFormFields(form.fields);

    if (
      !fields.length &&
      Array.isArray(form.fields) &&
      form.fields.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This form has invalid field configuration.",
        },
        { status: 500 }
      );
    }

    if (
      Number(request.headers.get("content-length") || 0) >
      MAX_BODY_BYTES
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Submission is too large.",
        },
        { status: 413 }
      );
    }

    const body = await request.formData();

    // Honeypot anti-spam
    if (String(body.get("_website") || "").trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Submission not accepted.",
        },
        { status: 400 }
      );
    }

    const rawData = body.get("data");

    if (
      typeof rawData !== "string" ||
      rawData.length > 100_000
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid form response.",
        },
        { status: 400 }
      );
    }

    let values: Record<string, unknown>;

    try {
      const parsed: unknown = JSON.parse(rawData);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("Invalid form data");
      }

      values = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid form response.",
        },
        { status: 400 }
      );
    }

    // Structural fields are not submission inputs.
    const dataFields = fields.filter(
      (field) =>
        !STRUCTURAL_FIELDS.includes(field.type)
    );

    const fieldIds = new Set(
      dataFields.map((field) => field.id)
    );

    // Reject unknown or structural field values.
    if (
      Object.keys(values).some(
        (key) => !fieldIds.has(key)
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unexpected form field.",
        },
        { status: 400 }
      );
    }

    // Server-side field validation
    for (const field of dataFields) {
      const value = values[field.id];

      // Files are submitted separately through FormData.
      if (
        ["file", "image"].includes(field.type) &&
        value !== undefined
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid value for ${field.label}.`,
          },
          { status: 400 }
        );
      }

      const empty =
        value === undefined ||
        value === null ||
        value === "" ||
        (typeof value === "string" && !value.trim()) ||
        (Array.isArray(value) && value.length === 0);

      if (
        field.required &&
        !["file", "image"].includes(field.type) &&
        empty
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `${field.label} is required.`,
          },
          { status: 400 }
        );
      }

      if (
        field.required &&
        ["checkbox", "consent"].includes(field.type) &&
        value !== true
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `${field.label} is required.`,
          },
          { status: 400 }
        );
      }

      if (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        !validateValue(
          field.type,
          value,
          field.options ?? []
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `Please check ${field.label}.`,
          },
          { status: 400 }
        );
      }

      if (
        typeof value === "string" &&
        value.length > 5000
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `${field.label} is too long.`,
          },
          { status: 400 }
        );
      }
    }

    // Process uploaded files
    const acceptedFiles: UploadedFile[] = [];

    for (const [key, entry] of body.entries()) {
      if (key === "data" || key === "_website") {
        continue;
      }

      if (!(entry instanceof File)) {
        return NextResponse.json(
          {
            success: false,
            message: "Unexpected form field.",
          },
          { status: 400 }
        );
      }

      if (entry.size === 0) {
        continue;
      }

      if (!key.startsWith("file:")) {
        return NextResponse.json(
          {
            success: false,
            message: "Unexpected file field.",
          },
          { status: 400 }
        );
      }

      const fieldId = key.slice(5);

      const field = dataFields.find(
        (candidate) => candidate.id === fieldId
      );

      if (
        !field ||
        !["file", "image"].includes(field.type)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Unexpected file field.",
          },
          { status: 400 }
        );
      }

      if (entry.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Each file must be 10 MB or smaller.",
          },
          { status: 400 }
        );
      }

      if (acceptedFiles.length >= MAX_FILES) {
        return NextResponse.json(
          {
            success: false,
            message:
              "A maximum of 5 files may be uploaded.",
          },
          { status: 400 }
        );
      }

      const bytes = Buffer.from(
        await entry.arrayBuffer()
      );

      const extension = isAllowedContent(bytes);

      if (
        !extension ||
        (
          field.type === "image" &&
          !["png", "jpg", "gif", "webp"].includes(
            extension
          )
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Only genuine image, PDF, and CSV files are accepted.",
          },
          { status: 400 }
        );
      }

      acceptedFiles.push({
        fieldId,
        extension,
        bytes,
      });
    }

    // Required upload validation
    for (const field of dataFields) {
      if (
        field.required &&
        ["file", "image"].includes(field.type) &&
        !acceptedFiles.some(
          (file) => file.fieldId === field.id
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `${field.label} is required.`,
          },
          { status: 400 }
        );
      }
    }

    const totalBytes = acceptedFiles.reduce(
      (sum, file) => sum + file.bytes.length,
      0
    );

    if (totalBytes > MAX_FILE_SIZE * MAX_FILES) {
      return NextResponse.json(
        {
          success: false,
          message: "Submission is too large.",
        },
        { status: 413 }
      );
    }

    // Save uploaded files
    const submissionId = randomUUID();

    const filesDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "forms",
      submissionId
    );

    const storedFiles: Array<{
      fieldId: string;
      name: string;
      url: string;
      size: number;
    }> = [];

    if (acceptedFiles.length > 0) {
      await mkdir(filesDirectory, {
        recursive: true,
      });

      writtenDirectory = filesDirectory;

      for (const file of acceptedFiles) {
        const name = `${randomUUID()}.${file.extension}`;

        await writeFile(
          path.join(filesDirectory, name),
          file.bytes,
          { flag: "wx" }
        );

        storedFiles.push({
          fieldId: file.fieldId,
          name,
          url: `/api/public/forms/files/${submissionId}/${name}`,
          size: file.bytes.length,
        });
      }
    }

    // Save form values and file information.
    const data = {
      ...values,
      _files: storedFiles,
    };

    const submission = await prisma.formSubmission.create({
      data: {
        id: submissionId,
        formId: form.id,
        data: data as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    const settings =
      form.settings &&
      typeof form.settings === "object" &&
      !Array.isArray(form.settings)
        ? (form.settings as Record<string, unknown>)
        : {};

    const successMessage =
      typeof settings.successMessage === "string" &&
      settings.successMessage.trim()
        ? settings.successMessage
        : "Thank you. Your response has been received.";

    return NextResponse.json(
      {
        success: true,
        message: successMessage,
        submissionId: submission.id,
      },
      { status: 201 }
    );
  } catch (error) {
    if (writtenDirectory) {
      await rm(writtenDirectory, {
        recursive: true,
        force: true,
      }).catch(() => undefined);
    }

    console.error("Form submission failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "We could not save your response. Please try again.",
      },
      { status: 500 }
    );
  }
}
