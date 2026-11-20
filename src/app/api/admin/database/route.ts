import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const TABLE_KEYS = ["pages", "posts", "categories", "tags", "media"] as const;
type TableKey = (typeof TABLE_KEYS)[number];
const PAGE_SIZE = 25;

const pageUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]).optional(),
  seoTitle: z.string().max(255).nullable().optional(),
  seoDescription: z.string().max(10000).nullable().optional(),
  canonicalUrl: z.string().max(500).nullable().optional(),
  focusKeyword: z.string().max(255).nullable().optional(),
  metaRobots: z.string().max(100).nullable().optional(),
}).strict();

const postUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  slug: z.string().trim().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  excerpt: z.string().max(10000).nullable().optional(),
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]).optional(),
  featuredImage: z.string().max(1000).nullable().optional(),
  seoTitle: z.string().max(255).nullable().optional(),
  seoDescription: z.string().max(10000).nullable().optional(),
  focusKeyword: z.string().max(255).nullable().optional(),
}).strict();

const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(10000).nullable().optional(),
  imageUrl: z.string().max(1000).nullable().optional(),
}).strict();

const tagUpdateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  imageUrl: z.string().max(1000).nullable().optional(),
}).strict();

const mediaUpdateSchema = z.object({
  altText: z.string().max(500).nullable().optional(),
  title: z.string().max(255).nullable().optional(),
  caption: z.string().max(500).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
}).strict();

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

function isTableKey(value: unknown): value is TableKey {
  return typeof value === "string" && TABLE_KEYS.includes(value as TableKey);
}

async function authorize() {
  const user = await getCurrentUser();
  if (!user?.isActive || !["SUPER_ADMIN", "ADMIN"].includes(user.role)) return null;
  return user;
}

function isKnownRecordError(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}

