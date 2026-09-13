import type { AppDocument, AppNode, RepeatConfig, StateVariable } from './types';

/**
 * Binding evaluation.
 *
 * The studio stores bindings as text (`{{state.count}}`) inside ordinary widget
 * properties. This module is the single interpreter for that syntax: the canvas
 * uses it to render live values and the generator uses it to decide which
 * signals a component needs.
 */

export interface BindingContext {
  /** State variables by name. */
  state: Record<string, unknown>;
  /** Repeater locals, e.g. `{ item: {...}, index: 0 }`. */
  locals: Record<string, unknown>;
}

export const EMPTY_CONTEXT: BindingContext = { state: {}, locals: {} };

const BINDING_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
/** Non-global twin of {@link BINDING_PATTERN}: safe for `test()` (a global regex keeps `lastIndex`). */
const BINDING_TEST = /\{\{\s*[^{}]+?\s*\}\}/;

/** Converts a variable's stored text into a runtime value. */
export function parseStateValue(variable: StateVariable): unknown {
  const raw = variable.initial ?? '';
  switch (variable.type) {
    case 'number': {
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    case 'boolean':
      return raw === 'true' || raw === '1';
    case 'list': {
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    case 'object': {
      try {
        const parsed: unknown = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    case 'string':
    default:
      return raw;
  }
}

/** Builds the state map used for previews. */
export function stateMap(doc: AppDocument): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const variable of doc.state) {
    map[variable.name] = parseStateValue(variable);
  }
  return map;
}

/** Resolves a dotted path such as `state.user.name` or `item.title`. */
export function resolvePath(context: BindingContext, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }
  const [head, ...rest] = parts;
  let current: unknown = head === 'state' ? context.state : context.locals[head];
  if (head === 'state') {
    for (const part of rest) {
      current = readProperty(current, part);
    }
    return current;
  }
  if (current === undefined) {
    return undefined;
  }
  for (const part of rest) {
    current = readProperty(current, part);
  }
  return current;
}

function readProperty(target: unknown, key: string): unknown {
  if (target === null || target === undefined) {
    return undefined;
  }
  if (Array.isArray(target) && key === 'length') {
    return target.length;
  }
  if (typeof target === 'object') {
    return (target as Record<string, unknown>)[key];
  }
  return undefined;
}

export function stringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Replaces every `{{ ... }}` in a string with its current value. */
export function evaluateBindings(text: string, context: BindingContext): string {
  if (!text.includes('{{')) {
    return text;
  }
  return text.replace(BINDING_PATTERN, (_match, path: string) => stringify(resolvePath(context, path.trim())));
}

/** True when the text contains at least one binding. */
export function hasBindings(text: string): boolean {
  return BINDING_TEST.test(text);
}

/** Every binding path referenced in a string, e.g. `['state.count', 'item.name']`. */
export function bindingPaths(text: string): string[] {
  const paths: string[] = [];
  for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    paths.push(match[1].trim());
  }
  return paths;
}

/** State variable names referenced by a value. */
export function referencedStateNames(text: string): string[] {
  return bindingPaths(text)
    .filter((path) => path.startsWith('state.'))
    .map((path) => path.split('.')[1])
    .filter((name): name is string => Boolean(name));
}

/** Collects every binding used in a node's properties. */
export function nodeBindingTexts(node: AppNode): string[] {
  return Object.values(node.props)
    .filter((value): value is string => typeof value === 'string')
    .filter((value) => value.includes('{{'));
}

/** The items a repeater should render, resolved against the document's state. */
export function resolveCollection(doc: AppDocument, repeat: RepeatConfig): unknown[] {
  const value = stateMap(doc)[repeat.collection];
  return Array.isArray(value) ? value : [];
}

/** Builds the local context for one iteration of a repeater. */
export function repeatContext(repeat: RepeatConfig, item: unknown, index: number): Record<string, unknown> {
  return {
    [repeat.itemName || 'item']: item,
    [repeat.indexName || 'index']: index,
  };
}

/** Finds a state variable by name. */
export function findStateVariable(doc: AppDocument, name: string): StateVariable | undefined {
  return doc.state.find((variable) => variable.name === name);
}
