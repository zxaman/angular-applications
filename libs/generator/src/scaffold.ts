import type { AppDocument } from '@appstudio/schema';
import { BREAKPOINTS } from '@appstudio/schema';
import { escapeTs, kebab, pascal } from './naming';
import type { ComponentPlan, ProjectPlan } from './plan';
import type { GeneratedFile, GenerateOptions, NormalisedOptions } from './types';

const DEFAULT_ANGULAR = '^22.1.0';
const DEFAULT_CLI = '^22.1.8';
const DEFAULT_TS = '~6.0.2';

export interface ScaffoldContext {
  doc: AppDocument;
  plan: ProjectPlan;
  options: NormalisedOptions;
  /** Project relative paths of user imported global stylesheets. */
  globalStylePaths: string[];
  /** True when a generated component performs an HTTP action. */
  http?: boolean;
}

function angularVersion(options: GenerateOptions): string {
  return options.angularVersion ?? DEFAULT_ANGULAR;
}

export function emitPackageJson(ctx: ScaffoldContext): string {
  const { doc, options } = ctx;
  const dependencies: Record<string, string> = {
    '@angular/common': angularVersion(options),
    '@angular/compiler': angularVersion(options),
    '@angular/core': angularVersion(options),
    '@angular/forms': angularVersion(options),
    '@angular/platform-browser': angularVersion(options),
    '@angular/router': angularVersion(options),
    rxjs: '~7.8.0',
    tslib: '^2.3.0',
  };
  const devDependencies: Record<string, string> = {
    '@angular/build': options.angularVersion ? angularVersion(options) : DEFAULT_CLI,
    '@angular/cli': options.angularVersion ? angularVersion(options) : DEFAULT_CLI,
    '@angular/compiler-cli': angularVersion(options),
    typescript: DEFAULT_TS,
  };
  const scripts: Record<string, string> = {
    ng: 'ng',
    start: 'ng serve',
    build: 'ng build',
    watch: 'ng build --watch --configuration development',
  };

  if (options.includeCapacitor) {
    dependencies['@capacitor/core'] = '^8.0.0';
    dependencies['@capacitor/android'] = '^8.0.0';
    dependencies['@capacitor/ios'] = '^8.0.0';
    devDependencies['@capacitor/cli'] = '^8.0.0';
    scripts['cap:sync'] = 'npm run build && cap sync';
    scripts['cap:open:android'] = 'cap open android';
    scripts['cap:open:ios'] = 'cap open ios';
  }
  if (options.includeTests) {
    devDependencies['jsdom'] = '^28.0.0';
    devDependencies['vitest'] = '^4.0.8';
    scripts['test'] = 'ng test';
  }

  return `${JSON.stringify(
    {
      name: ctx.options.projectName,
      version: doc.meta.version || '0.1.0',
      private: true,
      description: doc.meta.description,
      author: options.author ?? doc.meta.author ?? undefined,
      scripts,
      dependencies,
      devDependencies,
    },
    null,
    2,
  )}\n`;
}

