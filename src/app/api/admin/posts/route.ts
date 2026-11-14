import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";
import { getPostPermalink, getSiteSettings } from "@/lib/site-settings";

const postSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255),
  excerpt: z.string().max(10000).optional().default(""),
  content: z.string().max(1000000).optional().default(""),
  featuredImage: z.string().max(1000).optional().default(""),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  categoryIds: z.array(z.string().min(1)).max(100).default([]),
  tagIds: z.array(z.string().min(1)).max(100).default([]),
  seoTitle: z.string().max(255).optional().default(""),
  seoDescription: z.string().max(10000).optional().default(""),
  focusKeyword: z.string().max(255).optional().default(""),
  postTypeSlug: z.string().min(1).max(100).optional(),
});

function cleanSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validFeaturedImage(value: string) {
  return (
    !value ||
    (/^\/uploads\/media\/[A-Za-z0-9_%.-]+$/.test(value) &&
      !value.includes(".."))
  );
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

    const [posts, settings] = await Promise.all([
      prisma.post.findMany({
      where: { postTypeId: contentType?.id ?? null },
      orderBy: { updatedAt: "desc" },
      include: {
        categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
      }),
      getSiteSettings(),
    ]);

    return NextResponse.json({
      success: true,
      posts: posts.map((post) => ({
        ...post,
        permalink: getPostPermalink(post, settings),
      })),
    });
  } catch (error) {
    console.error("GET posts error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load posts." },
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

    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid post." },
        { status: 400 }
      );
    }

    const data = parsed.data;
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
    const slug = cleanSlug(data.slug);
    if (!slug) {
      return NextResponse.json(
        { success: false, message: "Enter a valid post slug." },
        { status: 400 }
      );
    }
    if (!validFeaturedImage(data.featuredImage)) {
      return NextResponse.json(
        { success: false, message: "Select a valid image from the Media Library." },
        { status: 400 }
      );
    }

    const existing = await prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "This post slug already exists." },
        { status: 409 }
      );
    }

    const categoryIds = [...new Set(data.categoryIds)];
    const tagIds = [...new Set(data.tagIds)];
    const [categories, tags] = await Promise.all([
      categoryIds.length
        ? prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true } })
        : [],
      tagIds.length
        ? prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true } })
        : [],
    ]);
    if (categories.length !== categoryIds.length || tags.length !== tagIds.length) {
      return NextResponse.json(
        { success: false, message: "One or more selected categories or tags no longer exist." },
        { status: 400 }
      );
    }

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          title: data.title,
          postTypeId: contentType?.id ?? null,
          slug,
          excerpt: data.excerpt || null,
          content: { editor: "tinymce", html: data.content },
          featuredImage: data.featuredImage || null,
          status: data.status,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
          focusKeyword: data.focusKeyword || null,
          publishedAt: data.status === "PUBLISHED" ? new Date() : null,
        },
      });

      if (categoryIds.length) {
        await tx.postCategory.createMany({
          data: categoryIds.map((categoryId) => ({ postId: created.id, categoryId })),
        });
      }
      if (tagIds.length) {
        await tx.postTag.createMany({
          data: tagIds.map((tagId) => ({ postId: created.id, tagId })),
        });
      }
      return created;
    });

    return NextResponse.json(
      { success: true, message: "Post created successfully.", post },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST post error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create post." },
      { status: 500 }
    );
  }
}
