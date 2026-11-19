import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import PublicLayout from "@/components/public/PublicLayout";
import BlogPostGrid from "@/components/public/BlogPostGrid";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import styles from "../../Blog.module.css";

async function BlogCategoryContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await connection();
  const settings = await getSiteSettings();
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) notFound();

  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      postTypeId: null,
      categories: { some: { categoryId: category.id } },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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
      categories: { select: { category: { select: { name: true, slug: true } } } },
    },
  });

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>{category.name}</h1>
        {category.imageUrl && (
          <img className={styles.taxonomyImage} src={category.imageUrl} alt={category.name} />
        )}
        {category.description && <p className={styles.intro}>{category.description}</p>}
        <BlogPostGrid posts={posts} settings={settings} emptyText="There are no published posts in this category." />
      </div>
    </div>
  );
}

export default function BlogCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<div className={styles.page}>Loading category…</div>}><BlogCategoryPageWithLayout params={params} /></Suspense>;
}

async function BlogCategoryPageWithLayout({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PublicLayout pathname={`/blog/category/${slug}`}>
      <BlogCategoryContent params={Promise.resolve({ slug })} />
    </PublicLayout>
  );
}
