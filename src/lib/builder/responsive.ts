import type {
  BuilderDevice,
  BuilderNode,
  BuilderStyle,
  BuilderStyleResponsiveOverride,
} from "@/lib/builder/types";

type PlainRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is PlainRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function mergeDeep(base: unknown, override: unknown): unknown {
  if (!isPlainRecord(base) || !isPlainRecord(override)) {
    return override === undefined ? base : override;
  }

  const result: PlainRecord = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    result[key] =
      isPlainRecord(result[key]) && isPlainRecord(value)
        ? mergeDeep(result[key], value)
        : value;
  }
  return result;
}

function diffDeep(base: unknown, next: unknown): unknown {
  if (Object.is(base, next)) return undefined;

  if (isPlainRecord(base) && isPlainRecord(next)) {
    const result: PlainRecord = {};
    for (const [key, nextValue] of Object.entries(next)) {
      const difference = diffDeep(base[key], nextValue);
      if (difference !== undefined) result[key] = difference;
    }
    return Object.keys(result).length ? result : undefined;
  }

  if (Array.isArray(base) && Array.isArray(next)) {
    return JSON.stringify(base) === JSON.stringify(next) ? undefined : next;
  }

  return next;
}

/**
 * Resolve the shared Desktop style plus the selected device's explicit
 * overrides. Tablet and Mobile always inherit from Desktop, never from one
 * another, matching Elementor's independent device editing behaviour.
 */
export function resolveBuilderStyles(
  styles: BuilderStyle | undefined,
  device: BuilderDevice,
): BuilderStyle {
  if (!styles) return {};
  const { responsive, ...base } = styles;
  if (device === "desktop") return base;
  return mergeDeep(base, responsive?.[device] || {}) as BuilderStyle;
}

/**
 * Update one style setting for the active device. Desktop edits update the
 * base value. Tablet/Mobile edits store only the changed portion, so all
 * untouched values continue to inherit from Desktop.
 */
export function setBuilderStyleForDevice<K extends keyof BuilderStyle>(
  styles: BuilderStyle,
  key: K,
  value: BuilderStyle[K],
  device: BuilderDevice,
): BuilderStyle {
  if (device === "desktop") {
    return { ...styles, [key]: value };
  }

  const base = resolveBuilderStyles(styles, "desktop");
  const difference = diffDeep(base[key], value);
  const responsive = { ...(styles.responsive || {}) };
  const deviceOverride = { ...(responsive[device] || {}) } as PlainRecord;

  if (difference === undefined) {
    delete deviceOverride[String(key)];
  } else {
    deviceOverride[String(key)] = difference;
  }

  if (Object.keys(deviceOverride).length) {
    responsive[device] = deviceOverride as BuilderStyleResponsiveOverride;
  } else {
    delete responsive[device];
  }

  return {
    ...styles,
    responsive: Object.keys(responsive).length ? responsive : undefined,
  };
}

/** Merge device-specific visual widget props without changing shared content props. */
export function resolveBuilderProps(
  props: Record<string, unknown>,
  device: BuilderDevice,
): Record<string, unknown> {
  const responsive = props.__responsive;
  if (!responsive || typeof responsive !== "object") return props;
  const overrides = (responsive as Record<string, unknown>)[device];
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return props;
  }
  const result = { ...props };
  delete result.__responsive;
  return { ...result, ...(overrides as Record<string, unknown>) };
}

/** Persist a Style-tab widget prop at the active device; Content-tab props stay shared. */
export function setBuilderPropForDevice(
  props: Record<string, unknown>,
  key: string,
  value: unknown,
  device: BuilderDevice,
): Record<string, unknown> {
  if (device === "desktop") {
    return { ...props, [key]: value };
  }

  const responsive =
    props.__responsive && typeof props.__responsive === "object"
      ? (props.__responsive as Record<string, Record<string, unknown>>)
      : {};
  const nextResponsive = {
    ...responsive,
    [device]: {
      ...(responsive[device] || {}),
      [key]: value,
    },
  };

  return {
    ...props,
    __responsive: nextResponsive,
  };
}

/** A CSS-safe list of responsive widget visual properties for public CSS vars. */
export function getResponsiveBuilderPropOverrides(
  node: BuilderNode,
  device: Exclude<BuilderDevice, "desktop">,
): Record<string, unknown> {
  const responsive = node.props.__responsive;
  if (!responsive || typeof responsive !== "object") return {};
  const overrides = (responsive as Record<string, unknown>)[device];
  return overrides && typeof overrides === "object" && !Array.isArray(overrides)
    ? (overrides as Record<string, unknown>)
    : {};
}
