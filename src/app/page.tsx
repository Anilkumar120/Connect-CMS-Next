import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import PublicLayout from "@/components/public/PublicLayout";
import CMSPageView from "@/components/public/CMSPageView";
import PublicPostView from "@/components/public/PublicPostView";
import PublicPostsListing from "@/components/public/PublicPostsListing";
import { prisma } from "@/lib/prisma";
import { getPostPermalink, getSiteSettings } from "@/lib/site-settings";
import { buildSeoTitle, getSeoContentMeta, getSeoManagerData } from "@/lib/seo-manager";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  await connection();
  const [settings, seo, query] = await Promise.all([getSiteSettings(), getSeoManagerData(), searchParams]);
  const hasSearchQuery = [query.s, query.search, query.q].some((value) => typeof value === "string" && value.trim().length > 0);
  const searchRobots = seo.global.noindexSearch && hasSearchQuery
    ? { index: false, follow: true }
    : undefined;

  // Legacy query-string post URLs (/?p=POST_ID) need the post's own SEO metadata.
  const queryPostId = typeof query.p === "string" ? query.p : "";
  if (queryPostId) {
    const post = await prisma.post.findFirst({
      where: { id: queryPostId, status: "PUBLISHED", deletedAt: null, postTypeId: null },
      select: {
        id: true,
        title: true,
        excerpt: true,
        seoTitle: true,
        seoDescription: true,
        slug: true,
        publishedAt: true,
        featuredImage: true,
        categories: { include: { category: { select: { slug: true } } } },
        createdAt: true,
      },
    });
    if (post) {
      const extra = await getSeoContentMeta("post", post.id);
      const title = post.seoTitle?.trim() || buildSeoTitle(post.title, settings.general.siteTitle, seo.global.titleTemplate);
      const description = post.seoDescription?.trim() || post.excerpt || seo.global.defaultDescription;
      const canonical = extra.canonicalUrl || `${settings.general.siteAddress.replace(/\/$/, "")}${getPostPermalink(post, settings)}`;
      const robots = (extra.metaRobots || "index,follow").toLowerCase();
      const image = extra.ogImage || post.featuredImage || seo.global.defaultSocialImage || undefined;
      return {
        title,
        description,
        alternates: { canonical },
        robots: {
          index: !searchRobots && !robots.includes("noindex"),
          follow: !robots.includes("nofollow"),
        },
        openGraph: {
          type: "article",
          title: extra.ogTitle || title,
          description: extra.ogDescription || description,
          url: canonical,
          images: image ? [image] : undefined,
          siteName: settings.general.siteTitle,
          publishedTime: post.publishedAt?.toISOString(),
        },
        twitter: {
          card: "summary_large_image",
          title: extra.twitterTitle || extra.ogTitle || title,
          description: extra.twitterDescription || extra.ogDescription || description,
          images: (extra.twitterImage || image) ? [extra.twitterImage || image!] : undefined,
        },
      };
    }
  }

  if (settings.reading.showOnFront === "page" && settings.reading.homepagePageId) {
    const page = await prisma.page.findFirst({
      where: { id: settings.reading.homepagePageId, status: "PUBLISHED", deletedAt: null },
      select: { id: true, title: true, description: true, seoTitle: true, seoDescription: true, canonicalUrl: true, metaRobots: true },
    });
    if (page) {
      const title = page.seoTitle?.trim() || buildSeoTitle(page.title, settings.general.siteTitle, seo.global.titleTemplate);
      const description = page.seoDescription?.trim() || page.description || seo.global.defaultDescription;
      const robots = (page.metaRobots || "index,follow").toLowerCase();
      const social = seo.contentMeta[`page:${page.id}`];
      const image = social?.ogImage || seo.global.defaultSocialImage || undefined;
      return {
        title, description,
        alternates: page.canonicalUrl ? { canonical: page.canonicalUrl } : { canonical: `${settings.general.siteAddress.replace(/\/$/, "")}/` },
        robots: { index: !searchRobots && !robots.includes("noindex"), follow: !robots || !robots.includes("nofollow") },
        openGraph: { type: "website", title: social?.ogTitle || title, description: social?.ogDescription || description, url: page.canonicalUrl || settings.general.siteAddress, images: image ? [image] : undefined, siteName: settings.general.siteTitle },
        twitter: { card: "summary_large_image", title: social?.twitterTitle || social?.ogTitle || title, description: social?.twitterDescription || social?.ogDescription || description, images: (social?.twitterImage || image) ? [social?.twitterImage || image!] : undefined },
      };
    }
  }
  return {
    title: settings.general.siteTitle,
    description: seo.global.defaultDescription || settings.general.tagline,
    ...(searchRobots ? { robots: searchRobots } : {}),
    alternates: { canonical: `${settings.general.siteAddress.replace(/\/$/, "")}/` },
    openGraph: { type: "website", siteName: settings.general.siteTitle, title: settings.general.siteTitle, description: seo.global.defaultDescription, images: seo.global.defaultSocialImage ? [seo.global.defaultSocialImage] : undefined },
  };
}

export default function Home({ searchParams }: Props) {
  return <Suspense fallback={null}><HomeContent searchParams={searchParams} /></Suspense>;
}

async function HomeContent({ searchParams }: Props) {
  await connection();
  const [settings, query] = await Promise.all([getSiteSettings(), searchParams]);
  const postId = typeof query.p === "string" ? query.p : "";
  if (postId) {
    try {
      const post = await prisma.post.findFirst({
        where: { id: postId, status: "PUBLISHED", deletedAt: null, postTypeId: null },
        include: {
          categories: { include: { category: { select: { name: true, slug: true } } } },
          tags: { include: { tag: { select: { name: true, slug: true, imageUrl: true } } } },
        },
      });
      if (post) return <PublicLayout><PublicPostView post={post} settings={settings} /></PublicLayout>;
    } catch (error) {
      console.error("Homepage post query failed:", error);
    }
  }

  if (settings.reading.showOnFront === "page" && settings.reading.homepagePageId) {
    try {
      const page = await prisma.page.findFirst({
        where: { id: settings.reading.homepagePageId, status: "PUBLISHED", deletedAt: null },
        select: { id: true, title: true, slug: true, description: true, seoTitle: true, seoDescription: true, canonicalUrl: true, content: true },
      });
      if (page) return <PublicLayout><CMSPageView page={page} /></PublicLayout>;
    } catch (error) {
      console.error("Homepage CMS page query failed:", error);
    }
  }
  return <PublicLayout><PublicPostsListing /></PublicLayout>;
}
