import type {
  PageBuilderElement,
  PageBuilderLayout,
} from "@/lib/page-builder-types";

export function getBuilderLayout(content: unknown): PageBuilderLayout | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }

  const layout = (content as Record<string, unknown>).layout;
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    return null;
  }

  const candidate = layout as { version?: unknown; elements?: unknown };
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.elements) ||
    candidate.elements.length > 100
  ) {
    return null;
  }

  const allowedTypes = new Set([
    "section",
    "container",
    "heading",
    "text",
    "image",
    "button",
    "link",
    "icon",
    "divider",
    "spacer",
  ]);
  let count = 0;

  function isElement(value: unknown, depth: number): value is PageBuilderElement {
    if (
      depth > 20 ||
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return false;
    }

    const element = value as Record<string, unknown>;
    count += 1;
    if (
      count > 500 ||
      typeof element.id !== "string" ||
      !allowedTypes.has(String(element.type))
    ) {
      return false;
    }

    if (element.children === undefined) return true;
    return (
      Array.isArray(element.children) &&
      element.children.length <= 100 &&
      element.children.every((child) => isElement(child, depth + 1))
    );
  }

  if (!candidate.elements.every((element) => isElement(element, 0))) {
    return null;
  }

  return candidate as PageBuilderLayout;
}
