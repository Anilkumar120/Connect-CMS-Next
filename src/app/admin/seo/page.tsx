import SEOManager from "@/components/admin/SEOManager";

export const metadata = {
  title: "SEO Manager",
  robots: { index: false, follow: false },
};

export default function SEOManagerPage() {
  return <SEOManager />;
}
