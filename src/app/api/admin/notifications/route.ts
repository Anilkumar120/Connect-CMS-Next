import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

async function authorized() {
  const user = await getCurrentUser();
  return user?.isActive ? user : null;
}

export async function GET() {
  const user = await authorized();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const [comments, submissions, payments] = await Promise.all([
      prisma.comment.findMany({ where: { status: "PENDING", deletedAt: null }, select: { id: true, authorName: true, content: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.formSubmission.findMany({ where: { status: "UNREAD", deletedAt: null }, select: { id: true, createdAt: true, form: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.paymentRequest.findMany({ where: { status: { in: ["REQUESTED", "PENDING_LOOKUP"] } }, select: { id: true, transactionNumber: true, customerName: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);

    const records = [
      ...comments.map((item) => ({ sourceType: "COMMENT", sourceId: item.id, title: "New blog comment", message: `${item.authorName}: ${item.content.slice(0, 150)}`, href: "/admin/comments?status=PENDING", createdAt: item.createdAt })),
      ...submissions.map((item) => ({ sourceType: "FORM_SUBMISSION", sourceId: item.id, title: "New form submission", message: `A new submission was received for ${item.form.title}.`, href: "/admin/forms", createdAt: item.createdAt })),
      ...payments.map((item) => ({ sourceType: "PAYMENT_REQUEST", sourceId: item.id, title: "Payment request needs attention", message: `${item.customerName} Â· ${item.transactionNumber}`, href: "/admin/payments", createdAt: item.createdAt })),
    ];

    await Promise.all(records.map((record) => prisma.adminNotification.upsert({
      where: { sourceType_sourceId: { sourceType: record.sourceType, sourceId: record.sourceId } },
      create: record,
      update: {},
    })));

    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
      prisma.adminNotification.count({ where: { readAt: null } }),
    ]);

    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error("Load admin notifications failed:", error);
    return NextResponse.json({ success: false, message: "Unable to load notifications." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const user = await authorized();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsed = z.object({ id: z.string().optional(), markAllRead: z.boolean().optional() }).safeParse(await request.json());
  if (!parsed.success || (!parsed.data.id && !parsed.data.markAllRead)) return NextResponse.json({ success: false, message: "Select a notification." }, { status: 400 });
  try {
    if (parsed.data.markAllRead) {
      await prisma.adminNotification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
    } else {
      await prisma.adminNotification.updateMany({ where: { id: parsed.data.id, readAt: null }, data: { readAt: new Date() } });
    }
    return NextResponse.json({ success: true, message: "Notifications updated." });
  } catch (error) {
    console.error("Update admin notifications failed:", error);
    return NextResponse.json({ success: false, message: "Unable to update notifications." }, { status: 500 });
  }
}
