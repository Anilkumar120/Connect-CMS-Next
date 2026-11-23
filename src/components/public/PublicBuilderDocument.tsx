import { useId, type CSSProperties, type ReactNode } from "react";
import sanitizeHtml from "sanitize-html";
import Link from "next/link";
import type {
  BuilderGlobalStyles,
  BuilderLayout,
  BuilderNode,
  BuilderStyle,
} from "@/lib/builder/types";
import {
  builderSpacingCss,
  combineBuilderSpacing,
} from "@/lib/builder/spacing";
import {
  getResponsiveBuilderPropOverrides,
  resolveBuilderProps,
  resolveBuilderStyles,
} from "@/lib/builder/responsive";
import PublicNavigationMenu, {
  type PublicNavigationMenuItem,
} from "./PublicNavigationMenu";
import BuilderVideoPlayer from "./BuilderVideoPlayer";
import BuilderDynamicLink from "./BuilderDynamicLink";
import BannerSlider, { type BannerSliderSlide } from "./BannerSlider";
import { themeIcons } from "./theme-icons";
import PublicShortcodeWidget from "./PublicShortcodeWidget";
import PublicBuilderPosts from "./PublicBuilderPosts";
import PublicBuilderPostTabs from "./PublicBuilderPostTabs";
import PublicBuilderTabs from "./PublicBuilderTabs";
import PublicCountdownWidget from "./PublicCountdownWidget";
import PublicAnimatedHeadline from "./PublicAnimatedHeadline";
import PublicShareButtons from "./PublicShareButtons";
import PublicBuilderLoginForm from "./PublicBuilderLoginForm";
import PublicPostNavigation from "./PublicPostNavigation";

const imageUrl = (value: unknown) => safeUrl(value, true);

function safeUrl(value: unknown, image = false): string {
  if (typeof value !== "string" || !value.trim() || /^(javascript|vbscript|data):/i.test(value)) {
    return "";
  }

  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return (image ? ["https:"] : ["https:", "http:", "mailto:", "tel:"]).includes(
      parsed.protocol
    )
      ? url
      : "";
  } catch {
    return "";
  }
}

function cssLength(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function responsive<T>(
  value: T | { desktop?: T; tablet?: T; mobile?: T } | undefined,
  device: "desktop" | "tablet" | "mobile" = "desktop",
): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return value as T;
  const record = value as { desktop?: T; tablet?: T; mobile?: T };
  if (!("desktop" in record || "tablet" in record || "mobile" in record)) {
    return value as T;
  }
  return record[device] ?? record.desktop;
}

function responsiveOverride<T>(
  value: T | { desktop?: T; tablet?: T; mobile?: T } | undefined,
  device: "tablet" | "mobile",
): T | undefined {
  if (
    value === undefined ||
    value === null ||
    typeof value !== "object" ||
    !("desktop" in value)
  ) {
    return undefined;
  }
  return value[device] as T | undefined;
}

function backgroundStyle(
  background: BuilderStyle["background"],
  device: "desktop" | "tablet" | "mobile" = "desktop",
): CSSProperties {
  if (!background) return {};
  const style: CSSProperties = {};

  if (background.color) style.backgroundColor = responsive(background.color, device);
  if (background.type === "gradient" && background.gradient) {
    const gradient = background.gradient;
    const stops = gradient.stops?.length
      ? gradient.stops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")
      : `${gradient.color1 || "#3984e8"}, ${gradient.color2 || "#0c2f55"}`;
    style.backgroundImage =
      gradient.type === "radial"
        ? `radial-gradient(${gradient.position || "center"}, ${stops})`
        : `linear-gradient(${gradient.angle ?? 135}deg, ${stops})`;
  }
  if (
    (background.type === "image" && background.image) ||
    background.overlayImage
  ) {
    const url = imageUrl(background.image);
    const overlayImage = imageUrl(background.overlayImage);
    if (url || overlayImage) {
      const overlay = Math.max(0, Math.min(1, background.overlayOpacity || 0));
      const overlayColor =
        `color-mix(in srgb, ${background.overlayColor || "#000000"} ${Math.round(overlay * 100)}%, transparent)`;
      const layers = url ? [`url("${url.replace(/["\\]/g, "")}")`] : [];
      if (overlayImage) {
        layers.unshift(`url("${overlayImage.replace(/["\\]/g, "")}")`);
      }
      if (background.overlayColor && overlay > 0) {
        layers.unshift(`linear-gradient(${overlayColor}, ${overlayColor})`);
      }
      style.backgroundImage = layers.join(", ");
    }
  }
  if (background.positionX || background.positionY) {
    style.backgroundPosition = `${responsive(background.positionX, device) || "50%"} ${responsive(background.positionY, device) || "50%"}`;
  } else if (background.position) {
    style.backgroundPosition = background.position;
  }
  if (background.size) style.backgroundSize = background.size;
  if (background.repeat) {
    style.backgroundRepeat = background.repeat as CSSProperties["backgroundRepeat"];
  }
  if (background.attachment) {
    style.backgroundAttachment = background.attachment as CSSProperties["backgroundAttachment"];
  }
  return style;
}

function nodeStyleForDevice(
  node: BuilderNode,
  device: "desktop" | "tablet" | "mobile",
): CSSProperties {
  const style: Record<string, string | number | undefined> = {};
  const s = resolveBuilderStyles(node.styles, device);
  const put = (key: string, value: unknown) => {
    if (typeof value === "string" || typeof value === "number") {
      style[key] = value;
    }
  };

  for (const [key, value] of Object.entries({
    width: responsive(s.width, device),
    height: responsive(s.height, device),
    minWidth: responsive(s.minWidth, device),
    maxWidth: responsive(s.maxWidth, device),
    minHeight: responsive(s.minHeight, device),
    maxHeight: responsive(s.maxHeight, device),
    display: responsive(s.display, device),
    flexDirection: responsive(s.direction, device),
    justifyContent: responsive(s.justifyContent, device),
    alignItems: responsive(s.alignItems, device),
    alignContent: responsive(s.alignContent, device),
    alignSelf: responsive(s.alignSelf, device),
    flexWrap: responsive(s.flexWrap, device),
    gap: responsive(s.gap, device),
    rowGap: responsive(s.rowGap, device),
    columnGap: responsive(s.columnGap, device),
    flexGrow: responsive(s.flexGrow, device),
    flexShrink: responsive(s.flexShrink, device),
    flexBasis: responsive(s.flexBasis, device),
    order: responsive(s.order, device),
    gridTemplateColumns: responsive(s.gridTemplateColumns, device),
    gridTemplateRows: responsive(s.gridTemplateRows, device),
    gridAutoColumns: responsive(s.gridAutoColumns, device),
    gridAutoRows: responsive(s.gridAutoRows, device),
    gridAutoFlow: responsive(s.gridAutoFlow, device),
    gridColumn: responsive(s.gridColumn, device),
    gridRow: responsive(s.gridRow, device),
    color: responsive(s.color, device),
    mixBlendMode: s.blendMode,
    boxShadow: s.boxShadow,
    opacity: s.opacity,
    zIndex: s.zIndex,
    overflow: s.overflow,
    position: s.position === "default" ? undefined : s.position,
    top: responsive(s.top, device),
    right: responsive(s.right, device),
    bottom: responsive(s.bottom, device),
    left: responsive(s.left, device),
    transition: s.transition,
    transitionDuration: s.transitionDuration,
    transform: s.transform || transformCss(s.transformSettings),
    transformOrigin: s.transformSettings?.origin,
  })) {
    put(key, value);
  }
  if (s.motion?.sticky) {
    put("position", "sticky");
    const stickyOffset = `${s.motion.stickyOffset || 0}px`;
    put(s.motion.stickyPosition === "bottom" ? "bottom" : "top", stickyOffset);
  }
  if (s.motion?.entranceAnimation && s.motion.entranceAnimation !== "none") {
    put("animationName", s.motion.entranceAnimation);
    put("animationDuration", `${s.motion.animationDuration ?? 600}ms`);
    put("animationDelay", `${s.motion.animationDelay ?? 0}ms`);
    put("animationTimingFunction", s.motion.animationEasing || "ease");
    put("animationFillMode", "both");
  }
  if (
    (device === "desktop" && node.advanced?.hideOnDesktop) ||
    (device === "tablet" && node.advanced?.hideOnTablet) ||
    (device === "mobile" && node.advanced?.hideOnMobile)
  ) {
    style.display = "none";
  }

  const widthMode = responsive(node.advanced?.widthMode, device);
  if (widthMode === "inline") put("width", "fit-content");
  if (widthMode === "full") put("width", "100%");
  if (widthMode === "default") put("width", undefined);

  if (["section", "container", "row", "column", "grid"].includes(node.type)) {
    style.display = responsive(s.display, device) || (node.type === "grid" ? "grid" : "flex");
    if (style.display === "flex" && !style.flexDirection) {
      style.flexDirection =
        responsive(s.direction, device) || (node.type === "row" ? "row" : "column");
    }
  }

  put(
    "padding",
    builderSpacingCss(
      combineBuilderSpacing(responsive(s.padding, device), responsive(s.stylePadding, device)),
    ),
  );
  put(
    "margin",
    builderSpacingCss(
      combineBuilderSpacing(responsive(s.margin, device), responsive(s.styleMargin, device)),
    ),
  );
  put("borderRadius", responsive(s.border?.radius, device));
  if (s.border?.style && s.border.style !== "none") {
    put("borderStyle", s.border.style);
    put("borderWidth", s.border.width || "1px");
    put("borderColor", responsive(s.border.color, device) || "#dbe3ed");
  }

  if (s.typography) {
    put("fontFamily", s.typography.fontFamily);
    put("fontSize", responsive(s.typography.fontSize, device));
    put("fontWeight", s.typography.fontWeight);
    put("lineHeight", s.typography.lineHeight);
    put("letterSpacing", s.typography.letterSpacing);
    put("wordSpacing", s.typography.wordSpacing);
    put("fontStyle", s.typography.fontStyle);
    put("textTransform", s.typography.textTransform);
    put("textDecoration", s.typography.textDecoration);
    put("textAlign", responsive(s.typography.textAlign, device));
    put("textShadow", s.typography.textShadow);
    put("WebkitTextStroke", s.typography.textStroke);
  }

  Object.assign(style, backgroundStyle(s.background, device));
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
  if (s.filters) {
    const f = s.filters;
    const filters = [
      f.blur ? `blur(${f.blur}px)` : "",
      f.brightness !== undefined ? `brightness(${f.brightness}%)` : "",
      f.contrast !== undefined ? `contrast(${f.contrast}%)` : "",
      f.saturation !== undefined ? `saturate(${f.saturation}%)` : "",
      f.hue ? `hue-rotate(${f.hue}deg)` : "",
      f.grayscale ? `grayscale(${f.grayscale}%)` : "",
      f.sepia ? `sepia(${f.sepia}%)` : "",
      f.invert ? `invert(${f.invert}%)` : "",
    ].filter(Boolean);
    if (filters.length) put("filter", filters.join(" "));
  }

  return style as CSSProperties;
}

