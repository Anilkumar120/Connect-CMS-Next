
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import styles from "./MediaPickerModal.module.css";

import { upload } from "@vercel/blob/client";

export type MediaPickerItem = {
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

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MediaPickerItem) => void;
};

type Tab = "library" | "upload";

const CHUNK_SIZE = 8 * 1024 * 1024;

async function readResponse(response: Response) {
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || result.error || "Request failed.");
  }

  return result;
}

export default function MediaPickerModal({
  open,
  onClose,
  onSelect,
}: Props) {
  const [tab, setTab] = useState<Tab>("library");
  const [media, setMedia] = useState<MediaPickerItem[]>([]);
  const [selected, setSelected] = useState<MediaPickerItem | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        view: "library",
        search,
        type: "image",
      });

      const response = await fetch(
        `/api/admin/media?${params.toString()}`,
        { cache: "no-store" }
      );

      const result = await readResponse(response);
      const items: MediaPickerItem[] = Array.isArray(result.media)
        ? result.media
        : [];

      setMedia(
        items.filter(
          (item) =>
            item.mimeType?.startsWith("image/") &&
            !item.isDeleted &&
            item.url
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load media."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (open) {
      void loadMedia();
    } else {
      setSelected(null);
      setError("");
      setTab("library");
      setSearch("");
      setUploadProgress(0);
    }
  }, [open, loadMedia]);

 const uploadFile = async (file: File) => {
  if (!file.type.startsWith("image/")) {
    setError(`${file.name}: Please select an image file.`);
    return;
  }

  if (file.size <= 0 || file.size > 5 * 1024 * 1024 * 1024) {
    setError(`${file.name}: Image must be between 1 byte and 5 GB.`);
    return;
  }

  let uploadId = "";

  setUploading(true);
  setUploadProgress(0);
  setError("");

  try {
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
            setUploadProgress(Math.min(99, Math.round(percentage)));
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

      await readResponse(registerResponse);
    } else {
      const initForm = new FormData();
      initForm.append("action", "init");
      initForm.append("fileName", file.name);
      initForm.append("size", String(file.size));
      initForm.append("mimeType", file.type);

      const initResponse = await fetch("/api/admin/media", {
        method: "POST",
        body: initForm,
      });

      const initResult = await readResponse(initResponse);
      uploadId = initResult.uploadId;

      if (!uploadId) {
        throw new Error("Upload could not be initialized.");
      }

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      for (let index = 0; index < totalChunks; index++) {
        const start = index * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const chunkForm = new FormData();
        chunkForm.append("action", "chunk");
        chunkForm.append("uploadId", uploadId);
        chunkForm.append("chunkIndex", String(index));
        chunkForm.append("chunk", chunk, `${file.name}.part${index}`);

        const chunkResponse = await fetch("/api/admin/media", {
          method: "POST",
          body: chunkForm,
        });

        await readResponse(chunkResponse);

        setUploadProgress(
          Math.round(((index + 1) / totalChunks) * 100)
        );
      }

      const completeForm = new FormData();
      completeForm.append("action", "complete");
      completeForm.append("uploadId", uploadId);

      const completeResponse = await fetch("/api/admin/media", {
        method: "POST",
        body: completeForm,
      });

      await readResponse(completeResponse);
    }

    setUploadProgress(100);
    setTab("library");
    await loadMedia();
  } catch (err) {
    if (uploadId) {
      const cancelForm = new FormData();
      cancelForm.append("action", "cancel");
      cancelForm.append("uploadId", uploadId);

      await fetch("/api/admin/media", {
        method: "POST",
        body: cancelForm,
      }).catch(() => undefined);
    }

    setError(
      err instanceof Error ? err.message : "Image upload failed."
    );
  } finally {
    setUploading(false);
  }
};

  const handleFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (!imageFiles.length) {
      setError("Please select at least one image.");
      return;
    }

    for (const file of imageFiles) {
      await uploadFile(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      void handleFiles(event.target.files);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    if (event.dataTransfer.files.length) {
      void handleFiles(event.dataTransfer.files);
    }
  };

  const selectImage = () => {
    if (!selected) {
      setError("Please select an image first.");
      return;
    }

    onSelect(selected);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !uploading) {
          onClose();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-picker-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="media-picker-title">Select or Upload Media</h2>
            <p>Choose an image from your Media Library.</p>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={uploading}
            aria-label="Close media library"
          >
            ×
          </button>
        </header>

        <div className={styles.tabs}>
          <button
            type="button"
            className={tab === "library" ? styles.activeTab : ""}
            onClick={() => {
              setTab("library");
              setError("");
            }}
          >
            Media Library
          </button>

          <button
            type="button"
            className={tab === "upload" ? styles.activeTab : ""}
            onClick={() => {
              setTab("upload");
              setError("");
            }}
          >
            Upload Files
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {tab === "library" && (
          <div className={styles.libraryLayout}>
            <div className={styles.libraryMain}>
              <div className={styles.toolbar}>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search images..."
                  aria-label="Search images"
                />

                <button
                  type="button"
                  onClick={() => void loadMedia()}
                  disabled={loading}
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className={styles.message}>Loading images...</div>
              ) : media.length === 0 ? (
                <div className={styles.message}>
                  No images found. Upload an image to get started.
                </div>
              ) : (
                <div className={styles.imageGrid}>
                  {media.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`${styles.imageItem} ${
                        selected?.id === item.id ? styles.selectedImage : ""
                      }`}
                      onClick={() => {
                        setSelected(item);
                        setError("");
                      }}
                      title={item.originalName}
                    >
                      <img
                        src={item.url}
                        alt={item.altText || item.originalName}
                      />
                      {selected?.id === item.id && (
                        <span className={styles.checkmark}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <aside className={styles.details}>
              <h3>Attachment Details</h3>

              {selected ? (
                <>
                  <img
                    className={styles.preview}
                    src={selected.url}
                    alt={selected.altText || selected.originalName}
                  />
                  <strong>{selected.originalName}</strong>
                  <span>{selected.mimeType}</span>
                  <label>Image URL</label>
                  <input readOnly value={selected.url} />
                  <label>Alt Text</label>
                  <p>{selected.altText || "No alt text added"}</p>
                </>
              ) : (
                <p className={styles.muted}>
                  Select an image to view its details.
                </p>
              )}
            </aside>
          </div>
        )}

        {tab === "upload" && (
          <div
            className={`${styles.dropzone} ${
              dragging ? styles.dragging : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className={styles.uploadIcon}>↑</div>
            <h3>Drop files to upload</h3>
            <p>or</p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Select Images
            </button>

            <span>Image files only</span>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleFileChange}
            />

            {uploading && (
              <div className={styles.progressArea}>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressBar}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span>Uploading... {uploadProgress}%</span>
              </div>
            )}
          </div>
        )}

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </button>

          {tab === "library" && (
            <button
              type="button"
              className={styles.selectButton}
              onClick={selectImage}
              disabled={!selected || loading}
            >
              Select Image
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
