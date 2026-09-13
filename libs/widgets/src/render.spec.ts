import { describe, expect, it } from 'vitest';
import { createNode } from '@appstudio/schema';
import { allClasses, createNodeFromWidget, derivedStyle, isBindable, nodeClasses, renderPlan, searchCatalog, WIDGET_CATALOG, WIDGET_TYPES } from './index';

describe('widget catalog', () => {
  it('has unique types and complete metadata', () => {
    expect(new Set(WIDGET_TYPES).size).toBe(WIDGET_TYPES.length);
    for (const widget of WIDGET_CATALOG) {
      expect(widget.label.length, widget.type).toBeGreaterThan(0);
      expect(widget.icon.length, widget.type).toBeGreaterThan(0);
      for (const prop of widget.propSchema) {
        expect(prop.label.length, `${widget.type}.${prop.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('applies defaults and derived styles when creating a node', () => {
    const spacer = createNodeFromWidget('spacer');
    expect(spacer.props['size']).toBe(24);
    expect(spacer.style['height']).toBe('24px');

    const grid = createNodeFromWidget('grid');
    expect(grid.style['--as-cols']).toBe('3');

    const card = createNodeFromWidget('card');
    expect(card.children.length).toBe(2);
  });

  it('searches by label, type and description', () => {
    expect(searchCatalog('button').map((widget) => widget.type)).toContain('button');
    expect(searchCatalog('dropdown').map((widget) => widget.type)).toContain('select');
    expect(searchCatalog('').length).toBe(WIDGET_CATALOG.length);
  });

  it('only exposes runtime properties as component inputs', () => {
    expect(isBindable('card', 'title')).toBe(true);
    expect(isBindable('card', 'elevated')).toBe(false);
    expect(isBindable('container', 'label')).toBe(false);
    expect(isBindable('text', 'weight', false)).toBe(false);
  });

  it('derives object-fit for images', () => {
    const image = createNodeFromWidget('image', { props: { fit: 'contain', height: 300 } });
    const style = derivedStyle(image);
    expect(style['object-fit']).toBe('contain');
    expect(style['height']).toBe('300px');
  });
});

describe('renderPlan', () => {
  it('renders containers with their configured tag', () => {
    const node = createNodeFromWidget('container', { props: { tag: 'section' } });
    const plan = renderPlan(node);
    expect(plan.tag).toBe('section');
    expect(plan.classes).toContain('as-container');
  });

  it('nests children and keeps sub parts attached to their owner', () => {
    const card = createNodeFromWidget('card', {
      props: { title: 'Title', subtitle: 'Sub' },
      children: [createNodeFromWidget('text', { props: { text: 'Body' } })],
    });
    const plan = renderPlan(card);
    const header = plan.children?.[0];
    expect(header?.classes).toContain('as-card-header');
    // Sub parts belong to the card itself; only real children carry another node.
    expect(header?.node.id).toBe(card.id);
    const body = plan.children?.[1];
    expect(body?.node.id).not.toBe(card.id);
    expect(body?.text).toBe('Body');
  });

  it('builds form fields with labels and options', () => {
    const select = createNodeFromWidget('select', { props: { label: 'Size', options: 's: Small\nl: Large' } });
    const plan = renderPlan(select);
    const control = plan.children?.find((child) => child.tag === 'select');
    expect(control?.children?.length).toBe(3);
    expect(control?.children?.[2]?.attrs['value']).toBe('l');
    expect(control?.children?.[2]?.text).toBe('Large');
  });

  it('marks void elements', () => {
    expect(renderPlan(createNodeFromWidget('image')).void).toBe(true);
    expect(renderPlan(createNodeFromWidget('divider')).void).toBe(true);
    expect(renderPlan(createNodeFromWidget('container')).void).toBeUndefined();
  });

  it('emits stable classes for generated stylesheets', () => {
    const node = createNode('button', { id: 'n_abc12345', props: { variant: 'outline', size: 'lg' } });
    expect(nodeClasses(node)).toEqual(['as-button', 'button-12345']);
    expect(allClasses(node)).toEqual(['as-button', 'button-12345', 'is-outline', 'is-lg']);
  });

  it('renders icon markup from the built-in set', () => {
    const plan = renderPlan(createNodeFromWidget('icon', { props: { name: 'check', size: 32 } }));
    expect(plan.html).toContain('<svg');
    expect(plan.html).toContain('width="32"');
  });

  it('falls back to a container for unknown widget types', () => {
    const plan = renderPlan(createNode('totally-unknown', { children: [createNode('text', { props: { text: 'x' } })] }));
    expect(plan.tag).toBe('div');
    expect(plan.children?.length).toBe(1);
  });
});
