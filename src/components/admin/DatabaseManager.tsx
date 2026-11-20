"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Database,
  FileText,
  Newspaper,
  FolderTree,
  Tag,
  Images,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  RotateCcw,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import styles from "./DatabaseManager.module.css";

type TableKey = "pages" | "posts" | "categories" | "tags" | "media";
type View = "active" | "trash";
type DbRecord = Record<string, unknown> & { id: string };
type TableInfo = { key: TableKey; label: string; count: number; canTrash: boolean };
type ApiResponse<T = Record<string, unknown>> = { success?: boolean; message?: string } & T;
type FieldDefinition = {
  key: string;
  label: string;
  multiline?: boolean;
  options?: { value: string; label: string }[];
};

const tableDefinitions: {
  key: TableKey;
  label: string;
  description: string;
  icon: typeof FileText;
  columns: { key: string; label: string }[];
  fields: FieldDefinition[];
  canTrash: boolean;
}[] = [
  {
    key: "pages",
    label: "Pages",
    description: "Page titles, URLs, publishing status and SEO metadata.",
    icon: FileText,
    canTrash: true,
    columns: [
      { key: "title", label: "Title" },
      { key: "slug", label: "Slug" },
      { key: "status", label: "Status" },
      { key: "updatedAt", label: "Updated" },
    ],
    fields: [
      { key: "title", label: "Title" },
      { key: "slug", label: "Slug" },
      { key: "description", label: "Description", multiline: true },
      { key: "status", label: "Status", options: [
        { value: "DRAFT", label: "Draft" },
        { value: "REVIEW", label: "Review" },
        { value: "PUBLISHED", label: "Published" },
        { value: "ARCHIVED", label: "Archived" },
      ] },
      { key: "seoTitle", label: "SEO Title" },
      { key: "seoDescription", label: "SEO Description", multiline: true },
      { key: "canonicalUrl", label: "Canonical URL" },
      { key: "focusKeyword", label: "Focus Keyword" },
      { key: "metaRobots", label: "Meta Robots" },
    ],
  },
  {
    key: "posts",
    label: "Posts",
    description: "Blog posts and custom post metadata.",
    icon: Newspaper,
    canTrash: true,
    columns: [
      { key: "title", label: "Title" },
      { key: "slug", label: "Slug" },
      { key: "status", label: "Status" },
      { key: "updatedAt", label: "Updated" },
    ],
    fields: [
      { key: "title", label: "Title" },
      { key: "slug", label: "Slug" },
      { key: "excerpt", label: "Excerpt", multiline: true },
      { key: "status", label: "Status", options: [
        { value: "DRAFT", label: "Draft" },
        { value: "REVIEW", label: "Review" },
        { value: "PUBLISHED", label: "Published" },
        { value: "ARCHIVED", label: "Archived" },
      ] },
      { key: "featuredImage", label: "Featured Image Path" },
      { key: "seoTitle", label: "SEO Title" },
      { key: "seoDescription", label: "SEO Description", multiline: true },
      { key: "focusKeyword", label: "Focus Keyword" },
    ],
  },
  {
    key: "categories",
    label: "Categories",
    description: "Blog categories. A category linked to posts cannot be deleted here.",
    icon: FolderTree,
    canTrash: false,
    columns: [
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "_count", label: "Linked posts" },
      { key: "updatedAt", label: "Updated" },
    ],
    fields: [
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "description", label: "Description", multiline: true },
      { key: "imageUrl", label: "Image URL" },
    ],
  },
  {
    key: "tags",
    label: "Tags",
    description: "Blog tags. A tag linked to posts cannot be deleted here.",
    icon: Tag,
    canTrash: false,
    columns: [
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "_count", label: "Linked posts" },
      { key: "updatedAt", label: "Updated" },
    ],
    fields: [
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "imageUrl", label: "Image URL" },
    ],
  },
  {
    key: "media",
    label: "Media Library",
    description: "Media metadata such as filename, Alt Text, title and caption.",
    icon: Images,
    canTrash: true,
    columns: [
      { key: "originalName", label: "File" },
      { key: "mimeType", label: "Type" },
      { key: "title", label: "Title" },
      { key: "updatedAt", label: "Updated" },
    ],
    fields: [
      { key: "altText", label: "Alt Text" },
      { key: "title", label: "Title" },
      { key: "caption", label: "Caption" },
      { key: "description", label: "Description", multiline: true },
    ],
  },
];

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleString("en-IN");
  if (typeof value === "object") {
    const object = value as { posts?: number };
    if (typeof object.posts === "number") return String(object.posts);
    return JSON.stringify(value);
  }
  return String(value);
}

