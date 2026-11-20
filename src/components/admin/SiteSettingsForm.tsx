"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import MediaPickerModal, {
  type MediaPickerItem,
} from "@/components/admin/MediaPickerModal";
import type { SiteSettings } from "@/lib/site-settings";
import styles from "./SiteSettingsForm.module.css";

type SettingsFormState = SiteSettings & {
  general: SiteSettings["general"] & {
    siteIcon?: { id: string; filePath: string; originalName: string } | null;
  };
};
type PageOption = { id: string; title: string; slug: string };
type Tab = "general" | "reading" | "permalinks";

const timezones = [
  "Asia/Kolkata",
  "UTC",
  "America/Los_Angeles",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

const initialSettings: SettingsFormState = {
  general: {
    siteTitle: "Connect Broadband",
    tagline: "",
    siteIconId: null,
    wordpressAddress: "http://localhost:3000",
    siteAddress: "http://localhost:3000",
    adminEmail: "admin@example.com",
    siteUrlMode: "auto",
    adminEmailMode: "auto",
    membership: false,
    newUserRole: "CONTRIBUTOR",
    language: "en-US",
    timezone: "Asia/Kolkata",
    dateFormat: "F j, Y",
    timeFormat: "g:i a",
    weekStartsOn: 1,
  },
  reading: {
    showOnFront: "posts",
    homepagePageId: null,
    postsPageId: null,
    postsPerPage: 10,
    postsPerFeed: 10,
    feedContent: "excerpt",
  },
  permalinks: {
    structure: "post-name",
    customStructure: "/%postname%/",
  },
};

const permalinkExamples: Record<string, string> = {
  plain: "/?p=123",
  "day-and-name": "/2026/11/20/sample-post/",
  "month-and-name": "/2026/11/sample-post/",
  numeric: "/archives/123/",
  "post-name": "/sample-post/",
  custom: "/%category%/%postname%/",
};

const permalinkTags = [
  ["%year%", "Year"],
  ["%monthnum%", "Month"],
  ["%day%", "Day"],
  ["%hour%", "Hour"],
  ["%minute%", "Minute"],
  ["%second%", "Second"],
  ["%post_id%", "Post ID"],
  ["%postname%", "Post Name"],
  ["%category%", "Category"],
] as const;

type RuntimeDefaults = { siteOrigin: string; adminEmail: string };

export default function SiteSettingsForm() {
  const [settings, setSettings] = useState(initialSettings);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [tab, setTab] = useState<Tab>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [runtimeDefaults, setRuntimeDefaults] = useState<RuntimeDefaults>({ siteOrigin: "", adminEmail: "" });
  const permalinkInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load settings.");
        }
        if (active) {
          setSettings(result.settings);
          setPages(result.pages);
          setRuntimeDefaults({
            siteOrigin: typeof result.runtime?.siteOrigin === "string" ? result.runtime.siteOrigin : "",
            adminEmail: typeof result.runtime?.adminEmail === "string" ? result.runtime.adminEmail : "",
          });
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unable to load settings.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateGeneral<K extends keyof SiteSettings["general"]>(
    key: K,
    value: SiteSettings["general"][K]
  ) {
    setSettings((current) => ({
      ...current,
      general: { ...current.general, [key]: value },
    }));
  }

  function updateReading<K extends keyof SiteSettings["reading"]>(
    key: K,
    value: SiteSettings["reading"][K]
  ) {
    setSettings((current) => ({
      ...current,
      reading: { ...current.reading, [key]: value },
    }));
  }

  function updatePermalinks<K extends keyof SiteSettings["permalinks"]>(
    key: K,
    value: SiteSettings["permalinks"][K]
  ) {
    setSettings((current) => ({
      ...current,
      permalinks: { ...current.permalinks, [key]: value },
    }));
  }

  function insertPermalinkTag(token: string) {
    const input = permalinkInputRef.current;
    const current = settings.permalinks.customStructure;
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    updatePermalinks("customStructure", next);
    requestAnimationFrame(() => {
      input?.focus();
      const cursor = start + token.length;
      input?.setSelectionRange(cursor, cursor);
    });
  }

  function setSiteUrlMode(mode: "auto" | "custom") {
    updateGeneral("siteUrlMode", mode);
    if (mode === "auto") {
      const origin = runtimeDefaults.siteOrigin || window.location.origin;
      updateGeneral("wordpressAddress", origin);
      updateGeneral("siteAddress", origin);
    }
  }

  function setAdminEmailMode(mode: "auto" | "custom") {
    updateGeneral("adminEmailMode", mode);
    if (mode === "auto" && runtimeDefaults.adminEmail) {
      updateGeneral("adminEmail", runtimeDefaults.adminEmail);
    }
  }

  const customPreviewPath = settings.permalinks.customStructure
    .replace(/%year%/g, "2026")
    .replace(/%monthnum%/g, "11")
    .replace(/%day%/g, "20")
    .replace(/%hour%/g, "10")
    .replace(/%minute%/g, "30")
    .replace(/%second%/g, "00")
    .replace(/%post_id%/g, "123")
    .replace(/%postname%/g, "sample-post")
    .replace(/%category%/g, "broadband");

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          general: settings.general,
          reading: settings.reading,
          permalinks: settings.permalinks,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save settings.");
      }
      setSettings((current) => ({
        ...current,
        ...result.settings,
        general: { ...result.settings.general, siteIcon: current.general.siteIcon },
      }));
      setNotice("Settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function selectIcon(item: MediaPickerItem) {
    updateGeneral("siteIconId", item.id);
    setSettings((current) => ({
      ...current,
      general: {
        ...current.general,
        siteIconId: item.id,
        siteIcon: {
          id: item.id,
          filePath: item.url,
          originalName: item.originalName,
        },
      },
    }));
  }

  const icon = settings.general.siteIcon;
  const selectedPage = (id: string | null) =>
    id ? pages.find((page) => page.id === id)?.title || "" : "";

  return (
    <form className={styles.page} onSubmit={saveSettings}>
      <header className={styles.header}>
        <div>
          <h1>Settings</h1>
          <p>Manage your website identity, homepage, and post URLs.</p>
        </div>
        <button className={styles.save} type="submit" disabled={saving || loading}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </header>

      <nav className={styles.tabs} aria-label="Settings sections">
        {([
          ["general", "General"],
          ["reading", "Reading"],
          ["permalinks", "Permalinks"],
        ] as [Tab, string][]).map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? styles.activeTab : ""}
            type="button"
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {loading ? (
        <div className={styles.panel}>Loading settings…</div>
      ) : (
        <>
          {tab === "general" && (
            <section className={styles.panel}>
              <h2>General Settings</h2>
              <label className={styles.field}>
                <span>Site Title</span>
                <input value={settings.general.siteTitle} maxLength={120} onChange={(e) => updateGeneral("siteTitle", e.target.value)} required />
              </label>
              <label className={styles.field}>
                <span>Tagline</span>
                <input value={settings.general.tagline} maxLength={250} onChange={(e) => updateGeneral("tagline", e.target.value)} />
              </label>
              <div className={styles.field}>
                <span>Site Icon</span>
                <div className={styles.iconControl}>
                  {icon ? <img src={icon.filePath} alt={icon.originalName} /> : <div className={styles.iconPlaceholder}><ImagePlus size={22} /></div>}
                  <div>
                    <button className={styles.secondary} type="button" onClick={() => setPickerOpen(true)}>Choose from Media Library</button>
                    {settings.general.siteIconId && (
                      <button
                        className={styles.clear}
                        type="button"
                        onClick={() => {
                          updateGeneral("siteIconId", null);
                          setSettings((current) => ({
                            ...current,
                            general: { ...current.general, siteIconId: null, siteIcon: null },
                          }));
                        }}
                      >
                        Clear icon reference
                      </button>
                    )}
                  </div>
                </div>
                <small>Clearing removes the site’s reference only. The media file stays in the library.</small>
              </div>
              <label className={styles.field}>
                <span>Site URL Detection</span>
                <select value={settings.general.siteUrlMode} onChange={(e) => setSiteUrlMode(e.target.value as "auto" | "custom")}>
                  <option value="auto">Automatically detect current live domain</option>
                  <option value="custom">Use custom address</option>
                </select>
                <small>Auto mode uses the deployment's configured site URL or the domain currently serving this admin panel.</small>
              </label>
              <label className={styles.field}>
                <span>WordPress Address (URL)</span>
                <input type="url" value={settings.general.wordpressAddress} disabled={settings.general.siteUrlMode === "auto"} onChange={(e) => { updateGeneral("siteUrlMode", "custom"); updateGeneral("wordpressAddress", e.target.value); }} required />
              </label>
              <label className={styles.field}>
                <span>Site Address (URL)</span>
                <input type="url" value={settings.general.siteAddress} disabled={settings.general.siteUrlMode === "auto"} onChange={(e) => { updateGeneral("siteUrlMode", "custom"); updateGeneral("siteAddress", e.target.value); }} required />
              </label>
              <label className={styles.field}>
                <span>Administration Email Detection</span>
                <select value={settings.general.adminEmailMode} onChange={(e) => setAdminEmailMode(e.target.value as "auto" | "custom")}>
                  <option value="auto">Use currently logged-in admin email</option>
                  <option value="custom">Use custom administration email</option>
                </select>
                <small>Auto mode is populated from the active account. Switch to Custom to keep a separate site contact address.</small>
              </label>
              <label className={styles.field}>
                <span>Administration Email Address</span>
                <input type="email" value={settings.general.adminEmail} disabled={settings.general.adminEmailMode === "auto"} onChange={(e) => { updateGeneral("adminEmailMode", "custom"); updateGeneral("adminEmail", e.target.value); }} required />
              </label>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={settings.general.membership} onChange={(e) => updateGeneral("membership", e.target.checked)} />
                <span>Anyone can register</span>
              </label>
              <label className={styles.field}>
                <span>New User Default Role</span>
                <select value={settings.general.newUserRole} onChange={(e) => updateGeneral("newUserRole", e.target.value as SiteSettings["general"]["newUserRole"])}>
                  <option value="CONTRIBUTOR">Contributor</option>
                  <option value="AUTHOR">Author</option>
                  <option value="EDITOR">Editor</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Site Language</span>
                <select value={settings.general.language} onChange={(e) => updateGeneral("language", e.target.value)}>
                  <option value="en-US">English (United States)</option>
                  <option value="en-GB">English (United Kingdom)</option>
                  <option value="hi-IN">Hindi</option>
                  <option value="pa-IN">Punjabi</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Timezone</span>
                <input list="site-timezones" value={settings.general.timezone} onChange={(e) => updateGeneral("timezone", e.target.value)} />
                <datalist id="site-timezones">
                  {timezones.map((zone) => <option key={zone} value={zone} />)}
                </datalist>
              </label>
              <fieldset className={styles.fieldset}>
                <legend>Date and Time Format</legend>
                <label className={styles.field}>
                  <span>Date Format</span>
                  <select value={settings.general.dateFormat} onChange={(e) => updateGeneral("dateFormat", e.target.value as SiteSettings["general"]["dateFormat"])}>
                    <option value="F j, Y">November 13, 2026</option>
                    <option value="Y-m-d">2026-11-13</option>
                    <option value="m/d/Y">11/13/2026</option>
                    <option value="d/m/Y">13/11/2026</option>
                    <option value="M j, Y">Nov 13, 2026</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Time Format</span>
                  <select value={settings.general.timeFormat} onChange={(e) => updateGeneral("timeFormat", e.target.value as SiteSettings["general"]["timeFormat"])}>
                    <option value="g:i a">1:45 pm</option>
                    <option value="g:i A">1:45 PM</option>
                    <option value="H:i">13:45</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Week Starts On</span>
                  <select value={settings.general.weekStartsOn} onChange={(e) => updateGeneral("weekStartsOn", Number(e.target.value))}>
                    {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <option value={index} key={day}>{day}</option>)}
                  </select>
                </label>
              </fieldset>
            </section>
          )}

          {tab === "reading" && (
            <section className={styles.panel}>
              <h2>Reading Settings</h2>
              <fieldset className={styles.choiceGroup}>
                <legend>Your homepage displays</legend>
                <label><input type="radio" name="showOnFront" value="posts" checked={settings.reading.showOnFront === "posts"} onChange={() => updateReading("showOnFront", "posts")} /> Your latest posts</label>
                <label><input type="radio" name="showOnFront" value="page" checked={settings.reading.showOnFront === "page"} onChange={() => updateReading("showOnFront", "page")} /> A static page</label>
              </fieldset>
              <label className={styles.field}>
                <span>Homepage</span>
                <select value={settings.reading.homepagePageId || ""} onChange={(e) => updateReading("homepagePageId", e.target.value || null)} disabled={settings.reading.showOnFront !== "page"}>
                  <option value="">— Select a page —</option>
                  {pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
                </select>
                {settings.reading.homepagePageId && <small>{selectedPage(settings.reading.homepagePageId)} is served at /; its page URL redirects to the homepage.</small>}
              </label>
              <label className={styles.field}>
                <span>Posts page</span>
                <select value={settings.reading.postsPageId || ""} onChange={(e) => updateReading("postsPageId", e.target.value || null)}>
                  <option value="">— Select a page —</option>
                  {pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>Blog pages show at most</span>
                <input type="number" min={1} max={100} value={settings.reading.postsPerPage} onChange={(e) => updateReading("postsPerPage", Number(e.target.value))} />
                <small>posts</small>
              </label>
              <label className={styles.field}>
                <span>Syndication feeds show the most recent</span>
                <input type="number" min={1} max={100} value={settings.reading.postsPerFeed} onChange={(e) => updateReading("postsPerFeed", Number(e.target.value))} />
                <small>items</small>
              </label>
              <fieldset className={styles.choiceGroup}>
                <legend>For each post in a feed, include</legend>
                <label><input type="radio" name="feedContent" value="full" checked={settings.reading.feedContent === "full"} onChange={() => updateReading("feedContent", "full")} /> Full text</label>
                <label><input type="radio" name="feedContent" value="excerpt" checked={settings.reading.feedContent === "excerpt"} onChange={() => updateReading("feedContent", "excerpt")} /> Excerpt</label>
              </fieldset>
            </section>
          )}

          {tab === "permalinks" && (
            <section className={styles.panel}>
              <h2>Permalink Settings</h2>
              <p className={styles.help}>Choose the URL format for published posts. Existing /blog/post-slug links continue to redirect to the selected URL.</p>
              <fieldset className={styles.permalinkList}>
                <legend>Common settings</legend>
                {([
                  ["plain", "Plain"],
                  ["day-and-name", "Day and name"],
                  ["month-and-name", "Month and name"],
                  ["numeric", "Numeric"],
                  ["post-name", "Post name"],
                  ["custom", "Custom Structure"],
                ] as [SiteSettings["permalinks"]["structure"], string][]).map(([value, label]) => (
                  <label key={value}>
                    <input type="radio" name="permalinkStructure" value={value} checked={settings.permalinks.structure === value} onChange={() => updatePermalinks("structure", value)} />
                    <span>{label}</span>
                    {value !== "custom" && <code>{permalinkExamples[value]}</code>}
                  </label>
                ))}
              </fieldset>
              {settings.permalinks.structure === "custom" && (
                <div className={styles.customPermalinkEditor}>
                  <label className={styles.field}>
                    <span>Custom Structure</span>
                    <div className={styles.customStructureInput}>
                      <span>{settings.general.siteAddress.replace(/\/$/, "")}</span>
                      <input
                        ref={permalinkInputRef}
                        value={settings.permalinks.customStructure}
                        onChange={(e) => updatePermalinks("customStructure", e.target.value)}
                        placeholder="/%category%/%postname%/"
                        aria-label="Custom permalink structure"
                      />
                    </div>
                  </label>
                  <div className={styles.permalinkTags}>
                    <strong>Available tags:</strong>
                    <div className={styles.permalinkTagButtons}>
                      {permalinkTags.map(([token, label]) => (
                        <button key={token} type="button" onClick={() => insertPermalinkTag(token)} title={`Insert ${token}`}>
                          {token}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.permalinkPreview}>
                    <strong>Example:</strong>
                    <code>{settings.general.siteAddress.replace(/\/$/, "")}{customPreviewPath}</code>
                    <small>For example, /%category%/%postname%/ creates /broadband/sample-post/.</small>
                    <small>%author% is not available yet because the current Post database model does not store an author relation.</small>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
      <MediaPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={selectIcon} />
    </form>
  );
}
