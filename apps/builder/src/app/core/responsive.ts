import { BREAKPOINT_ORDER, type AppNode, type Breakpoint, type CssMap } from '@appstudio/schema';

const OVERRIDES = ['sm', 'md', 'lg', 'xl'] as const;

/**
 * Resolves the styles that apply at a given breakpoint, mobile first: base rules
 * plus every override up to and including the active breakpoint. The canvas uses
 * this because a component sized like a phone is not a real viewport, so CSS
 * media queries cannot do the work for us.
 */
export function resolveStyle(node: AppNode, breakpoint: Breakpoint): CssMap {
  const limit = BREAKPOINT_ORDER[breakpoint];
  const merged: CssMap = { ...node.style };
  for (const bp of OVERRIDES) {
    if (BREAKPOINT_ORDER[bp] <= limit) {
      Object.assign(merged, node.styles?.[bp] ?? {});
    }
  }
  return merged;
}

export function styleToString(style: CssMap): string {
  return Object.entries(style)
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([property, value]) => `${property}: ${value};`)
    .join(' ');
}

/** Properties that have an override at (or below) a breakpoint. */
export function overriddenProperties(node: AppNode, breakpoint: Breakpoint): Set<string> {
  const limit = BREAKPOINT_ORDER[breakpoint];
  const properties = new Set<string>();
  for (const bp of OVERRIDES) {
    if (BREAKPOINT_ORDER[bp] <= limit) {
      for (const key of Object.keys(node.styles?.[bp] ?? {})) {
        properties.add(key);
      }
    }
  }
  return properties;
}

/** Turns `12` into `12px`, leaving relative and keyword values untouched. */
export function withUnit(value: string, unit = 'px'): string {
  const trimmed = value.trim();
  if (trimmed === '' || /^[0-9.]+$/.test(trimmed)) {
    return `${trimmed}${unit}`;
  }
  return trimmed;
}
