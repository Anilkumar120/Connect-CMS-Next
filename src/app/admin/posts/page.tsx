import { Suspense } from "react";
import { connection } from "next/server";
import PostsManager, { type AdminPost } from "@/components/admin/PostsManager";
import { prisma } from "@/lib/prisma";

export default function PostsAdminPage() {
  return (
    <Suspense fallback={<div>Loading posts...</div>}>
      <PostsAdminContent />
    </Suspense>
  );
}

async function PostsAdminContent() {
  await connection();
  const posts = await prisma.post.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      categories: {
        include: { category: { select: { id: true, name: true } } },
      },
    },
  });

  const initialPosts: AdminPost[] = posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    updatedAt: post.updatedAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    deletedAt: post.deletedAt?.toISOString() ?? null,
    categories: post.categories.map(({ category }) => ({ category })),
  }));

  return <PostsManager initialPosts={initialPosts} />;
}
