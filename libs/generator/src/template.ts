import { actionsForTrigger, type AppNode, type NodeAction } from '@appstudio/schema';
import { allClasses, iconSvg, parseList, parseSelectOptions } from '@appstudio/widgets';
import { escapeAttr, escapeHtml, escapeTs, indent, pascal, toAngularExpression } from './naming';
import type { ComponentPlan } from './plan';

export interface GeneratedHandler {
  name: string;
  comment: string;
  /** Studio actions this handler runs, in order. */
  actions: NodeAction[];
  /** `event` for click/change handlers, `form` for submit handlers. */
  param: 'event' | 'form';
}

export interface TemplateResult {
  html: string;
  needsForms: boolean;
  needsRouter: boolean;
  /** True when the template reads `store.*`, so the component must inject it. */
  needsStore: boolean;
  hasForm: boolean;
  handlers: GeneratedHandler[];
  modelDefaults: Record<string, string>;
  /** Class names of child components this template renders. */
  childComponents: string[];
  /** Library component plans referenced by instance nodes. */
  libraryPlans: ComponentPlan[];
}

const pad = (depth: number): string => '  '.repeat(depth);

function isInternalRoute(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

/**
 * Emits Angular template markup for a component plan.
 *
 * Where the canvas renders static HTML, the generator emits real bindings:
 * `ngModel` for form fields, `routerLink` for internal links and click handlers
 * for buttons, so exported projects are immediately functional.
 */
const BINDING_SPLIT = /(\{\{\s*[^{}]+?\s*\}\})/g;
const BINDING_ONLY = /^\{\{\s*([^{}]+?)\s*\}\}$/;

export function hasBinding(value: string): boolean {
  return value.includes('{{');
}

/** Builds a single Angular expression for text that mixes literals and bindings. */
export function bindingExpression(text: string): string {
  const parts = text.split(BINDING_SPLIT).filter((part) => part.length > 0);
  const expressions = parts.map((part) => {
    const match = BINDING_ONLY.exec(part);
    return match ? toAngularExpression(match[1].trim()) : `'${escapeTs(part)}'`;
  });
  return expressions.length === 1 ? expressions[0] : expressions.join(' + ');
}

/**
 * Rewrites bindings in place, keeping the literal text around them:
 * `Total: {{ state.count }}` -> `Total: {{ store.count() }}`.
 */
export function interpolateBindings(text: string): string {
  return text.replace(BINDING_SPLIT, (match) => {
    const inner = BINDING_ONLY.exec(match);
    return inner ? `{{ ${toAngularExpression(inner[1].trim())} }}` : match;
  });
}

class TemplateEmitter {
  needsForms = false;
  needsRouter = false;
  needsStore = false;
  hasForm = false;

  private readonly handlers: GeneratedHandler[] = [];
  private readonly handlerNames = new Set<string>();
  private readonly modelDefaults = new Map<string, string>();
  private readonly childComponents = new Set<string>();
  private readonly libraryPlans = new Map<string, ComponentPlan>();

  constructor(
    private readonly plan: ComponentPlan,
    private readonly byNodeId: Map<string, ComponentPlan>,
    private readonly byComponentId: Map<string, ComponentPlan> = new Map(),
  ) {}

  emit(): TemplateResult {
    const html = this.emitNode(this.plan.node, 0).trimStart();
    return {
      html: `${html}\n`,
      needsForms: this.needsForms,
      needsRouter: this.needsRouter,
      needsStore: this.needsStore,
      hasForm: this.hasForm,
      handlers: this.handlers,
      modelDefaults: Object.fromEntries(this.modelDefaults),
      childComponents: [...this.childComponents],
      libraryPlans: [...this.libraryPlans.values()],
    };
  }

  /** Signal input name for a property of this component's own root node. */
  private inputName(node: AppNode, key: string): string | null {
    if (node.id !== this.plan.node.id) {
      return null;
    }
    return this.plan.inputs.find((input) => input.prop === key)?.name ?? null;
  }

  private text(node: AppNode, key: string, fallback: string): string {
    const input = this.inputName(node, key);
    const raw = node.props[key];
    const value = raw === null || raw === undefined || raw === '' ? fallback : String(raw);
    if (hasBinding(value)) {
      this.needsStore = true;
      return interpolateBindings(value);
    }
    return input ? `{{ ${input}() }}` : escapeHtml(value);
  }

  /** `placeholder="Type here"`, `[placeholder]="placeholder()"`, or a binding. */
  private attr(node: AppNode, key: string, attribute: string, fallback = ''): string {
    const input = this.inputName(node, key);
    const raw = node.props[key];
    const value = raw === null || raw === undefined ? fallback : String(raw);
    if (hasBinding(value)) {
      this.needsStore = true;
      return ` [${attribute}]="${bindingExpression(value)}"`;
    }
    if (input) {
      return ` [${attribute}]="${input}()"`;
    }
    if (value === '') {
      return '';
    }
    return ` ${attribute}="${escapeAttr(value)}"`;
  }

  private boolAttr(node: AppNode, key: string, attribute: string): string {
    const raw = node.props[key];
    return raw === true || raw === 'true' ? ` ${attribute}` : '';
  }

  private classNames(node: AppNode): string {
    return allClasses(node).join(' ');
  }

  private handler(
    node: AppNode,
    suffix: string,
    actions: NodeAction[] = [],
    param: 'event' | 'form' = 'event',
  ): string {
    const label = String(
      node.name?.trim() || node.props['label'] || node.props['text'] || node.props['title'] || node.props['name'] || node.type,
    );
    const base = `on${pascal(label)}${suffix}`;
    let name = base;
    let index = 2;
    while (this.handlerNames.has(name)) {
      name = `${base}${index}`;
      index += 1;
    }
    this.handlerNames.add(name);
    this.handlers.push({ name, comment: `Action for the "${label}" ${node.type}.`, actions, param });
    return name;
  }

  /** Widgets whose click/submit/change binding is emitted by their own case. */
  private static readonly INTERACTIVE = new Set([
    'button',
    'link',
    'form',
    'text-input',
    'textarea',
    'select',
    'checkbox',
    'switch',
  ]);

  /** Adds `(click)` to any non-interactive widget that carries click actions. */
  private withClickActions(markup: string, node: AppNode): string {
    const actions = actionsForTrigger(node, 'click');
    if (actions.length === 0 || TemplateEmitter.INTERACTIVE.has(node.type)) {
      return markup;
    }
    const name = this.handler(node, 'Click', actions);
    const end = markup.indexOf('>');
    if (end === -1) {
      return markup;
    }
    return `${markup.slice(0, end)} (click)="${name}($event)"${markup.slice(end)}`;
  }

  /** `(ngModelChange)` binding for inputs that carry change actions. */
  private changeBinding(node: AppNode): string {
    const actions = actionsForTrigger(node, 'change');
    if (actions.length === 0) {
      return '';
    }
    return ` (ngModelChange)=\"${this.handler(node, 'Change', actions)}($event)\"`;
  }

  private modelField(node: AppNode, defaultValue = "''"): string {
    const raw = node.props['name'];
    const name = raw && String(raw).trim() ? String(raw).trim() : `field${this.modelDefaults.size + 1}`;
    if (!this.modelDefaults.has(name)) {
      this.modelDefaults.set(name, defaultValue);
    }
    return name;
  }

  /** `<app-hero title="Hello" [columns]="3" />` for a node from the library. */
  private emitInstance(node: AppNode, component: ComponentPlan, depth: number): string {
    this.childComponents.add(component.className);
    this.libraryPlans.set(component.componentId ?? component.className, component);

    const props = node.instance?.props ?? {};
    const attrs = component.inputs
      .map((input) => {
        const raw = props[input.name] ?? input.value;
        const value = String(raw);
        if (input.type === 'string') {
          if (hasBinding(value)) {
            this.needsStore = true;
            return ` [${input.name}]="${bindingExpression(value)}"`;
          }
          return value === '' ? '' : ` ${input.name}="${escapeAttr(value)}"`;
        }
        return ` [${input.name}]="${input.type === 'boolean' ? (raw === true || raw === 'true') : raw}"`;
      })
      .join('');

    return `${pad(depth)}<${component.selector}${attrs} />`;
  }

  private emitChildComponent(child: ComponentPlan, depth: number): string {
    this.childComponents.add(child.className);
    if (child.inputs.some((input) => hasBinding(String(input.value)))) {
      this.needsStore = true;
    }
    return `${pad(depth)}<${child.selector}${childAttributes(child)} />`;
  }

  private emitNode(node: AppNode, depth: number): string {
    const instancePlan = node.instance ? this.byComponentId.get(node.instance.componentId) : undefined;
    if (instancePlan && instancePlan.node.id !== this.plan.node.id) {
      return this.emitInstance(node, instancePlan, depth);
    }

    const childPlan = this.byNodeId.get(node.id);
    if (childPlan && node.id !== this.plan.node.id) {
      return this.emitChildComponent(childPlan, depth);
    }

    const markup = this.emitElement(node, depth);
    const repeat = node.repeat;
    if (!repeat?.collection) {
      return markup;
    }
    this.needsStore = true;
    const item = repeat.itemName || 'item';
    const aliases = repeat.indexName && repeat.indexName !== '$index' ? `; let ${repeat.indexName} = $index` : '';
    return `${pad(depth)}@for (${item} of store.${repeat.collection}(); track $index${aliases}) {\n${indent(
      markup,
      2,
    )}\n${pad(depth)}}`;
  }

  private emitElement(node: AppNode, depth: number): string {
    return this.withClickActions(this.emitMarkup(node, depth), node);
  }

  private emitMarkup(node: AppNode, depth: number): string {
    const cls = ` class="${this.classNames(node)}"`;
    const renderChildren = (at: number): string => node.children.map((child) => this.emitNode(child, at)).join('\n');
    const children = renderChildren(depth + 1);
    const wrap = (open: string, close: string, body: string): string =>
      body.trim().length > 0 ? `${pad(depth)}${open}\n${body}\n${pad(depth)}${close}` : `${pad(depth)}${open}${close}`;

    switch (node.type) {
      case 'container': {
        const tag = String(node.props['tag'] ?? 'div');
        return wrap(`<${tag}${cls}>`, `</${tag}>`, children);
      }

      case 'row':
      case 'column':
      case 'grid':
      case 'stack':
        return wrap(`<div${cls}>`, '</div>', children);

      case 'card': {
        const title = String(node.props['title'] ?? '');
        const subtitle = String(node.props['subtitle'] ?? '');
        const header: string[] = [];
        if (title || subtitle) {
          const parts: string[] = [];
          if (title) {
            parts.push(`${pad(depth + 2)}<h3 class="as-card-title">${this.text(node, 'title', '')}</h3>`);
          }
          if (subtitle) {
            parts.push(`${pad(depth + 2)}<p class="as-card-subtitle">${this.text(node, 'subtitle', '')}</p>`);
          }
          header.push(`${pad(depth + 1)}<div class="as-card-header">\n${parts.join('\n')}\n${pad(depth + 1)}</div>`);
        }
        return wrap(`<div${cls}>`, '</div>', [...header, ...(children ? [children] : [])].join('\n'));
      }

      case 'divider':
        return `${pad(depth)}<hr${cls} />`;

      case 'spacer':
        return `${pad(depth)}<div${cls} aria-hidden="true"></div>`;

      case 'form': {
        this.needsForms = true;
        this.hasForm = true;
        const submitLabel = String(node.props['submitLabel'] ?? 'Submit');
        const body = [
          ...(children ? [children] : []),
          `${pad(depth + 1)}<button class="as-button is-primary is-md" type="submit">${escapeHtml(submitLabel)}</button>`,
        ].join('\n');
        const submitActions = actionsForTrigger(node, 'submit');
        const submitName = submitActions.length > 0 ? this.handler(node, 'Submit', submitActions, 'form') : 'onSubmit';
        return `${pad(depth)}<form${cls} #form="ngForm" (ngSubmit)="${submitName}(form)">\n${body}\n${pad(depth)}</form>`;
      }

      case 'heading': {
        const tag = String(node.props['level'] ?? 'h2');
        return `${pad(depth)}<${tag}${cls}>${this.text(node, 'text', 'Heading')}</${tag}>`;
      }

      case 'text':
        return `${pad(depth)}<p${cls}>${this.text(node, 'text', '')}</p>`;

      case 'badge':
        return `${pad(depth)}<span${cls}>${this.text(node, 'text', '')}</span>`;

      case 'alert': {
        const title = String(node.props['title'] ?? '');
        const lines = [
          ...(title ? [`${pad(depth + 1)}<strong class="as-alert-title">${this.text(node, 'title', '')}</strong>`] : []),
          `${pad(depth + 1)}<span class="as-alert-text">${this.text(node, 'text', '')}</span>`,
        ];
        return `${pad(depth)}<div${cls} role="alert">\n${lines.join('\n')}\n${pad(depth)}</div>`;
      }

      case 'icon': {
        const size = Number(node.props['size'] ?? 24) || 24;
        const name = String(node.props['name'] ?? 'star');
        return `${pad(depth)}<span${cls} role="img" aria-label="${escapeAttr(name)}">${iconSvg(name, size)}</span>`;
      }

      case 'link': {
        const href = String(node.props['href'] ?? '#');
        const label = this.text(node, 'label', 'Link');
        if (isInternalRoute(href)) {
          this.needsRouter = true;
          return `${pad(depth)}<a${cls} [routerLink]="'${escapeAttr(href)}'">${label}</a>`;
        }
        const target = node.props['openInNewTab'] === true ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `${pad(depth)}<a${cls} href="${escapeAttr(href)}"${target}>${label}</a>`;
      }

      case 'list': {
        const ordered = node.props['ordered'] === true;
        const items = parseList(node.props['items']);
        const tag = ordered ? 'ol' : 'ul';
        const body = (items.length > 0 ? items : ['Empty list'])
          .map((item) => `${pad(depth + 1)}<li class="as-list-item">${escapeHtml(item)}</li>`)
          .join('\n');
        return `${pad(depth)}<${tag}${cls}>\n${body}\n${pad(depth)}</${tag}>`;
      }

      case 'breadcrumb': {
        this.needsRouter = true;
        const crumbs = parseSelectOptions(node.props['items']);
        const body = crumbs
          .map((crumb) => {
            const link = isInternalRoute(crumb.value)
              ? `<a class="as-breadcrumb-link" [routerLink]="'${escapeAttr(crumb.value || '/')}'">${escapeHtml(crumb.label)}</a>`
              : `<a class="as-breadcrumb-link" href="${escapeAttr(crumb.value || '#')}">${escapeHtml(crumb.label)}</a>`;
            return `${pad(depth + 2)}<li class="as-breadcrumb-item">${link}</li>`;
          })
          .join('\n');
        return `${pad(depth)}<nav${cls} aria-label="Breadcrumb">\n${pad(depth + 1)}<ol class="as-breadcrumb">\n${body}\n${pad(depth + 1)}</ol>\n${pad(depth)}</nav>`;
      }

      case 'button': {
        const type = String(node.props['buttonType'] ?? 'button');
        const click =
          type === 'submit' ? '' : ` (click)="${this.handler(node, 'Click', actionsForTrigger(node, 'click'))}($event)"`;
        return `${pad(depth)}<button${cls} type="${escapeAttr(type)}"${click}>${this.text(node, 'label', 'Button')}</button>`;
      }

      case 'text-input': {
        this.needsForms = true;
        const field = this.modelField(node);
        const required = node.props['required'] === true ? ' required' : '';
        const lines = [
          `${pad(depth + 1)}<label class="as-label">`,
          `${pad(depth + 2)}<span class="as-label-text">${this.text(node, 'label', 'Label')}</span>${
            node.props['required'] === true ? '\n' + pad(depth + 2) + '<span class="as-required">*</span>' : ''
          }`,
          `${pad(depth + 1)}</label>`,
          `${pad(depth + 1)}<input class="as-control" type="${escapeAttr(
            String(node.props['inputType'] ?? 'text'),
          )}"${this.attr(node, 'placeholder', 'placeholder')} name="${escapeAttr(field)}" [(ngModel)]="model['${escapeTs(
            field,
          )}']"${this.changeBinding(node)}${required} />`,
          ...(String(node.props['helper'] ?? '')
            ? [`${pad(depth + 1)}<span class="as-helper">${escapeHtml(String(node.props['helper']))}</span>`]
            : []),
        ];
        return `${pad(depth)}<div${cls}>\n${lines.join('\n')}\n${pad(depth)}</div>`;
      }

      case 'textarea': {
        this.needsForms = true;
        const field = this.modelField(node);
        const required = node.props['required'] === true ? ' required' : '';
        const lines = [
          `${pad(depth + 1)}<label class="as-label">`,
          `${pad(depth + 2)}<span class="as-label-text">${this.text(node, 'label', 'Label')}</span>`,
          `${pad(depth + 1)}</label>`,
          `${pad(depth + 1)}<textarea class="as-control" rows="${escapeAttr(
            String(node.props['rows'] ?? 4),
          )}"${this.attr(node, 'placeholder', 'placeholder')} name="${escapeAttr(field)}" [(ngModel)]="model['${escapeTs(
            field,
          )}']"${this.changeBinding(node)}${required}></textarea>`,
        ];
        return `${pad(depth)}<div${cls}>\n${lines.join('\n')}\n${pad(depth)}</div>`;
      }

      case 'select': {
        this.needsForms = true;
        const field = this.modelField(node);
        const options = parseSelectOptions(node.props['options']);
        const optionLines = [
          `${pad(depth + 2)}<option class="as-option" value="">${escapeHtml(String(node.props['placeholder'] ?? 'Select…'))}</option>`,
          ...options.map(
            (option) =>
              `${pad(depth + 2)}<option class="as-option" value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`,
          ),
        ];
        const lines = [
          `${pad(depth + 1)}<label class="as-label">`,
          `${pad(depth + 2)}<span class="as-label-text">${this.text(node, 'label', 'Label')}</span>`,
          `${pad(depth + 1)}</label>`,
          `${pad(depth + 1)}<select class="as-control" name="${escapeAttr(
            field,
          )}" [(ngModel)]="model['${escapeTs(field)}']"${this.changeBinding(node)}>\n${optionLines.join('\n')}\n${pad(depth + 1)}</select>`,
        ];
        return `${pad(depth)}<div${cls}>\n${lines.join('\n')}\n${pad(depth)}</div>`;
      }

      case 'checkbox': {
        this.needsForms = true;
        const field = this.modelField(node, node.props['checked'] === true ? 'true' : 'false');
        const lines = [
          `${pad(depth + 1)}<input class="as-checkbox-input" type="checkbox" name="${escapeAttr(field)}" [(ngModel)]="model['${escapeTs(
            field,
          )}']"${this.changeBinding(node)} />`,
          `${pad(depth + 1)}<span class="as-checkbox-label">${this.text(node, 'label', 'Checkbox')}</span>`,
        ];
        return `${pad(depth)}<label${cls}>\n${lines.join('\n')}\n${pad(depth)}</label>`;
      }

      case 'switch': {
        this.needsForms = true;
        const field = this.modelField(node, node.props['checked'] === true ? 'true' : 'false');
        const lines = [
          `${pad(depth + 1)}<button class="as-switch-track" type="button" role="switch" [attr.aria-checked]="model['${escapeTs(
            field,
          )}'] ? 'true' : 'false'" (click)="model['${escapeTs(field)}'] = !model['${escapeTs(field)}']"${this.changeBinding(node)}>`,
          `${pad(depth + 2)}<span class="as-switch-thumb"></span>`,
          `${pad(depth + 1)}</button>`,
          `${pad(depth + 1)}<span class="as-checkbox-label">${this.text(node, 'label', 'Switch')}</span>`,
        ];
        return `${pad(depth)}<label${cls}>\n${lines.join('\n')}\n${pad(depth)}</label>`;
      }

      case 'image':
        return `${pad(depth)}<img${cls}${this.attr(node, 'src', 'src')}${this.attr(node, 'alt', 'alt')} loading="lazy" />`;

      case 'avatar': {
        const src = String(node.props['src'] ?? '');
        if (src) {
          const lines = [
            `${pad(depth + 1)}<img class="as-avatar-image"${this.attr(node, 'src', 'src')}${this.attr(
              node,
              'initials',
              'alt',
            )} style="width:100%;height:100%;object-fit:cover" />`,
          ];
          return `${pad(depth)}<span${cls}>\n${lines.join('\n')}\n${pad(depth)}</span>`;
        }
        return `${pad(depth)}<span${cls}>${this.text(node, 'initials', 'AS')}</span>`;
      }

      case 'progress': {
        const max = Math.max(1, Number(node.props['max'] ?? 100) || 100);
        const value = Math.max(0, Number(node.props['value'] ?? 0) || 0);
        const percent = Math.round((value / max) * 100);
        const lines = [
          ...(node.props['showLabel'] === true ? [`${pad(depth + 1)}<span class="as-progress-label">${percent}%</span>`] : []),
          `${pad(depth + 1)}<div class="as-progress-track" role="progressbar" aria-valuenow="${value}" aria-valuemax="${max}">`,
          `${pad(depth + 2)}<div class="as-progress-fill" style="width:${percent}%"></div>`,
          `${pad(depth + 1)}</div>`,
        ];
        return `${pad(depth)}<div${cls}>\n${lines.join('\n')}\n${pad(depth)}</div>`;
      }

      case 'video':
        return `${pad(depth)}<video${cls}${this.attr(node, 'src', 'src')}${this.attr(node, 'poster', 'poster')}${this.boolAttr(
          node,
          'controls',
          'controls',
        )}${this.boolAttr(node, 'autoplay', 'autoplay')} playsinline></video>`;

      case 'navbar': {
        // `children` is already rendered at depth + 1; re-indent rather than emit twice.
        const links = children.trim().length > 0 ? indent(children, 2) : '';
        const lines = [
          `${pad(depth + 1)}<span class="as-navbar-brand">${this.text(node, 'brand', 'My App')}</span>`,
          links.trim().length > 0
            ? `${pad(depth + 1)}<nav class="as-navbar-links">\n${links}\n${pad(depth + 1)}</nav>`
            : `${pad(depth + 1)}<nav class="as-navbar-links"></nav>`,
        ];
        return `${pad(depth)}<header${cls}>\n${lines.join('\n')}\n${pad(depth)}</header>`;
      }

      default:
        return wrap(`<div${cls}>`, '</div>', children);
    }
  }
}

export function emitTemplate(
  plan: ComponentPlan,
  byNodeId: Map<string, ComponentPlan>,
  byComponentId: Map<string, ComponentPlan> = new Map(),
): TemplateResult {
  return new TemplateEmitter(plan, byNodeId, byComponentId).emit();
}

/** Attributes used when a parent renders a child component. */
export function childAttributes(plan: ComponentPlan): string {
  return plan.inputs
    .map((input) => {
      const value = String(input.value);
      if (input.type === 'string' && hasBinding(value)) {
        return ` [${input.name}]="${bindingExpression(value)}"`;
      }
      return input.type === 'string' ? ` ${input.name}="${escapeAttr(value)}"` : ` [${input.name}]="${input.value}"`;
    })
    .join('');
}
