"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { themeIcons } from "./theme-icons";
import styles from "./PublicNavigationMenu.module.css";

export type PublicNavigationMenuItem = {
  id?: string;
  label?: string;
  title?: string;
  url?: string;
  href?: string;
  target?: string;
  iconName?: string;
  children?: PublicNavigationMenuItem[];
};

type Props = {
  items: PublicNavigationMenuItem[];
  style: CSSProperties;
  nodeId: string;
  id?: string;
  className?: string;
  orientation?: string;
  alignment?: string;
  mobileToggle?: boolean;
  mobileBreakpoint?: number;
  mobileLayout?: string;
  mobilePosition?: string;
  mobileWidth?: string;
  openIcon?: string;
  closeIcon?: string;
  iconColor?: string;
  itemIconName?: string;
  iconSize?: number;
  itemPadding?: string;
  menuId?: string;
  menuLocation?: string;
};

function safeLink(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || /^(javascript|vbscript|data):/i.test(value)) {
    return "#";
  }
  const url = value.trim();
  if (url.startsWith("#") || url.startsWith("?")) return url;
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
    return url;
  }
  if (url.includes("\\") || url.startsWith("//")) return "#";
  try {
    const parsed = new URL(url);
    return ["https:", "http:", "mailto:", "tel:"].includes(parsed.protocol)
      ? url
      : "#";
  } catch {
    return `/${url.replace(/^\/+/, "")}`;
  }
}

export default function PublicNavigationMenu({
  items,
  style,
  nodeId,
  id,
  className,
  orientation,
  alignment,
  mobileToggle = true,
  mobileBreakpoint = 767,
  mobileLayout = "slide-in",
  mobilePosition = "right",
  mobileWidth = "320px",
  openIcon,
  closeIcon,
  iconColor = "#0c2f55",
  itemIconName,
  iconSize = 24,
  itemPadding,
  menuId,
  menuLocation = "HEADER",
}: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedItems, setResolvedItems] = useState(items);
  const breakpoint = Number.isFinite(mobileBreakpoint)
    ? Math.max(320, Math.min(1920, mobileBreakpoint))
    : 767;
  const direction = orientation === "vertical" ? "column" : "row";
  const justifyContent =
    alignment === "center"
      ? "center"
      : alignment === "right"
        ? "flex-end"
        : "flex-start";
  const OpenIcon = themeIcons[openIcon || ""] || Menu;
  const CloseIcon = themeIcons[closeIcon || ""] || X;
  const resolvedIconSize = Number.isFinite(iconSize)
    ? Math.max(12, Math.min(64, iconSize))
    : 24;

  useEffect(() => {
    if (!menuId || (menuLocation !== "HEADER" && menuLocation !== "FOOTER")) {
      return;
    }

    let active = true;
    const loadCurrentMenu = async () => {
      try {
        const response = await fetch(
          `/api/public/menus/${menuLocation}?menuId=${encodeURIComponent(menuId)}`,
          { cache: "no-store" },
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load navigation links.");
        }
        if (active) {
          setResolvedItems(
            Array.isArray(result.menu?.items)
              ? (result.menu.items as PublicNavigationMenuItem[])
              : [],
          );
        }
      } catch (error) {
        console.error("Public navigation menu refresh failed:", error);
      }
    };

    void loadCurrentMenu();
    return () => {
      active = false;
    };
  }, [menuId, menuLocation]);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const syncViewport = () => {
      setIsMobile(query.matches);
      if (!query.matches) setIsOpen(false);
    };
    syncViewport();
    query.addEventListener("change", syncViewport);
    return () => query.removeEventListener("change", syncViewport);
  }, [breakpoint]);

  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobile, isOpen]);

  const renderItems = (
    menuItems: PublicNavigationMenuItem[],
    nested = false,
  ): ReactNode => (
    <ul
      className={nested ? styles.submenu : styles.menuList}
      style={{
        flexDirection: nested || isMobile ? "column" : direction,
        justifyContent: isMobile ? "flex-start" : justifyContent,
      }}
    >
      {menuItems.map((item, index) => {
        const children = Array.isArray(item.children) ? item.children : [];
        const ItemIcon = themeIcons[item.iconName || itemIconName || ""];
        return (
          <li key={item.id || `${item.label || item.title || "item"}-${index}`}>
            <a
              href={safeLink(item.href || item.url)}
              target={item.target === "_blank" ? "_blank" : undefined}
              rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
              style={{
                color: "inherit",
                padding: itemPadding || undefined,
              }}
              onClick={() => setIsOpen(false)}
            >
              {ItemIcon ? (
                <ItemIcon
                  size={16}
                  className={styles.itemIcon}
                  style={{ color: iconColor }}
                  aria-hidden="true"
                />
              ) : null}
              {item.label || item.title || "Menu item"}
            </a>
            {children.length ? renderItems(children, true) : null}
          </li>
        );
      })}
    </ul>
  );

  const rootStyle: CSSProperties & { "--builder-menu-gap": string } = {
    ...style,
    display: "flex",
    flexDirection: isMobile && !mobileToggle ? "column" : direction,
    justifyContent,
    position: style.position || "relative",
    "--builder-menu-gap":
      typeof style.gap === "string" || typeof style.gap === "number"
        ? String(style.gap)
        : "18px",
  };

  if (isMobile && mobileToggle) {
    return (
      <nav
        className={`${styles.root} ${className || ""}`.trim()}
        id={id}
        style={rootStyle}
        aria-label="Main navigation"
        data-builder-node-id={nodeId}
      >
        <button
          type="button"
          className={styles.toggle}
          aria-label="Open menu"
          aria-expanded={isOpen}
          aria-controls={`mobile-menu-${nodeId}`}
          onClick={() => setIsOpen(true)}
          style={{ color: iconColor }}
        >
          <OpenIcon size={resolvedIconSize} aria-hidden="true" />
        </button>
        {isOpen ? (
          <div
            className={styles.backdrop}
            onClick={() => setIsOpen(false)}
            role="presentation"
          >
            <div
              id={`mobile-menu-${nodeId}`}
              className={`${styles.panel} ${styles[mobileLayout] || styles["slide-in"]} ${styles[mobilePosition] || styles.right}`}
              style={{
                width: mobileLayout === "fullscreen" ? undefined : mobileWidth,
                backgroundColor:
                  typeof style.backgroundColor === "string"
                    ? style.backgroundColor
                    : "#fff",
                color: typeof style.color === "string" ? style.color : "#1f2937",
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={styles.close}
                aria-label="Close menu"
                onClick={() => setIsOpen(false)}
                style={{ color: iconColor }}
              >
                <CloseIcon size={resolvedIconSize} aria-hidden="true" />
              </button>
              <div className={styles.panelItems}>{renderItems(resolvedItems)}</div>
            </div>
          </div>
        ) : null}
      </nav>
    );
  }

  return (
    <nav
      className={`${styles.root} ${className || ""}`.trim()}
      id={id}
      style={rootStyle}
      aria-label="Main navigation"
      data-builder-node-id={nodeId}
    >
      <div className={styles.desktopList}>{renderItems(resolvedItems)}</div>
    </nav>
  );
}
