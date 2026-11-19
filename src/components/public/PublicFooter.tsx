
"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import {
  usePublicTheme,
  type MenuItem,
  type ThemeElement,
} from "./PublicThemeRenderer";
import { themeIcons } from "./theme-icons";
import styles from "./PublicNavigation.module.css";

function getFooterWidgetStyle(
  element: ThemeElement
): CSSProperties {
  const responsiveProperties = ["width", "height", "padding", "margin", "gap"] as const;
  const responsiveVariables: Record<string, string> = {};

  for (const property of responsiveProperties) {
    for (const device of ["desktop", "tablet", "mobile"] as const) {
      const responsiveValue = element.widgetResponsive?.[property]?.[device];
      const value =
        responsiveValue ||
        (device === "desktop"
          ? element.widgetStyle?.[property] || element.widgetAdvanced?.[property]
          : undefined);
      if (value) {
        responsiveVariables[`--footer-widget-${property}-${device}`] = value;
      }
    }
  }

  const isResponsiveProperty = (key: string) =>
    (responsiveProperties as readonly string[]).includes(key);

  return {
    ...Object.fromEntries(
      Object.entries(element.widgetAdvanced || {}).filter(
        ([key]) => !key.endsWith("Unit") && !isResponsiveProperty(key)
      )
    ),
    ...Object.fromEntries(
      Object.entries(element.widgetStyle || {}).filter(
        ([key]) => !isResponsiveProperty(key)
      )
    ),
    ...responsiveVariables,
    "--footer-widget-color": element.widgetStyle?.color,
  } as CSSProperties;
}

