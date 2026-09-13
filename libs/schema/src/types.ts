/**
 * Core document model shared by the builder UI and the code generator.
 *
 * A project is a single JSON document. Everything the editor does is a pure
 * transformation of that document, which makes history (undo/redo), persistence
 * and code generation straightforward.
 */

/** Responsive breakpoints, smallest first. `base` is the un-prefixed default. */
export type Breakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl';

/** Style values for the non-base breakpoints, keyed by breakpoint. */
export type BreakpointStyles = Partial<Record<Exclude<Breakpoint, 'base'>, CssMap>>;

/** A flat map of CSS property -> value, e.g. `{ 'flex-direction': 'row' }`. */
export type CssMap = Record<string, string>;

/** Widget properties are simple, JSON serialisable scalars. */
export type NodeProps = Record<string, string | number | boolean | null>;

/**
 * A single widget instance in the tree.
 *
 * `css` holds a stylesheet imported by the user for this specific node. It is
 * scoped to the generated component so it can never leak into the rest of the app.
 */
export interface AppNode {
  /** Stable unique id. */
  id: string;
  /** Widget type key from the widget catalog (e.g. `text`, `button`, `row`). */
  type: string;
  /** Optional label shown in the outline tree. */
  name?: string;
  /**
   * When set, this node is extracted into its own Angular component during
   * code generation ("Convert to component"). The value is the component name.
   */
  componentName?: string;
  props: NodeProps;
  /** Base (all breakpoints) inline styles. */
  style: CssMap;
  /** Per-breakpoint style overrides. */
  styles?: BreakpointStyles;
  /** Raw CSS imported for this node. */
  css?: string;
  /** File name the CSS was imported from (kept for provenance in the UI). */
  cssFileName?: string;
  children: AppNode[];
}

export interface PageDef {
  id: string;
  name: string;
  /** Route path without leading slash, e.g. `about` or `settings/profile`. */
  route: string;
  /** Document title for the page. */
  title: string;
  /** Root container node of the page. */
  root: AppNode;
  /** Optional raw CSS applied to the whole page component. */
  css?: string;
  cssFileName?: string;
}

export interface ThemeTokens {
  primary: string;
  onPrimary: string;
  secondary: string;
  accent: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  /** Corner radius in px. */
  radius: number;
  /** Base spacing unit in px; the scale is derived from it. */
  spacing: number;
  fontHeading: string;
  fontBody: string;
  /** Root font size in px. */
  fontScale: number;
  shadow: string;
}

export interface StyleFile {
  /** Original file name, e.g. `brand.css`. */
  name: string;
  /** Verbatim file content. */
  content: string;
  /** ISO timestamp of the import. */
  importedAt: string;
}

export interface AppMeta {
  name: string;
  description: string;
  version: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  /** Selector prefix used by generated Angular components, e.g. `app`. */
  prefix: string;
  /** Breakpoint previewed in the canvas by default. */
  defaultBreakpoint: Breakpoint;
  /** Include Capacitor configuration in exported projects. */
  includeCapacitor: boolean;
}

export interface AppDocument {
  /** Schema version, bumped by `migrate()`. */
  version: number;
  kind: 'appstudio.document';
  meta: AppMeta;
  theme: ThemeTokens;
  /** Global stylesheets imported by the user. */
  globalStyles: StyleFile[];
  pages: PageDef[];
  settings: AppSettings;
}

/** Result of a tree lookup. */
export interface NodeLocation {
  node: AppNode;
  parent: AppNode | null;
  index: number;
  page: PageDef;
  /** Ancestor chain from the page root down to (but excluding) the node. */
  path: AppNode[];
}
