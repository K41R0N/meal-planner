# Meal Planner

A personal, offline-first recipe book, weekly meal-prep planner, grocery list and actual-portion nutrition log. The app has one local profile, no accounts and no organization switcher. Native Android packaging and multi-user support are intentionally later work.

This evolves the existing `K41R0N/meal-planner` foundation. The original prototype remains in `src/`, and its 16 recipes and 3 condiments are retained in the new recipe bank. The Storyteller Tactics Android app informed card/navigation patterns only; its purchased deck content and artwork are not included.

## Run and build

Requires Node.js 22 and the package manager pinned in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm exec vite preview --host 0.0.0.0 --port 3000
```

The live client is in `apps/web/`. Its production build writes `dist/` and generates a versioned service worker from the actual local build assets. Serve that output over HTTPS for installation on Android. The development server does not register a service worker, to avoid stale code during editing.

After a successful first download and service-worker activation, the recipe bank and local images are available without the network. Browser storage and service workers can be restricted in private browsing or embedded previews; use an installed PWA or a normal supported browser for day-to-day offline use. Your device/browser can clear local data, so export backups regularly. Changing the host/origin creates a separate local database; export and restore a backup when moving.

## Recipe data

`apps/web/public/data/recipe-bank.json` contains 119 entries: 100 Louis Howard recipe videos plus the original 16 recipes and 3 condiments. Selection used exact, dated view counts across the channel's 242 public Shorts and required a written ingredient list below the video. Video/source links and creator credits are preserved. Source-video thumbnails are bundled locally and attributed through their recipe links, not substituted with unrelated food stock.

Reported macros are distinct from normalized per-serving values. A section saying only “Macros” does not establish a serving basis. Unknown yields, quantities and nutrition remain null. Source values are not independently verified; extraction gaps remain visible. Meal-prep ratings are user decisions, not inferred storage-safety claims. Weekly planning is not a promise of seven-day refrigerator storage.

Standalone SQLite, CSV and JSON exports are delivered separately in this task. To reproducibly create the app seed from those exports and the original recipe JSON:

```sh
python3 scripts/prepare_recipe_bank.py path/to/louis-howard-top-100-recipes.json src/data/recipes.json
```

The source extraction/export tooling and source evidence are in the separate private recipe-import bundle, not automatically published inside this app.

## Private local data

Recipes, personal edits, saved plans, targets, shopping overrides and consumption logs are stored in IndexedDB on this device, with a localStorage fallback when available. A storage failure is surfaced rather than falsely reporting a successful save. Backups/imports are explicit user actions. Personal data, SQLite databases, backups and signing keys must not enter the public source repository.

No server database or hosted AI service is required. The shared `packages/meal-domain/` package owns catalog filtering, planning, compatible-unit shopping arithmetic and nutrition snapshots. These functions and the data schema are reusable for a later Expo/React Native Android client with a SQLite storage adapter.

## Self-hosted organization layer

The proposed decision boundary targets Ollaya with Laya, with GLiClass as a tagging-focused alternative. It remains optional and disconnected in this version until a host is selected. Model suggestions must be persisted, editable and distinguishable from user decisions. Models must not invent nutrition, ingredient amounts, allergens or storage safety. Manual organization and the core app work without inference.

## Repository and deployment

`meal-planner` remains the central source project. The Manus workspace is a build/Preview mirror. No existing Netlify deployment is replaced automatically. Review and deliberately apply the included build configuration before publishing a replacement. The former static `src/` site remains available as migration reference.
