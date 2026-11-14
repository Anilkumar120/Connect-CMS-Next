
import { Suspense } from "react";
import { notFound } from "next/navigation";

import UniversalBuilder from "@/components/admin/UniversalBuilder";

type Props = {
  params: Promise<{
    kind: string;
    slug: string;
  }>;
};

async function TemplateEditorContent({ params }: Props) {
  const { kind, slug } = await params;

  if (
    (kind !== "single" && kind !== "archive") ||
    !slug
  ) {
    notFound();
  }

  return (
    <UniversalBuilder
      target={{
        kind,
        slug,
        title: slug,
      }}
    />
  );
}

function Loading() {
  return (
    <div
      style={{
        padding: "30px",
        color: "#64748b",
        fontSize: "14px",
      }}
    >
      Loading Template Editor...
    </div>
  );
}

export default function TemplateEditorPage({ params }: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <TemplateEditorContent params={params} />
    </Suspense>
  );
}
