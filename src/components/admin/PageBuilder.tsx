"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  Grid2X2,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Plus,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  Save,
} from "lucide-react";
import MediaPickerModal, {
  type MediaPickerItem,
} from "@/components/admin/MediaPickerModal";
import type {
  PageBuilderDevice,
  PageBuilderElement,
  PageBuilderElementType,
  PageBuilderLayout,
  PageBuilderStyles,
} from "@/lib/page-builder-types";
import styles from "./PageBuilder.module.css";

type Props = {
  target: {
    kind: "page" | "post";
    id: string;
    postTypeSlug?: string;
  };
};

type InspectorTab = "content" | "style" | "advanced";
type PageStatus = "DRAFT" | "PUBLISHED";
type HeaderTemplateOption = { id: string; name: string };

const widgetTypes: PageBuilderElementType[] = [
  "section",
  "container",
  "heading",
  "text",
  "image",
  "icon",
  "button",
  "link",
  "divider",
  "spacer",
];

const emptyLayout: PageBuilderLayout = { version: 1, elements: [] };
let nextId = 0;

function createId(type: PageBuilderElementType) {
  nextId += 1;
  return `${type}-${Date.now().toString(36)}-${nextId}`;
}

function getSafeMediaUrl(value: string | undefined) {
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}


function nudgeCssValue(value: string, direction: -1 | 1, multiplier = 1) {
  const match = value.trim().match(/^(-?\\d+(?:\\.\\d+)?)(px|rem|em|%|vh|vw)?$/i);
  if (!match) return value;
  const number = Number(match[1]) + direction * multiplier;
  const rounded = Math.round(number * 100) / 100;
  return `${rounded}${match[2] ?? "px"}`;
}

function createElement(type: PageBuilderElementType): PageBuilderElement {
  const element: PageBuilderElement = { id: createId(type), type };
  if (type === "section") {
    return {
      ...element,
      display: "flex",
      columns: 1,
      children: [],
      styles: {
        width: "100%",
        padding: "48px 32px",
        gap: "24px",
        backgroundColor: "#f8fafc",
      },
    };
  }
  if (type === "container") {
    return {
      ...element,
      display: "flex",
      columns: 2,
      children: [],
      styles: {
        width: "100%",
        padding: "24px",
        gap: "20px",
        backgroundColor: "#ffffff",
      },
    };
  }
  if (type === "heading") {
    return { ...element, content: "Add your heading", level: 2 };
  }
  if (type === "text") {
    return { ...element, content: "Add your text here." };
  }
  if (type === "image") {
    return { ...element, src: "", alt: "" };
  }
  if (type === "icon") {
    return { ...element, src: "", alt: "Icon" };
  }
  if (type === "button") {
    return {
      ...element,
      content: "Click here",
      href: "#",
      styles: { backgroundColor: "#3984e8", color: "#ffffff" },
    };
  }
  if (type === "link") {
    return { ...element, content: "Add link text", href: "#" };
  }
  if (type === "spacer") {
    return { ...element, styles: { height: "40px" } };
  }
  return element;
}

function findElement(
  elements: PageBuilderElement[],
  id: string
): PageBuilderElement | null {
  for (const element of elements) {
    if (element.id === id) return element;
    const child = findElement(element.children ?? [], id);
    if (child) return child;
  }
  return null;
}

function updateElement(
  elements: PageBuilderElement[],
  id: string,
  updater: (element: PageBuilderElement) => PageBuilderElement
): PageBuilderElement[] {
  return elements.map((element) => {
    if (element.id === id) return updater(element);
    return element.children
      ? {
          ...element,
          children: updateElement(element.children, id, updater),
        }
      : element;
  });
}

function removeElement(
  elements: PageBuilderElement[],
  id: string
): PageBuilderElement[] {
  return elements
    .filter((element) => element.id !== id)
    .map((element) =>
      element.children
        ? { ...element, children: removeElement(element.children, id) }
        : element
    );
}

function containsElement(element: PageBuilderElement, id: string): boolean {
  return (
    element.id === id ||
    (element.children ?? []).some((child) => containsElement(child, id))
  );
}

function insertIntoContainer(
  elements: PageBuilderElement[],
  containerId: string,
  child: PageBuilderElement
): { elements: PageBuilderElement[]; inserted: boolean } {
  let inserted = false;
  const updated = elements.map((element) => {
    if (
      element.id === containerId &&
      (element.type === "container" || element.type === "section")
    ) {
      inserted = true;
      return { ...element, children: [...(element.children ?? []), child] };
    }

    if (!element.children) return element;
    const result = insertIntoContainer(element.children, containerId, child);
    inserted ||= result.inserted;
    return result.inserted ? { ...element, children: result.elements } : element;
  });
  return { elements: updated, inserted };
}

