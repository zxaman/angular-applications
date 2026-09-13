import { cloneNode, cloneNodeWithNewIds } from './factory';
import type {
  AppDocument,
  AppNode,
  Breakpoint,
  BreakpointStyles,
  CssMap,
  NodeAction,
  NodeLocation,
  NodeProps,
  PageDef,
  RepeatConfig,
  StateVariable,
} from './types';

/**
 * Immutable-ish tree helpers. Every function returns a brand new document so the
 * editor can push the previous state straight onto the undo stack without
 * worrying about aliasing.
 */

/**
 * Finds a node and reports where it lives: its parent, its index among the
 * parent's children, the page it belongs to and its ancestor chain (outermost
 * first, excluding the node itself).
 */
/**
 * Finds a node in the pages or in the component library, so every tree helper
 * works the same way while editing either one.
 */
export function findNode(doc: AppDocument, id: string): NodeLocation | null {
  for (const page of doc.pages) {
    const found = locate(page.root, id, { page }, []);
    if (found) {
      return found;
    }
  }
  for (const component of doc.components ?? []) {
    const found = locate(component.root, id, { componentId: component.id }, []);
    if (found) {
      return found;
    }
  }
  return null;
}

function locate(
  node: AppNode,
  id: string,
  owner: { page?: PageDef; componentId?: string },
  ancestors: AppNode[],
): NodeLocation | null {
  if (node.id === id) {
    const parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
    return {
      node,
      parent,
      index: parent ? parent.children.findIndex((child) => child.id === id) : 0,
      page: owner.page,
      componentId: owner.componentId,
      path: ancestors,
    };
  }
  for (const child of node.children) {
    const found = locate(child, id, owner, [...ancestors, node]);
    if (found) {
      return found;
    }
  }
  return null;
}

export function findPage(doc: AppDocument, pageId: string): PageDef | null {
  return doc.pages.find((page) => page.id === pageId) ?? null;
}

export function getNodeIds(node: AppNode): string[] {
  return [node.id, ...node.children.flatMap(getNodeIds)];
}

export function isDescendant(node: AppNode, maybeAncestorId: string): boolean {
  return getNodeIds(node).includes(maybeAncestorId);
}

/** Insert `child` inside `parentId` at `index` (clamped, -1 = append). */
export function insertNode(doc: AppDocument, parentId: string, child: AppNode, index = -1): AppDocument {
  return updateNode(doc, parentId, (parent) => {
    const at = index < 0 ? parent.children.length : Math.min(index, parent.children.length);
    parent.children.splice(at, 0, child);
    return parent;
  });
}

/** Remove a node and return `{ doc, removed }`. Removing a page root is a no-op. */
export function removeNode(doc: AppDocument, id: string): { doc: AppDocument; removed: AppNode | null } {
  const location = findNode(doc, id);
  if (!location || !location.parent) {
    return { doc, removed: null };
  }
  const removed = location.node;
  const next = updateNode(doc, location.parent.id, (parent) => {
    parent.children = parent.children.filter((child) => child.id !== id);
    return parent;
  });
  return { doc: next, removed };
}

/** Move a node to a new parent/index, refusing cycles and self-moves. */
export function moveNode(
  doc: AppDocument,
  id: string,
  targetParentId: string,
  index = -1,
): AppDocument | null {
  const source = findNode(doc, id);
  const target = findNode(doc, targetParentId);
  if (!source || !target) {
    return null;
  }
  if (id === targetParentId || isDescendant(source.node, targetParentId)) {
    return null;
  }
  const without = removeNode(doc, id);
  const node = without.removed;
  if (!node) {
    return null;
  }
  let adjustedIndex = index;
  if (source.parent?.id === targetParentId && index > source.index) {
    adjustedIndex = index - 1;
  }
  return insertNode(without.doc, targetParentId, node, adjustedIndex);
}

/** Duplicate a node right after its original, with fresh ids. */
export function duplicateNode(doc: AppDocument, id: string): { doc: AppDocument; copy: AppNode | null } {
  const location = findNode(doc, id);
  if (!location || !location.parent) {
    return { doc, copy: null };
  }
  const copy = cloneNodeWithNewIds(location.node);
  copy.name = location.node.name ? `${location.node.name} copy` : undefined;
  return { doc: insertNode(doc, location.parent.id, copy, location.index + 1), copy };
}

/**
 * Apply `mutator` to a copy of the node with the given id. The mutator receives a
 * cloned node and returns the replacement, which keeps callers honest about
 * immutability.
 */
export function updateNode(doc: AppDocument, id: string, mutator: (node: AppNode) => AppNode): AppDocument {
  const mapTree = (node: AppNode): AppNode => {
    if (node.id === id) {
      const updated = mutator(cloneNode(node));
      return { ...updated, children: updated.children.map(mapTree) };
    }
    return { ...node, children: node.children.map(mapTree) };
  };
  return {
    ...doc,
    pages: doc.pages.map((page) => ({ ...page, root: mapTree(page.root) })),
    components: (doc.components ?? []).map((component) => ({
      ...component,
      root: mapTree(component.root),
      updatedAt: new Date().toISOString(),
    })),
  };
}

