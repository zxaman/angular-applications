import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { AppNode } from '@appstudio/schema';
import { getWidgetOrFallback } from '@appstudio/widgets';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';

/** One row of the outline tree. Recurses into itself for children. */
@Component({
  selector: 'studio-layer-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent, LayerRowComponent],
  template: `
    <div
      class="row"
      [class.selected]="selected()"
      [class.is-component]="isComponent()"
      [style.padding-left.px]="8 + depth() * 12"
      (click)="select()"
      role="treeitem"
      [attr.aria-selected]="selected()"
    >
      @if (node().children.length > 0) {
        <button type="button" class="twisty" (click)="toggle($event)" [attr.aria-label]="expanded() ? 'Collapse' : 'Expand'">
          <ui-icon name="chevron-down" [size]="12" [class.rotated]="!expanded()" />
        </button>
      } @else {
        <span class="twisty placeholder"></span>
      }
      <ui-icon [name]="icon()" [size]="14" />
      <span class="label">{{ label() }}</span>
      @if (isComponent()) {
        <span class="tag">C</span>
      }
      @if (node().css) {
        <span class="tag css" title="Has an imported stylesheet">CSS</span>
      }
      <span class="spacer"></span>
      <span class="type">{{ node().type }}</span>
    </div>
    @if (expanded()) {
      @for (child of node().children; track child.id) {
        <studio-layer-row [node]="child" [depth]="depth() + 1" />
      }
    }
  `,
  styles: [
    `
      .row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        color: var(--text-soft);
        font-size: 12px;
        min-width: 0;
      }
      .row:hover {
        background: var(--panel-2);
      }
      .row.selected {
        background: var(--accent-soft);
        color: #fff;
      }
      .row.is-component .label {
        font-weight: 600;
      }
      .twisty {
        display: inline-flex;
        width: 14px;
        height: 14px;
        align-items: center;
        justify-content: center;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        padding: 0;
      }
      .twisty.placeholder {
        cursor: default;
      }
      .rotated {
        transform: rotate(-90deg);
      }
      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .type {
        font-size: 10px;
        color: var(--muted);
        flex: 0 0 auto;
      }
      .spacer {
        flex: 1 1 auto;
      }
      .tag {
        font-size: 9px;
        font-weight: 700;
        padding: 1px 4px;
        border-radius: 3px;
        background: var(--accent-soft);
        color: #b6b9ff;
      }
      .tag.css {
        background: rgba(34, 211, 238, 0.16);
        color: #7dd3fc;
      }
    `,
  ],
})
export class LayerRowComponent {
  readonly node = input.required<AppNode>();
  readonly depth = input(0);

  private readonly state = inject(BuilderStateService);
  protected readonly expanded = signal(this.depth() < 3);

  protected readonly selected = computed(() => this.state.selectedId() === this.node().id);
  protected readonly isComponent = computed(() => Boolean(this.node().componentName));
  protected readonly label = computed(() => {
    const node = this.node();
    return node.componentName?.trim() || node.name?.trim() || getWidgetOrFallback(node.type).label;
  });
  protected readonly icon = computed(() => getWidgetOrFallback(this.node().type).icon);

  protected select(): void {
    this.state.select(this.node().id);
  }

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.expanded.update((value) => !value);
  }
}
