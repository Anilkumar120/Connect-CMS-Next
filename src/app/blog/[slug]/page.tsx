import type { Metadata } from "next";
import { Suspense } from "react";
import { permanentRedirect, notFound } from "next/navigation";
import PublicLayout from "@/components/public/PublicLayout";
import PublicPostView from "@/components/public/PublicPostView";
import PublicPageBuilder from "@/components/public/PublicPageBuilder";
import PublicBuilderDocument from "@/components/public/PublicBuilderDocument";
import { getPostHtml, sanitizePostHtml } from "@/lib/blog-content";
import { getBuilderLayout } from "@/lib/page-builder-content";
import { getPublishedBuilderDocument } from "@/lib/builder/public-layout";
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

  const builderDocument = await getPublishedBuilderDocument(`post:${post.id}`);
  const legacyBuilderLayout = getBuilderLayout(post.content);
  const safePostHtml = sanitizePostHtml(getPostHtml(post.content));

  return (
    <PublicLayout>
      {builderDocument?.layout.root.length ? (
        <PublicBuilderDocument
          layout={builderDocument.layout}
          globalStyles={builderDocument.globalStyles}
          postContext={{
            id: post.id,
            title: post.title,
            slug: post.slug,
            postTypeId: post.postTypeId,
            excerpt: post.excerpt,
            contentHtml: safePostHtml,
            featuredImage: post.featuredImage,
            publishedAt: post.publishedAt,
            categories: post.categories.map(({ category }: { category: { name: string; slug: string } }) => ({
              name: category.name,
              slug: category.slug,
            })),
          }}
          postUrlPrefix="/blog"
        />
      ) : legacyBuilderLayout?.elements.length ? (
        <PublicPageBuilder layout={legacyBuilderLayout} />
      ) : (
        <PublicPostView post={post} settings={settings} />
      )}
    </PublicLayout>
  );
}
