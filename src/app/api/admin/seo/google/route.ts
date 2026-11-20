import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { getSiteSettings } from "@/lib/site-settings";
import { getSeoManagerData, saveSeoManagerData } from "@/lib/seo-manager";
import { deleteGoogleConnection, getGoogleAccessToken, getGoogleConnection } from "@/lib/seo-google";

const roles = new Set(["SUPER_ADMIN", "ADMIN", "EDITOR", "SEO_MANAGER"]);
async function authorized() {
  const user = await getCurrentUser();
  return Boolean(user?.isActive && roles.has(user.role));
}

function dateOnly(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export async function GET() {
  try {
    if (!(await authorized())) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const connection = await getGoogleConnection();
    const seo = await getSeoManagerData();
    if (!connection) return NextResponse.json({ success: true, connected: false, sites: [], gsc: null, analytics: null });

    const token = await getGoogleAccessToken();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const sitesResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers, cache: "no-store" });
    const sitesPayload = await sitesResponse.json() as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>; error?: { message?: string } };
    if (!sitesResponse.ok) throw new Error(sitesPayload.error?.message || "Search Console sites could not be loaded.");
    const sites = sitesPayload.siteEntry ?? [];

    const selectedSite = seo.google.searchConsoleSite || sites.find((site) => site.permissionLevel !== "siteUnverifiedUser")?.siteUrl || "";
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 3);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 27);
    const startDate = dateOnly(start);
    const endDate = dateOnly(end);

    let gsc: unknown = null;
    let gscError = "";
    if (selectedSite) {
      const encodedSite = encodeURIComponent(selectedSite);
      const queryUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;
      const [dailyResponse, pageResponse, queryResponse] = await Promise.all([
        fetch(queryUrl, { method: "POST", headers, body: JSON.stringify({ startDate, endDate, dimensions: ["date"], rowLimit: 30 }), cache: "no-store" }),
        fetch(queryUrl, { method: "POST", headers, body: JSON.stringify({ startDate, endDate, dimensions: ["page"], rowLimit: 10 }), cache: "no-store" }),
        fetch(queryUrl, { method: "POST", headers, body: JSON.stringify({ startDate, endDate, dimensions: ["query"], rowLimit: 10 }), cache: "no-store" }),
      ]);
      type SearchAnalyticsRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
      type SearchAnalyticsResponse = { rows?: SearchAnalyticsRow[]; error?: { message?: string } };
      const [daily, pages, queries] = await Promise.all([dailyResponse.json(), pageResponse.json(), queryResponse.json()]) as [SearchAnalyticsResponse, SearchAnalyticsResponse, SearchAnalyticsResponse];
      if (!dailyResponse.ok || !pageResponse.ok || !queryResponse.ok) gscError = daily.error?.message || pages.error?.message || queries.error?.message || "Search Console report failed.";
      else {
        type SearchTotals = { clicks: number; impressions: number; ctrWeighted: number; positionWeighted: number };
        const total = (rows: SearchAnalyticsRow[] | undefined): SearchTotals => (rows ?? []).reduce<SearchTotals>((acc, row) => ({ clicks: acc.clicks + (row.clicks ?? 0), impressions: acc.impressions + (row.impressions ?? 0), ctrWeighted: acc.ctrWeighted + (row.ctr ?? 0) * (row.impressions ?? 0), positionWeighted: acc.positionWeighted + (row.position ?? 0) * (row.impressions ?? 0) }), { clicks: 0, impressions: 0, ctrWeighted: 0, positionWeighted: 0 });
        const totals = total(daily.rows);
        gsc = {
          startDate, endDate,
          clicks: totals.clicks,
          impressions: totals.impressions,
          ctr: totals.impressions ? totals.ctrWeighted / totals.impressions : 0,
          position: totals.impressions ? totals.positionWeighted / totals.impressions : 0,
          daily: (daily.rows ?? []).map((row) => ({ date: row.keys?.[0] ?? "", clicks: row.clicks ?? 0, impressions: row.impressions ?? 0 })),
          pages: pages.rows ?? [],
          queries: queries.rows ?? [],
        };
      }
    }

    let analytics: unknown = null;
    let analyticsError = "";
    if (seo.google.analyticsPropertyId) {
      const gaResponse = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(seo.google.analyticsPropertyId)}:runReport`, {
        method: "POST", headers,
        body: JSON.stringify({
          dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "engagementRate" }],
          dimensions: [{ name: "date" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          metricAggregations: ["TOTAL"],
          limit: "30",
        }),
        cache: "no-store",
      });
      const gaPayload = await gaResponse.json() as { rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>; totals?: Array<{ metricValues?: Array<{ value?: string }> }>; error?: { message?: string } };
      if (!gaResponse.ok) analyticsError = gaPayload.error?.message || "Google Analytics report failed.";
      else analytics = {
        totals: gaPayload.totals?.[0]?.metricValues?.map((item) => Number(item.value ?? 0)) ?? [],
        daily: (gaPayload.rows ?? []).map((row) => ({ date: row.dimensionValues?.[0]?.value ?? "", values: row.metricValues?.map((item) => Number(item.value ?? 0)) ?? [] })),
      };
    }

    return NextResponse.json({
      success: true,
      connected: true,
      email: connection.email,
      connectedAt: connection.connectedAt,
      sites,
      selectedSite,
      gsc,
      gscError,
      analytics,
      analyticsError,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Google SEO dashboard failed:", error);
    return NextResponse.json({ success: false, connected: false, message: error instanceof Error ? error.message : "Unable to load Google reports." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  try {
    if (!(await authorized())) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const body = await request.json() as { action?: string };
    if (body.action !== "submit-sitemap") return NextResponse.json({ success: false, message: "Unknown Google action." }, { status: 400 });
    const connection = await getGoogleConnection();
    if (!connection) return NextResponse.json({ success: false, message: "Connect Google first." }, { status: 400 });
    const seo = await getSeoManagerData();
    const siteSettings = await getSiteSettings();
    if (!seo.global.sitemapEnabled) return NextResponse.json({ success: false, message: "Enable the XML sitemap before submitting it to Google." }, { status: 400 });
    const siteUrl = seo.google.searchConsoleSite;
    if (!siteUrl) return NextResponse.json({ success: false, message: "Choose a Search Console property first." }, { status: 400 });
    const sitemapUrl = `${siteSettings.general.siteAddress.replace(/\/$/, "")}/sitemap.xml`;
    const token = await getGoogleAccessToken();
    const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json({ success: false, message: payload.error?.message || "Google rejected the sitemap submission." }, { status: response.status });
    }
    return NextResponse.json({ success: true, message: `Submitted ${sitemapUrl} to Google Search Console.` });
  } catch (error) {
    console.error("Sitemap submission failed:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unable to submit sitemap." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  if (!(await authorized())) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  await deleteGoogleConnection();
  return NextResponse.json({ success: true, message: "Google account disconnected." });
}
