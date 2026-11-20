import { Suspense } from "react";
import HeaderFooterBuilderRoute from "@/components/admin/HeaderFooterBuilderRoute";

export default function HeaderBuilderPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: 280, padding: 28 }}>Loading Header Builder…</div>}>
      <HeaderFooterBuilderRoute kind="header" />
    </Suspense>
  );
}
