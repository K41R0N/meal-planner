# Integration review — Mealbook

**Scope:** Read-only review of `TODO.md` and the available `plan.md` (the requested `approvedplan.md` is not present), focused on the completed offline-first, personal PWA. No packages, browser session, source files, Git state, or deployment were changed. The previously reported typecheck/test/build results were not repeated.

## Findings

### H1 — A user cannot choose a replacement for an entire prepared batch

**Evidence:** `apps/web/src/components/PlanBuilder.tsx:73` exposes only **Swap batch**, whose callback reaches `apps/web/src/App.tsx:161-166`. That calls `replaceBatch(plan, recipeId, recipes, filters)` with no selected candidate. `packages/meal-domain/src/planner.ts:249-278` chooses the candidate internally with `pick(candidates)` at line 274. The recipe-detail “Add to selected slot” flow only permits a one-slot replacement that keeps the exact distinct-count unchanged (`apps/web/src/components/RecipeDetails.tsx:27-32,90`; `apps/web/src/App.tsx:169-177`). Thus, for a repeated old recipe A in a three-recipe plan, choosing a new recipe D from the book for one occurrence would temporarily create four distinct recipes and is blocked; the user cannot deliberately replace every unlocked A occurrence with D.

**Impact:** This defeats the requested intentional batch swap for the common meal-prep case; the only full-batch change is random.

**Minimal fix:** Add a candidate-aware domain operation such as `replaceBatchWith(plan, oldRecipeId, replacementRecipeId, recipes, filters)`. In the recipe detail (or a batch-swap chooser), offer it only when the candidate satisfies every affected role, all affected meals are unlocked, the configured exact distinct count is preserved, and the candidate passes stored filters. Retain meal IDs, dates, servings, and unaffected slots. Keep the current randomized action as an optional “random replacement.”

### H2 — Checked/owned grocery items remain completed after their required quantity changes, without any warning

**Evidence:** Shopping check state is only `Record<string, 'checked' | 'owned' | null>` (`packages/meal-domain/src/types.ts:120`) and is stored by a stable `planId:item.key` string (`apps/web/src/App.tsx:181`; `apps/web/src/components/Shopping.tsx:55`). The item key is based on normalized ingredient name/unit rather than amount (`packages/meal-domain/src/shopping.ts:97-100`), and `Shopping.tsx:55` marks any matching state as done without comparing quantity, contributors, or review status. A targeted in-memory probe changed a meal from 1 to 2 servings: its key remained `shopping:tomato:g`, while the list changed from `1 g` to `2 g`.

**Impact:** After a serving edit or swap changes a previously checked item, the list can still show it done. The shopper may underbuy; this also misses the approved requirement to retain relevant state *while highlighting changed quantities*.

**Minimal fix:** Persist an item fingerprint/value snapshot alongside the check state (at least display quantity, review flag, and contribution signature). On regeneration, retain the state only if that snapshot matches; otherwise clear/downgrade it and render a “quantity changed — review” marker. Keep manual items plan-scoped as they are.

### M1 — Imported and restored source links are not validated as safe HTTP(S) URLs

**Evidence:** `packages/meal-domain/src/validation.ts:145` and `277` accept `sourceUrl` through `nullableText`, which checks only that it is nonempty plain text (`lines 40-41`). The detail view directly uses that value as an anchor target at `apps/web/src/components/RecipeDetails.tsx:87`. A targeted validation probe successfully accepted `javascript:alert(1)` as `sourceUrl`; the bundled 119-record seed itself currently contains only valid HTTPS video URLs.

**Impact:** A malformed or hostile recipe-bank/backup import can present an unsafe or nonsensical “Open original source” link. This is especially avoidable because backups/imports are validated before device storage.

**Minimal fix:** Add a `nullableHttpUrl` validator using `new URL`, accepting only `https:` (and optionally `http:` for explicitly allowed local development), rejecting credentials and invalid URLs. Use it for app and converted-import source URLs; treat bad links as a file-validation error before restore/merge.

### M2 — Backup validation treats timestamp fields as arbitrary text and leaves shopping-state references untyped

**Evidence:** `recipe()` validates `addedAt` and `viewCountAt` with `text()` (`packages/meal-domain/src/validation.ts:149,157`), and plan/log `createdAt` likewise uses `text()` (`lines 453,468`). `manualShopping()` accepts every object key as a plan ID with no membership check (`lines 472-489`), and `shoppingChecks` likewise accepts arbitrary keys (`lines 516-524`). The targeted probe accepted `not-a-date` / `not-a-timestamp` for recipe and plan metadata. Recipe references and `activePlanId` are correctly checked (`lines 435-447,506-507`), so the gap is limited to these remaining fields.

