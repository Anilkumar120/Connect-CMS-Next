import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const templateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  header: z.record(z.string(), z.unknown()),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const setting = await prisma.siteSetting.findUnique({
      where: { key: "header_templates" },
      select: { value: true },
    });
    const templates = Array.isArray(setting?.value) ? setting.value : [];
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error("GET header templates error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load header templates." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    const user = await getCurrentUser();
    if (!user?.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const parsed = templateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Invalid header template.",
        },
        { status: 400 }
      );
    }

    const template = {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      header: parsed.data.header,
    };
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "header_templates" },
      select: { value: true },
    });
    const existing = Array.isArray(setting?.value) ? setting.value : [];
    const templates = [...existing, template];
    if (templates.length > 100) {
      return NextResponse.json(
        { success: false, message: "You can save up to 100 header templates." },
        { status: 400 }
      );
    }

    await prisma.siteSetting.upsert({
      where: { key: "header_templates" },
      create: {
        key: "header_templates",
        value: templates as Prisma.InputJsonValue,
      },
      update: { value: templates as Prisma.InputJsonValue },
    });

    return NextResponse.json(
      { success: true, template },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST header template error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save header template." },
      { status: 500 }
    );
  }
}
