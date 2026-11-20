
import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import AdminLayout from "@/components/admin/AdminLayout";
import { getCurrentUser } from "@/lib/auth/session";
import "@/styles/admin/admin-layout.css";

export const instant = false;

async function AdminLayoutContent({
  children,
}: {
  children: ReactNode;
}) {
  // Wait for an incoming request before running authentication.
  // This prevents JWT expiry checks from running during prerendering.
  await connection();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin-login");
  }

  return <AdminLayout user={user}>{children}</AdminLayout>;
}

export default function AdminRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<div>Loading admin...</div>}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
