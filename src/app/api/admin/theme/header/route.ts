import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const headerSchema = z.object({
  layout: z.enum(["horizontal", "centered", "split"]),
  background: z.string().max(200),
  textColor: z.string().max(200),
  logo: z
    .object({
      text: z.string().max(100),
      url: z.string().max(2048),
      imageUrl: z.string().max(2048).optional(),
      alt: z.string().max(200).optional(),
      width: z.record(z.string(), z.string()).optional(),
      height: z.record(z.string(), z.string()).optional(),
    })
    .passthrough(),
  elements: z
    .array(
      z
        .object({
          id: z.string().min(1).max(100),
          type: z.string().min(1).max(40),
        })
        .passthrough()
    )
    .max(40),
  styles: z
    .object({
      normal: z.record(z.string(), z.string()).optional(),
      hover: z.record(z.string(), z.string()).optional(),
    })
    .passthrough()
    .optional(),
  advanced: z
    .object({})
    .catchall(z.unknown())
    .optional(),
}).passthrough();

const allowedRoles = ["SUPER_ADMIN", "ADMIN", "WEB_DESIGNER"];

async function authorizeAdmin() {
  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, message: "You do not have permission to edit the Header." },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

export async function POST(request: NextRequest) {
  try {
    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    const auth = await authorizeAdmin();

    if (auth.response) {
      return auth.response;
    }

    const body = await request.json();
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

    const setting = await prisma.$transaction(async (tx) => {
      const saved = await tx.siteSetting.upsert({
        where: { key: "header_layout" },
        create: {
          key: "header_layout",
          value: headerSettings as Prisma.InputJsonValue,
        },
        update: {
          value: headerSettings as Prisma.InputJsonValue,
        },
      });

      await tx.siteSetting.deleteMany({
        where: { key: "header_layout_draft" },
      });

      return saved;
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