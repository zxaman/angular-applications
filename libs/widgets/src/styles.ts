import type { ThemeTokens } from '@appstudio/schema';

/**
 * Base stylesheet shared by the canvas preview and every exported project.
 * Keeping it in one place is what makes the preview WYSIWYG: the builder injects
 * exactly this CSS, and the generator writes it into the app's `styles.scss`.
 */
export const BASE_STYLES: Record<string, string> = {
  '.as-container': 'box-sizing:border-box;width:100%;min-width:0',
  '.as-row': 'box-sizing:border-box;width:100%;min-width:0',
  '.as-row.is-wrap': 'flex-wrap:wrap',
  '.as-column': 'box-sizing:border-box;width:100%;min-width:0',
  '.as-grid': 'width:100%;grid-template-columns:repeat(var(--as-cols,3),minmax(0,1fr))',
  '.as-stack': 'width:100%;box-sizing:border-box',
  '.as-card':
    'background:var(--as-surface);border:1px solid var(--as-border);border-radius:var(--as-radius);padding:20px;box-sizing:border-box;width:100%',
  '.as-card.is-elevated': 'box-shadow:var(--as-shadow)',
  '.as-card-header': 'display:flex;flex-direction:column;gap:4px',
  '.as-card-title': 'margin:0;font-size:17px;font-weight:600;color:var(--as-text)',
  '.as-card-subtitle': 'margin:0;font-size:13px;color:var(--as-text-muted)',
  '.as-divider': 'border:0;background:var(--as-border);height:1px;width:100%',
  '.as-divider.is-vertical': 'width:1px;height:auto;min-height:100%;align-self:stretch',
  '.as-spacer': 'flex:0 0 auto',
  '.as-form': 'width:100%;box-sizing:border-box',
  '.as-heading': 'color:var(--as-text);font-family:var(--as-font-heading);letter-spacing:-0.01em',
  '.as-text': 'color:var(--as-text);font-family:var(--as-font-body)',
  '.as-badge':
    'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:var(--as-primary);color:var(--as-on-primary);border:1px solid transparent',
  '.as-badge.is-soft': 'background:color-mix(in srgb,var(--as-primary) 14%,transparent);color:var(--as-primary)',
  '.as-badge.is-outline': 'background:transparent;border-color:var(--as-primary);color:var(--as-primary)',
  '.as-alert':
    'display:flex;flex-direction:column;gap:4px;border-radius:var(--as-radius);border:1px solid var(--as-border);background:var(--as-surface-alt);color:var(--as-text)',
  '.as-alert.is-info': 'border-color:color-mix(in srgb,var(--as-secondary) 45%,transparent)',
  '.as-alert.is-success': 'border-color:#86efac;background:#f0fdf4',
  '.as-alert.is-warning': 'border-color:#fcd34d;background:#fffbeb',
  '.as-alert.is-danger': 'border-color:#fca5a5;background:#fef2f2',
  '.as-alert-title': 'font-weight:600;font-size:14px',
  '.as-alert-text': 'font-size:13px;color:var(--as-text-muted)',
  '.as-icon': 'display:inline-flex;color:currentColor;flex:0 0 auto',
  '.as-link': 'color:var(--as-primary);text-decoration:none;font-weight:600;font-size:14px',
  '.as-link:hover': 'text-decoration:underline',
  '.as-list': 'color:var(--as-text);font-size:14px;line-height:1.7',
  '.as-breadcrumb': 'list-style:none;margin:0;padding:0;flex-wrap:wrap',
  '.as-breadcrumb li': 'display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--as-text-muted)',
  '.as-breadcrumb li + li::before': "content:'/';color:var(--as-border)",
  '.as-breadcrumb a': 'color:var(--as-primary);text-decoration:none',
  '.as-button':
    'display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid transparent;border-radius:var(--as-radius);font-weight:600;cursor:pointer;font-family:inherit;transition:filter .15s ease',
  '.as-button:hover': 'filter:brightness(0.96)',
  '.as-button.is-primary': 'background:var(--as-primary);color:var(--as-on-primary)',
  '.as-button.is-secondary': 'background:var(--as-secondary);color:#ffffff',
  '.as-button.is-outline': 'background:transparent;border-color:var(--as-primary);color:var(--as-primary)',
  '.as-button.is-ghost': 'background:transparent;color:var(--as-primary)',
  '.as-button.is-danger': 'background:#dc2626;color:#ffffff',
  '.as-button.is-sm': 'padding:8px 14px;font-size:13px',
  '.as-button.is-md': 'padding:10px 18px;font-size:14px',
  '.as-button.is-lg': 'padding:14px 24px;font-size:16px',
  '.as-button.is-full': 'width:100%',
  '.as-field': 'width:100%;box-sizing:border-box',
  '.as-text-input': 'display:flex;flex-direction:column;gap:6px;width:100%;box-sizing:border-box',
  '.as-textarea': 'display:flex;flex-direction:column;gap:6px;width:100%;box-sizing:border-box',
  '.as-select': 'display:flex;flex-direction:column;gap:6px;width:100%;box-sizing:border-box',
  '.as-label': 'font-size:13px;font-weight:600;color:var(--as-text)',
  '.as-required': 'color:#dc2626;margin-left:2px',
  '.as-control':
    'width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--as-border);border-radius:var(--as-radius);background:var(--as-surface);color:var(--as-text);font-family:inherit;font-size:14px',
  '.as-control:focus': 'outline:2px solid color-mix(in srgb,var(--as-primary) 35%,transparent);outline-offset:1px;border-color:var(--as-primary)',
  '.as-helper': 'font-size:12px;color:var(--as-text-muted)',
  '.as-checkbox': 'display:inline-flex;align-items:center;gap:8px;font-size:14px;color:var(--as-text);cursor:pointer',
  '.as-checkbox-input': 'width:18px;height:18px;accent-color:var(--as-primary);cursor:pointer;flex:0 0 auto',
  '.as-checkbox-label': 'font-size:14px;color:var(--as-text)',
  '.as-progress': 'display:flex;flex-direction:column;gap:6px;width:100%',
  '.as-switch': 'display:inline-flex;align-items:center;gap:10px;font-size:14px;color:var(--as-text);cursor:pointer',
  '.as-switch-track':
    'position:relative;display:inline-flex;flex:0 0 auto;width:44px;height:24px;border-radius:999px;background:var(--as-border);border:0;padding:0;cursor:pointer;transition:background .15s ease',
  '.as-switch.is-on .as-switch-track': 'background:var(--as-primary)',
  '.as-switch-thumb':
    'position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#ffffff;transition:transform .15s ease',
  '.as-switch.is-on .as-switch-thumb': 'transform:translateX(20px)',
  '.as-image': 'display:block;max-width:100%;object-fit:cover',
  '.as-avatar':
    'display:inline-flex;align-items:center;justify-content:center;overflow:hidden;border-radius:50%;background:var(--as-surface-alt);color:var(--as-text-muted);font-weight:600;font-size:14px;flex:0 0 auto',
  '.as-avatar.is-square': 'border-radius:var(--as-radius)',
  '.as-progress-track': 'width:100%;height:10px;border-radius:999px;background:var(--as-surface-alt);overflow:hidden',
  '.as-progress-fill': 'height:100%;background:var(--as-primary);border-radius:999px',
  '.as-progress-label': 'font-size:12px;color:var(--as-text-muted)',
  '.as-video': 'display:block;width:100%;background:#000000',
  '.as-navbar': 'background:var(--as-surface);border-bottom:1px solid var(--as-border);box-sizing:border-box;width:100%',
  '.as-navbar.is-sticky': 'position:sticky;top:0;z-index:20',
  '.as-navbar-brand': 'font-weight:700;font-size:16px;color:var(--as-text)',
  '.as-navbar-links': 'display:flex;align-items:center;gap:14px;flex-wrap:wrap',
  '.as-empty':
    'display:flex;align-items:center;justify-content:center;min-height:56px;border:1px dashed var(--as-border);border-radius:var(--as-radius);color:var(--as-text-muted);font-size:12px;padding:12px;text-align:center',
};

