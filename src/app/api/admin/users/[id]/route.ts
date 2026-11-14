import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { canManageRole, canManageUsers, ensureSuperAdminRemains, isValidPhone, normalizePhone, validateAvatarUrl } from "@/lib/account-management";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  avatarUrl: z.string().max(1000).nullable().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ success: false, message: "Username, email, or phone is already in use." }, { status: 409 });
  }
  if (error instanceof Error && error.message === "LAST_SUPER_ADMIN") {
    return NextResponse.json({ success: false, message: "The last Super Admin cannot be removed or deactivated." }, { status: 409 });
  }
  if (error instanceof Error && error.message === "USER_NOT_FOUND") {
    return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
  }
  console.error("User update failed:", error);
  return NextResponse.json({ success: false, message: "Unable to update user." }, { status: 500 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const actor = await getCurrentUser();
  if (!actor || !canManageUsers(actor.role)) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: actor ? 403 : 401 });
  }

  const { id } = await context.params;
  if (id === actor.id) {
    return NextResponse.json({ success: false, message: "Use your profile page to edit your own account." }, { status: 409 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ success: false, message: "Check the user details." }, { status: 400 });
  }

  const data = parsed.data;
  if (data.role && !canManageRole(actor.role, data.role)) {
    return NextResponse.json({ success: false, message: "You cannot assign that role." }, { status: 403 });
  }

  const phone = data.phone === undefined ? undefined : data.phone ? normalizePhone(data.phone) : null;
  if (phone && !isValidPhone(phone)) {
    return NextResponse.json({ success: false, message: "Enter a phone number in international format, such as +14155550123." }, { status: 400 });
  }
  const avatarUrl = data.avatarUrl === undefined ? undefined : await validateAvatarUrl(data.avatarUrl);
  if (avatarUrl === undefined && data.avatarUrl !== undefined && data.avatarUrl !== null) {
    return NextResponse.json({ success: false, message: "Choose a profile photo from the media library." }, { status: 400 });
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
      if (!current) throw new Error("USER_NOT_FOUND");
      if (!canManageRole(actor.role, current.role)) throw new Error("ROLE_FORBIDDEN");
      if (data.role && !canManageRole(actor.role, current.role)) throw new Error("ROLE_FORBIDDEN");

      const removingRole = current.role === "SUPER_ADMIN" && data.role !== undefined && data.role !== "SUPER_ADMIN";
      const deactivating = data.isActive === false;
      if (removingRole || deactivating) {
        await ensureSuperAdminRemains(tx, id, { removingRole, deactivating });
      }

      return tx.user.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.username !== undefined ? { username: data.username.toLowerCase() } : {}),
          ...(data.email !== undefined ? { email: data.email.toLowerCase() } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(data.avatarUrl !== undefined ? { avatarUrl: avatarUrl ?? null } : {}),
          ...(data.role !== undefined ? { role: data.role } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
        select: {
          id: true, name: true, username: true, email: true, phone: true,
          avatarUrl: true, role: true, isActive: true, createdAt: true, updatedAt: true,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, user });
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_FORBIDDEN") {
      return NextResponse.json({ success: false, message: "You cannot manage an account with that role." }, { status: 403 });
    }
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const actor = await getCurrentUser();
  if (!actor || !canManageUsers(actor.role)) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: actor ? 403 : 401 });
  }

  const { id } = await context.params;
  if (id === actor.id) {
    return NextResponse.json({ success: false, message: "You cannot delete your own account." }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: { id: true, role: true } });
      if (!current) throw new Error("USER_NOT_FOUND");
      if (!canManageRole(actor.role, current.role)) throw new Error("ROLE_FORBIDDEN");
      if (current.role === "SUPER_ADMIN") {
        await ensureSuperAdminRemains(tx, id, { removingRole: true });
      }
      await tx.user.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_FORBIDDEN") {
      return NextResponse.json({ success: false, message: "You cannot manage an account with that role." }, { status: 403 });
    }
    return errorResponse(error);
  }
}
