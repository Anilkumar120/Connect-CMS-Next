import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getSeoManagerData } from "@/lib/seo-manager";
import { getPostPermalink, getSiteSettings } from "@/lib/site-settings";

function score(row: { seoTitle: string | null; seoDescription: string | null; focusKeyword: string | null; canonicalUrl?: string | null }, url: string) {
  let value = 0;
  const title = row.seoTitle?.trim() ?? "";
  const description = row.seoDescription?.trim() ?? "";
  const keyword = row.focusKeyword?.trim().toLowerCase() ?? "";
  if (title) value += 20;
  if (title.length >= 30 && title.length <= 60) value += 15;
  if (description) value += 20;
  if (description.length >= 120 && description.length <= 160) value += 15;
  if (keyword) value += 10;
  if (keyword && title.toLowerCase().includes(keyword)) value += 10;
  if (keyword && description.toLowerCase().includes(keyword)) value += 5;
  if (row.canonicalUrl?.trim() || url) value += 5;
  return Math.min(100, value);
}

function csvEscape(value: unknown): string {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.isActive || !["SUPER_ADMIN", "ADMIN", "EDITOR", "SEO_MANAGER"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const [pages, posts, seo, site] = await Promise.all([
      prisma.page.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, slug: true, parentId: true, status: true, deletedAt: true, updatedAt: true, seoTitle: true, seoDescription: true, focusKeyword: true, canonicalUrl: true, metaRobots: true },
      }),
      prisma.post.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          postType: { select: { slug: true } },
          categories: { include: { category: { select: { slug: true } } } },
        },
      }),
      getSeoManagerData(),
      getSiteSettings(),
    ]);

    const base = site.general.siteAddress.replace(/\/$/, "");
    const pageById = new Map(pages.map((page) => [page.id, page]));
    const getPagePath = (pageId: string) => {
      const segments: string[] = [];
      const visited = new Set<string>();
      let current = pageById.get(pageId);
      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        segments.unshift(current.slug);
        current = current.parentId ? pageById.get(current.parentId) : undefined;
      }
      return `/${segments.join("/")}/`;
    };

    const rows = [
      ...pages.map((item) => {
        const url = `${base}${getPagePath(item.id)}`;
        return {
          type: "Page", id: item.id, title: item.title, url,
          status: item.deletedAt ? "TRASH" : item.status,
          seoTitle: item.seoTitle ?? "", seoDescription: item.seoDescription ?? "",
          focusKeyword: item.focusKeyword ?? "", canonicalUrl: item.canonicalUrl ?? "",
          robots: item.metaRobots ?? "index,follow", score: score(item, url), updatedAt: item.updatedAt,
        };
      }),
      ...posts.map((item) => {
        const meta = seo.contentMeta[`post:${item.id}`] ?? {};
        const urlPath = item.postType ? `/content/${item.postType.slug}/${item.slug}/` : getPostPermalink(item, site);
        const url = `${base}${urlPath}`;
        return {
          type: item.postType ? "Custom Post" : "Post", id: item.id, title: item.title, url,
          status: item.deletedAt ? "TRASH" : item.status,
          seoTitle: item.seoTitle ?? "", seoDescription: item.seoDescription ?? "",
          focusKeyword: item.focusKeyword ?? "", canonicalUrl: meta.canonicalUrl ?? "",
          robots: meta.metaRobots ?? "index,follow", score: score(item, url), updatedAt: item.updatedAt,
        };
      }),
    ];

    const format = new URL(request.url).searchParams.get("format") || "csv";
    if (format === "json") {
      return new NextResponse(JSON.stringify({ generatedAt: new Date().toISOString(), site: base, rows }, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": "attachment; filename=connect-broadband-seo-report.json", "Cache-Control": "no-store" },
      });
    }
    const headers = ["Type", "ID", "Title", "URL", "Status", "SEO Title", "SEO Description", "Focus Keyword", "Canonical URL", "Robots", "SEO Score", "Updated At"];
    const lines = [headers.map(csvEscape).join(","), ...rows.map((row) => [row.type, row.id, row.title, row.url, row.status, row.seoTitle, row.seoDescription, row.focusKeyword, row.canonicalUrl, row.robots, row.score, row.updatedAt].map(csvEscape).join(","))];
    return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=connect-broadband-seo-report.csv", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("SEO report export failed:", error);
    return NextResponse.json({ success: false, message: "Unable to generate SEO report." }, { status: 500 });
  }
}
