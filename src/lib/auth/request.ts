import { NextRequest, NextResponse } from "next/server";

export function verifyRequestOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host");

  if (!origin || !host) {
    return NextResponse.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 }
    );
  }

  try {
    if (new URL(origin).host !== host) {
      return NextResponse.json(
        { success: false, message: "Cross-origin request blocked." },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 }
    );
  }

  return null;
}