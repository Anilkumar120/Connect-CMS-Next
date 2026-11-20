import type { Metadata } from "next";
import { Suspense } from "react";
import { permanentRedirect, notFound } from "next/navigation";
import PublicLayout from "@/components/public/PublicLayout";
import PublicPostView from "@/components/public/PublicPostView";
import { prisma } from "@/lib/prisma";
import {
  getPostPermalink,
  getSiteSettings,
} from "@/lib/site-settings";

type Params = { slug: string };

async function getPost(slug: string) {
  return prisma.post.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, postTypeId: null },
    include: {
      categories: {
        include: { category: { select: { name: true, slug: true } } },
      },
      tags: {
        include: { tag: { select: { name: true, slug: true, imageUrl: true } } },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post Not Found | Connect Broadband" };
  return {
    title: post.seoTitle?.trim() || `${post.title} | Connect Broadband`,
    description: post.seoDescription?.trim() || post.excerpt || undefined,
    openGraph: {
      title: post.seoTitle?.trim() || post.title,
      description: post.seoDescription?.trim() || post.excerpt || undefined,
      type: "article",
      images: post.featuredImage ? [post.featuredImage] : undefined,
      publishedTime: post.publishedAt?.toISOString(),
    },
  };
}

export default function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  return (
    <Suspense fallback={null}>
      <BlogPostContent params={params} />
    </Suspense>
  );
}

async function BlogPostContent({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([getPost(slug), getSiteSettings()]);
  if (!post) notFound();

  const canonical = getPostPermalink(post, settings);
  if (`/blog/${slug}` !== canonical.replace(/\/+$/, "")) {
    permanentRedirect(canonical);
  }

  return (
    <PublicLayout pathname={`/blog/${slug}`}>
      <PublicPostView post={post} settings={settings} />
    </PublicLayout>
  );
}
