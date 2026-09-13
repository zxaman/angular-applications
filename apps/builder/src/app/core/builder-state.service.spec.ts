import { describe, expect, it, beforeEach } from 'vitest';
import { findNode } from '@appstudio/schema';
import { landingTemplate } from '@appstudio/widgets';
import { BuilderStateService } from './builder-state.service';

describe('BuilderStateService', () => {
  let state: BuilderStateService;

  beforeEach(() => {
    state = new BuilderStateService();
    state.load(landingTemplate('Test'), { keepHistory: false, markDirty: false });
  });

  it('starts on the first page', () => {
    expect(state.activePage()?.name).toBe('Home');
    expect(state.nodeCount()).toBeGreaterThan(5);
  });

  it('adds, selects and deletes a widget', () => {
    const page = state.activePage();
    const before = state.nodeCount();
    const id = state.addWidget('badge', page!.root.id, 0);

    expect(id).toBeTruthy();
    expect(state.selectedId()).toBe(id);
    expect(state.nodeCount()).toBe(before + 1);

    state.deleteSelected();
    expect(state.selectedId()).toBe(page!.root.id);
    expect(state.nodeCount()).toBe(before);
    expect(state.document().pages[0]!.root.children.some((child) => child.id === id)).toBe(false);
  });

  it('updates props and keeps derived styles in sync', () => {
    const page = state.activePage();
    const id = state.addWidget('spacer', page!.root.id, -1)!;
    state.select(id);
    state.updateProp('size', 64);

    const node = findNode(state.document(), id)!.node;
    expect(node.props['size']).toBe(64);
    expect(node.style['height']).toBe('64px');
  });

  it('writes responsive overrides per breakpoint', () => {
    const page = state.activePage();
    const id = state.addWidget('row', page!.root.id, -1)!;
    state.select(id);
    state.setStyle('flex-direction', 'column', 'base');
    state.setStyle('flex-direction', 'row', 'lg');

    const node = findNode(state.document(), id)!.node;
    expect(node.style['flex-direction']).toBe('column');
    expect(node.styles?.lg?.['flex-direction']).toBe('row');
  });

  it('attaches an imported stylesheet to a single widget', () => {
    const page = state.activePage();
    const id = state.addWidget('card', page!.root.id, -1)!;
    state.select(id);
    state.setNodeCss('.card-x { color: red; }', 'brand.css');

    const node = findNode(state.document(), id)!.node;
    expect(node.css).toContain('color: red');
    expect(node.cssFileName).toBe('brand.css');
  });

  it('moves a widget between containers without creating cycles', () => {
    const page = state.activePage();
    const parentA = state.addWidget('column', page!.root.id, -1)!;
    const child = state.addWidget('text', parentA, -1)!;
    const parentB = state.addWidget('column', page!.root.id, -1)!;

    state.moveNode(child, parentB, 0);
    const moved = findNode(state.document(), child)!;
    expect(moved.parent?.id).toBe(parentB);

    // Refusing a cycle keeps the tree valid.
    state.moveNode(parentB, child, 0);
    expect(findNode(state.document(), parentB)!.parent?.id).toBe(page!.root.id);
  });

  it('undoes and redoes edits', () => {
    const page = state.activePage();
    const before = state.nodeCount();
    state.addWidget('badge', page!.root.id, -1);
    expect(state.nodeCount()).toBe(before + 1);

    state.undo();
    expect(state.nodeCount()).toBe(before);

    state.redo();
    expect(state.nodeCount()).toBe(before + 1);
  });

  it('manages pages and derives routes', () => {
    state.addPage('Settings & Profile');
    const pages = state.document().pages;
    expect(pages.length).toBe(3);
    expect(pages[2]!.route).toBe('settings-profile');

    state.deletePage(pages[2]!.id);
    expect(state.document().pages.length).toBe(2);
  });

  it('refuses to delete the last page', () => {
    const doc = state.document();
    const only = { ...doc, pages: [doc.pages[0]!] };
    state.load(only, { keepHistory: false });
    state.deletePage(only.pages[0]!.id);
    expect(state.document().pages.length).toBe(1);
  });

  it('imports global stylesheets and de-duplicates by name', () => {
    state.addGlobalStyle({ name: 'a.css', content: 'body{}', importedAt: '' });
    state.addGlobalStyle({ name: 'a.css', content: 'body{color:red}', importedAt: '' });
    expect(state.document().globalStyles.length).toBe(1);
    expect(state.document().globalStyles[0]!.content).toContain('color:red');
  });

  it('marks a node as a component for the exporter', () => {
    const page = state.activePage();
    const id = state.addWidget('card', page!.root.id, -1)!;
    state.select(id);
    state.setComponentName('Pricing Card');
    expect(findNode(state.document(), id)!.node.componentName).toBe('Pricing Card');
  });

  it('adds, edits and removes state variables', () => {
    state.addStateVariable('Headline', 'string');
    expect(state.stateVariables().length).toBe(1);
    expect(state.stateVariables()[0]!.name).toBe('headline');

    const id = state.stateVariables()[0]!.id;
    state.updateStateVariable(id, { initial: 'Hi there' });
    expect(state.stateVariables()[0]!.initial).toBe('Hi there');

    state.removeStateVariable(id);
    expect(state.stateVariables().length).toBe(0);
  });

  it('rejects an empty or duplicate variable name', () => {
    state.addStateVariable('   ');
    expect(state.stateVariables().length).toBe(0);

    state.addStateVariable('total');
    state.addStateVariable('total');
    expect(state.stateVariables().length).toBe(1);
    expect(state.notice()?.tone).toBe('error');
  });

  it('attaches a repeater to the selected node', () => {
    state.addStateVariable('items', 'list');
    const page = state.activePage();
    const id = state.addWidget('card', page!.root.id, -1)!;
    state.select(id);

    state.setNodeRepeat({ collection: 'items', itemName: 'item', indexName: 'index' });
    expect(findNode(state.document(), id)!.node.repeat?.collection).toBe('items');

    state.setNodeRepeat(undefined);
    expect(findNode(state.document(), id)!.node.repeat).toBeUndefined();
  });

  it('saves a widget as a reusable component and places instances', () => {
    const page = state.activePage()!;
    const id = state.addWidget('card', page.root.id, -1)!;
    state.select(id);
    state.setInstanceProp; // no-op guard: instances only exist after saving
    state.saveSelectedAsComponent('Pricing Card');

    expect(state.components().length).toBe(1);
    expect(state.components()[0]!.name).toBe('Pricing Card');
    expect(state.selectedNode()?.instance?.componentId).toBe(state.components()[0]!.id);

    state.insertComponentInstance(state.components()[0]!.id, page.root.id, -1);
    expect(state.nodeCount()).toBeGreaterThan(0);
    expect(state.document().pages[0]!.root.children.filter((child) => child.instance).length).toBe(2);
  });

  it('edits a component definition and updates every instance', () => {
    const page = state.activePage()!;
    const id = state.addWidget('card', page.root.id, -1)!;
    state.select(id);
    state.updateProp('title', 'Pro');
    state.saveSelectedAsComponent('Pricing Card');

    const component = state.components()[0]!;
    state.editComponent(component.id);
    expect(state.editingComponent()?.name).toBe('Pricing Card');
    expect(state.activeRoot()?.id).toBe(component.root.id);

    state.select(component.root.id);
    state.updateProp('title', 'Enterprise');
    expect(state.components()[0]!.root.props['title']).toBe('Enterprise');

    state.exitComponentEditing();
    expect(state.activeRoot()?.id).toBe(page.root.id);
  });

  it('sets instance props and detaches an instance', () => {
    const page = state.activePage()!;
    const id = state.addWidget('card', page.root.id, -1)!;
    state.select(id);
    state.saveSelectedAsComponent('Pricing Card');

    state.setInstanceProp('title', 'Team');
    expect(state.selectedNode()?.instance?.props['title']).toBe('Team');

    state.detachSelectedInstance();
    expect(state.selectedNode()?.instance).toBeUndefined();
    expect(state.selectedNode()?.props['title']).toBe('Team');
    expect(state.components().length).toBe(1);
  });

  it('deleting a component detaches its instances', () => {
    const page = state.activePage()!;
    const id = state.addWidget('card', page.root.id, -1)!;
    state.select(id);
    state.saveSelectedAsComponent('Pricing Card');

    state.removeComponent(state.components()[0]!.id);
    expect(state.components().length).toBe(0);
    expect(state.document().pages[0]!.root.children.some((child) => child.instance)).toBe(false);
  });

  it('copies, cuts and pastes a subtree', () => {
    const page = state.activePage()!;
    const columnId = state.addWidget('column', page.root.id, -1)!;
    state.addWidget('heading', columnId, -1);
    const before = state.nodeCount();

    state.select(columnId);
    state.copySelected();
    state.paste();
    expect(state.nodeCount()).toBe(before + 2);

    // The paste gets fresh ids, so nothing collides.
    expect(state.selectedId()).not.toBe(columnId);
    expect(state.selectedNode()?.type).toBe('column');

    state.cutSelected();
    expect(state.nodeCount()).toBe(before);
  });

  it('validates the document for the checks panel', () => {
    state.addStateVariable('rows', 'list');
    const page = state.activePage()!;
    const id = state.addWidget('text', page.root.id, -1)!;
    state.select(id);
    state.setNodeRepeat({ collection: 'ghost', itemName: 'item', indexName: 'index' });

    expect(state.issueCount()).toBeGreaterThan(0);
    expect(state.issues().some((issue) => issue.nodeId === id)).toBe(true);
  });

  it('supports undo across state edits', () => {
    state.addStateVariable('counter', 'number');
    expect(state.stateVariables().length).toBe(1);
    state.undo();
    expect(state.stateVariables().length).toBe(0);
    state.redo();
    expect(state.stateVariables().length).toBe(1);
  });
});
