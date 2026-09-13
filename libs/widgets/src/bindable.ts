/**
 * Properties that are *not* exposed as component inputs.
 *
 * A property is bindable only when the generated template actually reads it at
 * runtime. Things like `variant` (a CSS class), `columns` (a CSS custom property)
 * or `label` (the canvas empty state) are compiled into markup or styles, so
 * turning them into inputs would produce dead code in the exported project.
 */
const NON_BINDABLE: Record<string, string[]> = {
  container: ['label', 'tag'],
  row: ['label', 'wrap'],
  column: ['label'],
  grid: ['label', 'columns'],
  stack: ['label', 'minHeight'],
  card: ['label', 'elevated'],
  badge: ['variant'],
  alert: ['variant'],
  form: ['label'],
  divider: ['thickness'],
  spacer: ['size'],
  heading: ['level'],
  text: ['weight'],
  list: ['ordered'],
  icon: ['name', 'size'],
  link: ['openInNewTab'],
  button: ['variant', 'size', 'buttonType', 'fullWidth'],
  'text-input': ['name', 'inputType', 'required'],
  textarea: ['name', 'rows', 'required'],
  select: ['name', 'options', 'required'],
  checkbox: ['name', 'checked'],
  switch: ['name', 'checked'],
  image: ['fit', 'height'],
  avatar: ['size', 'shape'],
  progress: ['value', 'max', 'showLabel'],
  video: ['controls', 'autoplay'],
  navbar: ['sticky'],
  breadcrumb: ['items'],
};

export function isBindable(type: string, key: string, schemaBindable?: boolean): boolean {
  if (schemaBindable === false) {
    return false;
  }
  return !(NON_BINDABLE[type] ?? []).includes(key);
}
