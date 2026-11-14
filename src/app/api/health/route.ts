
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      success: true,
      application: "Connect Broadband CMS",
      database: "Connected",
      status: "Healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        success: false,
        application: "Connect Broadband CMS",
        database: "Disconnected",
        status: "Unhealthy",
      },
      { status: 503 }
    );
  }
}
