
import { Suspense } from "react";
import { notFound } from "next/navigation";
import UniversalBuilder from "@/components/admin/UniversalBuilder";

type ContentBuilderPageProps = {
  params: Promise<{
    kind: string;
    id: string;
  }>;
};

async function ContentBuilderContent({
  params,
}: ContentBuilderPageProps) {
  const { kind, id } = await params;

  if (!id || (kind !== "pages" && kind !== "posts")) {
    notFound();
  }

  const builderKind = kind === "pages" ? "page" : "post";

  return (
    <UniversalBuilder
      target={{
        kind: builderKind,
        id,
      }}
    />
  );
}

function BuilderLoading() {
  return (
    <div
      style={{
        padding: "30px",
        color: "#64748b",
        fontSize: "14px",
      }}
    >
      Loading Page Builder...
    </div>
  );
}

export default function ContentBuilderPage({
  params,
}: ContentBuilderPageProps) {
  return (
    <Suspense fallback={<BuilderLoading />}>
      <ContentBuilderContent params={params} />
    </Suspense>
  );
}
