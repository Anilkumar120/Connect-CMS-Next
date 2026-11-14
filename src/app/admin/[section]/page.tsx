
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Construction } from "lucide-react";
import { notFound } from "next/navigation";

const sections: Record<
  string,
  {
    title: string;
    description: string;
    links: { label: string; href: string }[];
  }
> = {
  posts: {
    title: "Posts",
    description: "Create and organize blog posts, categories and tags.",
    links: [
      { label: "Manage Posts", href: "/admin/posts" },
      { label: "Categories", href: "/admin/posts/categories" },
      { label: "Tags", href: "/admin/posts/tags" },
    ],
  },
  builder: {
    title: "Page Builder",
    description:
      "Choose a page to build a responsive layout with sections, containers, and widgets.",
    links: [{ label: "Manage Pages", href: "/admin/pages" }],
  },
  seo: {
    title: "SEO Manager",
    description:
      "SEO title, description, canonical URL and robots settings are available in each page editor.",
    links: [{ label: "Manage Pages", href: "/admin/pages" }],
  },
  forms: {
    title: "Forms & Leads",
    description: "Form submission management is not enabled yet.",
    links: [{ label: "Manage Pages", href: "/admin/pages" }],
  },
  payments: {
    title: "Payments",
    description: "Payment management is not enabled yet.",
    links: [{ label: "Dashboard", href: "/admin" }],
  },
  users: {
    title: "Users & Roles",
    description: "User management is not enabled yet.",
    links: [{ label: "Dashboard", href: "/admin" }],
  },
  database: {
    title: "Database",
    description: "Database tools are not enabled in the admin panel.",
    links: [{ label: "Dashboard", href: "/admin" }],
  },
  settings: {
    title: "Settings",
    description: "Manage your site identity, homepage, reading, and permalink settings.",
    links: [
      { label: "General, Reading & Permalinks", href: "/admin/settings" },
    ],
  },
  profile: {
    title: "My Profile",
    description: "Profile management is not enabled yet.",
    links: [{ label: "Dashboard", href: "/admin" }],
  },
};

type AdminSectionPageProps = {
  params: Promise<{ section: string }>;
};

async function AdminSectionContent({
  params,
}: AdminSectionPageProps) {
  const { section } = await params;
  const data = sections[section];

  if (!data) {
    notFound();
  }

  return (
    <section
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "8px 0",
      }}
    >
      <div
        style={{
          padding: 28,
          border: "1px solid #e5eaf1",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <Construction size={26} color="#3984e8" />

        <h1 style={{ margin: "14px 0 8px", fontSize: 24 }}>
          {data.title}
        </h1>

        <p style={{ color: "#718096", lineHeight: 1.7 }}>
          {data.description}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 22,
          }}
        >
          {data.links.map((link) => (
            <Link
              href={link.href}
              key={link.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 14px",
                borderRadius: 7,
                color: "#fff",
                background: "#0c2f55",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {link.label}
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function AdminSectionLoading() {
  return (
    <div style={{ padding: 28, color: "#718096" }}>
      Loading admin section...
    </div>
  );
}

export default function AdminSectionPage({
  params,
}: AdminSectionPageProps) {
  return (
    <Suspense fallback={<AdminSectionLoading />}>
      <AdminSectionContent params={params} />
    </Suspense>
  );
}
