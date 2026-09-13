# AppStudio

A **visual builder for Angular applications** — drag widgets onto a canvas, tune them in an
inspector, then export a real, componentised Angular project you can keep developing by hand.

Think FlutterFlow, but the output is plain Angular: standalone components, one `.ts` / `.html` /
`.scss` triple per component, lazy routes, and your own stylesheets preserved.

Beyond layout, the studio models the parts that make an app an app:

- **State & bindings** — declare variables in the *Data* panel, write `{{ state.counter }}` in any
  text or property field, and repeat a widget over a list. Exports as a typed `AppStore` of signals
  plus a real `@for` loop.
- **Actions** — navigate, open a URL, write state or call an HTTP endpoint on click / change /
  submit. They run in the studio's preview mode and export as real method bodies.
- **Reusable components** — save any subtree to the library, drop instances anywhere, edit the
  definition once and every copy updates. Exports as one shared standalone component.
- **Image assets** — upload images in the inspector; they are exported as real files under
  `public/assets` instead of inline data URIs.

The studio itself is a **responsive website** (no native app). It runs in any modern browser and
adapts from a wide desktop down to a narrow window or tablet — the side panels slide over the
canvas instead of requiring a separate mobile build.

---

## Quick start

```bash
npm install
npm start          # http://localhost:4200
```

Other useful scripts (run from the repo root):

| Script | What it does |
| --- | --- |
| `npm start` | Serves the builder (`apps/builder`) with live reload |
| `npm run build` | Typechecks every library, then production-builds the builder |
| `npm run test` | Runs the library suites (vitest) and the builder suites (Angular + jsdom) |
| `npm run test:libs` | Only the schema / widgets / generator tests |
| `npm run test:builder` | Only the studio UI tests |
| `npm run typecheck` | Typechecks all workspaces without emitting |
| `npm run export:sample` | Exports a demo project into `exports/sample` (gitignored) |
| `npm run export:sample widget` | Same, using one-component-per-widget granularity |

Continuous integration (`.github/workflows/ci.yml`) runs the same checks on every push, and adds
the one that matters most: it exports the sample project, installs it and builds it.

`exports/sample` is a normal Angular project — you can `cd` into it and run `npm install && npm start`
to see exactly what a user downloads from the studio.

> **Note on `npm install`:** the repo ships an `.npmrc` with `legacy-peer-deps=true`. npm 10.9.x
> crashes (`Cannot read properties of null (reading 'edgesOut')`) while resolving vitest's optional
> `jsdom` peer set in a workspace install. Exported projects get the same file for the same reason.

---

## Monorepo layout

npm workspaces, no extra build orchestrator. Libraries are consumed **as source** through
TypeScript path mappings (`tsconfig.base.json`), so the builder bundles them directly and there is
no separate library publish step.

```
angular-applications/
├── apps/
│   └── builder/                  The studio: responsive Angular 22 web app (zoneless, signals)
│       └── src/app/
│           ├── core/             State store, history, autosave, export, drag & drop, responsive helpers
│           └── features/
│               ├── shell/        Topbar, statusbar
│               ├── canvas/       Design surface + recursive node renderer
│               ├── inspector/    Design / Styles / Code tabs, actions, bindings, custom CSS import
│               ├── panels/       Widgets, layers, pages, data, checks, settings, theme
│               └── export/       Export drawer: options, file tree, preview, download
├── libs/
│   ├── schema/     @appstudio/schema     Document model, tree ops, validation, migrations
│   ├── widgets/    @appstudio/widgets    Widget catalog, property schemas, shared render plan, base CSS
│   ├── generator/  @appstudio/generator  Document → complete Angular project (pure, filesystem-free)
│   └── ui/         @appstudio/ui         Shared Angular chrome components (icons, panels)
├── scripts/                      Dev tools (sample export)
├── docs/ARCHITECTURE.md          Design notes: data model, render contract, generator pipeline
└── tsconfig.base.json            Shared compiler options + @appstudio/* path mappings
```

Dependency direction is strict and one-way:

```
schema  ←  widgets  ←  generator
   ↑           ↑            ↑
   └───────────┴── builder ─┘          ui ← builder
```

`schema` knows nothing about widgets, `widgets` knows nothing about Angular, and the generator
never touches the DOM — which is why the same code path serves the in-browser export and the
`export:sample` CLI.

---

## Using the studio

1. **Add widgets** — drag from the *Widgets* rail onto the canvas, or click a widget to append it
   to the selected container. Drop position is shown with a blue insertion line.
2. **Select & arrange** — click any widget. Use the breadcrumb bar to jump to parents, `Del` to
   delete, `Ctrl+D` to duplicate, `Alt+↑/↓` to reorder, arrows to walk the tree, `Ctrl+Z`/`Ctrl+Y`
   for history.
