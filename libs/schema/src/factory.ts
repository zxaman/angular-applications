import { createId } from './ids';
import type {
  AppDocument,
  AppNode,
  ComponentDef,
  ComponentInputDef,
  CssMap,
  NodeInstance,
  NodeProps,
  PageDef,
  StateType,
  StateVariable,
  ThemeTokens,
} from './types';

export const DOCUMENT_VERSION = 3;
export const DOCUMENT_KIND = 'appstudio.document' as const;

export const DEFAULT_THEME: ThemeTokens = {
  primary: '#4f46e5',
  onPrimary: '#ffffff',
  secondary: '#0ea5e9',
  accent: '#f59e0b',
  surface: '#ffffff',
  surfaceAlt: '#f4f5f7',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  radius: 10,
  spacing: 8,
  fontHeading: "'Inter', system-ui, sans-serif",
  fontBody: "'Inter', system-ui, sans-serif",
  fontScale: 16,
  shadow: '0 10px 30px rgba(15, 23, 42, 0.10)',
};

export function createNode(
  type: string,
  options: {
    props?: NodeProps;
    style?: CssMap;
    children?: AppNode[];
    name?: string;
    id?: string;
    componentName?: string;
    instance?: NodeInstance;
  } = {},
): AppNode {
  return {
    id: options.id ?? createId('n'),
    type,
    name: options.name,
    componentName: options.componentName,
    instance: options.instance,
    props: { ...options.props },
    style: { ...options.style },
    children: options.children ? [...options.children] : [],
  };
}

export function createPage(options: {
  name: string;
  route?: string;
  title?: string;
  root?: AppNode;
  id?: string;
}): PageDef {
  const name = options.name.trim() || 'Page';
  return {
    id: options.id ?? createId('p'),
    name,
    route: options.route ?? slugifyRoute(name),
    title: options.title ?? name,
    root: options.root ?? createNode('container', { props: { label: name } }),
  };
}

export function createDocument(name = 'My Application'): AppDocument {
  const now = new Date().toISOString();
  const home = createPage({ name: 'Home', route: '' });
  return {
    version: DOCUMENT_VERSION,
    kind: DOCUMENT_KIND,
    meta: {
      name,
      description: 'Built visually with AppStudio.',
      version: '0.1.0',
      author: '',
      createdAt: now,
      updatedAt: now,
    },
    theme: { ...DEFAULT_THEME },
    globalStyles: [],
    state: [],
    components: [],
    pages: [home],
    settings: {
      prefix: 'app',
      defaultBreakpoint: 'md',
      includeCapacitor: false,
    },
  };
}

/** `Settings & Profile` -> `settings-profile`, and the first page becomes the index route. */
export function slugifyRoute(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === 'home' || slug === '' ? '' : slug;
}

/** Creates a state variable with a sensible default for its type. */
export function createStateVariable(options: {
  name: string;
  type?: StateType;
  initial?: string;
  description?: string;
  id?: string;
}): StateVariable {
  const type = options.type ?? 'string';
  const defaults: Record<StateType, string> = { string: '', number: '0', boolean: 'false', list: '[]', object: '{}' };
  return {
    id: options.id ?? createId('s'),
    name: sanitiseIdentifier(options.name),
    type,
    initial: options.initial ?? defaults[type],
    description: options.description,
  };
}

/** Creates a reusable component definition from an existing subtree. */
export function createComponent(options: {
  name: string;
  root: AppNode;
  inputs?: ComponentInputDef[];
  description?: string;
  id?: string;
}): ComponentDef {
  return {
    id: options.id ?? createId('c'),
    name: options.name.trim() || 'Component',
    description: options.description,
    inputs: options.inputs ?? [],
    root: options.root,
    updatedAt: new Date().toISOString(),
  };
}

/** A node that renders a library component instead of its own subtree. */
export function createInstanceNode(options: {
  component: ComponentDef;
  id?: string;
  props?: Record<string, string | number | boolean>;
}): AppNode {
  const props: Record<string, string | number | boolean> = {};
  for (const input of options.component.inputs) {
    props[input.name] = input.type === 'number' ? Number(input.default) || 0 : input.type === 'boolean' ? input.default === 'true' : input.default;
  }
  return createNode(options.component.root.type, {
    id: options.id,
    name: options.component.name,
    props: {},
    style: {},
    children: [],
    instance: { componentId: options.component.id, props: { ...props, ...(options.props ?? {}) } },
  });
}

/** `User Name` -> `userName`; keeps generated code valid. */
export function sanitiseIdentifier(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_$ ]/g, '')
    .replace(/\s+(.)/g, (_match, char: string) => char.toUpperCase())
    .replace(/\s+/g, '');
  const camel = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  const safe = /^[a-zA-Z_$]/.test(camel) ? camel : `value${camel}`;
  return safe || 'value';
}

export function isAppDocument(value: unknown): value is AppDocument {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<AppDocument>;
  return candidate.kind === DOCUMENT_KIND && Array.isArray(candidate.pages);
}

export function cloneDocument(doc: AppDocument): AppDocument {
  return structuredClone(doc);
}

export function cloneNode(node: AppNode): AppNode {
  return structuredClone(node);
}

/** Deep clone of a subtree with brand new ids, used by duplicate/paste. */
export function cloneNodeWithNewIds(node: AppNode): AppNode {
  const copy = cloneNode(node);
  const walk = (current: AppNode): void => {
    current.id = createId('n');
    current.children.forEach(walk);
  };
  walk(copy);
  return copy;
}
