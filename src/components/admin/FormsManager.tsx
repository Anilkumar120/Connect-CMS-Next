
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
} from "lucide-react";

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
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
  submissions?: Lead[];
  submission?: Lead;
  count?: number;
};

type FieldDraft = FormField & {
  optionsText: string;
};

type FormTab = "ALL" | "PUBLISHED" | "DRAFT" | "ARCHIVED";

const SHORTCODE = (id: string) => `[connect_form id="${id}"]`;

const OPTION_FIELD_TYPES = [
  "dropdown",
  "multi-select",
  "radio",
  "multiple-choice",
];

const RANGE_FIELD_TYPES = ["number", "rating", "scale"];

const PLACEHOLDER_FIELD_TYPES = [
  "text",
  "paragraph",
  "name",
  "email",
  "number",
  "telephone",
  "url",
  "dropdown",
  "multi-select",
  "address",
  "city",
  "state",
  "country",
  "postal-code",
  "signature",
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #ccd5e0",
  borderRadius: 6,
  padding: "9px 10px",
  font: "inherit",
  fontSize: 14,
  boxSizing: "border-box",
};

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

async function readApiResponse(response: Response): Promise<ApiResult> {
  const text = await response.text();

  try {
    return JSON.parse(text) as ApiResult;
  } catch {
    throw new Error(
      `Server returned an invalid response (${response.status}).`
    );
  }
}

/* ======================================================
   SORTABLE FIELD
====================================================== */

type SortableFieldProps = {
  field: FieldDraft;
  index: number;
  updateField: (index: number, patch: Partial<FieldDraft>) => void;
  removeField: (index: number) => void;
};

