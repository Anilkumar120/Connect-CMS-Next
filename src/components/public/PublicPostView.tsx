import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getPostHtml, sanitizePostHtml } from "@/lib/blog-content";
import { formatSiteDateTime, type SiteSettings } from "@/lib/site-settings";
import styles from "@/app/blog/Blog.module.css";

export type PublicPost = Prisma.PostGetPayload<{
  include: {
    categories: { include: { category: { select: { name: true; slug: true } } } };
    tags: { include: { tag: { select: { name: true; slug: true; imageUrl: true } } } };
  };
}>;

export default function PublicPostView({
  post,
  settings,
}: {
  post: PublicPost;
  settings: SiteSettings;
}) {
  const html = sanitizePostHtml(getPostHtml(post.content));
  return (
    <div className={styles.page}>
      <article className={styles.article}>
        <Link className={styles.readMore} href="/blog">← All posts</Link>
        <h1 className={styles.articleTitle}>{post.title}</h1>
        <div className={styles.articleMeta}>
          {post.publishedAt && (
            <time dateTime={post.publishedAt.toISOString()}>
              {formatSiteDateTime(post.publishedAt, settings)}
            </time>
          )}
          {post.categories.map(({ category }) => (
            <Link
              className={styles.categoryLink}
              href={`/blog/category/${category.slug}`}
              key={category.slug}
            >
              {category.name}
            </Link>
          ))}
        </div>
        {post.featuredImage && (
          <img className={styles.featuredImage} src={post.featuredImage} alt={post.title} />
        )}
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
      </article>
    </div>
  );
}
