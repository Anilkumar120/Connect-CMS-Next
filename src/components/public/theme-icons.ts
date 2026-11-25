import { createElement } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";
import * as SimpleIcons from "simple-icons";
import type { SimpleIcon } from "simple-icons";

/**
 * Shared icon registry used by the admin builder, canvas preview and public site.
 *
 * - All PascalCase Lucide React icon components are registered dynamically.
 * - All Simple Icons brand marks are registered as SiInstagram, SiFacebook, etc.
 * - Friendly aliases (Instagram, Facebook, LinkedIn...) are also registered
 *   when they do not collide with an existing Lucide export.
 *
 * Keep this file as .ts (not .tsx): brand SVG elements are created with
 * React.createElement so the existing theme-icons.ts import path stays valid.
 */

const registry: Record<string, LucideIcon> = Object.create(null) as Record<string, LucideIcon>;
const labels: Record<string, string> = Object.create(null) as Record<string, string>;
const categories: Record<string, "lucide" | "brand"> = Object.create(null) as Record<string, "lucide" | "brand">;

const lucideExports = LucideIcons as unknown as Record<string, unknown>;

function isReactIconComponent(value: unknown): value is LucideIcon {
  if (typeof value === "function") return true;
  return typeof value === "object" && value !== null && "$$typeof" in value;
}

for (const name of Object.keys(lucideExports)) {
  const candidate = lucideExports[name];
  if (
    !/^[A-Z]/.test(name) ||
    name === "Icon" ||
    name === "LucideProvider" ||
    name === "LucideContext" ||
    !isReactIconComponent(candidate)
  ) {
    continue;
  }

  registry[name] = candidate;
  labels[name] = name;
  categories[name] = "lucide";
}

function isSimpleIcon(value: unknown): value is SimpleIcon {
  if (typeof value !== "object" || value === null) return false;
  const icon = value as Partial<SimpleIcon>;
  return (
    typeof icon.title === "string" &&
    typeof icon.slug === "string" &&
    typeof icon.path === "string" &&
    typeof icon.hex === "string"
  );
}

function createBrandComponent(icon: SimpleIcon): LucideIcon {
  const BrandIcon = (props: LucideProps) => {
    const {
      size = 24,
      color,
      style,
      strokeWidth: _strokeWidth,
      absoluteStrokeWidth: _absoluteStrokeWidth,
      nonScalingStroke: _nonScalingStroke,
      ...svgProps
    } = props;

    const styleColor = typeof style?.color === "string" ? style.color : undefined;
    const requestedColor = color && color !== "currentColor" ? color : styleColor;
    const fillColor = requestedColor && requestedColor !== "currentColor"
      ? requestedColor
      : `#${icon.hex}`;

    return createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        width: size,
        height: size,
        fill: fillColor,
        role: "img",
        "aria-label": icon.title,
        style,
        ...svgProps,
      },
      createElement("title", null, icon.title),
      createElement("path", { d: icon.path }),
    );
  };

  BrandIcon.displayName = `BrandIcon(${icon.title})`;
  return BrandIcon as unknown as LucideIcon;
}

const simpleIconExports = SimpleIcons as unknown as Record<string, unknown>;

for (const exportName of Object.keys(simpleIconExports)) {
  // Simple Icons package exports brand data as siInstagram, siFacebook, etc.
  if (!/^si[A-Z]/.test(exportName)) continue;

  const candidate = simpleIconExports[exportName];
  if (!isSimpleIcon(candidate)) continue;

  const componentName = `Si${exportName.slice(2)}`;
  const component = createBrandComponent(candidate);

  registry[componentName] = component;
  labels[componentName] = candidate.title;
  categories[componentName] = "brand";

  const friendlyName = candidate.title.replace(/[^a-zA-Z0-9]/g, "");
  if (friendlyName && !Object.prototype.hasOwnProperty.call(registry, friendlyName)) {
    registry[friendlyName] = component;
    labels[friendlyName] = candidate.title;
    categories[friendlyName] = "brand";
  }
}

// SOCIAL_BRAND_ALIASES_V8
function registerBrandAlias(alias: string, candidates: string[], title: string) {
  const source = candidates.find((name) => registry[name] && categories[name] === "brand");
  if (!source) return;
  const component = registry[source];
  if (!component) return;
  registry[alias] = component;
  labels[alias] = title;
  categories[alias] = "brand";
}

