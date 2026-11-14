
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  try {
    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    const user = await getCurrentUser();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Please select an image." },
        { status: 400 }
      );
    }

    const extension = allowedTypes[file.type];

    if (!extension) {
      return NextResponse.json(
        {
          success: false,
          message: "Only JPG, PNG and WEBP images are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "Image size must be between 1 byte and 5 MB.",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Basic file signature validation
    const validSignature =
      (extension === "jpg" &&
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff) ||
      (extension === "png" &&
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        )) ||
      (extension === "webp" &&
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP");

    if (!validSignature) {
      return NextResponse.json(
        { success: false, message: "Invalid image file." },
        { status: 400 }
      );
    }

    const fileName = `${randomUUID()}.${extension}`;
    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "pages"
    );

    await mkdir(uploadDirectory, { recursive: true });

    const filePath = path.join(uploadDirectory, fileName);

    await writeFile(filePath, buffer, { flag: "wx" });

    return NextResponse.json(
      {
        success: true,
        message: "Featured image uploaded successfully.",
        image: `/uploads/pages/${fileName}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Featured image upload error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to upload featured image." },
      { status: 500 }
    );
  }
}
