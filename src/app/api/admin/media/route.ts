
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import {
  mkdir,
  writeFile,
  readFile,
  appendFile,
  unlink,
  rm,
  access,
  rename,
} from "fs/promises";
import type { Prisma } from "@prisma/client";
import { head, del } from "@vercel/blob";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "media");
const TEMP_DIR = path.join(UPLOAD_DIR, ".chunks");

const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "ico",
  "mp4", "webm", "mov", "m4v", "avi", "mkv", "mpeg", "mpg",
  "mp3", "wav", "ogg", "m4a", "aac", "flac",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv", "rtf", "odt", "ods", "odp",
  "zip", "7z", "rar", "tar", "gz",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
  tar: "application/x-tar",
  gz: "application/gzip",
};

type UploadMetadata = {
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  totalChunks: number;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

async function authorize() {
  const user = await getCurrentUser();
  return user && user.isActive ? user : null;
}

function getExtension(name: string) {
  return path.extname(name).replace(".", "").toLowerCase();
}

function safeFileName(name: string) {
  return path.basename(name.replace(/\\/g, "/"))
    .replace(/[\0-\x1f\x7f]/g, "")
    .trim();
}

function sanitizeFileName(name: string) {
  const extension = getExtension(name);
  const base = path.basename(name, path.extname(name));

  const cleanBase = base
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 150) || "media";

  return extension ? `${cleanBase}.${extension}` : cleanBase;
}

function getMimeType(extension: string, supplied = "") {
  return MIME_BY_EXTENSION[extension] || supplied || "application/octet-stream";
}

function serializeMedia(item: Prisma.MediaAssetGetPayload<object>) {
  return {
    id: item.id,
    fileName: item.fileName,
    originalName: item.originalName,
    mimeType: item.mimeType,
    fileSize: Number(item.fileSize),
    filePath: item.filePath,
    url: item.filePath,
    altText: item.altText,
    title: item.title,
    caption: item.caption,
    description: item.description,
    isDeleted: item.isDeleted,
    createdAt: item.createdAt.toISOString(),
  };
}

function isBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function getSafeStoredPath(filePath: string) {
  let decoded: string;

  try {
    decoded = decodeURIComponent(filePath);
  } catch {
    throw new Error("Invalid encoded media path.");
  }

  if (/^https?:\/\//i.test(decoded)) {
    throw new Error("Remote media cannot be accessed as a local file.");
  }

  const relative = decoded.replace(/^[/\\]+/, "");
  const resolved = path.resolve(process.cwd(), "public", relative);
  const root = path.resolve(UPLOAD_DIR) + path.sep;

  if (!resolved.startsWith(root)) {
    throw new Error("Invalid media file path.");
  }

  return resolved;
}

async function ensureDirectories() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });
}

async function getUniqueFileName(originalName: string, ignorePath?: string) {
  const safeName = sanitizeFileName(originalName);
  const extension = path.extname(safeName);
  const base = path.basename(safeName, extension);

  let candidate = safeName;
  let counter = 1;

  while (true) {
    const candidatePath = path.join(UPLOAD_DIR, candidate);

    if (
      ignorePath &&
      path.resolve(candidatePath) === path.resolve(ignorePath)
    ) {
      return candidate;
    }

    try {
      await access(candidatePath);
      candidate = `${base}-${counter}${extension}`;
      counter++;
    } catch {
      return candidate;
    }
  }
}

function isValidUploadId(id: string) {
  return /^[a-f0-9-]{36}$/i.test(id);
}

async function removeUploadFolder(id: string) {
  if (!isValidUploadId(id)) throw new Error("Invalid upload ID.");

  const folder = path.resolve(TEMP_DIR, id);
  const root = path.resolve(TEMP_DIR) + path.sep;

  if (!folder.startsWith(root)) throw new Error("Invalid upload folder.");

  await rm(folder, { recursive: true, force: true });
}

async function getUploadMetadata(id: string): Promise<UploadMetadata> {
  if (!isValidUploadId(id)) throw new Error("Invalid upload ID.");

  const file = path.join(TEMP_DIR, id, "metadata.json");
  return JSON.parse(await readFile(file, "utf8")) as UploadMetadata;
}

