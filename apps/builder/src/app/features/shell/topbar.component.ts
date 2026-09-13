import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TEMPLATES } from '@appstudio/widgets';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';
import { PersistenceService } from '../../core/persistence.service';

/** Application chrome: project identity, history, project import/export. */
@Component({
  selector: 'studio-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, UiIconComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  protected readonly state = inject(BuilderStateService);
  private readonly persistence = inject(PersistenceService);

  readonly openExport = output<void>();
  readonly toggleLeft = output<void>();
  readonly toggleRight = output<void>();

  protected readonly templates = TEMPLATES;

  protected save(): void {
    this.persistence.saveNow();
  }

  protected downloadProject(): void {
    this.persistence.downloadProject();
  }

  protected async importProject(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (file) {
      await this.persistence.importProject(file);
    }
  }

  protected newProject(templateId: string): void {
    const template = TEMPLATES.find((entry) => entry.id === templateId);
    if (!template) {
      return;
    }
    const name = this.state.document().meta.name || 'New Project';
    this.state.newProject(name, template.build);
  }

  protected undo(): void {
    this.state.undo();
  }

  protected redo(): void {
    this.state.redo();
  }
}
