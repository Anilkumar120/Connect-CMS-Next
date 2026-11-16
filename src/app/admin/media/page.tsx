
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  Upload,
  Search,
  Grid2X2,
  List,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Archive,
  File,
  Trash2,
  RotateCcw,
  X,
  Loader2,
  Copy,
  Check,
  Eye,
  Download,
  RefreshCw,
  FolderOpen,
  AlertCircle,
  Save,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { upload } from "@vercel/blob/client";

import styles from "./MediaLibrary.module.css";

type MediaItem = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  url: string;
  altText: string | null;
  title: string | null;
  caption: string | null;
  description: string | null;
  isDeleted: boolean;
  createdAt: string;
};

type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "completed" | "error";
  message?: string;
};

type ViewType = "library" | "trash";
type FilterType = "all" | "image" | "video" | "audio" | "document";
type LayoutType = "grid" | "list";

const CHUNK_SIZE = 8 * 1024 * 1024;

const filters: { label: string; value: FilterType }[] = [
  { label: "All files", value: "all" },
  { label: "Images", value: "image" },
  { label: "Videos", value: "video" },
  { label: "Audio", value: "audio" },
  { label: "Documents", value: "document" },
];

function formatSize(bytes: number) {
  if (!bytes || bytes < 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 2
  )} ${units[index]}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getCategory(mimeType: string) {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  return "Document";
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon size={25} />;
  if (mimeType.startsWith("video/")) return <Video size={25} />;
  if (mimeType.startsWith("audio/")) return <Music size={25} />;

  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("compressed")
  ) {
    return <Archive size={25} />;
  }

  if (mimeType.includes("pdf") || mimeType.startsWith("text/")) {
    return <FileText size={25} />;
  }

  return <File size={25} />;
}

