# Repository assessment — meal-planner

**Audit date:** 2026-10-26  
**Mode:** read-only. No repository files were edited; no installs, builds, deployments, copies, or pushes were performed.

## Decision in brief

**Best choice:** keep `/home/ubuntu/meal-app-workspace/meal-planner` as the one canonical repository and build a small, framework-neutral TypeScript meal-domain core first. Use that core for an offline-capable web/PWA interface now; add an Android front end later in the **same repository**. This matches the stated “native Android later, not now” boundary and avoids encoding the current prototype’s DOM or storage assumptions into the planner.

Use the private `pip-decks-app` only as an interaction and architecture reference. It is explicitly a private app whose text and images were generated from a purchased PDF [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/README.md:1-8`]. Do **not** copy its purchased card text, images, icons, fonts, visual identity, or source code into the public meal-planner repository. Adapt high-level patterns only.

The confirmed repository boundary is material: `meal-planner` is public and `pip-decks-app` is private. Therefore, commit only generic seed recipes, application code, and non-personal fixtures to meal-planner. Personal plans, preference rules, favorites, shopping check-offs, nutrition/consumption logs, local database files, and any later backups must remain on-device and out of the public repo. The current `.gitignore` only excludes `.env`; it does not itself provide a policy for local personal data [source: `/home/ubuntu/meal-app-workspace/meal-planner/.gitignore:1-3`].

## What exists today

The canonical app is a static vanilla HTML/CSS/JS prototype. Netlify publishes `src` with no build command and only a single-page fallback; this is static hosting, not an application backend [source: `/home/ubuntu/meal-app-workspace/meal-planner/netlify.toml:1-8`]. `app.js` fetches one JSON file, renders daily suggestions and a recipe catalog, and opens read-only recipe details [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:4-23`, `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:83-156`]. There is no database, account, API, local persistence, service worker, planner, shopping-list derivation, macro model, or consumption log.

The usable retained seed is `src/data/recipes.json`: **16 recipes and 3 condiments**, with unique IDs. Recipes have id, name, type, `meal_time`, tags, ingredients, instructions, and servings; condiments additionally have `pairs_with` [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/data/recipes.json:2-20`, `/home/ubuntu/meal-app-workspace/meal-planner/src/data/recipes.json:393-443`]. The prototype discards `condiments` immediately by assigning only `data.recipes` [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:11-14`], so none of the three is currently browsable.

The old roadmap is useful historical input, not current product policy. It hard-codes smoothie breakfast, main lunch, and soup dinner [source: `/home/ubuntu/meal-app-workspace/meal-planner/roadmap.md:1-4`], and calls for no repeat within three days [source: `/home/ubuntu/meal-app-workspace/meal-planner/roadmap.md:78-94`]. The latest direction instead calls for user-controlled categories/preferences and intentional repeated portions. Treat the old rules as configurable preference candidates only after confirmation; do not make either a new default.

## Current functional limits and concrete defects

| Finding | Evidence and consequence | Required migration response |
|---|---|---|
| Visible search is broken. | The static HTML has an earlier `#searchInput` inside `header` [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/index.html:13-19`], but CSS hides the entire header [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/css/style.css:77-80`]. JavaScript adds a second visible input with the same id [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:183-198`], while `getElementById('searchInput')` binds the first, hidden control [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:159-169`]. | Replace DOM-built controls with one stateful search/filter model; never duplicate ids. |
| “+N tags” expansion is inert. | `createTagsSection` attaches a listener to an in-memory element [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:43-72`] then returns `outerHTML` [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:80`]. The listener is lost when that string is injected into a card via `innerHTML` [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:29-34`]. | Render tags from component state or use event delegation; support accessible expand/collapse. |
| Filtering is narrow and non-composable. | It filters only `meal_time`, starts again from all recipes, and overwrites any text-search result [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:210-244`]. Search itself only examines name and tags, not ingredient names [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:159-169`]. | One query object must combine text, categories, editable tags, ingredients, macro ranges, sort order, and meal suitability. |
| The recommendation model is fixed and cannot meet weekly planning. | Daily selection chooses one `smoothie`, one `main`, and one `soup` based only on a date hash [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:246-278`]. It has no user constraints, chosen unique count, portions, deliberate repeats, replacement action, or aggregate shopping list. | Retire this as the planning engine. Use an explicit weekly plan and configurable schedule/preferences. |
| Macros and reliable shopping arithmetic cannot be derived from the current schema. | No recipe or condiment has nutrition/macros. Every ingredient quantity is a free-text string; examples include `1/2`, `170g`, and `1/4 tsp` [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/data/recipes.json:95-107`]. Ingredient naming also differs between rows, such as `Salmon` and `Fresh Salmon` [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/data/recipes.json:95-107`, `/home/ubuntu/meal-app-workspace/meal-planner/src/data/recipes.json:219-229`]. | Add numeric amounts, units, canonical ingredient IDs, per-serving nutrition, and explicit handling for non-additive “to taste”/purchase quantities before promising exact totals. |
| Editable content would create an injection risk. | Recipe names, tags, ingredient names, and instruction text are interpolated into `innerHTML` [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:29-34`, `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:99-126`]. Current seed is trusted, but user editing would make this unsafe. | Use framework escaping or DOM text APIs plus validation; never store rendered HTML. |
| Offline behavior is not established. | The app depends on a fetch of JSON [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/js/app.js:4-15`], has no service worker/cache, and requests Google Fonts over the network [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/index.html:7-10`]. | Bundle seed data and local font assets (with a valid license) in any offline target; define cache/storage behavior deliberately. |
| The prototype styles have drifted. | The stylesheet contains duplicated blocks and contradictory animation declarations: `.suggestion-card` is set to `animation: none` and later given `subtle-float` [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/css/style.css:830-887`]. | Do not carry the 1,185-line stylesheet forward unchanged; preserve only intentional visual decisions as named tokens. |

