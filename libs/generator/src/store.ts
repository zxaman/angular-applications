import type { StateVariable } from '@appstudio/schema';
import { escapeTs, pascal } from './naming';

/** JSON keys that are not valid identifiers need quoting. */
function tsKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${escapeTs(key)}'`;
}

/** TypeScript type for a primitive JSON value. */
function primitiveType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'unknown';
  }
}

/** Unions two type strings, keeping the output readable. */
function unionTypes(a: string, b: string): string {
  if (a === b) {
    return a;
  }
  const parts = new Set([...a.split(' | '), ...b.split(' | ')]);
  return [...parts].join(' | ');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** `(string | number)[]` needs parens, `string[]` does not. */
function arrayOf(itemType: string): string {
  return itemType.includes(' | ') ? `(${itemType})[]` : `${itemType}[]`;
}

/** Type of a value nested inside a list item or an object variable. */
function nestedType(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'unknown[]';
    }
    if (value.every(isPlainObject)) {
      return 'Record<string, unknown>[]';
    }
    return arrayOf(value.map(primitiveType).reduce(unionTypes));
  }
  if (isPlainObject(value)) {
    const fields = Object.entries(value).map(([key, entry]) => `${tsKey(key)}: ${nestedType(entry)}`);
    return fields.length > 0 ? `{ ${fields.join('; ')} }` : 'Record<string, unknown>';
  }
  return primitiveType(value);
}

export interface ShapeDeclaration {
  name: string;
  body: string;
}

/**
 * Infers an item interface for a list of objects so generated templates can use
 * `{{ item.title }}` instead of `item['title']` (required by `strictTemplates`).
 */
function listItemShape(variable: StateVariable, items: unknown[]): ShapeDeclaration | null {
  const objects = items.filter(isPlainObject);
  if (objects.length === 0 || objects.length !== items.length) {
    return null;
  }
  const keys = [...new Set(objects.flatMap((item) => Object.keys(item)))];
  const fields = keys.map((key) => {
    const present = objects.filter((item) => key in item);
    let type = present.map((item) => nestedType(item[key])).reduce(unionTypes);
    if (present.length < objects.length) {
      type = unionTypes(type, 'undefined');
    }
    return `  ${tsKey(key)}${present.length < objects.length ? '?' : ''}: ${type};`;
  });
  return { name: `${pascal(variable.name)}Item`, body: `export interface ${pascal(variable.name)}Item {\n${fields.join('\n')}\n}` };
}

/** Infers an interface for an `object` variable. */
function objectShape(variable: StateVariable, value: Record<string, unknown>): ShapeDeclaration {
  const fields = Object.entries(value).map(([key, entry]) => `  ${tsKey(key)}: ${nestedType(entry)};`);
  return { name: pascal(variable.name), body: `export interface ${pascal(variable.name)} {\n${fields.join('\n')}\n}` };
}

function parseJson(raw: string | undefined, fallback: unknown): unknown {
  try {
    return JSON.parse(raw ?? '');
  } catch {
    return fallback;
  }
}

interface Resolved {
  type: string;
  initial: string;
  shapes: ShapeDeclaration[];
}

/** TypeScript type + initial value for one variable. */
function resolve(variable: StateVariable): Resolved {
  switch (variable.type) {
    case 'number': {
      const parsed = Number.parseFloat(variable.initial);
      return { type: 'number', initial: Number.isFinite(parsed) ? String(parsed) : '0', shapes: [] };
    }
    case 'boolean':
      return {
        type: 'boolean',
        initial: variable.initial === 'true' || variable.initial === '1' ? 'true' : 'false',
        shapes: [],
      };
    case 'list': {
      const parsed = parseJson(variable.initial, []);
      const items = Array.isArray(parsed) ? parsed : [];
      const shape = listItemShape(variable, items);
      const type = shape ? `${shape.name}[]` : items.length > 0 ? arrayOf(items.map(nestedType).reduce(unionTypes)) : 'unknown[]';
      return { type, initial: JSON.stringify(items), shapes: shape ? [shape] : [] };
    }
    case 'object': {
      const parsed = parseJson(variable.initial, {});
      if (!isPlainObject(parsed)) {
        return { type: 'Record<string, unknown>', initial: '{}', shapes: [] };
      }
      const shape = objectShape(variable, parsed);
      return { type: shape.name, initial: JSON.stringify(parsed), shapes: [shape] };
    }
    case 'string':
    default:
      return { type: 'string', initial: `'${escapeTs(variable.initial ?? '')}'`, shapes: [] };
  }
}

/**
 * The shared state container.
 *
 * Studio state is app level, so it is generated once as an injectable and read
 * through `store.name()`. That keeps the value shared between components and
 * gives generated action handlers something real to write to.
 */
export function emitAppStore(state: StateVariable[]): string {
  const resolved = state.map((variable) => ({ variable, ...resolve(variable) }));
  const shapes = resolved.flatMap((entry) => entry.shapes);
  const uniqueShapes = shapes.filter((shape, index) => shapes.findIndex((other) => other.name === shape.name) === index);

  const signals = resolved
    .map((entry) => {
      const comment = entry.variable.description?.trim();
      const doc = comment ? `  /** ${comment} */\n` : '';
      return `${doc}  readonly ${entry.variable.name} = signal<${entry.type}>(${entry.initial});`;
    })
    .join('\n\n');

  const body = signals || '  /* No state variables yet — add them in the Data panel of the studio. */';

  return `/* Generated by AppStudio — application state. */
import { Injectable, signal } from '@angular/core';

${uniqueShapes.map((shape) => `${shape.body}`).join('\n\n')}${uniqueShapes.length > 0 ? '\n\n' : ''}@Injectable({ providedIn: 'root' })
export class AppStore {
${body}
}
`;
}
