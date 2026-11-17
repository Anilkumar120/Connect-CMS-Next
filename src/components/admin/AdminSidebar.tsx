
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Folder,
  Images,
  MapPin,
  Newspaper,
  Package,
  ShoppingBag,
  Ticket,
  X,
  ChevronLeft,
} from "lucide-react";

import { adminMenu } from "./AdminMenu";

type SidebarContentType = {
  id: string;
  title: string;
  slug: string;
  icon: string;
};

type AdminSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onCollapse: () => void;
};

const contentTypeIcons = {
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Folder,
  Images,
  MapPin,
  Newspaper,
  Package,
  ShoppingBag,
  Ticket,
} as const;

export default function AdminSidebar({
  collapsed,
  mobileOpen,
  onClose,
  onCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const [contentTypes, setContentTypes] = useState<
    SidebarContentType[]
  >([]);

  const [faviconError, setFaviconError] = useState(false);

  // Load custom content types
  useEffect(() => {
    let active = true;

    async function loadContentTypes() {
      try {
        const response = await fetch(
          "/api/admin/content-types",
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          const responseText = await response.text();

          throw new Error(
            `Content Types API returned non-JSON response (${response.status}): ${responseText.slice(0, 200)}`
          );
        }

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Unable to load custom post types."
          );
        }

        if (active) {
          setContentTypes(
            Array.isArray(result.contentTypes)
              ? result.contentTypes
              : []
          );
        }
      } catch (error) {
        console.error(
          "Load sidebar content types error:",
          error
        );
      }
    }

    void loadContentTypes();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div
        className={`admin-sidebar-overlay ${
          mobileOpen ? "show" : ""
        }`}
        onClick={onClose}
      />

      <aside
        className={[
          "admin-sidebar",
          collapsed ? "collapsed" : "",
          mobileOpen ? "mobile-open" : "",
        ].join(" ")}
      >
        {/* Sidebar Header */}
        <div className="admin-sidebar-header">
          <Link
            href="/admin"
            className="admin-brand"
            onClick={onClose}
            title="Connect CMS"
          >
            <span className="admin-brand-icon">
              {!faviconError ? (
                <img
                  src="/favicon.ico"
                  alt="Connect Broadband Favicon"
                  className="admin-sidebar-favicon"
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <span className="admin-brand-fallback">
                  C
                </span>
              )}
            </span>

            {!collapsed && (
              <span className="admin-brand-text">
                CONNECT <strong>CMS</strong>
              </span>
            )}
          </Link>

          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Sidebar Menu */}
        <div className="admin-sidebar-menu">
          {adminMenu.map((item) => {
            if ("section" in item) {
              return (
                <div
                  className="admin-menu-section"
                  key={item.section}
                >
                  {!collapsed && item.section}
                </div>
              );
            }

            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            const Icon = item.icon;

            return (
              <div
                className={[
                  "admin-sidebar-menu-group",
                  active ? "active" : "",
                ].join(" ")}
                key={item.href}
              >
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`admin-menu-link ${
                    active ? "active" : ""
                  }`}
                  title={collapsed ? item.title : undefined}
                >
                  <Icon size={19} strokeWidth={1.8} />

                  {!collapsed && (
                    <span>{item.title}</span>
                  )}
                </Link>
              </div>
            );
          })}

          {/* Custom Content Types */}
          {!collapsed && (
            <div className="admin-menu-section">
              CUSTOM CONTENT
            </div>
          )}

          {contentTypes.map((contentType) => {
            const ContentIcon =
              contentTypeIcons[
                contentType.icon as keyof typeof contentTypeIcons
              ] || FileText;

            const href = `/admin/content-types/${contentType.slug}/posts`;

            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`);

            return (
              <Link
                href={href}
                key={contentType.id}
                onClick={onClose}
                className={`admin-menu-link ${
                  active ? "active" : ""
                }`}
                title={
                  collapsed ? contentType.title : undefined
                }
              >
                <ContentIcon size={19} strokeWidth={1.8} />

                {!collapsed && (
                  <span>{contentType.title}</span>
                )}
              </Link>
            );
          })}

          {/* Custom Post Types */}
          <Link
            href="/admin/content-types"
            onClick={onClose}
            className={`admin-menu-link ${
              pathname === "/admin/content-types"
                ? "active"
                : ""
            }`}
            title={
              collapsed ? "Custom Post Types" : undefined
            }
          >
            <Folder size={19} strokeWidth={1.8} />

            {!collapsed && (
              <span>Custom Post Types</span>
            )}
          </Link>
        </div>

        {/* Sidebar Footer */}
        <div className="admin-sidebar-footer">
          {!collapsed && (
            <div>
              <strong>Connect Broadband</strong>
              <span>CMS Version 1.0</span>
            </div>
          )}

          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={onCollapse}
            aria-label="Toggle sidebar"
            title="Collapse sidebar"
          >
            <ChevronLeft
              size={18}
              className={collapsed ? "rotate-icon" : ""}
            />
          </button>
        </div>
      </aside>
    </>
  );
}
