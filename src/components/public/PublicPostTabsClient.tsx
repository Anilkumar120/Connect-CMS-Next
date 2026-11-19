"use client";

import { useState, type CSSProperties } from "react";

type PostItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  publishedAt: string | null;
  href: string;
};

type Tab = {
  id: string;
  title: string;
  posts: PostItem[];
};

type Props = {
  tabs: Tab[];
  postType?: string;
  columns?: number;
  showImage?: boolean;
  showTitle?: boolean;
  showExcerpt?: boolean;
  showDate?: boolean;
  showReadMore?: boolean;
  readMoreText?: string;
  normalColor?: string;
  normalBackground?: string;
  hoverColor?: string;
  hoverBackground?: string;
  activeColor?: string;
  activeBackground?: string;
  gap?: string;
  imageHeight?: string;
  cardBackground?: string;
  cardBorderColor?: string;
  cardRadius?: string;
  style?: CSSProperties;
};

export default function PublicPostTabsClient({
  tabs,
  columns = 2,
  showImage = true,
  showTitle = true,
  showExcerpt = true,
  showDate = true,
  showReadMore = true,
  readMoreText = "Read More",
  normalColor = "#334155",
  normalBackground = "#f1f5f9",
  hoverColor,
  hoverBackground,
  activeColor = "#ffffff",
  activeBackground = "#0c2f55",
  gap = "16px",
  imageHeight = "150px",
  cardBackground = "#ffffff",
  cardBorderColor = "#e2e8f0",
  cardRadius = "8px",
  style,
}: Props) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const current = tabs[active] || tabs[0];
  const safeColumns = Math.max(1, Math.min(6, Number(columns) || 2));

  if (!tabs.length) return <div style={style}>Add post tabs in the Content panel.</div>;

  const cardStyle: CSSProperties = {
    minWidth: 0,
    overflow: "hidden",
    border: `1px solid ${cardBorderColor}`,
    borderRadius: cardRadius,
    background: cardBackground,
  };

  return (
    <div style={style}>
      <div role="tablist" aria-label="Post categories" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === index}
            onClick={() => setActive(index)}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            style={{ border: 0, borderRadius: 6, padding: "9px 14px", cursor: "pointer", color: active === index ? activeColor : hovered === index ? hoverColor : normalColor, background: active === index ? activeBackground : hovered === index ? hoverBackground : normalBackground, font: "inherit" }}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ display: "grid", gridTemplateColumns: `repeat(var(--builder-prop-columns, ${safeColumns}), minmax(0, 1fr))`, gap }}>
        {(current?.posts || []).map((post) => (
          <article key={post.id} style={cardStyle}>
            {showImage && post.featuredImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.featuredImage} alt={post.title} style={{ display: "block", width: "100%", height: imageHeight, objectFit: "cover" }} />
            ) : null}
            <div style={{ padding: 14 }}>
              {showDate && post.publishedAt ? <time style={{ display: "block", fontSize: 12, opacity: 0.7, marginBottom: 7 }}>{new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</time> : null}
              {showTitle ? <h3 style={{ margin: "0 0 8px", fontSize: 17 }}>{post.title}</h3> : null}
              {showExcerpt && post.excerpt ? <p style={{ margin: "0 0 10px", lineHeight: 1.55 }}>{post.excerpt}</p> : null}
              {showReadMore ? <a href={post.href} style={{ fontWeight: 600, textDecoration: "none" }}>{readMoreText}</a> : null}
            </div>
          </article>
        ))}
        {!current?.posts?.length ? <p>No posts found in this tab.</p> : null}
      </div>
    </div>
  );
}
