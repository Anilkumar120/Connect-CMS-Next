import type { Metadata } from "next";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";
import PublicLayout from "@/components/public/PublicLayout";
import SeoJsonLd from "@/components/public/SeoJsonLd";
import { getPostHtml, sanitizePostHtml } from "@/lib/blog-content";
import { getBuilderLayout } from "@/lib/page-builder-content";
import PublicPageBuilder from "@/components/public/PublicPageBuilder";
import PublicBuilderDocument from "@/components/public/PublicBuilderDocument";
import { getPublishedBuilderDocument } from "@/lib/builder/public-layout";
import { applySeoRedirect, buildSeoTitle, getSeoContentMeta, getSeoManagerData } from "@/lib/seo-manager";
import { getSiteSettings } from "@/lib/site-settings";

export async function generateMetadata({ params }: { params: Promise<{ type: string; slug: string }> }): Promise<Metadata> {
  await connection();
  const { type, slug } = await params;
  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, postType: { slug: type } },
    include: { postType: { select: { title: true } } },
  });
  if (!post) return { title: "Content Not Found | Connect Broadband", robots: { index: false, follow: false } };
  const [site, seo] = await Promise.all([getSiteSettings(), getSeoManagerData()]);
  const extra = seo.contentMeta[`post:${post.id}`] ?? {};
  const title = post.seoTitle?.trim() || buildSeoTitle(post.title, site.general.siteTitle, seo.global.titleTemplate);
  const description = post.seoDescription?.trim() || post.excerpt || seo.global.defaultDescription;
  const canonical = extra.canonicalUrl || `${site.general.siteAddress.replace(/\/$/, "")}/content/${type}/${slug}/`;
  const image = extra.ogImage || post.featuredImage || seo.global.defaultSocialImage || undefined;
  const robots = (extra.metaRobots || "index,follow").toLowerCase();
  return {
    title, description, alternates: { canonical },
    robots: { index: !robots.includes("noindex"), follow: !robots.includes("nofollow") },
    openGraph: { type: "article", title: extra.ogTitle || title, description: extra.ogDescription || description, url: canonical, images: image ? [image] : undefined, siteName: site.general.siteTitle, publishedTime: post.publishedAt?.toISOString() },
    twitter: { card: "summary_large_image", title: extra.twitterTitle || extra.ogTitle || title, description: extra.twitterDescription || extra.ogDescription || description, images: (extra.twitterImage || image) ? [extra.twitterImage || image!] : undefined },
  };
}

export default function CustomContentRoute({ params }: { params: Promise<{ type: string; slug: string }> }) {
  return <Suspense fallback={<div className="custom-content-loading">Loading...</div>}>
    {params.then(({ type, slug }) => <CustomContentPage type={type} slug={slug} />)}
  </Suspense>;
}

async function CustomContentPage({ type, slug }: { type: string; slug: string }) {
  await connection();
  const redirectRule = await applySeoRedirect(`/content/${type}/${slug}/`);
  if (redirectRule) {
    if (redirectRule.permanent) permanentRedirect(redirectRule.destination);
    redirect(redirectRule.destination);
  }
  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, postType: { slug: type } },
    include: {
      postType: { select: { title: true } },
      categories: { include: { category: { select: { name: true, slug: true } } } },
      tags: { include: { tag: { select: { name: true, slug: true } } } },
    },
  });
  if (!post) notFound();

  const [site, extra] = await Promise.all([
    getSiteSettings(),
    getSeoContentMeta("post", post.id),
  ]);
  const html = sanitizePostHtml(getPostHtml(post.content));
  const builderLayout = getBuilderLayout(post.content);
  const universalBuilderDocument = await getPublishedBuilderDocument(`custom:${type}:${post.id}`);
  const hasBuilderContent = Boolean(builderLayout?.elements.length || universalBuilderDocument?.layout.root.length);
  const excerpt = post.excerpt ? sanitizeHtml(post.excerpt, { allowedTags: [], allowedAttributes: {} }) : "";
  return (
    <PublicLayout>
      <SeoJsonLd
        schemaType={extra.schemaType || "BlogPosting"}
        title={post.title}
        description={extra.ogDescription || post.excerpt}
        url={extra.canonicalUrl || `${site.general.siteAddress.replace(/\/$/, "")}/content/${type}/${slug}/`}
        image={extra.ogImage || post.featuredImage}
        siteName={site.general.siteTitle}
        publishedAt={post.publishedAt}
        modifiedAt={post.updatedAt}
      />
      <main className="custom-content-page">
        <article
          className="custom-content-article"
          style={universalBuilderDocument?.layout.root.length ? { maxWidth: "none", padding: 0 } : undefined}
        >
          {!universalBuilderDocument?.layout.root.length && post.featuredImage && <img className="custom-content-featured" src={post.featuredImage} alt={post.title} />}
          {!universalBuilderDocument?.layout.root.length && <p className="custom-content-type">{post.postType?.title ?? type}</p>}
          {!universalBuilderDocument?.layout.root.length && <h1>{post.title}</h1>}
          {!universalBuilderDocument?.layout.root.length && excerpt && <p className="custom-content-excerpt">{excerpt}</p>}
          {universalBuilderDocument?.layout.root.length ? (
            <PublicBuilderDocument
              layout={universalBuilderDocument.layout}
              globalStyles={universalBuilderDocument.globalStyles}
              postContext={{
                id: post.id,
                kind: "post",
                postTypeId: post.postTypeId,
                title: post.title,
                slug: post.slug,
                url: `/content/${type}/${slug}/`,
                description: excerpt,
                excerpt,
                contentHtml: html,
                featuredImage: post.featuredImage,
                publishedAt: post.publishedAt,
                categories: post.categories.map(({ category }) => ({ name: category.name, slug: category.slug })),
              }}
            />
          ) : hasBuilderContent && builderLayout ? (
            <PublicPageBuilder layout={builderLayout} />
          ) : (
            <div className="custom-content-body" dangerouslySetInnerHTML={{ __html: html }} />
          )}
          {/* CONNECT_BUILDER_DYNAMIC_BINDINGS_V1 */}
          {(post.categories.length > 0 || post.tags.length > 0) && <footer className="custom-content-taxonomies">
            {post.categories.map(({ category }) => <span key={category.slug}>{category.name}</span>)}
            {post.tags.map(({ tag }) => <span key={tag.slug}>#{tag.name}</span>)}
          </footer>}
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
