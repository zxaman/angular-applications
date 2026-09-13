import { describe, expect, it } from 'vitest';
import { createNodeFromWidget } from '@appstudio/widgets';
import {
  addComponentInput,
  coerceInputValue,
  countInstances,
  createDocument,
  detachInstance,
  deleteComponent,
  findComponent,
  findNode,
  inferInputs,
  insertInstance,
  instanceProps,
  insertNode,
  createInstanceNode,
  removeComponentInput,
  saveNodeAsComponent,
  updateComponent,
  updateComponentInput,
  updateInstanceProp,
  updateNodeProps,
  validateDocument,
  type AppDocument,
} from './index';

function docWithCard(): { doc: AppDocument; cardId: string } {
  const doc = createDocument('Library');
  const page = doc.pages[0]!;
  const card = createNodeFromWidget('card', { name: 'Pricing', props: { title: 'Pro', subtitle: '$9' } });
  page.root = createNodeFromWidget('container', { children: [card] });
  return { doc, cardId: card.id };
}

describe('component library', () => {
  it('saves a node as a component and leaves an instance behind', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card');

    expect(saved).toBeTruthy();
    expect(saved!.doc.components).toHaveLength(1);
    expect(saved!.doc.components[0]!.name).toBe('Pricing Card');

    const replaced = findNode(saved!.doc, cardId)!.node;
    expect(replaced.instance?.componentId).toBe(saved!.componentId);
    expect(replaced.children).toHaveLength(0);
    // The definition keeps its own copy of the subtree.
    expect(saved!.doc.components[0]!.root.id).not.toBe(cardId);
  });

  it('infers inputs from the node properties', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card')!;
    const inputs = saved.doc.components[0]!.inputs;

    expect(inputs.map((input) => input.name)).toContain('title');
    expect(inputs.find((input) => input.name === 'elevated')?.type).toBe('boolean');
  });

  it('inserts instances and counts them', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card')!;
    const page = saved.doc.pages[0]!;

    const withTwo = insertInstance(saved.doc, saved.componentId, page.root.id, -1)!;
    expect(countInstances(withTwo, saved.componentId)).toBe(2);
  });

  it('updates instance props without touching the definition', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card')!;
    const updated = updateInstanceProp(saved.doc, cardId, 'title', 'Team');

    expect(findNode(updated, cardId)!.node.instance?.props['title']).toBe('Team');
    expect(updated.components[0]!.root.props['title']).toBe('Pro');
  });

  it('fills in defaults for props an instance has not set', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card')!;
    const component = saved.doc.components[0]!;
    const props = instanceProps(component, { componentId: component.id, props: { title: 'Solo' } });

    expect(props['title']).toBe('Solo');
    expect(props['subtitle']).toBe('$9');
  });

  it('edits the definition through the ordinary node helpers', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card')!;
    const rootId = saved.doc.components[0]!.root.id;

    const edited = updateNodeProps(saved.doc, rootId, { title: 'Enterprise' });
    expect(findComponent(edited, saved.componentId)!.root.props['title']).toBe('Enterprise');
    // Instances follow the definition automatically.
    expect(findNode(edited, cardId)!.node.instance?.componentId).toBe(saved.componentId);
  });

  it('detaches an instance into ordinary widgets', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card')!;
    const withInstance = updateInstanceProp(saved.doc, cardId, 'title', 'Team');

    const detached = detachInstance(withInstance, cardId);
    const node = findNode(detached, cardId)!.node;
    expect(node.instance).toBeUndefined();
    expect(node.props['title']).toBe('Team');
    expect(node.children.length).toBeGreaterThan(0);
  });

  it('deleting a component detaches every instance', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card')!;
    const withTwo = insertInstance(saved.doc, saved.componentId, saved.doc.pages[0]!.root.id, -1)!;

    const deleted = deleteComponent(withTwo, saved.componentId);
    expect(deleted.components).toHaveLength(0);
    expect(findNode(deleted, cardId)!.node.instance).toBeUndefined();
    expect(validateDocument(deleted).filter((issue) => issue.severity === 'error')).toHaveLength(0);
  });

  it('manages inputs', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card')!;
    const id = saved.componentId;

    let next = addComponentInput(saved.doc, id, { name: 'badge', label: 'Badge', type: 'string', default: 'New' });
    expect(findComponent(next, id)!.inputs.some((input) => input.name === 'badge')).toBe(true);

    next = updateComponentInput(next, id, 'badge', { default: 'Hot' });
    expect(findComponent(next, id)!.inputs.find((input) => input.name === 'badge')?.default).toBe('Hot');

    next = removeComponentInput(next, id, 'badge');
    expect(findComponent(next, id)!.inputs.some((input) => input.name === 'badge')).toBe(false);
  });

  it('renames a component', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card')!;
    const renamed = updateComponent(saved.doc, saved.componentId, { name: 'Plan Card' });
    expect(findComponent(renamed, saved.componentId)!.name).toBe('Plan Card');
  });

  it('coerces input values by type', () => {
    expect(coerceInputValue('number', '12')).toBe(12);
    expect(coerceInputValue('number', 'abc')).toBe(0);
    expect(coerceInputValue('boolean', 'true')).toBe(true);
    expect(coerceInputValue('string', 'text')).toBe('text');
  });

  it('infers inputs only from real values', () => {
    const node = createNodeFromWidget('heading', { props: { text: 'Hello', level: 'h2' } });
    const inputs = inferInputs(node);
    expect(inputs.map((input) => input.name)).toEqual(['text', 'level']);
  });

  it('reports broken instances and self-referencing components', () => {
    const { doc, cardId } = docWithCard();
    const saved = saveNodeAsComponent(doc, cardId, 'Pricing Card')!;
    const component = saved.doc.components[0]!;

    const orphan = {
      ...saved.doc,
      pages: saved.doc.pages.map((page) => ({
        ...page,
        root: { ...page.root, children: [createInstanceNode({ component: { ...component, id: 'ghost' } })] },
      })),
    };
    expect(validateDocument(orphan).map((issue) => issue.message)).toContain(
      'This node references a component that no longer exists.',
    );

    const recursive = insertNode(saved.doc, component.root.id, createInstanceNode({ component }), -1)!;
    expect(validateDocument(recursive).map((issue) => issue.message)).toContain(
      'Component "Pricing Card" contains an instance of itself.',
    );
  });
});
