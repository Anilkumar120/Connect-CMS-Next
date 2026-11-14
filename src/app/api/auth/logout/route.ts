
import { NextRequest, NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);

  if (originError) {
    return originError;
  }

  try {
    await destroySession();

    return NextResponse.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Logout API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Logout failed.",
      },
      { status: 500 }
    );
  }
}
