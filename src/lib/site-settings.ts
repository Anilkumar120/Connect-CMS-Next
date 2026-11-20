import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const permalinkStructures = [
  "plain",
  "day-and-name",
  "month-and-name",
  "numeric",
  "post-name",
  "custom",
] as const;

const customPermalinkTokens = [
  "%year%",
  "%monthnum%",
  "%day%",
  "%hour%",
  "%minute%",
  "%second%",
  "%postname%",
  "%post_id%",
  "%category%",
] as const;

function isValidCustomStructure(value: string) {
  if (!value.startsWith("/") || /[?#]/.test(value)) return false;
  const tokens: string[] = value.match(/%[^%]+%/g) ?? [];
  const allowed = new Set<string>(customPermalinkTokens);
  return (
    tokens.length > 0 &&
    tokens.every((token) => allowed.has(token)) &&
    (tokens.includes("%postname%") || tokens.includes("%post_id%"))
  );
}

const siteModeSchema = z.enum(["auto", "custom"]).default("auto");

export const siteSettingsSchema = z.object({
  general: z.object({
    siteTitle: z.string().trim().min(1).max(120),
    tagline: z.string().max(250),
    siteIconId: z.string().max(191).nullable(),
    wordpressAddress: z.string().url().max(500),
    siteAddress: z.string().url().max(500),
    adminEmail: z.string().email().max(254),
    siteUrlMode: siteModeSchema,
    adminEmailMode: siteModeSchema,
    membership: z.boolean(),
    newUserRole: z.enum(["ADMIN", "EDITOR", "AUTHOR", "CONTRIBUTOR"]),
    language: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
    timezone: z.string().min(1).max(100),
    dateFormat: z.enum(["F j, Y", "Y-m-d", "m/d/Y", "d/m/Y", "M j, Y"]),
    timeFormat: z.enum(["g:i a", "g:i A", "H:i"]),
    weekStartsOn: z.number().int().min(0).max(6),
  }),
  reading: z.object({
    showOnFront: z.enum(["posts", "page"]),
    homepagePageId: z.string().max(191).nullable(),
    postsPageId: z.string().max(191).nullable(),
    postsPerPage: z.number().int().min(1).max(100),
    postsPerFeed: z.number().int().min(1).max(100),
    feedContent: z.enum(["full", "excerpt"]),
  }),
  permalinks: z.object({
    structure: z.enum(permalinkStructures),
    customStructure: z.string().max(500),
  }),
}).superRefine((settings, context) => {
  if (
    settings.permalinks.structure === "custom" &&
    !isValidCustomStructure(settings.permalinks.customStructure)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["permalinks", "customStructure"],
      message: "Use a leading slash, supported tags, and include %postname% or %post_id%.",
    });
  }
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export type RuntimeSiteDefaults = {
  siteOrigin?: string;
  adminEmail?: string;
};

export const defaultSiteSettings: SiteSettings = {
  general: {
    siteTitle: "Connect Broadband",
    tagline: "",
    siteIconId: null,
    wordpressAddress: "http://localhost:3000",
    siteAddress: "http://localhost:3000",
    adminEmail: "admin@example.com",
    siteUrlMode: "auto",
    adminEmailMode: "auto",
    membership: false,
    newUserRole: "CONTRIBUTOR",
    language: "en-US",
    timezone: "Asia/Kolkata",
    dateFormat: "F j, Y",
    timeFormat: "g:i a",
    weekStartsOn: 1,
  },
  reading: {
    showOnFront: "posts",
    homepagePageId: null,
    postsPageId: null,
    postsPerPage: 10,
    postsPerFeed: 10,
    feedContent: "excerpt",
  },
  permalinks: {
    structure: "post-name",
    customStructure: "/%postname%/",
  },
};

function normalizeOrigin(value?: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeEmail(value?: string | null): string | null {
  const email = value?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/**
 * Runtime defaults are deliberately applied only when the corresponding mode
 * is "auto". A custom URL or administration email remains under the site's control.
 */
export async function getSiteSettings(
  runtime: RuntimeSiteDefaults = {}
): Promise<SiteSettings> {
  let settings: SiteSettings;

  try {
    const record = await prisma.siteSetting.findUnique({
      where: { key: "site-settings" },
      select: { value: true },
    });

    const parsed = siteSettingsSchema.safeParse(record?.value);
    settings = parsed.success
      ? parsed.data
      : {
          ...defaultSiteSettings,
          general: { ...defaultSiteSettings.general },
          reading: { ...defaultSiteSettings.reading },
          permalinks: { ...defaultSiteSettings.permalinks },
        };
  } catch (error) {
    console.error("Unable to load site settings. Using defaults:", error);
    settings = {
      ...defaultSiteSettings,
      general: { ...defaultSiteSettings.general },
      reading: { ...defaultSiteSettings.reading },
      permalinks: { ...defaultSiteSettings.permalinks },
    };
  }

  const configuredOrigin = normalizeOrigin(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL
  );
  const runtimeOrigin = normalizeOrigin(runtime.siteOrigin);
  const automaticOrigin = configuredOrigin || runtimeOrigin;

  if (settings.general.siteUrlMode === "auto" && automaticOrigin) {
    settings.general.wordpressAddress = automaticOrigin;
    settings.general.siteAddress = automaticOrigin;
  }

  if (settings.general.adminEmailMode === "auto") {
    const automaticEmail =
      normalizeEmail(runtime.adminEmail) ||
      normalizeEmail(process.env.ADMIN_EMAIL) ||
      normalizeEmail(settings.general.adminEmail);

    if (automaticEmail) settings.general.adminEmail = automaticEmail;
  }

  return settings;
}

export function getPostPermalink(
  post: {
    id: string;
    slug: string;
    publishedAt?: Date | null;
    createdAt?: Date;
    categories?: { category: { slug: string } }[];
  },
  settings: SiteSettings
) {
  const publishedDate = post.publishedAt || post.createdAt || new Date();
  const dateParts = new Intl.DateTimeFormat("en", {
    timeZone: settings.general.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(publishedDate);
  const dateValues = Object.fromEntries(
    dateParts.map((part) => [part.type, part.value])
  );

  const tokens: Record<string, string> = {
    "%year%": dateValues.year || "",
    "%monthnum%": dateValues.month || "",
    "%day%": dateValues.day || "",
    "%hour%": dateValues.hour || "00",
    "%minute%": dateValues.minute || "00",
    "%second%": dateValues.second || "00",
    "%postname%": encodeURIComponent(post.slug),
    "%post_id%": encodeURIComponent(post.id),
    "%category%": encodeURIComponent(post.categories?.[0]?.category.slug || "uncategorized"),
  };

  if (settings.permalinks.structure === "plain") {
    return `/?p=${encodeURIComponent(post.id)}`;
  }

  const structure = settings.permalinks.structure === "custom"
    ? settings.permalinks.customStructure
    : settings.permalinks.structure === "day-and-name"
      ? "/%year%/%monthnum%/%day%/%postname%/"
      : settings.permalinks.structure === "month-and-name"
        ? "/%year%/%monthnum%/%postname%/"
        : settings.permalinks.structure === "numeric"
          ? "/archives/%post_id%/"
          : "/%postname%/";

  return Object.entries(tokens).reduce(
    (path, [token, value]) => path.split(token).join(value),
    structure
  ).replace(/\/{2,}/g, "/");
}

export function matchPostPermalink(
  pathname: string,
  settings: SiteSettings
): { slug?: string; id?: string } | null {
  const structure = settings.permalinks.structure === "plain"
    ? null
    : settings.permalinks.structure === "day-and-name"
      ? "/%year%/%monthnum%/%day%/%postname%/"
      : settings.permalinks.structure === "month-and-name"
        ? "/%year%/%monthnum%/%postname%/"
        : settings.permalinks.structure === "numeric"
          ? "/archives/%post_id%/"
          : settings.permalinks.structure === "custom"
            ? settings.permalinks.customStructure
            : "/%postname%/";

  if (!structure) return null;
  const tokenPattern = /%([a-z_]+)%/g;
  let regex = "^";
  let cursor = 0;
  const captures: string[] = [];

  for (const match of structure.matchAll(tokenPattern)) {
    const tokenIndex = match.index ?? 0;
    regex += structure
      .slice(cursor, tokenIndex)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const token = match[1];
    if (token === "postname" || token === "post_id") {
      captures.push(token === "postname" ? "slug" : "id");
      regex += "([^/]+)";
    } else if (["year", "monthnum", "day", "hour", "minute", "second"].includes(token)) {
      regex += "\\d{1,4}";
    } else if (token === "category") {
      regex += "[^/]+";
    } else {
      return null;
    }
    cursor = tokenIndex + match[0].length;
  }

  regex += structure.slice(cursor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`${regex}$`);
  const matched = matcher.exec(pathname) || matcher.exec(`${pathname}/`);
  if (!matched) return null;

  let values: [string, string][];
  try {
    values = captures.map((token, index) => [
      token,
      decodeURIComponent(matched[index + 1]),
    ]);
  } catch {
    return null;
  }

  return Object.fromEntries(values) as { slug?: string; id?: string };
}

export function formatSiteDateTime(
  date: Date,
  settings: SiteSettings,
  includeTime = false
) {
  const parts = (month: Intl.DateTimeFormatOptions["month"]) =>
    new Intl.DateTimeFormat(settings.general.language, {
      timeZone: settings.general.timezone,
      year: "numeric",
      month,
      day: "numeric",
    }).formatToParts(date);
  const longParts = parts("long");
  const shortParts = parts("short");
  const numericParts = parts("2-digit");
  const values: Record<string, string> = {};
  for (const part of longParts) values[part.type] = part.value;
  const monthShort = shortParts.find((part) => part.type === "month")?.value;
  const monthNumeric = numericParts.find((part) => part.type === "month")?.value;
  const dayNumeric = numericParts.find((part) => part.type === "day")?.value;
  const dayUnpadded = String(Number(values.day));
  const dateText = settings.general.dateFormat.replace(
    /F|Y|m|d|j|M/g,
    (token) => ({
      F: values.month,
      M: monthShort || values.month,
      Y: values.year,
      m: monthNumeric || values.month,
      d: dayNumeric || values.day,
      j: dayUnpadded,
    })[token] || token
  );
  if (!includeTime) return dateText;

  const timeText = new Intl.DateTimeFormat(settings.general.language, {
    timeZone: settings.general.timezone,
    hour: settings.general.timeFormat.startsWith("H") ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: !settings.general.timeFormat.startsWith("H"),
  }).format(date);
  return `${dateText} ${timeText}`;
}
