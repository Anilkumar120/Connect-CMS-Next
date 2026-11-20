"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  ChevronDown,
  FileText,
  Globe,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import styles from "./HeaderFooterManager.module.css";

type Kind = "header" | "footer";
type View = "active" | "trash";
type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type RuleAction = "include" | "exclude";
type RuleType =
  | "entire-site"
  | "all-pages"
  | "selected-page"
  | "all-posts"
  | "selected-post"
  | "all-singular"
  | "blog-archive"
  | "category-archives"
  | "tag-archives"
  | "all-archives"
  | "custom-archives"
  | "custom-type-archive"
  | "all-custom-singular"
  | "custom-type-singular"
  | "selected-custom-post"
  | "selected-category"
  | "selected-tag"
  | "custom-path";

type ConditionRule = {
  action: RuleAction;
  type: RuleType;
  id?: string;
  slug?: string;
  path?: string;
};
type RuleDraft = ConditionRule & { key: string };
type Conditions = { include?: string[]; exclude?: string[]; rules?: ConditionRule[] };
type TemplateItem = {
  id: string;
  documentKey: string;
  kind: Kind;
  title: string;
  status: Status;
  conditions?: Conditions | null;
  updatedAt?: string | Date | null;
};
type PageOption = { id: string; title: string; permalink: string };
type PostOption = { id: string; title: string; permalink: string; postTypeSlug?: string | null };
type NamedOption = { id: string; name: string; slug: string };
type ContentTypeOption = { id: string; title: string; slug: string };
type ApiResult<T> = { success?: boolean; message?: string } & T;
type Props = { kind: Kind };

const basePath = (kind: Kind) => `/admin/appearance/${kind}-builder`;
const kindLabel = (kind: Kind) => (kind === "header" ? "Header" : "Footer");
const ruleLabels: Record<RuleType, string> = {
  "entire-site": "Entire Site",
  "all-pages": "All Pages",
  "selected-page": "Singular → Specific Page",
  "all-posts": "All Posts",
  "selected-post": "Singular → Specific Post",
  "all-singular": "All Singular (Pages + Posts)",
  "blog-archive": "Blog Archive",
  "category-archives": "All Category Archives",
  "tag-archives": "All Tag Archives",
  "all-archives": "All Archives",
  "custom-archives": "All Custom Post Type Archives",
  "custom-type-archive": "Specific Custom Post Type Archive",
  "all-custom-singular": "All Custom Post Entries",
  "custom-type-singular": "Custom Post Type Entries",
  "selected-custom-post": "Specific Custom Post",
  "selected-category": "Specific Blog Category Archive",
  "selected-tag": "Specific Blog Tag Archive",
  "custom-path": "Custom URL / Pattern",
};

