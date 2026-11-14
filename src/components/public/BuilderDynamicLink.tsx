"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function BuilderDynamicLink({
  destination,
  children,
}: {
  destination: "current-page" | "homepage";
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <Link href={destination === "homepage" ? "/" : pathname || "/"}>
      {children}
    </Link>
  );
}
