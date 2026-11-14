"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { themeIcons } from "@/components/public/theme-icons";
import styles from "./IconPicker.module.css";

export default function IconPicker({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const names = useMemo(
    () =>
      Object.keys(themeIcons).filter((name) =>
        name.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [query]
  );

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
            <p>Select an icon for this element.</p>
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
            placeholder="Search icons..."
          />
        </label>
        <div className={styles.grid}>
          {names.map((name) => {
            const Icon = themeIcons[name];
            return (
              <button
                type="button"
                key={name}
                className={name === value ? styles.selected : ""}
                onClick={() => {
                  onSelect(name);
                  onClose();
                }}
                aria-label={name}
                title={name}
              >
                <Icon size={22} />
                <span>{name}</span>
              </button>
            );
          })}
          {names.length === 0 && (
            <p className={styles.empty}>No matching icons.</p>
          )}
        </div>
        <p className={styles.note}>
          Icons are provided by the project&apos;s Lucide icon set.
        </p>
      </section>
    </div>
  );
}
