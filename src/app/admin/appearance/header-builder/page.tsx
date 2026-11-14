import { Suspense } from "react";
import UniversalBuilder from "@/components/admin/UniversalBuilder";

export default function HeaderBuilderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 30 }}>Loading Header Builder...</div>}>
      <UniversalBuilder
        target={{
          kind: "header",
          title: "Header Builder",
        }}
      />
    </Suspense>
  );
}
