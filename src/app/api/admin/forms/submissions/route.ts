import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const allowed = ["SUPER_ADMIN", "ADMIN", "EDITOR"];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !allowed.includes(user.role)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const trash = request.nextUrl.searchParams.get("trash") === "1";
  const formId = request.nextUrl.searchParams.get("formId") || undefined;
  const submissions = await prisma.formSubmission.findMany({
    where: { deletedAt: trash ? { not: null } : null, ...(formId && { formId }) },
    include: { form: { select: { id: true, title: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ success: true, submissions });
}
