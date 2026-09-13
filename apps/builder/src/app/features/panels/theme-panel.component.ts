import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ThemeTokens } from '@appstudio/schema';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';
import { readTextFile } from '../../core/dnd';

interface ColorField {
  key: keyof ThemeTokens;
  label: string;
}

/** Theme tokens (exported as `--as-*` custom properties) and global stylesheets. */
@Component({
  selector: 'studio-theme-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiIconComponent],
  templateUrl: './theme-panel.component.html',
  styleUrl: './theme-panel.component.scss',
})
export class ThemePanelComponent {
  protected readonly state = inject(BuilderStateService);

  protected readonly colors: ColorField[] = [
    { key: 'primary', label: 'Primary' },
    { key: 'onPrimary', label: 'On primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
    { key: 'surface', label: 'Surface' },
    { key: 'surfaceAlt', label: 'Surface alt' },
    { key: 'text', label: 'Text' },
    { key: 'textMuted', label: 'Muted text' },
    { key: 'border', label: 'Border' },
  ];

  protected readonly theme = computed(() => this.state.document().theme);
  protected readonly globalStyles = computed(() => this.state.document().globalStyles);

  protected color(key: keyof ThemeTokens): string {
    return String(this.theme()[key]);
  }

  protected setColor(key: keyof ThemeTokens, value: string): void {
    this.state.updateTheme({ [key]: value } as Partial<ThemeTokens>);
  }

  protected setNumber(key: keyof ThemeTokens, value: number): void {
    this.state.updateTheme({ [key]: value } as Partial<ThemeTokens>);
  }

  protected setText(key: keyof ThemeTokens, value: string): void {
    this.state.updateTheme({ [key]: value } as Partial<ThemeTokens>);
  }

  protected async importStyles(files: FileList | null): Promise<void> {
    if (!files) {
      return;
    }
    for (const file of Array.from(files)) {
      const content = await readTextFile(file);
      this.state.addGlobalStyle({ name: file.name, content, importedAt: new Date().toISOString() });
    }
  }
}
