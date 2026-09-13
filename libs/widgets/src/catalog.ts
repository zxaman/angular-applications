import { createNode } from '@appstudio/schema';
import type { AppNode } from '@appstudio/schema';
import { CONTENT_WIDGETS } from './definitions/content';
import { INPUT_WIDGETS } from './definitions/input';
import { LAYOUT_WIDGETS } from './definitions/layout';
import { MEDIA_WIDGETS } from './definitions/media';
import { NAVIGATION_WIDGETS } from './definitions/navigation';
import { derivedStyle } from './style-sync';
import type { WidgetCategory, WidgetDefinition } from './types';

export const WIDGET_CATALOG: WidgetDefinition[] = [
  ...LAYOUT_WIDGETS,
  ...CONTENT_WIDGETS,
  ...INPUT_WIDGETS,
  ...MEDIA_WIDGETS,
  ...NAVIGATION_WIDGETS,
];

const BY_TYPE = new Map<string, WidgetDefinition>(WIDGET_CATALOG.map((widget) => [widget.type, widget]));

export const WIDGET_TYPES: string[] = WIDGET_CATALOG.map((widget) => widget.type);

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  layout: 'Layout',
  content: 'Content',
  input: 'Inputs',
  media: 'Media',
  navigation: 'Navigation',
};

export function getWidget(type: string): WidgetDefinition | undefined {
  return BY_TYPE.get(type);
}

/** Falls back to a generic container so unknown types never crash the canvas. */
export function getWidgetOrFallback(type: string): WidgetDefinition {
  return (
    BY_TYPE.get(type) ?? {
      type,
      label: type,
      category: 'layout',
      icon: 'container',
      description: 'Unknown widget, rendered as a container.',
      isContainer: true,
      maxChildren: -1,
      defaultProps: {},
      propSchema: [],
    }
  );
}

export interface CategoryGroup {
  category: WidgetCategory;
  label: string;
  widgets: WidgetDefinition[];
}

export function groupedCatalog(): CategoryGroup[] {
  const order: WidgetCategory[] = ['layout', 'content', 'input', 'media', 'navigation'];
  return order.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    widgets: WIDGET_CATALOG.filter((widget) => widget.category === category),
  }));
}

export function searchCatalog(query: string): WidgetDefinition[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return WIDGET_CATALOG;
  }
  return WIDGET_CATALOG.filter((widget) =>
    [widget.label, widget.type, widget.description, widget.category].join(' ').toLowerCase().includes(needle),
  );
}

/** Build a ready to drop node for a widget type, with defaults already applied. */
export function createNodeFromWidget(type: string, overrides: Partial<AppNode> = {}): AppNode {
  const widget = getWidgetOrFallback(type);
  const props = { ...widget.defaultProps, ...(overrides.props ?? {}) };
  const node = createNode(widget.type, {
    props,
    style: { ...widget.defaultStyle, ...(overrides.style ?? {}) },
    children: overrides.children ?? (widget.isContainer ? defaultChildrenFor(widget) : []),
    name: overrides.name,
    id: overrides.id,
    componentName: overrides.componentName,
  });
  return { ...node, style: { ...node.style, ...derivedStyle(node) } };
}

function defaultChildrenFor(widget: WidgetDefinition): AppNode[] {
  switch (widget.type) {
    case 'card':
      return [
        createNodeFromWidget('heading', { props: { text: 'Card heading', level: 'h4' }, style: { 'font-size': '16px' } }),
        createNodeFromWidget('text', { props: { text: 'Describe what this card is about.' } }),
      ];
    case 'navbar':
      return [
        createNodeFromWidget('link', { props: { label: 'Home', href: '/' } }),
        createNodeFromWidget('link', { props: { label: 'Features', href: '#features' } }),
        createNodeFromWidget('button', { props: { label: 'Get started', size: 'sm' } }),
      ];
    default:
      return [];
  }
}
