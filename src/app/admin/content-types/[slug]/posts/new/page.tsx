import { notFound } from "next/navigation";
import { connection } from "next/server";
import PostEditor from "@/components/admin/PostEditor";
import { prisma } from "@/lib/prisma";

export default async function NewCustomPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const contentType = await prisma.customPostType.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!contentType) notFound();

  return <PostEditor postTypeSlug={slug} />;
}
