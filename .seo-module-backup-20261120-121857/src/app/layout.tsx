import type { Metadata } from "next";
import "./globals.css";
import "@/styles/auth.css";

export const metadata: Metadata = {
  title: {
    default: "Connect Broadband",
    template: "%s | Connect Broadband",
  },
  description: "Connect Broadband official website.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}