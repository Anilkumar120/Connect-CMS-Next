import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPostHtml, sanitizePostHtml } from "@/lib/blog-content";
import { formatSiteDateTime, getPostPermalink, type SiteSettings } from "@/lib/site-settings";
import styles from "@/app/blog/Blog.module.css";
import { getSeoContentMeta } from "@/lib/seo-manager";
import SeoJsonLd from "@/components/public/SeoJsonLd";
import BlogComments from "@/components/public/BlogComments";
import PublicBuilderDocument from "@/components/public/PublicBuilderDocument";
import { getPublishedBuilderDocument } from "@/lib/builder/public-layout";

export type PublicPost = Prisma.PostGetPayload<{
  include: {
    categories: { include: { category: { select: { name: true; slug: true } } } };
    tags: { include: { tag: { select: { name: true; slug: true; imageUrl: true } } } };
  };
}>;

export default async function PublicPostView({
  post,
  settings,
}: {
  post: PublicPost;
  settings: SiteSettings;
}) {
  const [html, seoMeta, comments, builderDocument] = await Promise.all([
    Promise.resolve(sanitizePostHtml(getPostHtml(post.content))),
    getSeoContentMeta("post", post.id),
    prisma.comment.findMany({
      where: { postId: post.id, status: "APPROVED", deletedAt: null },
      select: { id: true, authorName: true, content: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    getPublishedBuilderDocument(`post:${post.id}`),
  ]);

  const url = seoMeta.canonicalUrl || `${settings.general.siteAddress.replace(/\/$/, "")}${getPostPermalink(post, settings)}`;
  // CONNECT_BUILDER_DYNAMIC_BINDINGS_V1

  return (
    <div className={styles.page}>
      <SeoJsonLd
        schemaType={seoMeta.schemaType || "BlogPosting"}
        title={post.title}
        description={seoMeta.ogDescription || post.excerpt}
        url={url}
        image={seoMeta.ogImage || post.featuredImage}
        siteName={settings.general.siteTitle}
        publishedAt={post.publishedAt}
        modifiedAt={post.updatedAt}
      />
      <article className={styles.article} style={builderDocument?.layout.root.length ? { width: "100%", maxWidth: "none" } : undefined}>
        {builderDocument?.layout.root.length ? (
          <PublicBuilderDocument
            layout={builderDocument.layout}
            globalStyles={builderDocument.globalStyles}
            postContext={{
              id: post.id,
              kind: "post",
              title: post.title,
              slug: post.slug,
              url: getPostPermalink(post, settings),
              excerpt: post.excerpt,
              description: post.excerpt,
              contentHtml: html,
              featuredImage: post.featuredImage,
              publishedAt: post.publishedAt,
              categories: post.categories.map(({ category }) => ({ name: category.name, slug: category.slug })),
            }}
          />
        ) : (
          <>
            <Link className={styles.readMore} href="/blog">← All posts</Link>
            <h1 className={styles.articleTitle}>{post.title}</h1>
            <div className={styles.articleMeta}>
              {post.publishedAt && (
                <time dateTime={post.publishedAt.toISOString()}>
                  {formatSiteDateTime(post.publishedAt, settings)}
                </time>
              )}
              {post.categories.map(({ category }) => (
                <Link className={styles.categoryLink} href={`/blog/category/${category.slug}`} key={category.slug}>
                  {category.name}
                </Link>
              ))}
            </div>
            {post.featuredImage && <img className={styles.featuredImage} src={post.featuredImage} alt={post.title} />}
            {post.excerpt && <p className={styles.intro}>{post.excerpt}</p>}
            {html ? (
              <div className={styles.articleBody} dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <p className={styles.empty}>This post does not have any content yet.</p>
            )}
            {post.tags.length > 0 && (
              <div className={styles.tags}>
                {post.tags.map(({ tag }) => (
                  <Link className={styles.tagLink} href={`/blog/tag/${tag.slug}`} key={tag.slug}>
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </article>
      <BlogComments
        postSlug={post.slug}
        comments={comments.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() }))}
      />
    </div>
  );
}
