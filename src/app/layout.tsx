
import type { Metadata } from "next";
import { cacheLife } from "next/cache";

import { getSiteSettings } from "@/lib/site-settings";
import { getSeoManagerData } from "@/lib/seo-manager";

import "./globals.css";
import "@/styles/auth.css";

function getAbsoluteImageUrl(
  image: string,
  siteAddress: string
): string | undefined {
  if (!image.trim()) return undefined;

  try {
    return new URL(image.trim(), siteAddress).toString();
  } catch {
    return undefined;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  "use cache";

  // IMPORTANT: "minutes" instead of "seconds".
  // This profile supports prerendering with Cache Components.
  cacheLife("minutes");

  const [site, seo] = await Promise.all([
    getSiteSettings(),
    getSeoManagerData(),
  ]);

  const title =
    site.general.siteTitle || "Connect Broadband";

  const description =
    seo.global.defaultDescription ||
    site.general.tagline ||
    "Connect Broadband offers high-speed fiber broadband services in Punjab and Chandigarh.";

  const socialImage = getAbsoluteImageUrl(
    seo.global.defaultSocialImage || "",
    site.general.siteAddress
  );

  return {
    title: {
      default: title,
      template: "%s",
    },

    description,
    applicationName: title,

    robots: {
      index: true,
      follow: true,
    },

    verification: {
      ...(seo.global.googleVerification?.trim()
        ? {
            google: seo.global.googleVerification.trim(),
          }
        : {}),

      ...(seo.global.bingVerification?.trim()
        ? {
            other: {
              "msvalidate.01":
                seo.global.bingVerification.trim(),
            },
          }
        : {}),
    },

    openGraph: {
      type: "website",
      siteName: title,
      title,
      description,
      ...(socialImage
        ? {
            images: [socialImage],
          }
        : {}),
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(socialImage
        ? {
            images: [socialImage],
          }
        : {}),
    },
  };
}

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
