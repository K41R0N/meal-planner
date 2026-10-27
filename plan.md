# Meal Planner: Android-ready recipe book and weekly prep planner

**Historical implementation plan.** This file preserves the first personal-app scope and subsequent dated approvals. Its original planner-first opening, navigation and herb-green styling were superseded by the approved Today-first Atlantic/oyster/citrus experience. For current authority, read [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), [the documentation index](docs/README.md) and [the commercial roadmap](docs/roadmap/commercial-release.md). Future commercial work is proposed, not implemented or authorized by this historical plan.

Original status: approved personal-only implementation scope; first offline web/PWA build completed. Recipe-source collection and standalone dataset preparation were separate from app implementation.

## Repository and delivery boundaries

`K41R0N/meal-planner` remains the central repository. It is currently public. `K41R0N/pip-decks-app` is the private Storyteller Tactics reference and has been fetched for its Android card interaction patterns. Do not copy purchased Pip Decks text, rendered cards, illustrations, or category artwork into the public project. Personal preferences, edits, weekly plans, shopping check-offs and food logs remain private device data, never Git commits.

Keep the current `src/` prototype available until its replacement is accepted. Preserve its 16 recipes and 3 condiments with original IDs and raw quantities. Conflicting legacy Markdown recipes are reference material, not automatic overwrites. Imported recipe revisions must not erase user changes.

First implement the recipe bank and framework-independent planning logic, then a mobile-first offline web/PWA experience. Add an Expo/React Native Android client later in the same repository. This avoids building and maintaining two independent planners. An APK, Play Store submission, hosted AI deployment and cloud sync are not part of the first implementation unless separately selected.

## Daily experience

Four primary sections: **This Week**, **Recipe Book**, **Shopping**, and **Food Log**. The home surface opens the current saved week, not an arbitrary daily suggestion. Recipe cards from search, plans or the book open one shared recipe-detail experience.

The recipe book supports combined search, filters and sorting: recipe names, ingredients, source, categories, tags, meal type, meal-prep rating and nutrition ranges. Allow multiple categories and tags per recipe. Give the user direct editing controls; suggested organization is not a dietary judgment. “Suitable for this week” means it meets the user's selected rules, not an AI-defined definition of healthy.

A recipe detail shows ingredients and source quantities, available instructions, reported nutrition and its basis, yield, editable organization and source attribution. Portion scaling must show its basis. Missing yield, ambiguous quantities and nutrition basis need review rather than guessed conversions. If a source recipe is incomplete, show that gap beside the relevant field.

## Storyteller-inspired design

**Design movement:** a tactile, card-led personal recipe book, informed by the reference app's browse tiles, focused viewer and concise navigation.

**Core principles:** thumb-friendly actions; readable recipe content; visible weekly state; user-owned organization. Borrow interaction patterns, not the purchased deck's content or artwork.

**Color philosophy:** warm paper and dark ink establish a calm reading surface; an independently chosen herb-green action color and modest category accents distinguish meal roles. Categories are user editable and cannot rely on color alone.

**Layout paradigm:** a compact weekly overview and horizontal card shelf lead into focused recipe views; the recipe book uses dense but readable mobile cards, and shopping uses a straightforward aisle-grouped checklist. Avoid a desktop dashboard squeezed onto a phone.

**Signature elements:** rounded recipe cards with title, meal role and concise macro strip; labeled category chips; a visible portion/batch count on planned recipes. Ingredients and cooking steps are readable text, not screenshots of recipes.

**Interaction philosophy:** add to week, replace, edit portions and mark consumed are explicit actions. Do not require swiping through large carousels to complete grocery or logging tasks. A card may reveal ingredients or cooking steps, but a flip animation must never hide necessary controls.

**Animation:** brief press feedback and optional card transitions; honor reduced-motion settings. Later native haptics accompany meaningful confirmations rather than ordinary scrolling. Cooking views can later keep the screen awake through a visible preference.

**Typography:** a properly licensed reading serif for recipe titles and a readable system sans-serif for amounts, macros and actions. Obtain fonts independently; no dependency on private deck assets. Numeric data uses stable alignment and adequate contrast.

**Brand essence:** a private recipe book that turns saved recipes into an achievable week of meals. Practical, calm, personal.

**Voice:** direct and specific. Examples: “Choose this week's recipes” and “Shopping list updated for 6 portions.”

**Wordmark and mark:** retain “Meal Planner” as the working name; use a simple independent recipe-card mark. Do not copy Pip Decks branding. Signature accent: herb green, refined during implementation with the chosen card treatment.

