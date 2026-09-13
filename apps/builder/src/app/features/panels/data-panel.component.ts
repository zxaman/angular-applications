import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { sanitiseIdentifier, type StateType, type StateVariable } from '@appstudio/schema';
import { UiIconComponent } from '@appstudio/ui';
import { BuilderStateService } from '../../core/builder-state.service';

const TYPES: StateType[] = ['string', 'number', 'boolean', 'list', 'object'];

const DEFAULT_INITIAL: Record<StateType, string> = {
  string: 'Hello world',
  number: '0',
  boolean: 'false',
  list: '[\n  { "title": "First item" },\n  { "title": "Second item" }\n]',
  object: '{}',
};

/**
 * Data / state manager.
 *
 * Everything declared here becomes a `signal()` on the generated `AppStore`, and
 * any `{{ state.<name> }}` written in the inspector resolves against it — both on
 * the canvas and in the exported code.
 */
@Component({
  selector: 'studio-data-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiIconComponent],
  template: `
    <div class="head">
      <span>Data</span>
      <span class="spacer"></span>
      <button type="button" class="btn sm" (click)="startAdd()"><ui-icon name="plus" [size]="12" />Variable</button>
    </div>

    <div class="list">
      @if (adding()) {
        <div class="var new">
          <input
            class="input"
            #nameInput
            placeholder="Variable name, e.g. counter"
            (keyup.enter)="confirmAdd(nameInput.value)"
            (keyup.escape)="adding.set(false)"
          />
          <div class="row">
            <button type="button" class="btn sm primary" (click)="confirmAdd(nameInput.value)">Create</button>
            <button type="button" class="btn sm ghost" (click)="adding.set(false)">Cancel</button>
          </div>
        </div>
      }

      @for (variable of state.stateVariables(); track variable.id; let i = $index) {
        <div class="var">
          <button type="button" class="open" (click)="toggle(variable.id)">
            <span class="type" [attr.data-type]="variable.type">{{ variable.type }}</span>
            <span class="name">{{ variable.name }}</span>
            <span class="spacer"></span>
            <ui-icon [name]="open() === variable.id ? 'chevron-down' : 'chevron'" [size]="12" />
          </button>
          <div class="actions">
            <button type="button" class="btn sm ghost" (click)="copyBinding(variable)" title="Copy binding">
              <ui-icon name="copy" [size]="12" />
            </button>
            <button type="button" class="btn sm ghost danger" (click)="state.removeStateVariable(variable.id)" title="Delete">
              <ui-icon name="trash" [size]="12" />
            </button>
          </div>

          @if (open() === variable.id) {
            <div class="edit">
              <div class="field">
                <label [for]="'sv-name-' + i">Name</label>
                <input
                  [id]="'sv-name-' + i"
                  class="input"
                  [ngModel]="variable.name"
                  (ngModelChange)="rename(variable, $event)"
                />
              </div>
              <div class="field">
                <label [for]="'sv-type-' + i">Type</label>
                <select
                  [id]="'sv-type-' + i"
                  class="input"
                  [ngModel]="variable.type"
                  (ngModelChange)="retype(variable, $event)"
                >
                  @for (type of types; track type) {
                    <option [value]="type">{{ type }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label [for]="'sv-initial-' + i">Initial value</label>
                @if (variable.type === 'list' || variable.type === 'object') {
                  <textarea
                    [id]="'sv-initial-' + i"
                    class="input mono"
                    rows="4"
                    [ngModel]="variable.initial"
                    (ngModelChange)="state.updateStateVariable(variable.id, { initial: $event })"
                  ></textarea>
                } @else {
                  <input
                    [id]="'sv-initial-' + i"
                    class="input"
                    [type]="variable.type === 'number' ? 'number' : 'text'"
                    [ngModel]="variable.initial"
                    (ngModelChange)="state.updateStateVariable(variable.id, { initial: $event })"
                  />
                }
              </div>
              <div class="field">
                <label [for]="'sv-desc-' + i">Description</label>
                <input
                  [id]="'sv-desc-' + i"
                  class="input"
                  placeholder="What is this for?"
                  [ngModel]="variable.description ?? ''"
                  (ngModelChange)="state.updateStateVariable(variable.id, { description: $event })"
                />
              </div>
              @if (invalid(variable)) {
                <p class="bad">{{ invalid(variable) }}</p>
              }
            </div>
          }
        </div>
      } @empty {
        <p class="hint pad">No state yet. Variables you add here become typed signals in the exported app.</p>
      }
    </div>

    <div class="hint pad">
      <p class="strong">Use it in the inspector</p>
      <p>Write <span class="mono" ngNonBindable>{{ state.counter }}</span> in any text or property field.</p>
      <p class="strong">Repeat over a list</p>
      <p>Select a node &rarr; Data tab &rarr; pick a list to loop over.</p>
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
      .list {
        flex: 1 1 auto;
        overflow: auto;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .var {
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--panel-2);
      }
      .var.new {
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
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
      .type {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 2px 5px;
        border-radius: 4px;
        background: var(--line);
        color: var(--muted);
      }
      .type[data-type='number'] {
        background: color-mix(in srgb, var(--accent) 22%, transparent);
        color: var(--accent);
      }
      .type[data-type='list'] {
        background: color-mix(in srgb, var(--ok, #2ea36b) 22%, transparent);
        color: var(--ok, #2ea36b);
      }
      .type[data-type='boolean'] {
        background: color-mix(in srgb, #d98c1f 26%, transparent);
        color: #d98c1f;
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
        padding: 10px;
        border-top: 1px solid var(--line-soft);
      }
      .bad {
        font-size: 11px;
        color: var(--danger, #e05252);
      }
      .strong {
        font-weight: 600;
        margin-top: 6px;
      }
      .pad {
        padding: 0 10px 12px;
      }
    `,
  ],
})
export class DataPanelComponent {
  protected readonly state = inject(BuilderStateService);
  protected readonly types = TYPES;
  protected readonly adding = signal(false);
  protected readonly open = signal<string | null>(null);

  protected startAdd(): void {
    this.adding.set(true);
  }

  protected toggle(id: string): void {
    this.open.update((current) => (current === id ? null : id));
  }

  protected confirmAdd(name: string): void {
    if (!name.trim()) {
      return;
    }
    this.state.addStateVariable(name.trim(), 'string');
    this.adding.set(false);
  }

  protected rename(variable: StateVariable, name: string): void {
    this.state.updateStateVariable(variable.id, { name: sanitiseIdentifier(name) });
  }

  protected retype(variable: StateVariable, type: StateType): void {
    const keep = variable.type === type;
    this.state.updateStateVariable(variable.id, { type, initial: keep ? variable.initial : DEFAULT_INITIAL[type] });
  }

  /** Inline hint for the one thing that can really go wrong: hand-written JSON. */
  protected invalid(variable: StateVariable): string | null {
    if (!variable.name) {
      return 'Name cannot be empty.';
    }
    if (this.state.stateVariables().filter((entry) => entry.name === variable.name).length > 1) {
      return `Another variable is already called "${variable.name}".`;
    }
    if (variable.type === 'list' || variable.type === 'object') {
      try {
        JSON.parse(variable.initial || 'null');
      } catch {
        return 'Value is not valid JSON.';
      }
    }
    return null;
  }

  protected copyBinding(variable: StateVariable): void {
    const text = `{{ state.${variable.name} }}`;
    void navigator.clipboard?.writeText(text);
    this.state.notify(`Copied ${text}`);
  }
}
