
import { NextRequest, NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import path from "path";

import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const isCompletion = body?.type === "blob.upload-completed";

    if (!isCompletion) {
      const originError = verifyRequestOrigin(request);
      if (originError) return originError;

      const user = await getCurrentUser();
      if (!user || !user.isActive) {
        return jsonError("Unauthorized access.", 401);
      }
    }

    const result = await handleUpload({
      request,
      body,

      onBeforeGenerateToken: async (
        pathname,
        clientPayload,
        multipart
      ) => {
        if (!multipart) {
          throw new Error("Multipart upload is required.");
        }

        let metadata: {
          originalName?: string;
          size?: number;
        };

        try {
          metadata = JSON.parse(clientPayload || "{}");
        } catch {
          throw new Error("Invalid upload metadata.");
        }

        const originalName = path.basename(
          String(metadata.originalName || "").replace(/\\/g, "/")
        ).trim();

        const size = Number(metadata.size);
        const extension = path.extname(originalName).slice(1).toLowerCase();
        const pathnameExtension = path.extname(pathname).slice(1).toLowerCase();

        if (!originalName || !extension) {
          throw new Error("Invalid file name.");
        }

        if (
          !pathname.startsWith("media/") ||
          pathname.split("/").includes("..") ||
          pathnameExtension !== extension
        ) {
          throw new Error("Invalid upload path.");
        }

        const expectedMime = MIME_BY_EXTENSION[extension];

        if (!expectedMime) {
          throw new Error(`File type .${extension} is not allowed.`);
        }

        if (
          !Number.isSafeInteger(size) ||
          size <= 0 ||
          size > MAX_FILE_SIZE
        ) {
          throw new Error("File size must be between 1 byte and 5 GB.");
        }

        return {
          allowedContentTypes: [expectedMime],
          maximumSizeInBytes: size,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            originalName,
            size,
            mimeType: expectedMime,
          }),
        };
      },

      onUploadCompleted: async () => {
        // The authenticated browser registers the completed Blob in Prisma.
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Media Blob upload error:", error);

    return jsonError(
      error instanceof Error ? error.message : "Blob upload failed.",
      500
    );
  }
}
