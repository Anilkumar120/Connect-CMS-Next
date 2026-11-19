import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import PublicLayout from "@/components/public/PublicLayout";
import BlogPostGrid from "@/components/public/BlogPostGrid";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import styles from "../../Blog.module.css";

async function BlogTagContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await connection();
  const settings = await getSiteSettings();
  const tag = await prisma.tag.findUnique({ where: { slug } });
  if (!tag) notFound();

  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      postTypeId: null,
      tags: { some: { tagId: tag.id } },
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
        <h1 className={styles.heading}>Tag: {tag.name}</h1>
        {tag.imageUrl && <img className={styles.taxonomyImage} src={tag.imageUrl} alt={tag.name} />}
        <BlogPostGrid posts={posts} settings={settings} emptyText="There are no published posts with this tag." />
      </div>
    </div>
  );
}

export default function BlogTagPage({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<div className={styles.page}>Loading tag…</div>}><BlogTagPageWithLayout params={params} /></Suspense>;
}

async function BlogTagPageWithLayout({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PublicLayout pathname={`/blog/tag/${slug}`}>
      <BlogTagContent params={Promise.resolve({ slug })} />
    </PublicLayout>
  );
}
