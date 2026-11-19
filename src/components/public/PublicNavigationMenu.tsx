"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowDown, ChevronDown, Menu, Plus, X } from "lucide-react";
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
  iconImage?: string;
  children?: PublicNavigationMenuItem[];
};

type MenuItemStateStyle = {
  color?: string;
  iconColor?: string;
  backgroundColor?: string;
  backgroundGradient?: { angle?: number; color1?: string; color2?: string };
};

type MenuDeviceStyle = {
  normal?: MenuItemStateStyle;
  hover?: MenuItemStateStyle;
  active?: MenuItemStateStyle;
};

export type ResponsiveMenuItemStyles = Partial<
  Record<"desktop" | "tablet" | "mobile", MenuDeviceStyle>
>;

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
  iconSize?: string | number;
  itemPadding?: string;
  menuId?: string;
  menuLocation?: string;
  menuItemStyles?: ResponsiveMenuItemStyles;
  mobilePanelBackground?: string;
  mobilePanelBackgroundType?: string;
  mobilePanelGradient?: { angle?: number; color1?: string; color2?: string };
  mobilePanelColor?: string;
  mobilePanelIconColor?: string;
  mobileOverlayColor?: string;
  toggleHoverIconColor?: string;
  toggleBackgroundColor?: string;
  toggleHoverBackgroundColor?: string;
  closeIconColor?: string;
  closeIconHoverColor?: string;
  responsiveSettings?: Partial<Record<"tablet" | "mobile", Record<string, unknown>>>;
  alignmentResponsive?: Partial<Record<"tablet" | "mobile", string>>;
  mobileLogo?: string;
  mobileLogoAlt?: string;
  mobileLogoLinkType?: string;
  mobileLogoLink?: string;
  dropdownOpenAs?: string;
  submenuIndicator?: string;
  submenuClickArea?: string;
  closeOnAnchorClick?: boolean;
  onePage?: boolean;
};

function safeLink(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || /^(javascript|vbscript|data):/i.test(value)) {
    return "#";
  }
  const url = value.trim();
  if (url.startsWith("#") || url.startsWith("?") || (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\"))) {
    return url;
  }
  if (url.includes("\\") || url.startsWith("//")) return "#";
  try {
    const parsed = new URL(url);
    return ["https:", "http:", "mailto:", "tel:"].includes(parsed.protocol) ? url : "#";
  } catch {
    return `/${url.replace(/^\/+/, "")}`;
  }
}

function safeImage(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function safeCssColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const color = value.trim();
  return /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,24}|transparent|var\(--builder-prop-[a-zA-Z0-9_-]+(?:,\s*[^;{}<>]+)?\))$/i.test(color)
    ? color
    : undefined;
}



function alignmentToJustify(value: unknown): string {
  switch (value) {
    case "center": return "center";
    case "right": return "flex-end";
    case "justify": return "space-between";
    default: return "flex-start";
  }
}

