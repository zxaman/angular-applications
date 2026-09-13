import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';

/**
 * Validation panel.
 *
 * Runs the same checks the exporter uses, so a broken document is caught in the
 * studio instead of in the generated project. Clicking an issue selects the node
 * it belongs to.
 */
@Component({
  selector: 'studio-validation-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  template: `
    <div class="head">
      <span>Checks</span>
      <span class="spacer"></span>
      @if (errors() > 0) {
        <span class="badge danger">{{ errors() }}</span>
      } @else if (warnings() > 0) {
        <span class="badge warn">{{ warnings() }}</span>
      } @else {
        <span class="badge ok">Clean</span>
      }
    </div>

    <div class="list">
      @for (issue of state.issues(); track trackIssue($index)) {
        <button type="button" class="issue" [class.error]="issue.severity === 'error'" (click)="focus(issue)">
          <ui-icon [name]="issue.severity === 'error' ? 'warning' : 'info'" [size]="13" />
          <span class="text">
            <strong>{{ issue.message }}</strong>
            <em class="mono">{{ issue.path }}</em>
          </span>
        </button>
      } @empty {
        <div class="clean">
          <ui-icon name="check" [size]="22" />
          <p>No problems found. This document exports cleanly.</p>
        </div>
      }
    </div>

    <p class="hint pad">
      Checks run over pages, components, state, actions and routes — the same rules
      <span class="mono">validateDocument()</span> applies at export time.
    </p>
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
      .spacer {
        flex: 1 1 auto;
      }
      .list {
        flex: 1 1 auto;
        overflow: auto;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .issue {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        width: 100%;
        padding: 8px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--panel-2);
        color: var(--text-soft);
        text-align: left;
        cursor: pointer;
      }
      .issue.error {
        border-color: color-mix(in srgb, var(--danger, #e05252) 55%, var(--line));
      }
      .issue .text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .issue strong {
        font-size: 12px;
        font-weight: 600;
      }
      .issue em {
        font-size: 10px;
        font-style: normal;
        color: var(--muted);
        word-break: break-all;
      }
      .clean {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 24px 12px;
        color: var(--ok, #2ea36b);
        text-align: center;
      }
      .clean p {
        color: var(--muted);
        font-size: 12px;
      }
      .pad {
        padding: 0 10px 12px;
      }
    `,
  ],
})
export class ValidationPanelComponent {
  protected readonly state = inject(BuilderStateService);

  protected readonly errors = computed(() => this.state.issues().filter((issue) => issue.severity === 'error').length);
  protected readonly warnings = computed(() => this.state.issues().filter((issue) => issue.severity === 'warning').length);

  protected trackIssue(index: number): number {
    return index;
  }

  protected focus(issue: { nodeId?: string }): void {
    if (issue.nodeId) {
      this.state.select(issue.nodeId);
    }
  }
}
