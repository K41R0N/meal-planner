# Repository map

## Orientation

`meal-planner` is a personal-first web/PWA application with an optional Node import API. The current product has local browser storage and a checked-in seed; it is not a multi-user service and does not contain a server database. `README.md`, `PRODUCT.md`, and `DESIGN.md` are the starting points for product, run/build, and approved design decisions.

The working application source is `apps/web/`, shared recipe/planning logic is `packages/meal-domain/`, and the optional import/static server is `server/`. The old prototype is intentionally retained in `src/` and `legacy/`; it is context, not the active UI implementation.

| Area | Role | Treat as source of truth? |
| --- | --- | --- |
| `apps/web/` | Active React client, PWA public files, app entry, browser persistence, experience UI | Yes, for the shipped client |
| `apps/web/src/experience/` | Current card-led experience shell, navigation, cooking, planning, and styling | Yes, for approved interface implementation |
| `apps/web/src/components/` | Import, recipe detail/book, planning, shopping, log, and shared view components | Yes, for client features outside the experience shell |
| `apps/web/public/data/recipe-bank.json` | Versioned 119-entry seed loaded by the client | Yes, for the checked-in seed snapshot |
| `packages/meal-domain/src/` | Shared recipe types, validation, catalog/filtering, nutrition, planning, shopping, and YouTube URL parsing | Yes, for domain contracts and deterministic logic |
| `server/` | Optional HTTP server, import route, media-free YouTube provider, managed recipe extractor, static serving | Yes, for the import API |
| `scripts/` | Build helpers: seed preparation, font preparation, service-worker generation, developer setup | Yes, as build/tooling code; inspect inputs before rerunning |
| `tests/` | TypeScript test coverage for domain, experience, storage, and import behavior | Yes, as regression evidence |
| `docs/` | Product, implementation, integration, and reference documentation | Yes, as documented decisions/evidence |
| `tools/recipe-import/` | Portable metadata collection and seed export utilities | Yes, for offline/tooling workflows; not runtime code |
| `dist/` | Generated production client output | No; regenerate with `pnpm build` |
| `src/`, `legacy/` | Preserved original prototype and supporting records | No for new active UI work |
| `tooling/`, `.claude/`, `.claude-plugin/` | Development-tool pinning, notices, and optional agent/editor configuration | No runtime dependency |

## Client structure and data flow

`apps/web/src/main.tsx` boots the React client. `App.tsx`, `useMealbook.ts`, storage helpers, and `mealbook-contract.ts` connect the browser UI to the shared domain. The client uses IndexedDB for the primary local book, plans, prepared batches, grocery coverage/history, profiles, and logs, with recovery checkpoints in local storage. This is device-local state; it is not synchronized by `server/`.

The seed at `apps/web/public/data/recipe-bank.json` has `schemaVersion: 1` and 119 records. It is application-ready rather than a raw collection dump. Each record uses the shared `Recipe` shape: identity, roles/tags/categories, ingredients, steps, yield, normalized and source-reported nutrition, nutrition basis/evidence, provenance, image reference, timing, user-reviewable meal-prep fields, data gaps, and add time. One hundred records have `youtube:` IDs and historical view snapshot metadata; nineteen `legacy:` records intentionally lack external-view provenance.

`packages/meal-domain/src/types.ts`, `validation.ts`, `nutrition.ts`, `catalog.ts`, `planner.ts`, `batch-planner.ts`, `shopping.ts`, and `purchase-list.ts` supply the corresponding rules. Import-specific contracts live in `import-types.ts`; secure URL parsing is in `youtube.ts`. Keep business rules here rather than duplicating calculations in a React component or the server.

The card-led user interface is centered in `apps/web/src/experience/`:

- `MealbookUI.tsx` renders the four primary destinations, Today state, cooking continuation, dialogs, and support rails.
- `RecipeWorkspace.tsx` handles the recipe book, visible filters, pagination, recipe editing, and manual entry.
- `HistoryWorkspace.tsx` and `WindowEntry.tsx` cover secondary historical/planning editing contexts.
- `controls.tsx` provides shared labeled buttons, dialogs, card construction, image labeling, time, and macro facts.
- `mealbook-ui.css` owns the Atlantic/oyster/citrus tokens, responsive navigation, card anatomy, focus, state treatments, and reduced motion. `recipe-workspace.css` adds workspace-specific responsive controls.

The active interface intentionally keeps Today, My week, Recipe book, and Shop primary. History/goals, settings/backup, importing, and advanced organization are secondary contexts.

## Optional import API

The browser’s `RecipeImport.tsx` and `import-client.ts` call the Node server only for a single source preview. The server does not read/write the browser’s personal book and does not persist user recipes, planning, shopping, or logs.

```text
Browser URL / optional pasted text
  -> POST /api/recipes/preview
  -> server/app.ts validation, origin guard, rate/concurrency bounds
  -> server/youtube-provider.ts public metadata / fallback captions (no media download)
  -> server/recipe-extractor.ts managed-model draft extraction
  -> source-evidence normalization and shared validation
  -> review draft returned to browser
  -> explicit user edits and Save into local browser state
```

`server/app.ts` owns request limits, rate limiting, import enablement, cross-site rejection, and public error envelopes. `server/youtube-provider.ts` invokes `yt-dlp` in a stripped environment with skip-download, time/output limits, and no cookie/account flow. `server/recipe-extractor.ts` uses the managed endpoint only on the server and verifies structured output/evidence before constructing a draft. `server/index.ts` wires API routing and safe static file serving from `dist/` (or `STATIC_ROOT`).

Server environment keys are intentionally few: `IMPORT_API_ENABLED`, `STATIC_ROOT`, `PORT`, and the managed endpoint/key pair named in `.env.example`. The Docker image builds the client, creates an isolated Python environment for `yt-dlp`, and defaults online import to disabled. A static host can serve `dist/` and the offline core but cannot supply the Node import API.

## Build, checks, and generated files

The package scripts in `package.json` are authoritative:

```sh
corepack enable
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` runs `scripts/prepare-fonts.mjs`, TypeScript checking, Vite build, and service-worker generation. It creates `dist/`, including copied public data/assets and hashed client assets. Do not hand-edit `dist/`. The font helper is intentionally resilient: if the licensee’s permitted General Sans download is unavailable, the CSS system-sans fallback keeps the app usable.

`scripts/prepare_recipe_bank.py` is the historical app-seed integrator, not a portable new-collection pipeline. Its input is an external source export and the legacy recipe list; it expects 119 total records and may fetch public source thumbnails. The portable, non-networked `tools/recipe-import/export_bank.py` is the appropriate way to validate/export the checked-in seed without touching application data.

## Data and documentation boundaries

Raw metadata/descriptions, historic collection manifests, parsed source evidence, and old export bundles were kept in a separate preparation workspace and are not public application assets. The checked-in seed carries enough app-facing provenance to show source links/credits and historical snapshot fields, but it is not a license grant for the source text, thumbnails, or research materials.

`docs/reference/` explains these boundaries; `docs/experience/` preserves approved contracts and design rationale. Consult the component and test files before treating any prose as proof of runtime behavior. Conversely, do not mistake an existing test, generated asset, or local workspace file for approval to publish content, enable paid import, or add features outside the current scope.