## Data preservation and migration guardrails

1. **Treat `src/data/recipes.json` as the initial seed to preserve**, including its 16 recipe IDs, 3 condiment IDs, tags, ingredients, instructions, serving counts, and `pairs_with` metadata. Do not silently overwrite it from the other markdown files.
2. **Resolve source conflicts with the owner before conversion.** For example, the JSON lists the Salmon Bowl salmon amount as `170g` [source: `/home/ubuntu/meal-app-workspace/meal-planner/src/data/recipes.json:91-107`], while `recipes.md` describes the same dish with `200g` [source: `/home/ubuntu/meal-app-workspace/meal-planner/recipes.md:99-114`]. The markdown collection should be retained as reference/legacy notes until each variance is adjudicated, not machine-merged into the seed.
3. **Do not use the nested zero-byte duplicate** at `meal-planner/meal-planner/src/src/data/recipes.json` as a data source. It needs cleanup only during a controlled migration after confirming no external process references it.
4. **Keep the static “essential kitchen ingredients” document distinct from a planned shopping list.** It is a useful staples/preference seed [source: `/home/ubuntu/meal-app-workspace/meal-planner/shopping%20list.md:1-97`], but it is not a computed list and must never replace plan-derived quantities.
5. Add a seed-data validation script before feature work: fixed expected counts (16/3), unique IDs, required fields, valid serving counts, valid category/tag IDs, no orphan references, and a schema/data version. This catches accidental loss during conversion.

### Target domain shape

Keep the imported seed immutable in version control and put all user changes in local storage tables/records:

- `Recipe` and `Condiment`: stable ID, title, kind, eligible meal roles, base servings, instructions, source revision.
- `Ingredient`: stable canonical ID, display name, aisle/category, aliases; `RecipeIngredient`: recipe ID, ingredient ID, decimal amount, unit, optional raw/display quantity, and a flag for non-additive or “to taste.” This is required for dependable list aggregation.
- `Category`, `Tag`, and join tables: editable local taxonomy, not hard-coded CSS labels. Categories and tags should have stable ids and display metadata; recipes may belong to multiple categories/tags.
- `NutritionPerServing`: initially nullable and explicitly sourced/verified. At minimum support calories, protein, carbs, and fat; add fibre or any other macro only after the user defines it.
- `WeeklyPlan` and `PlannedMeal`: date/slot, recipe ID, planned servings/portion multiplier, optional locked state, and replacement history if desired. A repeated meal is multiple plan rows pointing to the same recipe, not a duplicated recipe record.
- `ShoppingOverride`: checked, excluded, manually added, and purchase-quantity overrides. The shopping view itself remains derived from plan rows plus these overrides.
- `ConsumptionLog`: date/time, recipe or manual-food reference, actual servings, and a nutrition snapshot. Snapshotting preserves the meaning of old logs if a recipe’s macros are corrected later.

## Planner behavior to implement after the data foundation

The initial planner should satisfy the stated need without adding optional scope:

