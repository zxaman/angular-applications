import { describe, expect, it } from 'vitest';
import {
  addStateVariable,
  createAction,
  createDocument,
  createStateVariable,
  describeAction,
  addNodeAction,
  triggersFor,
  type AppDocument,
} from '@appstudio/schema';
import { createNodeFromWidget } from '@appstudio/widgets';
import { emitComponentClass } from './component';
import { planProject } from './plan';
import { emitTemplate } from './template';
import { fileContents, generateProject } from './index';

function docWithActions(): AppDocument {
  let doc = createDocument('Actions App');
  doc = addStateVariable(doc, createStateVariable({ name: 'counter', type: 'number', initial: '0' }));
  doc = addStateVariable(doc, createStateVariable({ name: 'quote', type: 'object', initial: '{}' }));
  doc = { ...doc, pages: [...doc.pages, { ...doc.pages[0]!, id: 'p_about', name: 'About', route: 'about', title: 'About' }] };

  const page = doc.pages[0]!;
  const button = createNodeFromWidget('button', { props: { label: 'Load' } });
  const card = createNodeFromWidget('card', { props: { title: 'Clickable' } });
  const form = createNodeFromWidget('form', {});
  const email = createNodeFromWidget('text-input', { props: { name: 'email', label: 'Email' } });
  page.root = createNodeFromWidget('container', { children: [button, card, form, email] });

  doc = addNodeAction(doc, button.id, { ...createAction('setState'), variable: 'counter', value: '{{ state.counter }}' });
  doc = addNodeAction(doc, button.id, {
    ...createAction('http'),
    method: 'GET',
    url: 'https://example.com/quote',
    assignTo: 'quote',
  });
  doc = addNodeAction(doc, button.id, { ...createAction('navigate'), pageId: 'p_about' });
  doc = addNodeAction(doc, button.id, { ...createAction('openUrl'), url: 'https://example.com', newTab: true });
  doc = addNodeAction(doc, card.id, { ...createAction('navigate'), pageId: 'p_about' });
  doc = addNodeAction(doc, form.id, { ...createAction('setState'), trigger: 'submit', variable: 'counter', value: '5' });
  doc = addNodeAction(doc, email.id, { ...createAction('setState'), trigger: 'change', variable: 'counter', value: '1' });
  return doc;
}

function actionContext(doc: AppDocument) {
  return { state: doc.state, routeOf: (pageId: string) => doc.pages.find((page) => page.id === pageId)?.route };
}

describe('action schema helpers', () => {
  it('creates an action with kind specific defaults', () => {
    expect(createAction('navigate').pageId).toBe('');
    expect(createAction('openUrl').url).toBe('https://');
    expect(createAction('http').method).toBe('GET');
    expect(createAction('setState').value).toBe('');
  });

  it('offers the triggers a widget can react to', () => {
    expect(triggersFor('button')).toEqual(['click']);
    expect(triggersFor('form')).toEqual(['submit']);
    expect(triggersFor('text-input')).toEqual(['change']);
  });

  it('describes an action for the studio list', () => {
    const doc = docWithActions();
    const actions = doc.pages[0]!.root.children[0]!.actions!;
    expect(describeAction(actions[0]!)).toContain('Set counter');
    expect(describeAction(actions[2]!, doc)).toContain('/about');
    expect(describeAction(actions[3]!)).toContain('new tab');
  });
});

describe('generated templates with actions', () => {
  const doc = docWithActions();
  const plan = planProject(doc, { granularity: 'page' });
  const template = emitTemplate(plan.pages[0]!, plan.byNodeId);

  it('binds click, submit and change handlers', () => {
    expect(template.html).toContain('(click)="onLoadClick($event)"');
    expect(template.html).toContain('(ngSubmit)="onFormSubmit(form)"');
    expect(template.html).toContain('(ngModelChange)="onEmailChange($event)"');
    // non-interactive widgets get a click binding injected on their own tag
    expect(template.html).toMatch(/<div class="as-card[^"]*"[^>]*\(click\)="onCardClick\(\$event\)"/);
  });
});

describe('generated component classes with actions', () => {
  const doc = docWithActions();
  const plan = planProject(doc, { granularity: 'page' });
  const template = emitTemplate(plan.pages[0]!, plan.byNodeId);
  const source = emitComponentClass(plan.pages[0]!, template, [], actionContext(doc));

  it('injects the services its actions need', () => {
    expect(source).toContain("import { HttpClient } from '@angular/common/http';");
    expect(source).toContain("import { Router } from '@angular/router';");
    expect(source).toContain('private readonly http = inject(HttpClient);');
    expect(source).toContain('private readonly router = inject(Router);');
    expect(source).toContain('protected readonly store = inject(AppStore);');
  });

  it('emits one statement per action, in order', () => {
    expect(source).toContain('this.store.counter.set(this.store.counter());');
    expect(source).toContain("this.http.request<unknown>('GET', 'https://example.com/quote').subscribe({");
    expect(source).toContain('next: (response) => this.store.quote.set(response as never),');
    expect(source).toContain("void this.router.navigate(['/about']);");
    expect(source).toContain("window.open('https://example.com', '_blank', 'noopener');");
  });

  it('types set-state values from the variable type', () => {
    expect(source).toContain('this.store.counter.set(5);');
    expect(source).toContain('this.store.counter.set(1);');
  });

  it('keeps a TODO body for handlers without actions', () => {
    const plain = createDocument('Plain');
    const page = plain.pages[0]!;
    page.root = createNodeFromWidget('container', { children: [createNodeFromWidget('button', { props: { label: 'Go' } })] });
    const plainPlan = planProject(plain, { granularity: 'page' });
    const plainTemplate = emitTemplate(plainPlan.pages[0]!, plainPlan.byNodeId);
    const plainSource = emitComponentClass(plainPlan.pages[0]!, plainTemplate, [], actionContext(plain));

    expect(plainSource).toContain('// TODO: implement this action.');
    expect(plainSource).not.toContain('HttpClient');
  });
});

describe('generateProject with actions', () => {
  it('adds provideHttpClient only when an HTTP action exists', () => {
    const withHttp = generateProject(docWithActions(), { projectName: 'actions-app', granularity: 'page' });
    expect(withHttp.stats.actions).toBe(7);
    expect(fileContents(withHttp, 'src/app/app.config.ts')).toContain('provideHttpClient(withFetch())');

    const without = generateProject(createDocument('Plain'), { projectName: 'plain-app' });
    expect(fileContents(without, 'src/app/app.config.ts')).not.toContain('provideHttpClient');
  });
});
