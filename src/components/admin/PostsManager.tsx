"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Edit,
  ExternalLink,
  PanelsTopLeft,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/format-date";
import styles from "./PostsAdmin.module.css";

export type AdminPost = {
  id: string;
  title: string;
  slug: string;
  permalink?: string;
  status: string;
  updatedAt: string;
  publishedAt: string | null;
  deletedAt: string | null;
  categories: { category: { id: string; name: string } }[];
};

type Filter = "ALL" | "PUBLISHED" | "DRAFT" | "TRASH";

export default function PostsManager({
  initialPosts,
  title = "Posts",
  description = "Write, organize and publish blog posts.",
  basePath = "/admin/posts",
  postTypeSlug,
}: {
  initialPosts: AdminPost[];
  title?: string;
  description?: string;
  basePath?: string;
  postTypeSlug?: string;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const visiblePosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return posts.filter((post) => {
      const trashed = post.deletedAt !== null;
      const matchesFilter =
        filter === "ALL"
          ? !trashed
          : filter === "TRASH"
            ? trashed
            : !trashed && post.status === filter;
      return (
        matchesFilter &&
        (!query ||
          post.title.toLowerCase().includes(query) ||
          post.slug.toLowerCase().includes(query))
      );
    });
  }, [filter, posts, search]);

  const allVisibleSelected =
    visiblePosts.length > 0 &&
    visiblePosts.every((post) => selectedIds.includes(post.id));

  function togglePostSelection(postId: string) {
    setSelectedIds((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    );
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visiblePosts.some((post) => post.id === id))
        : [...new Set([...current, ...visiblePosts.map((post) => post.id)])]
    );
  }

  async function runBulkAction(
    action: "TRASH" | "RESTORE" | "PERMANENT_DELETE"
  ) {
    if (busyId || !selectedIds.length) return;
    const confirmation =
      action === "TRASH"
        ? `Move ${selectedIds.length} selected post(s) to Trash?`
        : action === "RESTORE"
          ? `Restore ${selectedIds.length} selected post(s) as drafts?`
          : `Permanently delete ${selectedIds.length} selected post(s)? This cannot be undone.`;
    if (!window.confirm(confirmation)) return;

    setBusyId("bulk");
    setError("");
    try {
      const response = await fetch("/api/admin/posts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          action,
          ...(postTypeSlug ? { postTypeSlug } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to update selected posts.");
      }

      const selected = new Set(selectedIds);
      setPosts((current) =>
        action === "PERMANENT_DELETE"
          ? current.filter((post) => !selected.has(post.id))
          : current.map((post) =>
              selected.has(post.id)
                ? action === "TRASH"
                  ? { ...post, deletedAt: new Date().toISOString(), status: "DRAFT" }
                  : { ...post, deletedAt: null, status: "DRAFT" }
                : post
            )
      );
      setSelectedIds([]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to update selected posts."
      );
    } finally {
      setBusyId("");
    }
  }

  async function trashPost(post: AdminPost) {
    if (busyId || !window.confirm(`Move “${post.title}” to Trash?`)) return;
    setBusyId(post.id);
    setError("");
    try {
      const response = await fetch(getPostApiUrl(post.id, postTypeSlug), {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to move post to Trash.");
      }
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, deletedAt: new Date().toISOString(), status: "DRAFT" }
            : item
        )
      );
      setSelectedIds((current) => current.filter((id) => id !== post.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to move post to Trash.");
    } finally {
      setBusyId("");
    }
  }

  async function restorePost(post: AdminPost) {
    if (busyId) return;
    setBusyId(post.id);
    setError("");
    try {
      const response = await fetch(getPostApiUrl(post.id, postTypeSlug), { method: "PATCH" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to restore post.");
      }
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, deletedAt: null, status: "DRAFT" }
            : item
        )
      );
      setSelectedIds((current) => current.filter((id) => id !== post.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to restore post.");
    } finally {
      setBusyId("");
    }
  }

  async function permanentlyDeletePost(post: AdminPost) {
    if (
      busyId ||
      !window.confirm(
        `Permanently delete “${post.title}”? This cannot be undone.`
      )
    ) {
      return;
    }

    setBusyId(post.id);
    setError("");
    try {
      const response = await fetch(
        getPostApiUrl(post.id, postTypeSlug, true),
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to permanently delete post.");
      }
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setSelectedIds((current) => current.filter((id) => id !== post.id));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to permanently delete post."
      );
    } finally {
      setBusyId("");
    }
  }

  const filters: { title: string; value: Filter }[] = [
    { title: "All", value: "ALL" },
    { title: "Published", value: "PUBLISHED" },
    { title: "Drafts", value: "DRAFT" },
    { title: "Trash", value: "TRASH" },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={styles.actions}>
          {!postTypeSlug && (
            <>
              <Link className={styles.button} href="/admin/posts/categories">Categories</Link>
              <Link className={styles.button} href="/admin/posts/tags">Tags</Link>
            </>
          )}
          <Link className={styles.primaryButton} href={`${basePath}/new`}>
            <Plus size={16} /> Add New {postTypeSlug ? title.replace(/s$/, "") : "Post"}
          </Link>
        </div>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {filters.map((item) => (
            <button
              type="button"
              key={item.value}
              className={`${styles.filter} ${filter === item.value ? styles.filterActive : ""}`}
              onClick={() => {
                setFilter(item.value);
                setSelectedIds([]);
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedIds([]);
            }}
            placeholder="Search posts"
            aria-label="Search posts"
          />
        </label>
      </div>

      {selectedIds.length > 0 && (
        <div className={styles.bulkToolbar}>
          <span>{selectedIds.length} selected</span>
          {filter === "TRASH" ? (
            <>
              <button
                type="button"
                className={styles.button}
                disabled={Boolean(busyId)}
                onClick={() => void runBulkAction("RESTORE")}
              >
                <RotateCcw size={14} /> Restore
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={Boolean(busyId)}
                onClick={() => void runBulkAction("PERMANENT_DELETE")}
              >
                <Trash2 size={14} /> Delete permanently
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.dangerButton}
              disabled={Boolean(busyId)}
              onClick={() => void runBulkAction("TRASH")}
            >
              <Trash2 size={14} /> Move to Trash
            </button>
          )}
          <button
            type="button"
            className={styles.button}
            disabled={Boolean(busyId)}
            onClick={() => setSelectedIds([])}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className={styles.tableCard}>
        {visiblePosts.length ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCell}>
                  <button
                    type="button"
                    className={styles.selectAllButton}
                    onClick={toggleSelectAll}
                    aria-label={
                      allVisibleSelected
                        ? "Deselect all visible posts"
                        : "Select all visible posts"
                    }
                  >
                    {allVisibleSelected ? (
                      <CheckSquare size={17} />
                    ) : (
                      <Square size={17} />
                    )}
                  </button>
                </th>
                <th>Title</th>
                <th>Categories</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {visiblePosts.map((post) => (
                <tr key={post.id}>
                  <td className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(post.id)}
                      onChange={() => togglePostSelection(post.id)}
                      aria-label={`Select ${post.title}`}
                    />
                  </td>
                  <td>
                    <Link className={styles.titleLink} href={`${basePath}/${post.id}/edit`}>
                      {post.title}
                    </Link>
                    <span className={styles.slug}>
                      {postTypeSlug ? `/content/${postTypeSlug}/${post.slug}` : post.permalink || `/blog/${post.slug}`}
                    </span>
                    <div className={`${styles.rowActions}${post.deletedAt ? ` ${styles.rowActionsVisible}` : ""}`}>
                      {post.deletedAt ? (
                        <>
                          <button
                            type="button"
                            className={styles.rowAction}
                            onClick={() => void restorePost(post)}
                            disabled={Boolean(busyId)}
                            aria-label={`Restore ${post.title}`}
                          >
                            Restore
                          </button>
                          <span className={styles.rowActionSeparator}>|</span>
                          <button
                            type="button"
                            className={`${styles.rowAction} ${styles.rowActionDanger}`}
                            onClick={() => void permanentlyDeletePost(post)}
                            disabled={Boolean(busyId)}
                            aria-label={`Permanently delete ${post.title}`}
                          >
                            Delete permanently
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            className={styles.rowAction}
                            href={`${basePath}/${post.id}/edit`}
                            aria-label={`Edit ${post.title}`}
                          >
                            <Edit size={14} /> Edit
                          </Link>
                          <span className={styles.rowActionSeparator}>|</span>
                          <Link
                            className={styles.rowAction}
                            href={
                              postTypeSlug
                                ? `/admin/builder/custom/${postTypeSlug}/${post.id}`
                                : `/admin/builder/posts/${post.id}`
                            }
                            aria-label={`Open builder for ${post.title}`}
                          >
                            <PanelsTopLeft size={14} /> Builder
                          </Link>
                          <span className={styles.rowActionSeparator}>|</span>
                          <button
                            type="button"
                            className={`${styles.rowAction} ${styles.rowActionDanger}`}
                            onClick={() => void trashPost(post)}
                            disabled={Boolean(busyId)}
                            aria-label={`Move ${post.title} to Trash`}
                          >
                            <Trash2 size={14} /> Trash
                          </button>
                          <span className={styles.rowActionSeparator}>|</span>
                          <Link
                            className={styles.rowAction}
                            href={`${basePath}/${post.id}/edit#seo`}
                            aria-label={`Edit SEO for ${post.title}`}
                          >
                            SEO
                          </Link>
                          {post.status === "PUBLISHED" && (
                            <>
                              <span className={styles.rowActionSeparator}>|</span>
                              <Link
                                className={styles.rowAction}
                                href={
                                  postTypeSlug
                                    ? `/content/${postTypeSlug}/${post.slug}`
                                    : post.permalink || `/blog/${post.slug}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`View ${post.title}`}
                              >
                                <ExternalLink size={14} /> View
                              </Link>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td>{post.categories.map(({ category }) => category.name).join(", ") || "—"}</td>
                  <td>
                    <span className={`${styles.badge} ${post.status === "PUBLISHED" ? styles.badgePublished : ""}`}>
                      {post.deletedAt ? "TRASH" : post.status}
                    </span>
                  </td>
                  <td>{formatDate(post.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.empty}>
            {filter === "TRASH" ? "Trash is empty." : "No posts found."}
          </div>
        )}
      </div>
    </main>
  );
}

function getPostApiUrl(
  postId: string,
  postTypeSlug?: string,
  permanent = false
) {
  const query = new URLSearchParams();
  if (postTypeSlug) query.set("type", postTypeSlug);
  if (permanent) query.set("permanent", "true");
  const search = query.size ? `?${query}` : "";
  return `/api/admin/posts/${postId}${search}`;
}
