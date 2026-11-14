import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

type Location = "HEADER" | "FOOTER";

type PublicMenuItem = {
  id: string;
  label: string;
  href: string;
  target: string;
  children: PublicMenuItem[];
};

type PagePathRecord = {
  id: string;
  slug: string;
  parentId: string | null;
  status: string;
  deletedAt: Date | null;
};

function getSafeUrl(url: string | null | undefined): string {
  const value = url?.trim() || "";

  if (!value) return "#";

  if (/^(https?:\/\/|mailto:|tel:|#)/i.test(value)) {
    return value;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  if (/^(javascript:|data:|vbscript:)/i.test(value)) {
    return "#";
  }

  return `/${value.replace(/^\/+/, "")}`;
}

function getPublishedPageUrl(
  pageId: string,
  pagesById: Map<string, PagePathRecord>,
  homepagePageId: string | null
): string | null {
  const slugs: string[] = [];
  const visited = new Set<string>();
  let page = pagesById.get(pageId);
  if (
    !page ||
    page.status !== "PUBLISHED" ||
    page.deletedAt !== null
  ) {
    return null;
  }
  if (page.id === homepagePageId) return "/";

  while (page) {
    if (
      visited.has(page.id) ||
      page.status !== "PUBLISHED" ||
      page.deletedAt !== null
    ) {
      return null;
    }

    visited.add(page.id);
    slugs.unshift(page.slug);

    if (!page.parentId) {
      return getSafeUrl(`/${slugs.join("/")}`);
    }

    page = pagesById.get(page.parentId);
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ location: string }> }
) {
  try {
    const { location } = await context.params;

    if (location !== "HEADER" && location !== "FOOTER") {
      return NextResponse.json(
        { success: false, message: "Invalid menu location." },
        { status: 400 }
      );
    }

    const menuId = request.nextUrl.searchParams.get("menuId");
    const menu = await prisma.menu.findFirst({
      where: menuId
        ? { id: menuId }
        : { location: location as Location },
      select: {
        id: true,
        name: true,
        items: {
          orderBy: [
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
          select: {
            id: true,
            label: true,
            type: true,
            url: true,
            target: true,
            sortOrder: true,
            pageId: true,
            parentId: true,
          },
        },
      },
    });

    if (!menu) {
      return NextResponse.json({
        success: true,
        menu: null,
      });
    }

    const pages = await prisma.page.findMany({
      select: {
        id: true,
        slug: true,
        parentId: true,
        status: true,
        deletedAt: true,
      },
    });
    const pagesById = new Map<string, PagePathRecord>(
      pages.map((page) => [page.id, page])
    );
    const settings = await getSiteSettings();
    const homepagePageId =
      settings.reading.showOnFront === "page"
        ? settings.reading.homepagePageId
        : null;

    const itemMap = new Map<string, PublicMenuItem>();

    for (const item of menu.items) {
      let href = "";

      if (item.type === "PAGE") {
        const pageHref = getPublishedPageUrl(
          item.pageId || "",
          pagesById,
          homepagePageId
        );

        if (!pageHref) {
          continue;
        }

        href = pageHref;
      } else {
        href = getSafeUrl(item.url);
      }

      itemMap.set(item.id, {
        id: item.id,
        label: item.label,
        href,
        target: item.target,
        children: [],
      });
    }

    const menuItems: PublicMenuItem[] = [];

    for (const item of menu.items) {
      const currentItem = itemMap.get(item.id);

      if (!currentItem) continue;

      const parentItem = item.parentId
        ? itemMap.get(item.parentId)
        : undefined;

      if (parentItem) {
        parentItem.children.push(currentItem);
      } else {
        menuItems.push(currentItem);
      }
    }

    return NextResponse.json(
      {
        success: true,
        menu: {
          id: menu.id,
          name: menu.name,
          items: menuItems,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Public menu API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load menu.",
      },
      { status: 500 }
    );
  }
}