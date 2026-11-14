import { NextResponse } from "next/server";
import { getPublicPaymentGateways } from "@/lib/payments";

export async function GET() {
  try {
    const gateways = await getPublicPaymentGateways();
    return NextResponse.json(
      { success: true, gateways },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("GET public payment gateways error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load payment options." },
      { status: 500 },
    );
  }
}
