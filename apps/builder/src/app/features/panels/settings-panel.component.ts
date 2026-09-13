import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BREAKPOINTS, type Breakpoint } from '@appstudio/schema';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';

/** Project settings: metadata, generated-code options and a document summary. */
@Component({
  selector: 'studio-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiIconComponent],
  template: `
    <div class="head">
      <span>Settings</span>
    </div>

    <div class="scroll">
      <section class="block">
        <h3>Project</h3>
        <div class="field">
          <label for="meta-name">Name</label>
          <input
            id="meta-name"
            class="input"
            [ngModel]="meta().name"
            (ngModelChange)="state.updateMeta({ name: $event })"
          />
        </div>
        <div class="field">
          <label for="meta-description">Description</label>
          <textarea
            id="meta-description"
            class="input"
            rows="2"
            [ngModel]="meta().description"
            (ngModelChange)="state.updateMeta({ description: $event })"
          ></textarea>
        </div>
        <div class="row two">
          <div class="field">
            <label for="meta-version">Version</label>
            <input
              id="meta-version"
              class="input"
              [ngModel]="meta().version"
              (ngModelChange)="state.updateMeta({ version: $event })"
            />
          </div>
          <div class="field">
            <label for="meta-author">Author</label>
            <input
              id="meta-author"
              class="input"
              [ngModel]="meta().author"
              (ngModelChange)="state.updateMeta({ author: $event })"
            />
          </div>
        </div>
      </section>

      <section class="block">
        <h3>Generated code</h3>
        <div class="field">
          <label for="setting-prefix">Selector prefix</label>
          <input
            id="setting-prefix"
            class="input mono"
            [ngModel]="settings().prefix"
            placeholder="app"
            (ngModelChange)="state.updateSettings({ prefix: $event })"
          />
          <p class="hint">Components are emitted as <span class="mono">&lt;{{ settings().prefix || 'app' }}-…&gt;</span>.</p>
        </div>
        <div class="field">
          <label for="setting-breakpoint">Default preview</label>
          <select
            id="setting-breakpoint"
            class="input"
            [ngModel]="settings().defaultBreakpoint"
            (ngModelChange)="state.updateSettings({ defaultBreakpoint: $event })"
          >
            @for (bp of breakpoints; track bp.id) {
              <option [value]="bp.id">{{ bp.label }}</option>
            }
          </select>
        </div>
        <label class="check">
          <input
            type="checkbox"
            [ngModel]="settings().includeCapacitor"
            (ngModelChange)="state.updateSettings({ includeCapacitor: $event })"
          />
          Include Capacitor config in exports
        </label>
        <p class="hint">
          Capacitor files are written but never enabled by default — the exported project stays a plain Angular web app.
        </p>
      </section>

      <section class="block">
        <h3>Summary</h3>
        <ul class="stats">
          <li><span>Pages</span><strong>{{ state.document().pages.length }}</strong></li>
          <li><span>Components</span><strong>{{ state.components().length }}</strong></li>
          <li><span>Widgets on this canvas</span><strong>{{ state.nodeCount() }}</strong></li>
          <li><span>State variables</span><strong>{{ state.stateVariables().length }}</strong></li>
          <li><span>Global stylesheets</span><strong>{{ state.document().globalStyles.length }}</strong></li>
          <li><span>Validation errors</span><strong [class.bad]="state.issueCount() > 0">{{ state.issueCount() }}</strong></li>
        </ul>
        <p class="hint pad">Document version {{ state.document().version }} · last saved {{ savedLabel() }}</p>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-bottom: 1px solid var(--line-soft);
        font-size: 12px;
        font-weight: 600;
      }
      .scroll {
        flex: 1 1 auto;
        overflow: auto;
        padding: 10px;
      }
      .block + .block {
        margin-top: 16px;
      }
      .block h3 {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 8px;
      }
      .row.two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--text-soft);
        margin-top: 4px;
      }
      .stats {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .stats li {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: var(--text-soft);
      }
      .stats strong {
        font-variant-numeric: tabular-nums;
      }
      .stats strong.bad {
        color: var(--danger, #e05252);
      }
      .pad {
        padding-top: 8px;
      }
    `,
  ],
})
export class SettingsPanelComponent {
  protected readonly state = inject(BuilderStateService);
  protected readonly breakpoints = BREAKPOINTS;

  protected readonly meta = computed(() => this.state.document().meta);
  protected readonly settings = computed(() => this.state.document().settings);

  protected readonly savedLabel = computed(() => {
    const saved = this.state.lastSavedAt();
    if (!saved) {
      return 'never';
    }
    const date = new Date(saved);
    return Number.isNaN(date.getTime()) ? 'never' : date.toLocaleTimeString();
  });

  /** Keeps the select bound to a `Breakpoint` rather than a raw string. */
  protected asBreakpoint(value: string): Breakpoint {
    return value as Breakpoint;
  }
}
