import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const pageSchema = z.object({
  title: z.string().trim().min(1, "Page title is required").max(255),
  slug: z.string().trim().min(1, "Page slug is required").max(255),
  description: z.string().max(10000).optional().default(""),
  content: z.string().max(1000000).optional().default(""),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  parentId: z.string().nullable().optional(),
  featuredImage: z.string().max(1000).optional().default(""),
  seoTitle: z.string().max(255).optional().default(""),
  seoDescription: z.string().max(10000).optional().default(""),
  focusKeyword: z.string().max(255).optional().default(""),
});

function makePermalink(slug: string, parentPermalink = "") {
  const cleanSlug = slug.replace(/^\/+|\/+$/g, "");
  return `${parentPermalink}/${cleanSlug}/`.replace(/\/+/g, "/");
}

// GET: Active pages for parent dropdown
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const pages = await prisma.page.findMany({
      where: {
        deletedAt: null,
        status: { not: "ARCHIVED" },
      },
      orderBy: {
        title: "asc",
      },
      select: {
        id: true,
        title: true,
        slug: true,
        parentId: true,
      },
    });

    const pageMap = new Map(pages.map((page) => [page.id, page]));
    const permalinkCache = new Map<string, string>();

    function getPagePermalink(
      pageId: string,
      visited = new Set<string>()
    ): string {
      const cached = permalinkCache.get(pageId);
      if (cached) return cached;

      const page = pageMap.get(pageId);
      if (!page) return "/";

      if (visited.has(pageId)) return "/";

      visited.add(pageId);

      const parentPermalink = page.parentId
        ? getPagePermalink(page.parentId, visited)
        : "";

      const permalink = makePermalink(page.slug, parentPermalink);

      permalinkCache.set(pageId, permalink);
      return permalink;
    }

    const formattedPages = pages.map((page) => ({
      ...page,
      permalink: getPagePermalink(page.id),
    }));

    return NextResponse.json({
      success: true,
      pages: formattedPages,
    });
  } catch (error) {
    console.error("Fetch pages error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch pages." },
      { status: 500 }
    );
  }
}

// POST: Create page
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validation = pageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            validation.error.issues[0]?.message ||
            "Invalid page information.",
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    const slug = data.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid page slug." },
        { status: 400 }
      );
    }

    // Slugs remain unique, including pages in Trash.
    const existingPage = await prisma.page.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingPage) {
      return NextResponse.json(
        { success: false, message: "This page slug already exists." },
        { status: 409 }
      );
    }

    const parentId = data.parentId || null;

    if (parentId) {
      const parentPage = await prisma.page.findFirst({
        where: {
          id: parentId,
          deletedAt: null,
          status: { not: "ARCHIVED" },
        },
        select: { id: true },
      });

      if (!parentPage) {
        return NextResponse.json(
          { success: false, message: "Selected parent page was not found." },
          { status: 400 }
        );
      }
    }

    const featuredImage = data.featuredImage.trim();

    if (
      featuredImage &&
      !/^\/uploads\/pages\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(
        featuredImage
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid featured image." },
        { status: 400 }
      );
    }

    const page = await prisma.page.create({
      data: {
        title: data.title,
        slug,
        description: data.description || null,
        content: {
          text: data.content || "",
          featuredImage: featuredImage || "",
        },
        status: data.status,
        parentId,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        focusKeyword: data.focusKeyword || null,
        publishedAt:
          data.status === "PUBLISHED" ? new Date() : null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        parentId: true,
        content: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Page created successfully.",
        page,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create page error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to create page." },
      { status: 500 }
    );
  }
}