function SortableField({
  field,
  index,
  updateField,
  removeField,
}: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
  });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : 1,
    background: isDragging ? "#f0f6ff" : undefined,
    border: isDragging ? "2px dashed #3984e8" : undefined,
  };

  return (
    <fieldset
      ref={setNodeRef}
      className={styles.fieldEditor}
      style={sortableStyle}
    >
      <div className={styles.fieldGrid}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            minWidth: 0,
          }}
        >
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag to reorder ${field.label || "field"}`}
            title="Drag to reorder field"
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
            onChange={(event) =>
              updateField(index, { label: event.target.value })
            }
          />
        </div>

        <select
          aria-label="Field type"
          style={inputStyle}
          value={field.type}
          onChange={(event) =>
            updateField(index, { type: event.target.value })
          }
        >
          {FORM_FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={styles.removeField}
          aria-label="Remove field"
          onClick={() => removeField(index)}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className={styles.fieldOptions}>
        <label>
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(event) =>
              updateField(index, {
                required: event.target.checked,
              })
            }
          />
          Required
        </label>

        {PLACEHOLDER_FIELD_TYPES.includes(field.type) && (
          <input
            style={inputStyle}
            placeholder="Placeholder"
            value={field.placeholder ?? ""}
            onChange={(event) =>
              updateField(index, {
                placeholder: event.target.value,
              })
            }
          />
        )}
      </div>

      {OPTION_FIELD_TYPES.includes(field.type) && (
        <div style={{ marginTop: 12 }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: "#344054",
            }}
          >
            Field Options
          </label>

          <textarea
            aria-label="Options"
            style={{ ...inputStyle, minHeight: 85 }}
            placeholder={
              "Enter one option per line\nOption one\nOption two\nOption three"
            }
            value={field.optionsText}
            onChange={(event) =>
              updateField(index, {
                optionsText: event.target.value,
              })
            }
          />

          <small style={{ color: "#667085" }}>
            Enter each option on a separate line.
          </small>
        </div>
      )}

      {RANGE_FIELD_TYPES.includes(field.type) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#344054",
            }}
          >
            Minimum Value
            <input
              type="number"
              style={{ ...inputStyle, marginTop: 6 }}
              placeholder="Minimum"
              value={field.min ?? ""}
              onChange={(event) =>
                updateField(index, {
                  min:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
            />
          </label>

          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#344054",
            }}
          >
            Maximum Value
            <input
              type="number"
              style={{ ...inputStyle, marginTop: 6 }}
              placeholder="Maximum"
              value={field.max ?? ""}
              onChange={(event) =>
                updateField(index, {
                  max:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
            />
          </label>
        </div>
      )}

      {field.type === "html" && (
        <div style={{ marginTop: 12 }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: "#344054",
            }}
          >
            HTML Content
          </label>

          <textarea
            aria-label="HTML content"
            style={{
              ...inputStyle,
              minHeight: 150,
              fontFamily: "monospace",
              fontSize: 13,
            }}
            placeholder="<div>Your HTML content here</div>"
            value={field.content ?? ""}
            onChange={(event) =>
              updateField(index, {
                content: event.target.value,
              })
            }
          />

          <small style={{ color: "#667085" }}>
            HTML content will be stored with this field. Sanitize
            HTML before rendering it on the public website.
          </small>
        </div>
      )}
    </fieldset>
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

  const [editing, setEditing] = useState<FormRecord | null | undefined>(
    undefined
  );

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<FormStatus>("DRAFT");
  const [fields, setFields] = useState<FieldDraft[]>([]);

  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [formResponse, leadResponse] = await Promise.all([
        fetch(`/api/admin/forms${trash ? "?trash=1" : ""}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin/forms/submissions${trash ? "?trash=1" : ""}`, {
          cache: "no-store",
        }),
      ]);

      const [formData, leadData] = await Promise.all([
        readApiResponse(formResponse),
        readApiResponse(leadResponse),
      ]);

      if (!formResponse.ok || !formData.success) {
        throw new Error(formData.message || "Unable to load forms.");
      }

      if (!leadResponse.ok || !leadData.success) {
        throw new Error(
          leadData.message || "Unable to load submissions."
        );
      }

      setForms(formData.forms ?? []);
      setLeads(leadData.submissions ?? []);
      setSelected([]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Forms & Leads."
      );
    } finally {
      setLoading(false);
    }
  }, [trash]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const counts = useMemo(
    () => ({
      ALL: forms.length,
      PUBLISHED: forms.filter((form) => form.status === "PUBLISHED").length,
      DRAFT: forms.filter((form) => form.status === "DRAFT").length,
      ARCHIVED: forms.filter((form) => form.status === "ARCHIVED").length,
    }),
    [forms]
  );

  const filteredForms = useMemo(() => {
    const query = search.trim().toLowerCase();

    return forms.filter((form) => {
      const matchesTab =
        activeTab === "ALL" || form.status === activeTab;

      const matchesSearch =
        !query ||
        form.title.toLowerCase().includes(query) ||
        form.slug.toLowerCase().includes(query) ||
        form.id.toLowerCase().includes(query);

      return matchesTab && matchesSearch;
    });
  }, [forms, activeTab, search]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      return (
        !query ||
        lead.form.title.toLowerCase().includes(query) ||
        lead.id.toLowerCase().includes(query)
      );
    });
  }, [leads, search]);

  async function request(
    url: string,
    method: string,
    body?: unknown
  ): Promise<ApiResult> {
    const response = await fetch(url, {
      method,
      headers: body
        ? { "Content-Type": "application/json" }
        : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = await readApiResponse(response);

    if (!response.ok || !result.success) {
      throw new Error(result.message || "The operation failed.");
    }

    return result;
  }

  function startCreate() {
    setEditing(null);
    setTitle("");
    setSlug("");
    setDescription("");
    setStatus("DRAFT");
    setFields([]);
    setError("");
    setNotice("");
  }

  function startEdit(form: FormRecord) {
    setEditing(form);
    setTitle(form.title);
    setSlug(form.slug);
    setDescription(form.description ?? "");
    setStatus(form.status);
    setFields(toFieldDrafts(form.fields));
    setError("");
    setNotice("");
  }

  async function saveForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        title,
        slug,
        description,
        status,

        // Array order is the saved field order.
        fields: fields.map(({ optionsText, ...field }) => ({
          ...field,
          options: optionsText
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        })),
      };

      await request(
        editing
          ? `/api/admin/forms/${editing.id}`
          : "/api/admin/forms",
        editing ? "PATCH" : "POST",
        payload
      );

      setEditing(undefined);
      setNotice("Form saved successfully.");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save form."
      );
    } finally {
      setBusy(false);
    }
  }

  /* ======================================================
     DRAG AND DROP
  ====================================================== */

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setFields((current) => {
      const oldIndex = current.findIndex(
        (field) => field.id === String(active.id)
      );

      const newIndex = current.findIndex(
        (field) => field.id === String(over.id)
      );

      if (oldIndex < 0 || newIndex < 0) return current;

      return arrayMove(current, oldIndex, newIndex);
    });
  }

  function operate(
    url: string,
    ids: string[],
    action: string
  ) {
    if (!ids.length || busy) return;

    if (
      action === "PERMANENT_DELETE" &&
      !window.confirm(
        `Permanently delete ${ids.length} selected item(s)? This cannot be undone.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    void (async () => {
      try {
        if (url.endsWith("/bulk")) {
          await request(url, "POST", { ids, action });
        } else {
          const isFormStatusUpdate =
            !url.includes("/submissions/") &&
            !["TRASH", "RESTORE"].includes(action);

          await request(
            url,
            "PATCH",
            isFormStatusUpdate ? { status: action } : { action }
          );
        }

        setNotice("Changes saved successfully.");
        setSelected([]);
        setActiveLead(null);
        await load();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to save changes."
        );
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
      const response = await fetch(
        `/api/admin/forms/submissions/${lead.id}`,
        { cache: "no-store" }
      );

      const result = await readApiResponse(response);

      if (!response.ok || !result.success || !result.submission) {
        throw new Error(
          result.message || "Unable to load submission."
        );
      }

      setActiveLead(result.submission);

      if (lead.status === "UNREAD" && !lead.deletedAt) {
        setLeads((current) =>
          current.map((item) =>
            item.id === lead.id
              ? { ...item, status: "READ" }
              : item
          )
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load submission."
      );
    }
  }

  function addField() {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `field_${crypto.randomUUID()}`
        : `field_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    setFields((current) => [
      ...current,
      {
        id,
        label: "New field",
        type: "text",
        required: false,
        placeholder: "",
        options: [],
        optionsText: "",
        min: undefined,
        max: undefined,
        content: "",
      },
    ]);
  }

  function updateField(index: number, patch: Partial<FieldDraft>) {
    setFields((current) =>
      current.map((field, position) =>
        position === index ? { ...field, ...patch } : field
      )
    );
  }

  function removeField(index: number) {
    setFields((current) =>
      current.filter((_, position) => position !== index)
    );
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
            <button
              type="button"
              key={tab.id}
              className={`${styles.tab} ${
                activeTab === tab.id ? styles.tabActive : ""
              }`}
              onClick={() => {
                setActiveTab(tab.id);
                setSelected([]);
              }}
            >
              {tab.label} <span>({counts[tab.id]})</span>
            </button>
          ))}

          <button
            type="button"
            className={`${styles.tab} ${
              trash ? styles.tabActive : ""
            }`}
            onClick={() => changeTrash(true)}
          >
            Trash
          </button>
        </div>

        <label className={styles.searchBox}>
          <span className={styles.srOnly}>Search forms</span>
          <FileText size={15} />
          <input
            type="search"
            placeholder="Search forms..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {selected.length > 0 && (
        <div className={styles.bulkBar}>
          <span>{selected.length} selected</span>

          {!trash ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  operate("/api/admin/forms/bulk", selected, "PUBLISH")
                }
              >
                Publish
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  operate("/api/admin/forms/bulk", selected, "DRAFT")
                }
              >
                Set draft
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  operate("/api/admin/forms/bulk", selected, "ARCHIVE")
                }
              >
                Archive
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className={styles.dangerText}
                  disabled={busy}
                  onClick={() =>
                    operate("/api/admin/forms/bulk", selected, "TRASH")
                  }
                >
                  Move to Trash
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  operate("/api/admin/forms/bulk", selected, "RESTORE")
                }
              >
                Restore selected
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className={styles.dangerText}
                  disabled={busy}
                  onClick={() =>
                    operate(
                      "/api/admin/forms/bulk",
                      selected,
                      "PERMANENT_DELETE"
                    )
                  }
                >
                  Delete permanently
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkColumn}>
                <input
                  type="checkbox"
                  aria-label="Select all forms"
                  checked={
                    filteredForms.length > 0 &&
                    filteredForms.every((form) =>
                      selected.includes(form.id)
                    )
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? filteredForms.map((form) => form.id)
                        : []
                    )
                  }
                />
              </th>
              <th>Form Title</th>
              <th>Shortcode</th>
              <th>Status</th>
              <th>Leads</th>
              <th>Last Updated</th>
            </tr>
          </thead>

          <tbody>
            {filteredForms.map((form) => (
              <tr key={form.id} className={styles.formRow}>
                <td className={styles.checkColumn}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${form.title}`}
                    checked={selected.includes(form.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, form.id]
                          : current.filter((id) => id !== form.id)
                      )
                    }
                  />
                </td>

                <td className={styles.titleCell}>
                  <strong>{form.title}</strong>

                  <div className={styles.rowActions}>
                    {!trash ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(form)}
                        >
                          <Pencil size={12} /> Edit
                        </button>

                        <span>|</span>

                        <a
                          href={`/forms/${encodeURIComponent(form.slug)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Eye size={13} /> View
                        </a>

                        <span>|</span>

                        <button
                          type="button"
                          onClick={() => void copyShortcode(form)}
                        >
                          {copiedId === form.id ? (
                            <Check size={13} />
                          ) : (
                            <Copy size={13} />
                          )}
                          {copiedId === form.id ? "Copied" : "Copy Shortcode"}
                        </button>

                        <span>|</span>

                        <button
                          type="button"
                          onClick={() =>
                            operate(
                              `/api/admin/forms/${form.id}`,
                              [form.id],
                              form.status === "PUBLISHED"
                                ? "DRAFT"
                                : "PUBLISHED"
                            )
                          }
                        >
                          {form.status === "PUBLISHED"
                            ? "Unpublish"
                            : "Publish"}
                        </button>

                        <span>|</span>

                        <button
                          type="button"
                          onClick={() =>
                            operate(
                              `/api/admin/forms/${form.id}`,
                              [form.id],
                              form.status === "ARCHIVED"
                                ? "DRAFT"
                                : "ARCHIVED"
                            )
                          }
                        >
                          <Archive size={12} />
                          {form.status === "ARCHIVED"
                            ? "Unarchive"
                            : "Archive"}
                        </button>

                        {isAdmin && (
                          <>
                            <span>|</span>
                            <button
                              type="button"
                              className={styles.dangerText}
                              onClick={() =>
                                operate(
                                  `/api/admin/forms/${form.id}`,
                                  [form.id],
                                  "TRASH"
                                )
                              }
                            >
                              <Trash2 size={12} /> Trash
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            operate(
                              `/api/admin/forms/${form.id}`,
                              [form.id],
                              "RESTORE"
                            )
                          }
                        >
                          <RotateCcw size={12} /> Restore
                        </button>

                        {isAdmin && (
                          <>
                            <span>|</span>
                            <button
                              type="button"
                              className={styles.dangerText}
                              onClick={() =>
                                operate(
                                  "/api/admin/forms/bulk",
                                  [form.id],
                                  "PERMANENT_DELETE"
                                )
                              }
                            >
                              <Trash2 size={12} /> Delete permanently
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div className={styles.formSlug}>
                    /forms/{form.slug}
                  </div>
                </td>

                <td className={styles.shortcodeCell}>
                  <code>{SHORTCODE(form.id)}</code>
                  <button
                    type="button"
                    aria-label="Copy shortcode"
                    title="Copy shortcode"
                    onClick={() => void copyShortcode(form)}
                  >
                    {copiedId === form.id ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </td>

                <td>
                  <span
                    className={`${styles.statusBadge} ${
                      form.status === "PUBLISHED"
                        ? styles.published
                        : form.status === "DRAFT"
                          ? styles.draft
                          : styles.archived
                    }`}
                  >
                    {trash ? "TRASH" : form.status}
                  </span>
                </td>

                <td>{form._count?.submissions ?? 0}</td>

                <td className={styles.dateCell}>
                  {new Date(form.updatedAt).toLocaleDateString("en-GB")}
                </td>
              </tr>
            ))}

            {!filteredForms.length && (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  {search
                    ? "No matching forms found."
                    : trash
                      ? "Trash is empty."
                      : "No forms found."}
                </td>
              </tr>
            )}
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
          <button
            type="button"
            className={`${styles.tab} ${
              !trash ? styles.tabActive : ""
            }`}
            onClick={() => changeTrash(false)}
          >
            Active Leads
          </button>

          <button
            type="button"
            className={`${styles.tab} ${
              trash ? styles.tabActive : ""
            }`}
            onClick={() => changeTrash(true)}
          >
            Trash
          </button>
        </div>

        <label className={styles.searchBox}>
          <span className={styles.srOnly}>Search leads</span>
          <FileText size={15} />
          <input
            type="search"
            placeholder="Search leads..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {selected.length > 0 && (
        <div className={styles.bulkBar}>
          <span>{selected.length} selected</span>

          {!trash ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  operate(
                    "/api/admin/forms/submissions/bulk",
                    selected,
                    "READ"
                  )
                }
              >
                Mark read
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  operate(
                    "/api/admin/forms/submissions/bulk",
                    selected,
                    "SPAM"
                  )
                }
              >
                Mark spam
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className={styles.dangerText}
                  disabled={busy}
                  onClick={() =>
                    operate(
                      "/api/admin/forms/submissions/bulk",
                      selected,
                      "TRASH"
                    )
                  }
                >
                  Move to Trash
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                operate(
                  "/api/admin/forms/submissions/bulk",
                  selected,
                  "RESTORE"
                )
              }
            >
              Restore selected
            </button>
          )}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkColumn}>
                <input
                  type="checkbox"
                  aria-label="Select all leads"
                  checked={
                    filteredLeads.length > 0 &&
                    filteredLeads.every((lead) =>
                      selected.includes(lead.id)
                    )
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? filteredLeads.map((lead) => lead.id)
                        : []
                    )
                  }
                />
              </th>
              <th>Form</th>
              <th>Status</th>
              <th>Received</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.id}>
                <td className={styles.checkColumn}>
                  <input
                    type="checkbox"
                    checked={selected.includes(lead.id)}
                    aria-label={`Select lead ${lead.id}`}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, lead.id]
                          : current.filter((id) => id !== lead.id)
                      )
                    }
                  />
                </td>

                <td className={styles.titleCell}>
                  <strong>{lead.form.title}</strong>
                  <div className={styles.formSlug}>
                    ID: {lead.id.slice(-8)}
                  </div>
                </td>

                <td>
                  <span className={styles.statusBadge}>
                    {lead.deletedAt ? "TRASH" : lead.status}
                  </span>
                </td>

                <td>
                  {new Date(lead.createdAt).toLocaleString("en-GB")}
                </td>

                <td>
                  <div className={styles.leadActions}>
                    {!trash ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void viewLead(lead)}
                        >
                          <Eye size={13} /> View
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            operate(
                              `/api/admin/forms/submissions/${lead.id}`,
                              [lead.id],
                              lead.status === "SPAM" ? "UNREAD" : "SPAM"
                            )
                          }
                        >
                          {lead.status === "SPAM" ? "Not spam" : "Spam"}
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            className={styles.dangerText}
                            onClick={() =>
                              operate(
                                `/api/admin/forms/submissions/${lead.id}`,
                                [lead.id],
                                "TRASH"
                              )
                            }
                          >
                            Trash
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          operate(
                            `/api/admin/forms/submissions/${lead.id}`,
                            [lead.id],
                            "RESTORE"
                          )
                        }
                      >
                        <RotateCcw size={13} /> Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {!filteredLeads.length && (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  No {trash ? "deleted " : ""}submissions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ======================================================
     MAIN RENDER
  ====================================================== */

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Forms &amp; Leads</h1>
          <p>Create public forms and manage their submissions.</p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={busy}
            onClick={() => void load()}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          {section === "forms" && !trash && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={startCreate}
            >
              <Plus size={15} /> New Form
            </button>
          )}
        </div>
      </header>

      {(error || notice) && (
        <p
          className={error ? styles.error : styles.notice}
          role={error ? "alert" : "status"}
        >
          {error || notice}
        </p>
      )}

      {busy && (
        <p className={styles.muted} aria-live="polite">
          Saving changes...
        </p>
      )}

      <nav className={styles.sectionTabs}>
        <button
          type="button"
          className={section === "forms" ? styles.sectionActive : ""}
          onClick={() => changeSection("forms")}
        >
          Forms
        </button>

        <button
          type="button"
          className={section === "leads" ? styles.sectionActive : ""}
          onClick={() => changeSection("leads")}
        >
          Leads
        </button>
      </nav>

      {loading ? (
        <p className={styles.muted} role="status">
          Loading forms and submissions...
        </p>
      ) : section === "forms" ? (
        formsView
      ) : (
        leadsView
      )}

      {/* FORM EDITOR */}

      {editing !== undefined && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditing(undefined);
            }
          }}
        >
          <form onSubmit={saveForm} className={styles.editor}>
            <div className={styles.editorHeader}>
              <h2>{editing ? "Edit Form" : "Create Form"}</h2>
              <button
                type="button"
                aria-label="Close editor"
                onClick={() => setEditing(undefined)}
              >
                <X size={19} />
              </button>
            </div>

            <label className={styles.formLabel}>
              Title
              <input
                style={inputStyle}
                required
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);

                  if (!editing) {
                    setSlug(
                      event.target.value
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                    );
                  }
                }}
              />
            </label>

            <label className={styles.formLabel}>
              Public URL slug
              <input
                style={inputStyle}
                required
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </label>

            <label className={styles.formLabel}>
              Description
              <textarea
                style={{ ...inputStyle, minHeight: 75 }}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <label className={styles.formLabel}>
              Status
              <select
                style={inputStyle}
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as FormStatus)
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>

            <div className={styles.fieldsHeading}>
              <h3>Form Fields</h3>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={addField}
              >
                <Plus size={14} /> Add Field
              </button>
            </div>

            <p
              style={{
                fontSize: 12,
                color: "#667085",
                margin: "0 0 12px",
              }}
            >
              <GripVertical
                size={14}
                style={{
                  display: "inline-block",
                  verticalAlign: "middle",
                }}
              />{" "}
              Drag fields using the handle to change their order.
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map((field) => field.id)}
                strategy={verticalListSortingStrategy}
              >
                {fields.map((field, index) => (
                  <SortableField
                    key={field.id}
                    field={field}
                    index={index}
                    updateField={updateField}
                    removeField={removeField}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {!fields.length && (
              <p className={styles.muted}>
                Add fields to build your form.
              </p>
            )}

            <div className={styles.editorFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setEditing(undefined)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={styles.primaryButton}
                disabled={busy}
              >
                {busy ? "Saving..." : "Save Form"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LEAD DETAILS */}

      {activeLead && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveLead(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-title"
            className={styles.leadDialog}
          >
            <div className={styles.editorHeader}>
              <h2 id="lead-title">
                {activeLead.form.title} Response
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setActiveLead(null)}
              >
                <X size={19} />
              </button>
            </div>

            <p className={styles.muted}>
              {new Date(activeLead.createdAt).toLocaleString()} ·{" "}
              {activeLead.status}
            </p>

            {(() => {
              const data =
                activeLead.data &&
                typeof activeLead.data === "object" &&
                !Array.isArray(activeLead.data)
                  ? (activeLead.data as Record<string, unknown>)
                  : {};

              const uploads = Array.isArray(data._files)
                ? (data._files as Array<{
                    fieldId?: string;
                    url?: string;
                    name?: string;
                    size?: number;
                  }>)
                : [];

              const formFields = Array.isArray(activeLead.form.fields)
                ? (activeLead.form.fields as Array<{
                    id?: string;
                    label?: string;
                  }>)
                : [];

              return (
                <>
                  {Object.entries(data)
                    .filter(([key]) => key !== "_files")
                    .map(([key, value]) => (
                      <div key={key} className={styles.leadValue}>
                        <strong>
                          {formFields.find((field) => field.id === key)
                            ?.label ?? key}
                        </strong>
                        <span>
                          {Array.isArray(value)
                            ? value.join(", ")
                            : String(value ?? "—")}
                        </span>
                      </div>
                    ))}

                  {uploads.map((file, index) => (
                    <p key={`${file.name}-${index}`}>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        download
                      >
                        Download {file.name ?? "attachment"} (
                        {Math.ceil((file.size ?? 0) / 1024)} KB)
                      </a>
                    </p>
                  ))}
                </>
              );
            })()}

            <div className={styles.editorFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setActiveLead(null)}
              >
                Close
              </button>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={() =>
                  operate(
                    `/api/admin/forms/submissions/${activeLead.id}`,
                    [activeLead.id],
                    "SPAM"
                  )
                }
              >
                Mark Spam
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
