import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { getPostPermalink, getSiteSettings } from "@/lib/site-settings";
import {
  getSeoManagerData,
  normalizePath,
  saveSeoManagerData,
} from "@/lib/seo-manager";

const allowedRoles = new Set(["SUPER_ADMIN", "ADMIN", "EDITOR", "SEO_MANAGER"]);

async function authorize() {
  const user = await getCurrentUser();
  return user?.isActive && allowedRoles.has(user.role) ? user : null;
}

function pagePath(pageId: string, pages: Array<{ id: string; slug: string; parentId: string | null }>) {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const segments: string[] = [];
  const visited = new Set<string>();
  let current: { id: string; slug: string; parentId: string | null } | undefined = byId.get(pageId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    segments.unshift(current.slug);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return `/${segments.join("/")}${segments.length ? "/" : ""}`;
}

export async function GET() {
  try {
    if (!(await authorize())) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const [settings, seo, pages, posts, categories, tags] = await Promise.all([
      getSiteSettings(),
      getSeoManagerData(),
      prisma.page.findMany({
        orderBy: { updatedAt: "desc" },
        take: 600,
        select: {
          id: true, title: true, slug: true, parentId: true, description: true,
          status: true, deletedAt: true, updatedAt: true, seoTitle: true,
          seoDescription: true, focusKeyword: true, canonicalUrl: true, metaRobots: true,
        },
      }),
      prisma.post.findMany({
        orderBy: { updatedAt: "desc" },
        take: 600,
        include: {
          postType: { select: { slug: true, title: true } },
          categories: { include: { category: { select: { slug: true, name: true } } } },
        },
      }),
      prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, _count: { select: { posts: true } } } }),
      prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, _count: { select: { posts: true } } } }),
    ]);

    const pageRows = pages.map((page) => ({
      id: page.id,
      type: "page" as const,
      title: page.title,
      slug: page.slug,
      url: `${settings.general.siteAddress.replace(/\/$/, "")}${pagePath(page.id, pages)}`,
      status: page.status,
      deletedAt: page.deletedAt?.toISOString() ?? null,
      updatedAt: page.updatedAt.toISOString(),
      seoTitle: page.seoTitle ?? "",
      seoDescription: page.seoDescription ?? "",
      focusKeyword: page.focusKeyword ?? "",
      canonicalUrl: page.canonicalUrl ?? "",
      metaRobots: page.metaRobots ?? "index,follow",
      ...(seo.contentMeta[`page:${page.id}`] ?? {}),
    }));

    const postRows = posts.map((post) => {
      const urlPath = post.postType
        ? `/content/${post.postType.slug}/${post.slug}/`
        : getPostPermalink(post, settings);
      return {
        id: post.id,
        type: "post" as const,
        title: post.title,
        slug: post.slug,
        url: `${settings.general.siteAddress.replace(/\/$/, "")}${urlPath}`,
        status: post.status,
        deletedAt: post.deletedAt?.toISOString() ?? null,
        updatedAt: post.updatedAt.toISOString(),
        seoTitle: post.seoTitle ?? "",
        seoDescription: post.seoDescription ?? "",
        focusKeyword: post.focusKeyword ?? "",
        canonicalUrl: seo.contentMeta[`post:${post.id}`]?.canonicalUrl ?? "",
        metaRobots: seo.contentMeta[`post:${post.id}`]?.metaRobots ?? "index,follow",
        ...(seo.contentMeta[`post:${post.id}`] ?? {}),
        contentType: post.postType?.title ?? "Post",
      };
    });

    return NextResponse.json({
      success: true,
      site: {
        title: settings.general.siteTitle,
        url: settings.general.siteAddress,
        adminEmail: settings.general.adminEmail,
      },
      global: seo.global,
      google: seo.google,
      redirects: seo.redirects,
      items: [...pageRows, ...postRows],
      taxonomies: { categories, tags },
      counts: {
        pages: pageRows.length,
        posts: postRows.length,
        published: [...pageRows, ...postRows].filter((item) => item.status === "PUBLISHED" && !item.deletedAt).length,
        trashed: [...pageRows, ...postRows].filter((item) => Boolean(item.deletedAt)).length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("SEO manager GET failed:", error);
    return NextResponse.json({ success: false, message: "Unable to load SEO manager data." }, { status: 500 });
  }
}

const globalSchema = z.object({
  titleTemplate: z.string().max(255),
  titleSeparator: z.string().max(8),
  defaultDescription: z.string().max(1000),
  defaultSocialImage: z.string().max(1000),
  googleVerification: z.string().max(500),
  bingVerification: z.string().max(500),
  sitemapEnabled: z.boolean(),
  sitemapIncludePages: z.boolean(),
  sitemapIncludePosts: z.boolean(),
  sitemapIncludeTaxonomies: z.boolean(),
  disallowPaths: z.array(z.string().max(200)).max(100),
  noindexSearch: z.boolean(),
});

const contentSchema = z.object({
  action: z.literal("save-content"),
  type: z.enum(["page", "post"]),
  id: z.string().min(1).max(191),
  seoTitle: z.string().max(255),
  seoDescription: z.string().max(1000),
  focusKeyword: z.string().max(255),
  canonicalUrl: z.string().max(500).optional().default("").refine((value) => !value.trim() || /^https?:\/\//i.test(value.trim()), { message: "Canonical URL must be an absolute HTTP(S) URL." }),
  metaRobots: z.enum(["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"]),
  ogTitle: z.string().max(255).optional().default(""),
  ogDescription: z.string().max(1000).optional().default(""),
  ogImage: z.string().max(1000).optional().default(""),
  twitterTitle: z.string().max(255).optional().default(""),
  twitterDescription: z.string().max(1000).optional().default(""),
  twitterImage: z.string().max(1000).optional().default(""),
  schemaType: z.string().max(60).optional().default("WebPage"),
});

const redirectSchema = z.object({
  action: z.literal("save-redirect"),
  id: z.string().max(191).optional(),
  from: z.string().trim().min(1).max(1000),
  to: z.string().trim().min(1).max(1000),
  code: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]),
  active: z.boolean().default(true),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save-global"), global: globalSchema }),
  z.object({ action: z.literal("save-google-settings"), searchConsoleSite: z.string().max(500), analyticsPropertyId: z.string().max(100).refine((value) => !value || /^\d+$/.test(value), { message: "Google Analytics Property ID must contain digits only." }) }),
  contentSchema,
  redirectSchema,
  z.object({ action: z.literal("trash-content"), type: z.enum(["page", "post"]), id: z.string().min(1).max(191) }),
  z.object({ action: z.literal("restore-content"), type: z.enum(["page", "post"]), id: z.string().min(1).max(191) }),
  z.object({ action: z.literal("trash-redirect"), id: z.string().min(1).max(191) }),
  z.object({ action: z.literal("restore-redirect"), id: z.string().min(1).max(191) }),
]);

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  try {
    if (!(await authorize())) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid SEO request." }, { status: 400 });
    const data = parsed.data;
    const seo = await getSeoManagerData();

    if (data.action === "save-global") {
      const next = { ...seo, global: data.global };
      await saveSeoManagerData(next);
      return NextResponse.json({ success: true, message: "SEO settings saved." });
    }

    if (data.action === "save-google-settings") {
      const next = { ...seo, google: { searchConsoleSite: data.searchConsoleSite, analyticsPropertyId: data.analyticsPropertyId } };
      await saveSeoManagerData(next);
      return NextResponse.json({ success: true, message: "Google property settings saved." });
    }

    if (data.action === "save-content") {
      const key = `${data.type}:${data.id}`;
      const extra = {
        canonicalUrl: data.canonicalUrl.trim(), metaRobots: data.metaRobots,
        ogTitle: data.ogTitle, ogDescription: data.ogDescription, ogImage: data.ogImage,
        twitterTitle: data.twitterTitle, twitterDescription: data.twitterDescription,
        twitterImage: data.twitterImage, schemaType: data.schemaType,
      };
      if (data.type === "page") {
        const result = await prisma.page.updateMany({
          where: { id: data.id, deletedAt: null },
          data: {
            seoTitle: data.seoTitle.trim() || null,
            seoDescription: data.seoDescription.trim() || null,
            focusKeyword: data.focusKeyword.trim() || null,
            canonicalUrl: data.canonicalUrl.trim() || null,
            metaRobots: data.metaRobots,
          },
        });
        if (!result.count) return NextResponse.json({ success: false, message: "Page not found or is in Trash." }, { status: 404 });
      } else {
        const result = await prisma.post.updateMany({
          where: { id: data.id, deletedAt: null },
          data: {
            seoTitle: data.seoTitle.trim() || null,
            seoDescription: data.seoDescription.trim() || null,
            focusKeyword: data.focusKeyword.trim() || null,
          },
        });
        if (!result.count) return NextResponse.json({ success: false, message: "Post not found or is in Trash." }, { status: 404 });
      }
      await saveSeoManagerData({ ...seo, contentMeta: { ...seo.contentMeta, [key]: extra } });
      return NextResponse.json({ success: true, message: "SEO metadata saved." });
    }

    if (data.action === "save-redirect") {
      const from = normalizePath(data.from);
      const to = data.to.trim();
      if (!to.startsWith("/") && !/^https?:\/\//i.test(to)) {
        return NextResponse.json({ success: false, message: "Destination must start with / or be an HTTP(S) URL." }, { status: 400 });
      }
      if (from === normalizePath(to)) return NextResponse.json({ success: false, message: "Source and destination cannot be the same." }, { status: 400 });
      const existing = data.id ? seo.redirects.find((item) => item.id === data.id) : null;
      const now = new Date().toISOString();
      const redirect = {
        id: existing?.id ?? randomUUID(), from, to, code: data.code, active: data.active,
        createdAt: existing?.createdAt ?? now, updatedAt: now, deletedAt: existing?.deletedAt ?? null,
      };
      const redirects = existing
        ? seo.redirects.map((item) => item.id === existing.id ? redirect : item)
        : [...seo.redirects, redirect];
      if (redirects.filter((item) => !item.deletedAt && item.from === from && item.id !== redirect.id).length) {
        return NextResponse.json({ success: false, message: "A redirect already exists for this source path." }, { status: 409 });
      }
      await saveSeoManagerData({ ...seo, redirects });
      return NextResponse.json({ success: true, message: "Redirect saved.", redirect });
    }

    if (data.action === "trash-redirect" || data.action === "restore-redirect") {
      const found = seo.redirects.some((item) => item.id === data.id);
      if (!found) return NextResponse.json({ success: false, message: "Redirect not found." }, { status: 404 });
      const now = new Date().toISOString();
      const redirects = seo.redirects.map((item) => item.id === data.id
        ? { ...item, deletedAt: data.action === "trash-redirect" ? now : null, updatedAt: now }
        : item);
      await saveSeoManagerData({ ...seo, redirects });
      return NextResponse.json({ success: true, message: data.action === "trash-redirect" ? "Redirect moved to Trash." : "Redirect restored." });
    }

    const deletedAt = data.action === "trash-content" ? new Date() : null;
    const result = data.type === "page"
      ? await prisma.page.updateMany({ where: { id: data.id, deletedAt: data.action === "restore-content" ? { not: null } : null }, data: { deletedAt } })
      : await prisma.post.updateMany({ where: { id: data.id, deletedAt: data.action === "restore-content" ? { not: null } : null }, data: { deletedAt } });
    if (!result.count) return NextResponse.json({ success: false, message: "Content not found or already in that state." }, { status: 404 });
    return NextResponse.json({ success: true, message: data.action === "trash-content" ? "Content moved to Trash." : "Content restored." });
  } catch (error) {
    console.error("SEO manager POST failed:", error);
    return NextResponse.json({ success: false, message: "Unable to save SEO changes." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  try {
    if (!(await authorize())) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const body = await request.json() as { type?: string; id?: string };
    if (!body.id || !body.type) return NextResponse.json({ success: false, message: "Delete target is required." }, { status: 400 });
    if (body.type === "redirect") {
      const seo = await getSeoManagerData();
      const target = seo.redirects.find((item) => item.id === body.id);
      if (!target || !target.deletedAt) return NextResponse.json({ success: false, message: "Move the redirect to Trash before permanent deletion." }, { status: 409 });
      await saveSeoManagerData({ ...seo, redirects: seo.redirects.filter((item) => item.id !== body.id) });
      return NextResponse.json({ success: true, message: "Redirect permanently deleted." });
    }
    if (body.type !== "page" && body.type !== "post") return NextResponse.json({ success: false, message: "Invalid delete target." }, { status: 400 });
    const result = body.type === "page"
      ? await prisma.page.deleteMany({ where: { id: body.id, deletedAt: { not: null } } })
      : await prisma.post.deleteMany({ where: { id: body.id, deletedAt: { not: null } } });
    if (!result.count) return NextResponse.json({ success: false, message: "Move this item to Trash before permanent deletion." }, { status: 409 });
    const seo = await getSeoManagerData();
    const contentMeta = { ...seo.contentMeta };
    delete contentMeta[`${body.type}:${body.id}`];
    await saveSeoManagerData({ ...seo, contentMeta });
    return NextResponse.json({ success: true, message: "Content permanently deleted." });
  } catch (error) {
    console.error("SEO manager DELETE failed:", error);
    return NextResponse.json({ success: false, message: "Unable to permanently delete item." }, { status: 500 });
  }
}
