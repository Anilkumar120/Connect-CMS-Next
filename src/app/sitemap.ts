import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPostPermalink, getSiteSettings } from "@/lib/site-settings";
import { getSeoManagerData } from "@/lib/seo-manager";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [site, seo] = await Promise.all([getSiteSettings(), getSeoManagerData()]);
  if (!seo.global.sitemapEnabled) return [];

  const base = site.general.siteAddress.replace(/\/$/, "");
  const urls: MetadataRoute.Sitemap = [{ url: `${base}/`, changeFrequency: "weekly", priority: 1 }];

  if (seo.global.sitemapIncludePages) {
    const pages = await prisma.page.findMany({
      select: { id: true, slug: true, parentId: true, updatedAt: true, canonicalUrl: true, metaRobots: true, status: true, deletedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    const byId = new Map(pages.map((page) => [page.id, page]));
    for (const page of pages) {
      if (page.status !== "PUBLISHED" || page.deletedAt) continue;
      if (page.metaRobots?.toLowerCase().includes("noindex")) continue;
      const parts: string[] = [];
      const visited = new Set<string>();
      let current = byId.get(page.id);
      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        parts.unshift(current.slug);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      const path = `/${parts.join("/")}/`;
      urls.push({ url: page.canonicalUrl && /^https?:\/\//i.test(page.canonicalUrl) ? page.canonicalUrl : `${base}${path}`, lastModified: page.updatedAt, changeFrequency: "monthly", priority: 0.7 });
    }
  }

  if (seo.global.sitemapIncludePosts) {
    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      include: {
        postType: { select: { slug: true } },
        categories: { include: { category: { select: { slug: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    });
    for (const post of posts) {
      const meta = seo.contentMeta[`post:${post.id}`];
      if (meta?.metaRobots?.toLowerCase().includes("noindex")) continue;
      const path = post.postType ? `/content/${post.postType.slug}/${post.slug}/` : getPostPermalink(post, site);
      urls.push({ url: meta?.canonicalUrl && /^https?:\/\//i.test(meta.canonicalUrl) ? meta.canonicalUrl : `${base}${path}`, lastModified: post.updatedAt, changeFrequency: "weekly", priority: 0.65 });
    }
  }

  if (seo.global.sitemapIncludeTaxonomies) {
    const [categories, tags] = await Promise.all([
      prisma.category.findMany({ where: { posts: { some: { post: { status: "PUBLISHED", deletedAt: null, postTypeId: null } } } }, select: { slug: true, updatedAt: true } }),
      prisma.tag.findMany({ where: { posts: { some: { post: { status: "PUBLISHED", deletedAt: null, postTypeId: null } } } }, select: { slug: true, updatedAt: true } }),
    ]);
    for (const category of categories) urls.push({ url: `${base}/blog/category/${category.slug}/`, lastModified: category.updatedAt, changeFrequency: "weekly", priority: 0.4 });
    for (const tag of tags) urls.push({ url: `${base}/blog/tag/${tag.slug}/`, lastModified: tag.updatedAt, changeFrequency: "weekly", priority: 0.3 });
  }

  const seen = new Set<string>();
  return urls.filter((entry) => {
    const normalized = entry.url.replace(/\/$/, "");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
