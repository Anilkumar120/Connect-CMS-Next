import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const bulkSchema = z.object({
  action: z.enum([
    "TRASH",
    "RESTORE",
    "DELETE",
    "EMPTY_TRASH",
    "PUBLISH",
    "DRAFT",
  ]),
  ids: z.array(z.string().trim().min(1)).max(100).optional().default([]),
});

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);

  if (originError) {
    return originError;
  }

  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const validation = bulkSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid action or page selection.",
        },
        { status: 400 }
      );
    }

    const { action, ids } = validation.data;
    const uniqueIds = [...new Set(ids)];

    if (action !== "EMPTY_TRASH" && uniqueIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please select at least one page." },
        { status: 400 }
      );
    }

    // EMPTY TRASH: permanently delete all trashed pages.
    if (action === "EMPTY_TRASH") {
      const result = await prisma.$transaction(async (tx) => {
        const trashedPages = await tx.page.findMany({
          where: {
            OR: [
              { deletedAt: { not: null } },
              { status: "ARCHIVED" },
            ],
          },
          select: { id: true },
        });

        const trashIds = trashedPages.map((page) => page.id);

        if (trashIds.length === 0) {
          return 0;
        }

        // Delete associated revisions.
        await tx.contentRevision.deleteMany({
          where: {
            pageId: { in: trashIds },
          },
        });

        // Child pages are detached by the PageHierarchy SetNull relation.
        const deleted = await tx.page.deleteMany({
          where: {
            id: { in: trashIds },
            OR: [
              { deletedAt: { not: null } },
              { status: "ARCHIVED" },
            ],
          },
        });

        return deleted.count;
      });

      return NextResponse.json({
        success: true,
        message: `${result} page(s) permanently deleted. Trash is now empty.`,
      });
    }

    const existingPages = await prisma.page.findMany({
      where: {
        id: { in: uniqueIds },
      },
      select: {
        id: true,
        deletedAt: true,
        status: true,
      },
    });

    if (existingPages.length !== uniqueIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "One or more selected pages were not found.",
        },
        { status: 404 }
      );
    }

    // Move active pages to Trash.
    if (action === "TRASH") {
      const result = await prisma.page.updateMany({
        where: {
          id: { in: uniqueIds },
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} page(s) moved to Trash.`,
      });
    }

    // Restore pages without changing their original status.
    if (action === "RESTORE") {
      const [restoredPages, restoredArchivedPages] =
        await prisma.$transaction([
          prisma.page.updateMany({
            where: {
              id: { in: uniqueIds },
              deletedAt: { not: null },
              status: { not: "ARCHIVED" },
            },
            data: { deletedAt: null },
          }),
          prisma.page.updateMany({
            where: {
              id: { in: uniqueIds },
              status: "ARCHIVED",
            },
            data: { deletedAt: null, status: "DRAFT" },
          }),
        ]);

      return NextResponse.json({
        success: true,
        message: `${
          restoredPages.count + restoredArchivedPages.count
        } page(s) restored successfully.`,
      });
    }

    // Permanent deletion is allowed only for trashed pages.
    if (action === "DELETE") {
      const activePages = existingPages.filter(
        (page) =>
          page.deletedAt === null && page.status !== "ARCHIVED"
      );

      if (activePages.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Only pages in Trash can be permanently deleted. Move the selected pages to Trash first.",
          },
          { status: 400 }
        );
      }

      const deletedCount = await prisma.$transaction(async (tx) => {
        await tx.contentRevision.deleteMany({
          where: {
            pageId: { in: uniqueIds },
          },
        });

        const result = await tx.page.deleteMany({
          where: {
            id: { in: uniqueIds },
            OR: [
              { deletedAt: { not: null } },
              { status: "ARCHIVED" },
            ],
          },
        });

        return result.count;
      });

      return NextResponse.json({
        success: true,
        message: `${deletedCount} page(s) permanently deleted.`,
      });
    }

    // Publish selected active pages.
    if (action === "PUBLISH") {
      const result = await prisma.page.updateMany({
        where: {
          id: { in: uniqueIds },
          deletedAt: null,
          status: { not: "ARCHIVED" },
        },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} page(s) published.`,
      });
    }

    // Move selected active pages to Draft.
    if (action === "DRAFT") {
      const result = await prisma.page.updateMany({
        where: {
          id: { in: uniqueIds },
          deletedAt: null,
          status: { not: "ARCHIVED" },
        },
        data: {
          status: "DRAFT",
          publishedAt: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} page(s) moved to Draft.`,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unsupported action.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Bulk page action error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to complete the page action.",
      },
      { status: 500 }
    );
  }
}