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
  rectIntersection,
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
  Video,
  Music,
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
import BuilderRichTextEditor from "@/components/admin/BuilderRichTextEditor";
import BannerSlider, {
  type BannerSliderSlide,
} from "@/components/public/BannerSlider";
import BuilderVideoPlayer from "@/components/public/BuilderVideoPlayer";
import { themeIcons, themeIconLabels } from "@/components/public/theme-icons";
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
import BuilderStructurePicker, { type BuilderStructureSelection } from "./BuilderStructurePicker";

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

type GlobalTemplatePreview = {
  title: string;
  status: string;
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
  | { kind: "nodeProp"; key: string; value: string }
  | { kind: "repeaterItem"; index: number; key: "items" | "icons" | "tabs"; value: string }
  | { kind: "slideButton"; slideIndex: number; buttonIndex: number; value: string }
  | null;

type NodeContextMenu = {
  nodeId: string;
  left: number;
  top: number;
} | null;

type LayoutPickerContext = {
  parentId: string | null;
  rootSection: boolean;
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
  | "videoFile"
  | "audioFile"
  | "slideBackground"
  | "slideButtonIcon"
  | "carouselItem"
  | "repeaterIcon"
  | "menuMobileLogo";

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

function cssLength(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
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

  // Motion > Sticky has priority over normal positioning controls.
  if (s.motion?.sticky) {
    const stickyOffset = `${Math.max(0, Number(s.motion.stickyOffset ?? 0) || 0)}px`;
    style.position = "sticky";
    if (s.motion.stickyPosition === "bottom") {
      style.bottom = stickyOffset;
      style.top = undefined;
    } else {
      style.top = stickyOffset;
      style.bottom = undefined;
    }
    if (style.zIndex === undefined) style.zIndex = 1000;
  } else if (style.position === "sticky") {
    if (style.top === undefined && style.bottom === undefined) style.top = "0px";
    if (style.zIndex === undefined) style.zIndex = 1000;
  }

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
  if (style.display === "grid" && !childrenStyle.gridTemplateColumns) {
    const childCount = Math.max(1, Math.min(6, node.children?.length || 2));
    childrenStyle.gridTemplateColumns = `repeat(${childCount}, minmax(0, 1fr))`;
  }
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

function getCanvasWidthIndicator(
  node: BuilderNode,
  device: BuilderDevice,
  parentNode?: BuilderNode | null,
): { label: string; percentage: number | null } | null {
  if (!LAYOUT_TYPES.has(node.type)) return null;

  const style = getNodeInlineStyle(node, device);
  const widthMode = getWidthMode(node.advanced?.widthMode, device);
  const explicitWidth = String(style.width || style.flexBasis || '').trim();

  if (!parentNode) {
    const width = explicitWidth || (widthMode === 'inline' ? 'Auto' : '100%');
    const match = width.match(/^(\d+(?:\.\d+)?)%$/);
    return {
      label: width,
      percentage: match ? Math.max(0, Math.min(100, Number(match[1]))) : null,
    };
  }

  const parentStyle = getNodeInlineStyle(parentNode, device);
  const display = String(parentStyle.display || 'flex');
  const direction = String(parentStyle.flexDirection || (parentNode.type === 'row' ? 'row' : 'column'));
  const siblings = (parentNode.children || []).filter((child) => LAYOUT_TYPES.has(child.type));
  const count = Math.max(1, siblings.length);

  if (display === 'flex' && direction.startsWith('row')) {
    const widthValue = String(style.width || '').trim();
    const basisValue = String(style.flexBasis || '').trim();
    const growValue = Math.max(0, Number(style.flexGrow || 0));
    const isDefaultFullWidth = widthValue === '100%' && widthMode === 'default';
    const effectiveGrowValue = growValue > 0
      ? growValue
      : isDefaultFullWidth && !basisValue
        ? 1
        : 0;
    const explicitPercentageText = !isDefaultFullWidth && widthValue
      ? widthValue
      : growValue <= 0 && basisValue && basisValue !== '0%'
        ? basisValue
        : '';
    const explicitPercentage = explicitPercentageText.match(/^(\d+(?:\.\d+)?)%$/);
    if (explicitPercentage) {
      const percentage = Number(explicitPercentage[1]);
      return { label: `${Number(percentage.toFixed(2))}%`, percentage };
    }

    if (effectiveGrowValue > 0) {
      const totalGrow = siblings.reduce((total, sibling) => {
        const siblingStyle = getNodeInlineStyle(sibling, device);
        const siblingGrow = Math.max(0, Number(siblingStyle.flexGrow || 0));
        const siblingWidthValue = String(siblingStyle.width || '').trim();
        const siblingBasisValue = String(siblingStyle.flexBasis || '').trim();
        const siblingMode = getWidthMode(sibling.advanced?.widthMode, device);
        const siblingIsDefaultFullWidth = siblingWidthValue === '100%' && siblingMode === 'default';
        const effectiveSiblingGrow = siblingGrow > 0
          ? siblingGrow
          : siblingIsDefaultFullWidth && !siblingBasisValue
            ? 1
            : 0;
        return total + effectiveSiblingGrow;
      }, 0);
      const fixedPercentageTotal = siblings.reduce((total, sibling) => {
        const siblingStyle = getNodeInlineStyle(sibling, device);
        const siblingMode = getWidthMode(sibling.advanced?.widthMode, device);
        const siblingWidth = String(siblingStyle.width || '').trim();
        const siblingBasis = String(siblingStyle.flexBasis || '').trim();
        const defaultFullWidth = siblingWidth === '100%' && siblingMode === 'default';
        const percentageText = !defaultFullWidth && siblingWidth
          ? siblingWidth
          : Number(siblingStyle.flexGrow || 0) <= 0 && siblingBasis && siblingBasis !== '0%'
            ? siblingBasis
            : '';
        const match = percentageText.match(/^(\d+(?:\.\d+)?)%$/);
        return total + (match ? Number(match[1]) : 0);
      }, 0);
      if (totalGrow > 0) {
        const available = Math.max(0, 100 - fixedPercentageTotal);
        const percentage = available * effectiveGrowValue / totalGrow;
        return { label: `${Number(percentage.toFixed(2))}%`, percentage };
      }
    }

    const hasExplicitSize = Boolean(
      (widthValue && !isDefaultFullWidth) ||
      (basisValue && basisValue !== '0%') ||
      growValue > 0 ||
      widthMode === 'custom' ||
      widthMode === 'full' ||
      widthMode === 'inline',
    );
    if (!hasExplicitSize) {
      const percentage = 100 / count;
      return { label: `${Number(percentage.toFixed(2))}%`, percentage };
    }
  }

  if (display === "grid") {
    const columns = String(parentStyle.gridTemplateColumns || "").trim();
    const repeatMatch = columns.match(/^repeat\(\s*(\d+)\s*,\s*(.+)\)$/i);
    let tracks: string[] = [];
    if (repeatMatch) {
      const repeatedTrack = repeatMatch[2].trim();
      tracks = Array.from({ length: Math.max(1, Number(repeatMatch[1])) }, () => repeatedTrack);
    } else {
      tracks = columns.match(/minmax\(\s*0\s*,\s*[^)]+\)|[^\s]+/gi) || [];
    }

    const childIndex = siblings.findIndex((sibling) => sibling.id === node.id);
    if (tracks.length > 0 && childIndex >= 0) {
      const selectedTrack = tracks[childIndex % tracks.length];
      const trackMatch = selectedTrack.match(/minmax\(\s*0\s*,\s*([^)]+)\s*\)/i);
      const trackValue = String(trackMatch?.[1] || selectedTrack).trim();
      const fixedPercentageTotal = tracks.reduce((total, track) => {
        const match = track.match(/minmax\(\s*0\s*,\s*(\d+(?:\.\d+)?)%\s*\)/i);
        return total + (match ? Number(match[1]) : 0);
      }, 0);
      const frWeights = tracks.map((track) => {
        const match = track.match(/minmax\(\s*0\s*,\s*([\d.]+)fr\s*\)/i);
        return Number(match?.[1] || 0);
      });
      const totalFr = frWeights.reduce((total, weight) => total + weight, 0);
      const percentageMatch = trackValue.match(/^(\d+(?:\.\d+)?)%$/);
      if (percentageMatch) {
        const percentage = Number(percentageMatch[1]);
        return { label: `${Number(percentage.toFixed(2))}%`, percentage };
      }
      const frMatch = trackValue.match(/^([\d.]+)fr$/i);
      if (frMatch && totalFr > 0) {
        const hasFixedNonPercent = tracks.some((track) =>
          /minmax\(\s*0\s*,\s*[^)]+\)/i.test(track) &&
          !/minmax\(\s*0\s*,\s*(?:[\d.]+%|[\d.]+fr)\s*\)/i.test(track),
        );
        if (!hasFixedNonPercent) {
          const percentage = Math.max(0, 100 - fixedPercentageTotal) * Number(frMatch[1]) / totalFr;
          return { label: `${Number(percentage.toFixed(2))}%`, percentage };
        }
      }
      return { label: trackValue, percentage: null };
    }

    const explicitPercentage = explicitWidth.match(/^(\d+(?:\.\d+)?)%$/);
    if (explicitPercentage) {
      const percentage = Number(explicitPercentage[1]);
      return { label: `${Number(percentage.toFixed(2))}%`, percentage };
    }
  }
  if (display === 'flex' && direction.startsWith('column')) {
    const width = explicitWidth || '100%';
    const match = width.match(/^(\d+(?:\.\d+)?)%$/);
    return { label: width, percentage: match ? Number(match[1]) : null };
  }

  const width = explicitWidth || '100%';
  const match = width.match(/^(\d+(?:\.\d+)?)%$/);
  return { label: width, percentage: match ? Number(match[1]) : null };
}

function getCanvasHeightIndicator(
  node: BuilderNode,
  device: BuilderDevice,
): { label: string; percentage: number | null } | null {
  if (!LAYOUT_TYPES.has(node.type)) return null;

  const style = getNodeInlineStyle(node, device);
  const rawHeight = String(style.height ?? "").trim();
  const rawMinHeight = String(style.minHeight ?? "").trim();
  const isAuto = !rawHeight || rawHeight.toLowerCase() === "auto";
  const label = isAuto
    ? rawMinHeight
      ? `Auto Â· min ${rawMinHeight}`
      : "Auto"
    : rawHeight;
  const percentageMatch = rawHeight.match(/^(\d+(?:\.\d+)?)%$/);

  return {
    label,
    percentage: percentageMatch
      ? Math.max(0, Math.min(100, Number(percentageMatch[1])))
      : null,
  };
}
function getCanvasFlexItemStyle(
  node: BuilderNode,
  device: BuilderDevice,
  parentNode?: BuilderNode | null,
): CSSProperties {
  const style = getNodeInlineStyle(node, device);
  const result: CSSProperties = {
    width: style.width,
    minWidth: style.minWidth,
    maxWidth: style.maxWidth,
    flexGrow: style.flexGrow,
    flexShrink: style.flexShrink,
    flexBasis: style.flexBasis,
    order: style.order,
    alignSelf: style.alignSelf,
    boxSizing: "border-box",
  };

  // Sticky is applied to the sortable outer node so it can remain at the
  // top of the canvas scrollport while the sample page content moves below.
  if (style.position === "sticky") {
    result.position = "sticky";
    result.top = style.top ?? "0px";
    result.bottom = style.bottom;
    result.zIndex = Number(style.zIndex ?? 1000);
    result.alignSelf = "stretch";
  }

  if (!parentNode || !LAYOUT_TYPES.has(node.type)) return result;

  const parentStyle = getNodeInlineStyle(parentNode, device);
  const parentDisplay = String(parentStyle.display || "flex");
  const parentDirection = String(parentStyle.flexDirection || (parentNode.type === "row" ? "row" : "column"));
  const widthMode = getWidthMode(node.advanced?.widthMode, device);
  const widthValue = String(style.width || "").trim();
  // New and old Builder nodes commonly carry a default width:100%. Treat that
  // default as fluid in a flex row; an intentional custom width should use the
  // Custom width mode or an explicit flex basis/grow value.
  const isDefaultFullWidth = widthValue === "100%" && widthMode === "default";
  const explicitSize = Boolean(
    (widthValue && !isDefaultFullWidth) || style.flexBasis || Number(style.flexGrow || 0) > 0 || widthMode !== "default",
  );

  if (parentDisplay === "flex" && parentDirection.startsWith("row") && !explicitSize) {
    // Each sibling layout container receives the same flex basis. Two children
    // become 50/50, three become 33/33/33, etc. Explicit width/flex overrides win.
    result.width = undefined;
    result.flex = "1 1 0%";
    result.flexGrow = 1;
    result.flexShrink = 1;
    result.flexBasis = "0%";
    result.minWidth = 0;
    result.maxWidth = "100%";
  } else if ((parentDisplay === "flex" && parentDirection.startsWith("column")) || parentDisplay === "grid" || parentDisplay === "block") {
    if (!style.width && widthMode === "default") result.width = "100%";
    result.minWidth = style.minWidth || 0;
    result.maxWidth = style.maxWidth || "100%";
  }

  return result;
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
        alignItems: "stretch",
        gap: 6,
        marginBottom: 13,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
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

function colorToParts(value: string): { hex: string; red: number; green: number; blue: number; alpha: number } {
  const raw = value.trim().toLowerCase();
  if (raw === "transparent") return { hex: "#000000", red: 0, green: 0, blue: 0, alpha: 0 };

  const hexMatch = raw.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) hex = hex.split("").map((part) => part + part).join("");
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { hex: `#${hex.slice(0, 6)}`, red, green, blue, alpha };
  }

  const rgbMatch = raw.match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (rgbMatch) {
    const red = Math.max(0, Math.min(255, Number(rgbMatch[1])));
    const green = Math.max(0, Math.min(255, Number(rgbMatch[2])));
    const blue = Math.max(0, Math.min(255, Number(rgbMatch[3])));
    const alphaRaw = rgbMatch[4] || "1";
    const alpha = alphaRaw.endsWith("%") ? Number(alphaRaw.slice(0, -1)) / 100 : Number(alphaRaw);
    const hex = `#${[red, green, blue].map((part) => Math.round(part).toString(16).padStart(2, "0")).join("")}`;
    return { hex, red, green, blue, alpha: Math.max(0, Math.min(1, alpha)) };
  }

  return { hex: "#000000", red: 0, green: 0, blue: 0, alpha: 1 };
}

type ColorFormat = "HEX" | "RGB" | "HSL";

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  let saturation = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / delta) % 6; break;
      case g: h = (b - r) / delta + 2; break;
      default: h = (r - g) / delta + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(saturation * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  let parts: [number, number, number];
  if (hue < 60) parts = [c, x, 0];
  else if (hue < 120) parts = [x, c, 0];
  else if (hue < 180) parts = [0, c, x];
  else if (hue < 240) parts = [0, x, c];
  else if (hue < 300) parts = [x, 0, c];
  else parts = [c, 0, x];
  return parts.map((part) => Math.round((part + m) * 255)) as [number, number, number];
}

