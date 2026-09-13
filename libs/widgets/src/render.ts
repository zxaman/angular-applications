import type { AppNode, CssMap } from '@appstudio/schema';
import { getWidgetOrFallback } from './catalog';
import { iconSvg } from './icons';
import { asBoolean, asNumber, asString, parseList, parseSelectOptions } from './props';
import type { RenderPlan } from './types';

/** Stable, css-safe suffix derived from the node id. */
export function shortId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toLowerCase() || 'node';
}

/** Classes every instance of this node carries. */
export function nodeClasses(node: AppNode): string[] {
  const widget = getWidgetOrFallback(node.type);
  const classes = [`as-${node.type}`, `${node.type}-${shortId(node.id)}`];
  if (widget.classNames) {
    classes.push(...widget.classNames);
  }
  return classes;
}

/** Modifier classes derived from properties (`is-primary`, `is-lg`, …). */
export function modifierClasses(node: AppNode): string[] {
  const props = node.props;
  switch (node.type) {
    case 'button':
      return [`is-${asString(props['variant'], 'primary')}`, `is-${asString(props['size'], 'md')}`, asBoolean(props['fullWidth'], false) ? 'is-full' : ''].filter(
        Boolean,
      ) as string[];
    case 'badge':
    case 'alert':
      return [`is-${asString(props['variant'], 'solid')}`];
    case 'divider':
      return asString(props['orientation'], 'horizontal') === 'vertical' ? ['is-vertical'] : [];
    case 'card':
      return asBoolean(props['elevated'], true) ? ['is-elevated'] : [];
    case 'navbar':
      return asBoolean(props['sticky'], true) ? ['is-sticky'] : [];
    case 'checkbox':
    case 'switch':
      return asBoolean(props['checked'], false) ? ['is-on'] : [];
    case 'list':
      return asBoolean(props['ordered'], false) ? ['is-ordered'] : [];
    case 'avatar':
      return asString(props['shape'], 'circle') === 'square' ? ['is-square'] : [];
    case 'row':
      return asBoolean(props['wrap'], true) ? ['is-wrap'] : [];
    default:
      return [];
  }
}

/** All classes for a node, in the order they should appear in markup. */
export function allClasses(node: AppNode): string[] {
  return [...nodeClasses(node), ...modifierClasses(node)];
}

const VOID_TAGS = new Set(['img', 'input', 'hr', 'video', 'source', 'br']);

function element(
  node: AppNode,
  tag: string,
  options: {
    classes?: string[];
    attrs?: Record<string, string>;
    text?: string;
    html?: string;
    children?: RenderPlan[];
  } = {},
): RenderPlan {
  const classes = options.classes ?? allClasses(node);
  return {
    tag,
    attrs: options.attrs ?? {},
    classes,
    text: options.text,
    html: options.html,
    children: options.children,
    void: VOID_TAGS.has(tag) || undefined,
    node,
  };
}

function childElement(
  node: AppNode,
  tag: string,
  className: string,
  options: { text?: string; attrs?: Record<string, string>; children?: RenderPlan[]; html?: string } = {},
): RenderPlan {
  return element(node, tag, {
    classes: className.split(' '),
    attrs: options.attrs,
    text: options.text,
    html: options.html,
    children: options.children,
  });
}

/**
 * Turn a node (and its subtree) into a tag level description.
 *
 * Both the live canvas and the Angular code generator consume this, which is why
 * the exported HTML always matches what was designed.
 */
