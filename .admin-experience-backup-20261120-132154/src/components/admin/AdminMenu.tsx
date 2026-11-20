import {
  LayoutDashboard,
  FileText,
  Newspaper,
  Images,
  PanelsTopLeft,
  Search,
  Menu as MenuIcon,
  Users,
  Settings,
  Database,
  ClipboardList,
  CreditCard,
  Palette,
} from "lucide-react";

export const adminMenu = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    section: "CONTENT",
  },
  {
    title: "Pages",
    href: "/admin/pages",
    icon: FileText,
  },
  {
    title: "Posts",
    href: "/admin/posts",
    icon: Newspaper,
  },
  {
    title: "Media Library",
    href: "/admin/media",
    icon: Images,
  },
  {
    title: "Site Builder",
    href: "/admin/builder",
    icon: PanelsTopLeft,
  },
  {
    title: "Menus",
    href: "/admin/menus",
    icon: MenuIcon,
  },
  {
    section: "MANAGEMENT",
  },
  {
    title: "SEO Manager",
    href: "/admin/seo",
    icon: Search,
  },
  {
    title: "Forms & Leads",
    href: "/admin/forms",
    icon: ClipboardList,
  },
  {
    title: "Payments",
    href: "/admin/payments",
    icon: CreditCard,
  },
  {
    title: "Users & Roles",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Appearance",
    href: "/admin/appearance",
    icon: Palette,
  },
  {
    section: "SYSTEM",
  },
  {
    title: "Database",
    href: "/admin/database",
    icon: Database,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
] as const;