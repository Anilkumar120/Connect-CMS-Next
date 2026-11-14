
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Edit,
  Eye,
  Trash2,
  RotateCcw,
  X,
  CheckSquare,
  Square,
  Globe,
  FileText,
  Archive,
  Loader2,
  ExternalLink,
  PanelsTopLeft,
} from "lucide-react";
import type { CSSProperties } from "react";
import { formatDate } from "@/lib/format-date";

export type AdminPage = {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
  publishedAt: string | null;
  deletedAt: string | null;
};

type FilterType = "ALL" | "PUBLISHED" | "DRAFT" | "REVIEW" | "TRASH";

type BulkAction = "TRASH" | "RESTORE" | "DELETE" | "PUBLISH" | "DRAFT";

const statusStyles: Record<string, CSSProperties> = {
  DRAFT: { background: "#fff7e6", color: "#b7791f" },
  REVIEW: { background: "#eaf2ff", color: "#2563eb" },
  PUBLISHED: { background: "#e8f7ee", color: "#16834a" },
  ARCHIVED: { background: "#f1f1f1", color: "#666" },
  TRASH: { background: "#f1f1f1", color: "#666" },
};

const addButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "11px 18px",
  minHeight: "40px",
  backgroundColor: "#0c2f55",
  border: "1px solid #0c2f55",
  borderRadius: "7px",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: 1.2,
  cursor: "pointer",
};

function isTrashed(page: AdminPage) {
  return page.deletedAt !== null || page.status === "ARCHIVED";
}