function FooterMenuItems({
  items,
  nested = false,
}: {
  items: MenuItem[];
  nested?: boolean;
}) {
  return (
    <ul
      className={
        nested
          ? styles.footerChildren
          : styles.footerMenu
      }
    >
      {items.map((item) => (
        <li key={item.id} className={styles.footerItem}>
          <Link
            href={item.href || "#"}
            target={item.target || "_self"}
            rel={
              item.target === "_blank"
                ? "noopener noreferrer"
                : undefined
            }
            className={styles.footerLink}
          >
            {item.label}
          </Link>

          {item.children?.length > 0 && (
            <FooterMenuItems
              items={item.children}
              nested
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function PublicFooter() {
  const {
    theme,
    footerMenu,
    currentYear,
    loading,
  } = usePublicTheme();

  const footer = theme.footer;
  const elements = footer.elements || [];

  const logo = footer.logo;
  const advanced = footer.advanced || {};
  const responsiveColumns = advanced.columns;
  const footerStyle = {
    background: footer.background || "#071e35",
    color: footer.textColor || "#ffffff",
    fontFamily: advanced.fontFamily,
    fontSize: advanced.fontSize,
    fontWeight: advanced.fontWeight,
    lineHeight: advanced.lineHeight,
    "--footer-width-desktop": advanced.width?.desktop || "1200px",
    "--footer-width-tablet": advanced.width?.tablet || `var(--footer-width-desktop, 1200px)`,
    "--footer-width-mobile": advanced.width?.mobile || `var(--footer-width-desktop, 1200px)`,
    "--footer-height-desktop": advanced.height?.desktop || "auto",
    "--footer-height-tablet": advanced.height?.tablet || `var(--footer-height-desktop, auto)`,
    "--footer-height-mobile": advanced.height?.mobile || `var(--footer-height-desktop, auto)`,
    "--footer-padding-desktop": advanced.padding?.desktop || "35px 24px",
    "--footer-padding-tablet": advanced.padding?.tablet || `var(--footer-padding-desktop, 35px 24px)`,
    "--footer-padding-mobile": advanced.padding?.mobile || `var(--footer-padding-desktop, 35px 24px)`,
    "--footer-margin-desktop": advanced.margin?.desktop || "0",
    "--footer-margin-tablet": advanced.margin?.tablet || `var(--footer-margin-desktop, 0)`,
    "--footer-margin-mobile": advanced.margin?.mobile || `var(--footer-margin-desktop, 0)`,
    "--footer-gap-desktop": advanced.gap?.desktop || "30px",
    "--footer-gap-tablet": advanced.gap?.tablet || `var(--footer-gap-desktop, 30px)`,
    "--footer-gap-mobile": advanced.gap?.mobile || `var(--footer-gap-desktop, 30px)`,
    "--footer-columns-desktop": responsiveColumns?.desktop || String(footer.columns || 2),
    "--footer-columns-tablet": responsiveColumns?.tablet || `var(--footer-columns-desktop, ${footer.columns || 2})`,
    "--footer-columns-mobile": responsiveColumns?.mobile || `var(--footer-columns-desktop, ${footer.columns || 2})`,
    "--footer-display": advanced.display || "grid",
  } as CSSProperties;

  function renderElement(element: (typeof elements)[number]) {
    const widgetStyle = getFooterWidgetStyle(element);
    if (element.type === "section" || element.type === "container") {
      return (
        <div
          className={`${styles.footerLayout} ${styles.footerResponsiveWidget}`}
          key={element.id}
          style={{
            ...widgetStyle,
            display: element.display || "flex",
            gridTemplateColumns:
              element.display === "grid"
                ? `repeat(${Math.max(1, element.columns || 1)}, minmax(0, 1fr))`
                : undefined,
            alignItems: element.alignItems,
            justifyContent: element.justifyContent,
            flexWrap: element.flexWrap || "wrap",
            flex: element.flex,
          }}
        >
          {element.children?.map((child) => renderElement(child))}
        </div>
      );
    }

    if (element.type === "logo") {
      return (
        <div className={`${styles.footerBrand} ${styles.footerResponsiveWidget}`} key={element.id} style={widgetStyle}>
          <Link href="/" className={styles.footerLogo}>
            {logo?.imageUrl ? (
              <img src={logo.imageUrl} alt={logo.alt || logo.text || "Website logo"} />
            ) : (
              logo?.text || "CONNECT BROADBAND"
            )}
          </Link>
          {footer.description && (
            <p className={styles.footerDescription}>{footer.description}</p>
          )}
        </div>
      );
    }
    if (element.type === "menu") {
      return !loading && element.location === "FOOTER" && footerMenu.length > 0 ? (
        <nav
          aria-label="Footer Navigation"
          key={element.id}
          className={styles.footerResponsiveWidget}
          style={widgetStyle}
        >
          <FooterMenuItems items={footerMenu} />
        </nav>
      ) : null;
    }
    if (element.type === "copyright") {
      return (
        <div className={`${styles.footerBottom} ${styles.footerResponsiveWidget}`} key={element.id} style={widgetStyle}>
          {currentYear && `© ${currentYear} `}
          {logo?.text || "Connect Broadband"}.{" "}
          {element.text || "All rights reserved."}
        </div>
      );
    }
    if (element.type === "text") {
      return (
        <p className={`${styles.footerWidgetText} ${styles.footerResponsiveWidget}`} key={element.id} style={widgetStyle}>
          {element.text}
        </p>
      );
    }
    if (element.type === "icon") {
      const Icon = themeIcons[element.iconName || ""] || themeIcons.Wifi;
      return (
        <Link
          href={element.url || "#"}
          className={`${styles.footerWidgetIcon} ${styles.footerResponsiveWidget}`}
          key={element.id}
          aria-label={element.label || element.iconName || "Link"}
          style={widgetStyle}
        >
          <Icon size={20} />
          {element.label && <span>{element.label}</span>}
        </Link>
      );
    }
    return null;
  }

  return (
    <footer
      className={styles.footer}
      style={footerStyle}
    >
      <div
        className={styles.footerInner}
      >
        {elements.map((element) => renderElement(element))}
      </div>
    </footer>
  );
}
