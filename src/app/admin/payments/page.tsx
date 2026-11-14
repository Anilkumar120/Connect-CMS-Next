import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import PaymentsManager from "@/components/admin/PaymentsManager";

export const instant = false;

export default async function PaymentsAdminPage() {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "ADMIN"].includes(user.role)) notFound();
  return <PaymentsManager />;
}
