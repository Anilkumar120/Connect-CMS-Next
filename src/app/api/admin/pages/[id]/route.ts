import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const pageSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255),
  description: z.string().max(1000).optional().default(""),
  content: z.string().optional().default(""),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  parentId: z.string().nullable().optional(),
  featuredImage: z.string().optional().default(""),
  seoTitle: z.string().max(255).optional().default(""),
  seoDescription: z.string().max(500).optional().default(""),
  focusKeyword: z.string().max(255).optional().default(""),
});

function getFeaturedImage(value: string) {
  if (!value) return "";

  if (
    !/^\/uploads\/pages\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(value)
  ) {
    return null;
  }

  return value;
}

// GET: Load existing active page
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const page = await prisma.page.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        content: true,
        status: true,
        parentId: true,
        seoTitle: true,
        seoDescription: true,
        focusKeyword: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    if (!page || page.status === "ARCHIVED") {
      return NextResponse.json(
        { success: false, message: "Page not found" },
        { status: 404 }
      );
    }

    const contentData =
      page.content &&
      typeof page.content === "object" &&
      !Array.isArray(page.content)
        ? (page.content as Record<string, unknown>)
        : {};

    return NextResponse.json({
      success: true,
      page: {
        ...page,
        content:
          typeof contentData.text === "string"
            ? contentData.text
            : "",
        featuredImage:
          typeof contentData.featuredImage === "string"
            ? contentData.featuredImage
            : "",
      },
    });
  } catch (error) {
    console.error("GET PAGE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load page" },
      { status: 500 }
    );
  }
}

// PUT: Update existing active page
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    const user = await getCurrentUser();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const existingPage = await prisma.page.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        content: true,
      },
    });

    if (!existingPage || existingPage.status === "ARCHIVED") {
      return NextResponse.json(
        { success: false, message: "Page not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = pageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid page data",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const slug = data.slug
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid slug" },
        { status: 400 }
      );
    }

    const duplicateSlug = await prisma.page.findFirst({
      where: {
        slug,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicateSlug) {
      return NextResponse.json(
        { success: false, message: "This slug is already in use" },
        { status: 409 }
      );
    }

    const featuredImage = getFeaturedImage(data.featuredImage);

    if (featuredImage === null) {
      return NextResponse.json(
        { success: false, message: "Invalid featured image path" },
        { status: 400 }
      );
    }

    if (data.parentId) {
      if (data.parentId === id) {
        return NextResponse.json(
          { success: false, message: "A page cannot be its own parent" },
          { status: 400 }
        );
      }

      const parent = await prisma.page.findFirst({
        where: {
          id: data.parentId,
          deletedAt: null,
          status: { not: "ARCHIVED" },
        },
        select: { id: true },
      });

      if (!parent) {
        return NextResponse.json(
          { success: false, message: "Parent page not found" },
          { status: 400 }
        );
      }

      let currentParentId: string | null = data.parentId;
      const visited = new Set<string>();

      while (currentParentId) {
        if (currentParentId === id || visited.has(currentParentId)) {
          return NextResponse.json(
            {
              success: false,
              message: "Invalid parent page hierarchy",
            },
            { status: 400 }
          );
        }

        visited.add(currentParentId);

        const currentParent: { parentId: string | null } | null =
          await prisma.page.findUnique({
            where: { id: currentParentId },
            select: { parentId: true },
          });

        currentParentId = currentParent?.parentId ?? null;
      }
    }

    const contentData =
      existingPage.content &&
      typeof existingPage.content === "object" &&
      !Array.isArray(existingPage.content)
        ? { ...(existingPage.content as Prisma.InputJsonObject) }
        : {};
    const layoutDraft = contentData.layoutDraft;

    contentData.text = data.content || "";
    contentData.featuredImage = featuredImage || "";

    if (
      data.status === "PUBLISHED" &&
      layoutDraft &&
      typeof layoutDraft === "object" &&
      !Array.isArray(layoutDraft)
    ) {
      contentData.layout = layoutDraft;
      delete contentData.layoutDraft;
    }

    const updatedPage = await prisma.page.update({
      where: { id },
      data: {
        title: data.title,
        slug,
        description: data.description,
        content: contentData,
        status: data.status,
        parentId: data.parentId || null,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        focusKeyword: data.focusKeyword,
        publishedAt:
          data.status === "PUBLISHED"
            ? existingPage.status === "PUBLISHED"
              ? undefined
              : new Date()
            : null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Page updated successfully",
      page: updatedPage,
    });
  } catch (error) {
    console.error("UPDATE PAGE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update page" },
      { status: 500 }
    );
  }
}

// DELETE: Move page to Trash (soft delete)
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    const user = await getCurrentUser();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const result = await prisma.page.updateMany({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, message: "Page not found or already in Trash." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Page moved to Trash successfully.",
    });
  } catch (error) {
    console.error("DELETE PAGE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Unable to move page to Trash." },
      { status: 500 }
    );
  }
}