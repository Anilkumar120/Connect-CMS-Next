import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type SeoRedirect = {
  id: string;
  from: string;
  to: string;
  code: 301 | 302 | 307 | 308;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type SeoContentMeta = {
  canonicalUrl?: string;
  metaRobots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  schemaType?: string;
};

export type SeoGlobalSettings = {
  titleTemplate: string;
  titleSeparator: string;
  defaultDescription: string;
  defaultSocialImage: string;
  googleVerification: string;
  bingVerification: string;
  sitemapEnabled: boolean;
  sitemapIncludePages: boolean;
  sitemapIncludePosts: boolean;
  sitemapIncludeTaxonomies: boolean;
  disallowPaths: string[];
  noindexSearch: boolean;
};

export type SeoManagerData = {
  global: SeoGlobalSettings;
  redirects: SeoRedirect[];
  contentMeta: Record<string, SeoContentMeta>;
  google: {
    searchConsoleSite: string;
    analyticsPropertyId: string;
  };
};

export const defaultSeoManagerData: SeoManagerData = {
  global: {
    titleTemplate: "%title% | %sitename%",
    titleSeparator: "|",
    defaultDescription: "Connect Broadband offers reliable high-speed fiber broadband services in Punjab and Chandigarh.",
    defaultSocialImage: "",
    googleVerification: "",
    bingVerification: "",
    sitemapEnabled: true,
    sitemapIncludePages: true,
    sitemapIncludePosts: true,
    sitemapIncludeTaxonomies: true,
    disallowPaths: ["/admin/", "/api/"],
    noindexSearch: true,
  },
  redirects: [],
  contentMeta: {},
  google: { searchConsoleSite: "", analyticsPropertyId: "" },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeSeoManagerData(value: unknown): SeoManagerData {
  const raw = asRecord(value);
  const globalRaw = asRecord(raw.global);
  const googleRaw = asRecord(raw.google);
  const redirects = Array.isArray(raw.redirects)
    ? raw.redirects.filter((item): item is SeoRedirect => {
        const row = asRecord(item);
        return typeof row.id === "string" && typeof row.from === "string" && typeof row.to === "string";
      })
    : [];
  const contentMetaRaw = asRecord(raw.contentMeta);
  const contentMeta: Record<string, SeoContentMeta> = {};
  for (const [key, entry] of Object.entries(contentMetaRaw)) {
    const entryRaw = asRecord(entry);
    contentMeta[key] = {
      canonicalUrl: typeof entryRaw.canonicalUrl === "string" ? entryRaw.canonicalUrl : "",
      metaRobots: typeof entryRaw.metaRobots === "string" ? entryRaw.metaRobots : "",
      ogTitle: typeof entryRaw.ogTitle === "string" ? entryRaw.ogTitle : "",
      ogDescription: typeof entryRaw.ogDescription === "string" ? entryRaw.ogDescription : "",
      ogImage: typeof entryRaw.ogImage === "string" ? entryRaw.ogImage : "",
      twitterTitle: typeof entryRaw.twitterTitle === "string" ? entryRaw.twitterTitle : "",
      twitterDescription: typeof entryRaw.twitterDescription === "string" ? entryRaw.twitterDescription : "",
      twitterImage: typeof entryRaw.twitterImage === "string" ? entryRaw.twitterImage : "",
      schemaType: typeof entryRaw.schemaType === "string" ? entryRaw.schemaType : "",
    };
  }
  const global: SeoGlobalSettings = {
    ...defaultSeoManagerData.global,
    ...globalRaw,
    disallowPaths: Array.isArray(globalRaw.disallowPaths)
      ? globalRaw.disallowPaths.filter((item): item is string => typeof item === "string")
      : defaultSeoManagerData.global.disallowPaths,
    sitemapEnabled: globalRaw.sitemapEnabled !== false,
    sitemapIncludePages: globalRaw.sitemapIncludePages !== false,
    sitemapIncludePosts: globalRaw.sitemapIncludePosts !== false,
    sitemapIncludeTaxonomies: globalRaw.sitemapIncludeTaxonomies !== false,
    noindexSearch: globalRaw.noindexSearch !== false,
  } as SeoGlobalSettings;
  return {
    global,
    redirects,
    contentMeta,
    google: {
      searchConsoleSite: typeof googleRaw.searchConsoleSite === "string" ? googleRaw.searchConsoleSite : "",
      analyticsPropertyId: typeof googleRaw.analyticsPropertyId === "string" ? googleRaw.analyticsPropertyId : "",
    },
  };
}

export async function getSeoManagerData(): Promise<SeoManagerData> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: "seo-manager" },
    select: { value: true },
  });
  return normalizeSeoManagerData(setting?.value);
}

export async function saveSeoManagerData(data: SeoManagerData): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: "seo-manager" },
    create: { key: "seo-manager", value: data as unknown as Prisma.InputJsonValue },
    update: { value: data as unknown as Prisma.InputJsonValue },
  });
}

export async function getSeoContentMeta(type: "page" | "post", id: string): Promise<SeoContentMeta> {
  const data = await getSeoManagerData();
  return data.contentMeta[`${type}:${id}`] ?? {};
}

export function buildSeoTitle(title: string, siteName: string, template: string): string {
  const raw = template.trim() || "%title% | %sitename%";
  return raw
    .replace(/%title%/gi, title)
    .replace(/%sitename%/gi, siteName)
    .replace(/\s*\|\s*\|\s*/g, " | ")
    .replace(/^\s*[|â€“â€”-]\s*|\s*[|â€“â€”-]\s*$/g, "")
    .trim();
}

export async function applySeoRedirect(pathname: string): Promise<{ destination: string; permanent: boolean } | null> {
  const data = await getSeoManagerData();
  const normalized = normalizePath(pathname);
  const match = data.redirects.find((redirect) => {
    if (!redirect.active || redirect.deletedAt) return false;
    return normalizePath(redirect.from) === normalized;
  });
  if (!match) return null;
  return { destination: match.to, permanent: match.code === 301 || match.code === 308 };
}

export function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "/";
  try {
    const url = new URL(trimmed, "https://seo.local");
    const path = url.pathname.replace(/\/{2,}/g, "/");
    return path.length > 1 ? path.replace(/\/+$/, "") : "/";
  } catch {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
}
