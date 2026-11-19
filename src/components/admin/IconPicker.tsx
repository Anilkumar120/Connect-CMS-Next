"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, RotateCcw, Plus } from "lucide-react";
import {
  themeIcons,
  themeIconLabels,
  themeIconCategories,
} from "@/components/public/theme-icons";
import styles from "./IconPicker.module.css";

type IconTab = "all" | "lucide" | "brand";

type Props = {
  value: string;
  onSelect: (name: string) => void;
  onClose: () => void;
};

const PAGE_SIZE = 180;

export default function IconPicker({ value, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<IconTab>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const icons = useMemo(() => {
    const search = query.trim().toLowerCase();

    return Object.keys(themeIcons)
      .filter((name) => {
        const category = themeIconCategories[name] || "lucide";
        if (tab !== "all" && category !== tab) return false;

        const label = themeIconLabels[name] || name;
        return (
          !search ||
          name.toLowerCase().includes(search) ||
          label.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        const labelA = themeIconLabels[a] || a;
        const labelB = themeIconLabels[b] || b;
        return labelA.localeCompare(labelB);
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
            ["lucide", "Interface Icons"],
            ["brand", "Social & Brand"],
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