function layoutChildrenStyle(node: BuilderNode): CSSProperties {
  // The public DOM consumes CSS variables instead of hard-coded inline values.
  // Device media rules can therefore override them with normal cascade rules.
  const childrenStyle: CSSProperties = {
    display: "var(--builder-layout-display, flex)",
    flexDirection: "var(--builder-layout-flex-direction, column)" as CSSProperties["flexDirection"],
    justifyContent: "var(--builder-layout-justify-content, flex-start)",
    alignItems: "var(--builder-layout-align-items, stretch)",
    alignContent: "var(--builder-layout-align-content, stretch)",
    flexWrap: "var(--builder-layout-flex-wrap, nowrap)" as CSSProperties["flexWrap"],
    gap: "var(--builder-layout-gap, 0px)",
    rowGap: "var(--builder-layout-row-gap, 0px)",
    columnGap: "var(--builder-layout-column-gap, 0px)",
    gridTemplateColumns: "var(--builder-layout-grid-template-columns, none)",
    gridTemplateRows: "var(--builder-layout-grid-template-rows, auto)",
    gridAutoColumns: "var(--builder-layout-grid-auto-columns, auto)",
    gridAutoRows: "var(--builder-layout-grid-auto-rows, auto)",
    gridAutoFlow: "var(--builder-layout-grid-auto-flow, row)",
    width: "var(--builder-layout-width, 100%)",
    maxWidth: "var(--builder-layout-max-width, 100%)",
    marginLeft: "var(--builder-layout-margin-left, 0px)",
    marginRight: "var(--builder-layout-margin-right, 0px)",
    boxSizing: "border-box",
  };
  return childrenStyle;
}

function nodeStyle(node: BuilderNode): CSSProperties {
  const devices = ["desktop", "tablet", "mobile"] as const;
  const resolved = devices.map((device) => nodeStyleForDevice(node, device));
  const keys = new Set<string>();
  for (const value of resolved) {
    Object.keys(value).forEach((key) => keys.add(key));
  }

  const result: Record<string, string | number> = {};
  for (const key of keys) {
    const desktopValue = (resolved[0] as Record<string, unknown>)[key];
    const defaultDisplay: Record<string, string> = {
      section: "block", container: "block", row: "block", column: "block", grid: "block",
      button: "inline-flex", icon: "inline-flex", "icon-box": "flex", "icon-list": "flex",
      "social-icons": "flex", "image-carousel": "flex", "media-carousel": "flex",
      "post-info": "flex", "author-box": "flex", "search-form": "flex", "price-list": "grid",
      "posts": "grid", "loop-grid": "grid", "loop-carousel": "flex", "post-tabs": "block",
    };
    const fallback = desktopValue === undefined
      ? (key === "display" ? (defaultDisplay[node.type] || "block") : "initial")
      : String(desktopValue);
    const variableName = `--builder-style-${cssPropertyName(key)}`;
    result[key] = `var(${variableName}, ${fallback})`;
  }
  return result as CSSProperties;
}

