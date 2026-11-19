"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  Monitor,
  Tablet,
  Smartphone,
  Save,
  Eye,
  Upload,
  Layers,
  Settings2,
  Plus,
  Trash2,
  Copy,
  Loader2,
  ArrowLeft,
  LayoutGrid,
  Undo2,
  Redo2,
  ChevronRight,
  ChevronDown,
  Search,
  Move,
  Menu,
  Image as ImageIcon,
  X,
  Download,
  FileUp,
  History,
  Lock,
  Unlock,
  EyeOff,
  RotateCcw,
  Link2,
  Unlink,
} from "lucide-react";
import * as LucideIcons from "lucide-react";

import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import MediaPickerModal, {
  type MediaPickerItem,
} from "@/components/admin/MediaPickerModal";
import IconPicker from "@/components/admin/IconPicker";
import BannerRichTextEditor from "@/components/admin/BannerRichTextEditor";
import BannerSlider, {
  type BannerSliderSlide,
} from "@/components/public/BannerSlider";
import { themeIcons } from "@/components/public/theme-icons";
import {
  builderSpacingCss,
  combineBuilderSpacing,
} from "@/lib/builder/spacing";
import {
  resolveBuilderProps,
  resolveBuilderStyles,
  setBuilderPropForDevice,
  setBuilderStyleForDevice,
} from "@/lib/builder/responsive";

import styles from "./UniversalBuilder.module.css";

import type {
  BuilderDevice,
  BuilderKind,
  BuilderLayout,
  BuilderNode,
  BuilderTarget,
  BuilderGlobalStyles,
  BuilderSpacing,
  BuilderBackground,
  BuilderTypography,
  BuilderBorder,
  BuilderStyle,
} from "@/lib/builder/types";

import {
  DEFAULT_GLOBAL_STYLES,
  createDefaultLayout,
  createDefaultNode,
  createDefaultSettings,
  createDefaultConditions,
  createDocumentKey,
} from "@/lib/builder/defaults";

import {
  BUILDER_WIDGETS,
  BUILDER_WIDGET_CATEGORIES,
} from "@/lib/builder/widgets";

type Props = {
  target: BuilderTarget;
};

type HistoryState = {
  root: BuilderNode[];
};

type MediaItem = {
  id: string;
  fileName?: string;
  originalName?: string;
  filePath?: string;
  url?: string;
  altText?: string;
  title?: string;
  mimeType?: string;
};

type LinkSuggestion = {
  label: string;
  value: string;
};

type IconPickerTarget =
  | { kind: "button"; value: string }
  | { kind: "widget"; value: string }
  | { kind: "repeaterItem"; index: number; key: "items" | "icons"; value: string }
  | { kind: "slideButton"; slideIndex: number; buttonIndex: number; value: string }
  | null;

type NodeContextMenu = {
  nodeId: string;
  left: number;
  top: number;
} | null;

type DocumentResponse = {
  success?: boolean;
  message?: string;
  document?: {
    id: string;
    documentKey: string;
    kind: BuilderKind;
    title: string;
    slug?: string | null;
    targetId?: string | null;
    postTypeSlug?: string | null;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    layout: BuilderLayout;
    settings?: Record<string, unknown> | null;
    globalStyles?: BuilderGlobalStyles | null;
    conditions?: Record<string, unknown> | null;
    updatedAt?: string;
  } | null;
};

type RevisionItem = {
  id: string;
  revisionNo: number;
  title: string;
  message?: string | null;
  createdAt?: string;
};

type MediaTarget =
  | "widget"
  | "widgetIcon"
  | "background"
  | "hoverBackground"
  | "backgroundOverlay"
  | "hoverBackgroundOverlay"
  | "videoPoster"
  | "slideBackground"
  | "slideButtonIcon"
  | "carouselItem"
  | "repeaterIcon";

type BuilderMenuItem = {
  id: string;
  label: string;
  url: string | null;
  target: string;
  children: BuilderMenuItem[];
};

type BuilderMenu = {
  id: string;
  name: string;
  location?: "HEADER" | "FOOTER" | null;
};

function normalizePublicMenuItems(value: unknown): BuilderMenuItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): BuilderMenuItem[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.label !== "string") {
      return [];
    }

    return [{
      id: record.id,
      label: record.label,
      url:
        typeof record.href === "string"
          ? record.href
          : typeof record.url === "string"
            ? record.url
            : null,
      target: typeof record.target === "string" ? record.target : "_self",
      children: normalizePublicMenuItems(record.children),
    }];
  });
}

function normalizeBuilderMenus(value: unknown): BuilderMenu[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((menu): BuilderMenu[] => {
    if (!menu || typeof menu !== "object") return [];
    const record = menu as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.name !== "string") {
      return [];
    }

    return [{
      id: record.id,
      name: record.name,
      location:
        record.location === "HEADER" || record.location === "FOOTER"
          ? record.location
          : null,
    }];
  });
}

const KIND_LABELS: Record<BuilderKind, string> = {
  header: "Header",
  footer: "Footer",
  page: "Page",
  post: "Post",
  single: "Single Template",
  archive: "Archive Template",
  custom: "Custom Post Type",
};

const LAYOUT_TYPES = new Set(["section", "container", "row", "column", "grid"]);

const UNITS = ["px", "%", "rem", "em", "vw", "vh", "auto"];

const GOOGLE_FONT_FAMILIES = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Nunito Sans",
  "Playfair Display",
  "Merriweather",
  "Source Sans 3",
  "PT Sans",
  "Oswald",
  "Raleway",
  "Ubuntu",
  "Work Sans",
  "DM Sans",
  "Manrope",
  "Outfit",
  "Plus Jakarta Sans",
  "Fira Sans",
  "Rubik",
  "Mukta",
  "Noto Sans",
  "Noto Serif",
  "Karla",
  "Barlow",
  "Cabin",
  "Libre Baskerville",
];

const CONTROL_STYLE: CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 5,
  padding: "8px 9px",
  background: "#fff",
  color: "#1e293b",
  fontSize: 13,
};

const BUTTON_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 5,
  padding: "7px 9px",
  color: "#334155",
  fontSize: 12,
  cursor: "pointer",
};