function colorDraft(color: ReturnType<typeof colorToParts>, format: ColorFormat): string {
  if (format === "HEX") return color.hex.toUpperCase();
  if (format === "RGB") return `${color.red}, ${color.green}, ${color.blue}`;
  const hsl = rgbToHsl(color.red, color.green, color.blue);
  return `${hsl.h}, ${hsl.s}%, ${hsl.l}%`;
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const color = colorToParts(value || "#000000");
  const [format, setFormat] = useState<ColorFormat>("HEX");
  const [draft, setDraft] = useState(colorDraft(color, "HEX"));

  useEffect(() => {
    setDraft(colorDraft(colorToParts(value || "#000000"), format));
  }, [value, format]);

  const emitRgb = (red: number, green: number, blue: number) => {
    const r = Math.max(0, Math.min(255, Math.round(red)));
    const g = Math.max(0, Math.min(255, Math.round(green)));
    const b = Math.max(0, Math.min(255, Math.round(blue)));
    const current = colorToParts(value || "#000000");
    if (current.alpha >= 0.999) {
      onChange(`#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`);
    } else {
      onChange(`rgba(${r}, ${g}, ${b}, ${Math.round(current.alpha * 100) / 100})`);
    }
  };

  const commitDraft = () => {
    const raw = draft.trim();
    if (format === "HEX") {
      if (raw.toLowerCase() === "transparent") {
        onChange("transparent");
        return;
      }
      if (/^#[0-9a-f]{3,8}$/i.test(raw)) {
        const parsed = colorToParts(raw);
        emitRgb(parsed.red, parsed.green, parsed.blue);
      }
      return;
    }
    if (format === "RGB") {
      const match = raw.match(/^\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*$/);
      if (match) emitRgb(Number(match[1]), Number(match[2]), Number(match[3]));
      return;
    }
    const match = raw.match(/^\s*(\d{1,3})\s*[, ]\s*(\d{1,3})%?\s*[, ]\s*(\d{1,3})%?\s*$/);
    if (match) {
      const [red, green, blue] = hslToRgb(Number(match[1]), Number(match[2]), Number(match[3]));
      emitRgb(red, green, blue);
    }
  };

  const setAlpha = (alpha: number) => {
    const nextAlpha = Math.max(0, Math.min(1, alpha));
    if (nextAlpha >= 0.999) {
      onChange(color.hex);
    } else {
      onChange(`rgba(${color.red}, ${color.green}, ${color.blue}, ${Math.round(nextAlpha * 100) / 100})`);
    }
  };

  const opacityGradient = `linear-gradient(to right, rgba(${color.red},${color.green},${color.blue},0), rgba(${color.red},${color.green},${color.blue},1))`;

  return (
    <Field label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, flexWrap: "nowrap" }}>
        {(["HEX", "RGB", "HSL"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={format === item}
            onClick={() => setFormat(item)}
            style={{
              border: format === item ? "1px solid #3984e8" : "1px solid #dbe3ed",
              background: format === item ? "#eff6ff" : "#fff",
              color: format === item ? "#1d4ed8" : "#64748b",
              borderRadius: 5,
              minWidth: 38,
              height: 28,
              padding: "0 7px",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {item}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748b" }}>Opacity</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 38px auto", gap: 6, alignItems: "center", minWidth: 0 }}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => { if (event.key === "Enter") { commitDraft(); (event.currentTarget as HTMLInputElement).blur(); } }}
          placeholder={format === "HEX" ? "#RRGGBB" : format === "RGB" ? "R, G, B" : "H, S%, L%"}
          aria-label={`${label} ${format} color`}
          style={{ ...CONTROL_STYLE, minWidth: 0 }}
        />
        <div style={{ width: 38, height: 34, padding: 2, border: "1px solid #cbd5e1", borderRadius: 6, background: "conic-gradient(#e5e7eb 25%, #fff 0 50%, #e5e7eb 0 75%, #fff 0) 0 0 / 10px 10px", boxSizing: "border-box" }}>
          <input
            aria-label={`${label} color picker`}
            type="color"
            value={color.hex}
            onChange={(event) => {
              const picked = colorToParts(event.target.value);
              emitRgb(picked.red, picked.green, picked.blue);
            }}
            style={{ width: "100%", height: "100%", display: "block", padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
          />
        </div>
        <button
          type="button"
          title={color.alpha <= 0 ? "Use opaque color" : "Set transparent"}
          onClick={() => color.alpha <= 0 ? onChange(color.hex) : onChange(`rgba(${color.red}, ${color.green}, ${color.blue}, 0)`)}
          style={{ ...BUTTON_STYLE, padding: "7px 8px", whiteSpace: "nowrap" }}
        >
          {color.alpha <= 0 ? "Solid" : "Clear"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 42px", gap: 8, alignItems: "center", marginTop: 8 }}>
        <input
          aria-label={`${label} transparency / opacity`}
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(color.alpha * 100)}
          onChange={(event) => setAlpha(Number(event.target.value) / 100)}
          style={{ width: "100%", height: 7, accentColor: "#3984e8", background: opacityGradient, borderRadius: 99, cursor: "pointer" }}
        />
        <span style={{ color: "#64748b", fontSize: 11, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(color.alpha * 100)}%</span>
      </div>
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

type CssMeasureUnit = "px" | "%" | "em" | "rem" | "vw" | "vh" | "auto" | "custom" | "unitless";

function readCssMeasure(
  value: string,
  allowUnitless = false,
): { number: string; unit: CssMeasureUnit } {
  const raw = value.trim();
  if (!raw) return { number: "", unit: allowUnitless ? "unitless" : "px" };
  if (raw.toLowerCase() === "auto") return { number: "", unit: "auto" };

  const match = raw.match(/^(-?(?:\d+\.?\d*|\.\d+))\s*(px|%|em|rem|vw|vh)$/i);
  if (match) {
    return { number: match[1], unit: match[2].toLowerCase() as CssMeasureUnit };
  }

  // Historical numeric line-height values such as 1.4 stay unitless.
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) {
    return { number: raw, unit: allowUnitless ? "unitless" : "px" };
  }

  return { number: raw, unit: "custom" };
}

function UnitControl({
  label,
  value,
  onChange,
  placeholder = "0",
  allowAuto = true,
  allowUnitless = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowAuto?: boolean;
  allowUnitless?: boolean;
}) {
  const parsed = readCssMeasure(value, allowUnitless);
  const [emptyUnit, setEmptyUnit] = useState<CssMeasureUnit>("px");
  const [manualUnit, setManualUnit] = useState<CssMeasureUnit | null>(null);

  useEffect(() => {
    if (value.trim()) setEmptyUnit(parsed.unit);
  }, [value, parsed.unit]);

  const selectedUnit = manualUnit || (value.trim() ? parsed.unit : emptyUnit);
  const units: CssMeasureUnit[] = [
    "px",
    "%",
    "rem",
    "em",
    "vw",
    "vh",
    ...(allowUnitless ? ["unitless" as const] : []),
    ...(allowAuto ? ["auto" as const] : []),
    "custom",
  ];

  const changeUnit = (nextUnit: CssMeasureUnit) => {
    setEmptyUnit(nextUnit);
    setManualUnit(nextUnit);
    if (nextUnit === "auto") {
      onChange("auto");
      return;
    }
    if (nextUnit === "custom") {
      // Auto is a sizing mode, not a numeric CSS expression. Clear it so the
      // Custom text field becomes editable immediately instead of calc(auto).
      // Existing numeric units are wrapped so the input stays in Custom mode.
      const currentValue = value.trim();
      const nextValue =
        selectedUnit === "auto" || currentValue.toLowerCase() === "auto"
          ? ""
          : selectedUnit === "custom"
            ? currentValue
            : currentValue
              ? `calc(${currentValue})`
              : "";
      onChange(nextValue);
      return;
    }
    if (nextUnit === "unitless") {
      onChange(parsed.number || "");
      return;
    }

    const numeric = selectedUnit === "auto" || selectedUnit === "custom"
      ? ""
      : parsed.number;
    onChange(numeric ? `${numeric}${nextUnit}` : "");
  };

  const isCustom = selectedUnit === "custom";
  const isAuto = selectedUnit === "auto";
  const displayValue = isCustom
    ? (value.trim().toLowerCase() === "auto" ? "" : value)
    : isAuto
      ? "auto"
      : parsed.number;

  return (
    <Field label={label}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 82px",
          gap: 5,
          minWidth: 0,
        }}
      >
        <input
          type={isCustom || isAuto ? "text" : "number"}
          inputMode={isCustom ? "text" : "decimal"}
          value={displayValue}
          disabled={isAuto}
          placeholder={isCustom ? "calc(100% - 20px)" : placeholder.replace(/(px|%|em|rem|vw|vh)$/i, "")}
          onChange={(event) => {
            const next = event.target.value;
            if (isCustom || selectedUnit === "unitless") {
              onChange(next);
            } else if (!isAuto) {
              onChange(next ? `${next}${selectedUnit}` : "");
            }
          }}
          style={{ ...CONTROL_STYLE, minWidth: 0, opacity: isAuto ? 0.6 : 1 }}
          aria-label={`${label} value`}
        />
        <select
          value={selectedUnit}
          onChange={(event) => changeUnit(event.target.value as CssMeasureUnit)}
          style={{ ...CONTROL_STYLE, minWidth: 0, padding: "7px 5px" }}
          aria-label={`${label} unit`}
        >
          {units.map((unit) => (
            <option key={unit} value={unit}>
              {unit === "custom" ? "Custom" : unit === "unitless" ? "Unitless" : unit}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
}

function RangeUnitControl({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const parsed = readCssMeasure(value, false);
  const unit = parsed.unit === "custom" || parsed.unit === "auto" ? "px" : parsed.unit;
  const numeric = Number(parsed.number || 0);
  const rangeValue = Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : 0));
  return (
    <Field label={label}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 82px", gap: 10, alignItems: "center", minWidth: 0 }}>
        <input
          aria-label={`${label} slider`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={rangeValue}
          onChange={(event) => onChange(`${event.target.value}${unit}`)}
          style={{ width: "100%", minWidth: 0, accentColor: "#3984e8", cursor: "pointer" }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 4 }}>
          <input
            aria-label={`${label} value`}
            type="number"
            min={min}
            max={max}
            step={step}
            value={parsed.number}
            onChange={(event) => onChange(event.target.value ? `${event.target.value}${unit}` : "")}
            style={{ ...CONTROL_STYLE, width: "100%", minWidth: 0, padding: "7px 6px" }}
          />
          <span style={{ color: "#64748b", fontSize: 11 }}>{unit}</span>
        </div>
      </div>
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
    icon?: string;
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
              aria-label={option.title || option.label}
              title={option.title || option.label}
              onClick={() => onChange(option.value)}
              style={{
                flex: "1 1 auto",
                minWidth: option.icon ? 36 : 42,
                minHeight: 34,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: active ? "1px solid #3984e8" : "1px solid transparent",
                borderRadius: 4,
                padding: option.icon ? "7px" : "7px 8px",
                background: active ? "#fff" : "transparent",
                color: active ? "#2164c5" : "#475569",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {option.icon && themeIcons[option.icon] ? (
                (() => {
                  const OptionIcon = themeIcons[option.icon!];
                  return <OptionIcon size={16} aria-hidden="true" />;
                })()
              ) : (
                option.label
              )}
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
                  if (unit === "auto") return [side, "auto"];
                  if (unit === "custom") {
                    // Keep the existing CSS length/expression as-is. Auto is
                    // not a useful starting point for a custom expression.
                    return [side, current.trim().toLowerCase() === "auto" ? "0" : current];
                  }
                  // Switching back from Auto must produce a valid numeric
                  // value instead of accidentally creating "auto%" / "autoem".
                  const numeric = current.trim().toLowerCase() === "auto"
                    ? "0"
                    : current.replace(/\s*(px|%|em|rem|vw|vh)$/i, "");
                  return [side, numeric || "0"];
                }),
              ) as Pick<BuilderSpacing, "top" | "right" | "bottom" | "left">;
              onChange({ ...spacing, ...nextSides, unit });
            }}
            style={{ ...CONTROL_STYLE, width: 82, padding: "4px 6px" }}
          >
            {["px", "%", "rem", "em", "vw", "vh", ...(label.toLowerCase().includes("padding") ? [] : ["auto"]), "custom"].map((unit) => (
              <option key={unit} value={unit}>{unit === "custom" ? "Custom" : unit}</option>
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
              type={spacing.unit === "custom" ? "text" : "text"}
              value={spacing[side] || ""}
              placeholder={spacing.unit === "custom" ? "calc(...)" : "0"}
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

// BUILDER_LIST_LAYOUT_V6_2
// BUILDER_ICON_SOCIAL_GAP_V6_4
// BUILDER_GAP_CONFLICT_FIX_V7
// BUILDER_GAP_DISPLAY_CONFLICT_V7_2
// BUILDER_SOCIAL_ICONS_LAYOUT_BRANDS_V8
function PreviewNode({
  node,
  device,
}: {
  node: BuilderNode;
  device: BuilderDevice;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [hoveredTab, setHoveredTab] = useState<number | null>(null);
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
    "data-builder-node-id": node.id,
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
    const safeRichText = sanitizeHtml(String(props.content || ""), {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, "h1", "h2", "h3", "h4", "h5", "h6", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "hr", "span"],
      allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, "*": ["class", "style", "title"], a: ["href", "target", "rel", "title"], img: ["src", "alt", "title", "width", "height"] },
      allowedStyles: { "*": { color: [/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,24}|transparent)$/i], "background-color": [/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,24}|transparent)$/i], "text-align": [/^(left|right|center|justify)$/i], "font-size": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/i], "font-weight": [/^(normal|bold|[1-9]00)$/i], "font-style": [/^(normal|italic|oblique)$/i], "text-decoration": [/^(none|underline|line-through)$/i], "line-height": [/^\d+(?:\.\d+)?(?:px|em|rem|%)?$/i] } },
      allowedSchemes: ["http", "https", "mailto", "tel"],
      allowProtocolRelative: false,
    });
    return <div {...commonProps} className={`${styles.previewText} ${advancedClass}`} dangerouslySetInnerHTML={{ __html: safeRichText }} />;
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
    const iconName = typeof props.iconName === "string" ? props.iconName : "";
    const Icon = iconName ? themeIcons[iconName] : null;
    const iconImage = typeof props.iconImage === "string" && props.iconImage
      ? props.iconImage
      : typeof props.src === "string" ? props.src : "";
    const symbol = typeof props.symbol === "string" ? props.symbol : "";
    const sizeCss = cssLength(props.size, "24px");
    const color = String(props.iconColor || props.color || "#0c2f55");

    if (iconImage) {
      return (
        <span {...commonProps} className={styles.previewIcon}>
          <img src={safeMediaUrl(iconImage)} alt={String(props.alt || "")} style={{ width: sizeCss, height: sizeCss, objectFit: "contain" }} />
        </span>
      );
    }

    if (!Icon && !symbol) return null;

    return (
      <span
        {...commonProps}
        className={styles.previewIcon}
        style={{
          ...inlineStyle,
          fontSize: sizeCss,
          color,
        }}
      >
        {Icon ? <Icon size={24} style={{ width: sizeCss, height: sizeCss, color }} /> : symbol}
      </span>
    );
  }

  if (node.type === "icon-list") {
    const items = Array.isArray(props.items)
      ? props.items as Array<Record<string, unknown>>
      : [];
    const listLayout = String(props.layout || "list");
    const listColumns = Math.max(1, Math.min(6, Number(props.columns) || 2));
    const iconSizeCss = cssLength(props.iconSize, "16px");
    const itemGap = cssLength(props.iconGap, "9px");
    const itemSpacing = cssLength(props.itemSpacing ?? props.gap, "12px");
    const display = listLayout === "grid" ? "grid" : "flex";
    const listAlignment = String(props.listAlignment || "left");
    const listAlignValue = listAlignment === "center" ? "center" : listAlignment === "right" ? "flex-end" : "flex-start";

    return (
      <ul
        {...commonProps}
        style={{
          ...inlineStyle,
          listStyle: "none",
          padding: 0,
          margin: 0,
          display,
          flexDirection: listLayout === "inline" ? "row" : "column",
          flexWrap: inlineStyle.flexWrap || (listLayout === "inline" ? "wrap" : "nowrap"),
          gridTemplateColumns: inlineStyle.gridTemplateColumns || (listLayout === "grid" ? `repeat(${listColumns}, minmax(0, 1fr))` : undefined),
          alignItems: listLayout === "inline" ? "center" : listAlignValue,
          justifyContent: listLayout === "inline" ? listAlignValue : "flex-start",
          justifyItems: listLayout === "grid" ? (listAlignment === "center" ? "center" : listAlignment === "right" ? "end" : "start") : undefined,
          gap: itemSpacing,
          rowGap: itemSpacing,
          columnGap: itemSpacing,
        }}
      >
        {items.map((item, index) => {
          const iconName = typeof item.iconName === "string" ? item.iconName : "Check";
          const ItemIcon = iconName ? themeIcons[iconName] : null;
          const iconImage = safeMediaUrl(String(item.iconImage || ""));
          const hasItemIcon = Boolean(iconImage || ItemIcon);
          const content = (
            <>
              {hasItemIcon ? (
                <span style={{ display: "inline-flex", alignItems: "center", flex: "0 0 auto", color: String(props.iconColor || "#3984e8") }}>
                  {iconImage ? (
                    <img src={iconImage} alt="" style={{ width: iconSizeCss, height: iconSizeCss, objectFit: "contain" }} />
                  ) : ItemIcon ? (
                    <ItemIcon size={16} style={{ width: iconSizeCss, height: iconSizeCss, color: String(props.iconColor || "#3984e8") }} />
                  ) : null}
                </span>
              ) : null}
              <span>{String(item.text || item.label || `List item ${index + 1}`)}</span>
            </>
          );
          const href = String(item.url || "").trim();
          const contentStyle: CSSProperties = {
            display: "inline-flex",
            alignItems: "center",
            gap: itemGap,
            color: "inherit",
            textDecoration: "none",
          };

          return (
            <li
              key={String(item.id || index)}
              style={{
                display: "flex",
                alignItems: "center",
                minWidth: 0,
                gap: itemGap,
                borderBottom: props.divider ? `1px solid ${String(props.dividerColor || "#e2e8f0")}` : undefined,
              }}
            >
              {href ? <a href={href} style={contentStyle}>{content}</a> : <span style={contentStyle}>{content}</span>}
            </li>
          );
        })}
      </ul>
    );
  }

  if (node.type === "social-icons") {
    const icons = Array.isArray(props.icons) ? props.icons as Array<Record<string, unknown>> : [];
    const iconSizeCss = cssLength(props.iconSize, "22px");
    const buttonSizeCss = cssLength(props.buttonSize, "40px");
    const shape = String(props.shape || "circle");
    const layoutMode = String(props.layoutMode || "inline");
    const iconGap = cssLength(props.iconGap ?? props.gap ?? inlineStyle.gap, "12px");
    const radius = cssLength(props.shapeRadius, shape === "square" ? "4px" : shape === "rounded" ? "10px" : "999px");
    return (
      <div {...commonProps} style={{ ...inlineStyle, display: "flex", flexDirection: layoutMode === "block" ? "column" : "row", alignItems: inlineStyle.alignItems || "center", justifyContent: inlineStyle.justifyContent || "flex-start", flexWrap: layoutMode === "block" ? "nowrap" : "wrap",
          gap: iconGap, rowGap: iconGap, columnGap: iconGap, }}>
        {icons.map((entry, index) => {
          const name = String(entry.iconName || entry.name || "");
          const SocialIcon = name ? themeIcons[name] : null;
          const image = safeMediaUrl(String(entry.iconImage || ""));
          if (!SocialIcon && !image) return null;
          const href = safeMediaUrl(String(entry.url || "")) || "#";
          const iconColor = String(props.iconColor || "#ffffff");
          return (
            <a
              key={String(entry.id || index)}
              href={href}
              aria-label={String(entry.label || entry.name || "Social link")}
              title={String(entry.label || entry.name || "Social link")}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", width: buttonSizeCss, height: buttonSizeCss, borderRadius: radius, color: iconColor, background: String(props.iconBackground || props.backgroundColor || "#0c2f55"), textDecoration: "none" }}
            >
              {image ? <img src={image} alt="" style={{ width: iconSizeCss, height: iconSizeCss, objectFit: "contain" }} /> : SocialIcon ? <SocialIcon size={22} style={{ width: iconSizeCss, height: iconSizeCss, color: iconColor }} /> : null}
            </a>
          );
        })}
      </div>
    );
  }

  if (node.type === "video") {
    return (
      <BuilderVideoPlayer
        id={node.advanced?.cssId || undefined}
        className={advancedClass || undefined}
        nodeId={node.id}
        preview
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        source={String(props.source || "auto")}
        url={String(props.url || "")}
        poster={String(props.poster || "")}
        startTime={props.startTime as number | string | undefined}
        endTime={props.endTime as number | string | undefined}
        autoplay={Boolean(props.autoplay)}
        playOnMobile={Boolean(props.playOnMobile)}
        muted={Boolean(props.muted)}
        loop={Boolean(props.loop)}
        controls={props.controls !== false}
        captions={Boolean(props.captions)}
        captionsUrl={String(props.captionsUrl || "")}
        captionsLanguage={String(props.captionsLanguage || "en")}
        captionsLabel={String(props.captionsLabel || "Captions")}
        privacyMode={Boolean(props.privacyMode)}
        lazyLoad={props.lazyLoad !== false}
        suggestedVideos={String(props.suggestedVideos || "any")}
        modestBranding={Boolean(props.modestBranding)}
        showTitle={props.showTitle !== false}
        showPortrait={props.showPortrait !== false}
        showByline={props.showByline !== false}
        showInfo={props.showInfo !== false}
        showLogo={props.showLogo !== false}
        controlsColor={String(props.controlsColor || "")}
        downloadButton={props.downloadButton !== false}
        preload={String(props.preload || "metadata")}
        imageOverlay={Boolean(props.imageOverlay)}
        playIcon={props.playIcon !== false}
        lightbox={Boolean(props.lightbox)}
        aspectRatio={String(props.aspectRatio || "16:9")}
        objectFit={String(props.objectFit || "cover")}
        overlayOpacity={props.overlayOpacity as number | string | undefined}
        overlayColor={String(props.overlayColor || "#000000")}
        playIconColor={String(props.playIconColor || "#ffffff")}
        playIconSize={props.playIconSize as number | string | undefined}
        style={inlineStyle}
      />
    );
  }

  if (node.type === "audio") {
    return (
      <audio
        {...commonProps}
        src={String(props.url || "")}
        controls={props.controls !== false}
        autoPlay={Boolean(props.autoplay)}
        loop={Boolean(props.loop)}
        preload={( ["auto", "metadata", "none"].includes(String(props.preload)) ? props.preload : "metadata") as "auto" | "metadata" | "none"}
        style={{ ...inlineStyle, width: inlineStyle.width || "100%" }}
      />
    );
  }

  if (node.type === "icon-box") {
    const position = String(props.iconPosition || "top");
    const iconName = typeof props.iconName === "string" ? props.iconName : "";
    const Icon = iconName ? themeIcons[iconName] : null;
    const iconImage = safeMediaUrl(String(props.iconImage || ""));
    const iconSizeCss = cssLength(props.iconSize, "40px");
    const symbol = typeof props.symbol === "string" ? props.symbol : "";
    const hasIcon = Boolean(iconImage || Icon || symbol);

    return (
      <div
        {...commonProps}
        style={{
          ...inlineStyle,
          display: inlineStyle.display || "flex",
          flexDirection: inlineStyle.flexDirection || (position === "left" ? "row" : position === "right" ? "row-reverse" : "column"),
          alignItems: inlineStyle.alignItems || "center",
          justifyContent: inlineStyle.justifyContent || "flex-start",
          flexWrap: inlineStyle.flexWrap || "nowrap",
          gap: inlineStyle.gap || cssLength(props.gap, "12px"),
        }}
      >
        {hasIcon ? (
          <div style={{ fontSize: iconSizeCss, color: String(props.iconColor || "#3984e8"), flex: "0 0 auto" }}>
            {iconImage ? (
              <img src={iconImage} alt="" style={{ width: iconSizeCss, height: iconSizeCss, objectFit: "contain" }} />
            ) : Icon ? (
              <Icon size={40} style={{ width: iconSizeCss, height: iconSizeCss, color: String(props.iconColor || "#3984e8") }} />
            ) : symbol}
          </div>
        ) : null}
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
          display: inlineStyle.display || "flex",
          flexDirection: inlineStyle.flexDirection || (position === "left" ? "row" : position === "right" ? "row-reverse" : "column"),
          alignItems: inlineStyle.alignItems || "center",
          justifyContent: inlineStyle.justifyContent || "flex-start",
          flexWrap: inlineStyle.flexWrap || "nowrap",
          gap: inlineStyle.gap || 12,
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
          display: inlineStyle.display || "flex",
          flexDirection: inlineStyle.flexDirection || "row",
          alignItems: inlineStyle.alignItems || "center",
          justifyContent: inlineStyle.justifyContent || "flex-start",
          flexWrap: inlineStyle.flexWrap || "nowrap",
          width: inlineStyle.width || "100%",
          maxWidth: inlineStyle.maxWidth || "100%",
          minWidth: 0,
          gap: inlineStyle.gap || 8,
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
    const menuBreakpoint = Math.max(320, Math.min(1920, Number(props.mobileBreakpoint || 1024)));
    const showMobileMenu = device === "mobile" || (device === "tablet" && menuBreakpoint >= 768);
    if (showMobileMenu && props.mobileToggle !== false) {
      const openIconName = Object.prototype.hasOwnProperty.call(props, "openIcon")
        ? String(props.openIcon || "")
        : "Menu";
      const closeIconName = Object.prototype.hasOwnProperty.call(props, "closeIcon")
        ? String(props.closeIcon || "")
        : "X";
      const OpenIcon = openIconName ? themeIcons[openIconName] : null;
      const CloseIcon = closeIconName ? themeIcons[closeIconName] : null;
      const mobileMenuAlignment = props.alignment === "center"
        ? "center"
        : props.alignment === "right"
          ? "flex-end"
          : props.alignment === "justify"
            ? "space-between"
            : "flex-start";
      const mobilePanelGradient = props.mobilePanelBackgroundType === "gradient" || (!props.mobilePanelBackgroundType && Boolean(props.mobilePanelGradient));
      const mobileMenuStyleMap = props.menuItemStyles && typeof props.menuItemStyles === "object"
        ? props.menuItemStyles as Record<string, Record<string, Record<string, unknown>>>
        : {};
      const mobileMenuStyleFor = (state: "normal" | "hover" | "active") => ({
        ...(mobileMenuStyleMap.desktop?.[state] || {}),
        ...(mobileMenuStyleMap[device]?.[state] || {}),
      });
      const mobilePreviewItems = (entries: unknown[], depth = 0): ReactNode => entries.map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const menuItem = entry as Record<string, unknown>;
          const itemId = String(menuItem.id || `${depth}-${index}-${menuItem.label || menuItem.title || "item"}`);
          const iconName = String(menuItem.iconName || props.itemIconName || "");
          const ItemIcon = iconName ? themeIcons[iconName] : null;
          const ItemImage = safeMediaUrl(String(menuItem.iconImage || ""));
          const label = String(menuItem.label || menuItem.title || "Menu item");
          const nestedItems = Array.isArray(menuItem.children) ? menuItem.children : [];
          const normalStyle = mobileMenuStyleFor("normal");
          const hoverStyle = mobileMenuStyleFor("hover");
          const normalGradient = normalStyle.backgroundGradient && typeof normalStyle.backgroundGradient === "object"
            ? normalStyle.backgroundGradient as Record<string, unknown>
            : null;
          const itemBackground = normalGradient
            ? `linear-gradient(${Number(normalGradient.angle ?? 135)}deg, ${String(normalGradient.color1 || "#ffffff")}, ${String(normalGradient.color2 || "#eaf1fb")})`
            : String(normalStyle.backgroundColor || "transparent");
          return (
            <div key={itemId}>
              <div
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = String(hoverStyle.color || normalStyle.color || props.mobilePanelColor || "#1f2937");
                  if (hoverStyle.backgroundGradient && typeof hoverStyle.backgroundGradient === "object") {
                    const gradient = hoverStyle.backgroundGradient as Record<string, unknown>;
                    event.currentTarget.style.background = `linear-gradient(${Number(gradient.angle ?? 135)}deg, ${String(gradient.color1 || "#ffffff")}, ${String(gradient.color2 || "#eaf1fb")})`;
                  } else {
                    event.currentTarget.style.background = String(hoverStyle.backgroundColor || itemBackground);
                  }
                  const icon = event.currentTarget.querySelector<HTMLElement>("[data-preview-menu-icon]");
                  if (icon) icon.style.color = String(hoverStyle.iconColor || hoverStyle.color || normalStyle.iconColor || props.mobilePanelIconColor || "#1f2937");
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = String(normalStyle.color || props.mobilePanelColor || "#1f2937");
                  event.currentTarget.style.background = itemBackground;
                  const icon = event.currentTarget.querySelector<HTMLElement>("[data-preview-menu-icon]");
                  if (icon) icon.style.color = String(normalStyle.iconColor || props.mobilePanelIconColor || props.mobilePanelColor || "#1f2937");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "10px 8px",
                  paddingLeft: 8 + depth * 14,
                  borderRadius: 5,
                  color: String(normalStyle.color || props.mobilePanelColor || "#1f2937"),
                  background: itemBackground,
                  cursor: "default",
                  transition: "color 140ms ease, background 140ms ease",
                }}
              >
                {ItemImage ? <img data-preview-menu-icon="true" src={ItemImage} alt="" style={{ width: 16, height: 16, objectFit: "contain", flex: "0 0 auto" }} /> : ItemIcon ? <ItemIcon data-preview-menu-icon="true" size={16} style={{ color: String(normalStyle.iconColor || props.mobilePanelIconColor || props.mobilePanelColor || "#1f2937"), flex: "0 0 auto" }} /> : null}
                <span>{label}</span>
                {nestedItems.length ? <ChevronDown size={14} style={{ marginLeft: "auto" }} /> : null}
              </div>
              {nestedItems.length ? <div>{mobilePreviewItems(nestedItems, depth + 1)}</div> : null}
            </div>
          );
        });
      return (
        <nav
          {...commonProps}
          aria-label="Mobile navigation preview"
          style={{ ...inlineStyle, display: "flex", alignItems: "center", justifyContent: mobileMenuAlignment, width: inlineStyle.width || "100%", position: "relative", boxSizing: "border-box" }}
        >
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setMobileMenuOpen((open) => !open);
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.color = String(props.toggleHoverIconColor || props.iconColor || "#3984e8");
              event.currentTarget.style.backgroundColor = String(props.toggleHoverBackgroundColor || "transparent");
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = String(props.iconColor || "#0c2f55");
              event.currentTarget.style.backgroundColor = String(props.toggleBackgroundColor || "transparent");
            }}
            style={{
              ...BUTTON_STYLE,
              border: 0,
              padding: 6,
              background: String(props.toggleBackgroundColor || "transparent"),
              color: String(props.iconColor || "#0c2f55"),
            }}
          >
            {mobileMenuOpen
              ? CloseIcon ? <CloseIcon size={22} /> : null
              : OpenIcon ? <OpenIcon size={22} /> : null}
          </button>
          {mobileMenuOpen ? (
            <div
              role="presentation"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: "absolute",
                zIndex: 80,
                top: 0,
                left: 0,
                right: 0,
                minHeight: "min(560px, 75vh)",
                display: "flex",
                justifyContent: props.mobilePosition === "left" ? "flex-start" : "flex-end",
                alignItems: "stretch",
                background: String(props.mobileOverlayColor || "rgba(15,23,42,.48)"),
                boxShadow: "0 8px 24px rgba(15,23,42,.12)",
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation preview"
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: props.mobileLayout === "fullscreen" ? "100%" : String(props.mobileWidth || "280px"),
                  maxWidth: "100%",
                  minWidth: 0,
                  minHeight: props.mobileLayout === "dropdown" ? "auto" : "min(560px, 75vh)",
                  maxHeight: props.mobileLayout === "dropdown" ? "min(560px, 75vh)" : "min(560px, 75vh)",
                  overflowY: "auto",
                  boxSizing: "border-box",
                  padding: 16,
                  backgroundColor: String(props.mobilePanelBackground || "#ffffff"),
                  backgroundImage: mobilePanelGradient && props.mobilePanelGradient && typeof props.mobilePanelGradient === "object"
                    ? `linear-gradient(${Number((props.mobilePanelGradient as Record<string, unknown>).angle ?? 135)}deg, ${String((props.mobilePanelGradient as Record<string, unknown>).color1 || "#ffffff")}, ${String((props.mobilePanelGradient as Record<string, unknown>).color2 || "#eaf1fb")})`
                    : undefined,
                  alignSelf: props.mobileLayout === "dropdown" ? "flex-start" : "stretch",
                  color: String(props.mobilePanelColor || "#1f2937"),
                  boxShadow: "0 8px 24px rgba(15,23,42,.18)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid rgba(148,163,184,.25)" }}>
                  {props.mobileLogo ? <a href={String(props.mobileLogoLinkType === "homepage" ? "/" : props.mobileLogoLinkType === "current-page" ? "#" : props.mobileLogoLink || "/")} onClick={(event) => event.preventDefault()} style={{ display: "block", minWidth: 0, maxWidth: "calc(100% - 48px)" }}><img src={safeMediaUrl(String(props.mobileLogo))} alt={String(props.mobileLogoAlt || "Mobile menu logo")} style={{ display: "block", maxWidth: 180, maxHeight: 54, objectFit: "contain" }} /></a> : <strong>Menu</strong>}
                  <button
                    type="button"
                    aria-label="Close mobile menu preview"
                    onClick={() => setMobileMenuOpen(false)}
                    onMouseEnter={(event) => { event.currentTarget.style.color = String(props.closeIconHoverColor || "#3984e8"); }}
                    onMouseLeave={(event) => { event.currentTarget.style.color = String(props.closeIconColor || props.iconColor || "#0c2f55"); }}
                    style={{ ...BUTTON_STYLE, flex: "0 0 auto", color: String(props.closeIconColor || props.iconColor || "#0c2f55"), background: "transparent", border: 0 }}
                  >
                    {CloseIcon ? <CloseIcon size={20} /> : null}
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 12 }}>
                  {mobilePreviewItems(Array.isArray(props.items) ? props.items : [])}
                </div>
              </div>
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
          : props.alignment === "justify"
            ? "space-between"
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
            style={{ color: "var(--builder-menu-text-color, inherit)", backgroundColor: "var(--builder-menu-background-color, transparent)" }}
          >
            {ItemIcon ? (
              <ItemIcon
                size={16}
                className={styles.menuItemIcon}
                style={{ color: "var(--builder-menu-item-icon-color, currentColor)" }}
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
      ? props.menuItemStyles as Record<string, Record<string, Record<string, unknown>>>
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
    ) as Record<string, Record<string, unknown>>;
    const cssColor = (value: unknown) => typeof value === "string" && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,24}|transparent)$/i.test(value) ? value : "";
    const menuSelectorId = node.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const menuSelector = `[data-builder-node-id="${menuSelectorId}"]`;
    const stateDeclarations = (state: Record<string, unknown> | undefined) => {
      if (!state) return "";
      const declarations = [
        cssColor(state.iconColor) ? `--builder-menu-item-icon-color:${cssColor(state.iconColor)}` : "",
        cssColor(state.color) ? `--builder-menu-text-color:${cssColor(state.color)}` : "",
        cssColor(state.backgroundColor) ? `--builder-menu-background-color:${cssColor(state.backgroundColor)}` : "",
        Object.prototype.hasOwnProperty.call(state, "backgroundGradient")
          ? (() => {
              const gradient = state.backgroundGradient && typeof state.backgroundGradient === "object"
                ? state.backgroundGradient as Record<string, unknown>
                : null;
              return gradient
                ? `background-image:linear-gradient(${Math.max(0, Math.min(360, Number(gradient.angle ?? 135)))}deg, ${cssColor(gradient.color1) || "#ffffff"}, ${cssColor(gradient.color2) || "#eaf1fb"})`
                : "background-image:none";
            })()
          : cssColor(state.backgroundColor) ? "background-image:none" : "",
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
      `${menuSelector} a svg{color:var(--builder-menu-item-icon-color, inherit)}`,
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
          width: inlineStyle.width || "100%",
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
            width: "100%",
          }}
        >
          {menuItems.map(renderMenuItem)}
        </ul>

        {menuItems.length === 0 && (
          <span>Menu preview Â· {String(props.menuLocation || "HEADER")}</span>
        )}
      </nav>
    );
  }

  if (node.type === "accordion") {
    const items = Array.isArray(props.items)
      ? (props.items as Array<{ id?: string; title?: string; content?: string; iconName?: string; iconImage?: string }>)
      : [];
    const itemGap = cssLength(props.itemSpacing, "8px");
    const itemRadius = cssLength(props.itemRadius, "6px");
    const headerPadding = cssLength(props.headerPadding, "12px 14px");
    const contentPadding = cssLength(props.contentPadding, "12px 14px");
    const dividerColor = String(props.dividerColor || "#e2e8f0");
    const titleColor = String(props.titleColor || "#0c2f55");
    const itemIconSize = cssLength(props.itemIconSize, "16px");
    const itemIconColor = String(props.itemIconColor || "#3984e8");

    return (
      <div {...commonProps} style={{ ...inlineStyle, display: "flex", flexDirection: "column", gap: itemGap, minWidth: 0 }}>
        {items.map((item, index) => {
          const Icon = item.iconName ? themeIcons[item.iconName] : null;
          const image = safeMediaUrl(String(item.iconImage || ""));
          return (
            <details
              key={item.id || index}
              open={Boolean(props.firstOpen) && index === 0}
              style={{ border: `1px solid ${dividerColor}`, borderRadius: itemRadius, overflow: "hidden", background: String(props.titleBackground || "#f8fafc") }}
            >
              <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: headerPadding, color: titleColor, cursor: "pointer", fontWeight: 600, listStyle: "none" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  {image ? <img src={image} alt="" style={{ width: itemIconSize, height: itemIconSize, objectFit: "contain" }} /> : Icon ? <Icon size={16} style={{ width: itemIconSize, height: itemIconSize, color: itemIconColor, flex: "0 0 auto" }} /> : null}
                  <span>{item.title || `Item ${index + 1}`}</span>
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div style={{ padding: contentPadding, color: String(props.contentColor || "#334155"), background: String(props.contentBackground || "#ffffff"), borderTop: `1px solid ${dividerColor}` }}>
                {item.content || ""}
              </div>
            </details>
          );
        })}
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
      ? (props.tabs as Array<{ id?: string; title?: string; content?: string; iconName?: string; iconImage?: string }>)
      : [];
    const tabGap = cssLength(props.tabGap, "6px");
    const tabRadius = cssLength(props.tabRadius, "6px");
    const tabPadding = cssLength(props.tabPadding, "9px 14px");
    const tabIconSize = cssLength(props.tabIconSize, "15px");
    const tabIconColor = String(props.tabIconColor || "#334155");
    const alignment = String(props.tabAlignment || "left");
    const justify = alignment === "center" ? "center" : alignment === "right" ? "flex-end" : "flex-start";
    const activeIndex = Math.max(0, Math.min(activeTab, Math.max(0, tabs.length - 1)));
    const active = tabs[activeIndex];
    const dividerColor = String(props.tabDividerColor || "#e2e8f0");

    return (
      <div {...commonProps} style={{ ...inlineStyle, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: justify, alignItems: "center", gap: tabGap, borderBottom: `1px solid ${dividerColor}` }}>
          {tabs.map((tab, index) => {
            const isActive = activeIndex === index;
            const isHovered = hoveredTab === index && !isActive;
            const Icon = tab.iconName ? themeIcons[tab.iconName] : null;
            const image = safeMediaUrl(String(tab.iconImage || ""));
            return (
              <button
                key={tab.id || index}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(index)}
                onMouseEnter={() => setHoveredTab(index)}
                onMouseLeave={() => setHoveredTab(null)}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: tabPadding, border: `1px solid ${isActive ? String(props.tabActiveBackground || "#0c2f55") : dividerColor}`, borderBottom: isActive ? `2px solid ${String(props.tabActiveBackground || "#0c2f55")}` : `1px solid ${dividerColor}`, borderRadius: `${tabRadius} ${tabRadius} 0 0`, background: String(isActive ? props.tabActiveBackground || "#0c2f55" : isHovered ? props.tabHoverBackground || "#e2e8f0" : props.tabNormalBackground || "#f1f5f9"), color: String(isActive ? props.tabActiveColor || "#ffffff" : isHovered ? props.tabHoverColor || "#0c2f55" : props.tabNormalColor || "#334155"), fontWeight: isActive ? 700 : 500, cursor: "pointer" }}
              >
                {image ? <img src={image} alt="" style={{ width: tabIconSize, height: tabIconSize, objectFit: "contain" }} /> : Icon ? <Icon size={15} aria-hidden="true" style={{ width: tabIconSize, height: tabIconSize, color: tabIconColor }} /> : null}
                {tab.title || `Tab ${index + 1}`}
              </button>
            );
          })}
        </div>
        <div role="tabpanel" style={{ padding: cssLength(props.tabContentPadding, "14px"), color: String(props.tabContentColor || "#334155"), background: String(props.tabContentBackground || "#ffffff"), border: `1px solid ${dividerColor}`, borderTop: 0, minWidth: 0 }}>
          {active?.content || ""}
        </div>
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
        {"â˜…".repeat(Math.round(rating))}
        {"â˜†".repeat(maximum - Math.round(rating))}
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
          {String(props.currency || "â‚¹")}
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
          display: inlineStyle.display || "flex",
          flexDirection: inlineStyle.flexDirection || "row",
          alignItems: inlineStyle.alignItems || "stretch",
          justifyContent: inlineStyle.justifyContent || "flex-start",
          flexWrap: inlineStyle.flexWrap || "nowrap",
          gap: inlineStyle.gap || 12,
          overflowX: (inlineStyle.overflow || "auto") as CSSProperties["overflowX"],
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
          display: inlineStyle.display || "grid",
          gridTemplateColumns: inlineStyle.gridTemplateColumns || `repeat(${Math.max(
            1,
            Number(props.columns || 3),
          )}, minmax(0, 1fr))`,
          flexDirection: inlineStyle.flexDirection || "row",
          flexWrap: inlineStyle.flexWrap || "wrap",
          alignItems: inlineStyle.alignItems || "stretch",
          justifyContent: inlineStyle.justifyContent || "flex-start",
          gap: inlineStyle.gap || 12,
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

