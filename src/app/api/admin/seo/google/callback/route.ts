import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { saveGoogleConnection } from "@/lib/seo-google";

export async function GET(request: NextRequest) {
  const base = new URL("/admin/seo", request.url);
  const user = await getCurrentUser();
  if (!user?.isActive || !["SUPER_ADMIN", "ADMIN", "EDITOR", "SEO_MANAGER"].includes(user.role)) {
    base.searchParams.set("googleError", "unauthorized");
    return NextResponse.redirect(base);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("seo_google_oauth_state")?.value;
  const state = request.nextUrl.searchParams.get("state");
  cookieStore.delete("seo_google_oauth_state");

  if (!expectedState || !state || expectedState !== state) {
    base.searchParams.set("googleError", "state");
    return NextResponse.redirect(base);
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    base.searchParams.set("googleError", "cancelled");
    return NextResponse.redirect(base);
  }

  const code = request.nextUrl.searchParams.get("code");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!code || !clientId || !clientSecret) {
    base.searchParams.set("googleError", "missing-code");
    return NextResponse.redirect(base);
  }

  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/admin/seo/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      error_description?: string;
      error?: string;
    };
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Google token exchange failed.");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: "no-store",
    });
    const profile = await profileResponse.json() as { email?: string };
    if (!profileResponse.ok || !profile.email) throw new Error("Google account email could not be verified.");

    if (!tokenData.refresh_token) {
      throw new Error("Google did not return a refresh token. Revoke the existing app permission in your Google Account and connect again.");
    }

    await saveGoogleConnection({
      email: profile.email,
      refreshToken: tokenData.refresh_token,
      scopes: (tokenData.scope || "").split(" ").filter(Boolean),
    });

    base.searchParams.set("google", "connected");
    return NextResponse.redirect(base);
  } catch (error) {
    console.error("Google SEO OAuth callback failed:", error);
    base.searchParams.set("googleError", "token-exchange");
    return NextResponse.redirect(base);
  }
}
