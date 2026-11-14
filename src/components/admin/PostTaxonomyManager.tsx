"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Pencil, Save, Trash2, X } from "lucide-react";
import MediaPickerModal, {
  type MediaPickerItem,
} from "@/components/admin/MediaPickerModal";
import styles from "./PostsAdmin.module.css";

type TaxonomyType = "categories" | "tags";
type Term = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  _count?: { posts: number; children?: number };
};
type ApiResult = {
  success?: boolean;
  message?: string;
  categories?: Term[];
  tags?: Term[];
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export default function PostTaxonomyManager({
  type,
}: {
  type: TaxonomyType;
}) {
  const isCategory = type === "categories";
  const title = isCategory ? "Categories" : "Tags";
  const endpoint = `/api/admin/posts/taxonomies/${type}`;
  const [terms, setTerms] = useState<Term[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [parentId, setParentId] = useState("");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTerms = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const result: ApiResult = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || `Unable to load ${title.toLowerCase()}.`);
    }
    setTerms(isCategory ? result.categories || [] : result.tags || []);
  }, [endpoint, isCategory, title]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        await loadTerms();
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : `Unable to load ${title.toLowerCase()}.`);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadTerms, title]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setSlug("");
    setDescription("");
    setImageUrl("");
    setParentId("");
    setError("");
    setNotice("");
  }

  function startEditing(term: Term) {
    setEditingId(term.id);
    setName(term.name);
    setSlug(term.slug);
    setDescription(term.description || "");
    setImageUrl(term.imageUrl || "");
    setParentId(term.parentId || "");
    setError("");
    setNotice("");
  }

  async function saveTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    if (!name.trim() || !slugify(slug)) {
      setError("Enter a name and a valid slug.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(
        editingId ? `${endpoint}/${editingId}` : endpoint,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            slug: slugify(slug),
            ...(isCategory ? { description, parentId: parentId || null } : {}),
            imageUrl,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || `Unable to save ${title.toLowerCase()}.`);
      }
      setNotice(result.message || `${isCategory ? "Category" : "Tag"} saved.`);
      await loadTerms();
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to save ${title.toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTerm(term: Term) {
    if (busy || !window.confirm(`Delete “${term.name}”?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${endpoint}/${term.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || `Unable to delete ${title.toLowerCase()}.`);
      }
      setNotice(result.message || `${title.slice(0, -1)} deleted.`);
      await loadTerms();
      if (editingId === term.id) resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to delete ${title.toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  }

  function selectImage(item: MediaPickerItem) {
    setImageUrl(item.url);
    setNotice("Image selected. Save to apply it.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.taxonomyHeader}>
        <div>
          <Link className={styles.linkButton} href="/admin/posts">
            <ArrowLeft size={15} /> Back to Posts
          </Link>
          <h1 style={{ marginTop: 12 }}>{title}</h1>
          <p className={styles.muted}>
            {isCategory
              ? "Organize posts into categories and nested subcategories."
              : "Add tags to help visitors browse related posts."}
          </p>
        </div>
        <Link className={styles.button} href="/admin/posts">View Posts</Link>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <div className={styles.taxonomyLayout}>
        <form className={styles.card} onSubmit={(event) => void saveTerm(event)}>
          <h2>{editingId ? `Edit ${isCategory ? "Category" : "Tag"}` : `Add New ${isCategory ? "Category" : "Tag"}`}</h2>
          <label className={styles.field}>
            Name
            <input
              required
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSlug(slugify(event.target.value));
              }}
            />
          </label>
          <label className={styles.field}>
            Slug
            <input required value={slug} onChange={(event) => setSlug(event.target.value)} />
          </label>
          {isCategory && (
            <>
              <label className={styles.field}>
                Parent Category
                <select
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                >
                  <option value="">None (Top Level)</option>
                  {terms
                    .filter((term) => term.id !== editingId)
                    .map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.parent ? `${term.parent.name} › ` : ""}
                        {term.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className={styles.field}>
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </>
          )}

          <h2>{isCategory ? "Category Image" : "Tag Image"}</h2>
          {imageUrl && <img className={styles.imagePreview} src={imageUrl} alt={`${title.slice(0, -1)} preview`} />}
          <div className={styles.mediaActions}>
            <button type="button" className={styles.button} onClick={() => setMediaPickerOpen(true)}>
              <ImagePlus size={15} /> Choose or Upload Image
            </button>
            {imageUrl && (
              <button type="button" className={styles.button} onClick={() => setImageUrl("")}>
                <X size={15} /> Remove
              </button>
            )}
          </div>
          <div className={styles.actions}>
            {editingId && (
              <button type="button" className={styles.button} onClick={resetForm}>
                Cancel
              </button>
            )}
            <button type="submit" className={styles.primaryButton} disabled={busy}>
              <Save size={15} /> {busy ? "Saving…" : editingId ? "Update" : "Add"}
            </button>
          </div>
        </form>

        <section className={styles.card}>
          <h2>All {title}</h2>
          {terms.length ? terms.map((term) => (
            <div className={styles.termRow} key={term.id}>
              {term.imageUrl
                ? <img className={styles.termImage} src={term.imageUrl} alt="" />
                : <div className={styles.termImage} aria-hidden="true" />}
              <div>
                <div className={styles.termName}>
                  {term.parent ? `${term.parent.name} › ` : ""}{term.name}
                </div>
                <div className={styles.termSlug}>
                  /{term.slug} · {term._count?.posts || 0} posts
                  {isCategory && term._count?.children ? ` · ${term._count.children} subcategories` : ""}
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => startEditing(term)}
                  aria-label={`Edit ${term.name}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => void deleteTerm(term)}
                  disabled={busy}
                  aria-label={`Delete ${term.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )) : <p className={styles.empty}>No {title.toLowerCase()} have been added.</p>}
        </section>
      </div>

      <MediaPickerModal
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={selectImage}
      />
    </main>
  );
}
