"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { FORM_FIELD_TYPES, type FormField } from "@/lib/forms";
import styles from "./PostsAdmin.module.css";

type FormRecord = {
  id: string; title: string; slug: string; description: string | null;
  fields: unknown; status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  deletedAt: string | null; updatedAt: string; _count?: { submissions: number };
};
type Lead = {
  id: string; formId: string; data: unknown; status: "UNREAD" | "READ" | "SPAM";
  deletedAt: string | null; createdAt: string; form: { id: string; title: string; slug: string; fields?: unknown };
};
type ApiResult = { success?: boolean; message?: string; forms?: FormRecord[]; submissions?: Lead[]; form?: FormRecord; submission?: Lead; count?: number };
type FieldDraft = FormField & { optionsText: string };
const button: React.CSSProperties = { border: "1px solid #d5deea", borderRadius: 6, padding: "8px 11px", background: "#fff", color: "#24364b", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const primary: React.CSSProperties = { ...button, borderColor: "#0c2f55", background: "#0c2f55", color: "#fff" };
const input: React.CSSProperties = { width: "100%", border: "1px solid #ccd5e0", borderRadius: 6, padding: "9px 10px", font: "inherit", fontSize: 14 };
const cell: React.CSSProperties = { padding: "13px 15px", borderBottom: "1px solid #edf0f4", textAlign: "left", verticalAlign: "middle" };

function toFieldDrafts(value: unknown): FieldDraft[] {
  if (!Array.isArray(value)) return [];
  return value.filter((field): field is FormField => Boolean(field) && typeof field === "object" && typeof field.id === "string" && typeof field.label === "string" && typeof field.type === "string")
    .map((field) => ({ ...field, optionsText: (field.options ?? []).join("\n") }));
}

export default function FormsManager({ role }: { role: string }) {
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const [section, setSection] = useState<"forms" | "leads">("forms");
  const [trash, setTrash] = useState(false);
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<FormRecord | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<FormRecord["status"]>("DRAFT");
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [formResponse, leadResponse] = await Promise.all([
        fetch(`/api/admin/forms${trash ? "?trash=1" : ""}`, { cache: "no-store" }),
        fetch(`/api/admin/forms/submissions${trash ? "?trash=1" : ""}`, { cache: "no-store" }),
      ]);
      const [formData, leadData] = await Promise.all([formResponse.json(), leadResponse.json()]) as [ApiResult, ApiResult];
      if (!formResponse.ok || !formData.success) throw new Error(formData.message || "Unable to load forms.");
      if (!leadResponse.ok || !leadData.success) throw new Error(leadData.message || "Unable to load submissions.");
      setForms(formData.forms ?? []);
      setLeads(leadData.submissions ?? []);
      setSelected([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Forms & Leads.");
    } finally {
      setLoading(false);
    }
  }, [trash]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function request(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json() as ApiResult;
    if (!response.ok || !result.success) throw new Error(result.message || "The operation failed.");
    return result;
  }
  function startCreate() {
    setEditing(null); setTitle(""); setSlug(""); setDescription(""); setStatus("DRAFT"); setFields([]); setError(""); setNotice("");
  }
  function startEdit(form: FormRecord) {
    setEditing(form); setTitle(form.title); setSlug(form.slug); setDescription(form.description ?? ""); setStatus(form.status); setFields(toFieldDrafts(form.fields)); setError(""); setNotice("");
  }
  async function saveForm(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const payload = {
        title, slug, description, status,
        fields: fields.map(({ optionsText, ...field }) => ({ ...field, options: optionsText.split("\n").map((item) => item.trim()).filter(Boolean) })),
      };
      await request(editing ? `/api/admin/forms/${editing.id}` : "/api/admin/forms", editing ? "PATCH" : "POST", payload);
      setEditing(undefined); setNotice("Form saved."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save form."); }
    finally { setBusy(false); }
  }
  async function operate(url: string, ids: string[], action: string) {
    if (!ids.length) return;
    if (
      url === "/api/admin/forms/bulk" &&
      action === "PERMANENT_DELETE" &&
      !window.confirm(
        `Permanently delete ${ids.length} selected form(s) and their submissions? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      if (url.endsWith("/bulk")) await request(url, "POST", { ids, action });
      else {
        const isFormStatusUpdate = !url.includes("/submissions/") && !["TRASH", "RESTORE"].includes(action);
        await request(url, "PATCH", isFormStatusUpdate ? { status: action } : { action });
      }
      setNotice("Changes saved."); setSelected([]); setActiveLead(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save changes."); }
    finally { setBusy(false); }
  }
  async function viewLead(lead: Lead) {
    setActiveLead(lead);
    try {
      const response = await fetch(`/api/admin/forms/submissions/${lead.id}`, { cache: "no-store" });
      const result = await response.json() as ApiResult;
      if (!response.ok || !result.success || !result.submission) throw new Error(result.message || "Unable to load submission.");
      setActiveLead(result.submission);
      if (lead.status === "UNREAD" && !lead.deletedAt) {
        setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status: "READ" } : item));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load submission.");
    }
  }
  function addField() {
    const id = `field_${Math.random().toString(36).slice(2, 9)}`;
    setFields((current) => [...current, { id, label: "New field", type: "text", required: false, optionsText: "" }]);
  }
  function updateField(index: number, patch: Partial<FieldDraft>) {
    setFields((current) => current.map((field, position) => position === index ? { ...field, ...patch } : field));
  }

  const formsView = (
    <>
      <div className={styles.toolbar}>
        <div className={styles.actions}>
        <button className={styles.primaryButton} onClick={startCreate}><Plus size={15} />New form</button>
        <button className={styles.button} onClick={() => setTrash((value) => !value)}>{trash ? "Active forms" : "Trash"}</button>
        {selected.length > 0 && !trash && <>
          <button className={styles.button} disabled={busy} onClick={() => void operate("/api/admin/forms/bulk", selected, "PUBLISH")}>Publish</button>
          <button className={styles.button} disabled={busy} onClick={() => void operate("/api/admin/forms/bulk", selected, "DRAFT")}>Set draft</button>
          <button className={styles.button} disabled={busy} onClick={() => void operate("/api/admin/forms/bulk", selected, "ARCHIVE")}>Archive</button>
          {isAdmin && <button className={styles.dangerButton} disabled={busy} onClick={() => void operate("/api/admin/forms/bulk", selected, "TRASH")}>Move selected to Trash</button>}
        </>}
        {selected.length > 0 && trash && <>
          <button className={styles.button} disabled={busy} onClick={() => void operate("/api/admin/forms/bulk", selected, "RESTORE")}>Restore selected</button>
          {isAdmin && <button className={styles.dangerButton} disabled={busy} onClick={() => void operate("/api/admin/forms/bulk", selected, "PERMANENT_DELETE")}>Delete permanently</button>}
        </>}
        </div>
      </div>
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead><tr><th className={styles.checkboxCell}><input aria-label="Select all forms" type="checkbox" checked={forms.length > 0 && selected.length === forms.length} onChange={(event) => setSelected(event.target.checked ? forms.map((form) => form.id) : [])} /></th><th>Form</th><th>Status</th><th>Leads</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>{forms.map((form) => <tr key={form.id}>
            <td className={styles.checkboxCell}><input aria-label={`Select ${form.title}`} type="checkbox" checked={selected.includes(form.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, form.id] : current.filter((id) => id !== form.id))} /></td>
            <td style={cell}><strong>{form.title}</strong><div style={{ color: "#718096", fontSize: 12 }}>/forms/{form.slug}</div></td>
            <td style={cell}><span className={`${styles.badge} ${form.status === "PUBLISHED" ? styles.badgePublished : ""}`}>{trash ? "TRASH" : form.status}</span></td><td style={cell}>{form._count?.submissions ?? 0}</td><td style={cell}>{new Date(form.updatedAt).toLocaleDateString()}</td>
            <td style={cell}><div className={styles.actions}>
              {!trash && <><button className={styles.linkButton} onClick={() => startEdit(form)}>Edit</button><button className={styles.linkButton} onClick={() => void operate(`/api/admin/forms/${form.id}`, [form.id], form.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")}>{form.status === "PUBLISHED" ? "Unpublish" : "Publish"}</button><button className={styles.linkButton} onClick={() => void operate(`/api/admin/forms/${form.id}`, [form.id], form.status === "ARCHIVED" ? "DRAFT" : "ARCHIVED")}>{form.status === "ARCHIVED" ? "Unarchive" : "Archive"}</button><a className={styles.linkButton} href={`/forms/${encodeURIComponent(form.slug)}`} target="_blank" rel="noreferrer">View <ExternalLink size={13} /></a>{isAdmin && <button className={styles.linkButton} onClick={() => void operate(`/api/admin/forms/${form.id}`, [form.id], "TRASH")}>Trash</button>}</>}
              {trash && <><button className={styles.linkButton} onClick={() => void operate(`/api/admin/forms/${form.id}`, [form.id], "RESTORE")}>Restore</button>{isAdmin && <button className={`${styles.linkButton} ${styles.rowActionDanger}`} onClick={() => void operate("/api/admin/forms/bulk", [form.id], "PERMANENT_DELETE")}>Delete permanently</button>}</>}
            </div></td>
          </tr>)}
          {!forms.length && <tr><td style={{ ...cell, padding: 28, color: "#718096" }} colSpan={6}>No {trash ? "deleted" : ""} forms found.</td></tr>}</tbody>
        </table>
      </div>
    </>
  );
  const leadsView = (
    <>
      <div className={styles.toolbar}>
        <div className={styles.actions}>
        <button className={styles.button} onClick={() => setTrash((value) => !value)}>{trash ? "Active leads" : "Trash"}</button>
        {selected.length > 0 && !trash && <>
          <button className={styles.button} disabled={busy} onClick={() => void operate("/api/admin/forms/submissions/bulk", selected, "READ")}>Mark read</button>
          <button className={styles.button} disabled={busy} onClick={() => void operate("/api/admin/forms/submissions/bulk", selected, "SPAM")}>Mark spam</button>
          {isAdmin && <button className={styles.dangerButton} disabled={busy} onClick={() => void operate("/api/admin/forms/submissions/bulk", selected, "TRASH")}>Delete selected</button>}
        </>}
        {selected.length > 0 && trash && <button className={styles.button} disabled={busy} onClick={() => void operate("/api/admin/forms/submissions/bulk", selected, "RESTORE")}>Restore selected</button>}
        </div>
      </div>
      <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e5eaf1", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ background: "#f7f9fc" }}><th style={cell}><input aria-label="Select all submissions" type="checkbox" checked={leads.length > 0 && selected.length === leads.length} onChange={(event) => setSelected(event.target.checked ? leads.map((lead) => lead.id) : [])} /></th><th style={cell}>Form</th><th style={cell}>Status</th><th style={cell}>Received</th><th style={cell}>Actions</th></tr></thead>
          <tbody>{leads.map((lead) => <tr key={lead.id} style={{ background: lead.status === "UNREAD" ? "#f8fbff" : "#fff" }}>
            <td style={cell}><input aria-label={`Select lead ${lead.id}`} type="checkbox" checked={selected.includes(lead.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, lead.id] : current.filter((id) => id !== lead.id))} /></td>
            <td style={cell}><button onClick={() => void viewLead(lead)} style={{ ...button, border: 0, padding: 0, color: "#0c2f55" }}>{lead.form.title} <span style={{ color: "#718096" }}>· {lead.id.slice(-8)}</span></button></td><td style={cell}>{lead.deletedAt ? "TRASH" : lead.status}</td><td style={cell}>{new Date(lead.createdAt).toLocaleString()}</td>
            <td style={cell}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {!trash && <><button style={button} onClick={() => void viewLead(lead)}>View</button><button style={button} onClick={() => void operate(`/api/admin/forms/submissions/${lead.id}`, [lead.id], lead.status === "SPAM" ? "UNREAD" : "SPAM")}>{lead.status === "SPAM" ? "Not spam" : "Spam"}</button>{isAdmin && <button style={button} onClick={() => void operate(`/api/admin/forms/submissions/${lead.id}`, [lead.id], "TRASH")}>Delete</button>}</>}
              {trash && <button style={button} onClick={() => void operate(`/api/admin/forms/submissions/${lead.id}`, [lead.id], "RESTORE")}>Restore</button>}
            </div></td>
          </tr>)}
          {!leads.length && <tr><td style={{ ...cell, padding: 28, color: "#718096" }} colSpan={5}>No {trash ? "deleted" : ""} submissions found.</td></tr>}</tbody>
        </table>
      </div>
    </>
  );

  return (
    <main className={styles.page} style={{ padding: "8px 0 32px" }}>
      <header className={styles.header}>
        <div><h1 style={{ margin: "4px 0 6px", fontSize: 26 }}>Forms &amp; Leads</h1><p style={{ margin: 0, color: "#718096" }}>Create public forms and manage their submissions.</p></div>
        <button className={styles.button} disabled={busy} onClick={() => void load()}><RefreshCw size={14} />Refresh</button>
      </header>
      {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || notice}</p>}
      {busy && <p aria-live="polite" className={styles.muted}>Saving…</p>}
      <nav className={styles.toolbar}>
        <div className={styles.filters}>
        {(["forms", "leads"] as const).map((value) => <button type="button" className={`${styles.filter} ${section === value ? styles.filterActive : ""}`} key={value} onClick={() => { setSection(value); setSelected([]); setTrash(false); }} style={{ textTransform: "capitalize" }}>{value}</button>)}
        </div>
      </nav>
      {loading ? <p role="status" className={styles.muted}>Loading forms and submissions…</p> : section === "forms" ? formsView : leadsView}

      {editing !== undefined && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(undefined); }} style={{ position: "fixed", zIndex: 300, inset: 0, background: "#12243a88", overflow: "auto", padding: 24 }}>
        <form onSubmit={saveForm} style={{ maxWidth: 760, margin: "30px auto", background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 16px 50px #10243b33" }}>
          <h2 style={{ margin: "0 0 20px" }}>{editing ? "Edit form" : "Create form"}</h2>
          <label style={{ display: "block", marginBottom: 14 }}>Title<input style={{ ...input, marginTop: 6 }} required value={title} onChange={(event) => { setTitle(event.target.value); if (!editing) setSlug(event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></label>
          <label style={{ display: "block", marginBottom: 14 }}>Public URL slug<input style={{ ...input, marginTop: 6 }} required value={slug} onChange={(event) => setSlug(event.target.value)} /></label>
          <label style={{ display: "block", marginBottom: 14 }}>Description<textarea style={{ ...input, marginTop: 6, minHeight: 75 }} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label style={{ display: "block", marginBottom: 14 }}>Status<select style={{ ...input, marginTop: 6 }} value={status} onChange={(event) => setStatus(event.target.value as FormRecord["status"])}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 10px" }}><h3 style={{ margin: 0 }}>Fields</h3><button type="button" style={button} onClick={addField}>Add field</button></div>
          {fields.map((field, index) => <fieldset key={field.id} style={{ border: "1px solid #e5eaf1", borderRadius: 8, margin: "10px 0", padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
              <input aria-label="Field label" style={input} value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
              <select aria-label="Field type" style={input} value={field.type} onChange={(event) => updateField(index, { type: event.target.value })}>{FORM_FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
              <button type="button" aria-label="Remove field" style={button} onClick={() => setFields((current) => current.filter((_, position) => position !== index))}><Trash2 size={15} /></button>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center" }}>
              <label style={{ whiteSpace: "nowrap" }}><input type="checkbox" checked={field.required ?? false} onChange={(event) => updateField(index, { required: event.target.checked })} /> Required</label>
              <input style={input} placeholder="Placeholder / checkbox label" value={field.placeholder ?? ""} onChange={(event) => updateField(index, { placeholder: event.target.value })} />
            </div>
            {["dropdown", "multi-select", "radio", "multiple-choice"].includes(field.type) && <textarea aria-label="Options" style={{ ...input, marginTop: 10, minHeight: 70 }} placeholder={"Options (one per line)\nOption one\nOption two"} value={field.optionsText} onChange={(event) => updateField(index, { optionsText: event.target.value })} />}
          </fieldset>)}
          {!fields.length && <p style={{ color: "#718096" }}>Add fields to build your form.</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}><button type="button" style={button} onClick={() => setEditing(undefined)}>Cancel</button><button type="submit" style={primary} disabled={busy}>{busy ? "Saving…" : "Save form"}</button></div>
        </form>
      </div>}
      {activeLead && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveLead(null); }} style={{ position: "fixed", zIndex: 301, inset: 0, background: "#12243a88", overflow: "auto", padding: 24 }}>
        <section role="dialog" aria-modal="true" aria-labelledby="lead-title" style={{ maxWidth: 720, margin: "30px auto", background: "#fff", borderRadius: 12, padding: 24 }}>
          <h2 id="lead-title" style={{ marginTop: 0 }}>{activeLead.form.title} response</h2><p style={{ color: "#718096" }}>{new Date(activeLead.createdAt).toLocaleString()} · {activeLead.status}</p>
          {(() => {
            const data = activeLead.data && typeof activeLead.data === "object" && !Array.isArray(activeLead.data) ? activeLead.data as Record<string, unknown> : {};
            const uploads = Array.isArray(data._files) ? data._files as Array<{ fieldId?: string; url?: string; name?: string; size?: number }> : [];
            const formFields = Array.isArray(activeLead.form.fields) ? activeLead.form.fields as Array<{ id?: string; label?: string }> : [];
            return <>
              {Object.entries(data).filter(([key]) => key !== "_files").map(([key, value]) => <div key={key} style={{ padding: "11px 0", borderBottom: "1px solid #edf0f4" }}><strong style={{ display: "block", marginBottom: 4 }}>{formFields.find((field) => field.id === key)?.label ?? key}</strong><span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{Array.isArray(value) ? value.join(", ") : String(value ?? "—")}</span></div>)}
              {uploads.map((file, index) => <p key={`${file.name}-${index}`}><a href={file.url} target="_blank" rel="noreferrer" download>Download {file.name ?? "attachment"} ({Math.ceil((file.size ?? 0) / 1024)} KB)</a></p>)}
            </>;
          })()}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}><button style={button} onClick={() => setActiveLead(null)}>Close</button><button style={primary} onClick={() => void operate(`/api/admin/forms/submissions/${activeLead.id}`, [activeLead.id], "SPAM")}>Mark spam</button></div>
        </section>
      </div>}
    </main>
  );
}
