
export type FormField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];

  // Additional field settings
  min?: number;
  max?: number;
  content?: string;
};

export const FORM_FIELD_TYPES = [
  // Basic fields
  "text",
  "paragraph",
  "name",
  "email",
  "number",
  "telephone",
  "url",

  // Selection fields
  "dropdown",
  "multi-select",
  "checkbox",
  "radio",
  "multiple-choice",

  // Date and time
  "date",
  "time",
  "datetime",

  // Upload and media
  "image",
  "file",
  "signature",

  // Address fields
  "address",
  "city",
  "state",
  "country",
  "postal-code",

  // Advanced fields
  "hidden",
  "html",
  "divider",
  "section",
  "page-break",

  // Consent and rating
  "consent",
  "rating",
  "scale",
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const NON_INPUT_FIELD_TYPES = [
  "html",
  "divider",
  "section",
  "page-break",
] as const;

export function isNonInputField(type: string): boolean {
  return (NON_INPUT_FIELD_TYPES as readonly string[]).includes(type);
}

export function getFormFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((field): field is Record<string, unknown> => {
      if (!field || typeof field !== "object" || Array.isArray(field)) {
        return false;
      }

      const item = field as Record<string, unknown>;

      return (
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.type === "string" &&
        FORM_FIELD_TYPES.includes(item.type as FormFieldType)
      );
    })
    .map((field) => ({
      id: field.id as string,
      label: field.label as string,
      type: field.type as string,
      required:
        typeof field.required === "boolean"
          ? field.required
          : false,
      placeholder:
        typeof field.placeholder === "string"
          ? field.placeholder
          : "",
      options: Array.isArray(field.options)
        ? field.options.filter(
            (option): option is string =>
              typeof option === "string"
          )
        : [],
      min:
        typeof field.min === "number" &&
        Number.isFinite(field.min)
          ? field.min
          : undefined,
      max:
        typeof field.max === "number" &&
        Number.isFinite(field.max)
          ? field.max
          : undefined,
      content:
        typeof field.content === "string"
          ? field.content
          : "",
    }));
}

export function normalizeFormSlug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}
