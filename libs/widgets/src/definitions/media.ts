import { booleanProp, numberProp, selectProp, textProp, urlProp } from '../props';
import type { WidgetDefinition } from '../types';

export const MEDIA_WIDGETS: WidgetDefinition[] = [
  {
    type: 'image',
    label: 'Image',
    category: 'media',
    icon: 'image',
    description: 'Responsive image with object-fit control.',
    isContainer: false,
    maxChildren: 0,
    defaultProps: {
      src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=60',
      alt: 'Descriptive alternative text',
      fit: 'cover',
      height: 220,
    },
    defaultStyle: { width: '100%', height: '220px', 'border-radius': '10px' },
    propSchema: [
      urlProp('src', 'Source URL'),
      textProp('alt', 'Alt text'),
      selectProp(
        'fit',
        'Object fit',
        ['cover', 'contain', 'fill', 'none'].map((value) => ({ label: value, value })),
        'appearance',
      ),
      numberProp('height', 'Height (px)', 'appearance', { min: 20, max: 1200 }),
    ],
  },
  {
    type: 'avatar',
    label: 'Avatar',
    category: 'media',
    icon: 'avatar',
    description: 'Circular user image with initials fallback.',
    isContainer: false,
    maxChildren: 0,
    defaultProps: { src: '', initials: 'AS', size: 48, shape: 'circle' },
    defaultStyle: { width: '48px', height: '48px' },
    propSchema: [
      urlProp('src', 'Image URL'),
      textProp('initials', 'Initials fallback'),
      numberProp('size', 'Size (px)', 'appearance', { min: 16, max: 200 }),
      selectProp(
        'shape',
        'Shape',
        [
          { label: 'Circle', value: 'circle' },
          { label: 'Square', value: 'square' },
        ],
        'appearance',
      ),
    ],
  },
  {
    type: 'progress',
    label: 'Progress',
    category: 'media',
    icon: 'progress',
    description: 'Progress bar with optional label.',
    isContainer: false,
    maxChildren: 0,
    defaultProps: { value: 65, max: 100, showLabel: true },
    propSchema: [
      numberProp('value', 'Value', 'content', { min: 0, max: 1000 }),
      numberProp('max', 'Max', 'content', { min: 1, max: 1000 }),
      booleanProp('showLabel', 'Show label', 'appearance'),
    ],
  },
  {
    type: 'video',
    label: 'Video',
    category: 'media',
    icon: 'video',
    description: 'HTML5 video player.',
    isContainer: false,
    maxChildren: 0,
    defaultProps: { src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', poster: '', controls: true, autoplay: false },
    defaultStyle: { width: '100%', 'border-radius': '10px' },
    propSchema: [
      urlProp('src', 'Source URL'),
      urlProp('poster', 'Poster URL'),
      booleanProp('controls', 'Show controls', 'appearance'),
      booleanProp('autoplay', 'Autoplay', 'behaviour'),
    ],
  },
];
