import type { BuilderSpacing } from "./types";

function normalizeValue(value: string | undefined, unit: string | undefined) {
  const trimmed = value?.trim() || "0";
  return /^-?(?:\d+|\d*\.\d+)$/.test(trimmed)
    ? `${trimmed}${unit || "px"}`
    : trimmed;
}

export function combineBuilderSpacing(
  advanced?: BuilderSpacing,
  style?: BuilderSpacing,
): BuilderSpacing | undefined {
  if (!advanced && !style) return undefined;

  const combineSide = (side: "top" | "right" | "bottom" | "left") => {
    const first = normalizeValue(advanced?.[side], advanced?.unit);
    const second = normalizeValue(style?.[side], style?.unit);
    if (first === "0" || first === "0px") return second;
    if (second === "0" || second === "0px") return first;
    if (first === "auto" || second === "auto") return "auto";
    return `calc(${first} + ${second})`;
  };

  return {
    top: combineSide("top"),
    right: combineSide("right"),
    bottom: combineSide("bottom"),
    left: combineSide("left"),
  };
}

export function builderSpacingCss(
  spacing: BuilderSpacing | undefined,
): string | undefined {
  if (!spacing) return undefined;
  return [spacing.top, spacing.right, spacing.bottom, spacing.left]
    .map((value) => value || "0")
    .join(" ");
}
