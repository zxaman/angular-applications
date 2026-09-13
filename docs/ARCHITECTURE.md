# Architecture

This document explains *why* AppStudio is shaped the way it is. For usage, see the
[root README](../README.md).

---

## 1. Goals and constraints

| Goal | Consequence for the design |
| --- | --- |
| Users design an app visually | The document, not code, is the source of truth |
| Exported code must be maintainable by hand | Real standalone components, idiomatic Angular, no runtime "player" library in the output |
| Users can bring their own CSS per component | Styles must be attachable to a single node and survive export |
| The studio is a responsive website | One Angular app, no native shell; panels adapt to the viewport |
| Preview must match the export | A single render contract shared by canvas and generator |

The last point is the load-bearing decision. Most builders of this kind render a preview with one
mechanism and generate code with another, and the two drift. Here they share `RenderPlan`.

---

## 2. Monorepo strategy

**npm workspaces, libraries consumed as source.**

```
apps/builder  ──(tsconfig paths)──▶  libs/{schema,widgets,generator,ui}/src
```

Alternatives considered:

- **Nx** — powerful, but it adds a dependency graph daemon, generators and a plugin ecosystem to a
  repo with four libraries and one app. The same boundaries are expressible with path mappings.
- **Angular CLI libraries (`ng-packagr`)** — designed for publishable packages. These libraries are
  internal, and pre-bundling them would add a build step plus FESM artefacts for no benefit.
  `libs/widgets` and `libs/generator` are framework-agnostic TypeScript and would be awkward in
  `ng-packagr` anyway.
- **A single app with folders** — loses the enforced dependency direction, which is the main thing
  keeping the generator honest.

Because the libraries are consumed as source, `tsconfig.base.json` is the single place where the
dependency contract lives, and each library typechecks itself in isolation (`npm run typecheck`).

The strict direction `schema ← widgets ← generator` matters:

- `schema` has **zero** dependencies — it is pure data and pure functions, trivially testable.
- `widgets` depends only on `schema` types; it contains no Angular imports.
- `generator` depends on both and never touches the DOM, `localStorage` or Angular.
- `ui` is the only Angular library; it is presentational chrome only.

That is why the exporter can run in the browser (zipping a blob) and from Node
(`npm run export:sample`) with identical output.

---

## 3. The document model (`@appstudio/schema`)

```ts
AppDocument
├── version: number                 // bumped by migrateDocument()
├── meta                            // name, description, author, timestamps
├── theme: ThemeTokens              // exported as --as-* custom properties
├── globalStyles: StyleFile[]       // user imported global .css/.scss
├── assets: AssetFile[]             // uploaded images (base64), exported to public/assets
├── state: StateVariable[]          // app variables the document can bind to
├── components: ComponentDef[]      // reusable components and their inputs
├── pages: PageDef[]                // name, route, title, root: AppNode
└── settings                        // component prefix, default breakpoint, capacitor flag

AppNode
├── id / type / name
├── componentName?                  // set ⇒ extracted into its own component on export
├── instance?                       // { componentId, props } ⇒ a reusable component, not a subtree
├── props: Record<string, scalar>   // widget properties; string values may hold {{ state.x }}
├── repeat?: RepeatConfig           // iterate a list over the node and its subtree
├── actions?: NodeAction[]          // navigate / openUrl / setState / http on click|change|submit
├── style: CssMap                   // base styles
├── styles?: { sm?, md?, lg?, xl? } // per-breakpoint overrides (mobile first)
├── css? / cssFileName?             // stylesheet imported for THIS node only
└── children: AppNode[]
```

Bindings are **plain strings**, not a parallel AST: any string property or piece of text may contain
`{{ state.counter }}` or `{{ item.name }}` inside a repeater. `state.ts` parses them into a
`BindingContext`, which the canvas uses to resolve values live and the generator uses to emit
`{{ store.counter() }}` / `[attr]="'x' + store.value()"`. One representation, two consumers, nothing
to keep in sync.

Rules that keep this model cheap to work with:

1. **Everything is JSON.** No class instances, no cycles, no functions. Autosave is one
   `JSON.stringify`; import is one `JSON.parse` + `migrateDocument`.
