import { hash } from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { canManageRole, canManageUsers, isValidPhone, normalizePhone, validateAvatarUrl } from "@/lib/account-management";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const userInput = z.object({
  name: z.string().trim().min(1).max(100),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(32).optional().default(""),
  avatarUrl: z.string().max(1000).nullable().optional().default(null),
  role: z.nativeEnum(UserRole),
  password: z.string().min(8).max(72),
  isActive: z.boolean().optional().default(true),
});

function errorResponse(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      { success: false, message: "Username, email, or phone is already in use." },
      { status: 409 }
    );
  }
  console.error("User management request failed:", error);
  return NextResponse.json(
    { success: false, message: "Unable to complete user management request." },
    { status: 500 }
  );
}

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor || !canManageUsers(actor.role)) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: actor ? 403 : 401 });
  }

  try {
    let users;
    try {
      users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      });
    } catch (ormError) {
      if (
        !(ormError instanceof Error) ||
        ormError.name !== "PrismaClientValidationError" ||
        !/Unknown field `(phone|avatarUrl)`/.test(ormError.message)
      ) {
        throw ormError;
      }
      console.warn("User list used the SQL compatibility path for a stale Prisma Client schema.");
      users = await prisma.$queryRaw<Array<{
        id: string;
        name: string;
        username: string;
        email: string;
        phone: string | null;
        avatarUrl: string | null;
        role: UserRole;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>>(Prisma.sql`
        SELECT \`id\`, \`name\`, \`username\`, \`email\`, \`phone\`, \`avatarUrl\`,
               \`role\`, \`isActive\`, \`createdAt\`, \`updatedAt\`
        FROM \`User\`
        ORDER BY \`createdAt\` DESC, \`name\` ASC
      `);
    }
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  const actor = await getCurrentUser();
  if (!actor || !canManageUsers(actor.role)) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: actor ? 403 : 401 });
  }

  const parsed = userInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Check the user details and password requirements." }, { status: 400 });
  }

  const data = parsed.data;
  const phone = data.phone ? normalizePhone(data.phone) : null;
  if (phone && !isValidPhone(phone)) {
    return NextResponse.json({ success: false, message: "Enter a phone number in international format, such as +14155550123." }, { status: 400 });
  }
  if (!canManageRole(actor.role, data.role)) {
    return NextResponse.json({ success: false, message: "You cannot assign that role." }, { status: 403 });
  }
  const avatarUrl = await validateAvatarUrl(data.avatarUrl ?? null);
  if (avatarUrl === undefined) {
    return NextResponse.json({ success: false, message: "Choose a profile photo from the media library." }, { status: 400 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: data.name,
        username: data.username.toLowerCase(),
        email: data.email.toLowerCase(),
        phone,
        avatarUrl,
        role: data.role,
        isActive: data.isActive,
        passwordHash: await hash(data.password, 10),
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
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
