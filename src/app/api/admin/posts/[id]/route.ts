import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const postSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255),
  excerpt: z.string().max(10000).optional().default(""),
  content: z.string().max(1000000).optional().default(""),
  featuredImage: z.string().max(1000).optional().default(""),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  categoryIds: z.array(z.string().min(1)).max(100).default([]),
  tagIds: z.array(z.string().min(1)).max(100).default([]),
  seoTitle: z.string().max(255).optional().default(""),
  seoDescription: z.string().max(10000).optional().default(""),
  focusKeyword: z.string().max(255).optional().default(""),
  postTypeSlug: z.string().min(1).max(100).optional(),
});

function cleanSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function validFeaturedImage(value: string) {
  return !value || (/^\/uploads\/media\/[A-Za-z0-9_%.-]+$/.test(value) && !value.includes(".."));
}

async function isAuthorized() {
  const user = await getCurrentUser();
  return Boolean(user?.isActive);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    if (!(await isAuthorized())) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const typeSlug = request.nextUrl.searchParams.get("type");
    const contentType = typeSlug
      ? await prisma.customPostType.findUnique({
          where: { slug: typeSlug },
          select: { id: true },
        })
      : null;
    if (typeSlug && !contentType) {
      return NextResponse.json(
        { success: false, message: "Custom post type not found." },
        { status: 404 }
      );
    }

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null, postTypeId: contentType?.id ?? null },
      include: {
        categories: { select: { categoryId: true } },
        tags: { select: { tagId: true } },
      },
    });
    if (!post) {
      return NextResponse.json({ success: false, message: "Post not found." }, { status: 404 });
    }
    const content = post.content && typeof post.content === "object" && !Array.isArray(post.content)
      ? post.content as { html?: unknown }
      : {};

    return NextResponse.json({
      success: true,
      post: {
        ...post,
        content: typeof content.html === "string" ? content.html : "",
        categoryIds: post.categories.map(({ categoryId }) => categoryId),
        tagIds: post.tags.map(({ tagId }) => tagId),
      },
    });
  } catch (error) {
    console.error("GET post error:", error);
    return NextResponse.json({ success: false, message: "Unable to load post." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await isAuthorized())) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    const { id } = await context.params;
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid post." },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const slug = cleanSlug(data.slug);
    if (!slug) {
      return NextResponse.json({ success: false, message: "Enter a valid post slug." }, { status: 400 });
    }
    if (!validFeaturedImage(data.featuredImage)) {
      return NextResponse.json(
        { success: false, message: "Select a valid image from the Media Library." },
        { status: 400 }
      );
    }

    const contentType = data.postTypeSlug
      ? await prisma.customPostType.findUnique({
          where: { slug: data.postTypeSlug },
          select: { id: true, hasCategories: true, hasTags: true },
        })
      : null;
    if (data.postTypeSlug && !contentType) {
      return NextResponse.json(
        { success: false, message: "Custom post type not found." },
        { status: 404 }
      );
    }
    if (
      (contentType && !contentType.hasCategories && data.categoryIds.length) ||
      (contentType && !contentType.hasTags && data.tagIds.length)
    ) {
      return NextResponse.json(
        { success: false, message: "This content type does not support the selected taxonomy." },
        { status: 400 }
      );
    }

    const [post, duplicate] = await Promise.all([
      prisma.post.findFirst({
        where: {
          id,
          deletedAt: null,
          postTypeId: contentType?.id ?? null,
        },
        select: { id: true, status: true, publishedAt: true, content: true },
      }),
      prisma.post.findFirst({ where: { slug, id: { not: id } }, select: { id: true } }),
    ]);
    if (!post) {
      return NextResponse.json({ success: false, message: "Post not found." }, { status: 404 });
    }
    if (duplicate) {
      return NextResponse.json({ success: false, message: "This post slug already exists." }, { status: 409 });
    }

    const categoryIds = [...new Set(data.categoryIds)];
    const tagIds = [...new Set(data.tagIds)];
    const [categories, tags] = await Promise.all([
      categoryIds.length ? prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true } }) : [],
      tagIds.length ? prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true } }) : [],
    ]);
    if (categories.length !== categoryIds.length || tags.length !== tagIds.length) {
      return NextResponse.json(
        { success: false, message: "One or more selected categories or tags no longer exist." },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.postCategory.deleteMany({ where: { postId: id } });
      await tx.postTag.deleteMany({ where: { postId: id } });

      const saved = await tx.post.update({
        where: { id },
        data: {
          title: data.title,
          slug,
          excerpt: data.excerpt || null,
          content: {
            ...(post.content &&
            typeof post.content === "object" &&
            !Array.isArray(post.content)
              ? (post.content as Prisma.JsonObject)
              : {}),
            editor: "tinymce",
            html: data.content,
          },
          featuredImage: data.featuredImage || null,
          status: data.status,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
          focusKeyword: data.focusKeyword || null,
          publishedAt:
            data.status === "PUBLISHED"
              ? post.publishedAt || new Date()
              : null,
        },
      });

      if (categoryIds.length) {
        await tx.postCategory.createMany({
          data: categoryIds.map((categoryId) => ({ postId: id, categoryId })),
        });
      }
      if (tagIds.length) {
        await tx.postTag.createMany({
          data: tagIds.map((tagId) => ({ postId: id, tagId })),
        });
      }
      return saved;
    });

    return NextResponse.json({ success: true, message: "Post updated successfully.", post: updated });
  } catch (error) {
    console.error("PUT post error:", error);
    return NextResponse.json({ success: false, message: "Unable to update post." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await isAuthorized())) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    const { id } = await context.params;
    const typeSlug = request.nextUrl.searchParams.get("type");
    const permanently = request.nextUrl.searchParams.get("permanent");
    if (permanently && permanently !== "true") {
      return NextResponse.json(
        { success: false, message: "Invalid delete action." },
        { status: 400 }
      );
    }
    const contentType = typeSlug
      ? await prisma.customPostType.findUnique({
          where: { slug: typeSlug },
          select: { id: true },
        })
      : null;
    if (typeSlug && !contentType) {
      return NextResponse.json(
        { success: false, message: "Custom post type not found." },
        { status: 404 }
      );
    }

    if (permanently === "true") {
      const result = await prisma.post.deleteMany({
        where: {
          id,
          deletedAt: { not: null },
          ...(contentType ? { postTypeId: contentType.id } : {}),
        },
      });
      if (!result.count) {
        return NextResponse.json(
          {
            success: false,
            message: "Trashed post not found. Only trashed posts can be permanently deleted.",
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Post permanently deleted.",
      });
    }

    const result = await prisma.post.updateMany({
      where: {
        id,
        deletedAt: null,
        ...(contentType ? { postTypeId: contentType.id } : {}),
      },
      data: { deletedAt: new Date(), status: "DRAFT" },
    });
    if (!result.count) {
      return NextResponse.json({ success: false, message: "Post not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Post moved to Trash." });
  } catch (error) {
    console.error("DELETE post error:", error);
    return NextResponse.json({ success: false, message: "Unable to delete post." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await isAuthorized())) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    const { id } = await context.params;
    const typeSlug = request.nextUrl.searchParams.get("type");
    const contentType = typeSlug
      ? await prisma.customPostType.findUnique({
          where: { slug: typeSlug },
          select: { id: true },
        })
      : null;
    if (typeSlug && !contentType) {
      return NextResponse.json(
        { success: false, message: "Custom post type not found." },
        { status: 404 }
      );
    }
    const result = await prisma.post.updateMany({
      where: {
        id,
        deletedAt: { not: null },
        ...(contentType ? { postTypeId: contentType.id } : {}),
      },
      data: { deletedAt: null, status: "DRAFT" },
    });
    if (!result.count) {
      return NextResponse.json({ success: false, message: "Trashed post not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Post restored as a draft." });
  } catch (error) {
    console.error("PATCH post restore error:", error);
    return NextResponse.json({ success: false, message: "Unable to restore post." }, { status: 500 });
  }
}
