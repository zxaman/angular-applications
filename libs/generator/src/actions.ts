import { escapeTs, toAngularExpression } from './naming';
import type { NodeAction, StateVariable } from '@appstudio/schema';

/**
 * Turns studio actions into TypeScript statements.
 *
 * Every action kind maps to one statement so a handler body reads top to bottom
 * exactly like the list in the inspector.
 */

export interface ActionContext {
  /** State variables by name, used to type `setState` writes. */
  state: StateVariable[];
  /** Route path for a page id (`navigate`). */
  routeOf: (pageId: string) => string | undefined;
}

export interface ActionRequirements {
  router: boolean;
  http: boolean;
  store: boolean;
}

/**
 * `{{state.count}}` inside an action value becomes `this.store.count()`.
 * Template expressions address `store` directly; class bodies need `this.`.
 */
function inClass(expression: string): string {
  return expression.startsWith('store.') ? `this.${expression}` : expression;
}

function valueExpression(value: string): string {
  const binding = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec(value.trim());
  return binding ? inClass(toAngularExpression(binding[1].trim())) : `'${escapeTs(value)}'`;
}

function typedValue(action: NodeAction, context: ActionContext): string {
  const variable = context.state.find((entry) => entry.name === action.variable);
  const raw = action.value ?? '';
  switch (variable?.type) {
    case 'number': {
      const binding = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec(raw.trim());
      if (binding) {
        return inClass(toAngularExpression(binding[1].trim()));
      }
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? String(parsed) : '0';
    }
    case 'boolean':
      return raw === 'true' || raw === '1' ? 'true' : 'false';
    case 'list':
    case 'object': {
      const binding = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec(raw.trim());
      if (binding) {
        return inClass(toAngularExpression(binding[1].trim()));
      }
      try {
        return JSON.stringify(JSON.parse(raw));
      } catch {
        return variable.type === 'list' ? '[]' : '{}';
      }
    }
    default:
      return valueExpression(raw);
  }
}

/** Statements for one action, plus the services it needs. */
export function emitAction(action: NodeAction, context: ActionContext): { statements: string[]; needs: ActionRequirements } {
  const needs: ActionRequirements = { router: false, http: false, store: false };

  switch (action.kind) {
    case 'navigate': {
      needs.router = true;
      const route = action.pageId ? context.routeOf(action.pageId) : undefined;
      if (!route) {
        return { statements: ['// TODO: pick a target page for this navigate action.'], needs };
      }
      const path = route === '' ? '/' : `/${route}`;
      return { statements: [`void this.router.navigate(['${escapeTs(path)}']);`], needs };
    }
    case 'openUrl': {
      const url = escapeTs(action.url ?? '');
      const target = action.newTab === false ? "'_self'" : "'_blank', 'noopener'";
      return { statements: [`window.open('${url}', ${target});`], needs };
    }
    case 'setState': {
      if (!action.variable) {
        return { statements: ['// TODO: pick the state variable this action writes.'], needs };
      }
      needs.store = true;
      return { statements: [`this.store.${action.variable}.set(${typedValue(action, context)});`], needs };
    }
    case 'http': {
      needs.http = true;
      const method = action.method ?? 'GET';
      const url = escapeTs(action.url ?? '');
      if (action.assignTo) {
        needs.store = true;
        return {
          statements: [
            `this.http.request<unknown>('${method}', '${url}').subscribe({`,
            `  next: (response) => this.store.${action.assignTo}.set(response as never),`,
            `  error: (error: unknown) => console.error('${method} ${url} failed', error),`,
            '});',
          ],
          needs,
        };
      }
      return {
        statements: [
          `this.http.request<unknown>('${method}', '${url}').subscribe({`,
          `  error: (error: unknown) => console.error('${method} ${url} failed', error),`,
          '});',
        ],
        needs,
      };
    }
  }
}

/** Everything a handler needs, aggregated over its actions. */
export function emitHandlerBody(
  actions: NodeAction[],
  context: ActionContext,
): { body: string; needs: ActionRequirements } {
  const needs: ActionRequirements = { router: false, http: false, store: false };
  const lines: string[] = [];

  for (const action of actions) {
    const emitted = emitAction(action, context);
    needs.router ||= emitted.needs.router;
    needs.http ||= emitted.needs.http;
    needs.store ||= emitted.needs.store;
    lines.push(...emitted.statements.map((line) => `    ${line}`));
  }

  if (lines.length === 0) {
    lines.push('    // TODO: implement this action.');
  }
  return { body: lines.join('\n'), needs };
}

/** True when any node in the tree carries an HTTP action (drives `provideHttpClient`). */
export function actionRequirements(actions: NodeAction[], context: ActionContext): ActionRequirements {
  const needs: ActionRequirements = { router: false, http: false, store: false };
  for (const action of actions) {
    const emitted = emitAction(action, context);
    needs.router ||= emitted.needs.router;
    needs.http ||= emitted.needs.http;
    needs.store ||= emitted.needs.store;
  }
  return needs;
}
