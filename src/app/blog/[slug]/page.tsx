import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import PublicLayout from "@/components/public/PublicLayout";
import PublicPostView from "@/components/public/PublicPostView";
import { prisma } from "@/lib/prisma";
import { getPostPermalink, getSiteSettings } from "@/lib/site-settings";
import { applySeoRedirect, buildSeoTitle, getSeoManagerData } from "@/lib/seo-manager";

type Params = { slug: string };

async function getPost(slug: string) {
  return prisma.post.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, postTypeId: null },
    include: {
      categories: { include: { category: { select: { name: true, slug: true } } } },
      tags: { include: { tag: { select: { name: true, slug: true, imageUrl: true } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post Not Found | Connect Broadband", robots: { index: false, follow: false } };
  const [site, seo] = await Promise.all([getSiteSettings(), getSeoManagerData()]);
  const permalinkSettings = site;
  const extra = seo.contentMeta[`post:${post.id}`] ?? {};
  const title = post.seoTitle?.trim() || buildSeoTitle(post.title, site.general.siteTitle, seo.global.titleTemplate);
  const description = post.seoDescription?.trim() || post.excerpt || seo.global.defaultDescription;
  const canonical = extra.canonicalUrl || `${site.general.siteAddress.replace(/\/$/, "")}${getPostPermalink(post, permalinkSettings)}`;
  const image = extra.ogImage || post.featuredImage || seo.global.defaultSocialImage || undefined;
  const robots = (extra.metaRobots || "index,follow").toLowerCase();
  return {
    title, description, alternates: { canonical },
    robots: { index: !robots.includes("noindex"), follow: !robots.includes("nofollow") },
    openGraph: { type: "article", title: extra.ogTitle || title, description: extra.ogDescription || description, url: canonical, images: image ? [image] : undefined, publishedTime: post.publishedAt?.toISOString(), siteName: site.general.siteTitle },
    twitter: { card: "summary_large_image", title: extra.twitterTitle || extra.ogTitle || title, description: extra.twitterDescription || extra.ogDescription || description, images: (extra.twitterImage || image) ? [extra.twitterImage || image!] : undefined },
  };
}

export default function BlogPostPage({ params }: { params: Promise<Params> }) {
  return <Suspense fallback={null}><BlogPostContent params={params} /></Suspense>;
}

async function BlogPostContent({ params }: { params: Promise<Params> }) {
  await connection();
  const { slug } = await params;
  const redirectRule = await applySeoRedirect(`/blog/${slug}/`);
  if (redirectRule) {
    if (redirectRule.permanent) permanentRedirect(redirectRule.destination);
    redirect(redirectRule.destination);
  }
  const [post, settings] = await Promise.all([getPost(slug), getSiteSettings()]);
  if (!post) return <PublicLayout><div className="container">Post not found.</div></PublicLayout>;
  const canonical = getPostPermalink(post, settings);
  if (`/blog/${slug}` !== canonical.replace(/\/+$/, "")) permanentRedirect(canonical);
  return <PublicLayout><PublicPostView post={post} settings={settings} /></PublicLayout>;
}
