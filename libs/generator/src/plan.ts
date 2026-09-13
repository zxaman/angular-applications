import type { AppDocument, AppNode, PageDef } from '@appstudio/schema';
import { getWidgetOrFallback, isBindable, shortId } from '@appstudio/widgets';
import { kebab, NameRegistry, pascal, selectorFor } from './naming';
import type { Granularity } from './types';

export interface InputPlan {
  /** Widget property key. */
  prop: string;
  /** Signal input name in the generated class. */
  name: string;
  type: 'string' | 'number' | 'boolean';
  value: string | number | boolean;
  label: string;
}

export interface ComponentPlan {
  /** Node this component renders (its root). */
  node: AppNode;
  className: string;
  selector: string;
  /** Folder under `src/app`, e.g. `components/hero-section`. */
  folder: string;
  fileBase: string;
  kind: 'page' | 'component' | 'widget';
  /** Set for plans built from the document's component library. */
  componentId?: string;
  page?: PageDef;
  route?: string;
  title?: string;
  inputs: InputPlan[];
  /** Component plans nested directly inside this one. */
  children: ComponentPlan[];
}

export interface ProjectPlan {
  pages: ComponentPlan[];
  /** Reusable components from the document library. */
  library: ComponentPlan[];
  /** Every plan, parents before children. */
  all: ComponentPlan[];
  byNodeId: Map<string, ComponentPlan>;
  /** Library plans by component id, for instance nodes. */
  byComponentId: Map<string, ComponentPlan>;
  warnings: string[];
}

function shouldExtract(node: AppNode, granularity: Granularity): boolean {
  if (granularity === 'widget') {
    return true;
  }
  if (granularity === 'component') {
    return Boolean(node.componentName && node.componentName.trim().length > 0);
  }
  return false;
}

function defaultComponentName(node: AppNode): string {
  const widget = getWidgetOrFallback(node.type);
  if (node.componentName?.trim()) {
    return node.componentName.trim();
  }
  if (node.name?.trim()) {
    return node.name.trim();
  }
  return `${widget.label} ${shortId(node.id)}`;
}

function buildInputs(node: AppNode): InputPlan[] {
  const widget = getWidgetOrFallback(node.type);
  const registry = new NameRegistry();
  const inputs: InputPlan[] = [];

  for (const prop of widget.propSchema) {
    const raw = node.props[prop.key];
    if (raw === null || raw === undefined) {
      continue;
    }
    if (!isBindable(node.type, prop.key, prop.bindable)) {
      continue;
    }
    let type: InputPlan['type'] = 'string';
    let value: string | number | boolean = String(raw);
    if (prop.control === 'boolean') {
      type = 'boolean';
      value = raw === true || raw === 'true';
    } else if (prop.control === 'number') {
      type = 'number';
      const parsed = Number(raw);
      value = Number.isFinite(parsed) ? parsed : 0;
    }
    inputs.push({ prop: prop.key, name: registry.unique(prop.key), type, value, label: prop.label });
  }
  return inputs;
}

/**
 * Decides which parts of the tree become their own Angular components and how
 * they nest. This is the single place where "component separation" is defined,
 * so the exported file tree is always predictable:
 *
 * - `page`      → one component per page, everything inline.
 * - `component` → pages plus every node the user marked "Convert to component".
 * - `widget`    → one component per widget instance.
 */
export function planProject(doc: AppDocument, granularity: Granularity = 'component'): ProjectPlan {
  const nameRegistry = new NameRegistry();
  const warnings: string[] = [];
  const all: ComponentPlan[] = [];
  const byNodeId = new Map<string, ComponentPlan>();
  const byComponentId = new Map<string, ComponentPlan>();
  const pages: ComponentPlan[] = [];
  const library: ComponentPlan[] = [];

  // Library components first so their class names are stable regardless of
  // which page happens to use them.
  for (const component of doc.components ?? []) {
    const slug = kebab(component.name).slice(0, 48) || 'component';
    const plan: ComponentPlan = {
      node: component.root,
      className: nameRegistry.unique(`${pascal(component.name)}Component`),
      selector: selectorFor(doc.settings.prefix, slug),
      folder: `components/${slug}`,
      fileBase: `${slug}.component`,
      kind: 'component',
      componentId: component.id,
      inputs: component.inputs.map((input) => ({
        prop: input.name,
        name: input.name,
        type: input.type,
        value:
          input.type === 'number'
            ? Number.parseFloat(input.default) || 0
            : input.type === 'boolean'
              ? input.default === 'true'
              : input.default,
        label: input.label,
      })),
      children: [],
    };
    library.push(plan);
    all.push(plan);
    byComponentId.set(component.id, plan);
    byNodeId.set(component.root.id, plan);
  }

  for (const page of doc.pages) {
    const slug = kebab(page.name) === 'item' ? 'home' : kebab(page.name);
    const pagePlan: ComponentPlan = {
      node: page.root,
      className: nameRegistry.unique(`${pascal(page.name)}Component`),
      selector: selectorFor(doc.settings.prefix, slug),
      folder: `pages/${slug}`,
      fileBase: `${slug}.component`,
      kind: 'page',
      page,
      route: page.route,
      title: page.title,
      inputs: [],
      children: [],
    };
    all.push(pagePlan);
    byNodeId.set(page.root.id, pagePlan);
    pages.push(pagePlan);

    // Depth first: an ancestor is always planned before its descendants, so the
    // owner of every node is known by the time we reach it.
    const ownerOf = new Map<string, ComponentPlan>([[page.root.id, pagePlan]]);
    const visit = (node: AppNode): void => {
      const owner = ownerOf.get(node.id);
      if (!owner) {
        return;
      }
      for (const child of node.children) {
        if (shouldExtract(child, granularity)) {
          const plan = createPlan(child, doc, nameRegistry, warnings);
          owner.children.push(plan);
          all.push(plan);
          byNodeId.set(child.id, plan);
          ownerOf.set(child.id, plan);
        } else {
          ownerOf.set(child.id, owner);
        }
        visit(child);
      }
    };
    visit(page.root);
  }

  return { pages, library, all, byNodeId, byComponentId, warnings };
}

function createPlan(node: AppNode, doc: AppDocument, nameRegistry: NameRegistry, warnings: string[]): ComponentPlan {
  const rawName = defaultComponentName(node);
  const className = nameRegistry.unique(`${pascal(rawName)}Component`);
  const slug = kebab(rawName).slice(0, 48);
  const kind: ComponentPlan['kind'] = node.componentName?.trim() ? 'component' : 'widget';
  if (slug.length >= 48) {
    warnings.push(`Component name "${rawName}" is long; its folder was shortened to "${slug}".`);
  }
  return {
    node,
    className,
    selector: selectorFor(doc.settings.prefix, slug),
    folder: `${kind === 'component' ? 'components' : 'widgets'}/${slug}`,
    fileBase: `${slug}.component`,
    kind,
    inputs: buildInputs(node),
    children: [],
  };
}
