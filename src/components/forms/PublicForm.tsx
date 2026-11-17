
"use client";

import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import type { FormField } from "@/lib/forms";

type Props = {
  title: string;
  description: string;
  fields: FormField[];
  styles: unknown;
  slug: string;
};

type FormValues = Record<string, unknown>;

const STRUCTURAL_FIELDS = [
  "html",
  "divider",
  "section",
  "page-break",
];

export default function PublicForm({
  title,
  description,
  fields,
  styles,
  slug,
}: Props) {
  const [values, setValues] = useState<FormValues>(() => {
    const initial: FormValues = {};

    for (const field of fields) {
      if (field.type === "hidden") {
        initial[field.id] = field.placeholder ?? "";
      }

      if (field.type === "scale") {
        initial[field.id] = 1;
      }
    }

    return initial;
  });

  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  // Searchable City dropdown state
  const [citySearch, setCitySearch] = useState<Record<string, string>>({});
  const [cityDropdownOpen, setCityDropdownOpen] = useState<
    Record<string, boolean>
  >({});

  const look =
    styles && typeof styles === "object"
      ? (styles as Record<string, unknown>)
      : {};

  const primaryColor =
    typeof look.primaryColor === "string"
      ? look.primaryColor
      : "#0c2f55";

  const setValue = (id: string, value: unknown) => {
    setValues((current) => ({
      ...current,
      [id]: value,
    }));
  };

  const labelStyle = {
    display: "block",
    marginBottom: 7,
    fontWeight: 600,
    fontSize: 14,
  } as const;

  const inputStyle = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #ccd5e0",
    borderRadius: 7,
    font: "inherit",
    background: "#fff",
    color: "#19283a",
    boxSizing: "border-box" as const,
  };

  const fieldContainerStyle = {
    display: "grid",
    gap: 20,
  };

  function handleInputChange(
    field: FormField,
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const value = event.target.value;

    if (field.type === "number") {
      setValue(
        field.id,
        value === "" ? "" : Number(value)
      );
      return;
    }

    setValue(field.id, value);
  }

  function isCityDropdown(field: FormField) {
    return (
      field.type === "dropdown" &&
      field.label.trim().toLowerCase() === "city"
    );
  }

  function handleCityBlur(
    fieldId: string,
    event: FocusEvent<HTMLDivElement>
  ) {
    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    setCityDropdownOpen((current) => ({
      ...current,
      [fieldId]: false,
    }));
  }

  function handleCityKeyDown(
    fieldId: string,
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Escape") {
      setCityDropdownOpen((current) => ({
        ...current,
        [fieldId]: false,
      }));

      setCitySearch((current) => ({
        ...current,
        [fieldId]: "",
      }));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (loading) return;

    // Validate that a real City option was selected.
    for (const field of fields) {
      if (isCityDropdown(field) && field.required) {
        const selectedCity = String(values[field.id] ?? "");
        const validCities = field.options ?? [];

        if (!validCities.includes(selectedCity)) {
          setError(`Please select a valid ${field.label}.`);
          return;
        }
      }
    }

    setLoading(true);

    try {
      const formElement = event.currentTarget;
      const body = new FormData();

      const honeypot = new FormData(formElement).get("_website");

      body.set("data", JSON.stringify(values));
      body.set("_website", String(honeypot ?? ""));

      for (const [fieldId, selectedFiles] of Object.entries(files)) {
        for (const file of selectedFiles) {
          body.append(`file:${fieldId}`, file);
        }
      }

      const response = await fetch(
        `/api/public/forms/${encodeURIComponent(slug)}/submit`,
        {
          method: "POST",
          body,
        }
      );

      const responseText = await response.text();

      let result: {
        success?: boolean;
        message?: string;
      };

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Server returned an invalid response (${response.status}).`
        );
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to submit the form."
        );
      }

      setComplete(true);
      setMessage(
        result.message ||
          "Thank you. Your response has been received."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to submit the form."
      );
    } finally {
      setLoading(false);
    }
  }

  if (complete) {
    return (
      <section
        className="public-form-card"
        role="status"
        style={{
          maxWidth: 720,
          margin: "48px auto",
          padding: 32,
          borderRadius: 12,
          background: "#fff",
          color: "#19283a",
          boxShadow: "0 8px 36px #152b4512",
        }}
      >
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    );
  }

  return (
    <section
      className="public-form-card"
      style={{
        maxWidth: 720,
        margin: "48px auto",
        padding: 32,
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 8px 36px #152b4512",
        color: "#19283a",
      }}
    >
      <h1 style={{ margin: "0 0 8px", fontSize: 30 }}>
        {title}
      </h1>

      {description && (
        <p
          style={{
            margin: "0 0 26px",
            color: "#637286",
            lineHeight: 1.65,
          }}
        >
          {description}
        </p>
      )}

      <form onSubmit={submit}>
        {/* Honeypot anti-spam field */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-10000px",
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
        >
          <label htmlFor="website-address">
            Leave this field empty
          </label>

          <input
            id="website-address"
            name="_website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div style={fieldContainerStyle}>
          {fields.map((field) => {
            const options = field.options ?? [];

            if (field.type === "hidden") {
              return (
                <input
                  key={field.id}
                  type="hidden"
                  name={field.id}
                  value={String(values[field.id] ?? "")}
                />
              );
            }

            if (field.type === "divider") {
              return (
                <hr
                  key={field.id}
                  style={{
                    width: "100%",
                    border: 0,
                    borderTop: "1px solid #e2e8f0",
                    margin: "8px 0",
                  }}
                />
              );
            }

            if (field.type === "section") {
              return (
                <div key={field.id}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 20,
                      color: "#0c2f55",
                    }}
                  >
                    {field.label}
                  </h2>
                </div>
              );
            }

            if (field.type === "page-break") {
              return (
                <hr
                  key={field.id}
                  style={{
                    width: "100%",
                    border: 0,
                    borderTop: "2px dashed #ccd5e0",
                    margin: "12px 0",
                  }}
                />
              );
            }

            if (field.type === "html") {
              return (
                <div
                  key={field.id}
                  style={{
                    color: "#637286",
                    lineHeight: 1.6,
                  }}
                >
                  {field.label}
                </div>
              );
            }

            if (STRUCTURAL_FIELDS.includes(field.type)) {
              return null;
            }

            const common = {
              id: field.id,
              name: field.id,
              placeholder: field.placeholder,
              style: inputStyle,
              "aria-label": field.label,
            };

            return (
              <div key={field.id}>
                <label
                  htmlFor={field.id}
                  style={labelStyle}
                >
                  {field.label}
                  {field.required && (
                    <span aria-hidden="true"> *</span>
                  )}
                </label>

                {/* Text fields */}
                {[
                  "text",
                  "name",
                  "signature",
                  "telephone",
                  "address",
                  "city",
                  "state",
                  "country",
                  "postal-code",
                ].includes(field.type) && (
                  <>
                    {field.type === "signature" && (
                      <small
                        style={{
                          display: "block",
                          marginBottom: 6,
                          color: "#637286",
                        }}
                      >
                        Type your full name as your signature.
                      </small>
                    )}

                    <input
                      {...common}
                      type={
                        field.type === "telephone"
                          ? "tel"
                          : "text"
                      }
                      required={field.required}
                      autoComplete={
                        field.type === "name"
                          ? "name"
                          : field.type === "telephone"
                            ? "tel"
                            : field.type === "address"
                              ? "street-address"
                              : field.type === "city"
                                ? "address-level2"
                                : field.type === "state"
                                  ? "address-level1"
                                  : field.type === "country"
                                    ? "country-name"
                                    : field.type === "postal-code"
                                      ? "postal-code"
                                      : undefined
                      }
                      onChange={(event) =>
                        handleInputChange(field, event)
                      }
                    />
                  </>
                )}

                {/* Email */}
                {field.type === "email" && (
                  <input
                    {...common}
                    type="email"
                    required={field.required}
                    autoComplete="email"
                    onChange={(event) =>
                      handleInputChange(field, event)
                    }
                  />
                )}

                {/* URL */}
                {field.type === "url" && (
                  <input
                    {...common}
                    type="url"
                    required={field.required}
                    onChange={(event) =>
                      handleInputChange(field, event)
                    }
                  />
                )}

                {/* Number */}
                {field.type === "number" && (
                  <input
                    {...common}
                    type="number"
                    required={field.required}
                    onChange={(event) =>
                      handleInputChange(field, event)
                    }
                  />
                )}

                {/* Paragraph */}
                {field.type === "paragraph" && (
                  <textarea
                    {...common}
                    rows={4}
                    required={field.required}
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                    }}
                    onChange={(event) =>
                      handleInputChange(field, event)
                    }
                  />
                )}

                {/* Date */}
                {field.type === "date" && (
                  <input
                    {...common}
                    type="date"
                    required={field.required}
                    onChange={(event) =>
                      handleInputChange(field, event)
                    }
                  />
                )}

                {/* Time */}
                {field.type === "time" && (
                  <input
                    {...common}
                    type="time"
                    required={field.required}
                    onChange={(event) =>
                      handleInputChange(field, event)
                    }
                  />
                )}

                {/* Date and time */}
                {field.type === "datetime" && (
                  <input
                    {...common}
                    type="datetime-local"
                    required={field.required}
                    onChange={(event) =>
                      handleInputChange(field, event)
                    }
                  />
                )}

                {/* Searchable City dropdown */}
                {isCityDropdown(field) && (
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                    }}
                    onBlur={(event) =>
                      handleCityBlur(field.id, event)
                    }
                  >
                    <input
                      id={field.id}
                      name={field.id}
                      type="text"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={
                        cityDropdownOpen[field.id] === true
                      }
                      aria-controls={`${field.id}-city-options`}
                      autoComplete="off"
                      placeholder="Search city..."
                      value={
                        cityDropdownOpen[field.id]
                          ? citySearch[field.id] ?? ""
                          : String(values[field.id] ?? "")
                      }
                      style={inputStyle}
                      onFocus={() => {
                        setCitySearch((current) => ({
                          ...current,
                          [field.id]: "",
                        }));

                        setCityDropdownOpen((current) => ({
                          ...current,
                          [field.id]: true,
                        }));
                      }}
                      onChange={(event) => {
                        setCitySearch((current) => ({
                          ...current,
                          [field.id]: event.target.value,
                        }));

                        setCityDropdownOpen((current) => ({
                          ...current,
                          [field.id]: true,
                        }));
                      }}
                      onKeyDown={(event) =>
                        handleCityKeyDown(field.id, event)
                      }
                    />

                    {cityDropdownOpen[field.id] && (
                      <div
                        id={`${field.id}-city-options`}
                        role="listbox"
                        aria-label={`${field.label} options`}
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          left: 0,
                          right: 0,
                          zIndex: 100,
                          maxHeight: 230,
                          overflowY: "auto",
                          background: "#fff",
                          border: "1px solid #ccd5e0",
                          borderRadius: 7,
                          boxShadow: "0 6px 18px #152b451a",
                        }}
                      >
                        {options
                          .filter((option) =>
                            option
                              .toLowerCase()
                              .includes(
                                (citySearch[field.id] ?? "")
                                  .trim()
                                  .toLowerCase()
                              )
                          )
                          .map((option) => (
                            <button
                              key={option}
                              type="button"
                              role="option"
                              aria-selected={
                                values[field.id] === option
                              }
                              onMouseDown={(event) =>
                                event.preventDefault()
                              }
                              onClick={() => {
                                setValue(field.id, option);

                                setCitySearch((current) => ({
                                  ...current,
                                  [field.id]: "",
                                }));

                                setCityDropdownOpen((current) => ({
                                  ...current,
                                  [field.id]: false,
                                }));
                              }}
                              style={{
                                display: "block",
                                width: "100%",
                                padding: "10px 12px",
                                border: 0,
                                borderBottom: "1px solid #edf0f4",
                                background:
                                  values[field.id] === option
                                    ? "#eef4fb"
                                    : "#fff",
                                color: "#19283a",
                                textAlign: "left",
                                font: "inherit",
                                cursor: "pointer",
                              }}
                            >
                              {option}
                            </button>
                          ))}

                        {options.filter((option) =>
                          option
                            .toLowerCase()
                            .includes(
                              (citySearch[field.id] ?? "")
                                .trim()
                                .toLowerCase()
                            )
                        ).length === 0 && (
                          <div
                            style={{
                              padding: 12,
                              color: "#637286",
                              fontSize: 14,
                            }}
                          >
                            No matching city found.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Normal Dropdown - other fields */}
                {field.type === "dropdown" &&
                  !isCityDropdown(field) && (
                    <select
                      {...common}
                      required={field.required}
                      value={String(values[field.id] ?? "")}
                      onChange={(event) =>
                        handleInputChange(field, event)
                      }
                    >
                      <option value="">
                        Select an option
                      </option>

                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}

                {/* Multi select */}
                {field.type === "multi-select" && (
                  <select
                    {...common}
                    multiple
                    required={field.required}
                    value={
                      Array.isArray(values[field.id])
                        ? (values[field.id] as string[])
                        : []
                    }
                    onChange={(event) =>
                      setValue(
                        field.id,
                        Array.from(
                          event.currentTarget.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {/* Radio and multiple choice */}
                {["radio", "multiple-choice"].includes(
                  field.type
                ) && (
                  <div
                    role="radiogroup"
                    aria-label={field.label}
                    style={{
                      display: "grid",
                      gap: 9,
                    }}
                  >
                    {options.map((option) => (
                      <label
                        key={option}
                        style={{
                          display: "flex",
                          gap: 9,
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name={field.id}
                          value={option}
                          required={field.required}
                          checked={values[field.id] === option}
                          onChange={() =>
                            setValue(field.id, option)
                          }
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}

                {/* Checkbox */}
                {field.type === "checkbox" && (
                  <label
                    style={{
                      display: "flex",
                      gap: 9,
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={values[field.id] === true}
                      required={field.required}
                      onChange={(event) =>
                        setValue(
                          field.id,
                          event.target.checked
                        )
                      }
                    />

                    {field.placeholder || "Yes"}
                  </label>
                )}

                {/* Consent */}
                {field.type === "consent" && (
                  <label
                    style={{
                      display: "flex",
                      gap: 9,
                      alignItems: "flex-start",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={values[field.id] === true}
                      required={field.required}
                      onChange={(event) =>
                        setValue(
                          field.id,
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      {field.placeholder || field.label}
                    </span>
                  </label>
                )}

                {/* Rating: 1 to 5 */}
                {field.type === "rating" && (
                  <div
                    role="radiogroup"
                    aria-label={field.label}
                    style={{
                      display: "flex",
                      gap: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <label
                        key={rating}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name={field.id}
                          value={rating}
                          required={field.required}
                          checked={values[field.id] === rating}
                          onChange={() =>
                            setValue(field.id, rating)
                          }
                        />

                        {rating} ★
                      </label>
                    ))}
                  </div>
                )}

                {/* Scale: 1 to 10 */}
                {field.type === "scale" && (
                  <div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={Number(values[field.id] ?? 1)}
                      onChange={(event) =>
                        setValue(
                          field.id,
                          Number(event.target.value)
                        )
                      }
                      style={{ width: "100%" }}
                    />

                    <p
                      style={{
                        margin: "5px 0 0",
                        color: "#637286",
                      }}
                    >
                      Selected: {String(values[field.id] ?? 1)}
                    </p>
                  </div>
                )}

                {/* File and image upload */}
                {["file", "image"].includes(field.type) && (
                  <input
                    id={field.id}
                    name={field.id}
                    type="file"
                    required={field.required}
                    multiple
                    accept={
                      field.type === "image"
                        ? "image/png,image/jpeg,image/gif,image/webp"
                        : "image/png,image/jpeg,image/gif,image/webp,application/pdf,text/csv,.csv"
                    }
                    onChange={(event) => {
                      setFiles((current) => ({
                        ...current,
                        [field.id]: Array.from(
                          event.target.files ?? []
                        ),
                      }));
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <p
            role="alert"
            style={{
              color: "#b42318",
              margin: "18px 0 0",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 24,
            border: 0,
            borderRadius: 7,
            padding: "12px 20px",
            background: primaryColor,
            color: "#fff",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>
    </section>
  );
}
