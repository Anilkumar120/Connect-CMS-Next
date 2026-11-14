
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import AdminLayout from "@/components/admin/AdminLayout";
import { getCurrentUser } from "@/lib/auth/session";
import "@/styles/admin/admin-layout.css";

export const instant = false;

export default async function AdminRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");

  return <AdminLayout user={user}>{children}</AdminLayout>;
}
