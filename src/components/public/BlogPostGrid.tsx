import Link from "next/link";
import styles from "@/app/blog/Blog.module.css";
import {
  formatSiteDateTime,
  getPostPermalink,
  type SiteSettings,
} from "@/lib/site-settings";
import { getPostHtml, sanitizePostHtml } from "@/lib/blog-content";

export type BlogCardPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  publishedAt: Date | null;
  createdAt?: Date;
  content?: unknown;
  categories: { category: { name: string; slug: string } }[];
};

export default function BlogPostGrid({
  posts,
  settings,
  emptyText = "No published posts yet.",
}: {
  posts: BlogCardPost[];
  settings: SiteSettings;
  emptyText?: string;
}) {
  if (!posts.length) return <div className={styles.empty}>{emptyText}</div>;

  return (
    <div className={styles.grid}>
      {posts.map((post) => (
        <article className={styles.card} key={post.id}>
          <Link className={styles.cardImageLink} href={getPostPermalink(post, settings)} aria-label={post.title}>
            {post.featuredImage && (
              <img className={styles.cardImage} src={post.featuredImage} alt={post.title} />
            )}
          </Link>
          <div className={styles.cardBody}>
            <div className={styles.meta}>
              {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatSiteDateTime(post.publishedAt, settings)}</time>}
              {post.categories.map(({ category }) => (
                <Link
                  className={styles.categoryLink}
                  key={category.slug}
                  href={`/blog/category/${category.slug}`}
                >
                  {category.name}
                </Link>
              ))}
            </div>
            <h2 className={styles.cardTitle}>
              <Link href={getPostPermalink(post, settings)}>{post.title}</Link>
            </h2>
            {settings.reading.feedContent === "excerpt" && post.excerpt && (
              <p className={styles.excerpt}>{post.excerpt}</p>
            )}
            {settings.reading.feedContent === "full" && post.content != null && (
              <div
                className={styles.articleBody}
                dangerouslySetInnerHTML={{ __html: sanitizePostHtml(getPostHtml(post.content)) }}
              />
            )}
            <Link className={styles.readMore} href={getPostPermalink(post, settings)}>Read more</Link>
          </div>
        </article>
      ))}
    </div>
  );
}
