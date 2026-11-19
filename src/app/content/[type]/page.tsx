import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import PublicLayout from "@/components/public/PublicLayout";

export default function CustomContentArchivePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  return (
    <Suspense fallback={<div className="custom-content-loading">Loading...</div>}>
      {params.then(({ type }) => (
        <CustomContentArchive type={type} />
      ))}
    </Suspense>
  );
}

async function CustomContentArchive({ type }: { type: string }) {
  await connection();
  const contentType = await prisma.customPostType.findUnique({
    where: { slug: type },
  });
  if (!contentType) notFound();

  const posts = await prisma.post.findMany({
    where: {
      postTypeId: contentType.id,
      status: "PUBLISHED",
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
      publishedAt: true,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <PublicLayout pathname={`/content/${type}`}>
      <main className="custom-content-archive">
        <h1>{contentType.title}</h1>
        {posts.length ? (
          <div className="custom-content-grid">
            {posts.map((post) => (
              <article key={post.id}>
                {post.featuredImage && (
                  <Link href={`/content/${type}/${post.slug}`}>
                    <img src={post.featuredImage} alt={post.title} />
                  </Link>
                )}
                <h2>
                  <Link href={`/content/${type}/${post.slug}`}>{post.title}</Link>
                </h2>
                {post.excerpt && <p>{post.excerpt}</p>}
                {post.publishedAt && (
                  <time dateTime={post.publishedAt.toISOString()}>
                    {post.publishedAt.toLocaleDateString()}
                  </time>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p>No published {contentType.title.toLowerCase()} yet.</p>
        )}
        <style>{`
          .custom-content-archive { min-height: 60vh; padding: 45px 20px 70px; background: #fff; color: #233144; }
          .custom-content-archive > h1 { width: 100%; max-width: 1200px; margin: 0 auto 28px; color: #0c2f55; font-size: 34px; }
          .custom-content-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; width: 100%; max-width: 1200px; margin: 0 auto; }
          .custom-content-grid article { overflow: hidden; border: 1px solid #e5eaf0; border-radius: 9px; background: #fff; }
          .custom-content-grid img { display: block; width: 100%; height: 190px; object-fit: cover; }
          .custom-content-grid h2, .custom-content-grid p, .custom-content-grid time { margin-right: 16px; margin-left: 16px; }
          .custom-content-grid h2 { margin-top: 16px; font-size: 18px; }
          .custom-content-grid h2 a { color: #0c2f55; text-decoration: none; }
          .custom-content-grid p { color: #667085; line-height: 1.6; }
          .custom-content-grid time { display: block; margin-bottom: 16px; color: #8793a2; font-size: 12px; }
        `}</style>
      </main>
    </PublicLayout>
  );
}
