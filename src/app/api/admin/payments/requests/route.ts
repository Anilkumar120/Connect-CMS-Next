import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

async function isPaymentsAdmin() {
  const user = await getCurrentUser();
  return Boolean(user && ["SUPER_ADMIN", "ADMIN"].includes(user.role));
}

export async function GET(request: NextRequest) {
  if (!(await isPaymentsAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const transactionNumber = params.get("transactionNumber")?.trim();
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) {
    const date = new Date(`${from}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== from) {
      return NextResponse.json({ success: false, message: "Invalid from date." }, { status: 400 });
    }
    dateFilter.gte = date;
  }
  if (to) {
    const date = new Date(`${to}T23:59:59.999Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== to) {
      return NextResponse.json({ success: false, message: "Invalid to date." }, { status: 400 });
    }
    dateFilter.lte = date;
  }
  if (dateFilter.gte && dateFilter.lte && dateFilter.gte > dateFilter.lte) {
    return NextResponse.json({ success: false, message: "From date must be before to date." }, { status: 400 });
  }
  if (transactionNumber && transactionNumber.length > 40) {
    return NextResponse.json({ success: false, message: "Transaction number is too long." }, { status: 400 });
  }
  try {
    const requests = await prisma.paymentRequest.findMany({
      where: {
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
        ...(transactionNumber ? { transactionNumber: { contains: transactionNumber } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error("GET admin payment requests error:", error);
    return NextResponse.json({ success: false, message: "Unable to load payment requests." }, { status: 500 });
  }
}