## Recipe database and source imports

The initial Louis Howard import selects the 100 highest-viewed videos whose descriptions contain a written recipe. Rank by exact view counts collected during this run, not rounded channel counters. Preserve one source record per video; possible repeated recipe variants can be grouped later without silently changing the requested video ranking.

Store source URL, channel/video IDs, view count and collection timestamp, creator credit where available, source ingredient evidence, independently phrased instructions and extraction gaps. Full raw descriptions remain provenance files in the private preparation workspace; do not automatically publish them in the public app.

Separate reported nutrition from normalized per-serving nutrition. A source saying only “Macros” does not establish whether those values describe one serving or the whole recipe. Preserve that information and mark the basis unspecified. Never manufacture fiber, sugar, sodium, calorie values, serving counts or weights. Unknown is null, not zero. User-confirmed values and subsequent ingredient-based calculations retain their own provenance.

Standalone exports: SQLite recipe database, flattened CSV for sorting, and structured JSON for import. The SQLite schema and JSON data shape become the Android-compatible seed; CSV is a convenience export, not the source of truth. Include ingredients in separate database rows so ingredient filters and later shopping aggregation are usable.

Future sources use adapters with the same contract: discover source items, collect facts, identify written recipes, normalize, preserve attribution, propose organization, and require review for gaps. New channels or external recipe links can be added without rewriting the core schema. Do not configure an unattended crawler or recurring imports as part of this finite collection.

## Weekly meal-prep behavior

The user configures days, meal slots, people/servings and desired unique recipe counts. The old smoothie-breakfast/main-lunch/soup-dinner rules and three-day no-repeat rule become optional preferences only if still wanted; they are not silently carried into the new planner.

Generate a randomized selection from the currently eligible pool using user-selected categories, tags, ingredients and available numeric filters. Save the result, so a refresh or offline reopen cannot reroll the week. If the pool cannot meet the requested recipe count, explain which requirement cannot be satisfied and ask the user to change it. Do not relax rules invisibly.

Choose distinct recipes separately from allocation of portions and repeated meals. Batch cooking should deliberately reuse prepared portions rather than force seven different dinners. Allow locking a recipe, swapping an individual meal or replacing a whole recipe batch, and editing the serving count. Replacing one recipe should preserve the rest of the week.

Planning across a whole week is not a claim that every cooked food may be refrigerated for seven days. Storage/freezing notes require a source or user entry and stay unknown when absent. The planner can capture prep days and freezer portions without AI inventing safe storage periods.

## Shopping-list generation

Derive the list from planned servings and base recipe yields. Sum quantities only when ingredient identity and units are compatible. Preserve meaningful variants, such as low-fat versus full-fat dairy, cooked versus dry rice, and distinct cuts of meat. Allow alias corrections and manual item additions.

Convert compatible units with explicit deterministic conversion factors. Do not convert cups to grams without an ingredient-specific supported conversion. Ranges, unspecified quantities, packages and “to taste” items remain visible for review. Show which recipes contribute to each total and which amounts are incomplete.

Group by editable shopping aisle/category; support checked-off and already-have states. Regenerating after a swap recalculates totals and retains relevant manual overrides, highlighting changed quantities. Purchase pack rounding and ingredient price history are later features, not guessed first-pass arithmetic.

## Macro and calorie tracking

Keep planned nutrition separate from what was consumed. Log actual portions from a planned meal, a recipe, or a manual entry. Save a nutrition snapshot with each consumption entry so editing a recipe later does not silently rewrite historical counts.

Sum calories, protein, carbohydrates and fat where the per-serving basis is established. Expose other source-provided fields, including fiber, sugar and sodium. Incomplete totals are labeled incomplete, not treated as zero. The user owns calorie/protein targets and filter thresholds; none is prescribed by the app.

## Optional self-hosted decision layer

Research recommendation: Ollaya with a deliberately selected Apache-2.0 Laya model, behind a private app-owned adapter. GLiClass is a viable alternative if flexible multi-label classification proves more useful. See `self-hosted-recipe-ai.md` for primary sources and limitations.

The service proposes closed-set labels and organizational decisions using the recipe facts and user-selected taxonomy. Persist model/revision, taxonomy version, scores and proposed/accepted/edited/rejected status. Manual decisions override suggestions. Viewing recipes, filtering, planning and shopping work when AI is unavailable.

