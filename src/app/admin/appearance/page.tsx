import Link from "next/link";
import { ArrowRight, Menu, PanelTop } from "lucide-react";
import styles from "./Appearance.module.css";

const tools = [
  {
    title: "Site Builder",
    description:
      "Open the shared entry point for header, footer, pages and content.",
    href: "/admin/builder",
    icon: PanelTop,
  },
  {
    title: "Menu Manager",
    description:
      "Create and organize the links used by the header and footer.",
    href: "/admin/menus",
    icon: Menu,
  },
];

export default function AppearancePage() {
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p>WEBSITE DESIGN</p>
        <h1>Appearance</h1>
        <span>Manage the shared design and navigation for public pages.</span>
      </header>

      <div className={styles.grid}>
        {tools.map(({ title, description, href, icon: Icon }) => (
          <Link className={styles.card} href={href} key={href}>
            <span className={styles.icon}>
              <Icon size={22} />
            </span>
            <strong>{title}</strong>
            <span>{description}</span>
            <span className={styles.open}>
              Open <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
