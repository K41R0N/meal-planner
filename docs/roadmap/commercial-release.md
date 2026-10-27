# Roadmap to a competitive commercial release

Updated October 27, 2026. This is a proposed sequence, not a promise of ship dates. **Implemented** means in the current personal web/PWA code; **approved direction** means the user chose the product architecture; **proposed gate** needs validation; **release blocker** prevents the corresponding public promise. Each stage ends with evidence, not an assumed date.

## 0 — Preserve the working personal foundation

**Implemented:** A Today-first recipe book with 119 initial entries, a bounded YouTube description/caption review flow, filtered/randomized weekly suggestions, cooking-session recovery, immutable ready portions, actual consumption with Undo and purchase-aware shopping. Version-one backups and on-device operation remain supported. Cards work on mobile and desktop. `PRODUCT.md` and [the implementation evidence](../experience/implementation-evidence.md) describe the present behavior.

**Not implemented:** Native Android client, account/sync, server personal-data store, subscription entitlement, verified nutrition calculation or numerical full-day macro-goal solver. Existing per-recipe numeric filters do **not** imply a weekly target match. In the 100 imported-channel entries, the dated research recorded 65 with normalized calories and protein, 55 with all four macros, 58 with source yield and only 42 with all four macros plus yield; these are coverage counts, not nutrition verification. See [market research](../research/market/commercial-strategy.md).

**Gate:** Document the foundation and verify clean build/backup behavior. No new commercial claims, checkout or public creator-catalog distribution.

## 1 — Make recipes and nutrition trustworthy

**Proposed:** Define source provenance and quality levels (`creator-reported`, `user-entered`, `dataset-calculated`, `verified by reviewed process`, `unknown`) with serving basis, yield, ingredient identity, preparation state, dataset/version and edit invalidation. Add a reviewed food-data calculation pipeline only after unit conversion, edible portion and yield tests can make its numbers honest. Users correct extraction before save. Source recipes without sufficient information remain cookable but cannot count toward a numeric-goal proof.

**Source reliability work:** Build a creator-permission and content-rights register. Test distinct video formats on a permissioned sample; record failure rate, caption access, review corrections, time and cost per successful import. Add equivalent allowed text/URL/manual sources. Support request limits, cancellation, duplicate IDs, missing recipes and attribution. YouTube's official arbitrary-public caption download is not assumed. Source access policy and actual licensing are separate gates.

**Gate:** A representative held-out set meets predeclared source-fidelity, ingredient/unit, yield and serving-basis review thresholds. Report denominators and abstention instead of inventing a pass percentage. Public launch cannot ship the existing creator research bank as a licensed starter set without rights review. Owner roles: engineering, product, nutrition reviewer, rights/legal.

## 2 — Prove the repeatable week and numeric-goal engine

**Proposed:** Make scope explicit: whole-day calories/protein only when all intended meals and external food allowances are represented; partial-day planning shows remaining targets rather than an invented full-day fit. Start from time available, desired prepared portions, preferences and known nutrition. Use deterministic constraints/optimization for acceptable portion increments, recipe variety, grocery compatibility and existing ready-food inventory. Show per-day deviation, reasons and failed constraints; user controls hard eligibility and soft overlap, not an opaque model.

A second week must reuse existing prepared food without making historical cooking or shopping records mutable. Do not equate ingredient overlap with actual cash savings when package prices and waste are unknown. Measure usefulness in a real sequence: save, review, plan, shop, cook, eat/skip, recover, repeat. Correct false matches and unavailable cooking times before advertising automatic plans.

**Gate:** Held-out scenarios demonstrate feasible and impossible goals, partial-day disclosure, unknown macros/yield, locked recipes, edited recipe composition, leftovers, changed cooking windows, allergy exclusions and purchase invariants. A supervised pilot demonstrates users can reach a usable second week. Owner roles: domain engineering, product/nutrition and UX research.

## 3 — Add accounts, Android, sync and authoritative entitlements

**Approved direction, not built:** Native Android is prioritized, sharing `packages/meal-domain/` contracts with web; responsive web remains useful. Guest recipes and cooking should not vanish when accounts arrive. Evaluate Expo/React Native and local SQLite as candidates. Specify guest-to-account consent and collision resolution, per-user ownership, opt-in sync, offline writes and deletion/export. Preserve existing version-one backups. Operate a protected import API with account-level quotas and abuse budgets before exposing it publicly.

**Proposed paid capability:** Keep personally entered recipes, manual planning, grocery and cooking/consumption accessible without renewal. Test a Pro tier for repeat-week automation and optional sync. The [subscription design](../commercial/subscriptions.md) covers trial, purchase, restore, refund, cancellation, grace, expiry and accounting reconciliation. Pro quotas and prices are hypotheses, not a deployed paywall.

**Gate:** Android physical-device and interrupted-network tests, source/backup migration/restore, no cross-user data leakage, purchase/expiry/refund webhooks and support exercises pass in staging. Production owner, privacy documents, publisher accounts and budget limits exist before inviting paid users. Owner roles: mobile/backend engineering, operations, billing and privacy.

## 4 — Closed commercial pilot before broad marketing

**Proposed:** Recruit 30 qualified, permission-based testers through creators or communities that allow participation. Spend two weeks observing the actual loop, then offer a transparently priced, cancellable 14-day paid experiment. The proposed team decision rules from the research are 20 usable weeks, 12 second weeks, eight actual payments and five first renewals by roughly week six. These are directional thresholds for a small selected sample, not forecasts.

Instrument only consented, minimal events: source attempt/blocked/review completion, usable first/second week, list action, cooking start/completion, target fit/uncertainty, refund/cancel/renewal and all-in cost to serve. Avoid collecting recipe text or personal dietary details in generic telemetry. Interview dropouts about time saved and cleanup effort; do not infer adoption from download count.

**Gate:** The [production readiness register](../release/production-readiness.md) is signed off, support can recover billing/data incidents, and actual payment+renewal evidence informs whether to scale. If people import but do not cook a second week, improve the loop rather than adding more AI marketing. Owner roles: founder/operator, product, privacy, engineering, support.

## 5 — Release and growth, only after the gates

**Proposed:** Offer Android and responsive web with accurate store descriptions, honest import support/limits, clear plan terms, support/contact, export and deletion paths, compliant attribution and documented incidents/rollback. Demonstrate a real recipe-to-week-to-groceries result. Creator partnerships require permission and measured acquisition cost. Improve onboarding and repeat-week value before paid acquisition; household, coach and organizational modes remain later hypotheses, not a prerequisite for launch.

**Out of scope for this approval:** Creating a store listing, taking payments, publishing the website, launching an inference host, transferring private creator content into a public paid seed or running outreach. A GitHub `main` update is source integration only. [Source integration safeguards](../release/source-integration.md) must protect the existing Netlify deployment.
