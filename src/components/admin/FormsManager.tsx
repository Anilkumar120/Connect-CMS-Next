"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  Copy,
  Eye,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
  GripVertical,
  Columns3,
  Rows3,
  ArrowLeft,
  Mail,
  MessageSquareText,
} from "lucide-react";

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { FORM_FIELD_TYPES, type FormField } from "@/lib/forms";
import styles from "./FormsManager.module.css";

type FormStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type FormRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  fields: unknown;
  settings?: unknown;
  status: FormStatus;
  deletedAt: string | null;
  updatedAt: string;
  _count?: { submissions: number };
};

type Lead = {
  id: string;
  formId: string;
  data: unknown;
  status: "UNREAD" | "READ" | "SPAM";
  deletedAt: string | null;
  createdAt: string;
  form: {
    id: string;
    title: string;
    slug: string;
    fields?: unknown;
  };
};

type ApiResult = {
  success?: boolean;
  message?: string;
  forms?: FormRecord[];
  form?: FormRecord;
  submissions?: Lead[];
  submission?: Lead;
  count?: number;
};

type FieldDraft = FormField & { optionsText: string };
type FormTab = "ALL" | "PUBLISHED" | "DRAFT" | "ARCHIVED";

type LayoutColumn = {
  id: string;
  width: number;
  fields: FieldDraft[];
};

type LayoutRow = {
  id: string;
  columns: LayoutColumn[];
};

type SavedLayout = {
  version: 1;
  rows: Array<{
    id: string;
    columns: Array<{
      id: string;
      width: number;
      fieldIds: string[];
    }>;
  }>;
};

type EmailSourceMode = "static" | "dynamic";

type FormBuilderSettings = {
  submitButtonText: string;
  successMessage: string;
  errorMessage: string;
  notifications: {
    enabled: boolean;
    fromEmail: string;
    toMode: EmailSourceMode;
    toEmails: string;
    toFieldId: string;
    ccMode: EmailSourceMode;
    ccEmails: string;
    ccFieldId: string;
    replyToFieldId: string;
  };
};

const DEFAULT_BUILDER_SETTINGS: FormBuilderSettings = {
  submitButtonText: "Submit",
  successMessage: "Thank you. Your response has been received.",
  errorMessage: "Unable to submit the form. Please try again.",
  notifications: {
    enabled: false,
    fromEmail: "",
    toMode: "static",
    toEmails: "",
    toFieldId: "",
    ccMode: "static",
    ccEmails: "",
    ccFieldId: "",
    replyToFieldId: "",
  },
};

const SHORTCODE = (id: string) => `[connect_form id="${id}"]`;

const OPTION_FIELD_TYPES = ["dropdown", "multi-select", "radio", "multiple-choice"];
const RANGE_FIELD_TYPES = ["number", "rating", "scale"];
const PLACEHOLDER_FIELD_TYPES = [
  "text", "paragraph", "name", "email", "number", "telephone", "url",
  "dropdown", "multi-select", "address", "city", "state", "country",
  "postal-code", "signature",
];
const COLUMN_WIDTHS = [3, 4, 6, 8, 9, 12];

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #ccd5e0",
  borderRadius: 6,
  padding: "9px 10px",
  font: "inherit",
  fontSize: 14,
  boxSizing: "border-box",
};

const smallActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  border: "1px solid #d5deea",
  background: "#fff",
  color: "#344054",
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 12,
  cursor: "pointer",
};

function makeId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toFieldDrafts(value: unknown): FieldDraft[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (field): field is FormField =>
        Boolean(field) &&
        typeof field === "object" &&
        typeof field.id === "string" &&
        typeof field.label === "string" &&
        typeof field.type === "string"
    )
    .map((field) => ({
      ...field,
      optionsText: (field.options ?? []).join("\n"),
    }));
}

function createEmptyColumn(width = 12): LayoutColumn {
  return { id: makeId("column"), width, fields: [] };
}

function createEmptyRow(): LayoutRow {
  return { id: makeId("row"), columns: [createEmptyColumn(12)] };
}

function cloneField(field: FieldDraft): FieldDraft {
  return { ...field, id: makeId("field"), options: [...(field.options ?? [])] };
}

function getSettingsObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function toFormBuilderSettings(value: unknown): FormBuilderSettings {
  const settings = getSettingsObject(value);
  const messages = isRecord(settings.formMessages) ? settings.formMessages : {};
  const rawNotifications = isRecord(settings.notifications) ? settings.notifications : {};
  const mode = (value: unknown): EmailSourceMode => value === "dynamic" ? "dynamic" : "static";

  return {
    submitButtonText: typeof messages.submitButtonText === "string" ? messages.submitButtonText : DEFAULT_BUILDER_SETTINGS.submitButtonText,
    successMessage: typeof messages.successMessage === "string" ? messages.successMessage : DEFAULT_BUILDER_SETTINGS.successMessage,
    errorMessage: typeof messages.errorMessage === "string" ? messages.errorMessage : DEFAULT_BUILDER_SETTINGS.errorMessage,
    notifications: {
      enabled: rawNotifications.enabled === true,
      fromEmail: typeof rawNotifications.fromEmail === "string" ? rawNotifications.fromEmail : "",
      toMode: mode(rawNotifications.toMode),
      toEmails: typeof rawNotifications.toEmails === "string" ? rawNotifications.toEmails : "",
      toFieldId: typeof rawNotifications.toFieldId === "string" ? rawNotifications.toFieldId : "",
      ccMode: mode(rawNotifications.ccMode),
      ccEmails: typeof rawNotifications.ccEmails === "string" ? rawNotifications.ccEmails : "",
      ccFieldId: typeof rawNotifications.ccFieldId === "string" ? rawNotifications.ccFieldId : "",
      replyToFieldId: typeof rawNotifications.replyToFieldId === "string" ? rawNotifications.replyToFieldId : "",
    },
  };
}

/**
 * Rebuild the visual row/column layout from settings.layout. Fields remain in
 * the existing flat Form.fields array so current submissions keep their IDs.
 */
