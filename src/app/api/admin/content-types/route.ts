import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

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

const contentTypeSchema = z.object({
  title: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  icon: z.enum(iconNames).default("FileText"),
  hasCategories: z.boolean().default(true),
  hasTags: z.boolean().default(true),
});

function cleanSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function authorize() {
  const user = await getCurrentUser();
  return user?.isActive ? user : null;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await authorize())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const slug = request.nextUrl.searchParams.get("slug");
    if (slug) {
      const contentType = await prisma.customPostType.findUnique({
        where: { slug },
      });
      if (!contentType) {
        return NextResponse.json(
          { success: false, message: "Custom post type not found." },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, contentType });
    }

    const contentTypes = await prisma.customPostType.findMany({
      orderBy: { title: "asc" },
      include: { _count: { select: { posts: true } } },
    });

    return NextResponse.json({ success: true, contentTypes });
  } catch (error) {
    console.error("GET custom post types error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load custom post types." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await authorize())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const parsed = contentTypeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Invalid content type.",
        },
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

    const existing = await prisma.customPostType.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "That content type slug already exists." },
        { status: 409 }
      );
    }

    const contentType = await prisma.customPostType.create({
      data: { ...parsed.data, slug },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Custom post type created.",
        contentType,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST custom post type error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create the custom post type." },
      { status: 500 }
    );
  }
}