function responsiveCssValue(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  if (!normalized || /[;{}<>]/.test(normalized)) return undefined;
  return /^[\w\s#.,%()+/:'"-]+$/.test(normalized) ? normalized : undefined;
}

function cssPropertyName(property: string): string {
  if (property.startsWith("Webkit")) {
    return `-webkit-${property.slice(6).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  }
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function responsiveCss(nodes: BuilderNode[], documentSelector: string): string {
  const rules: string[] = [];
  const layoutTypes = new Set(["section", "container", "row", "column", "grid"]);
  const devices = ["desktop", "tablet", "mobile"] as const;

  const cssValue = (value: unknown): string | undefined => {
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const normalized = String(value).trim();
    if (!normalized || /[;{}<>]/.test(normalized)) return undefined;
    return /^[\w\s#.,%()+/:'"-]+$/.test(normalized) ? normalized : undefined;
  };

  const collect = (node: BuilderNode) => {
    const selector = `${documentSelector} [data-builder-node-id=${JSON.stringify(node.id)}]`;
    const childrenSelector = `${documentSelector} [data-builder-layout-children=${JSON.stringify(node.id)}]`;

    for (const device of devices) {
      const style = resolveBuilderStyles(node.styles, device);
      const rawNodeStyle = nodeStyleForDevice(node, device) as Record<string, unknown>;
      const root = new Map<string, string>();
      const layout = new Map<string, string>();
      const widgetProps = resolveBuilderProps(node.props, device);
      const children = node.children || [];

      const add = (target: Map<string, string>, property: string, value: unknown) => {
        const normalized = cssValue(value);
        if (normalized !== undefined) target.set(property, normalized);
      };

      // Every Builder Style property is expressed as a CSS variable. This
      // keeps base and responsive rules in the stylesheet, not inline style.
      for (const [property, value] of Object.entries(rawNodeStyle)) {
        if (property === "display" && layoutTypes.has(node.type)) {
          const hidden = value === "none";
          add(root, "display", hidden ? "none" : "block");
        } else {
          add(root, cssPropertyName(property), value);
        }
      }

      // Layout properties belong to the inner layout wrapper. The same model
      // is used in Desktop, Tablet and Mobile, with each device resolving its
      // own merged values (Tablet/Mobile inherit directly from Desktop).
      if (layoutTypes.has(node.type)) {
        const display = responsive(style.display, device) || (node.type === "grid" ? "grid" : "flex");
        const direction = responsive(style.direction, device) || (node.type === "row" ? "row" : "column");
        add(layout, "display", display);
        add(layout, "flex-direction", direction);
        add(layout, "justify-content", responsive(style.justifyContent, device) || "flex-start");
        add(layout, "align-items", responsive(style.alignItems, device) || "stretch");
        add(layout, "align-content", responsive(style.alignContent, device) || "stretch");
        add(layout, "flex-wrap", responsive(style.flexWrap, device) || "nowrap");
        add(layout, "gap", responsive(style.gap, device) || "0px");
        add(layout, "row-gap", responsive(style.rowGap, device) || responsive(style.gap, device) || "0px");
        add(layout, "column-gap", responsive(style.columnGap, device) || responsive(style.gap, device) || "0px");
        add(layout, "grid-template-columns", responsive(style.gridTemplateColumns, device) || (display === "grid" ? `repeat(${Math.max(1, Math.min(6, children.length || 2))}, minmax(0, 1fr))` : "none"));
        add(layout, "grid-template-rows", responsive(style.gridTemplateRows, device) || "auto");
        add(layout, "grid-auto-columns", responsive(style.gridAutoColumns, device) || "auto");
        add(layout, "grid-auto-rows", responsive(style.gridAutoRows, device) || "auto");
        add(layout, "grid-auto-flow", responsive(style.gridAutoFlow, device) || "row");

        if (node.type === "section") {
          const contentWidth = widgetProps.contentWidth || "boxed";
          const containerWidth = widgetProps.containerWidth || "1200px";
          add(layout, "width", "100%");
          add(layout, "max-width", contentWidth === "full" ? "none" : containerWidth);
          add(layout, "margin-left", "auto");
          add(layout, "margin-right", "auto");
        }

        // Layout children fill the row equally when their parent is a flex row.
        // Explicit width / flex sizing remains authoritative.
        const childRules: string[] = [];
        if (display === "flex" && direction.startsWith("row")) {
          for (const child of children) {
            if (!layoutTypes.has(child.type)) continue;
            const childStyle = resolveBuilderStyles(child.styles, device);
            const childWidthMode = child.advanced?.widthMode;
            const resolvedWidthMode = typeof childWidthMode === "string"
              ? childWidthMode
              : childWidthMode?.[device] ?? childWidthMode?.desktop ?? "default";
            const childWidth = responsive(childStyle.width, device);
            const childFlexBasis = responsive(childStyle.flexBasis, device);
            const childFlexGrow = responsive(childStyle.flexGrow, device);
            const widthText = String(childWidth || "").trim();
            const isDefaultFullWidth = widthText === "100%" && resolvedWidthMode === "default";
            const hasExplicitSize = Boolean(
              (childWidth && !isDefaultFullWidth) ||
              childFlexBasis ||
              Number(childFlexGrow || 0) > 0 ||
              resolvedWidthMode === "custom" ||
              resolvedWidthMode === "full" ||
              resolvedWidthMode === "inline",
            );
            if (!hasExplicitSize) {
              childRules.push(
                `${childrenSelector} > [data-builder-node-id=${JSON.stringify(child.id)}]{flex:1 1 0%;min-width:0;max-width:100%;box-sizing:border-box}`,
              );
            }
          }
        } else if (display === "flex" && direction.startsWith("column")) {
          for (const child of children) {
            if (!layoutTypes.has(child.type)) continue;
            const childStyle = resolveBuilderStyles(child.styles, device);
            const childWidthMode = child.advanced?.widthMode;
            const resolvedWidthMode = typeof childWidthMode === "string"
              ? childWidthMode
              : childWidthMode?.[device] ?? childWidthMode?.desktop ?? "default";
            const resolvedChildWidth = responsive(childStyle.width, device);
            const isDefaultColumnWidth =
              !resolvedChildWidth || String(resolvedChildWidth).trim() === "100%";
            if (isDefaultColumnWidth && resolvedWidthMode === "default") {
              childRules.push(
                `${childrenSelector} > [data-builder-node-id=${JSON.stringify(child.id)}]{width:100%;min-width:0;box-sizing:border-box}`,
              );
            }
          }
        } else if (display === "grid") {
          for (const child of children) {
            if (layoutTypes.has(child.type)) {
              childRules.push(
                `${childrenSelector} > [data-builder-node-id=${JSON.stringify(child.id)}]{width:100%;min-width:0;box-sizing:border-box}`,
              );
            }
          }
        }
        if (childRules.length) {
          const selectorText = childRules.join("");
          if (device === "desktop") rules.push(selectorText);
          else {
            const media = device === "tablet"
              ? "@media (min-width: 768px) and (max-width: 1024px)"
              : "@media (max-width: 767px)";
            rules.push(`${media}{${selectorText}}`);
          }
        }
      }

      // Device-specific visual widget settings. Content fields remain shared.
      const responsivePropValues = device === "desktop"
        ? {}
        : getResponsiveBuilderPropOverrides(node, device);
      for (const [key, value] of Object.entries(responsivePropValues)) {
        if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key)) continue;
        const pixelProperties = new Set(["size", "iconSize", "buttonSize", "mobileIconSize"]);
        const normalizedValue = typeof value === "number" && pixelProperties.has(key) ? `${value}px` : value;
        add(root, `--builder-prop-${key}`, normalizedValue);
      }

      if (node.type === "button" && Object.prototype.hasOwnProperty.call(responsivePropValues, "iconPosition")) {
        add(root, "display", "inline-flex");
        add(root, "flex-direction", responsivePropValues.iconPosition === "after" ? "row-reverse" : "row");
        add(root, "align-items", "center");
      }
      if (node.type === "icon-box" && Object.prototype.hasOwnProperty.call(responsivePropValues, "iconPosition")) {
        const position = responsivePropValues.iconPosition;
        add(root, "display", "flex");
        add(root, "flex-direction", position === "left" ? "row" : position === "right" ? "row-reverse" : position === "bottom" ? "column-reverse" : "column");
        add(root, "align-items", "center");
      }
      if (node.type === "social-icons" && Object.prototype.hasOwnProperty.call(responsivePropValues, "shape")) {
        const selectedShape = responsivePropValues.shape;
        add(root, "--builder-prop-shape-radius", selectedShape === "square" ? "4px" : selectedShape === "rounded" ? "10px" : "999px");
      }

      if (node.type === "icon-list") {
        if (Object.prototype.hasOwnProperty.call(responsivePropValues, "layout")) {
          const selectedLayout = responsivePropValues.layout;
          if (selectedLayout === "grid") {
            add(root, "display", "grid");
            add(root, "grid-template-columns", `repeat(${Number(widgetProps.columns || 2)}, minmax(0, 1fr))`);
          } else if (selectedLayout === "inline") {
            add(root, "display", "flex");
            add(root, "flex-direction", "row");
            add(root, "flex-wrap", "wrap");
            add(root, "grid-template-columns", "none");
          } else {
            add(root, "display", "flex");
            add(root, "flex-direction", "column");
            add(root, "flex-wrap", "nowrap");
            add(root, "grid-template-columns", "none");
          }
        } else if (Object.prototype.hasOwnProperty.call(responsivePropValues, "columns") && widgetProps.layout === "grid") {
          add(root, "grid-template-columns", `repeat(${Number(widgetProps.columns || 2)}, minmax(0, 1fr))`);
        }
        if (Object.prototype.hasOwnProperty.call(responsivePropValues, "divider")) {
          const showDivider = Boolean(widgetProps.divider);
          const dividerColor = cssValue(widgetProps.dividerColor) || "#e2e8f0";
          add(root, "--builder-prop-divider-border", showDivider ? `1px solid ${dividerColor}` : "none");
          add(root, "--builder-prop-divider-padding", showDivider ? "8px" : "0px");
        }
      }

      const hidden =
        (device === "desktop" && node.advanced?.hideOnDesktop) ||
        (device === "tablet" && node.advanced?.hideOnTablet) ||
        (device === "mobile" && node.advanced?.hideOnMobile);
      if (hidden) add(root, "display", "none");
      else if (node.advanced?.hideOnDesktop) add(root, "display", layoutTypes.has(node.type) ? "block" : (rawNodeStyle.display as string) || "block");

      const hoverDeclarations = new Map<string, string>();
      const hoverColor = responsive(style.colorHover, device);
      if (hoverColor !== undefined) add(hoverDeclarations, "--builder-style-color", hoverColor);
      if (style.backgroundHover) {
        const hoverBackground = backgroundStyle(style.backgroundHover, device);
        for (const [property, value] of Object.entries(hoverBackground)) {
          add(hoverDeclarations, `--builder-style-${cssPropertyName(property)}`, value);
        }
      }
      if (style.borderHover) {
        add(hoverDeclarations, "--builder-style-border-color", responsive(style.borderHover.color, device));
        add(hoverDeclarations, "--builder-style-border-width", responsive(style.borderHover.width, device));
        add(hoverDeclarations, "--builder-style-border-radius", responsive(style.borderHover.radius, device));
        add(hoverDeclarations, "--builder-style-border-style", style.borderHover.style);
      }
      if (style.boxShadowHover !== undefined) add(hoverDeclarations, "--builder-style-box-shadow", style.boxShadowHover);
      if (style.opacityHover !== undefined) add(hoverDeclarations, "--builder-style-opacity", style.opacityHover);

      const selectorRules: string[] = [];
      if (root.size) {
        selectorRules.push(`${selector}{${[...root.entries()].map(([key, value]) => `${key.startsWith("--") ? key : `--builder-style-${key}`}:${value}`).join(";")}}`);
      }
      if (layout.size) {
        selectorRules.push(`${childrenSelector}{${[...layout.entries()].map(([key, value]) => `--builder-layout-${key}:${value}`).join(";")}}`);
      }
      if (hoverDeclarations.size) {
        if (node.type === "icon-list") {
          /* ICON LIST HOVER ISOLATION START */
          // Icon List is a repeater: hovering its wrapper must not place every
          // list item in the hover state. Apply the saved widget hover styles
          // to only the direct LI under the pointer.
          const itemHoverDeclarations = [...hoverDeclarations.entries()].map(
            ([property, value]) => {
              const cssProperty = property.replace(/^--builder-style-/, "");
              return `${cssProperty}:${value}${cssProperty === "color" ? " !important" : ""}`;
            },
          );
          const hoveredItemSelector = `${selector} > li:hover`;
          const hoveredItemDescendantSelector = `${hoveredItemSelector} *`;
          const itemHoverColor = hoverDeclarations.get("--builder-style-color");
          const itemHoverRule = itemHoverDeclarations.length
            ? `${hoveredItemSelector}{${itemHoverDeclarations.join(";")}}`
            : "";
          // Links and icon components may carry normal inline colors. An
          // item-scoped important color rule overrides them only while that
          // particular LI is hovered; adjacent LI elements remain unchanged.
          const itemDescendantColorRule = itemHoverColor
            ? `${hoveredItemDescendantSelector}{color:${itemHoverColor} !important}`
            : "";
          selectorRules.push(`${itemHoverRule}${itemDescendantColorRule}`);
          /* ICON LIST HOVER ISOLATION END */
        } else {
          selectorRules.push(`${selector}:hover{${[...hoverDeclarations.entries()].map(([key, value]) => `${key}:${value}`).join(";")}}`);
        }
      }

      if (selectorRules.length) {
        const selectorText = selectorRules.join("");
        if (device === "desktop") rules.push(selectorText);
        else {
          const media = device === "tablet"
            ? "@media (min-width: 768px) and (max-width: 1024px)"
            : "@media (max-width: 767px)";
          rules.push(`${media}{${selectorText}}`);
        }
      }
    }

    node.children?.forEach(collect);
  };

  nodes.forEach(collect);
  return rules.join("\n");
}

function transformCss(transform: BuilderStyle["transformSettings"]): string | undefined {
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


function motionCss(nodes: BuilderNode[]): string {
  const animations = new Set<string>();
  const collect = (node: BuilderNode) => {
    const animation = node.styles.motion?.entranceAnimation;
    if (animation && animation !== "none") animations.add(animation);
    node.children?.forEach(collect);
  };
  nodes.forEach(collect);

  const keyframes: Record<string, string> = {
    fadeIn: "from{opacity:0}to{opacity:1}",
    fadeInUp: "from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}",
    fadeInDown: "from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}",
    fadeInLeft: "from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}",
    fadeInRight: "from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}",
    zoomIn: "from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}",
    zoomOut: "from{opacity:0;transform:scale(1.15)}to{opacity:1;transform:scale(1)}",
    slideInUp: "from{transform:translateY(35px)}to{transform:translateY(0)}",
    slideInDown: "from{transform:translateY(-35px)}to{transform:translateY(0)}",
    bounce: "0%,20%,53%,100%{transform:translateY(0)}40%,43%{transform:translateY(-18px)}70%{transform:translateY(-9px)}90%{transform:translateY(-3px)}",
  };
  return [...animations]
    .filter((name) => keyframes[name])
    .map((name) => `@keyframes ${name}{${keyframes[name]}}`)
    .join("\n");
}

function customCss(nodes: BuilderNode[], documentSelector: string): string {
  const rules: string[] = [];
  const collect = (node: BuilderNode) => {
    const css = node.advanced?.customCss || node.styles.customCss;
    if (typeof css === "string" && css.trim()) {
      const selector = `${documentSelector} [data-builder-node-id=${JSON.stringify(node.id)}]`;
      rules.push(css.replace(/\bselector\b/g, selector).replace(/</g, "\\3C "));
    }
    node.children?.forEach(collect);
  };
  nodes.forEach(collect);
  return rules.join("\n");
}

function text(node: BuilderNode): string {
  for (const key of ["text", "content", "title"]) {
    if (typeof node.props[key] === "string") return node.props[key] as string;
  }
  return node.label;
}

function layoutTag(node: BuilderNode) {
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

export type PublicBuilderPostContext = {
  id: string;
  title: string;
  slug: string;
  postTypeId?: string | null;
  excerpt?: string | null;
  contentHtml?: string;
  featuredImage?: string | null;
  publishedAt?: Date | null;
  categories?: Array<{ name: string; slug: string }>;
};

function renderNode(node: BuilderNode, postContext?: PublicBuilderPostContext, postUrlPrefix = "/blog"): ReactNode {
  if (!node.enabled || node.advanced?.displayCondition === "hidden") return null;

  const props = node.props;
  const style = nodeStyle(node);
  const children = node.children ?? [];
  const className = node.advanced?.cssClasses;
  const common = {
    id: node.advanced?.cssId || undefined,
    className,
    style,
    "data-builder-node-id": node.id,
    ...Object.fromEntries(
      Object.entries(node.advanced?.attributes || {}).filter(
        ([name, value]) =>
          /^[a-zA-Z_:][a-zA-Z0-9_:.-]*$/.test(name) &&
          !/^on/i.test(name) &&
          !["id", "class", "style", "href"].includes(name.toLowerCase()) &&
          typeof value === "string",
      ),
    ),
  };
  const stringProp = (key: string, fallback = "") =>
    typeof props[key] === "string" ? (props[key] as string) : fallback;
  const styleProp = (key: string, fallback: string) =>
    `var(--builder-prop-${key}, ${fallback})`;
  const link = (value: unknown) => safeUrl(value) || "#";

  if (["section", "container", "row", "column", "grid"].includes(node.type)) {
    const Tag = layoutTag(node);
    return (
      <Tag key={node.id} {...common} style={style}>
        <div
          data-builder-layout-children={node.id}
          style={layoutChildrenStyle(node)}
        >
          {children.map((child) => renderNode(child, postContext, postUrlPrefix))}
        </div>
      </Tag>
    );
  }
  if (node.type === "post-title") {
    const level = stringProp("htmlTag", "h1");
    const Tag = /^h[1-6]$/.test(level) ? level as "h1" | "h2" | "h3" | "h4" | "h5" | "h6" : "h1";
    return <Tag key={node.id} {...common}>{postContext?.title || stringProp("fallbackText", "Current Post Title")}</Tag>;
  }
  if (node.type === "post-content") {
    const safeContent = sanitizeHtml(postContext?.contentHtml || stringProp("content"), { allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "video", "source"], allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, "*": ["class", "style"], a: ["href", "target", "rel"], img: ["src", "alt", "title", "width", "height", "loading"], video: ["src", "controls", "width", "height", "poster"], source: ["src", "type"] }, allowedSchemes: ["http", "https", "mailto", "tel"], allowProtocolRelative: false });
    return <div key={node.id} {...common} dangerouslySetInnerHTML={{ __html: safeContent }} />;
  }
  if (node.type === "post-excerpt") {
    const raw = postContext?.excerpt || stringProp("excerpt", "Current post excerpt will appear here.");
    const words = Math.max(1, Math.min(500, Number(props.length || 30)));
    const excerpt = raw.trim().split(/\s+/).slice(0, words).join(" ");
    return <p key={node.id} {...common}>{excerpt}{raw.trim().split(/\s+/).length > words ? "…" : ""}</p>;
  }
  if (node.type === "featured-image") {
    const src = imageUrl(postContext?.featuredImage || props.src || props.image);
    return src ? <img key={node.id} {...common} src={src} alt={stringProp("alt", postContext?.title || "")} style={{ ...style, maxWidth: "100%", width: style.width || "100%", height: style.height || "auto", objectFit: stringProp("objectFit", "cover") as CSSProperties["objectFit"] }} /> : null;
  }
  if (node.type === "post-info") {
    const parts: ReactNode[] = [];
    if (props.showDate !== false && postContext?.publishedAt) parts.push(<time key="date" dateTime={postContext.publishedAt.toISOString()}>{postContext.publishedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</time>);
    if (props.showCategories !== false && postContext?.categories?.length) parts.push(<span key="categories">{postContext.categories.map((category) => category.name).join(", ")}</span>);
    return <div key={node.id} {...common} style={{ ...style, display: "var(--builder-style-display, flex)", flexWrap: "var(--builder-style-flex-wrap, wrap)" as CSSProperties["flexWrap"], gap: "var(--builder-style-gap, 10px)" }}>{parts.length ? parts : stringProp("fallbackText", "Post metadata")}</div>;
  }
  if (node.type === "author-box") {
    const authorImage = imageUrl(props.authorImage);
    return <div key={node.id} {...common} style={{ ...style, display: "var(--builder-style-display, flex)", gap: "var(--builder-style-gap, 14px)", alignItems: "var(--builder-style-align-items, center)" }}>{props.showImage !== false && authorImage ? <img src={authorImage} alt={stringProp("authorName", "Author")} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} /> : null}<div>{props.showName !== false ? <strong>{stringProp("authorName", "Author")}</strong> : null}{stringProp("authorRole") ? <div>{stringProp("authorRole")}</div> : null}{props.showBio !== false && stringProp("authorBio") ? <p>{stringProp("authorBio")}</p> : null}</div></div>;
  }
  if (node.type === "post-navigation" && postContext) {
    return <PublicPostNavigation key={node.id} postId={postContext.id} postTypeId={postContext.postTypeId} publishedAt={postContext.publishedAt} prefix={postUrlPrefix} showPrevious={props.showPrevious !== false} showNext={props.showNext !== false} previousText={stringProp("previousText", "Previous Post")} nextText={stringProp("nextText", "Next Post")} />;
  }
  if (node.type === "archive-title") return <h1 key={node.id} {...common}>{stringProp("title", "Archive")}</h1>;
  if (node.type === "archive-description") return <p key={node.id} {...common}>{stringProp("description")}</p>;
  if (node.type === "pagination") return <nav key={node.id} {...common} aria-label="Pagination"><a href={stringProp("previousUrl", "?page=1")}>{stringProp("previousText", "Previous")}</a><span style={{ margin: "0 12px" }}>{stringProp("currentLabel", "Page")}</span><a href={stringProp("nextUrl", "?page=2")}>{stringProp("nextText", "Next")}</a></nav>;

  if (node.type === "heading") {
    const level = stringProp("level", "h2");
    const Tag = /^h[1-6]$/.test(level) ? (level as "h1" | "h2" | "h3" | "h4" | "h5" | "h6") : "h2";
    const heading = <Tag {...common}>{text(node)}</Tag>;
    if (props.linkType === "dynamic") {
      return (
        <BuilderDynamicLink key={node.id} destination={props.dynamicLink === "homepage" ? "homepage" : "current-page"}>
          {heading}
        </BuilderDynamicLink>
      );
    }
    return props.link ? (
      <a
        key={node.id}
        href={link(props.link)}
        target={props.linkTarget === "_blank" ? "_blank" : undefined}
        rel={props.linkTarget === "_blank" ? "noopener noreferrer" : undefined}
        style={{ color: "inherit", textDecoration: "none" }}
      >
        {heading}
      </a>
    ) : <Tag key={node.id} {...common}>{text(node)}</Tag>;
  }
  if (node.type === "text") {
    const richText = sanitizeHtml(stringProp("content"), {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, "h1", "h2", "h3", "h4", "h5", "h6", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "hr", "span"],
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["class", "style", "title"],
        a: ["href", "target", "rel", "title"],
        img: ["src", "alt", "title", "width", "height", "loading"],
        th: ["colspan", "rowspan"],
        td: ["colspan", "rowspan"],
      },
      allowedStyles: {
        "*": {
          color: [/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,24}|transparent)$/i],
          "background-color": [/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,24}|transparent)$/i],
          "text-align": [/^(left|right|center|justify)$/i],
          "font-size": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/i],
          "font-weight": [/^(normal|bold|[1-9]00)$/i],
          "font-style": [/^(normal|italic|oblique)$/i],
          "text-decoration": [/^(none|underline|line-through)$/i],
          "line-height": [/^\d+(?:\.\d+)?(?:px|em|rem|%)?$/i],
        },
      },
      allowedSchemes: ["http", "https", "mailto", "tel"],
      allowProtocolRelative: false,
    });
    return <div key={node.id} {...common} dangerouslySetInnerHTML={{ __html: richText }} />;
  }
  if (node.type === "button") {
    const target = props.target === "_blank" ? "_blank" : undefined;
    const ButtonIcon = themeIcons[stringProp("iconName")];
    const buttonIconImage = imageUrl(props.iconImage);
    const icon = buttonIconImage ? (
      <img src={buttonIconImage} alt="" width={16} height={16} />
    ) : ButtonIcon ? (
      <ButtonIcon size={16} />
    ) : stringProp("icon") || null;
    const initialIconPosition = stringProp("iconPosition", "before");
    return (
      <a
        key={node.id}
        {...common}
        href={link(props.url)}
        title={stringProp("tooltip") || undefined}
        target={target}
        rel={target ? "noopener noreferrer" : undefined}
        style={{
          display: "var(--builder-style-display, inline-flex)",
          flexDirection: ("var(--builder-style-flex-direction, " + (initialIconPosition === "after" ? "row-reverse" : "row") + ")") as CSSProperties["flexDirection"],
          alignItems: "center",
          justifyContent: "center",
          gap: styleProp("iconGap", "8px"),
          width: style.width || "fit-content",
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
          padding: "10px 18px",
          borderRadius: "5px",
          backgroundColor: "#0c2f55",
          color: "#ffffff",
          fontSize: "13px",
          fontWeight: 600,
          textDecoration: "none",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          ...style,
        }}
      >
        {icon ? <span data-builder-button-icon="true" style={{ display: "inline-flex", alignItems: "center", flex: "0 0 auto" }}>{icon}</span> : null}
        <span data-builder-button-text="true">{text(node)}</span>
      </a>
    );
  }
  if (["image", "featured-image", "site-logo"].includes(node.type)) {
    const src = imageUrl(props.src || props.image);
    if (!src) return null;
    const objectFit = ["contain", "cover", "fill", "none"].includes(String(props.objectFit))
      ? String(props.objectFit) as CSSProperties["objectFit"]
      : "cover";
    const img = <img src={src} alt={stringProp("alt")} title={stringProp("title") || undefined} style={{ ...style, width: style.width || (node.type === "site-logo" ? stringProp("width", "180px") : undefined), height: style.height || (node.type === "site-logo" ? stringProp("height", "auto") : undefined), maxWidth: "100%", objectFit: styleProp("objectFit", String(objectFit || "cover")) as CSSProperties["objectFit"], objectPosition: styleProp("objectPosition", stringProp("objectPosition", "center center")) }} />;
    const target = props.linkTarget === "_blank" ? "_blank" : undefined;
    return <figure key={node.id} {...common} style={{ ...style, margin: style.margin || 0, padding: style.padding || 0, textAlign: styleProp("alignment", stringProp("alignment", "left")) as CSSProperties["textAlign"] }}>{props.link ? <a href={link(props.link)} target={target} rel={target ? "noopener noreferrer" : undefined}>{img}</a> : img}{props.caption ? <figcaption>{stringProp("caption")}</figcaption> : null}</figure>;
  }
  if (node.type === "icon") {
    const Icon = themeIcons[stringProp("iconName")];
    const src = imageUrl(props.iconImage || props.src);
    const symbol = typeof props.symbol === "string" ? props.symbol : "";
    const sizeCss = styleProp("size", cssLength(props.size, "24px"));
    const iconColor = styleProp("iconColor", stringProp("iconColor", stringProp("color", "#0c2f55")));
    if (!src && !Icon && !symbol) return null;
    return (
      <span key={node.id} {...common} style={{ ...style, display: style.display || "inline-flex", alignItems: style.alignItems || "center", justifyContent: style.justifyContent || "center", width: style.width, height: style.height, fontSize: style.fontSize || sizeCss, color: style.color || iconColor }}>
        {src ? <img src={src} alt={stringProp("alt")} style={{ width: sizeCss, height: sizeCss, objectFit: "contain" }} /> : Icon ? <Icon size={24} style={{ width: sizeCss, height: sizeCss, color: iconColor }} strokeWidth={Number(props.strokeWidth || 2)} /> : symbol}
      </span>
    );
  }
  if (node.type === "icon-box") {
    const position = stringProp("iconPosition", "top");
    const Icon = themeIcons[stringProp("iconName")];
    const iconSrc = imageUrl(props.iconImage);
    const responsiveIconSize = styleProp("iconSize", cssLength(props.iconSize, "40px"));
    const responsiveIconColor = styleProp("iconColor", stringProp("iconColor", "#3984e8"));
    const symbol = typeof props.symbol === "string" ? props.symbol : "";
    const hasIcon = Boolean(iconSrc || Icon || symbol);
    const icon = !hasIcon ? null : iconSrc ? <img src={iconSrc} alt="" style={{ width: responsiveIconSize, height: responsiveIconSize, objectFit: "contain" }} /> : Icon ? <Icon size={40} style={{ width: responsiveIconSize, height: responsiveIconSize, color: responsiveIconColor }} /> : <span style={{ fontSize: responsiveIconSize, color: responsiveIconColor }}>{symbol}</span>;
    const content = <div><h3>{stringProp("title", "Feature Title")}</h3><p>{stringProp("description")}</p></div>;
    return <div key={node.id} {...common} style={{ ...style, display: style.display || "var(--builder-style-display, flex)", flexDirection: (style.flexDirection || `var(--builder-style-flex-direction, ${position === "left" ? "row" : position === "right" ? "row-reverse" : position === "bottom" ? "column-reverse" : "column"})`) as CSSProperties["flexDirection"], alignItems: style.alignItems || "var(--builder-style-align-items, center)", justifyContent: style.justifyContent || "var(--builder-style-justify-content, flex-start)", flexWrap: (style.flexWrap || "var(--builder-style-flex-wrap, nowrap)") as CSSProperties["flexWrap"], gap: style.gap || styleProp("gap", cssLength(props.gap, "12px")) }}>{icon}{content}</div>;
  }
  if (node.type === "icon-list") {
    const items = Array.isArray(props.items) ? props.items : [];
    const iconSizeCss = styleProp("iconSize", cssLength(props.iconSize, "16px"));
    const listLayout = stringProp("layout", "list");
    const listGap = styleProp("itemSpacing", stringProp("itemSpacing", "12px"));
    const listColumns = Math.max(1, Math.min(6, Number(props.columns || 2)));
    const listStyle: CSSProperties = {
      ...style,
      listStyle: "none",
      padding: 0,
      margin: 0,
      display: `var(--builder-style-display, ${listLayout === "grid" ? "grid" : "flex"})`,
      flexDirection: `var(--builder-style-flex-direction, ${listLayout === "inline" ? "row" : "column"})` as CSSProperties["flexDirection"],
      flexWrap: `var(--builder-style-flex-wrap, ${listLayout === "inline" ? "wrap" : "nowrap"})` as CSSProperties["flexWrap"],
      gridTemplateColumns: `var(--builder-style-grid-template-columns, ${listLayout === "grid" ? `repeat(var(--builder-prop-columns, ${listColumns}), minmax(0, 1fr))` : "none"})`,
      gap: `var(--builder-style-gap, ${listGap})`,
    };

    return (
      <ul key={node.id} {...common} style={listStyle}>
        {items.map((raw, index) => {
          if (!raw || typeof raw !== "object") return null;
          const item = raw as Record<string, unknown>;
          const iconName = typeof item.iconName === "string" ? item.iconName : "Check";
          const Icon = iconName ? themeIcons[iconName] : null;
          const iconSrc = imageUrl(item.iconImage);
          const hasItemIcon = Boolean(iconSrc || Icon);
          const responsiveIconSize = iconSizeCss;
          const iconColor = styleProp("iconColor", stringProp("iconColor", "#3984e8"));
          const itemText = String(item.text || item.label || `List item ${index + 1}`);
          const content = (
            <>
              {hasItemIcon ? (
                <span style={{ display: "inline-flex", flex: "0 0 auto", color: iconColor }}>
                  {iconSrc ? (
                    <img src={iconSrc} alt="" style={{ width: responsiveIconSize, height: responsiveIconSize, objectFit: "contain" }} />
                  ) : Icon ? (
                    <Icon size={16} style={{ width: responsiveIconSize, height: responsiveIconSize, color: iconColor }} />
                  ) : null}
                </span>
              ) : null}
              <span>{itemText}</span>
            </>
          );
          const isDynamic = item.linkType === "dynamic";
          const dynamicDestination = item.dynamicLink === "homepage" ? "homepage" : "current-page";
          const href = safeUrl(item.url);
          const target = item.linkTarget === "_blank" ? "_blank" : undefined;
          const itemContent = isDynamic ? (
            <BuilderDynamicLink destination={dynamicDestination}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: styleProp("iconGap", "9px"), color: styleProp("linkColor", "inherit"), textDecoration: "none" }}>
                {content}
              </span>
            </BuilderDynamicLink>
          ) : href && href !== "#" ? (
            <a
              href={href}
              target={target}
              rel={target ? "noopener noreferrer" : undefined}
              style={{ display: "inline-flex", alignItems: "center", gap: styleProp("iconGap", "9px"), color: styleProp("linkColor", "inherit"), textDecoration: "none" }}
            >
              {content}
            </a>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: styleProp("iconGap", "9px") }}>{content}</span>
          );

          return (
            <li
              key={String(item.id || index)}
              style={{
                display: "flex",
                alignItems: "center",
                minWidth: 0,
                gap: styleProp("iconGap", "9px"),
                color: styleProp("textColor", "inherit"),
                borderBottom: props.divider ? `1px solid ${styleProp("dividerColor", "#e2e8f0")}` : undefined,
                paddingBottom: props.divider ? 8 : undefined,
              }}
            >
              {itemContent}
            </li>
          );
        })}
      </ul>
    );
  }
  if (node.type === "image-box") {
    const src = imageUrl(props.image);
    const position = stringProp("imagePosition", "top");
    const img = src ? (
      <img
        src={src}
        alt={stringProp("alt")}
        title={stringProp("title") || undefined}
        style={{
          maxWidth: "100%",
          objectFit: styleProp("objectFit", ["contain", "cover", "fill", "none"].includes(String(props.objectFit))
            ? String(props.objectFit)
            : "cover") as CSSProperties["objectFit"],
        }}
      />
    ) : null;
    const target = props.linkTarget === "_blank" ? "_blank" : undefined;
    return <div key={node.id} {...common} style={{ ...style, display: style.display || "flex", flexDirection: style.flexDirection || (position === "left" ? "row" : position === "right" ? "row-reverse" : "column"), alignItems: style.alignItems || "center", justifyContent: style.justifyContent || "flex-start", flexWrap: style.flexWrap || "nowrap", gap: style.gap || "12px" }}>
      {img ? (props.link ? <a href={link(props.link)} target={target} rel={target ? "noopener noreferrer" : undefined}>{img}</a> : img) : null}
      <div><h3>{stringProp("title")}</h3><p>{stringProp("description")}</p>{props.caption ? <small>{stringProp("caption")}</small> : null}</div>
    </div>;
  }
  if (node.type === "divider") return <hr key={node.id} {...common} style={{ ...style, border: 0, borderTop: `${stringProp("thickness", "1px")} ${stringProp("style", "solid")} ${stringProp("color", "#e2e8f0")}` }} />;
  if (node.type === "spacer") return <div key={node.id} {...common} style={{ ...style, minHeight: style.minHeight || style.height || stringProp("height", "40px") }} aria-hidden="true" />;
  if (node.type === "video") {
    return (
      <BuilderVideoPlayer
        id={node.advanced?.cssId || undefined}
        className={className}
        nodeId={node.id}
        source={stringProp("source", "auto")}
        url={stringProp("url")}
        poster={stringProp("poster")}
        startTime={props.startTime as number | string | undefined}
        endTime={props.endTime as number | string | undefined}
        autoplay={Boolean(props.autoplay)}
        playOnMobile={Boolean(props.playOnMobile)}
        muted={Boolean(props.muted)}
        loop={Boolean(props.loop)}
        controls={props.controls !== false}
        captions={Boolean(props.captions)}
        captionsUrl={stringProp("captionsUrl")}
        captionsLanguage={stringProp("captionsLanguage", "en")}
        captionsLabel={stringProp("captionsLabel", "Captions")}
        privacyMode={Boolean(props.privacyMode)}
        lazyLoad={props.lazyLoad !== false}
        suggestedVideos={stringProp("suggestedVideos", "any")}
        modestBranding={Boolean(props.modestBranding)}
        showTitle={props.showTitle !== false}
        showPortrait={props.showPortrait !== false}
        showByline={props.showByline !== false}
        showInfo={props.showInfo !== false}
        showLogo={props.showLogo !== false}
        controlsColor={stringProp("controlsColor")}
        downloadButton={props.downloadButton !== false}
        preload={stringProp("preload", "metadata")}
        imageOverlay={Boolean(props.imageOverlay)}
        playIcon={props.playIcon !== false}
        lightbox={Boolean(props.lightbox)}
        aspectRatio={stringProp("aspectRatio", "16:9")}
        objectFit={stringProp("objectFit", "cover")}
        overlayOpacity={props.overlayOpacity as number | string | undefined}
        overlayColor={stringProp("overlayColor", "#000000")}
        playIconColor={stringProp("playIconColor", "#ffffff")}
        playIconSize={props.playIconSize as number | string | undefined}
        style={style}
      />
    );
  }
  if (node.type === "audio") {
    const src = safeUrl(props.url, true);
    return src ? (
      <audio
        key={node.id}
        {...common}
        src={src}
        controls={props.controls !== false}
        autoPlay={Boolean(props.autoplay)}
        loop={Boolean(props.loop)}
        preload={( ["auto", "metadata", "none"].includes(String(props.preload)) ? props.preload : "metadata") as "auto" | "metadata" | "none"}
        style={{ ...style, width: style.width || "100%" }}
      />
    ) : null;
  }
  if (node.type === "menu") {
    const items = Array.isArray(props.items) ? props.items : [];
    return (
      <PublicNavigationMenu
        key={node.id}
        items={items as PublicNavigationMenuItem[]}
        style={{ ...style, width: "var(--builder-style-width, 100%)" as CSSProperties["width"] }}
        nodeId={node.id}
        id={typeof node.advanced?.cssId === "string" ? node.advanced.cssId : undefined}
        className={className}
        orientation={stringProp("orientation", "horizontal")}
        alignment={stringProp("alignment", "left")}
        alignmentResponsive={(() => {
          const responsive = props.__responsive && typeof props.__responsive === "object"
            ? props.__responsive as Record<string, Record<string, unknown>>
            : {};
          return {
            tablet: typeof responsive.tablet?.alignment === "string" ? responsive.tablet.alignment : undefined,
            mobile: typeof responsive.mobile?.alignment === "string" ? responsive.mobile.alignment : undefined,
          };
        })()}
        responsiveSettings={(() => {
          const responsive = props.__responsive && typeof props.__responsive === "object"
            ? props.__responsive as Record<string, Record<string, unknown>>
            : {};
          return { tablet: responsive.tablet, mobile: responsive.mobile };
        })()}
        mobileToggle={props.mobileToggle !== false}
        mobileBreakpoint={Number(props.mobileBreakpoint || 1024)}
        mobileLayout={stringProp("mobileLayout", "slide-in")}
        mobilePosition={stringProp("mobilePosition", "right")}
        mobileWidth={styleProp("mobileWidth", cssLength(props.mobileWidth, "320px"))}
        openIcon={stringProp("openIcon", "Menu")}
        closeIcon={stringProp("closeIcon", "X")}
        iconSize={styleProp("mobileIconSize", cssLength(props.mobileIconSize, "24px"))}
        itemPadding={stringProp("itemPadding")}
        itemIconName={stringProp("itemIconName")}
        iconColor={styleProp("iconColor", stringProp("iconColor", "#0c2f55"))}
        menuId={stringProp("menuId")}
        menuLocation={stringProp("menuLocation", "HEADER")}
        menuItemStyles={props.menuItemStyles as import("./PublicNavigationMenu").ResponsiveMenuItemStyles}
        mobilePanelBackground={stringProp("mobilePanelBackground", "#ffffff")}
        mobilePanelBackgroundType={stringProp("mobilePanelBackgroundType", props.mobilePanelGradient && typeof props.mobilePanelGradient === "object" ? "gradient" : "classic")}
        mobilePanelGradient={props.mobilePanelGradient && typeof props.mobilePanelGradient === "object" ? props.mobilePanelGradient as { angle?: number; color1?: string; color2?: string } : undefined}
        mobilePanelColor={stringProp("mobilePanelColor", "#1f2937")}
        mobilePanelIconColor={stringProp("mobilePanelIconColor", "#1f2937")}
        mobileOverlayColor={stringProp("mobileOverlayColor", "rgba(15, 23, 42, 0.48)")}
        toggleHoverIconColor={stringProp("toggleHoverIconColor", "#3984e8")}
        toggleBackgroundColor={stringProp("toggleBackgroundColor", "transparent")}
        toggleHoverBackgroundColor={stringProp("toggleHoverBackgroundColor", "transparent")}
        closeIconColor={stringProp("closeIconColor", "#0c2f55")}
        closeIconHoverColor={stringProp("closeIconHoverColor", "#3984e8")}
        mobileLogo={stringProp("mobileLogo")}
        mobileLogoAlt={stringProp("mobileLogoAlt", "Site logo")}
        mobileLogoLinkType={stringProp("mobileLogoLinkType", "homepage")}
        mobileLogoLink={stringProp("mobileLogoLink", "/")}
        dropdownOpenAs={stringProp("dropdownOpenAs", "hover")}
        submenuIndicator={stringProp("submenuIndicator", "ChevronDown")}
        submenuClickArea={stringProp("submenuClickArea", "icon")}
        closeOnAnchorClick={props.closeOnAnchorClick !== false}
        onePage={Boolean(props.onePage)}
      />
    );
  }
  if (node.type === "site-title") {
    const title = <strong>{text(node)}</strong>;
    return props.link ? <a key={node.id} {...common} href={link(props.link)} style={{ ...style, color: "inherit" }}>{title}</a> : <strong key={node.id} {...common}>{text(node)}</strong>;
  }
  if (node.type === "breadcrumbs") return <nav key={node.id} {...common}>{props.showHome !== false ? <Link href="/">Home</Link> : null} {stringProp("separator", "/")} {text(node)}</nav>;
  if (node.type === "search-form") {
    return (
      <form
        key={node.id}
        {...common}
        action="/search"
        style={{
          ...style,
          display: style.display || "flex",
          flexDirection: style.flexDirection || "row",
          alignItems: style.alignItems || "center",
          justifyContent: style.justifyContent || "flex-start",
          flexWrap: style.flexWrap || "nowrap",
          width: style.width || "100%",
          maxWidth: style.maxWidth || "100%",
          minWidth: 0,
          gap: style.gap || "8px",
          boxSizing: "border-box",
        }}
      >
        <input
          name="q"
          placeholder={stringProp("placeholder", "Search...")}
          style={{
            flex: "1 1 0%",
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            padding: "8px 10px",
            border: "1px solid #cbd5e1",
            borderRadius: 5,
          }}
        />
        {props.showButton !== false ? (
          <button
            type="submit"
            style={{
              flex: "0 0 auto",
              padding: "8px 12px",
              border: "1px solid #0c2f55",
              borderRadius: 5,
              background: "#0c2f55",
              color: "#fff",
            }}
          >
            {stringProp("buttonText", "Search")}
          </button>
        ) : null}
      </form>
    );
  }
  if (node.type === "accordion") {
    const items = Array.isArray(props.items) ? props.items : [];
    return <div key={node.id} {...common}>{items.map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      return <details key={String(entry.id || index)} open={Boolean(props.firstOpen) && index === 0} style={{ borderBottom: `1px solid ${styleProp("dividerColor", stringProp("dividerColor", "#e2e8f0"))}`, padding: "10px 0", background: styleProp("titleBackground", stringProp("titleBackground", "#f8fafc")) }}><summary style={{ cursor: "pointer", fontWeight: 600, color: styleProp("titleColor", stringProp("titleColor", "#0c2f55")) }}>{String(entry.title || `Item ${index + 1}`)}</summary><div style={{ padding: "10px 0", color: styleProp("contentColor", stringProp("contentColor", "#334155")), background: styleProp("contentBackground", stringProp("contentBackground", "#ffffff")) }}>{String(entry.content || "")}</div></details>;
    })}</div>;
  }
  if (node.type === "tabs") {
    const items = Array.isArray(props.tabs) ? props.tabs : [];
    return <div key={node.id} {...common}><PublicBuilderTabs items={items as Array<{id?: string; title?: string; content?: string}>} style={{ width: "100%", minWidth: 0 }} normalColor={styleProp("tabNormalColor", stringProp("tabNormalColor", "#334155"))} normalBackground={styleProp("tabNormalBackground", stringProp("tabNormalBackground", "#f1f5f9"))} activeColor={styleProp("tabActiveColor", stringProp("tabActiveColor", "#ffffff"))} activeBackground={styleProp("tabActiveBackground", stringProp("tabActiveBackground", "#0c2f55"))} hoverColor={styleProp("tabHoverColor", stringProp("tabHoverColor", "#0c2f55"))} hoverBackground={styleProp("tabHoverBackground", stringProp("tabHoverBackground", "#e2e8f0"))} /></div>;
  }
  if (node.type === "toggle") return <details key={node.id} {...common} open={Boolean(props.open)}><summary>{stringProp("title", "Toggle")}</summary><div>{stringProp("content")}</div></details>;
  if (node.type === "counter") return <div key={node.id} {...common}><strong>{stringProp("prefix")}{String(props.end ?? 0)}{stringProp("suffix")}</strong><div>{stringProp("title")}</div></div>;
  if (node.type === "progress") {
    const percent = Math.max(0, Math.min(100, Number(props.percentage || 0)));
    return <div key={node.id} {...common}><span>{stringProp("title", "Progress")}</span><progress max={100} value={percent} /> {percent}%</div>;
  }
  if (node.type === "rating") {
    const maximum = Math.max(1, Math.min(10, Math.round(Number(props.maxRating || 5))));
    const rating = Math.max(0, Math.min(maximum, Math.round(Number(props.rating || 0))));
    return <div key={node.id} {...common}>{"★".repeat(rating)}{"☆".repeat(maximum - rating)}</div>;
  }
  if (node.type === "testimonial") return <blockquote key={node.id} {...common}><p>{stringProp("quote")}</p><strong>{stringProp("name")}</strong><small>{stringProp("role")}</small></blockquote>;
  if (node.type === "flip-box") return <details key={node.id} {...common} style={{ ...style, border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}><summary style={{ cursor: "pointer", listStyle: "none" }}><h3>{stringProp("frontTitle", "Front Title")}</h3><p>{stringProp("frontDescription")}</p><span>{stringProp("flipHint", "Click to view more")}</span></summary><div style={{ paddingTop: 14 }}><h3>{stringProp("backTitle", "Back Title")}</h3><p>{stringProp("backDescription")}</p>{stringProp("backButtonUrl") ? <a href={link(props.backButtonUrl)}>{stringProp("backButtonText", "Learn More")}</a> : null}</div></details>;
  if (node.type === "countdown") return <div key={node.id} {...common}><PublicCountdownWidget date={stringProp("date")} showDays={props.showDays !== false} showHours={props.showHours !== false} showMinutes={props.showMinutes !== false} showSeconds={props.showSeconds !== false} expiredText={stringProp("expiredText", "The offer has ended.")} numberColor={styleProp("numberColor", stringProp("numberColor", "#ffffff"))} labelColor={styleProp("labelColor", stringProp("labelColor", "#ffffff"))} boxBackground={styleProp("boxBackground", stringProp("boxBackground", "#0c2f55"))} boxRadius={styleProp("boxRadius", stringProp("boxRadius", "8px"))} style={{ width: "100%", minWidth: 0 }} /></div>;
  if (node.type === "animated-headline") return <div key={node.id} {...common}><PublicAnimatedHeadline beforeText={stringProp("beforeText")} animatedText={Array.isArray(props.animatedText) ? props.animatedText.filter((item): item is string => typeof item === "string") : []} afterText={stringProp("afterText")} animation={stringProp("animation", "typing")} interval={Number(props.interval || 2400)} style={{ width: "100%", minWidth: 0 }} /></div>;
  if (node.type === "share-buttons") return <div key={node.id} {...common}><PublicShareButtons networks={Array.isArray(props.networks) ? props.networks.filter((item): item is string => typeof item === "string") : undefined} showLabels={Boolean(props.showLabels)} buttonSize={Number(props.buttonSize || 40)} iconSize={Number(props.iconSize || 18)} shape={stringProp("shape", "circle")} iconColor={styleProp("iconColor", stringProp("iconColor", "#ffffff"))} backgroundColor={styleProp("iconBackground", stringProp("iconBackground", stringProp("backgroundColor", "#0c2f55")))} buttonSizeCss={styleProp("buttonSize", cssLength(props.buttonSize, "40px"))} iconSizeCss={styleProp("iconSize", cssLength(props.iconSize, "18px"))} style={{ width: "100%", minWidth: 0 }} /></div>;

  if (node.type === "price-table") {
    const features = Array.isArray(props.features) ? props.features : [];
    return <section key={node.id} {...common} style={{ ...style, border: `1px solid ${styleProp("cardBorderColor", stringProp("cardBorderColor", "#dbe3ed"))}`, borderRadius: "10px", padding: 22, background: styleProp("cardBackground", stringProp("cardBackground", "#ffffff")), textAlign: "center" }}><h3 style={{ color: styleProp("titleColor", stringProp("titleColor", "#0c2f55")) }}>{stringProp("title", "Plan")}</h3><strong style={{ color: styleProp("priceColor", stringProp("priceColor", "#3984e8")), fontSize: 30 }}>{stringProp("currency", "₹")}{stringProp("price", "0")}</strong><span> / {stringProp("period", "month")}</span><ul style={{ textAlign: "left" }}>{features.map((feature, index) => <li key={index}>{String(feature)}</li>)}</ul><a href={link(props.buttonUrl)} style={{ display: "inline-block", padding: "10px 16px", borderRadius: 6, textDecoration: "none", background: styleProp("buttonBackground", stringProp("buttonBackground", "#0c2f55")), color: styleProp("buttonColor", stringProp("buttonColor", "#ffffff")) }}>{stringProp("buttonText", "Choose Plan")}</a></section>;
  }
  if (node.type === "price-list") {
    const items = Array.isArray(props.items) ? props.items : [];
    return <ul key={node.id} {...common} style={{ ...style, listStyle: "none", padding: 0, margin: 0, display: style.display || "grid", gridTemplateColumns: style.gridTemplateColumns || "minmax(0, 1fr)", gap: style.gap || "10px" }}>{items.map((item, index) => { const entry = item && typeof item === "object" ? item as Record<string, unknown> : {}; return <li key={String(entry.id || index)} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}><span><strong>{String(entry.title || (typeof item === "string" ? item : `Item ${index + 1}`))}</strong>{entry.description ? <small style={{ display: "block" }}>{String(entry.description)}</small> : null}</span>{entry.price ? <strong>{String(entry.price)}</strong> : null}</li>; })}</ul>;
  }
  if (node.type === "call-to-action") return <section key={node.id} {...common}><h3>{stringProp("title")}</h3><p>{stringProp("description")}</p><a href={link(props.buttonUrl)}>{stringProp("buttonText", "Learn More")}</a></section>;
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

    return (
      <BannerSlider
        key={node.id}
        {...common}
        slides={slides}
        autoplay={props.autoplay !== false}
        autoplayDelay={Number(props.autoplayDelay || 5000)}
        navigation={props.navigation !== false}
        pagination={props.pagination !== false}
        transition={stringProp("transition", "slide")}
      />
    );
  }
  if (node.type === "image-carousel" || node.type === "media-carousel") {
    const raw = node.type === "image-carousel" ? props.images : node.type === "media-carousel" ? props.items : props.slides;
    const items = Array.isArray(raw) ? raw : [];
    return <div key={node.id} {...common} style={{ ...style, display: style.display || "flex", flexDirection: style.flexDirection || "row", alignItems: style.alignItems || "stretch", justifyContent: style.justifyContent || "flex-start", flexWrap: style.flexWrap || "nowrap", gap: style.gap || "12px", overflowX: (style.overflow || "auto") as CSSProperties["overflowX"] }}>{items.map((item, index) => {
      const entry = typeof item === "string" ? { url: item } : item && typeof item === "object" ? item as Record<string, unknown> : {};
      const src = imageUrl(entry.url || entry.src);
      return src ? <img key={index} src={src} alt={typeof entry.alt === "string" ? entry.alt : ""} style={{ maxWidth: "100%", width: 240, objectFit: "cover" }} /> : null;
    })}</div>;
  }
  if (node.type === "social-icons") {
    const icons = Array.isArray(props.icons) ? props.icons : [];
    const sizeCss = styleProp("iconSize", cssLength(props.iconSize, "22px"));
    const buttonSizeCss = styleProp("buttonSize", cssLength(props.buttonSize, "40px"));
    const shape = stringProp("shape", "circle");
    const radius = shape === "square" ? "4px" : shape === "rounded" ? "10px" : "999px";
    return <div key={node.id} {...common} style={{ ...style, display: style.display || "flex", flexDirection: style.flexDirection || "row", alignItems: style.alignItems || "center", justifyContent: style.justifyContent || "flex-start", flexWrap: style.flexWrap || "wrap", gap: style.gap || cssLength(props.gap, "12px") }}>{icons.map((icon, index) => {
      if (!icon || typeof icon !== "object") return null;
      const entry = icon as Record<string, unknown>;
      const name = String(entry.iconName || entry.name || "");
      const SocialIcon = themeIcons[name];
      const iconImage = imageUrl(entry.iconImage);
      const label = String(entry.label || entry.name || "Social");
      if (!SocialIcon && !iconImage) return null;
      const href = safeUrl(entry.url) || "#";
      const responsiveIconColor = styleProp("iconColor", stringProp("iconColor", "#ffffff"));
      return <a key={String(entry.id || index)} href={href} aria-label={label} title={label} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: buttonSizeCss, height: buttonSizeCss, flex: "0 0 auto", borderRadius: styleProp("shapeRadius", radius), color: responsiveIconColor, background: styleProp("iconBackground", stringProp("iconBackground", "#0c2f55")), textDecoration: "none" }}>{iconImage ? <img src={iconImage} alt="" style={{ width: sizeCss, height: sizeCss, objectFit: "contain" }} /> : SocialIcon ? <SocialIcon size={22} style={{ width: sizeCss, height: sizeCss, color: responsiveIconColor }} /> : null}</a>;
    })}</div>;
  }
  if (node.type === "google-maps") {
    const address = encodeURIComponent(stringProp("address"));
    return address ? <iframe key={node.id} {...common} title="Map" loading="lazy" src={`https://www.google.com/maps?q=${address}&output=embed`} style={{ ...style, width: style.width || "100%", height: style.height || stringProp("height", "350px"), border: 0 }} /> : null;
  }
  if (node.type === "login-form") return <div key={node.id} {...common}><PublicBuilderLoginForm usernameLabel={stringProp("usernameLabel", "Username or Email")} passwordLabel={stringProp("passwordLabel", "Password")} submitText={stringProp("submitText", "Log In")} rememberMe={props.rememberMe !== false} style={{ width: "100%", minWidth: 0 }} /></div>;
  if (node.type === "form") {
    const fields = Array.isArray(props.fields) ? props.fields : [];
    return <form key={node.id} {...common}>{fields.map((field, index) => {
      if (!field || typeof field !== "object") return null;
      const entry = field as Record<string, unknown>;
      const label = String(entry.label || "Field");
      return <label key={String(entry.id || index)} style={{ display: "block", marginBottom: 12 }}>{label}{entry.type === "textarea" ? <textarea name={String(entry.name || "")} required={Boolean(entry.required)} placeholder={String(entry.placeholder || "")} /> : <input type={["email", "tel", "number", "url"].includes(String(entry.type)) ? String(entry.type) : "text"} name={String(entry.name || "")} required={Boolean(entry.required)} placeholder={String(entry.placeholder || "")} />}</label>;
    })}<button type="submit">{stringProp("submitText", "Submit")}</button></form>;
  }
  if (node.type === "html") {
    const html = sanitizeHtml(stringProp("html"), {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "figure", "figcaption"],
      allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, "*": ["class", "style"], a: ["href", "target", "rel"], img: ["src", "alt", "title", "width", "height"] },
      allowedSchemes: ["http", "https", "mailto", "tel"],
      allowProtocolRelative: false,
    });
    return <div key={node.id} {...common} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (node.type === "lottie") {
    return <div key={node.id} {...common}>Lottie preview: {stringProp("url", "Select Lottie JSON")}</div>;
  }
  if (node.type === "shortcode") {
    return <div key={node.id} {...common}><PublicShortcodeWidget code={stringProp("shortcode")} /></div>;
  }
  if (node.type === "posts" || node.type === "loop-grid" || node.type === "loop-carousel") {
    return <div key={node.id} {...common}><PublicBuilderPosts postType={stringProp("postType", "post")} count={Number(props.count || 6)} columns={Number(props.columns || 3)} category={stringProp("category")} orderBy={stringProp("orderBy", "date")} order={stringProp("order", "desc")} showImage={props.showImage !== false} showTitle={props.showTitle !== false} showExcerpt={props.showExcerpt !== false} showDate={props.showDate !== false} showReadMore={props.showReadMore !== false} readMoreText={stringProp("readMoreText", "Read More")} imageHeight={styleProp("imageHeight", stringProp("imageHeight", "180px"))} cardBackground={styleProp("cardBackground", stringProp("cardBackground", "#ffffff"))} cardBorderColor={styleProp("cardBorderColor", stringProp("cardBorderColor", "#e2e8f0"))} cardRadius={styleProp("cardRadius", stringProp("cardRadius", "8px"))} gap={styleProp("gap", stringProp("gap", "18px"))} layout={node.type === "loop-carousel" ? "carousel" : "grid"} style={{ ...style, width: style.width || "100%", minWidth: 0 }} /></div>;
  }
  if (node.type === "post-tabs") {
    return <div key={node.id} {...common}><PublicBuilderPostTabs postType={stringProp("postType", "post")} tabs={Array.isArray(props.tabs) ? props.tabs as Array<{id?: string; title?: string; categorySlug?: string}> : []} count={Number(props.count || 4)} columns={Number(props.columns || 2)} orderBy={stringProp("orderBy", "date")} order={stringProp("order", "desc")} showImage={props.showImage !== false} showTitle={props.showTitle !== false} showExcerpt={props.showExcerpt !== false} showDate={props.showDate !== false} showReadMore={props.showReadMore !== false} readMoreText={stringProp("readMoreText", "Read More")} tabNormalColor={styleProp("tabNormalColor", stringProp("tabNormalColor", "#334155"))} tabNormalBackground={styleProp("tabNormalBackground", stringProp("tabNormalBackground", "#f1f5f9"))} tabActiveColor={styleProp("tabActiveColor", stringProp("tabActiveColor", "#ffffff"))} tabActiveBackground={styleProp("tabActiveBackground", stringProp("tabActiveBackground", "#0c2f55"))} tabHoverColor={styleProp("tabHoverColor", stringProp("tabHoverColor", "#0c2f55"))} tabHoverBackground={styleProp("tabHoverBackground", stringProp("tabHoverBackground", "#e2e8f0"))} gap={styleProp("gap", stringProp("gap", "16px"))} imageHeight={styleProp("imageHeight", stringProp("imageHeight", "150px"))} cardBackground={styleProp("cardBackground", stringProp("cardBackground", "#ffffff"))} cardBorderColor={styleProp("cardBorderColor", stringProp("cardBorderColor", "#e2e8f0"))} cardRadius={styleProp("cardRadius", stringProp("cardRadius", "8px"))} style={{ ...style, width: style.width || "100%", minWidth: 0 }} /></div>;
  }

  return <div key={node.id} {...common}>{text(node)}</div>;
}

