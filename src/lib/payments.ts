import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const DEFAULT_PAYMENT_GATEWAYS = [
  { code: "RAZORPAY", displayName: "Razorpay" },
  { code: "BILLDESK", displayName: "BillDesk" },
  { code: "CASHFREE", displayName: "Cashfree" },
  { code: "UPI_BANK", displayName: "UPI / Bank transfer" },
] as const;

export type PaymentGatewaySettings = {
  apiKey?: string;
  apiSecret?: string;
  merchantId?: string;
  clientId?: string;
  clientSecret?: string;
  bankVpa?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
};

function getEncryptionKey() {
  const encoded = process.env.PAYMENT_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error("PAYMENT_ENCRYPTION_KEY is not configured.");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("PAYMENT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptPaymentSettings(settings: PaymentGatewaySettings) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(settings), "utf8"),
    cipher.final(),
  ]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptPaymentSettings(encrypted: string): PaymentGatewaySettings {
  const [version, iv, tag, ciphertext] = encrypted.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Invalid encrypted payment settings.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as PaymentGatewaySettings;
}

export async function ensureDefaultPaymentGateways() {
  await prisma.paymentGatewayConfig.createMany({
    data: DEFAULT_PAYMENT_GATEWAYS.map((gateway) => ({
      ...gateway,
      enabled: false,
    })),
    skipDuplicates: true,
  });
}

export async function getPublicPaymentGateways() {
  try {
    const gateways = await prisma.paymentGatewayConfig.findMany({
      where: { enabled: true },
      orderBy: { displayName: "asc" },
      select: {
        code: true,
        displayName: true,
        publicInstructions: true,
        encryptedSettings: true,
      },
    });

    return gateways.map((gateway) => {
      let publicDetails: Pick<
        PaymentGatewaySettings,
        "bankVpa" | "bankAccountName" | "bankAccountNumber" | "bankIfsc"
      > = {};

      if (gateway.code === "UPI_BANK" && gateway.encryptedSettings) {
        try {
          const settings = decryptPaymentSettings(
            gateway.encryptedSettings
          );

          publicDetails = {
            bankVpa: settings.bankVpa,
            bankAccountName: settings.bankAccountName,
            bankAccountNumber: settings.bankAccountNumber,
            bankIfsc: settings.bankIfsc,
          };
        } catch (error) {
          console.error("Unable to decrypt public UPI settings:", error);
        }
      }

      return {
        code: gateway.code,
        displayName: gateway.displayName,
        publicInstructions: gateway.publicInstructions,
        publicDetails,
      };
    });
  } catch (error) {
    console.error(
      "Unable to load payment gateways. Returning empty list:",
      error
    );

    return [];
  }
}

export function createPaymentRequestNumber() {
  return `PBR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
}
