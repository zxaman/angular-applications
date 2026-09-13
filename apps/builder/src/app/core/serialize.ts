import type { AppNode, Breakpoint, CssMap } from '@appstudio/schema';
import type { RenderPlan } from '@appstudio/widgets';
import { renderPlan } from '@appstudio/widgets';
import { resolveStyle } from './responsive';

const VOID_TAGS = new Set(['img', 'input', 'hr', 'br', 'source', 'video']);

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Serialises a render plan to readable HTML — used by the inspector Code tab. */
export function planToHtml(plan: RenderPlan, depth = 0): string {
  const pad = '  '.repeat(depth);
  const classes = plan.classes.length > 0 ? ` class="${plan.classes.join(' ')}"` : '';
  const attrs = Object.entries(plan.attrs)
    .map(([name, value]) => ` ${name}="${escape(value)}"`)
    .join('');

  if (VOID_TAGS.has(plan.tag)) {
    return `${pad}<${plan.tag}${classes}${attrs} />`;
  }
  if (plan.html) {
    return `${pad}<${plan.tag}${classes}${attrs}>${plan.html}</${plan.tag}>`;
  }
  if (plan.text !== undefined) {
    return `${pad}<${plan.tag}${classes}${attrs}>${escape(plan.text)}</${plan.tag}>`;
  }
  const children = (plan.children ?? []).map((child) => planToHtml(child, depth + 1)).join('\n');
  if (!children) {
    return `${pad}<${plan.tag}${classes}${attrs}></${plan.tag}>`;
  }
  return `${pad}<${plan.tag}${classes}${attrs}>\n${children}\n${pad}</${plan.tag}>`;
}

export function nodeToHtml(node: AppNode): string {
  return planToHtml(renderPlan(node));
}

/** The SCSS rule the generator will write for this node. */
export function nodeToScss(node: AppNode, breakpoint: Breakpoint): string {
  const selector = `.${node.type}-${node.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toLowerCase()}`;
  const chunks: string[] = [];
  const base = resolveStyle(node, 'base');
  if (Object.keys(base).length > 0) {
    chunks.push(`${selector} {\n${declarations(base)}\n}`);
  }
  const override = node.styles?.[breakpoint === 'base' ? 'sm' : breakpoint];
  if (breakpoint !== 'base' && override && Object.keys(override).length > 0) {
    chunks.push(`@media (min-width: ...) {\n  ${selector} {\n${declarations(override, '    ')}\n  }\n}`);
  }
  if (node.css?.trim()) {
    chunks.push(`/* Imported from ${node.cssFileName ?? 'custom.css'} */\n${node.css.trim()}`);
  }
  return chunks.length > 0 ? chunks.join('\n\n') : '/* No custom styles yet. */';
}

function declarations(style: CssMap, pad = '  '): string {
  return Object.entries(style)
    .filter(([, value]) => value !== '')
    .map(([property, value]) => `${pad}${property}: ${value};`)
    .join('\n');
}