**Impact:** A structurally corrupt backup can be reported as restored even when recency/sorting metadata is invalid and manual shopping data is keyed to a non-existent plan, making it unreachable in the UI.

**Minimal fix:** Validate metadata with an ISO timestamp parser (or a documented date-time format) and reject invalid values. Require every `manualShopping` key to match an existing plan ID; validate shopping-check keys against the plan/item-key scheme or deliberately prune/report stale keys during restore.

### M3 — The food log stores other nutrients but never exposes them after logging

**Evidence:** Nutrition snapshots preserve all seven macro keys (`packages/meal-domain/src/nutrition.ts:10,35-40,50-58`). The Food Log collects all fields for a manual entry (`apps/web/src/components/Log.tsx:40`), but daily/weekly totals and each saved log row iterate only `primaryMacros` (`lines 31-33,41,43`). Therefore non-null fiber, sugar, and sodium snapshots are saved but cannot be viewed in Food Log.

**Impact:** This misses the required exposure of other source-provided fields and prevents a user from reviewing those values after a meal is logged.

**Minimal fix:** Add an “Other nutrients” disclosure to daily/weekly totals and each entry, rendering fiber, sugar, and sodium when known with the same incomplete-coverage labeling. Keep calories/protein/carbs/fat as the compact default.

## Verified behavior outside the findings

- **Seed content:** `apps/web/public/data/recipe-bank.json` contains exactly 119 distinct IDs: 100 `youtube:` and 19 `legacy:` records; all have ingredients, 117 have written steps, no placeholder names were detected, all seed source URLs are HTTPS, and 100 source thumbnails are local `/images/` assets.
- **Offline/PWA and privacy:** production-only registration is present (`apps/web/src/main.tsx:10-16`). `scripts/generate-sw.mjs:11-27` derives the precache from the actual `dist` files, excludes maps/the generated worker, handles only same-origin GET requests, and never sends personal state over the network. The inspected `dist/sw.js` includes the app bundle, recipe bank, manifest, icons, and local images. Personal state is in IndexedDB/localStorage (`storage.ts:5-37`), not the cache.
- **Core week, shopping, and nutrition rules:** generator code preserves saved plans and enforces roles, valid locks, and exact distinct counts (`planner.ts:145-212`); shopping uses yields and only explicit compatible conversions while marking unknown/ambiguous quantities for review (`shopping.ts:90-180`); consumption takes immutable per-serving snapshots and labels incomplete primary totals (`nutrition.ts:28-96`, `Log.tsx:39-43`).
- **Personal-only/deferred scope:** no account or organization selector is present in the reviewed UI/state; AI remains a documented, disconnected interface rather than a core dependency. No native Android/APK, hosted AI, source push, or deployment issue is requested or implied.

## Conclusion

There are **two high-severity daily-use workflow defects** (chosen batch swaps and stale checked grocery quantities) plus three medium-severity validation/nutrition-visibility defects. Addressing these targeted changes should preserve the approved single-user offline-first PWA scope without adding native, hosted AI, account, or deployment work.

## Resolution — 2026-10-26

All five findings above were addressed before handoff. `state-utils.ts` provides a user-selected whole-batch replacement that preserves meal IDs, portions, roles, locks and distinct-count rules. The recipe detail exposes that action alongside single-slot changes. Grocery checks are reconciled against previous quantities/review status after plan or recipe changes; changed items are unchecked and marked with their prior amount while the session remains open.

Recipe/source imports now reject unsafe URL schemes, embedded credentials, invalid timestamps, out-of-range meal-prep ratings and shopping references that do not belong to saved plans/current grocery items. The Food Log exposes fiber, sugar and sodium for each snapshot and for daily/weekly totals with coverage labels.

Additional concrete fixes canonicalize per-serving nutrition from explicitly confirmed whole-recipe values/yield, recalculate when yield changes, prevent unknown-basis values from entering totals, preserve comma separators while entering multiple tags/ingredient filters, and avoid mistaking ingredient descriptors for units during manual entry. Ingredients, cooking steps and shopping aisles are editable without discarding retained source evidence.

Final evidence: `pnpm typecheck` passed; `pnpm test` passed 15/15 tests; `pnpm build` completed and generated the real production offline cache. The running Preview returned HTTP 200 for app/routes/manifest/worker/bank; its actual browser rendered 119 recipe cards without a persistence warning. A read-only browser check confirmed an active service worker with 110 cached requests (root plus 109 local build assets). No consumption entries or test plans were written during that browser check. Native Android packaging, hosted inference and multi-user support remain explicitly deferred.
