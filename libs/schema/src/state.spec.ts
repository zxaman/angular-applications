import { describe, expect, it } from 'vitest';
import {
  addStateVariable,
  bindingPaths,
  createStateVariable,
  createDocument,
  createId,
  evaluateBindings,
  findNode,
  hasBindings,
  nodeBindingTexts,
  parseStateValue,
  referencedStateNames,
  removeStateVariable,
  repeatContext,
  resolveCollection,
  resolvePath,
  sanitiseIdentifier,
  setNodeRepeat,
  stateMap,
  stringify,
  updateStateVariable,
  validateDocument,
  type AppDocument,
  type AppNode,
} from './index';

function node(props: Record<string, unknown> = {}): AppNode {
  return {
    id: createId('n'),
    type: 'text',
    name: '',
    props,
    children: [],
    style: {},
    visible: true,
    locked: false,
  };
}

function docWithState(): AppDocument {
  let doc = createDocument('State tests');
  doc = addStateVariable(doc, createStateVariable({ name: 'title', initial: 'Hello' }));
  doc = addStateVariable(doc, createStateVariable({ name: 'count', type: 'number', initial: '7' }));
  doc = addStateVariable(doc, createStateVariable({ name: 'open', type: 'boolean', initial: 'true' }));
  doc = addStateVariable(
    doc,
    createStateVariable({
      name: 'items',
      type: 'list',
      initial: '[{"title":"First","price":10},{"title":"Second","price":20}]',
    }),
  );
  return addStateVariable(doc, createStateVariable({ name: 'user', type: 'object', initial: '{"name":"Ada"}' }));
}

describe('state variables', () => {
  it('sanitises names into valid identifiers', () => {
    expect(sanitiseIdentifier('Total Count')).toBe('totalCount');
    expect(sanitiseIdentifier('9lives')).toBe('value9lives');
    expect(sanitiseIdentifier('  spaced out  ')).toBe('spacedOut');
    expect(sanitiseIdentifier('')).toBe('value');
  });

  it('picks a default initial value per type', () => {
    expect(createStateVariable({ name: 'a' }).initial).toBe('');
    expect(createStateVariable({ name: 'a', type: 'number' }).initial).toBe('0');
    expect(createStateVariable({ name: 'a', type: 'list' }).initial).toBe('[]');
    expect(createStateVariable({ name: 'a', type: 'object' }).initial).toBe('{}');
  });

  it('adds, updates and removes variables', () => {
    const variable = createStateVariable({ name: 'total' });
    let doc = addStateVariable(createDocument('X'), variable);
    expect(doc.state).toHaveLength(1);

    doc = updateStateVariable(doc, variable.id, { initial: '42', type: 'number' });
    expect(doc.state[0].initial).toBe('42');
    expect(doc.state[0].type).toBe('number');

    doc = removeStateVariable(doc, variable.id);
    expect(doc.state).toHaveLength(0);
  });

  it('parses each type into a runtime value', () => {
    expect(parseStateValue(createStateVariable({ name: 'a', type: 'number', initial: '12.5' }))).toBe(12.5);
    expect(parseStateValue(createStateVariable({ name: 'a', type: 'number', initial: 'oops' }))).toBe(0);
    expect(parseStateValue(createStateVariable({ name: 'a', type: 'boolean', initial: 'true' }))).toBe(true);
    expect(parseStateValue(createStateVariable({ name: 'a', type: 'boolean', initial: 'no' }))).toBe(false);
    expect(parseStateValue(createStateVariable({ name: 'a', type: 'list', initial: '[1,2]' }))).toEqual([1, 2]);
    expect(parseStateValue(createStateVariable({ name: 'a', type: 'list', initial: 'not json' }))).toEqual([]);
    expect(parseStateValue(createStateVariable({ name: 'a', type: 'object', initial: '{"k":1}' }))).toEqual({ k: 1 });
    expect(parseStateValue(createStateVariable({ name: 'a', type: 'object', initial: '[1]' }))).toEqual({});
    expect(parseStateValue(createStateVariable({ name: 'a', initial: 'text' }))).toBe('text');
  });

  it('keeps one variable per name when adding', () => {
    let doc = addStateVariable(createDocument('X'), createStateVariable({ name: 'total', initial: 'first' }));
    doc = addStateVariable(doc, createStateVariable({ name: 'total', initial: 'second' }));
    expect(doc.state).toHaveLength(1);
    expect(doc.state[0].initial).toBe('second');
  });

  it('rejects duplicates, bad names and bad JSON during validation', () => {
    let doc = addStateVariable(createDocument('X'), createStateVariable({ name: 'broken', type: 'list', initial: '{oops' }));
    doc = {
      ...doc,
      state: [
        ...doc.state,
        createStateVariable({ name: 'dup' }),
        createStateVariable({ name: 'dup' }),
        { id: createId('s'), name: 'has space', type: 'string', initial: '' },
      ],
    };

    const messages = validateDocument(doc).map((issue) => issue.message);
    expect(messages).toContain('Duplicate state name "dup".');
    expect(messages).toContain('List state "broken" contains invalid JSON.');
    expect(messages).toContain('State name "has space" is not a valid identifier.');
  });
});

