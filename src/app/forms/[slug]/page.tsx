import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getFormFields } from "@/lib/forms";
import PublicForm from "@/components/forms/PublicForm";

type Props = { params: Promise<{ slug: string }> };

async function FormContent({ params }: Props) {
  const { slug } = await params;
  const form = await prisma.form.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    select: { title: true, description: true, fields: true, styles: true },
  });
  if (!form) notFound();
  return <PublicForm title={form.title} description={form.description ?? ""} fields={getFormFields(form.fields)} styles={form.styles} slug={slug} />;
}

export default function PublicFormPage({ params }: Props) {
  return (
    <main className="public-form-page">
      <Suspense fallback={<p role="status" style={{ maxWidth: 720, margin: "48px auto", color: "#718096" }}>Loading form…</p>}>
        <FormContent params={params} />
      </Suspense>
    </main>
  );
}
