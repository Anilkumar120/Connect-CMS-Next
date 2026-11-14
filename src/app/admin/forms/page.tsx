import { notFound } from "next/navigation";
import FormsManager from "@/components/admin/FormsManager";
import { getCurrentUser } from "@/lib/auth/session";

export const instant = false;

export default async function FormsAdminPage() {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(user.role)) notFound();
  return <FormsManager role={user.role} />;
}
