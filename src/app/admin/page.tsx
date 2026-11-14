
import { Suspense } from "react";

import {
  FileText,
  Images,
  ArrowUpRight,
  Activity,
  Plus,
  Globe,
  Palette,
  Menu as MenuIcon,
  UserRound,
  Users,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export const instant = false;

async function DashboardContent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin-login");
  }

  const [totalPages, publishedPages, mediaFiles, totalMenus, recentPages] =
    await Promise.all([
      prisma.page.count({ where: { deletedAt: null } }),
      prisma.page.count({
        where: { deletedAt: null, status: "PUBLISHED" },
      }),
      prisma.mediaAsset.count({ where: { isDeleted: false } }),
      prisma.menu.count(),
      prisma.page.findMany({
        where: { deletedAt: null },
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

  const stats = [
    {
      title: "Total Pages",
      value: totalPages,
      note: "Website pages",
      icon: FileText,
      href: "/admin/pages",
    },
    {
      title: "Published Pages",
      value: publishedPages,
      note: "Live on the website",
      icon: Globe,
      href: "/admin/pages",
    },
    {
      title: "Media Files",
      value: mediaFiles,
      note: "Images and documents",
      icon: Images,
      href: "/admin/media",
    },
    {
      title: "Menus",
      value: totalMenus,
      note: "Header and footer menus",
      icon: MenuIcon,
      href: "/admin/menus",
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <div className="dashboard-eyebrow">
            OVERVIEW
          </div>

          <h1>Dashboard</h1>

          <p>
            Welcome back, {user.name}.
          </p>
        </div>

        <div className="dashboard-heading-actions">
          <span className="development-status">
            <span />
            Development
          </span>
        </div>
      </div>

      <section className="dashboard-welcome">
        <div>
          <span className="welcome-label">
            CONNECT BROADBAND CMS
          </span>

          <h2>
            Welcome, {user.name}!
          </h2>

          <p>
            You are logged in as{" "}
            {user.role.toLowerCase().replaceAll("_", " ")}.
            Manage website pages, media, menus, and the shared
            public header and footer from one central dashboard.
          </p>

          <p>
            <strong>Email:</strong> {user.email}
          </p>

          <p>
            <strong>Username:</strong> {user.username}
          </p>
        </div>

        <div className="welcome-icon">
          <Globe size={66} strokeWidth={1.2} />
        </div>
      </section>

      <section className="dashboard-stats">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              className="stat-card"
              href={item.href}
              key={item.title}
            >
              <div className="stat-card-top">
                <span className="stat-icon">
                  <Icon size={21} />
                </span>

                <ArrowUpRight
                  size={17}
                  className="stat-arrow"
                />
              </div>

              <h3>{item.value}</h3>
              <strong>{item.title}</strong>
              <p>{item.note}</p>
            </Link>
          );
        })}
      </section>

      <div className="dashboard-lower-grid">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Activity</h2>
              <p>Recently updated website pages</p>
            </div>

            <Activity size={20} />
          </div>

          <div className="activity-list">
            {recentPages.map((page) => (
              <div
                className="activity-item"
                key={page.id}
              >
                <span className="activity-indicator" />

                <div>
                  <strong>{page.title}</strong>
                  <p>{page.status.toLowerCase()}</p>
                </div>

                <span className="activity-time">
                  {page.updatedAt.toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
            {recentPages.length === 0 && (
              <p>No pages have been created yet.</p>
            )}
          </div>
        </section>

        <section className="dashboard-panel quick-actions">
          <div className="panel-heading">
            <div>
              <h2>Quick Actions</h2>
              <p>Frequently used operations</p>
            </div>
          </div>

          <Link className="quick-action-item" href="/admin/pages/new">
            <span className="quick-action-icon">
              <Plus size={19} />
            </span>

            <div>
              <strong>Create New Page</strong>
              <p>Write and publish website content</p>
            </div>
          </Link>

          <Link className="quick-action-item" href="/admin/media">
            <span className="quick-action-icon">
              <Images size={19} />
            </span>

            <div>
              <strong>Manage Media</strong>
              <p>Upload and organize website files</p>
            </div>
          </Link>

          <Link className="quick-action-item" href="/admin/menus">
            <span className="quick-action-icon">
              <MenuIcon size={19} />
            </span>

            <div>
              <strong>Manage Menus</strong>
              <p>Update public navigation links</p>
            </div>
          </Link>

          <Link className="quick-action-item" href="/admin/profile">
            <span className="quick-action-icon">
              <UserRound size={19} />
            </span>
            <div>
              <strong>My Profile</strong>
              <p>Update your account details and password</p>
            </div>
          </Link>

          {(user.role === "SUPER_ADMIN" || user.role === "ADMIN") && (
            <Link className="quick-action-item" href="/admin/users">
              <span className="quick-action-icon">
                <Users size={19} />
              </span>
              <div>
                <strong>Manage Users</strong>
                <p>Create accounts and manage access</p>
              </div>
            </Link>
          )}

          <Link
            className="quick-action-item"
            href="/admin/appearance"
          >
            <span className="quick-action-icon">
              <Palette size={19} />
            </span>

            <div>
              <strong>Customize Appearance</strong>
              <p>Edit the public header and footer</p>
            </div>
          </Link>
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="dashboard-page">
          Loading dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