function toLayoutRows(fieldsValue: unknown, settingsValue: unknown): LayoutRow[] {
  const fields = toFieldDrafts(fieldsValue);
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const settings = getSettingsObject(settingsValue);
  const savedLayout = isRecord(settings.layout) ? settings.layout : null;
  const savedRows = savedLayout && Array.isArray(savedLayout.rows)
    ? savedLayout.rows
    : null;

  if (!savedRows) {
    return [{
      id: makeId("row"),
      columns: [{ id: makeId("column"), width: 12, fields }],
    }];
  }

  const used = new Set<string>();
  const rows: LayoutRow[] = savedRows.map((rawRow) => {
    const row = isRecord(rawRow) ? rawRow : {};
    const rowId = typeof row.id === "string" ? row.id : makeId("row");
    const rawColumns = Array.isArray(row.columns) ? row.columns : [];

    const columns: LayoutColumn[] = rawColumns.map((rawColumn) => {
      const column = isRecord(rawColumn) ? rawColumn : {};
      const columnId = typeof column.id === "string" ? column.id : makeId("column");
      const widthValue = Number(column.width);
      const width = COLUMN_WIDTHS.includes(widthValue) ? widthValue : 12;
      const fieldIds = Array.isArray(column.fieldIds) ? column.fieldIds : [];
      const columnFields: FieldDraft[] = [];

      for (const rawId of fieldIds) {
        if (typeof rawId !== "string" || used.has(rawId)) continue;
        const field = fieldById.get(rawId);
        if (!field) continue;
        used.add(rawId);
        columnFields.push(field);
      }

      return { id: columnId, width, fields: columnFields };
    });

    return {
      id: rowId,
      columns: columns.length ? columns : [createEmptyColumn(12)],
    };
  });

  const unassigned = fields.filter((field) => !used.has(field.id));
  if (!rows.length) rows.push(createEmptyRow());
  if (unassigned.length) rows[0].columns[0].fields.push(...unassigned);

  return rows;
}

function toSavedLayout(rows: LayoutRow[]): SavedLayout {
  return {
    version: 1,
    rows: rows.map((row) => ({
      id: row.id,
      columns: row.columns.map((column) => ({
        id: column.id,
        width: column.width,
        fieldIds: column.fields.map((field) => field.id),
      })),
    })),
  };
}

function flattenRows(rows: LayoutRow[]): FieldDraft[] {
  return rows.flatMap((row) => row.columns.flatMap((column) => column.fields));
}

async function readApiResponse(response: Response): Promise<ApiResult> {
  const text = await response.text();
  try {
    return JSON.parse(text) as ApiResult;
  } catch {
    throw new Error(`Server returned an invalid response (${response.status}).`);
  }
}

/* ======================================================
   SORTABLE FIELD
====================================================== */

type SortableFieldProps = {
  field: FieldDraft;
  updateField: (fieldId: string, patch: Partial<FieldDraft>) => void;
  removeField: (fieldId: string) => void;
  duplicateField: (fieldId: string) => void;
};

