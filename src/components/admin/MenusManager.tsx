"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Plus,
  Trash2,
  Save,
  GripVertical,
  Link as LinkIcon,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  Menu as MenuIcon,
  RotateCcw,
  ExternalLink,
  Settings2,
} from "lucide-react";
import styles from "./MenusManager.module.css";

type PageOption = {
  id: string;
  title: string;
  slug: string;
};

type MenuItem = {
  id: string;
  label: string;
  type: "PAGE" | "CUSTOM_LINK";
  url: string;
  pageId: string;
  target: "_self" | "_blank";
  children: MenuItem[];
};

type FlatMenuItem = {
  id: string;
  menuId: string;
  parentId: string | null;
  label: string;
  type: "PAGE" | "CUSTOM_LINK";
  url: string;
  pageId: string;
  target: "_self" | "_blank";
  sortOrder: number;
  page?: PageOption | null;
};

type Menu = {
  id: string;
  name: string;
  location: "HEADER" | "FOOTER" | null;
  items: FlatMenuItem[];
};

type MenuDraft = {
  id: string;
  name: string;
  location: "HEADER" | "FOOTER" | null;
  items: MenuItem[];
};

type SerializedMenuItem = {
  label: string;
  type: "PAGE" | "CUSTOM_LINK";
  url?: string;
  pageId?: string;
  target: "_self" | "_blank";
  children: SerializedMenuItem[];
};

