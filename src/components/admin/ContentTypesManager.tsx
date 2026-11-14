"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Folder,
  Images,
  MapPin,
  Newspaper,
  Package,
  Plus,
  Save,
  ShoppingBag,
  Tag,
  Ticket,
  Trash2,
} from "lucide-react";
import styles from "./PostsAdmin.module.css";

const iconOptions = [
  ["BriefcaseBusiness", BriefcaseBusiness],
  ["CalendarDays", CalendarDays],
  ["FileText", FileText],
  ["Folder", Folder],
  ["Images", Images],
  ["MapPin", MapPin],
  ["Newspaper", Newspaper],
  ["Package", Package],
  ["ShoppingBag", ShoppingBag],
  ["Ticket", Ticket],
] as const;

type ContentType = {
  id: string;
  title: string;
  slug: string;
  icon: string;
  hasCategories: boolean;
  hasTags: boolean;
  _count?: { posts: number };
};

const emptyForm = {
  title: "",
  slug: "",
  icon: "FileText",
  hasCategories: true,
  hasTags: true,
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export default function ContentTypesManager() {
  const [types, setTypes] = useState<ContentType[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadTypes() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/content-types", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load custom post types.");
      }
      setTypes(result.contentTypes);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load content types.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitialTypes() {
      try {
        const response = await fetch("/api/admin/content-types", {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load custom post types.");
        }
        if (active) setTypes(result.contentTypes);
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load content types."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialTypes();
    return () => {
      active = false;
    };
  }, []);

  function editType(type: ContentType) {
    setEditingId(type.id);
    setForm({
      title: type.title,
      slug: type.slug,
      icon: type.icon,
      hasCategories: type.hasCategories,
      hasTags: type.hasTags,
    });
    setNotice("");
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyForm);
  }

  async function saveType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        editingId
          ? `/api/admin/content-types/${editingId}`
          : "/api/admin/content-types",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, slug: slugify(form.slug) }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save the content type.");
      }
      setNotice(result.message);
      resetForm();
      await loadTypes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save content type.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteType(type: ContentType) {
    if (busy || !window.confirm(`Delete the “${type.title}” content type?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/content-types/${type.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to delete the content type.");
      }
      setNotice(result.message);
      await loadTypes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete content type.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Custom Post Types</h1>
          <p>Create separate content sections and add them to the admin menu.</p>
        </div>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <div className={styles.editorGrid}>
        <section className={styles.card}>
          <h2>{editingId ? "Edit Content Type" : "Add New Content Type"}</h2>
          <form onSubmit={(event) => void saveType(event)}>
            <label className={styles.field}>
              Type Title
              <input
                required
                maxLength={100}
                value={form.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setForm((current) => ({
                    ...current,
                    title,
                    slug: current.slug || slugify(title),
                  }));
                }}
              />
            </label>
            <label className={styles.field}>
              Slug
              <input
                required
                maxLength={100}
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    slug: slugify(event.target.value),
                  }))
                }
              />
            </label>
            <label className={styles.field}>
              Admin Icon
              <select
                value={form.icon}
                onChange={(event) =>
                  setForm((current) => ({ ...current, icon: event.target.value }))
                }
              >
                {iconOptions.map(([name]) => (
                  <option value={name} key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form.hasCategories}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    hasCategories: event.target.checked,
                  }))
                }
              />
              Enable categories
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form.hasTags}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    hasTags: event.target.checked,
                  }))
                }
              />
              Enable tags
            </label>
            <div className={styles.actions}>
              <button className={styles.primaryButton} disabled={busy} type="submit">
                {editingId ? <Save size={15} /> : <Plus size={15} />}
                {editingId ? "Save Changes" : "Create Type"}
              </button>
              {editingId && (
                <button className={styles.button} type="button" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <h2>Registered Types</h2>
          {loading ? (
            <p className={styles.muted}>Loading content types…</p>
          ) : !types.length ? (
            <p className={styles.muted}>No custom post types created yet.</p>
          ) : (
            <div className={styles.checkboxList}>
              {types.map((type) => {
                const Icon =
                  iconOptions.find(([name]) => name === type.icon)?.[1] ??
                  FileText;
                return (
                  <div
                    key={type.id}
                    className={styles.typeRow}
                  >
                    <a className={styles.typeName} href={`/admin/content-types/${type.slug}/posts`}>
                      <Icon size={18} />
                      <span>
                        <strong>{type.title}</strong>
                        <small>/{type.slug} · {type._count?.posts ?? 0} items</small>
                      </span>
                    </a>
                    <div className={styles.actions}>
                      {type.hasCategories && <span title="Categories"><Folder size={14} /></span>}
                      {type.hasTags && <span title="Tags"><Tag size={14} /></span>}
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => editType(type)}
                        aria-label={`Edit ${type.title}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => void deleteType(type)}
                        disabled={busy || (type._count?.posts ?? 0) > 0}
                        aria-label={`Delete ${type.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
