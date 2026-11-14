import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ type: string; id: string }> };

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

export async function PUT(request: NextRequest, context: RouteContext) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await authorized())) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    const { type, id } = await context.params;
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
      const [current, duplicate] = await Promise.all([
        prisma.category.findUnique({ where: { id }, select: { id: true } }),
        prisma.category.findFirst({ where: { slug, id: { not: id } }, select: { id: true } }),
      ]);
      if (!current) return NextResponse.json({ success: false, message: "Category not found." }, { status: 404 });
      if (duplicate) return NextResponse.json({ success: false, message: "This category slug already exists." }, { status: 409 });
      if (data.parentId === id) return NextResponse.json({ success: false, message: "A category cannot be its own parent." }, { status: 400 });
      if (data.parentId) {
        let parentId: string | null = data.parentId;
        const visited = new Set<string>();
        while (parentId) {
          if (parentId === id || visited.has(parentId)) {
            return NextResponse.json({ success: false, message: "This parent would create a category loop." }, { status: 400 });
          }
          visited.add(parentId);
          const parentCategory: { id: string; parentId: string | null } | null =
            await prisma.category.findUnique({
            where: { id: parentId },
            select: { id: true, parentId: true },
          });
          if (!parentCategory) return NextResponse.json({ success: false, message: "Parent category not found." }, { status: 400 });
          parentId = parentCategory.parentId;
        }
      }
      const category = await prisma.category.update({
        where: { id },
        data: {
          name: data.name,
          slug,
          description: data.description || null,
          imageUrl: data.imageUrl || null,
          parentId: data.parentId || null,
        },
      });
      return NextResponse.json({ success: true, message: "Category updated.", category });
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
      const [current, duplicate] = await Promise.all([
        prisma.tag.findUnique({ where: { id }, select: { id: true } }),
        prisma.tag.findFirst({ where: { slug, id: { not: id } }, select: { id: true } }),
      ]);
      if (!current) return NextResponse.json({ success: false, message: "Tag not found." }, { status: 404 });
      if (duplicate) return NextResponse.json({ success: false, message: "This tag slug already exists." }, { status: 409 });
      const tag = await prisma.tag.update({
        where: { id },
        data: { name: data.name, slug, imageUrl: data.imageUrl || null },
      });
      return NextResponse.json({ success: true, message: "Tag updated.", tag });
    }

    return NextResponse.json({ success: false, message: "Invalid taxonomy." }, { status: 404 });
  } catch (error) {
    console.error("PUT post taxonomy error:", error);
    return NextResponse.json({ success: false, message: "Unable to update taxonomy term." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await authorized())) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    const { type, id } = await context.params;
    if (type === "categories") {
      const category = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { posts: true } } },
      });
      if (!category) return NextResponse.json({ success: false, message: "Category not found." }, { status: 404 });
      if (category._count.posts) {
        return NextResponse.json({ success: false, message: "Remove this category from its posts before deleting it." }, { status: 409 });
      }
      await prisma.category.delete({ where: { id } });
      return NextResponse.json({ success: true, message: "Category deleted." });
    }
    if (type === "tags") {
      const tag = await prisma.tag.findUnique({
        where: { id },
        include: { _count: { select: { posts: true } } },
      });
      if (!tag) return NextResponse.json({ success: false, message: "Tag not found." }, { status: 404 });
      if (tag._count.posts) {
        return NextResponse.json({ success: false, message: "Remove this tag from its posts before deleting it." }, { status: 409 });
      }
      await prisma.tag.delete({ where: { id } });
      return NextResponse.json({ success: true, message: "Tag deleted." });
    }
    return NextResponse.json({ success: false, message: "Invalid taxonomy." }, { status: 404 });
  } catch (error) {
    console.error("DELETE post taxonomy error:", error);
    return NextResponse.json({ success: false, message: "Unable to delete taxonomy term." }, { status: 500 });
  }
}