export function emitAngularJson(ctx: ScaffoldContext): string {
  const { options } = ctx;
  const project = options.projectName;
  const styles = ['src/styles.scss', ...ctx.globalStylePaths];
  const architect: Record<string, unknown> = {
    build: {
      builder: '@angular/build:application',
      options: {
        browser: 'src/main.ts',
        tsConfig: 'tsconfig.app.json',
        inlineStyleLanguage: 'scss',
        assets: [{ glob: '**/*', input: 'public' }],
        styles,
      },
      configurations: {
        production: {
          budgets: [
            { type: 'initial', maximumWarning: '500kB', maximumError: '1MB' },
            { type: 'anyComponentStyle', maximumWarning: '6kB', maximumError: '12kB' },
          ],
          outputHashing: 'all',
        },
        development: { optimization: false, extractLicenses: false, sourceMap: true },
      },
      defaultConfiguration: 'production',
    },
    serve: {
      builder: '@angular/build:dev-server',
      configurations: {
        production: { buildTarget: `${project}:build:production` },
        development: { buildTarget: `${project}:build:development` },
      },
      defaultConfiguration: 'development',
    },
  };
  if (options.includeTests) {
    architect['test'] = { builder: '@angular/build:unit-test' };
  }

  return `${JSON.stringify(
    {
      $schema: './node_modules/@angular/cli/lib/config/schema.json',
      version: 1,
      cli: { packageManager: 'npm' },
      newProjectRoot: 'projects',
      projects: {
        [project]: {
          projectType: 'application',
          schematics: { '@schematics/angular:component': { style: 'scss' } },
          root: '',
          sourceRoot: 'src',
          prefix: options.prefix ?? 'app',
          architect,
        },
      },
    },
    null,
    2,
  )}\n`;
}

export function emitTsConfig(): string {
  return `${JSON.stringify(
    {
      compileOnSave: false,
      compilerOptions: {
        strict: true,
        noImplicitOverride: true,
        noPropertyAccessFromIndexSignature: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        skipLibCheck: true,
        isolatedModules: true,
        experimentalDecorators: true,
        importHelpers: true,
        target: 'ES2022',
        module: 'preserve',
      },
      angularCompilerOptions: {
        enableI18nLegacyMessageIdFormat: false,
        strictInjectionParameters: true,
        strictInputAccessModifiers: true,
        strictTemplates: true,
      },
      files: [],
      references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.spec.json' }],
    },
    null,
    2,
  )}\n`;
}

export function emitTsConfigApp(): string {
  return `${JSON.stringify(
    {
      extends: './tsconfig.json',
      compilerOptions: { outDir: './out-tsc/app', types: [] },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
    },
    null,
    2,
  )}\n`;
}

export function emitTsConfigSpec(): string {
  return `${JSON.stringify(
    {
      extends: './tsconfig.json',
      compilerOptions: { outDir: './out-tsc/spec', types: ['vitest/globals'] },
      include: ['src/**/*.d.ts', 'src/**/*.spec.ts'],
    },
    null,
    2,
  )}\n`;
}

export function emitMainTs(): string {
  return `import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
`;
}

export function emitIndexHtml(doc: AppDocument): string {
  const title = doc.meta.name || 'Application';
  const description = doc.meta.description || '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="description" content="${description.replace(/"/g, '&quot;')}" />
    <meta name="theme-color" content="${doc.theme.primary}" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`;
}

/** `provideHttpClient()` is added only when a component issues HTTP requests. */
export function emitAppConfig(options: { http?: boolean } = {}): string {
  const httpImport = options.http ? "import { provideHttpClient, withFetch } from '@angular/common/http';\n" : '';
  const httpProvider = options.http ? ', provideHttpClient(withFetch())' : '';
  return `import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
${httpImport}import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes, withComponentInputBinding())${httpProvider}],
};
`;
}

export function emitAppRoutes(plan: ProjectPlan): string {
  const entries = plan.pages
    .map((page) => {
      const path = (page.route ?? '').replace(/^\//, '');
      const importPath = `./${page.folder}/${page.fileBase}`;
      const title = page.title ? `, title: '${escapeTs(page.title)}'` : '';
      return `  {\n    path: '${escapeTs(path)}',\n    loadComponent: () => import('${importPath}').then((m) => m.${page.className})${title},\n  },`;
    })
    .join('\n');
  return `import type { Routes } from '@angular/router';

export const routes: Routes = [
${entries}
  { path: '**', redirectTo: '' },
];
`;
}

export function emitRootComponent(prefix: string): string {
  return `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: '${prefix}-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
})
export class App {}
`;
}

export function emitRootTemplate(): string {
  return `<router-outlet />
