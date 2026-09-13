import type { PropSchema } from './types';

/** Small builders that keep the catalog readable. */

export function textProp(key: string, label: string, group: PropSchema['group'] = 'content', extra: Partial<PropSchema> = {}): PropSchema {
  return { key, label, control: 'text', group, ...extra };
}

export function textareaProp(key: string, label: string, group: PropSchema['group'] = 'content', extra: Partial<PropSchema> = {}): PropSchema {
  return { key, label, control: 'textarea', group, ...extra };
}

export function numberProp(key: string, label: string, group: PropSchema['group'] = 'appearance', extra: Partial<PropSchema> = {}): PropSchema {
  return { key, label, control: 'number', group, ...extra };
}

export function booleanProp(key: string, label: string, group: PropSchema['group'] = 'behaviour', extra: Partial<PropSchema> = {}): PropSchema {
  return { key, label, control: 'boolean', group, ...extra };
}

export function selectProp(
  key: string,
  label: string,
  options: PropSchema['options'],
  group: PropSchema['group'] = 'appearance',
  extra: Partial<PropSchema> = {},
): PropSchema {
  return { key, label, control: 'select', options, group, ...extra };
}

export function urlProp(key: string, label: string, group: PropSchema['group'] = 'content', extra: Partial<PropSchema> = {}): PropSchema {
  return { key, label, control: 'url', group, ...extra };
}

export function optionsProp(key: string, label: string, group: PropSchema['group'] = 'content', extra: Partial<PropSchema> = {}): PropSchema {
  return { key, label, control: 'options', group, ...extra };
}

/** `"one\ntwo"` -> `['one', 'two']`, ignoring blanks. */
export function parseList(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseSelectOptions(value: unknown): { label: string; value: string }[] {
  return parseList(value).map((line) => {
    const [rawValue, ...rest] = line.split(':');
    const label = rest.length > 0 ? rest.join(':').trim() : rawValue.trim();
    return { value: rawValue.trim(), label };
  });
}

export function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

export function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return value === true || value === 'true' || value === '1';
}
