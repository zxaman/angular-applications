import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BREAKPOINTS, type Breakpoint, type CssMap } from '@appstudio/schema';
import type { PropSchema } from '@appstudio/widgets';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';
import { readTextFile } from '../../core/dnd';
import { nodeToHtml, nodeToScss } from '../../core/serialize';
import { PropFieldComponent } from './prop-field.component';

interface StyleField {
  prop: string;
  label: string;
  type: 'text' | 'select' | 'color';
  options?: string[];
  placeholder?: string;
}

interface StyleGroup {
  title: string;
  fields: StyleField[];
}

const STYLE_GROUPS: StyleGroup[] = [
  {
    title: 'Layout',
    fields: [
      { prop: 'display', label: 'Display', type: 'select', options: ['block', 'flex', 'inline-flex', 'grid', 'inline-block', 'none'] },
      { prop: 'flex-direction', label: 'Direction', type: 'select', options: ['row', 'row-reverse', 'column', 'column-reverse'] },
      { prop: 'flex-wrap', label: 'Wrap', type: 'select', options: ['nowrap', 'wrap', 'wrap-reverse'] },
      { prop: 'align-items', label: 'Align items', type: 'select', options: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'] },
      {
        prop: 'justify-content',
        label: 'Justify',
        type: 'select',
        options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
      },
      { prop: 'gap', label: 'Gap', type: 'text', placeholder: '12px' },
      { prop: 'grid-template-columns', label: 'Grid columns', type: 'text', placeholder: 'repeat(3, 1fr)' },
    ],
  },
  {
    title: 'Size',
    fields: [
      { prop: 'width', label: 'Width', type: 'text', placeholder: '100%' },
      { prop: 'max-width', label: 'Max width', type: 'text', placeholder: '720px' },
      { prop: 'height', label: 'Height', type: 'text', placeholder: 'auto' },
      { prop: 'min-height', label: 'Min height', type: 'text', placeholder: '120px' },
    ],
  },
  {
    title: 'Spacing',
    fields: [
      { prop: 'padding-top', label: 'Padding top', type: 'text', placeholder: '16px' },
      { prop: 'padding-right', label: 'Padding right', type: 'text', placeholder: '16px' },
      { prop: 'padding-bottom', label: 'Padding bottom', type: 'text', placeholder: '16px' },
      { prop: 'padding-left', label: 'Padding left', type: 'text', placeholder: '16px' },
      { prop: 'margin', label: 'Margin', type: 'text', placeholder: '0 auto' },
    ],
  },
  {
    title: 'Typography',
    fields: [
      { prop: 'font-size', label: 'Font size', type: 'text', placeholder: '15px' },
      { prop: 'font-weight', label: 'Weight', type: 'select', options: ['300', '400', '500', '600', '700', '800'] },
      { prop: 'line-height', label: 'Line height', type: 'text', placeholder: '1.6' },
      { prop: 'letter-spacing', label: 'Letter spacing', type: 'text', placeholder: '0.01em' },
      { prop: 'text-align', label: 'Align', type: 'select', options: ['left', 'center', 'right', 'justify'] },
      { prop: 'color', label: 'Colour', type: 'color' },
    ],
  },
  {
    title: 'Decoration',
    fields: [
      { prop: 'background', label: 'Background', type: 'text', placeholder: '#ffffff' },
      { prop: 'border', label: 'Border', type: 'text', placeholder: '1px solid #e5e7eb' },
      { prop: 'border-radius', label: 'Radius', type: 'text', placeholder: '10px' },
      { prop: 'box-shadow', label: 'Shadow', type: 'text', placeholder: '0 8px 24px rgba(0,0,0,.08)' },
      { prop: 'opacity', label: 'Opacity', type: 'text', placeholder: '1' },
    ],
  },
];

/** Right hand panel: widget properties, styles per breakpoint, custom CSS, code. */
@Component({
  selector: 'studio-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiIconComponent, PropFieldComponent],
  templateUrl: './inspector.component.html',
  styleUrl: './inspector.component.scss',
})
export class InspectorComponent {
  protected readonly state = inject(BuilderStateService);
  protected readonly breakpoints = BREAKPOINTS;
  protected readonly styleGroups = STYLE_GROUPS;

  protected readonly editingBreakpoint = signal<Breakpoint>('base');
  protected readonly customCss = signal('');
  protected readonly customCssName = signal<string | undefined>(undefined);

  protected readonly node = this.state.selectedNode;
  protected readonly widget = this.state.selectedWidget;

  protected readonly propGroups = computed(() => {
    const widget = this.widget();
    if (!widget) {
      return [];
    }
    const groups: { title: string; props: PropSchema[] }[] = [
      { title: 'Content', props: [] },
      { title: 'Appearance', props: [] },
      { title: 'Behaviour', props: [] },
    ];
    for (const prop of widget.propSchema) {
      const group = groups.find((entry) => entry.title.toLowerCase() === prop.group);
      (group ?? groups[0]).props.push(prop);
    }
    return groups.filter((group) => group.props.length > 0);
  });

  protected readonly overrideCount = computed(() => {
    const node = this.node();
    if (!node) {
      return 0;
    }
    return Object.values(node.styles ?? {}).reduce((total, styles) => total + Object.keys(styles ?? {}).length, 0);
  });

  protected readonly generatedHtml = computed(() => {
    const node = this.node();
    return node ? nodeToHtml(node) : '';
  });

  protected readonly generatedScss = computed(() => {
    const node = this.node();
    return node ? nodeToScss(node, this.editingBreakpoint()) : '';
  });

  /** Value of a CSS property at the breakpoint being edited. */
  protected styleValue(property: string): string {
    const node = this.node();
    if (!node) {
      return '';
    }
    const breakpoint = this.editingBreakpoint();
    if (breakpoint === 'base') {
      return node.style[property] ?? '';
    }
    return (node.styles?.[breakpoint] as CssMap | undefined)?.[property] ?? '';
  }

  protected hasOverride(property: string): boolean {
    const node = this.node();
    const breakpoint = this.editingBreakpoint();
    if (!node || breakpoint === 'base') {
      return false;
    }
    return Boolean((node.styles?.[breakpoint] as CssMap | undefined)?.[property]);
  }

  protected setStyle(property: string, value: string): void {
    this.state.setStyle(property, value, this.editingBreakpoint());
  }

  protected clearBreakpoint(): void {
    const node = this.node();
    const breakpoint = this.editingBreakpoint();
    if (!node || breakpoint === 'base') {
      return;
    }
    for (const property of Object.keys((node.styles?.[breakpoint] as CssMap | undefined) ?? {})) {
      this.state.setStyle(property, '', breakpoint);
    }
  }

  // ------------------------------------------------------------- custom CSS

  protected loadCustomCss(): void {
    const node = this.node();
    this.customCss.set(node?.css ?? '');
    this.customCssName.set(node?.cssFileName);
  }

  protected applyCustomCss(): void {
    this.state.setNodeCss(this.customCss(), this.customCssName());
    this.state.notify('Custom CSS applied to this widget');
  }

  protected async importCustomCss(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) {
      return;
    }
    const content = await readTextFile(file);
    this.customCss.set(content);
    this.customCssName.set(file.name);
    this.state.setNodeCss(content, file.name);
    this.state.notify(`Imported ${file.name} into this widget`);
  }

  protected clearCustomCss(): void {
    this.customCss.set('');
    this.customCssName.set(undefined);
    this.state.setNodeCss('', undefined);
  }

  // ------------------------------------------------------------------ misc

  protected selectBreakpoint(breakpoint: Breakpoint): void {
    this.editingBreakpoint.set(breakpoint);
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.state.notify('Copied to clipboard');
    } catch {
      this.state.notify('Clipboard is not available here.', 'error');
    }
  }

  protected trackProp = (index: number, prop: PropSchema): string => prop.key;

  constructor() {
    // Keep the CSS editor in sync with whichever widget is selected.
    effect(() => {
      const id = this.state.selectedId();
      untracked(() => {
        if (id) {
          this.loadCustomCss();
        } else {
          this.customCss.set('');
          this.customCssName.set(undefined);
        }
      });
    });
  }
}
