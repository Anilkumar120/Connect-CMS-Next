import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import PagesManager, {
  type AdminPage,
} from "@/components/admin/PagesManager";

async function PagesContent() {
  const pages = await prisma.page.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
      deletedAt: true,
    },
  });

  const initialPages: AdminPage[] = pages.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    updatedAt: page.updatedAt.toISOString(),
    publishedAt: page.publishedAt?.toISOString() ?? null,
    deletedAt: page.deletedAt?.toISOString() ?? null,
  }));

  return <PagesManager initialPages={initialPages} />;
}

export default function PagesAdminPage() {
  return (
    <Suspense fallback={null}>
      <PagesContent />
    </Suspense>
  );
}