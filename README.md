# Angular Applications — Monorepo

One Angular workspace containing **multiple applications + shared libraries**, managed with the Angular CLI.

> Created with `ng new --no-create-application` so the repo starts as a pure workspace — every app/lib lives under `projects/`.

## 📁 Structure

```
angular-applications/
├── angular.json            # workspace config — all apps & libs registered here
├── package.json            # single root package.json + monorepo scripts
├── tsconfig.json           # root tsconfig with path aliases for libs (e.g. shared-ui)
├── projects/
│   ├── web-app/            # demo app 1 — public site (serves on :4200)
│   │   └── src/app/
│   │       ├── app.routes.ts
│   │       └── pages/home, pages/about
│   ├── admin-app/          # demo app 2 — admin panel (serves on :4201)
│   │   └── src/app/
│   │       ├── app.routes.ts
│   │       └── pages/dashboard, pages/users
│   └── shared-ui/          # shared library — reusable standalone components
│       └── src/
│           ├── public-api.ts          # 👈 public surface; export everything here
│           └── lib/
│               ├── button/button.ts         # <lib-button>
│               ├── page-header/page-header.ts # <lib-page-header>
│               └── shared-ui.ts             # <lib-shared-ui>
└── dist/                   # build output (git-ignored)
```

## ✅ Prerequisites

- **Node.js 22** (check with `node -v`)
- **npm 11+** — ⚠️ npm 10 fails installing this workspace (`Cannot read properties of null (reading 'edgesOut')`). Upgrade once with:
  ```bash
  npm install -g npm@11
  npm -v   # should print 11.x
  ```

## 🚀 Getting started

```bash
# 1. Install (once, at repo root)
npm install

# 2. Run the demo apps (each in its own terminal)
npm run start:web-app     # http://localhost:4200
npm run start:admin-app   # http://localhost:4201  (admin runs on 4201 to avoid clash)

# 3. Build
npm run build:shared-ui   # build the library  -> dist/shared-ui
npm run build:web-app     # build web app      -> dist/web-app
npm run build:admin-app   # build admin app    -> dist/admin-app
npm run build             # build everything (lib first, then apps)
```

## 📜 Scripts

| Script | What it does |
|---|---|
| `npm run start:web-app` | Serve `web-app` on `:4200` |
| `npm run start:admin-app` | Serve `admin-app` on `:4201` |
| `npm run build:shared-ui` | Build `shared-ui` library |
| `npm run build:web-app` / `build:admin-app` | Build one app |
| `npm run build` | Build lib + all apps |
| `npm run watch:shared-ui` | Rebuild lib on change |
| `npm run test:web-app` / `test:admin-app` / `test:shared-ui` | Unit tests per project |
| `npm run generate:app` | Shortcut for `ng generate application` |
| `npm run generate:lib` | Shortcut for `ng generate library` |

## ➕ Add a new application

```bash
# scaffold (routing + scss recommended)
ng generate application my-app --routing=true --style=scss

# serve / build it
ng serve my-app
ng build my-app
```

Then add convenience scripts to `package.json`:

```json
{
  "start:my-app": "ng serve my-app --port 4202",
  "build:my-app": "ng build my-app"
}
```

> Give each app its own port when serving in parallel: `--port 4200/4201/4202…`.

## 📚 Add a new library

```bash
# scaffold
ng generate library my-lib --prefix=lib

# use it in an app
# 1. export from projects/my-lib/src/public-api.ts
# 2. import in the app:
#      import { Something } from 'my-lib';
# 3. build: ng build my-lib
```

Path aliases live in root `tsconfig.json` → `compilerOptions.paths`. This repo maps libs to **source** (`./projects/shared-ui/src/public-api.ts`) so apps can `ng serve` without building the lib first. `ng build my-lib` still produces the publishable package in `dist/`.

## 🧩 Add components / services to a specific project

```bash
# component inside web-app
ng generate component pages/contact --project=web-app

# component inside the shared library (export it from public-api.ts!)
ng generate component card --project=shared-ui --prefix=lib

# service inside admin-app
ng generate service core/auth --project=admin-app
```

## 🔗 Sharing code between apps

1. Put reusable UI/services/utils in a library under `projects/` (e.g. `shared-ui`).
2. Export it from that lib's `src/public-api.ts`.
3. Import by alias in any app: `import { Button, PageHeader } from 'shared-ui';`
4. Both demo apps already do this — see `projects/web-app/src/app/pages/home/home.ts`.

## 🧪 Testing

```bash
ng test web-app      # vitest for one project
npm run test:web-app # same via npm script
```

## 🏗️ How it works

- `angular.json` → `projects` registers every app/lib; `newProjectRoot: "projects"` keeps scaffolding organized.
- One `node_modules` + one `package.json` at the root — dependencies are shared across all projects.
- Each app has independent routing, `main.ts`, `index.html`, and build output (`dist/<app>`), so apps deploy separately while sharing code.
- Libraries are built with `ng-packagr` (`dist/<lib>`) and can also be published to npm if needed.

## ❓ FAQ

**Q: Do I need Nx?**
No — this is a native Angular CLI monorepo, which is enough for multiple apps + shared libs. If you later need affected-builds, module boundaries, or micro-frontend orchestration, you can migrate to Nx (`npx nx init`) without restructuring `projects/`.

**Q: `npm install` fails on npm 10?**
Upgrade to npm 11+: `npm install -g npm@11`. (npm 10's arborist crashes resolving `vitest`/Angular 22 peer sets.)

**Q: How do I remove a demo app?**
Delete `projects/<app>`, remove its entry from `angular.json` → `projects`, and drop its `references` in `tsconfig.json`.
