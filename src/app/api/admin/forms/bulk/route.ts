import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const admins = ["SUPER_ADMIN", "ADMIN"];
const editors = ["SUPER_ADMIN", "ADMIN", "EDITOR"];
const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["TRASH", "RESTORE", "PERMANENT_DELETE", "ARCHIVE", "PUBLISH", "DRAFT"]),
});

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user || !editors.includes(user.role)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, message: "Select forms and a valid action." }, { status: 400 });
  const { ids, action } = parsed.data;
  if (action === "TRASH" && !admins.includes(user.role)) return NextResponse.json({ success: false, message: "Only administrators can delete forms." }, { status: 403 });
  if (action === "PERMANENT_DELETE") {
    if (!admins.includes(user.role)) return NextResponse.json({ success: false, message: "Only administrators can permanently delete forms." }, { status: 403 });
    const result = await prisma.form.deleteMany({
      where: { id: { in: [...new Set(ids)] }, deletedAt: { not: null } },
    });
    return NextResponse.json({ success: true, count: result.count });
  }
  const data = action === "TRASH" ? { deletedAt: new Date() }
    : action === "RESTORE" ? { deletedAt: null }
    : { status: action === "ARCHIVE" ? "ARCHIVED" as const : action === "PUBLISH" ? "PUBLISHED" as const : "DRAFT" as const };
  const result = await prisma.form.updateMany({ where: { id: { in: [...new Set(ids)] } }, data });
  return NextResponse.json({ success: true, count: result.count });
}
