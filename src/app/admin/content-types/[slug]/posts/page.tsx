import { connection } from "next/server";
import { notFound } from "next/navigation";
import PostsManager, {
  type AdminPost,
} from "@/components/admin/PostsManager";
import { prisma } from "@/lib/prisma";

export default async function CustomPostsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const contentType = await prisma.customPostType.findUnique({
    where: { slug },
  });
  if (!contentType) notFound();

  const posts = await prisma.post.findMany({
    where: { postTypeId: contentType.id },
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
  const basePath = `/admin/content-types/${contentType.slug}/posts`;

  return (
    <PostsManager
      initialPosts={initialPosts}
      title={contentType.title}
      description={`Manage ${contentType.title.toLowerCase()} entries.`}
      basePath={basePath}
      postTypeSlug={contentType.slug}
    />
  );
}
