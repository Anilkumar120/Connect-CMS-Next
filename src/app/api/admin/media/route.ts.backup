
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
import DOMPurify from "isomorphic-dompurify";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "media");
const TEMP_DIR = path.join(UPLOAD_DIR, ".chunks");

const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "bmp", "ico",
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
  svg: "image/svg+xml",
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

async function authorize() {
  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

function getExtension(fileName: string) {
  return path.extname(fileName).replace(".", "").toLowerCase();
}

function safeFileName(fileName: string) {
  return path
    .basename(fileName)
    .replace(/[\0-\x1f\x7f]/g, "")
    .trim();
}

function sanitizeFileName(fileName: string) {
  const extension = getExtension(fileName);

  const originalBase = path.basename(
    fileName,
    path.extname(fileName)
  );

  // Remove date and timestamp suffixes from filenames.
  // Examples:
  // ChatGPT-Image-Apr-17-2026-04_44_41-PM
  // Company-Logo-2026-11-06
  const timestampPattern =
    /(?:[-_](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-_]\d{1,2}[-_]\d{4}|[-_]\d{4}[-_]\d{2}[-_]\d{2})(?:[-_]\d{1,2}[-_]\d{2}(?:[-_]\d{2})?(?:[-_](?:AM|PM))?)?$/i;

  const cleanBase = originalBase.replace(timestampPattern, "");

  const safeBase = cleanBase
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 150);

  const finalBase = safeBase || "media";

  return extension
    ? `${finalBase}.${extension}`
    : finalBase;
}

/**
 * Generates a unique readable filename.
 * Example: image.png, image-1.png, image-2.png
 */
async function getUniqueFileName(
  originalName: string,
  ignorePath?: string
) {
  const sanitizedName = sanitizeFileName(originalName);

  const extension = path.extname(sanitizedName);
  const baseName = path.basename(sanitizedName, extension);

  let candidate = sanitizedName;
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
      candidate = `${baseName}-${counter}${extension}`;
      counter++;
    } catch {
      return candidate;
    }
  }
}

function getMimeType(extension: string, suppliedMime = "") {
  return (
    MIME_BY_EXTENSION[extension] ||
    suppliedMime ||
    "application/octet-stream"
  );
}

function serializeMedia(item: Prisma.MediaAssetGetPayload<{}>) {
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

async function ensureDirectories() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });
}

function getSafeStoredPath(filePath: string) {
  let decodedPath = filePath;

  try {
    decodedPath = decodeURIComponent(filePath);
  } catch {
    throw new Error("Invalid encoded media path.");
  }

  const relativePath = decodedPath.replace(/^[/\\]+/, "");

  const resolvedPath = path.resolve(
    process.cwd(),
    "public",
    relativePath
  );

  const allowedRoot = path.resolve(UPLOAD_DIR) + path.sep;

  if (!resolvedPath.startsWith(allowedRoot)) {
    throw new Error("Invalid media file path.");
  }

  return resolvedPath;
}

function isValidUploadId(uploadId: string) {
  return /^[a-f0-9-]{36}$/i.test(uploadId);
}

async function removeUploadFolder(uploadId: string) {
  if (!isValidUploadId(uploadId)) {
    throw new Error("Invalid upload ID.");
  }

  const folder = path.resolve(TEMP_DIR, uploadId);
  const allowedRoot = path.resolve(TEMP_DIR) + path.sep;

  if (!folder.startsWith(allowedRoot)) {
    throw new Error("Invalid upload folder.");
  }

  await rm(folder, { recursive: true, force: true });
}

async function getUploadMetadata(
  uploadId: string
): Promise<UploadMetadata> {
  if (!isValidUploadId(uploadId)) {
    throw new Error("Invalid upload ID.");
  }

  const folder = path.join(TEMP_DIR, uploadId);
  const metadataPath = path.join(folder, "metadata.json");
  const raw = await readFile(metadataPath, "utf8");

  return JSON.parse(raw) as UploadMetadata;
}

function sanitizeSvg(content: string) {
  return DOMPurify.sanitize(content, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      "script",
      "foreignObject",
      "iframe",
      "object",
      "embed",
    ],
    FORBID_ATTR: [
      "onload",
      "onclick",
      "onerror",
      "onmouseover",
      "onfocus",
      "onbegin",
    ],
  });
}

/**
 * Migrates existing UUID filenames to readable filenames.
 */
