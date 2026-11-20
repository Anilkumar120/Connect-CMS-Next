import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";
import {
  getSiteSettings,
  siteSettingsSchema,
} from "@/lib/site-settings";

async function authorize() {
  const user = await getCurrentUser();
  return user?.isActive ? user : null;
}

function getRequestSiteOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    } catch {
      // Fall through to the incoming deployment host.
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : request.nextUrl.protocol.replace(":", "");

  try {
    const url = new URL(`${protocol}://${host}`);
    if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
  } catch {
    // Fall through to Next.js' request URL.
  }

  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  try {
    const user = await authorize();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const siteOrigin = getRequestSiteOrigin(request);
    const settings = await getSiteSettings({
      siteOrigin,
      adminEmail: user.email,
    });
    const [pages, icon] = await Promise.all([
      prisma.page.findMany({
        where: { status: "PUBLISHED", deletedAt: null },
        select: { id: true, title: true, slug: true },
        orderBy: { title: "asc" },
      }),
      settings.general.siteIconId
        ? prisma.mediaAsset.findFirst({
            where: {
              id: settings.general.siteIconId,
              isDeleted: false,
              mimeType: { startsWith: "image/" },
            },
            select: { id: true, filePath: true, originalName: true },
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      settings: {
        ...settings,
        general: { ...settings.general, siteIcon: icon },
      },
      pages,
      runtime: {
        siteOrigin,
        adminEmail: user.email,
      },
    });
  } catch (error) {
    console.error("GET site settings error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load site settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await authorize())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = siteSettingsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.error.issues[0]?.message || "Invalid site settings.",
        },
        { status: 400 }
      );
    }

    const settings = result.data;
    for (const address of [
      settings.general.wordpressAddress,
      settings.general.siteAddress,
    ]) {
      const protocol = new URL(address).protocol;
      if (protocol !== "http:" && protocol !== "https:") {
        return NextResponse.json(
          { success: false, message: "Site addresses must use HTTP or HTTPS." },
          { status: 400 }
        );
      }
    }

    try {
      new Intl.DateTimeFormat("en", { timeZone: settings.general.timezone });
    } catch {
      return NextResponse.json(
        { success: false, message: "Select a valid timezone." },
        { status: 400 }
      );
    }

    if (
      settings.reading.showOnFront === "page" &&
      !settings.reading.homepagePageId
    ) {
      return NextResponse.json(
        { success: false, message: "Choose a homepage page." },
        { status: 400 }
      );
    }
    if (
      settings.reading.showOnFront === "page" &&
      settings.reading.homepagePageId &&
      settings.reading.homepagePageId === settings.reading.postsPageId
    ) {
      return NextResponse.json(
        { success: false, message: "Choose different homepage and posts pages." },
        { status: 400 }
      );
    }

    const [icon, homepage, postsPage] = await Promise.all([
      settings.general.siteIconId
        ? prisma.mediaAsset.findFirst({
            where: {
              id: settings.general.siteIconId,
              isDeleted: false,
              mimeType: { startsWith: "image/" },
            },
            select: { id: true },
          })
        : null,
      settings.reading.homepagePageId
        ? prisma.page.findFirst({
            where: {
              id: settings.reading.homepagePageId,
              status: "PUBLISHED",
              deletedAt: null,
            },
            select: { id: true },
          })
        : null,
      settings.reading.postsPageId
        ? prisma.page.findFirst({
            where: {
              id: settings.reading.postsPageId,
              status: "PUBLISHED",
              deletedAt: null,
            },
            select: { id: true },
          })
        : null,
    ]);

    if (settings.general.siteIconId && !icon) {
      return NextResponse.json(
        { success: false, message: "Choose an image from the Media Library." },
        { status: 400 }
      );
    }
    if (settings.reading.homepagePageId && !homepage) {
      return NextResponse.json(
        { success: false, message: "Choose a published homepage page." },
        { status: 400 }
      );
    }
    if (settings.reading.postsPageId && !postsPage) {
      return NextResponse.json(
        { success: false, message: "Choose a published posts page." },
        { status: 400 }
      );
    }

    await prisma.siteSetting.upsert({
      where: { key: "site-settings" },
      create: { key: "site-settings", value: settings },
      update: { value: settings },
    });

    return NextResponse.json({
      success: true,
      message: "Settings saved.",
      settings,
    });
  } catch (error) {
    console.error("PUT site settings error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save site settings." },
      { status: 500 }
    );
  }
}
