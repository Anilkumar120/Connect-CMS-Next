export type FormField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export const FORM_FIELD_TYPES = [
  "text",
  "name",
  "number",
  "telephone",
  "signature",
  "dropdown",
  "multi-select",
  "checkbox",
  "radio",
  "multiple-choice",
  "image",
  "file",
] as const;

export function getFormFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (field): field is FormField =>
      Boolean(field) &&
      typeof field === "object" &&
      typeof field.id === "string" &&
      typeof field.label === "string" &&
      typeof field.type === "string" &&
      FORM_FIELD_TYPES.includes(field.type as (typeof FORM_FIELD_TYPES)[number])
  );
}

export function normalizeFormSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}
