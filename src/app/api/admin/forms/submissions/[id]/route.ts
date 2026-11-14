import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(user.role)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const submission = await prisma.formSubmission.findUnique({ where: { id }, include: { form: { select: { id: true, title: true, slug: true, fields: true } } } });
  if (!submission) return NextResponse.json({ success: false, message: "Submission not found." }, { status: 404 });
  if (submission.status === "UNREAD" && !submission.deletedAt) await prisma.formSubmission.update({ where: { id }, data: { status: "READ" } });
  return NextResponse.json({ success: true, submission: { ...submission, status: submission.status === "UNREAD" ? "READ" : submission.status } });
}

export async function PATCH(request: NextRequest, context: Context) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(user.role)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const parsed = z.object({ action: z.enum(["READ", "UNREAD", "SPAM", "TRASH", "RESTORE"]) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  if (parsed.data.action === "TRASH" && !["SUPER_ADMIN", "ADMIN"].includes(user.role)) return NextResponse.json({ success: false, message: "Only administrators can delete submissions." }, { status: 403 });
  const action = parsed.data.action;
  const submission = await prisma.formSubmission.update({
    where: { id },
    data: action === "TRASH" ? { deletedAt: new Date() }
      : action === "RESTORE" ? { deletedAt: null }
      : { status: action },
  });
  return NextResponse.json({ success: true, submission });
}
