import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * A shared name-to-component registry used by the builder's icon picker and
 * the public renderer. Keeping both sides on the same registry means a
 * selected Lucide icon is not lost when the saved page is rendered publicly.
 */
const registry = Object.entries(LucideIcons).reduce<Record<string, LucideIcon>>(
  (icons, [name, component]) => {
    // Lucide exports components as forwardRef objects. Exclude utility exports
    // and keep only PascalCase component names.
    if (
      /^[A-Z]/.test(name) &&
      name !== "Icon" &&
      component !== null &&
      (typeof component === "object" || typeof component === "function")
    ) {
      icons[name] = component as unknown as LucideIcon;
    }
    return icons;
  }, {} as Record<string, LucideIcon>,
);

export const themeIcons: Record<string, LucideIcon> = registry;
