import { Suspense } from "react";
import UniversalBuilder from "@/components/admin/UniversalBuilder";

export default function FooterBuilderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 30 }}>Loading Footer Builder...</div>}>
      <UniversalBuilder
        target={{
          kind: "footer",
          title: "Footer Builder",
        }}
      />
    </Suspense>
  );
}
