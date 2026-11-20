import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { connection } from "next/server";
import CMSPageView from "@/components/public/CMSPageView";
import PublicLayout from "@/components/public/PublicLayout";
import PublicPostView, { type PublicPost } from "@/components/public/PublicPostView";
import PublicPostsListing from "@/components/public/PublicPostsListing";
import { prisma } from "@/lib/prisma";
import { getPostPermalink, getSiteSettings, matchPostPermalink } from "@/lib/site-settings";
import { applySeoRedirect, buildSeoTitle, getSeoManagerData } from "@/lib/seo-manager";

type Props = { params: Promise<{ slug: string[] }> };

async function findPublishedPage(slugs: string[]) {
  let parentId: string | null = null;
  let page = null;
  for (const slug of slugs) {
    page = await prisma.page.findFirst({
      where: { slug, parentId, status: "PUBLISHED", deletedAt: null },
      select: {
        id: true, title: true, slug: true, description: true, seoTitle: true,
        seoDescription: true, canonicalUrl: true, metaRobots: true, content: true,
      },
    });
    if (!page) return null;
    parentId = page.id;
  }
  return page;
}

async function findPostById(id: string): Promise<PublicPost | null> {
  return prisma.post.findFirst({
    where: { id, status: "PUBLISHED", deletedAt: null, postTypeId: null },
    include: {
      categories: { include: { category: { select: { name: true, slug: true } } } },
      tags: { include: { tag: { select: { name: true, slug: true, imageUrl: true } } } },
    },
  });
}

async function findPostBySlug(slug: string): Promise<PublicPost | null> {
  return prisma.post.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, postTypeId: null },
    include: {
      categories: { include: { category: { select: { name: true, slug: true } } } },
      tags: { include: { tag: { select: { name: true, slug: true, imageUrl: true } } } },
    },
  });
}

function robotsFrom(value: string | null | undefined) {
  const directive = (value || "index,follow").toLowerCase();
  return { index: !directive.includes("noindex"), follow: !directive.includes("nofollow") };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const [page, site, seo] = await Promise.all([
    findPublishedPage(slug), getSiteSettings(), getSeoManagerData(),
  ]);
  const settings = site;
  if (page) {
    const siteName = site.general.siteTitle;
    const title = page.seoTitle?.trim() || buildSeoTitle(page.title, siteName, seo.global.titleTemplate);
    const description = page.seoDescription?.trim() || page.description || seo.global.defaultDescription;
    const social = seo.contentMeta[`page:${page.id}`];
    const canonical = page.canonicalUrl?.trim() || `${site.general.siteAddress.replace(/\/$/, "")}/${slug.join("/")}/`;
    const image = social?.ogImage || seo.global.defaultSocialImage || undefined;
    return {
      title,
      description,
      alternates: { canonical },
      robots: robotsFrom(page.metaRobots),
      openGraph: {
        type: "website", title: social?.ogTitle || title,
        description: social?.ogDescription || description,
        url: canonical, images: image ? [image] : undefined, siteName,
      },
      twitter: {
        card: "summary_large_image", title: social?.twitterTitle || social?.ogTitle || title,
        description: social?.twitterDescription || social?.ogDescription || description,
        images: (social?.twitterImage || image) ? [social?.twitterImage || image!] : undefined,
      },
    };
  }

  const path = `/${slug.join("/")}`;
  const parsed = matchPostPermalink(path, settings);
  let post = parsed?.id ? await findPostById(parsed.id) : parsed?.slug ? await findPostBySlug(parsed.slug) : null;
  if (!post && slug.length) post = await findPostBySlug(slug[slug.length - 1]);
  if (!post) return { title: site.general.siteTitle, description: seo.global.defaultDescription, robots: { index: false, follow: true } };

  const extra = seo.contentMeta[`post:${post.id}`] ?? {};
  const title = post.seoTitle?.trim() || buildSeoTitle(post.title, site.general.siteTitle, seo.global.titleTemplate);
  const description = post.seoDescription?.trim() || post.excerpt || seo.global.defaultDescription;
  const canonical = extra.canonicalUrl || `${site.general.siteAddress.replace(/\/$/, "")}${getPostPermalink(post, settings)}`;
  const image = extra.ogImage || post.featuredImage || seo.global.defaultSocialImage || undefined;
  return {
    title,
    description,
    alternates: { canonical },
    robots: robotsFrom(extra.metaRobots),
    openGraph: {
      type: "article", title: extra.ogTitle || title,
      description: extra.ogDescription || description,
      url: canonical, images: image ? [image] : undefined,
      publishedTime: post.publishedAt?.toISOString(), siteName: site.general.siteTitle,
    },
    twitter: {
      card: "summary_large_image", title: extra.twitterTitle || extra.ogTitle || title,
      description: extra.twitterDescription || extra.ogDescription || description,
      images: (extra.twitterImage || image) ? [extra.twitterImage || image!] : undefined,
    },
  };
}

export default function DynamicCMSPage({ params }: Props) {
  return <Suspense fallback={null}><DynamicCMSPageContent params={params} /></Suspense>;
}

async function DynamicCMSPageContent({ params }: Props) {
  await connection();
  const { slug } = await params;
  const pathname = `/${slug.join("/")}`;
  const redirectRule = await applySeoRedirect(pathname);
  if (redirectRule) {
    if (redirectRule.permanent) permanentRedirect(redirectRule.destination);
    redirect(redirectRule.destination);
  }

  const [settings, page] = await Promise.all([getSiteSettings(), findPublishedPage(slug)]);
  if (page) {
    if (settings.reading.showOnFront === "page" && settings.reading.homepagePageId === page.id) permanentRedirect("/");
    if (settings.reading.postsPageId === page.id) return <PublicLayout><PublicPostsListing /></PublicLayout>;
    return <PublicLayout><CMSPageView page={page} /></PublicLayout>;
  }

  const parsed = matchPostPermalink(pathname, settings);
  let post = parsed?.id ? await findPostById(parsed.id) : parsed?.slug ? await findPostBySlug(parsed.slug) : null;
  if (!post) {
    const lastSegment = slug[slug.length - 1];
    if (slug[0] === "archives" && slug.length === 2) post = await findPostById(lastSegment);
    else if (lastSegment) {
      try { post = await findPostBySlug(decodeURIComponent(lastSegment)); } catch { post = null; }
    }
  }
  if (!post) notFound();
  const canonicalPath = getPostPermalink(post, settings).split("?")[0].replace(/\/+$/, "") || "/";
  const currentPath = pathname.replace(/\/+$/, "") || "/";
  if (currentPath !== canonicalPath) permanentRedirect(getPostPermalink(post, settings));
  return <PublicLayout><PublicPostView post={post} settings={settings} /></PublicLayout>;
}
