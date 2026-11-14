import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["TRASH", "RESTORE", "PERMANENT_DELETE"]),
  postTypeSlug: z.string().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    const user = await getCurrentUser();
    if (!user?.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Select posts and a valid bulk action." },
        { status: 400 }
      );
    }

    const { ids, action, postTypeSlug } = parsed.data;
    const contentType = postTypeSlug
      ? await prisma.customPostType.findUnique({
          where: { slug: postTypeSlug },
          select: { id: true },
        })
      : null;
    if (postTypeSlug && !contentType) {
      return NextResponse.json(
        { success: false, message: "Custom post type not found." },
        { status: 404 }
      );
    }

    const where = {
      id: { in: [...new Set(ids)] },
      postTypeId: contentType?.id ?? null,
    };

    if (action === "PERMANENT_DELETE") {
      const result = await prisma.post.deleteMany({
        where: { ...where, deletedAt: { not: null } },
      });
      return NextResponse.json({ success: true, count: result.count });
    }

    const result = await prisma.post.updateMany({
      where:
        action === "TRASH"
          ? { ...where, deletedAt: null }
          : { ...where, deletedAt: { not: null } },
      data:
        action === "TRASH"
          ? { deletedAt: new Date(), status: "DRAFT" }
          : { deletedAt: null, status: "DRAFT" },
    });
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Bulk post action error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update selected posts." },
      { status: 500 }
    );
  }
}
