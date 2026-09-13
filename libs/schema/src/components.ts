import { cloneNode, cloneNodeWithNewIds, createComponent, createInstanceNode } from './factory';
import { findNode, insertNode, removeNode, updateNode } from './tree';
import type { AppDocument, AppNode, ComponentDef, ComponentInputDef, ComponentInputType, NodeInstance } from './types';

/**
 * Reusable component library.
 *
 * Saving a node turns it into a definition plus an instance in its place, so the
 * studio never loses the subtree the user was working on. Instances stay live:
 * editing the definition re-renders every copy, and the exporter emits one
 * standalone component that all instances reference.
 */

export function findComponent(doc: AppDocument, id: string): ComponentDef | undefined {
  return doc.components.find((component) => component.id === id);
}

/** Widget properties that make sense to expose as component inputs. */
export function inferInputs(node: AppNode): ComponentInputDef[] {
  const inputs: ComponentInputDef[] = [];
  for (const [key, value] of Object.entries(node.props)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    if (typeof value === 'boolean') {
      inputs.push({ name: key, label: labelFor(key), type: 'boolean', default: String(value) });
    } else if (typeof value === 'number') {
      inputs.push({ name: key, label: labelFor(key), type: 'number', default: String(value) });
    } else {
      inputs.push({ name: key, label: labelFor(key), type: 'string', default: String(value) });
    }
  }
  return inputs.slice(0, 8);
}

function labelFor(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}

/** Applies a definition's inputs to a cloned subtree so a copy renders correctly. */
function materialise(component: ComponentDef, props: Record<string, string | number | boolean>): AppNode {
  const root = cloneNode(component.root);
  for (const [key, value] of Object.entries(props)) {
    root.props[key] = value;
  }
  return cloneNodeWithNewIds(root);
}

/**
 * Saves a node as a reusable component and replaces it with an instance.
 * Returns the new document and the id of the created component.
 */
export function saveNodeAsComponent(
  doc: AppDocument,
  nodeId: string,
  name: string,
  options: { inputs?: ComponentInputDef[]; description?: string } = {},
): { doc: AppDocument; componentId: string } | null {
  const located = findNode(doc, nodeId);
  if (!located) {
    return null;
  }
  const source = located.node;
  const inputs = options.inputs ?? inferInputs(source);
  const definition = createComponent({
    name,
    description: options.description,
    inputs,
    root: cloneNodeWithNewIds(source),
  });

  const instanceNode = createInstanceNode({ component: definition, id: source.id });
  const next = updateNode(doc, nodeId, () => instanceNode);
  return { doc: { ...next, components: [...next.components, definition] }, componentId: definition.id };
}

/** Drops an instance of a library component into the tree. */
export function insertInstance(
  doc: AppDocument,
  componentId: string,
  parentId: string,
  index: number,
): AppDocument | null {
  const component = findComponent(doc, componentId);
  if (!component) {
    return null;
  }
  return insertNode(doc, parentId, createInstanceNode({ component }), index);
}

/** Sets one input value on an instance. */
export function updateInstanceProp(
  doc: AppDocument,
  nodeId: string,
  key: string,
  value: string | number | boolean,
): AppDocument {
  return updateNode(doc, nodeId, (node) => {
    if (!node.instance) {
      return node;
    }
    const instance: NodeInstance = { ...node.instance, props: { ...node.instance.props, [key]: value } };
    return { ...node, instance };
  });
}

export function updateComponent(doc: AppDocument, id: string, patch: Partial<ComponentDef>): AppDocument {
  return {
    ...doc,
    components: doc.components.map((component) =>
      component.id === id ? { ...component, ...patch, updatedAt: new Date().toISOString() } : component,
    ),
  };
}

export function updateComponentInput(
  doc: AppDocument,
  componentId: string,
  inputName: string,
  patch: Partial<ComponentInputDef>,
): AppDocument {
  const component = findComponent(doc, componentId);
  if (!component) {
    return doc;
  }
  return updateComponent(doc, componentId, {
    inputs: component.inputs.map((input) => (input.name === inputName ? { ...input, ...patch } : input)),
  });
}

export function addComponentInput(doc: AppDocument, componentId: string, input: ComponentInputDef): AppDocument {
  const component = findComponent(doc, componentId);
  if (!component) {
    return doc;
  }
  return updateComponent(doc, componentId, {
    inputs: [...component.inputs.filter((entry) => entry.name !== input.name), input],
  });
}

export function removeComponentInput(doc: AppDocument, componentId: string, inputName: string): AppDocument {
  const component = findComponent(doc, componentId);
  if (!component) {
    return doc;
  }
  return updateComponent(doc, componentId, {
    inputs: component.inputs.filter((input) => input.name !== inputName),
  });
}

/** How many instances of a component exist across every page. */
export function countInstances(doc: AppDocument, componentId: string): number {
  let total = 0;
  const walk = (node: AppNode): void => {
    if (node.instance?.componentId === componentId) {
      total += 1;
    }
    node.children.forEach(walk);
  };
  doc.pages.forEach((page) => walk(page.root));
  return total;
}

/** Replaces an instance with a detached, editable copy of the component subtree. */
export function detachInstance(doc: AppDocument, nodeId: string): AppDocument {
  const located = findNode(doc, nodeId);
  const component = located?.node.instance ? findComponent(doc, located.node.instance.componentId) : undefined;
  if (!located || !component) {
    return doc;
  }
  const copy = materialise(component, located.node.instance?.props ?? {});
  return updateNode(doc, nodeId, (node) => ({
    ...copy,
    id: node.id,
    name: node.name ?? copy.name,
    instance: undefined,
  }));
}

/** Deletes a component and detaches every instance of it. */
export function deleteComponent(doc: AppDocument, componentId: string): AppDocument {
  const component = findComponent(doc, componentId);
  if (!component) {
    return doc;
  }
  let next = detachAll(doc, component);
  return { ...next, components: next.components.filter((entry) => entry.id !== componentId) };
}

function detachAll(doc: AppDocument, component: ComponentDef): AppDocument {
  let next = doc;
  const ids: string[] = [];
  const walk = (node: AppNode): void => {
    if (node.instance?.componentId === component.id) {
      ids.push(node.id);
    }
    node.children.forEach(walk);
  };
  next.pages.forEach((page) => walk(page.root));
  for (const id of ids) {
    next = detachInstance(next, id);
  }
  return next;
}

/** Moves a node into the library as a component without leaving an instance behind. */
export function extractNodeAsComponent(
  doc: AppDocument,
  nodeId: string,
  name: string,
): { doc: AppDocument; componentId: string } | null {
  const saved = saveNodeAsComponent(doc, nodeId, name);
  if (!saved) {
    return null;
  }
  const withoutInstance = removeNode(saved.doc, nodeId);
  return { doc: withoutInstance.doc, componentId: saved.componentId };
}

/** Coerces raw text to an input's type. */
export function coerceInputValue(type: ComponentInputType, raw: string): string | number | boolean {
  if (type === 'number') {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (type === 'boolean') {
    return raw === 'true' || raw === '1';
  }
  return raw;
}

/** Input values for an instance, with defaults filled in. */
export function instanceProps(component: ComponentDef, instance: NodeInstance | undefined): Record<string, string | number | boolean> {
  const props: Record<string, string | number | boolean> = {};
  for (const input of component.inputs) {
    props[input.name] = coerceInputValue(input.type, input.default);
  }
  return { ...props, ...(instance?.props ?? {}) };
}
