import type { AppNode, CssMap } from '@appstudio/schema';
import { asBoolean, asNumber, asString } from './props';

/**
 * Styles that are implied by widget properties.
 *
 * The builder merges these into `node.style` whenever a property changes, which
 * keeps a single styling channel for both the canvas and the generator: inline
 * style in the document, a plain CSS rule in the exported component.
 */
export function derivedStyle(node: AppNode): CssMap {
  const props = node.props;
  const style: CssMap = {};

  switch (node.type) {
    case 'grid':
      style['--as-cols'] = String(Math.max(1, asNumber(props['columns'], 3)));
      break;
    case 'spacer':
      style['height'] = `${Math.max(0, asNumber(props['size'], 24))}px`;
      break;
    case 'stack':
      style['min-height'] = `${Math.max(0, asNumber(props['minHeight'], 220))}px`;
      break;
    case 'divider': {
      const thickness = `${Math.max(1, asNumber(props['thickness'], 1))}px`;
      if (asString(props['orientation'], 'horizontal') === 'vertical') {
        style['width'] = thickness;
        style['height'] = 'auto';
        style['min-height'] = '100%';
      } else {
        style['height'] = thickness;
        style['width'] = '100%';
        style['min-height'] = '0';
      }
      break;
    }
    case 'avatar': {
      const size = Math.max(16, asNumber(props['size'], 48));
      style['width'] = `${size}px`;
      style['height'] = `${size}px`;
      style['font-size'] = `${Math.round(size * 0.36)}px`;
      break;
    }
    case 'image':
      style['height'] = `${Math.max(20, asNumber(props['height'], 220))}px`;
      style['object-fit'] = asString(props['fit'], 'cover');
      break;
    case 'text': {
      const weight = asString(props['weight'], '');
      if (weight) {
        style['font-weight'] = weight;
      }
      break;
    }
    case 'heading': {
      const level = asString(props['level'], 'h2');
      const sizes: Record<string, string> = { h1: '40px', h2: '30px', h3: '24px', h4: '20px', h5: '17px', h6: '15px' };
      style['font-size'] = sizes[level] ?? '28px';
      break;
    }
    case 'button':
      if (asBoolean(props['fullWidth'], false)) {
        style['width'] = '100%';
      }
      break;
    case 'video':
      style['height'] = `${Math.max(120, asNumber(props['height'], 260))}px`;
      break;
    default:
      break;
  }

  return style;
}