3. **Design** — the inspector's *Design* tab edits widget properties; *Styles* edits CSS with a
   breakpoint switcher (base / sm / md / lg / xl) so you design mobile-first responsive layouts;
   *Code* shows the markup and SCSS that will be generated.
4. **State & data** — the *Data* rail panel holds your app's variables (string, number, boolean,
   list, object). Bind one with `{{ state.name }}` in any text field, or set *Repeat over* on a node
   to render it once per list item. The canvas resolves both live.
5. **Actions** — in the inspector's *Actions* block, add *Navigate*, *URL*, *Set state* or *HTTP*
   on click / change / submit. Press **Preview** and they run: set-state actions update the canvas
   immediately, so you can prototype flows without leaving the studio.
6. **Reusable components** — *Save to library* on any widget turns it into a component; drag it
   from *Your components* in the widget panel to place instances, edit the inputs per instance, or
   *Edit component* to change every copy at once.
7. **Your own CSS** — in *Styles → Custom CSS for this widget* you can **import your own `.css` or
   `.scss` file** (or paste CSS). It is attached to that widget only and lands in that component's
   `.scss` file, so it stays scoped. Global stylesheets live in the *Theme* panel and are
   registered in the exported `angular.json`. Images upload from the *Image asset* block and are
   exported to `public/assets`.
8. **Component separation** — set *Extract as component* on any widget (or choose per-widget
   granularity at export time) and the exporter creates a dedicated folder for it, with its
   content exposed as Angular signal inputs.
9. **Stay honest** — the *Checks* rail panel runs the exporter's validation over pages, components,
   state, actions and routes, and each issue jumps to the widget that caused it. *Settings* holds
   the project metadata, selector prefix and a live summary. `Ctrl+/` lists every shortcut.
10. **Export** — `Ctrl+E` opens the export drawer: choose the project name, component prefix,
   separation granularity and options, preview every generated file, then download a `.zip`.

Your work autosaves to the browser's local storage. Use **Project** in the topbar to download the
project as a `.appstudio.json` file and **Import** to load it on another machine.

### Component separation levels

| Granularity | Result |
| --- | --- |
| `page` | One component per page, widgets inline in the page template |
| `component` *(default)* | Pages **plus** every widget you marked *Extract as component* |
| `widget` | One component per widget instance — maximum separation |

---

## What an exported project looks like

```
my-app/
├── angular.json                  # styles[] includes your imported global stylesheets
├── package.json                  # Angular 22, optional Capacitor, vitest specs
├── src/
│   ├── styles.scss               # theme tokens (--as-*) + widget base stylesheet
│   ├── styles/imports/brand.css  # your imported global stylesheet, verbatim
│   ├── public/assets/logo.png    # uploaded images, as real binaries
│   └── app/
│       ├── app.config.ts         # provideRouter (+ provideHttpClient when an action needs it)
│       ├── app.routes.ts         # one lazy route per page + wildcard redirect
│       ├── core/app-store.ts     # one signal per state variable, with inferred item types
│       ├── core/breakpoints.scss # Sass breakpoint map + respond-to() mixin
│       ├── pages/home/           # home.component.ts | .html | .scss | .spec.ts
│       └── components/hero/      # extracted + reusable components, with signal inputs
└── capacitor.config.ts           # only when you tick "Add Capacitor config"
```

Generated components are idiomatic modern Angular: `standalone` by default, `OnPush`, signal
`input()`s, `ngModel` bindings on form fields, `routerLink` on internal links, `@for` loops over
state lists, `{{ store.value() }}` interpolation and handlers that actually do something:

```ts
protected onGetStartedClick(event: MouseEvent): void {
  void this.router.navigate(['/about']);
}

protected onTestimonialsClick(event: MouseEvent): void {
  this.http.request<unknown>('GET', 'https://example.com/quote').subscribe({
    next: (response) => this.store.sectionTitle.set(response as never),
    error: (error: unknown) => console.error('GET failed', error),
  });
}
```

Exported projects compile (`ng build`) and their smoke specs pass (`ng test`) — both are covered by
this repo's checks and by CI.

---

## Testing

```bash
npm test
```

- **`libs/schema`** — tree operations (insert/move/duplicate/cycle refusal), breakpoint style
  overrides, validation, migrations, the binding interpreter, state CRUD, repeaters, the component
  library and image assets.
- **`libs/widgets`** — catalog integrity, derived styles, and the render plan contract.
- **`libs/generator`** — project scaffolding, lazy routes, component extraction, the generated
  `AppStore`, `@for` repeaters, every action kind, per-component custom CSS scoping, media queries,
  global stylesheet registration, Capacitor opt-in, JSON validity.
- **`apps/builder`** — the state store (nodes, pages, state, actions, clipboard, components), plus a
  jsdom test that boots the whole shell and drives it: rendering the canvas, selecting a widget,
  editing a property, adding from the palette, resolving bindings, rendering component instances and
  running set-state actions in preview mode.

For a deeper look at how the pieces fit together, read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
