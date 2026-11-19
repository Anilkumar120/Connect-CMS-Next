"use client";

import { useState, type CSSProperties } from "react";

type Item = { id?: string; title?: string; content?: string };
type Props = {
  items: Item[];
  style?: CSSProperties;
  normalColor?: string;
  normalBackground?: string;
  hoverColor?: string;
  hoverBackground?: string;
  activeColor?: string;
  activeBackground?: string;
};

export default function PublicBuilderTabs({
  items,
  style,
  normalColor = "#334155",
  normalBackground = "#f1f5f9",
  hoverColor,
  hoverBackground,
  activeColor = "#ffffff",
  activeBackground = "#0c2f55",
}: Props) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const current = items[active] || items[0];
  if (!items.length) return <div style={style}>Add tabs in the builder Content panel.</div>;
  return (
    <div style={style}>
      <div role="tablist" aria-label="Content tabs" style={{ display: "flex", flexWrap: "wrap", gap: 6, borderBottom: "1px solid #e2e8f0" }}>
        {items.map((item, index) => (
          <button
            key={item.id || index}
            type="button"
            role="tab"
            aria-selected={active === index}
            onClick={() => setActive(index)}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            style={{ border: 0, borderRadius: "6px 6px 0 0", padding: "10px 14px", cursor: "pointer", color: active === index ? activeColor : hovered === index ? hoverColor || normalColor : normalColor, background: active === index ? activeBackground : hovered === index ? hoverBackground || normalBackground : normalBackground, font: "inherit" }}
          >
            {item.title || `Tab ${index + 1}`}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ padding: "14px 0" }}>{current?.content || "Add tab content in the builder."}</div>
    </div>
  );
}
