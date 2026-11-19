import UniversalBuilder from "@/components/admin/UniversalBuilder";
import HeaderFooterManager from "@/components/admin/HeaderFooterManager";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FooterBuilderPage({ searchParams }: Props) {
  const query = await searchParams;
  const id = typeof query.id === "string" ? query.id : undefined;

  if (id) {
    return <UniversalBuilder target={{ kind: "footer", id, title: "Footer Builder" }} />;
  }

  return <HeaderFooterManager kind="footer" />;
}
