import { evaluateBindings, stateMap, type BindingContext } from './state';
import type { AppDocument, AppNode, NodeAction, StateVariable } from './types';

/**
 * Action helpers shared by the studio and the generator.
 *
 * Actions are stored on the node so they survive copy/paste, and they are
 * deliberately data (not code) so the same list can drive the live preview and
 * the emitted TypeScript.
 */

export const ACTION_LABELS: Record<NodeAction['kind'], string> = {
  navigate: 'Navigate to page',
  openUrl: 'Open URL',
  setState: 'Set state',
  http: 'HTTP request',
};

export const TRIGGER_LABELS: Record<NodeAction['trigger'], string> = {
  click: 'On click',
  submit: 'On submit',
  change: 'On change',
};

let counter = 0;

/** Creates an action with defaults filled in for its kind. */
export function createAction(kind: NodeAction['kind'], trigger: NodeAction['trigger'] = 'click'): NodeAction {
  counter += 1;
  const base: NodeAction = { id: `a_${Date.now().toString(36)}${counter.toString(36)}`, trigger, kind };
  switch (kind) {
    case 'navigate':
      return { ...base, pageId: '' };
    case 'openUrl':
      return { ...base, url: 'https://', newTab: true };
    case 'setState':
      return { ...base, variable: '', value: '' };
    case 'http':
      return { ...base, method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1' };
  }
}

/** Actions attached to a node for one trigger. */
export function actionsForTrigger(node: AppNode, trigger: NodeAction['trigger']): NodeAction[] {
  return (node.actions ?? []).filter((action) => action.trigger === trigger);
}

/** True when a node reacts to anything at all. */
export function hasActions(node: AppNode): boolean {
  return (node.actions?.length ?? 0) > 0;
}

/** One-line description used in the studio's action list. */
export function describeAction(action: NodeAction, doc?: AppDocument): string {
  switch (action.kind) {
    case 'navigate': {
      const page = doc?.pages.find((entry) => entry.id === action.pageId);
      return `Go to ${page ? `/${page.route}`.replace(/\/$/, '') || '/' : 'a page'}`;
    }
    case 'openUrl':
      return `Open ${action.url || 'a URL'}${action.newTab ? ' in a new tab' : ''}`;
    case 'setState':
      return `Set ${action.variable || 'state'} = ${action.value || '""'}`;
    case 'http':
      return `${action.method ?? 'GET'} ${action.url || ''}${action.assignTo ? ` → ${action.assignTo}` : ''}`;
  }
}

/** Triggers a widget type can react to. */
export function triggersFor(type: string): NodeAction['trigger'][] {
  if (type === 'form') {
    return ['submit'];
  }
  if (['text-input', 'textarea', 'select', 'checkbox', 'switch'].includes(type)) {
    return ['change'];
  }
  return ['click'];
}

/** Coerces action text into the target variable's type (used by the preview). */
export function coerceForVariable(variable: StateVariable | undefined, raw: string): unknown {
  if (!variable) {
    return raw;
  }
  switch (variable.type) {
    case 'number': {
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    case 'boolean':
      return raw === 'true' || raw === '1';
    case 'list':
    case 'object': {
      try {
        return JSON.parse(raw);
      } catch {
        return variable.type === 'list' ? [] : {};
      }
    }
    default:
      return raw;
  }
}

/** Applies one `setState` action to a state map, resolving `{{…}}` first. */
export function applySetState(
  doc: AppDocument,
  action: NodeAction,
  state: Record<string, unknown>,
  locals: Record<string, unknown> = {},
): Record<string, unknown> {
  if (!action.variable) {
    return state;
  }
  const context: BindingContext = { state, locals };
  const raw = evaluateBindings(action.value ?? '', context);
  const variable = doc.state.find((entry) => entry.name === action.variable);
  return { ...state, [action.variable]: coerceForVariable(variable, raw) };
}

/** Runs every `setState` action of a trigger; other kinds are the app's job. */
export function runPreviewActions(
  doc: AppDocument,
  node: AppNode,
  trigger: NodeAction['trigger'],
  state: Record<string, unknown>,
): Record<string, unknown> {
  let next = state;
  for (const action of actionsForTrigger(node, trigger)) {
    if (action.kind === 'setState') {
      next = applySetState(doc, action, next);
    }
  }
  return next;
}

/** State variables referenced by any action on a node. */
export function actionStateNames(node: AppNode): string[] {
  const names = new Set<string>();
  for (const action of node.actions ?? []) {
    if (action.variable) {
      names.add(action.variable);
    }
    if (action.assignTo) {
      names.add(action.assignTo);
    }
  }
  return [...names];
}

/** Full state map, useful when a preview needs to start from the document. */
export function previewState(doc: AppDocument): Record<string, unknown> {
  return stateMap(doc);
}
