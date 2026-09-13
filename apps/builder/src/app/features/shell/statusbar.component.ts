import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';

/** Bottom strip: state, counters and a keyboard hint. */
@Component({
  selector: 'studio-statusbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  template: `
    <span class="item">
      <ui-icon name="pages" [size]="12" />
      {{ state.activePage()?.name ?? '—' }}
      <em class="mono">/{{ state.activePage()?.route ?? '' }}</em>
    </span>
    <span class="item"><ui-icon name="box" [size]="12" />{{ state.nodeCount() }} widgets</span>
    <span class="item"><ui-icon name="component" [size]="12" />{{ state.widgetTypes().length }} types</span>
    <span class="item grow">
      @if (state.notice(); as notice) {
        <span class="notice" [class.error]="notice.tone === 'error'">{{ notice.text }}</span>
      }
    </span>
    <span class="item hide-sm"><kbd>Ctrl</kbd>+<kbd>Z</kbd> undo</span>
    <span class="item hide-sm"><kbd>Del</kbd> delete</span>
    <span class="item hide-sm"><kbd>Ctrl</kbd>+<kbd>E</kbd> export</span>
    <span class="item">
      @if (state.dirty()) {
        <span class="dot"></span> unsaved
      } @else {
        <ui-icon name="check" [size]="12" /> saved locally
      }
    </span>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        gap: 14px;
        height: var(--statusbar-h);
        padding: 0 12px;
        border-top: 1px solid var(--line);
        background: var(--panel);
        color: var(--muted);
        font-size: 11px;
        flex: 0 0 auto;
        overflow: hidden;
      }
      .item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
      }
      .grow {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
      }
      .notice {
        color: var(--accent-2);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .notice.error {
        color: #fca5a5;
      }
      .mono {
        font-family: var(--mono);
        font-style: normal;
        font-size: 10px;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--warn);
      }
      kbd {
        padding: 0 4px;
        border: 1px solid var(--line);
        border-radius: 3px;
        background: var(--panel-2);
        font-family: var(--mono);
        font-size: 9px;
      }
      @media (max-width: 900px) {
        .hide-sm {
          display: none;
        }
      }
    `,
  ],
})
export class StatusbarComponent {
  protected readonly state = inject(BuilderStateService);
}