`;
}

export function emitRootStyles(): string {
  return `:host {
  display: block;
  min-height: 100vh;
}
`;
}

/** Sass breakpoint helpers mirroring the studio's breakpoint table. */
export function emitBreakpointsScss(): string {
  const entries = BREAKPOINTS.filter((bp) => bp.media)
    .map((bp) => `  ${bp.id}: ${bp.media?.replace('(min-width: ', '').replace(')', '')}`)
    .join(',\n');
  return `@use 'sass:map';

// Mirrors the breakpoints used in the studio canvas.
$breakpoints: (
${entries},
);

@mixin respond-to($name) {
  $width: map.get($breakpoints, $name);
  @if $width == null {
    @error 'Unknown breakpoint #{$name}';
  }
  @media (min-width: $width) {
    @content;
  }
}
`;
}

export function emitCapacitorConfig(doc: AppDocument, projectName: string): string {
  const appId = `com.${kebab(doc.meta.author || 'appstudio').replace(/-/g, '')}.${kebab(projectName).replace(/-/g, '')}`;
  return `import type { CapacitorConfig } from '@capacitor/cli';

// Only needed when you want to ship this app as a native build.
// Run: npx cap add android && npx cap add ios && npm run cap:sync
const config: CapacitorConfig = {
  appId: '${appId}',
  appName: '${escapeTs(doc.meta.name || pascal(projectName))}',
  webDir: 'dist/${projectName}/browser',
  server: { androidScheme: 'https' },
};

export default config;
`;
}

export function emitReadme(ctx: ScaffoldContext): string {
  const { doc, plan, options } = ctx;
  const prefix = options.prefix ?? 'app';
  const tree = plan.all
    .map((component: ComponentPlan) => {
      const depth = component.kind === 'page' ? 0 : 1;
      const label = component.kind === 'page' ? `page "${component.page?.name ?? ''}"` : component.className;
      return `${'  '.repeat(depth)}- \`src/app/${component.folder}/\` — ${label}${
        component.kind === 'page' ? ` (route: /${component.route ?? ''})` : ''
      }`;
    })
    .join('\n');

  const capacitor = options.includeCapacitor
    ? `## Native build (Capacitor)

Capacitor is configured but no platform folder has been added yet:

\`\`\`bash
npx cap add android
npx cap add ios
npm run cap:sync
\`\`\`

The web build output is served from \`dist/${options.projectName}/browser\`.
`
    : `## Native build

This project was exported as a web app. To ship it as a native app later, add Capacitor:

\`\`\`bash
npm i @capacitor/core @capacitor/cli
npx cap init "${doc.meta.name}" "com.example.${kebab(options.projectName)}" --web-dir dist/${options.projectName}/browser
npx cap add android
\`\`\`
`;

  return `# ${doc.meta.name}

${doc.meta.description || 'Generated with AppStudio.'}

Generated by [AppStudio](../../README.md) — a visual builder for Angular applications.
Every screen is a standalone Angular component with its own template and stylesheet,
so the code is safe to keep editing by hand.

## Getting started

\`\`\`bash
npm install
npm start        # http://localhost:4200
npm run build    # production build in dist/
${options.includeTests ? 'npm test         # vitest smoke tests\n' : ''}\`\`\`

## Project layout

${tree}

- \`src/styles.scss\` — theme tokens (\`--as-*\`) plus the widget base stylesheet.
${
  ctx.globalStylePaths.length > 0
    ? `- Imported stylesheets: ${ctx.globalStylePaths.map((path) => `\`${path}\``).join(', ')} (registered in \`angular.json\`).\n`
    : ''
}- \`src/app/core/breakpoints.scss\` — Sass breakpoint map and \`respond-to()\` mixin.

## Component inputs

Components extracted from the studio expose their widget properties as Angular
signal inputs, so they can be reused with different content:

\`\`\`html
${plan.all
  .filter((component) => component.kind !== 'page' && component.inputs.length > 0)
  .slice(0, 1)
  .map(
    (component) =>
      `<${component.selector}${component.inputs
        .slice(0, 2)
        .map((input) => (input.type === 'string' ? ` ${input.name}="…"` : ` [${input.name}]="…"`))
        .join('')} />`,
  )
  .join('\n') || `<${prefix}-example title="Hello" />`}
\`\`\`

${capacitor}
## Re-exporting from the studio

Exporting the same project again overwrites the generated files. Keep hand written
logic in files the studio does not generate (services, stores, extra components) or
paste custom CSS into the widget's *Custom CSS* field so it survives an export.
`;
}

