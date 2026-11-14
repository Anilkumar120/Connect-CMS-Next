import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export async function GET() {
  try {
    const settings = await getSiteSettings();
    const icon = settings.general.siteIconId
      ? await prisma.mediaAsset.findFirst({
          where: {
            id: settings.general.siteIconId,
            isDeleted: false,
            mimeType: { startsWith: "image/" },
          },
          select: { filePath: true },
        })
      : null;

    return NextResponse.json(
      {
        success: true,
        siteTitle: settings.general.siteTitle,
        language: settings.general.language,
        iconUrl: icon?.filePath || null,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("GET public site settings error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load public site settings." },
      { status: 500 }
    );
  }
}
