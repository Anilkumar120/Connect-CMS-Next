import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

type GoogleConnection = {
  email: string;
  refreshTokenEncrypted: string;
  connectedAt: string;
  scopes: string[];
};

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 64) {
    throw new Error("SESSION_SECRET must be at least 64 characters to encrypt Google tokens.");
  }
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt(value: string): string {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Stored Google token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function saveGoogleConnection(input: {
  email: string;
  refreshToken: string;
  scopes: string[];
}): Promise<void> {
  const value: GoogleConnection = {
    email: input.email,
    refreshTokenEncrypted: encrypt(input.refreshToken),
    connectedAt: new Date().toISOString(),
    scopes: input.scopes,
  };
  await prisma.siteSetting.upsert({
    where: { key: "seo-google-connection" },
    create: { key: "seo-google-connection", value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
}

export async function getGoogleConnection(): Promise<GoogleConnection | null> {
  const record = await prisma.siteSetting.findUnique({
    where: { key: "seo-google-connection" },
    select: { value: true },
  });
  if (!record?.value || typeof record.value !== "object" || Array.isArray(record.value)) return null;
  const value = record.value as Record<string, unknown>;
  if (typeof value.email !== "string" || typeof value.refreshTokenEncrypted !== "string") return null;
  return {
    email: value.email,
    refreshTokenEncrypted: value.refreshTokenEncrypted,
    connectedAt: typeof value.connectedAt === "string" ? value.connectedAt : "",
    scopes: Array.isArray(value.scopes) ? value.scopes.filter((scope): scope is string => typeof scope === "string") : [],
  };
}

export async function deleteGoogleConnection(): Promise<void> {
  await prisma.siteSetting.deleteMany({ where: { key: "seo-google-connection" } });
}

export async function getGoogleAccessToken(): Promise<string> {
  const connection = await getGoogleConnection();
  if (!connection) throw new Error("Google account is not connected.");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth environment variables are missing.");

  const refreshToken = decrypt(connection.refreshTokenEncrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const payload = await response.json() as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Unable to refresh Google access token.");
  }
  return payload.access_token;
}
