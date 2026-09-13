import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  private readonly state = inject(BuilderStateService);

  protected readonly query = signal('');
  protected readonly groups = groupedCatalog();

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

  /** Click = append to the selected container, otherwise to the page root. */
  protected add(widget: WidgetDefinition): void {
    const selection = this.state.selection();
    const target =
      selection && getWidgetOrFallback(selection.node.type).isContainer
        ? selection.node.id
        : (this.state.activePage()?.root.id ?? null);
    if (!target) {
      this.state.notify('Add a page first.', 'error');
      return;
    }
    this.state.addWidget(widget.type, target, -1);
  }
}
