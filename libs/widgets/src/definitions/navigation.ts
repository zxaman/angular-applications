import { booleanProp, optionsProp, textProp } from '../props';
import type { WidgetDefinition } from '../types';

export const NAVIGATION_WIDGETS: WidgetDefinition[] = [
  {
    type: 'navbar',
    label: 'Navbar',
    category: 'navigation',
    icon: 'navbar',
    description: 'Top navigation bar with a brand and a slot for links.',
    isContainer: true,
    maxChildren: -1,
    defaultProps: { brand: 'My App', sticky: true },
    defaultStyle: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'space-between',
      gap: '16px',
      padding: '12px 20px',
    },
    propSchema: [textProp('brand', 'Brand'), booleanProp('sticky', 'Stick to top', 'behaviour')],
  },
  {
    type: 'breadcrumb',
    label: 'Breadcrumb',
    category: 'navigation',
    icon: 'breadcrumb',
    description: 'Trail of links built from `route: Label` lines.',
    isContainer: false,
    maxChildren: 0,
    defaultProps: { items: '/: Home\n/products: Products\n/products/42: Cable' },
    defaultStyle: { display: 'flex', 'align-items': 'center', gap: '8px' },
    propSchema: [optionsProp('items', 'Items (route: Label)')],
  },
];