async function migrateExistingMedia() {
  const items = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "asc" },
  });

  let migrated = 0;
  let skipped = 0;

  const errors: string[] = [];

  for (const item of items) {
    try {
      const oldPath = getSafeStoredPath(item.filePath);

      await access(oldPath);

      const newFileName = await getUniqueFileName(
        item.originalName || item.fileName,
        oldPath
      );

      const newPath = path.join(UPLOAD_DIR, newFileName);

      if (path.resolve(oldPath) === path.resolve(newPath)) {
        skipped++;
        continue;
      }

      // Rename physical file first.
      await rename(oldPath, newPath);

      try {
        // Update database only after successful rename.
        await prisma.mediaAsset.update({
          where: { id: item.id },
          data: {
            fileName: newFileName,
            filePath: `/uploads/media/${encodeURIComponent(newFileName)}`,
          },
        });

        migrated++;
      } catch (databaseError) {
        // Roll back physical rename if database update fails.
        await rename(newPath, oldPath).catch(() => undefined);
        throw databaseError;
      }
    } catch (error) {
      skipped++;

      errors.push(
        `${item.originalName}: ${
          error instanceof Error
            ? error.message
            : "Migration failed"
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

/**
 * GET: Media Library and Trash
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authorize();

    if (!user) {
      return jsonError("Unauthorized access.", 401);
    }

    const { searchParams } = new URL(request.url);

    const view =
      searchParams.get("view") === "trash"
        ? "trash"
        : "library";

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

    if (type === "image") {
      where.mimeType = { startsWith: "image/" };
    } else if (type === "video") {
      where.mimeType = { startsWith: "video/" };
    } else if (type === "audio") {
      where.mimeType = { startsWith: "audio/" };
    } else if (type === "document") {
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

/**
 * POST: Chunked upload and filename migration.
 */
export async function POST(request: NextRequest) {
  try {
    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    const user = await authorize();

    if (!user) {
      return jsonError("Unauthorized access.", 401);
    }

    await ensureDirectories();

    const formData = await request.formData();
    const action = String(formData.get("action") || "");

    /**
     * Migrate old UUID filenames.
     */
    if (action === "migrate-existing") {
      const result = await migrateExistingMedia();

      return NextResponse.json(result);
    }

    /**
     * Initialize upload.
     */
    if (action === "init") {
      const originalName = safeFileName(
        String(formData.get("fileName") || "")
      );

      const size = Number(formData.get("size") || 0);
      const suppliedMime = String(formData.get("mimeType") || "");
      const extension = getExtension(originalName);

      if (!originalName || !extension) {
        return jsonError("Invalid file name.");
      }

      if (!ALLOWED_EXTENSIONS.has(extension)) {
        return jsonError(`File type .${extension} is not allowed.`);
      }

      if (
        !Number.isSafeInteger(size) ||
        size <= 0 ||
        size > MAX_FILE_SIZE
      ) {
        return jsonError("File size must be between 1 byte and 5 GB.");
      }

      const totalChunks = Math.ceil(size / CHUNK_SIZE);
      const uploadId = randomUUID();
      const uploadFolder = path.join(TEMP_DIR, uploadId);

      await mkdir(uploadFolder, { recursive: true });

      const metadata: UploadMetadata = {
        originalName,
        extension,
        mimeType: getMimeType(extension, suppliedMime),
        size,
        totalChunks,
      };

      await writeFile(
        path.join(uploadFolder, "metadata.json"),
        JSON.stringify(metadata)
      );

      return NextResponse.json({
        success: true,
        uploadId,
        totalChunks,
        chunkSize: CHUNK_SIZE,
      });
    }

    /**
     * Upload individual chunk.
     */
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

      const chunkBuffer = Buffer.from(await chunk.arrayBuffer());

      const chunkPath = path.join(
        TEMP_DIR,
        uploadId,
        `${chunkIndex}.part`
      );

      await writeFile(chunkPath, chunkBuffer);

      return NextResponse.json({
        success: true,
        chunkIndex,
      });
    }

    /**
     * Complete upload.
     */
    if (action === "complete") {
      const uploadId = String(formData.get("uploadId") || "");

      if (!isValidUploadId(uploadId)) {
        return jsonError("Invalid upload ID.");
      }

      const metadata = await getUploadMetadata(uploadId);

      if (
        !ALLOWED_EXTENSIONS.has(metadata.extension) ||
        metadata.size <= 0 ||
        metadata.size > MAX_FILE_SIZE ||
        metadata.totalChunks !== Math.ceil(metadata.size / CHUNK_SIZE)
      ) {
        return jsonError("Invalid upload metadata.");
      }

      const uploadFolder = path.join(TEMP_DIR, uploadId);

      let finalPath = "";

      try {
        const finalName = await getUniqueFileName(
          metadata.originalName
        );

        finalPath = path.join(UPLOAD_DIR, finalName);

        let assembledSize = 0;

        for (let index = 0; index < metadata.totalChunks; index++) {
          const chunkPath = path.join(
            uploadFolder,
            `${index}.part`
          );

          const chunkBuffer = await readFile(chunkPath);

          assembledSize += chunkBuffer.length;

          if (index === 0) {
            await writeFile(finalPath, chunkBuffer, {
              flag: "wx",
            });
          } else {
            await appendFile(finalPath, chunkBuffer);
          }
        }

        if (assembledSize !== metadata.size) {
          throw new Error("Uploaded file size does not match.");
        }

        if (metadata.extension === "svg") {
          const rawSvg = await readFile(finalPath, "utf8");
          const cleanSvg = sanitizeSvg(rawSvg);

          if (!cleanSvg || !cleanSvg.includes("<svg")) {
            throw new Error("Invalid SVG file.");
          }

          await writeFile(finalPath, cleanSvg, "utf8");
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
        if (finalPath) {
          await unlink(finalPath).catch(() => undefined);
        }

        throw error;
      }
    }

    /**
     * Cancel upload.
     */
    if (action === "cancel") {
      const uploadId = String(formData.get("uploadId") || "");

      if (!isValidUploadId(uploadId)) {
        return jsonError("Invalid upload ID.");
      }

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
      error instanceof Error
        ? error.message
        : "Media upload failed.",
      500
    );
  }
}

/**
 * PATCH: Update details, trash and restore.
 */
export async function PATCH(request: NextRequest) {
  try {
    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    const user = await authorize();

    if (!user) {
      return jsonError("Unauthorized access.", 401);
    }

    const body = await request.json();
    const action = String(body.action || "");

    /**
     * Update attachment details.
     */
    if (action === "update") {
      const id = typeof body.id === "string"
        ? body.id.trim()
        : "";

      if (!id) {
        return jsonError("Media ID is required.");
      }

      const existingMedia = await prisma.mediaAsset.findUnique({
        where: { id },
      });

      if (!existingMedia || existingMedia.isDeleted) {
        return jsonError("Media file not found.", 404);
      }

      const altText =
        typeof body.altText === "string"
          ? body.altText.trim().slice(0, 500)
          : "";

      const title =
        typeof body.title === "string"
          ? body.title.trim().slice(0, 255)
          : "";

      const caption =
        typeof body.caption === "string"
          ? body.caption.trim().slice(0, 500)
          : "";

      const description =
        typeof body.description === "string"
          ? body.description.trim().slice(0, 10000)
          : "";

      const updatedMedia = await prisma.mediaAsset.update({
        where: { id },
        data: {
          altText: altText || null,
          title: title || null,
          caption: caption || null,
          description: description || null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Media details updated successfully.",
        media: serializeMedia(updatedMedia),
      });
    }

    /**
     * Bulk trash / restore.
     */
    const ids = Array.isArray(body.ids)
      ? body.ids.filter(
          (id: unknown): id is string =>
            typeof id === "string" && id.trim().length > 0
        )
      : [];

    if (!ids.length) {
      return jsonError("Select at least one file.");
    }

    if (!["trash", "restore"].includes(action)) {
      return jsonError("Invalid media action.");
    }

    const result = await prisma.mediaAsset.updateMany({
      where: {
        id: { in: ids },
        isDeleted: action === "restore",
      },
      data: {
        isDeleted: action === "trash",
      },
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

/**
 * DELETE: Permanently delete files from Trash.
 */
export async function DELETE(request: NextRequest) {
  try {
    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    const user = await authorize();

    if (!user) {
      return jsonError("Unauthorized access.", 401);
    }

    const body = await request.json();

    const ids = Array.isArray(body.ids)
      ? body.ids.filter(
          (id: unknown): id is string =>
            typeof id === "string" && id.trim().length > 0
        )
      : [];

    if (!ids.length) {
      return jsonError("Select at least one file.");
    }

    const items = await prisma.mediaAsset.findMany({
      where: {
        id: { in: ids },
        isDeleted: true,
      },
    });

    if (!items.length) {
      return jsonError("No trashed files were selected.");
    }

    for (const item of items) {
      const physicalPath = getSafeStoredPath(item.filePath);

      await unlink(physicalPath).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }
      );
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
      "Unable to permanently delete selected files.",
      500
    );
  }
}
