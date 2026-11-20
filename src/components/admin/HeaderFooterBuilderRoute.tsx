"use client";

import { useSearchParams } from "next/navigation";
import UniversalBuilder from "@/components/admin/UniversalBuilder";
import HeaderFooterManager from "@/components/admin/HeaderFooterManager";

type Kind = "header" | "footer";

export default function HeaderFooterBuilderRoute({ kind }: { kind: Kind }) {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || undefined;
  const title = kind === "header" ? "Header Builder" : "Footer Builder";

  if (id) {
    return <UniversalBuilder target={{ kind, id, title }} />;
  }

  return <HeaderFooterManager kind={kind} />;
}