describe('binding evaluation', () => {
  const doc = docWithState();
  const context = { state: stateMap(doc), locals: {} };

  it('detects and extracts bindings', () => {
    expect(hasBindings('plain')).toBe(false);
    expect(hasBindings('{{ state.title }}')).toBe(true);
    // repeated calls must not be affected by regex lastIndex
    expect(hasBindings('{{ state.title }}')).toBe(true);
    expect(bindingPaths('a {{ state.title }} b {{ item.name }}')).toEqual(['state.title', 'item.name']);
    expect(referencedStateNames('{{ state.title }} {{ item.x }} {{ state.count }}')).toEqual(['title', 'count']);
  });

  it('stringifies values the way a template would', () => {
    expect(stringify(null)).toBe('');
    expect(stringify(undefined)).toBe('');
    expect(stringify(0)).toBe('0');
    expect(stringify(false)).toBe('false');
    expect(stringify({ a: 1 })).toBe('{"a":1}');
  });

  it('resolves state paths', () => {
    expect(resolvePath(context, 'state.title')).toBe('Hello');
    expect(resolvePath(context, 'state.count')).toBe(7);
    expect(resolvePath(context, 'state.open')).toBe(true);
    expect(resolvePath(context, 'state.user.name')).toBe('Ada');
    expect(resolvePath(context, 'state.items.length')).toBe(2);
    expect(resolvePath(context, 'state.nope.deep')).toBeUndefined();
  });

  it('resolves repeater locals', () => {
    const locals = repeatContext({ collection: 'items', itemName: 'item', indexName: 'index' }, { title: 'Second' }, 1);
    const nested = { state: context.state, locals };
    expect(resolvePath(nested, 'item.title')).toBe('Second');
    expect(resolvePath(nested, 'index')).toBe(1);
  });

  it('interpolates mixed literal and binding text', () => {
    expect(evaluateBindings('Hello {{ state.title }}!', context)).toBe('Hello Hello!');
    expect(evaluateBindings('Count: {{ state.count }}', context)).toBe('Count: 7');
    expect(evaluateBindings('{{ state.user.name }} is here', context)).toBe('Ada is here');
    expect(evaluateBindings('{{ state.missing }}', context)).toBe('');
    expect(evaluateBindings('no bindings', context)).toBe('no bindings');
  });

  it('collects every binding used on a node', () => {
    const target = node({ text: '{{ state.title }}', link: 'https://x/{{ state.count }}', flag: true });
    expect(nodeBindingTexts(target)).toEqual(['{{ state.title }}', 'https://x/{{ state.count }}']);
  });

  it('resolves a collection for a repeater', () => {
    expect(resolveCollection(doc, { collection: 'items', itemName: 'item', indexName: 'index' })).toHaveLength(2);
    expect(resolveCollection(doc, { collection: 'title', itemName: 'item', indexName: 'index' })).toEqual([]);
  });

  it('builds a state map from the document', () => {
    expect(stateMap(doc)).toEqual({
      title: 'Hello',
      count: 7,
      open: true,
      items: [
        { title: 'First', price: 10 },
        { title: 'Second', price: 20 },
      ],
      user: { name: 'Ada' },
    });
  });
});

describe('setNodeRepeat', () => {
  it('attaches and clears repeat configuration', () => {
    const doc = createDocument('X');
    const child = node();
    doc.pages[0].root.children.push(child);

    const repeated = setNodeRepeat(doc, child.id, { collection: 'items', itemName: 'row', indexName: 'i' });
    expect(findNode(repeated, child.id)?.node.repeat).toEqual({ collection: 'items', itemName: 'row', indexName: 'i' });

    const cleared = setNodeRepeat(repeated, child.id, undefined);
    expect(findNode(cleared, child.id)?.node.repeat).toBeUndefined();
  });

  it('reports an unknown collection as an error', () => {
    const doc = createDocument('X');
    const child = node();
    doc.pages[0].root.children.push(child);
    const repeated = setNodeRepeat(doc, child.id, { collection: 'ghost', itemName: 'item', indexName: 'index' });

    const messages = validateDocument(repeated).map((issue) => issue.message);
    expect(messages).toContain('Repeater uses unknown list state "ghost".');
  });
});
