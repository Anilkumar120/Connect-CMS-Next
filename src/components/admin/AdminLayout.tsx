"use client";

import { Suspense, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
  children: ReactNode;
  user: AdminUser;
};

type AdminLayoutFrameProps = AdminLayoutProps & {
  builderMode: boolean;
};

function AdminLayoutFrame({
  children,
  user,
  builderMode,
}: AdminLayoutFrameProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className={`admin-shell ${collapsed ? "sidebar-collapsed" : ""} ${
        builderMode ? "admin-builder-mode" : ""
      }`}
    >
      {!builderMode && (
        <AdminSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onCollapse={() => setCollapsed((current) => !current)}
        />
      )}

      <div className="admin-main">
        {!builderMode && (
          <AdminTopbar
            user={user}
            onMenuToggle={() => setMobileOpen((current) => !current)}
          />
        )}

        <main className="admin-page-content">{children}</main>
      </div>
    </div>
  );
}

function AdminLayoutContent({ children, user }: AdminLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isPageBuilder =
    /^\/admin\/builder\/(pages|posts)\/[^/]+\/?$/.test(pathname) ||
    /^\/admin\/builder\/custom\/[^/]+\/[^/]+\/?$/.test(pathname);

  const isHeaderFooterRoute =
    /^\/admin\/appearance\/(header|footer)-builder\/?$/.test(pathname);

  // The manager/list route keeps the normal admin shell. Once a template ID
  // is selected, the visual editor takes over the viewport without sidebar/topbar.
  const isHeaderFooterEditor =
    isHeaderFooterRoute && Boolean(searchParams.get("id")?.trim());

  return (
    <AdminLayoutFrame
      user={user}
      builderMode={isPageBuilder || isHeaderFooterEditor}
    >
      {children}
    </AdminLayoutFrame>
  );
}

export default function AdminLayout(props: AdminLayoutProps) {
  // useSearchParams is isolated behind Suspense for Next.js App Router.
  // The fallback intentionally shows the standard admin shell until the URL
  // query is resolved; the ?id= editor view then switches to full-screen.
  return (
    <Suspense
      fallback={
        <AdminLayoutFrame user={props.user} builderMode={false}>
          {props.children}
        </AdminLayoutFrame>
      }
    >
      <AdminLayoutContent {...props} />
    </Suspense>
  );
}
