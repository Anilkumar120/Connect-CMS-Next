
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import BlogPostGrid from "@/components/public/BlogPostGrid";
import styles from "@/app/blog/Blog.module.css";

export default async function PublicPostsListing() {
  await connection();

  const settings = await getSiteSettings();

  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      postTypeId: null,
    },
    orderBy: [
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: settings.reading.postsPerPage,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      featuredImage: true,
      publishedAt: true,
      createdAt: true,
      categories: {
        select: {
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  }).catch((error) => {
    console.error("Public posts query failed:", error);
    return [];
  });

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>Blog</h1>

        <p className={styles.intro}>
          News, updates and helpful information from Connect Broadband.
        </p>

        {posts.length > 0 ? (
          <BlogPostGrid posts={posts} settings={settings} />
        ) : (
          <p>No published posts are available right now.</p>
        )}
      </div>
    </div>
  );
}