const makeId = (type: string) =>
  `${type}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

function cloneNode(node: BuilderNode): BuilderNode {
  return {
    ...node,
    id: makeId(node.type),
    props: structuredClone(node.props || {}),
    styles: structuredClone(node.styles || {}),
    advanced: node.advanced ? structuredClone(node.advanced) : undefined,
    children: (node.children || []).map(cloneNode),
  };
}

function findNode(nodes: BuilderNode[], id: string | null): BuilderNode | null {
  if (!id) return null;

  for (const node of nodes) {
    if (node.id === id) return node;

    const found = findNode(node.children || [], id);

    if (found) return found;
  }

  return null;
}

function findParent(
  nodes: BuilderNode[],
  id: string,
  parentId: string | null = null,
): string | null | undefined {
  for (const node of nodes) {
    if (node.id === id) return parentId;

    const result = findParent(node.children || [], id, node.id);

    if (result !== undefined) return result;
  }

  return undefined;
}

function updateTree(
  nodes: BuilderNode[],
  id: string,
  updater: (node: BuilderNode) => BuilderNode,
): BuilderNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return updater(node);
    }

    return {
      ...node,
      children: updateTree(node.children || [], id, updater),
    };
  });
}

function removeTree(
  nodes: BuilderNode[],
  id: string,
): {
  nodes: BuilderNode[];
  removed: BuilderNode | null;
} {
  const index = nodes.findIndex((node) => node.id === id);

  if (index !== -1) {
    const next = [...nodes];
    const [removed] = next.splice(index, 1);

    return {
      nodes: next,
      removed,
    };
  }

  let removed: BuilderNode | null = null;

  const next = nodes.map((node) => {
    const result = removeTree(node.children || [], id);

    if (result.removed) {
      removed = result.removed;

      return {
        ...node,
        children: result.nodes,
      };
    }

    return node;
  });

  return {
    nodes: next,
    removed,
  };
}

function insertTree(
  nodes: BuilderNode[],
  parentId: string | null,
  node: BuilderNode,
): BuilderNode[] {
  if (!parentId) {
    return [...nodes, node];
  }

  return nodes.map((item) => {
    if (item.id === parentId) {
      return {
        ...item,
        children: [...(item.children || []), node],
      };
    }

    return {
      ...item,
      children: insertTree(item.children || [], parentId, node),
    };
  });
}

function getAllNodeIds(nodes: BuilderNode[]): string[] {
  return nodes.flatMap((node) => [
    node.id,
    ...getAllNodeIds(node.children || []),
  ]);
}

function replaceSiblingList(
  nodes: BuilderNode[],
  parentId: string | null,
  siblings: BuilderNode[],
): BuilderNode[] {
  if (parentId === null) return siblings;

  return updateTree(nodes, parentId, (node) => ({
    ...node,
    children: siblings,
  }));
}

function insertBeforeNode(
  nodes: BuilderNode[],
  parentId: string | null,
  overId: string,
  newNode: BuilderNode,
): BuilderNode[] {
  const siblings =
    parentId === null ? nodes : findNode(nodes, parentId)?.children || [];

  const index = siblings.findIndex((item) => item.id === overId);

  if (index === -1) {
    return insertTree(nodes, parentId, newNode);
  }

  const next = [...siblings];

  next.splice(index, 0, newNode);

  return replaceSiblingList(nodes, parentId, next);
}

function moveNode(
  root: BuilderNode[],
  activeId: string,
  overId: string,
  parentId: string | null,
): BuilderNode[] {
  const activeNode = findNode(root, activeId);

  if (!activeNode || activeId === overId) {
    return root;
  }

  const descendants = getAllNodeIds([activeNode]);

  if (parentId && descendants.includes(parentId)) {
    return root;
  }

  const sourceParent = findParent(root, activeId);

  if (sourceParent === undefined) {
    return root;
  }

  // Same parent: reorder from the original array.
  if (sourceParent === parentId && overId) {
    const siblings =
      parentId === null ? root : findNode(root, parentId)?.children || [];

    const oldIndex = siblings.findIndex((item) => item.id === activeId);

    const newIndex = siblings.findIndex((item) => item.id === overId);

    if (oldIndex === -1 || newIndex === -1) {
      return root;
    }

    return replaceSiblingList(
      root,
      parentId,
      arrayMove(siblings, oldIndex, newIndex),
    );
  }

  const removed = removeTree(root, activeId);

  if (!removed.removed) {
    return root;
  }

  if (overId) {
    const targetParent = findParent(removed.nodes, overId);

    if (targetParent === undefined || targetParent !== parentId) {
      return root;
    }

    return insertBeforeNode(removed.nodes, parentId, overId, removed.removed);
  }

  return insertTree(removed.nodes, parentId, removed.removed);
}

function getResponsiveValue<T>(
  value:
    | T
    | {
        desktop?: T;
        tablet?: T;
        mobile?: T;
      }
    | undefined,
  device: BuilderDevice,
): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return value as T;

  const responsive = value as { desktop?: T; tablet?: T; mobile?: T };
  if (!("desktop" in responsive || "tablet" in responsive || "mobile" in responsive)) {
    return value as T;
  }

  // Tablet/Mobile inherit from Desktop only. They never inherit from each other.
  return responsive[device] ?? responsive.desktop;
}

function getResponsiveScalar<T extends string | number>(
  value:
    | T
    | {
        desktop?: T;
        tablet?: T;
        mobile?: T;
      }
    | undefined,
  device: BuilderDevice,
): T | undefined {
  if (typeof value === "string" || typeof value === "number") return value as T;
  return value?.[device] ?? value?.desktop;
}

function getWidthMode(
  value:
    | "default"
    | "inline"
    | "full"
    | "custom"
    | { desktop?: "default" | "inline" | "full" | "custom"; tablet?: "default" | "inline" | "full" | "custom"; mobile?: "default" | "inline" | "full" | "custom" }
    | undefined,
  device: BuilderDevice,
): "default" | "inline" | "full" | "custom" {
  if (typeof value === "string") return value;
  return value?.[device] ?? value?.desktop ?? "default";
}

function getNodeText(node: BuilderNode): string {
  const props = node.props;

  if (typeof props.text === "string") {
    return props.text;
  }

  if (typeof props.content === "string") {
    return props.content;
  }

  if (typeof props.title === "string") {
    return props.title;
  }

  return node.label;
}

function getLayoutHtmlTag(node: BuilderNode) {
  const tag = node.advanced?.htmlTag || node.props.htmlTag;
  switch (tag) {
    case "div":
    case "section":
    case "header":
    case "footer":
    case "nav":
    case "main":
    case "article":
    case "aside":
      return tag;
    default:
      return node.type === "section" ? "section" : "div";
  }
}

function safeMediaUrl(value: string): string {
  const url = value.trim();

  if (!url || /^(javascript|vbscript|data):/i.test(url)) {
    return "";
  }

  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
    return url;
  }

  try {
    return ["http:", "https:"].includes(new URL(url).protocol) ? url : "";
  } catch {
    return "";
  }
}

function backgroundToCss(
  background?: BuilderBackground,
  device: BuilderDevice = "desktop",
): CSSProperties {
  if (!background) return {};

  const result: CSSProperties = {};

  const backgroundColor = getResponsiveScalar(background.color, device);
  if (backgroundColor) {
    result.backgroundColor = backgroundColor;
  }

  if (background.type === "gradient") {
    const gradient = background.gradient;

    if (gradient?.stops?.length) {
      const stops = gradient.stops
        .map((stop) => `${stop.color} ${stop.position}%`)
        .join(", ");

      result.backgroundImage =
        gradient.type === "radial"
          ? `radial-gradient(${gradient.position || "center"}, ${stops})`
          : `linear-gradient(${gradient.angle ?? 180}deg, ${stops})`;
    } else if (gradient) {
      result.backgroundImage = `linear-gradient(${gradient.angle ?? 135}deg, ${gradient.color1 || "#3984e8"}, ${gradient.color2 || "#0c2f55"})`;
    }
  }

  if (
    (background.type === "image" && background.image) ||
    background.overlayImage
  ) {
    const url = safeMediaUrl(background.image || "");
    const overlayImage = safeMediaUrl(background.overlayImage || "");
    if (url || overlayImage) {
      const layers = url ? [`url(${JSON.stringify(url)})`] : [];
      if (overlayImage) layers.unshift(`url(${JSON.stringify(overlayImage)})`);
      if (background.overlayColor && (background.overlayOpacity ?? 0) > 0) {
        const opacity = Math.max(
          0,
          Math.min(1, background.overlayOpacity || 0),
        );
        layers.unshift(
          `linear-gradient(rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity}))`,
        );
      }
      result.backgroundImage = layers.join(", ");
    }
  }

  if (background.position) {
    result.backgroundPosition = background.position;
  }

  if (background.positionX || background.positionY) {
    result.backgroundPosition = `${getResponsiveScalar(background.positionX, device) || "50%"} ${getResponsiveScalar(background.positionY, device) || "50%"}`;
  }

  if (background.size) {
    result.backgroundSize = background.size;
  }

  if (background.repeat) {
    result.backgroundRepeat =
      background.repeat as CSSProperties["backgroundRepeat"];
  }

  if (background.attachment) {
    result.backgroundAttachment =
      background.attachment as CSSProperties["backgroundAttachment"];
  }

  if (background.blendMode) {
    result.backgroundBlendMode =
      background.blendMode as CSSProperties["backgroundBlendMode"];
  }

  return result;
}

function builderTransformCss(transform: BuilderStyle["transformSettings"]) {
  if (!transform) return undefined;
  return [
    `rotateX(${transform.rotateX || 0}deg)`,
    `rotateY(${transform.rotateY || 0}deg)`,
    `rotateZ(${transform.rotateZ || 0}deg)`,
    `scale(${transform.scaleX ?? 1}, ${transform.scaleY ?? 1})`,
    `translate(${transform.translateX || "0"}, ${transform.translateY || "0"})`,
    `skew(${transform.skewX || 0}deg, ${transform.skewY || 0}deg)`,
  ].join(" ");
}

function getNodeInlineStyle(
  node: BuilderNode,
  device: BuilderDevice,
): CSSProperties {
  const style: CSSProperties = {};
  const s = resolveBuilderStyles(node.styles, device);

  const put = (key: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== "") {
      (style as unknown as Record<string, unknown>)[key] = value;
    }
  };

  put("width", getResponsiveValue(s.width, device));
  const widthMode = getWidthMode(node.advanced?.widthMode, device);
  if (widthMode === "inline") put("width", "fit-content");
  if (widthMode === "full") put("width", "100%");
  if (widthMode === "default") style.width = undefined;
  put("height", getResponsiveValue(s.height, device));
  put("minWidth", getResponsiveValue(s.minWidth, device));
  put("maxWidth", getResponsiveValue(s.maxWidth, device));
  put("minHeight", getResponsiveValue(s.minHeight, device));
  put("maxHeight", getResponsiveValue(s.maxHeight, device));

  put("display", getResponsiveValue(s.display, device));
  put("flexDirection", getResponsiveValue(s.direction, device));
  put("justifyContent", getResponsiveValue(s.justifyContent, device));
  put("alignItems", getResponsiveValue(s.alignItems, device));
  put("alignContent", getResponsiveValue(s.alignContent, device));
  put("alignSelf", getResponsiveValue(s.alignSelf, device));
  put("flexWrap", getResponsiveValue(s.flexWrap, device));

  put("gap", getResponsiveValue(s.gap, device));
  put("rowGap", getResponsiveValue(s.rowGap, device));
  put("columnGap", getResponsiveValue(s.columnGap, device));

  put("flexGrow", getResponsiveValue(s.flexGrow, device));
  put("flexShrink", getResponsiveValue(s.flexShrink, device));
  put("flexBasis", getResponsiveValue(s.flexBasis, device));
  put("order", getResponsiveValue(s.order, device));

  if (LAYOUT_TYPES.has(node.type)) {
    style.display =
      getResponsiveValue(s.display, device) ||
      (node.type === "grid" ? "grid" : "flex");
    if (style.display === "flex" && !style.flexDirection) {
      style.flexDirection =
        getResponsiveValue(s.direction, device) ||
        (node.type === "row" ? "row" : "column");
    }
  }

  if (
    (Number(style.flexGrow) > 0 || (style.flexBasis && style.flexBasis !== "auto")) &&
    !style.width
  ) {
    style.width = "100%";
  }

  put("gridTemplateColumns", getResponsiveValue(s.gridTemplateColumns, device));
  put("gridTemplateRows", getResponsiveValue(s.gridTemplateRows, device));
  put("gridAutoColumns", getResponsiveValue(s.gridAutoColumns, device));
  put("gridAutoRows", getResponsiveValue(s.gridAutoRows, device));
  put("gridAutoFlow", getResponsiveValue(s.gridAutoFlow, device));
  put("gridColumn", getResponsiveValue(s.gridColumn, device));
  put("gridRow", getResponsiveValue(s.gridRow, device));

  const padding = combineBuilderSpacing(
    getResponsiveValue(s.padding, device),
    getResponsiveValue(s.stylePadding, device),
  );
  put("padding", builderSpacingCss(padding));
  const margin = combineBuilderSpacing(
    getResponsiveValue(s.margin, device),
    getResponsiveValue(s.styleMargin, device),
  );
  put("margin", builderSpacingCss(margin));

  put("color", getResponsiveScalar(s.color, device));
  put("mixBlendMode", s.blendMode);

  Object.assign(style, backgroundToCss(s.background, device));

  if (s.border?.style && s.border.style !== "none") {
    style.borderStyle = s.border.style;
    style.borderWidth = s.border.width || "1px";
    style.borderColor =
      getResponsiveScalar(s.border.color, device) || "#dbe3ed";
  }

  put("borderRadius", getResponsiveValue(s.border?.radius, device));

  put("boxShadow", s.boxShadow);
  put("opacity", s.opacity);
  put("zIndex", s.zIndex);
  put("overflow", s.overflow);

  if (s.position && s.position !== "default") {
    style.position = s.position;
  }

  put("top", getResponsiveValue(s.top, device));
  put("right", getResponsiveValue(s.right, device));
  put("bottom", getResponsiveValue(s.bottom, device));
  put("left", getResponsiveValue(s.left, device));

  const typography = s.typography;

  if (typography) {
    put("fontFamily", typography.fontFamily);
    put("fontSize", getResponsiveValue(typography.fontSize, device));
    put("fontWeight", typography.fontWeight);
    put("lineHeight", typography.lineHeight);
    put("letterSpacing", typography.letterSpacing);
    put("wordSpacing", typography.wordSpacing);
    put("fontStyle", typography.fontStyle);
    put("textTransform", typography.textTransform);
    put("textDecoration", typography.textDecoration);
    put("textAlign", getResponsiveValue(typography.textAlign, device));
    put("textShadow", typography.textShadow);
    put("WebkitTextStroke", typography.textStroke);
  }

  if (s.transform) {
    style.transform = s.transform;
  } else if (s.transformSettings) {
    style.transform = builderTransformCss(s.transformSettings);
    style.transformOrigin = s.transformSettings.origin || "center center";
  }

  if (s.mask?.enabled) {
    const masks: Record<string, string> = {
      circle: "circle(50% at 50% 50%)",
      ellipse: "ellipse(50% 40% at 50% 50%)",
      rounded: "inset(0 round 20%)",
      triangle: "polygon(50% 0, 0 100%, 100% 100%)",
      "triangle-down": "polygon(0 0, 100% 0, 50% 100%)",
      diamond: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
      pentagon: "polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)",
      hexagon: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
      heptagon: "polygon(50% 0, 90% 18%, 100% 60%, 75% 100%, 25% 100%, 0 60%, 10% 18%)",
      octagon: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)",
      parallelogram: "polygon(20% 0, 100% 0, 80% 100%, 0 100%)",
      trapezoid: "polygon(20% 0, 80% 0, 100% 100%, 0 100%)",
      cross: "polygon(35% 0, 65% 0, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0 65%, 0 35%, 35% 35%)",
      heart: "polygon(50% 95%, 10% 55%, 0 35%, 5% 15%, 20% 5%, 35% 10%, 50% 25%, 65% 10%, 80% 5%, 95% 15%, 100% 35%, 90% 55%)",
      chevron: "polygon(0 0, 65% 0, 100% 50%, 65% 100%, 0 100%, 35% 50%)",
      arrow: "polygon(0 35%, 60% 35%, 60% 0, 100% 50%, 60% 100%, 60% 65%, 0 65%)",
      star: "polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 95%, 50% 72%, 21% 95%, 32% 57%, 2% 35%, 39% 35%)",
      plus: "polygon(35% 0, 65% 0, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0 65%, 0 35%, 35% 35%)",
    };
    put("clipPath", masks[s.mask.shape || "circle"] || masks.circle);
  }

  put("transition", s.transition);
  put("transitionDuration", s.transitionDuration);

  if (s.filters) {
    const filter = s.filters;
    const values = [
      filter.blur ? `blur(${filter.blur}px)` : "",
      filter.brightness !== undefined
        ? `brightness(${filter.brightness}%)`
        : "",
      filter.contrast !== undefined ? `contrast(${filter.contrast}%)` : "",
      filter.saturation !== undefined ? `saturate(${filter.saturation}%)` : "",
      filter.hue ? `hue-rotate(${filter.hue}deg)` : "",
      filter.grayscale ? `grayscale(${filter.grayscale}%)` : "",
      filter.sepia ? `sepia(${filter.sepia}%)` : "",
      filter.invert ? `invert(${filter.invert}%)` : "",
    ].filter(Boolean);

    if (values.length) {
      style.filter = values.join(" ");
    }
  }

  const hidden =
    (device === "desktop" && node.advanced?.hideOnDesktop) ||
    (device === "tablet" && node.advanced?.hideOnTablet) ||
    (device === "mobile" && node.advanced?.hideOnMobile);

  if (hidden || !node.enabled) {
    style.display = "none";
  }

  return style;
}

function getContainerChildrenStyle(
  node: BuilderNode,
  device: BuilderDevice,
): CSSProperties {
  const style = getNodeInlineStyle(node, device);
  const childrenStyle: CSSProperties = {
    display: style.display,
    flexDirection: style.flexDirection,
    justifyContent: style.justifyContent,
    alignItems: style.alignItems,
    alignContent: style.alignContent,
    flexWrap: style.flexWrap,
    gap: style.gap,
    rowGap: style.rowGap,
    columnGap: style.columnGap,
    gridTemplateColumns: style.gridTemplateColumns,
    gridTemplateRows: style.gridTemplateRows,
    gridAutoColumns: style.gridAutoColumns,
    gridAutoRows: style.gridAutoRows,
    gridAutoFlow: style.gridAutoFlow,
  };

  const responsiveProps = resolveBuilderProps(node.props, device);
  if (node.type === "section" && responsiveProps.contentWidth !== "full") {
    childrenStyle.width = "100%";
    childrenStyle.maxWidth = String(responsiveProps.containerWidth || "1200px");
    childrenStyle.marginLeft = "auto";
    childrenStyle.marginRight = "auto";
  } else if (node.type === "section") {
    childrenStyle.width = "100%";
    childrenStyle.maxWidth = "none";
  }

  return childrenStyle;
}

function getContainerPreviewStyle(
  node: BuilderNode,
  device: BuilderDevice,
): CSSProperties {
  const style = getNodeInlineStyle(node, device);
  if (style.display !== "none") style.display = "block";
  return style;
}

function getCanvasFlexItemStyle(
  node: BuilderNode,
  device: BuilderDevice,
): CSSProperties {
  const style = getNodeInlineStyle(node, device);
  return {
    width: style.width,
    minWidth: style.minWidth,
    maxWidth: style.maxWidth,
    flexGrow: style.flexGrow,
    flexShrink: style.flexShrink,
    flexBasis: style.flexBasis,
    order: style.order,
    alignSelf: style.alignSelf,
  };
}

/* -------------------------------------------------------
   Reusable Inspector Controls
------------------------------------------------------- */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label
      className={styles.fieldLabel}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 13,
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: "#334155",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function TextControl({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  list,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "url";
  list?: string;
  onFocus?: () => void;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        list={list}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
        style={CONTROL_STYLE}
      />
    </Field>
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{
    label: string;
    value: string;
  }>;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={CONTROL_STYLE}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function UnitControl({
  label,
  value,
  onChange,
  placeholder = "0px",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={CONTROL_STYLE}
      />
    </Field>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{
    label: string;
    value: string;
    title?: string;
  }>;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 13,
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: "#334155",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          padding: 3,
          background: "#f1f5f9",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
        }}
      >
        {options.map((option) => {
          const active = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              title={option.title || option.label}
              onClick={() => onChange(option.value)}
              style={{
                flex: "1 1 auto",
                minWidth: 42,
                border: active ? "1px solid #3984e8" : "1px solid transparent",
                borderRadius: 4,
                padding: "7px 8px",
                background: active ? "#fff" : "transparent",
                color: active ? "#2164c5" : "#475569",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpacingControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: BuilderSpacing;
  onChange: (value: BuilderSpacing) => void;
}) {
  const spacing: BuilderSpacing = {
    top: value?.top ?? "0px",
    right: value?.right ?? "0px",
    bottom: value?.bottom ?? "0px",
    left: value?.left ?? "0px",
    unit: value?.unit || "px",
    linked: value?.linked !== false,
  };

  const updateSide = (
    side: "top" | "right" | "bottom" | "left",
    nextValue: string,
  ) => {
    if (spacing.linked) {
      onChange({
        ...spacing,
        top: nextValue,
        right: nextValue,
        bottom: nextValue,
        left: nextValue,
      });
      return;
    }

    onChange({
      ...spacing,
      [side]: nextValue,
    });
  };

  return (
    <div style={{ marginBottom: 15 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 7,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#334155",
          }}
        >
          {label}
        </span>

        <div style={{ display: "flex", gap: 5 }}>
          <select
            aria-label={`${label} unit`}
            value={spacing.unit || "px"}
            onChange={(event) => {
              const unit = event.target.value as BuilderSpacing["unit"];
              const nextSides = Object.fromEntries(
                (["top", "right", "bottom", "left"] as const).map((side) => {
                  const current = spacing[side] || "0";
                  const numeric = current.replace(/\s*(px|%|em|rem|vw|vh)$/i, "");
                  return [side, unit === "auto" ? "auto" : numeric];
                }),
              ) as Pick<BuilderSpacing, "top" | "right" | "bottom" | "left">;
              onChange({ ...spacing, ...nextSides, unit });
            }}
            style={{ ...CONTROL_STYLE, width: 70, padding: "4px 6px" }}
          >
            {["px", "%", "em", "rem", ...(label.toLowerCase().includes("padding") ? [] : ["auto"])].map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
          <button
            type="button"
            title={spacing.linked ? "Unlink values" : "Link all values"}
            onClick={() =>
              onChange({
                ...spacing,
                linked: !spacing.linked,
              })
            }
            style={{
              ...BUTTON_STYLE,
              padding: "4px 7px",
              color: spacing.linked ? "#2164c5" : "#64748b",
              borderColor: spacing.linked ? "#3984e8" : "#cbd5e1",
            }}
          >
            {spacing.linked ? <Link2 size={13} /> : <Unlink size={13} />}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 5,
        }}
      >
        {(
          [
            ["top", "Top"],
            ["right", "Right"],
            ["bottom", "Bottom"],
            ["left", "Left"],
          ] as const
        ).map(([side, sideLabel]) => (
          <label
            key={side}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 10,
                textAlign: "center",
                color: "#64748b",
              }}
            >
              {sideLabel}
            </span>

            <input
              value={spacing[side] || ""}
              onChange={(event) => updateSide(side, event.target.value)}
              aria-label={`${label} ${sideLabel}`}
              style={{
                ...CONTROL_STYLE,
                padding: "7px 4px",
                textAlign: "center",
                fontSize: 11,
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function ControlGroup({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      style={{
        borderBottom: "1px solid #e2e8f0",
        paddingBottom: 10,
        marginBottom: 12,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          color: "#0c2f55",
          padding: "8px 0",
          userSelect: "none",
        }}
      >
        {title}
      </summary>

      <div style={{ paddingTop: 9 }}>{children}</div>
    </details>
  );
}

/* -------------------------------------------------------
   Canvas Preview
------------------------------------------------------- */

function PreviewNode({
  node,
  device,
}: {
  node: BuilderNode;
  device: BuilderDevice;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (
    !node.enabled ||
    node.advanced?.displayCondition === "hidden" ||
    (device === "desktop" && node.advanced?.hideOnDesktop) ||
    (device === "tablet" && node.advanced?.hideOnTablet) ||
    (device === "mobile" && node.advanced?.hideOnMobile)
  ) return null;

  const props = resolveBuilderProps(node.props, device);
  const children = node.children || [];
  const resolvedStyles = resolveBuilderStyles(node.styles, device);

  const inlineStyle = getNodeInlineStyle(node, device);

  if (hovered && resolvedStyles.backgroundHover) {
    Object.assign(inlineStyle, backgroundToCss(resolvedStyles.backgroundHover, device));
  }
  if (hovered && resolvedStyles.colorHover) {
    inlineStyle.color = getResponsiveScalar(resolvedStyles.colorHover, device);
  }
  if (hovered && resolvedStyles.transformSettingsHover) {
    inlineStyle.transform = builderTransformCss(resolvedStyles.transformSettingsHover);
    inlineStyle.transformOrigin =
      resolvedStyles.transformSettingsHover.origin || "center center";
  }
  if (hovered && resolvedStyles.borderHover?.style && resolvedStyles.borderHover.style !== "none") {
    inlineStyle.borderStyle = resolvedStyles.borderHover.style;
    inlineStyle.borderWidth = resolvedStyles.borderHover.width || "1px";
    inlineStyle.borderColor =
      getResponsiveScalar(resolvedStyles.borderHover.color, device) || "#dbe3ed";
    inlineStyle.borderRadius = getResponsiveValue(resolvedStyles.borderHover.radius, device);
  }
  if (hovered && resolvedStyles.boxShadowHover) {
    inlineStyle.boxShadow = resolvedStyles.boxShadowHover;
  }

  const advancedClass = node.advanced?.cssClasses || "";

  const commonProps = {
    id: node.advanced?.cssId || undefined,
    className: advancedClass || undefined,
    style: inlineStyle,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (LAYOUT_TYPES.has(node.type)) {
    const Tag = getLayoutHtmlTag(node);

    return (
      <Tag {...commonProps}>
        {children.map((child) => (
          <PreviewNode key={child.id} node={child} device={device} />
        ))}
      </Tag>
    );
  }

  if (node.type === "heading") {
    const level = String(props.level || "h2");
    const headingContent = getNodeText(node);
    const heading =
      level === "h1" ? <h1 {...commonProps}>{headingContent}</h1> :
      level === "h3" ? <h3 {...commonProps}>{headingContent}</h3> :
      level === "h4" ? <h4 {...commonProps}>{headingContent}</h4> :
      level === "h5" ? <h5 {...commonProps}>{headingContent}</h5> :
      level === "h6" ? <h6 {...commonProps}>{headingContent}</h6> :
      <h2 {...commonProps}>{headingContent}</h2>;
    if (props.linkType === "dynamic") {
      return <a href={props.dynamicLink === "homepage" ? "/" : "#"}>{heading}</a>;
    }
    if (props.link) {
      return (
        <a
          href={String(props.link)}
          target={props.linkTarget === "_blank" ? "_blank" : undefined}
          rel={props.linkTarget === "_blank" ? "noopener noreferrer" : undefined}
        >
          {heading}
        </a>
      );
    }

    switch (level) {
      case "h1":
        return <h1 {...commonProps}>{getNodeText(node)}</h1>;
      case "h3":
        return <h3 {...commonProps}>{getNodeText(node)}</h3>;
      case "h4":
        return <h4 {...commonProps}>{getNodeText(node)}</h4>;
      case "h5":
        return <h5 {...commonProps}>{getNodeText(node)}</h5>;
      case "h6":
        return <h6 {...commonProps}>{getNodeText(node)}</h6>;
      default:
        return <h2 {...commonProps}>{getNodeText(node)}</h2>;
    }
  }

  if (node.type === "text") {
    return (
      <p {...commonProps} className={`${styles.previewText} ${advancedClass}`}>
        {getNodeText(node)}
      </p>
    );
  }

  if (node.type === "button") {
    const ButtonIcon = themeIcons[String(props.iconName || "")];
    const iconImage = safeMediaUrl(String(props.iconImage || ""));
    const iconText = String(props.icon || "");
    return (
      <a
        {...commonProps}
        href={String(props.url || "#")}
        title={String(props.tooltip || "") || undefined}
        className={`${styles.previewButton} ${advancedClass}`}
        target={props.target === "_blank" ? "_blank" : undefined}
        rel={props.target === "_blank" ? "noopener noreferrer" : undefined}
      >
        {props.iconPosition === "before" && (ButtonIcon || iconImage || iconText) ? (
          <span>
            {iconImage ? <img src={iconImage} alt="" width={16} height={16} /> : ButtonIcon ? <ButtonIcon size={16} /> : iconText}
          </span>
        ) : null}

        {getNodeText(node)}

        {props.iconPosition === "after" && (ButtonIcon || iconImage || iconText) ? (
          <span>
            {iconImage ? <img src={iconImage} alt="" width={16} height={16} /> : ButtonIcon ? <ButtonIcon size={16} /> : iconText}
          </span>
        ) : null}
      </a>
    );
  }

  if (
    node.type === "image" ||
    node.type === "featured-image" ||
    node.type === "site-logo"
  ) {
    const src =
      typeof props.src === "string"
        ? props.src
        : typeof props.image === "string"
          ? props.image
          : "";

    const imageUrl = safeMediaUrl(src);

    const image = imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={String(props.alt || "")}
        title={String(props.title || "")}
        className={styles.previewImage}
        style={{
          ...inlineStyle,
          width: inlineStyle.width || (node.type === "site-logo" ? String(props.width || "180px") : undefined),
          height: inlineStyle.height || (node.type === "site-logo" ? String(props.height || "auto") : undefined),
          objectFit: String(
            props.objectFit || "cover",
          ) as CSSProperties["objectFit"],
          objectPosition: String(props.objectPosition || "center center"),
          maxWidth: "100%",
        }}
      />
    ) : (
      <div className={styles.imagePlaceholder}>
        <ImageIcon size={24} />
        <span>Select an image</span>
      </div>
    );

    return (
      <figure
        {...commonProps}
        style={{
          margin: 0,
          textAlign: String(
            props.alignment || "left",
          ) as CSSProperties["textAlign"],
        }}
      >
        {props.link ? (
          <a
            href={String(props.link)}
            target={props.linkTarget === "_blank" ? "_blank" : undefined}
            rel="noreferrer"
          >
            {image}
          </a>
        ) : (
          image
        )}

        {props.caption ? (
          <figcaption>{String(props.caption)}</figcaption>
        ) : null}
      </figure>
    );
  }

  if (node.type === "divider") {
    return (
      <hr
        {...commonProps}
        className={styles.previewDivider}
        style={{
          ...inlineStyle,
          border: 0,
          borderTop: `${String(props.thickness || "1px")} ${String(props.style || "solid")} ${String(props.color || "#e2e8f0")}`,
        }}
      />
    );
  }

  if (node.type === "spacer") {
    return (
      <div
        {...commonProps}
        className={styles.previewSpacer}
        style={{
          ...inlineStyle,
          minHeight: String(props.height || "40px"),
        }}
      />
    );
  }

  if (node.type === "icon") {
    const Icon = themeIcons[String(props.iconName || "")];
    const iconImage = typeof props.iconImage === "string" && props.iconImage ? props.iconImage : typeof props.src === "string" ? props.src : "";
    if (iconImage) {
      return (
        <span {...commonProps} className={styles.previewIcon}>
          <img src={safeMediaUrl(iconImage)} alt={String(props.alt || "")} style={{ width: Number(props.size || 24), height: Number(props.size || 24), objectFit: "contain" }} />
        </span>
      );
    }
    return (
      <span
        {...commonProps}
        className={styles.previewIcon}
        style={{
          ...inlineStyle,
          fontSize: Number(props.size || 24),
          color: String(props.color || "#0c2f55"),
        }}
      >
        {Icon ? <Icon size={Number(props.size || 24)} /> : String(props.symbol || "★")}
      </span>
    );
  }

  if (node.type === "icon-list") {
    const items = Array.isArray(props.items) ? props.items as Array<Record<string, unknown>> : [];
    return <ul {...commonProps} style={{ ...inlineStyle, listStyle: "none", padding: 0, margin: 0, display: "grid", gap: String(props.itemSpacing || "10px") }}>{items.map((item, index) => { const ItemIcon = themeIcons[String(item.iconName || "Check")]; const iconImage = safeMediaUrl(String(item.iconImage || "")); const iconSize = Number(props.iconSize || 16); const content = <><span style={{ display: "inline-flex", alignItems: "center", color: String(props.iconColor || "#3984e8") }}>{iconImage ? <img src={iconImage} alt="" width={iconSize} height={iconSize} style={{ objectFit: "contain" }} /> : ItemIcon ? <ItemIcon size={iconSize} color={String(props.iconColor || "#3984e8")} /> : "✓"}</span><span>{String(item.text || item.label || `List item ${index + 1}`)}</span></>; const href = String(item.url || "").trim(); return <li key={String(item.id || index)} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: props.divider ? "1px solid #e2e8f0" : undefined, paddingBottom: props.divider ? 8 : undefined }}>{href ? <a href={href} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>{content}</a> : content}</li>; })}</ul>;
  }

  if (node.type === "video") {
    const url = safeMediaUrl(String(props.url || ""));

    if (!url) {
      return (
        <div className={styles.imagePlaceholder}>
          <span>Select a video URL</span>
        </div>
      );
    }

    return (
      <video
        {...commonProps}
        src={url}
        poster={
          typeof props.poster === "string"
            ? safeMediaUrl(props.poster)
            : undefined
        }
        controls={props.controls !== false}
        autoPlay={Boolean(props.autoplay)}
        muted={Boolean(props.muted)}
        loop={Boolean(props.loop)}
        playsInline
        style={{
          ...inlineStyle,
          width: "100%",
          maxWidth: "100%",
        }}
      />
    );
  }

  if (node.type === "audio") {
    return (
      <audio
        {...commonProps}
        src={String(props.url || "")}
        controls={props.controls !== false}
        style={{
          width: "100%",
        }}
      />
    );
  }

  if (node.type === "icon-box") {
    const position = String(props.iconPosition || "top");
    return (
      <div
        {...commonProps}
        style={{
          ...inlineStyle,
          display: "flex",
          flexDirection: position === "left" ? "row" : position === "right" ? "row-reverse" : "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 30, color: String(props.iconColor || "#3984e8") }}>{props.iconImage ? <img src={safeMediaUrl(String(props.iconImage))} alt="" style={{ width: Number(props.iconSize || 40), height: Number(props.iconSize || 40), objectFit: "contain" }} /> : (() => { const Icon = themeIcons[String(props.iconName || "")]; return Icon ? <Icon size={Number(props.iconSize || 40)} /> : String(props.symbol || "★"); })()}</div>
        <div>
          <h3>{String(props.title || "Title")}</h3>
          <p>{String(props.description || "")}</p>
        </div>
      </div>
    );
  }

  if (node.type === "image-box") {
    const position = String(props.imagePosition || "top");
    const imageSrc = safeMediaUrl(String(props.image || ""));
    const image = imageSrc ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt={String(props.alt || "")}
        title={String(props.title || "")}
        style={{
          maxWidth: "100%",
          objectFit: String(props.objectFit || "cover") as CSSProperties["objectFit"],
        }}
      />
    ) : (
      <div className={styles.imagePlaceholder}>
        <ImageIcon size={22} />
      </div>
    );
    return (
      <div
        {...commonProps}
        style={{
          ...inlineStyle,
          display: "flex",
          flexDirection: position === "left" ? "row" : position === "right" ? "row-reverse" : "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {props.link ? (
          <a
            href={String(props.link)}
            target={props.linkTarget === "_blank" ? "_blank" : undefined}
            rel={props.linkTarget === "_blank" ? "noopener noreferrer" : undefined}
          >
            {image}
          </a>
        ) : image}
        <div>
          <h3>{String(props.title || "Image Box")}</h3>
          <p>{String(props.description || "")}</p>
          {props.caption ? <small>{String(props.caption)}</small> : null}
        </div>
      </div>
    );
  }

  if (node.type === "site-title") {
    const title = <strong {...commonProps}>{getNodeText(node)}</strong>;
    return props.link ? (
      <a href={String(props.link)} style={{ color: "inherit" }}>
        {title}
      </a>
    ) : (
      title
    );
  }

  if (node.type === "search-form") {
    return (
      <form
        {...commonProps}
        action="/search"
        style={{
          ...inlineStyle,
          display: "flex",
          width: inlineStyle.width || "100%",
          maxWidth: "100%",
          minWidth: 0,
          gap: 8,
          boxSizing: "border-box",
        }}
      >
        <input
          name="q"
          placeholder={String(props.placeholder || "Search...")}
          style={{ ...CONTROL_STYLE, flex: "1 1 0%", minWidth: 0 }}
        />
        {props.showButton !== false ? (
          <button type="submit" style={{ ...BUTTON_STYLE, flex: "0 0 auto" }}>
            {String(props.buttonText || "Search")}
          </button>
        ) : null}
      </form>
    );
  }

  if (node.type === "menu") {
    if (device === "mobile" && props.mobileToggle !== false) {
      const OpenIcon = themeIcons[String(props.openIcon || "Menu")] || Menu;
      const CloseIcon = themeIcons[String(props.closeIcon || "")] || X;
      return (
        <nav
          {...commonProps}
          aria-label="Mobile navigation preview"
          style={{ ...inlineStyle, position: "relative" }}
        >
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setMobileMenuOpen((open) => !open);
            }}
            style={{
              ...BUTTON_STYLE,
              border: 0,
              padding: 6,
              background: "transparent",
              color: String(props.iconColor || "#0c2f55"),
            }}
          >
            {mobileMenuOpen ? <CloseIcon size={22} /> : <OpenIcon size={22} />}
          </button>
          {mobileMenuOpen ? (
            <div
              style={{
                position: "absolute",
                zIndex: 30,
                top: "100%",
                right: 0,
                minWidth: String(props.mobileWidth || "260px"),
                maxWidth: "90vw",
                padding: 14,
                background: "#fff",
                color: "#1f2937",
                boxShadow: "0 8px 24px rgba(15,23,42,.18)",
              }}
            >
              {(Array.isArray(props.items) ? props.items : []).map((item, index) => {
                if (!item || typeof item !== "object") return null;
                const menuItem = item as Record<string, unknown>;
                const ItemIcon = themeIcons[String(props.itemIconName || "")];
                return (
                  <div key={String(menuItem.id || index)} style={{ padding: "8px 0" }}>
                    {ItemIcon ? (
                      <ItemIcon
                        size={16}
                        className={styles.menuItemIcon}
                        style={{ color: String(props.iconColor || "#0c2f55") }}
                      />
                    ) : null}
                    {String(menuItem.label || menuItem.title || "Menu item")}
                  </div>
                );
              })}
            </div>
          ) : null}
        </nav>
      );
    }

    const menuDirection = props.orientation === "vertical" ? "column" : "row";
    const menuAlignment =
      props.alignment === "center"
        ? "center"
        : props.alignment === "right"
          ? "flex-end"
          : "flex-start";
    const menuItems = Array.isArray(props.items)
      ? (props.items as Array<{
          id?: string;
          label?: string;
          title?: string;
          url?: string;
          href?: string;
          target?: string;
          children?: Array<Record<string, unknown>>;
          iconName?: string;
        }>)
      : [];
    const renderMenuItem = (
      item: (typeof menuItems)[number],
      index: number,
    ): ReactNode => {
      const ItemIcon = themeIcons[String(props.itemIconName || item.iconName || "")];
      return (
        <li key={item.id || index}>
          <a
            href={item.url || item.href || "#"}
            target={item.target === "_blank" ? "_blank" : undefined}
            rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
            style={{ color: "inherit" }}
          >
            {ItemIcon ? (
              <ItemIcon
                size={16}
                className={styles.menuItemIcon}
                style={{ color: String(props.iconColor || "#0c2f55") }}
              />
            ) : null}
            {item.label || item.title || "Menu item"}
          </a>
          {item.children?.length ? (
            <ul>{item.children.map((child, childIndex) => renderMenuItem(
              child as (typeof menuItems)[number],
              childIndex,
            ))}</ul>
          ) : null}
        </li>
      );
    };

    const menuItemStyles = props.menuItemStyles && typeof props.menuItemStyles === "object"
      ? props.menuItemStyles as Record<string, Record<string, Record<string, string>>>
      : {};
    const desktopMenuStyles = menuItemStyles.desktop || {};
    const selectedMenuStyles = menuItemStyles[device] || {};
    const currentMenuStyles = Object.fromEntries(
      (["normal", "hover", "active"] as const).map((state) => [
        state,
        {
          ...(desktopMenuStyles[state] || {}),
          ...(selectedMenuStyles[state] || {}),
        },
      ]),
    ) as Record<string, Record<string, string>>;
    const cssColor = (value: unknown) => typeof value === "string" && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,24}|transparent)$/i.test(value) ? value : "";
    const menuSelectorId = node.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const menuSelector = `[data-builder-node-id="${menuSelectorId}"]`;
    const stateDeclarations = (state: Record<string, string> | undefined) => {
      if (!state) return "";
      const declarations = [
        cssColor(state.color) ? `color:${cssColor(state.color)} !important` : "",
        cssColor(state.backgroundColor) ? `background-color:${cssColor(state.backgroundColor)} !important` : "",
      ].filter(Boolean);
      return declarations.join(";");
    };
    const normalDeclarations = stateDeclarations(currentMenuStyles.normal);
    const hoverDeclarations = stateDeclarations(currentMenuStyles.hover);
    const activeDeclarations = stateDeclarations(currentMenuStyles.active);
    const previewMenuCss = [
      normalDeclarations ? `${menuSelector} a{${normalDeclarations}}` : "",
      hoverDeclarations ? `${menuSelector} a:hover{${hoverDeclarations}}` : "",
      activeDeclarations ? `${menuSelector} > ul > li:first-child > a{${activeDeclarations}}` : "",
    ].filter(Boolean).join("\n");

    return (
      <nav
        {...commonProps}
        className={styles.previewMenu}
        style={{
          ...inlineStyle,
          display: "flex",
          flexDirection: menuDirection,
          justifyContent: menuAlignment,
          width: inlineStyle.width || "max-content",
        }}
      >
        {previewMenuCss ? <style>{previewMenuCss}</style> : null}
        <ul
          style={{
            display: "flex",
            flexDirection: menuDirection,
            flexWrap: "nowrap",
            justifyContent: menuAlignment,
            listStyle: "none",
            padding: 0,
            margin: 0,
            gap: 18,
            columnGap:
              getResponsiveValue(node.styles.columnGap, device) ||
              getResponsiveValue(node.styles.gap, device) ||
              "18px",
            rowGap:
              getResponsiveValue(node.styles.rowGap, device) ||
              getResponsiveValue(node.styles.gap, device) ||
              "18px",
            width: "max-content",
          }}
        >
          {menuItems.map(renderMenuItem)}
        </ul>

        {menuItems.length === 0 && (
          <span>Menu preview · {String(props.menuLocation || "HEADER")}</span>
        )}
      </nav>
    );
  }

  if (node.type === "accordion") {
    const items = Array.isArray(props.items)
      ? (props.items as Array<{
          id?: string;
          title?: string;
          content?: string;
        }>)
      : [];

    return (
      <div {...commonProps}>
        {items.map((item, index) => (
          <details
            key={item.id || index}
            open={Boolean(props.firstOpen) && index === 0}
            style={{
              borderBottom: "1px solid #e2e8f0",
              padding: "12px 0",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {item.title || `Item ${index + 1}`}
            </summary>
            <div style={{ paddingTop: 9 }}>{item.content || ""}</div>
          </details>
        ))}
      </div>
    );
  }

  if (node.type === "toggle") {
    return (
      <details {...commonProps} open={Boolean(props.open)}>
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {String(props.title || "Toggle")}
        </summary>
        <div style={{ paddingTop: 10 }}>{String(props.content || "")}</div>
      </details>
    );
  }

  if (node.type === "tabs") {
    const tabs = Array.isArray(props.tabs)
      ? (props.tabs as Array<{
          id?: string;
          title?: string;
          content?: string;
        }>)
      : [];

    return (
      <div {...commonProps}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id || index}
              type="button"
              onClick={() => setActiveTab(index)}
              style={{
                ...BUTTON_STYLE,
                borderColor: activeTab === index ? "#3984e8" : "#cbd5e1",
                color: activeTab === index ? "#2164c5" : "#334155",
              }}
            >
              {tab.title || `Tab ${index + 1}`}
            </button>
          ))}
        </div>

        <div style={{ padding: 12 }}>{tabs[activeTab]?.content || ""}</div>
      </div>
    );
  }

  if (node.type === "form") {
    const fields = Array.isArray(props.fields)
      ? (props.fields as Array<{
          id?: string;
          type?: string;
          label?: string;
          name?: string;
          required?: boolean;
          placeholder?: string;
        }>)
      : [];

    return (
      <form {...commonProps} onSubmit={(event) => event.preventDefault()}>
        {fields.map((field, index) => (
          <label
            key={field.id || index}
            style={{
              display: "block",
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            <span>{field.label || "Field"}</span>

            {field.type === "textarea" ? (
              <textarea
                placeholder={field.placeholder}
                required={Boolean(field.required)}
                style={{
                  ...CONTROL_STYLE,
                  display: "block",
                  marginTop: 5,
                  minHeight: 75,
                }}
              />
            ) : (
              <input
                type={
                  ["email", "tel", "number", "url", "password"].includes(
                    String(field.type),
                  )
                    ? String(field.type)
                    : "text"
                }
                name={field.name}
                placeholder={field.placeholder}
                required={Boolean(field.required)}
                style={{
                  ...CONTROL_STYLE,
                  display: "block",
                  marginTop: 5,
                }}
              />
            )}
          </label>
        ))}

        <button
          type="submit"
          style={{
            ...BUTTON_STYLE,
            background: "#0c2f55",
            color: "#fff",
          }}
        >
          {String(props.submitText || "Submit")}
        </button>
      </form>
    );
  }

  if (node.type === "counter") {
    return (
      <div {...commonProps}>
        <strong style={{ fontSize: 28 }}>
          {String(props.prefix || "")}
          {String(props.end || 0)}
          {String(props.suffix || "")}
        </strong>
        <div>{String(props.title || "")}</div>
      </div>
    );
  }

  if (node.type === "progress") {
    const percent = Math.min(100, Math.max(0, Number(props.percentage || 0)));

    return (
      <div {...commonProps}>
        <div>{String(props.title || "Progress")}</div>
        <div
          style={{
            height: 9,
            borderRadius: 20,
            background: "#e2e8f0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              background: "#3984e8",
            }}
          />
        </div>
        <small>{percent}%</small>
      </div>
    );
  }

  if (node.type === "rating") {
    const maximum = Math.max(
      1,
      Math.min(10, Math.round(Number(props.maxRating || 5))),
    );
    const rating = Math.min(
      maximum,
      Math.max(0, Math.round(Number(props.rating || 0))),
    );

    return (
      <div {...commonProps}>
        {"★".repeat(Math.round(rating))}
        {"☆".repeat(maximum - Math.round(rating))}
      </div>
    );
  }

  if (node.type === "testimonial") {
    return (
      <blockquote {...commonProps}>
        <p>{String(props.quote || "")}</p>
        <strong>{String(props.name || "")}</strong>
        <small>{String(props.role || "")}</small>
      </blockquote>
    );
  }

  if (node.type === "price-table") {
    const features = Array.isArray(props.features) ? props.features : [];

    return (
      <div
        {...commonProps}
        style={{
          ...inlineStyle,
          border: "1px solid #e2e8f0",
          borderRadius: 9,
          padding: 20,
          textAlign: "center",
        }}
      >
        <h3>{String(props.title || "Plan")}</h3>
        <strong style={{ fontSize: 30 }}>
          {String(props.currency || "₹")}
          {String(props.price || "0")}
        </strong>
        <small> / {String(props.period || "month")}</small>

        <ul>
          {features.map((feature, index) => (
            <li key={index}>{String(feature)}</li>
          ))}
        </ul>

        <a href={String(props.buttonUrl || "#")}>
          {String(props.buttonText || "Choose Plan")}
        </a>
      </div>
    );
  }

  if (node.type === "call-to-action") {
    return (
      <div {...commonProps}>
        <h3>{String(props.title || "")}</h3>
        <p>{String(props.description || "")}</p>
        <a href={String(props.buttonUrl || "#")}>
          {String(props.buttonText || "Learn More")}
        </a>
      </div>
    );
  }

  if (node.type === "slides") {
    const rawSlides = Array.isArray(props.slides) ? props.slides : [];
    const slides: BannerSliderSlide[] = rawSlides.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as Record<string, unknown>;
      const rawButtons = Array.isArray(entry.buttons) ? entry.buttons : [];
      return [{
        id: typeof entry.id === "string" ? entry.id : String(index),
        heading: typeof entry.heading === "string" ? entry.heading : "",
        descriptionHtml: sanitizeHtml(
          typeof entry.description === "string"
            ? entry.description
            : typeof entry.content === "string"
              ? entry.content
              : "",
          {
            allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a", "h3", "h4"],
            allowedAttributes: { a: ["href", "target", "rel"] },
            allowedSchemes: ["http", "https", "mailto", "tel"],
            allowProtocolRelative: false,
          },
        ),
        backgroundImage: typeof entry.backgroundImage === "string" ? entry.backgroundImage : typeof entry.image === "string" ? entry.image : "",
        backgroundColor: typeof entry.backgroundColor === "string" ? entry.backgroundColor : "",
        backgroundPosition: typeof entry.backgroundPosition === "string" ? entry.backgroundPosition : "center",
        overlayColor: typeof entry.overlayColor === "string" ? entry.overlayColor : "",
        overlayOpacity: Number(entry.overlayOpacity || 0),
        imageEffect: typeof entry.imageEffect === "string" ? entry.imageEffect : "none",
        headingColor: typeof entry.headingColor === "string" ? entry.headingColor : "",
        textColor: typeof entry.textColor === "string" ? entry.textColor : "",
        buttons: rawButtons.filter((button): button is Record<string, unknown> => Boolean(button) && typeof button === "object").slice(0, 3).map((button) => ({
          text: typeof button.text === "string" ? button.text : "",
          url: typeof button.url === "string" ? button.url : "",
          linkType: typeof button.linkType === "string" ? button.linkType : "normal",
          dynamicLink: typeof button.dynamicLink === "string" ? button.dynamicLink : "current-page",
          target: typeof button.target === "string" ? button.target : "_self",
          width: typeof button.width === "string" ? button.width : "fit-content",
          backgroundColor: typeof button.backgroundColor === "string" ? button.backgroundColor : "",
          textColor: typeof button.textColor === "string" ? button.textColor : "",
          hoverBackgroundColor: typeof button.hoverBackgroundColor === "string" ? button.hoverBackgroundColor : "",
          hoverTextColor: typeof button.hoverTextColor === "string" ? button.hoverTextColor : "",
          iconImage: typeof button.iconImage === "string" ? button.iconImage : "",
          iconPosition: typeof button.iconPosition === "string" ? button.iconPosition : "before",
        })),
      }];
    });

    return slides.length ? (
      <BannerSlider
        id={node.advanced?.cssId || undefined}
        className={node.advanced?.cssClasses || undefined}
        style={inlineStyle}
        slides={slides}
        autoplay={props.autoplay !== false}
        autoplayDelay={Number(props.autoplayDelay || 5000)}
        navigation={props.navigation !== false}
        pagination={props.pagination !== false}
        transition={String(props.transition || "slide")}
      />
    ) : (
      <div {...commonProps} className={styles.imagePlaceholder}>
        Add slides from the Content panel
      </div>
    );
  }

  if (node.type === "image-carousel" || node.type === "media-carousel") {
    const rawItems =
      node.type === "image-carousel" ? props.images : props.items;

    const items = Array.isArray(rawItems)
      ? (rawItems as Array<
          string | { url?: string; src?: string; alt?: string }
        >)
      : [];

    return (
      <div
        {...commonProps}
        style={{
          ...inlineStyle,
          display: "flex",
          gap: 12,
          overflowX: "auto",
        }}
      >
        {items.map((item, index) => {
          const url =
            typeof item === "string" ? item : item.url || item.src || "";

          return url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={index}
              src={safeMediaUrl(url)}
              alt={typeof item === "string" ? "" : item.alt || ""}
              style={{
                width: "100%",
                maxWidth: 240,
                objectFit: "cover",
              }}
            />
          ) : null;
        })}

        {items.length === 0 && (
          <div className={styles.imagePlaceholder}>Add carousel images</div>
        )}
      </div>
    );
  }

  if (node.type === "posts" || node.type === "loop-grid") {
    return (
      <div
        {...commonProps}
        style={{
          ...inlineStyle,
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(
            1,
            Number(props.columns || 3),
          )}, minmax(0, 1fr))`,
          gap: 12,
        }}
      >
        {Array.from(
          {
            length: Math.min(6, Math.max(1, Number(props.count || 3))),
          },
          (_, index) => (
            <article
              key={index}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                overflow: "hidden",
                padding: 10,
              }}
            >
              <div
                style={{
                  background: "#e2e8f0",
                  height: 70,
                  marginBottom: 8,
                }}
              />
              <strong>Post preview {index + 1}</strong>
              <p style={{ fontSize: 12 }}>Dynamic post content preview.</p>
            </article>
          ),
        )}
      </div>
    );
  }

  if (node.type === "breadcrumbs") {
    return (
      <nav {...commonProps}>
        {props.showHome !== false ? <>Home {String(props.separator || "/")} </> : null}
        Current Page
      </nav>
    );
  }

  if (node.type === "google-maps") {
    return (
      <div {...commonProps} className={styles.previewPlaceholder}>
        Map preview: {String(props.address || "Set a map address")}
      </div>
    );
  }

  if (node.type === "lottie") {
    return (
      <div className={styles.previewPlaceholder}>
        Lottie preview: {String(props.url || "Select Lottie JSON")}
      </div>
    );
  }

  if (node.type === "html") {
    const htmlPreview = sanitizeHtml(String(props.html || ""), { allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "figure", "figcaption"], allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, "*": ["class", "style"], a: ["href", "target", "rel"], img: ["src", "alt", "title", "width", "height"] }, allowedSchemes: ["http", "https", "mailto", "tel"], allowProtocolRelative: false });
    return <div {...commonProps} dangerouslySetInnerHTML={{ __html: htmlPreview || '<span style="color:#94a3b8">Paste HTML in Content tab</span>' }} />;
  }

  if (node.type === "shortcode") {
    return <div {...commonProps} className={styles.previewPlaceholder}>Shortcode preview: {String(props.shortcode || "Enter [connect_form id=\"FORM_ID\"] in Content")}</div>;
  }

  if (node.type === "site-title") {
    return <strong {...commonProps}>{getNodeText(node)}</strong>;
  }

  return (
    <div {...commonProps} className={styles.previewPlaceholder}>
      {getNodeText(node)}
    </div>
  );
}

