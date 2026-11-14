import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { canManageRole, canManageUsers } from "@/lib/account-management";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["activate", "deactivate", "delete"]),
});

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const actor = await getCurrentUser();
  if (!actor || !canManageUsers(actor.role)) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: actor ? 403 : 401 });
  }

  const parsed = bulkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Select users and a valid bulk action." }, { status: 400 });
  }
  const ids = [...new Set(parsed.data.ids)];
  if (ids.includes(actor.id)) {
    return NextResponse.json({ success: false, message: "Bulk actions cannot include your own account." }, { status: 409 });
  }

  try {
    const count = await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, role: true, isActive: true },
      });
      if (users.length !== ids.length) throw new Error("USER_NOT_FOUND");
      if (users.some((user) => !canManageRole(actor.role, user.role))) throw new Error("ROLE_FORBIDDEN");

      const selectedActiveSuperAdmins = users.filter((user) => user.role === "SUPER_ADMIN" && user.isActive).length;
      if (parsed.data.action === "delete") {
        const remaining = await tx.user.count({
          where: { role: "SUPER_ADMIN", id: { notIn: ids } },
        });
        const remainingActive = selectedActiveSuperAdmins > 0
          ? await tx.user.count({
            where: { role: "SUPER_ADMIN", isActive: true, id: { notIn: ids } },
          })
          : 1;
        if (remaining === 0 || remainingActive === 0) throw new Error("LAST_SUPER_ADMIN");
        await tx.user.deleteMany({ where: { id: { in: ids } } });
      } else {
        if (parsed.data.action === "deactivate" && selectedActiveSuperAdmins > 0) {
          const remainingActive = await tx.user.count({
            where: { role: "SUPER_ADMIN", isActive: true, id: { notIn: ids } },
          });
          if (remainingActive === 0) throw new Error("LAST_SUPER_ADMIN");
        }
        await tx.user.updateMany({
          where: { id: { in: ids } },
          data: { isActive: parsed.data.action === "activate" },
        });
      }
      return users.length;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "LAST_SUPER_ADMIN") {
        return NextResponse.json({ success: false, message: "The last Super Admin cannot be removed or deactivated." }, { status: 409 });
      }
      if (error.message === "ROLE_FORBIDDEN") {
        return NextResponse.json({ success: false, message: "Your role cannot manage one or more selected users." }, { status: 403 });
      }
      if (error.message === "USER_NOT_FOUND") {
        return NextResponse.json({ success: false, message: "One or more selected users no longer exist." }, { status: 404 });
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ success: false, message: "User records changed concurrently. Refresh and retry." }, { status: 409 });
    }
    console.error("Bulk user action failed:", error);
    return NextResponse.json({ success: false, message: "Unable to complete bulk action." }, { status: 500 });
  }
}
