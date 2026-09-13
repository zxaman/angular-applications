import type { Breakpoint } from './types';

export interface BreakpointDef {
  id: Breakpoint;
  label: string;
  /** Device preview width in px used by the canvas. */
  canvasWidth: number;
  /** Matches the CSS media query the generator emits. `null` for `base`. */
  media: string | null;
  description: string;
}

/**
 * Breakpoints are mobile-first: a rule declared at `md` applies from 768px up.
 * The same table drives the canvas preview and the emitted `@media` blocks, so
 * what you design is what gets generated.
 */
export const BREAKPOINTS: readonly BreakpointDef[] = [
  {
    id: 'base',
    label: 'Base',
    canvasWidth: 390,
    media: null,
    description: 'All sizes (mobile first)',
  },
  {
    id: 'sm',
    label: 'Small',
    canvasWidth: 576,
    media: '(min-width: 576px)',
    description: '≥ 576px',
  },
  {
    id: 'md',
    label: 'Medium',
    canvasWidth: 768,
    media: '(min-width: 768px)',
    description: '≥ 768px',
  },
  {
    id: 'lg',
    label: 'Large',
    canvasWidth: 1024,
    media: '(min-width: 1024px)',
    description: '≥ 1024px',
  },
  {
    id: 'xl',
    label: 'X-Large',
    canvasWidth: 1440,
    media: '(min-width: 1440px)',
    description: '≥ 1440px',
  },
];

export const BREAKPOINT_IDS = BREAKPOINTS.map((bp) => bp.id);

export const BREAKPOINT_ORDER: Record<Breakpoint, number> = {
  base: 0,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
};

export function getBreakpoint(id: Breakpoint): BreakpointDef {
  return BREAKPOINTS.find((bp) => bp.id === id) ?? BREAKPOINTS[0];
}
