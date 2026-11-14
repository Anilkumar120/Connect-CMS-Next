import { createHmac, timingSafeEqual } from "node:crypto";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { normalizePhone } from "@/lib/account-management";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const verifySchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  channel: z.enum(["EMAIL", "SMS"]),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(72),
});

function getPepper() {
  const secret = process.env.PASSWORD_RESET_SECRET;
  if (!secret || secret.length < 32) throw new Error("PASSWORD_RESET_SECRET is not configured.");
  return secret;
}

function hmac(value: string) {
  return createHmac("sha256", getPepper()).update(value).digest();
}

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const parsed = verifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Enter the 6-digit code and a new password of at least 8 characters." }, { status: 400 });
  }

  const recipient = parsed.data.channel === "EMAIL"
    ? parsed.data.identifier.toLowerCase()
    : normalizePhone(parsed.data.identifier);
  if (parsed.data.channel === "EMAIL" && !z.string().email().safeParse(recipient).success) {
    return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 400 });
  }
  if (parsed.data.channel === "SMS" && !/^\+[1-9]\d{7,14}$/.test(recipient)) {
    return NextResponse.json({ success: false, message: "Enter a valid phone number." }, { status: 400 });
  }

  try {
    const recipientHash = hmac(`recipient:${recipient}`).toString("hex");
    const otp = await prisma.passwordResetOtp.findFirst({
      where: { recipientHash, channel: parsed.data.channel },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    if (!otp || !otp.userId || otp.consumedAt || otp.expiresAt <= now || otp.failedAttempts >= 5) {
      return NextResponse.json({ success: false, message: "The code is invalid or expired. Request a new one." }, { status: 400 });
    }

    const suppliedHash = hmac(`${parsed.data.channel}:${recipient}:${parsed.data.code}`);
    const storedHash = Buffer.from(otp.tokenHash, "hex");
    if (storedHash.length !== suppliedHash.length || !timingSafeEqual(storedHash, suppliedHash)) {
      await prisma.passwordResetOtp.updateMany({
        where: { id: otp.id, consumedAt: null, failedAttempts: { lt: 5 } },
        data: {
          failedAttempts: { increment: 1 },
          ...(otp.failedAttempts >= 4 ? { consumedAt: now } : {}),
        },
      });
      return NextResponse.json({ success: false, message: "The code is invalid or expired. Request a new one." }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: otp.userId,
        isActive: true,
        ...(parsed.data.channel === "EMAIL" ? { email: recipient } : { phone: recipient }),
      },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, message: "The code is invalid or expired. Request a new one." }, { status: 400 });
    }

    const passwordHash = await hash(parsed.data.newPassword, 10);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetOtp.updateMany({
        where: {
          id: otp.id,
          consumedAt: null,
          expiresAt: { gt: now },
          failedAttempts: { lt: 5 },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new Error("OTP_ALREADY_USED");
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.passwordResetOtp.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: now },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true, message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    if (error instanceof Error && error.message === "OTP_ALREADY_USED") {
      return NextResponse.json({ success: false, message: "The code is invalid or expired. Request a new one." }, { status: 400 });
    }
    console.error("Password reset verification failed:", error);
    return NextResponse.json({ success: false, message: "Unable to reset the password." }, { status: 500 });
  }
}
