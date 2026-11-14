import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isValidPhone, normalizePhone, validateAvatarUrl } from "@/lib/account-management";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(32).optional().default(""),
  avatarUrl: z.string().max(1000).nullable(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      isActive: true,
    },
  });
  if (!profile || !profile.isActive) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json({ success: true, profile });
}

export async function PATCH(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Check your profile details." }, { status: 400 });
  }

  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  if (phone && !isValidPhone(phone)) {
    return NextResponse.json({ success: false, message: "Enter a phone number in international format, such as +14155550123." }, { status: 400 });
  }
  const avatarUrl = await validateAvatarUrl(parsed.data.avatarUrl);
  if (avatarUrl === undefined) {
    return NextResponse.json({ success: false, message: "Choose a profile photo from the media library." }, { status: 400 });
  }

  try {
    const profile = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        name: parsed.data.name,
        username: parsed.data.username.toLowerCase(),
        email: parsed.data.email.toLowerCase(),
        phone,
        avatarUrl: avatarUrl ?? null,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
      },
    });
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "Username, email, or phone is already in use." }, { status: 409 });
    }
    console.error("Profile update failed:", error);
    return NextResponse.json({ success: false, message: "Unable to update your profile." }, { status: 500 });
  }
}
