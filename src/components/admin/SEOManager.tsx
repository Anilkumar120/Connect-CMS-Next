"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowUpRight, BarChart3, Check, ChevronDown,
  CircleAlert, Clock3, ExternalLink, FileText, Globe, Image as ImageIcon,
  Link2, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Search, Send,
  Settings2, ShieldCheck, ListTree, Trash2, Unplug, X,
} from "lucide-react";
import styles from "./SEOManager.module.css";

type SeoItem = {
  id: string;
  type: "page" | "post";
  title: string;
  slug: string;
  url: string;
  status: string;
  deletedAt: string | null;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  metaRobots: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  schemaType?: string;
  contentType?: string;
};

type Redirect = {
  id: string;
  from: string;
  to: string;
  code: 301 | 302 | 307 | 308;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type GlobalSettings = {
  titleTemplate: string;
  titleSeparator: string;
  defaultDescription: string;
  defaultSocialImage: string;
  googleVerification: string;
  bingVerification: string;
  sitemapEnabled: boolean;
  sitemapIncludePages: boolean;
  sitemapIncludePosts: boolean;
  sitemapIncludeTaxonomies: boolean;
  disallowPaths: string[];
  noindexSearch: boolean;
};

type ApiData = {
  success: boolean;
  message?: string;
  site: { title: string; url: string; adminEmail: string };
  global: GlobalSettings;
  google: { searchConsoleSite: string; analyticsPropertyId: string };
  redirects: Redirect[];
  items: SeoItem[];
  counts: { pages: number; posts: number; published: number; trashed: number };
};

type GoogleData = {
  success: boolean;
  connected: boolean;
  email?: string;
  sites?: Array<{ siteUrl: string; permissionLevel: string }>;
  selectedSite?: string;
  gsc?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    daily: Array<{ date: string; clicks: number; impressions: number }>;
    pages: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
    queries: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
  } | null;
  gscError?: string;
  analytics?: { totals: number[]; daily: Array<{ date: string; values: number[] }> } | null;
  analyticsError?: string;
  message?: string;
};

type EditorValues = Pick<SeoItem,
  "id" | "type" | "seoTitle" | "seoDescription" | "focusKeyword" | "canonicalUrl" | "metaRobots" | "ogTitle" | "ogDescription" | "ogImage" | "twitterTitle" | "twitterDescription" | "twitterImage" | "schemaType"
>;

const emptyGlobal: GlobalSettings = {
  titleTemplate: "%title% | %sitename%",
  titleSeparator: "|",
  defaultDescription: "",
  defaultSocialImage: "",
  googleVerification: "",
  bingVerification: "",
  sitemapEnabled: true,
  sitemapIncludePages: true,
  sitemapIncludePosts: true,
  sitemapIncludeTaxonomies: true,
  disallowPaths: ["/admin/", "/api/"],
  noindexSearch: true,
};

function scoreItem(item: SeoItem): number {
  let score = 0;
  const title = item.seoTitle.trim();
  const description = item.seoDescription.trim();
  const keyword = item.focusKeyword.trim().toLowerCase();
  if (title) score += 20;
  if (title.length >= 30 && title.length <= 60) score += 15;
  if (description) score += 20;
  if (description.length >= 120 && description.length <= 160) score += 15;
  if (keyword) score += 10;
  if (keyword && title.toLowerCase().includes(keyword)) score += 10;
  if (keyword && description.toLowerCase().includes(keyword)) score += 5;
  if (item.canonicalUrl.trim() || item.url) score += 5;
  return Math.min(100, score);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
}

function makePolyline(values: number[], width = 620, height = 150) {
  if (!values.length) return "";
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(1, max - min);
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 18) - 9;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function initialEditor(item: SeoItem): EditorValues {
  return {
    id: item.id,
    type: item.type,
    seoTitle: item.seoTitle || "",
    seoDescription: item.seoDescription || "",
    focusKeyword: item.focusKeyword || "",
    canonicalUrl: item.canonicalUrl || "",
    metaRobots: item.metaRobots || "index,follow",
    ogTitle: item.ogTitle || "",
    ogDescription: item.ogDescription || "",
    ogImage: item.ogImage || "",
    twitterTitle: item.twitterTitle || "",
    twitterDescription: item.twitterDescription || "",
    twitterImage: item.twitterImage || "",
    schemaType: item.schemaType || "WebPage",
  };
}

