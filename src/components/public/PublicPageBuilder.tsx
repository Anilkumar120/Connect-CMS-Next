import type { CSSProperties, ElementType, ReactNode } from "react";
import type {
  PageBuilderElement,
  PageBuilderLayout,
  PageBuilderStyles,
} from "@/lib/page-builder-types";

const lengthPattern =
  /^-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|vh|vw)?$/i;
const colorPattern =
  /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i;

function safeLength(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim();
  return normalized === "auto" || normalized === "0" || lengthPattern.test(normalized)
    ? normalized
    : undefined;
}

function safeSpacing(value: string | undefined) {
  if (!value) return undefined;
  const parts = value.trim().split(/\s+/);
  if (
    parts.length > 4 ||
    parts.some(
      (part) =>
        part !== "auto" && part !== "0" && !lengthPattern.test(part)
    )
  ) {
    return undefined;
  }
  return parts.join(" ");
}

function safeColor(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim();
  return colorPattern.test(normalized) ? normalized : undefined;
}

function safeImageUrl(value: string | undefined) {
  if (!value) return "";
  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeHref(value: string | undefined) {
  if (!value) return "#";
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }

  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol)
      ? value
      : "#";
  } catch {
    return "#";
  }
}

function safeBackgroundUrl(value: string | undefined) {
  const url = safeImageUrl(value);
  return url && !/["'()<>\\]/.test(url) ? `url("${url}")` : undefined;
}

function withCustomLink(
  element: PageBuilderElement,
  child: ReactNode
): ReactNode {
  if (
    !element.href ||
    element.type === "button" ||
    element.type === "link" ||
    element.type === "section" ||
    element.type === "container"
  ) {
    return child;
  }
  const target = element.linkTarget ?? "_self";
  return (
    <a
      key={`${element.id}-custom-link`}
      className="page-builder-custom-link"
      href={safeHref(element.href)}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
    >
      {child}
    </a>
  );
}

function getStyles(styles: PageBuilderStyles | undefined) {
  if (!styles) return {};

  const fontFamily = styles.fontFamily?.trim();
  const fontWeight = styles.fontWeight?.trim();
  const textAlign = styles.textAlign?.trim();
  const borderRadius = safeLength(styles.borderRadius);
  const borderWidth = safeLength(styles.borderWidth);
  const borderColor = safeColor(styles.borderColor);
  const borderStyle = styles.borderStyle && /^(none|solid|dashed|dotted)$/.test(styles.borderStyle)
    ? styles.borderStyle
    : undefined;
  const backgroundImage = safeBackgroundUrl(styles.backgroundImage);

  return {
    "--pb-normal-color": safeColor(styles.color),
    "--pb-normal-background": safeColor(styles.backgroundColor),
    "--pb-hover-color": safeColor(styles.hoverColor),
    "--pb-hover-background": safeColor(styles.hoverBackgroundColor),
    backgroundImage,
    backgroundSize: backgroundImage ? "cover" : undefined,
    backgroundPosition: backgroundImage ? "center" : undefined,
    fontFamily:
      fontFamily && /^[\w\s,"'-]+$/.test(fontFamily)
        ? fontFamily
        : undefined,
    fontSize: safeLength(styles.fontSize),
    fontWeight:
      fontWeight && /^(normal|bold|[1-9]00)$/.test(fontWeight)
        ? fontWeight
        : undefined,
    textAlign:
      textAlign && /^(left|center|right|justify)$/.test(textAlign)
        ? (textAlign as CSSProperties["textAlign"])
        : undefined,
    borderRadius,
    borderWidth,
    borderColor,
    borderStyle,
    minWidth: safeLength(styles.minWidth),
    maxWidth: safeLength(styles.maxWidth),
    minHeight: safeLength(styles.minHeight),
    maxHeight: safeLength(styles.maxHeight),
    flexBasis: safeLength(styles.flexBasis),
    flexGrow: styles.flexGrow && /^\\d+(?:\\.\\d+)?$/.test(styles.flexGrow) ? Number(styles.flexGrow) : undefined,
    flexShrink: styles.flexShrink && /^\\d+(?:\\.\\d+)?$/.test(styles.flexShrink) ? Number(styles.flexShrink) : undefined,
    order: styles.order && /^-?\\d+$/.test(styles.order) ? Number(styles.order) : undefined,
    overflow: styles.overflow,
  } as CSSProperties;
}

function getResponsiveVariables(
  element: PageBuilderElement
): CSSProperties {
  const variables: Record<string, string> = {};

  for (const device of ["desktop", "tablet", "mobile"] as const) {
    const responsive = element.responsive?.[device];
    for (const property of [
      "width", "height", "margin", "padding", "gap",
      "minWidth", "maxWidth", "minHeight", "maxHeight",
      "flexBasis",
    ] as const) {
      const rawValue =
        responsive?.[property] ??
        (device === "desktop" ? element.styles?.[property] : undefined);
      const value =
        property === "margin" || property === "padding"
          ? safeSpacing(rawValue)
          : safeLength(rawValue);
      if (value) {
        variables[`--pb-${property}-${device}`] = value;
      }
    }
  }

  return variables as CSSProperties;
}

function getElementStyle(element: PageBuilderElement): CSSProperties {
  return {
    ...getResponsiveVariables(element),
    ...getStyles(element.styles),
    ...(element.type === "container" || element.type === "section"
      ? {
          display: element.display ?? "flex",
          gridTemplateColumns:
            element.display === "grid"
              ? `repeat(${Math.max(1, Math.min(12, element.columns ?? 1))}, minmax(0, 1fr))`
              : undefined,
          alignItems:
            element.alignItems &&
            /^(stretch|start|end|center|baseline)$/.test(element.alignItems)
              ? element.alignItems
              : undefined,
          justifyContent:
            element.justifyContent &&
            /^(start|end|center|space-between|space-around|space-evenly)$/.test(
              element.justifyContent
            )
              ? element.justifyContent
              : undefined,
          flexWrap: element.flexWrap ?? "wrap",
          flexDirection: element.flexDirection ?? "row",
          alignContent: element.alignContent ?? "stretch",
          columnGap: safeLength(element.columnGap),
          rowGap: safeLength(element.rowGap),
        }
      : {}),
  } as CSSProperties;
}

function renderElement(element: PageBuilderElement): ReactNode {
  const style = getElementStyle(element);

  if (element.type === "section" || element.type === "container") {
    return (
      <div
        key={element.id}
        className={`page-builder-element page-builder-${element.type}`}
        data-display={element.display ?? "flex"}
        style={style}
      >
        {(element.children ?? []).map(renderElement)}
        {element.href && (
          <a
            className="page-builder-layout-link"
            href={safeHref(element.href)}
            target={element.linkTarget ?? "_self"}
            rel={element.linkTarget === "_blank" ? "noopener noreferrer" : undefined}
            aria-label={`Open linked ${element.type}`}
          />
        )}
      </div>
    );
  }

  if (element.type === "heading") {
    const level = Math.min(6, Math.max(1, element.level ?? 2));
    const Heading = `h${level}` as ElementType;
    return withCustomLink(element, (
      <Heading
        key={element.id}
        className="page-builder-element page-builder-heading"
        style={style}
      >
        {element.content}
      </Heading>
    ));
  }

  if (element.type === "text") {
    return withCustomLink(element, (
      <p
        key={element.id}
        className="page-builder-element page-builder-text"
        style={style}
      >
        {element.content}
      </p>
    ));
  }

  if (element.type === "image") {
    const src = safeImageUrl(element.src);
    return src ? withCustomLink(element, (
      <figure
        key={element.id}
        className="page-builder-element page-builder-image"
        style={style}
      >
        <img src={src} alt={element.alt ?? ""} />
      </figure>
    )) : null;
  }

  if (element.type === "button") {
    return (
      <a
        key={element.id}
        className="page-builder-element page-builder-button"
        href={safeHref(element.href)}
        target={element.linkTarget ?? "_self"}
        rel={element.linkTarget === "_blank" ? "noopener noreferrer" : undefined}
        style={style}
      >
        {element.content || "Button"}
      </a>
    );
  }

  if (element.type === "link") {
    return (
      <a
        key={element.id}
        className="page-builder-element page-builder-link"
        href={safeHref(element.href)}
        target={element.linkTarget ?? "_self"}
        rel={element.linkTarget === "_blank" ? "noopener noreferrer" : undefined}
        style={style}
      >
        {element.content || "Link"}
      </a>
    );
  }

  if (element.type === "icon") {
    const src = safeImageUrl(element.src);
    return src ? withCustomLink(element, (
      <span
        key={element.id}
        className="page-builder-element page-builder-icon"
        style={style}
      >
        <img src={src} alt={element.alt ?? ""} />
      </span>
    )) : null;
  }

  if (element.type === "divider") {
    return withCustomLink(element, (
      <hr
        key={element.id}
        className="page-builder-element page-builder-divider"
        style={style}
      />
    ));
  }

  return withCustomLink(element, (
    <div
      key={element.id}
      className="page-builder-element page-builder-spacer"
      aria-hidden="true"
      style={style}
    />
  ));
}

export default function PublicPageBuilder({
  layout,
}: {
  layout: PageBuilderLayout;
}) {
  return (
    <>
      <style>{`
        .page-builder-root { width: 100%; }
        .page-builder-element { box-sizing: border-box; width: var(--pb-width-desktop, auto); height: var(--pb-height-desktop, auto); min-width: var(--pb-minWidth-desktop, 0); max-width: var(--pb-maxWidth-desktop, none); min-height: var(--pb-minHeight-desktop, 0); max-height: var(--pb-maxHeight-desktop, none); margin: var(--pb-margin-desktop, 0); padding: var(--pb-padding-desktop, 0); color: var(--pb-normal-color, inherit); background-color: var(--pb-normal-background, transparent); }
        .page-builder-element:hover { color: var(--pb-hover-color, var(--pb-normal-color, inherit)); background-color: var(--pb-hover-background, var(--pb-normal-background, transparent)); }
        .page-builder-custom-link { display: block; color: inherit; text-decoration: none; }
        .page-builder-section, .page-builder-container { min-width: 0; gap: var(--pb-gap-desktop, 16px); column-gap: var(--pb-columnGap-desktop, var(--pb-gap-desktop, 16px)); row-gap: var(--pb-rowGap-desktop, var(--pb-gap-desktop, 16px)); }
        .page-builder-section, .page-builder-container { position: relative; }
        .page-builder-layout-link { position: absolute; inset: 0; z-index: 0; }
        .page-builder-section > .page-builder-element, .page-builder-container > .page-builder-element, .page-builder-section > .page-builder-custom-link, .page-builder-container > .page-builder-custom-link { position: relative; z-index: 1; }
        .page-builder-layout-link:focus-visible { outline: 2px solid #3984e8; }
        .page-builder-container > .page-builder-element, .page-builder-section > .page-builder-element { min-width: 0; }
        .page-builder-container[data-display="flex"] > .page-builder-element, .page-builder-section[data-display="flex"] > .page-builder-element { flex: 1 1 0; }
        .page-builder-heading, .page-builder-text { white-space: pre-wrap; overflow-wrap: anywhere; }
        .page-builder-heading { margin-top: 0; }
        .page-builder-text { line-height: 1.65; }
        .page-builder-image img { display: block; width: 100%; height: auto; }
        .page-builder-icon { display: inline-flex; align-items: center; justify-content: center; width: auto; padding: 0; background: transparent; }
        .page-builder-icon img { display: block; width: 24px; height: 24px; object-fit: contain; }
        .page-builder-button { display: inline-flex; align-items: center; justify-content: center; width: auto; padding: 12px 20px; border-radius: 6px; background: #3984e8; color: #fff; font-weight: 600; text-decoration: none; }
        .page-builder-link { width: auto; color: inherit; text-decoration: underline; }
        .page-builder-divider { width: 100%; border: 0; border-top: 1px solid #d7dce3; }
        .page-builder-spacer { pointer-events: none; }
        @media (min-width: 769px) and (max-width: 1024px) {
          .page-builder-element { width: var(--pb-width-tablet, var(--pb-width-desktop, auto)); height: var(--pb-height-tablet, var(--pb-height-desktop, auto)); min-width: var(--pb-minWidth-tablet, var(--pb-minWidth-desktop, 0)); max-width: var(--pb-maxWidth-tablet, var(--pb-maxWidth-desktop, none)); min-height: var(--pb-minHeight-tablet, var(--pb-minHeight-desktop, 0)); max-height: var(--pb-maxHeight-tablet, var(--pb-maxHeight-desktop, none)); margin: var(--pb-margin-tablet, var(--pb-margin-desktop, 0)); padding: var(--pb-padding-tablet, var(--pb-padding-desktop, 0)); }
          .page-builder-section, .page-builder-container { gap: var(--pb-gap-tablet, var(--pb-gap-desktop, 16px)); }
        }
        @media (max-width: 768px) {
          .page-builder-element { width: var(--pb-width-mobile, var(--pb-width-tablet, var(--pb-width-desktop, auto))); height: var(--pb-height-mobile, var(--pb-height-tablet, var(--pb-height-desktop, auto))); min-width: var(--pb-minWidth-mobile, var(--pb-minWidth-tablet, var(--pb-minWidth-desktop, 0))); max-width: var(--pb-maxWidth-mobile, var(--pb-maxWidth-tablet, var(--pb-maxWidth-desktop, none))); min-height: var(--pb-minHeight-mobile, var(--pb-minHeight-tablet, var(--pb-minHeight-desktop, 0))); max-height: var(--pb-maxHeight-mobile, var(--pb-maxHeight-tablet, var(--pb-maxHeight-desktop, none))); margin: var(--pb-margin-mobile, var(--pb-margin-tablet, var(--pb-margin-desktop, 0))); padding: var(--pb-padding-mobile, var(--pb-padding-tablet, var(--pb-padding-desktop, 0))); }
          .page-builder-section, .page-builder-container { gap: var(--pb-gap-mobile, var(--pb-gap-tablet, var(--pb-gap-desktop, 16px))); }
          .page-builder-container[data-display="flex"], .page-builder-section[data-display="flex"] { flex-direction: column; }
          .page-builder-container[data-display="grid"], .page-builder-section[data-display="grid"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="page-builder-root">
        {layout.elements.map(renderElement)}
      </div>
    </>
  );
}
