
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Globe,
  Loader2,
  ImagePlus,
  Trash2,
  Link as LinkIcon,
  FolderTree,
  Search,
  FileText,
  Settings2,
  PanelsTopLeft,
} from "lucide-react";

import TinyMcePageEditor, {
  type TinyMcePageEditorHandle,
} from "@/components/admin/TinyMcePageEditor";

type ParentPage = {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  permalink: string;
};

type PageStatus = "DRAFT" | "PUBLISHED";

export default function NewPage() {
  const router = useRouter();
  const editorRef = useRef<TinyMcePageEditorHandle>(null);

  // Every new page starts with empty fields.
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");

  const [parentPages, setParentPages] = useState<ParentPage[]>([]);
  const [loadingParents, setLoadingParents] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Load existing pages only for the Parent Page dropdown.
  useEffect(() => {
    let active = true;

    async function loadParentPages() {
      try {
        const response = await fetch("/api/admin/pages", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load pages.");
        }

        if (active) {
          setParentPages(
            Array.isArray(result.pages) ? result.pages : []
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load parent pages."
          );
        }
      } finally {
        if (active) {
          setLoadingParents(false);
        }
      }
    }

    void loadParentPages();

    return () => {
      active = false;
    };
  }, []);

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    setSlug(createSlug(value));
  }

  const selectedParent = parentPages.find(
    (page) => page.id === parentId
  );

  const cleanSlug = slug
    .replace(/^\/+|\/+$/g, "")
    .trim();

  const permalink = selectedParent
    ? `${selectedParent.permalink.replace(/\/+$/, "")}/${cleanSlug}/`
    : `/${cleanSlug}/`;

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #dce2ea",
    borderRadius: 7,
    fontSize: 14,
    outline: "none",
    background: "#fff",
    color: "#263445",
    boxSizing: "border-box",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 650,
    color: "#344054",
    marginBottom: 7,
  };

  const cardStyle: CSSProperties = {
    background: "#fff",
    border: "1px solid #e5eaf0",
    borderRadius: 10,
    padding: 18,
    marginBottom: 16,
  };

  const headingStyle: CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: "#0c2f55",
    margin: "0 0 15px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const primaryButton: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "10px 15px",
    border: "none",
    borderRadius: 7,
    background: "#0c2f55",
    color: "#fff",
    fontWeight: 650,
    fontSize: 13,
    cursor: "pointer",
  };

  async function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setNotice("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG and WEBP images are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Featured image must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/pages/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.image) {
        throw new Error(result.message || "Image upload failed.");
      }

      setFeaturedImage(result.image);
      setNotice("Featured image uploaded successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload image."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function savePage(status: PageStatus, openBuilder = false) {
    if (saving) return;

    setError("");
    setNotice("");

    if (!title.trim()) {
      setError("Please enter page title.");
      return;
    }

    if (!cleanSlug) {
      setError("Please enter a valid page slug.");
      return;
    }

    if (uploading) {
      setError("Please wait until image upload finishes.");
      return;
    }

    const htmlContent = editorRef.current?.getContent();

    if (htmlContent === undefined) {
      setError("Editor is not ready. Please wait and try again.");
      return;
    }

    const pageContent = JSON.stringify({
      version: 2,
      editor: "tinymce",
      html: htmlContent,
    });

    setSaving(true);

    try {
      const response = await fetch("/api/admin/pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          slug: cleanSlug,
          description,
          content: pageContent,
          status,
          parentId: parentId || null,
          featuredImage,
          seoTitle,
          seoDescription,
          focusKeyword,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to create page.");
      }

      if (openBuilder) {
        const pageId = result.page?.id;
        if (!pageId) {
          throw new Error("Page was saved, but its builder URL could not be determined.");
        }
        router.push(`/admin/builder/pages/${pageId}`);
      } else {
        router.push("/admin/pages");
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  const isBusy = saving || uploading;

  return (
    <div className="new-page-wrapper">
      <style jsx>{`
        .new-page-wrapper {
          min-height: 100vh;
          padding: 24px;
          background: #f4f6fa;
          color: #263445;
        }

        .page-editor-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 20px;
          align-items: start;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 22px;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .alert {
          padding: 12px;
          margin-bottom: 16px;
          border-radius: 7px;
          font-size: 13px;
        }

        .alert-error {
          color: #b42318;
          background: #fef3f2;
          border: 1px solid #fecdca;
        }

        .alert-success {
          color: #067647;
          background: #ecfdf3;
          border: 1px solid #abefc6;
        }

        .editor-tip {
          padding: 13px;
          border-radius: 8px;
          background: #eef5ff;
          border: 1px solid #d7e7ff;
          color: #315b8a;
          font-size: 12px;
          line-height: 1.6;
        }

        .muted-text {
          color: #667085;
          font-size: 12px;
          line-height: 1.6;
        }

        .action-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .page-editor-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .new-page-wrapper {
            padding: 14px;
          }
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1
            style={{
              color: "#0c2f55",
              fontSize: 25,
              margin: "0 0 5px",
            }}
          >
            Add New Page
          </h1>

          <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>
            Create your page using the WordPress-style visual editor.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void savePage("DRAFT", true)}
            style={primaryButton}
          >
            <PanelsTopLeft size={15} /> Save Draft & Edit with Builder
          </button>
          <Link
            href="/admin/pages"
            style={{
              ...primaryButton,
              background: "#fff",
              color: "#344054",
              border: "1px solid #dce2ea",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={15} />
            Back to Pages
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="alert alert-success">
          {notice}
        </div>
      )}

      <div className="page-editor-grid">
        <main>
          {/* PAGE DETAILS */}
          <section style={cardStyle}>
            <label htmlFor="new-page-title" style={labelStyle}>
              Page Title *
            </label>

            <input
              id="new-page-title"
              key="new-page-title"
              type="text"
              name="new_page_title_field"
              autoComplete="new-password"
              data-lpignore="true"
              data-form-type="other"
              spellCheck={false}
              style={{
                ...inputStyle,
                fontSize: 21,
                fontWeight: 700,
                padding: 14,
              }}
              value={title}
              onChange={(event) =>
                handleTitleChange(event.target.value)
              }
              placeholder="Enter page title"
              required
            />

            <div style={{ marginTop: 13 }}>
              <label style={labelStyle}>Permalink</label>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 7,
                  background: "#f0f6ff",
                  color: "#1765b3",
                  fontSize: 13,
                  overflowWrap: "anywhere",
                }}
              >
                <LinkIcon size={15} />
                {permalink || "/"}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label htmlFor="new-page-slug" style={labelStyle}>
                Page Slug *
              </label>

              <input
                id="new-page-slug"
                key="new-page-slug"
                type="text"
                name="new_page_slug_field"
                autoComplete="new-password"
                data-lpignore="true"
                data-form-type="other"
                style={inputStyle}
                value={slug}
                onChange={(event) =>
                  setSlug(createSlug(event.target.value))
                }
                placeholder="about-us"
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <label
                htmlFor="new-page-description"
                style={labelStyle}
              >
                Short Description
              </label>

              <textarea
                id="new-page-description"
                name="new_page_description_field"
                autoComplete="off"
                style={{
                  ...inputStyle,
                  minHeight: 85,
                  resize: "vertical",
                }}
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Enter a short page description"
              />
            </div>
          </section>

          {/* PAGE EDITOR */}
          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 15,
              }}
            >
              <h2 style={{ ...headingStyle, margin: 0 }}>
                <FileText size={18} />
                Page Content
              </h2>

              <span className="muted-text">
                Visual / Code Editor
              </span>
            </div>

            <TinyMcePageEditor ref={editorRef} />

            <p className="muted-text" style={{ marginBottom: 0 }}>
              Use Visual mode to format content and Code mode to edit
              HTML. Use the Image button to upload images into your page.
            </p>
          </section>

          {/* SEO SETTINGS */}
          <section style={cardStyle}>
            <h2 style={headingStyle}>
              <Search size={18} />
              SEO Settings
            </h2>

            <div style={{ marginBottom: 15 }}>
              <label htmlFor="new-page-seo-title" style={labelStyle}>
                SEO Title
              </label>

              <input
                id="new-page-seo-title"
                name="new_page_seo_title"
                autoComplete="off"
                style={inputStyle}
                value={seoTitle}
                onChange={(event) =>
                  setSeoTitle(event.target.value)
                }
                placeholder="Enter SEO title"
              />

              <small className="muted-text">
                {seoTitle.length}/60 characters
              </small>
            </div>

            <div style={{ marginBottom: 15 }}>
              <label
                htmlFor="new-page-seo-description"
                style={labelStyle}
              >
                SEO Description
              </label>

              <textarea
                id="new-page-seo-description"
                name="new_page_seo_description"
                autoComplete="off"
                style={{
                  ...inputStyle,
                  minHeight: 85,
                  resize: "vertical",
                }}
                value={seoDescription}
                onChange={(event) =>
                  setSeoDescription(event.target.value)
                }
                placeholder="Enter SEO meta description"
              />

              <small className="muted-text">
                {seoDescription.length}/160 characters
              </small>
            </div>

            <div>
              <label
                htmlFor="new-page-focus-keyword"
                style={labelStyle}
              >
                Focus Keyword
              </label>

              <input
                id="new-page-focus-keyword"
                name="new_page_focus_keyword"
                autoComplete="off"
                style={inputStyle}
                value={focusKeyword}
                onChange={(event) =>
                  setFocusKeyword(event.target.value)
                }
                placeholder="Enter focus keyword"
              />
            </div>
          </section>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside>
          {/* PUBLISH */}
          <section style={cardStyle}>
            <h2 style={headingStyle}>
              <Globe size={18} />
              Publish
            </h2>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <span style={{ color: "#667085" }}>Status</span>
              <strong>New Page</strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <span style={{ color: "#667085" }}>Visibility</span>
              <strong>Public</strong>
            </div>

            <button
              type="button"
              className="action-button"
              disabled={isBusy}
              onClick={() => void savePage("DRAFT")}
              style={{
                ...primaryButton,
                width: "100%",
                background: "#fff",
                color: "#0c2f55",
                border: "1px solid #0c2f55",
                marginBottom: 9,
              }}
            >
              {saving ? (
                <Loader2 size={15} />
              ) : (
                <Save size={15} />
              )}
              Save Draft
            </button>

            <button
              type="button"
              className="action-button"
              disabled={isBusy}
              onClick={() => void savePage("PUBLISHED")}
              style={{
                ...primaryButton,
                width: "100%",
              }}
            >
              {saving ? (
                <Loader2 size={15} />
              ) : (
                <Globe size={15} />
              )}
              {saving ? "Saving..." : "Publish Page"}
            </button>
          </section>

          {/* FEATURED IMAGE */}
          <section style={cardStyle}>
            <h2 style={headingStyle}>
              <ImagePlus size={18} />
              Featured Image
            </h2>

            {featuredImage ? (
              <>
                <img
                  src={featuredImage}
                  alt="Featured page"
                  style={{
                    width: "100%",
                    maxHeight: 190,
                    objectFit: "contain",
                    borderRadius: 7,
                    background: "#f5f7fb",
                  }}
                />

                <button
                  type="button"
                  onClick={() => setFeaturedImage("")}
                  style={{
                    ...primaryButton,
                    width: "100%",
                    marginTop: 10,
                    background: "#fff5f4",
                    color: "#b42318",
                    border: "1px solid #fecdca",
                  }}
                >
                  <Trash2 size={15} />
                  Remove Image
                </button>
              </>
            ) : (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 9,
                  padding: 22,
                  border: "2px dashed #cbd5e1",
                  borderRadius: 8,
                  cursor: uploading ? "wait" : "pointer",
                  background: "#fafcff",
                  color: "#475467",
                  textAlign: "center",
                }}
              >
                {uploading ? (
                  <Loader2 size={27} />
                ) : (
                  <ImagePlus size={27} color="#3984e8" />
                )}

                <strong style={{ fontSize: 13 }}>
                  {uploading
                    ? "Uploading..."
                    : "Upload Featured Image"}
                </strong>

                <small className="muted-text">
                  JPG, PNG, WEBP · Max 5 MB
                </small>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  style={{ display: "none" }}
                />
              </label>
            )}
          </section>

          {/* PAGE ATTRIBUTES */}
          <section style={cardStyle}>
            <h2 style={headingStyle}>
              <FolderTree size={18} />
              Page Attributes
            </h2>

            <label htmlFor="new-page-parent" style={labelStyle}>
              Parent Page
            </label>

            <select
              id="new-page-parent"
              name="new_page_parent"
              style={inputStyle}
              value={parentId}
              onChange={(event) =>
                setParentId(event.target.value)
              }
              disabled={loadingParents}
            >
              <option value="">
                {loadingParents
                  ? "Loading pages..."
                  : "None — Top Level Page"}
              </option>

              {parentPages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title} — {page.permalink}
                </option>
              ))}
            </select>

            <small
              className="muted-text"
              style={{ display: "block", marginTop: 8 }}
            >
              Select a parent page to create a child page.
            </small>
          </section>

          {/* PAGE OPTIONS */}
          <section style={cardStyle}>
            <h2 style={headingStyle}>
              <Settings2 size={18} />
              Page Options
            </h2>

            <p className="muted-text" style={{ margin: 0 }}>
              Revision history and Duplicate Page will be connected
              through the Edit Page workflow.
            </p>
          </section>

          <div className="editor-tip">
            <strong>Editor tip</strong>
            <br />
            Use Visual mode for normal content editing and Code mode
            for HTML. Save Draft to keep the page unpublished, or
            Publish Page to publish it.
          </div>
        </aside>
      </div>
    </div>
  );
}
