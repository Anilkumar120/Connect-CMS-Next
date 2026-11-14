import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["READ", "UNREAD", "SPAM", "TRASH", "RESTORE"]),
});

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(user.role)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, message: "Select submissions and a valid action." }, { status: 400 });
  const { ids, action } = parsed.data;
  if (action === "TRASH" && !["SUPER_ADMIN", "ADMIN"].includes(user.role)) return NextResponse.json({ success: false, message: "Only administrators can delete submissions." }, { status: 403 });
  const data = action === "TRASH" ? { deletedAt: new Date() }
    : action === "RESTORE" ? { deletedAt: null }
    : { status: action };
  const result = await prisma.formSubmission.updateMany({ where: { id: { in: [...new Set(ids)] } }, data });
  return NextResponse.json({ success: true, count: result.count });
}
