import { DOCUMENT_VERSION } from './factory';
import { traverse } from './tree';
import type { AppDocument, AppNode } from './types';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** Dotted path to the offending part of the document. */
  path: string;
  message: string;
  nodeId?: string;
}

/**
 * Structural validation. Used before export and when importing a project file so
 * users get an actionable message instead of a generator crash.
 */
export function validateDocument(doc: AppDocument, knownWidgetTypes?: readonly string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (doc.version !== DOCUMENT_VERSION) {
    issues.push({
      severity: 'warning',
      path: 'version',
      message: `Document version ${doc.version} differs from the current version ${DOCUMENT_VERSION}.`,
    });
  }
  if (!doc.meta?.name?.trim()) {
    issues.push({ severity: 'error', path: 'meta.name', message: 'Project name is required.' });
  }
  if (!/^[a-z][a-z0-9-]*$/.test(doc.settings?.prefix ?? '')) {
    issues.push({
      severity: 'error',
      path: 'settings.prefix',
      message: 'Component prefix must be lowercase and start with a letter (e.g. `app`).',
    });
  }
  if (!doc.pages?.length) {
    issues.push({ severity: 'error', path: 'pages', message: 'A project needs at least one page.' });
    return issues;
  }

  const stateNames = new Set<string>();
  for (const variable of doc.state ?? []) {
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(variable.name)) {
      issues.push({
        severity: 'error',
        path: `state[${variable.id}].name`,
        message: `State name "${variable.name}" is not a valid identifier.`,
      });
    }
    if (stateNames.has(variable.name)) {
      issues.push({
        severity: 'error',
        path: `state[${variable.id}].name`,
        message: `Duplicate state name "${variable.name}".`,
      });
    }
    stateNames.add(variable.name);
    if (variable.type === 'list') {
      try {
        const parsed: unknown = JSON.parse(variable.initial || '[]');
        if (!Array.isArray(parsed)) {
          issues.push({
            severity: 'error',
            path: `state[${variable.id}].initial`,
            message: `List state "${variable.name}" must be initialised with a JSON array.`,
          });
        }
      } catch {
        issues.push({
          severity: 'error',
          path: `state[${variable.id}].initial`,
          message: `List state "${variable.name}" contains invalid JSON.`,
        });
      }
    }
  }

  const routes = new Map<string, string>();
  const ids = new Set<string>();

  doc.pages.forEach((page, pageIndex) => {
    const basePath = `pages[${pageIndex}]`;
    if (!page.name?.trim()) {
      issues.push({ severity: 'error', path: `${basePath}.name`, message: 'Page name cannot be empty.' });
    }
    if (pageIndex > 0 && page.route.trim() === '') {
      issues.push({
        severity: 'error',
        path: `${basePath}.route`,
        message: `Only the first page can use the empty ("") route. "${page.name}" needs a route.`,
      });
    }
    const routeKey = page.route.trim();
    if (routes.has(routeKey)) {
      issues.push({
        severity: 'error',
        path: `${basePath}.route`,
        message: `Route "${routeKey || '/'}" is already used by "${routes.get(routeKey)}".`,
      });
    } else {
      routes.set(routeKey, page.name);
    }

    let count = 0;
    const walk = (node: AppNode, nodePath: string, level: number): void => {
      count += 1;
      if (ids.has(node.id)) {
        issues.push({ severity: 'error', path: nodePath, message: `Duplicate node id "${node.id}".`, nodeId: node.id });
      }
      ids.add(node.id);
      if (node.repeat?.collection && !stateNames.has(node.repeat.collection)) {
        issues.push({
          severity: 'error',
          path: nodePath,
          message: `Repeater uses unknown list state "${node.repeat.collection}".`,
          nodeId: node.id,
        });
      }
      if (knownWidgetTypes && !knownWidgetTypes.includes(node.type)) {
        issues.push({
          severity: 'warning',
          path: nodePath,
          message: `Unknown widget type "${node.type}". It will be generated as a generic container.`,
          nodeId: node.id,
        });
      }
      node.children.forEach((child, childIndex) => walk(child, `${nodePath}.children[${childIndex}]`, level + 1));
    };
    walk(page.root, `${basePath}.root`, 0);

    if (count > 2000) {
      issues.push({ severity: 'warning', path: `${basePath}.root`, message: 'Page has more than 2000 nodes.' });
    }
  });

  // Orphaned custom CSS usually means the user replaced the widget type afterwards.
  allNodesFlat(doc).forEach((node) => {
    if (node.css && !node.css.trim()) {
      issues.push({
        severity: 'warning',
        path: `nodes[${node.id}].css`,
        message: 'Empty stylesheet attached to a widget.',
        nodeId: node.id,
      });
    }
  });

  return issues;
}

function allNodesFlat(doc: AppDocument): AppNode[] {
  const nodes: AppNode[] = [];
  doc.pages.forEach((page) => traverse(page.root, (node) => nodes.push(node)));
  return nodes;
}
