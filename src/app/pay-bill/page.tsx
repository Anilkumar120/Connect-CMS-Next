import type { Metadata } from "next";
import PublicLayout from "@/components/public/PublicLayout";
import PayBillForm from "@/components/public/PayBillForm";

export const metadata: Metadata = {
  title: "Pay Bill",
  description: "Submit an unverified bill payment request.",
};

export default function PayBillPage() {
  return (
    <PublicLayout pathname="/pay-bill">
      <PayBillForm />
    </PublicLayout>
  );
}
