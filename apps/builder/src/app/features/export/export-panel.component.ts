import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { validateDocument } from '@appstudio/schema';
import { WIDGET_TYPES } from '@appstudio/widgets';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';
import { ExportService, type ExportSettings } from '../../core/export.service';
import type { GeneratedFile } from '@appstudio/generator';

interface FileGroup {
  folder: string;
  files: GeneratedFile[];
}

/**
 * Export drawer: chooses how the project is split into components, previews the
 * generated file tree and downloads the archive.
 */
@Component({
  selector: 'studio-export-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiIconComponent],
  templateUrl: './export-panel.component.html',
  styleUrl: './export-panel.component.scss',
})
export class ExportPanelComponent {
  protected readonly state = inject(BuilderStateService);
  protected readonly export = inject(ExportService);

  readonly close = output<void>();

  protected readonly openFile = signal<GeneratedFile | null>(null);
  protected readonly filter = signal('');

  protected readonly settings = this.export.settings;
  protected readonly result = this.export.result;
  protected readonly stats = computed(() => this.result().stats);
  protected readonly warnings = computed(() => this.result().warnings);

  protected readonly issues = computed(() => validateDocument(this.state.document(), WIDGET_TYPES));

  protected readonly groups = computed<FileGroup[]>(() => {
    const needle = this.filter().trim().toLowerCase();
    const files = this.result().files.filter((file) => !needle || file.path.toLowerCase().includes(needle));
    const map = new Map<string, GeneratedFile[]>();
    for (const file of files) {
      const index = file.path.lastIndexOf('/');
      const folder = index > 0 ? file.path.slice(0, index) : '';
      const bucket = map.get(folder) ?? [];
      bucket.push(file);
      map.set(folder, bucket);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folder, groupFiles]) => ({ folder: folder || 'project root', files: groupFiles }));
  });

  protected readonly granularities: { id: ExportSettings['granularity']; label: string; hint: string }[] = [
    { id: 'page', label: 'Per page', hint: 'One component per page, widgets inline.' },
    { id: 'component', label: 'Per component', hint: 'Pages plus widgets you marked "Extract as component".' },
    { id: 'widget', label: 'Per widget', hint: 'One component per widget instance. Maximum separation.' },
  ];

  constructor() {
    this.export.syncFromDocument();
  }

  protected update(patch: Partial<ExportSettings>): void {
    this.export.update(patch);
  }

  protected select(file: GeneratedFile): void {
    this.openFile.set(file);
  }

  protected closeFile(): void {
    this.openFile.set(null);
  }

  protected async download(): Promise<void> {
    await this.export.downloadZip();
  }

  protected async copyFile(): Promise<void> {
    const file = this.openFile();
    if (file) {
      await this.export.copyFile(file.contents);
    }
  }

  protected lines(file: GeneratedFile): number {
    return file.contents.split('\n').length;
  }

  /** Preview URL for a binary asset. */
  protected dataUrl(file: GeneratedFile): string {
    const type = file.path.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    return `data:${type};base64,${file.contents}`;
  }

  protected bytes(file: GeneratedFile): string {
    const size = Math.round((file.contents.length * 3) / 4);
    return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} kB`;
  }
}
