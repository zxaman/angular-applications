import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from './core/builder-state.service';
import { PersistenceService } from './core/persistence.service';
import { CanvasComponent } from './features/canvas/canvas.component';
import { ExportPanelComponent } from './features/export/export-panel.component';
import { InspectorComponent } from './features/inspector/inspector.component';
import { LayersPanelComponent } from './features/panels/layers-panel.component';
import { PagesPanelComponent } from './features/panels/pages-panel.component';
import { ThemePanelComponent } from './features/panels/theme-panel.component';
import { WidgetsPanelComponent } from './features/panels/widgets-panel.component';
import { StatusbarComponent } from './features/shell/statusbar.component';
import { TopbarComponent } from './features/shell/topbar.component';

/**
 * Studio shell.
 *
 * Three columns on desktop (library · canvas · inspector). Below 1280px the side
 * panels slide over the canvas so the same app works on a tablet or a narrow
 * browser window without a separate mobile build.
 */
@Component({
  selector: 'studio-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiIconComponent,
    TopbarComponent,
    StatusbarComponent,
    CanvasComponent,
    WidgetsPanelComponent,
    LayersPanelComponent,
    PagesPanelComponent,
    ThemePanelComponent,
    InspectorComponent,
    ExportPanelComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly state = inject(BuilderStateService);
  private readonly persistence = inject(PersistenceService);

  protected readonly exportOpen = signal(false);

  constructor() {
    this.persistence.ensureStarted();
    this.syncPanelsToViewport();
  }

  /** On narrow viewports the side panels overlay the canvas, so start with them closed. */
  private syncPanelsToViewport(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const narrow = window.matchMedia('(max-width: 1280px)');
    const apply = (matches: boolean): void => {
      this.state.leftOpen.set(!matches);
      this.state.rightOpen.set(!matches);
    };
    apply(narrow.matches);
    narrow.addEventListener('change', (event) => apply(event.matches));
  }

  protected openExport(): void {
    this.exportOpen.set(true);
  }

  protected closeExport(): void {
    this.exportOpen.set(false);
  }

  @HostListener('window:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing =
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    const meta = event.ctrlKey || event.metaKey;

    if (meta && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.persistence.saveNow();
      return;
    }
    if (meta && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      this.exportOpen.update((open) => !open);
      return;
    }
    if (meta && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.state.redo();
      } else {
        this.state.undo();
      }
      return;
    }
    if (meta && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.state.redo();
      return;
    }
    if (typing) {
      return;
    }
    if (meta && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      this.state.duplicateSelected();
      return;
    }
    if (event.key === 'Escape') {
      if (this.exportOpen()) {
        this.closeExport();
      } else if (this.state.preview()) {
        this.state.setPreview(false);
      } else {
        this.state.select(null);
      }
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.state.deleteSelected();
      return;
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.state.moveSelected(event.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (event.key === 'ArrowUp') {
        this.state.selectParent();
      } else if (event.key === 'ArrowDown') {
        this.state.selectFirstChild();
      } else {
        this.state.selectSibling(event.key === 'ArrowRight' ? 1 : -1);
      }
    }
  }
}
