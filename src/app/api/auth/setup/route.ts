
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const setupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100),
  username: z.string().trim().min(3, "Username must be at least 3 characters.").max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can contain letters, numbers, dots, underscores and hyphens only."),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  password: z.string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password cannot exceed 72 characters."),
  setupSecret: z.string().min(1, "Setup Secret is required."),
});

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    const body = await request.json();
    const parsed = setupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Please check registration details." },
        { status: 400 }
      );
    }

    const { name, username, email, password, setupSecret } = parsed.data;
    const expectedSecret = process.env.SETUP_SECRET;

    if (!expectedSecret || setupSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, message: "Invalid setup authorization." },
        { status: 403 }
      );
    }

    const passwordHash = await hash(password, 10);

    const user = await prisma.$transaction(
      async (tx) => {
        const userCount = await tx.user.count();

        if (userCount > 0) {
          throw new Error("SETUP_ALREADY_COMPLETED");
        }

        return tx.user.create({
          data: {
            name,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            passwordHash,
            role: "SUPER_ADMIN",
            isActive: true,
          },
          select: {
            id: true,
            email: true,
            role: true,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    await createSession(user);

    return NextResponse.json({
      success: true,
      message: "Super Admin account created successfully.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SETUP_ALREADY_COMPLETED") {
      return NextResponse.json(
        { success: false, message: "Initial setup has already been completed." },
        { status: 409 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "Username or email already exists." },
        { status: 409 }
      );
    }

    console.error("Initial setup failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to complete initial setup." },
      { status: 500 }
    );
  }
}
