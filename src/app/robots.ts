import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";
import { getSeoManagerData } from "@/lib/seo-manager";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const [site, seo] = await Promise.all([getSiteSettings(), getSeoManagerData()]);
  const disallow = Array.from(new Set(["/admin/", "/api/", ...seo.global.disallowPaths]));
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${site.general.siteAddress.replace(/\/$/, "")}/sitemap.xml`,
  };
}
