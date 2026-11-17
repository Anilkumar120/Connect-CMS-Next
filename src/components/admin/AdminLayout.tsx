
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";

type AdminUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  avatarUrl: string | null;
};

type AdminLayoutProps = {
  children: React.ReactNode;
  user: AdminUser;
};

export default function AdminLayout({
  children,
  user,
}: AdminLayoutProps) {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Hide sidebar and topbar only on actual visual builders.
  const isPageBuilder =
    /^\/admin\/builder\/(pages|posts)\/[^/]+\/?$/.test(pathname) ||
    /^\/admin\/builder\/custom\/[^/]+\/[^/]+\/?$/.test(pathname);

  const isHeaderFooterBuilder =
    pathname === "/admin/appearance/header-builder" ||
    pathname === "/admin/appearance/footer-builder";

  const builderMode = isPageBuilder || isHeaderFooterBuilder;

  return (
    <div
      className={`admin-shell ${
        collapsed ? "sidebar-collapsed" : ""
      } ${builderMode ? "admin-builder-mode" : ""}`}
    >
      {!builderMode && (
        <AdminSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onCollapse={() =>
            setCollapsed((current) => !current)
          }
        />
      )}

      <div className="admin-main">
        {!builderMode && (
          <AdminTopbar
            user={user}
            onMenuToggle={() =>
              setMobileOpen((current) => !current)
            }
          />
        )}

        <main className="admin-page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