export default function MediaLibraryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [view, setView] = useState<ViewType>("library");
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<LayoutType>("grid");

  const [selected, setSelected] = useState<string[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const [editAltText, setEditAltText] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const overallProgress = useMemo(() => {
    if (!uploads.length) return 0;

    const total = uploads.reduce(
      (sum, item) => sum + item.progress,
      0
    );

    return Math.round(total / uploads.length);
  }, [uploads]);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        view,
        search,
        type: filter,
      });

      const response = await fetch(
        `/api/admin/media?${params.toString()}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load media.");
      }

      const items: MediaItem[] = Array.isArray(result.media)
        ? result.media
        : [];

      setMedia(items);
      setSelected([]);

      setPreview((current) => {
        if (!current) return null;
        return items.find((item) => item.id === current.id) || null;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load media."
      );
    } finally {
      setLoading(false);
    }
  }, [view, search, filter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadMedia();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadMedia]);

  useEffect(() => {
    if (!preview) {
      setEditAltText("");
      setEditTitle("");
      setEditCaption("");
      setEditDescription("");
      return;
    }

    setEditAltText(preview.altText || "");
    setEditTitle(preview.title || "");
    setEditCaption(preview.caption || "");
    setEditDescription(preview.description || "");
  }, [preview?.id]);

  const updateUpload = (
    id: string,
    updates: Partial<UploadItem>
  ) => {
    setUploads((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const uploadSingleFile = async (
  file: File,
  uploadId: string
): Promise<boolean> => {
  let serverUploadId = "";

  try {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";

    if (file.size <= 0 || file.size > 5 * 1024 * 1024 * 1024) {
      throw new Error("File size must be between 1 byte and 5 GB.");
    }

    if (process.env.NODE_ENV === "production") {
      const blob = await upload(
        `media/${file.name.replace(/[\\/]/g, "-")}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/admin/media/upload",
          multipart: true,
          clientPayload: JSON.stringify({
            originalName: file.name,
            size: file.size,
            mimeType: file.type,
          }),
          onUploadProgress: ({ percentage }) => {
            updateUpload(uploadId, {
              progress: Math.min(99, Math.round(percentage)),
            });
          },
        }
      );

      const registerResponse = await fetch("/api/admin/media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "register-blob",
          url: blob.url,
          pathname: blob.pathname,
          originalName: file.name,
        }),
      });

      const registerResult = await registerResponse.json();

      if (!registerResponse.ok || !registerResult.success) {
        throw new Error(
          registerResult.message || "Unable to register uploaded file."
        );
      }
    } else {
      const initData = new FormData();
      initData.append("action", "init");
      initData.append("fileName", file.name);
      initData.append("size", String(file.size));
      initData.append("mimeType", file.type || "application/octet-stream");

      const initResponse = await fetch("/api/admin/media", {
        method: "POST",
        body: initData,
      });

      const initResult = await initResponse.json();

      if (!initResponse.ok || !initResult.success) {
        throw new Error(initResult.message || "Upload could not start.");
      }

      serverUploadId = initResult.uploadId;

      if (!serverUploadId) {
        throw new Error("Upload could not be initialized.");
      }

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      for (let index = 0; index < totalChunks; index++) {
        const start = index * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const chunkData = new FormData();
        chunkData.append("action", "chunk");
        chunkData.append("uploadId", serverUploadId);
        chunkData.append("chunkIndex", String(index));
        chunkData.append("chunk", chunk, `${file.name}.part`);

        const response = await fetch("/api/admin/media", {
          method: "POST",
          body: chunkData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || `Upload failed at chunk ${index + 1}.`
          );
        }

        updateUpload(uploadId, {
          progress: Math.round(((index + 1) / totalChunks) * 95),
        });
      }

      const completeData = new FormData();
      completeData.append("action", "complete");
      completeData.append("uploadId", serverUploadId);

      const completeResponse = await fetch("/api/admin/media", {
        method: "POST",
        body: completeData,
      });

      const completeResult = await completeResponse.json();

      if (!completeResponse.ok || !completeResult.success) {
        throw new Error(
          completeResult.message || "Unable to complete upload."
        );
      }
    }

    updateUpload(uploadId, {
      progress: 100,
      status: "completed",
      message: "Uploaded successfully",
    });

    return true;
  } catch (err) {
    if (serverUploadId) {
      const cancelData = new FormData();
      cancelData.append("action", "cancel");
      cancelData.append("uploadId", serverUploadId);

      await fetch("/api/admin/media", {
        method: "POST",
        body: cancelData,
      }).catch(() => undefined);
    }

    updateUpload(uploadId, {
      status: "error",
      message: err instanceof Error ? err.message : "Upload failed.",
    });

    return false;
  }
};

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);

    if (!files.length || uploading) return;

    setError("");
    setMessage("");
    setUploading(true);

    const newUploads: UploadItem[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      progress: 0,
      status: "uploading",
    }));

    setUploads(newUploads);

    let successful = 0;
    let failed = 0;

    // Sequential upload prevents overloading the server.
    for (let index = 0; index < files.length; index++) {
      const success = await uploadSingleFile(
        files[index],
        newUploads[index].id
      );

      if (success) successful++;
      else failed++;
    }

    setUploading(false);

    await loadMedia();

    setMessage(
      `${successful} file(s) uploaded successfully. ${
        failed ? `${failed} file(s) failed.` : ""
      }`
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files) {
      void uploadFiles(event.target.files);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    if (event.dataTransfer.files.length) {
      void uploadFiles(event.dataTransfer.files);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const selectAll = () => {
    if (selected.length === media.length) {
      setSelected([]);
    } else {
      setSelected(media.map((item) => item.id));
    }
  };

  const copyUrl = async (url: string) => {
    try {
      const absoluteUrl = new URL(
        url,
        window.location.origin
      ).toString();

      await navigator.clipboard.writeText(absoluteUrl);

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy URL.");
    }
  };

  const saveMediaDetails = async () => {
    if (!preview || preview.isDeleted || savingDetails) return;

    setSavingDetails(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/media", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update",
          id: preview.id,
          altText: editAltText,
          title: editTitle,
          caption: editCaption,
          description: editDescription,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to save media details."
        );
      }

      const updated: MediaItem = result.media;

      setPreview(updated);

      setMedia((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      );

      setMessage("Media details saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save media details."
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const runBulkAction = async (
    method: "PATCH" | "DELETE",
    body: Record<string, unknown>
  ) => {
    try {
      const response = await fetch("/api/admin/media", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Action failed.");
      }

      setMessage(result.message || "Action completed.");
      setSelected([]);
      setPreview(null);

      await loadMedia();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Action failed."
      );
    }
  };

  const performBulkAction = async (
    action: "trash" | "restore"
  ) => {
    if (!selected.length) return;

    const confirmed = window.confirm(
      action === "trash"
        ? `Move ${selected.length} selected file(s) to Trash?`
        : `Restore ${selected.length} selected file(s)?`
    );

    if (!confirmed) return;

    await runBulkAction("PATCH", {
      action,
      ids: selected,
    });
  };

  const permanentlyDelete = async () => {
    if (!selected.length) return;

    const confirmed = window.confirm(
      `Permanently delete ${selected.length} selected file(s)? This cannot be undone.`
    );

    if (!confirmed) return;

    await runBulkAction("DELETE", {
      ids: selected,
    });
  };

  const runSingleAction = async (
    method: "PATCH" | "DELETE",
    body: Record<string, unknown>
  ) => {
    await runBulkAction(method, body);
  };

  const performSingleTrash = async (id: string) => {
    const confirmed = window.confirm("Move this file to Trash?");
    if (!confirmed) return;

    await runSingleAction("PATCH", {
      action: "trash",
      ids: [id],
    });
  };

  const performSingleRestore = async (id: string) => {
    await runSingleAction("PATCH", {
      action: "restore",
      ids: [id],
    });
  };

  const performSingleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Permanently delete this file? This cannot be undone."
    );

    if (!confirmed) return;

    await runSingleAction("DELETE", {
      ids: [id],
    });
  };

  const navigatePreview = (direction: -1 | 1) => {
    if (!preview) return;

    const currentIndex = media.findIndex(
      (item) => item.id === preview.id
    );

    if (currentIndex === -1) return;

    const nextItem = media[currentIndex + direction];

    if (nextItem) {
      setPreview(nextItem);
    }
  };

  const previewIndex = preview
    ? media.findIndex((item) => item.id === preview.id)
    : -1;

  const previewUrl = preview
    ? new URL(preview.url, typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost"
      ).toString()
    : "";

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Media Library</h1>
          <p>
            Manage images, videos, documents and other uploaded files.
          </p>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={17} />
          Upload Files
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className={styles.hiddenInput}
          onChange={handleFileChange}
        />
      </div>

      <div
        className={`${styles.dropZone} ${
          dragging ? styles.dragging : ""
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className={styles.dropIcon}>
          <Upload size={25} />
        </div>

        <div className={styles.dropContent}>
          <strong>Drop files here to upload</strong>
          <span>
            or{" "}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              browse files
            </button>
          </span>
          <small>
            Images, GIF, SVG, videos, audio, PDF, documents and archives.
            Maximum 5 GB per file, subject to server limits.
          </small>
        </div>
      </div>

      {uploads.length > 0 && (
        <section className={styles.uploadPanel}>
          <div className={styles.uploadPanelHeader}>
            <div>
              <strong>Upload Queue</strong>
              <span>
                {uploads.filter((item) => item.status === "completed").length}
                {" "}completed ·{" "}
                {uploads.filter((item) => item.status === "error").length}
                {" "}failed
              </span>
            </div>

            <div className={styles.overallProgress}>
              <strong>{overallProgress}%</strong>
              <span>Overall progress</span>
            </div>
          </div>

          <div className={styles.overallBar}>
            <span style={{ width: `${overallProgress}%` }} />
          </div>

          <div className={styles.uploadList}>
            {uploads.map((item) => (
              <div className={styles.uploadItem} key={item.id}>
                <div className={styles.uploadFileIcon}>
                  <File size={18} />
                </div>

                <div className={styles.uploadFileInfo}>
                  <strong title={item.name}>{item.name}</strong>

                  <div className={styles.uploadProgressTrack}>
                    <span
                      className={
                        item.status === "error"
                          ? styles.failedProgress
                          : ""
                      }
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <small>
                    {item.message ||
                      (item.status === "uploading"
                        ? `${item.progress}% uploaded`
                        : "Completed")}
                  </small>
                </div>

                <div className={styles.uploadStatus}>
                  {item.status === "uploading" && (
                    <Loader2 className={styles.spin} size={18} />
                  )}

                  {item.status === "completed" && (
                    <Check size={18} className={styles.successIcon} />
                  )}

                  {item.status === "error" && (
                    <AlertCircle size={18} className={styles.errorIcon} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && (
        <div className={styles.errorMessage} role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {message && (
        <div className={styles.successMessage}>
          <Check size={17} />
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className={styles.libraryCard}>
        <div className={styles.libraryTabs}>
          <button
            type="button"
            className={view === "library" ? styles.activeTab : ""}
            onClick={() => {
              setView("library");
              setPreview(null);
            }}
          >
            <FolderOpen size={17} />
            Media Library
          </button>

          <button
            type="button"
            className={view === "trash" ? styles.activeTab : ""}
            onClick={() => {
              setView("trash");
              setPreview(null);
            }}
          >
            <Trash2 size={17} />
            Trash
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={17} />
            <input
              type="search"
              placeholder="Search media..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className={styles.filterGroup}>
            {filters.map((item) => (
              <button
                type="button"
                key={item.value}
                className={
                  filter === item.value ? styles.activeFilter : ""
                }
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.viewControls}>
            <button
              type="button"
              className={layout === "grid" ? styles.activeView : ""}
              onClick={() => setLayout("grid")}
              aria-label="Grid view"
            >
              <Grid2X2 size={18} />
            </button>

            <button
              type="button"
              className={layout === "list" ? styles.activeView : ""}
              onClick={() => setLayout("list")}
              aria-label="List view"
            >
              <List size={19} />
            </button>

            <button
              type="button"
              onClick={() => void loadMedia()}
              aria-label="Refresh media"
              disabled={loading}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </div>

        <div className={styles.selectionBar}>
          <label className={styles.selectAll}>
            <input
              type="checkbox"
              checked={
                media.length > 0 && selected.length === media.length
              }
              onChange={selectAll}
            />
            Select all
          </label>

          <span>{media.length} file(s)</span>

          {selected.length > 0 && (
            <div className={styles.bulkActions}>
              <span>{selected.length} selected</span>

              {view === "library" ? (
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => void performBulkAction("trash")}
                >
                  <Trash2 size={15} />
                  Move to Trash
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.restoreButton}
                    onClick={() => void performBulkAction("restore")}
                  >
                    <RotateCcw size={15} />
                    Restore
                  </button>

                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => void permanentlyDelete()}
                  >
                    <Trash2 size={15} />
                    Delete permanently
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <Loader2 className={styles.spin} size={27} />
            <span>Loading media...</span>
          </div>
        ) : media.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FolderOpen size={35} />
            </div>
            <h3>
              {view === "trash" ? "Trash is empty" : "No media found"}
            </h3>
            <p>
              {view === "trash"
                ? "Deleted files will appear here."
                : "Upload files or change your search and filters."}
            </p>
          </div>
        ) : (
          <div className={styles.mediaWorkspace}>
            <div className={styles.mediaBrowser}>
              {layout === "grid" ? (
                <div className={styles.mediaGrid}>
                  {media.map((item) => {
                    const isImage = item.mimeType.startsWith("image/");
                    const isVideo = item.mimeType.startsWith("video/");

                    return (
                      <article
                        className={`${styles.mediaCard} ${
                          preview?.id === item.id
                            ? styles.currentItem
                            : ""
                        }`}
                        key={item.id}
                      >
                        <label className={styles.cardCheckbox}>
                          <input
                            type="checkbox"
                            checked={selected.includes(item.id)}
                            onChange={() => toggleSelect(item.id)}
                          />
                        </label>

                        <button
                          type="button"
                          className={styles.mediaPreview}
                          onClick={() => setPreview(item)}
                          title="View attachment details"
                        >
                          {isImage ? (
                            <img
                              src={item.url}
                              alt={item.altText || item.originalName}
                            />
                          ) : isVideo ? (
                            <div className={styles.filePreviewIcon}>
                              <Video size={36} />
                              <span>VIDEO</span>
                            </div>
                          ) : (
                            <div className={styles.filePreviewIcon}>
                              <FileIcon mimeType={item.mimeType} />
                              <span>
                                {item.mimeType.split("/").pop()?.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </button>

                        <div className={styles.mediaCardInfo}>
                          <strong title={item.originalName}>
                            {item.originalName}
                          </strong>

                          <span>
                            {formatSize(item.fileSize)} ·{" "}
                            {formatDate(item.createdAt)}
                          </span>

                          <div className={styles.cardActions}>
                            <button
                              type="button"
                              onClick={() => setPreview(item)}
                              title="Details"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => void copyUrl(item.url)}
                              title="Copy URL"
                            >
                              <Copy size={16} />
                            </button>

                            {view === "library" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void performSingleTrash(item.id)
                                }
                                title="Move to Trash"
                              >
                                <Trash2 size={16} />
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void performSingleRestore(item.id)
                                  }
                                  title="Restore"
                                >
                                  <RotateCcw size={16} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void performSingleDelete(item.id)
                                  }
                                  title="Delete permanently"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.listWrapper}>
                  <table className={styles.mediaTable}>
                    <thead>
                      <tr>
                        <th className={styles.checkColumn}></th>
                        <th>File</th>
                        <th>Type</th>
                        <th>File size</th>
                        <th>Date uploaded</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {media.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            preview?.id === item.id
                              ? styles.currentTableRow
                              : ""
                          }
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.includes(item.id)}
                              onChange={() => toggleSelect(item.id)}
                            />
                          </td>

                          <td>
                            <button
                              type="button"
                              className={styles.tableFile}
                              onClick={() => setPreview(item)}
                            >
                              <FileIcon mimeType={item.mimeType} />
                              <span title={item.originalName}>
                                {item.originalName}
                              </span>
                            </button>
                          </td>

                          <td>{getCategory(item.mimeType)}</td>
                          <td>{formatSize(item.fileSize)}</td>
                          <td>{formatDate(item.createdAt)}</td>

                          <td>
                            <div className={styles.tableActions}>
                              <button
                                type="button"
                                onClick={() => setPreview(item)}
                                title="Details"
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                onClick={() => void copyUrl(item.url)}
                                title="Copy URL"
                              >
                                <Copy size={16} />
                              </button>

                              {view === "library" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void performSingleTrash(item.id)
                                  }
                                  title="Move to Trash"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void performSingleRestore(item.id)
                                    }
                                    title="Restore"
                                  >
                                    <RotateCcw size={16} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void performSingleDelete(item.id)
                                    }
                                    title="Delete permanently"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {preview && (
              <aside className={styles.attachmentSidebar}>
                <div className={styles.attachmentHeader}>
                  <div>
                    <h3>Attachment Details</h3>
                    <span>Media information and settings</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    aria-label="Close attachment details"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className={styles.attachmentNavigation}>
                  <button
                    type="button"
                    onClick={() => navigatePreview(-1)}
                    disabled={previewIndex <= 0}
                    aria-label="Previous media"
                  >
                    <ChevronLeft size={18} />
                    Previous
                  </button>

                  <span>
                    {previewIndex + 1} of {media.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => navigatePreview(1)}
                    disabled={
                      previewIndex === -1 ||
                      previewIndex >= media.length - 1
                    }
                    aria-label="Next media"
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className={styles.attachmentPreview}>
                  {preview.mimeType.startsWith("image/") ? (
                    <img
                      src={preview.url}
                      alt={preview.altText || preview.originalName}
                    />
                  ) : preview.mimeType.startsWith("video/") ? (
                    <video src={preview.url} controls />
                  ) : preview.mimeType.startsWith("audio/") ? (
                    <audio src={preview.url} controls />
                  ) : preview.mimeType === "application/pdf" ? (
                    <iframe
                      src={preview.url}
                      title={preview.originalName}
                    />
                  ) : (
                    <div className={styles.documentPreview}>
                      <FileIcon mimeType={preview.mimeType} />
                      <strong>{preview.originalName}</strong>
                      <a
                        href={preview.url}
                        download={preview.originalName}
                      >
                        <Download size={16} />
                        Download file
                      </a>
                    </div>
                  )}
                </div>

                <div className={styles.attachmentFileDetails}>
                  <strong title={preview.originalName}>
                    {preview.originalName}
                  </strong>

                  <span>
                    {getCategory(preview.mimeType)} ·{" "}
                    {formatSize(preview.fileSize)}
                  </span>

                  <span>Uploaded {formatDate(preview.createdAt)}</span>
                  <span>File type: {preview.mimeType}</span>
                </div>

                <div className={styles.attachmentForm}>
                  <div className={styles.attachmentField}>
                    <label htmlFor="media-alt-text">Alt Text</label>
                    <input
                      id="media-alt-text"
                      type="text"
                      value={editAltText}
                      maxLength={500}
                      disabled={preview.isDeleted}
                      placeholder="Describe this image"
                      onChange={(event) =>
                        setEditAltText(event.target.value)
                      }
                    />
                    <small>
                      Describe the image for accessibility and SEO.
                    </small>
                  </div>

                  <div className={styles.attachmentField}>
                    <label htmlFor="media-title">Title</label>
                    <input
                      id="media-title"
                      type="text"
                      value={editTitle}
                      maxLength={255}
                      disabled={preview.isDeleted}
                      placeholder="Enter media title"
                      onChange={(event) =>
                        setEditTitle(event.target.value)
                      }
                    />
                  </div>

                  <div className={styles.attachmentField}>
                    <label htmlFor="media-caption">Caption</label>
                    <textarea
                      id="media-caption"
                      value={editCaption}
                      maxLength={500}
                      rows={3}
                      disabled={preview.isDeleted}
                      placeholder="Enter image caption"
                      onChange={(event) =>
                        setEditCaption(event.target.value)
                      }
                    />
                  </div>

                  <div className={styles.attachmentField}>
                    <label htmlFor="media-description">
                      Description
                    </label>
                    <textarea
                      id="media-description"
                      value={editDescription}
                      rows={5}
                      maxLength={10000}
                      disabled={preview.isDeleted}
                      placeholder="Enter media description"
                      onChange={(event) =>
                        setEditDescription(event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className={styles.attachmentUrl}>
                  <label>File URL</label>

                  <div>
                    <input readOnly value={previewUrl} />

                    <button
                      type="button"
                      onClick={() => void copyUrl(preview.url)}
                    >
                      {copied ? (
                        <Check size={16} />
                      ) : (
                        <Copy size={16} />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className={styles.attachmentFooter}>
                  {preview.isDeleted ? (
                    <span className={styles.trashNotice}>
                      This file is in Trash. Restore it to edit details.
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.saveDetailsButton}
                      onClick={() => void saveMediaDetails()}
                      disabled={savingDetails}
                    >
                      {savingDetails ? (
                        <Loader2 className={styles.spin} size={16} />
                      ) : (
                        <Save size={16} />
                      )}
                      {savingDetails ? "Saving..." : "Save Changes"}
                    </button>
                  )}

                  <div className={styles.attachmentActions}>
                    <a
                      href={preview.url}
                      download={preview.originalName}
                      title="Download file"
                    >
                      <Download size={16} />
                    </a>

                    {preview.isDeleted ? (
                      <>
                        <button
                          type="button"
                          title="Restore file"
                          onClick={() =>
                            void performSingleRestore(preview.id)
                          }
                        >
                          <RotateCcw size={16} />
                        </button>

                        <button
                          type="button"
                          title="Delete permanently"
                          onClick={() =>
                            void performSingleDelete(preview.id)
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        title="Move to Trash"
                        onClick={() =>
                          void performSingleTrash(preview.id)
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      {copied && (
        <div className={styles.copyToast}>
          <Check size={16} />
          URL copied
        </div>
      )}
    </div>
  );
}
