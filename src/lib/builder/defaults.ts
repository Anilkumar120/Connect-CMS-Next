
import type {
  BuilderGlobalStyles,
  BuilderKind,
  BuilderLayout,
  BuilderNode,
} from "./types";

export const DEFAULT_GLOBAL_STYLES: BuilderGlobalStyles = {
  colors: [
    { id: "primary", name: "Primary", value: "#0c2f55" },
    { id: "secondary", name: "Secondary", value: "#3984e8" },
    { id: "text", name: "Text", value: "#334155" },
    { id: "background", name: "Background", value: "#ffffff" },
    { id: "accent", name: "Accent", value: "#f59e0b" },
    { id: "border", name: "Border", value: "#dbe3ed" },
    { id: "surface", name: "Surface", value: "#f8fafc" },
  ],
  fonts: [
    {
      id: "primary-font",
      name: "Primary",
      family: "Arial, sans-serif",
      weight: "400",
    },
    {
      id: "heading-font",
      name: "Headings",
      family: "Arial, sans-serif",
      weight: "700",
    },
    {
      id: "body-font",
      name: "Body",
      family: "Arial, sans-serif",
      weight: "400",
    },
    {
      id: "accent-font",
      name: "Accent",
      family: "Arial, sans-serif",
      weight: "600",
    },
  ],
};

export function createDefaultNode(
  type: string,
  label: string,
  id: string,
  props: Record<string, unknown> = {},
  children: BuilderNode[] = [],
): BuilderNode {
  const isGrid = type === "grid";
  const isLayout = [
    "section",
    "container",
    "column",
    "row",
    "grid",
  ].includes(type);

  return {
    id,
    type,
    label,
    enabled: true,
    locked: false,
    props,
    children,
    styles: {
      width: {
        desktop: "100%",
      },
      display: {
        desktop: isGrid
          ? "grid"
          : isLayout
            ? "flex"
            : "block",
      },
      direction: {
        desktop: type === "row" ? "row" : "column",
      },
      justifyContent: {
        desktop: "flex-start",
      },
      alignItems: {
        desktop: "stretch",
      },
      flexWrap: {
        desktop: "nowrap",
      },
      gap: {
        desktop: "10px",
      },
      padding: {
        desktop: {
          top: "10px",
          right: "10px",
          bottom: "10px",
          left: "10px",
          unit: "px",
          linked: true,
        },
      },
      background: {
        type: "classic",
        color: "",
      },
      border: {
        style: "none",
        width: "1px",
        color: "#dbe3ed",
        radius: {
          desktop: "0px",
        },
      },
      opacity: 1,
      position: "default",
    },
    advanced: {
      hideOnDesktop: false,
      hideOnTablet: false,
      hideOnMobile: false,
      locked: false,
      attributes: {},
    },
  };
}

export function createDefaultLayout(
  kind: BuilderKind,
): BuilderLayout {
  const heading = createDefaultNode(
    "heading",
    "Heading",
    "default-heading",
    {
      text:
        kind === "header" || kind === "footer"
          ? "CONNECT BROADBAND"
          : "Your Heading",
      level: "h2",
      htmlTag: "h2",
    },
  );

  const container = createDefaultNode(
    "container",
    "Container",
    "default-container",
    {
      contentWidth: "boxed",
      containerWidth: "1200px",
    },
    [heading],
  );

  const section = createDefaultNode(
    "section",
    "Section",
    "default-section",
    {
      contentWidth: "boxed",
      containerWidth: "1200px",
      htmlTag: "section",
    },
    [container],
  );

  return {
    version: 1,
    root: [section],
  };
}

export function createDefaultSettings(
  kind: BuilderKind,
): Record<string, unknown> {
  return {
    kind,
    contentWidth: "boxed",
    containerWidth: "1200px",
    responsiveMode: "desktop",
    backgroundColor: "#ffffff",
    globalFontFamily: "Arial, sans-serif",
    primaryColor: "#3984e8",
    secondaryColor: "#0c2f55",
    defaultWidgetGap: "10px",
    defaultSectionPadding: "20px",
    breakpoints: [
      { id: "desktop", name: "Desktop", value: 1025, enabled: true },
      { id: "tablet", name: "Tablet", value: 768, enabled: true },
      { id: "mobile", name: "Mobile", value: 767, enabled: true },
    ],
    seoTitle: "",
    metaDescription: "",
    focusKeyphrase: "",
  };
}

export function createDefaultConditions(): Record<string, unknown> {
  return {
    include: [],
    exclude: [],
  };
}

export function createDocumentKey(
  kind: BuilderKind,
  target?: {
    id?: string;
    slug?: string;
    postTypeSlug?: string;
  },
): string {
  switch (kind) {
    case "header":
      return "header:primary";

    case "footer":
      return "footer:primary";

    case "page":
      if (!target?.id) {
        throw new Error("Page ID is required.");
      }
      return `page:${target.id}`;

    case "post":
      if (!target?.id) {
        throw new Error("Post ID is required.");
      }
      return `post:${target.id}`;

    case "single":
      if (!target?.slug) {
        throw new Error("Single template slug is required.");
      }
      return `single:${target.slug}`;

    case "archive":
      if (!target?.slug) {
        throw new Error("Archive template slug is required.");
      }
      return `archive:${target.slug}`;

    case "custom":
      if (!target?.postTypeSlug || !target?.id) {
        throw new Error(
          "Custom post type slug and ID are required.",
        );
      }
      return `custom:${target.postTypeSlug}:${target.id}`;

    default:
      throw new Error("Unsupported builder kind.");
  }
}
