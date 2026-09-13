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
  /** When set, this node is rendered once per item of the collection. */
  repeat?: RepeatConfig;
  /** Interactions attached to this node, in execution order. */
  actions?: NodeAction[];
  /** When set, this node renders a component from the document library. */
  instance?: NodeInstance;
  children: AppNode[];
}

/** An image uploaded through the studio. */
export interface AssetFile {
  id: string;
  /** File name including extension, e.g. `hero.png`. */
  name: string;
  mimeType: string;
  /** Raw base64 payload, without the `data:` prefix. */
  base64: string;
  addedAt: string;
}

export type ComponentInputType = 'string' | 'number' | 'boolean';

/** One configurable value on a library component. */
export interface ComponentInputDef {
  /** camelCase identifier used in generated code. */
  name: string;
  label: string;
  type: ComponentInputType;
  /** Literal default, as text. */
  default: string;
}

/**
 * A reusable component: a subtree saved once and dropped anywhere.
 *
 * Instances render the same markup everywhere, so editing the definition updates
 * every copy — in the studio and in the exported project.
 */
export interface ComponentDef {
  id: string;
  name: string;
  description?: string;
  inputs: ComponentInputDef[];
  root: AppNode;
  updatedAt: string;
}

/** A placed copy of a library component. */
export interface NodeInstance {
  componentId: string;
  /** Input values, keyed by input name. Missing keys use the input default. */
  props: Record<string, string | number | boolean>;
}

export type ActionTrigger = 'click' | 'submit' | 'change';
export type ActionKind = 'navigate' | 'openUrl' | 'setState' | 'http';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * One interaction on a node.
 *
 * The studio runs `setState` actions live in preview mode; the generator turns
 * every kind into a real method body in the exported component.
 */
export interface NodeAction {
  id: string;
  trigger: ActionTrigger;
  kind: ActionKind;
  /** `navigate`: target page id. */
  pageId?: string;
  /** `openUrl` and `http`: the address to open or call. */
  url?: string;
  /** `openUrl`: open in a new tab. */
  newTab?: boolean;
  /** `setState` / `http`: state variable to write. */
  variable?: string;
  /** `setState`: value to write. A `{{state.x}}` reference is resolved first. */
  value?: string;
  /** `http`: verb, defaults to GET. */
  method?: HttpMethod;
  /** `http`: assign the response to this state variable. */
  assignTo?: string;
  /** Optional label shown in the studio's action list. */
  label?: string;
}

export type StateType = 'string' | 'number' | 'boolean' | 'list' | 'object';

/**
 * An app level state variable. Exported as a signal on the components that read
 * it, so `{{state.count}}` in the studio becomes `{{ count() }}` in the app.
 */
export interface StateVariable {
  id: string;
  /** camelCase identifier used in generated code. */
  name: string;
  type: StateType;
  /** Literal initial value; for `list` this is JSON array text. */
  initial: string;
  description?: string;
}

/** Repeater configuration: renders the node once per item of a collection. */
export interface RepeatConfig {
  /** Name of a `list` state variable. */
  collection: string;
  /** Identifier each item is bound to, used as `{{item.field}}`. */
  itemName: string;
  /** Identifier for the position, used as `{{index}}`. */
  indexName: string;
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
  /** App level state variables. */
  state: StateVariable[];
  /** Reusable components built in the studio. */
  components: ComponentDef[];
  /** Images uploaded in the studio, exported to `public/assets`. */
  assets: AssetFile[];
  pages: PageDef[];
  settings: AppSettings;
}

/** Result of a tree lookup. */
export interface NodeLocation {
  node: AppNode;
  parent: AppNode | null;
  index: number;
  /** Owning page; absent when the node lives inside a library component. */
  page?: PageDef;
  /** Set when the node lives inside a library component. */
  componentId?: string;
  /** Ancestor chain from the root down to (but excluding) the node. */
  path: AppNode[];
}