function SortableField({ field, updateField, removeField, duplicateField }: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `field:${field.id}` });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    position: "relative",
    zIndex: isDragging ? 20 : 1,
    background: isDragging ? "#f0f6ff" : "#fff",
    border: isDragging ? "2px dashed #3984e8" : undefined,
  };

  return (
    <fieldset ref={setNodeRef} className={styles.fieldEditor} style={sortableStyle}>
      <div className={styles.fieldGrid}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag to reorder ${field.label || "field"}`}
            title="Drag field to another position or column"
            style={{
              border: "1px solid #d5deea",
              background: "#f8fafc",
              color: "#64748b",
              borderRadius: 6,
              padding: "9px 6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isDragging ? "grabbing" : "grab",
              flexShrink: 0,
              touchAction: "none",
            }}
          >
            <GripVertical size={19} />
          </button>
          <input
            aria-label="Field label"
            style={inputStyle}
            value={field.label}
            onChange={(event) => updateField(field.id, { label: event.target.value })}
          />
        </div>

        <select
          aria-label="Field type"
          style={inputStyle}
          value={field.type}
          onChange={(event) => updateField(field.id, { type: event.target.value as FormField["type"] })}
        >
          {FORM_FIELD_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
          <button type="button" style={smallActionStyle} title="Duplicate field" aria-label="Duplicate field" onClick={() => duplicateField(field.id)}>
            <Copy size={14} />
          </button>
          <button type="button" className={styles.removeField} aria-label="Remove field" onClick={() => removeField(field.id)}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className={styles.fieldOptions}>
        <label>
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(event) => updateField(field.id, { required: event.target.checked })}
          />
          Required
        </label>
        {PLACEHOLDER_FIELD_TYPES.includes(field.type) && (
          <input
            style={inputStyle}
            placeholder="Placeholder"
            value={field.placeholder ?? ""}
            onChange={(event) => updateField(field.id, { placeholder: event.target.value })}
          />
        )}
      </div>

      {OPTION_FIELD_TYPES.includes(field.type) && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#344054" }}>
            Field Options
          </label>
          <textarea
            aria-label="Options"
            style={{ ...inputStyle, minHeight: 85 }}
            placeholder={"Enter one option per line\nOption one\nOption two\nOption three"}
            value={field.optionsText}
            onChange={(event) => updateField(field.id, { optionsText: event.target.value })}
          />
          <small style={{ color: "#667085" }}>Enter each option on a separate line.</small>
        </div>
      )}

      {RANGE_FIELD_TYPES.includes(field.type) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054" }}>
            Minimum Value
            <input
              type="number"
              style={{ ...inputStyle, marginTop: 6 }}
              placeholder="Minimum"
              value={field.min ?? ""}
              onChange={(event) => updateField(field.id, { min: event.target.value === "" ? undefined : Number(event.target.value) })}
            />
          </label>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054" }}>
            Maximum Value
            <input
              type="number"
              style={{ ...inputStyle, marginTop: 6 }}
              placeholder="Maximum"
              value={field.max ?? ""}
              onChange={(event) => updateField(field.id, { max: event.target.value === "" ? undefined : Number(event.target.value) })}
            />
          </label>
        </div>
      )}

      {field.type === "html" && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#344054" }}>
            HTML Content
          </label>
          <textarea
            aria-label="HTML content"
            style={{ ...inputStyle, minHeight: 150, fontFamily: "monospace", fontSize: 13 }}
            placeholder="<div>Your HTML content here</div>"
            value={field.content ?? ""}
            onChange={(event) => updateField(field.id, { content: event.target.value })}
          />
          <small style={{ color: "#667085" }}>
            HTML content will be stored with this field. Sanitize HTML before rendering it on the public website.
          </small>
        </div>
      )}
    </fieldset>
  );
}

/* ======================================================
   SORTABLE COLUMN
====================================================== */

type SortableColumnProps = {
  rowId: string;
  column: LayoutColumn;
  columnIndex: number;
  updateField: (fieldId: string, patch: Partial<FieldDraft>) => void;
  removeField: (fieldId: string) => void;
  duplicateField: (rowId: string, columnId: string, fieldId: string) => void;
  addField: (rowId: string, columnId: string) => void;
  removeColumn: (rowId: string, columnId: string) => void;
  duplicateColumn: (rowId: string, columnId: string) => void;
  changeWidth: (rowId: string, columnId: string, width: number) => void;
};

function SortableColumn({
  rowId,
  column,
  columnIndex,
  updateField,
  removeField,
  duplicateField,
  addField,
  removeColumn,
  duplicateColumn,
  changeWidth,
}: SortableColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `column:${column.id}` });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `dropcol:${column.id}` });

  const columnStyle: React.CSSProperties = {
    gridColumn: `span ${column.width}`,
    minWidth: 0,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 15 : 1,
    border: isDragging ? "2px dashed #3984e8" : "1px solid #d7e0eb",
    background: isDragging ? "#f0f6ff" : "#fbfdff",
  };

  return (
    <section ref={setNodeRef} className={styles.layoutColumn} style={columnStyle}>
      <div className={styles.layoutColumnHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <button
            type="button"
            {...attributes}
            {...listeners}
            title="Drag to reorder column"
            aria-label={`Drag column ${columnIndex + 1}`}
            style={{ ...smallActionStyle, padding: 6, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
          >
            <GripVertical size={16} />
          </button>
          <strong style={{ fontSize: 13, color: "#183b60" }}>Column {columnIndex + 1}</strong>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#526174" }}>
            Width
            <select
              aria-label={`Column ${columnIndex + 1} width`}
              value={column.width}
              onChange={(event) => changeWidth(rowId, column.id, Number(event.target.value))}
              style={{ ...inputStyle, width: 86, padding: "5px 6px", fontSize: 12 }}
            >
              {COLUMN_WIDTHS.map((width) => (
                <option key={width} value={width}>{Math.round((width / 12) * 100)}%</option>
              ))}
            </select>
          </label>
          <button type="button" style={smallActionStyle} title="Duplicate column" onClick={() => duplicateColumn(rowId, column.id)}>
            <Copy size={13} />
          </button>
          <button type="button" style={{ ...smallActionStyle, color: "#b42318" }} title="Delete column" onClick={() => removeColumn(rowId, column.id)}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <SortableContext items={column.fields.map((field) => `field:${field.id}`)} strategy={verticalListSortingStrategy}>
        <div
          ref={setDropRef}
          className={styles.layoutColumnFields}
          style={{
            minHeight: 94,
            padding: 9,
            borderRadius: 7,
            background: isOver ? "#eaf3ff" : "#f5f8fc",
            outline: isOver ? "2px dashed #3984e8" : "none",
          }}
        >
          {column.fields.map((field) => (
            <SortableField
              key={field.id}
              field={field}
              updateField={updateField}
              removeField={removeField}
              duplicateField={(fieldId) => duplicateField(rowId, column.id, fieldId)}
            />
          ))}
          {!column.fields.length && (
            <div className={styles.layoutEmptyColumn}>
              Drop a field here or click “Add Field”.
            </div>
          )}
        </div>
      </SortableContext>

      <div style={{ display: "flex", justifyContent: "flex-start", padding: "0 9px 9px" }}>
        <button type="button" className={styles.secondaryButton} onClick={() => addField(rowId, column.id)}>
          <Plus size={13} /> Add Field
        </button>
      </div>
    </section>
  );
}

/* ======================================================
   SORTABLE ROW
====================================================== */

type SortableRowProps = {
  row: LayoutRow;
  rowIndex: number;
  updateField: (fieldId: string, patch: Partial<FieldDraft>) => void;
  removeField: (fieldId: string) => void;
  duplicateField: (rowId: string, columnId: string, fieldId: string) => void;
  addField: (rowId: string, columnId: string) => void;
  addColumn: (rowId: string) => void;
  removeRow: (rowId: string) => void;
  duplicateRow: (rowId: string) => void;
  removeColumn: (rowId: string, columnId: string) => void;
  duplicateColumn: (rowId: string, columnId: string) => void;
  changeWidth: (rowId: string, columnId: string, width: number) => void;
};

function SortableRow(props: SortableRowProps) {
  const { row, rowIndex } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `row:${row.id}` });

  return (
    <section
      ref={setNodeRef}
      className={styles.layoutRow}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        border: isDragging ? "2px dashed #3984e8" : "1px solid #d9e2ed",
        background: isDragging ? "#f0f6ff" : "#fff",
      }}
    >
      <div className={styles.layoutRowHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            {...attributes}
            {...listeners}
            title="Drag to reorder row"
            aria-label={`Drag row ${rowIndex + 1}`}
            style={{ ...smallActionStyle, padding: 7, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
          >
            <GripVertical size={17} />
          </button>
          <Rows3 size={17} color="#3984e8" />
          <strong>Row {rowIndex + 1}</strong>
          <span style={{ fontSize: 12, color: "#667085" }}>{row.columns.length} column(s)</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button type="button" style={smallActionStyle} onClick={() => props.addColumn(row.id)}>
            <Columns3 size={13} /> Add Column
          </button>
          <button type="button" style={smallActionStyle} title="Duplicate row" onClick={() => props.duplicateRow(row.id)}>
            <Copy size={13} /> Duplicate
          </button>
          <button type="button" style={{ ...smallActionStyle, color: "#b42318" }} title="Delete row" onClick={() => props.removeRow(row.id)}>
            <Trash2 size={13} /> Delete Row
          </button>
        </div>
      </div>

      <SortableContext items={row.columns.map((column) => `column:${column.id}`)} strategy={horizontalListSortingStrategy}>
        <div className={styles.layoutColumns}>
          {row.columns.map((column, index) => (
            <SortableColumn
              key={column.id}
              rowId={row.id}
              column={column}
              columnIndex={index}
              updateField={props.updateField}
              removeField={props.removeField}
              duplicateField={props.duplicateField}
              addField={props.addField}
              removeColumn={props.removeColumn}
              duplicateColumn={props.duplicateColumn}
              changeWidth={props.changeWidth}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

/* ======================================================
   MAIN FORMS MANAGER
====================================================== */

export default function FormsManager({ role }: { role: string }) {
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  const [section, setSection] = useState<"forms" | "leads">("forms");
  const [trash, setTrash] = useState(false);
  const [activeTab, setActiveTab] = useState<FormTab>("ALL");
  const [search, setSearch] = useState("");
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<FormRecord | null | undefined>(undefined);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<FormStatus>("DRAFT");
  const [rows, setRows] = useState<LayoutRow[]>([]);
  const [builderSettings, setBuilderSettings] = useState<FormBuilderSettings>(DEFAULT_BUILDER_SETTINGS);

  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [formResponse, leadResponse] = await Promise.all([
        fetch(`/api/admin/forms${trash ? "?trash=1" : ""}`, { cache: "no-store" }),
        fetch(`/api/admin/forms/submissions${trash ? "?trash=1" : ""}`, { cache: "no-store" }),
      ]);
      const [formData, leadData] = await Promise.all([
        readApiResponse(formResponse),
        readApiResponse(leadResponse),
      ]);
      if (!formResponse.ok || !formData.success) throw new Error(formData.message || "Unable to load forms.");
      if (!leadResponse.ok || !leadData.success) throw new Error(leadData.message || "Unable to load submissions.");
      setForms(formData.forms ?? []);
      setLeads(leadData.submissions ?? []);
      setSelected([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Forms & Leads.");
    } finally {
      setLoading(false);
    }
  }, [trash]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const counts = useMemo(() => ({
    ALL: forms.length,
    PUBLISHED: forms.filter((form) => form.status === "PUBLISHED").length,
    DRAFT: forms.filter((form) => form.status === "DRAFT").length,
    ARCHIVED: forms.filter((form) => form.status === "ARCHIVED").length,
  }), [forms]);

  const filteredForms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return forms.filter((form) => {
      const matchesTab = activeTab === "ALL" || form.status === activeTab;
      const matchesSearch = !query || form.title.toLowerCase().includes(query) || form.slug.toLowerCase().includes(query) || form.id.toLowerCase().includes(query);
      return matchesTab && matchesSearch;
    });
  }, [forms, activeTab, search]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => !query || lead.form.title.toLowerCase().includes(query) || lead.id.toLowerCase().includes(query));
  }, [leads, search]);

  async function request(url: string, method: string, body?: unknown): Promise<ApiResult> {
    const response = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const result = await readApiResponse(response);
    if (!response.ok || !result.success) throw new Error(result.message || "The operation failed.");
    return result;
  }

  function startCreate() {
    setEditing(null);
    setTitle("");
    setSlug("");
    setDescription("");
    setStatus("DRAFT");
    setRows([createEmptyRow()]);
    setBuilderSettings(DEFAULT_BUILDER_SETTINGS);
    setError("");
    setNotice("");
  }

  function startEdit(form: FormRecord) {
    setEditing(form);
    setTitle(form.title);
    setSlug(form.slug);
    setDescription(form.description ?? "");
    setStatus(form.status);
    setRows(toLayoutRows(form.fields, form.settings));
    setBuilderSettings(toFormBuilderSettings(form.settings));
    setError("");
    setNotice("");
  }

  function updateBuilderMessages(patch: Partial<Pick<FormBuilderSettings, "submitButtonText" | "successMessage" | "errorMessage">>) {
    setBuilderSettings((current) => ({ ...current, ...patch }));
  }

  function updateNotificationSettings(patch: Partial<FormBuilderSettings["notifications"]>) {
    setBuilderSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, ...patch },
    }));
  }

  async function saveForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const allFields = flattenRows(rows);
      const existingSettings = getSettingsObject(editing?.settings);
      const settings = {
        ...existingSettings,
        layout: toSavedLayout(rows),
        formMessages: {
          submitButtonText: builderSettings.submitButtonText.trim() || "Submit",
          successMessage: builderSettings.successMessage.trim() || DEFAULT_BUILDER_SETTINGS.successMessage,
          errorMessage: builderSettings.errorMessage.trim() || DEFAULT_BUILDER_SETTINGS.errorMessage,
        },
        notifications: {
          ...builderSettings.notifications,
          fromEmail: builderSettings.notifications.fromEmail.trim(),
          toEmails: builderSettings.notifications.toEmails.trim(),
          ccEmails: builderSettings.notifications.ccEmails.trim(),
        },
      };
      const payload = {
        title,
        slug,
        description,
        status,
        settings,
        // Keep fields flat for existing API validation and submission handling.
        fields: allFields.map(({ optionsText, ...field }) => ({
          ...field,
          options: optionsText.split("\n").map((item) => item.trim()).filter(Boolean),
        })),
      };

      await request(
        editing ? `/api/admin/forms/${editing.id}` : "/api/admin/forms",
        editing ? "PATCH" : "POST",
        payload
      );
      setEditing(undefined);
      setNotice("Form saved successfully.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save form.");
    } finally {
      setBusy(false);
    }
  }

  /* -------------------- ROW / COLUMN / FIELD ACTIONS -------------------- */

  function addRow() {
    setRows((current) => [...current, createEmptyRow()]);
  }

  function removeRow(rowId: string) {
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;
    const hasFields = row.columns.some((column) => column.fields.length > 0);
    if (hasFields && !window.confirm("Delete this row and all fields inside it?")) return;
    setRows((current) => {
      const next = current.filter((item) => item.id !== rowId);
      return next.length ? next : [createEmptyRow()];
    });
  }

  function duplicateRow(rowId: string) {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === rowId);
      if (index < 0) return current;
      const source = current[index];
      const copy: LayoutRow = {
        id: makeId("row"),
        columns: source.columns.map((column) => ({
          id: makeId("column"),
          width: column.width,
          fields: column.fields.map(cloneField),
        })),
      };
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }

  function addColumn(rowId: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== rowId) return row;
      if (row.columns.length >= 4) return row;
      const nextCount = row.columns.length + 1;
      const width = Math.floor(12 / nextCount);
      return {
        ...row,
        columns: [
          ...row.columns.map((column) => ({ ...column, width })),
          createEmptyColumn(width),
        ],
      };
    }));
    const target = rows.find((row) => row.id === rowId);
    if (target && target.columns.length >= 4) setError("A row can contain a maximum of 4 columns.");
  }

  function removeColumn(rowId: string, columnId: string) {
    const row = rows.find((item) => item.id === rowId);
    const column = row?.columns.find((item) => item.id === columnId);
    if (!row || !column) return;
    if (column.fields.length && !window.confirm("Delete this column and all fields inside it?")) return;
    setRows((current) => current.map((item) => {
      if (item.id !== rowId) return item;
      if (item.columns.length === 1) return { ...item, columns: [createEmptyColumn(12)] };
      const columns = item.columns.filter((col) => col.id !== columnId);
      const width = Math.floor(12 / columns.length);
      return { ...item, columns: columns.map((col) => ({ ...col, width })) };
    }));
  }

  function duplicateColumn(rowId: string, columnId: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== rowId) return row;
      if (row.columns.length >= 4) return row;
      const index = row.columns.findIndex((column) => column.id === columnId);
      if (index < 0) return row;
      const source = row.columns[index];
      const nextCount = row.columns.length + 1;
      const width = Math.floor(12 / nextCount);
      const columns = row.columns.map((column) => ({ ...column, width }));
      columns.splice(index + 1, 0, {
        id: makeId("column"),
        width,
        fields: source.fields.map(cloneField),
      });
      return { ...row, columns };
    }));
    const target = rows.find((row) => row.id === rowId);
    if (target && target.columns.length >= 4) setError("A row can contain a maximum of 4 columns.");
  }

  function changeWidth(rowId: string, columnId: string, width: number) {
    setRows((current) => current.map((row) => row.id !== rowId ? row : {
      ...row,
      columns: row.columns.map((column) => column.id === columnId ? { ...column, width } : column),
    }));
  }

  function addField(rowId: string, columnId: string) {
    const field: FieldDraft = {
      id: makeId("field"),
      label: "New field",
      type: "text",
      required: false,
      placeholder: "",
      options: [],
      optionsText: "",
      min: undefined,
      max: undefined,
      content: "",
    };
    setRows((current) => current.map((row) => row.id !== rowId ? row : {
      ...row,
      columns: row.columns.map((column) => column.id !== columnId ? column : {
        ...column,
        fields: [...column.fields, field],
      }),
    }));
  }

  function updateField(fieldId: string, patch: Partial<FieldDraft>) {
    setRows((current) => current.map((row) => ({
      ...row,
      columns: row.columns.map((column) => ({
        ...column,
        fields: column.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field),
      })),
    })));
  }

  function removeField(fieldId: string) {
    setRows((current) => current.map((row) => ({
      ...row,
      columns: row.columns.map((column) => ({
        ...column,
        fields: column.fields.filter((field) => field.id !== fieldId),
      })),
    })));
  }

  function duplicateField(rowId: string, columnId: string, fieldId: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        columns: row.columns.map((column) => {
          if (column.id !== columnId) return column;
          const index = column.fields.findIndex((field) => field.id === fieldId);
          if (index < 0) return column;
          const fields = [...column.fields];
          fields.splice(index + 1, 0, cloneField(fields[index]));
          return { ...column, fields };
        }),
      };
    }));
  }

  /* ----------------------------- DRAG AND DROP ----------------------------- */

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const [activeType, activeKey] = activeId.split(":", 2);
    const [overType, overKey] = overId.split(":", 2);

    if (activeType === "row" && overType === "row") {
      setRows((current) => {
        const oldIndex = current.findIndex((row) => row.id === activeKey);
        const newIndex = current.findIndex((row) => row.id === overKey);
        return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex);
      });
      return;
    }

    if (activeType === "column" && overType === "column") {
      setRows((current) => {
        const sourceRowIndex = current.findIndex((row) => row.columns.some((column) => column.id === activeKey));
        const targetRowIndex = current.findIndex((row) => row.columns.some((column) => column.id === overKey));
        if (sourceRowIndex < 0 || targetRowIndex < 0) return current;
        const next = current.map((row) => ({ ...row, columns: [...row.columns] }));
        const sourceColumns = next[sourceRowIndex].columns;
        const sourceIndex = sourceColumns.findIndex((column) => column.id === activeKey);
        const [moving] = sourceColumns.splice(sourceIndex, 1);
        const targetColumns = next[targetRowIndex].columns;
        const targetIndex = targetColumns.findIndex((column) => column.id === overKey);
        targetColumns.splice(Math.max(0, targetIndex), 0, moving);

        // Every row must retain at least one column after a cross-row move.
        if (sourceRowIndex !== targetRowIndex && sourceColumns.length === 0) {
          sourceColumns.push(createEmptyColumn(12));
        }

        return next.map((row) => {
          const width = Math.max(3, Math.floor(12 / Math.max(1, row.columns.length)));
          return { ...row, columns: row.columns.map((column) => ({ ...column, width })) };
        });
      });
      return;
    }

    if (activeType === "field" && (overType === "field" || overType === "dropcol")) {
      setRows((current) => {
        let sourceRowIndex = -1;
        let sourceColumnIndex = -1;
        let sourceFieldIndex = -1;
        current.forEach((row, rowIndex) => row.columns.forEach((column, columnIndex) => {
          const fieldIndex = column.fields.findIndex((field) => field.id === activeKey);
          if (fieldIndex >= 0) {
            sourceRowIndex = rowIndex;
            sourceColumnIndex = columnIndex;
            sourceFieldIndex = fieldIndex;
          }
        }));
        if (sourceRowIndex < 0 || sourceColumnIndex < 0 || sourceFieldIndex < 0) return current;

        let targetRowIndex = -1;
        let targetColumnIndex = -1;
        let targetFieldIndex = -1;
        current.forEach((row, rowIndex) => row.columns.forEach((column, columnIndex) => {
          if (overType === "dropcol" && column.id === overKey) {
            targetRowIndex = rowIndex;
            targetColumnIndex = columnIndex;
            targetFieldIndex = column.fields.length;
          }
          if (overType === "field") {
            const fieldIndex = column.fields.findIndex((field) => field.id === overKey);
            if (fieldIndex >= 0) {
              targetRowIndex = rowIndex;
              targetColumnIndex = columnIndex;
              targetFieldIndex = fieldIndex;
            }
          }
        }));
        if (targetRowIndex < 0 || targetColumnIndex < 0 || targetFieldIndex < 0) return current;

        const next = current.map((row) => ({
          ...row,
          columns: row.columns.map((column) => ({ ...column, fields: [...column.fields] })),
        }));
        const sourceFields = next[sourceRowIndex].columns[sourceColumnIndex].fields;
        const [moving] = sourceFields.splice(sourceFieldIndex, 1);
        const targetFields = next[targetRowIndex].columns[targetColumnIndex].fields;
        const insertAt = sourceRowIndex === targetRowIndex && sourceColumnIndex === targetColumnIndex && sourceFieldIndex < targetFieldIndex
          ? targetFieldIndex - 1
          : targetFieldIndex;
        targetFields.splice(Math.max(0, Math.min(insertAt, targetFields.length)), 0, moving);
        return next;
      });
    }
  }

  function operate(url: string, ids: string[], action: string) {
    if (!ids.length || busy) return;
    if (action === "PERMANENT_DELETE" && !window.confirm(`Permanently delete ${ids.length} selected item(s)? This cannot be undone.`)) return;

    setBusy(true);
    setError("");
    setNotice("");
    void (async () => {
      try {
        if (url.endsWith("/bulk")) {
          await request(url, "POST", { ids, action });
        } else {
          const isFormStatusUpdate = !url.includes("/submissions/") && !["TRASH", "RESTORE"].includes(action);
          await request(url, "PATCH", isFormStatusUpdate ? { status: action } : { action });
        }
        setNotice("Changes saved successfully.");
        setSelected([]);
        setActiveLead(null);
        await load();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to save changes.");
      } finally {
        setBusy(false);
      }
    })();
  }

  async function copyShortcode(form: FormRecord) {
    try {
      await navigator.clipboard.writeText(SHORTCODE(form.id));
      setCopiedId(form.id);
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch {
      setError("Unable to copy shortcode. Please copy it manually.");
    }
  }

  async function viewLead(lead: Lead) {
    setActiveLead(lead);
    try {
      const response = await fetch(`/api/admin/forms/submissions/${lead.id}`, { cache: "no-store" });
      const result = await readApiResponse(response);
      if (!response.ok || !result.success || !result.submission) throw new Error(result.message || "Unable to load submission.");
      setActiveLead(result.submission);
      if (lead.status === "UNREAD" && !lead.deletedAt) {
        setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status: "READ" } : item));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load submission.");
    }
  }

  function changeSection(next: "forms" | "leads") {
    setSection(next);
    setSelected([]);
    setSearch("");
    setTrash(false);
    setActiveTab("ALL");
  }

  function changeTrash(next: boolean) {
    setTrash(next);
    setActiveTab("ALL");
    setSelected([]);
    setSearch("");
  }

  const tabs: { id: FormTab; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "PUBLISHED", label: "Published" },
    { id: "DRAFT", label: "Draft" },
    { id: "ARCHIVED", label: "Archived" },
  ];

  /* ======================================================
     FORMS TABLE
  ====================================================== */

  const formsView = (
    <div className={styles.listCard}>
      <div className={styles.listToolbar}>
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button type="button" key={tab.id} className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`} onClick={() => { setActiveTab(tab.id); setSelected([]); }}>
              {tab.label} <span>({counts[tab.id]})</span>
            </button>
          ))}
          <button type="button" className={`${styles.tab} ${trash ? styles.tabActive : ""}`} onClick={() => changeTrash(true)}>Trash</button>
        </div>
        <label className={styles.searchBox}>
          <span className={styles.srOnly}>Search forms</span>
          <FileText size={15} />
          <input type="search" placeholder="Search forms..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>

      {selected.length > 0 && (
        <div className={styles.bulkBar}>
          <span>{selected.length} selected</span>
          {!trash ? (
            <>
              <button type="button" disabled={busy} onClick={() => operate("/api/admin/forms/bulk", selected, "PUBLISH")}>Publish</button>
              <button type="button" disabled={busy} onClick={() => operate("/api/admin/forms/bulk", selected, "DRAFT")}>Set draft</button>
              <button type="button" disabled={busy} onClick={() => operate("/api/admin/forms/bulk", selected, "ARCHIVE")}>Archive</button>
              {isAdmin && <button type="button" className={styles.dangerText} disabled={busy} onClick={() => operate("/api/admin/forms/bulk", selected, "TRASH")}>Move to Trash</button>}
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => operate("/api/admin/forms/bulk", selected, "RESTORE")}>Restore selected</button>
              {isAdmin && <button type="button" className={styles.dangerText} disabled={busy} onClick={() => operate("/api/admin/forms/bulk", selected, "PERMANENT_DELETE")}>Delete permanently</button>}
            </>
          )}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th className={styles.checkColumn}><input type="checkbox" aria-label="Select all forms" checked={filteredForms.length > 0 && filteredForms.every((form) => selected.includes(form.id))} onChange={(event) => setSelected(event.target.checked ? filteredForms.map((form) => form.id) : [])} /></th>
            <th>Form Title</th><th>Shortcode</th><th>Status</th><th>Leads</th><th>Last Updated</th>
          </tr></thead>
          <tbody>
            {filteredForms.map((form) => (
              <tr key={form.id} className={styles.formRow}>
                <td className={styles.checkColumn}><input type="checkbox" aria-label={`Select ${form.title}`} checked={selected.includes(form.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, form.id] : current.filter((id) => id !== form.id))} /></td>
                <td className={styles.titleCell}>
                  <strong>{form.title}</strong>
                  <div className={styles.rowActions}>
                    {!trash ? (
                      <>
                        <button type="button" onClick={() => startEdit(form)}><Pencil size={12} /> Edit</button><span>|</span>
                        <a href={`/forms/${encodeURIComponent(form.slug)}`} target="_blank" rel="noreferrer"><Eye size={13} /> View</a><span>|</span>
                        <button type="button" onClick={() => void copyShortcode(form)}>{copiedId === form.id ? <Check size={13} /> : <Copy size={13} />}{copiedId === form.id ? "Copied" : "Copy Shortcode"}</button><span>|</span>
                        <button type="button" onClick={() => operate(`/api/admin/forms/${form.id}`, [form.id], form.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")}>{form.status === "PUBLISHED" ? "Unpublish" : "Publish"}</button><span>|</span>
                        <button type="button" onClick={() => operate(`/api/admin/forms/${form.id}`, [form.id], form.status === "ARCHIVED" ? "DRAFT" : "ARCHIVED")}><Archive size={12} />{form.status === "ARCHIVED" ? "Unarchive" : "Archive"}</button>
                        {isAdmin && <><span>|</span><button type="button" className={styles.dangerText} onClick={() => operate(`/api/admin/forms/${form.id}`, [form.id], "TRASH")}><Trash2 size={12} /> Trash</button></>}
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => operate(`/api/admin/forms/${form.id}`, [form.id], "RESTORE")}><RotateCcw size={12} /> Restore</button>
                        {isAdmin && <><span>|</span><button type="button" className={styles.dangerText} onClick={() => operate("/api/admin/forms/bulk", [form.id], "PERMANENT_DELETE")}><Trash2 size={12} /> Delete permanently</button></>}
                      </>
                    )}
                  </div>
                  <div className={styles.formSlug}>/forms/{form.slug}</div>
                </td>
                <td className={styles.shortcodeCell}><code>{SHORTCODE(form.id)}</code><button type="button" aria-label="Copy shortcode" title="Copy shortcode" onClick={() => void copyShortcode(form)}>{copiedId === form.id ? <Check size={14} /> : <Copy size={14} />}</button></td>
                <td><span className={`${styles.statusBadge} ${form.status === "PUBLISHED" ? styles.published : form.status === "DRAFT" ? styles.draft : styles.archived}`}>{trash ? "TRASH" : form.status}</span></td>
                <td>{form._count?.submissions ?? 0}</td>
                <td className={styles.dateCell}>{new Date(form.updatedAt).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
            {!filteredForms.length && <tr><td colSpan={6} className={styles.emptyCell}>{search ? "No matching forms found." : trash ? "Trash is empty." : "No forms found."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ======================================================
     LEADS TABLE
  ====================================================== */

  const leadsView = (
    <div className={styles.listCard}>
      <div className={styles.listToolbar}>
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${!trash ? styles.tabActive : ""}`} onClick={() => changeTrash(false)}>Active Leads</button>
          <button type="button" className={`${styles.tab} ${trash ? styles.tabActive : ""}`} onClick={() => changeTrash(true)}>Trash</button>
        </div>
        <label className={styles.searchBox}><span className={styles.srOnly}>Search leads</span><FileText size={15} /><input type="search" placeholder="Search leads..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>

      {selected.length > 0 && (
        <div className={styles.bulkBar}>
          <span>{selected.length} selected</span>
          {!trash ? (
            <>
              <button type="button" disabled={busy} onClick={() => operate("/api/admin/forms/submissions/bulk", selected, "READ")}>Mark read</button>
              <button type="button" disabled={busy} onClick={() => operate("/api/admin/forms/submissions/bulk", selected, "SPAM")}>Mark spam</button>
              {isAdmin && <button type="button" className={styles.dangerText} disabled={busy} onClick={() => operate("/api/admin/forms/submissions/bulk", selected, "TRASH")}>Move to Trash</button>}
            </>
          ) : <button type="button" disabled={busy} onClick={() => operate("/api/admin/forms/submissions/bulk", selected, "RESTORE")}>Restore selected</button>}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th className={styles.checkColumn}><input type="checkbox" aria-label="Select all leads" checked={filteredLeads.length > 0 && filteredLeads.every((lead) => selected.includes(lead.id))} onChange={(event) => setSelected(event.target.checked ? filteredLeads.map((lead) => lead.id) : [])} /></th>
            <th>Form</th><th>Status</th><th>Received</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.id}>
                <td className={styles.checkColumn}><input type="checkbox" checked={selected.includes(lead.id)} aria-label={`Select lead ${lead.id}`} onChange={(event) => setSelected((current) => event.target.checked ? [...current, lead.id] : current.filter((id) => id !== lead.id))} /></td>
                <td className={styles.titleCell}><strong>{lead.form.title}</strong><div className={styles.formSlug}>ID: {lead.id.slice(-8)}</div></td>
                <td><span className={styles.statusBadge}>{lead.deletedAt ? "TRASH" : lead.status}</span></td>
                <td>{new Date(lead.createdAt).toLocaleString("en-GB")}</td>
                <td><div className={styles.leadActions}>
                  {!trash ? (
                    <>
                      <button type="button" onClick={() => void viewLead(lead)}><Eye size={13} /> View</button>
                      <button type="button" onClick={() => operate(`/api/admin/forms/submissions/${lead.id}`, [lead.id], lead.status === "SPAM" ? "UNREAD" : "SPAM")}>{lead.status === "SPAM" ? "Not spam" : "Spam"}</button>
                      {isAdmin && <button type="button" className={styles.dangerText} onClick={() => operate(`/api/admin/forms/submissions/${lead.id}`, [lead.id], "TRASH")}>Trash</button>}
                    </>
                  ) : <button type="button" onClick={() => operate(`/api/admin/forms/submissions/${lead.id}`, [lead.id], "RESTORE")}><RotateCcw size={13} /> Restore</button>}
                </div></td>
              </tr>
            ))}
            {!filteredLeads.length && <tr><td colSpan={5} className={styles.emptyCell}>No {trash ? "deleted " : ""}submissions found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ======================================================
     MAIN RENDER
  ====================================================== */

  const totalFields = rows.reduce((total, row) => total + row.columns.reduce((sum, column) => sum + column.fields.length, 0), 0);
  const emailFields = flattenRows(rows).filter((field) => field.type === "email");

  if (editing !== undefined) {
    const notification = builderSettings.notifications;
    const emailFieldOptions = emailFields.map((field) => (
      <option key={field.id} value={field.id}>{field.label || field.id}</option>
    ));

    return (
      <main className={styles.page}>
        <div className={styles.builderPageHeader}>
          <div className={styles.builderPageTitle}>
            <button type="button" className={styles.secondaryButton} onClick={() => setEditing(undefined)}>
              <ArrowLeft size={15} /> Back to Forms
            </button>
            <div>
              <h1>{editing ? "Edit Form" : "Create Form"}</h1>
              <p>Configure the form, layout, messages and email notifications.</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setEditing(undefined)}>Cancel</button>
            <button type="submit" form="form-builder-page" className={styles.primaryButton} disabled={busy}>
              <Check size={15} /> {busy ? "Saving..." : "Save Form"}
            </button>
          </div>
        </div>

        {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || notice}</p>}

        <form id="form-builder-page" onSubmit={saveForm} className={styles.builderPage}>
          <section className={styles.builderSection}>
            <div className={styles.builderSectionHeading}>
              <div><h2>Form Details</h2><p>Basic information shown on the public form.</p></div>
              <FileText size={20} />
            </div>
            <div className={styles.builderSettingsGrid}>
              <label className={styles.formLabel}>Form Title
                <input style={inputStyle} required value={title} onChange={(event) => {
                  setTitle(event.target.value);
                  if (!editing) setSlug(event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                }} />
              </label>
              <label className={styles.formLabel}>Public URL Slug
                <input style={inputStyle} required value={slug} onChange={(event) => setSlug(event.target.value)} />
              </label>
              <label className={`${styles.formLabel} ${styles.builderFullWidth}`}>Description
                <textarea style={{ ...inputStyle, minHeight: 80 }} value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <label className={styles.formLabel}>Status
                <select style={inputStyle} value={status} onChange={(event) => setStatus(event.target.value as FormStatus)}>
                  <option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option>
                </select>
              </label>
            </div>
          </section>

          <section className={styles.builderSection}>
            <div className={styles.builderSectionHeading}>
              <div><h2><MessageSquareText size={19} /> Submit &amp; Message Settings</h2><p>Customize the submit button and messages displayed to visitors.</p></div>
            </div>
            <div className={styles.builderSettingsGrid}>
              <label className={styles.formLabel}>Submit Button Text
                <input style={inputStyle} maxLength={60} value={builderSettings.submitButtonText} onChange={(event) => updateBuilderMessages({ submitButtonText: event.target.value })} placeholder="Submit" />
              </label>
              <label className={`${styles.formLabel} ${styles.builderFullWidth}`}>Success Message
                <textarea style={{ ...inputStyle, minHeight: 75 }} maxLength={1000} value={builderSettings.successMessage} onChange={(event) => updateBuilderMessages({ successMessage: event.target.value })} placeholder="Thank you. Your response has been received." />
              </label>
              <label className={`${styles.formLabel} ${styles.builderFullWidth}`}>Error Message
                <textarea style={{ ...inputStyle, minHeight: 75 }} maxLength={1000} value={builderSettings.errorMessage} onChange={(event) => updateBuilderMessages({ errorMessage: event.target.value })} placeholder="Unable to submit the form. Please try again." />
              </label>
            </div>
          </section>

          <section className={styles.builderSection}>
            <div className={styles.builderSectionHeading}>
              <div><h2><Mail size={19} /> Email Notifications</h2><p>Send form submissions to fixed email addresses or an email address entered by the visitor.</p></div>
            </div>
            <label className={styles.builderToggle}>
              <input type="checkbox" checked={notification.enabled} onChange={(event) => updateNotificationSettings({ enabled: event.target.checked })} />
              <span><strong>Enable email notifications</strong><small>Emails are sent by the server when the submission API is configured.</small></span>
            </label>
            {notification.enabled && (
              <>
                <div className={styles.builderSettingsGrid}>
                  <label className={styles.formLabel}>From Email (verified sender)
                    <input type="email" style={inputStyle} value={notification.fromEmail} onChange={(event) => updateNotificationSettings({ fromEmail: event.target.value })} placeholder="forms@yourdomain.com" />
                  </label>
                  <label className={styles.formLabel}>To: Recipient Type
                    <select style={inputStyle} value={notification.toMode} onChange={(event) => updateNotificationSettings({ toMode: event.target.value as EmailSourceMode })}>
                      <option value="static">Static email address(es)</option><option value="dynamic">Dynamic email field</option>
                    </select>
                  </label>
                  {notification.toMode === "static" ? (
                    <label className={`${styles.formLabel} ${styles.builderFullWidth}`}>To Email Address(es)
                      <input type="text" style={inputStyle} value={notification.toEmails} onChange={(event) => updateNotificationSettings({ toEmails: event.target.value })} placeholder="sales@company.com, leads@company.com" />
                      <small className={styles.builderFieldHelp}>Separate multiple addresses with commas.</small>
                    </label>
                  ) : (
                    <label className={styles.formLabel}>To: Select Email Field
                      <select style={inputStyle} value={notification.toFieldId} onChange={(event) => updateNotificationSettings({ toFieldId: event.target.value })}>
                        <option value="">Select an Email field</option>{emailFieldOptions}
                      </select>
                    </label>
                  )}
                  <label className={styles.formLabel}>CC: Recipient Type
                    <select style={inputStyle} value={notification.ccMode} onChange={(event) => updateNotificationSettings({ ccMode: event.target.value as EmailSourceMode })}>
                      <option value="static">Static email address(es)</option><option value="dynamic">Dynamic email field</option>
                    </select>
                  </label>
                  {notification.ccMode === "static" ? (
                    <label className={`${styles.formLabel} ${styles.builderFullWidth}`}>CC Email Address(es)
                      <input type="text" style={inputStyle} value={notification.ccEmails} onChange={(event) => updateNotificationSettings({ ccEmails: event.target.value })} placeholder="manager@company.com, team@company.com" />
                      <small className={styles.builderFieldHelp}>Separate multiple addresses with commas.</small>
                    </label>
                  ) : (
                    <label className={styles.formLabel}>CC: Select Email Field
                      <select style={inputStyle} value={notification.ccFieldId} onChange={(event) => updateNotificationSettings({ ccFieldId: event.target.value })}>
                        <option value="">Select an Email field</option>{emailFieldOptions}
                      </select>
                    </label>
                  )}
                  <label className={styles.formLabel}>Reply-To (dynamic)
                    <select style={inputStyle} value={notification.replyToFieldId} onChange={(event) => updateNotificationSettings({ replyToFieldId: event.target.value })}>
                      <option value="">Use the default sender</option>{emailFieldOptions}
                    </select>
                    <small className={styles.builderFieldHelp}>The sender stays your verified mailbox; replies can go to the visitor's email.</small>
                  </label>
                </div>
                <div className={styles.builderHelpBox}>
                  <strong>Important:</strong> From Email should be an address verified with your SMTP/email provider. Dynamic visitor email is used as To, CC or Reply-To—not as an unverified sender—to avoid spoofing and delivery problems.
                </div>
              </>
            )}
          </section>

          <section className={styles.builderSection}>
            <div className={styles.builderSectionHeading}>
              <div><h2><Rows3 size={19} /> Form Layout</h2><p>{rows.length} row(s) · {totalFields} input field(s)</p></div>
              <button type="button" className={styles.secondaryButton} onClick={addRow}><Plus size={14} /> Add Row</button>
            </div>
            <div className={styles.layoutHelp}>
              <strong>How it works:</strong> Add a Row, create Columns inside that row, then add input fields inside each column. Drag the row, column or field handle to reorder it. Drag a field into another column to move it there.
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rows.map((row) => `row:${row.id}`)} strategy={verticalListSortingStrategy}>
                <div className={styles.layoutRows}>
                  {rows.map((row, index) => (
                    <SortableRow
                      key={row.id}
                      row={row}
                      rowIndex={index}
                      updateField={updateField}
                      removeField={removeField}
                      duplicateField={duplicateField}
                      addField={addField}
                      addColumn={addColumn}
                      removeRow={removeRow}
                      duplicateRow={duplicateRow}
                      removeColumn={removeColumn}
                      duplicateColumn={duplicateColumn}
                      changeWidth={changeWidth}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className={styles.builderBottomActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setEditing(undefined)}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={busy}><Check size={15} /> {busy ? "Saving..." : "Save Form"}</button>
            </div>
          </section>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><h1>Forms &amp; Leads</h1><p>Create public forms and manage their submissions.</p></div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void load()}><RefreshCw size={14} /> Refresh</button>
          {section === "forms" && !trash && <button type="button" className={styles.primaryButton} onClick={startCreate}><Plus size={15} /> New Form</button>}
        </div>
      </header>

      {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || notice}</p>}
      {busy && <p className={styles.muted} aria-live="polite">Saving changes...</p>}

      <nav className={styles.sectionTabs}>
        <button type="button" className={section === "forms" ? styles.sectionActive : ""} onClick={() => changeSection("forms")}>Forms</button>
        <button type="button" className={section === "leads" ? styles.sectionActive : ""} onClick={() => changeSection("leads")}>Leads</button>
      </nav>

      {loading ? <p className={styles.muted} role="status">Loading forms and submissions...</p> : section === "forms" ? formsView : leadsView}

      {/* LEAD DETAILS */}
      {activeLead && (
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveLead(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="lead-title" className={styles.leadDialog}>
            <div className={styles.editorHeader}>
              <h2 id="lead-title">{activeLead.form.title} Response</h2>
              <button type="button" aria-label="Close" onClick={() => setActiveLead(null)}><X size={19} /></button>
            </div>
            <p className={styles.muted}>{new Date(activeLead.createdAt).toLocaleString()} · {activeLead.status}</p>
            {(() => {
              const data = activeLead.data && typeof activeLead.data === "object" && !Array.isArray(activeLead.data)
                ? activeLead.data as Record<string, unknown>
                : {};
              const uploads = Array.isArray(data._files) ? data._files as Array<{ fieldId?: string; url?: string; name?: string; size?: number }> : [];
              const formFields = Array.isArray(activeLead.form.fields) ? activeLead.form.fields as Array<{ id?: string; label?: string }> : [];
              return <>
                {Object.entries(data).filter(([key]) => key !== "_files").map(([key, value]) => (
                  <div key={key} className={styles.leadValue}>
                    <strong>{formFields.find((field) => field.id === key)?.label ?? key}</strong>
                    <span>{Array.isArray(value) ? value.join(", ") : String(value ?? "—")}</span>
                  </div>
                ))}
                {uploads.map((file, index) => (
                  <p key={`${file.name}-${index}`}><a href={file.url} target="_blank" rel="noreferrer" download>
                    Download {file.name ?? "attachment"} ({Math.ceil((file.size ?? 0) / 1024)} KB)
                  </a></p>
                ))}
              </>;
            })()}
            <div className={styles.editorFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setActiveLead(null)}>Close</button>
              <button type="button" className={styles.primaryButton} onClick={() => operate(`/api/admin/forms/submissions/${activeLead.id}`, [activeLead.id], "SPAM")}>Mark Spam</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
