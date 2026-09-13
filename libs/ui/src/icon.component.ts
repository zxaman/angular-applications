import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { UI_ICONS } from './icons';

/**
 * Inline SVG icon. Path data is a fixed internal set, so the markup is safe to
 * inject without sanitising user content.
 */
@Component({
  selector: 'ui-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--ui-icon-size, 18px);
        height: var(--ui-icon-size, 18px);
        color: currentColor;
        flex: 0 0 auto;
      }
      svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
  template: `<span [innerHTML]="svg"></span>`,
})
export class UiIconComponent {
  readonly name = input<string>('box');
  readonly size = input<number>(18);

  protected get svg(): SafeHtml {
    const path = UI_ICONS[this.name()] ?? UI_ICONS['box'];
    const size = this.size();
    return this.sanitizer.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`,
    );
  }

  constructor(private readonly sanitizer: DomSanitizer) {}
}
