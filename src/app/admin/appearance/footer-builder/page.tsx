import { Suspense } from "react";
import HeaderFooterBuilderRoute from "@/components/admin/HeaderFooterBuilderRoute";

export default function FooterBuilderPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: 280, padding: 28 }}>Loading Footer Builder…</div>}>
      <HeaderFooterBuilderRoute kind="footer" />
    </Suspense>
  );
}