export default function SEOManager() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState<ApiData | null>(null);
  const [google, setGoogle] = useState<GoogleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [contentView, setContentView] = useState<"active" | "trash">("active");
  const [editor, setEditor] = useState<EditorValues | null>(null);
  const [globalDraft, setGlobalDraft] = useState<GlobalSettings>(emptyGlobal);
  const [googleSite, setGoogleSite] = useState("");
  const [analyticsId, setAnalyticsId] = useState("");
  const [redirectEditor, setRedirectEditor] = useState<Partial<Redirect> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // The CMS SEO data is the primary dependency. A temporary Google API
      // failure must not prevent the administrator from editing SEO settings.
      const seoResponse = await fetch("/api/admin/seo", { cache: "no-store" });
      const seoResult = await seoResponse.json().catch(() => null) as ApiData | null;

      if (!seoResponse.ok || !seoResult?.success) {
        throw new Error(
          seoResult?.message || `Unable to load SEO manager (HTTP ${seoResponse.status}).`,
        );
      }

      let googleResult: GoogleData = {
        success: false,
        connected: false,
        sites: [],
        gsc: null,
        analytics: null,
      };

      try {
        const googleResponse = await fetch("/api/admin/seo/google", { cache: "no-store" });
        const googlePayload = await googleResponse.json().catch(() => null) as GoogleData | null;

        if (googleResponse.ok && googlePayload?.success) {
          googleResult = googlePayload;
        } else {
          const message = googlePayload?.message
            || `Google integration could not be loaded (HTTP ${googleResponse.status}).`;
          googleResult = {
            ...googleResult,
            message,
            gscError: message,
            analyticsError: message,
          };
        }
      } catch (googleLoadError) {
        const message = googleLoadError instanceof Error
          ? googleLoadError.message
          : "Google integration is temporarily unavailable.";
        googleResult = {
          ...googleResult,
          message,
          gscError: message,
          analyticsError: message,
        };
      }

      setData(seoResult);
      setGlobalDraft(seoResult.global || emptyGlobal);
      setGoogleSite(seoResult.google?.searchConsoleSite || googleResult.selectedSite || "");
      setAnalyticsId(seoResult.google?.analyticsPropertyId || "");
      setGoogle(googleResult);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load SEO manager.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") setNotice("Google account connected successfully.");
    if (params.get("googleError")) setError(`Google connection failed: ${params.get("googleError")}. Check OAuth configuration and try again.`);
    if (params.has("google") || params.has("googleError")) {
      window.history.replaceState({}, "", "/admin/seo");
    }
  }, []);

  const activeItems = useMemo(() => (data?.items ?? []).filter((item) => !item.deletedAt), [data]);
  const trashedItems = useMemo(() => (data?.items ?? []).filter((item) => Boolean(item.deletedAt)), [data]);
  const visibleItems = useMemo(() => {
    const source = contentView === "trash" ? trashedItems : activeItems;
    const q = search.trim().toLowerCase();
    return source.filter((item) => !q || [item.title, item.slug, item.seoTitle, item.focusKeyword, item.url].some((value) => value.toLowerCase().includes(q)));
  }, [activeItems, trashedItems, contentView, search]);

  const missingTitle = activeItems.filter((item) => !item.seoTitle.trim()).length;
  const missingDescription = activeItems.filter((item) => !item.seoDescription.trim()).length;
  const averageScore = activeItems.length ? Math.round(activeItems.reduce((sum, item) => sum + scoreItem(item), 0) / activeItems.length) : 0;

  const postAction = async (body: unknown, method = "POST") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/seo", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "SEO request failed.");
      setNotice(result.message || "Saved successfully.");
      await load();
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "SEO request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveGlobal = () => postAction({ action: "save-global", global: globalDraft });
  const saveGoogleProperties = () => postAction({ action: "save-google-settings", searchConsoleSite: googleSite, analyticsPropertyId: analyticsId });

  const saveEditor = async () => {
    if (!editor) return;
    const ok = await postAction({ action: "save-content", ...editor });
    if (ok) setEditor(null);
  };

  const contentAction = (item: SeoItem, action: "trash-content" | "restore-content") => postAction({ action, type: item.type, id: item.id });
  const deletePermanently = async (type: string, id: string, label: string) => {
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
    await postAction({ type, id }, "DELETE");
  };

  const saveRedirect = async () => {
    if (!redirectEditor?.from || !redirectEditor.to) return;
    const ok = await postAction({
      action: "save-redirect",
      id: redirectEditor.id,
      from: redirectEditor.from,
      to: redirectEditor.to,
      code: redirectEditor.code || 301,
      active: redirectEditor.active !== false,
    });
    if (ok) setRedirectEditor(null);
  };

  const googleAction = async (method: "POST" | "DELETE", body?: unknown) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/seo/google", {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json() as GoogleData & { message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "Google request failed.");
      if (method === "DELETE") setNotice(result.message || "Google disconnected.");
      else setNotice(result.message || "Google action complete.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Google request failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}><Loader2 className={styles.spin} size={22}/> Loading SEO Manager...</div>;
  }

  if (!data) {
    return <div className={styles.page}><div className={styles.alertError}>{error || "SEO Manager could not load."}</div><button className={styles.primaryButton} onClick={() => void load()}><RefreshCw size={15}/> Try Again</button></div>;
  }

  const tabs = [
    ["overview", "Overview", BarChart3],
    ["content", "Content SEO", FileText],
    ["sitemap", "Sitemap & Robots", ListTree],
    ["redirects", "Redirects", Link2],
    ["integrations", "Google Integrations", Globe],
    ["tools", "Reports & Tools", Settings2],
  ] as const;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>SEARCH ENGINE OPTIMIZATION</div>
          <h1>SEO Manager</h1>
          <p>Improve search appearance, technical SEO and Google search performance.</p>
          <div className={styles.siteAddress}><Globe size={14}/><span>{data.site.url}</span><a href={data.site.url} target="_blank" rel="noreferrer"><ExternalLink size={13}/></a></div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} onClick={() => void load()} disabled={busy}><RefreshCw size={15}/> Refresh</button>
          <a className={styles.primaryButton} href="/api/admin/seo/report"><ArrowDownToLine size={15}/> Export SEO Report</a>
        </div>
      </header>

      {error && <div className={styles.alertError}><CircleAlert size={16}/>{error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={15}/></button></div>}
      {notice && <div className={styles.alertSuccess}><Check size={16}/>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}

      <nav className={styles.tabs} aria-label="SEO sections">
        {tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? styles.activeTab : ""} onClick={() => setTab(id)}><Icon size={16}/>{label}</button>)}
      </nav>

      {tab === "overview" && (
        <section className={styles.sectionStack}>
          <div className={styles.metricGrid}>
            <Metric title="SEO health score" value={`${averageScore}/100`} note="Based on saved titles, descriptions and keywords" icon={<Activity size={18}/>} />
            <Metric title="Published content" value={String(activeItems.filter((item) => item.status === "PUBLISHED").length)} note="Pages and posts currently published" icon={<FileText size={18}/>} />
            <Metric title="Missing SEO titles" value={String(missingTitle)} note="Items that need a search title" icon={<CircleAlert size={18}/>} tone={missingTitle ? "warning" : "success"}/>
            <Metric title="Missing descriptions" value={String(missingDescription)} note="Items that need a meta description" icon={<Search size={18}/>} tone={missingDescription ? "warning" : "success"}/>
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.card}>
              <div className={styles.cardHeading}><div><h2>Google Search performance</h2><p>Search Console Â· Last 28 complete days</p></div><span className={google?.connected ? styles.connectedBadge : styles.mutedBadge}>{google?.connected ? "Connected" : "Not connected"}</span></div>
              {google?.gsc ? <>
                <div className={styles.googleMetrics}>
                  <MiniMetric label="Clicks" value={formatNumber(google.gsc.clicks)}/>
                  <MiniMetric label="Impressions" value={formatNumber(google.gsc.impressions)}/>
                  <MiniMetric label="CTR" value={`${(google.gsc.ctr * 100).toFixed(1)}%`}/>
                  <MiniMetric label="Avg. position" value={google.gsc.position.toFixed(1)}/>
                </div>
                <div className={styles.chartLegend}><span><i className={styles.blueDot}/> Clicks</span><span><i className={styles.orangeDot}/> Impressions</span></div>
                <svg className={styles.chart} viewBox="0 0 620 170" role="img" aria-label="Google Search Console daily clicks and impressions chart">
                  {[35, 75, 115, 155].map((y) => <line key={y} x1="0" x2="620" y1={y} y2={y} className={styles.chartGrid}/>) }
                  <polyline points={makePolyline(google.gsc.daily.map((point) => point.clicks))} className={styles.clickLine}/>
                  <polyline points={makePolyline(google.gsc.daily.map((point) => point.impressions))} className={styles.impressionLine}/>
                </svg>
                <p className={styles.chartFootnote}>Search Console reports may omit days with no recorded data and can return limited top rows. <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Open Search Console <ArrowUpRight size={12}/></a></p>
              </> : <EmptyPanel icon={<Globe size={24}/>} title="Connect Google Search Console" text={google?.gscError || "Connect your Google account to see clicks, impressions, search queries and page performance."} action={<a className={styles.primaryButton} href="/api/admin/seo/google/connect">Connect Google</a>} />}
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeading}><div><h2>SEO issues to review</h2><p>Calculated from your CMS content</p></div><span className={styles.mutedBadge}>{missingTitle + missingDescription} items</span></div>
              <IssueRow title="Missing SEO title" detail="Add a unique title to improve how the page appears in search." count={missingTitle}/>
              <IssueRow title="Missing meta description" detail="Write a clear summary for search result snippets." count={missingDescription}/>
              <IssueRow title="Focus keyword missing" detail={`${activeItems.filter((item) => !item.focusKeyword.trim()).length} items have no focus keyword set.`} count={activeItems.filter((item) => !item.focusKeyword.trim()).length}/>
              <IssueRow title="Long or short SEO title" detail={`${activeItems.filter((item) => item.seoTitle && (item.seoTitle.length < 30 || item.seoTitle.length > 60)).length} titles are outside the suggested 30â€“60 character range.`} count={activeItems.filter((item) => item.seoTitle && (item.seoTitle.length < 30 || item.seoTitle.length > 60)).length}/>
              <button className={styles.textButton} onClick={() => setTab("content")}>Review all content <ArrowUpRight size={14}/></button>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeading}><div><h2>Top search queries</h2><p>Queries bringing visitors from Google</p></div></div>
            {google?.gsc?.queries?.length ? <DataTable headers={["Search query", "Clicks", "Impressions", "CTR", "Position"]} rows={google.gsc.queries.map((row) => [row.keys?.[0] ?? "â€”", formatNumber(row.clicks ?? 0), formatNumber(row.impressions ?? 0), `${((row.ctr ?? 0) * 100).toFixed(1)}%`, (row.position ?? 0).toFixed(1)])}/> : <p className={styles.mutedText}>{google?.connected ? (google.gscError || "Select an accessible Search Console property in Google Integrations to load search queries.") : "Connect Google to display actual search queries. No sample metrics are shown as real data."}</p>}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeading}><div><h2>Top pages from Google Search</h2><p>Landing pages receiving impressions and clicks</p></div></div>
            {google?.gsc?.pages?.length ? <DataTable headers={["Page URL", "Clicks", "Impressions", "CTR", "Position"]} rows={google.gsc.pages.map((row) => [row.keys?.[0] ?? "â€”", formatNumber(row.clicks ?? 0), formatNumber(row.impressions ?? 0), `${((row.ctr ?? 0) * 100).toFixed(1)}%`, (row.position ?? 0).toFixed(1)])}/> : <p className={styles.mutedText}>{google?.connected ? (google.gscError || "No page report rows were returned for this date range.") : "Connect Google Search Console to load page performance."}</p>}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeading}><div><h2>Google Analytics 4</h2><p>Last 28 complete days Â· Active users, sessions, page views and engagement</p></div><span className={google?.analytics ? styles.connectedBadge : styles.mutedBadge}>{google?.analytics ? "Report loaded" : "Not configured"}</span></div>
            {google?.analytics ? <><div className={styles.googleMetrics}>
              <MiniMetric label="Active users" value={formatNumber(google.analytics.totals[0] ?? 0)}/>
              <MiniMetric label="Sessions" value={formatNumber(google.analytics.totals[1] ?? 0)}/>
              <MiniMetric label="Page views" value={formatNumber(google.analytics.totals[2] ?? 0)}/>
              <MiniMetric label="Engagement rate" value={`${((google.analytics.totals[3] ?? 0) * 100).toFixed(1)}%`}/>
            </div><div className={styles.chartLegend}><span><i className={styles.blueDot}/> Page views per day</span></div><svg className={styles.chart} viewBox="0 0 620 170" role="img" aria-label="Google Analytics daily page views chart">{[35, 75, 115, 155].map((y) => <line key={y} x1="0" x2="620" y1={y} y2={y} className={styles.chartGrid}/>) }<polyline points={makePolyline(google.analytics.daily.map((point) => point.values[2] ?? 0))} className={styles.clickLine}/></svg></> : <p className={styles.mutedText}>{google?.analyticsError || "Connect Google and enter a GA4 numeric Property ID in Google Integrations to load analytics reports."}</p>}
          </div>
        </section>
      )}

      {tab === "content" && (
        <section className={styles.card}>
          <div className={styles.cardHeading}><div><h2>Content SEO</h2><p>Edit SEO titles, descriptions, canonicals, robots and social metadata for your pages and posts.</p></div><div className={styles.viewSwitch}><button className={contentView === "active" ? styles.selectedView : ""} onClick={() => setContentView("active")}>Active ({activeItems.length})</button><button className={contentView === "trash" ? styles.selectedView : ""} onClick={() => setContentView("trash")}>Trash ({trashedItems.length})</button></div></div>
          <div className={styles.toolbar}><label className={styles.searchBox}><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, keyword or URL..."/></label><span className={styles.mutedText}>{visibleItems.length} results</span></div>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Content</th><th>SEO score</th><th>SEO title</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {visibleItems.map((item) => <tr key={`${item.type}:${item.id}`}>
              <td><div className={styles.contentName}><span className={styles.typeIcon}>{item.type === "page" ? <FileText size={15}/> : <Activity size={15}/>}</span><div><strong>{item.title}</strong><a href={item.url} target="_blank" rel="noreferrer">{item.url.replace(data.site.url.replace(/\/$/, ""), "") || "/"} <ExternalLink size={11}/></a></div></div></td>
              <td><Score score={scoreItem(item)}/></td><td><span className={item.seoTitle ? "" : styles.missing}> {item.seoTitle || "Missing"}</span><small className={styles.charCount}>{item.seoTitle.length}/60</small></td><td><span className={item.seoDescription ? "" : styles.missing}>{item.seoDescription ? `${item.seoDescription.slice(0, 72)}${item.seoDescription.length > 72 ? "â€¦" : ""}` : "Missing"}</span><small className={styles.charCount}>{item.seoDescription.length}/160</small></td>
              <td><span className={item.status === "PUBLISHED" ? styles.statusPublished : styles.statusDraft}>{item.status}</span></td>
              <td><div className={styles.rowActions}>{contentView === "active" ? <><button title="Edit SEO" onClick={() => setEditor(initialEditor(item))}><Pencil size={15}/></button><button title="Move to Trash" onClick={() => void contentAction(item, "trash-content")}><Trash2 size={15}/></button></> : <><button title="Restore" onClick={() => void contentAction(item, "restore-content")}><RotateCcw size={15}/></button><button title="Delete permanently" onClick={() => void deletePermanently(item.type, item.id, item.title)}><X size={15}/></button></>}</div></td>
            </tr>)}
            {!visibleItems.length && <tr><td colSpan={6} className={styles.emptyCell}>No content found in this view.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {tab === "sitemap" && (
        <section className={styles.sectionStack}>
          <div className={styles.card}>
            <div className={styles.cardHeading}><div><h2>XML Sitemap</h2><p>Automatically generated from published CMS content.</p></div><span className={globalDraft.sitemapEnabled ? styles.connectedBadge : styles.mutedBadge}>{globalDraft.sitemapEnabled ? "Enabled" : "Disabled"}</span></div>
            <div className={styles.sitemapUrl}><ListTree size={18}/><a href="/sitemap.xml" target="_blank" rel="noreferrer">{data.site.url.replace(/\/$/, "")}/sitemap.xml</a><a href="/sitemap.xml" target="_blank" rel="noreferrer"><ExternalLink size={14}/></a></div>
            <div className={styles.settingsGrid}>
              <Toggle label="Enable XML Sitemap" checked={globalDraft.sitemapEnabled} onChange={(value) => setGlobalDraft({ ...globalDraft, sitemapEnabled: value })}/>
              <Toggle label="Include published Pages" checked={globalDraft.sitemapIncludePages} onChange={(value) => setGlobalDraft({ ...globalDraft, sitemapIncludePages: value })}/>
              <Toggle label="Include published Posts" checked={globalDraft.sitemapIncludePosts} onChange={(value) => setGlobalDraft({ ...globalDraft, sitemapIncludePosts: value })}/>
              <Toggle label="Include Categories and Tags" checked={globalDraft.sitemapIncludeTaxonomies} onChange={(value) => setGlobalDraft({ ...globalDraft, sitemapIncludeTaxonomies: value })}/>
            </div>
            <div className={styles.buttonRow}><button className={styles.primaryButton} disabled={busy} onClick={() => void saveGlobal()}><Check size={15}/> Save Sitemap Settings</button>{google?.connected && <button className={styles.secondaryButton} disabled={busy} onClick={() => void googleAction("POST", { action: "submit-sitemap" })}><Send size={15}/> Submit Sitemap to Google</button>}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeading}><div><h2>Robots.txt</h2><p>Control crawler access to private and system paths.</p></div><a href="/robots.txt" target="_blank" rel="noreferrer">View robots.txt <ExternalLink size={13}/></a></div>
            <div className={styles.field}><label>Disallowed paths (one per line)</label><textarea rows={5} value={globalDraft.disallowPaths.join("\n")} onChange={(event) => setGlobalDraft({ ...globalDraft, disallowPaths: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}/><small>Keep admin and API routes blocked. Do not disallow CSS, images or public content needed for rendering.</small></div>
            <Toggle label="Noindex internal search results" checked={globalDraft.noindexSearch} onChange={(value) => setGlobalDraft({ ...globalDraft, noindexSearch: value })}/>
            <button className={styles.primaryButton} onClick={() => void saveGlobal()} disabled={busy}><Check size={15}/> Save Robots Settings</button>
          </div>
        </section>
      )}

      {tab === "redirects" && (
        <section className={styles.card}>
          <div className={styles.cardHeading}><div><h2>Redirect Manager</h2><p>Manage old URLs and prevent broken links after slug changes.</p></div><button className={styles.primaryButton} onClick={() => setRedirectEditor({ from: "/old-url/", to: "/new-url/", code: 301, active: true })}><Plus size={15}/> Add Redirect</button></div>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>From</th><th>Destination</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {(data.redirects ?? []).map((redirect) => <tr key={redirect.id}><td>{redirect.from}</td><td>{redirect.to}</td><td>{redirect.code}</td><td>{redirect.deletedAt ? "Trash" : redirect.active ? "Active" : "Inactive"}</td><td><div className={styles.rowActions}>{redirect.deletedAt ? <><button title="Restore" onClick={() => void postAction({ action: "restore-redirect", id: redirect.id })}><RotateCcw size={15}/></button><button title="Delete permanently" onClick={() => void deletePermanently("redirect", redirect.id, redirect.from)}><X size={15}/></button></> : <><button title="Edit" onClick={() => setRedirectEditor(redirect)}><Pencil size={15}/></button><button title="Move to Trash" onClick={() => void postAction({ action: "trash-redirect", id: redirect.id })}><Trash2 size={15}/></button></>}</div></td></tr>)}
            {!data.redirects.length && <tr><td colSpan={5} className={styles.emptyCell}>No redirects created yet.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {tab === "integrations" && (
        <section className={styles.sectionStack}>
          <div className={styles.card}>
            <div className={styles.cardHeading}><div><h2>Google account</h2><p>Connect Google Search Console and Google Analytics 4 using OAuth.</p></div><span className={google?.connected ? styles.connectedBadge : styles.mutedBadge}>{google?.connected ? "Connected" : "Not connected"}</span></div>
            {google?.connected ? <div className={styles.connectionBox}><ShieldCheck size={22}/><div><strong>{google.email}</strong><small>Google account connected. Access tokens are refreshed server-side; refresh token is encrypted at rest.</small></div><button className={styles.dangerButton} disabled={busy} onClick={() => void googleAction("DELETE")}><Unplug size={15}/> Disconnect</button></div> : <div className={styles.connectBox}><Globe size={28}/><div><strong>Connect your Google account</strong><p>Grant read access to Search Console and Analytics reports, plus permission to submit your sitemap.</p><a className={styles.primaryButton} href="/api/admin/seo/google/connect">Continue with Google</a></div></div>}
            <div className={styles.field}><label>Search Console property</label><select value={googleSite} onChange={(event) => setGoogleSite(event.target.value)} disabled={!google?.connected}><option value="">Select a verified property</option>{(google?.sites ?? []).map((site) => <option key={site.siteUrl} value={site.siteUrl}>{site.siteUrl} â€” {site.permissionLevel}</option>)}</select><small>Choose the URL-prefix property or Domain property that is verified and accessible to this Google account.</small></div>
            <div className={styles.field}><label>Google Analytics 4 Property ID</label><input value={analyticsId} onChange={(event) => setAnalyticsId(event.target.value)} placeholder="e.g. 123456789"/><small>Enter the numeric GA4 property ID (not the Measurement ID beginning with G-).</small></div>
            <button className={styles.primaryButton} onClick={() => void saveGoogleProperties()} disabled={busy}><Check size={15}/> Save Google Properties</button>
            {google?.gscError && <div className={styles.alertWarning}>{google.gscError}</div>}
            {google?.analyticsError && <div className={styles.alertWarning}>{google.analyticsError}</div>}
          </div>
          <div className={styles.card}>
            <h2>Verification codes</h2><p className={styles.mutedText}>Paste the content value from Google's HTML meta verification tag. The site root metadata adds these values to the public page head.</p>
            <div className={styles.field}><label>Google Search Console verification</label><input value={globalDraft.googleVerification} onChange={(event) => setGlobalDraft({ ...globalDraft, googleVerification: event.target.value })} placeholder="google-site-verification token"/></div>
            <div className={styles.field}><label>Bing Webmaster verification</label><input value={globalDraft.bingVerification} onChange={(event) => setGlobalDraft({ ...globalDraft, bingVerification: event.target.value })} placeholder="msvalidate.01 token"/></div>
            <button className={styles.primaryButton} onClick={() => void saveGlobal()} disabled={busy}><Check size={15}/> Save Verification Codes</button>
          </div>
        </section>
      )}

      {tab === "tools" && (
        <section className={styles.sectionStack}>
          <div className={styles.card}>
            <div className={styles.cardHeading}><div><h2>SEO defaults</h2><p>Fallback metadata used when content does not provide its own SEO values.</p></div></div>
            <div className={styles.field}><label>Title template</label><input value={globalDraft.titleTemplate} onChange={(event) => setGlobalDraft({ ...globalDraft, titleTemplate: event.target.value })}/><small>Available variables: %title% and %sitename%</small></div>
            <div className={styles.field}><label>Default meta description</label><textarea rows={3} maxLength={1000} value={globalDraft.defaultDescription} onChange={(event) => setGlobalDraft({ ...globalDraft, defaultDescription: event.target.value })}/><small>{globalDraft.defaultDescription.length}/160 recommended characters</small></div>
            <div className={styles.field}><label>Default social sharing image URL</label><input value={globalDraft.defaultSocialImage} onChange={(event) => setGlobalDraft({ ...globalDraft, defaultSocialImage: event.target.value })} placeholder="https://..."/></div>
            <button className={styles.primaryButton} onClick={() => void saveGlobal()} disabled={busy}><Check size={15}/> Save SEO Defaults</button>
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeading}><div><h2>SEO report</h2><p>Export content metadata, SEO scores and missing-field checks for offline review.</p></div><ArrowDownToLine size={20}/></div>
            <a className={styles.primaryButton} href="/api/admin/seo/report?format=csv"><ArrowDownToLine size={15}/> Download CSV Report</a>
            <a className={styles.secondaryButton} href="/api/admin/seo/report?format=json"><ArrowDownToLine size={15}/> Download JSON Report</a>
          </div>
          <div className={styles.card}>
            <h2>Technical SEO checks</h2>
            <CheckRow label="XML sitemap route" href="/sitemap.xml"/>
            <CheckRow label="Robots.txt route" href="/robots.txt"/>
            <CheckRow label="Canonical and robots metadata" detail="Page and post metadata is applied by the public route metadata functions."/>
            <CheckRow label="Open Graph and Twitter metadata" detail="Per-content social metadata can be saved in the Content SEO editor."/>
          </div>
        </section>
      )}

      {editor && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="seo-edit-title"><div className={styles.modalHeader}><div><h2 id="seo-edit-title">Edit SEO Metadata</h2><p>{editor.type.toUpperCase()} Â· {data.items.find((item) => item.id === editor.id && item.type === editor.type)?.title}</p></div><button onClick={() => setEditor(null)} aria-label="Close"><X size={18}/></button></div>
        <div className={styles.modalBody}>
          <Field label="SEO title"><input value={editor.seoTitle} maxLength={255} onChange={(event) => setEditor({ ...editor, seoTitle: event.target.value })}/><small className={editor.seoTitle.length > 60 ? styles.warningText : ""}>{editor.seoTitle.length}/60 characters recommended</small></Field>
          <Field label="Meta description"><textarea rows={4} maxLength={1000} value={editor.seoDescription} onChange={(event) => setEditor({ ...editor, seoDescription: event.target.value })}/><small>{editor.seoDescription.length}/160 characters recommended</small></Field>
          <Field label="Focus keyword"><input value={editor.focusKeyword} onChange={(event) => setEditor({ ...editor, focusKeyword: event.target.value })}/></Field>
          <Field label="Canonical URL"><input value={editor.canonicalUrl} onChange={(event) => setEditor({ ...editor, canonicalUrl: event.target.value })} placeholder="Leave empty to use the page URL"/></Field>
          <Field label="Robots directive"><select value={editor.metaRobots} onChange={(event) => setEditor({ ...editor, metaRobots: event.target.value })}><option value="index,follow">Index, Follow</option><option value="noindex,follow">Noindex, Follow</option><option value="index,nofollow">Index, Nofollow</option><option value="noindex,nofollow">Noindex, Nofollow</option></select></Field>
          <h3>Open Graph / Social</h3>
          <Field label="Social title"><input value={editor.ogTitle || ""} onChange={(event) => setEditor({ ...editor, ogTitle: event.target.value })}/></Field>
          <Field label="Social description"><textarea rows={2} value={editor.ogDescription || ""} onChange={(event) => setEditor({ ...editor, ogDescription: event.target.value })}/></Field>
          <Field label="Social image URL"><input value={editor.ogImage || ""} onChange={(event) => setEditor({ ...editor, ogImage: event.target.value })}/></Field>
          <h3>Twitter / X</h3>
          <Field label="Twitter title"><input value={editor.twitterTitle || ""} onChange={(event) => setEditor({ ...editor, twitterTitle: event.target.value })}/></Field>
          <Field label="Twitter description"><textarea rows={2} value={editor.twitterDescription || ""} onChange={(event) => setEditor({ ...editor, twitterDescription: event.target.value })}/></Field>
          <Field label="Twitter image URL"><input value={editor.twitterImage || ""} onChange={(event) => setEditor({ ...editor, twitterImage: event.target.value })}/></Field>
          <Field label="Schema type"><select value={editor.schemaType || "WebPage"} onChange={(event) => setEditor({ ...editor, schemaType: event.target.value })}><option>WebPage</option><option>Article</option><option>BlogPosting</option><option>Product</option><option>Service</option></select></Field>
        </div>
        <div className={styles.modalFooter}><button className={styles.secondaryButton} onClick={() => setEditor(null)}>Cancel</button><button className={styles.primaryButton} onClick={() => void saveEditor()} disabled={busy}>{busy ? <Loader2 className={styles.spin} size={15}/> : <Check size={15}/>} Save SEO</button></div></div></div>}

      {redirectEditor && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setRedirectEditor(null); }}><div className={styles.modal} role="dialog" aria-modal="true"><div className={styles.modalHeader}><div><h2>{redirectEditor.id ? "Edit Redirect" : "Add Redirect"}</h2><p>Redirect old URLs to the correct destination.</p></div><button onClick={() => setRedirectEditor(null)}><X size={18}/></button></div><div className={styles.modalBody}>
        <Field label="Source path"><input value={redirectEditor.from || ""} onChange={(event) => setRedirectEditor({ ...redirectEditor, from: event.target.value })} placeholder="/old-page/"/></Field>
        <Field label="Destination"><input value={redirectEditor.to || ""} onChange={(event) => setRedirectEditor({ ...redirectEditor, to: event.target.value })} placeholder="/new-page/ or https://example.com/"/></Field>
        <Field label="Redirect type"><select value={redirectEditor.code || 301} onChange={(event) => setRedirectEditor({ ...redirectEditor, code: Number(event.target.value) as 301 | 302 | 307 | 308 })}><option value={301}>301 â€” Permanent</option><option value={302}>302 â€” Temporary</option><option value={307}>307 â€” Temporary (preserve method)</option><option value={308}>308 â€” Permanent (preserve method)</option></select></Field>
        <Toggle label="Redirect enabled" checked={redirectEditor.active !== false} onChange={(value) => setRedirectEditor({ ...redirectEditor, active: value })}/>
      </div><div className={styles.modalFooter}><button className={styles.secondaryButton} onClick={() => setRedirectEditor(null)}>Cancel</button><button className={styles.primaryButton} onClick={() => void saveRedirect()} disabled={busy}><Check size={15}/> Save Redirect</button></div></div></div>}
    </main>
  );
}