export default function DatabaseManager() {
  const [table, setTable] = useState<TableKey>("pages");
  const [view, setView] = useState<View>("active");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [rows, setRows] = useState<DbRecord[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<DbRecord | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const definition = useMemo(
    () => tableDefinitions.find((item) => item.key === table) || tableDefinitions[0],
    [table]
  );

  const loadTables = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/database", { cache: "no-store" });
      const result = (await response.json()) as ApiResponse<{ tables?: TableInfo[] }>;
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to load database tables.");
      setTables(Array.isArray(result.tables) ? result.tables : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load database tables.");
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ table, view, page: String(page) });
      if (search) query.set("search", search);
      const response = await fetch(`/api/admin/database?${query.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as ApiResponse<{ rows?: DbRecord[]; total?: number }>;
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to load database records.");
      setRows(Array.isArray(result.rows) ? result.rows : []);
      setTotal(Number(result.total) || 0);
    } catch (reason) {
      setRows([]);
      setTotal(0);
      setError(reason instanceof Error ? reason.message : "Unable to load database records.");
    } finally {
      setLoading(false);
    }
  }, [table, view, page, search]);

  useEffect(() => { void loadTables(); }, [loadTables]);
  useEffect(() => { void loadRows(); }, [loadRows]);

  const openEdit = (row: DbRecord) => {
    const values: Record<string, string> = {};
    for (const field of definition.fields) values[field.key] = asText(row[field.key]);
    setFormValues(values);
    setEditing(row);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/database", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id: editing.id, data: formValues }),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to update record.");
      setEditing(null);
      setNotice("Record updated successfully.");
      await Promise.all([loadRows(), loadTables()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update record.");
    } finally {
      setBusy(false);
    }
  };

  const deleteRecord = async (row: DbRecord, permanent = false) => {
    const label = asText(row.title || row.name || row.originalName || row.slug || row.id);
    const permanentAction = permanent || !definition.canTrash;
    const extra = table === "media" && permanentAction
      ? " This removes the Media Library database record only; the stored file is not deleted from storage."
      : "";
    const question = permanentAction
      ? `Permanently delete “${label}” from the database? This cannot be undone.${extra}`
      : `Move “${label}” to Trash?`;
    if (!window.confirm(question)) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/database", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id: row.id, permanent: permanentAction }),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to delete record.");
      setNotice(result.message || "Record updated.");
      await Promise.all([loadRows(), loadTables()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete record.");
    } finally {
      setBusy(false);
    }
  };

  const restoreRecord = async (row: DbRecord) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", table, id: row.id }),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to restore record.");
      setNotice(result.message || "Record restored.");
      await Promise.all([loadRows(), loadTables()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to restore record.");
    } finally {
      setBusy(false);
    }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const changeTable = (next: TableKey) => {
    setTable(next);
    setView("active");
    setPage(1);
    setSearch("");
    setSearchInput("");
    setEditing(null);
    setNotice("");
  };

  const pagesTotal = Math.max(1, Math.ceil(total / 25));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}><Database size={15} /> SYSTEM / DATABASE</div>
          <h1>Database Manager</h1>
          <p>Inspect and safely manage editable Connect CMS content records.</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => { void loadTables(); void loadRows(); }} disabled={loading || busy}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <div className={styles.noticeBar}>
        <ShieldCheck size={18} />
        <span>Protected system data such as user password hashes, OTPs, payment secrets, revisions and internal relation tables cannot be edited here. Use their dedicated CMS managers.</span>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}

      <section className={styles.tableCards} aria-label="Database tables">
        {tableDefinitions.map((item) => {
          const Icon = item.icon;
          const count = tables.find((tableInfo) => tableInfo.key === item.key)?.count ?? 0;
          return (
            <button
              type="button"
              key={item.key}
              className={`${styles.tableCard} ${table === item.key ? styles.tableCardActive : ""}`}
              onClick={() => changeTable(item.key)}
            >
              <span className={styles.tableIcon}><Icon size={19} /></span>
              <span className={styles.tableCardText}><strong>{item.label}</strong><small>{item.description}</small></span>
              <span className={styles.tableCount}>{count}</span>
            </button>
          );
        })}
      </section>

      <section className={styles.recordsPanel}>
        <div className={styles.recordsHeader}>
          <div>
            <h2>{definition.label}</h2>
            <p>{total} {total === 1 ? "record" : "records"} {view === "trash" ? "in Trash" : "in this table"}</p>
          </div>
          <form className={styles.searchForm} onSubmit={submitSearch}>
            <Search size={17} />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={`Search ${definition.label.toLowerCase()}…`} />
            <button type="submit">Search</button>
          </form>
        </div>

        {definition.canTrash && (
          <div className={styles.viewTabs}>
            <button type="button" className={view === "active" ? styles.activeView : ""} onClick={() => { setView("active"); setPage(1); }}>Active</button>
            <button type="button" className={view === "trash" ? styles.activeView : ""} onClick={() => { setView("trash"); setPage(1); }}>Trash</button>
          </div>
        )}

        {loading ? (
          <div className={styles.empty}>Loading records…</div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>No records found in this view.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.recordsTable}>
              <thead>
                <tr>
                  {definition.columns.map((column) => <th key={column.key}>{column.label}</th>)}
                  <th className={styles.actionsHeading}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {definition.columns.map((column) => (
                      <td key={column.key}>
                        {column.key === "status" ? (
                          <span className={`${styles.status} ${styles[`status${asText(row.status)}`] || ""}`}>{asText(row.status)}</span>
                        ) : column.key === "_count" ? (
                          asText(row._count)
                        ) : column.key === "updatedAt" ? (
                          asText(row.updatedAt ? new Date(String(row.updatedAt)) : "—")
                        ) : (
                          <span className={styles.cellText} title={asText(row[column.key])}>{asText(row[column.key]) || "—"}</span>
                        )}
                      </td>
                    ))}
                    <td>
                      <div className={styles.rowActions}>
                        {view === "trash" ? (
                          <>
                            <button type="button" className={styles.restoreButton} onClick={() => void restoreRecord(row)} disabled={busy}><RotateCcw size={15} /> Restore</button>
                            <button type="button" className={styles.deleteButton} onClick={() => void deleteRecord(row, true)} disabled={busy} title="Permanently delete"><Trash2 size={15} /></button>
                          </>
                        ) : (
                          <>
                            <button type="button" className={styles.editButton} onClick={() => openEdit(row)}><Pencil size={15} /> Edit</button>
                            <button type="button" className={styles.deleteButton} onClick={() => void deleteRecord(row)} disabled={busy} title={definition.canTrash ? "Move to Trash" : "Delete"}><Trash2 size={15} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className={styles.pagination}>
          <span>Page {page} of {pagesTotal}</span>
          <div>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}><ChevronLeft size={16} /> Previous</button>
            <button type="button" onClick={() => setPage((current) => Math.min(pagesTotal, current + 1))} disabled={page >= pagesTotal || loading}>Next <ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>

      {editing && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <form className={styles.editModal} onSubmit={saveRecord}>
            <header>
              <div><span>Edit database record</span><h2>{asText(editing.title || editing.name || editing.originalName || editing.slug || editing.id)}</h2></div>
              <button type="button"
                className={styles.modalClose}
                onClick={() => setEditing(null)}
                aria-label="Close editor"
              ><X size={19} /></button>
            </header>
            <div className={styles.formGrid}>
              {definition.fields.map((field) => (
                <label key={field.key} className={field.multiline ? styles.formFieldWide : styles.formField}>
                  <span>{field.label}</span>
                  {field.options ? (
                    <select
                      value={formValues[field.key] || ""}
                      onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    >
                      {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : field.multiline ? (
                    <textarea
                      rows={4}
                      value={formValues[field.key] || ""}
                      onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  ) : (
                    <input
                      value={formValues[field.key] || ""}
                      onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
            <footer>
              <button type="button" className={styles.cancelButton} onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className={styles.saveButton} disabled={busy}><Save size={16} /> {busy ? "Saving…" : "Save Changes"}</button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
