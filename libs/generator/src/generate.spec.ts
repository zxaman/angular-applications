import { describe, expect, it } from 'vitest';
import { createDocument, createPage, setNodeComponentName, setNodeCss, setNodeStyle, type AppDocument } from '@appstudio/schema';
import { createNodeFromWidget, landingTemplate } from '@appstudio/widgets';
import { buildFileTree, fileContents, findFile, flattenTree, generateProject } from './index';

function docWithHero(): AppDocument {
  const doc = createDocument('Test App');
  const hero = createNodeFromWidget('column', {
    name: 'Hero',
    children: [
      createNodeFromWidget('heading', { props: { text: 'Hello world' } }),
      createNodeFromWidget('button', { props: { label: 'Click me' } }),
    ],
  });
  const page = doc.pages[0];
  if (page) {
    page.root = createNodeFromWidget('container', { children: [hero] });
  }
  return doc;
}

describe('generateProject', () => {
  it('generates a runnable project skeleton', () => {
    const result = generateProject(landingTemplate('Demo'), { projectName: 'demo-app' });
    const paths = result.files.map((file) => file.path);

    expect(paths).toContain('package.json');
    expect(paths).toContain('angular.json');
    expect(paths).toContain('src/main.ts');
    expect(paths).toContain('src/styles.scss');
    expect(paths).toContain('src/app/app.routes.ts');
    expect(paths).toContain('src/app/pages/home/home.component.ts');
    expect(paths).toContain('src/app/pages/home/home.component.html');
    expect(paths).toContain('src/app/pages/home/home.component.scss');
    expect(paths).toContain('src/app/pages/about/about.component.ts');
    expect(result.stats.pages).toBe(2);
  });

  it('writes lazy routes for every page with a wildcard fallback', () => {
    const result = generateProject(landingTemplate('Demo'), { projectName: 'demo-app' });
    const routes = fileContents(result, 'src/app/app.routes.ts');

    expect(routes).toContain("path: ''");
    expect(routes).toContain("import('./pages/home/home.component').then((m) => m.HomeComponent)");
    expect(routes).toContain("path: 'about'");
    expect(routes).toContain("{ path: '**', redirectTo: '' }");
  });

  it('keeps one component per page at page granularity', () => {
    const result = generateProject(docWithHero(), { projectName: 'test-app', granularity: 'page' });
    expect(result.stats.components).toBe(0);
    expect(findFile(result, 'src/app/pages/home/home.component.html')?.contents).toContain('Hello world');
  });

  it('extracts a node into its own component with inputs at component granularity', () => {
    const doc = docWithHero();
    const page = doc.pages[0];
    const hero = page?.root.children[0];
    expect(hero).toBeTruthy();
    const withName = setNodeComponentName(doc, hero!.id, 'Hero Section');
    const result = generateProject(withName, { projectName: 'test-app', granularity: 'component' });

    expect(result.stats.components).toBe(1);
    const component = fileContents(result, 'src/app/components/hero-section/hero-section.component.ts');
    expect(component).toContain('export class HeroSectionComponent');
    expect(component).toContain("selector: 'app-hero-section'");
    expect(component).toContain('ChangeDetectionStrategy.OnPush');
    // `label` only drives the canvas empty state, so it must not become a dead input.
    expect(component).not.toContain('input<');

    const pageTemplate = fileContents(result, 'src/app/pages/home/home.component.ts');
    expect(pageTemplate).toContain("import { HeroSectionComponent } from '../../components/hero-section/hero-section.component'");

    const pageHtml = fileContents(result, 'src/app/pages/home/home.component.html');
    expect(pageHtml).toContain('<app-hero-section');
    expect(pageHtml).not.toContain('Hello world');
  });

  it('creates one component per widget at widget granularity', () => {
    const result = generateProject(docWithHero(), { projectName: 'test-app', granularity: 'widget' });
    // container root (page) + column + heading + button
    expect(result.stats.components).toBe(3);
    expect(result.files.filter((file) => file.path.startsWith('src/app/widgets/')).length).toBe(9);
  });

  it('exposes bindable properties as signal inputs on extracted components', () => {
    const doc = createDocument('Cards');
    const card = createNodeFromWidget('card', { props: { title: 'Pricing', subtitle: 'Pick a plan' } });
    doc.pages[0]!.root = createNodeFromWidget('container', { children: [card] });
    const extracted = setNodeComponentName(doc, card.id, 'Pricing Card');
    const result = generateProject(extracted, { projectName: 'cards-app' });
    const component = fileContents(result, 'src/app/components/pricing-card/pricing-card.component.ts');

    expect(component).toContain("readonly title = input<string>('Pricing');");
    expect(component).toContain("readonly subtitle = input<string>('Pick a plan');");
    // `elevated` compiles to a CSS class, so it stays out of the public API.
    expect(component).not.toContain('elevated');

    const template = fileContents(result, 'src/app/components/pricing-card/pricing-card.component.html');
    expect(template).toContain('{{ title() }}');
    expect(fileContents(result, 'src/app/pages/home/home.component.html')).toContain('<app-pricing-card title="Pricing" subtitle="Pick a plan" />');
  });

  it('emits Angular bindings for form fields and click handlers', () => {
    const doc = createDocument('Forms');
    const page = doc.pages[0];
    page!.root = createNodeFromWidget('form', {
      children: [
        createNodeFromWidget('text-input', { props: { label: 'Email', name: 'email', required: true } }),
        createNodeFromWidget('checkbox', { props: { label: 'Terms', name: 'terms', checked: true } }),
        createNodeFromWidget('button', { props: { label: 'Save', buttonType: 'button' } }),
      ],
    });
    const result = generateProject(doc, { projectName: 'forms-app' });
    const html = fileContents(result, 'src/app/pages/home/home.component.html');
    const ts = fileContents(result, 'src/app/pages/home/home.component.ts');

    expect(html).toContain('#form="ngForm"');
    expect(html).toContain('(ngSubmit)="onSubmit(form)"');
    expect(html).toContain("[(ngModel)]=\"model['email']\"");
    expect(html).toContain('required');
    expect(html).toContain('(click)="onSaveClick($event)"');
    expect(ts).toContain('FormsModule');
    expect(ts).toContain("protected model: Record<string, unknown> = { 'email': '', 'terms': true }");
    expect(ts).toContain('protected onSubmit(form: NgForm): void');
    expect(ts).toContain('protected onSaveClick(event: MouseEvent): void');
  });

  it('scopes a user imported stylesheet to the component it belongs to', () => {
    const doc = docWithHero();
    const page = doc.pages[0];
    const heading = page?.root.children[0]?.children[0];
    const withCss = setNodeCss(doc, heading!.id, '.heading-brand {\n  letter-spacing: 2px;\n}\n', 'brand.css');
    const result = generateProject(withCss, { projectName: 'test-app' });
    const pageStyles = fileContents(result, 'src/app/pages/home/home.component.scss');

    expect(pageStyles).toContain('brand.css');
    expect(pageStyles).toContain('letter-spacing: 2px');
    expect(fileContents(result, 'src/styles.scss')).not.toContain('letter-spacing: 2px');
  });

  it('emits responsive overrides as media queries', () => {
    const doc = docWithHero();
    const page = doc.pages[0];
    const hero = page?.root.children[0];
    const withStyle = setNodeStyle(doc, hero!.id, 'md', 'flex-direction', 'row');
    const result = generateProject(withStyle, { projectName: 'test-app' });
    const styles = fileContents(result, 'src/app/pages/home/home.component.scss');

    expect(styles).toContain('@media (min-width: 768px)');
    expect(styles).toContain('flex-direction: row');
  });

  it('registers imported global stylesheets in angular.json', () => {
    const doc = landingTemplate('Demo');
    doc.globalStyles.push({ name: 'Brand Tokens.CSS', content: ':root { --brand: #123456; }', importedAt: new Date().toISOString() });
    const result = generateProject(doc, { projectName: 'demo-app' });

    expect(result.files.map((file) => file.path)).toContain('src/styles/imports/brand-tokens.css');
    const angular = JSON.parse(fileContents(result, 'angular.json')) as {
      projects: Record<string, { architect: { build: { options: { styles: string[] } } } }>;
    };
    expect(angular.projects['demo-app'].architect.build.options.styles).toEqual([
      'src/styles.scss',
      'src/styles/imports/brand-tokens.css',
    ]);
    expect(result.stats.importedStylesheets).toBe(1);
  });

  it('adds Capacitor configuration only when requested', () => {
    const doc = landingTemplate('Demo');
    expect(findFile(generateProject(doc, { projectName: 'demo-app' }), 'capacitor.config.ts')).toBeUndefined();

    const withCapacitor = generateProject(doc, { projectName: 'demo-app', includeCapacitor: true });
    expect(findFile(withCapacitor, 'capacitor.config.ts')?.contents).toContain('webDir');
    const pkg = JSON.parse(fileContents(withCapacitor, 'package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@capacitor/core']).toBeDefined();
  });

  it('produces valid JSON in every generated json file', () => {
    const result = generateProject(landingTemplate('Demo'), { projectName: 'demo-app' });
    for (const file of result.files.filter((candidate) => candidate.kind === 'json')) {
      expect(() => JSON.parse(file.contents), file.path).not.toThrow();
    }
  });

  it('builds a nested file tree for the preview', () => {
    const result = generateProject(landingTemplate('Demo'), { projectName: 'demo-app' });
    const tree = buildFileTree(result.files);
    expect(tree.map((node) => node.name)).toContain('src');
    expect(flattenTree(tree).length).toBe(result.files.length);
  });

  it('keeps the exported structure aligned with the render plan contract', () => {
    const doc = createDocument('Tags');
    const page = doc.pages[0];
    page!.root = createNodeFromWidget('container', {
      props: { tag: 'section' },
      children: [createNodeFromWidget('image', { props: { alt: 'Sunset' } })],
    });
    const html = fileContents(generateProject(doc, { projectName: 'tags-app' }), 'src/app/pages/home/home.component.html');
    expect(html).toContain('<section class="as-container');
    expect(html).toContain('<img class="as-image');
    expect(html).toContain('alt="Sunset"');
  });

  it('supports multiple pages with distinct routes', () => {
    const doc = createDocument('Multi');
    doc.pages.push(createPage({ name: 'Settings & Profile', root: createNodeFromWidget('container') }));
    const result = generateProject(doc, { projectName: 'multi-app' });
    const routes = fileContents(result, 'src/app/app.routes.ts');
    expect(routes).toContain("path: 'settings-profile'");
    expect(result.files.map((file) => file.path)).toContain('src/app/pages/settings-profile/settings-profile.component.ts');
  });
});
