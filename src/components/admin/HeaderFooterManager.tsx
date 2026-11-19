"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Search, Pencil, Trash2, RotateCcw, ShieldCheck, Globe, FileText, AlertTriangle } from "lucide-react";
import styles from "./HeaderFooterManager.module.css";

type Kind = "header" | "footer";
type View = "active" | "trash";
type TemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type Conditions = { include?: string[]; exclude?: string[] };
type TemplateItem = {
  id: string;
  documentKey: string;
  kind: Kind;
  title: string;
  status: TemplateStatus;
  conditions?: Conditions | null;
  updatedAt?: string | Date | null;
};
type ApiResult = { success?: boolean; message?: string; documents?: TemplateItem[] };
type Props = { kind: Kind };

const basePath = (kind: Kind) => `/admin/appearance/${kind}-builder`;
const kindLabel = (kind: Kind) => kind === "header" ? "Header" : "Footer";

function rulesToText(value: unknown): string {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : "";
}

function parseRules(value: string): string[] {
  return [...new Set(value.split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean))];
}

function getConditionSummary(template: TemplateItem): string {
  if (template.documentKey.endsWith(":primary")) return "Global default (fallback on all pages)";
  const include = template.conditions?.include ?? [];
  const exclude = template.conditions?.exclude ?? [];
  if (!include.length) return "Not assigned to any page";
  return `${include.join(", ")}${exclude.length ? ` · excluding ${exclude.join(", ")}` : ""}`;
}