const makeRule = (action: RuleAction = "include", type: RuleType = "all-pages"): RuleDraft => ({
  key: crypto.randomUUID(),
  action,
  type,
  ...(type === "custom-path" ? { path: "/" } : {}),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeOptionList<T extends { id: string }>(value: unknown, key: string): T[] {
  if (!isRecord(value) || !Array.isArray(value[key])) return [];
  return value[key].filter((item): item is T => isRecord(item) && typeof item.id === "string");
}

function rulesFromConditions(conditions?: Conditions | null): RuleDraft[] {
  const savedRules = Array.isArray(conditions?.rules) ? conditions.rules : [];
  const rows: RuleDraft[] = savedRules
    .filter((rule): rule is ConditionRule => isRecord(rule) && (rule.action === "include" || rule.action === "exclude") && typeof rule.type === "string")
    .map((rule) => ({ ...rule, key: crypto.randomUUID() }));
  for (const path of conditions?.include ?? []) {
    rows.push({ key: crypto.randomUUID(), action: "include", type: "custom-path", path });
  }
  for (const path of conditions?.exclude ?? []) {
    rows.push({ key: crypto.randomUUID(), action: "exclude", type: "custom-path", path });
  }
  return rows;
}

function getRuleTargets(rule: RuleDraft, data: {
  pages: PageOption[];
  posts: PostOption[];
  categories: NamedOption[];
  tags: NamedOption[];
  contentTypes: ContentTypeOption[];
}): { id: string; label: string }[] {
  switch (rule.type) {
    case "selected-page": return data.pages.map((item) => ({ id: item.id, label: `${item.title} (${item.permalink})` }));
    case "selected-post": return data.posts.filter((item) => !item.postTypeSlug).map((item) => ({ id: item.id, label: item.title }));
    case "selected-custom-post": return data.posts.filter((item) => Boolean(item.postTypeSlug)).map((item) => ({ id: item.id, label: `${item.title} (${item.postTypeSlug})` }));
    case "selected-category": return data.categories.map((item) => ({ id: item.id, label: `${item.name} (/blog/category/${item.slug})` }));
    case "selected-tag": return data.tags.map((item) => ({ id: item.id, label: `${item.name} (/blog/tag/${item.slug})` }));
    case "custom-type-archive": return data.contentTypes.map((item) => ({ id: item.slug, label: `${item.title} (/content/${item.slug})` }));
    case "custom-type-singular": return data.contentTypes.map((item) => ({ id: item.slug, label: item.title }));
    default: return [];
  }
}

function conditionSummary(template: TemplateItem): string {
  const rules = template.conditions?.rules ?? [];
  const include = rules.filter((rule) => rule.action === "include");
  const exclude = rules.filter((rule) => rule.action === "exclude");
  const legacy = [...(template.conditions?.include ?? []), ...(template.conditions?.exclude ?? [])];
  if (template.documentKey.endsWith(":primary")) return "Primary fallback template";
  if (!include.length && !legacy.length) return "Not assigned — will not replace the Primary template";
  const labels = include.map((rule) => ruleLabels[rule.type] || rule.type);
  if (legacy.length) labels.push(`${legacy.length} saved URL rule(s)`);
  return `${labels.join(", ")}${exclude.length ? ` · ${exclude.length} exclusion(s)` : ""}`;
}

function compileRules(rows: RuleDraft[]) {
  return rows.flatMap((row): ConditionRule[] => {
    const base = { action: row.action, type: row.type } as ConditionRule;
    if (["selected-page", "selected-post", "selected-custom-post", "selected-category", "selected-tag"].includes(row.type)) {
      return (row.id ? [row.id] : []).map((id) => ({ ...base, id }));
    }
    if (["custom-type-archive", "custom-type-singular"].includes(row.type)) {
      return (row.slug ? [row.slug] : []).map((slug) => ({ ...base, slug }));
    }
    if (row.type === "custom-path") return row.path?.trim() ? [{ ...base, path: row.path.trim() }] : [];
    return [base];
  });
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
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [expandedConditions, setExpandedConditions] = useState<string | null>(null);
  const [conditionRows, setConditionRows] = useState<RuleDraft[]>([]);
  const [savingConditions, setSavingConditions] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [posts, setPosts] = useState<PostOption[]>([]);
  const [categories, setCategories] = useState<NamedOption[]>([]);
  const [tags, setTags] = useState<NamedOption[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentTypeOption[]>([]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/builder/documents?kind=${kind}&view=${view}`, { cache: "no-store" });
      const data = (await response.json()) as ApiResult<{ documents?: TemplateItem[] }>;
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to load templates.");
      setTemplates(Array.isArray(data.documents) ? data.documents : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load templates.");
    } finally {
      setLoading(false);
    }
  }, [kind, view]);

  const loadConditionOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const endpoints = [
        "/api/admin/pages",
        "/api/admin/posts",
        "/api/admin/content-types",
        "/api/admin/posts/taxonomies/categories",
        "/api/admin/posts/taxonomies/tags",
      ];
      const responses = await Promise.all(endpoints.map((url) => fetch(url, { cache: "no-store" })));
      const payloads = await Promise.all(responses.map(async (response) => response.ok ? response.json() as Promise<Record<string, unknown>> : {}));
      const pageOptions = normalizeOptionList<PageOption>(payloads[0], "pages").map((item) => ({ ...item, permalink: typeof item.permalink === "string" ? item.permalink : `/${(item as unknown as { slug?: string }).slug || ""}` }));
      const postOptions = normalizeOptionList<PostOption>(payloads[1], "posts").map((item) => ({ ...item, permalink: typeof item.permalink === "string" ? item.permalink : `/blog/${item.id}` }));
      const typeOptions = normalizeOptionList<ContentTypeOption>(payloads[2], "contentTypes");
      const categoryOptions = normalizeOptionList<NamedOption>(payloads[3], "categories");
      const tagOptions = normalizeOptionList<NamedOption>(payloads[4], "tags");
      const customPostResponses = await Promise.all(typeOptions.map((type) => fetch(`/api/admin/posts?type=${encodeURIComponent(type.slug)}`, { cache: "no-store" })));
      const customPostPayloads = await Promise.all(customPostResponses.map(async (response) => response.ok ? response.json() as Promise<Record<string, unknown>> : {}));
      const customPosts = customPostPayloads.flatMap((payload, index) => normalizeOptionList<PostOption>(payload, "posts").map((item) => ({ ...item, postTypeSlug: typeOptions[index]?.slug ?? null, permalink: typeof item.permalink === "string" ? item.permalink : `/content/${typeOptions[index]?.slug || "content"}/${item.id}` })));
      setPages(pageOptions);
      setPosts([...postOptions, ...customPosts]);
      setContentTypes(typeOptions);
      setCategories(categoryOptions);
      setTags(tagOptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load page and post condition options.");
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);
  useEffect(() => { void loadConditionOptions(); }, [loadConditionOptions]);

  const filtered = useMemo(() => templates.filter((item) =>
    item.title.toLowerCase().includes(search.trim().toLowerCase()) ||
    item.documentKey.toLowerCase().includes(search.trim().toLowerCase())
  ), [templates, search]);

  const openEditor = (item: TemplateItem) => {
    const templateId = item.documentKey.slice(`${kind}:`.length);
    router.push(`${basePath(kind)}?id=${encodeURIComponent(templateId)}`);
  };

  const openCreate = () => {
    setError("");
    setMessage("");
    setNewTitle("");
    setConditionRows([]);
    setShowCreate(true);
  };

  const createTemplate = async () => {
    if (!newTitle.trim()) {
      setError(`Enter a name for the new ${kindLabel(kind).toLowerCase()}.`);
      return;
    }
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
          title: newTitle.trim(),
          status: "DRAFT",
          layout: { version: 1, root: [] },
          settings: {},
          globalStyles: {},
          conditions: { include: [], exclude: [], rules: compileRules(conditionRows) },
          revisionMessage: `Created ${kindLabel(kind).toLowerCase()} template`,
        }),
      });
      const data = (await response.json()) as ApiResult<{ document?: TemplateItem }>;
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to create template.");
      setShowCreate(false);
      setNewTitle("");
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
      const data = (await response.json()) as ApiResult<Record<string, unknown>>;
      if (!response.ok || !data.success) throw new Error(data.message || "Template action failed.");
      setMessage(data.message || "Template updated.");
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template action failed.");
    }
  };

  const openConditions = (template: TemplateItem) => {
    setExpandedConditions((current) => current === template.documentKey ? null : template.documentKey);
    setConditionRows(rulesFromConditions(template.conditions));
  };

  const saveConditions = async (template: TemplateItem) => {
    setSavingConditions(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/builder/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentKey: template.documentKey,
          action: "updateConditions",
          conditions: { include: [], exclude: [], rules: compileRules(conditionRows) },
        }),
      });
      const data = (await response.json()) as ApiResult<Record<string, unknown>>;
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to save display conditions.");
      setMessage("Display conditions saved.");
      setExpandedConditions(null);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save display conditions.");
    } finally {
      setSavingConditions(false);
    }
  };

  const updateRule = (key: string, update: Partial<RuleDraft>) => setConditionRows((rows) => rows.map((row) => row.key === key ? { ...row, ...update } : row));
  const addRule = (action: RuleAction) => setConditionRows((rows) => [...rows, makeRule(action)]);
  const deleteRule = (key: string) => setConditionRows((rows) => rows.filter((row) => row.key !== key));

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "Not updated yet";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not updated yet" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  };

  const conditionData = { pages, posts, categories, tags, contentTypes };

  const renderRule = (row: RuleDraft) => {
    const targets = getRuleTargets(row, conditionData);
    const targetValue = row.type === "custom-type-archive" || row.type === "custom-type-singular" ? row.slug || "" : row.id || "";
    const needsTarget = targets.length > 0 && ["selected-page", "selected-post", "selected-custom-post", "selected-category", "selected-tag", "custom-type-archive", "custom-type-singular"].includes(row.type);
    const selectedOptions = targets.filter((item) => row.type === "custom-type-archive" || row.type === "custom-type-singular" ? item.id === targetValue : item.id === targetValue);
    return (
      <div className={styles.ruleRow} key={row.key}>
        <select aria-label="Include or exclude" value={row.action} onChange={(event) => updateRule(row.key, { action: event.target.value as RuleAction })}>
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
        </select>
        <select aria-label="Display condition" value={row.type} onChange={(event) => updateRule(row.key, { type: event.target.value as RuleType, id: undefined, slug: undefined, path: undefined })}>
          <optgroup label="General"><option value="entire-site">Entire Site</option></optgroup>
          <optgroup label="Singular"><option value="all-pages">All Pages</option><option value="selected-page">Specific Page</option><option value="all-posts">All Posts</option><option value="selected-post">Specific Post</option><option value="all-singular">All Singular (Pages + Posts)</option><option value="all-custom-singular">All Custom Post Entries</option><option value="custom-type-singular">Custom Post Type Entries</option><option value="selected-custom-post">Specific Custom Post</option></optgroup>
          <optgroup label="Archives"><option value="blog-archive">Blog Archive</option><option value="category-archives">All Category Archives</option><option value="selected-category">Specific Category Archive</option><option value="tag-archives">All Tag Archives</option><option value="selected-tag">Specific Tag Archive</option><option value="all-archives">All Archives</option><option value="custom-archives">All Custom Post Type Archives</option><option value="custom-type-archive">Specific Custom Post Type Archive</option></optgroup>
          <optgroup label="Advanced"><option value="custom-path">Custom URL / Pattern</option></optgroup>
        </select>
        {needsTarget && (row.type === "custom-type-archive" || row.type === "custom-type-singular") ? (
          <select aria-label="Select custom post type" value={targetValue} onChange={(event) => updateRule(row.key, { slug: event.target.value })}>
            <option value="">Select content type…</option>
            {targets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        ) : null}
        {needsTarget && !["custom-type-archive", "custom-type-singular"].includes(row.type) ? (
          <select aria-label="Select content" value={targetValue} onChange={(event) => updateRule(row.key, { id: event.target.value })}>
            <option value="">Select…</option>
            {targets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        ) : null}
        {row.type === "custom-path" ? <input aria-label="Custom URL or pattern" value={row.path || ""} onChange={(event) => updateRule(row.key, { path: event.target.value })} placeholder="/about-us or /special/*" /> : null}
        <button type="button" className={styles.removeRule} onClick={() => deleteRule(row.key)} aria-label="Remove condition"><X size={16}/></button>
      </div>
    );
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingCopy}>
          <div className={styles.breadcrumb}>Appearance <span>/</span> {kindLabel(kind)} Builder</div>
          <h1>{kindLabel(kind)} Theme Builder</h1>
          <p>Create templates, design them visually, and decide exactly where each one appears.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => void loadTemplates()} disabled={loading}><RefreshCw size={16}/> Refresh</button>
          {view === "active" && <button type="button" className={styles.primaryButton} onClick={openCreate}><Plus size={17}/> Add New {kindLabel(kind)}</button>}
        </div>
      </header>

      {error && <div className={styles.alertError}><AlertTriangle size={16}/>{error}</div>}
      {message && <div className={styles.alertSuccess}>{message}</div>}

      <section className={styles.toolbar}>
        <div className={styles.tabs}>
          <button type="button" className={view === "active" ? styles.activeTab : ""} onClick={() => setView("active")}>All Templates <span>{view === "active" ? templates.length : ""}</span></button>
          <button type="button" className={view === "trash" ? styles.activeTab : ""} onClick={() => setView("trash")}><Trash2 size={14}/> Trash</button>
        </div>
        <label className={styles.search}><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${kindLabel(kind).toLowerCase()} templates`}/></label>
      </section>

      {loading ? <div className={styles.loadingState}><Loader2 className={styles.spinner} size={22}/> Loading templates…</div> : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          {view === "trash" ? <Archive size={30}/> : <LayoutTemplate size={34}/>}
          <strong>{view === "trash" ? "Trash is empty" : `No ${kindLabel(kind).toLowerCase()} templates yet`}</strong>
          <span>{view === "trash" ? "Templates moved to Trash will appear here." : "Create your first template, then assign it to the pages where it should appear."}</span>
          {view === "active" ? <button type="button" className={styles.primaryButton} onClick={openCreate}><Plus size={16}/> Create {kindLabel(kind)}</button> : null}
        </div>
      ) : (
        <section className={styles.templateGrid}>
          {filtered.map((template) => {
            const isTrash = view === "trash";
            return (
              <article className={styles.card} key={template.documentKey}>
                <div className={styles.cardHeading}>
                  <div className={styles.cardIcon}>{kind === "header" ? <Globe size={20}/> : <FileText size={20}/>}</div>
                  <div className={styles.cardTitle}><h2>{template.title}</h2><code>{template.documentKey}</code></div>
                  <span className={`${styles.status} ${template.status === "PUBLISHED" ? styles.published : isTrash ? styles.trashed : styles.draft}`}>{isTrash ? "TRASH" : template.status}</span>
                </div>
                <div className={styles.conditionSummary}><span>DISPLAY CONDITIONS</span><strong>{conditionSummary(template)}</strong></div>
                <div className={styles.cardMeta}>Last updated: {formatDate(template.updatedAt)}</div>

                {!isTrash && expandedConditions === template.documentKey ? (
                  <div className={styles.conditionEditor}>
                    <div className={styles.conditionEditorHeader}><div><strong>Display Conditions</strong><p>Choose where this template is included or excluded.</p></div><button type="button" onClick={() => setExpandedConditions(null)} aria-label="Close conditions"><X size={17}/></button></div>
                    {optionsLoading ? <div className={styles.optionsLoading}>Loading pages, posts and archives…</div> : null}
                    <div className={styles.conditionRows}>{conditionRows.map(renderRule)}</div>
                    <div className={styles.conditionAddActions}><button type="button" onClick={() => addRule("include")}><Plus size={14}/> Add Include Condition</button><button type="button" onClick={() => addRule("exclude")}><Plus size={14}/> Add Exclude Condition</button></div>
                    <div className={styles.conditionFooter}><span>{conditionRows.length} condition(s) · More specific matches override the Primary fallback.</span><div><button type="button" className={styles.secondaryButton} onClick={() => setExpandedConditions(null)}>Cancel</button><button type="button" className={styles.primaryButton} onClick={() => void saveConditions(template)} disabled={savingConditions || optionsLoading}>{savingConditions ? "Saving…" : "Save Conditions"}</button></div></div>
                  </div>
                ) : null}

                <div className={styles.cardActions}>
                  {isTrash ? (
                    <><button type="button" className={styles.restoreButton} onClick={() => void runAction(template, "restoreFromTrash")}><RotateCcw size={15}/> Restore</button><button type="button" className={styles.dangerButton} onClick={() => void runAction(template, "permanentlyDelete")}><Trash2 size={15}/> Delete permanently</button></>
                  ) : (
                    <><button type="button" className={styles.primaryButton} onClick={() => openEditor(template)}><Pencil size={15}/> Edit in Builder</button><button type="button" className={styles.secondaryButton} onClick={() => openConditions(template)}><ShieldCheck size={15}/> Display Conditions <ChevronDown size={14}/></button><button type="button" className={styles.dangerButton} onClick={() => void runAction(template, "moveToTrash")}><Trash2 size={15}/> Move to Trash</button></>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className={styles.helpNote}><ShieldCheck size={15}/> The Primary template is used as a fallback. Other templates appear only where their Display Conditions match and their status is Published.</div>

      {showCreate ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
          <section className={styles.createModal} role="dialog" aria-modal="true" aria-labelledby="create-template-title">
            <div className={styles.modalHeader}><div><span className={styles.modalEyebrow}>THEME BUILDER</span><h2 id="create-template-title">Create {kindLabel(kind)} Template</h2><p>Name the template and choose where it should appear, just like a Theme Builder display condition.</p></div><button type="button" onClick={() => setShowCreate(false)} aria-label="Close"><X size={19}/></button></div>
            <label className={styles.fieldLabel}>Template Name<input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createTemplate(); }} placeholder={`${kindLabel(kind)} — About Us`} maxLength={255}/></label>
            <div className={styles.createConditionPanel}>
              <div className={styles.createConditionHeading}>
                <div><strong>Display Conditions</strong><p>For example: Entire Site, All Pages, a specific Page or Post, or an Archive.</p></div>
                <span>{conditionRows.length} rule(s)</span>
              </div>
              {optionsLoading ? <div className={styles.optionsLoading}>Loading available pages, posts and archives…</div> : null}
              {conditionRows.length ? <div className={styles.conditionRows}>{conditionRows.map(renderRule)}</div> : <div className={styles.noCreateConditions}>No conditions added yet. This template will remain unassigned until you add an Include condition.</div>}
              <div className={styles.conditionAddActions}>
                <button type="button" onClick={() => addRule("include")}><Plus size={14}/> Add Include Condition</button>
                <button type="button" onClick={() => addRule("exclude")}><Plus size={14}/> Add Exclude Condition</button>
              </div>
            </div>
            <div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={() => setShowCreate(false)}>Cancel</button><button type="button" className={styles.primaryButton} onClick={() => void createTemplate()} disabled={creating || !newTitle.trim()}>{creating ? <Loader2 className={styles.spinner} size={15}/> : <Plus size={16}/>} Create and Open Builder <ArrowUpRight size={14}/></button></div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
