import { describe, expect, it } from 'vitest';
import { createDocument, createNode, createPage } from './factory';
import {
  countNodes,
  duplicateNode,
  findNode,
  getNodeIds,
  insertNode,
  moveNode,
  removeNode,
  setNodeComponentName,
  setNodeCss,
  setNodeStyle,
  traverse,
  updateNodeProps,
  widgetTypesUsed,
} from './tree';
import { migrateDocument } from './migrate';
import { validateDocument } from './validate';
import type { AppDocument, AppNode } from './types';

function sample(): AppDocument {
  const doc = createDocument('Test');
  const grandChild = createNode('text', { id: 'text_1', props: { text: 'Hello' } });
  const child = createNode('column', { id: 'col_1', children: [grandChild] });
  const root = createNode('container', { id: 'root_1', children: [child] });
  doc.pages = [createPage({ name: 'Home', route: '', root })];
  return doc;
}

describe('tree operations', () => {
  it('reports the ancestor chain without duplicating levels', () => {
    const doc = sample();
    const location = findNode(doc, 'text_1')!;

    expect(location.node.id).toBe('text_1');
    expect(location.parent?.id).toBe('col_1');
    expect(location.index).toBe(0);
    expect(location.path.map((node) => node.id)).toEqual(['root_1', 'col_1']);
    expect(location.page.name).toBe('Home');
  });

  it('reports no parent for a page root', () => {
    const location = findNode(sample(), 'root_1')!;
    expect(location.parent).toBeNull();
    expect(location.path).toEqual([]);
  });

  it('returns null for unknown ids', () => {
    expect(findNode(sample(), 'nope')).toBeNull();
  });

  it('inserts at an index and appends when the index is negative', () => {
    const badge = createNode('badge', { id: 'badge_1' });
    const inserted = insertNode(sample(), 'col_1', badge, 0);
    expect(findNode(inserted, 'badge_1')!.parent?.id).toBe('col_1');
    expect(findNode(inserted, 'badge_1')!.index).toBe(0);

    const appended = insertNode(inserted, 'col_1', createNode('spacer', { id: 'spacer_1' }), -1);
    expect(findNode(appended, 'spacer_1')!.index).toBe(2);
  });

  it('removes a node and returns it', () => {
    const result = removeNode(sample(), 'col_1');
    expect(result.removed?.id).toBe('col_1');
    expect(findNode(result.doc, 'col_1')).toBeNull();
    expect(findNode(result.doc, 'text_1')).toBeNull();
  });

  it('refuses to remove a page root', () => {
    const doc = sample();
    const result = removeNode(doc, 'root_1');
    expect(result.removed).toBeNull();
    expect(result.doc).toBe(doc);
  });

  it('moves nodes and refuses cycles', () => {
    const doc = sample();
    const other = createNode('row', { id: 'row_1' });
    const withRow = insertNode(doc, 'root_1', other);
    const moved = moveNode(withRow, 'text_1', 'row_1', 0)!;
    expect(findNode(moved, 'text_1')!.parent?.id).toBe('row_1');

    // Moving row_1 into its own descendant must be rejected.
    expect(moveNode(moved, 'row_1', 'text_1', 0)).toBeNull();
    // Moving a node into itself must be rejected.
    expect(moveNode(moved, 'row_1', 'row_1', 0)).toBeNull();
  });

  it('keeps sibling order when moving within the same parent', () => {
    const doc = sample();
    const a = insertNode(doc, 'root_1', createNode('badge', { id: 'a' }), -1);
    const b = insertNode(a, 'root_1', createNode('badge', { id: 'b' }), -1);
    const moved = moveNode(b, 'b', 'root_1', 0)!;
    expect(moved.pages[0]!.root.children.map((child) => child.id)).toEqual(['b', 'col_1', 'a']);
  });

  it('duplicates a subtree with fresh ids', () => {
    const result = duplicateNode(sample(), 'col_1');
    const copy = result.copy!;
    expect(copy.id).not.toBe('col_1');
    expect(copy.children[0]!.id).not.toBe('text_1');
    expect(getNodeIds(result.doc.pages[0]!.root)).toContain(copy.id);
    // No duplicate ids anywhere in the document.
    const ids = getNodeIds(result.doc.pages[0]!.root);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('patches props without mutating the original document', () => {
    const doc = sample();
    const next = updateNodeProps(doc, 'text_1', { text: 'Bye' });
    expect(findNode(doc, 'text_1')!.node.props['text']).toBe('Hello');
    expect(findNode(next, 'text_1')!.node.props['text']).toBe('Bye');
  });

  it('stores style overrides per breakpoint and clears empty values', () => {
    const doc = setNodeStyle(sample(), 'col_1', 'lg', 'gap', '24px');
    expect(findNode(doc, 'col_1')!.node.styles?.lg?.['gap']).toBe('24px');

    const cleared = setNodeStyle(doc, 'col_1', 'lg', 'gap', '');
    expect(findNode(cleared, 'col_1')!.node.styles).toBeUndefined();
  });

  it('attaches and clears a custom stylesheet', () => {
    const withCss = setNodeCss(sample(), 'text_1', '.x { color: red }', 'x.css');
    expect(findNode(withCss, 'text_1')!.node.cssFileName).toBe('x.css');
    const cleared = setNodeCss(withCss, 'text_1', '   ');
    expect(findNode(cleared, 'text_1')!.node.css).toBeUndefined();
    expect(findNode(cleared, 'text_1')!.node.cssFileName).toBeUndefined();
  });

  it('marks a node as an extracted component', () => {
    const doc = setNodeComponentName(sample(), 'col_1', 'Hero');
    expect(findNode(doc, 'col_1')!.node.componentName).toBe('Hero');
    expect(findNode(setNodeComponentName(doc, 'col_1', ''), 'col_1')!.node.componentName).toBeUndefined();
  });

  it('counts and walks the tree depth first', () => {
    const doc = sample();
    expect(countNodes(doc.pages[0]!.root)).toBe(3);
    const visited: string[] = [];
    traverse(doc.pages[0]!.root, (node) => visited.push(node.id));
    expect(visited).toEqual(['root_1', 'col_1', 'text_1']);
    expect(widgetTypesUsed(doc)).toEqual(['column', 'container', 'text']);
  });
});

describe('validation', () => {
  it('flags duplicate routes and empty names', () => {
    const doc = sample();
    doc.pages.push(createPage({ name: 'Other', route: '' }));
    const issues = validateDocument(doc);
    expect(issues.some((issue) => issue.message.includes('empty'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('already used'))).toBe(true);
  });

  it('warns about unknown widget types', () => {
    const doc = sample();
    const issues = validateDocument(doc, ['container', 'column']);
    expect(issues.some((issue) => issue.message.includes('Unknown widget type "text"'))).toBe(true);
  });

  it('rejects an invalid component prefix', () => {
    const doc = sample();
    doc.settings.prefix = 'App!';
    expect(validateDocument(doc).some((issue) => issue.path === 'settings.prefix')).toBe(true);
  });
});

describe('migrations', () => {
  it('normalises a document without a version', () => {
    const raw = JSON.parse(JSON.stringify(sample())) as Record<string, unknown>;
    delete raw['version'];
    delete raw['kind'];
    const result = migrateDocument(raw);
    expect(result.doc.kind).toBe('appstudio.document');
    expect(result.migratedFrom).toBe(0);
    expect(result.applied).toEqual([0, 1, 2, 3]);
  });

  it('rejects files that are not projects', () => {
    expect(() => migrateDocument({ hello: 'world' })).toThrow(/not an AppStudio project/);
  });

  it('accepts a JSON string', () => {
    const result = migrateDocument(JSON.stringify(sample()));
    expect(result.doc.pages.length).toBe(1);
  });
});

describe('node factory', () => {
  it('clones subtrees independently', () => {
    const node: AppNode = createNode('container', { children: [createNode('text', { id: 'keep' })] });
    const copy: AppNode = structuredClone(node);
    copy.children[0]!.id = 'changed';
    expect(node.children[0]!.id).toBe('keep');
  });
});
