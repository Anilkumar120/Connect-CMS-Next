"use client";

import { useEffect, useState } from "react";
import PublicForm from "@/components/forms/PublicForm";
import type { FormField } from "@/lib/forms";

type ResolvedForm = {
  title: string;
  description: string | null;
  slug: string;
  fields: FormField[];
  settings: unknown;
  styles: unknown;
};

export default function PublicShortcodeWidget({ code }: { code: string }) {
  const [form, setForm] = useState<ResolvedForm | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/public/builder/shortcode?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success || !result.form) {
          throw new Error(result.message || "Unable to load shortcode.");
        }
        if (active) setForm(result.form as ResolvedForm);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load shortcode.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [code]);

  if (loading) return <div aria-live="polite">Loading embedded content…</div>;
  if (error || !form) return <div role="status">{error || "Shortcode could not be loaded."}</div>;

  return (
    <PublicForm
      title={form.title}
      description={form.description || ""}
      fields={Array.isArray(form.fields) ? form.fields : []}
      settings={form.settings}
      styles={form.styles}
      slug={form.slug}
    />
  );
}