function insertBefore(
  elements: PageBuilderElement[],
  targetId: string,
  child: PageBuilderElement
): { elements: PageBuilderElement[]; inserted: boolean } {
  const index = elements.findIndex((element) => element.id === targetId);
  if (index >= 0) {
    return {
      elements: [
        ...elements.slice(0, index),
        child,
        ...elements.slice(index),
      ],
      inserted: true,
    };
  }

  let inserted = false;
  const updated = elements.map((element) => {
    if (!element.children) return element;
    const result = insertBefore(element.children, targetId, child);
    inserted ||= result.inserted;
    return result.inserted ? { ...element, children: result.elements } : element;
  });
  return { elements: updated, inserted };
}

function appendToRoot(
  elements: PageBuilderElement[],
  child: PageBuilderElement
) {
  return [...elements, child];
}

function getDeviceIcon(device: PageBuilderDevice) {
  if (device === "mobile") return <Smartphone size={17} />;
  if (device === "tablet") return <Tablet size={17} />;
  return <Monitor size={17} />;
}

export default function PageBuilder({ target }: Props) {
  const apiUrl = useMemo(() => {
    const query = new URLSearchParams({ type: target.kind });
    if (target.postTypeSlug) query.set("postType", target.postTypeSlug);
    return `/api/admin/builder/${encodeURIComponent(target.id)}?${query}`;
  }, [target.id, target.kind, target.postTypeSlug]);
  const editUrl =
    target.kind === "page"
      ? `/admin/pages/${target.id}/edit`
      : target.postTypeSlug
        ? `/admin/content-types/${target.postTypeSlug}/posts/${target.id}/edit`
        : `/admin/posts/${target.id}/edit`;
  const [layout, setLayout] = useState<PageBuilderLayout>(emptyLayout);
  const [pageTitle, setPageTitle] = useState("");
  const [pageStatus, setPageStatus] = useState<PageStatus>("DRAFT");
  const [headerTemplateId, setHeaderTemplateId] = useState("");
  const [headerTemplates, setHeaderTemplates] = useState<HeaderTemplateOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [device, setDevice] = useState<PageBuilderDevice>("desktop");
  const [tab, setTab] = useState<InspectorTab>("content");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [mediaPickerPurpose, setMediaPickerPurpose] = useState<
    "image" | "icon" | "background"
  >("image");

  useEffect(() => {
    let active = true;

    async function loadBuilder() {
      try {
        const response = await fetch(apiUrl, {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load the page builder.");
        }
        if (!active) return;

        setPageTitle(result.page.title);
        setPageStatus(
          result.page.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"
        );
        setHeaderTemplateId(result.headerTemplateId || "");
        setHeaderTemplates(
          Array.isArray(result.headerTemplates)
            ? result.headerTemplates.filter(
                (template: unknown): template is HeaderTemplateOption =>
                  Boolean(
                    template &&
                      typeof template === "object" &&
                      "id" in template &&
                      typeof template.id === "string" &&
                      "name" in template &&
                      typeof template.name === "string"
                  )
              )
            : []
        );
        if (
          result.layout &&
          result.layout.version === 1 &&
          Array.isArray(result.layout.elements)
        ) {
          setLayout(result.layout as PageBuilderLayout);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the page builder."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBuilder();
    return () => {
      active = false;
    };
  }, [apiUrl]);

  const selectedElement = useMemo(
    () => findElement(layout.elements, selectedId),
    [layout.elements, selectedId]
  );

  const canvasStyle = {
    "--builder-canvas-width":
      device === "mobile" ? "390px" : device === "tablet" ? "820px" : "100%",
  } as CSSProperties;

  const updateSelected = useCallback(
    (updater: (element: PageBuilderElement) => PageBuilderElement) => {
      if (!selectedId) return;
      setLayout((current) => ({
        ...current,
        elements: updateElement(current.elements, selectedId, updater),
      }));
    },
    [selectedId]
  );

  function addElement(type: PageBuilderElementType) {
    const element = createElement(type);
    setLayout((current) => ({
      ...current,
      elements: appendToRoot(current.elements, element),
    }));
    setSelectedId(element.id);
  }

  function handleDrop(
    event: DragEvent<HTMLElement>,
    targetId: string | null
  ) {
    event.preventDefault();
    event.stopPropagation();
    const payload = event.dataTransfer.getData("text/page-builder");
    if (!payload) return;

    const [kind, value] = payload.split(":");
    if (kind === "widget" && widgetTypes.includes(value as PageBuilderElementType)) {
      const element = createElement(value as PageBuilderElementType);
      if (targetId) {
        const target = findElement(layout.elements, targetId);
        if (target && (target.type === "section" || target.type === "container")) {
          const result = insertIntoContainer(layout.elements, targetId, element);
          setLayout((current) => ({ ...current, elements: result.elements }));
        } else {
          setLayout((current) => {
            const result = insertBefore(current.elements, targetId, element);
            return {
              ...current,
              elements: result.inserted
                ? result.elements
                : appendToRoot(current.elements, element),
            };
          });
        }
      } else {
        setLayout((current) => ({
          ...current,
          elements: appendToRoot(current.elements, element),
        }));
      }
      setSelectedId(element.id);
      return;
    }

    if (kind !== "element") return;
    const moving = findElement(layout.elements, value);
    if (!moving || moving.id === targetId || (targetId && containsElement(moving, targetId))) {
      return;
    }

    setLayout((current) => {
      const withoutMoving = removeElement(current.elements, value);
      if (targetId) {
        const target = findElement(withoutMoving, targetId);
        if (target && (target.type === "section" || target.type === "container")) {
          const result = insertIntoContainer(withoutMoving, targetId, moving);
          return { ...current, elements: result.elements };
        }
        const result = insertBefore(withoutMoving, targetId, moving);
        return {
          ...current,
          elements: result.inserted
            ? result.elements
            : appendToRoot(withoutMoving, moving),
        };
      }
      return { ...current, elements: appendToRoot(withoutMoving, moving) };
    });
    setSelectedId(moving.id);
  }

  function handleWidgetDragStart(
    event: DragEvent<HTMLElement>,
    type: PageBuilderElementType
  ) {
    event.dataTransfer.setData("text/page-builder", `widget:${type}`);
    event.dataTransfer.effectAllowed = "copy";
  }

  function handleElementDragStart(
    event: DragEvent<HTMLElement>,
    id: string
  ) {
    event.stopPropagation();
    event.dataTransfer.setData("text/page-builder", `element:${id}`);
    event.dataTransfer.effectAllowed = "move";
  }

  async function save(action: "saveDraft" | "publish") {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          layout,
          headerTemplateId: headerTemplateId || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save the page layout.");
      }
      if (action === "publish") setPageStatus("PUBLISHED");
      setNotice(result.message || "Page layout saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the page layout."
      );
    } finally {
      setSaving(false);
    }
  }

  function updateStyle(property: keyof PageBuilderStyles, value: string) {
    if (
      ["width", "height", "margin", "padding", "gap"].includes(property)
    ) {
      updateSelected((element) => ({
        ...element,
        responsive: {
          ...element.responsive,
          [device]: {
            ...element.responsive?.[device],
            [property]: value,
          },
        },
      }));
      return;
    }

    updateSelected((element) => ({
      ...element,
      styles: { ...element.styles, [property]: value },
    }));
  }

  function openMediaPicker(purpose: "image" | "icon" | "background") {
    setMediaPickerPurpose(purpose);
    setImagePickerOpen(true);
  }

  function removeSelected() {
    if (!selectedId) return;
    setLayout((current) => ({
      ...current,
      elements: removeElement(current.elements, selectedId),
    }));
    setSelectedId("");
  }

  function renderCanvasElement(element: PageBuilderElement) {
    const selected = selectedId === element.id;
    const backgroundImage = getSafeMediaUrl(element.styles?.backgroundImage);
    const elementStyle = {
      "--builder-normal-color": element.styles?.color,
      "--builder-normal-background": element.styles?.backgroundColor,
      backgroundImage: backgroundImage
        ? `url(${JSON.stringify(backgroundImage)})`
        : undefined,
      backgroundSize: backgroundImage ? "cover" : undefined,
      backgroundPosition: backgroundImage ? "center" : undefined,
      borderRadius: element.styles?.borderRadius,
      borderWidth: element.styles?.borderWidth,
      borderStyle: element.styles?.borderStyle,
      borderColor: element.styles?.borderColor,
      overflow: element.styles?.overflow,
      fontFamily: element.styles?.fontFamily,
      fontSize: element.styles?.fontSize,
      fontWeight: element.styles?.fontWeight,
      textAlign: element.styles?.textAlign as CSSProperties["textAlign"],
      "--builder-hover-color": element.styles?.hoverColor,
      "--builder-hover-background": element.styles?.hoverBackgroundColor,
      display:
        element.type === "section" || element.type === "container"
          ? undefined
          : undefined,
      flexWrap: element.flexWrap ?? "wrap",
      flexDirection: element.flexDirection ?? "row",
      alignContent: element.alignContent ?? "stretch",
      minWidth: element.responsive?.[device]?.minWidth ?? element.styles?.minWidth,
      maxWidth: element.responsive?.[device]?.maxWidth ?? element.styles?.maxWidth,
      minHeight: element.responsive?.[device]?.minHeight ?? element.styles?.minHeight,
      maxHeight: element.responsive?.[device]?.maxHeight ?? element.styles?.maxHeight,
      gridTemplateColumns:
        element.display === "grid"
          ? `repeat(${element.columns ?? 1}, minmax(0, 1fr))`
          : undefined,
      gap: element.responsive?.[device]?.gap ?? element.styles?.gap,
      width: element.responsive?.[device]?.width ?? element.styles?.width,
      height: element.responsive?.[device]?.height ?? element.styles?.height,
      padding: element.responsive?.[device]?.padding ?? element.styles?.padding,
      margin: element.responsive?.[device]?.margin ?? element.styles?.margin,
    } as CSSProperties;

    const dropProps = {
      onDragOver: (event: DragEvent<HTMLElement>) => event.preventDefault(),
      onDrop: (event: DragEvent<HTMLElement>) =>
        handleDrop(
          event,
          element.type === "section" || element.type === "container"
            ? element.id
            : element.id
        ),
    };

    return (
      <div
        key={element.id}
        className={`${styles.canvasElement} ${selected ? styles.selectedElement : ""} ${element.type === "section" || element.type === "container" ? styles.layoutElement : ""}`}
        style={elementStyle}
        draggable
        onClick={(event) => {
          event.stopPropagation();
          setSelectedId(element.id);
        }}
        onDragStart={(event) => handleElementDragStart(event, element.id)}
        {...dropProps}
      >
        {(element.type === "section" || element.type === "container") && (
          <>
            <div className={styles.elementLabel}>
              {element.type === "section" ? "Section" : "Container"}
              <span>{element.display ?? "flex"}</span>
            </div>
            <div
              className={`${styles.containerChildren} ${element.display === "grid" ? styles.gridChildren : ""} ${device === "mobile" ? styles.mobileChildren : ""}`}
              style={{
                display: element.display ?? "flex",
                gridTemplateColumns:
                  element.display === "grid"
                    ? `repeat(${element.columns ?? 1}, minmax(0, 1fr))`
                    : undefined,
                flexWrap: element.flexWrap ?? "wrap",
                flexDirection: element.flexDirection ?? "row",
                alignItems: element.alignItems ?? "stretch",
                justifyContent: element.justifyContent ?? "start",
                alignContent: element.alignContent ?? "stretch",
                gap:
                  element.responsive?.[device]?.gap ??
                  element.styles?.gap ??
                  "10px",
              }}
            >
              {element.children?.length ? (
                element.children.map(renderCanvasElement)
              ) : (
                <div className={styles.dropHint}>
                  Drop a widget here or add one from the panel
                </div>
              )}
            </div>
          </>
        )}
        {element.type === "heading" && (
          <div className={styles.previewHeading} style={elementStyle}>
            {element.content || "Heading"}
          </div>
        )}
        {element.type === "text" && (
          <div className={styles.previewText} style={elementStyle}>
            {element.content || "Text"}
          </div>
        )}
        {element.type === "image" && (
          <div className={styles.previewImage}>
            {element.src ? (
              <img src={element.src} alt={element.alt || ""} />
            ) : (
              <ImageIcon size={28} />
            )}
          </div>
        )}
        {element.type === "button" && (
          <span className={styles.previewButton} style={elementStyle}>
            {element.content || "Button"}
          </span>
        )}
        {element.type === "link" && (
          <span className={styles.previewLink} style={elementStyle}>
            {element.content || "Link"}
          </span>
        )}
        {element.type === "icon" && (
          <span className={styles.previewIcon} style={elementStyle}>
            {element.src ? <img src={element.src} alt={element.alt ?? ""} /> : <ImageIcon size={22} />}
          </span>
        )}
        {element.type === "divider" && <hr className={styles.previewDivider} />}
        {element.type === "spacer" && <div className={styles.previewSpacer} />}
      </div>
    );
  }

  function renderStructureItems(
    elements: PageBuilderElement[],
    depth = 0
  ): ReactNode {
    return elements.map((element) => (
      <div key={element.id}>
        <button
          type="button"
          className={`${styles.structureItem} ${
            selectedId === element.id ? styles.selectedStructureItem : ""
          }`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => setSelectedId(element.id)}
        >
          <span className={styles.structureIcon}>
            {element.type === "section" || element.type === "container"
              ? <Grid2X2 size={14} />
              : <Plus size={14} />}
          </span>
          <span>{element.type[0].toUpperCase() + element.type.slice(1)}</span>
        </button>
        {element.children?.length
          ? renderStructureItems(element.children, depth + 1)
          : null}
      </div>
    ));
  }

  function renderInspector() {
    if (!selectedElement) {
      return (
        <>
          <div className={styles.tabs}>
            <button type="button" className={styles.activeTab}>Page</button>
          </div>
          <div className={styles.inspectorFields}>
            <label>
              Header template
              <select
                value={headerTemplateId}
                onChange={(event) => setHeaderTemplateId(event.target.value)}
              >
                <option value="">Use site default</option>
                {headerTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            {!headerTemplates.length && (
              <p className={styles.emptyInspector}>
                Create header templates in Appearance → Header Builder.
              </p>
            )}
            <p className={styles.emptyInspector}>
              Select a widget in the canvas or use Structure to edit its layout.
            </p>
          </div>
        </>
      );
    }

    const isLayout =
      selectedElement.type === "section" || selectedElement.type === "container";
    const dimensionValue = (property: keyof PageBuilderStyles) =>
      selectedElement.responsive?.[device]?.[property] ??
      (device === "desktop" ? selectedElement.styles?.[property] : "") ??
      "";

    return (
      <>
        <div className={styles.tabs}>
          {(["content", "style", "advanced"] as const).map((name) => (
            <button
              key={name}
              type="button"
              className={tab === name ? styles.activeTab : ""}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className={styles.inspectorFields}>
          {tab === "content" && (
            <>
              {(selectedElement.type === "heading" ||
                selectedElement.type === "text" ||
                selectedElement.type === "button" ||
                selectedElement.type === "link") && (
                <label>
                  {selectedElement.type === "heading"
                    ? "Title"
                    : selectedElement.type === "button" || selectedElement.type === "link"
                      ? "Label"
                      : "Text"}
                  <textarea
                    value={selectedElement.content ?? ""}
                    rows={selectedElement.type === "text" ? 5 : 2}
                    onChange={(event) =>
                      updateSelected((element) => ({
                        ...element,
                        content: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
              {selectedElement.type === "heading" && (
                <label>
                  HTML Tag
                  <select
                    value={selectedElement.level ?? 2}
                    onChange={(event) =>
                      updateSelected((element) => ({
                        ...element,
                        level: Number(event.target.value),
                      }))
                    }
                  >
                    {[1, 2, 3, 4, 5, 6].map((level) => (
                      <option key={level} value={level}>
                        H{level}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selectedElement.type === "image" && (
                <>
                  <label>
                    Image
                    <button
                      type="button"
                      className={styles.mediaButton}
                      onClick={() => openMediaPicker("image")}
                    >
                      <ImageIcon size={15} /> Choose from Media Library
                    </button>
                  </label>
                  <label>
                    Image URL
                    <input
                      value={selectedElement.src ?? ""}
                      onChange={(event) =>
                        updateSelected((element) => ({
                          ...element,
                          src: event.target.value,
                        }))
                      }
                      placeholder="/uploads/media/..."
                    />
                  </label>
                  <label>
                    Alt Text
                    <input
                      value={selectedElement.alt ?? ""}
                      onChange={(event) =>
                        updateSelected((element) => ({
                          ...element,
                          alt: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              )}
              {selectedElement.type === "icon" && (
                <>
                  <label>
                    Icon image
                    <button
                      type="button"
                      className={styles.mediaButton}
                      onClick={() => openMediaPicker("icon")}
                    >
                      <ImageIcon size={15} /> Choose from Media Library
                    </button>
                  </label>
                  <label>
                    Alt Text
                    <input
                      value={selectedElement.alt ?? ""}
                      onChange={(event) =>
                        updateSelected((element) => ({
                          ...element,
                          alt: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              )}
              <label>
                Link URL
                <input
                  value={selectedElement.href ?? ""}
                  onChange={(event) =>
                    updateSelected((element) => ({
                      ...element,
                      href: event.target.value,
                    }))
                  }
                  placeholder="https:// or /page/"
                />
              </label>
              <label>
                Open link in
                <select
                  value={selectedElement.linkTarget ?? "_self"}
                  onChange={(event) =>
                    updateSelected((element) => ({
                      ...element,
                      linkTarget: event.target.value as "_self" | "_blank",
                    }))
                  }
                >
                  <option value="_self">Same tab</option>
                  <option value="_blank">New tab</option>
                </select>
              </label>
              {isLayout && (
                <>
                  <label>
                    Layout
                    <select
                      value={selectedElement.display ?? "flex"}
                      onChange={(event) =>
                        updateSelected((element) => ({
                          ...element,
                          display: event.target.value as "flex" | "grid" | "block",
                        }))
                      }
                    >
                      <option value="flex">Flexbox</option>
                      <option value="grid">Grid</option>
                      <option value="block">Block</option>
                    </select>
                  </label>
                  {selectedElement.display === "grid" && (
                    <label>
                      Columns
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={selectedElement.columns ?? 1}
                        onChange={(event) =>
                          updateSelected((element) => ({
                            ...element,
                            columns: Math.max(1, Math.min(12, Number(event.target.value) || 1)),
                          }))
                        }
                      />
                    </label>
                  )}
                  {selectedElement.display === "flex" && (
                    <label>
                      Wrap items
                      <select
                        value={selectedElement.flexWrap ?? "wrap"}
                        onChange={(event) =>
                          updateSelected((element) => ({
                            ...element,
                            flexWrap: event.target.value as "wrap" | "nowrap",
                          }))
                        }
                      >
                        <option value="wrap">Wrap</option>
                        <option value="nowrap">No wrap</option>
                      </select>
                    </label>
                  )}
                  {selectedElement.display === "flex" && (
                    <label>
                      Direction
                      <select
                        value={selectedElement.flexDirection ?? "row"}
                        onChange={(event) =>
                          updateSelected((element) => ({
                            ...element,
                            flexDirection: event.target.value as PageBuilderElement["flexDirection"],
                          }))
                        }
                      >
                        <option value="row">Row</option>
                        <option value="column">Column</option>
                        <option value="row-reverse">Row reverse</option>
                        <option value="column-reverse">Column reverse</option>
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    className={styles.inlineAdd}
                    onClick={() => {
                      const child = createElement("container");
                      updateSelected((element) => ({
                        ...element,
                        children: [...(element.children ?? []), child],
                      }));
                      setSelectedId(child.id);
                    }}
                  >
                    <Plus size={14} /> Add nested container
                  </button>
                </>
              )}
            </>
          )}

          {tab === "style" && (
            <>
              <p className={styles.fieldGroupTitle}>Normal</p>
              <label>
                Text Color
                <input
                  type="color"
                  value={selectedElement.styles?.color ?? "#19283a"}
                  onChange={(event) => updateStyle("color", event.target.value)}
                />
              </label>
              <label>
                Background Color
                <input
                  type="color"
                  value={selectedElement.styles?.backgroundColor ?? "#ffffff"}
                  onChange={(event) =>
                    updateStyle("backgroundColor", event.target.value)
                  }
                />
              </label>
              <label>
                Background Image
                <button
                  type="button"
                  className={styles.mediaButton}
                  onClick={() => openMediaPicker("background")}
                >
                  <ImageIcon size={15} /> Choose from Media Library
                </button>
                {selectedElement.styles?.backgroundImage && (
                  <button
                    type="button"
                    className={styles.clearMediaButton}
                    onClick={() => updateStyle("backgroundImage", "")}
                  >
                    Remove background image
                  </button>
                )}
              </label>
              <p className={styles.fieldGroupTitle}>Hover</p>
              <label>
                Text Color on Hover
                <input
                  type="color"
                  value={selectedElement.styles?.hoverColor ?? "#19283a"}
                  onChange={(event) => updateStyle("hoverColor", event.target.value)}
                />
              </label>
              <label>
                Background Color on Hover
                <input
                  type="color"
                  value={selectedElement.styles?.hoverBackgroundColor ?? "#ffffff"}
                  onChange={(event) =>
                    updateStyle("hoverBackgroundColor", event.target.value)
                  }
                />
              </label>
              <label>
                Font Family
                <select
                  value={selectedElement.styles?.fontFamily ?? "Arial, Helvetica, sans-serif"}
                  onChange={(event) => updateStyle("fontFamily", event.target.value)}
                >
                  <option value="Arial, Helvetica, sans-serif">Arial</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Verdana, sans-serif">Verdana</option>
                  <option value="Tahoma, sans-serif">Tahoma</option>
                  <option value="system-ui, sans-serif">System UI</option>
                </select>
              </label>
              <label>
                Font Size
                <input
                  value={selectedElement.styles?.fontSize ?? ""}
                  onChange={(event) => updateStyle("fontSize", event.target.value)}
                  placeholder="16px, 1rem"
                />
              </label>
              <label>
                Text Align
                <select
                  value={selectedElement.styles?.textAlign ?? "left"}
                  onChange={(event) => updateStyle("textAlign", event.target.value)}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                  <option value="justify">Justify</option>
                </select>
              </label>
              <label>
                Border Radius
                <input
                  value={selectedElement.styles?.borderRadius ?? ""}
                  onChange={(event) =>
                    updateStyle("borderRadius", event.target.value)
                  }
                  placeholder="6px"
                />
              </label>
              <label>
                Border Width
                <input value={selectedElement.styles?.borderWidth ?? ""} onChange={(event) => updateStyle("borderWidth", event.target.value)} placeholder="1px" />
              </label>
              <label>
                Border Style
                <select value={selectedElement.styles?.borderStyle ?? "none"} onChange={(event) => updateStyle("borderStyle", event.target.value)}>
                  <option value="none">None</option><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option>
                </select>
              </label>
              <label>
                Border Color
                <input type="color" value={selectedElement.styles?.borderColor ?? "#d0d5dd"} onChange={(event) => updateStyle("borderColor", event.target.value)} />
              </label>
            </>
          )}

          {tab === "advanced" && (
            <>
              {(["width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight", "padding", "margin", "gap"] as const).map(
                (property) => (
                  <label key={property}>
                    {property[0].toUpperCase() + property.slice(1)} ({device})
                    <input
                      value={dimensionValue(property)}
                      onChange={(event) => updateStyle(property, event.target.value)}
                      onWheel={(event) => {
                        if (document.activeElement !== event.currentTarget) return;
                        event.preventDefault();
                        const current = dimensionValue(property);
                        updateStyle(property, nudgeCssValue(current, event.deltaY < 0 ? 1 : -1));
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                        event.preventDefault();
                        const current = dimensionValue(property);
                        updateStyle(property, nudgeCssValue(current, event.key === "ArrowUp" ? 1 : -1, event.shiftKey ? 10 : 1));
                      }}
                      placeholder="auto, px, %, rem, em"
                    />
                  </label>
                )
              )}
              {isLayout && (
                <>
                  <label>
                    Column Gap
                    <input
                      value={selectedElement.columnGap ?? ""}
                      onChange={(event) => updateSelected((element) => ({ ...element, columnGap: event.target.value }))}
                      placeholder="20px, 2rem"
                    />
                  </label>
                  <label>
                    Row Gap
                    <input
                      value={selectedElement.rowGap ?? ""}
                      onChange={(event) => updateSelected((element) => ({ ...element, rowGap: event.target.value }))}
                      placeholder="20px, 2rem"
                    />
                  </label>
                  <label>
                    Align Content
                    <select
                      value={selectedElement.alignContent ?? "stretch"}
                      onChange={(event) => updateSelected((element) => ({ ...element, alignContent: event.target.value as PageBuilderElement["alignContent"] }))}
                    >
                      <option value="stretch">Stretch</option>
                      <option value="start">Start</option>
                      <option value="center">Center</option>
                      <option value="end">End</option>
                      <option value="space-between">Space between</option>
                      <option value="space-around">Space around</option>
                    </select>
                  </label>
                  <label>
                    Align Items
                    <select
                      value={selectedElement.alignItems ?? "stretch"}
                      onChange={(event) =>
                        updateSelected((element) => ({
                          ...element,
                          alignItems: event.target.value,
                        }))
                      }
                    >
                      <option value="stretch">Stretch</option>
                      <option value="start">Start</option>
                      <option value="center">Center</option>
                      <option value="end">End</option>
                    </select>
                  </label>
                  <label>
                    Justify Content
                    <select
                      value={selectedElement.justifyContent ?? "start"}
                      onChange={(event) =>
                        updateSelected((element) => ({
                          ...element,
                          justifyContent: event.target.value,
                        }))
                      }
                    >
                      <option value="start">Start</option>
                      <option value="center">Center</option>
                      <option value="end">End</option>
                      <option value="space-between">Space Between</option>
                      <option value="space-around">Space Around</option>
                      <option value="space-evenly">Space Evenly</option>
                    </select>
                  </label>
                </>
              )}
              <p className={styles.fieldGroupTitle}>Flex item</p>
              {(["flexBasis", "flexGrow", "flexShrink", "order"] as const).map((property) => (
                <label key={property}>
                  {property}
                  <input
                    value={selectedElement.styles?.[property] ?? ""}
                    onChange={(event) => updateStyle(property, event.target.value)}
                    placeholder={property === "flexBasis" ? "auto, 200px, 30%" : "0"}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                      if (property === "flexBasis") return;
                      event.preventDefault();
                      const current = Number(selectedElement.styles?.[property] ?? 0);
                      const next = Math.max(0, current + (event.key === "ArrowUp" ? 1 : -1));
                      updateStyle(property, String(next));
                    }}
                  />
                </label>
              ))}
              <label>
                Overflow
                <select
                  value={selectedElement.styles?.overflow ?? "visible"}
                  onChange={(event) => updateStyle("overflow", event.target.value)}
                >
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                  <option value="auto">Auto</option>
                </select>
              </label>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={removeSelected}
              >
                <Trash2 size={15} /> Remove element
              </button>
            </>
          )}
        </div>
      </>
    );
  }

  function chooseMedia(item: MediaPickerItem) {
    if (mediaPickerPurpose === "background") {
      updateStyle("backgroundImage", item.url);
    } else {
      updateSelected((element) => ({ ...element, src: item.url }));
    }
    setImagePickerOpen(false);
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spin} size={22} />
        Loading page builder...
      </div>
    );
  }

  return (
    <main className={styles.builder}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <Link className={styles.backButton} href={editUrl}>
            <ArrowLeft size={17} /> Back
          </Link>
          <div className={styles.pageName}>
            <strong>{pageTitle}</strong>
            <span>{target.kind === "page" ? "Page" : "Post"} Builder · {pageStatus === "PUBLISHED" ? "Published" : "Draft"}</span>
          </div>
        </div>
        <div className={styles.topbarActions}>
          <div className={styles.deviceSwitch} aria-label="Preview device">
            {(["desktop", "tablet", "mobile"] as const).map((choice) => (
              <button
                type="button"
                key={choice}
                aria-label={`${choice} preview`}
                title={`${choice} preview`}
                className={device === choice ? styles.activeDevice : ""}
                onClick={() => setDevice(choice)}
              >
                {getDeviceIcon(choice)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.saveButton}
            disabled={saving}
            onClick={() => void save("saveDraft")}
          >
            {saving ? <Loader2 className={styles.spin} size={16} /> : <Save size={16} />}
            Save Draft
          </button>
          <button
            type="button"
            className={styles.publishButton}
            disabled={saving}
            onClick={() => void save("publish")}
          >
            {saving ? <Loader2 className={styles.spin} size={16} /> : <Eye size={16} />}
            Publish
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className={`${styles.message} ${error ? styles.error : styles.success}`}>
          {error || notice}
          <button
            type="button"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.workspace}>
        <aside className={styles.widgetsPanel}>
          <h2>Widgets</h2>
          <div className={styles.widgetList}>
            {widgetTypes.map((type) => (
              <button
                type="button"
                key={type}
                draggable
                onDragStart={(event) => handleWidgetDragStart(event, type)}
                onClick={() => addElement(type)}
              >
                <span>{type === "container" || type === "section" ? <Grid2X2 size={16} /> : type === "image" ? <ImageIcon size={16} /> : <Plus size={16} />}</span>
                {type[0].toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <div className={styles.panelHint}>Drag a widget into the canvas or click to add it.</div>
        </aside>

        <section
          className={`${styles.canvasArea} ${styles[device]}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDrop(event, null)}
        >
          <div className={styles.canvasToolbar}>
            <span>Live Preview</span>
            <span>{device[0].toUpperCase() + device.slice(1)}</span>
          </div>
          <div className={styles.canvasViewport}>
            <div className={styles.canvasPage} style={canvasStyle}>
              {layout.elements.length ? (
                layout.elements.map(renderCanvasElement)
              ) : (
                <div className={styles.emptyCanvas}>
                  <Grid2X2 size={30} />
                  <strong>Start building your page</strong>
                  <span>Add a section, container, or widget to the canvas.</span>
                  <button type="button" onClick={() => addElement("section")}>
                    <Plus size={15} /> Add Section
                  </button>
                </div>
              )}
              <div className={styles.canvasDropTarget}>
                Drop here to add to the page
              </div>
            </div>
          </div>
        </section>

        <aside className={styles.structurePanel}>
          <div className={styles.inspectorHeader}>
            <h2>Structure</h2>
          </div>
          <div className={styles.structureTree}>
            {layout.elements.length ? (
              renderStructureItems(layout.elements)
            ) : (
              <p className={styles.emptyInspector}>Your page structure will appear here.</p>
            )}
          </div>
        </aside>

        <aside className={styles.inspector}>
          <div className={styles.inspectorHeader}>
            <h2>{selectedElement ? selectedElement.type : "Settings"}</h2>
            {selectedElement && (
              <span className={styles.inspectorActions}>
                <button
                  type="button"
                  title="Page settings"
                  onClick={() => setSelectedId("")}
                >
                  <Settings2 size={15} />
                </button>
                <button type="button" title="Remove element" onClick={removeSelected}>
                  <Trash2 size={16} />
                </button>
              </span>
            )}
          </div>
          {renderInspector()}
        </aside>
      </div>

      <MediaPickerModal
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={chooseMedia}
      />
    </main>
  );
}
