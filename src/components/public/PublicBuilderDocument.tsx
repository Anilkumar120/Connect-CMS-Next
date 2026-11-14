import type { CSSProperties, ReactNode } from "react";
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
import PublicNavigationMenu, {
  type PublicNavigationMenuItem,
} from "./PublicNavigationMenu";
import BuilderDynamicLink from "./BuilderDynamicLink";
import BannerSlider, { type BannerSliderSlide } from "./BannerSlider";
import { themeIcons } from "./theme-icons";

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

function responsive<T>(
  value: T | { desktop?: T; tablet?: T; mobile?: T } | undefined
): T | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object" || !("desktop" in value)) {
    return value as T;
  }
  return value.desktop as T | undefined;
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

function backgroundStyle(background: BuilderStyle["background"]): CSSProperties {
  if (!background) return {};
  const style: CSSProperties = {};

  if (background.color) style.backgroundColor = responsive(background.color);
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
  if (background.position) style.backgroundPosition = background.position;
  if (background.size) style.backgroundSize = background.size;
  if (background.repeat) {
    style.backgroundRepeat = background.repeat as CSSProperties["backgroundRepeat"];
  }
  if (background.attachment) {
    style.backgroundAttachment = background.attachment as CSSProperties["backgroundAttachment"];
  }
  return style;
}