/** Theme tokens as CSS custom properties. `selector` is `:root` in an app, `.as-root` in the canvas. */
export function themeCss(theme: ThemeTokens, selector = ':root'): string {
  const vars: Record<string, string> = {
    '--as-primary': theme.primary,
    '--as-on-primary': theme.onPrimary,
    '--as-secondary': theme.secondary,
    '--as-accent': theme.accent,
    '--as-surface': theme.surface,
    '--as-surface-alt': theme.surfaceAlt,
    '--as-text': theme.text,
    '--as-text-muted': theme.textMuted,
    '--as-border': theme.border,
    '--as-radius': `${theme.radius}px`,
    '--as-space': `${theme.spacing}px`,
    '--as-font-heading': theme.fontHeading,
    '--as-font-body': theme.fontBody,
    '--as-shadow': theme.shadow,
  };
  const body = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  return `${selector} {\n${body}\n  font-size: ${theme.fontScale}px;\n}`;
}

/** All base rules as one stylesheet string. */
export function baseCss(): string {
  return Object.entries(BASE_STYLES)
    .map(([selector, declarations]) => `${selector} {\n${declarations
      .split(';')
      .filter(Boolean)
      .map((decl) => `  ${decl.trim()};`)
      .join('\n')}\n}`)
    .join('\n\n');
}