export async function GET(request: NextRequest) {
  const user = await authorize();
  if (!user) return jsonError("Only administrators can access the database manager.", 403);

  const table = request.nextUrl.searchParams.get("table");
  const search = (request.nextUrl.searchParams.get("search") || "").trim().slice(0, 120);
  const view = request.nextUrl.searchParams.get("view") === "trash" ? "trash" : "active";
  const requestedPage = Number(request.nextUrl.searchParams.get("page") || "1");
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(100000, Math.floor(requestedPage))) : 1;
  const skip = (page - 1) * PAGE_SIZE;

  try {
    if (!table) {
      const [pages, posts, categories, tags, media] = await Promise.all([
        prisma.page.count({ where: { deletedAt: null } }),
        prisma.post.count({ where: { deletedAt: null } }),
        prisma.category.count(),
        prisma.tag.count(),
        prisma.mediaAsset.count({ where: { isDeleted: false } }),
      ]);

      return NextResponse.json({
        success: true,
        tables: [
          { key: "pages", label: "Pages", count: pages, canTrash: true },
          { key: "posts", label: "Posts", count: posts, canTrash: true },
          { key: "categories", label: "Categories", count: categories, canTrash: false },
          { key: "tags", label: "Tags", count: tags, canTrash: false },
          { key: "media", label: "Media Library", count: media, canTrash: true },
        ],
      });
    }

    if (!isTableKey(table)) return jsonError("Unknown or protected database table.");

    let rows: unknown[] = [];
    let total = 0;

    if (table === "pages") {
      const where: Prisma.PageWhereInput = {
        deletedAt: view === "trash" ? { not: null } : null,
        ...(search ? { OR: [{ title: { contains: search } }, { slug: { contains: search } }] } : {}),
      };
      [rows, total] = await Promise.all([
        prisma.page.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip,
          take: PAGE_SIZE,
          select: { id: true, title: true, slug: true, description: true, status: true, seoTitle: true, seoDescription: true, canonicalUrl: true, focusKeyword: true, metaRobots: true, deletedAt: true, createdAt: true, updatedAt: true },
        }),
        prisma.page.count({ where }),
      ]);
    } else if (table === "posts") {
      const where: Prisma.PostWhereInput = {
        deletedAt: view === "trash" ? { not: null } : null,
        ...(search ? { OR: [{ title: { contains: search } }, { slug: { contains: search } }] } : {}),
      };
      [rows, total] = await Promise.all([
        prisma.post.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip,
          take: PAGE_SIZE,
          select: { id: true, title: true, slug: true, excerpt: true, status: true, featuredImage: true, seoTitle: true, seoDescription: true, focusKeyword: true, deletedAt: true, createdAt: true, updatedAt: true },
        }),
        prisma.post.count({ where }),
      ]);
    } else if (table === "categories") {
      const where: Prisma.CategoryWhereInput = search
        ? { OR: [{ name: { contains: search } }, { slug: { contains: search } }] }
        : {};
      if (view === "trash") {
        rows = [];
        total = 0;
      } else {
        const [categoryRows, categoryTotal] = await Promise.all([
          prisma.category.findMany({ where, orderBy: { name: "asc" }, skip, take: PAGE_SIZE, select: { id: true, name: true, slug: true, description: true, imageUrl: true, createdAt: true, updatedAt: true, _count: { select: { posts: true } } } }),
          prisma.category.count({ where }),
        ]);
        rows = categoryRows;
        total = categoryTotal;
      }
    } else if (table === "tags") {
      const where: Prisma.TagWhereInput = search
        ? { OR: [{ name: { contains: search } }, { slug: { contains: search } }] }
        : {};
      if (view === "trash") {
        rows = [];
        total = 0;
      } else {
        const [tagRows, tagTotal] = await Promise.all([
          prisma.tag.findMany({ where, orderBy: { name: "asc" }, skip, take: PAGE_SIZE, select: { id: true, name: true, slug: true, imageUrl: true, createdAt: true, updatedAt: true, _count: { select: { posts: true } } } }),
          prisma.tag.count({ where }),
        ]);
        rows = tagRows;
        total = tagTotal;
      }
    } else {
      const where: Prisma.MediaAssetWhereInput = {
        isDeleted: view === "trash",
        ...(search ? { OR: [{ originalName: { contains: search } }, { fileName: { contains: search } }, { title: { contains: search } }] } : {}),
      };
      [rows, total] = await Promise.all([
        prisma.mediaAsset.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip,
          take: PAGE_SIZE,
          select: { id: true, fileName: true, originalName: true, mimeType: true, filePath: true, altText: true, title: true, caption: true, description: true, isDeleted: true, createdAt: true, updatedAt: true },
        }),
        prisma.mediaAsset.count({ where }),
      ]);
    }

    return NextResponse.json({ success: true, table, rows, total, page, pageSize: PAGE_SIZE, view });
  } catch (error) {
    console.error("Database manager GET error:", error);
    return jsonError("Unable to read this CMS data table.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  const user = await authorize();
  if (!user) return jsonError("Only administrators can edit database records.", 403);

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("Invalid request body.");
    const value = body as Record<string, unknown>;
    if (!isTableKey(value.table) || typeof value.id !== "string" || !value.id.trim()) return jsonError("A valid table and record ID are required.");
    if (!value.data || typeof value.data !== "object" || Array.isArray(value.data)) return jsonError("Record data is invalid.");

    const data = value.data as Record<string, unknown>;
    let record: unknown;

    if (value.table === "pages") {
      const parsed = pageUpdateSchema.safeParse(data);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid page fields.");
      record = await prisma.page.update({ where: { id: value.id }, data: parsed.data });
    } else if (value.table === "posts") {
      const parsed = postUpdateSchema.safeParse(data);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid post fields.");
      record = await prisma.post.update({ where: { id: value.id }, data: parsed.data });
    } else if (value.table === "categories") {
      const parsed = categoryUpdateSchema.safeParse(data);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid category fields.");
      record = await prisma.category.update({ where: { id: value.id }, data: parsed.data });
    } else if (value.table === "tags") {
      const parsed = tagUpdateSchema.safeParse(data);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid tag fields.");
      record = await prisma.tag.update({ where: { id: value.id }, data: parsed.data });
    } else {
      const parsed = mediaUpdateSchema.safeParse(data);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid media fields.");
      record = await prisma.mediaAsset.update({ where: { id: value.id }, data: parsed.data });
    }

    return NextResponse.json({ success: true, message: "Database record updated.", record });
  } catch (error) {
    if (isKnownRecordError(error, "P2002")) return jsonError("A record with this slug or unique value already exists.", 409);
    if (isKnownRecordError(error, "P2025")) return jsonError("Record not found.", 404);
    console.error("Database manager PATCH error:", error);
    return jsonError("Unable to update this record.", 500);
  }
}

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  const user = await authorize();
  if (!user) return jsonError("Only administrators can restore database records.", 403);

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("Invalid request body.");
    const value = body as Record<string, unknown>;
    if (value.action !== "restore" || !isTableKey(value.table) || typeof value.id !== "string") return jsonError("Invalid restore request.");

    if (value.table === "pages") {
      const current = await prisma.page.findUnique({ where: { id: value.id }, select: { deletedAt: true } });
      if (!current?.deletedAt) return jsonError("This page is not in Trash.");
      await prisma.page.update({ where: { id: value.id }, data: { deletedAt: null } });
    } else if (value.table === "posts") {
      const current = await prisma.post.findUnique({ where: { id: value.id }, select: { deletedAt: true } });
      if (!current?.deletedAt) return jsonError("This post is not in Trash.");
      await prisma.post.update({ where: { id: value.id }, data: { deletedAt: null } });
    } else if (value.table === "media") {
      const current = await prisma.mediaAsset.findUnique({ where: { id: value.id }, select: { isDeleted: true } });
      if (!current?.isDeleted) return jsonError("This media item is not in Trash.");
      await prisma.mediaAsset.update({ where: { id: value.id }, data: { isDeleted: false } });
    } else {
      return jsonError("This table does not support Trash and Restore.");
    }

    return NextResponse.json({ success: true, message: "Record restored successfully." });
  } catch (error) {
    if (isKnownRecordError(error, "P2025")) return jsonError("Record not found.", 404);
    console.error("Database manager restore error:", error);
    return jsonError("Unable to restore this record.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  const user = await authorize();
  if (!user) return jsonError("Only administrators can delete database records.", 403);

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("Invalid request body.");
    const value = body as Record<string, unknown>;
    if (!isTableKey(value.table) || typeof value.id !== "string" || !value.id.trim()) return jsonError("A valid table and record ID are required.");
    const permanent = value.permanent === true;

    if (value.table === "pages") {
      const current = await prisma.page.findUnique({ where: { id: value.id }, select: { deletedAt: true } });
      if (!current) return jsonError("Page not found.", 404);
      if (permanent) {
        if (!current.deletedAt) return jsonError("Move this page to Trash before permanently deleting it.");
        await prisma.page.delete({ where: { id: value.id } });
      } else {
        if (current.deletedAt) return jsonError("Page is already in Trash.");
        await prisma.page.update({ where: { id: value.id }, data: { deletedAt: new Date() } });
      }
    } else if (value.table === "posts") {
      const current = await prisma.post.findUnique({ where: { id: value.id }, select: { deletedAt: true } });
      if (!current) return jsonError("Post not found.", 404);
      if (permanent) {
        if (!current.deletedAt) return jsonError("Move this post to Trash before permanently deleting it.");
        await prisma.post.delete({ where: { id: value.id } });
      } else {
        if (current.deletedAt) return jsonError("Post is already in Trash.");
        await prisma.post.update({ where: { id: value.id }, data: { deletedAt: new Date() } });
      }
    } else if (value.table === "media") {
      const current = await prisma.mediaAsset.findUnique({ where: { id: value.id }, select: { isDeleted: true } });
      if (!current) return jsonError("Media item not found.", 404);
      if (permanent) {
        if (!current.isDeleted) return jsonError("Move this media item to Trash before deleting its database record.");
        await prisma.mediaAsset.delete({ where: { id: value.id } });
      } else {
        if (current.isDeleted) return jsonError("Media item is already in Trash.");
        await prisma.mediaAsset.update({ where: { id: value.id }, data: { isDeleted: true } });
      }
    } else if (value.table === "categories") {
      const current = await prisma.category.findUnique({ where: { id: value.id }, select: { _count: { select: { posts: true } } } });
      if (!current) return jsonError("Category not found.", 404);
      if (current._count.posts > 0) return jsonError("This category is assigned to posts. Remove or reassign those posts first.", 409);
      await prisma.category.delete({ where: { id: value.id } });
    } else {
      const current = await prisma.tag.findUnique({ where: { id: value.id }, select: { _count: { select: { posts: true } } } });
      if (!current) return jsonError("Tag not found.", 404);
      if (current._count.posts > 0) return jsonError("This tag is assigned to posts. Remove or reassign those posts first.", 409);
      await prisma.tag.delete({ where: { id: value.id } });
    }

    const message = permanent
      ? value.table === "media"
        ? "Media Library database record permanently deleted. The stored file was not removed."
        : "Database record permanently deleted."
      : "Record moved to Trash.";
    return NextResponse.json({ success: true, message });
  } catch (error) {
    if (isKnownRecordError(error, "P2025")) return jsonError("Record not found.", 404);
    console.error("Database manager DELETE error:", error);
    return jsonError("Unable to delete this database record.", 500);
  }
}
