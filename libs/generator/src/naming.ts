const RESERVED = new Set([
  'component',
  'module',
  'service',
  'class',
  'new',
  'import',
  'export',
  'default',
  'null',
  'undefined',
  'true',
  'false',
]);

export function kebab(value: string): string {
  const slug = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

export function pascal(value: string): string {
  const parts = kebab(value).split('-').filter(Boolean);
  const pascalised = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  return pascalised || 'Item';
}

export function camel(value: string): string {
  const pascalised = pascal(value);
  const lower = pascalised.charAt(0).toLowerCase() + pascalised.slice(1);
  return RESERVED.has(lower) ? `${lower}Value` : lower;
}

/** `Hero Section` -> `HeroSectionComponent`. */
export function componentName(value: string): string {
  return `${pascal(value)}Component`;
}

export function selectorFor(prefix: string, value: string): string {
  return `${prefix}-${kebab(value)}`;
}

export function fileName(value: string): string {
  return kebab(value);
}

/** Guarantees unique identifiers inside one generated project. */
export class NameRegistry {
  private readonly used = new Set<string>();

  unique(candidate: string): string {
    const base = candidate || 'Item';
    if (!this.used.has(base)) {
      this.used.add(base);
      return base;
    }
    let index = 2;
    while (this.used.has(`${base}${index}`)) {
      index += 1;
    }
    const unique = `${base}${index}`;
    this.used.add(unique);
    return unique;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes a value for use inside a double quoted HTML attribute. */
export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escapes a value for use inside a single quoted TS string literal. */
export function escapeTs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
}

/** Indents a block of text, skipping empty lines. */
export function indent(text: string, size = 2): string {
  const pad = ' '.repeat(size);
  return text
    .split('\n')
    .map((line) => (line.trim().length > 0 ? pad + line : line))
    .join('\n');
}

/** `state.count` -> `store.count()`, `state.user.name` -> `store.user().name`. */
export function toAngularExpression(path: string): string {
  if (!path.startsWith('state.')) {
    return path;
  }
  const [head, ...tail] = path.slice('state.'.length).split('.');
  return tail.length > 0 ? `store.${head}().${tail.join('.')}` : `store.${head}()`;
}
