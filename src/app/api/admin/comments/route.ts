
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const roles = ["SUPER_ADMIN", "ADMIN", "EDITOR"];

async function authorized() {
  const user = await getCurrentUser();

  return user?.isActive && roles.includes(user.role)
    ? user
    : null;
}

export async function GET(request: NextRequest) {
  const user = await authorized();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  const params = request.nextUrl.searchParams;
  const view = params.get("view") || "all";
  const q = (params.get("q") || "").trim().slice(0, 100);

  const where = {
    ...(view === "trash"
      ? { deletedAt: { not: null } }
      : { deletedAt: null }),

    ...(view === "pending"
      ? { status: "PENDING" as const }
      : {}),

    ...(view === "approved"
      ? { status: "APPROVED" as const }
      : {}),

    ...(view === "spam"
      ? { status: "SPAM" as const }
      : {}),

    ...(q
      ? {
          OR: [
            { authorName: { contains: q } },
            { authorEmail: { contains: q } },
            { content: { contains: q } },
            { post: { title: { contains: q } } },
          ],
        }
      : {}),
  };

  try {
    const [
      comments,
      all,
      pending,
      approved,
      spam,
      trash,
    ] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          post: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 250,
      }),

      prisma.comment.count({
        where: { deletedAt: null },
      }),

      prisma.comment.count({
        where: {
          deletedAt: null,
          status: "PENDING",
        },
      }),

      prisma.comment.count({
        where: {
          deletedAt: null,
          status: "APPROVED",
        },
      }),

      prisma.comment.count({
        where: {
          deletedAt: null,
          status: "SPAM",
        },
      }),

      prisma.comment.count({
        where: {
          deletedAt: { not: null },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      comments,
      counts: {
        all,
        pending,
        approved,
        spam,
        trash,
      },
    });
  } catch (error) {
    console.error("Load comments failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load comments.",
      },
      { status: 500 }
    );
  }
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum([
      "approve",
      "pending",
      "spam",
      "trash",
      "restore",
    ]),
    id: z.string().min(1),
  }),

  z.object({
    action: z.literal("edit"),
    id: z.string().min(1),
    authorName: z.string().trim().min(1).max(120),
    authorEmail: z.string().trim().email().max(254),
    content: z.string().trim().min(1).max(5000),
  }),
]);

export async function PATCH(request: NextRequest) {
  const originError = verifyRequestOrigin(request);

  if (originError) return originError;

  const user = await authorized();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  const parsed = patchSchema.safeParse(
    await request.json()
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message:
          parsed.error.issues[0]?.message ||
          "Invalid comment action.",
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (
    data.action === "trash" &&
    !["SUPER_ADMIN", "ADMIN"].includes(user.role)
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Only administrators can move comments to Trash.",
      },
      { status: 403 }
    );
  }

  try {
    let comment: Awaited<
      ReturnType<typeof prisma.comment.update>
    >;

    // Switch statement ensures correct TypeScript narrowing.
    switch (data.action) {
      case "approve":
        comment = await prisma.comment.update({
          where: { id: data.id },
          data: { status: "APPROVED" },
        });
        break;

      case "pending":
        comment = await prisma.comment.update({
          where: { id: data.id },
          data: { status: "PENDING" },
        });
        break;

      case "spam":
        comment = await prisma.comment.update({
          where: { id: data.id },
          data: { status: "SPAM" },
        });
        break;

      case "trash":
        comment = await prisma.comment.update({
          where: { id: data.id },
          data: { deletedAt: new Date() },
        });
        break;

      case "restore":
        comment = await prisma.comment.update({
          where: { id: data.id },
          data: { deletedAt: null },
        });
        break;

      case "edit":
        comment = await prisma.comment.update({
          where: { id: data.id },
          data: {
            authorName: data.authorName,
            authorEmail: data.authorEmail.toLowerCase(),
            content: data.content,
          },
        });
        break;

      default: {
        const exhaustiveCheck: never = data;
        return NextResponse.json(
          {
            success: false,
            message: "Unsupported comment action.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      comment,
      message: "Comment updated.",
    });
  } catch (error) {
    console.error("Update comment failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update comment.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const originError = verifyRequestOrigin(request);

  if (originError) return originError;

  const user = await getCurrentUser();

  if (
    !user?.isActive ||
    !["SUPER_ADMIN", "ADMIN"].includes(user.role)
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Only administrators can permanently delete comments.",
      },
      { status: 403 }
    );
  }

  const parsed = z
    .object({ id: z.string().min(1) })
    .safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Comment ID is required.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.comment.deleteMany({
      where: {
        id: parsed.data.id,
        deletedAt: { not: null },
      },
    });

    if (!result.count) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Move the comment to Trash before permanent deletion.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Comment permanently deleted.",
    });
  } catch (error) {
    console.error("Delete comment failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to permanently delete comment.",
      },
      { status: 500 }
    );
  }
}
