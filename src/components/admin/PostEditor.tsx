"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  PanelsTopLeft,
} from "lucide-react";
import TinyMcePageEditor, {
  type TinyMcePageEditorHandle,
} from "@/components/admin/TinyMcePageEditor";
import MediaPickerModal, {
  type MediaPickerItem,
} from "@/components/admin/MediaPickerModal";
import styles from "./PostsAdmin.module.css";

type Props = {
  postId?: string;
  postTypeSlug?: string;
};
type CategoryOption = {
  id: string;
  name: string;
  parent?: { name: string } | null;
};
type TagOption = { id: string; name: string };
type ApiResult = {
  success?: boolean;
  message?: string;
  categories?: CategoryOption[];
  tags?: TagOption[];
  contentType?: {
    title: string;
    hasCategories: boolean;
    hasTags: boolean;
  };
  post?: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    featuredImage: string | null;
    status: "DRAFT" | "PUBLISHED";
    categoryIds: string[];
    tagIds: string[];
    seoTitle: string | null;
    seoDescription: string | null;
    focusKeyword: string | null;
  };
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export default function PostEditor({ postId, postTypeSlug }: Props) {
  const router = useRouter();
  const editorRef = useRef<TinyMcePageEditorHandle>(null);
  const [loaded, setLoaded] = useState(!postId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [typeTitle, setTypeTitle] = useState("Post");
  const [hasCategories, setHasCategories] = useState(true);
  const [hasTags, setHasTags] = useState(true);
  const editorBasePath = postTypeSlug
    ? `/admin/content-types/${postTypeSlug}/posts`
    : "/admin/posts";

  useEffect(() => {
    let active = true;

    async function loadEditor() {
      try {
        const [categoryResponse, tagResponse, postResponse, typeResponse] = await Promise.all([
          fetch("/api/admin/posts/taxonomies/categories", { cache: "no-store" }),
          fetch("/api/admin/posts/taxonomies/tags", { cache: "no-store" }),
          postId
            ? fetch(
                `/api/admin/posts/${postId}${postTypeSlug ? `?type=${encodeURIComponent(postTypeSlug)}` : ""}`,
                { cache: "no-store" }
              )
            : Promise.resolve(null),
          postTypeSlug
            ? fetch(`/api/admin/content-types?slug=${encodeURIComponent(postTypeSlug)}`, { cache: "no-store" })
            : Promise.resolve(null),
        ]);
        const [categoryResult, tagResult, postResult, typeResult] = (await Promise.all([
          categoryResponse.json(),
          tagResponse.json(),
          postResponse?.json() ?? null,
          typeResponse?.json() ?? null,
        ])) as [ApiResult, ApiResult, ApiResult | null, ApiResult | null];

        for (const [response, result] of [
          [categoryResponse, categoryResult],
          [tagResponse, tagResult],
          ...(postResponse && postResult ? [[postResponse, postResult] as const] : []),
          ...(typeResponse && typeResult ? [[typeResponse, typeResult] as const] : []),
        ] as [Response, ApiResult][]) {
          if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to load post editor data.");
          }
        }

        if (!active) return;
        if (typeResult?.contentType) {
          setTypeTitle(typeResult.contentType.title);
          setHasCategories(typeResult.contentType.hasCategories);
          setHasTags(typeResult.contentType.hasTags);
        }
        setCategories(categoryResult.categories || []);
        setTags(tagResult.tags || []);
        if (postResult?.post) {
          setTitle(postResult.post.title);
          setSlug(postResult.post.slug);
          setExcerpt(postResult.post.excerpt || "");
          setInitialContent(postResult.post.content || "");
          setFeaturedImage(postResult.post.featuredImage || "");
          setStatus(postResult.post.status);
          setCategoryIds(postResult.post.categoryIds);
          setTagIds(postResult.post.tagIds);
          setSeoTitle(postResult.post.seoTitle || "");
          setSeoDescription(postResult.post.seoDescription || "");
          setFocusKeyword(postResult.post.focusKeyword || "");
        }
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unable to load post editor data.");
        }
      } finally {
        if (active) setLoaded(true);
      }
    }

    void loadEditor();
    return () => {
      active = false;
    };
  }, [postId, postTypeSlug]);

  function toggleId(
    id: string,
    current: string[],
    setCurrent: (next: string[]) => void
  ) {
    setCurrent(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function selectFeaturedImage(item: MediaPickerItem) {
    setFeaturedImage(item.url);
    setNotice("Featured image selected. Save or publish the post to apply it.");
  }

  async function savePost(
    nextStatus: "DRAFT" | "PUBLISHED",
    openBuilder = false
  ) {
    if (saving) return;
    setError("");
    setNotice("");

    if (!title.trim() || !slugify(slug)) {
      setError("Enter a post title and a valid slug.");
      return;
    }
    const html = editorRef.current?.getContent();
    if (html === undefined) {
      setError("The editor is still loading. Please wait and try again.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        postId
          ? `/api/admin/posts/${postId}`
          : "/api/admin/posts",
        {
          method: postId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            slug: slugify(slug),
            excerpt,
            content: html,
            featuredImage,
            status: nextStatus,
            categoryIds: hasCategories ? categoryIds : [],
            tagIds: hasTags ? tagIds : [],
            seoTitle,
            seoDescription,
            focusKeyword,
            ...(postTypeSlug ? { postTypeSlug } : {}),
          }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save post.");
      }
      if (openBuilder) {
        const savedPostId = postId || result.post?.id;
        if (!savedPostId) {
          throw new Error("Post was saved, but its builder URL could not be determined.");
        }
        router.push(
          postTypeSlug
            ? `/admin/builder/custom/${postTypeSlug}/${savedPostId}`
            : `/admin/builder/posts/${savedPostId}`
        );
      } else {
        router.push(editorBasePath);
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save post.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <p className={styles.muted}>Loading post editor…</p>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.linkButton} href={editorBasePath}>
            <ArrowLeft size={15} /> Back to {postTypeSlug ? typeTitle : "Posts"}
          </Link>
          <h1 style={{ marginTop: 12 }}>
            {postId ? `Edit ${typeTitle}` : `Add New ${typeTitle}`}
          </h1>
          <p>Content is public only after you choose Publish.</p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={saving}
            onClick={() => void savePost(status, true)}
          >
            <PanelsTopLeft size={15} /> Edit with Builder
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={saving}
            onClick={() => void savePost("DRAFT")}
          >
            <Save size={15} /> Save Draft
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={saving}
            onClick={() => void savePost("PUBLISHED")}
          >
            {saving ? <Loader2 size={15} /> : <Globe size={15} />}
            {saving ? "Saving…" : "Publish"}
          </button>
        </div>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <form
        className={styles.editorGrid}
        onSubmit={(event) => {
          event.preventDefault();
          void savePost(status);
        }}
      >
        <section>
          <div className={styles.card}>
            <label className={styles.field}>
              Post Title
              <input
                required
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSlug(slugify(event.target.value));
                }}
                placeholder="Enter post title"
              />
            </label>
            <label className={styles.field}>
              Permalink Slug
              <input value={slug} onChange={(event) => setSlug(event.target.value)} />
            </label>
            <label className={styles.field}>
              Excerpt
              <textarea
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                placeholder="Short summary shown in the blog archive"
              />
            </label>
            <h2>{typeTitle} Content</h2>
            <TinyMcePageEditor ref={editorRef} initialContent={initialContent} />
          </div>
          <div className={styles.card} id="seo">
            <h2>Search Engine Optimization</h2>
            <label className={styles.field}>
              SEO Title
              <input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
            </label>
            <label className={styles.field}>
              SEO Description
              <textarea value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} />
            </label>
            <label className={styles.field}>
              Focus Keyword
              <input value={focusKeyword} onChange={(event) => setFocusKeyword(event.target.value)} />
            </label>
          </div>
        </section>

        <aside>
          <div className={styles.card}>
            <h2>Featured Image</h2>
            {featuredImage && (
              <>
                <img className={styles.imagePreview} src={featuredImage} alt={title || "Featured image"} />
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => setFeaturedImage("")}
                >
                  <Trash2 size={14} /> Remove Image
                </button>
              </>
            )}
            <button
              type="button"
              className={styles.button}
              onClick={() => setMediaPickerOpen(true)}
            >
              <ImagePlus size={15} /> Choose or Upload Image
            </button>
          </div>

          {hasCategories && (
            <div className={styles.card}>
              <h2>Categories</h2>
              <div className={styles.checkboxList}>
                {categories.map((category) => (
                  <label key={category.id} className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(category.id)}
                      onChange={() =>
                        toggleId(category.id, categoryIds, setCategoryIds)
                      }
                    />
                    {category.parent ? `${category.parent.name} › ` : ""}
                    {category.name}
                  </label>
                ))}
                {!categories.length && (
                  <span className={styles.muted}>No categories yet.</span>
                )}
              </div>
              <Link
                href="/admin/posts/categories"
                className={styles.linkButton}
                style={{ marginTop: 12 }}
              >
                Manage Categories
              </Link>
            </div>
          )}

          {hasTags && <div className={styles.card}>
            <h2>Tags</h2>
            <div className={styles.checkboxList}>
              {tags.map((tag) => (
                <label key={tag.id} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={tagIds.includes(tag.id)}
                    onChange={() => toggleId(tag.id, tagIds, setTagIds)}
                  />
                  {tag.name}
                </label>
              ))}
              {!tags.length && <span className={styles.muted}>No tags yet.</span>}
            </div>
            <Link href="/admin/posts/tags" className={styles.linkButton} style={{ marginTop: 12 }}>
              Manage Tags
            </Link>
          </div>}
        </aside>
      </form>

      <MediaPickerModal
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={selectFeaturedImage}
      />
    </main>
  );
}
