import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SHORTCODE_PATTERN = /^\s*\[connect_form\s+id\s*=\s*(["'])([a-zA-Z0-9_-]{1,100})\1\s*\/?\]\s*$/i;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") || "";
  if (code.length > 500) {
    return NextResponse.json({ success: false, message: "Shortcode is too long." }, { status: 400 });
  }

  const match = code.match(SHORTCODE_PATTERN);
  if (!match) {
    return NextResponse.json({ success: false, message: "This shortcode is not registered." }, { status: 404 });
  }

  const identifier = match[2];
  try {
    const form = await prisma.form.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
        status: "PUBLISHED",
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        fields: true,
        settings: true,
        styles: true,
      },
    });

    if (!form) {
      return NextResponse.json({ success: false, message: "Published form not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, form }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Builder shortcode lookup failed:", error);
    return NextResponse.json({ success: false, message: "Unable to load shortcode." }, { status: 500 });
  }
}
