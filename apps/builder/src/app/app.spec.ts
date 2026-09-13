import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { landingTemplate } from '@appstudio/widgets';
import { App } from './app';
import { BuilderStateService } from './core/builder-state.service';

/**
 * Boots the whole shell (canvas, palette, inspector) against the landing
 * template. This exercises the renderer, selection and the widget palette, which
 * is where the studio could silently break.
 */
describe('AppStudio shell', () => {
  let fixture: ComponentFixture<App>;
  let state: BuilderStateService;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    fixture = TestBed.createComponent(App);
    state = TestBed.inject(BuilderStateService);
    state.load(landingTemplate('Smoke Test'), { keepHistory: false });
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  it('renders the shell regions', () => {
    expect(root.querySelector('studio-topbar')).toBeTruthy();
    expect(root.querySelector('.rail')).toBeTruthy();
    expect(root.querySelector('studio-canvas')).toBeTruthy();
    expect(root.querySelector('studio-inspector')).toBeTruthy();
    expect(root.querySelector('studio-statusbar')).toBeTruthy();
  });

  it('renders the document into the canvas with generated classes', () => {
    expect(root.querySelector('.as-navbar')).toBeTruthy();
    expect(root.querySelector('.as-button')).toBeTruthy();
    expect(root.querySelector('[data-type="heading"]')).toBeTruthy();
  });

  it('selects a widget on click and shows its inspector', () => {
    const heading = root.querySelector('[data-type="heading"] .as-heading') as HTMLElement;
    expect(heading).toBeTruthy();
    heading.click();
    fixture.detectChanges();

    expect(state.selectedNode()?.type).toBe('heading');
    const inspector = root.querySelector('studio-inspector') as HTMLElement;
    expect(inspector.textContent).toContain('Design');
    expect(inspector.querySelector('#prop-text')).toBeTruthy();
  });

  it('edits a property from the inspector and re-renders the canvas', () => {
    const badge = root.querySelector('[data-type="badge"] .as-badge') as HTMLElement;
    badge.click();
    fixture.detectChanges();

    const input = root.querySelector('#prop-text') as HTMLInputElement;
    input.value = 'Updated';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(state.selectedNode()?.props['text']).toBe('Updated');
    expect((root.querySelector('[data-type="badge"] .as-badge') as HTMLElement).textContent).toContain('Updated');
  });

  it('adds a widget when a palette item is clicked', () => {
    const before = state.nodeCount();
    const paletteItem = [...root.querySelectorAll<HTMLElement>('studio-widgets-panel .widget')].find((button) =>
      button.textContent?.includes('Progress'),
    );
    expect(paletteItem).toBeTruthy();
    paletteItem!.click();
    fixture.detectChanges();

    expect(state.nodeCount()).toBe(before + 1);
    expect(root.querySelector('.as-progress')).toBeTruthy();
  });

  it('previews the responsive frame width for the selected breakpoint', () => {
    state.setBreakpoint('sm');
    fixture.detectChanges();
    const frame = root.querySelector('.frame') as HTMLElement;
    expect(frame.style.width).toBe('576px');
  });

  it('resolves state bindings and repeats a node on the canvas', () => {
    state.addStateVariable('headline', 'string');
    state.updateStateVariable(state.stateVariables()[0]!.id, { initial: 'Live title' });
    state.addStateVariable('rows', 'list');
    state.updateStateVariable(state.stateVariables()[1]!.id, {
      initial: '[{"label":"Alpha"},{"label":"Beta"},{"label":"Gamma"}]',
    });

    const page = state.activePage()!;
    const headingId = state.addWidget('heading', page.root.id, -1)!;
    state.updateProp('text', '{{ state.headline }}');
    const cardId = state.addWidget('card', page.root.id, -1)!;
    state.updateProp('title', '{{ item.label }}');
    state.setNodeRepeat({ collection: 'rows', itemName: 'item', indexName: 'index' });
    fixture.detectChanges();

    const heading = root.querySelector(`[data-node-id="${headingId}"] .as-heading`) as HTMLElement;
    expect(heading.textContent).toBe('Live title');

    // The repeater draws one copy per item inside the node's host element.
    const copies = root.querySelectorAll(`[data-node-id="${cardId}"] .as-card`);
    expect(copies.length).toBe(3);
    expect(copies[0]!.textContent).toContain('Alpha');
    expect(copies[2]!.textContent).toContain('Gamma');
  });

  it('manages state from the data panel', () => {
    const dataTab = [...root.querySelectorAll<HTMLElement>('.rail button')].find((button) =>
      button.textContent?.includes('Data'),
    );
    expect(dataTab).toBeTruthy();
    dataTab!.click();
    fixture.detectChanges();

    expect(root.querySelector('studio-data-panel')).toBeTruthy();
    expect(state.leftPanel()).toBe('data');
  });

  it('opens the export drawer from the rail', () => {
    const exportButton = [...root.querySelectorAll<HTMLElement>('.rail button')].find((button) =>
      button.textContent?.includes('Export'),
    );
    exportButton!.click();
    fixture.detectChanges();

    expect(root.querySelector('studio-export-panel')).toBeTruthy();
    expect(root.querySelector('studio-export-panel')?.textContent).toContain('Export Angular project');
  });
});
