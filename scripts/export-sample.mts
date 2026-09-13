/**
 * Dev tool: exports a sample project built from the landing template so the
 * generated output can be inspected (or even `npm install`ed) outside the studio.
 *
 *   npm run export:sample            # writes to exports/sample
 *   npm run export:sample -- widget  # one component per widget
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateProject } from '../libs/generator/src/index';
import type { Granularity } from '../libs/generator/src/index';
import { setNodeComponentName, setNodeCss } from '../libs/schema/src/index';
import { landingTemplate } from '../libs/widgets/src/index';

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
doc.globalStyles.push({
  name: 'brand.css',
  content: '/* Imported global stylesheet */\n:root {\n  --brand: #ff5a1f;\n}\n',
  importedAt: new Date().toISOString(),
});

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
console.log(`  pages: ${result.stats.pages}, components: ${result.stats.components}, stylesheets: ${result.stats.importedStylesheets}`);
for (const warning of result.warnings) {
  console.warn(`  warning: ${warning}`);
}
