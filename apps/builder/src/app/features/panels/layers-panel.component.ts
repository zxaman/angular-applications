import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BuilderStateService } from '../../core/builder-state.service';
import { LayerRowComponent } from './layer-row.component';

/** Outline of the active page. */
@Component({
  selector: 'studio-layers-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LayerRowComponent],
  template: `
    <div class="head">
      <span>{{ state.activePage()?.name ?? 'No page' }}</span>
      <span class="badge">{{ state.nodeCount() }}</span>
      <span class="spacer"></span>
      <button type="button" class="btn sm ghost" (click)="state.selectParent()" title="Select parent">Up</button>
      <button type="button" class="btn sm ghost danger" (click)="state.deleteSelected()" title="Delete selected">Del</button>
    </div>
    <div class="tree" role="tree">
      @if (state.activePage(); as page) {
        <studio-layer-row [node]="page.root" [depth]="0" />
      } @else {
        <p class="empty-state">No page selected.</p>
      }
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
      .spacer {
        flex: 1 1 auto;
      }
      .tree {
        flex: 1 1 auto;
        overflow: auto;
        padding: 6px;
      }
    `,
  ],
})
export class LayersPanelComponent {
  protected readonly state = inject(BuilderStateService);
}
