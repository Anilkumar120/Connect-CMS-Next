import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { GOOGLE_SCOPES } from "@/lib/seo-google";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isActive || !["SUPER_ADMIN", "ADMIN", "EDITOR", "SEO_MANAGER"].includes(user.role)) {
    return NextResponse.redirect(new URL("/admin/seo?googleError=unauthorized", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/admin/seo?googleError=missing-config", request.url));
  }

  const state = randomBytes(32).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set("seo_google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/admin/seo/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
