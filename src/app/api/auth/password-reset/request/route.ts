import { createHmac, randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { OtpDeliveryError, deliverOtp, getOtpDeliveryReadiness } from "@/lib/auth/otp-delivery";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { normalizePhone } from "@/lib/account-management";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  channel: z.enum(["EMAIL", "SMS"]),
});

function getPepper() {
  const secret = process.env.PASSWORD_RESET_SECRET;
  if (!secret || secret.length < 32) {
    throw new OtpDeliveryError("PASSWORD_RESET_SECRET must be configured with at least 32 characters.", 503);
  }
  return secret;
}

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Enter an email address or phone number and choose a delivery method." }, { status: 400 });
  }

  try {
    getOtpDeliveryReadiness(parsed.data.channel);
    const recipient = parsed.data.channel === "EMAIL"
      ? parsed.data.identifier.toLowerCase()
      : normalizePhone(parsed.data.identifier);
    if (
      parsed.data.channel === "EMAIL" &&
      !z.string().email().safeParse(recipient).success
    ) {
      return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 400 });
    }
    if (parsed.data.channel === "SMS" && !/^\+[1-9]\d{7,14}$/.test(recipient)) {
      return NextResponse.json({ success: false, message: "Enter a phone number in international format, such as +14155550123." }, { status: 400 });
    }

    const pepper = getPepper();
    const recipientHash = createHmac("sha256", pepper).update(`recipient:${recipient}`).digest("hex");
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const sourceIp = forwardedFor || request.headers.get("x-real-ip") || "unknown";
    const requestIpHash = createHmac("sha256", pepper).update(`ip:${sourceIp}`).digest("hex");
    const windowStart = new Date(Date.now() - 60 * 60 * 1000);
    const user = await prisma.user.findFirst({
      where: parsed.data.channel === "EMAIL"
        ? { email: recipient, isActive: true }
        : { phone: recipient, isActive: true },
      select: { id: true },
    });
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const tokenHash = createHmac("sha256", pepper)
      .update(`${parsed.data.channel}:${recipient}:${code}`)
      .digest("hex");
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const [recipientRequests, ipRequests] = await Promise.all([
        tx.passwordResetOtp.count({ where: { recipientHash, createdAt: { gte: windowStart } } }),
        tx.passwordResetOtp.count({ where: { requestIpHash, createdAt: { gte: windowStart } } }),
      ]);
      if (recipientRequests >= 3 || ipRequests >= 10) {
        throw new Error("OTP_RATE_LIMIT");
      }

      await tx.passwordResetOtp.updateMany({
        where: { recipientHash, channel: parsed.data.channel, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.passwordResetOtp.create({
        data: {
          userId: user?.id ?? null,
          channel: parsed.data.channel,
          recipientHash,
          requestIpHash,
          tokenHash,
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (user) {
      try {
        await deliverOtp(parsed.data.channel, recipient, code);
      } catch (error) {
        await prisma.passwordResetOtp.updateMany({
          where: { recipientHash, channel: parsed.data.channel, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        if (error instanceof OtpDeliveryError) {
          return NextResponse.json({ success: false, message: error.message }, { status: error.status });
        }
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      message: "If an active account matches those details, a reset code has been sent.",
    });
  } catch (error) {
    if (error instanceof OtpDeliveryError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === "OTP_RATE_LIMIT") {
      return NextResponse.json({ success: false, message: "Too many reset requests. Try again later." }, { status: 429 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ success: false, message: "Too many reset requests. Try again later." }, { status: 429 });
    }
    console.error("Password reset request failed:", error);
    return NextResponse.json({ success: false, message: "Unable to process the password reset request." }, { status: 500 });
  }
}
