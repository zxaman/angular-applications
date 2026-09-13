import { describe, expect, it } from 'vitest';
import {
  addStateVariable,
  createStateVariable,
  createDocument,
  setNodeRepeat,
  type AppDocument,
} from '@appstudio/schema';
import { createNodeFromWidget } from '@appstudio/widgets';
import { emitTemplate } from './template';
import { emitComponentClass } from './component';
import { planProject } from './plan';
import { fileContents, generateProject } from './index';
import { emitAppStore } from './store';

function docWithList(): AppDocument {
  let doc = createDocument('Test App');
  doc = addStateVariable(doc, createStateVariable({ name: 'headline', initial: 'Latest posts' }));
  doc = addStateVariable(doc, createStateVariable({ name: 'count', type: 'number', initial: '3' }));
  doc = addStateVariable(
    doc,
    createStateVariable({
      name: 'posts',
      type: 'list',
      initial: '[{"title":"One"},{"title":"Two"}]',
      description: 'Blog posts',
    }),
  );

  const card = createNodeFromWidget('column', {
    name: 'Post card',
    children: [createNodeFromWidget('heading', { props: { text: '{{ post.title }}', level: 'h3' } })],
  });
  const page = doc.pages[0];
  if (page) {
    page.root = createNodeFromWidget('container', {
      children: [
        createNodeFromWidget('heading', { props: { text: '{{ state.headline }} ({{ state.count }})' } }),
        card,
      ],
    });
  }
  return setNodeRepeat(doc, card.id, { collection: 'posts', itemName: 'post', indexName: 'i' });
}

describe('emitAppStore', () => {
  it('emits one typed signal per state variable', () => {
    const doc = docWithList();
    const store = emitAppStore(doc.state);

    expect(store).toContain("@Injectable({ providedIn: 'root' })");
    expect(store).toContain('export class AppStore {');
    expect(store).toContain("readonly headline = signal<string>('Latest posts');");
    expect(store).toContain('readonly count = signal<number>(3);');
    expect(store).toContain('readonly posts = signal<PostsItem[]>([{"title":"One"},{"title":"Two"}]);');
    expect(store).toContain('export interface PostsItem {\n  title: string;\n}');
    expect(store).toContain('/** Blog posts */');
  });

  it('emits a placeholder body when there is no state', () => {
    expect(emitAppStore([])).toContain('/* No state variables yet');
  });

  it('infers item and object shapes from the JSON defaults', () => {
    const store = emitAppStore([
      createStateVariable({ name: 'tags', type: 'list', initial: '["a","b"]' }),
      createStateVariable({ name: 'empty', type: 'list', initial: '[]' }),
      createStateVariable({ name: 'theme', type: 'object', initial: '{"mode":"dark","radius":8}' }),
      createStateVariable({ name: 'rows', type: 'list', initial: '[{"a":1},{"a":2,"b":"x"}]' }),
    ]);

    expect(store).toContain("readonly tags = signal<string[]>([\"a\",\"b\"]);");
    expect(store).toContain('readonly empty = signal<unknown[]>([]);');
    expect(store).toContain('export interface Theme {\n  mode: string;\n  radius: number;\n}');
    expect(store).toContain('readonly theme = signal<Theme>({"mode":"dark","radius":8});');
    // keys missing from some rows become optional so `strictTemplates` still accepts them
    expect(store).toContain('  a: number;');
    expect(store).toContain('  b?: string | undefined;');
  });
});

describe('templates with bindings and repeaters', () => {
  it('rewrites state bindings into signal reads', () => {
    const doc = docWithList();
    const plan = planProject(doc, { granularity: 'page' });
    const page = plan.pages[0]!;
    const result = emitTemplate(page, plan.byNodeId);

    expect(result.needsStore).toBe(true);
    expect(result.html).toContain('{{ store.headline() }} ({{ store.count() }})');
    expect(result.html).toContain('@for (post of store.posts(); track $index; let i = $index) {');
    expect(result.html).toContain('{{ post.title }}');
  });

  it('leaves a plain template untouched', () => {
    const doc = createDocument('Plain');
    const page = doc.pages[0]!;
    page.root = createNodeFromWidget('container', {
      children: [createNodeFromWidget('heading', { props: { text: 'No bindings' } })],
    });
    const plan = planProject(doc, { granularity: 'page' });
    const result = emitTemplate(plan.pages[0]!, plan.byNodeId);

    expect(result.needsStore).toBe(false);
    expect(result.html).toContain('No bindings');
  });

  it('injects AppStore only when the template needs it', () => {
    const doc = docWithList();
    const plan = planProject(doc, { granularity: 'page' });
    const page = plan.pages[0]!;

    expect(emitComponentClass(page, emitTemplate(page, plan.byNodeId), [])).toContain(
      'protected readonly store = inject(AppStore);',
    );

    const plain = createDocument('Plain');
    const plainPlan = planProject(plain, { granularity: 'page' });
    const plainPage = plainPlan.pages[0]!;
    expect(emitComponentClass(plainPage, emitTemplate(plainPage, plainPlan.byNodeId), [])).not.toContain('AppStore');
  });
});

describe('generateProject with state', () => {
  it('writes the store file and reports the state count', () => {
    const result = generateProject(docWithList(), { projectName: 'test-app', granularity: 'page' });

    expect(result.stats.stateVariables).toBe(3);
    expect(fileContents(result, 'src/app/core/app-store.ts')).toContain('export class AppStore');
    expect(fileContents(result, 'src/app/pages/home/home.component.ts')).toContain(
      "import { AppStore } from '../../core/app-store';",
    );
    expect(fileContents(result, 'src/app/pages/home/home.component.html')).toContain('@for (post of store.posts()');
  });

  it('omits the store file when the document has no state', () => {
    const result = generateProject(createDocument('Plain'), { projectName: 'test-app' });
    expect(result.stats.stateVariables).toBe(0);
    expect(result.files.map((file) => file.path)).not.toContain('src/app/core/app-store.ts');
  });
});