export default function PagesManager({
  initialPages,
}: {
  initialPages: AdminPage[];
}) {
  const [pages, setPages] = useState(initialPages);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const counts = useMemo(
    () => ({
      ALL: pages.filter((page) => !isTrashed(page)).length,
      PUBLISHED: pages.filter(
        (page) => !isTrashed(page) && page.status === "PUBLISHED"
      ).length,
      DRAFT: pages.filter(
        (page) => !isTrashed(page) && page.status === "DRAFT"
      ).length,
      REVIEW: pages.filter(
        (page) => !isTrashed(page) && page.status === "REVIEW"
      ).length,
      TRASH: pages.filter(isTrashed).length,
    }),
    [pages]
  );

  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      const matchesFilter =
        filter === "ALL"
          ? !isTrashed(page)
          : filter === "TRASH"
            ? isTrashed(page)
            : !isTrashed(page) && page.status === filter;

      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        page.title.toLowerCase().includes(query) ||
        page.slug.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [pages, filter, search]);

  const allVisibleSelected =
    filteredPages.length > 0 &&
    filteredPages.every((page) => selectedIds.includes(page.id));

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) => !filteredPages.some((page) => page.id === id)
        )
      );
    } else {
      setSelectedIds((current) => [
        ...new Set([...current, ...filteredPages.map((page) => page.id)]),
      ]);
    }
  }

  async function runAction(action: BulkAction, ids: string[]) {
    if (!ids.length || busy) return;

    const confirmationMessages: Partial<Record<BulkAction, string>> = {
      TRASH: `Move ${ids.length} page(s) to Trash?`,
      DELETE: `Permanently delete ${ids.length} page(s)? This cannot be undone.`,
      RESTORE: `Restore ${ids.length} page(s)?`,
      PUBLISH: `Publish ${ids.length} page(s)?`,
      DRAFT: `Move ${ids.length} page(s) to Draft?`,
    };

    const message = confirmationMessages[action];

    if (message && !window.confirm(message)) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/pages/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, ids }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Page action failed.");
      }

      const selected = new Set(ids);
      if (action === "DELETE") {
        setPages((current) =>
          current.filter((page) => !selected.has(page.id))
        );
      } else {
        const trashedAt = new Date().toISOString();
        setPages((current) =>
          current.map((page) => {
            if (!selected.has(page.id)) return page;

            switch (action) {
              case "TRASH":
                return { ...page, deletedAt: trashedAt };
              case "RESTORE":
                return {
                  ...page,
                  deletedAt: null,
                  status:
                    page.status === "ARCHIVED" ? "DRAFT" : page.status,
                };
              case "PUBLISH":
                return {
                  ...page,
                  status: "PUBLISHED",
                  publishedAt: new Date().toISOString(),
                };
              case "DRAFT":
                return { ...page, status: "DRAFT", publishedAt: null };
            }
          })
        );
      }

      setSelectedIds([]);
      setNotice(result.message || "Pages updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "ALL" },
    { label: "Published", value: "PUBLISHED" },
    { label: "Draft", value: "DRAFT" },
    { label: "Review", value: "REVIEW" },
    { label: "Trash", value: "TRASH" },
  ];

  return (
    <div className="pages-management">
      <style jsx>{`
        .pages-management {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          color: var(--admin-text, #253247);
          box-sizing: border-box;
        }

        .pages-management *,
        .pages-management *::before,
        .pages-management *::after {
          box-sizing: border-box;
        }

        .pages-management button,
        .pages-management input {
          font-family: inherit;
        }

        .pages-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 25px;
        }

        .pages-header h1 {
          margin: 0 0 7px;
          font-size: 26px;
          font-weight: 700;
          line-height: 1.3;
        }

        .pages-header p {
          margin: 0;
          color: #788397;
          font-size: 14px;
        }

        .pages-add-button {
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        .pages-add-button:hover {
          background: #3984e8 !important;
          border-color: #3984e8 !important;
          color: #ffffff !important;
        }

        .pages-add-button svg {
          color: #ffffff !important;
          flex-shrink: 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 22px;
        }

        .stat {
          min-width: 0;
          padding: 20px;
          border: 1px solid #e8edf3;
          border-radius: 9px;
          background: var(--admin-surface, #fff);
        }

        .stat span {
          display: block;
          color: #788397;
          font-size: 13px;
          margin-bottom: 9px;
        }

        .stat strong {
          font-size: 25px;
          line-height: 1.3;
        }

        .table-card {
          width: 100%;
          min-width: 0;
          background: var(--admin-surface, #fff);
          border: 1px solid #e8edf3;
          border-radius: 9px;
          overflow: hidden;
        }

        .table-heading {
          padding: 18px 20px;
          border-bottom: 1px solid #edf0f4;
          font-size: 16px;
          font-weight: 700;
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          padding: 14px 20px;
          border-bottom: 1px solid #edf0f4;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 16px;
        }

        .filter-button {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          min-height: 28px;
          padding: 4px 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #667085;
          cursor: pointer;
          font-size: 13px;
          line-height: 1.4;
        }

        .filter-button:hover,
        .filter-button.active {
          color: #0c2f55;
        }

        .filter-button.active {
          font-weight: 700;
          box-shadow: 0 2px #0c2f55;
        }

        .filter-count {
          color: #98a2b3;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 250px;
          max-width: 100%;
          min-height: 37px;
          padding: 7px 10px;
          border: 1px solid #dce2ea;
          border-radius: 6px;
          background: #fff;
          color: #667085;
        }

        .search-box:focus-within {
          border-color: #3984e8;
          box-shadow: 0 0 0 2px rgba(57, 132, 232, 0.1);
        }

        .search-box input {
          width: 100%;
          min-width: 0;
          padding: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #344054;
          font-size: 13px;
          box-shadow: none;
        }

        .search-box input:focus {
          outline: 0;
          box-shadow: none;
        }

        .clear-search {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          border: 0;
          background: transparent;
          color: #667085;
          cursor: pointer;
        }

        .bulk-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: #f4f7fb;
          border-bottom: 1px solid #e5eaf0;
        }

        .bulk-toolbar > span {
          margin-right: 5px;
          color: #344054;
          font-size: 13px;
          font-weight: 600;
        }

        .action-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 32px;
          padding: 6px 10px;
          border: 1px solid #d0d5dd;
          border-radius: 5px;
          background: #fff;
          color: #344054;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.2;
          white-space: nowrap;
          text-decoration: none !important;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .action-button svg {
          flex: 0 0 auto;
        }

        .action-button:hover {
          border-color: #3984e8;
          background: #f0f6ff;
          color: #1765b3;
        }

        .action-button.danger {
          color: #b42318;
        }

        .action-button.danger:hover {
          border-color: #f0a19b;
          background: #fff1f0;
          color: #b42318;
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .pages-management table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
          border-spacing: 0;
        }

        .pages-management th,
        .pages-management td {
          padding: 13px 15px;
          text-align: left;
          border-bottom: 1px solid #edf0f4;
          font-size: 13px;
          vertical-align: middle;
        }

        .pages-management th {
          color: #788397;
          background: #fafbfd;
          font-weight: 600;
          white-space: nowrap;
        }

        .pages-management td {
          color: var(--admin-text, #344054);
        }

        .pages-management tbody tr {
          transition: background 0.15s ease;
        }

        .pages-management tbody tr:hover {
          background: #fafcff;
        }

        .pages-management tbody tr:last-child td {
          border-bottom: 0;
        }

        .page-title {
          display: inline-block;
          color: #0c2f55;
          font-weight: 650;
          line-height: 1.4;
          text-decoration: none;
        }

        .page-title:hover {
          color: #3984e8;
        }

        .slug {
          color: #788397;
          overflow-wrap: anywhere;
        }

        .status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
          white-space: nowrap;
        }

        .page-row-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
          margin-top: 6px;
          min-height: 20px;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-3px);
          transition: opacity 0.15s ease, transform 0.15s ease,
            visibility 0.15s ease;
        }

        .page-row-actions.trash-actions {
          opacity: 1;
          visibility: visible;
          transform: none;
        }

        tr:hover .page-row-actions,
        tr:focus-within .page-row-actions {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .row-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #2271b1;
          font-size: 12px;
          line-height: 1.4;
          text-decoration: none !important;
          cursor: pointer;
        }

        .row-link:hover {
          color: #135e96;
          text-decoration: underline !important;
        }

        .row-link:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .row-link.danger {
          color: #b32d2e;
        }

        .row-link.danger:hover {
          color: #8a2424;
        }

        .row-separator {
          color: #c3c4c7;
          font-size: 12px;
        }

        .row-link.seo {
          color: #2271b1;
          font-weight: 600;
        }

        .row-link.seo:hover {
          color: #135e96;
        }

        .empty {
          padding: 55px 20px;
          text-align: center;
        }

        .empty h3 {
          margin: 10px 0 8px;
          font-size: 17px;
        }

        .empty p {
          margin: 0 0 16px;
          color: #788397;
          font-size: 13px;
        }

        .alert {
          padding: 12px;
          margin-bottom: 15px;
          border-radius: 6px;
          font-size: 13px;
        }

        .alert.error {
          background: #fef3f2;
          border: 1px solid #fecdca;
          color: #b42318;
        }

        .alert.success {
          background: #ecfdf3;
          border: 1px solid #abefc6;
          color: #067647;
        }

        .select-all-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 0;
          background: transparent;
          color: #667085;
          cursor: pointer;
        }

        .page-checkbox {
          width: 15px;
          height: 15px;
          margin: 0;
          accent-color: #2271b1;
          cursor: pointer;
        }

        @media (max-width: 700px) {
          .stats {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .pages-header h1 {
            font-size: 22px;
          }

          .toolbar {
            align-items: stretch;
          }

          .filters {
            gap: 12px;
          }

          .search-box {
            width: 100%;
          }

          .page-row-actions {
            opacity: 1;
            visibility: visible;
            transform: none;
          }

          .bulk-toolbar {
            padding: 12px;
          }
        }
      `}</style>

      <div className="pages-header">
        <div>
          <h1>Pages</h1>
          <p>Manage your website pages and content.</p>
        </div>

        <Link
          href="/admin/pages/new"
          className="pages-add-button"
          style={addButtonStyle}
        >
          <Plus size={17} color="#ffffff" />
          Add New Page
        </Link>
      </div>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="stats">
        <div className="stat">
          <span>Total Pages</span>
          <strong>{counts.ALL}</strong>
        </div>

        <div className="stat">
          <span>Published Pages</span>
          <strong>{counts.PUBLISHED}</strong>
        </div>

        <div className="stat">
          <span>Draft Pages</span>
          <strong>{counts.DRAFT}</strong>
        </div>
      </div>

      <div className="table-card">
        <div className="table-heading">All Website Pages</div>

        <div className="toolbar">
          <div className="filters">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`filter-button ${
                  filter === item.value ? "active" : ""
                }`}
                onClick={() => {
                  setFilter(item.value);
                  setSelectedIds([]);
                }}
              >
                {item.label}
                <span className="filter-count">
                  ({counts[item.value]})
                </span>
              </button>
            ))}
          </div>

          <label className="search-box">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pages..."
            />
            {search && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </label>
        </div>

        {selectedIds.length > 0 && (
          <div className="bulk-toolbar">
            <span>{selectedIds.length} selected</span>

            {filter === "TRASH" ? (
              <>
                <button
                  type="button"
                  className="action-button"
                  disabled={busy}
                  onClick={() => void runAction("RESTORE", selectedIds)}
                >
                  <RotateCcw size={14} />
                  Restore
                </button>

                <button
                  type="button"
                  className="action-button danger"
                  disabled={busy}
                  onClick={() => void runAction("DELETE", selectedIds)}
                >
                  <Trash2 size={14} />
                  Delete Permanently
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="action-button"
                  disabled={busy}
                  onClick={() => void runAction("PUBLISH", selectedIds)}
                >
                  <Globe size={14} />
                  Publish
                </button>

                <button
                  type="button"
                  className="action-button"
                  disabled={busy}
                  onClick={() => void runAction("DRAFT", selectedIds)}
                >
                  <FileText size={14} />
                  Move to Draft
                </button>

                <button
                  type="button"
                  className="action-button danger"
                  disabled={busy}
                  onClick={() => void runAction("TRASH", selectedIds)}
                >
                  <Trash2 size={14} />
                  Move to Trash
                </button>
              </>
            )}

            <button
              type="button"
              className="action-button"
              disabled={busy}
              onClick={() => setSelectedIds([])}
            >
              <X size={14} />
              Clear
            </button>

            {busy && <Loader2 size={16} />}
          </div>
        )}

        {filteredPages.length === 0 ? (
          <div className="empty">
            <Archive size={30} color="#98a2b3" />
            <h3>No pages found</h3>
            <p>
              {filter === "TRASH"
                ? "Your Trash is empty."
                : "Create a page or change your search/filter."}
            </p>

            {filter !== "TRASH" && (
              <Link
                href="/admin/pages/new"
                className="pages-add-button"
                style={{
                  ...addButtonStyle,
                  padding: "10px 16px",
                  minHeight: "38px",
                  fontSize: "13px",
                }}
              >
                <Plus size={15} color="#ffffff" />
                Create Page
              </Link>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 45 }}>
                    <button
                      type="button"
                      className="select-all-button"
                      onClick={toggleSelectAll}
                      aria-label="Select all pages"
                    >
                      {allVisibleSelected ? (
                        <CheckSquare size={17} />
                      ) : (
                        <Square size={17} />
                      )}
                    </button>
                  </th>
                  <th>Page Title</th>
                  <th>URL Slug</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                </tr>
              </thead>

              <tbody>
                {filteredPages.map((page) => {
                  const status = page.status;
                  const isSelected = selectedIds.includes(page.id);
                  const editUrl = `/admin/pages/${page.id}/edit`;

                  return (
                    <tr key={page.id}>
                      <td>
                        <input
                          className="page-checkbox"
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(page.id)}
                          aria-label={`Select ${page.title}`}
                        />
                      </td>

                      <td>
                        <div>
                          <span className="page-title">{page.title}</span>

                          <div className={`page-row-actions${isTrashed(page) ? " trash-actions" : ""}`}>
                            {isTrashed(page) ? (
                              <>
                                <button
                                  type="button"
                                  className="row-link"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction("RESTORE", [page.id])
                                  }
                                >
                                  <RotateCcw size={12} />
                                  Restore
                                </button>

                                <span className="row-separator">|</span>

                                <button
                                  type="button"
                                  className="row-link danger"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction("DELETE", [page.id])
                                  }
                                >
                                  <Trash2 size={12} />
                                  Delete permanently
                                </button>
                              </>
                            ) : (
                              <>
                                <Link className="row-link" href={editUrl}>
                                  <Edit size={12} />
                                  Edit
                                </Link>

                                <span className="row-separator">|</span>

                                <Link
                                  className="row-link"
                                  href={`/admin/builder/pages/${page.id}`}
                                >
                                  <PanelsTopLeft size={12} />
                                  Builder
                                </Link>

                                <span className="row-separator">|</span>

                                <button
                                  type="button"
                                  className="row-link"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction("TRASH", [page.id])
                                  }
                                >
                                  <Trash2 size={12} />
                                  Trash
                                </button>

                                <span className="row-separator">|</span>

                                <Link
                                  className="row-link seo"
                                  href={`${editUrl}#seo`}
                                  title="Open SEO settings"
                                >
                                  SEO
                                  <ExternalLink size={11} />
                                </Link>

                                {page.status === "PUBLISHED" && (
                                  <>
                                    <span className="row-separator">|</span>
                                    <Link
                                      className="row-link"
                                      href={`/${page.slug}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      aria-label={`View ${page.title}`}
                                    >
                                      <Eye size={12} />
                                      View
                                    </Link>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="slug">/{page.slug}</span>
                      </td>

                      <td>
                        <span
                          className="status"
                          style={
                            statusStyles[
                              isTrashed(page) ? "TRASH" : status
                            ] || statusStyles.DRAFT
                          }
                        >
                          {isTrashed(page) ? "TRASH" : status}
                        </span>
                      </td>

                      <td>
                        {formatDate(page.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
