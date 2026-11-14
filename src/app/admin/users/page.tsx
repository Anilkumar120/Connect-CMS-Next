import { redirect } from "next/navigation";
import UserManagement from "@/components/admin/UserManagement";
import { getCurrentUser } from "@/lib/auth/session";

export const instant = false;

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") redirect("/admin");
  return <UserManagement actorId={user.id} actorRole={user.role} />;
}