function nodeStyle(node: BuilderNode): CSSProperties {
  const style: Record<string, string | number | undefined> = {};
  const s = node.styles;
  const put = (key: string, value: unknown) => {
    if (typeof value === "string" || typeof value === "number") {
      style[key] = value;
    }
  };

  for (const [key, value] of Object.entries({
    width: responsive(s.width),
    height: responsive(s.height),
    minWidth: responsive(s.minWidth),
    maxWidth: responsive(s.maxWidth),
    minHeight: responsive(s.minHeight),
    maxHeight: responsive(s.maxHeight),
    display: responsive(s.display),
    flexDirection: responsive(s.direction),
    justifyContent: responsive(s.justifyContent),
    alignItems: responsive(s.alignItems),
    alignContent: responsive(s.alignContent),
    alignSelf: responsive(s.alignSelf),
    flexWrap: responsive(s.flexWrap),
    gap: responsive(s.gap),
    rowGap: responsive(s.rowGap),
    columnGap: responsive(s.columnGap),
    flexGrow: responsive(s.flexGrow),
    flexShrink: responsive(s.flexShrink),
    flexBasis: responsive(s.flexBasis),
    order: responsive(s.order),
    gridTemplateColumns: responsive(s.gridTemplateColumns),
    gridTemplateRows: responsive(s.gridTemplateRows),
    gridAutoColumns: responsive(s.gridAutoColumns),
    gridAutoRows: responsive(s.gridAutoRows),
    gridAutoFlow: responsive(s.gridAutoFlow),
    gridColumn: responsive(s.gridColumn),
    gridRow: responsive(s.gridRow),
    color: responsive(s.color),
    mixBlendMode: s.blendMode,
    boxShadow: s.boxShadow,
    opacity: s.opacity,
    zIndex: s.zIndex,
    overflow: s.overflow,
    position: s.position === "default" ? undefined : s.position,
    top: responsive(s.top),
    right: responsive(s.right),
    bottom: responsive(s.bottom),
    left: responsive(s.left),
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
  const widthMode = responsive(node.advanced?.widthMode);
  if (widthMode === "inline") put("width", "fit-content");
  if (widthMode === "full") put("width", "100%");
  if (widthMode === "default") put("width", undefined);

  if (["section", "container", "row", "column", "grid"].includes(node.type)) {
    style.display = responsive(s.display) || (node.type === "grid" ? "grid" : "flex");
    if (style.display === "flex" && !style.flexDirection) {
      style.flexDirection =
        responsive(s.direction) || (node.type === "row" ? "row" : "column");
    }
  }

  put(
    "padding",
    builderSpacingCss(
      combineBuilderSpacing(responsive(s.padding), responsive(s.stylePadding)),
    ),
  );
  put(
    "margin",
    builderSpacingCss(
      combineBuilderSpacing(responsive(s.margin), responsive(s.styleMargin)),
    ),
  );
  put("borderRadius", responsive(s.border?.radius));
  if (s.border?.style && s.border.style !== "none") {
    put("borderStyle", s.border.style);
    put("borderWidth", s.border.width || "1px");
    put("borderColor", responsive(s.border.color) || "#dbe3ed");
  }

  if (s.typography) {
    put("fontFamily", s.typography.fontFamily);
    put("fontSize", responsive(s.typography.fontSize));
    put("fontWeight", s.typography.fontWeight);
    put("lineHeight", s.typography.lineHeight);
    put("letterSpacing", s.typography.letterSpacing);
    put("wordSpacing", s.typography.wordSpacing);
    put("fontStyle", s.typography.fontStyle);
    put("textTransform", s.typography.textTransform);
    put("textDecoration", s.typography.textDecoration);
    put("textAlign", responsive(s.typography.textAlign));
    put("textShadow", s.typography.textShadow);
    put("WebkitTextStroke", s.typography.textStroke);
  }

  Object.assign(style, backgroundStyle(s.background));
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
  const style = nodeStyle(node);
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

  if (node.type === "section" && node.props.contentWidth !== "full") {
    childrenStyle.width = "100%";
    childrenStyle.maxWidth = String(node.props.containerWidth || "1200px");
    childrenStyle.marginLeft = "auto";
    childrenStyle.marginRight = "auto";
  }

  return childrenStyle;
}

function responsiveCssValue(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return /^[\w\s#.,%()+/-]+$/.test(normalized) ? normalized : undefined;
}

function responsiveCss(nodes: BuilderNode[]): string {
  const rules: string[] = [];
  const layoutTypes = ["section", "container", "row", "column", "grid"];
  const collect = (node: BuilderNode) => {
    const style = node.styles;
    const declarations = (
      device: "tablet" | "mobile",
    ): Array<[string, string]> => {
      const style = node.styles;
      const entries: Array<[string, string | undefined]> = [
        ["width", responsiveCssValue(style.width?.[device])],
        ["height", responsiveCssValue(style.height?.[device])],
        ["min-width", responsiveCssValue(style.minWidth?.[device])],
        ["max-width", responsiveCssValue(style.maxWidth?.[device])],
        ["min-height", responsiveCssValue(style.minHeight?.[device])],
        ["max-height", responsiveCssValue(style.maxHeight?.[device])],
        ["display", layoutTypes.includes(node.type) ? undefined : responsiveCssValue(style.display?.[device])],
        ["align-self", responsiveCssValue(style.alignSelf?.[device])],
        ["flex-grow", responsiveCssValue(style.flexGrow?.[device])],
        ["flex-shrink", responsiveCssValue(style.flexShrink?.[device])],
        ["flex-basis", responsiveCssValue(style.flexBasis?.[device])],
        ["order", responsiveCssValue(style.order?.[device])],
        ["top", responsiveCssValue(style.top?.[device])],
        ["right", responsiveCssValue(style.right?.[device])],
        ["bottom", responsiveCssValue(style.bottom?.[device])],
        ["left", responsiveCssValue(style.left?.[device])],
        ["gap", layoutTypes.includes(node.type) || node.type === "menu" ? undefined : responsiveCssValue(style.gap?.[device])],
        ["--builder-menu-gap", node.type === "menu" ? responsiveCssValue(style.gap?.[device]) : undefined],
        ["font-size", responsiveCssValue(style.typography?.fontSize?.[device])],
        ["text-align", responsiveCssValue(style.typography?.textAlign?.[device])],
        ["border-radius", responsiveCssValue(style.border?.radius?.[device])],
        ["color", responsiveCssValue(responsiveOverride(style.color, device))],
        [
          "background-color",
          responsiveCssValue(responsiveOverride(style.background?.color, device)),
        ],
        [
          "border-color",
          responsiveCssValue(responsiveOverride(style.border?.color, device)),
        ],
      ];
      const widthMode = node.advanced?.widthMode;
      const deviceWidthMode =
        typeof widthMode === "string"
          ? widthMode
          : widthMode?.[device] ?? widthMode?.desktop;
      if (deviceWidthMode === "inline") {
        entries.push(["width", "fit-content"]);
      } else if (deviceWidthMode === "full") {
        entries.push(["width", "100%"]);
      } else if (deviceWidthMode === "default") {
        entries.push(["width", "auto"]);
      } else if (deviceWidthMode === "custom") {
        entries.push([
          "width",
          responsiveCssValue(style.width?.[device] ?? style.width?.desktop),
        ]);
      }
      entries.push(
        [
          "padding",
          responsiveCssValue(
            builderSpacingCss(
              combineBuilderSpacing(
                style.padding?.[device],
                style.stylePadding?.[device],
              ),
            ),
          ),
        ],
        [
          "margin",
          responsiveCssValue(
            builderSpacingCss(
              combineBuilderSpacing(
                style.margin?.[device],
                style.styleMargin?.[device],
              ),
            ),
          ),
        ],
      );
      return entries.filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      );
    };
    const layoutDeclarations = (
      device: "tablet" | "mobile",
    ): Array<[string, string]> => {
      if (!layoutTypes.includes(node.type)) return [];
      const style = node.styles;
      const entries: Array<[string, string | undefined]> = [
        ["display", responsiveCssValue(style.display?.[device])],
        ["flex-direction", responsiveCssValue(style.direction?.[device])],
        ["justify-content", responsiveCssValue(style.justifyContent?.[device])],
        ["align-items", responsiveCssValue(style.alignItems?.[device])],
        ["align-content", responsiveCssValue(style.alignContent?.[device])],
        ["flex-wrap", responsiveCssValue(style.flexWrap?.[device])],
        ["gap", responsiveCssValue(style.gap?.[device])],
        ["row-gap", responsiveCssValue(style.rowGap?.[device])],
        ["column-gap", responsiveCssValue(style.columnGap?.[device])],
        ["grid-template-columns", responsiveCssValue(style.gridTemplateColumns?.[device])],
        ["grid-template-rows", responsiveCssValue(style.gridTemplateRows?.[device])],
        ["grid-auto-columns", responsiveCssValue(style.gridAutoColumns?.[device])],
        ["grid-auto-rows", responsiveCssValue(style.gridAutoRows?.[device])],
        ["grid-auto-flow", responsiveCssValue(style.gridAutoFlow?.[device])],
      ];
      return entries.filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      );
    };
    const selector = `[data-builder-node-id=${JSON.stringify(node.id)}]`;
    if (node.advanced?.hideOnDesktop) {
      rules.push(`${selector}{display:none!important}`);
    }
    for (const device of ["tablet", "mobile"] as const) {
      const cssDeclarations = declarations(device);
      if (device === "tablet" && node.advanced?.hideOnTablet) {
        cssDeclarations.push(["display", "none"]);
      }
      if (device === "mobile" && node.advanced?.hideOnMobile) {
        cssDeclarations.push(["display", "none"]);
      }
      const layoutStyle = layoutDeclarations(device);
      if (!cssDeclarations.length && !layoutStyle.length) continue;
      const media =
        device === "tablet"
          ? "@media (min-width: 768px) and (max-width: 1024px)"
          : "@media (max-width: 767px)";
      const rootDeclarations = cssDeclarations
        .map(([property, value]) => `${property}:${value}!important`)
        .join(";");
      const imageDeclarations = cssDeclarations
        .filter(([property]) =>
          ["width", "height", "min-width", "max-width", "min-height", "max-height", "padding", "margin"].includes(property),
        )
        .map(([property, value]) => `${property}:${value}!important`)
        .join(";");
      const selectors = [`${selector}{${rootDeclarations}}`];
      const hoverDeclarations = [
        ["color", responsiveCssValue(responsiveOverride(style.colorHover, device))],
        [
          "background-color",
          responsiveCssValue(responsiveOverride(style.backgroundHover?.color, device)),
        ],
        [
          "border-color",
          responsiveCssValue(responsiveOverride(style.borderHover?.color, device)),
        ],
      ].filter((entry): entry is [string, string] => Boolean(entry[1]));
      if (hoverDeclarations.length) {
        selectors.push(
          `${selector}:hover{${hoverDeclarations
            .map(([property, value]) => `${property}:${value}!important`)
            .join(";")}}`,
        );
      }
      if (layoutStyle.length) {
        selectors.push(
          `[data-builder-layout-children=${JSON.stringify(node.id)}]{${layoutStyle
            .map(([property, value]) => `${property}:${value}!important`)
            .join(";")}}`,
        );
      }
      if (imageDeclarations && ["image", "featured-image", "site-logo"].includes(node.type)) {
        selectors.push(`${selector} img{${imageDeclarations}}`);
      }
      rules.push(`${media}{${selectors.join("")}}`);
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

function hoverCss(nodes: BuilderNode[]): string {
  const rules: string[] = [];
  const visit = (node: BuilderNode) => {
    const declarations: string[] = [];
    if (node.styles.opacityHover !== undefined) {
      declarations.push(`opacity:${node.styles.opacityHover}`);
    }
    const hoverColor = responsive(node.styles.colorHover);
    if (hoverColor) {
      declarations.push(`color:${hoverColor}`);
    }
    for (const [property, value] of Object.entries(
      backgroundStyle(node.styles.backgroundHover),
    )) {
      if (value !== undefined) {
        declarations.push(
          `${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${String(value)}`,
        );
      }
    }
    const border = node.styles.borderHover;
    if (border?.style && border.style !== "none") {
      declarations.push(
        `border:${border.width || "1px"} ${border.style} ${responsive(border.color) || "#dbe3ed"}`,
      );
    }
    if (border?.radius?.desktop) {
      declarations.push(`border-radius:${border.radius.desktop}`);
    }
    if (node.styles.boxShadowHover) {
      declarations.push(`box-shadow:${node.styles.boxShadowHover}`);
    }
    const transform = transformCss(node.styles.transformSettingsHover);
    if (transform) declarations.push(`transform:${transform}`);
    if (declarations.length) {
      rules.push(
        `[data-builder-node-id=${JSON.stringify(node.id)}]:hover{${declarations.map((declaration) => `${declaration}!important`).join(";")}}`,
      );
    }
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return rules.join("\n");
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

function customCss(nodes: BuilderNode[]): string {
  const rules: string[] = [];
  const collect = (node: BuilderNode) => {
    const css = node.advanced?.customCss || node.styles.customCss;
    if (typeof css === "string" && css.trim()) {
      const selector = `[data-builder-node-id=${JSON.stringify(node.id)}]`;
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

function renderNode(node: BuilderNode): ReactNode {
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
  const link = (value: unknown) => safeUrl(value) || "#";

  if (["section", "container", "row", "column", "grid"].includes(node.type)) {
    const Tag = layoutTag(node);
    const shellStyle = { ...style };
    if (shellStyle.display !== "none") shellStyle.display = "block";
    return (
      <Tag key={node.id} {...common} style={shellStyle}>
        <div
          data-builder-layout-children={node.id}
          style={layoutChildrenStyle(node)}
        >
          {children.map(renderNode)}
        </div>
      </Tag>
    );
  }
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
  if (node.type === "text") return <p key={node.id} {...common}>{text(node)}</p>;
  if (node.type === "button") {
    const target = props.target === "_blank" ? "_blank" : undefined;
    const ButtonIcon = themeIcons[stringProp("iconName")];
    const buttonIconImage = imageUrl(props.iconImage);
    const icon = buttonIconImage ? (
      <img src={buttonIconImage} alt="" width={16} height={16} />
    ) : ButtonIcon ? (
      <ButtonIcon size={16} />
    ) : stringProp("icon") || null;
    return (
      <a
        key={node.id}
        {...common}
        href={link(props.url)}
        title={stringProp("tooltip") || undefined}
        target={target}
        rel={target ? "noopener noreferrer" : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
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
        {props.iconPosition === "before" ? icon : null}
        {text(node)}
        {props.iconPosition === "after" ? icon : null}
      </a>
    );
  }
  if (["image", "featured-image", "site-logo"].includes(node.type)) {
    const src = imageUrl(props.src || props.image);
    if (!src) return null;
    const objectFit = ["contain", "cover", "fill", "none"].includes(String(props.objectFit))
      ? String(props.objectFit) as CSSProperties["objectFit"]
      : "cover";
    const img = <img src={src} alt={stringProp("alt")} title={stringProp("title") || undefined} style={{ ...style, width: style.width || (node.type === "site-logo" ? stringProp("width", "180px") : undefined), height: style.height || (node.type === "site-logo" ? stringProp("height", "auto") : undefined), maxWidth: "100%", objectFit, objectPosition: stringProp("objectPosition", "center center") }} />;
    const target = props.linkTarget === "_blank" ? "_blank" : undefined;
    return <figure key={node.id} {...common} style={{ ...style, margin: 0, padding: 0 }}>{props.link ? <a href={link(props.link)} target={target} rel={target ? "noopener noreferrer" : undefined}>{img}</a> : img}{props.caption ? <figcaption>{stringProp("caption")}</figcaption> : null}</figure>;
  }
  if (node.type === "icon") {
    const Icon = themeIcons[stringProp("iconName")];
    const src = imageUrl(props.src);
    return (
      <span key={node.id} {...common} style={{ ...style, fontSize: Number(props.size || 24), color: stringProp("color", "#0c2f55") }}>
        {src ? <img src={src} alt={stringProp("alt")} /> : Icon ? <Icon size={Number(props.size || 24)} /> : stringProp("symbol", "★")}
      </span>
    );
  }
  if (node.type === "icon-box") {
    const position = stringProp("iconPosition", "top");
    return <div key={node.id} {...common} style={{ ...style, display: "flex", flexDirection: position === "left" ? "row" : position === "right" ? "row-reverse" : "column", alignItems: "center", gap: 12 }}>
      <span>{stringProp("symbol", "★")}</span>
      <div><h3>{stringProp("title")}</h3><p>{stringProp("description")}</p></div>
    </div>;
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
          objectFit: ["contain", "cover", "fill", "none"].includes(String(props.objectFit))
            ? String(props.objectFit) as CSSProperties["objectFit"]
            : "cover",
        }}
      />
    ) : null;
    const target = props.linkTarget === "_blank" ? "_blank" : undefined;
    return <div key={node.id} {...common} style={{ ...style, display: "flex", flexDirection: position === "left" ? "row" : position === "right" ? "row-reverse" : "column", alignItems: "center", gap: 12 }}>
      {img ? (props.link ? <a href={link(props.link)} target={target} rel={target ? "noopener noreferrer" : undefined}>{img}</a> : img) : null}
      <div><h3>{stringProp("title")}</h3><p>{stringProp("description")}</p>{props.caption ? <small>{stringProp("caption")}</small> : null}</div>
    </div>;
  }
  if (node.type === "divider") return <hr key={node.id} {...common} style={{ ...style, border: 0, borderTop: `${stringProp("thickness", "1px")} ${stringProp("style", "solid")} ${stringProp("color", "#e2e8f0")}` }} />;
  if (node.type === "spacer") return <div key={node.id} {...common} style={{ ...style, minHeight: stringProp("height", "40px") }} aria-hidden="true" />;
  if (node.type === "video") {
    const src = safeUrl(props.url, true);
    return src ? <video key={node.id} {...common} src={src} poster={imageUrl(props.poster) || undefined} controls={props.controls !== false} autoPlay={Boolean(props.autoplay)} muted={Boolean(props.muted)} loop={Boolean(props.loop)} playsInline /> : null;
  }
  if (node.type === "audio") {
    const src = safeUrl(props.url, true);
    return src ? <audio key={node.id} {...common} src={src} controls={props.controls !== false} /> : null;
  }
  if (node.type === "menu") {
    const items = Array.isArray(props.items) ? props.items : [];
    return (
      <PublicNavigationMenu
        key={node.id}
        items={items as PublicNavigationMenuItem[]}
        style={{ ...style, width: style.width || "max-content" }}
        nodeId={node.id}
        id={typeof node.advanced?.cssId === "string" ? node.advanced.cssId : undefined}
        className={className}
        orientation={stringProp("orientation", "horizontal")}
        alignment={stringProp("alignment", "left")}
        mobileToggle={props.mobileToggle !== false}
        mobileBreakpoint={Number(props.mobileBreakpoint || 767)}
        mobileLayout={stringProp("mobileLayout", "slide-in")}
        mobilePosition={stringProp("mobilePosition", "right")}
        mobileWidth={stringProp("mobileWidth", "320px")}
        openIcon={stringProp("openIcon", "Menu")}
        closeIcon={stringProp("closeIcon")}
        iconSize={Number(props.mobileIconSize || 24)}
        itemPadding={stringProp("itemPadding")}
        itemIconName={stringProp("itemIconName")}
        iconColor={stringProp("iconColor", "#0c2f55")}
        menuId={stringProp("menuId")}
        menuLocation={stringProp("menuLocation", "HEADER")}
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
          display: "flex",
          width: style.width || "100%",
          maxWidth: "100%",
          minWidth: 0,
          gap: 8,
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
  if (node.type === "accordion" || node.type === "tabs") {
    const itemsValue = node.type === "tabs" ? props.tabs : props.items;
    const items = Array.isArray(itemsValue) ? itemsValue : [];
    return <div key={node.id} {...common}>{items.map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      return <details key={String(entry.id || index)} open={node.type === "accordion" && Boolean(props.firstOpen) && index === 0}><summary>{String(entry.title || `Item ${index + 1}`)}</summary><div>{String(entry.content || "")}</div></details>;
    })}</div>;
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
  if (node.type === "price-table") {
    const features = Array.isArray(props.features) ? props.features : [];
    return <section key={node.id} {...common}><h3>{stringProp("title", "Plan")}</h3><strong>{stringProp("currency", "₹")}{stringProp("price", "0")}</strong><span> / {stringProp("period", "month")}</span><ul>{features.map((feature, index) => <li key={index}>{String(feature)}</li>)}</ul><a href={link(props.buttonUrl)}>{stringProp("buttonText", "Choose Plan")}</a></section>;
  }
  if (node.type === "price-list") {
    const items = Array.isArray(props.items) ? props.items : [];
    return <ul key={node.id} {...common}>{items.map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul>;
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
    return <div key={node.id} {...common} style={{ ...style, display: "flex", gap: 12, overflowX: "auto" }}>{items.map((item, index) => {
      const entry = typeof item === "string" ? { url: item } : item && typeof item === "object" ? item as Record<string, unknown> : {};
      const src = imageUrl(entry.url || entry.src);
      return src ? <img key={index} src={src} alt={typeof entry.alt === "string" ? entry.alt : ""} style={{ maxWidth: "100%", width: 240, objectFit: "cover" }} /> : null;
    })}</div>;
  }
  if (node.type === "social-icons") {
    const icons = Array.isArray(props.icons) ? props.icons : [];
    return <div key={node.id} {...common}>{icons.map((icon, index) => {
      if (!icon || typeof icon !== "object") return null;
      const entry = icon as Record<string, unknown>;
      return <a key={index} href={link(entry.url)} target="_blank" rel="noopener noreferrer">{String(entry.label || entry.name || "Social")}</a>;
    })}</div>;
  }
  if (node.type === "google-maps") {
    const address = encodeURIComponent(stringProp("address"));
    return address ? <iframe key={node.id} {...common} title="Map" loading="lazy" src={`https://www.google.com/maps?q=${address}&output=embed`} style={{ ...style, width: "100%", height: stringProp("height", "350px"), border: 0 }} /> : null;
  }
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
    return <div key={node.id} {...common}>Shortcode: {stringProp("shortcode", "Enter shortcode")}</div>;
  }
  if (node.type === "posts" || node.type === "loop-grid") {
    const count = Math.min(6, Math.max(1, Number(props.count || 3)));
    const columns = Math.min(12, Math.max(1, Number(props.columns || 3)));
    return <div key={node.id} {...common} style={{ ...style, display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 12 }}>{Array.from({ length: count }, (_, index) => <article key={index} style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden", padding: 10 }}><div style={{ background: "#e2e8f0", height: 70, marginBottom: 8 }} /><strong>Post preview {index + 1}</strong><p style={{ fontSize: 12 }}>Dynamic post content preview.</p></article>)}</div>;
  }
  if (node.type === "loop-carousel") {
    return <div key={node.id} {...common}>{text(node)}</div>;
  }

  return <div key={node.id} {...common}>{text(node)}</div>;
}

function collectFontFamilies(
  nodes: BuilderNode[],
  families: Set<string>
) {
  for (const node of nodes) {
    const family = node.styles.typography?.fontFamily?.trim();
    if (family) families.add(family);
    if (node.children) collectFontFamilies(node.children, families);
  }
}

export default function PublicBuilderDocument({
  layout,
  globalStyles,
}: {
  layout: BuilderLayout;
  globalStyles?: BuilderGlobalStyles | null;
}) {
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
    responsiveCss(layout.root),
    hoverCss(layout.root),
    motionCss(layout.root),
    customCss(layout.root),
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
        style={{
          fontFamily:
            globalStyles?.fonts.find((font) => font.id === "primary-font")
              ?.family || undefined,
          ...globalColorVariables,
        } as CSSProperties}
      >
        {responsiveStyles ? (
          <style>{responsiveStyles}</style>
        ) : null}
        {layout.root.map(renderNode)}
      </div>
    </>
  );
}
