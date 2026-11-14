
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const menuSchema = z.object({
  name: z.string().trim().min(1).max(150),
  location: z.enum(["HEADER", "FOOTER"]).nullable().optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const [menus, pages] = await Promise.all([
      prisma.menu.findMany({
        orderBy: { updatedAt: "desc" },
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
      }),
      prisma.page.findMany({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          slug: true,
        },
        orderBy: { title: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      menus,
      pages,
    });
  } catch (error) {
    console.error("GET menus error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load menus." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const parsed = menuSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "Invalid menu data.",
        },
        { status: 400 }
      );
    }

    const { name, location } = parsed.data;

    const menu = await prisma.$transaction(async (tx) => {
      if (location) {
        await tx.menu.updateMany({
          where: { location },
          data: { location: null },
        });
      }

      return tx.menu.create({
        data: {
          name,
          location: location ?? null,
        },
        include: {
          items: true,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Menu created successfully.",
        menu,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST menu error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to create menu." },
      { status: 500 }
    );
  }
}
