import sanitizeHtml from "sanitize-html";

export function getPostHtml(content: unknown): string {
  if (typeof content === "string") {
    try {
      const parsed: unknown = JSON.parse(content);
      if (
        parsed &&
        typeof parsed === "object" &&
        "html" in parsed &&
        typeof parsed.html === "string"
      ) {
        return parsed.html;
      }
    } catch {
      return content;
    }
    return content;
  }

  if (content && typeof content === "object" && !Array.isArray(content) && "html" in content) {
    const html = content.html;
    return typeof html === "string" ? html : "";
  }

  return "";
}

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "figure",
      "figcaption",
      "iframe",
      "video",
      "source",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      iframe: ["src", "width", "height", "title", "allow", "allowfullscreen"],
      video: ["src", "controls", "width", "height", "poster"],
      source: ["src", "type"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
      }),
    },
  });
}
