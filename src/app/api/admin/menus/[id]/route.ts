
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const menuItemSchema: z.ZodType<{
  label: string;
  type: "PAGE" | "CUSTOM_LINK";
  url?: string;
  pageId?: string;
  target: "_self" | "_blank";
  children: any[];
}> = z.lazy(() =>
  z.object({
    label: z.string().trim().min(1).max(150),
    type: z.enum(["PAGE", "CUSTOM_LINK"]),
    url: z.string().max(1000).optional(),
    pageId: z.string().optional(),
    target: z.enum(["_self", "_blank"]).default("_self"),
    children: z.array(menuItemSchema).default([]),
  })
);

const updateMenuSchema = z.object({
  name: z.string().trim().min(1).max(150),
  location: z.enum(["HEADER", "FOOTER"]).nullable(),
  items: z.array(menuItemSchema).max(200),
});

type MenuItemInput = z.infer<typeof menuItemSchema>;

function isSafeUrl(value: string) {
  const url = value.trim();

  if (!url) return false;

  if (
    url.startsWith("/") ||
    url.startsWith("#") ||
    url.startsWith("?")
  ) {
    return !url.startsWith("//");
  }

  try {
    const parsed = new URL(url);

    return ["http:", "https:", "mailto:", "tel:"].includes(
      parsed.protocol
    );
  } catch {
    return false;
  }
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const originError = verifyRequestOrigin(request);

  if (originError) return originError;

  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateMenuSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "Invalid menu data.",
        },
        { status: 400 }
      );
    }

    const { name, location, items } = parsed.data;

    const existingMenu = await prisma.menu.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingMenu) {
      return NextResponse.json(
        { success: false, message: "Menu not found." },
        { status: 404 }
      );
    }

    const pageIds: string[] = [];

    function validateItems(menuItems: MenuItemInput[]): string | null {
      for (const item of menuItems) {
        if (item.type === "PAGE") {
          if (!item.pageId) {
            return `Select a page for "${item.label}".`;
          }

          pageIds.push(item.pageId);
        }

        if (item.type === "CUSTOM_LINK") {
          if (!item.url || !isSafeUrl(item.url)) {
            return `Enter a valid URL for "${item.label}".`;
          }
        }

        const childError = validateItems(item.children || []);

        if (childError) return childError;
      }

      return null;
    }

    const validationError = validateItems(items);

    if (validationError) {
      return NextResponse.json(
        { success: false, message: validationError },
        { status: 400 }
      );
    }

    const uniquePageIds = [...new Set(pageIds)];

    if (uniquePageIds.length) {
      const validPages = await prisma.page.findMany({
        where: {
          id: { in: uniquePageIds },
          status: "PUBLISHED",
          deletedAt: null,
        },
        select: { id: true },
      });

      if (validPages.length !== uniquePageIds.length) {
        return NextResponse.json(
          {
            success: false,
            message: "One or more selected pages are unavailable or unpublished.",
          },
          { status: 400 }
        );
      }
    }

    const updatedMenu = await prisma.$transaction(async (tx) => {
      if (location) {
        await tx.menu.updateMany({
          where: {
            location,
            id: { not: id },
          },
          data: { location: null },
        });
      }

      await tx.menu.update({
        where: { id },
        data: { name, location },
      });

      await tx.menuItem.deleteMany({
        where: { menuId: id },
      });

      async function saveItems(
        menuItems: MenuItemInput[],
        parentId: string | null = null
      ) {
        for (let index = 0; index < menuItems.length; index++) {
          const item = menuItems[index];

          const created = await tx.menuItem.create({
            data: {
              menuId: id,
              label: item.label,
              type: item.type,
              url: item.type === "CUSTOM_LINK" ? item.url!.trim() : null,
              pageId: item.type === "PAGE" ? item.pageId! : null,
              target: item.target,
              sortOrder: index,
              parentId,
            },
          });

          if (item.children?.length) {
            await saveItems(item.children, created.id);
          }
        }
      }

      await saveItems(items);

      return tx.menu.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: {
              page: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  status: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Menu updated successfully.",
      menu: updatedMenu,
    });
  } catch (error) {
    console.error("PUT menu error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update menu." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const originError = verifyRequestOrigin(request);

  if (originError) return originError;

  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;

    const menu = await prisma.menu.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!menu) {
      return NextResponse.json(
        { success: false, message: "Menu not found." },
        { status: 404 }
      );
    }

    await prisma.menu.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Menu deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE menu error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to delete menu." },
      { status: 500 }
    );
  }
}
