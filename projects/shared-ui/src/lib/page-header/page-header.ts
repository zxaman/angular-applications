import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-page-header',
  imports: [],
  styles: `
    .lib-page-header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #fff;
      padding: 2rem;
      border-radius: 12px;
      margin-bottom: 1.5rem;
    }
    .lib-page-header h1 {
      margin: 0 0 0.5rem;
      font-size: 1.75rem;
    }
    .lib-page-header p {
      margin: 0;
      opacity: 0.9;
    }
    .lib-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 999px;
      padding: 0.15rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }
  `,
  template: `
    <header class="lib-page-header">
      @if (badge()) {
        <span class="lib-badge">{{ badge() }}</span>
      }
      <h1>{{ title() }}</h1>
      @if (subtitle()) {
        <p>{{ subtitle() }}</p>
      }
    </header>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly badge = input<string>('');
}
