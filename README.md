# Meal Planner

A personal-first, Android-oriented recipe book, weekly meal-prep planner, grocery list and actual-portion nutrition log. It now imports YouTube recipe text into an explicit review-and-save flow, while saved recipes, planning, shopping and cooking steps remain usable offline. No accounts, organization switcher or cloud sync in this version. Native Android packaging and multi-user support are later work.

This evolves `K41R0N/meal-planner`. The original prototype is preserved in `src/` and `legacy/`, and its 16 recipes and 3 condiments are retained. Storyteller Tactics informed card/navigation patterns only; no purchased deck content or artwork is copied.

## Run and build

Requires Node.js 22, the pinned pnpm version, Python 3 and `yt-dlp` 2026.10.26 for online imports.

```sh
corepack enable
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt
pnpm typecheck
pnpm test
pnpm build
IMPORT_API_ENABLED=true pnpm exec tsx server/index.ts
```

The last command serves `dist/` and the API on port 3000. For frontend editing only, `pnpm dev` starts Vite; it does not provide the import API. For backend editing after a client build, `pnpm dev:server` watches the Node service. The shipped container installs the Python extractor into `/opt/recipe-tools` and uses a scrubbed child environment with that path first. A plain local checkout uses the project’s `.venv/bin` after the container tool path, then falls back to system Python; no inherited provider secrets enter the child environment.

The live client is in `apps/web/`; shared catalog, planning, unit-safe shopping and nutrition logic is in `packages/meal-domain/`. `pnpm build` creates `dist/` and a versioned offline worker from actual assets. Serve over HTTPS for Android PWA installation. The development Vite server does not register the worker.

## YouTube → recipe → week → groceries

Use **Recipe Book → Import from YouTube**. Paste a secure video link. The server reads the written description first; if that is insufficient it tries available captions, preferring manual captions. No video/audio media is downloaded. Anonymous YouTube access can be blocked or captions can be unavailable; paste creator-provided recipe text as the explicit fallback.

The request returns a draft, not a saved recipe. Review title, ingredients, amounts/units, steps, yield, meal roles, tags/categories and reported nutrition. Unknown values remain null. Source text and creator links remain visible. Confirm a serving basis only if supported; the app never estimates nutrition from ingredients. Existing video IDs open the saved recipe without overwriting edits. Cancellation and return-to-review retain the draft within the browser session.

After saving, the shared recipe detail offers **Use in your saved week**. Choose an unlocked batch or compatible meal slot. Shopping then recalculates from planned servings and base yields, retaining check-offs only for unchanged requirements. Set an unknown yield explicitly before expecting scaled grocery quantities. **Start cooking** provides step progress, ingredient checks and optional screen-awake access; it never logs consumption automatically.

The PWA declares an Android-compatible Web Share Target, with pasted-link fallback. OS sharing requires a later published and installed origin; this is not an Android APK or a claim that OS sharing works inside Preview.

Endpoints: `GET /api/health`, `GET /api/import/capabilities`, `POST /api/recipes/preview` with `{url, sourceText?}`. Runtime model credentials are read only by the server from the documented managed environment. The server does not persist personal recipes, plans or logs. Requests, concurrency, text and subprocess output are bounded. The Docker image intentionally defaults `IMPORT_API_ENABLED=false` until production access controls and release are approved. Do not expose a paid public import endpoint without an access policy.

## Data and offline privacy

The initial bank has 119 entries: the 100 highest-viewed Louis Howard videos with written recipes plus 16 original recipes and 3 condiments. Exact view counts are a dated snapshot, not live rankings. Source links/credits and locally bundled video thumbnails are retained. Reported macros remain distinct from confirmed per-serving values; “Macros” alone is not a serving basis. Ratings and prep suitability are user decisions, never invented storage-safety claims.

Recipes, edits, plans, grocery checks, targets and consumption snapshots are stored on-device in IndexedDB, with a localStorage fallback. There is no server database. JSON backup/restore and recipe-bank imports support up to 32 MB. Export before clearing browser data or changing origins/devices. Browser session draft recovery is not cross-device sync. Newly imported source images may require a connection; saved recipe text and core planning/cooking remain offline.

After successful first download/worker activation, bundled recipes and images work without network. Private browsing, embedded Preview and device storage eviction can restrict persistence or offline behavior. Use a published/installable PWA in a supported browser for daily use and keep backups. The worker bypasses API responses and never caches credentials.

Standalone SQLite/CSV/JSON recipe exports were delivered separately. Source-collection raw files stay in the private preparation workspace, not public application assets. To regenerate the seed:

```sh
python3 scripts/prepare_recipe_bank.py path/to/louis-howard-top-100-recipes.json src/data/recipes.json
```

## Development tools and later Android

Native Compound Engineering and Impeccable plugins, explicit native packages of the pinned Awwwards/Jury skills, and two Vercel project skills are installed for the current cloud workspace. Version/source locks and an explicit `node scripts/setup-agent-tools.mjs` restoration command are included. Hooks, inline skill-shell execution, peers, Live mode and auto-shipping are disabled. See `docs/development-plugins.md` for verified installation and the available Anthropic account's native-model credit limitation. These are development tools, not runtime dependencies.

`PRODUCT.md` and `DESIGN.md` preserve the approved card-led identity. The shared domain/data contracts are reusable for a later React Native/Expo Android client with SQLite. Ollaya/Laya (or a tagging-focused alternative) remains optional and unhosted until a host is selected; core flows do not require it.

## Repository and release

`meal-planner` remains the central source project. The Manus workspace is the build/Preview mirror; no current GitHub or Netlify deployment is replaced automatically. This phase does not publish or push to the user's GitHub. Review/apply the source branch and deliberately choose release/access controls later. A static-only Netlify build of `dist/` provides offline core flows but not the Node import API; the prepared managed deployment uses a static frontend plus a container API.
