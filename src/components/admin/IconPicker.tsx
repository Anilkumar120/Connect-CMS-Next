"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, RotateCcw, Plus } from "lucide-react";
import {
  themeIcons,
  themeIconLabels,
  themeIconCategories,
} from "@/components/public/theme-icons";
import styles from "./IconPicker.module.css";

type IconTab = "all" | "social" | "brand" | "lucide";

type Props = {
  value: string;
  onSelect: (name: string) => void;
  onClose: () => void;
  initialTab?: IconTab;
};

const PAGE_SIZE = 180;

function nameExact(name: string, search: string): boolean {
  return name.toLowerCase() === search;
}

// Canonical registry aliases; these are surfaced before the full brand catalog.
const POPULAR_SOCIAL_ICON_KEYS = [
  "LinkedIn", "XBrand", "Twitter", "Instagram", "Facebook", "YouTube",
  "TikTok", "WhatsApp", "Telegram", "Pinterest", "Snapchat", "Reddit",
  "Discord", "Twitch", "Threads", "Spotify", "GitHub", "GitLab", "Mastodon",
  "Bluesky", "WeChat", "Weibo", "LINE", "Slack", "Medium", "Behance",
  "Dribbble", "Vimeo", "SoundCloud", "Tumblr",
] as const;

// ICON_PICKER_POPULAR_SOCIAL_V8
export default function IconPicker({ value, onSelect, onClose, initialTab = "all" }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<IconTab>(initialTab);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const icons = useMemo(() => {
    const search = query.trim().toLowerCase();
    const popularRank = new Map<string, number>(
      POPULAR_SOCIAL_ICON_KEYS.map((name, index) => [name, index] as const),
    );

    const matches = Object.keys(themeIcons).filter((name) => {
      const category = themeIconCategories[name] || "lucide";
      const label = themeIconLabels[name] || name;
      if (tab === "lucide" && category !== "lucide") return false;
      if (tab === "brand" && category !== "brand") return false;
      if (tab === "social" && (category !== "brand" || !popularRank.has(name))) return false;
      return (
        !search ||
        name.toLowerCase().includes(search) ||
        label.toLowerCase().includes(search)
      );
    });

    matches.sort((a, b) => {
      const labelA = themeIconLabels[a] || a;
      const labelB = themeIconLabels[b] || b;
      if (search) {
        const exactA = labelA.toLowerCase() === search ? 0 : nameExact(a, search) ? 1 : 2;
        const exactB = labelB.toLowerCase() === search ? 0 : nameExact(b, search) ? 1 : 2;
        if (exactA !== exactB) return exactA - exactB;
      }
      const rankA = popularRank.has(a) ? popularRank.get(a)! : Number.MAX_SAFE_INTEGER;
      const rankB = popularRank.has(b) ? popularRank.get(b)! : Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      const aliasA = /^Si[A-Z]/.test(a) ? 1 : 0;
      const aliasB = /^Si[A-Z]/.test(b) ? 1 : 0;
      if (aliasA !== aliasB) return aliasA - aliasB;
      return labelA.localeCompare(labelB);
    });

    // Simple Icons expose both Si* keys and friendly aliases. Keep one tile per
    // actual brand component so the picker has no duplicate logos.
    const seenBrandComponents = new Set<unknown>();
    return matches.filter((name) => {
      if ((themeIconCategories[name] || "lucide") !== "brand") return true;
      const component = themeIcons[name];
      if (seenBrandComponents.has(component)) return false;
      seenBrandComponents.add(component);
      return true;
    });
  }, [query, tab]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, tab]);

  const visibleIcons = icons.slice(0, visibleCount);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="icon-picker-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="icon-picker-title">Choose an icon</h2>
            <p>Search interface icons and thousands of social / brand logos.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close icon picker">
            <X size={19} />
          </button>
        </header>

        <label className={styles.search}>
          <Search size={17} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Instagram, Facebook, LinkedIn, Arrow, Check..."
          />
        </label>

        <div className={styles.tabs} role="tablist" aria-label="Icon categories">
          {([
            ["all", "All Icons"],
            ["social", "Popular Social"],
            ["brand", "All Brands"],
            ["lucide", "Interface Icons"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? styles.activeTab : styles.tab}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.resultMeta}>
          <span>
            Showing {visibleIcons.length.toLocaleString()} of {icons.length.toLocaleString()} icons
          </span>
          <span>
            {value ? `Selected: ${themeIconLabels[value] || value}` : "No icon selected"}
          </span>
        </div>

        <div className={styles.grid}>
          {visibleIcons.map((name) => {
            const Icon = themeIcons[name];
            const label = themeIconLabels[name] || name;
            const selected = name === value;

            return (
              <button
                type="button"
                key={name}
                className={selected ? styles.selected : ""}
                onClick={() => {
                  onSelect(name);
                  onClose();
                }}
                aria-label={label}
                title={label}
              >
                <Icon size={22} />
                <span>{label}</span>
              </button>
            );
          })}
          {icons.length === 0 ? (
            <p className={styles.empty}>No matching icons. Try another search.</p>
          ) : null}
        </div>

        {visibleCount < icons.length ? (
          <button
            type="button"
            className={styles.showMore}
            onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, icons.length))}
          >
            <Plus size={15} />
            Show more icons ({(icons.length - visibleCount).toLocaleString()} remaining)
          </button>
        ) : null}

        <footer className={styles.footer}>
          <p className={styles.note}>
            Interface icons: Lucide. Brand logos: Simple Icons. Select “Remove Icon” to clear this field.
          </p>
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => {
              onSelect("");
              onClose();
            }}
            aria-label="Remove icon"
          >
            <RotateCcw size={14} />
            Remove Icon
          </button>
        </footer>
      </section>
    </div>
  );
}