1. Start with a week, a **chosen number of suitable unique recipes**, and a configurable set of meal slots/preferences. Build the eligible pool using selected categories/tags, excluded ingredients, meal suitability, and only those macro conditions for which verified data exists.
2. Select exactly the requested number of distinct recipe IDs. If there are fewer eligible recipes, show that constraint rather than silently reducing uniqueness or injecting inappropriate recipes.
3. Allocate repeat occurrences and portion multipliers separately. Example: a recipe can be one of the chosen unique recipes and appear in multiple slots with a planned-serving multiplier. This makes meal prep explicit.
4. Make “replace recipe” a slot-level action: preserve the week, slot, portion count, locks, and preferences; pick a new eligible recipe; recompute the derived shopping list immediately. The replacement should not mutate the master recipe.
5. Aggregate shopping quantities from the plan, grouping only canonical ingredients with compatible units. Surface ambiguous/raw quantities for review rather than inventing conversion factors.
6. Log consumed servings against the plan or as an independent entry, then sum the nutrition snapshots for the day/week. Do not imply macro tracking accuracy until nutrition data is supplied and attributed.

Favorites and a separate “nicer recipes” label are reasonable optional local flags later, but should not displace the above core flow.

## Reusable reference patterns — allowed adaptation only

The reference app has a coherent offline, Android-oriented interaction system, but its specific deck identity belongs in the private project. Reuse these **patterns**, not its protected content/assets/fonts/code or branded visual language:

- **A compact semantic token layer.** The reference groups paper/ink/muted text, radii, card aspect, shadows, and category-derived states in one theme module [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/src/lib/theme.ts:9-25`, `/home/ubuntu/meal-app-workspace/pip-decks-app/src/lib/theme.ts:118-127`]. For meal-planner, create independent tokens (surface, text, divider, action, success/warning, spacing, radius, elevation) rather than copying its cream palette, category hues, card proportions, or EB Garamond font. Those values are explicitly derived from the purchased deck [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/src/lib/theme.ts:3-8`, `/home/ubuntu/meal-app-workspace/pip-decks-app/README.md:139-145`].
- **Card UX worth adapting.** A compact tile has a press-scale response, eyebrow metadata, title, short caption, and optional status badge [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/src/components/CardTile.tsx:20-68`]. For meals, use this for recipe cards: image/photo only if separately licensed, meal role/category, title, key macros, prep servings, and planned/favorite state. The reference’s generic image overlay/caption composition is reusable as a pattern, but not its illustrations or specific diagonal deck treatment [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/src/components/Figure.tsx:31-67`].
- **Navigation structure worth adapting.** Its home screen uses a useful “continue” strip, a horizontal primary choice row, and clear secondary paths [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/app/index.tsx:35-75`]. Map that to **This Week**, **Recipes**, **Shopping**, and **Log**. Use one recipe-detail route/viewer so cards from library, plan, search, and shopping all open the same detail surface; the reference demonstrates a centralized sequence/view route [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/src/lib/sequences.ts:19-24`, `/home/ubuntu/meal-app-workspace/pip-decks-app/app/view.tsx:9-25`].
- **Filtering/navigation affordances worth adapting.** Segmented modes, collapsible groups, category stripes, and two-column compact cards are clear mobile patterns [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/app/browse.tsx:23-78`]. For this app, use them for sort/filter summaries, editable taxonomy sections, and ingredient/category result groups—not for borrowed deck categories or icons.
- **Feedback and accessibility.** The reference makes controls semantic buttons with labels and expanded touch targets [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/src/components/ScreenHeader.tsx:8-22`, `/home/ubuntu/meal-app-workspace/pip-decks-app/src/components/PillButton.tsx:21-52`]. It calls light impact haptics when a carousel page changes and selection haptics on a flip [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/src/components/Viewer.tsx:59-75`]. In the meal app, reserve optional, setting-respecting haptics for meaningful actions such as plan generated, recipe replaced, serving marked consumed, or shopping item checked—not ordinary scrolling. Do **not** copy the reference’s deliberate override of Android “Remove animations” for its card flip [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/src/components/FlipCard.tsx:17-21`]; meal-planner should respect reduced-motion preferences.

## Offline storage approach for Android later

The reference uses `expo-sqlite` key-value storage for one last-position record [source: `/home/ubuntu/meal-app-workspace/pip-decks-app/src/lib/storage.ts:1-34`]. That is a good proof that an offline Android app can persist data, but it is **not sufficient** for editable recipes, plans, aggregation, and logs.

For an Expo/React Native Android front end later, use a structured SQLite database (for example, the same `expo-sqlite` family) behind repository interfaces, with versioned SQL migrations and transactions. Seed from the bundled, versioned recipe JSON on first launch; preserve personal edits as local overrides rather than overwriting them on a seed update. Store the local database outside Git and provide an explicit private export/import only if the user later asks for backup. For a web/PWA shell, use an equivalent IndexedDB-backed repository; both call the same pure domain functions.

