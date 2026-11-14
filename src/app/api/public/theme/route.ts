
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

/**
 * Header Builder validation
 *
 * Supports:
 * - Text logo
 * - Image logo
 * - Logo responsive dimensions
 * - Header menu and buttons
 * - Normal and hover styles
 * - Advanced styling and responsive settings
 * - Additional future Header Builder properties
 */

const logoSchema = z.union([
  z.string().max(2048),
  z.object({}).passthrough(),
]);

const headerElementSchema = z.object({}).passthrough();

const headerSchema = z
  .object({
    layout: z
      .enum(["horizontal", "centered", "split"])
      .optional(),

    background: z.string().max(200).optional(),

    textColor: z.string().max(200).optional(),

    logo: logoSchema.optional(),

    elements: z
      .array(headerElementSchema)
      .max(100)
      .optional(),

    styles: z
      .object({})
      .passthrough()
      .optional(),

    advanced: z
      .object({})
      .passthrough()
      .optional(),
  })
  .passthrough();

const allowedRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "WEB_DESIGNER",
];

export async function GET(request: NextRequest) {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: ["header_layout", "footer_layout", "header_templates"],
        },
      },
      select: {
        key: true,
        value: true,
      },
    });

    const settingsByKey = new Map(
      settings.map((setting) => [setting.key, setting.value])
    );
    const routePath = request.nextUrl.searchParams.get("path") || "";
    const pathSegments = routePath
      .split(/[?#]/, 1)[0]
      .split("/")
      .filter(Boolean);
    const lastSegment = pathSegments.at(-1);
    let header = settingsByKey.get("header_layout") ?? null;
    if (lastSegment) {
      const isContentRoute =
        (pathSegments[0] === "blog" &&
          pathSegments.length === 2 &&
          pathSegments[1] !== "category" &&
          pathSegments[1] !== "tag") ||
        (pathSegments[0] === "content" && pathSegments.length === 3);
      const isPostPath =
        pathSegments[0] === "blog" || pathSegments[0] === "content";
      let record: { content: unknown } | null = null;
      if (isContentRoute) {
        record = await prisma.post.findFirst({
          where: { slug: lastSegment, status: "PUBLISHED", deletedAt: null },
          select: { content: true },
        });
      } else if (!isPostPath) {
        record = await prisma.page.findFirst({
          where: { slug: lastSegment, status: "PUBLISHED", deletedAt: null },
          select: { content: true },
        });
      }
      const content = record?.content;
      const headerTemplateId =
        content && typeof content === "object" && !Array.isArray(content)
          ? (content as Record<string, unknown>).headerTemplateId
          : null;
      const templates = settingsByKey.get("header_templates");
      if (typeof headerTemplateId === "string" && Array.isArray(templates)) {
        const selected = templates.find(
          (item) =>
            item &&
            typeof item === "object" &&
            "id" in item &&
            item.id === headerTemplateId &&
            "header" in item
        );
        if (selected && typeof selected === "object" && "header" in selected) {
          header = selected.header ?? null;
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        currentYear: new Date().getFullYear(),
        theme: {
          header,
          footer: settingsByKey.get("footer_layout") ?? null,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Public theme API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load theme settings.",
      },
      { status: 500 }
    );
  }
}

async function authorizeAdmin() {
  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          message: "You do not have permission to edit the Header.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify request origin
    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    // Verify admin permissions
    const auth = await authorizeAdmin();

    if (auth.response) {
      return auth.response;
    }

    // Read request body
    const body = await request.json();

    // Validate Header settings
    const validation = headerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid Header settings.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const headerSettings = validation.data;

    // Save complete Header Builder configuration
    const setting = await prisma.siteSetting.upsert({
      where: {
        key: "header_layout",
      },

      create: {
        key: "header_layout",
        value: headerSettings as Prisma.InputJsonValue,
      },

      update: {
        value: headerSettings as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Header settings saved successfully.",
        header: setting.value,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Header settings save error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to save Header settings.",
      },
      { status: 500 }
    );
  }
}
