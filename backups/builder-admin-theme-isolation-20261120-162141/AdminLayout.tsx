"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

  const shellRef = useRef<HTMLDivElement | null>(null);

  // Isolate Builder from the saved Admin appearance theme.
  useEffect(() => {
    if (!builderMode) return;

    const shell = shellRef.current;
    if (!shell) return;

    const documentRoot = document.documentElement;
    const previousTheme = documentRoot.getAttribute("data-admin-theme");

    const adminVariableNames: string[] = [];

    for (let index = 0; index < shell.style.length; index += 1) {
      const name = shell.style.item(index);

      if (name.startsWith("--admin-")) {
        adminVariableNames.push(name);
      }
    }

    const previousVariables = adminVariableNames.map((name) => ({
      name,
      value: shell.style.getPropertyValue(name),
      priority: shell.style.getPropertyPriority(name),
    }));

    // Remove only Admin theme variables while Builder is active.
    adminVariableNames.forEach((name) => {
      shell.style.removeProperty(name);
    });

    documentRoot.removeAttribute("data-admin-theme");

    return () => {
      // Restore the previous Admin theme when leaving Builder.
      previousVariables.forEach(({ name, value, priority }) => {
        shell.style.setProperty(name, value, priority);
      });

      if (previousTheme === null) {
        documentRoot.removeAttribute("data-admin-theme");
      } else {
        documentRoot.setAttribute("data-admin-theme", previousTheme);
      }
    };
  }, [builderMode]);

  return (
    <div
      ref={shellRef}
      className={`admin-shell ${
        collapsed ? "sidebar-collapsed" : ""
      } ${builderMode ? "admin-builder-mode" : ""}`}
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
            onMenuToggle={() =>
              setMobileOpen((current) => !current)
            }
          />
        )}

        <main className="admin-page-content">{children}</main>
      </div>
    </div>
  );
}

function AdminLayoutContent({
  children,
  user,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isPageBuilder =
    /^\/admin\/builder\/(pages|posts)\/[^/]+\/?$/.test(pathname) ||
    /^\/admin\/builder\/custom\/[^/]+\/[^/]+\/?$/.test(pathname);

  const isHeaderFooterRoute =
    /^\/admin\/appearance\/(header|footer)-builder\/?$/.test(pathname);

  const isHeaderFooterEditor =
    isHeaderFooterRoute &&
    Boolean(searchParams.get("id")?.trim());

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