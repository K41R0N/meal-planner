# Mealbook strategy

Updated October 27, 2026. Mealbook is the working product name; trademark, domain and store-name clearance are not complete.

## The customer and the job

Build for busy adults who already save recipes and want to prep toward calorie and protein goals, but struggle to find cooking time and turn their collection into a useful grocery run. Start with the individual's needs, not teams, coaches or switchable organizations. English-speaking consumers, US-first, are the initial research market—not evidence of demand worldwide.

**The offering hypothesis: Your recipes. A prep week that fits your goals and your time. One shopping list.**

A successful week is one the person can shop for and actually cook, not simply seven filled calendar columns. A recipe imported from a creator becomes a reviewed, owned library entry; a few realistic cooking opportunities become useful prepared portions; compatible ingredients become one explainable list. The app helps recover when the week changes.

## What is already decided

The app opens **Today's recipe**, with a state-matched next action whether the person has cooked it yet or not. The four main destinations are Today, My week, Recipe book and Shop. History, goals, importing, settings and advanced organization remain secondary. Card identity and the Atlantic/oyster/citrus language apply to desktop and Android alike. `PRODUCT.md`, `DESIGN.md` and [the interaction contract](docs/experience/interaction-contract.md) own these delivered behavior rules.

Planning, cooking, available prepared portions and actual eating remain separate. The user controls recipe labels and suitability; unknown facts stay unknown. Personal recipe access, correction and export must not become subscription leverage. Native Android is the first proposed commercial client alongside responsive web; an account is useful for sync and entitlements, not a reason to block the local cooking loop.

## What we can credibly sell later

Recurring automation is the paid-value hypothesis: selection and practical portions that fit numeric targets, cooking opportunities and user constraints; explainable changes when the week is disrupted; compatible ingredient reuse; and reuse of actual ready food. Capture helps activate the product, but a useful second and fourth week must justify renewal.

The existing app implements the personal execution loop, filtered/randomized batch suggestions, purchase-aware groceries, sourced nutrition and a bounded online recipe-review importer. It **does not** implement full-day numeric goal fitting, a reviewed ingredient-to-nutrition calculation service, native Android packaging, cloud accounts/sync or paid entitlements. Do not market those as shipped. See [current capability and gaps](docs/roadmap/commercial-release.md).

## Competitive position

The dated [15-product benchmark](docs/research/market/benchmark.csv) shows paid demand for adjacent jobs, not a forecast for this product. CookBook already combines documented YouTube capture, manual planning, macro targets and groceries. Eat This Much competes on goal-based automation; MealPrepPro on prep and portion workflows; ReciMe on capture. FoodiePrep is a smaller close challenger. No claim that “nobody else does this” is supported.

The proposed differentiation is a **reliable capture-to-prep-to-shop-to-eat loop using the person's recipes**, not merely collecting those features. Exact unknowns in competitors' imported-library planning and technical stacks are not proof of missing functionality. The [market report](docs/research/market/commercial-strategy.md) and [six deeper audits](docs/research/competitors/production-patterns.md) retain sources and uncertainty.

## Free, paid and trust

The recommended Free tier supports a personal book, manual planning, groceries, cooking, actual logging, correction and export. Pro earns its price through proven automation and optional sync. Import allowances, trial length and prices are test proposals, not approved live billing: initially evaluate $7.99/month or $49.99/year, 5 successful assisted imports/month Free and 50/month Pro, with a 14-day trial. Competing free allowances and cost-to-serve may justify changing them. [Subscriptions](docs/commercial/subscriptions.md) owns the proposed entitlement and expiry rules.

Do not move already-delivered personal functionality behind a paywall in this pass. Product packaging for a new commercial cohort needs explicit approval and a migration promise for any existing users.

## The role of decision models

Ollaya/Laya may make recipe organization and preferences more useful or less costly. It is an optional implementation experiment, not the customer's promised outcome or a proven moat. Arithmetic and hard eligibility belong to deterministic code; nutrition requires cited source or reviewed calculation data. Model proposals remain editable and reversible. [The evaluation plan](docs/architecture/decision-models.md) determines whether to adopt, change or omit the model.

## How to decide whether to continue

Run a proposed six-week paid pilot with 30 qualified participants after the safety and product gates are satisfied. Predeclare directional decisions: 20 reach a usable week, 12 return to prepare another, 8 actually pay after the trial and 5 renew once. These are team hypotheses from the market research, not industry benchmarks or promised outcomes. Record denominators and reasons for dropout; a small selected group does not estimate mass-market conversion.

The core measure is a **repeat useful prep week**: confirmed plan, usable shopping activity and at least one completed cooking session, with actual eating optional and tracked separately. Do not count an import, a calendar visit or a paid trial as equivalent. Retention and actual payment must precede scaling acquisition.

## What we will not become first

Not a medical nutrition service, an allergen-safety authority, a social recipe network, a creator-content scraper marketplace, a coach dashboard or a universal video-understanding tool. No automatic seven-day storage guarantees. No unlicensed paid public catalog. No paid claim that every YouTube video will import.

[The roadmap](docs/roadmap/commercial-release.md) sequences commercial work and [the release gates](docs/release/production-readiness.md) define required evidence. Approving this strategy documentation is not permission to activate billing, provision providers or publish the app.