If the later Android UI is Kotlin/Jetpack Compose instead, use Room/SQLite with the same schema and domain rules. The storage principle does not change: no backend is present today, and none is required for a one-person, offline-only experience. Cloud sync would be a separate privacy/security project and cannot be placed in the public repo by accident.

## Single-repository module proposal

Do not split to another main repository. Migrate deliberately inside the canonical repository:

```text
meal-planner/
  src/                         # current static prototype; retain until replacement is accepted
  data/
    seed/
      recipes.v1.json          # validated, versioned 16-recipe/3-condiment import seed
  packages/
    meal-domain/
      src/
        models/                # types and validation
        catalog/               # filter, sort, suitability
        planner/               # unique selection, slot replacement, portion allocation
        shopping/              # aggregate compatible ingredients
        nutrition/             # per-serving and log calculation
        ports/                 # repository interfaces; no DOM, Expo, or database imports
  apps/
    web/                       # later PWA UI and IndexedDB adapter; no personal DB committed
    mobile/                    # later Expo Android UI and SQLite adapter, if this option is chosen
  scripts/
    check-seed-data.mjs
  docs/
    data-governance.md
    migration-decisions.md
```

The existing `src/` static site can be kept as a visual/data reference during the transition. Once the replacement is accepted, decide whether it becomes `apps/web/` or is retired, then update Netlify’s `publish` setting deliberately. Do not start with a workspace/toolchain rewrite solely for the sake of the directory structure.

## Android scope choice — do not implement until selected

| Choice | When it is best | Consequence |
|---|---|---|
| **Recommended: shared domain first, web/PWA now, Expo Android later** | Native Android is explicitly deferred but the planner/data model needs validation now. | Pure TypeScript planner, filter, shopping, and nutrition logic can be tested once. The later Android app gets its own Expo/React Native UI plus SQLite adapter in `apps/mobile`; the public web shell keeps personal state on-device. The reference proves the general Expo Router/SQLite/haptics approach is viable, but no code or assets are copied. |
| **Native-first now: Android Compose/Room (or Expo) before a web replacement** | The app will only ever be used on one Android phone and the owner accepts native work now. | Strongest Android ergonomics sooner, but it conflicts with “later, not now” and either forgoes the current web interface or creates two front ends earlier. Choose Kotlin/Room if Android-native maintenance is preferred; choose Expo if a future cross-platform UI is desired. |

## Initial questions that materially affect the architecture

1. Which first interface is wanted: an installable offline web/PWA now with Android native later (recommended), or immediate Android native work? This selects the first storage adapter and UI boundary.
2. What meal slots are actually configurable (days, meals per day, snacks, sides, condiments)? Are smoothie/main/soup defaults still wanted at all, and is the old three-day no-repeat rule a preference, an option, or retired?
3. Does “chosen suitable unique recipe count” apply to all recipes, only main dishes, or each meal role? How should repeats be allocated: user-entered portions per occurrence, a weekly servings target, batch-cook portions, or a mix?
4. Which suitability rules must the random planner honor first: category/tag inclusion, ingredient exclusions/allergies, meal role, prep time, equipment, budget, macro thresholds, or no-repeat spacing? Which rules can it relax, if any?
5. What exactly are the macro fields and their source of truth? Confirm calories/protein/carbs/fat (and whether fibre or other values are required), units, per-serving basis, and whether values will be manually entered or imported later. No current source has nutrition data.
6. How accurate must shopping aggregation be? Confirm preferred units and whether the user will normalize aliases/conversions and ambiguous quantities such as “to taste,” packages, or bunches. This determines whether the list is arithmetic, review-first, or both.
7. Are editable categories/tags private device settings only, or should they ever sync/back up? Any cross-device answer changes the privacy model; personal logs and preferences must not enter the public Git repository.

## Suggested delivery order

1. Confirm the seven decisions above and reconcile JSON-versus-markdown ingredient discrepancies.
2. Define and validate the seed/domain schema; implement the catalog library with editable local categories/tags, ingredient search, and macro-aware sorting only where data exists.
3. Implement the weekly planner, unique selection, portioned repeats, per-slot replacement, and derived shopping list.
4. Add nutrition values and consumption logging after the macro source/units are confirmed.

This produces the requested core without inflating scope into favorites, price tracking, AI suggestions, localization, cloud sync, or a native Android build before those choices are made.