function collectFontFamilies(
  nodes: BuilderNode[],
  families: Set<string>
) {
  for (const node of nodes) {
    const family = resolveBuilderStyles(node.styles, "desktop").typography?.fontFamily?.trim();
    if (family) families.add(family);
    if (node.children) collectFontFamilies(node.children, families);
  }
}

export default function PublicBuilderDocument({
  layout,
  globalStyles,
  postContext,
  postUrlPrefix = "/blog",
}: {
  layout: BuilderLayout;
  globalStyles?: BuilderGlobalStyles | null;
  postContext?: PublicBuilderPostContext;
  postUrlPrefix?: string;
}) {
  // Every page, header, footer and post document receives an independent CSS
  // scope. Builder node IDs can repeat across documents (for example the
  // default-section ID), so unscoped selectors make one document's responsive
  // padding/margins affect another document.
  const documentId = useId();
  const documentSelector = `[data-builder-document-id=${JSON.stringify(documentId)}]`;

  const fontFamilies = new Set(
    (globalStyles?.fonts ?? [])
      .map((font) => font.family.trim())
      .filter(Boolean)
  );
  collectFontFamilies(layout.root, fontFamilies);
  const googleFonts = [...fontFamilies].filter(
    (family) =>
      /^[\p{L}\d -]+$/u.test(family) &&
      !/^(arial|helvetica|sans-serif|serif|monospace|system-ui)$/i.test(family)
  );
  const googleFontsQuery = new URLSearchParams();
  for (const family of googleFonts) {
    googleFontsQuery.append("family", family);
  }

  const globalColorVariables = Object.fromEntries(
    (globalStyles?.colors ?? [])
      .filter(
        (color) =>
          /^[a-zA-Z0-9_-]+$/.test(color.id) &&
          /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(
            color.value
          )
      )
      .map((color) => [`--builder-color-${color.id}`, color.value])
  );
  const responsiveStyles = [
    responsiveCss(layout.root, documentSelector),
    motionCss(layout.root),
    customCss(layout.root, documentSelector),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      {googleFonts.length > 0 && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            rel="stylesheet"
            href={`https://fonts.googleapis.com/css2?${googleFontsQuery.toString()}&display=swap`}
          />
        </>
      )}
      <div
        className="public-builder-document"
        data-builder-document-id={documentId}
        style={{
          width: "100%",
          minWidth: 0,
          fontFamily:
            globalStyles?.fonts.find((font) => font.id === "primary-font")
              ?.family || undefined,
          ...globalColorVariables,
        } as CSSProperties}
      >
        {responsiveStyles ? (
          <style>{responsiveStyles}</style>
        ) : null}
        {layout.root.map((node) => renderNode(node, postContext, postUrlPrefix))}
      </div>
    </>
  );
}
