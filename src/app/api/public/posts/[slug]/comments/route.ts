import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyRequestOrigin } from "@/lib/auth/request";

type Context = { params: Promise<{ slug: string }> };
const schema = z.object({
  authorName: z.string().trim().min(2, "Enter your name.").max(120),
  authorEmail: z.string().trim().email("Enter a valid email address.").max(254),
  content: z.string().trim().min(3, "Comment is too short.").max(5000, "Comment must be under 5000 characters."),
  website: z.string().optional().default(""),
});

export async function POST(request: NextRequest, context: Context) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Invalid comment." }, { status: 400 });

    // Honeypot: silently accept bot submissions without storing them.
    if (parsed.data.website.trim()) return NextResponse.json({ success: true, message: "Your comment has been submitted for review." });

    const { slug } = await context.params;
    const post = await prisma.post.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, select: { id: true, title: true } });
    if (!post) return NextResponse.json({ success: false, message: "This blog post is unavailable." }, { status: 404 });

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = request.headers.get("x-real-ip") || forwarded || "unknown";
    const secret = process.env.SESSION_SECRET;
    const ipHash = secret ? createHash("sha256").update(`${secret}:${ip}`).digest("hex") : null;
    if (ipHash) {
      const since = new Date(Date.now() - 10 * 60 * 1000);
      const recentCount = await prisma.comment.count({ where: { ipHash, createdAt: { gte: since } } });
      if (recentCount >= 5) return NextResponse.json({ success: false, message: "Too many comments. Please try again later." }, { status: 429 });
    }

    const comment = await prisma.comment.create({ data: {
      postId: post.id,
      authorName: parsed.data.authorName,
      authorEmail: parsed.data.authorEmail.toLowerCase(),
      content: parsed.data.content,
      ipHash,
      status: "PENDING",
    }, select: { id: true, authorName: true, createdAt: true } });

    await prisma.adminNotification.upsert({
      where: { sourceType_sourceId: { sourceType: "COMMENT", sourceId: comment.id } },
      create: { sourceType: "COMMENT", sourceId: comment.id, title: "New blog comment", message: `${comment.authorName}: ${parsed.data.content.slice(0, 150)}`, href: "/admin/comments?status=PENDING" },
      update: {},
    });

    return NextResponse.json({ success: true, message: "Thank you. Your comment has been submitted and is awaiting moderation." }, { status: 201 });
  } catch (error) {
    console.error("Public comment submission failed:", error);
    return NextResponse.json({ success: false, message: "Unable to submit your comment. Please try again." }, { status: 500 });
  }
}
