import { createId } from './ids';
import type { AppDocument, AppNode, CssMap, NodeProps, PageDef, ThemeTokens } from './types';

export const DOCUMENT_VERSION = 1;
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
  } = {},
): AppNode {
  return {
    id: options.id ?? createId('n'),
    type,
    name: options.name,
    componentName: options.componentName,
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