export function updateNodeProps(doc: AppDocument, id: string, patch: NodeProps): AppDocument {
  return updateNode(doc, id, (node) => ({ ...node, props: { ...node.props, ...patch } }));
}

export function setNodeStyle(
  doc: AppDocument,
  id: string,
  breakpoint: Breakpoint,
  property: string,
  value: string | null,
): AppDocument {
  return updateNode(doc, id, (node) => {
    if (breakpoint === 'base') {
      const style: CssMap = { ...node.style };
      if (value === null || value === '') {
        delete style[property];
      } else {
        style[property] = value;
      }
      return { ...node, style };
    }
    const styles: BreakpointStyles = structuredClone(node.styles ?? {});
    const bucket = (styles[breakpoint] ?? {}) as CssMap;
    if (value === null || value === '') {
      delete bucket[property];
    } else {
      bucket[property] = value;
    }
    if (Object.keys(bucket).length === 0) {
      delete styles[breakpoint];
    } else {
      styles[breakpoint] = bucket;
    }
    return { ...node, styles: Object.keys(styles).length > 0 ? styles : undefined };
  });
}

export function setNodeCss(doc: AppDocument, id: string, css: string | undefined, fileName?: string): AppDocument {
  return updateNode(doc, id, (node) => ({
    ...node,
    css: css && css.trim().length > 0 ? css : undefined,
    cssFileName: css && css.trim().length > 0 ? fileName ?? node.cssFileName : undefined,
  }));
}

export function setNodeComponentName(doc: AppDocument, id: string, componentName?: string): AppDocument {
  return updateNode(doc, id, (node) => ({
    ...node,
    componentName: componentName && componentName.trim().length > 0 ? componentName.trim() : undefined,
  }));
}

/** Attaches or clears a repeater on a node. */
export function setNodeRepeat(doc: AppDocument, id: string, repeat: RepeatConfig | undefined): AppDocument {
  return updateNode(doc, id, (node) => ({ ...node, repeat }));
}

// ------------------------------------------------------------------- actions

export function setNodeActions(doc: AppDocument, id: string, actions: NodeAction[]): AppDocument {
  return updateNode(doc, id, (node) => ({ ...node, actions: actions.length > 0 ? actions : undefined }));
}

export function addNodeAction(doc: AppDocument, id: string, action: NodeAction): AppDocument {
  return updateNode(doc, id, (node) => ({ ...node, actions: [...(node.actions ?? []), action] }));
}

export function updateNodeAction(
  doc: AppDocument,
  id: string,
  actionId: string,
  patch: Partial<NodeAction>,
): AppDocument {
  return updateNode(doc, id, (node) => ({
    ...node,
    actions: (node.actions ?? []).map((action) => (action.id === actionId ? { ...action, ...patch } : action)),
  }));
}

export function removeNodeAction(doc: AppDocument, id: string, actionId: string): AppDocument {
  return updateNode(doc, id, (node) => {
    const actions = (node.actions ?? []).filter((action) => action.id !== actionId);
    return { ...node, actions: actions.length > 0 ? actions : undefined };
  });
}

// --------------------------------------------------------------------- state

export function addStateVariable(doc: AppDocument, variable: StateVariable): AppDocument {
  return { ...doc, state: [...doc.state.filter((entry) => entry.name !== variable.name), variable] };
}

export function updateStateVariable(doc: AppDocument, id: string, patch: Partial<StateVariable>): AppDocument {
  return { ...doc, state: doc.state.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) };
}

export function removeStateVariable(doc: AppDocument, id: string): AppDocument {
  return { ...doc, state: doc.state.filter((entry) => entry.id !== id) };
}

export function renameNode(doc: AppDocument, id: string, name: string): AppDocument {
  return updateNode(doc, id, (node) => ({ ...node, name: name.trim() || undefined }));
}

export function traverse(node: AppNode, visit: (node: AppNode, depth: number) => void, depth = 0): void {
  visit(node, depth);
  node.children.forEach((child) => traverse(child, visit, depth + 1));
}

export function countNodes(node: AppNode): number {
  let total = 0;
  traverse(node, () => {
    total += 1;
  });
  return total;
}

/** Collect every node of every page, page first then depth first. */
export function allNodes(doc: AppDocument): AppNode[] {
  const nodes: AppNode[] = [];
  for (const page of doc.pages) {
    traverse(page.root, (node) => nodes.push(node));
  }
  return nodes;
}

export function widgetTypesUsed(doc: AppDocument): string[] {
  return [...new Set(allNodes(doc).map((node) => node.type))].sort();
}


