import type { PasswordResetChannel } from "@prisma/client";

export class OtpDeliveryError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export function getOtpDeliveryReadiness(channel: PasswordResetChannel) {
  if (process.env.NODE_ENV !== "production") {
    throw new OtpDeliveryError(
      "OTP delivery is disabled outside production.",
      503
    );
  }

  const prefix = channel === "EMAIL" ? "ACCOUNT_EMAIL_OTP" : "ACCOUNT_SMS_OTP";
  const url = process.env[`${prefix}_URL`];
  const token = process.env[`${prefix}_TOKEN`];

  if (!url || !token) {
    throw new OtpDeliveryError(
      `${channel === "EMAIL" ? "Email" : "SMS"} OTP delivery provider is not configured.`,
      503
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new OtpDeliveryError("OTP delivery provider URL is invalid.", 503);
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
    throw new OtpDeliveryError("OTP delivery provider URL must use HTTPS.", 503);
  }

  return { url: parsedUrl.toString(), token };
}

export async function deliverOtp(
  channel: PasswordResetChannel,
  recipient: string,
  code: string
) {
  const config = getOtpDeliveryReadiness(channel);
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      to: recipient,
      subject: "Your Connect Broadband password reset code",
      text: `Your password reset code is ${code}. It expires in 10 minutes.`,
      code,
      expiresInMinutes: 10,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => {
    throw new OtpDeliveryError("OTP delivery provider could not be reached.", 502);
  });

  if (!response.ok) {
    throw new OtpDeliveryError("OTP delivery provider rejected the request.", 502);
  }
}
