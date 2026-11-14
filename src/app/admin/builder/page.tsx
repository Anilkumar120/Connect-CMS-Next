
import Link from "next/link";
import {
  PanelsTopLeft,
  LayoutTemplate,
  FileText,
  Newspaper,
  Archive,
  PanelTop,
  PanelBottom,
  Code2,
  ArrowRight,
} from "lucide-react";

import styles from "./BuilderDashboard.module.css";

const builderGroups = [
  {
    title: "Theme Builder",
    description: "Manage your website's global header and footer.",
    items: [
      {
        title: "Header",
        description: "Edit logo, navigation, buttons and header layout.",
        href: "/admin/appearance/header-builder",
        icon: PanelTop,
      },
      {
        title: "Footer",
        description: "Edit footer columns, menus, copyright and widgets.",
        href: "/admin/appearance/footer-builder",
        icon: PanelBottom,
      },
    ],
  },
  {
    title: "Content Builder",
    description: "Design individual website pages and posts.",
    items: [
      {
        title: "Pages",
        description: "Open the pages manager and choose a page to design.",
        href: "/admin/pages",
        icon: FileText,
      },
      {
        title: "Posts",
        description: "Manage and design blog posts.",
        href: "/admin/posts",
        icon: Newspaper,
      },
    ],
  },
  {
    title: "Template Builder",
    description: "Manage reusable layouts and dynamic templates.",
    items: [
      {
        title: "Single Templates",
        description: "Create reusable layouts for individual content.",
        href: "/admin/builder/templates/single",
        icon: LayoutTemplate,
      },
      {
        title: "Archive Templates",
        description: "Create layouts for post and content archives.",
        href: "/admin/builder/templates/archive",
        icon: Archive,
      },
      {
        title: "Custom Post Types",
        description: "Manage layouts for custom content types.",
        href: "/admin/post-types",
        icon: Code2,
      },
    ],
  },
];

export default function BuilderDashboardPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.headingIcon}>
            <PanelsTopLeft size={25} />
          </div>

          <div>
            <h1>Website Builder</h1>
            <p>
              Manage your website design from one central builder dashboard.
            </p>
          </div>
        </div>
      </header>

      <div className={styles.notice}>
        <strong>One central builder</strong>
        <span>
          Header, Footer, Pages and Posts are accessible from this dashboard.
          Existing builder designs and saved content are preserved.
        </span>
      </div>

      <div className={styles.groups}>
        {builderGroups.map((group) => (
          <section className={styles.group} key={group.title}>
            <div className={styles.groupHeader}>
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </div>

            <div className={styles.cards}>
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    href={item.href}
                    className={styles.card}
                    key={item.title}
                  >
                    <div className={styles.cardIcon}>
                      <Icon size={23} />
                    </div>

                    <div className={styles.cardContent}>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>

                    <ArrowRight
                      size={19}
                      className={styles.arrow}
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