export function renderPlan(node: AppNode): RenderPlan {
  const props = node.props;
  const children = node.children.map(renderPlan);

  switch (node.type) {
    case 'container':
      return element(node, asString(props['tag'], 'div'), { children });

    case 'row':
    case 'column':
    case 'grid':
    case 'stack':
      return element(node, 'div', { children });

    case 'card': {
      const header: RenderPlan[] = [];
      const title = asString(props['title'], '');
      const subtitle = asString(props['subtitle'], '');
      if (title || subtitle) {
        header.push(
          childElement(node, 'div', 'as-card-header', {
            children: [
              ...(title ? [childElement(node, 'h3', 'as-card-title', { text: title })] : []),
              ...(subtitle ? [childElement(node, 'p', 'as-card-subtitle', { text: subtitle })] : []),
            ],
          }),
        );
      }
      return element(node, 'div', { children: [...header, ...children] });
    }

    case 'divider':
      return element(node, 'hr');

    case 'spacer':
      return element(node, 'div', { attrs: { 'aria-hidden': 'true' } });

    case 'form':
      return element(node, 'form', {
        attrs: { 'data-as-form': 'true' },
        children: [
          ...children,
          element(node, 'button', {
            classes: ['as-button', 'is-primary', 'is-md'],
            attrs: { type: 'submit' },
            text: asString(props['submitLabel'], 'Submit'),
          }),
        ],
      });

    case 'heading':
      return element(node, asString(props['level'], 'h2'), { text: asString(props['text'], 'Heading') });

    case 'text':
      return element(node, 'p', { text: asString(props['text'], '') });

    case 'badge':
      return element(node, 'span', { text: asString(props['text'], '') });

    case 'alert':
      return element(node, 'div', {
        attrs: { role: 'alert' },
        children: [
          ...(asString(props['title'], '') ? [childElement(node, 'strong', 'as-alert-title', { text: asString(props['title'], '') })] : []),
          childElement(node, 'span', 'as-alert-text', { text: asString(props['text'], '') }),
        ],
      });

    case 'icon': {
      const size = Math.max(8, asNumber(props['size'], 24));
      return element(node, 'span', {
        html: iconSvg(asString(props['name'], 'star'), size),
        attrs: { role: 'img', 'aria-label': asString(props['name'], 'icon') },
      });
    }

    case 'link':
      return element(node, 'a', {
        text: asString(props['label'], 'Link'),
        attrs: {
          href: asString(props['href'], '#'),
          ...(asBoolean(props['openInNewTab'], false) ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        },
      });

    case 'list': {
      const ordered = asBoolean(props['ordered'], false);
      const items = parseList(props['items']);
      return element(node, ordered ? 'ol' : 'ul', {
        children: (items.length > 0 ? items : ['Empty list']).map((item) => childElement(node, 'li', 'as-list-item', { text: item })),
      });
    }

    case 'breadcrumb': {
      const crumbs = parseSelectOptions(props['items']);
      return element(node, 'nav', {
        attrs: { 'aria-label': 'Breadcrumb' },
        children: [
          childElement(node, 'ol', 'as-breadcrumb', {
            children: crumbs.map((crumb) =>
              childElement(node, 'li', 'as-breadcrumb-item', {
                children: [
                  childElement(node, 'a', 'as-breadcrumb-link', {
                    text: crumb.label,
                    attrs: { href: crumb.value || '/' },
                  }),
                ],
              }),
            ),
          }),
        ],
      });
    }

    case 'button':
      return element(node, 'button', {
        text: asString(props['label'], 'Button'),
        attrs: { type: asString(props['buttonType'], 'button') },
      });

    case 'text-input':
      return fieldWrapper(node, [
        fieldLabel(node),
        element(node, 'input', {
          classes: [...nodeClasses(node), 'as-control'],
          attrs: {
            type: asString(props['inputType'], 'text'),
            placeholder: asString(props['placeholder'], ''),
            name: asString(props['name'], ''),
            ...(asBoolean(props['required'], false) ? { required: 'true' } : {}),
          },
        }),
        ...fieldHelper(node),
      ]);

    case 'textarea':
      return fieldWrapper(node, [
        fieldLabel(node),
        element(node, 'textarea', {
          classes: [...nodeClasses(node), 'as-control'],
          attrs: {
            placeholder: asString(props['placeholder'], ''),
            name: asString(props['name'], ''),
            rows: String(asNumber(props['rows'], 4)),
            ...(asBoolean(props['required'], false) ? { required: 'true' } : {}),
          },
        }),
        ...fieldHelper(node),
      ]);

    case 'select': {
      const options = parseSelectOptions(props['options']);
      return fieldWrapper(node, [
        fieldLabel(node),
        element(node, 'select', {
          classes: [...nodeClasses(node), 'as-control'],
          attrs: {
            name: asString(props['name'], ''),
            ...(asBoolean(props['required'], false) ? { required: 'true' } : {}),
          },
          children: [
            childElement(node, 'option', 'as-option', {
              text: asString(props['placeholder'], 'Select…'),
              attrs: { value: '' },
            }),
            ...options.map((option) =>
              childElement(node, 'option', 'as-option', { text: option.label, attrs: { value: option.value } }),
            ),
          ],
        }),
        ...fieldHelper(node),
      ]);
    }

    case 'checkbox':
      return element(node, 'label', {
        children: [
          childElement(node, 'input', 'as-checkbox-input', {
            attrs: {
              type: 'checkbox',
              name: asString(props['name'], ''),
              ...(asBoolean(props['checked'], false) ? { checked: 'true' } : {}),
            },
          }),
          childElement(node, 'span', 'as-checkbox-label', { text: asString(props['label'], 'Checkbox') }),
        ],
      });

    case 'switch':
      return element(node, 'label', {
        children: [
          childElement(node, 'button', 'as-switch-track', {
            attrs: { type: 'button', role: 'switch', 'aria-checked': asBoolean(props['checked'], false) ? 'true' : 'false' },
            children: [childElement(node, 'span', 'as-switch-thumb')],
          }),
          childElement(node, 'span', 'as-checkbox-label', { text: asString(props['label'], 'Switch') }),
        ],
      });

    case 'image':
      return element(node, 'img', {
        attrs: {
          src: asString(props['src'], ''),
          alt: asString(props['alt'], ''),
          loading: 'lazy',
        },
      });

    case 'avatar': {
      const src = asString(props['src'], '');
      if (src) {
        return element(node, 'span', {
          children: [
            childElement(node, 'img', 'as-avatar-image', {
              attrs: { src, alt: asString(props['initials'], 'avatar'), style: 'width:100%;height:100%;object-fit:cover' },
            }),
          ],
        });
      }
      return element(node, 'span', { text: asString(props['initials'], 'AS') });
    }

    case 'progress': {
      const max = Math.max(1, asNumber(props['max'], 100));
      const value = Math.max(0, asNumber(props['value'], 0));
      const percent = Math.round((value / max) * 100);
      return element(node, 'div', {
        children: [
          ...(asBoolean(props['showLabel'], true)
            ? [childElement(node, 'span', 'as-progress-label', { text: `${percent}%` })]
            : []),
          childElement(node, 'div', 'as-progress-track', {
            attrs: { role: 'progressbar', 'aria-valuenow': String(value), 'aria-valuemax': String(max) },
            children: [childElement(node, 'div', 'as-progress-fill', { attrs: { style: `width:${percent}%` } })],
          }),
        ],
      });
    }

    case 'video':
      return element(node, 'video', {
        attrs: {
          src: asString(props['src'], ''),
          ...(asString(props['poster'], '') ? { poster: asString(props['poster'], '') } : {}),
          ...(asBoolean(props['controls'], true) ? { controls: 'true' } : {}),
          ...(asBoolean(props['autoplay'], false) ? { autoplay: 'true', muted: 'true' } : {}),
          playsinline: 'true',
        },
      });

    case 'navbar':
      return element(node, 'header', {
        children: [
          childElement(node, 'span', 'as-navbar-brand', { text: asString(props['brand'], 'My App') }),
          childElement(node, 'nav', 'as-navbar-links', { children }),
        ],
      });

    default:
      return element(node, 'div', { children });
  }
}

function fieldWrapper(node: AppNode, children: RenderPlan[]): RenderPlan {
  return element(node, 'div', { children });
}

function fieldLabel(node: AppNode): RenderPlan {
  const required = asBoolean(node.props['required'], false);
  return childElement(node, 'label', 'as-label', {
    children: [
      childElement(node, 'span', 'as-label-text', { text: asString(node.props['label'], 'Label') }),
      ...(required ? [childElement(node, 'span', 'as-required', { text: '*' })] : []),
    ],
  });
}

function fieldHelper(node: AppNode): RenderPlan[] {
  const helper = asString(node.props['helper'], '');
  return helper ? [childElement(node, 'span', 'as-helper', { text: helper })] : [];
}

/** Merge derived styles with the node's own styles (own styles win). */
export function effectiveStyle(node: AppNode, derived: CssMap = {}): CssMap {
  return { ...derived, ...node.style };
}
