
import { Suspense } from "react";
import { notFound } from "next/navigation";
import TemplateManager from "@/components/admin/TemplateManager";

type Props = {
  params: Promise<{ kind: string }>;
};

async function BuilderTemplatesContent({ params }: Props) {
  const { kind } = await params;

  if (kind !== "single" && kind !== "archive") {
    notFound();
  }

  return <TemplateManager kind={kind} />;
}

function TemplatesLoading() {
  return (
    <div
      style={{
        padding: "32px",
        color: "#64748b",
        fontSize: "14px",
      }}
    >
      Loading templates...
    </div>
  );
}

export default function BuilderTemplatesPage({ params }: Props) {
  return (
    <Suspense fallback={<TemplatesLoading />}>
      <BuilderTemplatesContent params={params} />
    </Suspense>
  );
}