async function migrateExistingMedia() {
  const items = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "asc" },
  });

  let migrated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of items) {
    if (isBlobUrl(item.filePath)) {
      skipped++;
      continue;
    }

    try {
      const oldPath = getSafeStoredPath(item.filePath);
      await access(oldPath);

      const newName = await getUniqueFileName(
        item.originalName || item.fileName,
        oldPath
      );

      const newPath = path.join(UPLOAD_DIR, newName);

      if (path.resolve(oldPath) === path.resolve(newPath)) {
        skipped++;
        continue;
      }

      await rename(oldPath, newPath);

      try {
        await prisma.mediaAsset.update({
          where: { id: item.id },
          data: {
            fileName: newName,
            filePath: `/uploads/media/${encodeURIComponent(newName)}`,
          },
        });
        migrated++;
      } catch (error) {
        await rename(newPath, oldPath).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      skipped++;
      errors.push(
        `${item.originalName}: ${
          error instanceof Error ? error.message : "Migration failed"
        }`
      );
    }
  }

  return {
    success: true,
    message: "Media filename migration completed.",
    total: items.length,
    migrated,
    skipped,
    errors,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await authorize();
    if (!user) return jsonError("Unauthorized access.", 401);

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") === "trash" ? "trash" : "library";
    const search = (searchParams.get("search") || "").trim();
    const type = searchParams.get("type") || "all";

    const where: Prisma.MediaAssetWhereInput = {
      isDeleted: view === "trash",
    };

    if (search) {
      where.OR = [
        { originalName: { contains: search } },
        { fileName: { contains: search } },
        { mimeType: { contains: search } },
        { title: { contains: search } },
        { altText: { contains: search } },
        { caption: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (type === "image") where.mimeType = { startsWith: "image/" };
    else if (type === "video") where.mimeType = { startsWith: "video/" };
    else if (type === "audio") where.mimeType = { startsWith: "audio/" };
    else if (type === "document") {
      where.NOT = [
        { mimeType: { startsWith: "image/" } },
        { mimeType: { startsWith: "video/" } },
        { mimeType: { startsWith: "audio/" } },
      ];
    }

    const media = await prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({
      success: true,
      media: media.map(serializeMedia),
      total: media.length,
      view,
    });
  } catch (error) {
    console.error("Media GET error:", error);
    return jsonError("Unable to load media.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const originError = verifyRequestOrigin(request);
    if (originError) return originError;

    const user = await authorize();
    if (!user) return jsonError("Unauthorized access.", 401);

    const contentType = request.headers.get("content-type") || "";

    // JSON registration is handled BEFORE any local filesystem operation.
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const action = String(body.action || "");

      if (action !== "register-blob") {
        return jsonError("Invalid JSON media action.");
      }

      const url = typeof body.url === "string" ? body.url : "";
      const pathname = typeof body.pathname === "string" ? body.pathname : "";
      const originalName = safeFileName(
        typeof body.originalName === "string" ? body.originalName : ""
      );

      if (!isBlobUrl(url)) return jsonError("Invalid Vercel Blob URL.");

      const extension = getExtension(originalName);
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        return jsonError(`File type .${extension} is not allowed.`);
      }

      if (!pathname || !pathname.startsWith("media/") || pathname.includes("..")) {
        return jsonError("Invalid Blob pathname.");
      }

      const blobInfo = await head(url);

      if (blobInfo.url !== url || blobInfo.pathname !== pathname) {
        return jsonError("Blob URL and pathname do not match.");
      }

      if (
        !Number.isSafeInteger(blobInfo.size) ||
        blobInfo.size <= 0 ||
        blobInfo.size > MAX_FILE_SIZE
      ) {
        return jsonError("Uploaded file size is invalid.");
      }

      const expectedMime = getMimeType(extension);

      if (blobInfo.contentType && blobInfo.contentType !== expectedMime) {
        return jsonError("Uploaded file content type does not match its extension.");
      }

      const fileName = path.posix.basename(pathname);

      const existing = await prisma.mediaAsset.findFirst({
        where: { filePath: url },
      });

      if (existing) {
        return NextResponse.json({
          success: true,
          message: "File is already registered.",
          media: serializeMedia(existing),
        });
      }

      const media = await prisma.mediaAsset.create({
        data: {
          fileName,
          originalName,
          mimeType: expectedMime,
          fileSize: BigInt(blobInfo.size),
          filePath: url,
          title: originalName,
        },
      });

      return NextResponse.json({
        success: true,
        message: "File uploaded successfully.",
        media: serializeMedia(media),
      });
    }

    // The old chunk system is for local development only.
    if (process.env.VERCEL === "1") {
      return jsonError(
        "Production uploads must use the Vercel Blob multipart uploader.",
        400
      );
    }

    await ensureDirectories();

    const formData = await request.formData();
    const action = String(formData.get("action") || "");

    if (action === "migrate-existing") {
      return NextResponse.json(await migrateExistingMedia());
    }

    if (action === "init") {
      const originalName = safeFileName(
        String(formData.get("fileName") || "")
      );
      const size = Number(formData.get("size") || 0);
      const suppliedMime = String(formData.get("mimeType") || "");
      const extension = getExtension(originalName);

      if (!originalName || !extension) return jsonError("Invalid file name.");
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        return jsonError(`File type .${extension} is not allowed.`);
      }
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_SIZE) {
        return jsonError("File size must be between 1 byte and 5 GB.");
      }

      const totalChunks = Math.ceil(size / CHUNK_SIZE);
      const uploadId = randomUUID();
      const folder = path.join(TEMP_DIR, uploadId);

      await mkdir(folder, { recursive: true });

      const metadata: UploadMetadata = {
        originalName,
        extension,
        mimeType: getMimeType(extension, suppliedMime),
        size,
        totalChunks,
      };

      await writeFile(
        path.join(folder, "metadata.json"),
        JSON.stringify(metadata)
      );

      return NextResponse.json({
        success: true,
        uploadId,
        totalChunks,
        chunkSize: CHUNK_SIZE,
      });
    }

    if (action === "chunk") {
      const uploadId = String(formData.get("uploadId") || "");
      const chunkIndex = Number(formData.get("chunkIndex"));
      const chunk = formData.get("chunk");

      if (
        !isValidUploadId(uploadId) ||
        !Number.isInteger(chunkIndex) ||
        !(chunk instanceof File)
      ) {
        return jsonError("Invalid chunk data.");
      }

      const metadata = await getUploadMetadata(uploadId);

      if (
        chunkIndex < 0 ||
        chunkIndex >= metadata.totalChunks ||
        chunk.size <= 0 ||
        chunk.size > CHUNK_SIZE
      ) {
        return jsonError("Invalid chunk size or index.");
      }

      const expectedSize =
        chunkIndex === metadata.totalChunks - 1
          ? metadata.size - CHUNK_SIZE * chunkIndex
          : CHUNK_SIZE;

      if (chunk.size !== expectedSize) {
        return jsonError("Chunk size does not match.");
      }

      const buffer = Buffer.from(await chunk.arrayBuffer());
      const chunkPath = path.join(TEMP_DIR, uploadId, `${chunkIndex}.part`);

      await writeFile(chunkPath, buffer);

      return NextResponse.json({ success: true, chunkIndex });
    }

    if (action === "complete") {
      const uploadId = String(formData.get("uploadId") || "");
      if (!isValidUploadId(uploadId)) return jsonError("Invalid upload ID.");

      const metadata = await getUploadMetadata(uploadId);

      if (
        !ALLOWED_EXTENSIONS.has(metadata.extension) ||
        metadata.size <= 0 ||
        metadata.size > MAX_FILE_SIZE ||
        metadata.totalChunks !== Math.ceil(metadata.size / CHUNK_SIZE)
      ) {
        return jsonError("Invalid upload metadata.");
      }

      const folder = path.join(TEMP_DIR, uploadId);
      let finalPath = "";

      try {
        const finalName = await getUniqueFileName(metadata.originalName);
        finalPath = path.join(UPLOAD_DIR, finalName);

        let assembledSize = 0;

        for (let index = 0; index < metadata.totalChunks; index++) {
          const chunkPath = path.join(folder, `${index}.part`);
          const chunkBuffer = await readFile(chunkPath);
          assembledSize += chunkBuffer.length;

          if (index === 0) {
            await writeFile(finalPath, chunkBuffer, { flag: "wx" });
          } else {
            await appendFile(finalPath, chunkBuffer);
          }
        }

        if (assembledSize !== metadata.size) {
          throw new Error("Uploaded file size does not match.");
        }

        const media = await prisma.mediaAsset.create({
          data: {
            fileName: finalName,
            originalName: metadata.originalName,
            mimeType: metadata.mimeType,
            fileSize: BigInt(metadata.size),
            filePath: `/uploads/media/${encodeURIComponent(finalName)}`,
            title: metadata.originalName,
          },
        });

        await removeUploadFolder(uploadId);

        return NextResponse.json({
          success: true,
          message: "File uploaded successfully.",
          media: serializeMedia(media),
        });
      } catch (error) {
        if (finalPath) await unlink(finalPath).catch(() => undefined);
        throw error;
      }
    }

    if (action === "cancel") {
      const uploadId = String(formData.get("uploadId") || "");
      if (!isValidUploadId(uploadId)) return jsonError("Invalid upload ID.");

      await removeUploadFolder(uploadId);

      return NextResponse.json({
        success: true,
        message: "Upload cancelled.",
      });
    }

    return jsonError("Invalid upload action.");
  } catch (error) {
    console.error("Media POST error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Media upload failed.",
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const originError = verifyRequestOrigin(request);
    if (originError) return originError;

    const user = await authorize();
    if (!user) return jsonError("Unauthorized access.", 401);

    const body = await request.json();
    const action = String(body.action || "");

    if (action === "update") {
      const id = typeof body.id === "string" ? body.id.trim() : "";
      if (!id) return jsonError("Media ID is required.");

      const existing = await prisma.mediaAsset.findUnique({ where: { id } });

      if (!existing || existing.isDeleted) {
        return jsonError("Media file not found.", 404);
      }

      const updated = await prisma.mediaAsset.update({
        where: { id },
        data: {
          altText:
            typeof body.altText === "string"
              ? body.altText.trim().slice(0, 500) || null
              : null,
          title:
            typeof body.title === "string"
              ? body.title.trim().slice(0, 255) || null
              : null,
          caption:
            typeof body.caption === "string"
              ? body.caption.trim().slice(0, 500) || null
              : null,
          description:
            typeof body.description === "string"
              ? body.description.trim().slice(0, 10000) || null
              : null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Media details updated successfully.",
        media: serializeMedia(updated),
      });
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.filter(
          (id: unknown): id is string =>
            typeof id === "string" && id.trim().length > 0
        )
      : [];

    if (!ids.length) return jsonError("Select at least one file.");
    if (action !== "trash" && action !== "restore") {
      return jsonError("Invalid media action.");
    }

    const result = await prisma.mediaAsset.updateMany({
      where: {
        id: { in: ids },
        isDeleted: action === "restore",
      },
      data: { isDeleted: action === "trash" },
    });

    return NextResponse.json({
      success: true,
      message:
        action === "trash"
          ? "Selected files moved to Trash."
          : "Selected files restored.",
      count: result.count,
    });
  } catch (error) {
    console.error("Media PATCH error:", error);
    return jsonError("Unable to update media.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const originError = verifyRequestOrigin(request);
    if (originError) return originError;

    const user = await authorize();
    if (!user) return jsonError("Unauthorized access.", 401);

    const body = await request.json();

    const ids = Array.isArray(body.ids)
      ? body.ids.filter(
          (id: unknown): id is string =>
            typeof id === "string" && id.trim().length > 0
        )
      : [];

    if (!ids.length) return jsonError("Select at least one file.");

    const items = await prisma.mediaAsset.findMany({
      where: { id: { in: ids }, isDeleted: true },
    });

    if (!items.length) return jsonError("No trashed files were selected.");

    // Delete storage objects first. Keep DB rows if a storage deletion fails.
    for (const item of items) {
      if (isBlobUrl(item.filePath)) {
        await del(item.filePath);
      } else {
        const physicalPath = getSafeStoredPath(item.filePath);

        await unlink(physicalPath).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
    }

    const result = await prisma.mediaAsset.deleteMany({
      where: {
        id: { in: items.map((item) => item.id) },
        isDeleted: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Files permanently deleted.",
      count: result.count,
    });
  } catch (error) {
    console.error("Media DELETE error:", error);
    return jsonError(
      error instanceof Error
        ? `Unable to permanently delete selected files: ${error.message}`
        : "Unable to permanently delete selected files.",
      500
    );
  }
}
