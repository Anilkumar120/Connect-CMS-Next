import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const draftSchema = z.record(z.string(), z.unknown());
const allowedRoles = ["SUPER_ADMIN", "ADMIN", "WEB_DESIGNER"];

type RouteContext = {
  params: Promise<{ builder: string }>;
};

function getSettingKeys(builder: string) {
  if (builder !== "header" && builder !== "footer") return null;

  return {
    published: `${builder}_layout`,
    draft: `${builder}_layout_draft`,
  };
}

async function authorize() {
  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 }
    );
  }

  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "You do not have permission to edit this builder." },
      { status: 403 }
    );
  }

  return null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authError = await authorize();
    if (authError) return authError;

    const { builder } = await context.params;
    const keys = getSettingKeys(builder);
    if (!keys) {
      return NextResponse.json(
        { success: false, message: "Invalid theme builder." },
        { status: 404 }
      );
    }

    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: [keys.draft, keys.published] } },
      select: { key: true, value: true },
    });
    const draft =
      settings.find((setting) => setting.key === keys.draft)?.value ??
      settings.find((setting) => setting.key === keys.published)?.value ??
      null;

    return NextResponse.json(
      { success: true, draft },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Theme builder draft load error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load the builder draft." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    const authError = await authorize();
    if (authError) return authError;

    const { builder } = await context.params;
    const keys = getSettingKeys(builder);
    if (!keys) {
      return NextResponse.json(
        { success: false, message: "Invalid theme builder." },
        { status: 404 }
      );
    }

    const parsed = draftSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Builder draft must be a JSON object." },
        { status: 400 }
      );
    }

    const setting = await prisma.siteSetting.upsert({
      where: { key: keys.draft },
      create: {
        key: keys.draft,
        value: parsed.data as Prisma.InputJsonValue,
      },
      update: {
        value: parsed.data as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(
      { success: true, draft: setting.value },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Theme builder draft save error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save the builder draft." },
      { status: 500 }
    );
  }
}
