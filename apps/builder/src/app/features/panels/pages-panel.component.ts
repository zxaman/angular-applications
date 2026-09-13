import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';

/** Page manager: routes map 1:1 to the generated lazy routes. */
@Component({
  selector: 'studio-pages-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiIconComponent],
  template: `
    <div class="head">
      <span>Pages</span>
      <span class="spacer"></span>
      <button type="button" class="btn sm" (click)="startAdd()"><ui-icon name="plus" [size]="12" />Page</button>
    </div>

    <div class="list">
      @if (adding()) {
        <div class="page new">
          <input
            class="input"
            #nameInput
            placeholder="Page name"
            (keyup.enter)="confirmAdd(nameInput.value)"
            (keyup.escape)="adding.set(false)"
          />
          <div class="row">
            <button type="button" class="btn sm primary" (click)="confirmAdd(nameInput.value)">Create</button>
            <button type="button" class="btn sm ghost" (click)="adding.set(false)">Cancel</button>
          </div>
        </div>
      }

      @for (page of state.document().pages; track page.id) {
        <div class="page" [class.active]="page.id === state.activePageId()">
          <button type="button" class="open" (click)="state.setActivePage(page.id)">
            <ui-icon name="pages" [size]="14" />
            <span class="name">{{ page.name }}</span>
            <span class="route">/{{ page.route }}</span>
          </button>
          <div class="actions">
            <button type="button" class="btn sm ghost" (click)="state.duplicatePage(page.id)" title="Duplicate page">
              <ui-icon name="copy" [size]="12" />
            </button>
            <button type="button" class="btn sm ghost danger" (click)="state.deletePage(page.id)" title="Delete page">
              <ui-icon name="trash" [size]="12" />
            </button>
          </div>
          @if (page.id === state.activePageId()) {
            <div class="edit">
              <div class="field">
                <label for="page-name">Name</label>
                <input
                  id="page-name"
                  class="input"
                  [ngModel]="page.name"
                  (ngModelChange)="state.updatePage(page.id, { name: $event })"
                />
              </div>
              <div class="field">
                <label for="page-route">Route</label>
                <input
                  id="page-route"
                  class="input"
                  [ngModel]="page.route"
                  placeholder="empty = index route"
                  (ngModelChange)="state.updatePage(page.id, { route: $event })"
                />
              </div>
              <div class="field">
                <label for="page-title">Document title</label>
                <input
                  id="page-title"
                  class="input"
                  [ngModel]="page.title"
                  (ngModelChange)="state.updatePage(page.id, { title: $event })"
                />
              </div>
            </div>
          }
        </div>
      }
    </div>

    <p class="hint pad">Each page becomes a lazy loaded standalone component in <span class="mono">src/app/pages/</span>.</p>
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
      .page {
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--panel-2);
        overflow: hidden;
      }
      .page.active {
        border-color: var(--accent);
      }
      .open {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        border: 0;
        background: transparent;
        color: var(--text-soft);
        cursor: pointer;
        text-align: left;
      }
      .open .name {
        font-weight: 600;
      }
      .open .route {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--muted);
      }
      .actions {
        display: flex;
        gap: 4px;
        padding: 0 8px 8px;
      }
      .edit {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 0 10px 10px;
        border-top: 1px solid var(--line-soft);
        padding-top: 10px;
      }
      .page.new {
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .pad {
        padding: 0 10px 12px;
      }
    `,
  ],
})
export class PagesPanelComponent {
  protected readonly state = inject(BuilderStateService);
  protected readonly adding = signal(false);

  protected startAdd(): void {
    this.adding.set(true);
  }

  protected confirmAdd(name: string): void {
    if (!name.trim()) {
      return;
    }
    this.state.addPage(name.trim());
    this.adding.set(false);
  }
}
