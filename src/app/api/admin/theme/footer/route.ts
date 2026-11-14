import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const footerSchema = z
  .object({
    background: z.string().max(200).optional(),
    textColor: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    columns: z.number().int().min(1).max(4).optional(),
    logo: z
      .object({
        text: z.string().max(100).optional(),
        url: z.string().max(2048).optional(),
        imageUrl: z.string().max(2048).optional(),
        alt: z.string().max(200).optional(),
      })
      .passthrough()
      .optional(),
    elements: z
      .array(
        z
          .object({
            id: z.string().max(100),
            type: z.enum([
              "logo",
              "menu",
              "copyright",
              "text",
              "icon",
              "section",
              "container",
            ]),
            location: z.string().max(20).optional(),
            text: z.string().max(500).optional(),
            iconName: z.string().max(60).optional(),
            label: z.string().max(100).optional(),
            url: z.string().max(2048).optional(),
          })
          .passthrough()
      )
      .max(30)
      .optional(),
      advanced: z
        .object({})
        .catchall(z.unknown())
        .optional(),
  })
  .passthrough();

const allowedRoles = ["SUPER_ADMIN", "ADMIN", "WEB_DESIGNER"];

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);

  if (originError) {
    return originError;
  }

  try {
    const user = await getCurrentUser();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have permission to edit the Footer.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = footerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid Footer settings.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const setting = await prisma.$transaction(async (tx) => {
      const saved = await tx.siteSetting.upsert({
        where: { key: "footer_layout" },
        create: {
          key: "footer_layout",
          value: validation.data as Prisma.InputJsonValue,
        },
        update: {
          value: validation.data as Prisma.InputJsonValue,
        },
      });

      await tx.siteSetting.deleteMany({
        where: { key: "footer_layout_draft" },
      });

      return saved;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Footer settings saved successfully.",
        footer: setting.value,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Footer settings save error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to save Footer settings.",
      },
      { status: 500 }
    );
  }
}