2. **Mutations return new documents.** Every helper in `tree.ts` is non-mutating, so the editor can
   push the previous document straight onto the undo stack without defensive copies at call sites.
3. **One styling channel.** Widget properties that imply CSS (grid columns, spacer size, image
   height…) are compiled into `node.style` by `widgets.derivedStyle()` at edit time. The generator
   therefore only ever reads `node.style` — no second, parallel styling system.
4. **Migrations are forward-only and stepwise**, so a project saved by an older studio still opens.

---

## 4. The render contract

`widgets.renderPlan(node)` reduces a node to a tag-level description:

```ts
interface RenderPlan {
  tag: string;             // 'div' | 'button' | 'input' | …
  attrs: Record<string, string>;
  classes: string[];       // ['as-button', 'button-1a2b3', 'is-primary', 'is-lg']
  text?: string;
  html?: string;           // literal markup (icons)
  children?: RenderPlan[];
  void?: boolean;
  node: AppNode;           // which node produced this element
}
```

- **Canvas** walks the plan with `Renderer2` and creates real elements, nesting a child
  `studio-node-view` component wherever `child.node.id !== node.id`. That distinction is how sub
  parts (a card's header, a field's label) stay part of their owner while real children stay
  individually selectable and draggable.
- **Generator** emits Angular templates from the same node tree, adding what a static preview
  cannot express: `ngModel`, `routerLink`, `(click)` handlers and `[attr]` bindings.

Classes follow a fixed convention so generated SCSS has stable selectors:

- `as-<type>` — the widget's base class, styled once in the shared base stylesheet.
- `<type>-<idSuffix>` — unique per node, carries that node's own styles.
- `is-<variant>` — modifier classes derived from props (`is-primary`, `is-lg`, `is-on`…).

---

## 5. Generator pipeline

```
AppDocument ──▶ planProject() ──▶ ComponentPlan[] ──▶ emit ──▶ GeneratedFile[]
                     │                                     │
                     │  decides component boundaries        ├─ .ts   (class, inputs, handlers)
                     │  and nesting                         ├─ .html (Angular template)
                     │                                      ├─ .scss (node styles + user CSS)
                     └──────────────────────────────────────┴─ scaffold (angular.json, routes, …)
```

1. **`planProject`** is the only place where "component separation" is decided:
   `page` → pages only; `component` → pages + nodes with `componentName`; `widget` → every node.
   It walks depth first so a child's owning component always exists before the child is planned,
   and de-duplicates class names through a `NameRegistry`.
2. **`emitTemplate`** turns each plan into a template. Text properties of a component's own root
   node become `{{ input() }}` reads; everything else is literal.
3. **`emitComponentClass`** writes the class: signal `input()`s for *bindable* properties, a
   `model` record when the subtree contains form fields, `onSubmit` when it contains a form, and a
   stub handler per button.
4. **`emitComponentStyles`** writes the stylesheet: base rule, breakpoint overrides as
   `@media (min-width: …)` blocks, then the node's imported CSS **verbatim**. The walk stops at
   child component boundaries, so no style is emitted twice.
5. **`scaffoldFiles`** writes project-level files, including the user's global stylesheets under
   `src/styles/imports/` registered in `angular.json`'s `styles[]`.

### Which properties become component inputs

`widgets/bindable.ts` lists the properties that are *compiled away* — `variant` (a class),
`columns` (a CSS variable), `label` (the canvas empty state), `tag` (the element name). Exposing
them as inputs would produce dead code, so `buildInputs` filters them out. Content properties
(`text`, `title`, `src`, `placeholder`, `options`…) stay bindable.

### Why generated projects ship an `.npmrc`

npm 10.9.x aborts installs while resolving vitest's optional `jsdom` peer set
(`Cannot read properties of null (reading 'edgesOut')`). Exported projects include
`legacy-peer-deps=true` so `npm install` works out of the box on npm 10 and 11.

---

## 6. Styling strategy

Three layers, in increasing specificity:

1. **Theme tokens** — `themeCss()` emits `--as-*` custom properties. The canvas scopes them to
   `.as-root`; the export scopes them to `:root`.
2. **Widget base stylesheet** — `baseCss()` from a single `BASE_STYLES` table. Injected into the
   canvas at runtime and written verbatim into the exported `src/styles.scss`. One table, two
   consumers, no drift.
