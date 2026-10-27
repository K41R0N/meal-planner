# Decision registry

Updated October 27, 2026. This registry preserves **why** the app has its present shape and distinguishes direction from implementation. A future change must update the owning document and add a dated rationale; it must not silently reinterpret an old approval.

## Approved product and source decisions

**D001 — One central foundation.** `K41R0N/meal-planner` remains the source of truth. The original prototype is retained in `src/` and `legacy/`; the evolved client lives in `apps/web/` and reusable logic in `packages/meal-domain/`. A separate design repository is a reference, not a runtime dependency. Chosen over starting an unrelated app. Approved October 26; source integration authorized October 27.

**D002 — Personal first, users later.** The first working product has no organization switcher or account requirement. Commercial accounts and subscriptions are future individual-user boundaries, not a reason to introduce organizations. Chosen to make the owner's everyday prep loop usable before multi-user infrastructure. Owners: `PRODUCT.md`, [production blueprint](../architecture/production-blueprint.md).

**D003 — Today opens first.** The user identified cooking time and grocery efficiency as the hardest jobs and chose Today's recipe as the opening view. This replaced the planner-form-first experience. A card retains identity across cooking and eating; state changes the action rather than hiding the recipe. Owners: `PRODUCT.md`, [interaction contract](../experience/interaction-contract.md).

**D004 — Cards are cross-platform.** Card-led recipe identity and useful Storyteller Tactics interactions apply to web as well as Android. The approved Atlantic/oyster/citrus visual direction is distinct, not a copy of purchased deck content. Owners: `DESIGN.md`, [card system](../reference/card-system.md).

**D005 — Cooking is not logging.** Plans, cooking sessions, immutable prepared-food snapshots and consumption records are separate. Cooking completion records yield; explicit consumption changes availability and nutrition history; Undo reverses both. Chosen to avoid counting intended food as eaten or retroactively changing history after a recipe edit. Owner: [experience contract](../experience/interaction-contract.md).

**D006 — Source evidence beats invented completeness.** Written recipe quantities, yield and nutrition basis are retained. Missing facts remain unknown. Source-reported values are not independently verified facts. Safe unit compatibility and user confirmation beat plausible guesses. Owners: `PRODUCT.md`, [ingestion reference](../reference/source-ingestion.md), [data architecture](../architecture/data-and-sync.md).

**D007 — Source integration authorized; app release separate.** On October 27 the owner explicitly directed “Just push to main” after the proposed access/asset holds. Push the complete existing source bundle to `K41R0N/meal-planner` main normally, preserving history and using Netlify's documented `[skip ci]` marker; no additional source-asset or deployment-settings approval is a prerequisite for this push. Do not initiate app publication or change deployment settings. This instruction does not establish creator rights or approve a paid public catalog; commercial rights/release work remains documented separately. Owner: [source integration and release control](../release/source-integration.md).

**D008 — Public competitor evidence only.** Audit ReciMe, Eat This Much, MealPrepPro, CookBook, Samsung Food and Paprika deeply while preserving the 15-product benchmark. Do not infer private runtime/database/billing suppliers from public features. Approved October 27. Owner: [competitor synthesis](../research/competitors/production-patterns.md).

**D009 — Optional self-hosted decisions.** Evaluate Ollaya/Laya for tagging and ranking behind a replaceable adapter. Core use cannot depend on it; exact arithmetic, medical/allergy/storage claims and recipe facts are not delegated to it. Model installation and hosting remain unapproved. Owner: [decision models](../architecture/decision-models.md).

## Proposed commercial decisions, not implementation approvals

**P001 — Free ownership plus paid automation.** Free book/manual loop/export; Pro numerical planning, time-aware adaptation and optional sync. Exact quotas and grandfathering require product approval. Current personal functionality remains unchanged by this documentation pass. Owner: [subscriptions](../commercial/subscriptions.md).

**P002 — Price and trial experiment.** $7.99 monthly / $49.99 annually, 14 days and finite clearly disclosed assisted imports. Competing offers, measured cost and repeat-week value may change the proposal. No SKUs, checkout, trial or payment provider is configured. Owner: [go-to-market](../commercial/go-to-market.md).

**P003 — Android plus responsive web.** Reuse framework-neutral domain logic; evaluate Expo/React Native and SQLite for Android while retaining the web client. Backend, database, identity, billing and hosting vendors remain candidate decisions. No native app exists yet. Owner: [production blueprint](../architecture/production-blueprint.md).

**P004 — Trustworthy numeric planning.** Build a nutrition provenance and completeness layer, then practical portion/recipe fitting with explicit scope and infeasibility. Do not relabel current randomization or maximum-calorie filters as optimization. Owner: [commercial roadmap](../roadmap/commercial-release.md).

## Open decisions and their exit evidence

**O001 — Commercial source/content permission.** Before a paid public catalog, obtain a permitted-source strategy and documented creator/image rights, or replace the research seed with owned/licensed recipes. Credits alone do not resolve redistribution. Owner role: product/legal; evidence: asset/source rights register.

**O002 — Providers and operating budget.** Choose identity, authoritative database, synchronization and billing only after a scoped architecture review. Compare managed-platform capabilities and independent services on isolation, recovery, cross-client support, cost and portability. Owner role: engineering; evidence: accepted ADR and cost envelope.

**O003 — Guest-to-account and paid data migration.** Specify explicit consent, duplicate handling, account collision and logout/delete behavior before implementing sync. Owner role: engineering/product; evidence: migration design and restore/isolation tests.

**O004 — Planning and nutrition coverage.** Decide supported whole-day versus partial-day goals, nutritional matching provenance and supported uncertainties. Owner role: product/nutrition engineering; evidence: reviewed fixtures and per-day residual tests.

**O005 — Model value.** Choose a decision runtime only if held-out accuracy, abstention, latency and cost beat the baseline. Owner role: ML/engineering; evidence: versioned evaluation report, not model marketing.

**O006 — Release business readiness.** Confirm publisher identity, store access, support, privacy documents, billing terms, content rights, name clearance and the paid-pilot recruitment plan. Owner role: founder/operator; evidence: completed release gates. Documentation is not legal certification.
