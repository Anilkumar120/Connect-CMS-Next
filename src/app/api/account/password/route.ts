import { compare, hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyRequestOrigin } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Enter your current password and a new password of at least 8 characters." }, { status: 400 });
  }
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record || !(await compare(parsed.data.currentPassword, record.passwordHash))) {
    return NextResponse.json({ success: false, message: "Current password is incorrect." }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(parsed.data.newPassword, 10) },
  });
  return NextResponse.json({ success: true, message: "Password updated." });
}