3. **Node styles and user CSS** — `node.style` per breakpoint, then the imported stylesheet.

Because Angular scopes component styles to the component, an imported stylesheet attached to a
widget cannot leak into the rest of the app. Global stylesheets, by contrast, are registered in
`angular.json` and are genuinely global — the two mechanisms are deliberately different.

---

## 7. Responsive strategy

- **Mobile first.** Overrides live under `sm/md/lg/xl` and are emitted as `min-width` media
  queries, matching the `BREAKPOINTS` table in `schema`.
- **The canvas is not a viewport.** A 390px-wide `<div>` does not trigger CSS media queries, so
  `core/responsive.ts#resolveStyle()` resolves base + applicable overrides for the selected
  breakpoint and applies them as inline styles. The frame width comes from the same table, so
  what you see is the breakpoint you are editing.
- **The studio UI is responsive too.** Above 1280px the layout is three columns; below that the
  side panels slide over the canvas and start closed; below 640px the rail collapses to icons.
  `App` listens to `matchMedia('(max-width: 1280px)')` to set the initial panel state.

---

## 8. State management

One signal store (`BuilderStateService`) plus two thin services:

- `PersistenceService` — debounced autosave to `localStorage`, project import/export,
  schema migration on load.
- `ExportService` — a `computed()` over `(document, options)`, so the export drawer re-generates on
  every keystroke; only zipping is async.

Every mutation funnels through `commit()`, which snapshots the previous document for undo/redo
(capped at 60 entries) and flags the project dirty. Selection, viewport and panel state are
deliberately *outside* history — undoing a click would be maddening.

A third computed layer sits on top: `previewState` walks the tree, evaluates `{{ state.* }}`
bindings against `doc.state` and runs set-state actions when *Preview* is on, so the canvas shows
real values instead of placeholders. `state.issues` runs the same `validateDocument()` the exporter
runs, which is what powers the *Checks* panel — one source of truth for "will this export cleanly".

The app is **zoneless** and uses signal inputs/outputs throughout, with `OnPush` everywhere.
The canvas rebuilds a subtree with `Renderer2` when its node input changes; selection changes only
propagate `selectedId` downwards, so clicking around does not rebuild the DOM.

---

## 9. Adding a widget

Everything a widget needs lives in one definition:

```ts
// libs/widgets/src/definitions/content.ts
{
  type: 'callout',
  label: 'Callout',
  category: 'content',
  icon: 'info',
  description: 'Highlighted note.',
  isContainer: false,
  maxChildren: 0,
  defaultProps: { text: 'Note', tone: 'info' },
  defaultStyle: { padding: '12px 16px' },
  propSchema: [
    textProp('text', 'Text'),
    selectProp('tone', 'Tone', [{ label: 'Info', value: 'info' }], 'appearance'),
  ],
}
```

Then, in order:

1. `styles.ts` — add `.as-callout` (and any `is-*` modifiers) to `BASE_STYLES`.
2. `render.ts` — add a `case 'callout'` returning a `RenderPlan`.
3. `template.ts` (generator) — add the matching Angular markup, with bindings if it needs them.
4. `bindable.ts` — list props that compile away rather than becoming inputs.
5. `style-sync.ts` — only if a prop implies CSS.

The palette, inspector, canvas preview and exporter pick the widget up automatically.

---

## 10. Known limitations and roadmap

- **Actions cover four kinds** (navigate, open URL, set state, HTTP). Routing conditions,
  authentication flows, delays and loops are not modelled yet, and set-state values are literals or
  static bindings rather than arbitrary expressions.
- **No two-way preview of hand edits.** Importing an exported project back into the studio is not
  supported; the `.appstudio.json` document is the interchange format.
- **Image assets are stored in the document** as base64, which is convenient (one file to save and
  move) but means a large upload inflates the saved project; an object-storage variant would be the
  next step for production use.
- **Canvas hit testing** uses midpoint comparisons rather than true flex/grid gap awareness, so
  drop positions in dense grids can be approximate.
- **Capacitor** is generated as configuration only (`capacitor.config.ts` + dependencies); running
  `npx cap add android|ios` is left to the developer, which keeps the exported web project clean.