// LEGACY_WIDGET_DRAG_DROP_V3
function SortableCanvasNode({
  node,
  selectedId,
  device,
  parentNode,
  onSelect,
  onContextMenu,
  onAddLayout,
  onDelete,
}: {
  node: BuilderNode;
  selectedId: string | null;
  device: BuilderDevice;
  parentNode?: BuilderNode | null;
  onSelect: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  onAddLayout: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const locked = Boolean(node.locked || node.advanced?.locked);
  const sortable = useSortable({
    id: node.id,
    disabled: locked,
    data: { kind: "node", nodeId: node.id, nodeType: node.type },
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
  const widgetDefinition = BUILDER_WIDGETS.find((item) => item.type === node.type);
  const NodeIcon = widgetDefinition
    ? (LucideIcons[widgetDefinition.icon as keyof typeof LucideIcons] as typeof LayoutGrid)
    : LayoutGrid;

  return (
    <div
      ref={sortable.setNodeRef}
      {...(!isLayout ? sortable.attributes : {})}
      {...(!isLayout ? sortable.listeners : {})}

      data-builder-node-type={node.type}
      className={`${styles.canvasNode} ${
        selected ? styles.canvasNodeSelected : ""
      } ${sortable.isDragging ? styles.canvasNodeDragging : ""}`}
      style={{
        ...getCanvasFlexItemStyle(node, device, parentNode),
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: node.enabled ? 1 : 0.45,
        cursor: locked ? "not-allowed" : sortable.isDragging ? "grabbing" : "grab",
        touchAction: "pan-y",
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target instanceof Element && event.target.closest("a")) {
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
      {isLayout ? (
        <div
          className={styles.nodeToolbar}
          role="toolbar"
          aria-label={`${node.label} layout actions`}
        >
          <span className={styles.nodeToolbarActions}>
            <button
              type="button"
              title={`Add a container inside ${node.label}`}
              aria-label={`Add a container inside ${node.label}`}
              disabled={locked}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAddLayout(node.id);
              }}
            >
              <Plus size={13} />
            </button>
          </span>

          <button
            type="button"
            className={styles.layoutToolbarDrag}
            title={locked ? "Element locked" : "Drag to move"}
            aria-label={locked ? "Element locked" : `Move ${node.label}`}
            disabled={locked}
            {...sortable.attributes}
            {...sortable.listeners}
            onClick={(event) => event.stopPropagation()}
          >
            <Move size={13} aria-hidden="true" />
          </button>
          <span className={styles.canvasDimensionIndicators}>
            {(() => {
              const info = getCanvasWidthIndicator(node, device, parentNode);
              if (!info) return null;
              const fill = info.percentage !== null
                ? Math.max(0, Math.min(100, info.percentage))
                : /^auto\b/i.test(info.label) ? 0 : 100;
              return (
                <span className={styles.canvasDimensionBadge} title={`Width: ${info.label}`}>
                  <strong>W</strong>
                  <span className={styles.canvasDimensionValue}>{info.label}</span>
                  <span className={styles.canvasDimensionTrack} aria-hidden="true">
                    <span style={{ width: `${fill}%` }} />
                  </span>
                </span>
              );
            })()}
            {(() => {
              const info = getCanvasHeightIndicator(node, device);
              if (!info) return null;
              const fill = info.percentage !== null
                ? Math.max(0, Math.min(100, info.percentage))
                : /^auto\b/i.test(info.label) ? 0 : 100;
              return (
                <span className={styles.canvasDimensionBadge} title={`Height: ${info.label}`}>
                  <strong>H</strong>
                  <span className={styles.canvasDimensionValue}>{info.label}</span>
                  <span className={styles.canvasDimensionTrack} aria-hidden="true">
                    <span style={{ width: `${fill}%` }} />
                  </span>
                </span>
              );
            })()}
          </span>

          <span className={styles.nodeToolbarActions}>
            <button
              type="button"
              title={`Delete ${node.label}`}
              aria-label={`Delete ${node.label}`}
              disabled={locked}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDelete(node.id);
              }}
            >
              <Trash2 size={13} />
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          className={styles.widgetEditButton}
          title={`Edit ${node.label}`}
          aria-label={`Edit ${node.label}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(node.id);
          }}
        >
          <LucideIcons.Pencil size={14} aria-hidden="true" />
        </button>
      )}
      {isLayout ? (
        <div
          className={node.type === "section" ? styles.previewSection : styles.nodePreview}
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
                      parentNode={node}
                      onSelect={onSelect}
                      onContextMenu={onContextMenu}
                      onAddLayout={onAddLayout}
                      onDelete={onDelete}
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
  const [layoutPickerContext, setLayoutPickerContext] = useState<LayoutPickerContext>(null);
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

  // Page/Post builders show the site's saved Header and Footer around the
  // editable page canvas, just like a front-end template preview. These nodes
  // are read-only here; they remain editable in Header/Footer Builder.
  const [globalHeaderPreview, setGlobalHeaderPreview] =
    useState<GlobalTemplatePreview | null>(null);
  const [globalFooterPreview, setGlobalFooterPreview] =
    useState<GlobalTemplatePreview | null>(null);

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
    if (target.kind === "header" || target.kind === "footer") {
      setGlobalHeaderPreview(null);
      setGlobalFooterPreview(null);
      return;
    }

    let cancelled = false;

    const loadTemplate = async (
      key: "header:primary" | "footer:primary",
    ): Promise<GlobalTemplatePreview | null> => {
      const response = await fetch(
        `/api/admin/builder/documents?documentKey=${encodeURIComponent(key)}`,
        { cache: "no-store" },
      );

      if (!response.ok) return null;

      const result = (await response.json()) as {
        success?: boolean;
        document?: {
          title?: unknown;
          status?: unknown;
          layout?: { version?: unknown; root?: unknown };
        } | null;
      };

      const document = result.document;
      if (
        !result.success ||
        !document ||
        document.layout?.version !== 1 ||
        !Array.isArray(document.layout.root)
      ) {
        return null;
      }

      return {
        title: typeof document.title === "string" ? document.title : key,
        status: typeof document.status === "string" ? document.status : "DRAFT",
        root: document.layout.root as BuilderNode[],
      };
    };

    const loadGlobalTemplates = async () => {
      try {
        const [header, footer] = await Promise.all([
          loadTemplate("header:primary"),
          loadTemplate("footer:primary"),
        ]);

        if (!cancelled) {
          setGlobalHeaderPreview(header);
          setGlobalFooterPreview(footer);
        }
      } catch (templateError) {
        console.warn("Unable to load global Header/Footer preview:", templateError);
        if (!cancelled) {
          setGlobalHeaderPreview(null);
          setGlobalFooterPreview(null);
        }
      }
    };

    void loadGlobalTemplates();

    return () => {
      cancelled = true;
    };
  }, [target.kind]);

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

  const addSection = () => {
    setContextMenu(null);
    setLayoutPickerContext({ parentId: null, rootSection: true });
  };

  const openNestedLayoutPicker = (parentId: string) => {
    setContextMenu(null);
    setLayoutPickerContext({ parentId, rootSection: false });
  };

  const createStructuredContainer = (
    selection: BuilderStructureSelection,
    label = "Container",
  ): BuilderNode => {
    const createCell = (index: number, flexGrow?: number) => {
      const cell = createDefaultNode(
        "container",
        selection.mode === "grid" ? `Grid Cell ${index + 1}` : `Column ${index + 1}`,
        makeId("container"),
        { contentWidth: "100%", htmlTag: "div", layoutCell: true },
        [],
      );

      const nextStyles: BuilderStyle = {
        ...cell.styles,
        minHeight: { desktop: "90px" },
        gap: { desktop: "0px" },
        rowGap: { desktop: "0px" },
        columnGap: { desktop: "0px" },
      };

      if (flexGrow !== undefined) {
        delete nextStyles.width;
        nextStyles.flexGrow = { desktop: String(flexGrow) };
        nextStyles.flexShrink = { desktop: "1" };
        nextStyles.flexBasis = { desktop: "0%" };
      }

      cell.styles = nextStyles;
      return cell;
    };

    const container = createDefaultNode(
      "container",
      label,
      makeId("container"),
      { contentWidth: "100%", htmlTag: "div" },
      [],
    );

    if (selection.mode === "grid") {
      const rows = Math.max(1, Math.min(12, Math.floor(selection.rows)));
      const columns = Math.max(1, Math.min(12, Math.floor(selection.columns)));
      const cells = Array.from({ length: rows * columns }, (_, index) => createCell(index));

      container.children = cells;
      container.styles = {
        ...container.styles,
        display: { desktop: "grid" },
        direction: { desktop: "row" },
        gridTemplateColumns: { desktop: `repeat(${columns}, minmax(0, 1fr))` },
        gridTemplateRows: { desktop: `repeat(${rows}, minmax(100px, auto))` },
        gridAutoFlow: { desktop: "row" },
        gap: { desktop: "0px" },
        rowGap: { desktop: "0px" },
        columnGap: { desktop: "0px" },
      };
      return container;
    }

    const rows = selection.rows.length ? selection.rows : [[1]];
    if (rows.length === 1) {
      container.children = rows[0].map((weight, index) => createCell(index, weight));
      container.styles = {
        ...container.styles,
        display: { desktop: "flex" },
        direction: { desktop: "row" },
        flexWrap: { desktop: "nowrap" },
        gap: { desktop: "0px" },
        rowGap: { desktop: "0px" },
        columnGap: { desktop: "0px" },
      };
      return container;
    }

    container.children = rows.map((weights, rowIndex) => {
      const row = createDefaultNode(
        "row",
        `Row ${rowIndex + 1}`,
        makeId("row"),
        { htmlTag: "div", layoutRow: true },
        weights.map((weight, columnIndex) => createCell(columnIndex, weight)),
      );
      row.styles = {
        ...row.styles,
        display: { desktop: "flex" },
        direction: { desktop: "row" },
        flexWrap: { desktop: "nowrap" },
        gap: { desktop: "0px" },
        rowGap: { desktop: "0px" },
        columnGap: { desktop: "0px" },
      };
      return row;
    });
    container.styles = {
      ...container.styles,
      display: { desktop: "flex" },
      direction: { desktop: "column" },
      flexWrap: { desktop: "nowrap" },
      gap: { desktop: "0px" },
      rowGap: { desktop: "0px" },
      columnGap: { desktop: "0px" },
    };
    return container;
  };

  const createLayoutFromPicker = (selection: BuilderStructureSelection) => {
    if (!layoutPickerContext) return;

    const container = createStructuredContainer(selection);

    if (layoutPickerContext.rootSection) {
      const section = createDefaultNode(
        "section",
        "Section",
        makeId("section"),
        { contentWidth: "boxed", containerWidth: "1200px", htmlTag: "section" },
        [container],
      );
      section.styles = {
        ...section.styles,
        gap: { desktop: "0px" },
        rowGap: { desktop: "0px" },
        columnGap: { desktop: "0px" },
      };
      commitRoot([...layout.root, section]);
      setSelectedId(section.id);
    } else {
      const parentId = layoutPickerContext.parentId;
      const parent = parentId ? findNode(layout.root, parentId) : null;
      if (!parent || !LAYOUT_TYPES.has(parent.type)) {
        setError("Select a Section or Container before adding a nested structure.");
        setLayoutPickerContext(null);
        return;
      }
      commitRoot(insertTree(layout.root, parent.id, container));
      setSelectedId(container.id);
    }

    setLayoutPickerContext(null);
    setActivePanel("settings");
    setInspectorTab("layout");
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

  const updateResponsiveProps = (values: Record<string, unknown>) => {
    if (!selectedId) return;
    commitRoot(
      updateTree(layout.root, selectedId, (node) => ({
        ...node,
        props: Object.entries(values).reduce(
          (currentProps, [key, value]) => setBuilderPropForDevice(currentProps, key, value, device),
          node.props,
        ),
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

  // ELEMENTOR SIBLING WIDTH DISTRIBUTION V3 START
  const updateResponsiveStyle = (key: keyof BuilderStyle, value: unknown) => {
    if (key !== "width" || !selectedId) {
      updateResponsiveStyles([[key, value]]);
      return;
    }

    const selectedLayoutNode = findNode(layout.root, selectedId);
    if (!selectedLayoutNode || !LAYOUT_TYPES.has(selectedLayoutNode.type)) {
      updateResponsiveStyles([[key, value]]);
      return;
    }

    const widthText = String(value ?? "").trim();
    const isAutoWidth = !widthText || widthText.toLowerCase() === "auto";
    const parentId = findParent(layout.root, selectedId);
    const parent = parentId ? findNode(layout.root, parentId) : null;
    const parentStyles = parent ? resolveBuilderStyles(parent.styles, device) : null;
    const parentDisplay = parentStyles
      ? String(getResponsiveValue(parentStyles.display, device) || (parent?.type === "grid" ? "grid" : "flex"))
      : "";
    const parentDirection = parentStyles
      ? String(
          getResponsiveValue(parentStyles.direction, device) ||
            (parent?.type === "row" ? "row" : "column"),
        )
      : "";

    const setStyleForDevice = (
      styles: BuilderStyle,
      styleKey: keyof BuilderStyle,
      nextValue: unknown,
    ): BuilderStyle => {
      const currentValue = styles[styleKey] as unknown;
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

      return {
        ...styles,
        [styleKey]: { ...current, [device]: nextValue },
      } as BuilderStyle;
    };

    const setNodeWidthMode = (
      node: BuilderNode,
      mode: "custom" | "default",
    ): BuilderNode => {
      const currentMode = node.advanced?.widthMode;
      const responsiveMode =
        typeof currentMode === "string"
          ? { desktop: currentMode }
          : currentMode && typeof currentMode === "object"
            ? (currentMode as Record<string, unknown>)
            : {};
      return {
        ...node,
        advanced: {
          ...(node.advanced || {}),
          widthMode: {
            ...responsiveMode,
            [device]: mode,
          } as NonNullable<BuilderNode["advanced"]>["widthMode"],
        },
      };
    };

    // FLEX ROW: preserve every previously entered custom sibling width.
    // Only auto/default siblings receive flex-grow, so the remaining space is
    // shared equally. Example: 10% + four auto siblings = 10% + 22.5% each.
    if (
      parent &&
      parentDisplay === "flex" &&
      parentDirection.startsWith("row")
    ) {
      commitRoot(
        updateTree(layout.root, parent.id, (parentNode) => ({
          ...parentNode,
          children: (parentNode.children || []).map((child) => {
            if (!LAYOUT_TYPES.has(child.type)) return child;

            const isSelected = child.id === selectedId;
            const storedWidth = String(
              getResponsiveValue(child.styles.width, device) || "",
            ).trim();
            const storedBasis = String(
              getResponsiveValue(child.styles.flexBasis, device) || "",
            ).trim();
            const storedMode = getWidthMode(child.advanced?.widthMode, device);
            const isDefaultFullWidth = storedWidth === "100%" && storedMode === "default";
            const isStoredAuto = !storedWidth || storedWidth.toLowerCase() === "auto";
            const hasSavedCustomWidth = Boolean(
              !isStoredAuto && !isDefaultFullWidth ||
              storedMode === "custom" ||
              storedMode === "full" ||
              storedMode === "inline" ||
              (storedBasis && storedBasis !== "0%" && storedBasis !== "auto"),
            );

            const nextWidth = isSelected
              ? (isAutoWidth ? "auto" : widthText)
              : hasSavedCustomWidth
                ? (storedWidth || (storedMode === "full" ? "100%" : "fit-content"))
                : "auto";
            const nextBasis = isSelected
              ? (isAutoWidth ? "0%" : widthText)
              : hasSavedCustomWidth
                ? (storedBasis && storedBasis !== "0%" ? storedBasis : nextWidth)
                : "0%";
            const storedGrow = Number(
              getResponsiveValue(child.styles.flexGrow, device) || 0,
            );
            const nextGrow = isSelected
              ? (isAutoWidth ? "1" : "0")
              : hasSavedCustomWidth
                ? "0"
                : (storedGrow > 0 ? String(storedGrow) : "1");
            const nextMode = isSelected
              ? (isAutoWidth ? "default" : "custom")
              : hasSavedCustomWidth
                ? "custom"
                : "default";

            let nextStyles = child.styles;
            nextStyles = setStyleForDevice(nextStyles, "width", nextWidth);
            nextStyles = setStyleForDevice(nextStyles, "flexBasis", nextBasis);
            nextStyles = setStyleForDevice(nextStyles, "flexGrow", nextGrow);
            nextStyles = setStyleForDevice(nextStyles, "flexShrink", "1");

            return setNodeWidthMode(
              { ...child, styles: nextStyles },
              nextMode,
            );
          }),
        })),
      );
      return;
    }
    // CSS GRID: persist a separate width for each column. Custom columns keep
    // their widths; untouched 1fr columns automatically divide the remainder.
    if (parent && parentDisplay === "grid") {
      const directLayoutChildren = (parent.children || []).filter((child) =>
        LAYOUT_TYPES.has(child.type),
      );
      const selectedIndex = directLayoutChildren.findIndex((child) => child.id === selectedId);
      if (selectedIndex >= 0 && directLayoutChildren.length > 0) {
        const currentTemplate = String(
          getResponsiveValue(parentStyles?.gridTemplateColumns, device) || "",
        ).trim();
        const repeatMatch = currentTemplate.match(/^repeat\(\s*(\d+)/i);
        const explicitTracks = currentTemplate.match(/minmax\(\s*0\s*,\s*[^)]+\)|[^\s]+/gi) || [];
        const inferredColumns = repeatMatch
          ? Number(repeatMatch[1])
          : explicitTracks.length > 0
            ? explicitTracks.length
            : directLayoutChildren.length;
        const gridColumns = Math.max(
          1,
          Math.min(12, inferredColumns || directLayoutChildren.length),
        );
        const selectedColumn = selectedIndex % gridColumns;
        const columnWidths: Array<string | null> = Array.from(
          { length: gridColumns },
          () => null,
        );

        for (let column = 0; column < gridColumns; column += 1) {
          const columnChild = directLayoutChildren.find(
            (_child, index) => index % gridColumns === column,
          );
          if (!columnChild) continue;

          const savedWidth = String(
            getResponsiveValue(columnChild.styles.width, device) || "",
          ).trim();
          const savedMode = getWidthMode(columnChild.advanced?.widthMode, device);
          const savedBasis = String(
            getResponsiveValue(columnChild.styles.flexBasis, device) || "",
          ).trim();
          const defaultFullWidth = savedWidth === "100%" && savedMode === "default";
          const savedAuto = !savedWidth || savedWidth.toLowerCase() === "auto";
          const isCustom = Boolean(
            !savedAuto && !defaultFullWidth ||
            savedMode === "custom" ||
            savedMode === "full" ||
            savedMode === "inline" ||
            (savedBasis && savedBasis !== "0%" && savedBasis !== "auto"),
          );
          if (isCustom) {
            columnWidths[column] = savedWidth || (savedMode === "full" ? "100%" : "fit-content");
          }
        }

        columnWidths[selectedColumn] = isAutoWidth ? null : widthText;
        const nextTemplate = columnWidths
          .map((columnWidth) =>
            columnWidth
              ? `minmax(0, ${columnWidth})`
              : "minmax(0, 1fr)",
          )
          .join(" ");

        commitRoot(
          updateTree(layout.root, parent.id, (parentNode) => {
            const nextParentStyles = setStyleForDevice(
              parentNode.styles,
              "gridTemplateColumns",
              nextTemplate,
            );
            let layoutIndex = -1;
            const nextChildren = (parentNode.children || []).map((child) => {
              if (!LAYOUT_TYPES.has(child.type)) return child;
              layoutIndex += 1;
              const column = layoutIndex % gridColumns;
              const savedColumnWidth = columnWidths[column] || "auto";
              const nextStyles = setStyleForDevice(
                child.styles,
                "width",
                savedColumnWidth,
              );
              return setNodeWidthMode(
                { ...child, styles: nextStyles },
                "default",
              );
            });
            return {
              ...parentNode,
              styles: nextParentStyles,
              children: nextChildren,
            };
          }),
        );
        return;
      }
    }
    // Standalone, Section, vertical Flex and other layout nodes keep their own
    // explicit width. Only the active device is changed.
    commitRoot(
      updateTree(layout.root, selectedId, (currentNode) => {
        const nextStyles = setStyleForDevice(
          currentNode.styles,
          "width",
          isAutoWidth ? "auto" : widthText,
        );
        return setNodeWidthMode(
          { ...currentNode, styles: nextStyles },
          isAutoWidth ? "default" : "custom",
        );
      }),
    );
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

      const expectedMime = mediaType === "videoFile" ? "video/" : mediaType === "audioFile" ? "audio/" : "image/";
      setMediaItems(
        items.filter((item: MediaItem) => item.mimeType?.startsWith(expectedMime)),
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
        if (mediaTarget === "videoFile") {
          return {
            ...node,
            props: {
              ...node.props,
              source: "self-hosted",
              url: mediaUrl,
              mediaId: item.id,
            },
          };
        }

        if (mediaTarget === "audioFile") {
          return {
            ...node,
            props: {
              ...node.props,
              source: "self-hosted",
              url: mediaUrl,
              mediaId: item.id,
            },
          };
        }

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

        if (mediaTarget === "menuMobileLogo") {
          return {
            ...node,
            props: {
              ...node.props,
              mobileLogo: mediaUrl,
              mobileLogoMediaId: item.id,
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
    const deviceProps = resolveBuilderProps(node.props, device);
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
          ? { id: `icon-item-${Date.now()}`, text: "New list item", iconName: "Check", iconImage: "", linkType: "normal", dynamicLink: "current-page", url: "", linkTarget: "_self" }
          : node.type === "price-list"
            ? { id: `price-${Date.now()}`, title: "Item", price: "", description: "" }
            : { id: `item-${Date.now()}`, title: `Item ${repeaterItems.length + 1}`, content: "" };
      updateProps(repeaterKey, [...repeaterItems, base]);
    };
    const removeRepeaterItem = (index: number) => updateProps(repeaterKey, repeaterItems.filter((_, i) => i !== index));
    const duplicateRepeaterItem = (index: number) => {
      const source = repeaterItems[index];
      if (!source) return;
      const copy = { ...source, id: `${String(source.id || repeaterKey)}-copy-${Date.now()}` };
      const next = [...repeaterItems];
      next.splice(index + 1, 0, copy);
      updateProps(repeaterKey, next);
    };

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
            <>
              <Field label="Text Content â€” Visual Editor">
                <BuilderRichTextEditor
                  value={String(node.props.content || "")}
                  onChange={(value) => updateProps("content", value)}
                />
              </Field>
              <p style={{ margin: "-2px 0 12px", color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
                Use the Code button in the editor toolbar to edit HTML. For widget-specific CSS, use Advanced â†’ Custom CSS; the selector is scoped to this widget.
              </p>
            </>
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
                  {String(themeIconLabels[String(node.props.iconName || "")] || node.props.iconName || "No Icon â€” choose icon")}
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

              <SegmentedControl
                label="Icon Position"
                value={String(deviceProps.iconPosition || "before")}
                options={[
                  { label: "", value: "before", title: "Before Text", icon: "ArrowLeft" },
                  { label: "", value: "after", title: "After Text", icon: "ArrowRight" },
                ]}
                onChange={(value) => updateResponsiveProp("iconPosition", value)}
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

          {node.type === "video" && (
            <>
              <ControlGroup title="Video Source" defaultOpen>
                <SelectControl
                  label="Source"
                  value={["auto", "youtube", "vimeo", "dailymotion", "videopress", "self-hosted"].includes(String(node.props.source || "auto")) ? String(node.props.source || "auto") : "auto"}
                  options={[
                    { label: "Auto Detect", value: "auto" },
                    { label: "YouTube", value: "youtube" },
                    { label: "Vimeo", value: "vimeo" },
                    { label: "Dailymotion", value: "dailymotion" },
                    { label: "VideoPress", value: "videopress" },
                    { label: "Self Hosted", value: "self-hosted" },
                  ]}
                  onChange={(value) => updateProps("source", value)}
                />
                <TextControl
                  label="Video Link / File URL"
                  value={String(node.props.url || "")}
                  onChange={(value) => updateProps("url", value)}
                  placeholder="YouTube, Vimeo or .mp4 URL"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
                  <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={() => void openMediaLibrary("videoFile")}>
                    <Video size={14} /> Choose Video
                  </button>
                  <Link href="/admin/media" target="_blank" rel="noopener noreferrer" style={{ ...BUTTON_STYLE, width: "100%", textDecoration: "none" }}>
                    <Upload size={14} /> Upload Video
                  </Link>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
                  <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={() => void openMediaLibrary("videoPoster")}>
                    <ImageIcon size={14} /> Choose Poster
                  </button>
                  <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={() => openImageUpload("videoPoster")}>
                    <Upload size={14} /> Upload Poster
                  </button>
                </div>
                {node.props.url ? (
                  <button type="button" style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 10, color: "#b42318" }} onClick={() => clearProps("url", "mediaId")}>
                    <X size={15} /> Remove Video
                  </button>
                ) : null}
                <TextControl label="Start Time (seconds)" type="number" value={String(node.props.startTime ?? "")} onChange={(value) => updateProps("startTime", value === "" ? "" : Math.max(0, Number(value) || 0))} />
                <TextControl label="End Time (seconds)" type="number" value={String(node.props.endTime ?? "")} onChange={(value) => updateProps("endTime", value === "" ? "" : Math.max(0, Number(value) || 0))} />
                <TextControl label="Poster Image URL" value={String(node.props.poster || "")} onChange={(value) => updateProps("poster", value)} />
                {node.props.poster ? (
                  <button type="button" style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 10, color: "#b42318" }} onClick={() => clearProps("poster", "posterMediaId")}>
                    <X size={15} /> Remove Poster
                  </button>
                ) : null}
                <p style={{ color: "#64748b", fontSize: 11, lineHeight: 1.5, margin: "6px 0 0" }}>
                  Upload MP4, WebM or MOV files in Admin Ã¢â€ â€™ Media, then choose them here.
                </p>
              </ControlGroup>

              <ControlGroup title="Playback Settings" defaultOpen>
                {([
                  ["autoplay", "Autoplay", false],
                  ["playOnMobile", "Play on Mobile", false],
                  ["muted", "Mute", false],
                  ["loop", "Loop", false],
                  ["controls", "Player Controls", true],
                  ["captions", "Captions", false],
                  ["privacyMode", "Privacy Mode", false],
                  ["lazyLoad", "Lazy Load", true],
                ] as const).map(([key, label, defaultValue]) => (
                  <Field key={key} label={label}>
                    <input type="checkbox" checked={node.props[key] === undefined ? defaultValue : Boolean(node.props[key])} onChange={(event) => updateProps(key, event.target.checked)} />
                  </Field>
                ))}
                <SelectControl label="Suggested Videos" value={String(node.props.suggestedVideos || "any")} options={[{ label: "Any Videos", value: "any" }, { label: "Current Channel", value: "current-channel" }]} onChange={(value) => updateProps("suggestedVideos", value)} />
                <Field label="Modest Branding"><input type="checkbox" checked={Boolean(node.props.modestBranding)} onChange={(event) => updateProps("modestBranding", event.target.checked)} /></Field>
                <Field label="Show Video Title"><input type="checkbox" checked={node.props.showTitle !== false} onChange={(event) => updateProps("showTitle", event.target.checked)} /></Field>
                <Field label="Show Creator Portrait"><input type="checkbox" checked={node.props.showPortrait !== false} onChange={(event) => updateProps("showPortrait", event.target.checked)} /></Field>
                <Field label="Show Creator Byline"><input type="checkbox" checked={node.props.showByline !== false} onChange={(event) => updateProps("showByline", event.target.checked)} /></Field>
                <Field label="Show Dailymotion Info"><input type="checkbox" checked={node.props.showInfo !== false} onChange={(event) => updateProps("showInfo", event.target.checked)} /></Field>
                <Field label="Show Dailymotion Logo"><input type="checkbox" checked={node.props.showLogo !== false} onChange={(event) => updateProps("showLogo", event.target.checked)} /></Field>
                <TextControl label="Captions File URL (.vtt)" value={String(node.props.captionsUrl || "")} onChange={(value) => updateProps("captionsUrl", value)} />
                <TextControl label="Captions Language" value={String(node.props.captionsLanguage || "en")} onChange={(value) => updateProps("captionsLanguage", value)} />
                <TextControl label="Captions Label" value={String(node.props.captionsLabel || "Captions")} onChange={(value) => updateProps("captionsLabel", value)} />
                <Field label="Show Download Button"><input type="checkbox" checked={node.props.downloadButton !== false} onChange={(event) => updateProps("downloadButton", event.target.checked)} /></Field>
                <SelectControl label="Preload" value={String(node.props.preload || "metadata")} options={[{ label: "Metadata", value: "metadata" }, { label: "Auto", value: "auto" }, { label: "None", value: "none" }]} onChange={(value) => updateProps("preload", value)} />
              </ControlGroup>

              <ControlGroup title="Image Overlay" defaultOpen>
                <Field label="Enable Image Overlay"><input type="checkbox" checked={Boolean(node.props.imageOverlay)} onChange={(event) => updateProps("imageOverlay", event.target.checked)} /></Field>
                <Field label="Show Play Icon"><input type="checkbox" checked={node.props.playIcon !== false} onChange={(event) => updateProps("playIcon", event.target.checked)} /></Field>
                <Field label="Open in Lightbox"><input type="checkbox" checked={Boolean(node.props.lightbox)} onChange={(event) => updateProps("lightbox", event.target.checked)} /></Field>
              </ControlGroup>
            </>
          )}

          {node.type === "audio" && (
            <>
              <TextControl label="Audio File URL" value={String(node.props.url || "")} onChange={(value) => updateProps("url", value)} placeholder="MP3, WAV, OGG or M4A URL" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
                <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={() => void openMediaLibrary("audioFile")}>
                  <Music size={14} /> Choose Audio
                </button>
                <Link href="/admin/media" target="_blank" rel="noopener noreferrer" style={{ ...BUTTON_STYLE, width: "100%", textDecoration: "none" }}>
                  <Upload size={14} /> Upload Audio
                </Link>
              </div>
              {node.props.url ? (
                <button type="button" style={{ ...BUTTON_STYLE, width: "100%", marginBottom: 10, color: "#b42318" }} onClick={() => clearProps("url", "mediaId")}>
                  <X size={15} /> Remove Audio
                </button>
              ) : null}
              <TextControl label="Audio Title" value={String(node.props.title || "")} onChange={(value) => updateProps("title", value)} />
              {(["controls", "autoplay", "loop"] as const).map((key) => (
                <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
                  <input type="checkbox" checked={key === "controls" ? node.props.controls !== false : Boolean(node.props[key])} onChange={(event) => updateProps(key, event.target.checked)} />
                </Field>
              ))}
              <SelectControl label="Preload" value={String(node.props.preload || "metadata")} options={[{ label: "Metadata", value: "metadata" }, { label: "Auto", value: "auto" }, { label: "None", value: "none" }]} onChange={(value) => updateProps("preload", value)} />
            </>
          )}

          {node.type === "lottie" && (
            <>
              <TextControl label="Lottie JSON URL" value={String(node.props.url || "")} onChange={(value) => updateProps("url", value)} />
              <Field label="Loop Animation"><input type="checkbox" checked={node.props.loop !== false} onChange={(event) => updateProps("loop", event.target.checked)} /></Field>
              <Field label="Autoplay"><input type="checkbox" checked={node.props.autoplay !== false} onChange={(event) => updateProps("autoplay", event.target.checked)} /></Field>
              <SelectControl label="Renderer" value={String(node.props.renderer || "svg")} options={["svg", "canvas", "html"].map((value) => ({ label: value.toUpperCase(), value }))} onChange={(value) => updateProps("renderer", value)} />
              <p style={{ color: "#64748b", fontSize: 12 }}>The URL must point to a Lottie JSON animation file.</p>
            </>
          )}          {node.type === "site-title" && (
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
                  {String(themeIconLabels[String(node.props.iconName || "")] || node.props.iconName || "No Icon â€” choose icon")}
                </button>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                <button type="button" style={BUTTON_STYLE} onClick={() => void openMediaLibrary("widgetIcon")}><ImageIcon size={14} /> Media Library</button>
                <button type="button" style={BUTTON_STYLE} onClick={() => openImageUpload("widgetIcon")}><Upload size={14} /> Upload</button>
              </div>
              {node.props.iconImage ? <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><img src={safeMediaUrl(String(node.props.iconImage))} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} /><button type="button" style={BUTTON_STYLE} onClick={() => clearProps("iconImage", "iconImageId")}>Remove image</button></div> : null}
              <UnitControl label="Icon Size" value={String(deviceProps.iconSize || "40px")} onChange={(value) => updateResponsiveProp("iconSize", value)} allowAuto={false} />
              <UnitControl label="Icon / Content Gap" value={String(deviceProps.gap || "12px")} onChange={(value) => updateResponsiveProp("gap", value)} allowAuto={false} />
              <ColorControl label="Icon Color" value={String(deviceProps.iconColor || "#3984e8")} onChange={(value) => updateResponsiveProp("iconColor", value)} />
              <TextControl
                label="Icon Symbol"
                value={String(node.props.symbol ?? "â˜…")}
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
              <SegmentedControl
                label="Icon Position"
                value={String(deviceProps.iconPosition || "top")}
                options={[
                  { label: "", value: "top", title: "Top", icon: "ArrowUp" },
                  { label: "", value: "bottom", title: "Bottom", icon: "ArrowDown" },
                  { label: "", value: "left", title: "Left", icon: "ArrowLeft" },
                  { label: "", value: "right", title: "Right", icon: "ArrowRight" },
                ]}
                onChange={(value) => updateResponsiveProp("iconPosition", value)}
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
              <TextControl label="Currency" value={String(node.props.currency || "â‚¹")} onChange={(value) => updateProps("currency", value)} />
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
              <ControlGroup title="Menu Settings" defaultOpen>
                <SelectControl
                  label="Select Menu"
                  value={String(node.props.menuId || "")}
                  options={[{ label: "Choose a menu", value: "" }, ...builderMenus.map((menu) => ({ label: menu.name, value: menu.id }))]}
                  onChange={(menuId) => {
                    if (!selectedId) return;
                    const requestId = ++menuRequestId.current;
                    const menu = builderMenus.find((entry) => entry.id === menuId);
                    const saveMenuSelection = async () => {
                      try {
                        let items: BuilderMenuItem[] = [];
                        if (menuId) {
                          const location = menu?.location || "HEADER";
                          const response = await fetch(`/api/public/menus/${location}?menuId=${encodeURIComponent(menuId)}`, { cache: "no-store" });
                          const result = await response.json();
                          if (!response.ok || !result.success) throw new Error(result.message || "Unable to load menu links.");
                          items = normalizePublicMenuItems(result.menu?.items);
                        }
                        if (menuRequestId.current !== requestId) return;
                        commitRoot(updateTree(layout.root, selectedId, (currentNode) => ({
                          ...currentNode,
                          props: { ...currentNode.props, menuId, menuLocation: menu?.location || "HEADER", items },
                        })));
                        setError("");
                      } catch (menuError) {
                        if (menuRequestId.current !== requestId) return;
                        setError(menuError instanceof Error ? menuError.message : "Unable to load menu links.");
                      }
                    };
                    void saveMenuSelection();
                  }}
                />
                <SelectControl label="Menu Layout" value={String(node.props.orientation || "horizontal")} options={[{ label: "Horizontal", value: "horizontal" }, { label: "Vertical", value: "vertical" }]} onChange={(value) => updateProps("orientation", value)} />
                <SelectControl label="Horizontal Menu Position" value={String(deviceProps.alignment || "left")} options={[{ label: "Left", value: "left" }, { label: "Center", value: "center" }, { label: "Right", value: "right" }, { label: "Justified", value: "justify" }]} onChange={(value) => updateResponsiveProp("alignment", value)} />
                <SelectControl label="Dropdown Open As" value={String(node.props.dropdownOpenAs || "hover")} options={[{ label: "Hover", value: "hover" }, { label: "Click", value: "click" }]} onChange={(value) => updateProps("dropdownOpenAs", value)} />
                <Field label="Menu Item Icon (Optional)">
                  <button
                    type="button"
                    style={{ ...BUTTON_STYLE, width: "100%", justifyContent: "flex-start" }}
                    onClick={() => setIconPickerTarget({ kind: "nodeProp", key: "itemIconName", value: String(node.props.itemIconName || "") })}
                  >
                    {(() => {
                      const SelectedIcon = themeIcons[String(node.props.itemIconName || "")];
                      return SelectedIcon ? <SelectedIcon size={16} /> : <Search size={16} />;
                    })()}
                    {String(themeIconLabels[String(node.props.itemIconName || "")] || node.props.itemIconName || "No Icon")}
                  </button>
                </Field>
                <Field label="Submenu Indicator Icon">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                    <button
                      type="button"
                      style={{ ...BUTTON_STYLE, width: "100%", justifyContent: "flex-start" }}
                      disabled={node.props.submenuIndicator === "none" || node.props.submenuIndicator === ""}
                      onClick={() => setIconPickerTarget({ kind: "nodeProp", key: "submenuIndicator", value: String(node.props.submenuIndicator ?? "ChevronDown") })}
                    >
                      {(() => {
                        const iconName = typeof node.props.submenuIndicator === "string" ? node.props.submenuIndicator : "ChevronDown";
                        const SelectedIcon = iconName ? themeIcons[iconName] : null;
                        return SelectedIcon ? <SelectedIcon size={16} /> : <Search size={16} />;
                      })()}
                      {node.props.submenuIndicator === "none" || node.props.submenuIndicator === "" ? "No Icon" : String(themeIconLabels[String(node.props.submenuIndicator || "ChevronDown")] || node.props.submenuIndicator || "ChevronDown")}
                    </button>
                    <button
                      type="button"
                      style={BUTTON_STYLE}
                      onClick={() => updateProps("submenuIndicator", node.props.submenuIndicator === "none" || node.props.submenuIndicator === "" ? "ChevronDown" : "none")}
                    >
                      {node.props.submenuIndicator === "none" || node.props.submenuIndicator === "" ? "Show" : "Hide"}
                    </button>
                  </div>
                </Field>
                <SelectControl label="Responsive Breakpoint" value={String(node.props.mobileBreakpoint || 1024)} options={[{ label: "Mobile (767px)", value: "767" }, { label: "Tablet (1024px)", value: "1024" }]} onChange={(value) => updateProps("mobileBreakpoint", Number(value))} />
                <Field label="Enable One Page Menu"><input type="checkbox" checked={Boolean(node.props.onePage)} onChange={(event) => updateProps("onePage", event.target.checked)} /></Field>
                <Field label="Enable Mobile Menu"><input type="checkbox" checked={node.props.mobileToggle !== false} onChange={(event) => updateProps("mobileToggle", event.target.checked)} /></Field>
              </ControlGroup>

              <ControlGroup title="Mobile Menu Settings" defaultOpen={false}>
                {node.props.mobileLogo ? (
                  <div style={{ border: "1px solid #dbe3ed", borderRadius: 8, padding: 8, marginBottom: 10 }}>
                    <img src={safeMediaUrl(String(node.props.mobileLogo))} alt={String(node.props.mobileLogoAlt || "Mobile menu logo")} style={{ display: "block", width: "100%", maxWidth: 180, maxHeight: 70, objectFit: "contain" }} />
                    <button type="button" style={{ ...BUTTON_STYLE, marginTop: 8, color: "#b42318" }} onClick={() => clearProps("mobileLogo", "mobileLogoMediaId")}>Remove Mobile Logo</button>
                  </div>
                ) : null}
                <Field label="Mobile Menu Logo">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button type="button" style={BUTTON_STYLE} onClick={() => void openMediaLibrary("menuMobileLogo")}><ImageIcon size={14} /> Media Library</button>
                    <button type="button" style={BUTTON_STYLE} onClick={() => openImageUpload("menuMobileLogo")}><Upload size={14} /> Upload Image</button>
                  </div>
                </Field>
                <TextControl label="Logo Alt Text" value={String(node.props.mobileLogoAlt || "Mobile menu logo")} onChange={(value) => updateProps("mobileLogoAlt", value)} />
                <SelectControl label="Menu Link" value={String(node.props.mobileLogoLinkType || "homepage")} options={[{ label: "Default (Home)", value: "homepage" }, { label: "Current Page", value: "current-page" }, { label: "Custom Link", value: "custom" }]} onChange={(value) => updateProps("mobileLogoLinkType", value)} />
                {node.props.mobileLogoLinkType === "custom" ? <TextControl label="Custom Menu Link" value={String(node.props.mobileLogoLink || "/")} onChange={(value) => updateProps("mobileLogoLink", value)} list="builder-link-targets" onFocus={() => void loadLinkSuggestions()} /> : null}
                <Field label="Hamburger / Open Icon">
                  <button
                    type="button"
                    style={{ ...BUTTON_STYLE, width: "100%", justifyContent: "flex-start" }}
                    onClick={() => setIconPickerTarget({ kind: "nodeProp", key: "openIcon", value: String(node.props.openIcon ?? "Menu") })}
                  >
                    {(() => {
                      const iconName = String(node.props.openIcon ?? "Menu");
                      const SelectedIcon = iconName ? themeIcons[iconName] : null;
                      return SelectedIcon ? <SelectedIcon size={18} /> : <Search size={18} />;
                    })()}
                    {String(themeIconLabels[String(node.props.openIcon ?? "Menu")] || node.props.openIcon || "No Icon")}
                  </button>
                </Field>
                <Field label="Close Icon">
                  <button
                    type="button"
                    style={{ ...BUTTON_STYLE, width: "100%", justifyContent: "flex-start" }}
                    onClick={() => setIconPickerTarget({ kind: "nodeProp", key: "closeIcon", value: String(node.props.closeIcon ?? "X") })}
                  >
                    {(() => {
                      const iconName = String(node.props.closeIcon ?? "X");
                      const SelectedIcon = iconName ? themeIcons[iconName] : null;
                      return SelectedIcon ? <SelectedIcon size={18} /> : <Search size={18} />;
                    })()}
                    {String(themeIconLabels[String(node.props.closeIcon ?? "X")] || node.props.closeIcon || "No Icon")}
                  </button>
                </Field>
                <SelectControl label="Submenu Click Area" value={String(node.props.submenuClickArea || "icon")} options={[{ label: "Icon Only", value: "icon" }, { label: "Full Menu Text", value: "full" }]} onChange={(value) => updateProps("submenuClickArea", value)} />
                <Field label="Close Menu on Anchor Click"><input type="checkbox" checked={node.props.closeOnAnchorClick !== false} onChange={(event) => updateProps("closeOnAnchorClick", event.target.checked)} /></Field>
                <SelectControl label="Mobile Menu Layout" value={String(node.props.mobileLayout || "slide-in")} options={[{ label: "Dropdown", value: "dropdown" }, { label: "Slide In", value: "slide-in" }, { label: "Full Screen", value: "fullscreen" }, { label: "Off Canvas", value: "off-canvas" }]} onChange={(value) => updateProps("mobileLayout", value)} />
                <SelectControl label="Mobile Menu Position" value={String(node.props.mobilePosition || "right")} options={[{ label: "Left", value: "left" }, { label: "Right", value: "right" }]} onChange={(value) => updateProps("mobilePosition", value)} />
                <UnitControl label="Mobile Menu Width" value={String(deviceProps.mobileWidth || "320px")} onChange={(value) => updateResponsiveProp("mobileWidth", value)} />
                <UnitControl label="Mobile Icon Size" value={String(deviceProps.mobileIconSize || "24px")} onChange={(value) => updateResponsiveProp("mobileIconSize", value)} allowAuto={false} />
              </ControlGroup>
              <p style={{ color: "#64748b", fontSize: 12, margin: "8px 0 0" }}>Menu pages and Custom Links are managed under Admin â†’ Menus. Select that menu above to load its saved structure.</p>
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
              value={String(deviceProps.height || "40px")}
              onChange={(value) => updateResponsiveProp("height", value)}
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
                value={String(deviceProps.thickness || "1px")}
                onChange={(value) => updateResponsiveProp("thickness", value)}
                allowAuto={false}
              />
            </>
          )}

          {node.type === "icon" && (
            <>
              <Field label="Icon Library">
                <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={() => setIconPickerTarget({ kind: "widget", value: String(node.props.iconName || "") })}>
                  {(() => { const SelectedIcon = themeIcons[String(node.props.iconName || "")]; return SelectedIcon ? <SelectedIcon size={16} /> : <Search size={16} />; })()}
                  {String(themeIconLabels[String(node.props.iconName || "")] || node.props.iconName || "No Icon â€” choose icon")}
                </button>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                <button type="button" style={BUTTON_STYLE} onClick={() => void openMediaLibrary("widgetIcon")}><ImageIcon size={14} /> Media Library</button>
                <button type="button" style={BUTTON_STYLE} onClick={() => openImageUpload("widgetIcon")}><Upload size={14} /> Upload image</button>
              </div>
              {node.props.iconImage ? <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><img src={safeMediaUrl(String(node.props.iconImage))} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} /><button type="button" style={BUTTON_STYLE} onClick={() => clearProps("iconImage", "iconImageId")}>Remove image</button></div> : null}
              <TextControl
                label="Icon Symbol"
                value={String(node.props.symbol ?? "â˜…")}
                onChange={(value) => updateProps("symbol", value)}
              />

              <UnitControl
                label="Icon Size"
                value={String(deviceProps.size || "24px")}
                onChange={(value) => updateResponsiveProp("size", value)}
                allowAuto={false}
              />
            </>
          )}

          {node.type === "icon-list" ? (
            <ControlGroup title="Layout" defaultOpen>
              <SegmentedControl label="List Layout" value={String(deviceProps.layout || "list")} options={[{ label: "", value: "list", title: "Vertical List", icon: "List" }, { label: "", value: "inline", title: "Inline", icon: "Rows3" }, { label: "", value: "grid", title: "Grid", icon: "Grid3X3" }]} onChange={(value) => updateResponsiveProp("layout", value)} />
              {deviceProps.layout === "grid" ? <TextControl label="Columns" type="number" value={String(deviceProps.columns || 2)} onChange={(value) => updateResponsiveProp("columns", Math.max(1, Math.min(6, Number(value) || 1)))} /> : null}
            </ControlGroup>
          ) : null}

          {(node.type === "accordion" || node.type === "tabs" || node.type === "social-icons" || node.type === "icon-list" || node.type === "price-list") && (
            <ControlGroup title="Items" defaultOpen>
              {repeaterItems.map((entry, index) => (
                <div key={String(entry.id || index)} style={{ border: "1px solid #dbe3ed", borderRadius: 8, padding: 10, marginBottom: 10, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <strong style={{ fontSize: 12 }}>{node.type === "social-icons" ? `Social icon ${index + 1}` : node.type === "icon-list" ? `List item ${index + 1}` : `Item ${index + 1}`}</strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button type="button" aria-label="Duplicate item" title="Duplicate item" style={BUTTON_STYLE} onClick={() => duplicateRepeaterItem(index)}><Copy size={14} /></button>
                      <button type="button" aria-label="Remove item" title="Delete item" style={{ ...BUTTON_STYLE, color: "#b42318" }} onClick={() => removeRepeaterItem(index)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {node.type === "social-icons" ? (
                    <>
                      <Field label="Social / Brand Icon (Optional)">
                        <button
                          type="button"
                          style={{ ...BUTTON_STYLE, width: "100%", justifyContent: "flex-start" }}
                          onClick={() => setIconPickerTarget({ kind: "repeaterItem", index, key: "icons", value: String(entry.iconName || "") })}
                        >
                          {(() => {
                            const SelectedIcon = themeIcons[String(entry.iconName || "")];
                            return SelectedIcon ? <SelectedIcon size={18} /> : <Search size={18} />;
                          })()}
                          {String(themeIconLabels[String(entry.iconName || "")] || entry.iconName || "Choose social / brand icon")}
                        </button>
                      </Field>
                      <TextControl label="Label / Network" value={String(entry.label || entry.name || "")} onChange={(value) => updateRepeaterItem(index, { label: value, name: value })} />
                      <TextControl label="URL" value={String(entry.url || "")} onChange={(value) => updateRepeaterItem(index, { url: value })} placeholder="https://..." />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button type="button" style={BUTTON_STYLE} onClick={() => void openMediaLibrary("repeaterIcon", index)}><ImageIcon size={14} /> Media Library</button><button type="button" style={BUTTON_STYLE} onClick={() => openImageUpload("repeaterIcon", index)}><Upload size={14} /> Upload</button></div>
                      {entry.iconImage ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <img src={safeMediaUrl(String(entry.iconImage))} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                          <button type="button" style={{ ...BUTTON_STYLE, color: "#b42318" }} onClick={() => updateRepeaterItem(index, { iconImage: "", iconMediaId: "" })}>Remove Icon Image</button>
                        </div>
                      ) : null}
                    </>
                  ) : node.type === "icon-list" ? (
                    <details style={{ border: "1px solid #dbe3ed", borderRadius: 7, marginTop: 8, background: "#fff" }}>
                      <summary style={{ cursor: "pointer", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#334155" }}>{String(entry.text || entry.label || `List item ${index + 1}`)}</summary>
                      <div style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
                        <TextControl label="Text" value={String(entry.text || entry.label || "")} onChange={(value) => updateRepeaterItem(index, { text: value })} />
                        <Field label="Icon">
                          <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 10, alignItems: "stretch" }}>
                            <div style={{ minHeight: 64, display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", border: "1px solid #dbe3ed", borderRadius: 6 }}>
                              {entry.iconImage ? <img src={safeMediaUrl(String(entry.iconImage))} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} /> : (() => { const iconName = typeof entry.iconName === "string" ? entry.iconName : "Check"; const IconPreview = iconName ? themeIcons[iconName] : null; return IconPreview ? <IconPreview size={30} color={String(node.props.iconColor || "#3984e8")} /> : <span style={{ color: "#94a3b8", fontSize: 11 }}>No Icon</span>; })()}
                            </div>
                            <div style={{ display: "grid", gap: 6 }}>
                              <button type="button" style={BUTTON_STYLE} onClick={() => setIconPickerTarget({ kind: "repeaterItem", index, key: "items", value: String(entry.iconName ?? "Check") })}>{String(themeIconLabels[String(entry.iconName || "")] || entry.iconName || "No Icon â€” choose icon")}</button>
                              <button type="button" style={BUTTON_STYLE} onClick={() => void openMediaLibrary("repeaterIcon", index)}><ImageIcon size={14} /> Media Library</button>
                              <button type="button" style={BUTTON_STYLE} onClick={() => openImageUpload("repeaterIcon", index)}><Upload size={14} /> Upload Image</button>
                            </div>
                          </div>
                          {entry.iconImage ? <button type="button" style={{ ...BUTTON_STYLE, marginTop: 7, color: "#b42318" }} onClick={() => updateRepeaterItem(index, { iconImage: "", iconMediaId: "" })}>Remove Image Icon</button> : null}
                        </Field>
                        <SelectControl label="Link Type" value={String(entry.linkType || "normal")} options={[{ label: "Custom Link", value: "normal" }, { label: "Dynamic Link", value: "dynamic" }]} onChange={(value) => updateRepeaterItem(index, { linkType: value })} />
                        {entry.linkType === "dynamic" ? (
                          <SelectControl label="Dynamic Link" value={String(entry.dynamicLink || "current-page")} options={[{ label: "Current Page", value: "current-page" }, { label: "Homepage", value: "homepage" }]} onChange={(value) => updateRepeaterItem(index, { dynamicLink: value })} />
                        ) : (
                          <TextControl label="Custom Link URL" value={String(entry.url || "")} onChange={(value) => updateRepeaterItem(index, { url: value })} placeholder="https://example.com or /page/" list="builder-link-targets" onFocus={() => void loadLinkSuggestions()} />
                        )}
                        {entry.linkType !== "dynamic" ? <SelectControl label="Open Link In" value={String(entry.linkTarget || "_self")} options={[{ label: "Same Window", value: "_self" }, { label: "New Window", value: "_blank" }]} onChange={(value) => updateRepeaterItem(index, { linkTarget: value })} /> : null}
                      </div>
                    </details>
                  ) : node.type === "price-list" ? (
                    <><TextControl label="Title" value={String(entry.title || "")} onChange={(value) => updateRepeaterItem(index, { title: value })} /><TextControl label="Price" value={String(entry.price || "")} onChange={(value) => updateRepeaterItem(index, { price: value })} /><TextControl label="Description" value={String(entry.description || "")} onChange={(value) => updateRepeaterItem(index, { description: value })} /></>
                  ) : (
                    <>
                      <Field label="Item Icon (Optional)">
                        <button
                          type="button"
                          style={{ ...BUTTON_STYLE, width: "100%", justifyContent: "flex-start" }}
                          onClick={() => setIconPickerTarget({ kind: "repeaterItem", index, key: repeaterKey as "items" | "tabs", value: String(entry.iconName || "") })}
                        >
                          {(() => {
                            const ItemIcon = themeIcons[String(entry.iconName || "")];
                            return ItemIcon ? <ItemIcon size={17} /> : <Search size={17} />;
                          })()}
                          {String(themeIconLabels[String(entry.iconName || "")] || entry.iconName || "Choose icon")}
                        </button>
                      </Field>
                      <TextControl label="Title" value={String(entry.title || "")} onChange={(value) => updateRepeaterItem(index, { title: value })} />
                      <Field label="Content"><textarea rows={4} value={String(entry.content || "")} onChange={(event) => updateRepeaterItem(index, { content: event.target.value })} style={CONTROL_STYLE} /></Field>
                    </>
                  )}
                </div>
              ))}
              <button type="button" style={{ ...BUTTON_STYLE, width: "100%" }} onClick={addRepeaterItem}><Plus size={15} /> Add Item</button>
              {node.type === "social-icons" ? <><UnitControl label="Icon Size" value={String(deviceProps.iconSize || "22px")} onChange={(value) => updateResponsiveProp("iconSize", value)} allowAuto={false} /><UnitControl label="Button Size" value={String(deviceProps.buttonSize || "40px")} onChange={(value) => updateResponsiveProp("buttonSize", value)} allowAuto={false} /><SelectControl label="Shape" value={String(deviceProps.shape || "circle")} options={["circle", "rounded", "square"].map((value) => ({ label: value, value }))} onChange={(value) => updateResponsiveProp("shape", value)} /></> : null}
            </ControlGroup>
          )}

          {(node.type === "posts" || node.type === "loop-grid" || node.type === "loop-carousel" || node.type === "post-tabs") && (
            <ControlGroup title="Query & Content" defaultOpen>
              <TextControl label="Post Type Slug (post = regular posts)" value={String(node.props.postType || "post")} onChange={(value) => updateProps("postType", value.trim())} />
              <TextControl label="Number of Posts per Tab / Grid" type="number" value={String(node.props.count || 6)} onChange={(value) => updateProps("count", Math.max(1, Math.min(24, Number(value) || 1)))} />
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
                        â†‘ Move Up
                      </button>
                      <button
                        type="button"
                        style={BUTTON_STYLE}
                        disabled={slideIndex === slideEntries.length - 1}
                        onClick={() => moveSlide(slideIndex, 1)}
                      >
                        â†“ Move Down
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
                      <ColorControl
                        label="Background Color"
                        value={String(slide.backgroundColor || "#0c2f55")}
                        onChange={(value) => updateSlide(slideIndex, "backgroundColor", value)}
                      />
                      <ColorControl
                        label="Heading Color"
                        value={String(slide.headingColor || "#ffffff")}
                        onChange={(value) => updateSlide(slideIndex, "headingColor", value)}
                      />
                      <ColorControl
                        label="Text Color"
                        value={String(slide.textColor || "#ffffff")}
                        onChange={(value) => updateSlide(slideIndex, "textColor", value)}
                      />
                      <ColorControl
                        label="Overlay Color"
                        value={String(slide.overlayColor || "#000000")}
                        onChange={(value) => updateSlide(slideIndex, "overlayColor", value)}
                      />
                    </div>
                    <TextControl
                      label="Overlay Opacity (0â€“1)"
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
                            {String(button.iconName || "No Icon â€” choose icon")}
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
                          <UnitControl
                            label="Custom Width"
                            value={String(button.width || "240px")}
                            onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "width", value)}
                          />
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <ColorControl
                              label="Button Color"
                              value={String(button.backgroundColor || "#0c2f55")}
                              onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "backgroundColor", value)}
                            />
                            <ColorControl
                              label="Text Color"
                              value={String(button.textColor || "#ffffff")}
                              onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "textColor", value)}
                            />
                            <ColorControl
                              label="Hover Button Color"
                              value={String(button.hoverBackgroundColor || "#164a7e")}
                              onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "hoverBackgroundColor", value)}
                            />
                            <ColorControl
                              label="Hover Text Color"
                              value={String(button.hoverTextColor || "#ffffff")}
                              onChange={(value) => updateSlideButton(slideIndex, buttonIndex, "hoverTextColor", value)}
                            />
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

  const updateGridDimensions = (axis: "rows" | "columns", rawValue: number) => {
    if (!selectedId) return;
    const currentNode = findNode(layout.root, selectedId);
    if (!currentNode) return;

    const readCount = (value: unknown, fallback: number) => {
      const text = String(value || "").trim();
      const match = text.match(/^repeat\(\s*(\d+)/i);
      if (match) return Math.max(1, Math.min(12, Number(match[1])));
      if (!text || text === "auto" || text === "none") return fallback;
      return Math.max(1, Math.min(12, text.split(/\s+/).filter(Boolean).length));
    };

    const existingChildren = currentNode.children || [];
    const currentColumns = readCount(
      getResponsiveValue(currentNode.styles.gridTemplateColumns, device),
      Math.max(1, existingChildren.length || 1),
    );
    const currentRows = readCount(
      getResponsiveValue(currentNode.styles.gridTemplateRows, device),
      Math.max(1, Math.ceil((existingChildren.length || 1) / currentColumns)),
    );
    const rows = axis === "rows" ? Math.max(1, Math.min(12, Math.floor(rawValue || 1))) : currentRows;
    const columns = axis === "columns" ? Math.max(1, Math.min(12, Math.floor(rawValue || 1))) : currentColumns;
    const requiredCells = rows * columns;

    commitRoot(
      updateTree(layout.root, selectedId, (nodeToUpdate) => {
        let children = [...(nodeToUpdate.children || [])];
        const generatedCellsOnly = children.every((child) => child.props.layoutCell === true);

        if (generatedCellsOnly) {
          while (children.length < requiredCells) {
            const cell = createDefaultNode(
              "container",
              `Grid Cell ${children.length + 1}`,
              makeId("container"),
              { contentWidth: "100%", htmlTag: "div", layoutCell: true },
              [],
            );
            cell.styles = { ...cell.styles, minHeight: { desktop: "90px" } };
            children.push(cell);
          }

          while (children.length > requiredCells) {
            let removableIndex = -1;
            for (let index = children.length - 1; index >= 0; index -= 1) {
              const candidate = children[index];
              if (candidate.props.layoutCell === true && !(candidate.children || []).length) {
                removableIndex = index;
                break;
              }
            }
            if (removableIndex < 0) break;
            children.splice(removableIndex, 1);
          }
        }

        const currentGridColumnsStyle = nodeToUpdate.styles.gridTemplateColumns || {};
        const currentGridRowsStyle = nodeToUpdate.styles.gridTemplateRows || {};
        const nextStyles: BuilderStyle = {
          ...nodeToUpdate.styles,
          gridTemplateColumns: {
            ...currentGridColumnsStyle,
            [device]: `repeat(${columns}, minmax(0, 1fr))`,
          },
          gridTemplateRows: {
            ...currentGridRowsStyle,
            [device]: `repeat(${rows}, minmax(100px, auto))`,
          },
        };

        return { ...nodeToUpdate, children, styles: nextStyles };
      }),
    );
  };
  const distributeSelectedChildrenEqually = () => {
    if (!selectedId) return;
    const selectedParent = findNode(layout.root, selectedId);
    if (!selectedParent) return;
    const layoutChildCount = (selectedParent.children || []).filter((child) =>
      LAYOUT_TYPES.has(child.type),
    ).length;
    if (layoutChildCount < 2) return;

    commitRoot(
      updateTree(layout.root, selectedId, (parentNode) => ({
        ...parentNode,
        children: (parentNode.children || []).map((child) => {
          if (!LAYOUT_TYPES.has(child.type)) return child;

          const nextStyles: BuilderStyle = { ...child.styles };
          const setForCurrentDevice = (
            key: "width" | "flexBasis" | "flexGrow" | "flexShrink",
            value: string,
          ) => {
            const currentValue = nextStyles[key];
            const current = currentValue && typeof currentValue === "object"
              ? currentValue as Record<string, unknown>
              : currentValue !== undefined && currentValue !== null
                ? { desktop: currentValue }
                : {};
            (nextStyles as unknown as Record<string, unknown>)[key] = {
              ...current,
              [device]: value,
            };
          };

          // auto width + 0 basis + grow 1 yields equal columns without gaps.
          setForCurrentDevice("width", "auto");
          setForCurrentDevice("flexBasis", "0%");
          setForCurrentDevice("flexGrow", "1");
          setForCurrentDevice("flexShrink", "1");

          return { ...child, styles: nextStyles };
        }),
      })),
    );
  };
  const renderLayoutPanel = () => {
    if (!selectedNode) return null;

    const node = selectedNode;
    const deviceProps = resolveBuilderProps(node.props, device);
    const selectedDisplay =
      getResponsiveValue(node.styles.display, device) ||
      (node.type === "grid" ? "grid" : "flex");
    const readTrackCount = (value: unknown, fallback: number) => {
      const text = String(value || "").trim();
      const repeat = text.match(/^repeat\(\s*(\d+)/i);
      if (repeat) return Math.max(1, Math.min(12, Number(repeat[1])));
      if (!text || text === "auto" || text === "none") return fallback;
      return Math.max(1, Math.min(12, text.split(/\s+/).filter(Boolean).length));
    };
    const currentGridColumns = readTrackCount(
      getResponsiveValue(node.styles.gridTemplateColumns, device),
      Math.max(1, node.children?.length || 1),
    );
    const currentGridRows = readTrackCount(
      getResponsiveValue(node.styles.gridTemplateRows, device),
      Math.max(1, Math.ceil((node.children?.length || 1) / currentGridColumns)),
    );
    const gridColumns = currentGridColumns;
    const gridRows = currentGridRows;
    const selectedDirection = String(
      getResponsiveValue(node.styles.direction, device) ||
        (node.type === "row" ? "row" : "column"),
    );
    const directLayoutChildren = (node.children || []).filter((child) =>
      LAYOUT_TYPES.has(child.type),
    );
    const selectedParentId = findParent(layout.root, node.id);
    const selectedParent = selectedParentId ? findNode(layout.root, selectedParentId) : null;
    const selectedParentStyles = selectedParent
      ? resolveBuilderStyles(selectedParent.styles, device)
      : null;
    const selectedParentDisplay = selectedParentStyles
      ? String(getResponsiveValue(selectedParentStyles.display, device) || "flex")
      : "";
    const selectedParentDirection = selectedParentStyles
      ? String(
          getResponsiveValue(selectedParentStyles.direction, device) ||
            (selectedParent?.type === "row" ? "row" : "column"),
        )
      : "";
    const isFlexRowChild =
      Boolean(selectedParent) &&
      selectedParentDisplay === "flex" &&
      selectedParentDirection.startsWith("row");
    const isGridChild = Boolean(selectedParent) && selectedParentDisplay === "grid";

    return (
      <>
        {/* BUILDER_LIST_LAYOUT_V6_2: layout background color is responsive and stored with the node background. */}
        <ControlGroup title="Background" defaultOpen>
          <ColorControl
            label="Background Color"
            value={String(getResponsiveScalar(node.styles.background?.color, device) || "transparent")}
            onChange={(value) => {
              const rawColor = node.styles.background?.color;
              const colorByDevice = typeof rawColor === "string" ? { desktop: rawColor } : rawColor || {};
              updateBackground("color", { ...colorByDevice, [device]: value });
            }}
          />
          <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.45 }}>
            Gradient, image and hover backgrounds are available in the Style tab.
          </p>
        </ControlGroup>
        <ControlGroup title="Container Layout" defaultOpen>

          <SegmentedControl
            label="Display"
            value={String(selectedDisplay)}
            options={[
              { label: "Flex", value: "flex", icon: "Rows3", title: "Flex" },
              { label: "Grid", value: "grid", icon: "Grid3X3", title: "Grid" },
              { label: "Block", value: "block", icon: "Square", title: "Block" },
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
              { label: "", value: "row", title: "Row", icon: "ArrowRight" },
              { label: "", value: "column", title: "Column", icon: "ArrowDown" },
              { label: "", value: "row-reverse", title: "Row Reverse", icon: "ArrowLeft" },
              { label: "", value: "column-reverse", title: "Column Reverse", icon: "ArrowUp" },
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
              { label: "", value: "flex-start", title: "Start", icon: "AlignHorizontalJustifyStart" },
              { label: "", value: "center", title: "Center", icon: "AlignHorizontalJustifyCenter" },
              { label: "", value: "flex-end", title: "End", icon: "AlignHorizontalJustifyEnd" },
              { label: "", value: "space-between", title: "Space Between", icon: "AlignHorizontalSpaceBetween" },
              { label: "", value: "space-around", title: "Space Around", icon: "AlignHorizontalSpaceAround" },
              { label: "", value: "space-evenly", title: "Space Evenly", icon: "AlignHorizontalDistributeCenter" },
            ]}
            onChange={(value) => updateResponsiveStyle("justifyContent", value)}
          />

          <SegmentedControl
            label="Align Items"
            value={String(
              getResponsiveValue(node.styles.alignItems, device) || "stretch",
            )}
            options={[
              { label: "", value: "flex-start", title: "Start", icon: "AlignVerticalJustifyStart" },
              { label: "", value: "center", title: "Center", icon: "AlignVerticalJustifyCenter" },
              { label: "", value: "flex-end", title: "End", icon: "AlignVerticalJustifyEnd" },
              { label: "", value: "stretch", title: "Stretch", icon: "StretchVertical" },
              { label: "", value: "baseline", title: "Baseline", icon: "Baseline" },
            ]}
            onChange={(value) => updateResponsiveStyle("alignItems", value)}
          />

          <SegmentedControl
            label="Align Content"
            value={String(
              getResponsiveValue(node.styles.alignContent, device) || "stretch",
            )}
            options={[
              { label: "", value: "flex-start", title: "Start", icon: "AlignVerticalJustifyStart" },
              { label: "", value: "center", title: "Center", icon: "AlignVerticalJustifyCenter" },
              { label: "", value: "flex-end", title: "End", icon: "AlignVerticalJustifyEnd" },
              { label: "", value: "space-between", title: "Space Between", icon: "AlignVerticalSpaceBetween" },
              { label: "", value: "space-around", title: "Space Around", icon: "AlignVerticalSpaceAround" },
              { label: "", value: "space-evenly", title: "Space Evenly", icon: "AlignVerticalDistributeCenter" },
              { label: "", value: "stretch", title: "Stretch", icon: "StretchVertical" },
            ]}
            onChange={(value) => updateResponsiveStyle("alignContent", value)}
          />

          <SegmentedControl
            label="Wrap"
            value={String(
              getResponsiveValue(node.styles.flexWrap, device) || "nowrap",
            )}
            options={[
              { label: "", value: "nowrap", title: "No Wrap", icon: "ArrowRight" },
              { label: "", value: "wrap", title: "Wrap", icon: "WrapText" },
              { label: "", value: "wrap-reverse", title: "Wrap Reverse", icon: "ArrowDownUp" },
            ]}
            onChange={(value) => updateResponsiveStyle("flexWrap", value)}
          />

          {selectedDisplay === "grid" ? (
            <div className={styles.gridDimensionControls}>
              <label>
                <span>Grid Rows</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={gridRows}
                  onChange={(event) => updateGridDimensions("rows", Number(event.target.value))}
                />
              </label>
              <label>
                <span>Grid Columns</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={gridColumns}
                  onChange={(event) => updateGridDimensions("columns", Number(event.target.value))}
                />
              </label>
            </div>
          ) : null}

          {selectedDisplay === "flex" &&
          selectedDirection.startsWith("row") &&
          directLayoutChildren.length > 1 ? (
            <div className={styles.layoutDistributionTools}>
              <button
                type="button"
                onClick={distributeSelectedChildrenEqually}
              >
                Equal widths
              </button>
              <p>
                Equalize all direct containers, or select an individual container and set its Column Width to values such as 60% or 40%.
              </p>
            </div>
          ) : null}
        </ControlGroup>

        <ControlGroup title="Size">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
              minWidth: 0,
            }}
          >
            <UnitControl
              key={`${node.id}-width-${device}`}
              label={isFlexRowChild || isGridChild ? "Column Width" : "Width"}
              value={String(
                getResponsiveValue(node.styles.width, device) ||
                  (isFlexRowChild && Number(getResponsiveValue(node.styles.flexGrow, device) || 0) > 0 ? "auto" : ""),
              )}
              onChange={(value) => updateResponsiveStyle("width", value)}
              placeholder={isFlexRowChild || isGridChild ? "10% / 25% / auto" : "100%"}

              allowAuto={true}/>
            <p className={styles.dimensionControlHint} data-dimension-hint="width">Choose px, %, rem, em, Auto or Custom CSS. A value entered here is saved for this Container and active device.</p>
            {isFlexRowChild || isGridChild ? (
              <p className={styles.flexColumnWidthHint}>
                {isGridChild
                  ? "This width controls the Grid column track. Cells in the same Grid column share that track width."
                  : "This width is saved separately for this Container. Other custom widths stay unchanged and auto Containers share the remaining space."}
              </p>
            ) : null}

            <UnitControl
              key={`${node.id}-height-${device}`}
              label="Height"
              value={String(
                getResponsiveValue(node.styles.height, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("height", value)}
              placeholder="auto"

              allowAuto={true}/>
            <p className={styles.dimensionControlHint} data-dimension-hint="height">Choose px, %, rem, em, Auto or Custom CSS. Height is saved independently for Desktop, Tablet and Mobile.</p>

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
          <div className={styles.inspectorControlStack}>
            <UnitControl
              label="Row Gap"
              value={String(
                getResponsiveValue(node.styles.rowGap, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("rowGap", value)}
              allowAuto={false}
            />

            <UnitControl
              label="Column Gap"
              value={String(
                getResponsiveValue(node.styles.columnGap, device) || "",
              )}
              onChange={(value) => updateResponsiveStyle("columnGap", value)}
              allowAuto={false}
            />

            <UnitControl
              label="Gap"
              value={String(getResponsiveValue(node.styles.gap, device) || "")}
              onChange={(value) => updateResponsiveStyle("gap", value)}
              allowAuto={false}
            />
          </div>
        </ControlGroup>

        <ControlGroup title="Flex Child">
          <div className={styles.inspectorControlStack}>
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

            <UnitControl
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

            <SegmentedControl
              label="Align Self"
              value={String(getResponsiveValue(node.styles.alignSelf, device) || "auto")}
              options={[
                { label: "", value: "auto", title: "Auto", icon: "CircleDot" },
                { label: "", value: "flex-start", title: "Start", icon: "AlignStartVertical" },
                { label: "", value: "center", title: "Center", icon: "AlignCenterVertical" },
                { label: "", value: "flex-end", title: "End", icon: "AlignEndVertical" },
                { label: "", value: "stretch", title: "Stretch", icon: "StretchVertical" },
                { label: "", value: "baseline", title: "Baseline", icon: "Baseline" },
              ]}
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
          </div>
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
            value={String(deviceProps.contentWidth || "boxed")}
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
              deviceProps.containerWidth || settings.containerWidth || "1200px",
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
    const deviceProps = resolveBuilderProps(node.props, device);
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
    const menuStyles = deviceProps.menuItemStyles && typeof deviceProps.menuItemStyles === "object"
      ? deviceProps.menuItemStyles as Record<string, Record<string, Record<string, unknown>>>
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
    ) as Record<string, Record<string, unknown>>;
    const activeMenuItemStyle = menuDevice[menuItemState] || {};
    const updateMenuItemStyle = (key: "color" | "backgroundColor" | "iconColor" | "backgroundGradient", value: unknown) => {
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
              value={String(deviceProps.alignment || "left")}
              options={[
                { label: "", value: "left", title: "Left", icon: "AlignLeft" },
                { label: "", value: "center", title: "Center", icon: "AlignCenter" },
                { label: "", value: "right", title: "Right", icon: "AlignRight" },
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
              value={String(deviceProps.objectFit || "cover")}
              options={["cover", "contain", "fill", "none"].map((value) => ({
                label: value,
                value,
              }))}
              onChange={(value) => updateResponsiveProp("objectFit", value)}
            />
            <SelectControl
              label="Object Position"
              value={String(deviceProps.objectPosition || "center center")}
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
        {node.type === "video" ? (
          <ControlGroup title="Video Player Styling" defaultOpen>
            <SelectControl
              label="Aspect Ratio"
              value={String(deviceProps.aspectRatio || "16:9")}
              options={["16:9", "4:3", "1:1", "3:2", "9:16", "21:9"].map((value) => ({ label: value, value }))}
              onChange={(value) => updateResponsiveProp("aspectRatio", value)}
            />
            <SelectControl
              label="Object Fit"
              value={String(deviceProps.objectFit || "cover")}
              options={["cover", "contain", "fill"].map((value) => ({ label: value, value }))}
              onChange={(value) => updateResponsiveProp("objectFit", value)}
            />
            <ColorControl label="Overlay Color" value={String(deviceProps.overlayColor || "#000000")} onChange={(value) => updateResponsiveProp("overlayColor", value)} />
            <TextControl label="Overlay Opacity" type="number" value={String(deviceProps.overlayOpacity ?? 0.28)} onChange={(value) => updateResponsiveProp("overlayOpacity", Math.max(0, Math.min(1, Number(value) || 0)))} />
            <ColorControl label="Play Icon Color" value={String(deviceProps.playIconColor || "#ffffff")} onChange={(value) => updateResponsiveProp("playIconColor", value)} />
            <UnitControl label="Play Icon Size" value={String(deviceProps.playIconSize || "64px")} onChange={(value) => updateResponsiveProp("playIconSize", value)} allowAuto={false} />
            <ColorControl label="Embedded Controls Color" value={String(deviceProps.controlsColor || "#3984e8")} onChange={(value) => updateResponsiveProp("controlsColor", value)} />
          </ControlGroup>
        ) : null}

        {node.type === "menu" ? (
          <>
            <ControlGroup title="Navigation Menu Item Colors" defaultOpen>
              <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 8px", lineHeight: 1.5 }}>
                Select Desktop, Tablet or Mobile in the Builder toolbar. Normal, Hover and Active styles are stored independently for the selected device.
              </p>
              <SegmentedControl
                label="Item State"
                value={menuItemState}
                options={[{ label: "Normal", value: "normal" }, { label: "Hover", value: "hover" }, { label: "Active", value: "active" }]}
                onChange={(value) => setMenuItemState(value as "normal" | "hover" | "active")}
              />
              <ColorControl label="Text Color" value={String(activeMenuItemStyle.color || "#1f2937")} onChange={(value) => updateMenuItemStyle("color", value)} />
              <ColorControl label="Icon Color" value={String(activeMenuItemStyle.iconColor || activeMenuItemStyle.color || "#1f2937")} onChange={(value) => updateMenuItemStyle("iconColor", value)} />
              <SelectControl
                label="Background Type"
                value={activeMenuItemStyle.backgroundGradient ? "gradient" : "classic"}
                options={[{ label: "Classic", value: "classic" }, { label: "Gradient", value: "gradient" }]}
                onChange={(value) => {
                  if (value === "classic") {
                    updateMenuItemStyle("backgroundGradient", null);
                  } else {
                    updateMenuItemStyle("backgroundGradient", { angle: 135, color1: "#ffffff", color2: "#eaf1fb" });
                  }
                }}
              />
              {activeMenuItemStyle.backgroundGradient && typeof activeMenuItemStyle.backgroundGradient === "object" ? (() => {
                const gradient = activeMenuItemStyle.backgroundGradient as { angle?: number; color1?: string; color2?: string };
                return (
                  <>
                    <ColorControl label="Gradient Color 1" value={String(gradient.color1 || "#ffffff")} onChange={(value) => updateMenuItemStyle("backgroundGradient", { ...gradient, color1: value })} />
                    <ColorControl label="Gradient Color 2" value={String(gradient.color2 || "#eaf1fb")} onChange={(value) => updateMenuItemStyle("backgroundGradient", { ...gradient, color2: value })} />
                    <TextControl label="Gradient Angle" type="number" value={String(gradient.angle ?? 135)} onChange={(value) => updateMenuItemStyle("backgroundGradient", { ...gradient, angle: Math.max(0, Math.min(360, Number(value) || 0)) })} />
                  </>
                );
              })() : (
                <ColorControl label="Background Color" value={String(activeMenuItemStyle.backgroundColor || "transparent")} onChange={(value) => updateMenuItemStyle("backgroundColor", value)} />
              )}
            </ControlGroup>

            <ControlGroup title="Mobile Menu Panel" defaultOpen>
              <SelectControl
                label="Panel Background Type"
                value={String(deviceProps.mobilePanelBackgroundType || (deviceProps.mobilePanelGradient ? "gradient" : "classic"))}
                options={[{ label: "Classic", value: "classic" }, { label: "Gradient", value: "gradient" }]}
                onChange={(value) => {
                  updateResponsiveProps(value === "gradient"
                    ? {
                        mobilePanelBackgroundType: "gradient",
                        mobilePanelGradient: deviceProps.mobilePanelGradient && typeof deviceProps.mobilePanelGradient === "object"
                          ? deviceProps.mobilePanelGradient
                          : { angle: 135, color1: "#ffffff", color2: "#eaf1fb" },
                      }
                    : { mobilePanelBackgroundType: "classic" });
                }}
              />
              {deviceProps.mobilePanelBackgroundType === "gradient" || (!deviceProps.mobilePanelBackgroundType && deviceProps.mobilePanelGradient) ? (() => {
                const gradient = deviceProps.mobilePanelGradient && typeof deviceProps.mobilePanelGradient === "object"
                  ? deviceProps.mobilePanelGradient as { angle?: number; color1?: string; color2?: string }
                  : { angle: 135, color1: "#ffffff", color2: "#eaf1fb" };
                return (
                  <>
                    <ColorControl label="Panel Gradient Color 1" value={String(gradient.color1 || "#ffffff")} onChange={(value) => updateResponsiveProp("mobilePanelGradient", { ...gradient, color1: value })} />
                    <ColorControl label="Panel Gradient Color 2" value={String(gradient.color2 || "#eaf1fb")} onChange={(value) => updateResponsiveProp("mobilePanelGradient", { ...gradient, color2: value })} />
                    <TextControl label="Panel Gradient Angle" type="number" value={String(gradient.angle ?? 135)} onChange={(value) => updateResponsiveProp("mobilePanelGradient", { ...gradient, angle: Math.max(0, Math.min(360, Number(value) || 0)) })} />
                  </>
                );
              })() : (
                <ColorControl label="Panel Background Color" value={String(deviceProps.mobilePanelBackground || "#ffffff")} onChange={(value) => updateResponsiveProp("mobilePanelBackground", value)} />
              )}
              <ColorControl label="Panel Text Color" value={String(deviceProps.mobilePanelColor || "#1f2937")} onChange={(value) => updateResponsiveProp("mobilePanelColor", value)} />
              <ColorControl label="Panel Icon Color" value={String(deviceProps.mobilePanelIconColor || deviceProps.mobilePanelColor || "#1f2937")} onChange={(value) => updateResponsiveProp("mobilePanelIconColor", value)} />
              <ColorControl label="Backdrop / Overlay Color" value={String(deviceProps.mobileOverlayColor || "rgba(15, 23, 42, 0.48)")} onChange={(value) => updateResponsiveProp("mobileOverlayColor", value)} />
            </ControlGroup>

            <ControlGroup title="Mobile Menu Toggle & Icons">
              <ColorControl label="Toggle Icon â€” Normal" value={String(deviceProps.iconColor || "#0c2f55")} onChange={(value) => updateResponsiveProp("iconColor", value)} />
              <ColorControl label="Toggle Icon â€” Hover" value={String(deviceProps.toggleHoverIconColor || "#3984e8")} onChange={(value) => updateResponsiveProp("toggleHoverIconColor", value)} />
              <ColorControl label="Toggle Background â€” Normal" value={String(deviceProps.toggleBackgroundColor || "transparent")} onChange={(value) => updateResponsiveProp("toggleBackgroundColor", value)} />
              <ColorControl label="Toggle Background â€” Hover" value={String(deviceProps.toggleHoverBackgroundColor || "transparent")} onChange={(value) => updateResponsiveProp("toggleHoverBackgroundColor", value)} />
              <ColorControl label="Close Icon â€” Normal" value={String(deviceProps.closeIconColor || deviceProps.iconColor || "#0c2f55")} onChange={(value) => updateResponsiveProp("closeIconColor", value)} />
              <ColorControl label="Close Icon â€” Hover" value={String(deviceProps.closeIconHoverColor || "#3984e8")} onChange={(value) => updateResponsiveProp("closeIconHoverColor", value)} />
            </ControlGroup>
          </>
        ) : null}
        {(node.type === "icon" || node.type === "icon-box" || node.type === "social-icons") ? (
          <ControlGroup title="Icon Styling" defaultOpen>
            <ColorControl label="Icon Color" value={String(deviceProps.iconColor || "#3984e8")} onChange={(value) => updateResponsiveProp("iconColor", value)} />
            <UnitControl label="Icon Size" value={String(deviceProps.iconSize || deviceProps.size || "24px")} onChange={(value) => updateResponsiveProp(node.type === "icon" ? "size" : "iconSize", value)} allowAuto={false} />
            {node.type === "social-icons" ? (
              <>
                <ColorControl label="Icon Background" value={String(deviceProps.iconBackground || "#0c2f55")} onChange={(value) => updateResponsiveProp("iconBackground", value)} />
                <UnitControl label="Button Size" value={String(deviceProps.buttonSize || "40px")} onChange={(value) => updateResponsiveProp("buttonSize", value)} allowAuto={false} />
                <UnitControl label="Icon Gap" value={String(deviceProps.iconGap ?? deviceProps.gap ?? "12px")} onChange={(value) => updateResponsiveProp("iconGap", value)} allowAuto={false} />
                <SelectControl
                  label="Layout"
                  value={String(deviceProps.layoutMode || "inline")}
                  options={[
                    { label: "Inline", value: "inline" },
                    { label: "Block", value: "block" },
                  ]}
                  onChange={(value) => updateResponsiveProp("layoutMode", value)}
                />


                <UnitControl label="Shape Radius" value={String(deviceProps.shapeRadius || (deviceProps.shape === "square" ? "4px" : deviceProps.shape === "rounded" ? "10px" : "999px"))} onChange={(value) => updateResponsiveProp("shapeRadius", value)} allowAuto={false} />
              </>
            ) : null}
          </ControlGroup>
        ) : null}
        {node.type === "icon-list" ? (
          <>
            <ControlGroup title="List" defaultOpen>
              <UnitControl label="Space Between" value={String(deviceProps.itemSpacing ?? deviceProps.gap ?? "12px")} onChange={(value) => updateResponsiveProp("itemSpacing", value)} allowAuto={false} />

              <SegmentedControl
                label="Alignment"
                value={String(deviceProps.listAlignment || "left")}
                options={[{ label: "", value: "left", title: "Left", icon: "AlignLeft" }, { label: "", value: "center", title: "Center", icon: "AlignCenter" }, { label: "", value: "right", title: "Right", icon: "AlignRight" }]}
                onChange={(value) => updateResponsiveProp("listAlignment", value)}
              />
              <Field label="Divider"><input type="checkbox" checked={Boolean(deviceProps.divider)} onChange={(event) => updateResponsiveProp("divider", event.target.checked)} /></Field>
              <ColorControl label="Divider Color" value={String(deviceProps.dividerColor || "#e2e8f0")} onChange={(value) => updateResponsiveProp("dividerColor", value)} />
            </ControlGroup>
            <ControlGroup title="Icon">
              <UnitControl label="Size" value={String(deviceProps.iconSize || "16px")} onChange={(value) => updateResponsiveProp("iconSize", value)} allowAuto={false} />
              <ColorControl label="Color" value={String(deviceProps.iconColor || "#3984e8")} onChange={(value) => updateResponsiveProp("iconColor", value)} />
              <UnitControl label="Icon / Text Gap" value={String(deviceProps.iconGap || "9px")} onChange={(value) => updateResponsiveProp("iconGap", value)} allowAuto={false} />
            </ControlGroup>
            <ControlGroup title="Text">
              <ColorControl label="Text Color" value={String(deviceProps.textColor || "#334155")} onChange={(value) => updateResponsiveProp("textColor", value)} />
              <ColorControl label="Link Color" value={String(deviceProps.linkColor || "#334155")} onChange={(value) => updateResponsiveProp("linkColor", value)} />
            </ControlGroup>
          </>
        ) : null}        {(node.type === "tabs" || node.type === "post-tabs") ? (
          <ControlGroup title="Tabs Styling" defaultOpen>
            <ColorControl label="Normal Text Color" value={String(deviceProps.tabNormalColor || "#334155")} onChange={(value) => updateResponsiveProp("tabNormalColor", value)} />
            <ColorControl label="Normal Background" value={String(deviceProps.tabNormalBackground || "#f1f5f9")} onChange={(value) => updateResponsiveProp("tabNormalBackground", value)} />
            <ColorControl label="Hover Text Color" value={String(deviceProps.tabHoverColor || "#0c2f55")} onChange={(value) => updateResponsiveProp("tabHoverColor", value)} />
            <ColorControl label="Hover Background" value={String(deviceProps.tabHoverBackground || "#e2e8f0")} onChange={(value) => updateResponsiveProp("tabHoverBackground", value)} />
            <ColorControl label="Active Text Color" value={String(deviceProps.tabActiveColor || "#ffffff")} onChange={(value) => updateResponsiveProp("tabActiveColor", value)} />
            <ColorControl label="Active Background" value={String(deviceProps.tabActiveBackground || "#0c2f55")} onChange={(value) => updateResponsiveProp("tabActiveBackground", value)} />
            {node.type === "tabs" ? (
              <>
                <RangeUnitControl label="Tab Gap" value={String(deviceProps.tabGap || "6px")} onChange={(value) => updateResponsiveProp("tabGap", value)} min={0} max={60} />
                <SegmentedControl label="Alignment" value={String(deviceProps.tabAlignment || "left")} options={[{ label: "", value: "left", title: "Left", icon: "AlignLeft" }, { label: "", value: "center", title: "Center", icon: "AlignCenter" }, { label: "", value: "right", title: "Right", icon: "AlignRight" }]} onChange={(value) => updateResponsiveProp("tabAlignment", value)} />
                <UnitControl label="Tab Radius" value={String(deviceProps.tabRadius || "6px")} onChange={(value) => updateResponsiveProp("tabRadius", value)} allowAuto={false} />
                <UnitControl label="Tab Padding" value={String(deviceProps.tabPadding || "9px 14px")} onChange={(value) => updateResponsiveProp("tabPadding", value)} allowAuto={false} />
                <ColorControl label="Content Text Color" value={String(deviceProps.tabContentColor || "#334155")} onChange={(value) => updateResponsiveProp("tabContentColor", value)} />
                <ColorControl label="Content Background" value={String(deviceProps.tabContentBackground || "#ffffff")} onChange={(value) => updateResponsiveProp("tabContentBackground", value)} />
                <UnitControl label="Content Padding" value={String(deviceProps.tabContentPadding || "14px")} onChange={(value) => updateResponsiveProp("tabContentPadding", value)} allowAuto={false} />
                <ColorControl label="Divider Color" value={String(deviceProps.tabDividerColor || "#e2e8f0")} onChange={(value) => updateResponsiveProp("tabDividerColor", value)} />
                <UnitControl label="Icon Size" value={String(deviceProps.tabIconSize || "15px")} onChange={(value) => updateResponsiveProp("tabIconSize", value)} allowAuto={false} />
                <ColorControl label="Icon Color" value={String(deviceProps.tabIconColor || "#334155")} onChange={(value) => updateResponsiveProp("tabIconColor", value)} />
              </>
            ) : null}
          </ControlGroup>
        ) : null}
        {(node.type === "posts" || node.type === "loop-grid" || node.type === "loop-carousel" || node.type === "post-tabs") ? (
          <ControlGroup title="Post Cards Styling" defaultOpen>
            <TextControl
              label="Columns on this device"
              type="number"
              value={String(deviceProps.columns || (node.type === "post-tabs" ? 2 : 3))}
              onChange={(value) => updateResponsiveProp("columns", Math.max(1, Math.min(6, Number(value) || 1)))}
            />
            <ColorControl label="Card Background" value={String(deviceProps.cardBackground || "#ffffff")} onChange={(value) => updateResponsiveProp("cardBackground", value)} />
            <ColorControl label="Card Border Color" value={String(deviceProps.cardBorderColor || "#e2e8f0")} onChange={(value) => updateResponsiveProp("cardBorderColor", value)} />
            <UnitControl label="Card Border Radius" value={String(deviceProps.cardRadius || "8px")} onChange={(value) => updateResponsiveProp("cardRadius", value)} allowAuto={false} />
            <UnitControl label="Grid / Card Gap" value={String(deviceProps.gap || "18px")} onChange={(value) => updateResponsiveProp("gap", value)} allowAuto={false} />
            <UnitControl label="Image Height" value={String(deviceProps.imageHeight || "180px")} onChange={(value) => updateResponsiveProp("imageHeight", value)} />
          </ControlGroup>
        ) : null}
        {node.type === "price-table" ? (
          <ControlGroup title="Pricing Card Styling" defaultOpen>
            <ColorControl label="Card Background" value={String(deviceProps.cardBackground || "#ffffff")} onChange={(value) => updateResponsiveProp("cardBackground", value)} />
            <ColorControl label="Card Border" value={String(deviceProps.cardBorderColor || "#dbe3ed")} onChange={(value) => updateResponsiveProp("cardBorderColor", value)} />
            <ColorControl label="Title Color" value={String(deviceProps.titleColor || "#0c2f55")} onChange={(value) => updateResponsiveProp("titleColor", value)} />
            <ColorControl label="Price Color" value={String(deviceProps.priceColor || "#3984e8")} onChange={(value) => updateResponsiveProp("priceColor", value)} />
            <ColorControl label="Button Background" value={String(deviceProps.buttonBackground || "#0c2f55")} onChange={(value) => updateResponsiveProp("buttonBackground", value)} />
            <ColorControl label="Button Text Color" value={String(deviceProps.buttonColor || "#ffffff")} onChange={(value) => updateResponsiveProp("buttonColor", value)} />
          </ControlGroup>
        ) : null}
        {node.type === "accordion" ? (
          <ControlGroup title="Accordion Styling" defaultOpen>
            <ColorControl label="Title Text Color" value={String(deviceProps.titleColor || "#0c2f55")} onChange={(value) => updateResponsiveProp("titleColor", value)} />
            <ColorControl label="Title Background" value={String(deviceProps.titleBackground || "#f8fafc")} onChange={(value) => updateResponsiveProp("titleBackground", value)} />
            <UnitControl label="Header Padding" value={String(deviceProps.headerPadding || "12px 14px")} onChange={(value) => updateResponsiveProp("headerPadding", value)} allowAuto={false} />
            <ColorControl label="Content Text Color" value={String(deviceProps.contentColor || "#334155")} onChange={(value) => updateResponsiveProp("contentColor", value)} />
            <ColorControl label="Content Background" value={String(deviceProps.contentBackground || "#ffffff")} onChange={(value) => updateResponsiveProp("contentBackground", value)} />
            <UnitControl label="Content Padding" value={String(deviceProps.contentPadding || "12px 14px")} onChange={(value) => updateResponsiveProp("contentPadding", value)} allowAuto={false} />
            <RangeUnitControl label="Item Spacing" value={String(deviceProps.itemSpacing || "8px")} onChange={(value) => updateResponsiveProp("itemSpacing", value)} min={0} max={80} />
            <UnitControl label="Item Radius" value={String(deviceProps.itemRadius || "6px")} onChange={(value) => updateResponsiveProp("itemRadius", value)} allowAuto={false} />
            <ColorControl label="Divider Color" value={String(deviceProps.dividerColor || "#e2e8f0")} onChange={(value) => updateResponsiveProp("dividerColor", value)} />
            <UnitControl label="Item Icon Size" value={String(deviceProps.itemIconSize || "16px")} onChange={(value) => updateResponsiveProp("itemIconSize", value)} allowAuto={false} />
            <ColorControl label="Item Icon Color" value={String(deviceProps.itemIconColor || "#3984e8")} onChange={(value) => updateResponsiveProp("itemIconColor", value)} />
          </ControlGroup>
        ) : null}
        {node.type === "countdown" ? (
          <ControlGroup title="Countdown Styling" defaultOpen>
            <ColorControl label="Number Color" value={String(deviceProps.numberColor || "#ffffff")} onChange={(value) => updateResponsiveProp("numberColor", value)} />
            <ColorControl label="Label Color" value={String(deviceProps.labelColor || "#ffffff")} onChange={(value) => updateResponsiveProp("labelColor", value)} />
            <ColorControl label="Box Background" value={String(deviceProps.boxBackground || "#0c2f55")} onChange={(value) => updateResponsiveProp("boxBackground", value)} />
            <UnitControl label="Box Radius" value={String(deviceProps.boxRadius || "8px")} onChange={(value) => updateResponsiveProp("boxRadius", value)} allowAuto={false} />
          </ControlGroup>
        ) : null}
        <ControlGroup title={node.type === "heading" ? "Heading Text Color" : "Text Color"} defaultOpen>
          <SegmentedControl
            label="State"
            value={textColorState}
            options={[
              { label: "Normal", value: "normal" },
              { label: "Hover", value: "hover" },
            ]}
            onChange={(value) => setTextColorState(value as "normal" | "hover")}
          />
          <ColorControl
            label="Text Color"
            value={String(currentTextColor || "#334155")}
            onChange={(value) => updateResponsiveStyle(textColorState === "hover" ? "colorHover" : "color", value)}
          />
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

          <ColorControl
            label="Background Color"
            value={String(getResponsiveScalar(background.color, device) || "transparent")}
            onChange={(value) => updateCurrentBackground("color", value)}
          />

          {background.type === "gradient" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <ColorControl
                  label="Color 1"
                  value={String(gradient.color1 || "#3984e8")}
                  onChange={(value) => updateCurrentBackground("gradient", { ...gradient, color1: value })}
                />

                <ColorControl
                  label="Color 2"
                  value={String(gradient.color2 || "#0c2f55")}
                  onChange={(value) => updateCurrentBackground("gradient", { ...gradient, color2: value })}
                />
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
            allowAuto={false}
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

          <UnitControl
            label="Line Height"
            value={String(node.styles.typography?.lineHeight || "")}
            onChange={(value) => updateTypography("lineHeight", value)}
            allowAuto={false}
            allowUnitless
          />

          <UnitControl
            label="Letter Spacing"
            value={String(node.styles.typography?.letterSpacing || "")}
            onChange={(value) => updateTypography("letterSpacing", value)}
            allowAuto={false}
          />

          <UnitControl
            label="Word Spacing"
            value={String(node.styles.typography?.wordSpacing || "")}
            onChange={(value) => updateTypography("wordSpacing", value)}
            allowAuto={false}
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
              { label: "", value: "left", title: "Left", icon: "AlignLeft" },
              { label: "", value: "center", title: "Center", icon: "AlignCenter" },
              { label: "", value: "right", title: "Right", icon: "AlignRight" },
              { label: "", value: "justify", title: "Justify", icon: "AlignJustify" },
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

          <UnitControl
            label="Border Width"
            value={String(border.width || "1px")}
            onChange={(value) => updateBorder("width", value, borderState === "hover")}
            allowAuto={false}
          />

          <ColorControl
            label="Border Color"
            value={String(getResponsiveScalar(border.color, device) || "#dbe3ed")}
            onChange={(value) => {
              const currentColor = typeof border.color === "string" ? { desktop: border.color } : border.color || {};
              updateBorder("color", { ...currentColor, [device]: value }, borderState === "hover");
            }}
          />

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
            allowAuto={false}
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
          <SegmentedControl
            label="Width"
            value={getWidthMode(node.advanced?.widthMode, device)}
            options={[
              { label: "", value: "default", icon: "PanelTop", title: "Default" },
              { label: "", value: "inline", icon: "Minimize2", title: "Inline / Auto" },
              { label: "", value: "full", icon: "Maximize2", title: "Full Width" },
              { label: "", value: "custom", icon: "Ruler", title: "Custom Width" },
            ]}
            onChange={(value) => updateResponsiveAdvancedWidthMode(value as "default" | "inline" | "full" | "custom")}
          />
          {getWidthMode(node.advanced?.widthMode, device) === "custom" ? (
            <UnitControl
              label="Custom Width"
              value={String(getResponsiveValue(node.styles.width, device) || "")}
              onChange={(value) => updateResponsiveStyle("width", value)}
              placeholder="240px"
            />
          ) : null}
          <SegmentedControl
            label="Align Self"
            value={String(getResponsiveValue(node.styles.alignSelf, device) || "auto")}
            options={[
              { label: "", value: "auto", icon: "Minus", title: "Auto" },
              { label: "", value: "flex-start", icon: "AlignStartVertical", title: "Start" },
              { label: "", value: "center", icon: "AlignCenterVertical", title: "Center" },
              { label: "", value: "flex-end", icon: "AlignEndVertical", title: "End" },
              { label: "", value: "stretch", icon: "StretchVertical", title: "Stretch" },
              { label: "", value: "baseline", icon: "Baseline", title: "Baseline" },
            ]}
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

          <UnitControl
            label="Offset X"
            value={String(transform.translateX || "0px")}
            onChange={(value) => updateTransform("translateX", value)}
            allowAuto={false}
          />

          <UnitControl
            label="Offset Y"
            value={String(transform.translateY || "0px")}
            onChange={(value) => updateTransform("translateY", value)}
            allowAuto={false}
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
          {node.styles.motion?.sticky ? (
            <TextControl
              label="Sticky Offset (px)"
              type="number"
              value={String(node.styles.motion.stickyOffset ?? 0)}
              onChange={(value) =>
                updateSimpleStyle("motion", {
                  ...(node.styles.motion || {}),
                  stickyOffset: Math.max(0, Number(value) || 0),
                })
              }
            />
          ) : null}
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

  const showGlobalSiteShellPreview =
    target.kind !== "header" && target.kind !== "footer";

  const renderGlobalTemplatePreview = (
    label: "Header" | "Footer",
    template: GlobalTemplatePreview | null,
  ) => {
    if (!showGlobalSiteShellPreview) return null;

    const isHeader = label === "Header";
    const nodes = template?.root ?? [];
    const statusText = template
      ? template.status === "PUBLISHED"
        ? "Published"
        : "Draft Â· not visible publicly until published"
      : "No saved template yet";
    const stickyHeaderNode = isHeader
      ? nodes.find((node) => getNodeInlineStyle(node, device).position === "sticky")
      : undefined;
    const stickyHeaderStyle = stickyHeaderNode
      ? getNodeInlineStyle(stickyHeaderNode, device)
      : {};

    return (
      <div
        data-global-template-preview={label.toLowerCase()}
        style={{
          position: stickyHeaderNode ? "sticky" : "relative",
          top: stickyHeaderNode ? stickyHeaderStyle.top ?? "0px" : undefined,
          bottom: stickyHeaderNode ? stickyHeaderStyle.bottom : undefined,
          zIndex: stickyHeaderNode ? Number(stickyHeaderStyle.zIndex ?? 1000) : undefined,
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          margin: isHeader ? "0 0 12px" : "12px 0 0",
          border: "1px dashed #94a3b8",
          background: "#ffffff",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 5,
            minHeight: 22,
            padding: "4px 9px",
            boxSizing: "border-box",
            background: "#eff6ff",
            color: "#1d4ed8",
            borderBottom: "1px dashed #bfdbfe",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".04em",
            textTransform: "uppercase",
          }}
        >
          Global {label} Â· {template?.title || "Header/Footer Builder"} Â· {statusText}
        </div>

        {nodes.length ? (
          <div
            style={{
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          >
            {nodes.map((node) => (
              <PreviewNode
                key={`${label.toLowerCase()}-${node.id}`}
                node={node}
                device={device}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: 12, color: "#64748b", fontSize: 12 }}>
            Build and save the global {label.toLowerCase()} in Appearance â†’ {label} Builder. It will appear around this page preview.
          </div>
        )}
      </div>
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
      // BUILDER_NESTED_COLLISION_V4
      collisionDetection={(args) => {
        const pointerHits = pointerWithin(args);
        const collisions = pointerHits.length ? pointerHits : rectIntersection(args);
        if (!collisions.length) return [];

        const layoutTypes = new Set(["section", "container", "row", "column", "grid"]);
        const activeNodeId = String(
          args.active.data.current?.nodeId ?? args.active.id,
        ).replace(/^navigator:/, "");

        const targetFor = (collision: (typeof collisions)[number]) =>
          args.droppableContainers.find((item) => item.id === collision.id);
        const dataFor = (collision: (typeof collisions)[number]) =>
          targetFor(collision)?.data.current;
        const areaFor = (collision: (typeof collisions)[number]) => {
          const rect = targetFor(collision)?.rect.current;
          return rect ? rect.width * rect.height : Number.MAX_SAFE_INTEGER;
        };
        const smallest = (items: typeof collisions) =>
          items.slice().sort((a, b) => areaFor(a) - areaFor(b))[0];

        // 1) Over a widget: insert/reorder relative to that exact widget.
        const widgetHits = collisions.filter((collision) => {
          const data = dataFor(collision);
          return data?.kind === "node" &&
            String(data.nodeId ?? "") !== activeNodeId &&
            typeof data.nodeType === "string" &&
            !layoutTypes.has(data.nodeType);
        });
        if (widgetHits.length) return [smallest(widgetHits)];

        // 2) In empty layout space: use the smallest (deepest) nested DropArea.
        const containerHits = collisions.filter(
          (collision) => dataFor(collision)?.kind === "container",
        );
        if (containerHits.length) return [smallest(containerHits)];

        // 3) On a layout outline: allow dropping into that Section/Container/Grid.
        const layoutHits = collisions.filter((collision) => {
          const data = dataFor(collision);
          return data?.kind === "node" &&
            String(data.nodeId ?? "") !== activeNodeId &&
            typeof data.nodeType === "string" &&
            layoutTypes.has(data.nodeType);
        });
        if (layoutHits.length) return [smallest(layoutHits)];

        return [];
      }}
      onDragEnd={handleDragEnd}
    >
      <main
        className={`${styles.builder} ${
          target.kind === "header" || target.kind === "footer"
            ? styles.builderInsideAdmin
            : ""
        }`}
      >
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
            <Link href={target.kind === "header" ? "/admin/appearance/header-builder" : target.kind === "footer" ? "/admin/appearance/footer-builder" : "/admin/builder"} className={styles.backButton}>
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
                        <ColorControl
                          key={color.id}
                          label={color.name}
                          value={color.value}
                          onChange={(value) => setGlobalColor(color.id, value)}
                        />
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
                      <UnitControl
                        label="Container Width"
                        value={String(settings.containerWidth || "1200px")}
                        onChange={(value) => updateSetting("containerWidth", value)}
                      />

                      <UnitControl
                        label="Default Widget Gap"
                        value={String(settings.defaultWidgetGap || "10px")}
                        onChange={(value) => updateSetting("defaultWidgetGap", value)}
                      />

                      <UnitControl
                        label="Default Section Padding"
                        value={String(settings.defaultSectionPadding || "20px")}
                        onChange={(value) => updateSetting("defaultSectionPadding", value)}
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
                      role="group"
                      aria-label="Responsive device settings"
                      style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: 7, border: "1px solid #dbe3ed", borderRadius: 8, background: "#f8fafc" }}
                    >
                      {([
                        ["desktop", Monitor, "Desktop"],
                        ["tablet", Tablet, "Tablet"],
                        ["mobile", Smartphone, "Mobile"],
                      ] as const).map(([targetDevice, DeviceIcon, label]) => (
                        <button
                          key={targetDevice}
                          type="button"
                          aria-label={`${label} responsive settings`}
                          aria-pressed={device === targetDevice}
                          title={`${label} settings`}
                          onClick={() => setDevice(targetDevice)}
                          style={{ display: "inline-flex", flex: 1, alignItems: "center", justifyContent: "center", gap: 6, minHeight: 34, border: device === targetDevice ? "1px solid #3984e8" : "1px solid transparent", borderRadius: 6, background: device === targetDevice ? "#ffffff" : "transparent", color: device === targetDevice ? "#1d4ed8" : "#64748b", fontSize: 11, fontWeight: device === targetDevice ? 700 : 500, cursor: "pointer" }}
                        >
                          <DeviceIcon size={15} />
                          <span>{label}</span>
                        </button>
                      ))}
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

                      <UnitControl
                        label="Container Width"
                        value={String(settings.containerWidth || "1200px")}
                        onChange={(value) => updateSetting("containerWidth", value)}
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
                {device.toUpperCase()} Â· Select any element to edit; drag its box to move; right-click for actions
              </span>
              <button
                type="button"
                onClick={addSection}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 34, padding: "0 12px", border: "1px solid #b9d3f2", borderRadius: 7, background: "#eff6ff", color: "#174f91", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <Plus size={15} /> Add Section
              </button>
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
                {renderGlobalTemplatePreview("Header", globalHeaderPreview)}

                <DropArea id="root" className={styles.canvasElements}>
                  {layout.root.length === 0 ? (
                    <div className={styles.emptyCanvas}>
                      <button
                        type="button"
                        className={styles.emptyCanvasIcon}
                        title="Add a Section or Grid"
                        aria-label="Add a Section or Grid"
                        onClick={addSection}
                      >
                        <Plus size={25} />
                      </button>

                      <h2>Start building your {target.kind}</h2>

                      <p>Drag a Section, Container or widget here.</p>

                      <div style={{ display: "flex", justifyContent: "center", gap: 9, flexWrap: "wrap" }}>
                        <button type="button" onClick={addSection}>
                          <Plus size={14} /> Add First Section
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActivePanel("widgets");
                            setElementTab("widgets");
                          }}
                        >
                          Browse Elements
                        </button>
                      </div>
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
                          onContextMenu={openNodeContextMenu}
                          onAddLayout={openNestedLayoutPicker}
                          onDelete={deleteNode}
                        />
                      ))}
                    </SortableContext>
                  )}
                  {target.kind === "header" ? (
                    <div className={styles.headerPagePreview} data-builder-preview-only="true">
                      <div className={styles.headerPagePreviewNote}>
                        SCROLL PREVIEW Â· Sample page content Â· Not saved in the Header template
                      </div>
                      <section className={styles.headerPagePreviewHero}>
                        <span>CONNECT BROADBAND</span>
                        <h2>Experience high-speed connectivity</h2>
                        <p>Scroll this preview. A Sticky Top header should remain visible while this sample page moves underneath it.</p>
                      </section>
                      <div className={styles.headerPagePreviewCards}>
                        <article><strong>Fast Fiber Internet</strong><p>Sample content to test the sticky header while scrolling the page.</p></article>
                        <article><strong>Reliable Connectivity</strong><p>This preview is only for the editor and is never saved to your website.</p></article>
                        <article><strong>Plans for Every Home</strong><p>Keep scrolling to confirm the header stays at the top of the preview.</p></article>
                      </div>
                      <div className={styles.headerPagePreviewLong}>
                        <h3>Page scroll area</h3>
                        <p>The Header template ends above. This sample area is intentionally tall so sticky behavior can be checked in the Builder canvas.</p>
                      </div>
                    </div>
                  ) : null}
                </DropArea>

                {renderGlobalTemplatePreview("Footer", globalFooterPreview)}
              </div>
            </div>
          </section>
        </div>

        {layoutPickerContext ? (
          <BuilderStructurePicker
            targetLabel={layoutPickerContext.rootSection ? "section" : "container"}
            onClose={() => setLayoutPickerContext(null)}
            onCreate={createLayoutFromPicker}
          />
        ) : null}

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
            initialTab={iconPickerTarget.kind === "repeaterItem" && iconPickerTarget.key === "icons" ? "social" : "all"}
            onClose={() => setIconPickerTarget(null)}
            onSelect={(iconName) => {
              const removingIcon = iconName === "";

              if (iconPickerTarget.kind === "button") {
                updatePropsValues({
                  iconName,
                  iconImage: "",
                  iconImageId: "",
                  ...(removingIcon ? { icon: "" } : {}),
                });
              } else if (iconPickerTarget.kind === "widget") {
                updatePropsValues({
                  iconName,
                  iconImage: "",
                  iconImageId: "",
                  ...(removingIcon ? { symbol: "", src: "" } : {}),
                });
              } else if (iconPickerTarget.kind === "nodeProp") {
                updatePropsValues({
                  [iconPickerTarget.key]:
                    removingIcon && iconPickerTarget.key === "submenuIndicator"
                      ? "none"
                      : iconName,
                });
              } else if (iconPickerTarget.kind === "repeaterItem" && selectedNode) {
                const entries = Array.isArray(selectedNode.props[iconPickerTarget.key])
                  ? [...(selectedNode.props[iconPickerTarget.key] as unknown[])]
                  : [];
                const current = entries[iconPickerTarget.index];
                const entry = current && typeof current === "object"
                  ? current as Record<string, unknown>
                  : {};
                entries[iconPickerTarget.index] = {
                  ...entry,
                  iconName,
                  iconImage: "",
                  iconMediaId: "",
                };
                updateProps(iconPickerTarget.key, entries);
              } else if (iconPickerTarget.kind === "slideButton" && selectedNode) {
                const slides = Array.isArray(selectedNode.props.slides)
                  ? [...(selectedNode.props.slides as unknown[])]
                  : [];
                const slideValue = slides[iconPickerTarget.slideIndex];
                const slide = slideValue && typeof slideValue === "object"
                  ? slideValue as Record<string, unknown>
                  : {};
                const buttons = Array.isArray(slide.buttons) ? [...slide.buttons] : [];
                const buttonValue = buttons[iconPickerTarget.buttonIndex];
                const button = buttonValue && typeof buttonValue === "object"
                  ? buttonValue as Record<string, unknown>
                  : {};
                buttons[iconPickerTarget.buttonIndex] = {
                  ...button,
                  iconName,
                  iconImage: "",
                  iconImageId: "",
                };
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
            aria-label={mediaTarget === "videoFile" ? "Choose Video" : mediaTarget === "audioFile" ? "Choose Audio" : "Media Library"}
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
                  <strong>{mediaTarget === "videoFile" ? "Choose Video" : mediaTarget === "audioFile" ? "Choose Audio" : "Media Library"}</strong>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    {mediaTarget === "videoFile" ? "Select a video from your Media Library" : mediaTarget === "audioFile" ? "Select audio from your Media Library" : "Choose media for this element"}
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
                            ) : item.mimeType?.startsWith("video/") ? (
                              <Video size={30} />
                            ) : item.mimeType?.startsWith("audio/") ? (
                              <Music size={30} />
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
// ELEMENTOR INDEPENDENT WIDTHS + PUBLIC LAYOUT V4 START
// ELEMENTOR SIZE CONTROLS + DIMENSION INDICATORS V5 START
