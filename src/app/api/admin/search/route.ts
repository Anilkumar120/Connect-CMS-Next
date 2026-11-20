
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user?.isActive) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  const query = (
    request.nextUrl.searchParams.get("q") || ""
  )
    .trim()
    .slice(0, 100);

  if (query.length < 2) {
    return NextResponse.json({
      success: true,
      results: [],
    });
  }

  try {
    const contains = { contains: query };

    const [
      pages,
      posts,
      media,
      forms,
      comments,
    ] = await Promise.all([
      prisma.page.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: contains },
            { slug: contains },
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),

      prisma.post.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: contains },
            { slug: contains },
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),

      prisma.mediaAsset.findMany({
        where: {
          isDeleted: false,
          OR: [
            { fileName: contains },
            { originalName: contains },
            { title: contains },
          ],
        },
        select: {
          id: true,
          title: true,
          fileName: true,
          originalName: true,
        },
        take: 4,
        orderBy: { updatedAt: "desc" },
      }),

      prisma.form.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: contains },
            { slug: contains },
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
        },
        take: 4,
        orderBy: { updatedAt: "desc" },
      }),

      prisma.comment.findMany({
        where: {
          deletedAt: null,
          OR: [
            { authorName: contains },
            { authorEmail: contains },
            { content: contains },
          ],
        },
        select: {
          id: true,
          authorName: true,
          content: true,
          post: {
            select: {
              title: true,
            },
          },
        },
        take: 4,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const results = [
      ...pages.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: `Page · /${item.slug}`,
        type: "Page",
        href: `/admin/pages?search=${encodeURIComponent(item.title)}`,
      })),

      ...posts.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: `Post · /${item.slug}`,
        type: "Post",
        href: `/admin/posts?search=${encodeURIComponent(item.title)}`,
      })),

      ...media.map((item) => ({
        id: item.id,
        title:
          item.title ||
          item.originalName ||
          item.fileName,
        subtitle: "Media Library",
        type: "Media",
        href: `/admin/media?search=${encodeURIComponent(item.fileName)}`,
      })),

      ...forms.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: `Form · ${item.slug}`,
        type: "Form",
        href: `/admin/forms?search=${encodeURIComponent(item.title)}`,
      })),

      ...comments.map((item) => ({
        id: item.id,
        title: item.authorName,
        subtitle: `Comment on ${item.post.title}: ${item.content.slice(0, 75)}`,
        type: "Comment",
        href: `/admin/comments?search=${encodeURIComponent(item.authorName)}`,
      })),
    ].slice(0, 18);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Admin search failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Search is temporarily unavailable.",
      },
      { status: 500 }
    );
  }
}
