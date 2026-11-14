"use client";

import { useState } from "react";
import type { FormField } from "@/lib/forms";

type Props = { title: string; description: string; fields: FormField[]; styles: unknown; slug: string };

export default function PublicForm({ title, description, fields, styles, slug }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const look = styles && typeof styles === "object" ? styles as Record<string, unknown> : {};
  const setValue = (id: string, value: unknown) => setValues((current) => ({ ...current, [id]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const body = new FormData();
      body.set("data", JSON.stringify(values));
      body.set("_website", String(new FormData(event.currentTarget).get("_website") ?? ""));
      for (const [fieldId, selectedFiles] of Object.entries(files)) {
        for (const file of selectedFiles) body.append(`file:${fieldId}`, file);
      }
      const response = await fetch(`/api/public/forms/${encodeURIComponent(slug)}/submit`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to submit the form.");
      setComplete(true);
      setMessage(result.message || "Thank you. Your response has been received.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit the form.");
    } finally {
      setLoading(false);
    }
  }

  const labelStyle = { display: "block", marginBottom: 7, fontWeight: 600, fontSize: 14 };
  const inputStyle = { width: "100%", padding: "11px 12px", border: "1px solid #ccd5e0", borderRadius: 7, font: "inherit", background: "#fff" };
  const primaryColor = typeof look.primaryColor === "string" ? look.primaryColor : "#0c2f55";
  if (complete) return <section className="public-form-card" role="status"><h1>{title}</h1><p>{message}</p></section>;

  return (
    <section className="public-form-card" style={{ maxWidth: 720, margin: "48px auto", padding: 32, borderRadius: 12, background: "#fff", boxShadow: "0 8px 36px #152b4512", color: "#19283a" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 30 }}>{title}</h1>
      {description && <p style={{ margin: "0 0 26px", color: "#637286", lineHeight: 1.65 }}>{description}</p>}
      <form onSubmit={submit}>
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor="website-address">Leave this field empty</label>
          <input id="website-address" name="_website" tabIndex={-1} autoComplete="off" />
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          {fields.map((field) => {
            const common = { id: field.id, name: field.id, required: field.required, placeholder: field.placeholder, style: inputStyle, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValue(field.id, event.target.value) };
            const opts = field.options ?? [];
            return (
              <div key={field.id}>
                <label htmlFor={field.id} style={labelStyle}>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>
                {["text", "name", "telephone", "signature"].includes(field.type) && (
                  <>
                    {field.type === "signature" && <small style={{ display: "block", marginBottom: 6, color: "#637286" }}>Type your full name as your signature.</small>}
                    <input {...common} type={field.type === "telephone" ? "tel" : "text"} autoComplete={field.type === "name" ? "name" : undefined} aria-label={field.label} />
                  </>
                )}
                {field.type === "number" && <input {...common} type="number" onChange={(event) => setValue(field.id, event.target.value === "" ? "" : Number(event.target.value))} />}
                {field.type === "dropdown" && <select {...common} defaultValue=""><option value="" disabled>Select an option</option>{opts.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
                {field.type === "multi-select" && <select {...common} multiple value={Array.isArray(values[field.id]) ? values[field.id] as string[] : []} onChange={(event) => setValue(field.id, Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>{opts.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
                {["radio", "multiple-choice"].includes(field.type) && <div role="radiogroup" aria-label={field.label} style={{ display: "grid", gap: 8 }}>{opts.map((option) => <label key={option} style={{ display: "flex", gap: 9, alignItems: "center" }}><input type="radio" name={field.id} value={option} required={field.required} checked={values[field.id] === option} onChange={() => setValue(field.id, option)} />{option}</label>)}</div>}
                {field.type === "checkbox" && <label style={{ display: "flex", gap: 9, alignItems: "center" }}><input type="checkbox" checked={values[field.id] === true} required={field.required} onChange={(event) => setValue(field.id, event.target.checked)} />{field.placeholder || "Yes"}</label>}
                {["file", "image"].includes(field.type) && <input id={field.id} name={field.id} type="file" required={field.required} multiple accept={field.type === "image" ? "image/png,image/jpeg,image/gif,image/webp" : "image/png,image/jpeg,image/gif,image/webp,application/pdf,text/csv,.csv"} onChange={(event) => setFiles((current) => ({ ...current, [field.id]: Array.from(event.target.files ?? []) }))} />}
              </div>
            );
          })}
        </div>
        {error && <p role="alert" style={{ color: "#b42318", margin: "18px 0 0" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: 24, border: 0, borderRadius: 7, padding: "12px 20px", background: primaryColor, color: "#fff", fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>
          {loading ? "Submitting…" : "Submit"}
        </button>
      </form>
    </section>
  );
}
