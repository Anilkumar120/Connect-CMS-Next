import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PAYMENT_GATEWAYS,
  decryptPaymentSettings,
  encryptPaymentSettings,
  type PaymentGatewaySettings,
} from "@/lib/payments";

const settingKeys: (keyof PaymentGatewaySettings)[] = [
  "apiKey",
  "apiSecret",
  "merchantId",
  "clientId",
  "clientSecret",
  "bankVpa",
  "bankAccountName",
  "bankAccountNumber",
  "bankIfsc",
];

async function isPaymentsAdmin() {
  const user = await getCurrentUser();
  return Boolean(user && ["SUPER_ADMIN", "ADMIN"].includes(user.role));
}

function parseSettings(value: unknown): PaymentGatewaySettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const settings: PaymentGatewaySettings = {};
  for (const key of settingKeys) {
    const item = source[key];
    if (item === undefined) continue;
    if (typeof item !== "string" || item.length > 500) return null;
    settings[key] = item.trim();
  }
  return settings;
}

function hasSecretValues(settings: PaymentGatewaySettings) {
  return settingKeys.some((key) => Boolean(settings[key]));
}

export async function GET() {
  if (!(await isPaymentsAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    await prisma.paymentGatewayConfig.createMany({
      data: DEFAULT_PAYMENT_GATEWAYS.map((gateway) => ({ ...gateway, enabled: false })),
      skipDuplicates: true,
    });
    const gateways = await prisma.paymentGatewayConfig.findMany({
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        displayName: true,
        enabled: true,
        publicInstructions: true,
        encryptedSettings: true,
      },
    });
    return NextResponse.json({
      success: true,
      gateways: gateways.map(({ encryptedSettings, ...gateway }) => ({
        ...gateway,
        hasEncryptedSettings: Boolean(encryptedSettings),
      })),
    });
  } catch (error) {
    console.error("GET admin payment settings error:", error);
    return NextResponse.json({ success: false, message: "Unable to load payment settings." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  if (!(await isPaymentsAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !Array.isArray((body as { gateways?: unknown }).gateways)) {
    return NextResponse.json({ success: false, message: "Provide a list of gateways." }, { status: 400 });
  }

  const entries = (body as { gateways: unknown[] }).gateways;
  if (entries.length > 50) {
    return NextResponse.json({ success: false, message: "Too many gateways." }, { status: 400 });
  }
  const seen = new Set<string>();
  const parsed = entries.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const item = entry as Record<string, unknown>;
    const code = typeof item.code === "string" ? item.code.trim().toUpperCase() : "";
    const displayName = typeof item.displayName === "string" ? item.displayName.trim() : "";
    const instructions = typeof item.publicInstructions === "string"
      ? item.publicInstructions.trim()
      : "";
    const settings = parseSettings(item.settings);
    if (
      !/^(?:RAZORPAY|BILLDESK|CASHFREE|UPI_BANK|CUSTOM_[A-Z0-9_]{1,40})$/.test(code) ||
      seen.has(code) ||
      !displayName ||
      displayName.length > 120 ||
      instructions.length > 4000 ||
      typeof item.enabled !== "boolean" ||
      !settings
    ) return null;
    seen.add(code);
    return { code, displayName, instructions, enabled: item.enabled, settings };
  });
  if (parsed.some((entry) => !entry)) {
    return NextResponse.json({ success: false, message: "One or more gateway settings are invalid." }, { status: 400 });
  }

  try {
    const operations = [];
    for (const gateway of parsed as NonNullable<(typeof parsed)[number]>[]) {
      const current = await prisma.paymentGatewayConfig.findUnique({
        where: { code: gateway.code },
        select: { encryptedSettings: true },
      });
      let encryptedSettings = current?.encryptedSettings ?? null;
      if (hasSecretValues(gateway.settings)) {
        try {
          const previous = encryptedSettings ? decryptPaymentSettings(encryptedSettings) : {};
          const merged = { ...previous };
          for (const key of settingKeys) {
            if (gateway.settings[key]) merged[key] = gateway.settings[key];
          }
          encryptedSettings = encryptPaymentSettings(merged);
        } catch (error) {
          if (error instanceof Error && error.message.includes("PAYMENT_ENCRYPTION_KEY")) {
            return NextResponse.json({ success: false, message: error.message }, { status: 503 });
          }
          throw error;
        }
      }
      operations.push(prisma.paymentGatewayConfig.upsert({
        where: { code: gateway.code },
        create: {
          code: gateway.code,
          displayName: gateway.displayName,
          enabled: gateway.enabled,
          publicInstructions: gateway.instructions || null,
          encryptedSettings,
        },
        update: {
          displayName: gateway.displayName,
          enabled: gateway.enabled,
          publicInstructions: gateway.instructions || null,
          encryptedSettings,
        },
      }));
    }
    if (operations.length) await prisma.$transaction(operations);
    return NextResponse.json({ success: true, message: "Payment settings saved." });
  } catch (error) {
    console.error("PUT admin payment settings error:", error);
    return NextResponse.json({ success: false, message: "Unable to save payment settings." }, { status: 500 });
  }
}
