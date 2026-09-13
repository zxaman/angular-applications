import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from './core/builder-state.service';
import { PersistenceService } from './core/persistence.service';
import { CanvasComponent } from './features/canvas/canvas.component';
import { DataPanelComponent } from './features/panels/data-panel.component';
import { ExportPanelComponent } from './features/export/export-panel.component';
import { InspectorComponent } from './features/inspector/inspector.component';
import { LayersPanelComponent } from './features/panels/layers-panel.component';
import { PagesPanelComponent } from './features/panels/pages-panel.component';
import { SettingsPanelComponent } from './features/panels/settings-panel.component';
import { ValidationPanelComponent } from './features/panels/validation-panel.component';
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
    DataPanelComponent,
    WidgetsPanelComponent,
    LayersPanelComponent,
    PagesPanelComponent,
    SettingsPanelComponent,
    ThemePanelComponent,
    ValidationPanelComponent,
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
  protected readonly shortcutsOpen = signal(false);

  protected readonly shortcuts: { keys: string[]; label: string }[] = [
    { keys: ['Ctrl', 'S'], label: 'Save to this browser' },
    { keys: ['Ctrl', 'E'], label: 'Open the export drawer' },
    { keys: ['Ctrl', 'Z'], label: 'Undo' },
    { keys: ['Ctrl', 'Y'], label: 'Redo' },
    { keys: ['Ctrl', 'D'], label: 'Duplicate the selection' },
    { keys: ['Ctrl', 'C'], label: 'Copy the selection' },
    { keys: ['Ctrl', 'X'], label: 'Cut the selection' },
    { keys: ['Ctrl', 'V'], label: 'Paste into the selection' },
    { keys: ['Del'], label: 'Delete the selection' },
    { keys: ['Alt', '↑ / ↓'], label: 'Move the selection up or down' },
    { keys: ['↑ ↓ ← →'], label: 'Walk the tree' },
    { keys: ['Esc'], label: 'Deselect / close overlays' },
    { keys: ['Ctrl', '/'], label: 'Show this list' },
  ];

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
    if (meta && event.key === '/') {
      event.preventDefault();
      this.shortcutsOpen.update((open) => !open);
      return;
    }
    if (meta && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      this.state.duplicateSelected();
      return;
    }
    if (meta && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      this.state.copySelected();
      return;
    }
    if (meta && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      this.state.cutSelected();
      return;
    }
    if (meta && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      this.state.paste();
      return;
    }
    if (event.key === 'Escape') {
      if (this.shortcutsOpen()) {
        this.shortcutsOpen.set(false);
      } else if (this.exportOpen()) {
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
