import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PublicLayout from "@/components/public/PublicLayout";
import PublicPostsListing from "@/components/public/PublicPostsListing";
import { getSiteSettings } from "@/lib/site-settings";

export default function BlogIndexPage() {
  return (
    <PublicLayout>
      <Suspense fallback={null}>
        <BlogIndexContent />
      </Suspense>
    </PublicLayout>
  );
}

async function BlogIndexContent() {
  const settings = await getSiteSettings();
  if (
    settings.reading.showOnFront === "page" &&
    settings.reading.homepagePageId
  ) {
    const homepage = await prisma.page.findFirst({
      where: {
        id: settings.reading.homepagePageId,
        parentId: null,
        status: "PUBLISHED",
        deletedAt: null,
      },
      select: { slug: true },
    });
    if (homepage?.slug === "blog") redirect("/");
  }

  return <PublicPostsListing />;
}
