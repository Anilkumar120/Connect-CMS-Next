"use client";

import { useState, type CSSProperties } from "react";
import { themeIcons } from "./theme-icons";

type TabItem = {
  id?: string;
  title?: string;
  content?: string;
  iconName?: string;
  iconImage?: string;
};

type Props = {
  items: TabItem[];
  style?: CSSProperties;
  normalColor?: string;
  normalBackground?: string;
  hoverColor?: string;
  hoverBackground?: string;
  activeColor?: string;
  activeBackground?: string;
  gap?: string;
  alignment?: string;
  radius?: string;
  tabPadding?: string;
  contentColor?: string;
  contentBackground?: string;
  contentPadding?: string;
  dividerColor?: string;
  iconSize?: string;
  iconColor?: string;
};

// PUBLIC_BUILDER_TABS_ELEMENTOR_V6_2
export default function PublicBuilderTabs({
  items,
  style,
  normalColor = "#334155",
  normalBackground = "#f1f5f9",
  hoverColor = "#0c2f55",
  hoverBackground = "#e2e8f0",
  activeColor = "#ffffff",
  activeBackground = "#0c2f55",
  gap = "6px",
  alignment = "left",
  radius = "6px",
  tabPadding = "9px 14px",
  contentColor = "#334155",
  contentBackground = "#ffffff",
  contentPadding = "14px",
  dividerColor = "#e2e8f0",
  iconSize = "15px",
  iconColor = "#334155",
}: Props) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  if (!Array.isArray(items) || items.length === 0) return null;

  const safeActive = Math.max(0, Math.min(active, items.length - 1));
  const current = items[safeActive];
  const justifyContent = alignment;
  const panelId = `builder-tab-panel-${current?.id || safeActive}`;

  return (
    <div style={{ minWidth: 0, ...style }}>
      <div role="tablist" aria-label="Content tabs" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent, gap, borderBottom: `1px solid ${dividerColor}` }}>
        {items.map((item, index) => {
          const isActive = safeActive === index;
          const isHovered = hovered === index && !isActive;
          const Icon = item.iconName ? themeIcons[item.iconName] : null;
          const iconImage = typeof item.iconImage === "string" && !/^(javascript|data|vbscript):/i.test(item.iconImage) ? item.iconImage : "";
          return (
            <button
              key={item.id || index}
              id={`builder-tab-${item.id || index}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(index)}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: tabPadding, border: `1px solid ${isActive ? activeBackground : dividerColor}`, borderBottom: isActive ? `2px solid ${activeBackground}` : `1px solid ${dividerColor}`, borderRadius: `${radius} ${radius} 0 0`, background: isActive ? activeBackground : isHovered ? hoverBackground : normalBackground, color: isActive ? activeColor : isHovered ? hoverColor : normalColor, font: "inherit", fontSize: 13, fontWeight: isActive ? 700 : 500, cursor: "pointer", transition: "background-color .18s ease, color .18s ease, border-color .18s ease" }}
            >
              {iconImage ? <img src={iconImage} alt="" style={{ width: iconSize, height: iconSize, objectFit: "contain" }} /> : Icon ? <Icon size={15} aria-hidden="true" style={{ width: iconSize, height: iconSize, color: iconColor }} /> : null}
              {item.title || `Tab ${index + 1}`}
            </button>
          );
        })}
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={`builder-tab-${current?.id || safeActive}`} style={{ minWidth: 0, padding: contentPadding, color: contentColor, background: contentBackground, border: `1px solid ${dividerColor}`, borderTop: 0 }}>
        {current?.content || ""}
      </div>
    </div>
  );
}