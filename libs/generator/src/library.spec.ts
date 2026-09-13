import { describe, expect, it } from 'vitest';
import {
  createDocument,
  createInstanceNode,
  findComponent,
  insertInstance,
  insertNode,
  saveNodeAsComponent,
  type AppDocument,
} from '@appstudio/schema';
import { createNodeFromWidget } from '@appstudio/widgets';
import { emitComponentClass } from './component';
import { emitTemplate, planProject } from './index';
import { fileContents, generateProject } from './index';

function docWithLibrary(): { doc: AppDocument; componentId: string } {
  const base = createDocument('Library App');
  const page = base.pages[0]!;
  const card = createNodeFromWidget('card', { name: 'Pricing', props: { title: 'Pro', subtitle: '$9/mo' } });
  page.root = createNodeFromWidget('container', { children: [card] });

  const saved = saveNodeAsComponent(base, card.id, 'Pricing Card')!;
  const withSecond = insertNode(
    saved.doc,
    page.root.id,
    createInstanceNode({
      component: findComponent(saved.doc, saved.componentId)!,
      props: { title: 'Team', subtitle: '$29/mo' },
    }),
    -1,
  )!;
  return { doc: withSecond, componentId: saved.componentId };
}

describe('component library planning', () => {
  it('plans a library component and finds it by component id', () => {
    const { doc, componentId } = docWithLibrary();
    const plan = planProject(doc, { granularity: 'component' });

    expect(plan.library).toHaveLength(1);
    expect(plan.library[0]!.className).toBe('PricingCardComponent');
    expect(plan.library[0]!.folder).toBe('components/pricing-card');
    expect(plan.byComponentId.get(componentId)).toBe(plan.library[0]);
    expect(plan.library[0]!.inputs.map((input) => input.name)).toContain('title');
  });
});

describe('templates with component instances', () => {
  const { doc } = docWithLibrary();
  const plan = planProject(doc, { granularity: 'component' });
  const page = plan.pages[0]!;
  const template = emitTemplate(page, plan.byNodeId, plan.byComponentId);

  it('renders every instance as the component tag', () => {
    expect(template.html).toContain('<app-pricing-card title="Pro" subtitle="$9/mo"');
    expect(template.html).toContain('<app-pricing-card title="Team" subtitle="$29/mo"');
    expect(template.libraryPlans.map((entry) => entry.className)).toEqual(['PricingCardComponent']);
  });

  it('imports the library component in the page class', () => {
    const source = emitComponentClass(page, template, [...page.children, ...template.libraryPlans]);
    expect(source).toContain(
      "import { PricingCardComponent } from '../../components/pricing-card/pricing-card.component';",
    );
    expect(source).toContain('imports: [PricingCardComponent]');
  });

  it('emits the library component with signal inputs', () => {
    const library = plan.library[0]!;
    const libraryTemplate = emitTemplate(library, plan.byNodeId, plan.byComponentId);
    const source = emitComponentClass(library, libraryTemplate, []);

    expect(source).toContain('export class PricingCardComponent {');
    expect(source).toContain("readonly title = input<string>('Pro');");
    expect(libraryTemplate.html).toContain('{{ title() }}');
  });
});

describe('generateProject with a component library', () => {
  it('writes one folder per library component', () => {
    const { doc } = docWithLibrary();
    const result = generateProject(doc, { projectName: 'library-app', granularity: 'component' });

    expect(result.files.map((file) => file.path)).toContain('src/app/components/pricing-card/pricing-card.component.ts');
    expect(result.files.map((file) => file.path)).toContain('src/app/components/pricing-card/pricing-card.component.scss');
    expect(fileContents(result, 'src/app/pages/home/home.component.html')).toContain('<app-pricing-card');
  });

  it('keeps working when a document has no components', () => {
    const result = generateProject(createDocument('Plain'), { projectName: 'plain-app' });
    expect(result.files.map((file) => file.path)).not.toContain('src/app/components/pricing-card/pricing-card.component.ts');
  });
});
