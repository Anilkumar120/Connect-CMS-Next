"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  FileText,
  Layers,
  Archive,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import styles from "./TemplateManager.module.css";

type TemplateKind = "single" | "archive";

type TemplateItem = {
  id: string;
  documentId?: string;
  documentKey?: string;
  name: string;
  description?: string;
  status: "DRAFT" | "PUBLISHED";
  updatedAt?: string;
};

type Props = {
  kind: TemplateKind;
};

export default function TemplateManager({ kind }: Props) {
  const router = useRouter();

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [draftTemplates, setDraftTemplates] = useState<TemplateItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "published" | "draft">(
    "all",
  );

  const isSingle = kind === "single";

  const pageTitle = isSingle
    ? "Single Templates"
    : "Archive Templates";

  const pageDescription = isSingle
    ? "Create layouts for individual posts and custom post type entries."
    : "Create layouts for post archives and custom post type archives.";

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/builder/templates?kind=${kind}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load templates.");
      }

      setTemplates(
        Array.isArray(data.templates) ? data.templates : [],
      );

      setDraftTemplates(
        Array.isArray(data.draftTemplates)
          ? data.draftTemplates
          : [],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load templates.",
      );
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const openEditor = (templateId: string) => {
    router.push(
      `/admin/builder/templates/${kind}/${encodeURIComponent(templateId)}`,
    );
  };

  const createTemplate = async () => {
    const name = window.prompt(
      `Enter ${isSingle ? "Single" : "Archive"} template name:`,
    );

    if (!name?.trim()) return;

    const id = `${name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100)}-${crypto.randomUUID().slice(0, 8)}`;

    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/admin/builder/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind,
          action: "saveDraft",
          template: {
            id,
            name: name.trim(),
            description: "",
            layout: {
              version: 1,
              root: [],
            },
            conditions: {
              include: [],
              exclude: [],
            },
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to create template.");
      }

      await loadTemplates();
      openEditor(id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create template.",
      );
    } finally {
      setCreating(false);
    }
  };

  const deleteTemplate = async (template: TemplateItem) => {
    const confirmed = window.confirm(
      `Move "${template.name}" to archive?`,
    );

    if (!confirmed) return;

    setError("");

    try {
      const response = await fetch("/api/admin/builder/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind,
          action: "delete",
          template: {
            id: template.id,
            name: template.name,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to archive template.");
      }

      await loadTemplates();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to archive template.",
      );
    }
  };

  const allTemplates = [...templates, ...draftTemplates];

  const filteredTemplates = allTemplates.filter((template) => {
    const matchesSearch = template.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "published" &&
        template.status === "PUBLISHED") ||
      (activeTab === "draft" &&
        template.status === "DRAFT");

    return matchesSearch && matchesTab;
  });

  const formatDate = (value?: string) => {
    if (!value) return "Not updated";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not updated";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>
            Builder <span>/</span> Templates
          </div>

          <h1>{pageTitle}</h1>
          <p>{pageDescription}</p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void loadTemplates()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            type="button"
            className={styles.createButton}
            onClick={() => void createTemplate()}
            disabled={creating}
          >
            <Plus size={18} />
            {creating ? "Creating..." : "Add New Template"}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Layers size={19} />
          </div>
          <div>
            <span>Total Templates</span>
            <strong>{allTemplates.length}</strong>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.publishedIcon}`}>
            <CheckCircle2 size={19} />
          </div>
          <div>
            <span>Published</span>
            <strong>{templates.length}</strong>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.draftIcon}`}>
            <FileText size={19} />
          </div>
          <div>
            <span>Drafts</span>
            <strong>{draftTemplates.length}</strong>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={activeTab === "all" ? styles.activeTab : ""}
            onClick={() => setActiveTab("all")}
          >
            All
            <span>{allTemplates.length}</span>
          </button>

          <button
            type="button"
            className={
              activeTab === "published" ? styles.activeTab : ""
            }
            onClick={() => setActiveTab("published")}
          >
            Published
            <span>{templates.length}</span>
          </button>

          <button
            type="button"
            className={activeTab === "draft" ? styles.activeTab : ""}
            onClick={() => setActiveTab("draft")}
          >
            Drafts
            <span>{draftTemplates.length}</span>
          </button>
        </div>

        <div className={styles.searchBox}>
          <Search size={17} />
          <input
            type="search"
            placeholder="Search templates..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading templates...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <Archive size={28} />
          </div>

          <h2>No templates found</h2>

          <p>
            {search
              ? "Try another search term."
              : "Create your first template to get started."}
          </p>

          {!search && (
            <button
              type="button"
              className={styles.createButton}
              onClick={() => void createTemplate()}
              disabled={creating}
            >
              <Plus size={17} />
              Create Template
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredTemplates.map((template) => (
            <article className={styles.templateCard} key={template.id}>
              <div className={styles.cardPreview}>
                <div className={styles.previewBrowser}>
                  <span />
                  <span />
                  <span />
                </div>

                <div className={styles.previewContent}>
                  <div className={styles.previewHeader} />
                  <div className={styles.previewLine} />
                  <div className={styles.previewLineShort} />
                  <div className={styles.previewBlock} />
                  <div className={styles.previewColumns}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>

                <div className={styles.previewOverlay}>
                  <button
                    type="button"
                    onClick={() => openEditor(template.id)}
                  >
                    <Pencil size={15} />
                    Edit with Builder
                  </button>
                </div>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.cardTitleRow}>
                  <h3>{template.name}</h3>

                  <span
                    className={
                      template.status === "PUBLISHED"
                        ? styles.publishedBadge
                        : styles.draftBadge
                    }
                  >
                    {template.status === "PUBLISHED"
                      ? "Published"
                      : "Draft"}
                  </span>
                </div>

                <p className={styles.cardDescription}>
                  {template.description || "No description"}
                </p>

                <div className={styles.cardFooter}>
                  <span>{formatDate(template.updatedAt)}</span>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      title="Edit template"
                      onClick={() => openEditor(template.id)}
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      type="button"
                      title="Move to archive"
                      onClick={() => void deleteTemplate(template)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