const makeId = () =>
  `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function flatToTree(items: FlatMenuItem[]): MenuItem[] {
  const nodes = new Map<string, MenuItem>();

  items.forEach((item) => {
    nodes.set(item.id, {
      id: item.id,
      label: item.label,
      type: item.type,
      url: item.url || "",
      pageId: item.pageId || "",
      target: item.target || "_self",
      children: [],
    });
  });

  const roots: MenuItem[] = [];

  items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((item) => {
      const node = nodes.get(item.id);

      if (!node) return;

      if (item.parentId && nodes.has(item.parentId)) {
        nodes.get(item.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

  return roots;
}

function flattenOptions(
  items: MenuItem[],
  depth = 0
): { id: string; label: string; depth: number }[] {
  return items.flatMap((item) => [
    { id: item.id, label: item.label, depth },
    ...flattenOptions(item.children, depth + 1),
  ]);
}

function updateTree(
  items: MenuItem[],
  id: string,
  updater: (item: MenuItem) => MenuItem
): MenuItem[] {
  return items.map((item) =>
    item.id === id
      ? updater(item)
      : {
          ...item,
          children: updateTree(item.children, id, updater),
        }
  );
}

function removeFromTree(
  items: MenuItem[],
  id: string
): { items: MenuItem[]; removed: MenuItem | null } {
  const index = items.findIndex((item) => item.id === id);

  if (index >= 0) {
    const next = [...items];
    const [removed] = next.splice(index, 1);

    return { items: next, removed };
  }

  let removed: MenuItem | null = null;

  const next = items.map((item) => {
    const result = removeFromTree(item.children, id);

    if (result.removed) {
      removed = result.removed;
    }

    return {
      ...item,
      children: result.items,
    };
  });

  return { items: next, removed };
}

function insertBefore(
  items: MenuItem[],
  targetId: string,
  node: MenuItem
): { items: MenuItem[]; inserted: boolean } {
  const index = items.findIndex((item) => item.id === targetId);

  if (index >= 0) {
    const next = [...items];
    next.splice(index, 0, node);

    return { items: next, inserted: true };
  }

  for (let i = 0; i < items.length; i++) {
    const result = insertBefore(items[i].children, targetId, node);

    if (result.inserted) {
      const next = [...items];
      next[i] = {
        ...next[i],
        children: result.items,
      };

      return { items: next, inserted: true };
    }
  }

  return { items, inserted: false };
}

function addUnderParent(
  items: MenuItem[],
  parentId: string,
  node: MenuItem
): MenuItem[] {
  return items.map((item) =>
    item.id === parentId
      ? {
          ...item,
          children: [...item.children, node],
        }
      : {
          ...item,
          children: addUnderParent(item.children, parentId, node),
        }
  );
}

function serializeItems(items: MenuItem[]): SerializedMenuItem[] {
  return items.map((item) => ({
    label: item.label,
    type: item.type,
    url: item.type === "CUSTOM_LINK" ? item.url : undefined,
    pageId: item.type === "PAGE" ? item.pageId : undefined,
    target: item.target,
    children: serializeItems(item.children),
  }));
}

export default function MenusManager() {
  const [menus, setMenus] = useState<MenuDraft[]>([]);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [activeId, setActiveId] = useState("");

  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuLocation, setNewMenuLocation] = useState<
    "HEADER" | "FOOTER" | "NONE"
  >("NONE");

  const [activeSection, setActiveSection] = useState<
    "pages" | "custom"
  >("pages");

  const [pageSearch, setPageSearch] = useState("");
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);

  const [itemLabel, setItemLabel] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemTarget, setItemTarget] = useState<"_self" | "_blank">("_self");
  const [parentId, setParentId] = useState("");

  const [expandedItems, setExpandedItems] = useState<
    Record<string, boolean>
  >({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draggedId, setDraggedId] = useState("");

  const activeMenu = menus.find((menu) => menu.id === activeId);

  const parentOptions = useMemo(
    () => (activeMenu ? flattenOptions(activeMenu.items) : []),
    [activeMenu]
  );

  const filteredPages = useMemo(() => {
    const search = pageSearch.trim().toLowerCase();

    if (!search) return pages;

    return pages.filter(
      (page) =>
        page.title.toLowerCase().includes(search) ||
        page.slug.toLowerCase().includes(search)
    );
  }, [pages, pageSearch]);

  const loadMenus = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/menus", {
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load menus.");
      }

      const loadedMenus: MenuDraft[] = (result.menus || []).map(
        (menu: Menu) => ({
          id: menu.id,
          name: menu.name,
          location: menu.location,
          items: flatToTree(menu.items || []),
        })
      );

      setMenus(loadedMenus);
      setPages(result.pages || []);

      setActiveId((current) =>
        loadedMenus.some((menu) => menu.id === current)
          ? current
          : loadedMenus[0]?.id || ""
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load menus."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenus();
  }, [loadMenus]);

  function updateActiveMenu(updater: (menu: MenuDraft) => MenuDraft) {
    setMenus((current) =>
      current.map((menu) =>
        menu.id === activeId ? updater(menu) : menu
      )
    );
  }

  async function createMenu() {
    if (!newMenuName.trim() || saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newMenuName.trim(),
          location:
            newMenuLocation === "NONE" ? null : newMenuLocation,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to create menu.");
      }

      setNewMenuName("");
      setNewMenuLocation("NONE");
      setNotice(result.message || "Menu created successfully.");

      await loadMenus();

      if (result.menu?.id) {
        setActiveId(result.menu.id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create menu."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveMenu() {
    if (!activeMenu || saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/menus/${activeMenu.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: activeMenu.name,
            location: activeMenu.location,
            items: serializeItems(activeMenu.items),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save menu.");
      }

      setNotice(result.message || "Menu saved successfully.");
      await loadMenus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save menu."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteMenu() {
    if (!activeMenu || saving) return;

    if (
      !window.confirm(
        `Delete "${activeMenu.name}" menu permanently?`
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/menus/${activeMenu.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to delete menu.");
      }

      setNotice(result.message || "Menu deleted.");
      await loadMenus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete menu."
      );
    } finally {
      setSaving(false);
    }
  }

  function togglePageSelection(pageId: string) {
    setSelectedPageIds((current) =>
      current.includes(pageId)
        ? current.filter((id) => id !== pageId)
        : [...current, pageId]
    );
  }

  function addSelectedPages() {
    if (!activeMenu || selectedPageIds.length === 0) return;

    const selectedPages = pages.filter((page) =>
      selectedPageIds.includes(page.id)
    );

    const newItems: MenuItem[] = selectedPages.map((page) => ({
      id: makeId(),
      label: page.title,
      type: "PAGE",
      url: "",
      pageId: page.id,
      target: "_self",
      children: [],
    }));

    updateActiveMenu((menu) => ({
      ...menu,
      items: [...menu.items, ...newItems],
    }));

    setSelectedPageIds([]);
    setNotice(
      `${newItems.length} page(s) added. Click Save Menu to apply changes.`
    );
    setError("");
  }

  function addCustomLink() {
    if (!activeMenu) return;

    if (!itemLabel.trim()) {
      setError("Please enter a navigation label.");
      return;
    }

    if (!itemUrl.trim()) {
      setError("Please enter a custom URL.");
      return;
    }

    const item: MenuItem = {
      id: makeId(),
      label: itemLabel.trim(),
      type: "CUSTOM_LINK",
      url: itemUrl.trim(),
      pageId: "",
      target: itemTarget,
      children: [],
    };

    updateActiveMenu((menu) => ({
      ...menu,
      items: parentId
        ? addUnderParent(menu.items, parentId, item)
        : [...menu.items, item],
    }));

    setItemLabel("");
    setItemUrl("");
    setItemTarget("_self");
    setParentId("");
    setError("");
    setNotice("Custom link added. Click Save Menu to apply changes.");
  }

  function deleteItem(id: string) {
    if (!activeMenu) return;

    updateActiveMenu((menu) => ({
      ...menu,
      items: removeFromTree(menu.items, id).items,
    }));

    setNotice("Menu item removed. Save Menu to apply changes.");
  }

  function moveItemBefore(targetId: string) {
    if (!activeMenu || !draggedId || draggedId === targetId) return;

    const removed = removeFromTree(activeMenu.items, draggedId);

    if (!removed.removed) return;

    const inserted = insertBefore(
      removed.items,
      targetId,
      removed.removed
    );

    if (!inserted.inserted) return;

    updateActiveMenu((menu) => ({
      ...menu,
      items: inserted.items,
    }));

    setDraggedId("");
  }

  function nestItem(targetId: string) {
    if (!activeMenu || !draggedId || draggedId === targetId) return;

    const removed = removeFromTree(activeMenu.items, draggedId);

    if (!removed.removed) return;

    const targetExists = flattenOptions(removed.items).some(
      (item) => item.id === targetId
    );

    if (!targetExists) return;

    updateActiveMenu((menu) => ({
      ...menu,
      items: addUnderParent(
        removed.items,
        targetId,
        removed.removed!
      ),
    }));

    setDraggedId("");
  }

  function toggleItem(id: string) {
    setExpandedItems((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function renderItems(
    items: MenuItem[],
    depth = 0
  ): ReactNode {
    return items.map((item) => {
      const page = pages.find(
        (entry) => entry.id === item.pageId
      );

      const expanded = expandedItems[item.id] ?? false;

      return (
        <div className={styles.menuNode} key={item.id}>
          <div
            className={`${styles.menuItem} ${
              draggedId === item.id ? styles.dragging : ""
            }`}
            style={{ marginLeft: depth * 28 }}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              setDraggedId(item.id);
            }}
            onDragEnd={() => setDraggedId("")}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              moveItemBefore(item.id);
            }}
          >
            <button
              type="button"
              className={styles.dragHandle}
              title="Drag to reorder"
              aria-label="Drag menu item"
              onClick={(event) => event.preventDefault()}
            >
              <GripVertical size={17} />
            </button>

            <button
              type="button"
              className={styles.itemExpand}
              onClick={() => toggleItem(item.id)}
              aria-label={expanded ? "Collapse item" : "Expand item"}
            >
              {expanded ? (
                <ChevronDown size={17} />
              ) : (
                <ChevronRight size={17} />
              )}
            </button>

            <div className={styles.itemSummary}>
              <strong>{item.label || "(No label)"}</strong>
              <span>
                {item.type === "PAGE" ? (
                  <>
                    <FileText size={12} />
                    {page ? `/${page.slug}` : "Website Page"}
                  </>
                ) : (
                  <>
                    <LinkIcon size={12} />
                    {item.url}
                  </>
                )}
              </span>
            </div>

            <span className={styles.itemType}>
              {item.type === "PAGE" ? "Page" : "Custom Link"}
            </span>

            <button
              type="button"
              className={styles.itemEdit}
              onClick={() => toggleItem(item.id)}
              title="Edit menu item"
            >
              Edit
            </button>
          </div>

          {expanded && (
            <div
              className={styles.itemSettings}
              style={{ marginLeft: depth * 28 }}
            >
              <div className={styles.settingsGrid}>
                <div className={styles.field}>
                  <label htmlFor={`label-${item.id}`}>
                    Navigation Label
                  </label>
                  <input
                    id={`label-${item.id}`}
                    value={item.label}
                    onChange={(event) => {
                      const value = event.target.value;

                      updateActiveMenu((menu) => ({
                        ...menu,
                        items: updateTree(
                          menu.items,
                          item.id,
                          (current) => ({
                            ...current,
                            label: value,
                          })
                        ),
                      }));
                    }}
                  />
                </div>

                {item.type === "CUSTOM_LINK" && (
                  <div className={styles.field}>
                    <label htmlFor={`url-${item.id}`}>
                      URL
                    </label>
                    <input
                      id={`url-${item.id}`}
                      value={item.url}
                      onChange={(event) => {
                        const value = event.target.value;

                        updateActiveMenu((menu) => ({
                          ...menu,
                          items: updateTree(
                            menu.items,
                            item.id,
                            (current) => ({
                              ...current,
                              url: value,
                            })
                          ),
                        }));
                      }}
                    />
                  </div>
                )}

                <div className={styles.field}>
                  <label htmlFor={`target-${item.id}`}>
                    Open Link In
                  </label>
                  <select
                    id={`target-${item.id}`}
                    value={item.target}
                    onChange={(event) => {
                      const value = event.target.value as
                        | "_self"
                        | "_blank";

                      updateActiveMenu((menu) => ({
                        ...menu,
                        items: updateTree(
                          menu.items,
                          item.id,
                          (current) => ({
                            ...current,
                            target: value,
                          })
                        ),
                      }));
                    }}
                  >
                    <option value="_self">Same Tab</option>
                    <option value="_blank">New Tab</option>
                  </select>
                </div>
              </div>

              <div className={styles.itemFooter}>
                <span>
                  {item.children.length > 0
                    ? `${item.children.length} child item(s)`
                    : "No child items"}
                </span>

                <button
                  type="button"
                  className={styles.removeLink}
                  onClick={() => deleteItem(item.id)}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </div>
          )}

          {item.children.length > 0 && (
            <div className={styles.children}>
              {renderItems(item.children, depth + 1)}
            </div>
          )}

          {draggedId && draggedId !== item.id && (
            <button
              type="button"
              className={styles.nestDrop}
              style={{ marginLeft: (depth + 1) * 28 }}
              onClick={() => nestItem(item.id)}
            >
              Drop here to make “{item.label}” the parent
            </button>
          )}
        </div>
      );
    });
  }

  return (
    <div className={styles.menusPage}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Menus</h1>
          <p>
            Create and manage navigation menus for your website.
          </p>
        </div>
      </div>

      {error && (
        <div className={`${styles.notice} ${styles.error}`}>
          <X size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}

      {notice && (
        <div className={`${styles.notice} ${styles.success}`}>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}

      <section className={styles.createMenuBox}>
        <div className={styles.createMenuHeading}>
          <div>
            <Plus size={17} />
            <strong>Create a New Menu</strong>
          </div>
        </div>

        <div className={styles.createMenuBody}>
          <div className={styles.createFields}>
            <div className={styles.field}>
              <label htmlFor="new-menu-name">Menu Name</label>
              <input
                id="new-menu-name"
                value={newMenuName}
                onChange={(event) =>
                  setNewMenuName(event.target.value)
                }
                placeholder="e.g. Main Menu"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="new-menu-location">
                Display Location
              </label>
              <select
                id="new-menu-location"
                value={newMenuLocation}
                onChange={(event) =>
                  setNewMenuLocation(
                    event.target.value as
                      | "HEADER"
                      | "FOOTER"
                      | "NONE"
                  )
                }
              >
                <option value="NONE">Do not assign</option>
                <option value="HEADER">Primary Header</option>
                <option value="FOOTER">Footer Menu</option>
              </select>
            </div>

            <button
              type="button"
              className={styles.primaryButton}
              disabled={saving || !newMenuName.trim()}
              onClick={() => void createMenu()}
            >
              <Plus size={16} />
              Create Menu
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className={styles.loading}>
          <Loader2 size={25} className={styles.spinner} />
          <p>Loading menus...</p>
        </div>
      ) : (
        <div className={styles.editorLayout}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeading}>
              <MenuIcon size={17} />
              <strong>Menu Management</strong>
            </div>

            <div className={styles.menuList}>
              <div className={styles.menuListTitle}>
                Your Menus
              </div>

              {menus.length === 0 ? (
                <div className={styles.noMenus}>
                  No menus created yet.
                </div>
              ) : (
                menus.map((menu) => (
                  <button
                    type="button"
                    key={menu.id}
                    className={`${styles.menuSelect} ${
                      activeId === menu.id ? styles.menuActive : ""
                    }`}
                    onClick={() => {
                      setActiveId(menu.id);
                      setSelectedPageIds([]);
                      setError("");
                      setNotice("");
                    }}
                  >
                    <MenuIcon size={16} />
                    <span>{menu.name}</span>
                    {menu.location && (
                      <small>
                        {menu.location === "HEADER"
                          ? "Header"
                          : "Footer"}
                      </small>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className={styles.sidebarHelp}>
              <Settings2 size={17} />
              <div>
                <strong>Menu locations</strong>
                <p>
                  Assign a menu to Header or Footer to display it
                  on your website.
                </p>
              </div>
            </div>
          </aside>

          <main className={styles.editor}>
            {!activeMenu ? (
              <div className={styles.noActiveMenu}>
                <MenuIcon size={34} />
                <h3>Select or create a menu</h3>
                <p>
                  Choose a menu from the left panel or create a new
                  menu to start building your navigation.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.editorHeader}>
                  <div>
                    <h2>
                      Edit Menu: <strong>{activeMenu.name}</strong>
                    </h2>
                    <p>
                      Add, remove, and organize menu items below.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={saving || !activeMenu.name.trim()}
                    onClick={() => void saveMenu()}
                  >
                    {saving ? (
                      <Loader2 size={16} className={styles.spinner} />
                    ) : (
                      <Save size={16} />
                    )}
                    Save Menu
                  </button>
                </div>

                <div className={styles.menuSettings}>
                  <div className={styles.field}>
                    <label htmlFor="edit-menu-name">
                      Menu Name
                    </label>
                    <input
                      id="edit-menu-name"
                      value={activeMenu.name}
                      onChange={(event) =>
                        updateActiveMenu((menu) => ({
                          ...menu,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="edit-menu-location">
                      Display Location
                    </label>
                    <select
                      id="edit-menu-location"
                      value={activeMenu.location || "NONE"}
                      onChange={(event) =>
                        updateActiveMenu((menu) => ({
                          ...menu,
                          location:
                            event.target.value === "NONE"
                              ? null
                              : (event.target.value as
                                  | "HEADER"
                                  | "FOOTER"),
                        }))
                      }
                    >
                      <option value="NONE">Do not assign</option>
                      <option value="HEADER">Primary Header</option>
                      <option value="FOOTER">Footer Menu</option>
                    </select>
                  </div>
                </div>

                <div className={styles.builderLayout}>
                  <section className={styles.addItemsPanel}>
                    <div className={styles.sectionHeading}>
                      <h3>Add Menu Items</h3>
                    </div>

                    <div className={styles.accordion}>
                      <div className={styles.accordionSection}>
                        <button
                          type="button"
                          className={`${styles.accordionTitle} ${
                            activeSection === "pages"
                              ? styles.accordionActive
                              : ""
                          }`}
                          onClick={() => setActiveSection("pages")}
                        >
                          <span>
                            {activeSection === "pages" ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                            <FileText size={16} />
                            Pages
                          </span>
                          <small>{pages.length}</small>
                        </button>

                        {activeSection === "pages" && (
                          <div className={styles.accordionContent}>
                            <input
                              className={styles.searchInput}
                              value={pageSearch}
                              onChange={(event) =>
                                setPageSearch(event.target.value)
                              }
                              placeholder="Search pages..."
                            />

                            <div className={styles.pageList}>
                              {filteredPages.length === 0 ? (
                                <p className={styles.emptyText}>
                                  No pages found.
                                </p>
                              ) : (
                                filteredPages.map((page) => (
                                  <label
                                    key={page.id}
                                    className={styles.pageOption}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedPageIds.includes(
                                        page.id
                                      )}
                                      onChange={() =>
                                        togglePageSelection(page.id)
                                      }
                                    />
                                    <span>
                                      <strong>{page.title}</strong>
                                      <small>/{page.slug}</small>
                                    </span>
                                  </label>
                                ))
                              )}
                            </div>

                            <div className={styles.addPanelFooter}>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                disabled={
                                  selectedPageIds.length === 0
                                }
                                onClick={addSelectedPages}
                              >
                                Add to Menu
                                {selectedPageIds.length > 0
                                  ? ` (${selectedPageIds.length})`
                                  : ""}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={styles.accordionSection}>
                        <button
                          type="button"
                          className={`${styles.accordionTitle} ${
                            activeSection === "custom"
                              ? styles.accordionActive
                              : ""
                          }`}
                          onClick={() => setActiveSection("custom")}
                        >
                          <span>
                            {activeSection === "custom" ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                            <LinkIcon size={16} />
                            Custom Links
                          </span>
                        </button>

                        {activeSection === "custom" && (
                          <div className={styles.accordionContent}>
                            <div className={styles.field}>
                              <label htmlFor="custom-url">
                                URL
                              </label>
                              <input
                                id="custom-url"
                                value={itemUrl}
                                onChange={(event) =>
                                  setItemUrl(event.target.value)
                                }
                                placeholder="https://example.com"
                              />
                            </div>

                            <div className={styles.field}>
                              <label htmlFor="custom-label">
                                Link Text
                              </label>
                              <input
                                id="custom-label"
                                value={itemLabel}
                                onChange={(event) =>
                                  setItemLabel(event.target.value)
                                }
                                placeholder="e.g. Contact Us"
                              />
                            </div>

                            <div className={styles.field}>
                              <label htmlFor="custom-target">
                                Open Link In
                              </label>
                              <select
                                id="custom-target"
                                value={itemTarget}
                                onChange={(event) =>
                                  setItemTarget(
                                    event.target.value as
                                      | "_self"
                                      | "_blank"
                                  )
                                }
                              >
                                <option value="_self">
                                  Same Tab
                                </option>
                                <option value="_blank">
                                  New Tab
                                </option>
                              </select>
                            </div>

                            <div className={styles.field}>
                              <label htmlFor="custom-parent">
                                Parent Menu
                              </label>
                              <select
                                id="custom-parent"
                                value={parentId}
                                onChange={(event) =>
                                  setParentId(event.target.value)
                                }
                              >
                                <option value="">Top Level</option>
                                {parentOptions.map((item) => (
                                  <option
                                    key={item.id}
                                    value={item.id}
                                  >
                                    {"— ".repeat(item.depth)}
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className={styles.addPanelFooter}>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={addCustomLink}
                              >
                                <Plus size={15} />
                                Add to Menu
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className={styles.structurePanel}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <h3>Menu Structure</h3>
                        <p>
                          Drag each item into the order you prefer.
                          Click the arrow to edit item details.
                        </p>
                      </div>

                      <span className={styles.itemCount}>
                        {parentOptions.length} items
                      </span>
                    </div>

                    {activeMenu.items.length === 0 ? (
                      <div className={styles.emptyStructure}>
                        <MenuIcon size={30} />
                        <strong>No menu items yet</strong>
                        <p>
                          Select pages or add custom links from the
                          left panel.
                        </p>
                      </div>
                    ) : (
                      <div className={styles.menuStructure}>
                        {renderItems(activeMenu.items)}
                      </div>
                    )}

                    <div className={styles.structureHelp}>
                      <strong>Menu organization</strong>
                      <p>
                        Drag items to change their order. Use the
                        Parent Menu selector under Custom Links or
                        the drop option to create dropdown levels.
                      </p>
                    </div>
                  </section>
                </div>

                <div className={styles.menuLocationBox}>
                  <strong>Menu Settings</strong>
                  <label>
                    <input
                      type="checkbox"
                      checked={activeMenu.location === "HEADER"}
                      onChange={(event) =>
                        updateActiveMenu((menu) => ({
                          ...menu,
                          location: event.target.checked
                            ? "HEADER"
                            : null,
                        }))
                      }
                    />
                    Display location: Primary Header
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={activeMenu.location === "FOOTER"}
                      onChange={(event) =>
                        updateActiveMenu((menu) => ({
                          ...menu,
                          location: event.target.checked
                            ? "FOOTER"
                            : null,
                        }))
                      }
                    />
                    Display location: Footer Menu
                  </label>
                </div>

                <div className={styles.bottomActions}>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    disabled={saving}
                    onClick={() => void deleteMenu()}
                  >
                    <Trash2 size={15} />
                    Delete Menu
                  </button>

                  <div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={saving}
                      onClick={() => void loadMenus()}
                    >
                      <RotateCcw size={15} />
                      Reload
                    </button>

                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={saving || !activeMenu.name.trim()}
                      onClick={() => void saveMenu()}
                    >
                      {saving ? (
                        <Loader2
                          size={15}
                          className={styles.spinner}
                        />
                      ) : (
                        <Save size={15} />
                      )}
                      Save Menu
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}