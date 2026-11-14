import { Suspense } from "react";
import { connection } from "next/server";
import PublicLayout from "@/components/public/PublicLayout";
import CMSPageView from "@/components/public/CMSPageView";
import PublicPostView from "@/components/public/PublicPostView";
import PublicPostsListing from "@/components/public/PublicPostsListing";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function Home({ searchParams }: Props) {
  return (
    <Suspense fallback={null}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeContent({ searchParams }: Props) {
  await connection();
  const [settings, query] = await Promise.all([getSiteSettings(), searchParams]);
  const postId = typeof query.p === "string" ? query.p : "";

  if (postId) {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: "PUBLISHED",
        deletedAt: null,
        postTypeId: null,
      },
      include: {
        categories: {
          include: { category: { select: { name: true, slug: true } } },
        },
        tags: {
          include: { tag: { select: { name: true, slug: true, imageUrl: true } } },
        },
      },
    });

    if (post) {
      return (
        <PublicLayout>
          <PublicPostView post={post} settings={settings} />
        </PublicLayout>
      );
    }
  }

  if (
    settings.reading.showOnFront === "page" &&
    settings.reading.homepagePageId
  ) {
    const page = await prisma.page.findFirst({
      where: {
        id: settings.reading.homepagePageId,
        status: "PUBLISHED",
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        content: true,
      },
    });

    if (page) {
      return (
        <PublicLayout>
          <CMSPageView page={page} />
        </PublicLayout>
      );
    }
  }

  return (
    <PublicLayout>
      <PublicPostsListing />
    </PublicLayout>
  );
}
