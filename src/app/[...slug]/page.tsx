import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import CMSPageView from "@/components/public/CMSPageView";
import PublicLayout from "@/components/public/PublicLayout";
import PublicPostView, { type PublicPost } from "@/components/public/PublicPostView";
import PublicPostsListing from "@/components/public/PublicPostsListing";
import { prisma } from "@/lib/prisma";
import {
  getPostPermalink,
  getSiteSettings,
  matchPostPermalink,
} from "@/lib/site-settings";

type Props = { params: Promise<{ slug: string[] }> };

async function findPublishedPage(slugs: string[]) {
  let parentId: string | null = null;
  let page = null;

  for (const slug of slugs) {
    page = await prisma.page.findFirst({
      where: { slug, parentId, status: "PUBLISHED", deletedAt: null },
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
    if (!page) return null;
    parentId = page.id;
  }
  return page;
}

async function findPostById(id: string): Promise<PublicPost | null> {
  return prisma.post.findFirst({
    where: { id, status: "PUBLISHED", deletedAt: null, postTypeId: null },
    include: {
      categories: {
        include: { category: { select: { name: true, slug: true } } },
      },
      tags: {
        include: { tag: { select: { name: true, slug: true, imageUrl: true } } },
      },
    },
  });
}

async function findPostBySlug(slug: string): Promise<PublicPost | null> {
  return prisma.post.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, postTypeId: null },
    include: {
      categories: {
        include: { category: { select: { name: true, slug: true } } },
      },
      tags: {
        include: { tag: { select: { name: true, slug: true, imageUrl: true } } },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await findPublishedPage(slug);
  if (page) {
    return {
      title: page.seoTitle?.trim() || `${page.title} | Connect Broadband`,
      description: page.seoDescription?.trim() || page.description || undefined,
    };
  }
  return { title: "Connect Broadband" };
}

export default function DynamicCMSPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <DynamicCMSPageContent params={params} />
    </Suspense>
  );
}

async function DynamicCMSPageContent({ params }: Props) {
  await connection();
  const { slug } = await params;
  const [settings, page] = await Promise.all([
    getSiteSettings(),
    findPublishedPage(slug),
  ]);

  if (page) {
    if (
      settings.reading.showOnFront === "page" &&
      settings.reading.homepagePageId === page.id
    ) {
      permanentRedirect("/");
    }

    if (settings.reading.postsPageId === page.id) {
      return (
        <PublicLayout>
          <PublicPostsListing />
        </PublicLayout>
      );
    }

    return (
      <PublicLayout>
        <CMSPageView page={page} />
      </PublicLayout>
    );
  }

  const pathname = `/${slug.join("/")}`;
  const parsed = matchPostPermalink(pathname, settings);
  let post = parsed?.id
    ? await findPostById(parsed.id)
    : parsed?.slug
      ? await findPostBySlug(parsed.slug)
      : null;

  if (!post) {
    const lastSegment = slug[slug.length - 1];
    if (slug[0] === "archives" && slug.length === 2) {
      post = await findPostById(lastSegment);
    } else if (lastSegment) {
      try {
        post = await findPostBySlug(decodeURIComponent(lastSegment));
      } catch {
        post = null;
      }
    }
  }

  if (!post) notFound();

  const canonicalPath = getPostPermalink(post, settings).split("?")[0].replace(/\/+$/, "") || "/";
  const currentPath = `/${slug.join("/")}`.replace(/\/+$/, "") || "/";
  if (currentPath !== canonicalPath) {
    permanentRedirect(getPostPermalink(post, settings));
  }

  return (
    <PublicLayout>
      <PublicPostView post={post} settings={settings} />
    </PublicLayout>
  );
}