Do not ask the decision model to invent nutrition, ingredient amounts, allergens or storage safety. A constrained response is not proof of correctness. Hardware and serving configuration are assessed only after a host is selected; the current preparation sandbox is not presented as an always-on self-hosted service. Deployment is a separate approved action.

## Project structure

```text
meal-planner/
  src/                         # retained legacy web prototype during migration
  data/seed/                   # versioned recipes, source metadata, taxonomy seed
  packages/meal-domain/src/
    models/                    # shared types and schema validation
    catalog/                   # combined filters, ordering and ingredient search
    planner/                   # unique selection, saved allocation and replacement
    shopping/                  # quantity scaling, compatible aggregation, overrides
    nutrition/                 # basis normalization and consumed-portion snapshots
    ports/                     # storage/AI interfaces independent of UI frameworks
  apps/web/                    # card-led offline interface and IndexedDB adapter
  apps/mobile/                 # later Expo Android client and SQLite adapter
  scripts/imports/             # source adapters and standalone export tooling
  docs/                        # design decisions, data provenance, migration notes
```

The exact workspace/toolchain changes should be limited to what the first deliverable needs. Do not initialize a separate canonical app repository. Preserve the current deployment until its replacement is approved; no automatic push or publish.

## Implementation order after approval

1. Integrate the source-grounded recipe bank and preserve the legacy seed. Add stable identifiers, quantities, nutrition basis, editable taxonomy and provenance.
2. Replace the broken prototype search/filter interactions with a combined query model and a mobile-first card-led recipe book.
3. Add saved weekly plans, configurable recipe/batch counts, replacements and derived grocery lists.
4. Add consumed-portion logging and clearly labeled calorie/macro totals.
5. Connect the optional self-hosted organization adapter after a host and model are approved.
6. Build the native Android client later using the same data schema and domain rules.

Before app implementation, settle three choices: preferred weekly template and intentional repetitions; whether to retire the original strict smoothie/main/soup rules; and confirmation of offline-first PWA now with native Android later. These do not block the separately requested standalone recipe import.

## Approved implementation decisions

Approved by the user on 2026-10-26. Single-user personal mode only; no organization switching or account management. Proceed with flexible meal slots, an editable one-person seven-day template, saved repeated portions, and the offline card-led PWA now. Native Android and multi-user support remain later work. The Manus workspace is a preview/build mirror; K41R0N/meal-planner remains the source foundation and no existing deployment is replaced automatically.

## Approved upgrade — native development plugins and YouTube import

Confirmed by the user at 20:45 on 2026-10-26. Install Claude Code in this cloud workspace; use project-scoped Compound Engineering, Impeccable, the reviewed juliobsz Awwwards/Jury package and selected Vercel performance/interface skills. Record pinned source revisions and avoid native/portable duplicate installs. Installed workflows do not authorize publishing, external GitHub pushes, credential disclosure, cross-model peers, automated shipping or unnecessary libraries. Preserve the reference card design and mobile/offline goals; use critique and measured interface quality rather than cinematic effects.

Add a small Node import service under `server/` and shared source/import contracts under `packages/meal-domain/src/`. It accepts only validated YouTube video URLs/IDs, retrieves source descriptions with an available-captions fallback, calls a verified managed extraction model, validates the result, and returns a draft plus provenance for client-side review. The service never persists personal recipes, plans, targets or consumed-meal logs. Requests and model/source size are bounded; imports are explicit user actions, not unattended crawling. Unknown nutrition is never estimated. Source evidence and extraction gaps remain visible.

Add an import-review sheet in `apps/web/src/components/`, with a reusable client under `apps/web/src/`. Source acquisition, review and saving are distinct states. Retain drafts on cancellation/retry; save only after in-app confirmation. Existing video IDs route to existing recipes rather than overwriting edits. After save, open the shared detail and offer planning through existing batch/slot controls so grocery arithmetic uses the same domain engine.

Use an app-owned Web Share Target manifest where supported and a paste fallback everywhere. OS sharing requires a later published and installed PWA and is not a native APK feature. Keep service-worker caching for saved recipe/planning/shopping flows; never cache API responses or private tokens. Configure a container/backend serving declaration for eventual publication, but do not deploy. Use the same origin for relative API calls.

Keep personal-first device storage and backup version compatibility. Leave accounts, cloud sync, native APK and hosted self-hosted inference as later decisions. Existing recipe facts, credit, nutrition basis, unit-safe shopping behavior and actual-portion logging remain unchanged.
