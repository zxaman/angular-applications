import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BREAKPOINTS, getBreakpoint, type Breakpoint } from '@appstudio/schema';
import { baseCss, getWidgetOrFallback, themeCss } from '@appstudio/widgets';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';
import type { DragPayload } from '../../core/dnd';
import { NodeViewComponent, type DropEvent } from './node-view.component';

/**
 * The design surface: a device sized frame that renders the active page with the
 * exact stylesheet the exported app will ship.
 */
@Component({
  selector: 'studio-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiIconComponent, NodeViewComponent],
  templateUrl: './canvas.component.html',
  styleUrl: './canvas.component.scss',
})
export class CanvasComponent implements OnDestroy {
  protected readonly state = inject(BuilderStateService);
  protected readonly breakpoints = BREAKPOINTS;

  @ViewChild('rootView') private readonly rootView?: NodeViewComponent;
  @ViewChild('scroller') private readonly scroller?: ElementRef<HTMLElement>;

  private styleElement: HTMLStyleElement | null = null;

  protected readonly dragging = signal(false);
  protected readonly page = this.state.activePage;
  protected readonly breakpoint = this.state.breakpoint;
  protected readonly zoom = this.state.zoom;
  protected readonly preview = this.state.preview;

  protected readonly frameWidth = computed(() => getBreakpoint(this.breakpoint()).canvasWidth);

  /** Breadcrumb of the selected node, outermost first. */
  protected readonly path = computed(() => {
    const selection = this.state.selection();
    if (!selection) {
      return [];
    }
    return [...selection.path, selection.node].map((node) => ({
      id: node.id,
      label: node.name?.trim() || getWidgetOrFallback(node.type).label,
      type: node.type,
    }));
  });

  constructor() {
    // Keep the canvas stylesheet in sync with the theme, exactly like the export does.
    effect(() => {
      const theme = this.state.document().theme;
      this.writeRuntimeCss(`${themeCss(theme, '.as-root')}\n\n${baseCss()}`);
    });
  }

  ngOnDestroy(): void {
    this.styleElement?.remove();
    this.styleElement = null;
  }

  private writeRuntimeCss(css: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.setAttribute('data-appstudio', 'canvas-runtime');
      document.head.appendChild(this.styleElement);
    }
    this.styleElement.textContent = css;
  }

  // ------------------------------------------------------------------ actions

  protected setBreakpoint(breakpoint: Breakpoint): void {
    this.state.setBreakpoint(breakpoint);
  }

  protected zoomBy(delta: number): void {
    this.state.setZoom(this.zoom() + delta);
  }

  protected togglePreview(): void {
    this.state.setPreview(!this.preview());
  }

  protected onSelect(id: string): void {
    this.state.select(id);
  }

  protected onCanvasClick(): void {
    if (!this.preview()) {
      this.state.select(null);
    }
  }

  protected onDrop(event: DropEvent): void {
    const payload: DragPayload = event.payload;
    if (payload.kind === 'new') {
      this.state.insertWidget(payload.type, event.parentId, event.index);
    } else {
      this.state.moveNode(payload.id, event.parentId, event.index);
    }
    this.rootView?.clearHints();
  }

  protected onDragStart(): void {
    this.dragging.set(true);
  }

  protected onDragEnd(): void {
    this.dragging.set(false);
    this.rootView?.clearHints();
  }

  protected addWidgetToPage(type: string): void {
    const page = this.page();
    if (page) {
      this.state.addWidget(type, page.root.id, -1);
    }
  }

  protected deleteSelected(): void {
    this.state.deleteSelected();
  }

  protected duplicateSelected(): void {
    this.state.duplicateSelected();
  }

  protected wrapSelected(): void {
    this.state.wrapSelected();
  }

  protected scrollToTop(): void {
    this.scroller?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
