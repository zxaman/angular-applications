import type { AppNode } from '@appstudio/schema';

export type PropControl =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'boolean'
  | 'color'
  | 'slider'
  | 'url'
  | 'options'
  | 'route';

export interface PropOption {
  label: string;
  value: string | number | boolean;
}

export interface PropSchema {
  key: string;
  label: string;
  control: PropControl;
  group: 'content' | 'appearance' | 'behaviour';
  options?: PropOption[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  help?: string;
  /**
   * False for properties that only affect the editor (empty state labels) or are
   * compiled into styles/markup, so they are not exposed as component inputs.
   */
  bindable?: boolean;
}

export type WidgetCategory = 'layout' | 'content' | 'input' | 'media' | 'navigation';

export interface WidgetDefinition {
  type: string;
  label: string;
  category: WidgetCategory;
  /** Key into the builder icon set. */
  icon: string;
  description: string;
  /** Can hold child widgets. */
  isContainer: boolean;
  /** Suggested maximum direct children (`-1` = unlimited). */
  maxChildren: number;
  /** Extra CSS classes applied to the widget root. */
  classNames?: string[];
  defaultProps: Record<string, string | number | boolean | null>;
  propSchema: PropSchema[];
  /** Default inline styles applied when the widget is dropped. */
  defaultStyle?: Record<string, string>;
}

/**
 * Tag/attribute level description of a widget instance.
 *
 * This is the single source of truth for "what HTML does this widget become".
 * The canvas renders it directly and the generator turns it into real Angular
 * templates, so preview and exported code can never drift apart.
 */
export interface RenderPlan {
  tag: string;
  /** Attribute name -> value. Values are already escaped for HTML attributes. */
  attrs: Record<string, string>;
  classes: string[];
  /** Text content (mutually exclusive with `children`). */
  text?: string;
  /** Literal markup emitted as the element content (used by the icon widget). */
  html?: string;
  children?: RenderPlan[];
  /** Void element: `<img>`, `<input>`, `<hr>` … */
  void?: boolean;
  /** The node the plan was produced from. */
  node: AppNode;
}
