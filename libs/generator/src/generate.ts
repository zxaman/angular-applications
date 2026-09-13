import { traverse, validateDocument, type AppDocument, type NodeAction } from '@appstudio/schema';
import { baseCss, WIDGET_TYPES } from '@appstudio/widgets';
import type { ActionContext } from './actions';
import { emitComponentClass, emitComponentSpec } from './component';
import { kebab } from './naming';
import { planProject } from './plan';
import { scaffoldFiles } from './scaffold';
import { emitAppStore } from './store';
import { emitComponentStyles, emitGlobalStyles } from './styles';
import { emitTemplate } from './template';
import type { FileKind, GeneratedFile, GenerateOptions, GenerateResult, NormalisedOptions } from './types';

function kindFor(path: string): FileKind {
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.scss')) return 'scss';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'md';
  return 'other';
}

/** `Brand Tokens.CSS` -> `brand-tokens.css` (keeps the extension). */
export function styleFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? name.slice(dot).toLowerCase() : '.css';
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${kebab(base)}${['.css', '.scss'].includes(extension) ? extension : '.css'}`;
}

export function normaliseOptions(doc: AppDocument, options: GenerateOptions): NormalisedOptions {
  return {
    ...options,
    projectName: kebab(options.projectName || doc.meta.name || 'my-app'),
    prefix: (options.prefix ?? doc.settings.prefix ?? 'app').toLowerCase(),
    granularity: options.granularity ?? 'component',
    includeCapacitor: options.includeCapacitor ?? doc.settings.includeCapacitor ?? false,
    includeTests: options.includeTests ?? true,
  };
}

/**
 * Turns an AppStudio document into a complete Angular project.
 *
 * The output is a flat list of files (path + contents) which the UI can preview,
 * diff, copy or zip. Nothing here touches the filesystem, so the same function
 * serves the browser export and any future CLI.
 */
export function generateProject(doc: AppDocument, options: GenerateOptions): GenerateResult {
  const resolved = normaliseOptions(doc, options);
  const plan = planProject(doc, resolved.granularity);

  const warnings: string[] = [...plan.warnings];
  for (const issue of validateDocument(doc, WIDGET_TYPES)) {
    if (issue.severity === 'error') {
      warnings.push(`${issue.path}: ${issue.message}`);
    }
  }

  const seen = new Set<string>();
  const globalStylePaths: string[] = [];
  const globalStyleFiles: GeneratedFile[] = [];
  for (const style of doc.globalStyles) {
    const name = styleFileName(style.name || 'imported.css');
    if (seen.has(name)) {
      warnings.push(`Stylesheet "${style.name}" was imported twice; only the first copy is exported.`);
      continue;
    }
    seen.add(name);
    const path = `src/styles/imports/${name}`;
    globalStylePaths.push(path);
    globalStyleFiles.push({ path, contents: style.content, kind: kindFor(path) });
  }

  const actionContext: ActionContext = {
    state: doc.state,
    routeOf: (pageId: string) => doc.pages.find((page) => page.id === pageId)?.route,
  };
  const everyAction: NodeAction[] = [];
  for (const page of doc.pages) {
    traverse(page.root, (node) => everyAction.push(...(node.actions ?? [])));
  }
  const needsHttpClient = everyAction.some((action) => action.kind === 'http');

  const files: GeneratedFile[] = [
    ...scaffoldFiles({ doc, plan, options: resolved, globalStylePaths, http: needsHttpClient }),
    { path: 'src/styles.scss', contents: emitGlobalStyles(doc.theme, baseCss()), kind: 'scss' },
    ...globalStyleFiles,
  ];

  if (doc.state.length > 0) {
    files.push({ path: 'src/app/core/app-store.ts', contents: emitAppStore(doc.state), kind: 'ts' });
  }

  let widgets = 0;
  for (const component of plan.all) {
    const template = emitTemplate(component, plan.byNodeId);
    const dir = `src/app/${component.folder}`;
    files.push({
      path: `${dir}/${component.fileBase}.ts`,
      contents: emitComponentClass(component, template, component.children, actionContext),
      kind: 'ts',
    });
    files.push({ path: `${dir}/${component.fileBase}.html`, contents: template.html, kind: 'html' });
    files.push({
      path: `${dir}/${component.fileBase}.scss`,
      contents: emitComponentStyles(component, plan.byNodeId),
      kind: 'scss',
    });
    if (resolved.includeTests && component.kind === 'page') {
      files.push({ path: `${dir}/${component.fileBase}.spec.ts`, contents: emitComponentSpec(component, template), kind: 'ts' });
    }
    if (component.kind !== 'page') {
      widgets += 1;
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    files,
    warnings,
    stats: {
      files: files.length,
      pages: plan.pages.length,
      components: plan.all.length - plan.pages.length,
      widgets,
      importedStylesheets: globalStylePaths.length,
      stateVariables: doc.state.length,
      actions: everyAction.length,
    },
  };
}

/** Convenience helper for tests and CLIs: read one file out of a result. */
export function findFile(result: GenerateResult, path: string): GeneratedFile | undefined {
  return result.files.find((file) => file.path === path);
}

export function fileContents(result: GenerateResult, path: string): string {
  const file = findFile(result, path);
  if (!file) {
    throw new Error(`Generated project does not contain ${path}`);
  }
  return file.contents;
}