function registerFallbackBrand(alias: string, title: string, slug: string, path: string, hex: string) {
  if (registry[alias] && categories[alias] === "brand") return;
  const fallback = { title, slug, path, hex } as SimpleIcon;
  registry[alias] = createBrandComponent(fallback);
  labels[alias] = title;
  categories[alias] = "brand";
}

const socialBrandAliases: Array<[string, string[], string]> = [
  ["Facebook", ["SiFacebook"], "Facebook"],
  ["Instagram", ["SiInstagram"], "Instagram"],
  ["LinkedIn", ["SiLinkedin", "SiLinkedIn"], "LinkedIn"],
  ["YouTube", ["SiYoutube", "SiYouTube"], "YouTube"],
  ["TikTok", ["SiTiktok", "SiTikTok"], "TikTok"],
  ["WhatsApp", ["SiWhatsapp", "SiWhatsApp"], "WhatsApp"],
  ["Telegram", ["SiTelegram"], "Telegram"],
  ["Pinterest", ["SiPinterest"], "Pinterest"],
  ["Snapchat", ["SiSnapchat"], "Snapchat"],
  ["Reddit", ["SiReddit"], "Reddit"],
  ["Discord", ["SiDiscord"], "Discord"],
  ["Twitch", ["SiTwitch"], "Twitch"],
  ["Threads", ["SiThreads"], "Threads"],
  ["Spotify", ["SiSpotify"], "Spotify"],
  ["GitHub", ["SiGithub"], "GitHub"],
  ["GitLab", ["SiGitlab"], "GitLab"],
  ["Behance", ["SiBehance"], "Behance"],
  ["Dribbble", ["SiDribbble"], "Dribbble"],
  ["Vimeo", ["SiVimeo"], "Vimeo"],
  ["SoundCloud", ["SiSoundcloud"], "SoundCloud"],
  ["Tumblr", ["SiTumblr"], "Tumblr"],
  ["Mastodon", ["SiMastodon"], "Mastodon"],
  ["Bluesky", ["SiBluesky"], "Bluesky"],
  ["WeChat", ["SiWechat"], "WeChat"],
  ["Weibo", ["SiSinaweibo", "SiWeibo"], "Weibo"],
  ["LINE", ["SiLine"], "LINE"],
  ["Slack", ["SiSlack"], "Slack"],
  ["Medium", ["SiMedium"], "Medium"],
];

for (const [alias, candidates, title] of socialBrandAliases) {
  registerBrandAlias(alias, candidates, title);
}

registerBrandAlias("Twitter", ["SiTwitter"], "Twitter");
registerBrandAlias("XBrand", ["SiX"], "X");

// Guaranteed local SVG fallbacks for platforms often searched by name.
registerFallbackBrand(
  "LinkedIn",
  "LinkedIn",
  "linkedin",
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.35V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  "0A66C2",
);
registerFallbackBrand(
  "XBrand",
  "X",
  "x",
  "M18.901 1.153h3.68l-8.04 9.19 9.46 12.504h-7.406l-5.8-7.584-6.634 7.584h-3.68l8.6-9.828L.006 1.153H7.6l5.242 6.932 6.059-6.932Zm-1.291 19.494h2.039L6.486 3.237H4.298z",
  "000000",
);
registerFallbackBrand(
  "Twitter",
  "Twitter",
  "twitter",
  "M23.953 4.57a10 10 0 0 1-2.825.775 4.932 4.932 0 0 0 2.163-2.723 9.99 9.99 0 0 1-3.127 1.195 4.916 4.916 0 0 0-8.384 4.482A13.957 13.957 0 0 1 1.64 3.162a4.822 4.822 0 0 0-.666 2.475 4.916 4.916 0 0 0 2.188 4.092 4.903 4.903 0 0 1-2.228-.616v.06a4.918 4.918 0 0 0 3.946 4.817 4.936 4.936 0 0 1-2.224.084 4.919 4.919 0 0 0 4.59 3.42A9.867 9.867 0 0 1 0 19.54a13.9 13.9 0 0 0 7.548 2.212c9.057 0 14.01-7.503 14.01-14.01 0-.213-.005-.425-.014-.636a10.012 10.012 0 0 0 2.46-2.548z",
  "1DA1F2",
);
registerBrandAlias("XTwitter", ["XBrand"], "X (formerly Twitter)");
export const themeIcons: Record<string, LucideIcon> = registry;
export const themeIconLabels: Record<string, string> = labels;
export const themeIconCategories: Record<string, "lucide" | "brand"> = categories;
