import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const KEY = "admin-ui-preferences";
const defaults = {
  mode: "light" as const,
  primaryColor: "#0c2f55",
  accentColor: "#3984e8",
  buttonColor: "#3984e8",
  buttonTextColor: "#ffffff",
  buttonHoverColor: "#2c6fcb",
};
const schema = z.object({
  mode: z.enum(["light", "dark", "system"]).default("light"),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  buttonTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  buttonHoverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

async function authorized() {
  const user = await getCurrentUser();
  return user?.isActive ? user : null;
}

export async function GET() {
  const user = await authorized();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: KEY }, select: { value: true } });
    const value = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
      ? setting.value as Record<string, unknown> : {};
    const parsed = schema.safeParse({ ...defaults, ...value });
    return NextResponse.json({ success: true, preferences: parsed.success ? parsed.data : defaults });
  } catch (error) {
    console.error("Load admin theme preferences failed:", error);
    return NextResponse.json({ success: false, message: "Unable to load theme preferences." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const user = await authorized();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Invalid theme preferences." }, { status: 400 });
    await prisma.siteSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: parsed.data },
      update: { value: parsed.data },
    });
    return NextResponse.json({ success: true, message: "Admin theme saved.", preferences: parsed.data });
  } catch (error) {
    console.error("Save admin theme preferences failed:", error);
    return NextResponse.json({ success: false, message: "Unable to save theme preferences." }, { status: 500 });
  }
}
