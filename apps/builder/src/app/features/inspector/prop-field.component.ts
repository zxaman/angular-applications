import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PropSchema } from '@appstudio/widgets';

export type PropValue = string | number | boolean | null;

/** Renders one widget property with the control its schema asks for. */
@Component({
  selector: 'studio-prop-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="field" [class.inline]="schema().control === 'boolean'">
      @if (schema().control !== 'boolean') {
        <label [for]="id()">{{ schema().label }}</label>
      }

      @switch (schema().control) {
        @case ('text') {
          <input [id]="id()" class="input" type="text" [ngModel]="text()" (ngModelChange)="emitString($event)" [placeholder]="schema().placeholder ?? ''" />
        }
        @case ('url') {
          <input [id]="id()" class="input" type="url" [ngModel]="text()" (ngModelChange)="emitString($event)" placeholder="https://" />
        }
        @case ('textarea') {
          <textarea [id]="id()" class="input" rows="3" [ngModel]="text()" (ngModelChange)="emitString($event)"></textarea>
        }
        @case ('options') {
          <textarea
            [id]="id()"
            class="input mono"
            rows="4"
            [ngModel]="text()"
            (ngModelChange)="emitString($event)"
            placeholder="one per line"
          ></textarea>
        }
        @case ('number') {
          <input
            [id]="id()"
            class="input"
            type="number"
            [min]="schema().min ?? null"
            [max]="schema().max ?? null"
            [step]="schema().step ?? 1"
            [ngModel]="number()"
            (ngModelChange)="emitNumber($event)"
          />
        }
        @case ('slider') {
          <div class="slider">
            <input
              [id]="id()"
              class="input"
              type="range"
              [min]="schema().min ?? 0"
              [max]="schema().max ?? 100"
              [step]="schema().step ?? 1"
              [ngModel]="number()"
              (ngModelChange)="emitNumber($event)"
            />
            <span class="badge">{{ number() }}</span>
          </div>
        }
        @case ('color') {
          <input [id]="id()" class="input" type="color" [ngModel]="text()" (ngModelChange)="emitString($event)" />
        }
        @case ('select') {
          <select [id]="id()" class="input" [ngModel]="text()" (ngModelChange)="emitString($event)">
            @for (option of schema().options ?? []; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        }
        @case ('boolean') {
          <label class="checkbox">
            <input [id]="id()" type="checkbox" [ngModel]="bool()" (ngModelChange)="emitBoolean($event)" />
            {{ schema().label }}
          </label>
        }
        @default {
          <input [id]="id()" class="input" type="text" [ngModel]="text()" (ngModelChange)="emitString($event)" />
        }
      }

      @if (schema().help) {
        <p class="hint">{{ schema().help }}</p>
      }
    </div>
  `,
  styles: [
    `
      .field.inline {
        flex-direction: row;
        align-items: center;
      }
      .slider {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .mono {
        font-family: var(--mono);
        font-size: 11px;
      }
    `,
  ],
})
export class PropFieldComponent {
  readonly schema = input.required<PropSchema>();
  readonly value = input<PropValue>(null);
  readonly change = output<PropValue>();

  protected readonly id = computed(() => `prop-${this.schema().key}`);
  protected readonly text = computed(() => (this.value() === null || this.value() === undefined ? '' : String(this.value())));
  protected readonly number = computed(() => Number(this.value() ?? 0));
  protected readonly bool = computed(() => this.value() === true || this.value() === 'true');

  protected emitString(value: string): void {
    this.change.emit(value);
  }

  protected emitNumber(value: number | string): void {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
    this.change.emit(Number.isFinite(parsed) ? parsed : 0);
  }

  protected emitBoolean(value: boolean): void {
    this.change.emit(value);
  }
}
