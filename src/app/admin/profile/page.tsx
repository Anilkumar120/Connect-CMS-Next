import AccountProfile from "@/components/admin/AccountProfile";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const instant = false;

export default async function AccountProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  return <AccountProfile />;
}
