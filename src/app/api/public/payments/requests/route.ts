import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";
import { createPaymentRequestNumber } from "@/lib/payments";

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  let bodyValue: unknown;
  try {
    bodyValue = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON request." },
      { status: 400 },
    );
  }
  if (!bodyValue || typeof bodyValue !== "object" || Array.isArray(bodyValue)) {
    return NextResponse.json(
      { success: false, message: "Invalid payment request." },
      { status: 400 },
    );
  }

  const body = bodyValue as Record<string, unknown>;
  try {
    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
    const accountNumber = typeof body.accountNumber === "string" ? body.accountNumber.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const gatewayCode = typeof body.gatewayCode === "string" ? body.gatewayCode.trim() : "";
    const amountText = typeof body.amount === "string" || typeof body.amount === "number"
      ? String(body.amount).trim()
      : "";
    const amount = Number(amountText);

    if (
      customerName.length < 2 ||
      customerName.length > 160 ||
      accountNumber.length < 3 ||
      accountNumber.length > 80 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      email.length > 254 ||
      (phone && (!/^[+()\d\s.-]{7,32}$/.test(phone) || phone.replace(/\D/g, "").length < 7)) ||
      (!email && !phone) ||
      !/^(?:\d{1,10})(?:\.\d{1,2})?$/.test(amountText) ||
      !Number.isFinite(amount) ||
      amount < 1 ||
      amount > 10000000 ||
      !gatewayCode ||
      body.privacyConsent !== true
    ) {
      return NextResponse.json(
        { success: false, message: "Check the required details, amount, and privacy consent." },
        { status: 400 },
      );
    }

    const gateway = await prisma.paymentGatewayConfig.findFirst({
      where: { code: gatewayCode, enabled: true },
      select: { code: true, displayName: true },
    });
    if (!gateway) {
      return NextResponse.json(
        { success: false, message: "Choose an enabled payment option." },
        { status: 400 },
      );
    }

    const paymentRequest = await prisma.paymentRequest.create({
      data: {
        transactionNumber: createPaymentRequestNumber(),
        status: "PENDING_LOOKUP",
        customerName,
        accountNumber,
        email: email || null,
        phone: phone || null,
        amount: new Prisma.Decimal(amountText),
        gatewayCode: gateway.code,
        gatewayName: gateway.displayName,
        privacyConsent: true,
      },
      select: { transactionNumber: true, status: true },
    });

    return NextResponse.json(
      {
        success: true,
        request: paymentRequest,
        message: "Request recorded only. No payment was processed or verified.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create payment request error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to record the payment request." },
      { status: 500 },
    );
  }
}
