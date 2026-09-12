import { Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary';

@Component({
  selector: 'lib-button',
  imports: [],
  styles: `
    .lib-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.6rem 1.25rem;
      border-radius: 8px;
      border: 1px solid transparent;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: filter 0.15s ease, transform 0.15s ease;
    }
    .lib-btn:hover {
      filter: brightness(1.05);
    }
    .lib-btn:active {
      transform: scale(0.98);
    }
    .lib-btn-primary {
      background: #4f46e5;
      color: #fff;
    }
    .lib-btn-secondary {
      background: #fff;
      color: #4f46e5;
      border-color: #4f46e5;
    }
  `,
  template: `
    <button class="lib-btn" [class.lib-btn-primary]="variant() === 'primary'" [class.lib-btn-secondary]="variant() === 'secondary'" [type]="type()">
      <ng-content />
    </button>
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
}