function Metric({ title, value, note, icon, tone = "default" }: { title: string; value: string; note: string; icon: React.ReactNode; tone?: "default" | "warning" | "success" }) {
  return <div className={`${styles.metricCard} ${tone === "warning" ? styles.metricWarning : tone === "success" ? styles.metricSuccess : ""}`}><div className={styles.metricTop}><span>{title}</span>{icon}</div><strong>{value}</strong><small>{note}</small></div>;
}
function MiniMetric({ label, value }: { label: string; value: string }) { return <div className={styles.miniMetric}><span>{label}</span><strong>{value}</strong></div>; }
function IssueRow({ title, detail, count }: { title: string; detail: string; count: number }) { return <div className={styles.issueRow}><span className={count ? styles.issueIcon : styles.issueOk}>{count ? <CircleAlert size={16}/> : <Check size={16}/>}</span><div><strong>{title}</strong><small>{detail}</small></div><b>{count}</b></div>; }
function Score({ score }: { score: number }) { return <span className={`${styles.score} ${score >= 75 ? styles.scoreGood : score >= 45 ? styles.scoreMedium : styles.scoreLow}`}>{score}</span>; }
function EmptyPanel({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) { return <div className={styles.emptyPanel}>{icon}<strong>{title}</strong><p>{text}</p>{action}</div>; }
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className={styles.field}><label>{label}</label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className={styles.toggle}><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><i/></label>; }
function CheckRow({ label, href, detail }: { label: string; href?: string; detail?: string }) { return <div className={styles.checkRow}><Check size={16}/><span>{label}{detail && <small>{detail}</small>}</span>{href && <a href={href} target="_blank" rel="noreferrer"><ExternalLink size={13}/></a>}</div>; }
