"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type SiteInfo = {
  siteTitle: string;
  language: string;
  iconUrl: string | null;
};

export default function PublicSiteMetadata() {
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    async function applySiteInfo() {
      try {
        const info: SiteInfo = await fetch("/api/public/settings", {
          cache: "no-store",
        }).then(async (response) => {
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error("Unable to load public site settings.");
          }
          return result as SiteInfo;
        });
        if (!active) return;

        document.documentElement.lang = info.language;
        if (
          document.title === "Connect Broadband" ||
          document.title.endsWith(" | Connect Broadband")
        ) {
          document.title = document.title === "Connect Broadband"
            ? info.siteTitle
            : `${document.title.slice(0, -" | Connect Broadband".length)} | ${info.siteTitle}`;
        }

        const existingIcon = document.querySelector<HTMLLinkElement>(
          "link[data-site-icon='true']"
        );
        if (info.iconUrl) {
          const icon = existingIcon || document.createElement("link");
          icon.rel = "icon";
          icon.href = info.iconUrl;
          icon.dataset.siteIcon = "true";
          if (!existingIcon) document.head.appendChild(icon);
        } else {
          existingIcon?.remove();
        }
      } catch {
        // The server-rendered defaults remain in place if settings are unavailable.
      }
    }

    void applySiteInfo();
    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
