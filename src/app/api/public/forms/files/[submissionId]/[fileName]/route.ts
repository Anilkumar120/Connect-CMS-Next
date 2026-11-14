import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ submissionId: string; fileName: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { submissionId, fileName } = await context.params;
  if (!/^[\da-f-]{36}$/i.test(submissionId) || !/^[\da-f-]{36}\.(png|jpg|gif|webp|pdf|csv)$/i.test(fileName)) {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }
  const submission = await prisma.formSubmission.findUnique({ where: { id: submissionId }, select: { data: true } });
  const files = submission?.data && typeof submission.data === "object" && !Array.isArray(submission.data)
    ? (submission.data as Record<string, unknown>)._files : null;
  if (!Array.isArray(files) || !files.some((file) => file && typeof file === "object" && (file as Record<string, unknown>).name === fileName)) {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "uploads", "forms", submissionId, fileName));
    const extension = fileName.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf", csv: "text/csv" };
    return new Response(bytes, { headers: {
      "Content-Type": types[extension ?? ""] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="upload.${extension}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    } });
  } catch {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }
}
