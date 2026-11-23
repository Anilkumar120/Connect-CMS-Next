"use client";

import { useState, type MouseEvent } from "react";
import { ArrowLeft, X, LayoutGrid } from "lucide-react";
import styles from "./BuilderStructurePicker.module.css";

export type BuilderStructureSelection =
  | { mode: "flexbox"; rows: number[][] }
  | { mode: "grid"; rows: number; columns: number };

type FlexPreset = {
  id: string;
  label: string;
  rows: number[][];
};

type Props = {
  targetLabel: "section" | "container";
  onClose: () => void;
  onCreate: (selection: BuilderStructureSelection) => void;
};

const FLEX_PRESETS: FlexPreset[] = [
  { id: "single", label: "1 column", rows: [[1]] },
  { id: "two-equal", label: "2 columns", rows: [[1, 1]] },
  { id: "one-third-two-thirds", label: "1/3 Â· 2/3", rows: [[1, 2]] },
  { id: "two-thirds-one-third", label: "2/3 Â· 1/3", rows: [[2, 1]] },
  { id: "three-equal", label: "3 columns", rows: [[1, 1, 1]] },
  { id: "four-equal", label: "4 columns", rows: [[1, 1, 1, 1]] },
  { id: "five-equal", label: "5 columns", rows: [[1, 1, 1, 1, 1]] },
  { id: "six-equal", label: "6 columns", rows: [[1, 1, 1, 1, 1, 1]] },
  { id: "two-by-two", label: "2 Ã— 2", rows: [[1, 1], [1, 1]] },
  { id: "wide-top", label: "Full + 2 columns", rows: [[1], [1, 1]] },
  { id: "wide-bottom", label: "2 columns + full", rows: [[1, 1], [1]] },
  { id: "three-and-full", label: "3 columns + full", rows: [[1, 1, 1], [1]] },
];

function FlexPreview({ rows }: { rows: number[][] }) {
  return (
    <div className={styles.flexPreview} style={{ gridTemplateRows: `repeat(${rows.length}, minmax(22px, 1fr))` }}>
      {rows.map((row, rowIndex) => (
        <div className={styles.previewRow} key={rowIndex}>
          {row.map((weight, columnIndex) => (
            <span key={columnIndex} style={{ flex: `${weight} 1 0%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function BuilderStructurePicker({ targetLabel, onClose, onCreate }: Props) {
  const [step, setStep] = useState<"mode" | "flexbox" | "grid">("mode");
  const [gridRows, setGridRows] = useState(2);
  const [gridColumns, setGridColumns] = useState(2);

  const title = step === "mode"
    ? `Add ${targetLabel}`
    : step === "flexbox"
      ? "Select your structure"
      : "Set your grid structure";

  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className={styles.backdrop} onMouseDown={closeOnBackdrop}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="builder-structure-title">
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {step !== "mode" && (
              <button type="button" className={styles.backButton} onClick={() => setStep("mode")} aria-label="Back to layout type">
                <ArrowLeft size={19} />
              </button>
            )}
            <div>
              <span className={styles.eyebrow}>LAYOUT</span>
              <h2 id="builder-structure-title">{title}</h2>
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close layout picker">
            <X size={20} />
          </button>
        </header>

        {step === "mode" && (
          <div className={styles.modeGrid}>
            <button type="button" className={styles.modeCard} onClick={() => setStep("flexbox")}>
              <span className={`${styles.modeIcon} ${styles.flexGlyph}`} aria-hidden="true"><i /><i /></span>
              <strong>Flexbox</strong>
              <small>Arrange containers in rows or columns</small>
            </button>
            <button type="button" className={styles.modeCard} onClick={() => setStep("grid")}>
              <span className={styles.modeIcon}><LayoutGrid size={39} strokeWidth={1.5} /></span>
              <strong>Grid</strong>
              <small>Choose the exact number of rows and columns</small>
            </button>
          </div>
        )}

        {step === "flexbox" && (
          <div className={styles.structureBody}>
            <p className={styles.helper}>Choose a column or row structure. You can change the layout later in the Layout controls.</p>
            <div className={styles.structureGrid}>
              {FLEX_PRESETS.map((preset) => (
                <button
                  type="button"
                  className={styles.structureCard}
                  key={preset.id}
                  onClick={() => onCreate({ mode: "flexbox", rows: preset.rows })}
                >
                  <FlexPreview rows={preset.rows} />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "grid" && (
          <div className={styles.gridBody}>
            <p className={styles.helper}>Set how many rows and columns this grid should contain. Each cell will be an editable, draggable container.</p>
            <div className={styles.gridControls}>
              <label>
                <span>Rows</span>
                <select value={gridRows} onChange={(event) => setGridRows(Number(event.target.value))}>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                <span>Columns</span>
                <select value={gridColumns} onChange={(event) => setGridColumns(Number(event.target.value))}>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            </div>
            <div className={styles.gridPreviewWrap}>
              <div className={styles.gridPreview} style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${gridRows}, minmax(26px, 1fr))` }}>
                {Array.from({ length: gridRows * gridColumns }, (_, index) => <span key={index}>{index + 1}</span>)}
              </div>
            </div>
            <div className={styles.gridFooter}>
              <span>{gridRows * gridColumns} editable containers</span>
              <button type="button" className={styles.createButton} onClick={() => onCreate({ mode: "grid", rows: gridRows, columns: gridColumns })}>
                Create {gridRows} Ã— {gridColumns} Grid
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}