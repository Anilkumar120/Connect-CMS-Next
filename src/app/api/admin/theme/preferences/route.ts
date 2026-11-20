import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const KEY = "admin-ui-preferences";
const color = (fallback: string) => z.string().regex(/^#[0-9a-fA-F]{6}$/).default(fallback);

const defaults = {
  mode: "light" as const,
  primaryColor: "#0c2f55",
  sidebarTextColor: "#ffffff",
  accentColor: "#3984e8",
  backgroundColor: "#f4f7fb",
  surfaceColor: "#ffffff",
  textColor: "#19283a",
  mutedTextColor: "#718096",
  borderColor: "#e5eaf1",
  hoverColor: "#eaf2fc",
  hoverTextColor: "#0c2f55",
  buttonColor: "#3984e8",
  buttonTextColor: "#ffffff",
  buttonHoverColor: "#2c6fcb",
  buttonHoverTextColor: "#ffffff",
  inputBackgroundColor: "#ffffff",
  inputTextColor: "#19283a",
  darkBackgroundColor: "#101a27",
  darkSurfaceColor: "#172538",
  darkTextColor: "#e8eef6",
  darkMutedTextColor: "#9cacc0",
  darkBorderColor: "#2b3c51",
  darkHoverColor: "#23364d",
  darkHoverTextColor: "#ffffff",
};

const schema = z.object({
  mode: z.enum(["light", "dark", "system"]).default(defaults.mode),
  primaryColor: color(defaults.primaryColor),
  sidebarTextColor: color(defaults.sidebarTextColor),
  accentColor: color(defaults.accentColor),
  backgroundColor: color(defaults.backgroundColor),
  surfaceColor: color(defaults.surfaceColor),
  textColor: color(defaults.textColor),
  mutedTextColor: color(defaults.mutedTextColor),
  borderColor: color(defaults.borderColor),
  hoverColor: color(defaults.hoverColor),
  hoverTextColor: color(defaults.hoverTextColor),
  buttonColor: color(defaults.buttonColor),
  buttonTextColor: color(defaults.buttonTextColor),
  buttonHoverColor: color(defaults.buttonHoverColor),
  buttonHoverTextColor: color(defaults.buttonHoverTextColor),
  inputBackgroundColor: color(defaults.inputBackgroundColor),
  inputTextColor: color(defaults.inputTextColor),
  darkBackgroundColor: color(defaults.darkBackgroundColor),
  darkSurfaceColor: color(defaults.darkSurfaceColor),
  darkTextColor: color(defaults.darkTextColor),
  darkMutedTextColor: color(defaults.darkMutedTextColor),
  darkBorderColor: color(defaults.darkBorderColor),
  darkHoverColor: color(defaults.darkHoverColor),
  darkHoverTextColor: color(defaults.darkHoverTextColor),
});

async function authorized() {
  const user = await getCurrentUser();
  return user?.isActive ? user : null;
}

export async function GET() {
  const user = await authorized();
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: KEY },
      select: { value: true },
    });
    const value =
      setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
        ? (setting.value as Record<string, unknown>)
        : {};
    const parsed = schema.safeParse({ ...defaults, ...value });

    return NextResponse.json({
      success: true,
      preferences: parsed.success ? parsed.data : defaults,
    });
  } catch (error) {
    console.error("Load admin theme preferences failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load theme preferences." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  const user = await authorized();
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "Invalid theme preferences.",
        },
        { status: 400 },
      );
    }

    await prisma.siteSetting.upsert({
      where: { key: KEY },
      create: {
        key: KEY,
        value: parsed.data,
      },
      update: {
        value: parsed.data,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Admin theme saved.",
      preferences: parsed.data,
    });
  } catch (error) {
    console.error("Save admin theme preferences failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save theme preferences." },
      { status: 500 },
    );
  }
}
 