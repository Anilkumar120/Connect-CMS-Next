import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(72),
});

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Enter username/email and password." },
        { status: 400 }
      );
    }

    const { identifier, password } = parsed.data;
    const value = identifier.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: value },
          { username: value },
        ],
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Invalid login credentials." },
        { status: 401 }
      );
    }

    const passwordMatches = await compare(password, user.passwordHash);

    if (!passwordMatches) {
      return NextResponse.json(
        { success: false, message: "Invalid login credentials." },
        { status: 401 }
      );
    }

    await createSession(user);

    return NextResponse.json({
      success: true,
      message: "Login successful.",
    });
  } catch (error) {
    console.error("Login failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to process login." },
      { status: 500 }
    );
  }
}