/* -------------------------------------------------------
   Drag & Drop Components
------------------------------------------------------- */

function PaletteWidget({
  widget,
  onAdd,
}: {
  widget: (typeof BUILDER_WIDGETS)[number];
  onAdd: () => void;
}) {
  const WidgetIcon =
    LucideIcons[widget.icon as keyof typeof LucideIcons] as typeof LayoutGrid;
  const drag = useDraggable({
    id: `palette:${widget.type}`,
    data: {
      kind: "widget",
      widgetType: widget.type,
    },
  });

  return (
    <button
      ref={drag.setNodeRef}
      type="button"
      className={styles.widgetButton}
      style={{
        opacity: drag.isDragging ? 0.4 : 1,
        transform: CSS.Transform.toString(drag.transform),
        touchAction: "none",
      }}
      {...drag.listeners}
      {...drag.attributes}
      onClick={onAdd}
      title={widget.description}
    >
      <span className={styles.widgetIcon}>
        <WidgetIcon size={18} />
      </span>
      <span>{widget.label}</span>
    </button>
  );
}

function DropArea({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${id}`,
    data: {
      kind: "container",
      parentId: id === "root" ? null : id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={className}
      data-over={isOver ? "true" : "false"}
      style={{
        minHeight: 30,
        outline: isOver ? "2px dashed #3984e8" : undefined,
        outlineOffset: 3,
        transition: "outline .12s ease",
      }}
    >
      {children}
    </div>
  );
}

function SortableCanvasNode({
  node,
  selectedId,
  device,
  onSelect,
  onDelete,
  onDuplicate,
  onContextMenu,
}: {
  node: BuilderNode;
  selectedId: string | null;
  device: BuilderDevice;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (node: BuilderNode) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}) {
  const locked = Boolean(node.locked || node.advanced?.locked);

  const sortable = useSortable({
    id: node.id,
    disabled: locked,
    data: {
      kind: "node",
      nodeId: node.id,
    },
  });

  const selected = selectedId === node.id;
  const children = node.children || [];
  const isLayout = LAYOUT_TYPES.has(node.type);
  const deviceStyles = resolveBuilderStyles(node.styles, device);
  const layoutDisplay =
    getResponsiveValue(deviceStyles.display, device) ||
    (node.type === "grid" ? "grid" : "flex");
  const layoutDirection =
    getResponsiveValue(deviceStyles.direction, device) ||
    (node.type === "row" ? "row" : "column");
  const sortingStrategy =
    layoutDisplay === "grid"
      ? rectSortingStrategy
      : layoutDisplay === "flex" && layoutDirection.startsWith("row")
        ? horizontalListSortingStrategy
        : verticalListSortingStrategy;

  return (
    <div
      ref={sortable.setNodeRef}
      className={`${styles.canvasNode} ${
        selected ? styles.canvasNodeSelected : ""
      } ${sortable.isDragging ? styles.canvasNodeDragging : ""}`}
      style={{
        ...getCanvasFlexItemStyle(node, device),
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: node.enabled ? 1 : 0.45,
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (
          event.target instanceof Element &&
          event.target.closest("a")
        ) {
          event.preventDefault();
        }
        onSelect(node.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu(node.id, event.clientX, event.clientY);
      }}
    >
      <div className={styles.nodeToolbar}>
        <button
          type="button"
          className={styles.dragHandle}
          title={locked ? "Element locked" : "Drag element"}
          disabled={locked}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <Move size={13} />
        </button>

        <span>
          {node.label}
          {locked ? " 🔒" : ""}
          {!node.enabled ? " (Hidden)" : ""}
        </span>

        <div className={styles.nodeActions}>
          <button
            type="button"
            title="Duplicate"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(node);
            }}
          >
            <Copy size={13} />
          </button>

          <button
            type="button"
            title="Delete"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(node.id);
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {isLayout ? (
        <div
          className={
            node.type === "section" ? styles.previewSection : styles.nodePreview
          }
          style={getContainerPreviewStyle(node, device)}
        >
          <DropArea id={node.id} className={styles.nestedDropArea}>
            {children.length > 0 ? (
              <SortableContext
                items={children.map((child) => child.id)}
                strategy={sortingStrategy}
              >
                <div
                  className={`${styles.canvasElements} ${styles.containerElements}`}
                  style={getContainerChildrenStyle(node, device)}
                >
                  {children.map((child) => (
                    <SortableCanvasNode
                      key={child.id}
                      node={child}
                      selectedId={selectedId}
                      device={device}
                      onSelect={onSelect}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                      onContextMenu={onContextMenu}
                    />
                  ))}
                </div>
              </SortableContext>
            ) : (
              <div className={styles.emptyContainer}>Drop elements here</div>
            )}
          </DropArea>
        </div>
      ) : (
        <div className={styles.nodePreview}>
          <PreviewNode node={node} device={device} />
        </div>
      )}
    </div>
  );
}

function NavigatorNode({
  node,
  depth,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleEnabled,
  onToggleLocked,
  onRename,
}: {
  node: BuilderNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (node: BuilderNode) => void;
  onToggleEnabled: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onRename: (node: BuilderNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const locked = Boolean(node.locked || node.advanced?.locked);

  const sortable = useSortable({
    id: `navigator:${node.id}`,
    disabled: locked,
    data: {
      kind: "node",
      nodeId: node.id,
    },
  });

  const hasChildren = Boolean(node.children?.length);

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.4 : 1,
      }}
    >
      <div
        className={
          selectedId === node.id
            ? styles.navigatorItemActive
            : styles.navigatorItem
        }
        style={{
          paddingLeft: 8 + depth * 14,
          display: "flex",
          alignItems: "center",
          gap: 3,
          opacity: node.enabled ? 1 : 0.55,
        }}
      >
        <button
          type="button"
          title="Drag to reorder"
          disabled={locked}
          {...sortable.attributes}
          {...sortable.listeners}
          style={{
            border: 0,
            background: "transparent",
            color: "inherit",
            padding: 2,
            cursor: locked ? "not-allowed" : "grab",
          }}
        >
          <Move size={12} />
        </button>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label="Expand element"
          style={{
            border: 0,
            background: "transparent",
            padding: 2,
            color: "inherit",
          }}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : (
            <span style={{ display: "inline-block", width: 13 }} />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => onRename(node)}
          title="Select or double-click to rename"
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            background: "transparent",
            color: "inherit",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
          }}
        >
          <Layers size={12} />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.label}
          </span>
        </button>

        <button
          type="button"
          title={node.enabled ? "Hide element" : "Show element"}
          onClick={() => onToggleEnabled(node.id)}
          style={{
            border: 0,
            background: "transparent",
            color: "inherit",
            padding: 2,
            cursor: "pointer",
          }}
        >
          {node.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>

        <button
          type="button"
          title={locked ? "Unlock" : "Lock"}
          onClick={() => onToggleLocked(node.id)}
          style={{
            border: 0,
            background: "transparent",
            color: "inherit",
            padding: 2,
            cursor: "pointer",
          }}
        >
          {locked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>

        <button
          type="button"
          title="Duplicate"
          onClick={() => onDuplicate(node)}
          style={{
            border: 0,
            background: "transparent",
            color: "inherit",
            padding: 2,
            cursor: "pointer",
          }}
        >
          <Copy size={12} />
        </button>

        <button
          type="button"
          title="Delete"
          onClick={() => onDelete(node.id)}
          style={{
            border: 0,
            background: "transparent",
            color: "inherit",
            padding: 2,
            cursor: "pointer",
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && node.children && node.children.length > 0 && (
        <SortableContext
          items={node.children.map((child) => `navigator:${child.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {node.children.map((child) => (
            <NavigatorNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onToggleEnabled={onToggleEnabled}
              onToggleLocked={onToggleLocked}
              onRename={onRename}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

export default function UniversalBuilder({ target }: Props) {
  const documentKey = useMemo(
    () => createDocumentKey(target.kind, target),
    [target.kind, target.id, target.slug, target.postTypeSlug],
  );

  const [layout, setLayout] = useState<BuilderLayout>(() =>
    createDefaultLayout(target.kind),
  );

  const [title, setTitle] = useState(
    target.title || `${KIND_LABELS[target.kind]} Builder`,
  );

  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">(
    "DRAFT",
  );

  const [settings, setSettings] = useState<Record<string, unknown>>(() =>
    createDefaultSettings(target.kind),
  );

  const [globalStyles, setGlobalStyles] = useState<BuilderGlobalStyles>(
    DEFAULT_GLOBAL_STYLES,
  );

  const [conditions, setConditions] = useState<Record<string, unknown>>(
    createDefaultConditions(),
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<NodeContextMenu>(null);
  const [nodeClipboard, setNodeClipboard] = useState<BuilderNode | null>(null);

  const [device, setDevice] = useState<BuilderDevice>("desktop");

  const [activePanel, setActivePanel] = useState<
    "widgets" | "navigator" | "settings"
  >("widgets");

  const [elementTab, setElementTab] = useState<"widgets" | "globals" | "yoast">(
    "widgets",
  );

  const [inspectorTab, setInspectorTab] = useState<
    "content" | "layout" | "style" | "advanced"
  >("content");
  const [imageOpacityState, setImageOpacityState] = useState<"normal" | "hover">("normal");
  const [backgroundState, setBackgroundState] = useState<"normal" | "hover">("normal");
  const [textColorState, setTextColorState] = useState<"normal" | "hover">("normal");
  const [menuItemState, setMenuItemState] = useState<"normal" | "hover" | "active">("normal");
  const [borderState, setBorderState] = useState<"normal" | "hover">("normal");
  const [transformState, setTransformState] = useState<"normal" | "hover">("normal");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [widgetSearch, setWidgetSearch] = useState("");

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<IconPickerTarget>(null);
  const [linkSuggestions, setLinkSuggestions] = useState<LinkSuggestion[]>([]);
  const [linkSuggestionsLoaded, setLinkSuggestionsLoaded] = useState(false);
  const linkSuggestionsRequest = useRef<Promise<void> | null>(null);

  const [mediaTarget, setMediaTarget] = useState<MediaTarget>("widget");
  const [mediaItemIndex, setMediaItemIndex] = useState<number | null>(null);
  const [mediaButtonIndex, setMediaButtonIndex] = useState<number | null>(null);

  const [mediaLoading, setMediaLoading] = useState(false);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  const [mediaSearch, setMediaSearch] = useState("");

  const [builderMenus, setBuilderMenus] = useState<BuilderMenu[]>([]);

  const menuRequestId = useRef(0);

  const [revisionOpen, setRevisionOpen] = useState(false);

  const [revisionLoading, setRevisionLoading] = useState(false);

  const [revisions, setRevisions] = useState<RevisionItem[]>([]);

  const [importing, setImporting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [contextMenu]);

  const selectedNode = useMemo(() => {
    const rawNode = findNode(layout.root, selectedId);
    if (!rawNode) return undefined;
    return {
      ...rawNode,
      props: resolveBuilderProps(rawNode.props, device),
      styles: resolveBuilderStyles(rawNode.styles, device),
    };
  }, [layout.root, selectedId, device]);

  const isLayoutNode = Boolean(
    selectedNode && LAYOUT_TYPES.has(selectedNode.type),
  );

  const commitRoot = useCallback(
    (nextRoot: BuilderNode[]) => {
      setLayout({
        version: 1,
        root: nextRoot,
      });

      setHistory((current) => {
        const base = current.slice(0, historyIndex + 1);

        return [
          ...base,
          {
            root: structuredClone(nextRoot),
          },
        ];
      });

      setHistoryIndex((index) => index + 1);
    },
    [historyIndex],
  );

  const undo = () => {
    if (historyIndex <= 0) return;

    const nextIndex = historyIndex - 1;

    setHistoryIndex(nextIndex);

    setLayout({
      version: 1,
      root: structuredClone(history[nextIndex].root),
    });
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) {
      return;
    }

    const nextIndex = historyIndex + 1;

    setHistoryIndex(nextIndex);

    setLayout({
      version: 1,
      root: structuredClone(history[nextIndex].root),
    });
  };

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/builder/documents?documentKey=${encodeURIComponent(
          documentKey,
        )}`,
        {
          cache: "no-store",
        },
      );

      const result = (await response.json()) as DocumentResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load builder.");
      }

      if (result.document) {
        const doc = result.document;

        const root =
          doc.layout?.version === 1 && Array.isArray(doc.layout.root)
            ? doc.layout.root
            : createDefaultLayout(target.kind).root;

        setLayout({
          version: 1,
          root,
        });

        setHistory([
          {
            root: structuredClone(root),
          },
        ]);

        setHistoryIndex(0);
        setTitle(doc.title);
        setStatus(doc.status);

        setSettings(doc.settings || createDefaultSettings(target.kind));

        setGlobalStyles(doc.globalStyles || DEFAULT_GLOBAL_STYLES);

        setConditions(
          (doc.conditions || createDefaultConditions()) as Record<
            string,
            unknown
          >,
        );
      } else {
        const root = createDefaultLayout(target.kind).root;

        setLayout({
          version: 1,
          root,
        });

        setHistory([
          {
            root: structuredClone(root),
          },
        ]);

        setHistoryIndex(0);
        setStatus("DRAFT");
        setSettings(createDefaultSettings(target.kind));
        setGlobalStyles(DEFAULT_GLOBAL_STYLES);
        setConditions(createDefaultConditions());
      }

      setSelectedId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load builder document.",
      );
    } finally {
      setLoading(false);
    }
  }, [documentKey, target.kind]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    let active = true;

    async function loadMenus() {
      try {
        const response = await fetch("/api/admin/menus", {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load navigation menus.");
        }
        if (active) setBuilderMenus(normalizeBuilderMenus(result.menus));
      } catch (menuError) {
        if (active) {
          setError(
            menuError instanceof Error
              ? menuError.message
              : "Unable to load navigation menus."
          );
        }
      }
    }

    void loadMenus();
    return () => {
      active = false;
    };
  }, []);

  const createWidget = (type: string): BuilderNode | null => {
    const definition = BUILDER_WIDGETS.find((item) => item.type === type);

    if (!definition) return null;

    return createDefaultNode(
      definition.type,
      definition.label,
      makeId(definition.type),
      structuredClone(definition.defaultProps),
      [],
    );
  };

  const addWidget = (type: string, parentId: string | null = null) => {
    const node = createWidget(type);

    if (!node) return;

    commitRoot(insertTree(layout.root, parentId, node));

    setSelectedId(node.id);
    setActivePanel("settings");
    setInspectorTab(LAYOUT_TYPES.has(node.type) ? "layout" : "content");
  };

  const deleteNode = (id: string) => {
    const result = removeTree(layout.root, id);

    if (!result.removed) return;

    const deletedIds = getAllNodeIds([result.removed]);

    commitRoot(result.nodes);

    if (selectedId && deletedIds.includes(selectedId)) {
      setSelectedId(null);
    }
  };

  const duplicateNode = (node: BuilderNode) => {
    const duplicate = cloneNode(node);

    duplicate.label = `${node.label} Copy`;

    const parentId = findParent(layout.root, node.id);

    if (parentId === undefined) return;

    const siblings =
      parentId === null
        ? layout.root
        : findNode(layout.root, parentId)?.children || [];

    const index = siblings.findIndex((item) => item.id === node.id);

    if (index === -1) return;

    const next = [...siblings];

    next.splice(index + 1, 0, duplicate);

    const nextRoot =
      parentId === null
        ? next
        : updateTree(layout.root, parentId, (parent) => ({
            ...parent,
            children: next,
          }));

    commitRoot(nextRoot);
    setSelectedId(duplicate.id);
    setActivePanel("settings");
  };

  const openNodeContextMenu = (id: string, x: number, y: number) => {
    const node = findNode(layout.root, id);
    if (!node) return;

    setSelectedId(id);
    setActivePanel("settings");
    setInspectorTab(LAYOUT_TYPES.has(node.type) ? "layout" : "content");
    setContextMenu({
      nodeId: id,
      left: Math.max(8, Math.min(x, window.innerWidth - 232)),
      top: Math.max(8, Math.min(y, window.innerHeight - 328)),
    });
  };

  const copyNodeToClipboard = (id: string) => {
    const node = findNode(layout.root, id);
    if (node) setNodeClipboard(structuredClone(node));
    setContextMenu(null);
  };

  const pasteNode = () => {
    if (!nodeClipboard) return;

    const parentId = selectedId ? findParent(layout.root, selectedId) : null;
    if (parentId === undefined) return;

    const siblings =
      parentId === null
        ? layout.root
        : findNode(layout.root, parentId)?.children || [];
    const selectedIndex = selectedId
      ? siblings.findIndex((node) => node.id === selectedId)
      : siblings.length - 1;
    if (selectedId && selectedIndex === -1) return;

    const pasted = cloneNode(nodeClipboard);
    pasted.label = `${nodeClipboard.label} Copy`;
    const nextSiblings = [...siblings];
    nextSiblings.splice(selectedIndex + 1, 0, pasted);

    const nextRoot =
      parentId === null
        ? nextSiblings
        : updateTree(layout.root, parentId, (parent) => ({
            ...parent,
            children: nextSiblings,
          }));

    commitRoot(nextRoot);
    setSelectedId(pasted.id);
    setActivePanel("settings");
    setContextMenu(null);
  };

  const pasteNodeStyle = () => {
    if (!selectedId || !nodeClipboard) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => ({
        ...node,
        styles: structuredClone(nodeClipboard.styles),
      })),
    );
    setContextMenu(null);
  };

  const resetNodeStyle = (id: string) => {
    const node = findNode(layout.root, id);
    const defaults = node ? createWidget(node.type) : null;
    if (!node || !defaults) return;

    commitRoot(
      updateTree(layout.root, id, (current) => ({
        ...current,
        styles: structuredClone(defaults.styles),
      })),
    );
    setContextMenu(null);
  };

  const renameNode = (node: BuilderNode) => {
    const nextLabel = window.prompt("Element name", node.label);

    if (nextLabel === null || !nextLabel.trim()) {
      return;
    }

    commitRoot(
      updateTree(layout.root, node.id, (current) => ({
        ...current,
        label: nextLabel.trim(),
      })),
    );
  };

  const toggleNodeEnabled = (id: string) => {
    commitRoot(
      updateTree(layout.root, id, (node) => ({
        ...node,
        enabled: !node.enabled,
      })),
    );
  };

  const toggleNodeLocked = (id: string) => {
    commitRoot(
      updateTree(layout.root, id, (node) => {
        const locked = !(node.locked || node.advanced?.locked);

        return {
          ...node,
          locked,
          advanced: {
            ...(node.advanced || {}),
            locked,
          },
        };
      }),
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.kind === "widget") {
      const type = String(activeData.widgetType || "");

      const node = createWidget(type);

      if (!node) return;

      let parentId: string | null = null;
      let overId = "";

      if (overData?.kind === "container") {
        parentId = (overData.parentId as string | null) ?? null;
      } else if (overData?.kind === "node") {
        const targetId = String(overData.nodeId || over.id);

        const targetNode = findNode(layout.root, targetId);

        if (!targetNode) return;

        if (LAYOUT_TYPES.has(targetNode.type)) {
          parentId = targetNode.id;
        } else {
          parentId = findParent(layout.root, targetId) ?? null;
          overId = targetId;
        }
      } else {
        return;
      }

      const nextRoot = overId
        ? insertBeforeNode(layout.root, parentId, overId, node)
        : insertTree(layout.root, parentId, node);

      commitRoot(nextRoot);
      setSelectedId(node.id);
      setActivePanel("settings");
      setInspectorTab(LAYOUT_TYPES.has(node.type) ? "layout" : "content");

      return;
    }

    if (activeData?.kind !== "node") return;

    const activeId = String(
      activeData.nodeId || String(active.id).replace("navigator:", ""),
    );

    const movingNode = findNode(layout.root, activeId);

    if (!movingNode || movingNode.locked || movingNode.advanced?.locked) {
      return;
    }

    let parentId: string | null = null;
    let overId = "";

    if (overData?.kind === "container") {
      parentId = (overData.parentId as string | null) ?? null;
    } else if (overData?.kind === "node") {
      const targetId = String(overData.nodeId || over.id);

      if (targetId === activeId) return;

      const targetNode = findNode(layout.root, targetId);

      if (!targetNode) return;

      if (LAYOUT_TYPES.has(targetNode.type)) {
        parentId = targetNode.id;
      } else {
        parentId = findParent(layout.root, targetId) ?? null;
        overId = targetId;
      }
    } else {
      return;
    }

    const descendants = getAllNodeIds([movingNode]);

    if (parentId && descendants.includes(parentId)) {
      return;
    }

    const nextRoot = moveNode(layout.root, activeId, overId, parentId);

    if (nextRoot !== layout.root) {
      commitRoot(nextRoot);
    }
  };

  const updateProps = (key: string, value: unknown) => {
    if (!selectedId) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => ({
        ...node,
        props: {
          ...node.props,
          [key]: value,
        },
      })),
    );
  };

  const updateResponsiveProp = (key: string, value: unknown) => {
    if (!selectedId) return;
    commitRoot(
      updateTree(layout.root, selectedId, (node) => ({
        ...node,
        props: setBuilderPropForDevice(node.props, key, value, device),
      })),
    );
  };

  const updatePropsValues = (values: Record<string, unknown>) => {
    if (!selectedId) return;
    commitRoot(
      updateTree(layout.root, selectedId, (node) => ({
        ...node,
        props: {
          ...node.props,
          ...values,
        },
      })),
    );
  };

  const clearProps = (...keys: string[]) => {
    if (!selectedId) return;
    const remove = new Set(keys);
    commitRoot(
      updateTree(layout.root, selectedId, (node) => ({
        ...node,
        props: Object.fromEntries(
          Object.entries(node.props).filter(([key]) => !remove.has(key)),
        ),
      })),
    );
  };

  const updateLabel = (value: string) => {
    if (!selectedId) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => ({
        ...node,
        label: value,
      })),
    );
  };

  const updateResponsiveStyle = (key: keyof BuilderStyle, value: unknown) => {
    updateResponsiveStyles([[key, value]]);
  };

  const updateResponsiveStyles = (
    updates: Array<[keyof BuilderStyle, unknown]>,
  ) => {
    if (!selectedId) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => {
        const nextStyles = { ...node.styles };

        for (const [key, value] of updates) {
          const currentValue = node.styles[key];
          const isResponsiveObject =
            Boolean(currentValue) &&
            typeof currentValue === "object" &&
            !Array.isArray(currentValue) &&
            ("desktop" in (currentValue as Record<string, unknown>) ||
              "tablet" in (currentValue as Record<string, unknown>) ||
              "mobile" in (currentValue as Record<string, unknown>));
          const current = isResponsiveObject
            ? (currentValue as Record<string, unknown>)
            : currentValue !== undefined && currentValue !== null
              ? { desktop: currentValue }
              : {};

          (nextStyles as Record<string, unknown>)[key] = {
            ...current,
            [device]: value,
          };
        }

        return {
          ...node,
          styles: nextStyles,
        };
      }),
    );
  };

  const updateResponsiveAdvancedWidthMode = (
    value: "default" | "inline" | "full" | "custom",
  ) => {
    if (!selectedId) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => {
        const current = node.advanced?.widthMode;
        const responsiveMode =
          typeof current === "string" ? { desktop: current } : current || {};

        return {
          ...node,
          advanced: {
            ...(node.advanced || {}),
            widthMode: {
              ...responsiveMode,
              [device]: value,
            },
          },
        };
      }),
    );
  };

  const updateSimpleStyle = (key: keyof BuilderStyle, value: unknown) => {
    if (!selectedId) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => ({
        ...node,
        styles: setBuilderStyleForDevice(
          node.styles,
          key,
          value as BuilderStyle[typeof key],
          device,
        ),
      })),
    );
  };

  const updateSpacing = (
    key: "padding" | "margin" | "stylePadding" | "styleMargin",
    value: BuilderSpacing,
  ) => {
    if (!selectedId) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => ({
        ...node,
        styles: {
          ...node.styles,
          [key]: {
            ...((node.styles[key] &&
            typeof node.styles[key] === "object" &&
            ("desktop" in (node.styles[key] as Record<string, unknown>) ||
              "tablet" in (node.styles[key] as Record<string, unknown>) ||
              "mobile" in (node.styles[key] as Record<string, unknown>))
              ? node.styles[key]
              : node.styles[key] !== undefined
                ? { desktop: node.styles[key] }
                : {}) as Record<string, unknown>),
            [device]: value,
          },
        },
      })),
    );
  };

  const updateTypography = (
    key: keyof BuilderTypography,
    value: unknown,
    _responsive = false,
  ) => {
    if (!selectedId) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => {
        const typography = resolveBuilderStyles(node.styles, device).typography || {};
        const nextTypography = { ...typography, [key]: value } as BuilderTypography;
        return {
          ...node,
          styles: setBuilderStyleForDevice(
            node.styles,
            "typography",
            nextTypography,
            device,
          ),
        };
      }),
    );
  };

  const updateBackground = (
    key: keyof BuilderBackground,
    value: unknown,
    hover = false,
  ) => {
    if (!selectedId) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => {
        const styleKey = hover ? "backgroundHover" : "background";
        const current = resolveBuilderStyles(node.styles, device)[styleKey] || {};
        const nextBackground = { ...current, [key]: value };
        return {
          ...node,
          styles: setBuilderStyleForDevice(
            node.styles,
            styleKey,
            nextBackground,
            device,
          ),
        };
      }),
    );
  };

  const clearBackgroundMedia = (hover: boolean, ...keys: string[]) => {
    if (!selectedId) return;
    const remove = new Set(keys);
    commitRoot(
      updateTree(layout.root, selectedId, (node) => {
        const key = hover ? "backgroundHover" : "background";
        const current = resolveBuilderStyles(node.styles, device)[key] || {};
        // Empty values deliberately override the Desktop asset only on the
        // currently selected device; omitting a key would inherit the image.
        const next = { ...current } as BuilderBackground;
        for (const property of remove) {
          (next as Record<string, unknown>)[property] = "";
        }
        return {
          ...node,
          styles: setBuilderStyleForDevice(
            node.styles,
            key,
            next,
            device,
          ),
        };
      }),
    );
  };

  const updateBorder = (
    key: keyof BuilderBorder,
    value: unknown,
    hover = false,
  ) => {
    if (!selectedId) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => {
        const styleKey = hover ? "borderHover" : "border";
        const current = resolveBuilderStyles(node.styles, device)[styleKey] || {};
        const nextBorder = { ...current, [key]: value };
        return {
          ...node,
          styles: setBuilderStyleForDevice(
            node.styles,
            styleKey,
            nextBorder,
            device,
          ),
        };
      }),
    );
  };

  const updateAdvanced = (key: string, value: unknown) => {
    if (!selectedId) return;

    commitRoot(
      updateTree(layout.root, selectedId, (node) => ({
        ...node,
        advanced: {
          ...(node.advanced || {}),
          [key]: value,
        },
      })),
    );
  };

  const openMediaLibrary = async (
    mediaType: MediaTarget = "widget",
    itemIndex: number | null = null,
    buttonIndex: number | null = null,
  ) => {
    setMediaTarget(mediaType);
    setMediaItemIndex(itemIndex);
    setMediaButtonIndex(buttonIndex);
    setMediaPickerOpen(true);
    setMediaLoading(true);
    setMediaSearch("");
    setError("");

    try {
      const response = await fetch("/api/admin/media?view=library", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Media Library load nahi hui.");
      }

      const items = Array.isArray(result.media)
        ? result.media
        : Array.isArray(result.items)
          ? result.items
          : [];

      setMediaItems(
        items.filter((item: MediaItem) => item.mimeType?.startsWith("image/")),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Media Library load nahi hui.",
      );
    } finally {
      setMediaLoading(false);
    }
  };

  const openImageUpload = (
    mediaType: MediaTarget = "widget",
    itemIndex: number | null = null,
    buttonIndex: number | null = null,
  ) => {
    setMediaTarget(mediaType);
    setMediaItemIndex(itemIndex);
    setMediaButtonIndex(buttonIndex);
    setImageUploadOpen(true);
  };

  const chooseMedia = (item: MediaItem | MediaPickerItem) => {
    if (!selectedId) return;

    const mediaUrl = safeMediaUrl(item.filePath || item.url || "");

    if (!mediaUrl) {
      setError("Selected media URL available nahi hai.");
      return;
    }

    commitRoot(
      updateTree(layout.root, selectedId, (node) => {
        if (mediaTarget === "background") {
          return {
            ...node,
            styles: {
              ...node.styles,
              background: {
                ...(node.styles.background || {}),
                type: "image",
                image: mediaUrl,
                imageId: item.id,
              },
            },
          };
        }

        if (mediaTarget === "hoverBackground") {
          return {
            ...node,
            styles: {
              ...node.styles,
              backgroundHover: {
                ...(node.styles.backgroundHover || {}),
                type: "image",
                image: mediaUrl,
                imageId: item.id,
              },
            },
          };
        }

        if (
          mediaTarget === "backgroundOverlay" ||
          mediaTarget === "hoverBackgroundOverlay"
        ) {
          const hover = mediaTarget === "hoverBackgroundOverlay";
          return {
            ...node,
            styles: {
              ...node.styles,
              ...(hover
                ? {
                    backgroundHover: {
                      ...(node.styles.backgroundHover || {}),
                      overlayImage: mediaUrl,
                      overlayImageId: item.id,
                    },
                  }
                : {
                    background: {
                      ...(node.styles.background || {}),
                      overlayImage: mediaUrl,
                      overlayImageId: item.id,
                    },
                  }),
            },
          };
        }

        if (mediaTarget === "widgetIcon") {
          return {
            ...node,
            props: {
              ...node.props,
              iconImage: mediaUrl,
              iconImageId: item.id,
            },
          };
        }

        if (mediaTarget === "repeaterIcon" && mediaItemIndex !== null) {
          const key = node.type === "social-icons" ? "icons" : "items";
          const entries = Array.isArray(node.props[key]) ? [...(node.props[key] as unknown[])] : [];
          const current = entries[mediaItemIndex];
          const entry = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
          entries[mediaItemIndex] = { ...entry, iconImage: mediaUrl, iconMediaId: item.id, iconName: "" };
          return { ...node, props: { ...node.props, [key]: entries } };
        }

        if (mediaTarget === "videoPoster") {
          return {
            ...node,
            props: {
              ...node.props,
              poster: mediaUrl,
              posterMediaId: item.id,
            },
          };
        }

        if (mediaTarget === "slideBackground" && mediaItemIndex !== null) {
          const slides = Array.isArray(node.props.slides)
            ? [...node.props.slides]
            : [];
          const slide = slides[mediaItemIndex];
          const entry =
            slide && typeof slide === "object"
              ? (slide as Record<string, unknown>)
              : {};
          slides[mediaItemIndex] = {
            ...entry,
            backgroundImage: mediaUrl,
            backgroundMediaId: item.id,
          };
          return { ...node, props: { ...node.props, slides } };
        }

        if (
          mediaTarget === "slideButtonIcon" &&
          mediaItemIndex !== null &&
          mediaButtonIndex !== null
        ) {
          const slides = Array.isArray(node.props.slides)
            ? [...node.props.slides]
            : [];
          const slide = slides[mediaItemIndex];
          const entry =
            slide && typeof slide === "object"
              ? (slide as Record<string, unknown>)
              : {};
          const buttons = Array.isArray(entry.buttons) ? [...entry.buttons] : [];
          const button = buttons[mediaButtonIndex];
          const buttonEntry =
            button && typeof button === "object"
              ? (button as Record<string, unknown>)
              : {};
          buttons[mediaButtonIndex] = {
            ...buttonEntry,
            iconImage: mediaUrl,
            iconMediaId: item.id,
          };
          slides[mediaItemIndex] = { ...entry, buttons };
          return { ...node, props: { ...node.props, slides } };
        }

        if (mediaTarget === "carouselItem" && mediaItemIndex !== null) {
          const key = node.type === "image-carousel" ? "images" : "items";
          const items = Array.isArray(node.props[key]) ? [...(node.props[key] as unknown[])] : [];
          const current = items[mediaItemIndex];
          const entry =
            current && typeof current === "object"
              ? (current as Record<string, unknown>)
              : typeof current === "string"
                ? { alt: "" }
                : {};
          items[mediaItemIndex] = { ...entry, url: mediaUrl, mediaId: item.id };
          return { ...node, props: { ...node.props, [key]: items } };
        }

        return {
          ...node,
          props: {
            ...node.props,
            src: mediaUrl,
            image: mediaUrl,
            alt: item.altText || node.props.alt || "",
            title: item.title || node.props.title || "",
            mediaId: item.id,
          },
        };
      }),
    );

    setMediaPickerOpen(false);
    setImageUploadOpen(false);
    setMediaItemIndex(null);
    setMediaButtonIndex(null);
  };

  const saveDocument = async (nextStatus: "DRAFT" | "PUBLISHED") => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/builder/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentKey,
          kind: target.kind,
          title,
          slug: target.slug ?? null,
          targetId: target.id ?? null,
          postTypeSlug: target.postTypeSlug ?? null,
          status: nextStatus,
          layout,
          settings,
          globalStyles,
          conditions,
          revisionMessage:
            nextStatus === "PUBLISHED"
              ? `Published from Builder - ${new Date().toLocaleString()}`
              : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save builder.");
      }

      setStatus(nextStatus);
      setMessage(result.message || "Saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save builder.");
    } finally {
      setSaving(false);
    }
  };

  const loadRevisions = async () => {
    setRevisionOpen(true);
    setRevisionLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/builder/documents?documentKey=${encodeURIComponent(
          documentKey,
        )}&action=revisions`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load revision history.");
      }

      setRevisions(Array.isArray(result.revisions) ? result.revisions : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load revisions.",
      );
    } finally {
      setRevisionLoading(false);
    }
  };

  const restoreRevision = async (revisionId: string) => {
    const confirmed = window.confirm(
      "Restore this revision? Your current document will be replaced.",
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/builder/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "restore",
          documentKey,
          revisionId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to restore revision.");
      }

      setRevisionOpen(false);
      await loadDocument();

      setMessage(result.message || "Revision restored successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to restore revision.",
      );
    } finally {
      setSaving(false);
    }
  };

  const exportDocument = () => {
    const data = {
      format: "connect-broadband-builder",
      version: 1,
      exportedAt: new Date().toISOString(),
      kind: target.kind,
      title,
      layout,
      settings,
      globalStyles,
      conditions,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "builder-template"
    }.json`;

    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setImporting(true);
    setError("");
    setMessage("");

    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;

      const importedLayout = parsed.layout as BuilderLayout;

      if (
        !importedLayout ||
        importedLayout.version !== 1 ||
        !Array.isArray(importedLayout.root)
      ) {
        throw new Error("Invalid builder JSON file.");
      }

      const importedIds = getAllNodeIds(importedLayout.root);

      if (
        importedIds.length > 500 ||
        new Set(importedIds).size !== importedIds.length
      ) {
        throw new Error(
          "Imported template contains invalid or duplicate elements.",
        );
      }

      const nextRoot = structuredClone(importedLayout.root);

      setLayout({
        version: 1,
        root: nextRoot,
      });

      setHistory([
        {
          root: structuredClone(nextRoot),
        },
      ]);

      setHistoryIndex(0);

      if (typeof parsed.title === "string") {
        setTitle(parsed.title);
      }

      if (parsed.settings && typeof parsed.settings === "object") {
        setSettings(parsed.settings as Record<string, unknown>);
      }

      if (parsed.globalStyles && typeof parsed.globalStyles === "object") {
        setGlobalStyles(parsed.globalStyles as BuilderGlobalStyles);
      }

      if (parsed.conditions && typeof parsed.conditions === "object") {
        setConditions(parsed.conditions as Record<string, unknown>);
      }

      setSelectedId(null);

      setMessage("Template imported. Save Draft to store it in the database.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to import template.",
      );
    } finally {
      setImporting(false);
    }
  };

  const widgetGroups = useMemo(
    () =>
      BUILDER_WIDGET_CATEGORIES.map((category) => ({
        category,
        widgets: BUILDER_WIDGETS.filter(
          (widget) =>
            widget.category === category &&
            `${widget.label} ${widget.description}`
              .toLowerCase()
              .includes(widgetSearch.toLowerCase()),
        ),
      })).filter((group) => group.widgets.length > 0),
    [widgetSearch],
  );

  const filteredMedia = mediaItems.filter((item) =>
    `${item.fileName || ""} ${item.originalName || ""}`
      .toLowerCase()
      .includes(mediaSearch.toLowerCase()),
  );

  const isImageNode =
    selectedNode &&
    ["image", "site-logo", "featured-image", "image-box", "icon"].includes(
      selectedNode.type,
    );

  const setGlobalColor = (id: string, value: string) => {
    setGlobalStyles((current) => ({
      ...current,
      colors: current.colors.map((color) =>
        color.id === id ? { ...color, value } : color,
      ),
    }));
  };

  const setGlobalFont = (id: string, family: string) => {
    setGlobalStyles((current) => ({
      ...current,
      fonts: current.fonts.map((font) =>
        font.id === id ? { ...font, family } : font,
      ),
    }));
  };

  const updateSetting = (key: string, value: unknown) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const inspectorTabs = isLayoutNode
    ? (["layout", "content", "style", "advanced"] as const)
    : (["content", "style", "advanced"] as const);

  const selectedPadding = getResponsiveValue(selectedNode?.styles.padding, device);
  const selectedMargin = getResponsiveValue(selectedNode?.styles.margin, device);

  const loadLinkSuggestions = () => {
    if (linkSuggestionsLoaded) return Promise.resolve();
    if (linkSuggestionsRequest.current) return linkSuggestionsRequest.current;

    const request = (async () => {
      const endpoints = [
        "/api/admin/pages",
        "/api/admin/posts",
        "/api/admin/posts/taxonomies/categories",
        "/api/admin/posts/taxonomies/tags",
      ];
      const responses = await Promise.all(
        endpoints.map((endpoint) =>
          fetch(endpoint, { cache: "no-store" }),
        ),
      );
      const failedResponse = responses.find((response) => !response.ok);
      if (failedResponse) {
        throw new Error(`Could not load link suggestions (${failedResponse.status}).`);
      }

      const [pageData, postData, categoryData, tagData] = await Promise.all(
        responses.map((response) => response.json()),
      );
      const suggestions: LinkSuggestion[] = [{ label: "Homepage", value: "/" }];
      const addItems = (
        items: unknown,
        label: string,
        getValue: (item: Record<string, unknown>) => string,
      ) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const record = item as Record<string, unknown>;
          const value = getValue(record);
          if (!value) continue;
          suggestions.push({
            label: `${label}: ${String(record.title || record.name || record.slug || value)}`,
            value,
          });
        }
      };

      addItems(pageData?.pages, "Page", (page) =>
        typeof page.permalink === "string"
          ? page.permalink
          : typeof page.slug === "string"
            ? `/${page.slug}/`
            : "",
      );
      addItems(
        Array.isArray(postData?.posts)
          ? postData.posts.filter(
              (post: Record<string, unknown>) => post.status === "PUBLISHED",
            )
          : [],
        "Post",
        (post) => (typeof post.permalink === "string" ? post.permalink : ""),
      );
      addItems(categoryData?.categories, "Category", (category) =>
        typeof category.slug === "string"
          ? `/blog/category/${category.slug}`
          : "",
      );
      addItems(tagData?.tags, "Tag", (tag) =>
        typeof tag.slug === "string" ? `/blog/tag/${tag.slug}` : "",
      );

      const uniqueSuggestions = Array.from(
        new Map(
          suggestions.map((suggestion) => [suggestion.value, suggestion]),
        ).values(),
      );
      setLinkSuggestions(uniqueSuggestions);
      setLinkSuggestionsLoaded(true);
    })()
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load link suggestions.",
        );
      })
      .finally(() => {
        linkSuggestionsRequest.current = null;
      });

    linkSuggestionsRequest.current = request;
    return request;
  };

  const renderContentPanel = () => {
    if (!selectedNode) return null;

    const node = selectedNode;
    const slideEntries = Array.isArray(node.props.slides)
      ? node.props.slides.map((slide) =>
          slide && typeof slide === "object"
            ? (slide as Record<string, unknown>)
            : typeof slide === "string"
              ? { backgroundImage: slide }
              : {},
        )
      : [];
    const updateSlideFields = (
      index: number,
      fields: Record<string, unknown>,
    ) => {
      const slides = [...slideEntries];
      slides[index] = { ...slides[index], ...fields };
      updateProps("slides", slides);
    };
    const updateSlide = (index: number, key: string, value: unknown) =>
      updateSlideFields(index, { [key]: value });
    const updateSlideButton = (
      slideIndex: number,
      buttonIndex: number,
      key: string,
      value: unknown,
    ) => {
      const slide = slideEntries[slideIndex] || {};
      const buttons = Array.isArray(slide.buttons)
        ? [...slide.buttons]
        : [];
      const currentButton = buttons[buttonIndex];
      const button =
        currentButton && typeof currentButton === "object"
          ? (currentButton as Record<string, unknown>)
          : {};
      buttons[buttonIndex] = { ...button, [key]: value };
      updateSlide(slideIndex, "buttons", buttons);
    };
    const removeSlide = (index: number) => {
      updateProps(
        "slides",
        slideEntries.filter((_, slideIndex) => slideIndex !== index),
      );
    };
    const moveSlide = (index: number, offset: number) => {
      const target = index + offset;
      if (target < 0 || target >= slideEntries.length) return;
      const slides = [...slideEntries];
      [slides[index], slides[target]] = [slides[target], slides[index]];
      updateProps("slides", slides);
    };
    const slideButtonList = (slide: Record<string, unknown>) => {
      const buttons = Array.isArray(slide.buttons)
        ? slide.buttons
            .filter((button) => button && typeof button === "object")
            .map((button) => button as Record<string, unknown>)
            .slice(0, 3)
        : [];
      const defaults = [
        { text: "Learn More", url: "", width: "fit-content" },
        { text: "Get Started", url: "", width: "fit-content" },
      ];
      while (buttons.length < 2) buttons.push(defaults[buttons.length]);
      return buttons;
    };
    const repeaterKey = node.type === "tabs" ? "tabs" : node.type === "social-icons" ? "icons" : node.type === "icon-list" ? "items" : "items";
    const repeaterItems = Array.isArray(node.props[repeaterKey])
      ? (node.props[repeaterKey] as unknown[]).map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {})
      : [];
    const updateRepeaterItem = (index: number, patch: Record<string, unknown>) => {
      const next = [...repeaterItems];
      next[index] = { ...(next[index] || {}), ...patch };
      updateProps(repeaterKey, next);
    };
    const addRepeaterItem = () => {
      const base = node.type === "social-icons"
        ? { id: `social-${Date.now()}`, name: "Social", label: "Social", iconName: "Globe", url: "" }
        : node.type === "icon-list"
          ? { id: `icon-item-${Date.now()}`, text: "New list item", iconName: "Check", url: "" }
          : node.type === "price-list"
            ? { id: `price-${Date.now()}`, title: "Item", price: "", description: "" }
            : { id: `item-${Date.now()}`, title: `Item ${repeaterItems.length + 1}`, content: "" };
      updateProps(repeaterKey, [...repeaterItems, base]);
    };
    const removeRepeaterItem = (index: number) => updateProps(repeaterKey, repeaterItems.filter((_, i) => i !== index));

    return (
      <>
        <ControlGroup title="General" defaultOpen>
          <TextControl
            label="Element Name"
            value={node.label}
            onChange={updateLabel}
          />

          {LAYOUT_TYPES.has(node.type) && (
            <SelectControl
              label="HTML Tag"
              value={String(node.advanced?.htmlTag || (node.type === "section" ? "section" : "div"))}
              options={["section", "div", "header", "footer", "nav", "main", "article", "aside"].map((value) => ({
                label: value,
                value,
              }))}
              onChange={(value) => updateAdvanced("htmlTag", value)}
            />
          )}

          {node.type === "heading" && (
            <>
              <TextControl
                label="Heading Text"
                value={String(node.props.text || "")}
                onChange={(value) => updateProps("text", value)}
              />

              <SelectControl
                label="Link Type"
                value={String(node.props.linkType || "normal")}
                options={[
                  { label: "Normal Link", value: "normal" },
                  { label: "Dynamic Link", value: "dynamic" },
                ]}
                onChange={(value) => updateProps("linkType", value)}
              />
              {node.props.linkType === "dynamic" ? (
                <SelectControl
                  label="Dynamic Link"
                  value={String(node.props.dynamicLink || "current-page")}
                  options={[
                    { label: "Current Page", value: "current-page" },
                    { label: "Homepage", value: "homepage" },
                  ]}
                  onChange={(value) => updateProps("dynamicLink", value)}
                />
              ) : (
                <TextControl
                  label="Link"
                  value={String(node.props.link || "")}
                  onChange={(value) => updateProps("link", value)}
                  placeholder="https://example.com or /page"
                  list="builder-link-targets"
                  onFocus={() => void loadLinkSuggestions()}
                />
              )}
              {node.props.linkType !== "dynamic" && (
                <SelectControl
                  label="Link Target"
                  value={String(node.props.linkTarget || "_self")}
                  options={[
                    { label: "Same Window", value: "_self" },
                    { label: "New Window", value: "_blank" },
                  ]}
                  onChange={(value) => updateProps("linkTarget", value)}
                />
              )}

              <SelectControl
                label="HTML Tag"
                value={String(node.props.level || "h2")}
                options={["h1", "h2", "h3", "h4", "h5", "h6"].map((value) => ({
                  label: value.toUpperCase(),
                  value,
                }))}
                onChange={(value) => updateProps("level", value)}
              />
            </>
          )}

          {node.type === "text" && (
            <Field label="Text Content">
              <textarea
                rows={7}
                value={String(node.props.content || "")}
                onChange={(event) => updateProps("content", event.target.value)}
                style={CONTROL_STYLE}
              />
            </Field>
          )}

          {node.type === "html" && (
            <>
              <Field label="HTML Content">
                <textarea
                  rows={14}
                  value={String(node.props.html || "")}
                  onChange={(event) => updateProps("html", event.target.value)}
                  placeholder={'<div class="custom-block">Your HTML here</div>'}
                  spellCheck={false}
                  style={{ ...CONTROL_STYLE, minHeight: 260, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
                />
              </Field>
              <p style={{ margin: "-4px 0 10px", color: "#64748b", fontSize: 12 }}>HTML markup is sanitized on the public website. Script tags and inline event handlers are removed for security.</p>
            </>
          )}

          {node.type === "shortcode" && (
            <>
              <Field label="Shortcode">
                <textarea
                  rows={3}
                  value={String(node.props.shortcode || "")}
                  onChange={(event) => updateProps("shortcode", event.target.value)}
                  placeholder={'[connect_form id="FORM_ID"]'}
                  style={{ ...CONTROL_STYLE, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                />
              </Field>
              <p style={{ margin: "-4px 0 10px", color: "#64748b", fontSize: 12 }}>Supported registered shortcode: [connect_form id="FORM_ID"]. Use the form ID or public form slug.</p>
            </>
          )}

          {node.type === "button" && (
            <>
              <TextControl
                label="Button Text"
                value={String(node.props.text || "")}
                onChange={(value) => updateProps("text", value)}
              />

              <TextControl
                label="Link URL"
                value={String(node.props.url || "")}
                onChange={(value) => updateProps("url", value)}
                list="builder-link-targets"
                onFocus={() => void loadLinkSuggestions()}
              />

              <SelectControl
                label="Link Target"
                value={String(node.props.target || "_self")}
                options={[
                  { label: "Same Window", value: "_self" },
                  { label: "New Window", value: "_blank" },
                ]}
                onChange={(value) => updateProps("target", value)}
              />

              <Field label="Icon">
                <button
                  type="button"
                  style={{ ...BUTTON_STYLE, width: "100%" }}
                  onClick={() =>
                    setIconPickerTarget({
                      kind: "button",
                      value: String(node.props.iconName || ""),
                    })
                  }
                >
                  {(() => {
                    const SelectedIcon = themeIcons[String(node.props.iconName || "")];
                    return SelectedIcon ? <SelectedIcon size={16} /> : <Search size={16} />;
                  })()}
                  {String(node.props.iconName || "Choose Icon")}
                </button>
              </Field>

              <TextControl
                label="Icon Text"
                value={String(node.props.icon || "")}
                onChange={(value) => updateProps("icon", value)}
                placeholder="Optional symbol or text"
              />

              <div style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  style={{ ...BUTTON_STYLE, width: "100%" }}
                  onClick={() => void openMediaLibrary("widgetIcon")}
                >
                  <ImageIcon size={15} />
                  Choose Icon Image
                </button>
                <button
                  type="button"
                  style={{ ...BUTTON_STYLE, width: "100%", marginTop: 6 }}
                  onClick={() => openImageUpload("widgetIcon")}
                >
                  <Upload size={15} />
                  Upload Icon Image
                </button>
                {typeof node.props.iconImage === "string" && node.props.iconImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={safeMediaUrl(node.props.iconImage)}
                    alt=""
                    style={{ display: "block", maxWidth: 48, maxHeight: 48, marginTop: 8 }}
                  />
                ) : null}
                {node.props.iconImage ? (
                  <button
                    type="button"
                    style={{ ...BUTTON_STYLE, width: "100%", marginTop: 6 }}
                    onClick={() => clearProps("iconImage", "iconImageId")}
                  >
                    <X size={15} /> Remove Icon Image
                  </button>
                ) : null}
              </div>

              <SelectControl
                label="Icon Position"
                value={String(node.props.iconPosition || "before")}
                options={[
                  { label: "Before Text", value: "before" },
                  { label: "After Text", value: "after" },
                ]}
                onChange={(value) => updateProps("iconPosition", value)}
              />

              <TextControl
                label="Tooltip"
                value={String(node.props.tooltip || "")}
                onChange={(value) => updateProps("tooltip", value)}
              />
            </>
          )}

          {isImageNode && node.type !== "site-logo" && (
            <>
              {typeof (node.props.src || node.props.image) === "string" &&
              (node.props.src || node.props.image) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={safeMediaUrl(String(node.props.src || node.props.image))}
                  alt={String(node.props.alt || "")}
                  style={{
                    display: "block",
                    width: "100%",
                    maxHeight: 150,
                    objectFit: "contain",
                    marginBottom: 12,
                    border: "1px solid #e2e8f0",
                  }}
                />
              ) : null}
              <button
                type="button"
                style={{
                  ...BUTTON_STYLE,
                  width: "100%",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
                onClick={() => void openMediaLibrary("widget")}
              >
                <ImageIcon size={15} />
                Choose Image from Media Library
              </button>
              <button
                type="button"
                style={{
                  ...BUTTON_STYLE,
                  width: "100%",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
                onClick={() => openImageUpload()}
              >
                <Upload size={15} />
                Upload from Computer
              </button>
              {(node.props.src || node.props.image) ? (
                <button
                  type="button"
                  style={{
                    ...BUTTON_STYLE,
                    width: "100%",
                    justifyContent: "center",
                    marginBottom: 12,
                    color: "#b42318",
                  }}
                  onClick={() => clearProps("src", "image", "mediaId")}
                >
                  <X size={15} /> Remove Image Reference
                </button>
              ) : null}

              <TextControl
                label="Image URL"
                value={String(node.props.src || node.props.image || "")}
                onChange={(value) => updatePropsValues({ src: value, image: value })}
              />

              <TextControl
                label="Alternative Text"
                value={String(node.props.alt || "")}
                onChange={(value) => updateProps("alt", value)}
              />

              <TextControl
                label="Image Title"
                value={String(node.props.title || "")}
                onChange={(value) => updateProps("title", value)}
              />

              <TextControl
                label="Caption"
                value={String(node.props.caption || "")}
                onChange={(value) => updateProps("caption", value)}
              />

              <SelectControl
                label="Image Resolution"
                value={String(node.props.resolution || "full")}
                options={["thumbnail", "medium", "large", "full"].map((value) => ({
                  label: value[0].toUpperCase() + value.slice(1),
                  value,
                }))}
                onChange={(value) => updateProps("resolution", value)}
              />

              <TextControl
                label="Image Link"
                value={String(node.props.link || "")}
                onChange={(value) => updateProps("link", value)}
                list="builder-link-targets"
                onFocus={() => void loadLinkSuggestions()}
              />

              <SelectControl
                label="Link Target"
                value={String(node.props.linkTarget || "_self")}
                options={[
                  { label: "Same Window", value: "_self" },
                  { label: "New Window", value: "_blank" },
                ]}
                onChange={(value) => updateProps("linkTarget", value)}
              />

              <SelectControl
                label="Object Fit"
                value={String(node.props.objectFit || "cover")}
                options={["cover", "contain", "fill", "none"].map((value) => ({
                  label: value,
                  value,
                }))}
                onChange={(value) => updateProps("objectFit", value)}
              />
            </>
          )}

          {["video", "audio", "lottie"].includes(node.type) && (
            <>
              <TextControl
                label="Media URL"
                value={String(node.props.url || "")}
                onChange={(value) => updateProps("url", value)}
              />
              {node.props.url ? (
                <button
                  type="button"
                  style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 10, color: "#b42318" }}
                  onClick={() => clearProps("url", "mediaId")}
                >
                  <X size={15} /> Remove Media Reference
                </button>
              ) : null}

              {node.type === "video" && (
                <>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <button
                      type="button"
                      style={{ ...BUTTON_STYLE, flex: 1 }}
                      onClick={() => void openMediaLibrary("videoPoster")}
                    >
                      Choose Poster
                    </button>
                    <button
                      type="button"
                      style={{ ...BUTTON_STYLE, flex: 1 }}
                      onClick={() => openImageUpload("videoPoster")}
                    >
                      Upload Poster
                    </button>
                  </div>
                  <TextControl
                    label="Poster Image URL"
                    value={String(node.props.poster || "")}
                    onChange={(value) => updateProps("poster", value)}
                  />
                  {node.props.poster ? (
                    <button
                      type="button"
                      style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 10, color: "#b42318" }}
                      onClick={() => clearProps("poster", "posterMediaId")}
                    >
                      <X size={15} /> Remove Poster Reference
                    </button>
                  ) : null}

                  {(["controls", "autoplay", "muted", "loop"] as const).map(
                    (key) => (
                      <Field key={key} label={key}>
                        <input
                          type="checkbox"
                          checked={Boolean(node.props[key])}
                          onChange={(event) =>
                            updateProps(key, event.target.checked)
                          }
                        />
                      </Field>
                    ),
                  )}
                </>
              )}
              {node.type === "audio" && (
                <>
                  <TextControl label="Audio Title" value={String(node.props.title || "")} onChange={(value) => updateProps("title", value)} />
                  {(["controls", "autoplay", "loop"] as const).map((key) => (
                    <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
                      <input type="checkbox" checked={key === "controls" ? node.props.controls !== false : Boolean(node.props[key])} onChange={(event) => updateProps(key, event.target.checked)} />
                    </Field>
                  ))}
                </>
              )}
              {node.type === "lottie" && (
                <>
                  <Field label="Loop Animation"><input type="checkbox" checked={node.props.loop !== false} onChange={(event) => updateProps("loop", event.target.checked)} /></Field>
                  <Field label="Autoplay"><input type="checkbox" checked={node.props.autoplay !== false} onChange={(event) => updateProps("autoplay", event.target.checked)} /></Field>
                  <SelectControl label="Renderer" value={String(node.props.renderer || "svg")} options={["svg", "canvas", "html"].map((value) => ({ label: value.toUpperCase(), value }))} onChange={(value) => updateProps("renderer", value)} />
                  <p style={{ color: "#64748b", fontSize: 12 }}>The URL must point to a Lottie JSON animation file. Public playback requires the Lottie player package to be configured in the site.</p>
                </>
              )}
            </>
          )}

          {node.type === "site-title" && (
            <>
              <TextControl
                label="Site Title"
                value={String(node.props.text || "")}
                onChange={(value) => updateProps("text", value)}
              />
              <TextControl
                label="Site Title Link"
                value={String(node.props.link || "/")}
                onChange={(value) => updateProps("link", value)}
                list="builder-link-targets"
                onFocus={() => void loadLinkSuggestions()}
              />
            </>
          )}

          {node.type === "breadcrumbs" && (
            <>
              <TextControl
                label="Separator"
                value={String(node.props.separator || "/")}
                onChange={(value) => updateProps("separator", value)}
              />
              <Field label="Show Home Link">
                <input
                  type="checkbox"
                  checked={node.props.showHome !== false}
                  onChange={(event) => updateProps("showHome", event.target.checked)}
                />
              </Field>
            </>
          )}

          {node.type === "search-form" && (
            <>
              <TextControl
                label="Placeholder"
                value={String(node.props.placeholder || "Search...")}
                onChange={(value) => updateProps("placeholder", value)}
              />
              <TextControl
                label="Search Button Text"
                value={String(node.props.buttonText || "Search")}
                onChange={(value) => updateProps("buttonText", value)}
              />
              <Field label="Show Search Button">
                <input
                  type="checkbox"
                  checked={node.props.showButton !== false}
                  onChange={(event) => updateProps("showButton", event.target.checked)}
                />
              </Field>
            </>
          )}

          {node.type === "icon-box" && (
            <>
              <Field label="Icon Library">
                <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={() => setIconPickerTarget({ kind: "widget", value: String(node.props.iconName || "") })}>
                  {(() => { const SelectedIcon = themeIcons[String(node.props.iconName || "")]; return SelectedIcon ? <SelectedIcon size={16} /> : <Search size={16} />; })()}
                  {String(node.props.iconName || "Choose Icon")}
                </button>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                <button type="button" style={BUTTON_STYLE} onClick={() => void openMediaLibrary("widgetIcon")}><ImageIcon size={14} /> Media Library</button>
                <button type="button" style={BUTTON_STYLE} onClick={() => openImageUpload("widgetIcon")}><Upload size={14} /> Upload</button>
              </div>
              {node.props.iconImage ? <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><img src={safeMediaUrl(String(node.props.iconImage))} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} /><button type="button" style={BUTTON_STYLE} onClick={() => clearProps("iconImage", "iconImageId")}>Remove image</button></div> : null}
              <TextControl label="Icon Size" type="number" value={String(node.props.iconSize || 40)} onChange={(value) => updateProps("iconSize", Number(value))} />
              <TextControl label="Icon Color" value={String(node.props.iconColor || "#3984e8")} onChange={(value) => updateProps("iconColor", value)} />
              <TextControl
                label="Icon Symbol"
                value={String(node.props.symbol || "★")}
                onChange={(value) => updateProps("symbol", value)}
              />
              <TextControl
                label="Title"
                value={String(node.props.title || "")}
                onChange={(value) => updateProps("title", value)}
              />
              <TextControl
                label="Description"
                value={String(node.props.description || "")}
                onChange={(value) => updateProps("description", value)}
              />
              <SelectControl
                label="Icon Position"
                value={String(node.props.iconPosition || "top")}
                options={["top", "left", "right"].map((value) => ({
                  label: value,
                  value,
                }))}
                onChange={(value) => updateProps("iconPosition", value)}
              />
            </>
          )}

          {node.type === "image-box" && (
            <>
              <TextControl
                label="Title"
                value={String(node.props.title || "")}
                onChange={(value) => updateProps("title", value)}
              />
              <TextControl
                label="Description"
                value={String(node.props.description || "")}
                onChange={(value) => updateProps("description", value)}
              />
              <SelectControl
                label="Image Position"
                value={String(node.props.imagePosition || "top")}
                options={["top", "left", "right"].map((value) => ({
                  label: value,
                  value,
                }))}
                onChange={(value) => updateProps("imagePosition", value)}
              />
            </>
          )}

          {node.type === "counter" && (
            <>
              <TextControl label="Prefix" value={String(node.props.prefix || "")} onChange={(value) => updateProps("prefix", value)} />
              <TextControl label="End Value" type="number" value={String(node.props.end ?? 100)} onChange={(value) => updateProps("end", Number(value))} />
              <TextControl label="Suffix" value={String(node.props.suffix || "")} onChange={(value) => updateProps("suffix", value)} />
              <TextControl label="Title" value={String(node.props.title || "")} onChange={(value) => updateProps("title", value)} />
            </>
          )}

          {node.type === "progress" && (
            <>
              <TextControl label="Title" value={String(node.props.title || "")} onChange={(value) => updateProps("title", value)} />
              <TextControl label="Percentage" type="number" value={String(node.props.percentage ?? 0)} onChange={(value) => updateProps("percentage", Number(value))} />
            </>
          )}

          {node.type === "rating" && (
            <>
              <TextControl label="Rating" type="number" value={String(node.props.rating ?? 5)} onChange={(value) => updateProps("rating", Number(value))} />
              <TextControl label="Maximum Rating" type="number" value={String(node.props.maxRating ?? 5)} onChange={(value) => updateProps("maxRating", Number(value))} />
            </>
          )}

          {node.type === "testimonial" && (
            <>
              <Field label="Quote">
                <textarea
                  rows={5}
                  value={String(node.props.quote || "")}
                  onChange={(event) => updateProps("quote", event.target.value)}
                  style={CONTROL_STYLE}
                />
              </Field>
              <TextControl label="Name" value={String(node.props.name || "")} onChange={(value) => updateProps("name", value)} />
              <TextControl label="Role" value={String(node.props.role || "")} onChange={(value) => updateProps("role", value)} />
            </>
          )}

          {node.type === "call-to-action" && (
            <>
              <TextControl label="Title" value={String(node.props.title || "")} onChange={(value) => updateProps("title", value)} />
              <TextControl label="Description" value={String(node.props.description || "")} onChange={(value) => updateProps("description", value)} />
              <TextControl label="Button Text" value={String(node.props.buttonText || "Learn More")} onChange={(value) => updateProps("buttonText", value)} />
              <TextControl
                label="Button URL"
                value={String(node.props.buttonUrl || "")}
                onChange={(value) => updateProps("buttonUrl", value)}
                list="builder-link-targets"
                onFocus={() => void loadLinkSuggestions()}
              />
            </>
          )}
          {node.type === "flip-box" && (
            <ControlGroup title="Front & Back Content" defaultOpen>
              <TextControl label="Front Title" value={String(node.props.frontTitle || "")} onChange={(value) => updateProps("frontTitle", value)} />
              <Field label="Front Description"><textarea rows={3} value={String(node.props.frontDescription || "")} onChange={(event) => updateProps("frontDescription", event.target.value)} style={CONTROL_STYLE} /></Field>
              <TextControl label="Back Title" value={String(node.props.backTitle || "")} onChange={(value) => updateProps("backTitle", value)} />
              <Field label="Back Description"><textarea rows={3} value={String(node.props.backDescription || "")} onChange={(event) => updateProps("backDescription", event.target.value)} style={CONTROL_STYLE} /></Field>
              <TextControl label="Flip Hint" value={String(node.props.flipHint || "Click to view more")} onChange={(value) => updateProps("flipHint", value)} />
              <TextControl label="Button Text" value={String(node.props.backButtonText || "Learn More")} onChange={(value) => updateProps("backButtonText", value)} />
              <TextControl label="Button URL" value={String(node.props.backButtonUrl || "#")} onChange={(value) => updateProps("backButtonUrl", value)} />
            </ControlGroup>
          )}

          {node.type === "countdown" && (
            <ControlGroup title="Countdown Settings" defaultOpen>
              <Field label="Target Date & Time"><input type="datetime-local" value={String(node.props.date || "").slice(0, 16)} onChange={(event) => updateProps("date", event.target.value)} style={CONTROL_STYLE} /></Field>
              {(["showDays", "showHours", "showMinutes", "showSeconds"] as const).map((key) => <Field key={key} label={`Show ${key.replace("show", "")}`}><input type="checkbox" checked={node.props[key] !== false} onChange={(event) => updateProps(key, event.target.checked)} /></Field>)}
              <TextControl label="Expired Message" value={String(node.props.expiredText || "The offer has ended.")} onChange={(value) => updateProps("expiredText", value)} />
            </ControlGroup>
          )}

          {node.type === "animated-headline" && (
            <ControlGroup title="Headline Content" defaultOpen>
              <TextControl label="Before Text" value={String(node.props.beforeText || "")} onChange={(value) => updateProps("beforeText", value)} />
              <Field label="Animated Words (one per line)"><textarea rows={5} value={Array.isArray(node.props.animatedText) ? (node.props.animatedText as string[]).join("\n") : ""} onChange={(event) => updateProps("animatedText", event.target.value.split("\n").map((value) => value.trim()).filter(Boolean))} style={CONTROL_STYLE} /></Field>
              <TextControl label="After Text" value={String(node.props.afterText || "")} onChange={(value) => updateProps("afterText", value)} />
              <SelectControl label="Animation" value={String(node.props.animation || "typing")} options={[{ label: "Typing", value: "typing" }, { label: "Fade", value: "fade" }, { label: "Slide", value: "slide" }]} onChange={(value) => updateProps("animation", value)} />
              <TextControl label="Change Interval (ms)" type="number" value={String(node.props.interval || 2400)} onChange={(value) => updateProps("interval", Number(value))} />
            </ControlGroup>
          )}

          {node.type === "share-buttons" && (
            <ControlGroup title="Share Networks" defaultOpen>
              {(["facebook", "x", "linkedin", "whatsapp", "copy"] as const).map((network) => {
                const networks = Array.isArray(node.props.networks) ? node.props.networks as string[] : [];
                return <Field key={network} label={network === "x" ? "X / Twitter" : network[0].toUpperCase() + network.slice(1)}><input type="checkbox" checked={networks.includes(network)} onChange={(event) => updateProps("networks", event.target.checked ? [...networks, network] : networks.filter((item) => item !== network))} /></Field>;
              })}
              <Field label="Show Text Labels"><input type="checkbox" checked={Boolean(node.props.showLabels)} onChange={(event) => updateProps("showLabels", event.target.checked)} /></Field>
              <SelectControl label="Button Shape" value={String(node.props.shape || "circle")} options={["circle", "rounded", "square"].map((value) => ({ label: value, value }))} onChange={(value) => updateProps("shape", value)} />
            </ControlGroup>
          )}

          {node.type === "price-table" && (
            <ControlGroup title="Pricing Content" defaultOpen>
              <TextControl label="Plan Title" value={String(node.props.title || "Basic Plan")} onChange={(value) => updateProps("title", value)} />
              <TextControl label="Currency" value={String(node.props.currency || "₹")} onChange={(value) => updateProps("currency", value)} />
              <TextControl label="Price" value={String(node.props.price || "")} onChange={(value) => updateProps("price", value)} />
              <TextControl label="Billing Period" value={String(node.props.period || "month")} onChange={(value) => updateProps("period", value)} />
              <Field label="Features (one per line)"><textarea rows={7} value={Array.isArray(node.props.features) ? (node.props.features as string[]).join("\n") : ""} onChange={(event) => updateProps("features", event.target.value.split("\n").map((value) => value.trim()).filter(Boolean))} style={CONTROL_STYLE} /></Field>
              <TextControl label="Button Text" value={String(node.props.buttonText || "Choose Plan")} onChange={(value) => updateProps("buttonText", value)} />
              <TextControl label="Button URL" value={String(node.props.buttonUrl || "#")} onChange={(value) => updateProps("buttonUrl", value)} />
              <Field label="Featured Plan"><input type="checkbox" checked={Boolean(node.props.featured)} onChange={(event) => updateProps("featured", event.target.checked)} /></Field>
            </ControlGroup>
          )}

          {node.type === "login-form" && (
            <ControlGroup title="Login Form Content" defaultOpen>
              <TextControl label="Username Label" value={String(node.props.usernameLabel || "Username or Email")} onChange={(value) => updateProps("usernameLabel", value)} />
              <TextControl label="Password Label" value={String(node.props.passwordLabel || "Password")} onChange={(value) => updateProps("passwordLabel", value)} />
              <TextControl label="Submit Button Text" value={String(node.props.submitText || "Log In")} onChange={(value) => updateProps("submitText", value)} />
              <Field label="Show Remember Me"><input type="checkbox" checked={node.props.rememberMe !== false} onChange={(event) => updateProps("rememberMe", event.target.checked)} /></Field>
            </ControlGroup>
          )}

          {node.type === "post-excerpt" && <TextControl label="Excerpt Word Count" type="number" value={String(node.props.length || 30)} onChange={(value) => updateProps("length", Math.max(1, Math.min(500, Number(value) || 30)))} />}
          {node.type === "post-title" && <><SelectControl label="HTML Tag" value={String(node.props.htmlTag || "h1")} options={["h1", "h2", "h3", "h4", "h5", "h6"].map((value) => ({ label: value.toUpperCase(), value }))} onChange={(value) => updateProps("htmlTag", value)} /><TextControl label="Fallback Text" value={String(node.props.fallbackText || "Current Post Title")} onChange={(value) => updateProps("fallbackText", value)} /></>}
          {node.type === "post-content" && <p style={{ color: "#64748b", fontSize: 12 }}>Automatically displays the current post content. For security, embedded scripts are removed.</p>}
          {node.type === "featured-image" && <TextControl label="Image Alt Text" value={String(node.props.alt || "")} onChange={(value) => updateProps("alt", value)} />}
          {node.type === "post-info" && <>{(["showDate", "showAuthor", "showCategories", "showComments"] as const).map((key) => <Field key={key} label={`Show ${key.replace("show", "")}`}><input type="checkbox" checked={node.props[key] !== false} onChange={(event) => updateProps(key, event.target.checked)} /></Field>)}<TextControl label="Fallback Text" value={String(node.props.fallbackText || "Post metadata")} onChange={(value) => updateProps("fallbackText", value)} /></>}
          {node.type === "author-box" && <><TextControl label="Author Name" value={String(node.props.authorName || "Author")} onChange={(value) => updateProps("authorName", value)} /><TextControl label="Author Role" value={String(node.props.authorRole || "")} onChange={(value) => updateProps("authorRole", value)} /><Field label="Author Biography"><textarea rows={4} value={String(node.props.authorBio || "")} onChange={(event) => updateProps("authorBio", event.target.value)} style={CONTROL_STYLE} /></Field><TextControl label="Author Image URL" value={String(node.props.authorImage || "")} onChange={(value) => updateProps("authorImage", value)} /><Field label="Show Image"><input type="checkbox" checked={node.props.showImage !== false} onChange={(event) => updateProps("showImage", event.target.checked)} /></Field><Field label="Show Name"><input type="checkbox" checked={node.props.showName !== false} onChange={(event) => updateProps("showName", event.target.checked)} /></Field><Field label="Show Biography"><input type="checkbox" checked={node.props.showBio !== false} onChange={(event) => updateProps("showBio", event.target.checked)} /></Field></>}
          {node.type === "post-navigation" && <><TextControl label="Previous Label" value={String(node.props.previousText || "Previous Post")} onChange={(value) => updateProps("previousText", value)} /><TextControl label="Next Label" value={String(node.props.nextText || "Next Post")} onChange={(value) => updateProps("nextText", value)} /><Field label="Show Previous"><input type="checkbox" checked={node.props.showPrevious !== false} onChange={(event) => updateProps("showPrevious", event.target.checked)} /></Field><Field label="Show Next"><input type="checkbox" checked={node.props.showNext !== false} onChange={(event) => updateProps("showNext", event.target.checked)} /></Field></>}
          {node.type === "archive-title" && <TextControl label="Title" value={String(node.props.title || "Archive")} onChange={(value) => updateProps("title", value)} />}
          {node.type === "archive-description" && <Field label="Description"><textarea rows={4} value={String(node.props.description || "")} onChange={(event) => updateProps("description", event.target.value)} style={CONTROL_STYLE} /></Field>}
          {node.type === "pagination" && <><TextControl label="Previous Text" value={String(node.props.previousText || "Previous")} onChange={(value) => updateProps("previousText", value)} /><TextControl label="Next Text" value={String(node.props.nextText || "Next")} onChange={(value) => updateProps("nextText", value)} /><TextControl label="Previous URL" value={String(node.props.previousUrl || "?page=1")} onChange={(value) => updateProps("previousUrl", value)} /><TextControl label="Next URL" value={String(node.props.nextUrl || "?page=2")} onChange={(value) => updateProps("nextUrl", value)} /></>}

          {node.type === "toggle" && (
            <>
              <TextControl label="Title" value={String(node.props.title || "")} onChange={(value) => updateProps("title", value)} />
              <Field label="Content">
                <textarea
                  rows={5}
                  value={String(node.props.content || "")}
                  onChange={(event) => updateProps("content", event.target.value)}
                  style={CONTROL_STYLE}
                />
              </Field>
              <Field label="Open by Default">
                <input
                  type="checkbox"
                  checked={Boolean(node.props.open)}
                  onChange={(event) => updateProps("open", event.target.checked)}
                />
              </Field>
            </>
          )}

          {node.type === "menu" && (
            <>
              <SelectControl
                label="Navigation Menu"
                value={String(node.props.menuId || "")}
                options={[
                  { label: "Choose a menu", value: "" },
                  ...builderMenus.map((menu) => ({
                    label: menu.name,
                    value: menu.id,
                  })),
                ]}
                onChange={(menuId) => {
                if (!selectedId) return;
                const requestId = ++menuRequestId.current;
                const menu = builderMenus.find((entry) => entry.id === menuId);
                const saveMenuSelection = async () => {
                  try {
                    let items: BuilderMenuItem[] = [];
                    if (menuId) {
                      const location = menu?.location || "HEADER";
                      const response = await fetch(
                        `/api/public/menus/${location}?menuId=${encodeURIComponent(menuId)}`,
                        { cache: "no-store" },
                      );
                      const result = await response.json();
                      if (!response.ok || !result.success) {
                        throw new Error(
                          result.message || "Unable to load menu links.",
                        );
                      }
                      items = normalizePublicMenuItems(result.menu?.items);
                    }

                    if (menuRequestId.current !== requestId) return;
                    commitRoot(
                      updateTree(layout.root, selectedId, (currentNode) => ({
                        ...currentNode,
                        props: {
                          ...currentNode.props,
                          menuId,
                          menuLocation: menu?.location || "HEADER",
                          items,
                        },
                      })),
                    );
                    setError("");
                  } catch (menuError) {
                    if (menuRequestId.current !== requestId) return;
                    setError(
                      menuError instanceof Error
                        ? menuError.message
                        : "Unable to load menu links.",
                    );
                  }
                };
                void saveMenuSelection();
              }}
              />
              <SelectControl
                label="Menu Layout"
                value={String(node.props.orientation || "horizontal")}
                options={[
                  { label: "Horizontal", value: "horizontal" },
                  { label: "Vertical", value: "vertical" },
                ]}
                onChange={(value) => updateProps("orientation", value)}
              />
              <SelectControl
                label="Menu Alignment"
                value={String(node.props.alignment || "left")}
                options={[
                  { label: "Left", value: "left" },
                  { label: "Center", value: "center" },
                  { label: "Right", value: "right" },
                ]}
                onChange={(value) => updateProps("alignment", value)}
              />
              <SelectControl
                label="Menu Item Icon"
                value={String(node.props.itemIconName || "")}
                options={[
                  { label: "No icon", value: "" },
                  ...Object.keys(themeIcons).map((name) => ({
                    label: name,
                    value: name,
                  })),
                ]}
                onChange={(value) => updateProps("itemIconName", value)}
              />
              <Field label="Enable Submenus">
                <input
                  type="checkbox"
                  checked={node.props.dropdown !== false}
                  onChange={(event) => updateProps("dropdown", event.target.checked)}
                />
              </Field>
              <Field label="Enable Mobile Menu">
                <input
                  type="checkbox"
                  checked={node.props.mobileToggle !== false}
                  onChange={(event) => updateProps("mobileToggle", event.target.checked)}
                />
              </Field>
              <TextControl
                label="Mobile Breakpoint (px)"
                type="number"
                value={String(node.props.mobileBreakpoint || 767)}
                onChange={(value) => updateProps("mobileBreakpoint", Number(value))}
              />
              <SelectControl
                label="Mobile Menu Layout"
                value={String(node.props.mobileLayout || "slide-in")}
                options={[
                  { label: "Dropdown", value: "dropdown" },
                  { label: "Slide In", value: "slide-in" },
                  { label: "Full Screen", value: "fullscreen" },
                  { label: "Off Canvas", value: "off-canvas" },
                ]}
                onChange={(value) => updateProps("mobileLayout", value)}
              />
              <SelectControl
                label="Mobile Menu Position"
                value={String(node.props.mobilePosition || "right")}
                options={[
                  { label: "Left", value: "left" },
                  { label: "Right", value: "right" },
                ]}
                onChange={(value) => updateProps("mobilePosition", value)}
              />
              <UnitControl
                label="Mobile Menu Width"
                value={String(node.props.mobileWidth || "320px")}
                onChange={(value) => updateProps("mobileWidth", value)}
              />
              <SelectControl
                label="Open Menu Icon"
                value={String(node.props.openIcon || "Menu")}
                options={[
                  { label: "Default", value: "" },
                  ...Object.keys(themeIcons).map((name) => ({
                    label: name,
                    value: name,
                  })),
                ]}
                onChange={(value) => updateProps("openIcon", value)}
              />
              <SelectControl
                label="Close Menu Icon"
                value={String(node.props.closeIcon || "")}
                options={[
                  { label: "Default Close Icon", value: "" },
                  ...Object.keys(themeIcons).map((name) => ({
                    label: name,
                    value: name,
                  })),
                ]}
                onChange={(value) => updateProps("closeIcon", value)}
              />
              <TextControl
                label="Mobile Icon Size"
                type="number"
                value={String(node.props.mobileIconSize || 24)}
                onChange={(value) => updateProps("mobileIconSize", Number(value))}
              />
            </>
          )}

          {node.type === "site-logo" && (
            <>
              {typeof (node.props.src || node.props.image) === "string" &&
              (node.props.src || node.props.image) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={safeMediaUrl(
                    String(node.props.src || node.props.image),
                  )}
                  alt={String(node.props.alt || "")}
                  style={{
                    display: "block",
                    width: "100%",
                    maxHeight: 120,
                    objectFit: "contain",
                    marginBottom: 10,
                    border: "1px solid #e2e8f0",
                  }}
                />
              ) : null}
              <button
                type="button"
                style={{
                  ...BUTTON_STYLE,
                  width: "100%",
                }}
                onClick={() => void openMediaLibrary("widget")}
              >
                <ImageIcon size={15} />
                Choose Logo
              </button>

              {node.props.src || node.props.image ? (
                <button
                  type="button"
                  style={{ ...BUTTON_STYLE, width: "100%", marginTop: 6, color: "#b42318" }}
                  onClick={() => clearProps("src", "image", "mediaId")}
                >
                  <X size={15} /> Remove Logo Image
                </button>
              ) : null}

              <TextControl
                label="Alt Text"
                value={String(node.props.alt || "")}
                onChange={(value) => updateProps("alt", value)}
              />

              <TextControl
                label="Logo Link"
                value={String(node.props.link || "/")}
                onChange={(value) => updateProps("link", value)}
                list="builder-link-targets"
                onFocus={() => void loadLinkSuggestions()}
              />
            </>
          )}

          {node.type === "spacer" && (
            <UnitControl
              label="Spacer Height"
              value={String(node.props.height || "40px")}
              onChange={(value) => updateProps("height", value)}
            />
          )}

          {node.type === "divider" && (
            <>
              <SelectControl
                label="Divider Style"
                value={String(node.props.style || "solid")}
                options={["solid", "dashed", "dotted", "double"].map(
                  (value) => ({
                    label: value,
                    value,
                  }),
                )}
                onChange={(value) => updateProps("style", value)}
              />

              <UnitControl
                label="Thickness"
                value={String(node.props.thickness || "1px")}
                onChange={(value) => updateProps("thickness", value)}
              />
            </>
          )}

          {node.type === "icon" && (
            <>
              <Field label="Icon Library">
                <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={() => setIconPickerTarget({ kind: "widget", value: String(node.props.iconName || "") })}>
                  {(() => { const SelectedIcon = themeIcons[String(node.props.iconName || "")]; return SelectedIcon ? <SelectedIcon size={16} /> : <Search size={16} />; })()}
                  {String(node.props.iconName || "Choose Icon")}
                </button>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                <button type="button" style={BUTTON_STYLE} onClick={() => void openMediaLibrary("widgetIcon")}><ImageIcon size={14} /> Media Library</button>
                <button type="button" style={BUTTON_STYLE} onClick={() => openImageUpload("widgetIcon")}><Upload size={14} /> Upload image</button>
              </div>
              {node.props.iconImage ? <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><img src={safeMediaUrl(String(node.props.iconImage))} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} /><button type="button" style={BUTTON_STYLE} onClick={() => clearProps("iconImage", "iconImageId")}>Remove image</button></div> : null}
              <TextControl
                label="Icon Symbol"
                value={String(node.props.symbol || "★")}
                onChange={(value) => updateProps("symbol", value)}
              />

              <TextControl
                label="Icon Size"
                value={String(node.props.size || 24)}
                onChange={(value) => updateProps("size", Number(value))}
                type="number"
              />
            </>
          )}

          {(node.type === "accordion" || node.type === "tabs" || node.type === "social-icons" || node.type === "icon-list" || node.type === "price-list") && (
            <ControlGroup title="Items" defaultOpen>
              {repeaterItems.map((entry, index) => (
                <div key={String(entry.id || index)} style={{ border: "1px solid #dbe3ed", borderRadius: 8, padding: 10, marginBottom: 10, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <strong style={{ fontSize: 12 }}>{node.type === "social-icons" ? `Social icon ${index + 1}` : node.type === "icon-list" ? `List item ${index + 1}` : `Item ${index + 1}`}</strong>
                    <button type="button" aria-label="Remove item" style={{ ...BUTTON_STYLE, color: "#b42318" }} onClick={() => removeRepeaterItem(index)}><Trash2 size={14} /></button>
                  </div>
                  {node.type === "social-icons" ? (
                    <>
                      <TextControl label="Label / Network" value={String(entry.label || entry.name || "")} onChange={(value) => updateRepeaterItem(index, { label: value, name: value })} />
                      <TextControl label="URL" value={String(entry.url || "")} onChange={(value) => updateRepeaterItem(index, { url: value })} placeholder="https://..." />
                      <Field label="Icon">
                        <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={() => setIconPickerTarget({ kind: "repeaterItem", index, key: "icons", value: String(entry.iconName || "") })}>{String(entry.iconName || "Choose icon")}</button>
                      </Field>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button type="button" style={BUTTON_STYLE} onClick={() => void openMediaLibrary("repeaterIcon", index)}><ImageIcon size={14} /> Media Library</button><button type="button" style={BUTTON_STYLE} onClick={() => openImageUpload("repeaterIcon", index)}><Upload size={14} /> Upload</button></div>
                    </>
                  ) : node.type === "icon-list" ? (
                    <>
                      <TextControl label="Text" value={String(entry.text || entry.label || "")} onChange={(value) => updateRepeaterItem(index, { text: value })} />
                      <TextControl label="Link URL" value={String(entry.url || "")} onChange={(value) => updateRepeaterItem(index, { url: value })} />
                      <Field label="Icon"><button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={() => setIconPickerTarget({ kind: "repeaterItem", index, key: "items", value: String(entry.iconName || "Check") })}>{String(entry.iconName || "Choose icon")}</button></Field>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button type="button" style={BUTTON_STYLE} onClick={() => void openMediaLibrary("repeaterIcon", index)}><ImageIcon size={14} /> Media Library</button><button type="button" style={BUTTON_STYLE} onClick={() => openImageUpload("repeaterIcon", index)}><Upload size={14} /> Upload</button></div>
                    </>
                  ) : node.type === "price-list" ? (
                    <><TextControl label="Title" value={String(entry.title || "")} onChange={(value) => updateRepeaterItem(index, { title: value })} /><TextControl label="Price" value={String(entry.price || "")} onChange={(value) => updateRepeaterItem(index, { price: value })} /><TextControl label="Description" value={String(entry.description || "")} onChange={(value) => updateRepeaterItem(index, { description: value })} /></>
                  ) : (
                    <><TextControl label="Title" value={String(entry.title || "")} onChange={(value) => updateRepeaterItem(index, { title: value })} /><Field label="Content"><textarea rows={4} value={String(entry.content || "")} onChange={(event) => updateRepeaterItem(index, { content: event.target.value })} style={CONTROL_STYLE} /></Field></>
                  )}
                </div>
              ))}
              <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={addRepeaterItem}><Plus size={15} /> Add Item</button>
              {node.type === "icon-list" ? <><TextControl label="Icon Size" type="number" value={String(node.props.iconSize || 16)} onChange={(value) => updateProps("iconSize", Number(value))} /><TextControl label="Icon Color" value={String(node.props.iconColor || "#3984e8")} onChange={(value) => updateProps("iconColor", value)} /><UnitControl label="Item Spacing" value={String(node.props.itemSpacing || "12px")} onChange={(value) => updateProps("itemSpacing", value)} /><Field label="Show Dividers"><input type="checkbox" checked={Boolean(node.props.divider)} onChange={(event) => updateProps("divider", event.target.checked)} /></Field></> : null}
              {node.type === "social-icons" ? <><TextControl label="Icon Size" type="number" value={String(node.props.iconSize || 22)} onChange={(value) => updateProps("iconSize", Number(value))} /><TextControl label="Button Size" type="number" value={String(node.props.buttonSize || 40)} onChange={(value) => updateProps("buttonSize", Number(value))} /><SelectControl label="Shape" value={String(node.props.shape || "circle")} options={["circle", "rounded", "square"].map((value) => ({ label: value, value }))} onChange={(value) => updateProps("shape", value)} /></> : null}
            </ControlGroup>
          )}

          {(node.type === "posts" || node.type === "loop-grid" || node.type === "loop-carousel" || node.type === "post-tabs") && (
            <ControlGroup title="Query & Content" defaultOpen>
              <TextControl label="Post Type Slug (post = regular posts)" value={String(node.props.postType || "post")} onChange={(value) => updateProps("postType", value.trim())} />
              <TextControl label="Number of Posts per Tab / Grid" type="number" value={String(node.props.count || 6)} onChange={(value) => updateProps("count", Math.max(1, Math.min(24, Number(value) || 1)))} />
              <TextControl label="Columns" type="number" value={String(node.props.columns || 3)} onChange={(value) => updateProps("columns", Math.max(1, Math.min(6, Number(value) || 1)))} />
              <SelectControl label="Order By" value={String(node.props.orderBy || "date")} options={[{ label: "Published Date", value: "date" }, { label: "Created Date", value: "created" }, { label: "Title", value: "title" }]} onChange={(value) => updateProps("orderBy", value)} />
              <SelectControl label="Order" value={String(node.props.order || "desc")} options={[{ label: "Newest / Descending", value: "desc" }, { label: "Oldest / Ascending", value: "asc" }]} onChange={(value) => updateProps("order", value)} />
              {node.type !== "post-tabs" ? <TextControl label="Category Slug" value={String(node.props.category || "")} onChange={(value) => updateProps("category", value)} /> : null}
              {(["showImage", "showTitle", "showExcerpt", "showDate", "showReadMore"] as const).map((key) => <Field key={key} label={key.replace(/^show/, "Show ")}><input type="checkbox" checked={node.props[key] !== false} onChange={(event) => updateProps(key, event.target.checked)} /></Field>)}
              <TextControl label="Read More Text" value={String(node.props.readMoreText || "Read More")} onChange={(value) => updateProps("readMoreText", value)} />
              {node.type === "post-tabs" ? <>
                <strong style={{ display: "block", margin: "12px 0 6px" }}>Post Tabs</strong>
                {(Array.isArray(node.props.tabs) ? node.props.tabs as Array<Record<string, unknown>> : []).map((tab, index) => <div key={String(tab.id || index)} style={{ border: "1px solid #dbe3ed", borderRadius: 8, padding: 8, marginBottom: 8 }}><TextControl label="Tab Title" value={String(tab.title || "")} onChange={(value) => { const all = [...(node.props.tabs as Array<Record<string, unknown>> || [])]; all[index] = { ...all[index], title: value }; updateProps("tabs", all); }} /><TextControl label="Category Slug" value={String(tab.categorySlug || "")} onChange={(value) => { const all = [...(node.props.tabs as Array<Record<string, unknown>> || [])]; all[index] = { ...all[index], categorySlug: value }; updateProps("tabs", all); }} /><button type="button" style={{ ...BUTTON_STYLE, color: "#b42318" }} onClick={() => updateProps("tabs", (node.props.tabs as unknown[] || []).filter((_, i) => i !== index))}><Trash2 size={13} /> Remove Tab</button></div>)}
                <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={() => updateProps("tabs", [...(Array.isArray(node.props.tabs) ? node.props.tabs : []), { id: `post-tab-${Date.now()}`, title: "New Tab", categorySlug: "" }])}><Plus size={14} /> Add Post Tab</button>
              </> : null}
            </ControlGroup>
          )}

          {node.type === "form" && (
            <>
              <TextControl
                label="Submit Button Text"
                value={String(node.props.submitText || "Submit")}
                onChange={(value) => updateProps("submitText", value)}
              />

              <TextControl
                label="Notification Email"
                value={String(node.props.emailTo || "")}
                onChange={(value) => updateProps("emailTo", value)}
              />
              <TextControl label="Success Message" value={String(node.props.successMessage || "Thank you. Your submission was received.")} onChange={(value) => updateProps("successMessage", value)} />
              <Field label="Store Entries"><input type="checkbox" checked={node.props.storeEntries !== false} onChange={(event) => updateProps("storeEntries", event.target.checked)} /></Field>

              <Field label="Form Fields (JSON)">
                <textarea
                  rows={10}
                  defaultValue={JSON.stringify(
                    node.props.fields || [],
                    null,
                    2,
                  )}
                  onBlur={(event) => {
                    try {
                      const parsed = JSON.parse(event.target.value);

                      if (!Array.isArray(parsed)) {
                        throw new Error("Expected an array.");
                      }

                      updateProps("fields", parsed);
                    } catch {
                      setError("Form fields JSON is invalid.");
                    }
                  }}
                  style={{
                    ...CONTROL_STYLE,
                    fontFamily: "monospace",
                  }}
                />
              </Field>
            </>
          )}

          {node.type === "google-maps" && (
            <>
              <TextControl
                label="Map Address"
                value={String(node.props.address || "")}
                onChange={(value) => updateProps("address", value)}
              />

              <TextControl
                label="Zoom"
                value={String(node.props.zoom || 14)}
                onChange={(value) => updateProps("zoom", Number(value))}
                type="number"
              />
            </>
          )}
        </ControlGroup>

        {node.type === "slides" ? (
          <ControlGroup title="Banner Slider">
            <Field label="Autoplay">
              <input
                type="checkbox"
                checked={node.props.autoplay !== false}
                onChange={(event) => updateProps("autoplay", event.target.checked)}
              />
            </Field>
            <TextControl
              label="Autoplay Delay (ms)"
              type="number"
              value={String(node.props.autoplayDelay || 5000)}
              onChange={(value) => updateProps("autoplayDelay", Math.max(1000, Number(value) || 5000))}
            />
            <SelectControl
              label="Transition"
              value={String(node.props.transition || "slide")}
              options={[
                { label: "Slide", value: "slide" },
                { label: "Fade", value: "fade" },
              ]}
              onChange={(value) => updateProps("transition", value)}
            />
            <Field label="Navigation Arrows">
              <input
                type="checkbox"
                checked={node.props.navigation !== false}
                onChange={(event) => updateProps("navigation", event.target.checked)}
              />
            </Field>
            <Field label="Pagination Dots">
              <input
                type="checkbox"
                checked={node.props.pagination !== false}
                onChange={(event) => updateProps("pagination", event.target.checked)}
              />
            </Field>

            {slideEntries.map((slide, slideIndex) => {
              const buttons = slideButtonList(slide);
              const selectedImage = String(slide.backgroundImage || slide.image || "");
              return (
                <details
                  key={String(slide.id || slideIndex)}
                  open={slideIndex === 0}
                  style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 10 }}
                >
                  <summary style={{ display: "flex", cursor: "pointer", fontWeight: 700 }}>
                    Slide {slideIndex + 1}
                  </summary>
                  <div style={{ paddingTop: 10 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <button
                        type="button"
                        style={BUTTON_STYLE}
                        disabled={slideIndex === 0}
                        onClick={() => moveSlide(slideIndex, -1)}
                      >
                        ↑ Move Up
                      </button>
                      <button
                        type="button"
                        style={BUTTON_STYLE}
                        disabled={slideIndex === slideEntries.length - 1}
                        onClick={() => moveSlide(slideIndex, 1)}
                      >
                        ↓ Move Down
                      </button>
                    </div>
                    <TextControl
                      label="Heading"
                      value={String(slide.heading || "")}
                      onChange={(value) => updateSlide(slideIndex, "heading", value)}
                    />
                    <Field label="Rich Text">
                      <BannerRichTextEditor
                        key={`${node.id}-${slideIndex}-rich-text`}
                        value={String(slide.description || slide.content || "")}
                        onChange={(value) => updateSlide(slideIndex, "description", value)}
                      />
                    </Field>

                    <Field label="Background Image">
                      {selectedImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={safeMediaUrl(selectedImage)}
                          alt=""
                          style={{ width: "100%", maxHeight: 120, objectFit: "cover", display: "block", marginBottom: 8 }}
                        />
                      ) : null}
                      <button
                        type="button"
                        style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 6 }}
                        onClick={() => void openMediaLibrary("slideBackground", slideIndex)}
                      >
                        <ImageIcon size={15} /> Choose Background Image
                      </button>
                      <button
                        type="button"
                        style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 6 }}
                        onClick={() => openImageUpload("slideBackground", slideIndex)}
                      >
                        <Upload size={15} /> Upload Background Image
                      </button>
                      {selectedImage ? (
                        <button
                          type="button"
                          style={{ ...BUTTON_STYLE, width: "100%" }}
                          onClick={() => {
                            updateSlideFields(slideIndex, {
                              backgroundImage: "",
                              image: "",
                              backgroundMediaId: "",
                            });
                          }}
                        >
                          <X size={15} /> Remove Background Image
                        </button>
                      ) : null}
                    </Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <Field label="Background Color">
                        <input
                          type="color"
                          value={String(slide.backgroundColor || "#0c2f55")}
                          onChange={(event) => updateSlide(slideIndex, "backgroundColor", event.target.value)}
                        />
                      </Field>
                      <Field label="Heading Color">
                        <input
                          type="color"
                          value={String(slide.headingColor || "#ffffff")}
                          onChange={(event) => updateSlide(slideIndex, "headingColor", event.target.value)}
                        />
                      </Field>
                      <Field label="Text Color">
                        <input
                          type="color"
                          value={String(slide.textColor || "#ffffff")}
                          onChange={(event) => updateSlide(slideIndex, "textColor", event.target.value)}
                        />
                      </Field>
                      <Field label="Overlay Color">
                        <input
                          type="color"
                          value={String(slide.overlayColor || "#000000")}
                          onChange={(event) => updateSlide(slideIndex, "overlayColor", event.target.value)}
                        />
                      </Field>
                    </div>
                    <TextControl
                      label="Overlay Opacity (0–1)"
                      type="number"
                      value={String(slide.overlayOpacity ?? 0)}
                      onChange={(value) => updateSlide(slideIndex, "overlayOpacity", Math.max(0, Math.min(1, Number(value) || 0)))}
                    />
                    <SelectControl
                      label="Canvas Image Effect"
                      value={String(slide.imageEffect || node.props.imageEffect || "none")}
                      options={[
                        { label: "None", value: "none" },
                        { label: "Ken Burns Zoom", value: "zoom" },
                        { label: "Pan", value: "pan" },
                      ]}
                      onChange={(value) => updateSlide(slideIndex, "imageEffect", value)}
                    />
                    <SelectControl
                      label="Button Count"
                      value={String(buttons.length)}
                      options={[
                        { label: "2 Buttons", value: "2" },
                        { label: "3 Buttons", value: "3" },
                      ]}
                      onChange={(value) => {
                        const count = Number(value);
                        const next = buttons.slice(0, count);
                        while (next.length < count) {
                          next.push({
                            text: `Button ${next.length + 1}`,
                            url: "",
                            width: "fit-content",
                          });
                        }
                        updateSlide(slideIndex, "buttons", next);
                      }}
                    />
                    {buttons.map((button, buttonIndex) => (
                      <details
                        key={`${slideIndex}-${buttonIndex}`}
                        style={{ borderTop: "1px solid #e2e8f0", paddingTop: 8, marginTop: 8 }}
                      >
                        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                          Button {buttonIndex + 1}
                        </summary>
                        <div style={{ paddingTop: 8 }}>
                          <TextControl
                            label="Button Text"
                            value={String(button.text || "")}
                            onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "text", value)}
                          />
                          <button
                            type="button"
                            style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 8 }}
                            onClick={() =>
                              setIconPickerTarget({
                                kind: "slideButton",
                                slideIndex,
                                buttonIndex,
                                value: String(button.iconName || ""),
                              })
                            }
                          >
                            {String(button.iconName || "Choose Icon")}
                          </button>
                          <SelectControl
                            label="Link Type"
                            value={String(button.linkType || "normal")}
                            options={[
                              { label: "Normal Link", value: "normal" },
                              { label: "Dynamic Link", value: "dynamic" },
                            ]}
                            onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "linkType", value)}
                          />
                          {button.linkType === "dynamic" ? (
                            <SelectControl
                              label="Dynamic Link"
                              value={String(button.dynamicLink || "current-page")}
                              options={[
                                { label: "Current Page", value: "current-page" },
                                { label: "Homepage", value: "homepage" },
                              ]}
                              onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "dynamicLink", value)}
                            />
                          ) : (
                            <TextControl
                              label="Link URL"
                              value={String(button.url || "")}
                              onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "url", value)}
                              list="builder-link-targets"
                              onFocus={() => void loadLinkSuggestions()}
                            />
                          )}
                          <SelectControl
                            label="Link Target"
                            value={String(button.target || "_self")}
                            options={[
                              { label: "Same Window", value: "_self" },
                              { label: "New Window", value: "_blank" },
                            ]}
                            onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "target", value)}
                          />
                          <SelectControl
                            label="Button Width"
                            value={
                              button.width === "fit-content" || button.width === "100%"
                                ? String(button.width)
                                : "custom"
                            }
                            options={[
                              { label: "Auto", value: "fit-content" },
                              { label: "Full Width", value: "100%" },
                              { label: "Custom", value: "custom" },
                            ]}
                            onChange={(value) =>
                              updateSlideButton(
                                slideIndex,
                                buttonIndex,
                                "width",
                                value === "custom" ? String(button.width || "240px") : value,
                              )
                            }
                          />
                          <TextControl
                            label="Custom Width"
                            value={String(button.width || "")}
                            placeholder="e.g. 240px or 60%"
                            onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "width", value)}
                          />
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <Field label="Button Color">
                              <input
                                type="color"
                                value={String(button.backgroundColor || "#0c2f55")}
                                onChange={(event) => updateSlideButton(slideIndex, buttonIndex, "backgroundColor", event.target.value)}
                              />
                            </Field>
                            <Field label="Text Color">
                              <input
                                type="color"
                                value={String(button.textColor || "#ffffff")}
                                onChange={(event) => updateSlideButton(slideIndex, buttonIndex, "textColor", event.target.value)}
                              />
                            </Field>
                            <Field label="Hover Button Color">
                              <input
                                type="color"
                                value={String(button.hoverBackgroundColor || "#164a7e")}
                                onChange={(event) => updateSlideButton(slideIndex, buttonIndex, "hoverBackgroundColor", event.target.value)}
                              />
                            </Field>
                            <Field label="Hover Text Color">
                              <input
                                type="color"
                                value={String(button.hoverTextColor || "#ffffff")}
                                onChange={(event) => updateSlideButton(slideIndex, buttonIndex, "hoverTextColor", event.target.value)}
                              />
                            </Field>
                          </div>
                          <Field label="Button Icon Image">
                            {button.iconImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={safeMediaUrl(String(button.iconImage))}
                                alt=""
                                style={{ maxWidth: 40, maxHeight: 40, display: "block", marginBottom: 6 }}
                              />
                            ) : null}
                            <button
                              type="button"
                              style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 6 }}
                              onClick={() => void openMediaLibrary("slideButtonIcon", slideIndex, buttonIndex)}
                            >
                              <ImageIcon size={15} /> Choose Icon Image
                            </button>
                            <button
                              type="button"
                              style={{ ...BUTTON_STYLE, width: "100%" }}
                              onClick={() => openImageUpload("slideButtonIcon", slideIndex, buttonIndex)}
                            >
                              <Upload size={15} /> Upload Icon Image
                            </button>
                            {button.iconImage ? (
                              <button
                                type="button"
                                style={{ ...BUTTON_STYLE, width: "100%", marginTop: 6 }}
                                onClick={() => {
                                  const slides = [...slideEntries];
                                  const buttons = Array.isArray(slides[slideIndex].buttons)
                                    ? [...(slides[slideIndex].buttons as unknown[])]
                                    : [];
                                  const entry = buttons[buttonIndex] as Record<string, unknown>;
                                  buttons[buttonIndex] = { ...entry, iconImage: "", iconMediaId: "" };
                                  slides[slideIndex] = { ...slides[slideIndex], buttons };
                                  updateProps("slides", slides);
                                }}
                              >
                                <X size={15} /> Remove Icon Image
                              </button>
                            ) : null}
                          </Field>
                        </div>
                      </details>
                    ))}
                    <button
                      type="button"
                      style={{ ...BUTTON_STYLE, width: "100%", marginTop: 12, color: "#b42318" }}
                      onClick={() => removeSlide(slideIndex)}
                    >
                      <Trash2 size={15} /> Remove Slide
                    </button>
                  </div>
                </details>
              );
            })}
            <button
              type="button"
              style={{ ...BUTTON_STYLE, width: "100%", marginTop: 12 }}
              onClick={() =>
                updateProps("slides", [
                  ...slideEntries,
                  {
                    id: `slide-${Date.now()}`,
                    heading: "Your Heading",
                    description: "<p>Add your text here.</p>",
                    backgroundColor: "#0c2f55",
                    headingColor: "#ffffff",
                    textColor: "#ffffff",
                    buttons: [
                      { text: "Learn More", url: "", width: "fit-content" },
                      { text: "Get Started", url: "", width: "fit-content" },
                    ],
                  },
                ])
              }
            >
              <Plus size={15} /> Add Slide
            </button>
          </ControlGroup>
        ) : null}

        {(node.type === "image-carousel" || node.type === "media-carousel") ? (
          <ControlGroup title="Carousel Media">
            {(() => {
              const listKey = node.type === "image-carousel" ? "images" : "items";
              const items = Array.isArray(node.props[listKey]) ? node.props[listKey] as unknown[] : [];
              const updateItem = (index: number, value: unknown) => {
                const next = [...items];
                next[index] = value;
                updateProps(listKey, next);
              };
              return (
                <>
                  {items.map((item, index) => {
                    const entry = item && typeof item === "object"
                      ? item as Record<string, unknown>
                      : { url: typeof item === "string" ? item : "" };
                    const mediaUrl = String(entry.url || entry.src || "");
                    return (
                      <div key={String(entry.id || index)} style={{ padding: "8px 0", borderTop: "1px solid #e2e8f0" }}>
                        {mediaUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={safeMediaUrl(mediaUrl)} alt="" style={{ width: "100%", maxHeight: 100, objectFit: "cover", display: "block", marginBottom: 6 }} />
                        ) : null}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                          <button
                            type="button"
                            style={BUTTON_STYLE}
                            onClick={() => void openMediaLibrary("carouselItem", index)}
                          >
                            <ImageIcon size={15} /> Media Library
                          </button>
                          <button
                            type="button"
                            style={BUTTON_STYLE}
                            onClick={() => openImageUpload("carouselItem", index)}
                          >
                            <Upload size={15} /> Upload Image
                          </button>
                        </div>
                        <TextControl
                          label="Image URL"
                          value={mediaUrl}
                          onChange={(value) => updateItem(index, { ...entry, url: value })}
                        />
                        <TextControl
                          label="Image Alt Text"
                          value={String(entry.alt || "")}
                          onChange={(value) => updateItem(index, { ...entry, alt: value })}
                        />
                        {mediaUrl ? (
                          <button
                            type="button"
                            style={{ ...BUTTON_STYLE, width: "100%", color: "#b42318" }}
                            onClick={() => updateItem(index, { ...entry, url: "", src: "", mediaId: "" })}
                          >
                            <X size={15} /> Remove Image Reference
                          </button>
                        ) : null}
                        <button
                          type="button"
                          style={{ ...BUTTON_STYLE, width: "100%", marginTop: 6 }}
                          onClick={() => updateProps(listKey, items.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          <Trash2 size={15} /> Remove Item
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    style={{ ...BUTTON_STYLE, width: "100%", marginTop: 10 }}
                    onClick={() => updateProps(listKey, [...items, { url: "", alt: "" }])}
                  >
                    <Plus size={15} /> Add Image
                  </button>
                </>
              );
            })()}
          </ControlGroup>
        ) : null}
      </>
    );
  };

  const renderLayoutPanel = () => {
    if (!selectedNode) return null;

    const node = selectedNode;
    const selectedDisplay =
      getResponsiveValue(node.styles.display, device) ||
      (node.type === "grid" ? "grid" : "flex");

    return (
      <>
        <ControlGroup title="Container Layout" defaultOpen>
          <SegmentedControl
            label="Display"
            value={String(selectedDisplay)}
            options={[
              { label: "Flex", value: "flex" },
              { label: "Grid", value: "grid" },
              { label: "Block", value: "block" },
            ]}
            onChange={(value) => updateResponsiveStyle("display", value)}
          />

          <SegmentedControl
            label="Direction"
            value={String(
              getResponsiveValue(node.styles.direction, device) ||
                (node.type === "row" ? "row" : "column"),
            )}
            options={[
              { label: "→", value: "row", title: "Row" },
              { label: "↓", value: "column", title: "Column" },
              { label: "←", value: "row-reverse", title: "Row Reverse" },
              { label: "↑", value: "column-reverse", title: "Column Reverse" },
            ]}
            onChange={(value) => updateResponsiveStyle("direction", value)}
          />

          <SegmentedControl
            label="Justify Content"
            value={String(
              getResponsiveValue(node.styles.justifyContent, device) ||
                "flex-start",
            )}
            options={[
              { label: "Start", value: "flex-start" },
              { label: "Center", value: "center" },
              { label: "End", value: "flex-end" },
              { label: "Between", value: "space-between" },
              { label: "Around", value: "space-around" },
              { label: "Evenly", value: "space-evenly" },
            ]}
            onChange={(value) => updateResponsiveStyle("justifyContent", value)}
          />

          <SegmentedControl
            label="Align Items"
            value={String(
              getResponsiveValue(node.styles.alignItems, device) || "stretch",
            )}
            options={[
              { label: "Start", value: "flex-start" },
              { label: "Center", value: "center" },
              { label: "End", value: "flex-end" },
              { label: "Stretch", value: "stretch" },
              { label: "Base", value: "baseline" },
            ]}
            onChange={(value) => updateResponsiveStyle("alignItems", value)}
          />

          <SegmentedControl
            label="Wrap"
            value={String(
              getResponsiveValue(node.styles.flexWrap, device) || "nowrap",
            )}
            options={[
              { label: "No Wrap", value: "nowrap" },
              { label: "Wrap", value: "wrap" },
              { label: "Reverse", value: "wrap-reverse" },
            ]}
            onChange={(value) => updateResponsiveStyle("flexWrap", value)}
          />
        </ControlGroup>

        <ControlGroup title="Size">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <UnitControl
              label="Width"
              value={String(
                getResponsiveValue(node.styles.width, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("width", value)}
              placeholder="100%"
            />

            <UnitControl
              label="Height"
              value={String(
                getResponsiveValue(node.styles.height, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("height", value)}
              placeholder="auto"
            />

            <UnitControl
              label="Min Width"
              value={String(
                getResponsiveValue(node.styles.minWidth, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("minWidth", value)}
            />

            <UnitControl
              label="Max Width"
              value={String(
                getResponsiveValue(node.styles.maxWidth, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("maxWidth", value)}
            />

            <UnitControl
              label="Min Height"
              value={String(
                getResponsiveValue(node.styles.minHeight, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("minHeight", value)}
            />

            <UnitControl
              label="Max Height"
              value={String(
                getResponsiveValue(node.styles.maxHeight, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("maxHeight", value)}
            />
          </div>
        </ControlGroup>

        <ControlGroup title="Items Gap">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <UnitControl
              label="Row Gap"
              value={String(
                getResponsiveValue(node.styles.rowGap, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("rowGap", value)}
            />

            <UnitControl
              label="Column Gap"
              value={String(
                getResponsiveValue(node.styles.columnGap, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("columnGap", value)}
            />
          </div>

          <UnitControl
            label="Gap"
            value={String(getResponsiveValue(node.styles.gap, device) || "")}
            onChange={(value) => updateResponsiveStyle("gap", value)}
          />
        </ControlGroup>

        <ControlGroup title="Flex Child">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <TextControl
              label="Grow"
              value={String(
                getResponsiveValue(node.styles.flexGrow, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("flexGrow", value)}
            />

            <TextControl
              label="Shrink"
              value={String(
                getResponsiveValue(node.styles.flexShrink, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("flexShrink", value)}
            />

            <TextControl
              label="Basis"
              value={String(
                getResponsiveValue(node.styles.flexBasis, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("flexBasis", value)}
            />

            <TextControl
              label="Order"
              value={String(
                getResponsiveValue(node.styles.order, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("order", value)}
            />
          </div>

          <SelectControl
            label="Align Self"
            value={String(
              getResponsiveValue(node.styles.alignSelf, device) || "auto",
            )}
            options={[
              "auto",
              "flex-start",
              "center",
              "flex-end",
              "stretch",
              "baseline",
            ].map((value) => ({
              label: value,
              value,
            }))}
            onChange={(value) => updateResponsiveStyle("alignSelf", value)}
          />
          <SelectControl
            label="Size"
            value={
              Number(getResponsiveValue(node.styles.flexGrow, device)) > 0
                ? "grow"
                : Number(getResponsiveValue(node.styles.flexShrink, device)) > 0
                  ? "shrink"
                  : "default"
            }
            options={[
              { label: "Default", value: "default" },
              { label: "Grow", value: "grow" },
              { label: "Shrink", value: "shrink" },
              { label: "Grow and Shrink", value: "both" },
            ]}
            onChange={(value) => {
              updateResponsiveStyles([
                ["flexGrow", value === "grow" || value === "both" ? "1" : "0"],
                ["flexShrink", value === "shrink" || value === "both" ? "1" : "0"],
              ]);
            }}
          />
        </ControlGroup>

        {node.type === "grid" && (
          <ControlGroup title="Grid Settings">
            <TextControl
              label="Grid Columns"
              value={String(
                getResponsiveValue(node.styles.gridTemplateColumns, device) ||
                  "repeat(3, 1fr)",
              )}
              onChange={(value) =>
                updateResponsiveStyle("gridTemplateColumns", value)
              }
            />

            <TextControl
              label="Grid Rows"
              value={String(
                getResponsiveValue(node.styles.gridTemplateRows, device) ||
                  "auto",
              )}
              onChange={(value) =>
                updateResponsiveStyle("gridTemplateRows", value)
              }
            />

            <SelectControl
              label="Grid Auto Flow"
              value={String(
                getResponsiveValue(node.styles.gridAutoFlow, device) || "row",
              )}
              options={["row", "column", "row dense", "column dense"].map(
                (value) => ({
                  label: value,
                  value,
                }),
              )}
              onChange={(value) => updateResponsiveStyle("gridAutoFlow", value)}
            />
          </ControlGroup>
        )}

        <ControlGroup title="Content Width">
          <SelectControl
            label="Width Mode"
            value={String(node.props.contentWidth || "boxed")}
            options={[
              { label: "Boxed", value: "boxed" },
              { label: "Full Width", value: "full" },
              { label: "Custom", value: "custom" },
            ]}
            onChange={(value) => updateResponsiveProp("contentWidth", value)}
          />

          <UnitControl
            label="Container Width"
            value={String(
              node.props.containerWidth || settings.containerWidth || "1200px",
            )}
            onChange={(value) => updateResponsiveProp("containerWidth", value)}
          />

          <SelectControl
            label="Overflow"
            value={String(node.styles.overflow || "visible")}
            options={["visible", "hidden", "auto", "scroll"].map((value) => ({
              label: value,
              value,
            }))}
            onChange={(value) => updateSimpleStyle("overflow", value)}
          />
        </ControlGroup>
      </>
    );
  };

  const renderStylePanel = () => {
    if (!selectedNode) return null;

    const node = selectedNode;
    const background =
      backgroundState === "hover"
        ? node.styles.backgroundHover || {}
        : node.styles.background || {};
    const border =
      borderState === "hover"
        ? node.styles.borderHover || {}
        : node.styles.border || {};
    const updateCurrentBackground = (
      key: keyof BuilderBackground,
      value: unknown,
    ) => {
      if (key === "color") {
        const currentColor =
          typeof background.color === "string"
            ? { desktop: background.color }
            : background.color || {};
        updateBackground(
          key,
          { ...currentColor, [device]: value },
          backgroundState === "hover",
        );
        return;
      }

      updateBackground(key, value, backgroundState === "hover");
    };

    const gradient = background.gradient || {};
    const currentTextColor = getResponsiveScalar(
      textColorState === "hover" ? node.styles.colorHover : node.styles.color,
      device,
    );
    const menuStyles = node.props.menuItemStyles && typeof node.props.menuItemStyles === "object"
      ? node.props.menuItemStyles as Record<string, Record<string, Record<string, string>>>
      : {};
    const rawMenuDevice = menuStyles[device] || {};
    const desktopMenuDevice = menuStyles.desktop || {};
    const menuDevice = Object.fromEntries(
      (["normal", "hover", "active"] as const).map((state) => [
        state,
        {
          ...(desktopMenuDevice[state] || {}),
          ...(rawMenuDevice[state] || {}),
        },
      ]),
    ) as Record<string, Record<string, string>>;
    const activeMenuItemStyle = menuDevice[menuItemState] || {};
    const updateMenuItemStyle = (key: "color" | "backgroundColor", value: string) => {
      const next = {
        ...menuStyles,
        [device]: {
          ...rawMenuDevice,
          [menuItemState]: {
            ...(rawMenuDevice[menuItemState] || {}),
            [key]: value,
          },
        },
      };
      updateProps("menuItemStyles", next);
    };

    if (isImageNode) {
      const currentOpacity =
        imageOpacityState === "hover"
          ? node.styles.opacityHover
          : node.styles.opacity;

      return (
        <>
          <ControlGroup title="Image" defaultOpen>
            <SegmentedControl
              label="Alignment"
              value={String(node.props.alignment || "left")}
              options={[
                { label: "Left", value: "left" },
                { label: "Center", value: "center" },
                { label: "Right", value: "right" },
              ]}
              onChange={(value) => updateResponsiveProp("alignment", value)}
            />
            <UnitControl
              label="Width"
              value={String(getResponsiveValue(node.styles.width, device) || "")}
              onChange={(value) => updateResponsiveStyle("width", value)}
            />
            <UnitControl
              label="Max Width"
              value={String(getResponsiveValue(node.styles.maxWidth, device) || "")}
              onChange={(value) => updateResponsiveStyle("maxWidth", value)}
            />
            <UnitControl
              label="Height"
              value={String(getResponsiveValue(node.styles.height, device) || "")}
              onChange={(value) => updateResponsiveStyle("height", value)}
            />
            <SelectControl
              label="Object Fit"
              value={String(node.props.objectFit || "cover")}
              options={["cover", "contain", "fill", "none"].map((value) => ({
                label: value,
                value,
              }))}
              onChange={(value) => updateResponsiveProp("objectFit", value)}
            />
            <SelectControl
              label="Object Position"
              value={String(node.props.objectPosition || "center center")}
              options={[
                "center center",
                "left top",
                "left center",
                "left bottom",
                "right top",
                "right center",
                "right bottom",
              ].map((value) => ({ label: value, value }))}
              onChange={(value) => updateResponsiveProp("objectPosition", value)}
            />
            <SegmentedControl
              label="Opacity State"
              value={imageOpacityState}
              options={[
                { label: "Normal", value: "normal" },
                { label: "Hover", value: "hover" },
              ]}
              onChange={(value) =>
                setImageOpacityState(value as "normal" | "hover")
              }
            />
            <Field label="Opacity">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={String(currentOpacity ?? 1)}
                onChange={(event) =>
                  updateSimpleStyle(
                    imageOpacityState === "hover" ? "opacityHover" : "opacity",
                    Number(event.target.value),
                  )
                }
                style={{ width: "100%" }}
              />
            </Field>
          </ControlGroup>
          <ControlGroup title="CSS Filters" defaultOpen={false}>
            {(
              [
                "blur",
                "brightness",
                "contrast",
                "saturation",
                "hue",
                "grayscale",
                "sepia",
                "invert",
              ] as const
            ).map((filter) => (
              <TextControl
                key={filter}
                label={filter}
                value={String(node.styles.filters?.[filter] ?? "")}
                onChange={(value) => {
                  const currentFilters = node.styles.filters || {};

                  updateSimpleStyle("filters", {
                    ...currentFilters,
                    [filter]: value === "" ? undefined : Number(value),
                  });
                }}
                type="number"
              />
            ))}
          </ControlGroup>
        </>
      );
    }

    return (
      <>
        {node.type === "menu" ? (
          <ControlGroup title="Navigation Menu Item Colors" defaultOpen>
            <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 8px" }}>Choose Desktop, Tablet or Mobile from the builder toolbar, then set each menu item state.</p>
            <SegmentedControl
              label="Item State"
              value={menuItemState}
              options={[{ label: "Normal", value: "normal" }, { label: "Hover", value: "hover" }, { label: "Active", value: "active" }]}
              onChange={(value) => setMenuItemState(value as "normal" | "hover" | "active")}
            />
            <Field label={`${device[0].toUpperCase()}${device.slice(1)} Text Color — ${menuItemState}`}>
              <input type="color" value={/^#[\da-f]{6}$/i.test(activeMenuItemStyle.color || "") ? activeMenuItemStyle.color : "#1f2937"} onChange={(event) => updateMenuItemStyle("color", event.target.value)} style={{ ...CONTROL_STYLE, height: 38, padding: 3 }} />
            </Field>
            <Field label={`${device[0].toUpperCase()}${device.slice(1)} Background Color — ${menuItemState}`}>
              <input type="color" value={/^#[\da-f]{6}$/i.test(activeMenuItemStyle.backgroundColor || "") ? activeMenuItemStyle.backgroundColor : "#ffffff"} onChange={(event) => updateMenuItemStyle("backgroundColor", event.target.value)} style={{ ...CONTROL_STYLE, height: 38, padding: 3 }} />
            </Field>
            <Field label="Mobile Menu Panel Background">
              <input type="color" value={String(node.props.mobilePanelBackground || "#ffffff")} onChange={(event) => updateResponsiveProp("mobilePanelBackground", event.target.value)} style={{ ...CONTROL_STYLE, height: 38, padding: 3 }} />
            </Field>
            <Field label="Mobile Menu Panel Text Color">
              <input type="color" value={String(node.props.mobilePanelColor || "#1f2937")} onChange={(event) => updateResponsiveProp("mobilePanelColor", event.target.value)} style={{ ...CONTROL_STYLE, height: 38, padding: 3 }} />
            </Field>
            <Field label="Mobile Toggle Icon Color">
              <input type="color" value={String(node.props.iconColor || "#0c2f55")} onChange={(event) => updateResponsiveProp("iconColor", event.target.value)} style={{ ...CONTROL_STYLE, height: 38, padding: 3 }} />
            </Field>
          </ControlGroup>
        ) : null}
        {(node.type === "icon" || node.type === "icon-box" || node.type === "icon-list" || node.type === "social-icons") ? (
          <ControlGroup title="Icon Styling" defaultOpen>
            <TextControl label="Icon Color" value={String(node.props.iconColor || "#3984e8")} onChange={(value) => updateResponsiveProp("iconColor", value)} />
            <TextControl label="Icon Size" type="number" value={String(node.props.iconSize || node.props.size || 24)} onChange={(value) => updateResponsiveProp(node.type === "icon" ? "size" : "iconSize", Number(value))} />
            {node.type === "social-icons" ? <><TextControl label="Icon Background" value={String(node.props.iconBackground || "#0c2f55")} onChange={(value) => updateResponsiveProp("iconBackground", value)} /><TextControl label="Button Size" type="number" value={String(node.props.buttonSize || 40)} onChange={(value) => updateResponsiveProp("buttonSize", Number(value))} /></> : null}
          </ControlGroup>
        ) : null}
        {(node.type === "tabs" || node.type === "post-tabs") ? (
          <ControlGroup title="Tabs Styling" defaultOpen>
            <TextControl label="Normal Text Color" value={String(node.props.tabNormalColor || "#334155")} onChange={(value) => updateResponsiveProp("tabNormalColor", value)} />
            <TextControl label="Normal Background" value={String(node.props.tabNormalBackground || "#f1f5f9")} onChange={(value) => updateResponsiveProp("tabNormalBackground", value)} />
            <TextControl label="Hover Text Color" value={String(node.props.tabHoverColor || "#0c2f55")} onChange={(value) => updateResponsiveProp("tabHoverColor", value)} />
            <TextControl label="Hover Background" value={String(node.props.tabHoverBackground || "#e2e8f0")} onChange={(value) => updateResponsiveProp("tabHoverBackground", value)} />
            <TextControl label="Active Text Color" value={String(node.props.tabActiveColor || "#ffffff")} onChange={(value) => updateResponsiveProp("tabActiveColor", value)} />
            <TextControl label="Active Background" value={String(node.props.tabActiveBackground || "#0c2f55")} onChange={(value) => updateResponsiveProp("tabActiveBackground", value)} />
          </ControlGroup>
        ) : null}
        {(node.type === "posts" || node.type === "loop-grid" || node.type === "loop-carousel" || node.type === "post-tabs") ? (
          <ControlGroup title="Post Cards Styling" defaultOpen>
            <TextControl
              label="Columns on this device"
              type="number"
              value={String(node.props.columns || (node.type === "post-tabs" ? 2 : 3))}
              onChange={(value) => updateResponsiveProp("columns", Math.max(1, Math.min(6, Number(value) || 1)))}
            />
            <TextControl label="Card Background" value={String(node.props.cardBackground || "#ffffff")} onChange={(value) => updateResponsiveProp("cardBackground", value)} />
            <TextControl label="Card Border Color" value={String(node.props.cardBorderColor || "#e2e8f0")} onChange={(value) => updateResponsiveProp("cardBorderColor", value)} />
            <UnitControl label="Card Border Radius" value={String(node.props.cardRadius || "8px")} onChange={(value) => updateResponsiveProp("cardRadius", value)} />
            <UnitControl label="Grid / Card Gap" value={String(node.props.gap || "18px")} onChange={(value) => updateResponsiveProp("gap", value)} />
            <UnitControl label="Image Height" value={String(node.props.imageHeight || "180px")} onChange={(value) => updateResponsiveProp("imageHeight", value)} />
          </ControlGroup>
        ) : null}
        {node.type === "price-table" ? (
          <ControlGroup title="Pricing Card Styling" defaultOpen>
            <TextControl label="Card Background" value={String(node.props.cardBackground || "#ffffff")} onChange={(value) => updateResponsiveProp("cardBackground", value)} />
            <TextControl label="Card Border" value={String(node.props.cardBorderColor || "#dbe3ed")} onChange={(value) => updateResponsiveProp("cardBorderColor", value)} />
            <TextControl label="Title Color" value={String(node.props.titleColor || "#0c2f55")} onChange={(value) => updateResponsiveProp("titleColor", value)} />
            <TextControl label="Price Color" value={String(node.props.priceColor || "#3984e8")} onChange={(value) => updateResponsiveProp("priceColor", value)} />
            <TextControl label="Button Background" value={String(node.props.buttonBackground || "#0c2f55")} onChange={(value) => updateResponsiveProp("buttonBackground", value)} />
            <TextControl label="Button Text Color" value={String(node.props.buttonColor || "#ffffff")} onChange={(value) => updateResponsiveProp("buttonColor", value)} />
          </ControlGroup>
        ) : null}
        {node.type === "accordion" ? (
          <ControlGroup title="Accordion Styling" defaultOpen>
            <TextControl label="Title Text Color" value={String(node.props.titleColor || "#0c2f55")} onChange={(value) => updateResponsiveProp("titleColor", value)} />
            <TextControl label="Title Background" value={String(node.props.titleBackground || "#f8fafc")} onChange={(value) => updateResponsiveProp("titleBackground", value)} />
            <TextControl label="Content Text Color" value={String(node.props.contentColor || "#334155")} onChange={(value) => updateResponsiveProp("contentColor", value)} />
            <TextControl label="Content Background" value={String(node.props.contentBackground || "#ffffff")} onChange={(value) => updateResponsiveProp("contentBackground", value)} />
            <TextControl label="Divider Color" value={String(node.props.dividerColor || "#e2e8f0")} onChange={(value) => updateResponsiveProp("dividerColor", value)} />
          </ControlGroup>
        ) : null}
        {node.type === "countdown" ? (
          <ControlGroup title="Countdown Styling" defaultOpen>
            <TextControl label="Number Color" value={String(node.props.numberColor || "#ffffff")} onChange={(value) => updateResponsiveProp("numberColor", value)} />
            <TextControl label="Label Color" value={String(node.props.labelColor || "#ffffff")} onChange={(value) => updateResponsiveProp("labelColor", value)} />
            <TextControl label="Box Background" value={String(node.props.boxBackground || "#0c2f55")} onChange={(value) => updateResponsiveProp("boxBackground", value)} />
            <UnitControl label="Box Radius" value={String(node.props.boxRadius || "8px")} onChange={(value) => updateResponsiveProp("boxRadius", value)} />
          </ControlGroup>
        ) : null}
        <ControlGroup title="Text Color" defaultOpen>
          <SegmentedControl
            label="State"
            value={textColorState}
            options={[
              { label: "Normal", value: "normal" },
              { label: "Hover", value: "hover" },
            ]}
            onChange={(value) => setTextColorState(value as "normal" | "hover")}
          />
          <Field label="Text Color">
            <input
              type="color"
              value={
                typeof currentTextColor === "string" &&
                /^#[\da-f]{6}$/i.test(currentTextColor)
                  ? currentTextColor
                  : "#334155"
              }
              onChange={(event) =>
                updateResponsiveStyle(
                  textColorState === "hover" ? "colorHover" : "color",
                  event.target.value,
                )
              }
            />
          </Field>
        </ControlGroup>

        <ControlGroup title="Background">
          <SegmentedControl
            label="State"
            value={backgroundState}
            options={[
              { label: "Normal", value: "normal" },
              { label: "Hover", value: "hover" },
            ]}
            onChange={(value) => setBackgroundState(value as "normal" | "hover")}
          />
          <SelectControl
            label="Background Type"
            value={String(background.type || "classic")}
            options={[
              { label: "Classic", value: "classic" },
              { label: "Gradient", value: "gradient" },
              { label: "Image", value: "image" },
              { label: "Video", value: "video" },
            ]}
            onChange={(value) =>
              updateCurrentBackground("type", value as BuilderBackground["type"])
            }
          />

          <Field label="Background Color">
            <input
              type="color"
              value={
                getResponsiveScalar(background.color, device) &&
                getResponsiveScalar(background.color, device) !== "transparent"
                  ? String(getResponsiveScalar(background.color, device))
                  : "#ffffff"
              }
              onChange={(event) =>
                updateCurrentBackground("color", event.target.value)
              }
              style={{
                ...CONTROL_STYLE,
                height: 38,
                padding: 3,
              }}
            />
          </Field>

          {background.type === "gradient" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Color 1">
                  <input
                    type="color"
                    value={gradient.color1 || "#3984e8"}
                    onChange={(event) =>
                      updateCurrentBackground("gradient", {
                        ...gradient,
                        color1: event.target.value,
                      })
                    }
                  />
                </Field>

                <Field label="Color 2">
                  <input
                    type="color"
                    value={gradient.color2 || "#0c2f55"}
                    onChange={(event) =>
                      updateCurrentBackground("gradient", {
                        ...gradient,
                        color2: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>

              <SelectControl
                label="Gradient Type"
                value={String(gradient.type || "linear")}
                options={[
                  { label: "Linear", value: "linear" },
                  { label: "Radial", value: "radial" },
                ]}
                onChange={(value) =>
                  updateCurrentBackground("gradient", {
                    ...gradient,
                    type: value as "linear" | "radial",
                  })
                }
              />

              <TextControl
                label="Angle"
                type="number"
                value={String(gradient.angle ?? 135)}
                onChange={(value) =>
                  updateCurrentBackground("gradient", {
                    ...gradient,
                    angle: Number(value),
                  })
                }
              />
            </>
          )}

          {background.type === "image" && (
            <>
              <button
                type="button"
                style={{
                  ...BUTTON_STYLE,
                  width: "100%",
                  marginBottom: 12,
                }}
                onClick={() => void openMediaLibrary(backgroundState === "hover" ? "hoverBackground" : "background")}
              >
                <ImageIcon size={15} />
                Choose Background Image
              </button>
              <button
                type="button"
                style={{
                  ...BUTTON_STYLE,
                  width: "100%",
                  marginBottom: 12,
                }}
                onClick={() => openImageUpload(backgroundState === "hover" ? "hoverBackground" : "background")}
              >
                <Upload size={15} />
                Upload Background Image
              </button>

              {background.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={safeMediaUrl(background.image)}
                  alt={background.imageAlt || ""}
                  style={{
                    display: "block",
                    width: "100%",
                    maxHeight: 140,
                    objectFit: "contain",
                    marginBottom: 12,
                    border: "1px solid #e2e8f0",
                  }}
                />
              ) : null}
              {background.image ? (
                <button
                  type="button"
                  style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 12, color: "#b42318" }}
                  onClick={() => clearBackgroundMedia(backgroundState === "hover", "image", "imageId")}
                >
                  <X size={15} /> Remove Background Image
                </button>
              ) : null}

              <Field label="Overlay Image">
                {background.overlayImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={safeMediaUrl(background.overlayImage)}
                    alt=""
                    style={{ display: "block", width: "100%", maxHeight: 100, objectFit: "contain", marginBottom: 8 }}
                  />
                ) : null}
                <button
                  type="button"
                  style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 6 }}
                  onClick={() => void openMediaLibrary(backgroundState === "hover" ? "hoverBackgroundOverlay" : "backgroundOverlay")}
                >
                  <ImageIcon size={15} /> Choose Overlay Image
                </button>
                <button
                  type="button"
                  style={{ ...BUTTON_STYLE, width: "100%" }}
                  onClick={() => openImageUpload(backgroundState === "hover" ? "hoverBackgroundOverlay" : "backgroundOverlay")}
                >
                  <Upload size={15} /> Upload Overlay Image
                </button>
                {background.overlayImage ? (
                  <button
                    type="button"
                    style={{ ...BUTTON_STYLE, width: "100%", marginTop: 6, color: "#b42318" }}
                    onClick={() => clearBackgroundMedia(backgroundState === "hover", "overlayImage", "overlayImageId")}
                  >
                    <X size={15} /> Remove Overlay Image
                  </button>
                ) : null}
              </Field>
              <SelectControl
                label="Image Resolution"
                value={String(background.resolution || "full")}
                options={["thumbnail", "medium", "large", "full"].map((value) => ({
                  label: value[0].toUpperCase() + value.slice(1),
                  value,
                }))}
                onChange={(value) => updateCurrentBackground("resolution", value)}
              />

              <SelectControl
                label="Position"
                value={String(background.position || "center center")}
                options={[
                  "left top",
                  "left center",
                  "left bottom",
                  "center top",
                  "center center",
                  "center bottom",
                  "right top",
                  "right center",
                  "right bottom",
                ].map((value) => ({
                  label: value,
                  value,
                }))}
                onChange={(value) => updateCurrentBackground("position", value)}
              />

              <SelectControl
                label="Display Size"
                value={String(background.size || "cover")}
                options={["cover", "contain", "auto", "100% 100%"].map(
                  (value) => ({
                    label: value,
                    value,
                  }),
                )}
                onChange={(value) => updateCurrentBackground("size", value)}
              />

              <SelectControl
                label="Repeat"
                value={String(background.repeat || "no-repeat")}
                options={["no-repeat", "repeat", "repeat-x", "repeat-y"].map(
                  (value) => ({
                    label: value,
                    value,
                  }),
                )}
                onChange={(value) => updateCurrentBackground("repeat", value)}
              />

              <SelectControl
                label="Attachment"
                value={String(background.attachment || "scroll")}
                options={["scroll", "fixed", "local"].map((value) => ({
                  label: value,
                  value,
                }))}
                onChange={(value) => updateCurrentBackground("attachment", value)}
              />

            </>
          )}

          {background.type === "video" ? (
            <div>
              <TextControl
                label="Background Video URL"
                value={String(background.videoUrl || "")}
                onChange={(value) => updateCurrentBackground("videoUrl", value)}
                placeholder="https://..."
              />
              {background.videoUrl ? (
                <button
                  type="button"
                  style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 10, color: "#b42318" }}
                  onClick={() => clearBackgroundMedia(backgroundState === "hover", "videoUrl")}
                >
                  <X size={15} /> Remove Background Video
                </button>
              ) : null}
            </div>
          ) : null}
        </ControlGroup>

        <ControlGroup title="Typography">
          <TextControl
            label="Google Font Family"
            value={String(node.styles.typography?.fontFamily || "")}
            onChange={(value) => updateTypography("fontFamily", value)}
            placeholder="Choose or enter a Google Font"
            list="builder-google-fonts"
          />

          <UnitControl
            label="Font Size"
            value={String(
              getResponsiveValue(node.styles.typography?.fontSize, device) ||
                "",
            )}
            onChange={(value) => updateTypography("fontSize", value, true)}
          />

          <SelectControl
            label="Font Weight"
            value={String(node.styles.typography?.fontWeight || "400")}
            options={[
              "100",
              "200",
              "300",
              "400",
              "500",
              "600",
              "700",
              "800",
              "900",
            ].map((value) => ({
              label: value,
              value,
            }))}
            onChange={(value) => updateTypography("fontWeight", value)}
          />

          <TextControl
            label="Line Height"
            value={String(node.styles.typography?.lineHeight || "")}
            onChange={(value) => updateTypography("lineHeight", value)}
          />

          <TextControl
            label="Letter Spacing"
            value={String(node.styles.typography?.letterSpacing || "")}
            onChange={(value) => updateTypography("letterSpacing", value)}
          />

          <TextControl
            label="Word Spacing"
            value={String(node.styles.typography?.wordSpacing || "")}
            onChange={(value) => updateTypography("wordSpacing", value)}
          />

          <SelectControl
            label="Transform"
            value={String(node.styles.typography?.textTransform || "none")}
            options={["none", "uppercase", "lowercase", "capitalize"].map(
              (value) => ({
                label: value,
                value,
              }),
            )}
            onChange={(value) => updateTypography("textTransform", value)}
          />

          <SelectControl
            label="Font Style"
            value={String(node.styles.typography?.fontStyle || "normal")}
            options={["normal", "italic", "oblique"].map((value) => ({
              label: value,
              value,
            }))}
            onChange={(value) => updateTypography("fontStyle", value)}
          />

          <SelectControl
            label="Decoration"
            value={String(node.styles.typography?.textDecoration || "none")}
            options={["none", "underline", "overline", "line-through"].map(
              (value) => ({
                label: value,
                value,
              }),
            )}
            onChange={(value) => updateTypography("textDecoration", value)}
          />

          <SegmentedControl
            label="Text Alignment"
            value={String(
              getResponsiveValue(node.styles.typography?.textAlign, device) ||
                "left",
            )}
            options={[
              { label: "Left", value: "left" },
              { label: "Center", value: "center" },
              { label: "Right", value: "right" },
              { label: "Justify", value: "justify" },
            ]}
            onChange={(value) => updateTypography("textAlign", value, true)}
          />

          <TextControl
            label="Text Shadow CSS"
            value={String(node.styles.typography?.textShadow || "")}
            onChange={(value) => updateTypography("textShadow", value)}
            placeholder="0 2px 4px rgba(0,0,0,.2)"
          />
          <TextControl
            label="Text Stroke CSS"
            value={String(node.styles.typography?.textStroke || "")}
            onChange={(value) => updateTypography("textStroke", value)}
            placeholder="1px #000000"
          />
          <SelectControl
            label="Blend Mode"
            value={String(node.styles.blendMode || "normal")}
            options={[
              "normal",
              "multiply",
              "screen",
              "overlay",
              "darken",
              "lighten",
              "color-dodge",
              "color-burn",
              "difference",
              "exclusion",
              "hue",
              "saturation",
              "color",
              "luminosity",
            ].map((value) => ({ label: value, value }))}
            onChange={(value) => updateSimpleStyle("blendMode", value)}
          />
        </ControlGroup>

        <ControlGroup title="Border & Shadow">
          <SegmentedControl
            label="State"
            value={borderState}
            options={[
              { label: "Normal", value: "normal" },
              { label: "Hover", value: "hover" },
            ]}
            onChange={(value) => setBorderState(value as "normal" | "hover")}
          />
          <SelectControl
            label="Border Type"
            value={String(border.style || "none")}
            options={["none", "solid", "dashed", "dotted", "double"].map(
              (value) => ({
                label: value,
                value,
              }),
            )}
            onChange={(value) =>
              updateBorder("style", value as BuilderBorder["style"], borderState === "hover")
            }
          />

          <TextControl
            label="Border Width"
            value={String(border.width || "1px")}
            onChange={(value) => updateBorder("width", value, borderState === "hover")}
          />

          <Field label="Border Color">
            <input
              type="color"
              value={getResponsiveScalar(border.color, device) || "#dbe3ed"}
              onChange={(event) => {
                const currentColor =
                  typeof border.color === "string"
                    ? { desktop: border.color }
                    : border.color || {};
                updateBorder(
                  "color",
                  { ...currentColor, [device]: event.target.value },
                  borderState === "hover",
                );
              }}
            />
          </Field>

          <UnitControl
            label="Border Radius"
            value={String(
              getResponsiveValue(border.radius, device) || "",
            )}
            onChange={(value) =>
              updateBorder("radius", {
                ...(border.radius || {}),
                [device]: value,
              }, borderState === "hover")
            }
          />

          <TextControl
            label="Box Shadow"
            value={String(borderState === "hover" ? node.styles.boxShadowHover || "" : node.styles.boxShadow || "")}
            onChange={(value) =>
              updateSimpleStyle(borderState === "hover" ? "boxShadowHover" : "boxShadow", value)
            }
            placeholder="0 4px 12px rgba(0,0,0,.12)"
          />

        </ControlGroup>
      </>
    );
  };

  const renderAdvancedPanel = () => {
    if (!selectedNode) return null;

    const node = selectedNode;
    const transform =
      transformState === "hover"
        ? node.styles.transformSettingsHover || {}
        : node.styles.transformSettings || {};
    const currentOrder = String(getResponsiveValue(node.styles.order, device) || "");
    const updateTransform = (key: keyof NonNullable<BuilderStyle["transformSettings"]>, value: unknown) =>
      updateSimpleStyle(
        transformState === "hover" ? "transformSettingsHover" : "transformSettings",
        {
          ...transform,
          [key]: value,
        },
      );
    const updateFlexSize = (value: string) => {
      if (!selectedId) return;

      commitRoot(
        updateTree(layout.root, selectedId, (currentNode) => ({
          ...currentNode,
          styles: {
            ...currentNode.styles,
            flexGrow: {
              ...(currentNode.styles.flexGrow || {}),
              [device]: value === "grow" ? "1" : "0",
            },
            flexShrink: {
              ...(currentNode.styles.flexShrink || {}),
              [device]: value === "shrink" ? "1" : "0",
            },
          },
        })),
      );
    };

    return (
      <>
        <ControlGroup title="Layout" defaultOpen>
          <SpacingControl
            label="Margin"
            value={selectedMargin}
            onChange={(value) => updateSpacing("margin", value)}
          />
          <SpacingControl
            label="Padding"
            value={selectedPadding}
            onChange={(value) => updateSpacing("padding", value)}
          />
          <SelectControl
            label="Width"
            value={getWidthMode(node.advanced?.widthMode, device)}
            options={[
              { label: "Default", value: "default" },
              { label: "Inline (Auto)", value: "inline" },
              { label: "Full Width", value: "full" },
              { label: "Custom", value: "custom" },
            ]}
            onChange={(value) =>
              updateResponsiveAdvancedWidthMode(
                value as "default" | "inline" | "full" | "custom",
              )
            }
          />
          {getWidthMode(node.advanced?.widthMode, device) === "custom" ? (
            <UnitControl
              label="Custom Width"
              value={String(getResponsiveValue(node.styles.width, device) || "")}
              onChange={(value) => updateResponsiveStyle("width", value)}
              placeholder="240px"
            />
          ) : null}
          <SelectControl
            label="Align Self"
            value={String(getResponsiveValue(node.styles.alignSelf, device) || "auto")}
            options={["auto", "flex-start", "center", "flex-end", "stretch", "baseline"].map((value) => ({
              label: value,
              value,
            }))}
            onChange={(value) => updateResponsiveStyle("alignSelf", value)}
          />
          <SelectControl
            label="Order"
            value={currentOrder === "-1" || currentOrder === "1" ? currentOrder : currentOrder ? "custom" : "default"}
            options={[
              { label: "Default", value: "default" },
              { label: "Start", value: "-1" },
              { label: "End", value: "1" },
              { label: "Custom", value: "custom" },
            ]}
            onChange={(value) => {
              updateResponsiveStyle("order", value === "custom" ? (currentOrder || "2") : value === "default" ? "" : value);
            }}
          />
          <SelectControl
            label="Size"
            value={
              Number(getResponsiveValue(node.styles.flexGrow, device)) > 0
                ? "grow"
                : Number(getResponsiveValue(node.styles.flexShrink, device)) > 0
                  ? "shrink"
                  : "default"
            }
            options={[
              { label: "Default", value: "default" },
              { label: "Grow", value: "grow" },
              { label: "Shrink", value: "shrink" },
            ]}
            onChange={updateFlexSize}
          />
          {currentOrder && currentOrder !== "-1" && currentOrder !== "1" ? (
            <TextControl
              label="Custom Order Value"
              type="number"
              value={currentOrder}
              onChange={(value) => updateResponsiveStyle("order", value)}
            />
          ) : null}
        </ControlGroup>

        <ControlGroup title="Positioning">
          <SelectControl
            label="Position"
            value={String(node.styles.position || "default")}
            options={[
              "default",
              "static",
              "relative",
              "absolute",
              "fixed",
              "sticky",
            ].map((value) => ({
              label: value,
              value,
            }))}
            onChange={(value) =>
              updateSimpleStyle("position", value as BuilderStyle["position"])
            }
          />

          <TextControl
            label="Z-Index"
            type="number"
            value={String(node.styles.zIndex ?? "")}
            onChange={(value) =>
              updateSimpleStyle(
                "zIndex",
                value === "" ? undefined : Number(value),
              )
            }
          />
        </ControlGroup>

        <ControlGroup title="Transform">
          <SegmentedControl
            label="State"
            value={transformState}
            options={[
              { label: "Normal", value: "normal" },
              { label: "Hover", value: "hover" },
            ]}
            onChange={(value) => setTransformState(value as "normal" | "hover")}
          />
          {(
            [
              ["rotateZ", "Rotate"],
              ["scaleX", "Scale X"],
              ["scaleY", "Scale Y"],
              ["skewX", "Skew X"],
              ["skewY", "Skew Y"],
            ] as const
          ).map(([key, label]) => (
            <TextControl
              key={key}
              label={label}
              type="number"
              value={String(transform[key] ?? "")}
              onChange={(value) => updateTransform(key, value === "" ? undefined : Number(value))}
            />
          ))}

          <TextControl
            label="Offset X"
            value={String(transform.translateX || "")}
            onChange={(value) => updateTransform("translateX", value)}
            placeholder="0px"
          />

          <TextControl
            label="Offset Y"
            value={String(transform.translateY || "")}
            onChange={(value) => updateTransform("translateY", value)}
            placeholder="0px"
          />

          <SegmentedControl
            label="Flip Horizontal"
            value={Number(transform.scaleX) === -1 ? "on" : "off"}
            options={[{ label: "Off", value: "off" }, { label: "On", value: "on" }]}
            onChange={(value) => updateTransform("scaleX", value === "on" ? -1 : 1)}
          />
          <SegmentedControl
            label="Flip Vertical"
            value={Number(transform.scaleY) === -1 ? "on" : "off"}
            options={[{ label: "Off", value: "off" }, { label: "On", value: "on" }]}
            onChange={(value) => updateTransform("scaleY", value === "on" ? -1 : 1)}
          />
        </ControlGroup>

        <ControlGroup title="Motion Effects">
          <SelectControl
            label="Entrance Animation"
            value={String(node.styles.motion?.entranceAnimation || "none")}
            options={[
              "none",
              "fadeIn",
              "fadeInUp",
              "fadeInDown",
              "fadeInLeft",
              "fadeInRight",
              "zoomIn",
              "zoomOut",
              "slideInUp",
              "slideInDown",
              "bounce",
            ].map((value) => ({
              label: value,
              value,
            }))}
            onChange={(value) =>
              updateSimpleStyle("motion", {
                ...(node.styles.motion || {}),
                entranceAnimation: value,
              })
            }
          />

          <Field label="Scrolling Effects">
            <input
              type="checkbox"
              checked={Boolean(node.styles.motion?.scrollEffects)}
              onChange={(event) =>
                updateSimpleStyle("motion", {
                  ...(node.styles.motion || {}),
                  scrollEffects: event.target.checked,
                })
              }
            />
          </Field>
          <Field label="Mouse Effects">
            <input
              type="checkbox"
              checked={Boolean(node.styles.motion?.mouseEffects)}
              onChange={(event) =>
                updateSimpleStyle("motion", {
                  ...(node.styles.motion || {}),
                  mouseEffects: event.target.checked,
                })
              }
            />
          </Field>

          <SelectControl
            label="Sticky"
            value={
              node.styles.motion?.sticky
                ? node.styles.motion.stickyPosition || "top"
                : "none"
            }
            options={[
              { label: "None", value: "none" },
              { label: "Top", value: "top" },
              { label: "Bottom", value: "bottom" },
            ]}
            onChange={(value) =>
              updateSimpleStyle("motion", {
                ...(node.styles.motion || {}),
                sticky: value !== "none",
                stickyPosition:
                  value === "top" || value === "bottom" ? value : undefined,
              })
            }
          />
        </ControlGroup>

        <ControlGroup title="Display Conditions">
          <SelectControl
            label="Visibility"
            value={String(node.advanced?.displayCondition || "always")}
            options={[
              { label: "Always Show", value: "always" },
              { label: "Always Hide", value: "hidden" },
            ]}
            onChange={(value) => updateAdvanced("displayCondition", value)}
          />
        </ControlGroup>

        <ControlGroup title="Cache Settings">
          <Field label="Enable Element Cache">
            <input
              type="checkbox"
              checked={node.advanced?.cacheEnabled !== false}
              onChange={(event) => updateAdvanced("cacheEnabled", event.target.checked)}
            />
          </Field>
          <TextControl
            label="Cache Duration (seconds)"
            type="number"
            value={String(node.advanced?.cacheDuration ?? 300)}
            onChange={(value) => updateAdvanced("cacheDuration", Math.max(0, Number(value)))}
          />
        </ControlGroup>

        <ControlGroup title="Responsive">
          {(
            [
              ["hideOnDesktop", "Hide on Desktop"],
              ["hideOnTablet", "Hide on Tablet"],
              ["hideOnMobile", "Hide on Mobile"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="checkbox"
                checked={Boolean(node.advanced?.[key])}
                onChange={(event) => updateAdvanced(key, event.target.checked)}
              />
            </Field>
          ))}
        </ControlGroup>

        <ControlGroup title="Mask">
          <Field label="Enable Mask">
            <input
              type="checkbox"
              checked={Boolean(node.styles.mask?.enabled)}
              onChange={(event) =>
                updateSimpleStyle("mask", {
                  ...(node.styles.mask || {}),
                  enabled: event.target.checked,
                })
              }
            />
          </Field>
          {node.styles.mask?.enabled ? (
            <>
              <SelectControl
                label="Shape"
                value={String(node.styles.mask.shape || "circle")}
                options={[
                  "circle",
                  "ellipse",
                  "rounded",
                  "triangle",
                  "triangle-down",
                  "diamond",
                  "pentagon",
                  "hexagon",
                  "heptagon",
                  "octagon",
                  "parallelogram",
                  "trapezoid",
                  "cross",
                  "heart",
                  "chevron",
                  "arrow",
                  "star",
                  "plus",
                ].map((value) => ({ label: value, value }))}
                onChange={(value) =>
                  updateSimpleStyle("mask", { ...node.styles.mask, shape: value })
                }
              />
              <SelectControl
                label="Size"
                value={String(node.styles.mask.size || "fit")}
                options={["fit", "cover", "contain"].map((value) => ({
                  label: value,
                  value,
                }))}
                onChange={(value) =>
                  updateSimpleStyle("mask", { ...node.styles.mask, size: value })
                }
              />
              <SelectControl
                label="Position"
                value={String(node.styles.mask.position || "center center")}
                options={["center center", "left top", "right top", "left bottom", "right bottom"].map((value) => ({
                  label: value,
                  value,
                }))}
                onChange={(value) =>
                  updateSimpleStyle("mask", { ...node.styles.mask, position: value })
                }
              />
            </>
          ) : null}
        </ControlGroup>

        <ControlGroup title="Attributes">
          <TextControl
            label="HTML ID"
            value={String(node.advanced?.cssId || "")}
            onChange={(value) => updateAdvanced("cssId", value)}
            placeholder="my-element-id"
          />

          <TextControl
            label="CSS Classes"
            value={String(node.advanced?.cssClasses || "")}
            onChange={(value) => updateAdvanced("cssClasses", value)}
            placeholder="class-one class-two"
          />

          <Field label="Custom Attributes (name|value, one per line)">
            <textarea
              rows={6}
              value={Object.entries(node.advanced?.attributes || {})
                .map(([name, value]) => `${name}|${value}`)
                .join("\n")}
              placeholder={"aria-label|Description\nrole|region"}
              onChange={(event) => {
                const attributes = Object.fromEntries(
                  event.target.value
                    .split("\n")
                    .map((line) => line.split("|", 2))
                    .filter(([name]) => Boolean(name?.trim()))
                    .map(([name, value]) => [name.trim(), (value || "").trim()]),
                );
                updateAdvanced("attributes", attributes);
              }}
              style={{
                ...CONTROL_STYLE,
                fontFamily: "monospace",
              }}
            />
          </Field>
        </ControlGroup>

        <ControlGroup title="Custom CSS">
          <Field label="Element CSS">
            <textarea
              rows={10}
              value={String(
                node.advanced?.customCss || node.styles.customCss || "",
              )}
              onChange={(event) =>
                updateAdvanced("customCss", event.target.value)
              }
              placeholder={"selector {\n  color: red;\n  margin: 10px;\n}"}
              style={{
                ...CONTROL_STYLE,
                fontFamily: "monospace",
                minHeight: 150,
              }}
            />
          </Field>
          <p className={styles.mutedText}>
            Custom CSS is saved with this element. It is not executed in this
            editor preview.
          </p>
        </ControlGroup>

      </>
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <Loader2 className={styles.spin} size={28} />
        Loading Builder...
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const collisions = pointerWithin(args);

        return collisions.length ? collisions : closestCenter(args);
      }}
      onDragEnd={handleDragEnd}
    >
      <main className={styles.builder}>
        <datalist id="builder-google-fonts">
          {GOOGLE_FONT_FAMILIES.map((family) => (
            <option key={family} value={family} />
          ))}
        </datalist>
        <datalist id="builder-link-targets">
          {linkSuggestions.map((suggestion) => (
            <option
              key={`${suggestion.value}-${suggestion.label}`}
              value={suggestion.value}
              label={suggestion.label}
            />
          ))}
        </datalist>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <Link href="/admin/builder" className={styles.backButton}>
              <ArrowLeft size={17} />
            </Link>

            <div className={styles.documentInfo}>
              <input
                aria-label="Document title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={styles.titleInput}
              />

              <span className={styles.documentStatus}>
                {status === "PUBLISHED" ? "Published" : "Draft"}
              </span>
            </div>
          </div>

          <div className={styles.deviceControls}>
            <button
              type="button"
              className={device === "desktop" ? styles.deviceActive : ""}
              onClick={() => setDevice("desktop")}
              title="Desktop"
            >
              <Monitor size={17} />
            </button>

            <button
              type="button"
              className={device === "tablet" ? styles.deviceActive : ""}
              onClick={() => setDevice("tablet")}
              title="Tablet"
            >
              <Tablet size={17} />
            </button>

            <button
              type="button"
              className={device === "mobile" ? styles.deviceActive : ""}
              onClick={() => setDevice("mobile")}
              title="Mobile"
            >
              <Smartphone size={17} />
            </button>
          </div>

          <div className={styles.topbarActions}>
            <button
              type="button"
              className={styles.previewButton}
              onClick={() =>
                setMessage(
                  "The canvas is displaying the current builder layout.",
                )
              }
              title="Canvas Preview"
            >
              <Eye size={16} />
              Preview
            </button>

            <button
              type="button"
              className={styles.previewButton}
              onClick={() => void loadRevisions()}
              title="Revision History"
            >
              <History size={16} />
            </button>

            <button
              type="button"
              className={styles.previewButton}
              onClick={exportDocument}
              title="Export JSON"
            >
              <Download size={16} />
            </button>

            <label
              className={styles.previewButton}
              title="Import JSON"
              style={{ cursor: "pointer" }}
            >
              <FileUp size={16} />
              <input
                type="file"
                accept=".json,application/json"
                hidden
                disabled={importing}
                onChange={importDocument}
              />
            </label>

            <button
              type="button"
              className={styles.previewButton}
              onClick={undo}
              disabled={historyIndex <= 0}
              title="Undo"
            >
              <Undo2 size={16} />
            </button>

            <button
              type="button"
              className={styles.previewButton}
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              title="Redo"
            >
              <Redo2 size={16} />
            </button>

            <button
              type="button"
              className={styles.saveButton}
              onClick={() => void saveDocument("DRAFT")}
              disabled={saving}
            >
              {saving ? (
                <Loader2 size={16} className={styles.spin} />
              ) : (
                <Save size={16} />
              )}
              Save Draft
            </button>

            <button
              type="button"
              className={styles.publishButton}
              onClick={() => void saveDocument("PUBLISHED")}
              disabled={saving}
            >
              <Upload size={16} />
              Publish
            </button>
          </div>
        </header>

        {(error || message) && (
          <div
            className={error ? styles.errorBanner : styles.messageBanner}
            role={error ? "alert" : "status"}
          >
            {error || message}
          </div>
        )}

        <div className={styles.workspace}>
          <aside className={styles.leftPanel}>
            <div className={styles.panelTabs}>
              <button
                type="button"
                className={
                  activePanel === "widgets" ? styles.panelTabActive : ""
                }
                onClick={() => setActivePanel("widgets")}
              >
                <Plus size={16} />
                Elements
              </button>

              <button
                type="button"
                className={
                  activePanel === "navigator" ? styles.panelTabActive : ""
                }
                onClick={() => setActivePanel("navigator")}
              >
                <Layers size={16} />
                Navigator
              </button>

              <button
                type="button"
                className={
                  activePanel === "settings" ? styles.panelTabActive : ""
                }
                onClick={() => setActivePanel("settings")}
              >
                <Settings2 size={16} />
                Settings
              </button>
            </div>

            {activePanel === "widgets" && (
              <div className={styles.widgetPanel}>
                <div className={styles.panelHeading}>Elements</div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    borderBottom: "1px solid #e2e8f0",
                    marginBottom: 14,
                  }}
                >
                  {(["widgets", "globals", "yoast"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setElementTab(tab)}
                      style={{
                        padding: "12px 4px",
                        border: 0,
                        borderBottom:
                          elementTab === tab
                            ? "2px solid #3984e8"
                            : "2px solid transparent",
                        background: "transparent",
                        fontWeight: elementTab === tab ? 700 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {tab === "yoast"
                        ? "SEO"
                        : tab === "globals"
                          ? "Globals"
                          : "Widgets"}
                    </button>
                  ))}
                </div>

                {elementTab === "widgets" && (
                  <>
                    <div className={styles.widgetSearch}>
                      <Search size={15} />
                      <input
                        value={widgetSearch}
                        onChange={(event) =>
                          setWidgetSearch(event.target.value)
                        }
                        placeholder="Search elements..."
                      />
                    </div>

                    {widgetGroups.map((group) => (
                      <section
                        className={styles.widgetGroup}
                        key={group.category}
                      >
                        <h3>{group.category}</h3>

                        <div className={styles.widgetGrid}>
                          {group.widgets.map((widget) => (
                            <PaletteWidget
                              key={widget.type}
                              widget={widget}
                              onAdd={() => addWidget(widget.type)}
                            />
                          ))}
                        </div>
                      </section>
                    ))}

                    {widgetGroups.length === 0 && (
                      <p className={styles.mutedText}>No elements found.</p>
                    )}
                  </>
                )}

                {elementTab === "globals" && (
                  <div className={styles.settingsPanel}>
                    <ControlGroup title="Global Colors" defaultOpen>
                      {globalStyles.colors.map((color) => (
                        <Field key={color.id} label={color.name}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "48px 1fr",
                              gap: 8,
                            }}
                          >
                            <input
                              type="color"
                              value={color.value}
                              onChange={(event) =>
                                setGlobalColor(color.id, event.target.value)
                              }
                            />

                            <input
                              value={color.value}
                              onChange={(event) =>
                                setGlobalColor(color.id, event.target.value)
                              }
                              style={CONTROL_STYLE}
                            />
                          </div>
                        </Field>
                      ))}
                    </ControlGroup>

                    <ControlGroup title="Global Typography">
                      {globalStyles.fonts.map((font) => (
                        <Field key={font.id} label={font.name}>
                          <input
                            value={font.family}
                            list="builder-google-fonts"
                            onChange={(event) =>
                              setGlobalFont(font.id, event.target.value)
                            }
                            style={CONTROL_STYLE}
                          />
                        </Field>
                      ))}
                    </ControlGroup>

                    <ControlGroup title="Theme Defaults">
                      <TextControl
                        label="Container Width"
                        value={String(settings.containerWidth || "1200px")}
                        onChange={(value) =>
                          updateSetting("containerWidth", value)
                        }
                      />

                      <TextControl
                        label="Default Widget Gap"
                        value={String(settings.defaultWidgetGap || "10px")}
                        onChange={(value) =>
                          updateSetting("defaultWidgetGap", value)
                        }
                      />

                      <TextControl
                        label="Default Section Padding"
                        value={String(settings.defaultSectionPadding || "20px")}
                        onChange={(value) =>
                          updateSetting("defaultSectionPadding", value)
                        }
                      />
                    </ControlGroup>
                  </div>
                )}

                {elementTab === "yoast" && (
                  <div className={styles.settingsPanel}>
                    <ControlGroup title="SEO" defaultOpen>
                      <TextControl
                        label="SEO Title"
                        value={String(settings.seoTitle || "")}
                        onChange={(value) => updateSetting("seoTitle", value)}
                      />

                      <Field label="Meta Description">
                        <textarea
                          rows={5}
                          value={String(settings.metaDescription || "")}
                          onChange={(event) =>
                            updateSetting("metaDescription", event.target.value)
                          }
                          style={CONTROL_STYLE}
                        />
                      </Field>

                      <TextControl
                        label="Focus Keyphrase"
                        value={String(settings.focusKeyphrase || "")}
                        onChange={(value) =>
                          updateSetting("focusKeyphrase", value)
                        }
                      />
                    </ControlGroup>
                  </div>
                )}
              </div>
            )}

            {activePanel === "navigator" && (
              <div className={styles.navigatorPanel}>
                <div className={styles.panelHeading}>Navigator / Structure</div>

                {layout.root.length === 0 ? (
                  <p className={styles.mutedText}>No elements added yet.</p>
                ) : (
                  <SortableContext
                    items={layout.root.map((node) => `navigator:${node.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {layout.root.map((node) => (
                      <NavigatorNode
                        key={node.id}
                        node={node}
                        depth={0}
                        selectedId={selectedId}
                        onSelect={(id) => {
                          const selected = findNode(layout.root, id);

                          setSelectedId(id);
                          setActivePanel("settings");
                          setInspectorTab(
                            selected && LAYOUT_TYPES.has(selected.type)
                              ? "layout"
                              : "content",
                          );
                        }}
                        onDelete={deleteNode}
                        onDuplicate={duplicateNode}
                        onToggleEnabled={toggleNodeEnabled}
                        onToggleLocked={toggleNodeLocked}
                        onRename={renameNode}
                      />
                    ))}
                  </SortableContext>
                )}
              </div>
            )}

            {activePanel === "settings" && (
              <div className={styles.settingsPanel}>
                <div className={styles.panelHeading}>
                  {selectedNode ? selectedNode.label : "Document Settings"}
                </div>

                {selectedNode ? (
                  <>
                    <div
                      style={{
                        marginBottom: 10,
                        padding: "8px 10px",
                        borderRadius: 6,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 11,
                        lineHeight: 1.5,
                      }}
                    >
                      Editing {device}. Desktop is the base; Tablet and Mobile save independent overrides.
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${inspectorTabs.length}, minmax(0, 1fr))`,
                        borderBottom: "1px solid #e2e8f0",
                        marginBottom: 14,
                      }}
                    >
                      {inspectorTabs.map((tab) => (
                        <button
                          type="button"
                          key={tab}
                          onClick={() => setInspectorTab(tab)}
                          style={{
                            padding: "12px 3px",
                            border: 0,
                            borderBottom:
                              inspectorTab === tab
                                ? "2px solid #3984e8"
                                : "2px solid transparent",
                            background: "transparent",
                            fontSize: 12,
                            fontWeight: inspectorTab === tab ? 700 : 400,
                            textTransform: "capitalize",
                            cursor: "pointer",
                          }}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {inspectorTab === "content" && renderContentPanel()}

                    {isLayoutNode &&
                      inspectorTab === "layout" &&
                      renderLayoutPanel()}

                    {inspectorTab === "style" && renderStylePanel()}

                    {inspectorTab === "advanced" && renderAdvancedPanel()}

                    <button
                      type="button"
                      className={styles.deleteSelected}
                      onClick={() => deleteNode(selectedNode.id)}
                    >
                      <Trash2 size={15} />
                      Delete Element
                    </button>
                  </>
                ) : (
                  <>
                    <ControlGroup title="Document Settings">
                      <TextControl
                        label="Document Title"
                        value={title}
                        onChange={setTitle}
                      />

                      <SelectControl
                        label="Content Width"
                        value={String(settings.contentWidth || "boxed")}
                        options={[
                          { label: "Boxed", value: "boxed" },
                          { label: "Full Width", value: "full" },
                        ]}
                        onChange={(value) =>
                          updateSetting("contentWidth", value)
                        }
                      />

                      <TextControl
                        label="Container Width"
                        value={String(settings.containerWidth || "1200px")}
                        onChange={(value) =>
                          updateSetting("containerWidth", value)
                        }
                      />
                    </ControlGroup>

                    <p className={styles.mutedText}>
                      Select a container, section or widget on the canvas to
                      edit its controls.
                    </p>
                  </>
                )}
              </div>
            )}
          </aside>

          <section className={styles.canvasArea}>
            <div className={styles.canvasTopbar}>
              <span>{KIND_LABELS[target.kind]} Editor</span>

              <span className={styles.canvasHint}>
                {device.toUpperCase()} · Drag elements to arrange your layout
              </span>
            </div>

            <div className={styles.canvasScroll}>
              <div
                className={`${styles.canvas} ${
                  device === "tablet"
                    ? styles.canvasTablet
                    : device === "mobile"
                      ? styles.canvasMobile
                      : ""
                }`}
              >
                <DropArea id="root" className={styles.canvasElements}>
                  {layout.root.length === 0 ? (
                    <div className={styles.emptyCanvas}>
                      <div className={styles.emptyCanvasIcon}>
                        <Plus size={25} />
                      </div>

                      <h2>Start building your {target.kind}</h2>

                      <p>Drag a Section, Container or widget here.</p>

                      <button
                        type="button"
                        onClick={() => {
                          setActivePanel("widgets");
                          setElementTab("widgets");
                        }}
                      >
                        Add Your First Element
                      </button>
                    </div>
                  ) : (
                    <SortableContext
                      items={layout.root.map((node) => node.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {layout.root.map((node) => (
                        <SortableCanvasNode
                          key={node.id}
                          node={node}
                          selectedId={selectedId}
                          device={device}
                          onSelect={(id) => {
                            const current = findNode(layout.root, id);

                            setSelectedId(id);
                            setActivePanel("settings");
                            setInspectorTab(
                              current && LAYOUT_TYPES.has(current.type)
                                ? "layout"
                                : "content",
                            );
                          }}
                          onDelete={deleteNode}
                          onDuplicate={duplicateNode}
                          onContextMenu={openNodeContextMenu}
                        />
                      ))}
                    </SortableContext>
                  )}
                </DropArea>
              </div>
            </div>
          </section>
        </div>

        {contextMenu ? (
          <>
            <button
              type="button"
              className={styles.contextMenuBackdrop}
              aria-label="Close element context menu"
              onClick={() => setContextMenu(null)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextMenu(null);
              }}
            />
            <div
              className={styles.contextMenu}
              role="menu"
              aria-label="Element actions"
              style={{ left: contextMenu.left, top: contextMenu.top }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setInspectorTab("content");
                  setContextMenu(null);
                }}
              >
                {["image", "featured-image", "site-logo"].includes(
                  findNode(layout.root, contextMenu.nodeId)?.type || "",
                )
                  ? "Edit Image"
                  : "Edit"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const node = findNode(layout.root, contextMenu.nodeId);
                  if (node) duplicateNode(node);
                  setContextMenu(null);
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => copyNodeToClipboard(contextMenu.nodeId)}
              >
                Copy
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!nodeClipboard}
                onClick={pasteNode}
              >
                Paste
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!nodeClipboard}
                onClick={pasteNodeStyle}
              >
                Paste Style
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => resetNodeStyle(contextMenu.nodeId)}
              >
                Reset Style
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActivePanel("navigator");
                  setContextMenu(null);
                }}
              >
                Structure
              </button>
              <div className={styles.contextMenuDivider} />
              <button
                type="button"
                role="menuitem"
                className={styles.contextMenuDelete}
                onClick={() => {
                  deleteNode(contextMenu.nodeId);
                  setContextMenu(null);
                }}
              >
                Delete
              </button>
            </div>
          </>
        ) : null}

        <MediaPickerModal
          open={imageUploadOpen}
          onClose={() => setImageUploadOpen(false)}
          onSelect={chooseMedia}
        />

        {iconPickerTarget ? (
          <IconPicker
            value={iconPickerTarget.value}
            onClose={() => setIconPickerTarget(null)}
            onSelect={(iconName) => {
              if (iconPickerTarget.kind === "button" || iconPickerTarget.kind === "widget") {
                updatePropsValues({ iconName, iconImage: "", iconImageId: "" });
              } else if (iconPickerTarget.kind === "repeaterItem" && selectedNode) {
                const entries = Array.isArray(selectedNode.props[iconPickerTarget.key]) ? [...(selectedNode.props[iconPickerTarget.key] as unknown[])] : [];
                const current = entries[iconPickerTarget.index];
                const entry = current && typeof current === "object" ? current as Record<string, unknown> : {};
                entries[iconPickerTarget.index] = { ...entry, iconName, iconImage: "", iconMediaId: "" };
                updateProps(iconPickerTarget.key, entries);
              } else if (iconPickerTarget.kind === "slideButton" && selectedNode) {
                const slides = Array.isArray(selectedNode.props.slides) ? [...selectedNode.props.slides] : [];
                const slideValue = slides[iconPickerTarget.slideIndex];
                const slide = slideValue && typeof slideValue === "object" ? slideValue as Record<string, unknown> : {};
                const buttons = Array.isArray(slide.buttons) ? [...slide.buttons] : [];
                const buttonValue = buttons[iconPickerTarget.buttonIndex];
                const button = buttonValue && typeof buttonValue === "object" ? buttonValue as Record<string, unknown> : {};
                buttons[iconPickerTarget.buttonIndex] = { ...button, iconName, iconImage: "", iconImageId: "" };
                slides[iconPickerTarget.slideIndex] = { ...slide, buttons };
                updateProps("slides", slides);
              }
              setIconPickerTarget(null);
            }}
          />
        ) : null}

        {mediaPickerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Media Library"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              background: "rgba(15,23,42,.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              style={{
                width: "min(1000px, 96vw)",
                height: "min(720px, 90vh)",
                background: "#fff",
                borderRadius: 10,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 20px 70px rgba(0,0,0,.25)",
              }}
            >
              <div
                style={{
                  padding: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <strong>Media Library</strong>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    Choose media for this element
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMediaPickerOpen(false)}
                  aria-label="Close Media Library"
                  style={BUTTON_STYLE}
                >
                  <X size={18} />
                </button>
              </div>

              <div
                style={{
                  padding: 14,
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div className={styles.widgetSearch}>
                  <Search size={15} />

                  <input
                    value={mediaSearch}
                    onChange={(event) => setMediaSearch(event.target.value)}
                    placeholder="Search media..."
                  />
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  padding: 16,
                }}
              >
                {mediaLoading ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: 50,
                    }}
                  >
                    <Loader2 className={styles.spin} size={28} />
                  </div>
                ) : filteredMedia.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 50,
                      color: "#64748b",
                    }}
                  >
                    No media found.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(145px,1fr))",
                      gap: 14,
                    }}
                  >
                    {filteredMedia.map((item) => {
                      const url = item.filePath || item.url || "";

                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => chooseMedia(item)}
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: 7,
                            padding: 8,
                            background: "#fff",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              height: 115,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "#f1f5f9",
                              borderRadius: 5,
                              overflow: "hidden",
                            }}
                          >
                            {url && item.mimeType?.startsWith("image/") ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={url}
                                alt={item.altText || ""}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "contain",
                                }}
                              />
                            ) : (
                              <ImageIcon size={30} />
                            )}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              marginTop: 8,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.originalName || item.fileName || item.id}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: 14,
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => setMediaPickerOpen(false)}
                  className={styles.previewButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {revisionOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Revision History"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              background: "rgba(15,23,42,.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              style={{
                width: "min(760px, 96vw)",
                maxHeight: "85vh",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                background: "#fff",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  padding: 18,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <strong>Revision History</strong>

                <button
                  type="button"
                  onClick={() => setRevisionOpen(false)}
                  aria-label="Close revision history"
                  style={BUTTON_STYLE}
                >
                  <X size={18} />
                </button>
              </div>

              <div
                style={{
                  overflow: "auto",
                  padding: 16,
                }}
              >
                {revisionLoading ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 30,
                    }}
                  >
                    <Loader2 className={styles.spin} size={24} />
                  </div>
                ) : revisions.length === 0 ? (
                  <p className={styles.mutedText}>
                    No published revisions found yet.
                  </p>
                ) : (
                  revisions.map((revision) => (
                    <div
                      key={revision.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        borderBottom: "1px solid #e2e8f0",
                        padding: "12px 0",
                      }}
                    >
                      <div>
                        <strong>Revision #{revision.revisionNo}</strong>

                        <div
                          style={{
                            fontSize: 13,
                            color: "#64748b",
                          }}
                        >
                          {revision.message || revision.title}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: "#94a3b8",
                          }}
                        >
                          {revision.createdAt
                            ? new Date(revision.createdAt).toLocaleString()
                            : ""}
                        </div>
                      </div>

                      <button
                        type="button"
                        className={styles.previewButton}
                        disabled={saving}
                        onClick={() => void restoreRevision(revision.id)}
                      >
                        <RotateCcw size={14} />
                        Restore
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </DndContext>
  );
}
