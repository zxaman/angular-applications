export type Granularity = 'page' | 'component' | 'widget';

export interface GenerateOptions {
  /** npm package name, kebab-case, e.g. `my-app`. */
  projectName: string;
  /** Selector prefix for generated components. Defaults to `app`. */
  prefix?: string;
  /**
   * How finely the tree is split into components.
   * - `page`: one component per page.
   * - `component`: pages plus every node the user marked as a component (default).
   * - `widget`: one component per widget instance.
   */
  granularity?: Granularity;
  /** Add Capacitor configuration so the exported app can be wrapped as a native app. */
  includeCapacitor?: boolean;
  /** Emit a smoke spec next to every page component. */
  includeTests?: boolean;
  /** Angular major version range written into package.json. */
  angularVersion?: string;
  /** Author written into package.json. */
  author?: string;
}

export type FileKind = 'ts' | 'html' | 'scss' | 'json' | 'md' | 'css' | 'other';

export interface GeneratedFile {
  /** Path relative to the exported project root, always with forward slashes. */
  path: string;
  contents: string;
  kind: FileKind;
}

export interface GenerateStats {
  files: number;
  pages: number;
  components: number;
  widgets: number;
  importedStylesheets: number;
  stateVariables: number;
  actions: number;
}

export interface GenerateResult {
  files: GeneratedFile[];
  warnings: string[];
  stats: GenerateStats;
}

/** Options after defaults have been applied. */
export interface NormalisedOptions extends GenerateOptions {
  projectName: string;
  prefix: string;
  granularity: NonNullable<GenerateOptions['granularity']>;
  includeCapacitor: boolean;
  includeTests: boolean;
}
