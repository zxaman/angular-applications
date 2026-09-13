import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { countInstances, type ComponentDef } from '@appstudio/schema';
import { getWidgetOrFallback, groupedCatalog, searchCatalog, type WidgetDefinition } from '@appstudio/widgets';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';
import { DND_MIME, encodePayload } from '../../core/dnd';

/** Widget library: drag onto the canvas, or click to append to the selection. */
@Component({
  selector: 'studio-widgets-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiIconComponent],
  templateUrl: './widgets-panel.component.html',
  styleUrl: './widgets-panel.component.scss',
})
export class WidgetsPanelComponent {
  protected readonly state = inject(BuilderStateService);

  protected readonly query = signal('');
  protected readonly groups = groupedCatalog();

  /** Reusable components the user has saved. */
  protected readonly components = this.state.components;

  protected usages(component: ComponentDef): number {
    return countInstances(this.state.document(), component.id);
  }

  protected readonly results = computed(() => {
    const needle = this.query();
    return needle.trim() ? searchCatalog(needle) : null;
  });

  protected onDragStart(event: DragEvent, widget: WidgetDefinition): void {
    if (!event.dataTransfer) {
      return;
    }
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(DND_MIME, encodePayload({ kind: 'new', type: widget.type }));
    event.dataTransfer.setData('text/plain', widget.type);
  }

  protected onComponentDragStart(event: DragEvent, component: ComponentDef): void {
    if (!event.dataTransfer) {
      return;
    }
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(DND_MIME, encodePayload({ kind: 'component', componentId: component.id }));
    event.dataTransfer.setData('text/plain', component.name);
  }

  /** Click = append to the selected container, otherwise to the page root. */
  protected add(widget: WidgetDefinition): void {
    const target = this.dropTarget();
    if (!target) {
      this.state.notify('Add a page first.', 'error');
      return;
    }
    this.state.addWidget(widget.type, target, -1);
  }

  protected addComponent(component: ComponentDef): void {
    const target = this.dropTarget();
    if (!target) {
      this.state.notify('Add a page first.', 'error');
      return;
    }
    this.state.insertComponentInstance(component.id, target, -1);
  }

  private dropTarget(): string | null {
    const selection = this.state.selection();
    return selection && getWidgetOrFallback(selection.node.type).isContainer
      ? selection.node.id
      : (this.state.activeRoot()?.id ?? null);
  }
}
