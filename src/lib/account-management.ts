import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MANAGE_USERS_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN"];

export function canManageUsers(role: UserRole) {
  return MANAGE_USERS_ROLES.includes(role);
}

export function canManageRole(actorRole: UserRole, targetRole: UserRole) {
  return actorRole === "SUPER_ADMIN" ||
    (actorRole === "ADMIN" &&
      targetRole !== "SUPER_ADMIN" &&
      targetRole !== "ADMIN");
}

export async function validateAvatarUrl(avatarUrl: string | null) {
  if (!avatarUrl) return null;

  const asset = await prisma.mediaAsset.findFirst({
    where: {
      filePath: avatarUrl,
      isDeleted: false,
      mimeType: { startsWith: "image/" },
    },
    select: { filePath: true },
  });

  return asset?.filePath ?? undefined;
}

export function normalizePhone(phone: string) {
  return phone.trim().replace(/[()\s.-]/g, "");
}

export function isValidPhone(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export async function ensureSuperAdminRemains(
  transaction: Prisma.TransactionClient,
  userId: string,
  options: { removingRole?: boolean; deactivating?: boolean }
) {
  const existing = await transaction.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  if (!existing || existing.role !== "SUPER_ADMIN") return;

  if (options.removingRole) {
    const remaining = await transaction.user.count({
      where: {
        role: "SUPER_ADMIN",
        ...(existing.isActive ? { isActive: true } : {}),
        id: { not: userId },
      },
    });
    if (remaining === 0) throw new Error("LAST_SUPER_ADMIN");
  }

  if (options.deactivating && existing.isActive) {
    const activeRemaining = await transaction.user.count({
      where: {
        role: "SUPER_ADMIN",
        isActive: true,
        id: { not: userId },
      },
    });
    if (activeRemaining === 0) throw new Error("LAST_SUPER_ADMIN");
  }
}
