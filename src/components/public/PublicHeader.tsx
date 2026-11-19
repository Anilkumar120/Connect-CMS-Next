
"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import {
  usePublicTheme,
  type MenuItem,
  type ThemeElement,
  type ThemeConfig,
} from "./PublicThemeRenderer";
import { themeIcons } from "./theme-icons";
import styles from "./PublicNavigation.module.css";

function HeaderMenuItems({
  items,
  nested = false,
  mobile = false,
  onNavigate,
}: {
  items: MenuItem[];
  nested?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className={nested ? styles.subMenu : styles.navList}>
      {items.map((item) => (
        <HeaderMenuItem
          key={item.id}
          item={item}
          mobile={mobile}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

function HeaderMenuItem({
  item,
  mobile,
  onNavigate,
}: {
  item: MenuItem;
  mobile: boolean;
  onNavigate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children?.length > 0;

  return (
    <li
      className={`${styles.navItem} ${
        mobile && expanded ? styles.mobileSubmenuOpen : ""
      }`}
    >
      <div className={styles.menuItemRow}>
        <Link
          href={item.href || "#"}
          target={item.target || "_self"}
          rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
          className={styles.navLink}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
        {mobile && hasChildren && (
          <button
            type="button"
            className={styles.submenuToggle}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label} submenu`}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      {hasChildren &&
        (mobile ? (
          expanded && (
            <HeaderMenuItems
              items={item.children}
              nested
              mobile
              onNavigate={onNavigate}
            />
          )
        ) : (
          <HeaderMenuItems items={item.children} nested />
        ))}
    </li>
  );
}

function HeaderElementView({
  element,
  header,
  menuItems,
  menuEnabled,
  loading,
}: {
  element: ThemeElement;
  header: ThemeConfig["header"];
  menuItems: MenuItem[];
  menuEnabled: boolean;
  loading: boolean;
}) {
  const savedWidgetStyle = element.widgetStyle || {};
  const buttonTypeColors: Record<string, string> = {
    info: "#2563eb",
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
  };
  const getBackground = (state: "normal" | "hover") => {
    const color =
      savedWidgetStyle[`${state}BackgroundColor`] ||
      savedWidgetStyle[`${state}Background`] ||
      (state === "normal"
        ? savedWidgetStyle.background
        : savedWidgetStyle.hoverBackground);
    const image = savedWidgetStyle[`${state}BackgroundImage`];
    let background = color;
    if (savedWidgetStyle[`${state}BackgroundType`] === "gradient") {
      background = `linear-gradient(${
        savedWidgetStyle[`${state}GradientAngle`] || "90"
      }deg, ${
        savedWidgetStyle[`${state}GradientStart`] || "#4f46e5"
      }, ${savedWidgetStyle[`${state}GradientEnd`] || "#06b6d4"})${
        image ? `, url("${image}") center / cover no-repeat` : ""
      }`;
    }
    if (image) {
      if (savedWidgetStyle[`${state}BackgroundType`] !== "gradient") {
        background = `${background || "transparent"} url("${image}") center / cover no-repeat`;
      }
    }
    return background;
  };
  const getBorder = (state: "normal" | "hover") => {
    const type = savedWidgetStyle[`${state}BorderType`];
    if (type === "none") return "none";
    if (type && type !== "default") {
      return `${savedWidgetStyle[`${state}BorderWidth`] || "1px"} ${type} ${
        savedWidgetStyle[`${state}BorderColor`] || "#000000"
      }`;
    }
    return savedWidgetStyle[`${state}Border`] ||
      (state === "normal" ? savedWidgetStyle.border : savedWidgetStyle.hoverBorder);
  };
  const paintStyle = {
    "--widget-normal-background": getBackground("normal"),
    "--widget-hover-background": getBackground("hover"),
    "--widget-normal-color":
      savedWidgetStyle.normalColor || savedWidgetStyle.color,
    "--widget-hover-color":
      savedWidgetStyle.hoverColor || savedWidgetStyle.normalColor || savedWidgetStyle.color,
    "--widget-normal-border": getBorder("normal"),
    "--widget-hover-border": getBorder("hover"),
    "--widget-normal-border-radius":
      savedWidgetStyle.normalBorderRadius || savedWidgetStyle.borderRadius,
    "--widget-hover-border-radius":
      savedWidgetStyle.hoverBorderRadius || savedWidgetStyle.normalBorderRadius || savedWidgetStyle.borderRadius,
    "--widget-normal-box-shadow":
      savedWidgetStyle.normalBoxShadow || savedWidgetStyle.boxShadow,
    "--widget-hover-box-shadow":
      savedWidgetStyle.hoverBoxShadow || savedWidgetStyle.normalBoxShadow || savedWidgetStyle.boxShadow,
    "--widget-normal-text-shadow":
      savedWidgetStyle.normalTextShadow || savedWidgetStyle.textShadow,
    "--widget-hover-text-shadow":
      savedWidgetStyle.hoverTextShadow || savedWidgetStyle.normalTextShadow || savedWidgetStyle.textShadow,
    "--widget-transition-duration":
      savedWidgetStyle.hoverTransitionDuration
        ? `${savedWidgetStyle.hoverTransitionDuration}s`
        : undefined,
  } as CSSProperties;
  const paintClassNames = [
    getBackground("normal") && styles.widgetNormalBackground,
    getBackground("hover") && styles.widgetHoverBackground,
    (savedWidgetStyle.normalColor || savedWidgetStyle.color) &&
      styles.widgetNormalColor,
    (savedWidgetStyle.hoverColor ||
      savedWidgetStyle.normalColor ||
      savedWidgetStyle.color) && styles.widgetHoverColor,
    getBorder("normal") && styles.widgetNormalBorder,
    getBorder("hover") && styles.widgetHoverBorder,
    (savedWidgetStyle.normalBorderRadius || savedWidgetStyle.borderRadius) &&
      styles.widgetNormalBorderRadius,
    (savedWidgetStyle.hoverBorderRadius ||
      savedWidgetStyle.normalBorderRadius ||
      savedWidgetStyle.borderRadius) && styles.widgetHoverBorderRadius,
    (savedWidgetStyle.normalBoxShadow || savedWidgetStyle.boxShadow) &&
      styles.widgetNormalBoxShadow,
    (savedWidgetStyle.hoverBoxShadow ||
      savedWidgetStyle.normalBoxShadow ||
      savedWidgetStyle.boxShadow) && styles.widgetHoverBoxShadow,
    (savedWidgetStyle.normalTextShadow || savedWidgetStyle.textShadow) &&
      styles.widgetNormalTextShadow,
    (savedWidgetStyle.hoverTextShadow ||
      savedWidgetStyle.normalTextShadow ||
      savedWidgetStyle.textShadow) && styles.widgetHoverTextShadow,
    savedWidgetStyle.hoverTransitionDuration && styles.widgetTransition,
  ]
    .filter(Boolean)
    .join(" ");
  const widgetCssId = element.widgetAdvanced?.dataCssId?.trim();
  const widgetCssClasses = element.widgetAdvanced?.dataCssClasses?.trim();
  const widgetClassName = (className: string) =>
    `${className}${paintClassNames ? ` ${paintClassNames}` : ""}${
      widgetCssClasses ? ` ${widgetCssClasses}` : ""
    }`;
  const widgetStyle = {
    ...Object.fromEntries(
      Object.entries(element.widgetAdvanced || {}).filter(
        ([key]) =>
          !key.endsWith("Unit") &&
          !key.startsWith("data") &&
          !["width", "height", "padding", "margin", "gap"].includes(key) &&
          ![
            "background", "backgroundColor", "color", "border", "borderColor",
            "borderRadius", "boxShadow", "textShadow", "hoverBackground",
            "hoverBackgroundColor", "hoverColor", "hoverBorder", "hoverBorderColor",
            "hoverBorderRadius", "hoverBoxShadow", "hoverTextShadow",
          ].includes(key)
      )
    ),
    ...Object.fromEntries(
      Object.entries(savedWidgetStyle).filter(
        ([key]) =>
          !/^(normal|hover)(Background|BackgroundColor|BackgroundImage|BackgroundType|GradientStart|GradientEnd|GradientAngle|Color|Border|BorderType|BorderWidth|BorderColor|BorderRadius|BoxShadow|TextShadow|TransitionDuration)$/.test(
            key
          ) &&
          !["width", "height", "padding", "margin", "gap"].includes(key) &&
          ![
            "background",
            "hoverBackground",
            "color",
            "hoverColor",
            "border",
            "hoverBorder",
            "borderRadius",
            "boxShadow",
            "textShadow",
            "textStroke",
            "blendMode",
            "buttonType",
            "buttonSize",
            "buttonWidth",
            "buttonHeight",
            "buttonPosition",
            "buttonIconName",
            "buttonIconPosition",
          ].includes(key)
      )
    ),
    ...paintStyle,
    ...(savedWidgetStyle.textStroke
      ? { WebkitTextStroke: savedWidgetStyle.textStroke }
      : {}),
    ...Object.fromEntries(
      (["width", "height", "padding", "margin", "gap"] as const).flatMap(
        (property) =>
          (["desktop", "tablet", "mobile"] as const).flatMap((device) => {
            const responsiveValue = element.widgetResponsive?.[property]?.[device];
            const value =
              responsiveValue !== undefined && responsiveValue !== null && responsiveValue !== ""
                ? responsiveValue
                : device === "desktop"
                  ? savedWidgetStyle[property] || element.widgetAdvanced?.[property]
                  : undefined;
            return value !== undefined && value !== null && value !== ""
              ? [[`--widget-${property}-${device}`, value]]
              : [];
          })
      )
    ),
  } as CSSProperties;
  if (element.type === "menu") {
    return !loading && menuEnabled && menuItems.length > 0 ? (
      <div
        key={element.id}
        id={widgetCssId || undefined}
        className={widgetClassName(`${styles.responsiveWidget} ${styles.menuWidget}`)}
        style={{
          ...widgetStyle,
          "--nav-color": element.widgetStyle?.color,
          "--nav-hover-color": element.widgetStyle?.hoverColor,
          "--menu-font-size": element.widgetStyle?.fontSize,
        } as CSSProperties}
      >
        <HeaderMenuItems items={menuItems} />
      </div>
    ) : null;
  }
  if (element.type === "logo") {
    if (
      !header.logo?.imageUrl &&
      (!header.logo?.text?.trim() ||
        header.logo.text.trim().toUpperCase() === "CONNECT BROADBAND")
    ) return null;
    return (
      <Link
        key={element.id}
        id={widgetCssId || undefined}
        href="/"
        className={widgetClassName(`${styles.logo} ${styles.responsiveWidget}`)}
        style={widgetStyle}
      >
        {header.logo?.imageUrl ? (
          <img
            src={header.logo.imageUrl}
            alt={header.logo.alt || header.logo.text || ""}
          />
        ) : (
          header.logo?.text || null
        )}
      </Link>
    );
  }
  if (element.type === "container" || element.type === "section") {
    return (
      <div
        key={element.id}
        id={widgetCssId || undefined}
        className={widgetClassName(`${styles.widgetContainer} ${styles.responsiveWidget}`)}
        style={{
          ...widgetStyle,
          display: element.display || "flex",
          gridTemplateColumns:
            element.display === "grid"
              ? `repeat(${Math.max(1, Math.min(6, element.columns || 1))}, minmax(0, 1fr))`
              : undefined,
          alignItems: element.alignItems,
          justifyContent: element.justifyContent,
          flexWrap: element.flexWrap || "wrap",
        }}
      >
        {element.children?.map((child) => (
          <HeaderElementView
            key={child.id}
            element={child}
            header={header}
            menuItems={menuItems}
            menuEnabled={menuEnabled}
            loading={loading}
          />
        ))}
      </div>
    );
  }
  if (element.type === "button") {
    const Icon = savedWidgetStyle.buttonIconName
      ? themeIcons[savedWidgetStyle.buttonIconName]
      : null;
    const typeColor = buttonTypeColors[savedWidgetStyle.buttonType];
    const buttonHeight = savedWidgetStyle.buttonHeight || "full";
    const hasResponsiveHeight = Object.values(
      element.widgetResponsive?.height || {}
    ).some(Boolean);
    const sizeStyles =
      savedWidgetStyle.buttonSize === "small"
        ? { fontSize: "12px", padding: "8px 14px" }
        : savedWidgetStyle.buttonSize === "large"
          ? { fontSize: "16px", padding: "14px 24px" }
          : savedWidgetStyle.buttonSize === "xl"
            ? { fontSize: "18px", padding: "16px 30px" }
            : {};
    const positionStyles =
      savedWidgetStyle.buttonPosition === "center"
        ? { marginLeft: "auto", marginRight: "auto" }
        : savedWidgetStyle.buttonPosition === "right"
          ? { marginLeft: "auto" }
          : savedWidgetStyle.buttonPosition === "left"
            ? { marginRight: "auto" }
            : {};
    return (
      <Link
        key={element.id}
        id={widgetCssId || undefined}
        href={element.url || "/#contact"}
        className={widgetClassName(`${styles.ctaButton} ${styles.responsiveWidget}`)}
        style={{
          ...widgetStyle,
          ...sizeStyles,
          ...positionStyles,
          ...(savedWidgetStyle.buttonWidth === "full" ||
          savedWidgetStyle.buttonSize === "full-width"
            ? { width: "100%" }
            : {}),
          ...(buttonHeight === "full" && !hasResponsiveHeight
            ? { height: "100%", alignSelf: "stretch" }
            : {}),
          ...(typeColor ? { "--button-background": typeColor } : {}),
        } as CSSProperties}
      >
        {Icon && savedWidgetStyle.buttonIconPosition !== "right" && (
          <Icon size={16} aria-hidden="true" />
        )}
        {element.label || "Get Connected"}
        {Icon && savedWidgetStyle.buttonIconPosition === "right" && (
          <Icon size={16} aria-hidden="true" />
        )}
      </Link>
    );
  }
  if (element.type === "icon") {
    const Icon = themeIcons[element.iconName || ""] || themeIcons.Wifi;
    return (
      <Link
        key={element.id}
        id={widgetCssId || undefined}
        href={element.url || "#"}
        className={widgetClassName(`${styles.iconWidget} ${styles.responsiveWidget}`)}
        aria-label={element.label || element.iconName || "Link"}
        style={widgetStyle}
      >
        <Icon size={20} />
        {element.label && <span>{element.label}</span>}
      </Link>
    );
  }
  if (element.type === "text") {
    return (
      <span key={element.id} id={widgetCssId || undefined} className={widgetClassName(`${styles.textWidget} ${styles.responsiveWidget}`)} style={widgetStyle}>
        {element.text}
      </span>
    );
  }
  if (element.type === "heading") {
    const level = Math.min(6, Math.max(1, element.level || 2));
    const HeadingTag = ({
      1: "h1",
      2: "h2",
      3: "h3",
      4: "h4",
      5: "h5",
      6: "h6",
    } as const)[level as 1 | 2 | 3 | 4 | 5 | 6];
    const heading = (
      <HeadingTag
        key={element.id}
        id={widgetCssId || undefined}
        className={widgetClassName(`${styles.headingWidget} ${styles.responsiveWidget}`)}
        style={widgetStyle}
      >
        {element.text}
      </HeadingTag>
    );
    return element.url ? (
      <Link
        key={element.id}
        href={element.url}
        style={{ color: "inherit", textDecoration: "none" }}
      >
        {heading}
      </Link>
    ) : (
      heading
    );
  }
  if (element.type === "image") {
    const image = (
      <img
        src={element.imageUrl || ""}
        alt={element.alt || ""}
        style={{
          ...widgetStyle,
          "--image-widget-width-desktop": element.width?.desktop || "auto",
          "--image-widget-width-tablet": element.width?.tablet || element.width?.desktop || "auto",
          "--image-widget-width-mobile": element.width?.mobile || element.width?.desktop || "auto",
          "--image-widget-height-desktop": element.height?.desktop || "auto",
          "--image-widget-height-tablet": element.height?.tablet || element.height?.desktop || "auto",
          "--image-widget-height-mobile": element.height?.mobile || element.height?.desktop || "auto",
        } as CSSProperties}
      />
    );
    if (!element.imageUrl) return null;
    return (
      <figure
        key={element.id}
        id={widgetCssId || undefined}
        className={widgetClassName(`${styles.imageWidget} ${styles.responsiveWidget}`)}
      >
        {element.url ? (
          <Link href={element.url} className={styles.imageWidgetLink}>{image}</Link>
        ) : image}
        {element.caption && <figcaption>{element.caption}</figcaption>}
      </figure>
    );
  }
  if (element.type === "list") {
    return (
      <ul
        key={element.id}
        id={widgetCssId || undefined}
        className={widgetClassName(`${styles.simpleWidgetList} ${styles.responsiveWidget}`)}
        style={widgetStyle}
      >
        {(element.items || []).map((item, index) => <li key={`${element.id}-${index}`}>{item}</li>)}
      </ul>
    );
  }
  if (element.type === "icon-list" || element.type === "social-icons") {
    return (
      <ul
        key={element.id}
        id={widgetCssId || undefined}
        className={widgetClassName(`${styles.simpleWidgetList} ${styles.responsiveWidget}`)}
        style={widgetStyle}
      >
        {(element.items || []).map((item, index) => (
          <li key={`${element.id}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  }
  if (element.type === "accordion") {
    return (
      <div key={element.id} id={widgetCssId || undefined} className={widgetClassName(styles.responsiveWidget)} style={widgetStyle}>
        {(element.items || []).map((item, index) => (
          <details key={`${element.id}-${index}`}>
            <summary>{item}</summary>
          </details>
        ))}
      </div>
    );
  }
  if (element.type === "tabs") {
    return (
      <div key={element.id} id={widgetCssId || undefined} className={widgetClassName(styles.responsiveWidget)} style={widgetStyle}>
        {(element.items || []).map((item, index) => (
          <span key={`${element.id}-${index}`} className={styles.simpleTab}>{item}</span>
        ))}
      </div>
    );
  }
  if (element.type === "alert") {
    return (
      <div key={element.id} id={widgetCssId || undefined} role="status" className={widgetClassName(`${styles.simpleAlert} ${styles.responsiveWidget}`)} style={widgetStyle}>
        {element.text}
      </div>
    );
  }
  if (element.type === "counter") {
    return (
      <div key={element.id} id={widgetCssId || undefined} className={widgetClassName(`${styles.simpleCounter} ${styles.responsiveWidget}`)} style={widgetStyle}>
        <strong>{element.value || 0}</strong>
        <span>{element.text}</span>
      </div>
    );
  }
  if (element.type === "progress") {
    return (
      <label key={element.id} id={widgetCssId || undefined} className={widgetClassName(`${styles.simpleProgress} ${styles.responsiveWidget}`)} style={widgetStyle}>
        <span>{element.label}</span>
        <progress max={100} value={Math.min(100, Math.max(0, element.value || 0))} />
      </label>
    );
  }
  if (element.type === "divider") {
    return <hr key={element.id} id={widgetCssId || undefined} className={widgetClassName(styles.responsiveWidget)} style={widgetStyle} />;
  }
  if (element.type === "spacer") {
    return (
      <div
        key={element.id}
        id={widgetCssId || undefined}
        aria-hidden="true"
        className={widgetClassName(styles.responsiveWidget)}
        style={{
          "--widget-height-desktop": element.size?.desktop || "32px",
          "--widget-height-tablet": element.size?.tablet || "24px",
          "--widget-height-mobile": element.size?.mobile || "16px",
          ...widgetStyle,
        } as CSSProperties}
      />
    );
  }
  if (element.type === "video") {
    return element.url ? (
      <a key={element.id} id={widgetCssId || undefined} href={element.url} className={widgetClassName(styles.responsiveWidget)} style={widgetStyle}>Watch video</a>
    ) : null;
  }
  return null;
}

function findHeaderElement(
  elements: ThemeElement[],
  type: string
): ThemeElement | undefined {
  for (const element of elements) {
    if (element.type === type) return element;
    const nested = element.children
      ? findHeaderElement(element.children, type)
      : undefined;
    if (nested) return nested;
  }
  return undefined;
}

export default function PublicHeader() {
  const { theme, headerMenu, loading } = usePublicTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const header = theme.header;
  const elements = header.elements || [];

  const menuElement = findHeaderElement(elements, "menu");
  const menuEnabled = Boolean(menuElement && menuElement.location === "HEADER");
  const showGlobalLogo =
    !findHeaderElement(elements, "logo") &&
    Boolean(
      header.logo?.imageUrl ||
      (header.logo?.text?.trim() &&
        header.logo.text.trim().toUpperCase() !== "CONNECT BROADBAND")
    );

  const advanced = header.advanced || {};
  const logoText = header.logo?.text || "";

  const logoUrl = "/";

  const logoParts = logoText.split("BROADBAND");
  const MobileMenuIcon = themeIcons[menuElement?.mobileIconName || "Menu"] || Menu;

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);
  const headerStyle = {
    background: "var(--header-background)",
    color: "var(--header-text-color)",
    fontFamily: advanced.fontFamily,
    fontSize: advanced.fontSize,
    fontWeight: advanced.fontWeight,
    lineHeight: advanced.lineHeight,
    position: advanced.position as CSSProperties["position"],
    zIndex: Number(advanced.zIndex) || 100,
    "--header-background":
      header.styles?.normal?.background ||
      header.background ||
      "#ffffff",
    "--header-text-color":
      header.styles?.normal?.color ||
      header.textColor ||
      "#34465b",
    "--header-hover-background":
      header.styles?.hover?.background || "#f1f5f9",
    "--header-hover-color":
      header.styles?.hover?.color || "#0c2f55",
    "--header-hover-border-color":
      header.styles?.hover?.borderColor || "transparent",
    "--header-border-color":
      header.styles?.normal?.borderColor || "transparent",
    "--nav-color": advanced.menuColor || header.textColor || "#34465b",
    "--nav-hover-color": advanced.menuHoverColor || "#3984e8",
    "--nav-hover-background": advanced.menuHoverBackground || "transparent",
    "--submenu-color": advanced.submenuColor || "#34465b",
    "--submenu-background": advanced.submenuBackground || "#ffffff",
    "--submenu-hover-color": advanced.submenuHoverColor || "#ffffff",
    "--submenu-hover-background":
      advanced.submenuHoverBackground || "#0c2f55",
    "--button-background":
      advanced.buttonBackground ||
      theme.globalStyles.primaryColor ||
      "#0c2f55",
    "--button-text": advanced.buttonText || "#ffffff",
    "--button-radius": advanced.buttonRadius || "6px",
    "--button-hover-background":
      advanced.buttonHoverBackground || "#3984e8",
    "--button-hover-text": advanced.buttonHoverText || "#ffffff",
    "--header-width-desktop": advanced.width?.desktop || "1200px",
    "--header-width-tablet": advanced.width?.tablet || `var(--header-width-desktop, 1200px)`,
    "--header-width-mobile": advanced.width?.mobile || `var(--header-width-desktop, 1200px)`,
    "--header-height-desktop": advanced.height?.desktop || "auto",
    "--header-height-tablet": advanced.height?.tablet || `var(--header-height-desktop, auto)`,
    "--header-height-mobile": advanced.height?.mobile || `var(--header-height-desktop, auto)`,
    "--header-padding-desktop":
      advanced.padding?.desktop || "18px 24px",
    "--header-padding-tablet":
      advanced.padding?.tablet || `var(--header-padding-desktop, 18px 24px)`,
    "--header-padding-mobile":
      advanced.padding?.mobile || `var(--header-padding-desktop, 18px 24px)`,
    "--header-gap-desktop": advanced.gap?.desktop || "30px",
    "--header-gap-tablet": advanced.gap?.tablet || `var(--header-gap-desktop, 30px)`,
    "--header-gap-mobile": advanced.gap?.mobile || `var(--header-gap-desktop, 30px)`,
    "--logo-width-desktop": header.logo?.width?.desktop || "auto",
    "--logo-width-tablet": header.logo?.width?.tablet || `var(--logo-width-desktop, auto)`,
    "--logo-width-mobile": header.logo?.width?.mobile || `var(--logo-width-desktop, auto)`,
    "--logo-height-desktop": header.logo?.height?.desktop || "auto",
    "--logo-height-tablet": header.logo?.height?.tablet || `var(--logo-height-desktop, auto)`,
    "--logo-height-mobile": header.logo?.height?.mobile || `var(--logo-height-desktop, auto)`,
    "--header-display": advanced.display || "flex",
    "--header-grid-columns": `repeat(${Math.max(
      1,
      Math.min(6, Number(advanced.columns) || 2)
    )}, minmax(0, 1fr))`,
    "--header-flex-wrap": advanced.flexWrap || "wrap",
    "--header-margin-desktop": advanced.margin?.desktop || "0 auto",
    "--header-margin-tablet": advanced.margin?.tablet || `var(--header-margin-desktop, 0 auto)`,
    "--header-margin-mobile": advanced.margin?.mobile || `var(--header-margin-desktop, 0 auto)`,
    "--header-radius": advanced.borderRadius || "0",
    "--header-overlay": advanced.overlayColor || "transparent",
  } as CSSProperties;

  return (
    <header
      className={styles.header}
      style={headerStyle}
    >
      <div
        className={styles.headerInner}
        style={{
          justifyContent:
            header.layout === "centered"
              ? "center"
              : advanced.alignment || "space-between",
        }}
      >
        <button
          type="button"
          className={styles.mobileMenuButton}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-primary-navigation"
          style={{ color: menuElement?.mobileIconColor || undefined }}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? <X size={21} /> : <MobileMenuIcon size={21} />}
        </button>

        {showGlobalLogo && (
          <Link href={logoUrl} className={styles.logo}>
            {header.logo?.imageUrl ? (
              <img
                src={header.logo.imageUrl}
                alt={header.logo.alt || logoText}
              />
            ) : (
              <>
                {logoParts[0]}
                {logoParts.length > 1 && (
                  <span>
                    BROADBAND{logoParts.slice(1).join("BROADBAND")}
                  </span>
                )}
              </>
            )}
          </Link>
        )}

        <nav
          className={styles.navigation}
          aria-label="Main Navigation"
        >
          {elements.map((element) => (
            <HeaderElementView
              key={element.id}
              element={element}
              header={header}
              menuItems={headerMenu}
              menuEnabled={menuEnabled}
              loading={loading}
            />
          ))}
        </nav>
      </div>

      <div
        className={`${styles.mobileMenuOverlay} ${
          mobileMenuOpen ? styles.mobileMenuOverlayOpen : ""
        }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="mobile-primary-navigation"
        className={`${styles.mobileDrawer} ${
          mobileMenuOpen ? styles.mobileDrawerOpen : ""
        }`}
        aria-label="Mobile navigation"
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
      >
        <div className={styles.mobileDrawerHeader}>
          <span>Menu</span>
          <button
            type="button"
            className={styles.mobileDrawerClose}
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={21} />
          </button>
        </div>
        <nav className={styles.mobileNavigation} aria-label="Mobile Main Navigation">
          {!loading && menuEnabled && headerMenu.length > 0 && (
            <div
              className={styles.responsiveWidget}
              style={{
                ...menuElement?.widgetStyle,
                "--nav-color": menuElement?.widgetStyle?.color || "#ffffff",
                "--nav-hover-color":
                  menuElement?.widgetStyle?.hoverColor || "#ff6a1a",
                "--menu-font-size":
                  menuElement?.widgetStyle?.fontSize || "10px",
              } as CSSProperties}
            >
              <HeaderMenuItems
                items={headerMenu}
                mobile
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>
          )}
          {elements.map((element) => {
            if (element.type === "button") {
              return (
                <Link
                  key={element.id}
                  href={element.url || "/#contact"}
                  className={styles.mobileCta}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {element.label || "Get Connected"}
                </Link>
              );
            }

            if (element.type === "icon") {
              const Icon = themeIcons[element.iconName || ""] || themeIcons.Wifi;
              return (
                <Link
                  key={element.id}
                  href={element.url || "#"}
                  className={styles.mobileIconLink}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon size={18} />
                  {element.label || element.iconName}
                </Link>
              );
            }

            return null;
          })}
        </nav>
      </aside>
    </header>
  );
}
