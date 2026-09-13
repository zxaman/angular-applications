import { effect, inject, Injectable, untracked } from '@angular/core';
import { isAppDocument, migrateDocument, validateDocument, type AppDocument } from '@appstudio/schema';
import { landingTemplate, WIDGET_TYPES } from '@appstudio/widgets';
import { BuilderStateService } from './builder-state.service';
import { downloadBlob } from './dnd';

const STORAGE_KEY = 'appstudio.document.v1';
const AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * Autosaves to localStorage and handles project import/export.
 * The studio is a static site, so the browser is the only backend.
 */
@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private readonly state = inject(BuilderStateService);
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly available = typeof localStorage !== 'undefined';

  private started = false;

  constructor() {
    effect(() => {
      const doc = this.state.document();
      const dirty = this.state.dirty();
      untracked(() => {
        if (dirty) {
          this.schedule(doc);
        }
      });
    });
  }

  /**
   * Restores the last autosaved project, or starts from the landing template on a
   * first visit so the canvas is never empty.
   */
  ensureStarted(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    const stored = this.read();
    if (stored) {
      this.state.load(stored, { keepHistory: false, markDirty: false });
      this.state.markSaved();
      return;
    }
    this.state.load(landingTemplate('My Application'), { keepHistory: false, markDirty: false });
    this.state.markSaved();
  }

  hasStored(): boolean {
    return this.available && localStorage.getItem(STORAGE_KEY) !== null;
  }

  private schedule(doc: AppDocument): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.write(doc);
      this.state.markSaved();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  private read(): AppDocument | null {
    if (!this.available) {
      return null;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const { doc } = migrateDocument(JSON.parse(raw));
      return doc;
    } catch (error) {
      console.warn('Could not restore the saved project', error);
      return null;
    }
  }

  private write(doc: AppDocument): void {
    if (!this.available) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch (error) {
      console.warn('Autosave failed', error);
      this.state.notify('Autosave failed — storage may be full.', 'error');
    }
  }

  saveNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.write(this.state.document());
    this.state.markSaved();
    this.state.notify('Project saved to this browser');
  }

  clear(): void {
    if (this.available) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  downloadProject(): void {
    const doc = this.state.document();
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${doc.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project'}.appstudio.json`);
  }

  async importProject(file: File): Promise<void> {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.state.notify('That file is not valid JSON.', 'error');
      return;
    }
    if (!isAppDocument(parsed)) {
      this.state.notify('That file is not an AppStudio project.', 'error');
      return;
    }
    const { doc, migratedFrom } = migrateDocument(parsed);
    this.state.load(doc);
    this.state.notify(
      migratedFrom < doc.version ? `Imported and migrated from schema v${migratedFrom}` : `Imported ${doc.meta.name}`,
    );
    const errors = validateDocument(doc, WIDGET_TYPES).filter((issue) => issue.severity === 'error');
    if (errors.length > 0) {
      this.state.notify(`${errors.length} problem(s) in the imported project — see Export panel`, 'error');
    }
  }
}
