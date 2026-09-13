/**
 * Dev tool: exports a sample project built from the landing template so the
 * generated output can be inspected (or even `npm install`ed) outside the studio.
 *
 *   npm run export:sample            # writes to exports/sample
 *   npm run export:sample -- widget  # one component per widget
 *
 * The sample also carries app state and a repeated section, so the exported
 * `AppStore` and `@for` output is exercised end to end.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateProject } from '../libs/generator/src/index';
import type { Granularity } from '../libs/generator/src/index';
import {
  addNodeAction,
  addStateVariable,
  createInstanceNode,
  createStateVariable,
  findComponent,
  saveNodeAsComponent,
  setNodeComponentName,
  setNodeCss,
  createAction,
  setNodeRepeat,
  updateNodeProps,
} from '../libs/schema/src/index';
import { createNodeFromWidget, landingTemplate } from '../libs/widgets/src/index';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'exports', 'sample');
const granularity = (process.argv[2] as Granularity | undefined) ?? 'component';

let doc = landingTemplate('Acme Store');
const page = doc.pages[0];
const features = page?.root.children[2];
if (page && features) {
  doc = setNodeComponentName(doc, features.id, 'Feature Grid');
  doc = setNodeCss(
    doc,
    features.id,
    `.feature-grid {
  padding-inline: 12px;
}

@media (max-width: 600px) {
  .feature-grid {
    padding-inline: 4px;
  }
}
`,
    'acme-grid.css',
  );
}
// A state-driven, repeated section: proves the generated AppStore + @for compile.
doc = addStateVariable(
  doc,
  createStateVariable({ name: 'sectionTitle', initial: 'What customers say', description: 'Heading above the quotes' }),
);
doc = addStateVariable(
  doc,
  createStateVariable({
    name: 'testimonials',
    type: 'list',
    initial: JSON.stringify(
      [
        { quote: 'Shipped our landing page in an afternoon.', author: 'Priya' },
        { quote: 'The exported code reads like it was hand written.', author: 'Tom' },
      ],
      null,
      2,
    ),
    description: 'Customer quotes',
  }),
);

const quote = createNodeFromWidget('column', {
  name: 'Testimonial',
  children: [
    createNodeFromWidget('text', { props: { text: '{{ item.quote }}' } }),
    createNodeFromWidget('text', { props: { text: '— {{ item.author }}' } }),
  ],
});
const testimonials = createNodeFromWidget('column', {
  name: 'Testimonials',
  props: { gap: '16px', padding: '32px 16px' },
  children: [createNodeFromWidget('heading', { props: { text: '{{ state.sectionTitle }}', level: 'h2' } }), quote],
});
doc = updateNodeProps(doc, testimonials.id, { gap: '16px' });
if (page) {
  doc = {
    ...doc,
    pages: doc.pages.map((entry) =>
      entry.id === page.id ? { ...entry, root: { ...entry.root, children: [...entry.root.children, testimonials] } } : entry,
    ),
  };
}
// Applied last so the repeater lands on the node that is actually in the tree.
doc = setNodeRepeat(doc, quote.id, { collection: 'testimonials', itemName: 'item', indexName: 'index' });

// Actions: the hero button navigates, a card fetches a quote into state.
const heroButton = findNodeById(doc, 'button');
if (heroButton) {
  doc = addNodeAction(doc, heroButton.id, {
    ...createAction('navigate'),
    pageId: doc.pages[1]?.id,
  });
}
doc = addNodeAction(doc, testimonials.id, {
  ...createAction('http'),
  method: 'GET',
  url: 'https://jsonplaceholder.typicode.com/todos/1',
  assignTo: 'sectionTitle',
});

doc.globalStyles.push({
  name: 'brand.css',
  content: '/* Imported global stylesheet */\n:root {\n  --brand: #ff5a1f;\n}\n',
  importedAt: new Date().toISOString(),
});

// A reusable component: saved once, placed twice, exported as one folder.
const planCard = createNodeFromWidget('card', {
  name: 'Plan',
  props: { title: 'Pro', subtitle: 'For small teams shipping fast' },
  children: [
    createNodeFromWidget('text', { props: { text: 'Everything you need to launch.' } }),
    createNodeFromWidget('button', { props: { label: 'Choose Pro' } }),
  ],
});
if (page) {
  doc = {
    ...doc,
    pages: doc.pages.map((entry) =>
      entry.id === page.id ? { ...entry, root: { ...entry.root, children: [...entry.root.children, planCard] } } : entry,
    ),
  };
}
const savedComponent = saveNodeAsComponent(doc, planCard.id, 'Plan Card');
if (savedComponent) {
  doc = savedComponent.doc;
  const definition = findComponent(doc, savedComponent.componentId)!;
  const second = createInstanceNode({ component: definition, props: { title: 'Team', subtitle: 'For growing products' } });
  const aboutPage = doc.pages[1];
  if (aboutPage) {
    doc = {
      ...doc,
      pages: doc.pages.map((entry) =>
        entry.id === aboutPage.id ? { ...entry, root: { ...entry.root, children: [...entry.root.children, second] } } : entry,
      ),
    };
  }
}

/** First node of a given widget type, depth first. */
function findNodeById(document: typeof doc, type: string) {
  let found: { id: string } | null = null;
  const walk = (node: { id: string; type: string; children: typeof node[] }): void => {
    if (found || node.type !== type) {
      node.children.forEach(walk);
      return;
    }
    found = node;
  };
  document.pages.forEach((page) => walk(page.root));
  return found;
}

const result = generateProject(doc, {
  projectName: 'acme-store',
  granularity,
  includeCapacitor: granularity === 'component',
});

rmSync(outDir, { recursive: true, force: true });
for (const file of result.files) {
  const target = join(outDir, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.contents, 'utf8');
}

console.log(`Exported ${result.stats.files} files to ${outDir}`);
console.log(
  `  pages: ${result.stats.pages}, components: ${result.stats.components}, stylesheets: ${result.stats.importedStylesheets}, state: ${result.stats.stateVariables}, actions: ${result.stats.actions}`,
);
for (const warning of result.warnings) {
  console.warn(`  warning: ${warning}`);
}