function safeSelectorValue(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function buildMenuItemCss(
  nodeId: string,
  menuItemStyles: ResponsiveMenuItemStyles | undefined,
): string {
  if (!menuItemStyles || typeof menuItemStyles !== "object") return "";
  const root = `[data-builder-menu-id="${safeSelectorValue(nodeId)}"]`;
  const item = `${root} .${styles.menuItemLink}`;
  const rules: string[] = [];

  const createRules = (device: "desktop" | "tablet" | "mobile") => {
    const desktop = menuItemStyles.desktop || {};
    const selected = device === "desktop" ? {} : menuItemStyles[device] || {};
    const config: MenuDeviceStyle = {
      normal: { ...(desktop.normal || {}), ...(selected.normal || {}) },
      hover: { ...(desktop.hover || {}), ...(selected.hover || {}) },
      active: { ...(desktop.active || {}), ...(selected.active || {}) },
    };
    const deviceRules: string[] = [];
    const write = (selector: string, state: MenuItemStateStyle | undefined) => {
      if (!state) return;
      const declarations = [
        safeCssColor(state.color) ? `color:${safeCssColor(state.color)}` : "",
        safeCssColor(state.backgroundColor) ? `background-color:${safeCssColor(state.backgroundColor)}` : "",
        Object.prototype.hasOwnProperty.call(state, "backgroundGradient")
          ? state.backgroundGradient && typeof state.backgroundGradient === "object"
            ? `background-image:linear-gradient(${Math.max(0, Math.min(360, Number(state.backgroundGradient.angle ?? 135)))}deg, ${safeCssColor(state.backgroundGradient.color1) || "#ffffff"}, ${safeCssColor(state.backgroundGradient.color2) || "#eaf1fb"})`
            : "background-image:none"
          : safeCssColor(state.backgroundColor) ? "background-image:none" : "",
      ].filter(Boolean);
      if (declarations.length) deviceRules.push(`${selector}{${declarations.join(";")}}`);
      if (safeCssColor(state.iconColor)) {
        deviceRules.push(`${selector} .${styles.itemIcon}{color:${safeCssColor(state.iconColor)}}`);
      }
    };

    write(item, config.normal);
    write(`${item}:hover,${item}:focus-visible`, config.hover);
    write(`${item}.${styles.active}`, config.active);
    return deviceRules;
  };

  rules.push(...createRules("desktop"));
  const tabletRules = createRules("tablet");
  if (tabletRules.length) {
    rules.push(`@media (min-width:768px) and (max-width:1024px){${tabletRules.join("\n")}}`);
  }
  const mobileRules = createRules("mobile");
  if (mobileRules.length) {
    rules.push(`@media (max-width:767px){${mobileRules.join("\n")}}`);
  }
  return rules.join("\n");
}

function buildMenuResponsiveCss(
  nodeId: string,
  baseAlignment: string | undefined,
  alignmentResponsive: Props["alignmentResponsive"],
  responsiveSettings: Props["responsiveSettings"],
  baseSettings: Record<string, unknown>,
): string {
  const root = `[data-builder-menu-id="${safeSelectorValue(nodeId)}"]`;
  const baseDeclarations: string[] = [
    `--builder-menu-justify:${alignmentToJustify(baseAlignment || "left")}`,
  ];
  const settingMap: Record<string, string> = {
    iconColor: "--builder-menu-icon-color",
    toggleHoverIconColor: "--builder-menu-toggle-hover-icon-color",
    toggleBackgroundColor: "--builder-menu-toggle-background",
    toggleHoverBackgroundColor: "--builder-menu-toggle-hover-background",
    closeIconColor: "--builder-menu-close-icon-color",
    closeIconHoverColor: "--builder-menu-close-icon-hover-color",
    mobilePanelBackground: "--builder-menu-panel-background",
    mobilePanelColor: "--builder-menu-panel-color",
    mobilePanelIconColor: "--builder-menu-panel-icon-color",
    mobileOverlayColor: "--builder-menu-overlay-color",
  };
  for (const [key, variable] of Object.entries(settingMap)) {
    const color = safeCssColor(baseSettings[key]);
    if (color) baseDeclarations.push(`${variable}:${color}`);
  }
  const baseGradient = baseSettings.mobilePanelGradient;
  const basePanelType = typeof baseSettings.mobilePanelBackgroundType === "string"
    ? baseSettings.mobilePanelBackgroundType
    : baseGradient && typeof baseGradient === "object" ? "gradient" : "classic";
  if (basePanelType === "gradient" && baseGradient && typeof baseGradient === "object") {
    const gradient = baseGradient as { angle?: number; color1?: string; color2?: string };
    const first = safeCssColor(gradient.color1) || "#ffffff";
    const second = safeCssColor(gradient.color2) || "#eaf1fb";
    baseDeclarations.push(`--builder-menu-panel-background-image:linear-gradient(${Math.max(0, Math.min(360, Number(gradient.angle ?? 135)))}deg, ${first}, ${second})`);
  } else {
    baseDeclarations.push("--builder-menu-panel-background-image:none");
  }
  const css: string[] = [`${root}{${baseDeclarations.join(";")}}`];
  for (const device of ["tablet", "mobile"] as const) {
    const declarations: string[] = [];
    const align = alignmentResponsive?.[device];
    if (typeof align === "string") declarations.push(`--builder-menu-justify:${alignmentToJustify(align)}`);
    const settings = responsiveSettings?.[device] || {};
    for (const [key, variable] of Object.entries(settingMap)) {
      const color = safeCssColor(settings[key]);
      if (color) declarations.push(`${variable}:${color}`);
    }
    const selectedPanelType = typeof settings.mobilePanelBackgroundType === "string"
      ? settings.mobilePanelBackgroundType
      : basePanelType;
    const selectedGradient = settings.mobilePanelGradient && typeof settings.mobilePanelGradient === "object"
      ? settings.mobilePanelGradient
      : baseGradient;
    if (selectedPanelType === "gradient" && selectedGradient && typeof selectedGradient === "object") {
      const gradient = selectedGradient as { angle?: number; color1?: string; color2?: string };
      const first = safeCssColor(gradient.color1) || "#ffffff";
      const second = safeCssColor(gradient.color2) || "#eaf1fb";
      declarations.push(`--builder-menu-panel-background-image:linear-gradient(${Math.max(0, Math.min(360, Number(gradient.angle ?? 135)))}deg, ${first}, ${second})`);
    } else if (selectedPanelType === "classic") {
      declarations.push("--builder-menu-panel-background-image:none");
    }
    if (declarations.length) {
      const media = device === "tablet"
        ? "@media (min-width:768px) and (max-width:1024px)"
        : "@media (max-width:767px)";
      css.push(`${media}{${root}{${declarations.join(";")}}}`);
    }
  }
  return css.join("\n");
}

function isActiveLink(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  const safe = safeLink(href);
  if (!safe.startsWith("/")) return false;
  const path = safe.split(/[?#]/, 1)[0] || "/";
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path.replace(/\/$/, "")}/`);
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
  mobileBreakpoint = 1024,
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
  menuItemStyles,
  mobilePanelBackground = "#ffffff",
  mobilePanelBackgroundType,
  mobilePanelGradient,
  mobilePanelColor = "#1f2937",
  mobilePanelIconColor,
  mobileOverlayColor = "rgba(15, 23, 42, 0.48)",
  toggleHoverIconColor,
  toggleBackgroundColor,
  toggleHoverBackgroundColor,
  closeIconColor,
  closeIconHoverColor,
  responsiveSettings,
  alignmentResponsive,
  mobileLogo,
  mobileLogoAlt = "Site logo",
  mobileLogoLinkType = "homepage",
  mobileLogoLink = "/",
  dropdownOpenAs = "hover",
  submenuIndicator = "ChevronDown",
  submenuClickArea = "icon",
  closeOnAnchorClick = true,
  onePage = false,
}: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedItems, setResolvedItems] = useState(items);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const reactId = useId();
  const instanceId = `${safeSelectorValue(nodeId)}-${safeSelectorValue(reactId)}`;
  const breakpoint = Number.isFinite(mobileBreakpoint)
    ? Math.max(320, Math.min(1920, mobileBreakpoint))
    : 1024;
  const direction = orientation === "vertical" ? "column" : "row";
  const OpenIcon = openIcon === undefined ? Menu : openIcon ? themeIcons[openIcon] : null;
  const CloseIcon = closeIcon === undefined ? X : closeIcon ? themeIcons[closeIcon] : null;
  const submenuIndicatorHidden = submenuIndicator === "none" || submenuIndicator === "";
  const SubmenuIcon = submenuIndicatorHidden
    ? null
    : submenuIndicator === "Plus"
      ? Plus
      : submenuIndicator === "ArrowDown"
        ? ArrowDown
        : themeIcons[submenuIndicator || ""] || ChevronDown;
  const resolvedIconSize = typeof iconSize === "number"
    ? `${Math.max(12, Math.min(64, iconSize))}px`
    : typeof iconSize === "string" && iconSize.trim()
      ? iconSize.trim()
      : "24px";
  const mobileIconStyle: CSSProperties = {
    width: resolvedIconSize,
    height: resolvedIconSize,
    flex: "0 0 auto",
  };
  const responsiveCss = [
    buildMenuItemCss(instanceId, menuItemStyles),
    buildMenuResponsiveCss(instanceId, alignment, alignmentResponsive, responsiveSettings, {
      iconColor,
      toggleHoverIconColor,
      toggleBackgroundColor,
      toggleHoverBackgroundColor,
      closeIconColor,
      closeIconHoverColor,
      mobilePanelBackground,
      mobilePanelBackgroundType,
      mobilePanelGradient,
      mobilePanelColor,
      mobilePanelIconColor,
      mobileOverlayColor,
    }),
  ].filter(Boolean).join("\n");
  const logoSrc = safeImage(mobileLogo);
  const logoHref = mobileLogoLinkType === "homepage"
    ? "/"
    : mobileLogoLinkType === "current-page"
      ? pathname || "/"
      : safeLink(mobileLogoLink || "/");
  const openAs = dropdownOpenAs === "click" ? "click" : "hover";
  const clickArea = submenuClickArea === "full" ? "full" : "icon";

  useEffect(() => {
    setResolvedItems(items);
  }, [items]);

  useEffect(() => {
    if (!menuId || (menuLocation !== "HEADER" && menuLocation !== "FOOTER")) return;
    let active = true;
    const loadCurrentMenu = async () => {
      try {
        const response = await fetch(`/api/public/menus/${menuLocation}?menuId=${encodeURIComponent(menuId)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Unable to load navigation links.");
        if (active) setResolvedItems(Array.isArray(result.menu?.items) ? result.menu.items as PublicNavigationMenuItem[] : []);
      } catch (error) {
        console.error("Public navigation menu refresh failed:", error);
      }
    };
    void loadCurrentMenu();
    return () => { active = false; };
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
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setIsOpen(false); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobile, isOpen]);

  const toggleSubmenu = (key: string) => {
    setExpandedItems((current) => ({ ...current, [key]: !current[key] }));
  };

  const renderItems = (
    menuItems: PublicNavigationMenuItem[],
    nested = false,
    parentKey = "root",
  ): ReactNode => (
    <ul
      className={nested ? styles.submenu : styles.menuList}
      style={{
        flexDirection: nested || isMobile ? "column" : direction,
      }}
    >
      {menuItems.map((item, index) => {
        const children = Array.isArray(item.children) ? item.children : [];
        const key = String(item.id || `${parentKey}-${item.label || item.title || "item"}-${index}`);
        const expanded = Boolean(expandedItems[key]);
        const ItemIcon = themeIcons[item.iconName || itemIconName || ""];
        const itemImage = safeImage(item.iconImage);
        const href = safeLink(item.href || item.url);
        const active = isActiveLink(href, pathname);
        const shouldRenderChildren = children.length > 0 && (
          (!isMobile && openAs === "hover") || expanded
        );
        const linkOpensSubmenu = children.length > 0 && (
          (!isMobile && openAs === "click") || (isMobile && clickArea === "full")
        );

        return (
          <li
            key={key}
            className={`${styles.menuItem} ${expanded ? styles.menuItemOpen : ""}`.trim()}
          >
            <div className={styles.menuItemRow}>
              <a
                className={`${styles.menuItemLink} ${active ? styles.active : ""}`.trim()}
                href={onePage && href.startsWith("#") ? href : href}
                target={item.target === "_blank" ? "_blank" : undefined}
                rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                aria-current={active ? "page" : undefined}
                aria-expanded={children.length ? expanded : undefined}
                style={{ padding: itemPadding || undefined }}
                onClick={(event) => {
                  if (linkOpensSubmenu) {
                    event.preventDefault();
                    toggleSubmenu(key);
                    return;
                  }
                  if (closeOnAnchorClick) setIsOpen(false);
                }}
              >
                {itemImage ? <img src={itemImage} alt="" className={styles.itemIconImage} /> : ItemIcon ? <ItemIcon size={16} className={styles.itemIcon} aria-hidden="true" /> : null}
                {item.label || item.title || "Menu item"}
              </a>
              {children.length > 0 ? (
                <button
                  type="button"
                  className={styles.submenuToggle}
                  aria-label={`${expanded ? "Close" : "Open"} ${item.label || item.title || "submenu"}`}
                  aria-expanded={expanded}
                  onClick={() => toggleSubmenu(key)}
                >
                  {!submenuIndicatorHidden && SubmenuIcon ? <SubmenuIcon size={15} aria-hidden="true" /> : null}
                </button>
              ) : null}
            </div>
            {shouldRenderChildren ? renderItems(children, true, key) : null}
          </li>
        );
      })}
    </ul>
  );

  const rootStyle: CSSProperties = {
    ...style,
    display: "flex",
    flexDirection: isMobile && !mobileToggle ? "column" : direction,
    justifyContent: "var(--builder-menu-justify, flex-start)" as CSSProperties["justifyContent"],
    position: style.position || "relative",
    width: "var(--builder-style-width, 100%)" as CSSProperties["width"],
    minWidth: 0,
    boxSizing: "border-box",
    "--builder-menu-gap": typeof style.gap === "string" || typeof style.gap === "number" ? String(style.gap) : "18px",
  } as CSSProperties;

  return (
    <nav
      className={`${styles.root} ${className || ""}`.trim()}
      id={id}
      style={rootStyle}
      aria-label="Main navigation"
      data-builder-node-id={nodeId}
      data-builder-menu-id={instanceId}
      data-dropdown-open-as={openAs}
    >
      {responsiveCss ? <style>{responsiveCss}</style> : null}
      {isMobile && mobileToggle ? (
        <>
          <button
            type="button"
            className={styles.toggle}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
            aria-controls={`mobile-menu-${instanceId}`}
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen
              ? CloseIcon ? <CloseIcon size={24} style={mobileIconStyle} aria-hidden="true" /> : null
              : OpenIcon ? <OpenIcon size={24} style={mobileIconStyle} aria-hidden="true" /> : null}
          </button>
          {isOpen ? (
            <div className={styles.backdrop} onClick={() => setIsOpen(false)} role="presentation" style={{ backgroundColor: "var(--builder-menu-overlay-color, rgba(15, 23, 42, 0.48))" }}>
              <div
                id={`mobile-menu-${instanceId}`}
                className={`${styles.panel} ${styles[mobileLayout] || styles["slide-in"]} ${styles[mobilePosition] || styles.right}`}
                style={{ width: mobileLayout === "fullscreen" ? undefined : mobileWidth, backgroundColor: "var(--builder-menu-panel-background, #ffffff)", backgroundImage: "var(--builder-menu-panel-background-image, none)", color: "var(--builder-menu-panel-color, #1f2937)" } as CSSProperties}
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation"
                onClick={(event) => event.stopPropagation()}
              >
                <div className={styles.panelHeader}>
                  {logoSrc ? (
                    <a href={logoHref} className={styles.mobileLogoLink} onClick={() => closeOnAnchorClick && setIsOpen(false)}>
                      <img src={logoSrc} alt={mobileLogoAlt} className={styles.mobileLogo} />
                    </a>
                  ) : <span className={styles.panelTitle}>Menu</span>}
                  <button type="button" className={styles.close} aria-label="Close menu" onClick={() => setIsOpen(false)}>
                    {CloseIcon ? <CloseIcon size={24} style={mobileIconStyle} aria-hidden="true" /> : null}
                  </button>
                </div>
                <div className={styles.panelItems}>{renderItems(resolvedItems)}</div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className={styles.desktopList}>{renderItems(resolvedItems)}</div>
      )}
    </nav>
  );
}
