"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  Save,
  Eye,
  Upload,
  Image as ImageIcon,
  Loader2,
  X,
  PanelsTopLeft,
} from "lucide-react";

import TinyMcePageEditor, {
  type TinyMcePageEditorHandle,
} from "@/components/admin/TinyMcePageEditor";

type PageStatus = "DRAFT" | "PUBLISHED";

type ParentPage = {
  id: string;
  title: string;
  slug: string;
  parentId?: string | null;
  permalink?: string;
};

type EditPageData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  content: string;
  status: string;
  parentId: string | null;
  featuredImage: string;
  seoTitle: string | null;
  seoDescription: string | null;
  focusKeyword: string | null;
};

function extractEditorContent(content: string): string {
  if (!content) return "";

  try {
    const parsed = JSON.parse(content);

    if (parsed && typeof parsed.html === "string") {
      return parsed.html;
    }

    if (parsed && typeof parsed.text === "string") {
      return extractEditorContent(parsed.text);
    }
  } catch {
    // Content is already HTML.
  }

  return content;
}

export default function EditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const pageId = params.id;

  const editorRef = useRef<TinyMcePageEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const [status, setStatus] = useState<PageStatus>("DRAFT");
  const [parentId, setParentId] = useState("");

  const [featuredImage, setFeaturedImage] = useState("");

  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [editorContent, setEditorContent] = useState("");

  const [parentPages, setParentPages] = useState<ParentPage[]>([]);

  // Load existing page and parent pages
  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      try {
        setLoading(true);
        setError("");

        const [pageResponse, parentsResponse] = await Promise.all([
          fetch(`/api/admin/pages/${pageId}`, {
            method: "GET",
            cache: "no-store",
          }),
          fetch("/api/admin/pages", {
            method: "GET",
            cache: "no-store",
          }),
        ]);

        const pageResult = await pageResponse.json();

        if (!pageResponse.ok || !pageResult.success) {
          throw new Error(
            pageResult.message || "Unable to load page."
          );
        }

        if (cancelled) return;

        const page: EditPageData = pageResult.page;

        setTitle(page.title || "");
        setSlug(page.slug || "");
        setDescription(page.description || "");

        setStatus(
          page.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"
        );

        setParentId(page.parentId || "");
        setFeaturedImage(page.featuredImage || "");

        setSeoTitle(page.seoTitle || "");
        setSeoDescription(page.seoDescription || "");
        setFocusKeyword(page.focusKeyword || "");

        // Load parent page dropdown
        if (parentsResponse.ok) {
          const parentsResult = await parentsResponse.json();

          if (!cancelled && parentsResult.success) {
            const pages: ParentPage[] = (
              parentsResult.pages || []
            ).filter(
              (item: ParentPage) => item.id !== pageId
            );

            setParentPages(pages);
          }
        }

        // Store editor content after loading the page
        if (!cancelled) {
          setEditorContent(
            extractEditorContent(page.content || "")
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [pageId]);

  // Generate permalink preview
  const selectedParent = parentPages.find(
    (page) => page.id === parentId
  );

  const parentPermalink = selectedParent?.permalink || "";

  const cleanSlug = slug
    .trim()
    .replace(/^\/+|\/+$/g, "");

  const permalink = parentPermalink
    ? `${parentPermalink.replace(/\/+$/g, "")}/${cleanSlug}/`
    : `/${cleanSlug}/`;

  // Featured image upload
  async function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

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
      setError("Image size must be less than 5 MB.");
      event.target.value = "";
      return;
    }

    try {
      setUploading(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "/api/admin/pages/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success || !result.image) {
        throw new Error(
          result.message || "Image upload failed."
        );
      }

      setFeaturedImage(result.image);
      setSuccess("Featured image uploaded successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Image upload failed."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  // Save page
  async function handleSave(
    publishStatus: PageStatus,
    openBuilder = false
  ) {
    if (!title.trim()) {
      setError("Page title is required.");
      return;
    }

    if (!slug.trim()) {
      setError("Page slug is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const editorHTML = editorRef.current?.getContent() || "";

      const response = await fetch(
        `/api/admin/pages/${pageId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim(),
            description,
            content: JSON.stringify({
              version: 2,
              editor: "tinymce",
              html: editorHTML,
            }),
            status: publishStatus,
            parentId: parentId || null,
            featuredImage,
            seoTitle,
            seoDescription,
            focusKeyword,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to update page."
        );
      }

      setStatus(publishStatus);
      setSuccess("Page updated successfully.");

      if (openBuilder) {
        router.push(`/admin/builder/pages/${pageId}`);
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

  if (loading) {
    return (
      <div className="edit-page-loading">
        <Loader2 size={22} className="loading-icon" />
        <span>Loading page...</span>

        <style jsx>{`
          .edit-page-loading {
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            color: #667085;
            font-size: 14px;
          }

          .loading-icon {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (error && !title) {
    return (
      <div className="edit-page-error">
        <p>{error}</p>
        <button onClick={() => router.back()}>
          Go Back
        </button>

        <style jsx>{`
          .edit-page-error {
            padding: 30px;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            color: #b42318;
          }

          button {
            margin-top: 12px;
            padding: 9px 16px;
            border: 0;
            border-radius: 6px;
            background: #0c2f55;
            color: #fff;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="edit-page-wrapper">
      {/* Header */}
      <div className="edit-page-header">
        <div className="header-left">
          <button
            type="button"
            className="back-button"
            onClick={() => router.push("/admin/pages")}
          >
            <ArrowLeft size={17} />
          </button>

          <div>
            <h1>Edit Page</h1>
            <p>Update your page content and settings.</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="save-draft-button"
            disabled={saving || uploading}
            onClick={() => void handleSave(status, true)}
          >
            <PanelsTopLeft size={16} />
            Edit with Builder
          </button>

          <button
            type="button"
            className="save-draft-button"
            disabled={saving || uploading}
            onClick={() => handleSave("DRAFT")}
          >
            {saving ? (
              <Loader2 size={16} className="loading-icon" />
            ) : (
              <Save size={16} />
            )}
            Save Draft
          </button>

          <button
            type="button"
            className="publish-button"
            disabled={saving || uploading}
            onClick={() => handleSave("PUBLISHED")}
          >
            {saving ? (
              <Loader2 size={16} className="loading-icon" />
            ) : (
              <Eye size={16} />
            )}
            Update
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="message message-error">
          {error}
          <button onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="message message-success">
          {success}
          <button onClick={() => setSuccess("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="edit-page-layout">
        {/* Main Content */}
        <main className="edit-page-main">
          <section className="editor-card">
            <div className="form-group">
              <label htmlFor="page-title">
                Page Title <span>*</span>
              </label>

              <input
                id="page-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter page title"
                maxLength={255}
              />
            </div>

            <div className="form-group slug-group">
              <label htmlFor="page-slug">
                URL Slug <span>*</span>
              </label>

              <input
                id="page-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="page-url"
                maxLength={255}
              />

              <div className="permalink-preview">
                <span>Permalink:</span>
                <strong>{permalink}</strong>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="page-description">
                Short Description
              </label>

              <textarea
                id="page-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a short page description"
                rows={3}
                maxLength={1000}
              />
            </div>
          </section>

          {/* TinyMCE Editor */}
          <section className="editor-card content-card">
            <div className="section-heading">
              <h2>Page Content</h2>
            </div>

            <TinyMcePageEditor
              ref={editorRef}
              initialContent={editorContent}
            />
          </section>

          {/* SEO */}
          <section className="editor-card seo-card" id="seo">
            <div className="section-heading">
              <div>
                <h2>SEO Settings</h2>
                <p>
                  Optimize this page for search engines.
                </p>
              </div>

              <span className="seo-badge">SEO</span>
            </div>

            <div className="form-group">
              <label htmlFor="focus-keyword">
                Focus Keyword
              </label>

              <input
                id="focus-keyword"
                type="text"
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                placeholder="Enter focus keyword"
                maxLength={255}
              />
            </div>

            <div className="form-group">
              <label htmlFor="seo-title">
                SEO Title
              </label>

              <input
                id="seo-title"
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Enter SEO title"
                maxLength={255}
              />

              <div className="field-counter">
                {seoTitle.length}/255 characters
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="seo-description">
                Meta Description
              </label>

              <textarea
                id="seo-description"
                value={seoDescription}
                onChange={(e) =>
                  setSeoDescription(e.target.value)
                }
                placeholder="Enter SEO meta description"
                rows={4}
                maxLength={500}
              />

              <div className="field-counter">
                {seoDescription.length}/500 characters
              </div>
            </div>
          </section>
        </main>

        {/* Sidebar */}
        <aside className="edit-page-sidebar">
          {/* Publish Status */}
          <section className="sidebar-card">
            <h2>Publish</h2>

            <div className="status-row">
              <span>Status</span>

              <strong
                className={
                  status === "PUBLISHED"
                    ? "status-published"
                    : "status-draft"
                }
              >
                {status === "PUBLISHED" ? "Published" : "Draft"}
              </strong>
            </div>

            <div className="sidebar-buttons">
              <button
                type="button"
                className="save-draft-button full-button"
                disabled={saving || uploading}
                onClick={() => handleSave("DRAFT")}
              >
                <Save size={16} />
                Save Draft
              </button>

              <button
                type="button"
                className="publish-button full-button"
                disabled={saving || uploading}
                onClick={() => handleSave("PUBLISHED")}
              >
                <Eye size={16} />
                Update
              </button>
            </div>
          </section>

          {/* Featured Image */}
          <section className="sidebar-card">
            <h2>Featured Image</h2>

            {featuredImage ? (
              <div className="featured-image-preview">
                <img
                  src={featuredImage}
                  alt="Featured image"
                />

                <button
                  type="button"
                  className="remove-image-button"
                  onClick={() => setFeaturedImage("")}
                  title="Remove image"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="empty-image">
                <ImageIcon size={30} />
                <p>No featured image selected.</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleImageUpload}
            />

            <button
              type="button"
              className="upload-image-button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 size={16} className="loading-icon" />
              ) : (
                <Upload size={16} />
              )}

              {uploading ? "Uploading..." : "Upload Image"}
            </button>

            <p className="help-text">
              JPG, PNG or WEBP. Maximum size 5 MB.
            </p>
          </section>

          {/* Parent Page */}
          <section className="sidebar-card">
            <h2>Page Attributes</h2>

            <div className="form-group">
              <label htmlFor="parent-page">
                Parent Page
              </label>

              <select
                id="parent-page"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">No Parent</option>

                {parentPages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title}
                  </option>
                ))}
              </select>
            </div>

            <p className="help-text">
              Select a parent page to create a page hierarchy.
            </p>
          </section>
        </aside>
      </div>

      <style jsx>{`
        .edit-page-wrapper {
          width: 100%;
          color: #263445;
          padding-bottom: 30px;
        }

        .edit-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .header-left,
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-left h1 {
          margin: 0 0 5px;
          font-size: 24px;
          font-weight: 700;
          color: #172b4d;
        }

        .header-left p {
          margin: 0;
          color: #667085;
          font-size: 13px;
        }

        .back-button {
          width: 39px;
          height: 39px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #dce2ea;
          border-radius: 7px;
          background: #fff;
          color: #344054;
          cursor: pointer;
        }

        .back-button:hover {
          background: #f1f5f9;
        }

        .save-draft-button,
        .publish-button {
          min-height: 40px;
          padding: 9px 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #0c2f55;
          border-radius: 7px;
          background: #fff;
          color: #0c2f55;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .publish-button {
          background: #0c2f55;
          color: #fff;
        }

        .save-draft-button:hover {
          background: #f0f5fa;
        }

        .publish-button:hover {
          background: #3984e8;
          border-color: #3984e8;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .edit-page-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 290px;
          gap: 20px;
          align-items: start;
        }

        .edit-page-main,
        .edit-page-sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .editor-card,
        .sidebar-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 20px;
          min-width: 0;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 19px;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-group label {
          color: #344054;
          font-size: 13px;
          font-weight: 600;
        }

        .form-group label span {
          color: #dc2626;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 12px;
          border: 1px solid #d0d5dd;
          border-radius: 6px;
          background: #fff;
          color: #263445;
          font-family: inherit;
          font-size: 14px;
          outline: none;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          border-color: #3984e8;
          box-shadow: 0 0 0 3px rgba(57, 132, 232, 0.1);
        }

        .form-group textarea {
          resize: vertical;
          line-height: 1.6;
        }

        .permalink-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          font-size: 12px;
          color: #667085;
        }

        .permalink-preview strong {
          color: #1765b3;
          font-weight: 500;
          overflow-wrap: anywhere;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .section-heading h2,
        .sidebar-card h2 {
          margin: 0;
          color: #172b4d;
          font-size: 15px;
          font-weight: 700;
        }

        .section-heading p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 12px;
        }

        .seo-badge {
          padding: 5px 10px;
          border-radius: 5px;
          background: #eaf3ff;
          color: #2271b1;
          font-size: 12px;
          font-weight: 700;
        }

        .sidebar-card h2 {
          margin-bottom: 17px;
        }

        .status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-top: 1px solid #edf0f4;
          border-bottom: 1px solid #edf0f4;
          font-size: 13px;
        }

        .status-row span {
          color: #667085;
        }

        .status-published {
          color: #16803c;
        }

        .status-draft {
          color: #b7791f;
        }

        .sidebar-buttons {
          display: flex;
          flex-direction: column;
          gap: 9px;
          margin-top: 15px;
        }

        .full-button {
          width: 100%;
        }

        .empty-image {
          min-height: 125px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 1px dashed #cbd5e1;
          border-radius: 7px;
          background: #f8fafc;
          color: #98a2b3;
        }

        .empty-image p {
          margin: 0;
          font-size: 12px;
        }

        .featured-image-preview {
          position: relative;
          width: 100%;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          background: #f8fafc;
        }

        .featured-image-preview img {
          display: block;
          width: 100%;
          max-height: 220px;
          object-fit: contain;
        }

        .remove-image-button {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 5px;
          background: #dc2626;
          color: #fff;
          cursor: pointer;
        }

        .upload-image-button {
          width: 100%;
          min-height: 39px;
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #0c2f55;
          border-radius: 6px;
          background: #fff;
          color: #0c2f55;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .upload-image-button:hover {
          background: #f0f5fa;
        }

        .help-text {
          margin: 9px 0 0;
          color: #98a2b3;
          font-size: 11px;
          line-height: 1.5;
        }

        .field-counter {
          color: #98a2b3;
          font-size: 11px;
          text-align: right;
        }

        .message {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          margin-bottom: 18px;
          border-radius: 7px;
          font-size: 13px;
        }

        .message button {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .message-error {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .message-error button {
          color: #b42318;
        }

        .message-success {
          border: 1px solid #abefc6;
          background: #ecfdf3;
          color: #067647;
        }

        .message-success button {
          color: #067647;
        }

        .loading-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1000px) {
          .edit-page-layout {
            grid-template-columns: minmax(0, 1fr) 260px;
          }
        }

        @media (max-width: 760px) {
          .edit-page-layout {
            grid-template-columns: 1fr;
          }

          .edit-page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }
        }

        @media (max-width: 480px) {
          .editor-card,
          .sidebar-card {
            padding: 14px;
          }

          .header-left h1 {
            font-size: 21px;
          }
        }
      `}</style>
    </div>
  );
}