export default function HeaderFooterManager({ kind }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("active");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedConditions, setExpandedConditions] = useState<string | null>(null);
  const [includeDraft, setIncludeDraft] = useState("");
  const [excludeDraft, setExcludeDraft] = useState("");

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/builder/documents?kind=${kind}&view=${view}`, { cache: "no-store" });
      const data = (await response.json()) as ApiResult;
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to load templates.");
      setTemplates(Array.isArray(data.documents) ? data.documents : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load templates.");
    } finally {
      setLoading(false);
    }
  }, [kind, view]);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const filtered = useMemo(() => templates.filter((item) =>
    item.title.toLowerCase().includes(search.trim().toLowerCase()) ||
    item.documentKey.toLowerCase().includes(search.trim().toLowerCase())
  ), [templates, search]);

  const openEditor = (item: TemplateItem) => {
    const templateId = item.documentKey.slice(`${kind}:`.length);
    router.push(`${basePath(kind)}?id=${encodeURIComponent(templateId)}`);
  };

  const createTemplate = async () => {
    const name = window.prompt(`Enter a name for the new ${kindLabel(kind).toLowerCase()}:`);
    if (!name?.trim()) return;
    const id = crypto.randomUUID().replace(/-/g, "");
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/builder/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentKey: `${kind}:${id}`,
          kind,
          title: name.trim(),
          status: "DRAFT",
          layout: { version: 1, root: [] },
          settings: {},
          globalStyles: {},
          conditions: { include: [], exclude: [] },
          revisionMessage: `Created ${kindLabel(kind).toLowerCase()} template`,
        }),
      });
      const data = (await response.json()) as ApiResult;
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to create template.");
      router.push(`${basePath(kind)}?id=${encodeURIComponent(id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create template.");
    } finally {
      setCreating(false);
    }
  };

  const runAction = async (template: TemplateItem, action: "moveToTrash" | "restoreFromTrash" | "permanentlyDelete") => {
    const confirmation = action === "moveToTrash"
      ? `Move “${template.title}” to Trash? It will stop appearing on the public website.`
      : action === "restoreFromTrash"
        ? `Restore “${template.title}” from Trash?`
        : `Permanently delete “${template.title}” and its revision history? This cannot be undone.`;
    if (!window.confirm(confirmation)) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/builder/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentKey: template.documentKey, action }),
      });
      const data = (await response.json()) as ApiResult;
      if (!response.ok || !data.success) throw new Error(data.message || "Template action failed.");
      setMessage(data.message || "Template updated.");
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template action failed.");
    }
  };

  const openConditions = (template: TemplateItem) => {
    setExpandedConditions((current) => current === template.documentKey ? null : template.documentKey);
    setIncludeDraft(rulesToText(template.conditions?.include));
    setExcludeDraft(rulesToText(template.conditions?.exclude));
  };

  const saveConditions = async (template: TemplateItem) => {
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/builder/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentKey: template.documentKey,
          action: "updateConditions",
          conditions: { include: parseRules(includeDraft), exclude: parseRules(excludeDraft) },
        }),
      });
      const data = (await response.json()) as ApiResult;
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to save display conditions.");
      setMessage("Display conditions saved.");
      setExpandedConditions(null);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save display conditions.");
    }
  };

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "Not updated yet";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not updated yet" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>Appearance <span>/</span> {kindLabel(kind)} Builder</div>
          <h1>{kindLabel(kind)} Templates</h1>
          <p>Create different {kindLabel(kind).toLowerCase()} designs and assign them to specific website pages.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => void loadTemplates()} disabled={loading}><RefreshCw size={16}/> Refresh</button>
          {view === "active" && <button type="button" className={styles.primaryButton} onClick={() => void createTemplate()} disabled={creating}><Plus size={17}/> {creating ? "Creating…" : `Add New ${kindLabel(kind)}`}</button>}
        </div>
      </header>

      {error && <div className={styles.alertError}><AlertTriangle size={16}/>{error}</div>}
      {message && <div className={styles.alertSuccess}>{message}</div>}

      <section className={styles.toolbar}>
        <div className={styles.tabs}>
          <button type="button" className={view === "active" ? styles.activeTab : ""} onClick={() => setView("active")}>All Templates</button>
          <button type="button" className={view === "trash" ? styles.activeTab : ""} onClick={() => setView("trash")}><Trash2 size={14}/> Trash</button>
        </div>
        <label className={styles.search}><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${kindLabel(kind).toLowerCase()} templates`}/></label>
      </section>

      {loading ? <div className={styles.empty}>Loading templates…</div> : filtered.length === 0 ? (
        <div className={styles.empty}><FileText size={30}/><strong>No templates found</strong><span>{view === "trash" ? "Deleted templates will appear here." : `Create your first ${kindLabel(kind).toLowerCase()} template.`}</span></div>
      ) : (
        <section className={styles.grid}>
          {filtered.map((template) => {
            const isTrash = view === "trash";
            return (
              <article className={styles.card} key={template.documentKey}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIcon}>{kind === "header" ? <Globe size={20}/> : <FileText size={20}/>}</div>
                  <div className={styles.cardTitle}><h2>{template.title}</h2><code>{template.documentKey}</code></div>
                  <span className={template.status === "PUBLISHED" ? styles.published : isTrash ? styles.trashed : styles.draft}>{isTrash ? "TRASH" : template.status}</span>
                </div>
                <div className={styles.assignment}><span className={styles.assignmentLabel}>Display condition</span><span>{getConditionSummary(template)}</span></div>
                <div className={styles.updated}>Updated: {formatDate(template.updatedAt)}</div>

                {!isTrash && expandedConditions === template.documentKey && (
                  <div className={styles.conditionsEditor}>
                    <label>Include on pages <small>One path per line. Use * for all pages, / for homepage, or /about-us.</small><textarea rows={4} value={includeDraft} onChange={(event) => setIncludeDraft(event.target.value)} placeholder={'/about-us\n/contact'}/></label>
                    <label>Exclude from pages <small>Optional paths that should not show this template.</small><textarea rows={3} value={excludeDraft} onChange={(event) => setExcludeDraft(event.target.value)} placeholder="/about-us/private"/></label>
                    <div className={styles.conditionsActions}><button type="button" className={styles.secondaryButton} onClick={() => setExpandedConditions(null)}>Cancel</button><button type="button" className={styles.primaryButton} onClick={() => void saveConditions(template)}>Save Conditions</button></div>
                  </div>
                )}

                <div className={styles.cardActions}>
                  {isTrash ? (
                    <>
                      <button type="button" className={styles.restoreButton} onClick={() => void runAction(template, "restoreFromTrash")}><RotateCcw size={15}/> Restore</button>
                      <button type="button" className={styles.dangerButton} onClick={() => void runAction(template, "permanentlyDelete")}><Trash2 size={15}/> Delete permanently</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={styles.primaryButton} onClick={() => openEditor(template)}><Pencil size={15}/> Edit in Builder</button>
                      <button type="button" className={styles.secondaryButton} onClick={() => openConditions(template)}><ShieldCheck size={15}/> Display Conditions</button>
                      <button type="button" className={styles.dangerButton} onClick={() => void runAction(template, "moveToTrash")}><Trash2 size={15}/> Move to Trash</button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
      <p className={styles.note}><ShieldCheck size={14}/> A Primary template with no include rules acts as the global fallback. Other templates display only on assigned page paths. If no matching published Builder template exists, the website uses its default {kindLabel(kind).toLowerCase()}.</p>
    </main>
  );
}
