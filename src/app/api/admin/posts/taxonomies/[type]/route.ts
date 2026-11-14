import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ type: string }> };

const categorySchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z.string().trim().min(1).max(180),
  description: z.string().max(10000).optional().default(""),
  imageUrl: z.string().max(1000).optional().default(""),
  parentId: z.string().nullable().optional(),
});

const tagSchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z.string().trim().min(1).max(180),
  imageUrl: z.string().max(1000).optional().default(""),
});

function cleanSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function validImage(value: string) {
  return !value || (/^\/uploads\/media\/[A-Za-z0-9_%.-]+$/.test(value) && !value.includes(".."));
}

async function authorized() {
  const user = await getCurrentUser();
  return Boolean(user?.isActive);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    if (!(await authorized())) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { type } = await context.params;
    if (type === "categories") {
      const categories = await prisma.category.findMany({
        orderBy: [{ parentId: "asc" }, { name: "asc" }],
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { posts: true, children: true } },
        },
      });
      return NextResponse.json({ success: true, categories });
    }
    if (type === "tags") {
      const tags = await prisma.tag.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { posts: true } } },
      });
      return NextResponse.json({ success: true, tags });
    }
    return NextResponse.json({ success: false, message: "Invalid taxonomy." }, { status: 404 });
  } catch (error) {
    console.error("GET post taxonomy error:", error);
    return NextResponse.json({ success: false, message: "Unable to load taxonomy." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await authorized())) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    const { type } = await context.params;
    const body = await request.json();

    if (type === "categories") {
      const parsed = categorySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, message: parsed.error.issues[0]?.message || "Invalid category." },
          { status: 400 }
        );
      }
      const data = parsed.data;
      const slug = cleanSlug(data.slug);
      if (!slug || !validImage(data.imageUrl)) {
        return NextResponse.json({ success: false, message: "Check the category slug and image." }, { status: 400 });
      }
      if (await prisma.category.findUnique({ where: { slug }, select: { id: true } })) {
        return NextResponse.json({ success: false, message: "This category slug already exists." }, { status: 409 });
      }
      if (data.parentId && !(await prisma.category.findUnique({ where: { id: data.parentId }, select: { id: true } }))) {
        return NextResponse.json({ success: false, message: "Parent category not found." }, { status: 400 });
      }
      const category = await prisma.category.create({
        data: {
          name: data.name,
          slug,
          description: data.description || null,
          imageUrl: data.imageUrl || null,
          parentId: data.parentId || null,
        },
      });
      return NextResponse.json({ success: true, message: "Category created.", category }, { status: 201 });
    }

    if (type === "tags") {
      const parsed = tagSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, message: parsed.error.issues[0]?.message || "Invalid tag." },
          { status: 400 }
        );
      }
      const data = parsed.data;
      const slug = cleanSlug(data.slug);
      if (!slug || !validImage(data.imageUrl)) {
        return NextResponse.json({ success: false, message: "Check the tag slug and image." }, { status: 400 });
      }
      if (await prisma.tag.findUnique({ where: { slug }, select: { id: true } })) {
        return NextResponse.json({ success: false, message: "This tag slug already exists." }, { status: 409 });
      }
      const tag = await prisma.tag.create({
        data: { name: data.name, slug, imageUrl: data.imageUrl || null },
      });
      return NextResponse.json({ success: true, message: "Tag created.", tag }, { status: 201 });
    }

    return NextResponse.json({ success: false, message: "Invalid taxonomy." }, { status: 404 });
  } catch (error) {
    console.error("POST post taxonomy error:", error);
    return NextResponse.json({ success: false, message: "Unable to create taxonomy term." }, { status: 500 });
  }
}
