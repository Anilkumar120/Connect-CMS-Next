import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const iconNames = [
  "BriefcaseBusiness",
  "CalendarDays",
  "FileText",
  "Folder",
  "Images",
  "MapPin",
  "Newspaper",
  "Package",
  "ShoppingBag",
  "Ticket",
] as const;

const schema = z.object({
  title: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  icon: z.enum(iconNames),
  hasCategories: z.boolean(),
  hasTags: z.boolean(),
});

function cleanSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function authorize() {
  const user = await getCurrentUser();
  return user?.isActive ? user : null;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    if (!(await authorize())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const contentType = await prisma.customPostType.findUnique({
      where: { id },
    });

    if (!contentType) {
      return NextResponse.json(
        { success: false, message: "Custom post type not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, contentType });
  } catch (error) {
    console.error("GET custom post type error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load the custom post type." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await authorize())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Invalid content type." },
        { status: 400 }
      );
    }

    const slug = cleanSlug(parsed.data.slug);
    if (!slug) {
      return NextResponse.json(
        { success: false, message: "Enter a valid type slug." },
        { status: 400 }
      );
    }

    const [existing, duplicate] = await Promise.all([
      prisma.customPostType.findUnique({ where: { id }, select: { id: true } }),
      prisma.customPostType.findFirst({
        where: { slug, id: { not: id } },
        select: { id: true },
      }),
    ]);

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Custom post type not found." },
        { status: 404 }
      );
    }
    if (duplicate) {
      return NextResponse.json(
        { success: false, message: "That content type slug already exists." },
        { status: 409 }
      );
    }

    const contentType = await prisma.customPostType.update({
      where: { id },
      data: { ...parsed.data, slug },
    });

    return NextResponse.json({
      success: true,
      message: "Custom post type updated.",
      contentType,
    });
  } catch (error) {
    console.error("PUT custom post type error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update the custom post type." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await authorize())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const contentType = await prisma.customPostType.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });

    if (!contentType) {
      return NextResponse.json(
        { success: false, message: "Custom post type not found." },
        { status: 404 }
      );
    }
    if (contentType._count.posts > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Move or delete its posts before deleting this content type.",
        },
        { status: 409 }
      );
    }

    await prisma.customPostType.delete({ where: { id } });
    return NextResponse.json({
      success: true,
      message: "Custom post type deleted.",
    });
  } catch (error) {
    console.error("DELETE custom post type error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to delete the custom post type." },
      { status: 500 }
    );
  }
}
