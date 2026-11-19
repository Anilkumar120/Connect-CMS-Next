import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";
import PublicLayout from "@/components/public/PublicLayout";
import { getPostHtml, sanitizePostHtml } from "@/lib/blog-content";
import { getBuilderLayout } from "@/lib/page-builder-content";
import PublicPageBuilder from "@/components/public/PublicPageBuilder";
import PublicBuilderDocument from "@/components/public/PublicBuilderDocument";
import { getPublishedBuilderDocument } from "@/lib/builder/public-layout";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}): Promise<Metadata> {
  await connection();
  const { type, slug } = await params;
  const post = await prisma.post.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      deletedAt: null,
      postType: { slug: type },
    },
    include: { postType: { select: { title: true } } },
  });

  if (!post) return { title: "Content Not Found | Connect Broadband" };
  return {
    title: post.seoTitle?.trim() || `${post.title} | ${post.postType?.title ?? type}`,
    description: post.seoDescription?.trim() || post.excerpt || undefined,
  };
}

export default function CustomContentRoute({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="custom-content-loading">Loading...</div>}>
      {params.then(({ type, slug }) => (
        <CustomContentPage type={type} slug={slug} />
      ))}
    </Suspense>
  );
}

async function CustomContentPage({
  type,
  slug,
}: {
  type: string;
  slug: string;
}) {
  await connection();
  const post = await prisma.post.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      deletedAt: null,
      postType: { slug: type },
    },
    include: {
      postType: { select: { title: true } },
      categories: {
        include: { category: { select: { name: true, slug: true } } },
      },
      tags: { include: { tag: { select: { name: true, slug: true } } } },
    },
  });

  if (!post) notFound();

  const html = sanitizePostHtml(getPostHtml(post.content));
  const builderLayout = getBuilderLayout(post.content);
  const universalBuilderDocument = await getPublishedBuilderDocument(
    `custom:${type}:${post.id}`
  );
  const hasBuilderContent = Boolean(
    builderLayout?.elements.length ||
      universalBuilderDocument?.layout.root.length
  );
  const excerpt = post.excerpt
    ? sanitizeHtml(post.excerpt, { allowedTags: [], allowedAttributes: {} })
    : "";
  return (
    <PublicLayout>
      <main className="custom-content-page">
        <article className="custom-content-article">
          {post.featuredImage && (
            <img className="custom-content-featured" src={post.featuredImage} alt={post.title} />
          )}
          <p className="custom-content-type">{post.postType?.title ?? type}</p>
          <h1>{post.title}</h1>
          {excerpt && <p className="custom-content-excerpt">{excerpt}</p>}
          {universalBuilderDocument?.layout.root.length ? (
            <PublicBuilderDocument
              layout={universalBuilderDocument.layout}
              globalStyles={universalBuilderDocument.globalStyles}
              postContext={{
                id: post.id,
                title: post.title,
                slug: post.slug,
                postTypeId: post.postTypeId,
                excerpt: post.excerpt,
                contentHtml: html,
                featuredImage: post.featuredImage,
                publishedAt: post.publishedAt,
                categories: post.categories.map(({ category }: { category: { name: string; slug: string } }) => ({ name: category.name, slug: category.slug })),
              }}
              postUrlPrefix={`/content/${encodeURIComponent(type)}`}
            />
          ) : hasBuilderContent && builderLayout ? (
            <PublicPageBuilder layout={builderLayout} />
          ) : (
            <div
              className="custom-content-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
          {(post.categories.length > 0 || post.tags.length > 0) && (
            <footer className="custom-content-taxonomies">
              {post.categories.map(({ category }: { category: { name: string; slug: string } }) => (
                <span key={category.slug}>{category.name}</span>
              ))}
              {post.tags.map(({ tag }: { tag: { name: string; slug: string } }) => (
                <span key={tag.slug}>#{tag.name}</span>
              ))}
            </footer>
          )}
        </article>
        <style>{`
          .custom-content-page { min-height: 60vh; padding: 45px 20px 70px; background: #fff; color: #233144; }
          .custom-content-article { width: 100%; max-width: 900px; margin: 0 auto; }
          .custom-content-article h1 { margin: 8px 0 16px; color: #0c2f55; font-size: clamp(30px, 5vw, 46px); line-height: 1.15; }
          .custom-content-type { margin: 0; color: #3984e8; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
          .custom-content-featured { display: block; width: 100%; max-height: 480px; margin-bottom: 28px; border-radius: 10px; object-fit: cover; }
          .custom-content-excerpt { color: #667085; font-size: 18px; line-height: 1.6; }
          .custom-content-body { margin-top: 28px; font-size: 16px; line-height: 1.8; overflow-wrap: anywhere; }
          .custom-content-body img { max-width: 100%; height: auto; }
          .custom-content-taxonomies { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 35px; }
          .custom-content-taxonomies span { padding: 6px 10px; border-radius: 20px; background: #eff5fb; color: #315779; font-size: 12px; }
        `}</style>
      </main>
    </PublicLayout>
  );
}
