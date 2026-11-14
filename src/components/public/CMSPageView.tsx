import sanitizeHtml from "sanitize-html";
import type { Page } from "@prisma/client";
import PublicPageBuilder from "@/components/public/PublicPageBuilder";
import PublicBuilderDocument from "@/components/public/PublicBuilderDocument";
import { getBuilderLayout } from "@/lib/page-builder-content";
import { getPublishedBuilderDocument } from "@/lib/builder/public-layout";

type PublicPageRecord = Pick<
  Page,
  "id" | "title" | "slug" | "description" | "seoTitle" | "seoDescription" | "content"
>;

function getContentData(content: unknown) {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content as { text?: unknown; featuredImage?: unknown };
  }
  return {};
}

function getPageHtml(content: unknown): string {
  const storedText = getContentData(content).text;
  if (typeof storedText !== "string" || !storedText.trim()) return "";
  try {
    const parsed = JSON.parse(storedText);
    if (parsed && typeof parsed === "object" && typeof parsed.html === "string") {
      return parsed.html;
    }
  } catch {
    // Older content is stored as raw HTML.
  }
  return storedText;
}

function sanitizePageHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "figure",
      "figcaption",
      "iframe",
      "video",
      "source",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["class", "style"],
      a: ["href", "name", "target", "rel", "class", "style"],
      img: ["src", "alt", "title", "width", "height", "class", "style", "loading"],
      iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "frameborder"],
      video: ["src", "controls", "width", "height", "poster"],
      source: ["src", "type"],
      td: ["colspan", "rowspan", "class", "style"],
      th: ["colspan", "rowspan", "class", "style"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\([0-9\s,%.]+\)$/, /^rgba\([0-9\s,.]+\)$/, /^[a-zA-Z]+$/],
        "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\([0-9\s,%.]+\)$/, /^rgba\([0-9\s,.]+\)$/, /^[a-zA-Z]+$/],
        "text-align": [/^(left|right|center|justify)$/],
        "font-size": [/^[0-9.]+(px|pt|em|rem|%)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "font-style": [/^(normal|italic)$/],
        "text-decoration": [/^(none|underline|line-through)$/],
        width: [/^[0-9.]+(px|%|em|rem)$/],
        height: [/^[0-9.]+(px|%|em|rem)$/],
        "max-width": [/^[0-9.]+(px|%|em|rem)$/],
        margin: [/^[0-9.\s]+(px|%|em|rem)?$/],
        padding: [/^[0-9.\s]+(px|%|em|rem)?$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}

export default async function CMSPageView({
  page,
}: {
  page: PublicPageRecord;
}) {
  const contentData = getContentData(page.content);
  const featuredImage =
    typeof contentData.featuredImage === "string" ? contentData.featuredImage : "";
  const builderLayout = getBuilderLayout(page.content);
  const universalBuilderDocument = await getPublishedBuilderDocument(`page:${page.id}`);
  const hasBuilderContent = Boolean(
    builderLayout?.elements.length || universalBuilderDocument?.layout.root.length
  );
  const safeHtml = sanitizePageHtml(getPageHtml(page.content));

  return (
    <main className="cms-public-page">
      {!hasBuilderContent && featuredImage && (
        <div className="cms-featured-image">
          <img src={featuredImage} alt={page.title} />
        </div>
      )}
      <article className={`cms-page-content ${hasBuilderContent ? "cms-builder-content" : ""}`}>
        {!hasBuilderContent && <h1 className="cms-page-title">{page.title}</h1>}
        {!hasBuilderContent && page.description && (
          <p className="cms-page-description">{page.description}</p>
        )}
        {universalBuilderDocument?.layout.root.length ? (
          <PublicBuilderDocument
            layout={universalBuilderDocument.layout}
            globalStyles={universalBuilderDocument.globalStyles}
          />
        ) : hasBuilderContent && builderLayout ? (
          <PublicPageBuilder layout={builderLayout} />
        ) : safeHtml ? (
          <div className="cms-editor-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        ) : (
          <p>This page does not have any content yet.</p>
        )}
      </article>
      <style>{`
        .cms-public-page { width: 100%; min-height: 400px; background: #fff; color: #333; }
        .cms-page-content { width: 100%; max-width: 1200px; margin: 0 auto; padding: 40px 24px 60px; }
        .cms-page-content.cms-builder-content { max-width: none; padding: 0; }
        .cms-page-title { margin: 0 0 15px; color: #0c2f55; font-size: 36px; line-height: 1.25; font-weight: 700; }
        .cms-page-description { margin: 0 0 25px; color: #666; font-size: 16px; line-height: 1.7; }
        .cms-featured-image { width: 100%; max-width: 1200px; margin: 30px auto 0; padding: 0 24px; }
        .cms-featured-image img { display: block; width: 100%; max-height: 480px; object-fit: cover; border-radius: 8px; }
        .cms-editor-content { color: #333; font-size: 16px; line-height: 1.8; overflow-wrap: break-word; }
        .cms-editor-content img { max-width: 100%; height: auto; }
        .cms-editor-content a { color: #2271b1; text-decoration: underline; }
        .cms-editor-content table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .cms-editor-content th, .cms-editor-content td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        .cms-editor-content iframe { max-width: 100%; }
        @media (max-width: 768px) {
          .cms-page-content { padding: 25px 16px 40px; }
          .cms-page-title { font-size: 28px; }
          .cms-featured-image { padding: 0 16px; }
        }
      `}</style>
    </main>
  );
}
