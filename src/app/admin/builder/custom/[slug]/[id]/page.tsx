
import { Suspense } from "react";
import { notFound } from "next/navigation";
import UniversalBuilder from "@/components/admin/UniversalBuilder";

type CustomBuilderPageProps = {
  params: Promise<{
    slug: string;
    id: string;
  }>;
};

async function CustomBuilderContent({
  params,
}: CustomBuilderPageProps) {
  const { slug, id } = await params;

  if (!slug || !id) {
    notFound();
  }

  return (
    <UniversalBuilder
      target={{
        kind: "custom",
        id,
        slug,
        postTypeSlug: slug,
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
      Loading Custom Post Type Builder...
    </div>
  );
}

export default function CustomPostTypeBuilderPage({
  params,
}: CustomBuilderPageProps) {
  return (
    <Suspense fallback={<BuilderLoading />}>
      <CustomBuilderContent params={params} />
    </Suspense>
  );
}
