import { Injectable, computed, inject, signal } from '@angular/core';
import JSZip from 'jszip';
import { generateProject, type GenerateOptions, type GenerateResult } from '@appstudio/generator';
import { BuilderStateService } from './builder-state.service';
import { downloadBlob } from './dnd';

export interface ExportSettings {
  projectName: string;
  prefix: string;
  granularity: NonNullable<GenerateOptions['granularity']>;
  includeCapacitor: boolean;
  includeTests: boolean;
}

/**
 * Runs the generator and packages the result.
 *
 * Generation is pure and synchronous, so the export panel can re-render the file
 * tree on every keystroke; only the zip step is async.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly state = inject(BuilderStateService);

  readonly settings = signal<ExportSettings>({
    projectName: 'my-app',
    prefix: 'app',
    granularity: 'component',
    includeCapacitor: false,
    includeTests: true,
  });

  readonly busy = signal(false);

  /** Re-runs whenever the document or the export options change. */
  readonly result = computed<GenerateResult>(() => {
    const doc = this.state.document();
    const options = this.settings();
    return generateProject(doc, {
      projectName: options.projectName,
      prefix: options.prefix,
      granularity: options.granularity,
      includeCapacitor: options.includeCapacitor,
      includeTests: options.includeTests,
    });
  });

  update(patch: Partial<ExportSettings>): void {
    this.settings.update((current) => ({ ...current, ...patch }));
  }

  /** Seeds the panel from the document the first time it is opened. */
  syncFromDocument(): void {
    const doc = this.state.document();
    const slug = doc.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-app';
    this.update({ projectName: slug, prefix: doc.settings.prefix, includeCapacitor: doc.settings.includeCapacitor });
  }

  async downloadZip(): Promise<void> {
    const { files } = this.result();
    const projectName = this.settings().projectName || 'my-app';
    this.busy.set(true);
    try {
      const zip = new JSZip();
      const root = zip.folder(projectName);
      if (!root) {
        throw new Error('Could not create the archive root folder');
      }
      for (const file of files) {
        root.file(file.path, file.contents);
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      downloadBlob(blob, `${projectName}.zip`);
      this.state.notify(`Exported ${files.length} files`);
    } catch (error) {
      console.error(error);
      this.state.notify('Export failed — see the console for details.', 'error');
    } finally {
      this.busy.set(false);
    }
  }

  async copyFile(contents: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(contents);
      this.state.notify('Copied to clipboard');
    } catch {
      this.state.notify('Clipboard is not available in this context.', 'error');
    }
  }

  async copyAll(): Promise<void> {
    const { files } = this.result();
    const text = files.map((file) => `// ===== ${file.path} =====\n${file.contents}`).join('\n');
    await this.copyFile(text);
  }
}
