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

export const themeIcons: Record<string, LucideIcon> = registry;
export const themeIconLabels: Record<string, string> = labels;
export const themeIconCategories: Record<string, "lucide" | "brand"> = categories;