export function emitGitignore(): string {
  return `# Compiled output
/dist
/tmp
/out-tsc

# Node
/node_modules
npm-debug.log
yarn-error.log

# Angular
/.angular/cache
.sass-cache/

# Capacitor
/android
/ios

# Editors
.idea/
.vscode/*
!.vscode/extensions.json
.history/

# System
.DS_Store
Thumbs.db
`;
}

/**
 * npm 10.9.x aborts installs while resolving vitest's optional `jsdom` peer set
 * ("Cannot read properties of null (reading 'edgesOut')"). Shipping this file
 * keeps `npm install` working out of the box on npm 10 and 11.
 */
export function emitNpmRc(): string {
  return `legacy-peer-deps=true
`;
}

export function emitEditorConfig(): string {
  return `root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
`;
}

export function emitPrettierRc(): string {
  return `${JSON.stringify(
    {
      singleQuote: true,
      printWidth: 120,
      trailingComma: 'all',
      arrowParens: 'always',
    },
    null,
    2,
  )}\n`;
}

export function scaffoldFiles(ctx: ScaffoldContext): GeneratedFile[] {
  const { doc, plan, options } = ctx;
  const prefix = options.prefix ?? doc.settings.prefix ?? 'app';
  const files: GeneratedFile[] = [
    { path: 'package.json', contents: emitPackageJson(ctx), kind: 'json' },
    { path: 'angular.json', contents: emitAngularJson(ctx), kind: 'json' },
    { path: 'tsconfig.json', contents: emitTsConfig(), kind: 'json' },
    { path: 'tsconfig.app.json', contents: emitTsConfigApp(), kind: 'json' },
    { path: 'tsconfig.spec.json', contents: emitTsConfigSpec(), kind: 'json' },
    { path: 'src/main.ts', contents: emitMainTs(), kind: 'ts' },
    { path: 'src/index.html', contents: emitIndexHtml(doc), kind: 'html' },
    { path: 'src/app/app.config.ts', contents: emitAppConfig({ http: ctx.http }), kind: 'ts' },
    { path: 'src/app/app.routes.ts', contents: emitAppRoutes(plan), kind: 'ts' },
    { path: 'src/app/app.ts', contents: emitRootComponent(prefix), kind: 'ts' },
    { path: 'src/app/app.html', contents: emitRootTemplate(), kind: 'html' },
    { path: 'src/app/app.scss', contents: emitRootStyles(), kind: 'scss' },
    { path: 'src/app/core/breakpoints.scss', contents: emitBreakpointsScss(), kind: 'scss' },
    { path: '.gitignore', contents: emitGitignore(), kind: 'other' },
    { path: '.editorconfig', contents: emitEditorConfig(), kind: 'other' },
    { path: '.npmrc', contents: emitNpmRc(), kind: 'other' },
    { path: '.prettierrc', contents: emitPrettierRc(), kind: 'json' },
    { path: 'README.md', contents: emitReadme(ctx), kind: 'md' },
    { path: 'public/.gitkeep', contents: '', kind: 'other' },
  ];

  if (options.includeCapacitor) {
    files.push({ path: 'capacitor.config.ts', contents: emitCapacitorConfig(doc, options.projectName), kind: 'ts' });
  }

  return files;
}
