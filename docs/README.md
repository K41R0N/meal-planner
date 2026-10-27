# Mealbook documentation

Updated October 27, 2026. Begin with [the product truth](../PRODUCT.md), [strategy](../STRATEGY.md) and [commercial roadmap](roadmap/commercial-release.md). This repository contains a working personal app and a plan for a commercial product—not a commercially released service.

## Which documents decide what?

| Question | Canonical document | Status |
|---|---|---|
| What does the personal app actually do? | [PRODUCT.md](../PRODUCT.md) and [implementation evidence](experience/implementation-evidence.md) | Delivered core behavior; limitations explicit |
| Who is it for and why might they pay? | [STRATEGY.md](../STRATEGY.md) | Product direction plus commercial hypotheses |
| What did we approve, propose or leave open? | [Decision registry](decisions/README.md) | Durable approval boundaries |
| What is the next release milestone? | [Commercial roadmap](roadmap/commercial-release.md) | Proposed stage gates, not dates |
| How should cards, hierarchy and interactions work? | [DESIGN.md](../DESIGN.md), [card system](reference/card-system.md), [interaction contract](experience/interaction-contract.md) | Approved cross-platform direction |
| What architecture would support commercial users? | [Production blueprint](architecture/production-blueprint.md), [data and sync](architecture/data-and-sync.md) | Candidate seams/vendors, not services provisioned |
| What data or model input is retained where? | [Data lifecycle and inference register](architecture/data-lifecycle.md) | Current behavior plus unapproved retention proposals |
| How do Free/Pro and store events behave? | [Subscriptions](commercial/subscriptions.md) | Proposed packaging and authoritative ledger rules |
| What role could Ollaya/Laya have? | [Decision models](architecture/decision-models.md) | Optional measured experiment, no deployment |
| How do we acquire and retain customers? | [Go-to-market](commercial/go-to-market.md) | Pilot and channels proposed, not executed |
| Can we launch? | [Production readiness](release/production-readiness.md) | Unchecked release evidence gates |
| How can users bring their own assistant? | [Agent architecture](architecture/agents/README.md), [tool contract](reference/agents/tool-contract.md), [permissions](architecture/agents/permissions-and-trust.md) | Approved design, no live MCP/account API |
| Which clients work and how does this scale? | [Dated client/competition evidence](research/agent-integrations/README.md), [scaling](architecture/agents/scaling-and-operations.md), [future implementation plan](plans/2026-10-27-1205-feat-agent-friendly-mealbook-plan.md) | Research and proposed milestones, not tested endpoint availability |
| Can we push source without publishing? | [Source integration](release/source-integration.md) | Explicit deployment controls and evidence |
| How do I reproduce source ingestion and exports? | [Source ingestion](reference/source-ingestion.md), [reference tools](../tools/recipe-import/README.md) | Existing boundary plus portable finite tools |
| What needs licensing or removal? | [Provenance and licenses](reference/provenance-and-licenses.md) | Rights inventory, not permission |
| Where is the implementation? | [Repository map](reference/repository-map.md), [root bootstrap](../README.md) | Buildable source; private Pip Decks repo not needed |

## Competitive evidence

The [market report](research/market/commercial-strategy.md), [15-product benchmark CSV](research/market/benchmark.csv), [coverage measurements](research/market/current-product-gaps.json) and [price sensitivities](research/market/pricing-scenarios.csv) preserve the October 27 research. Downloads, ratings, third-party estimates and subscription prices are not actual paid-user counts.

Six deeper audits cover publicly documented profiles, subscriptions, recipes, storage/sync, technical evidence, upselling and marketing:

- [ReciMe](research/competitors/recime.md)
- [Eat This Much](research/competitors/eat-this-much.md)
- [MealPrepPro](research/competitors/mealpreppro.md)
- [CookBook](research/competitors/cookbook.md)
- [Samsung Food](research/competitors/samsung-food.md)
- [Paprika](research/competitors/paprika.md)
- [Cross-app production patterns](research/competitors/production-patterns.md)

These are public-evidence audits, not account/checkout tests or private architecture reverse engineering. Dated policies and expired jobs remain dated signals. Unknown internals or untested flows are not missing features.

## Durable working practice

[The commercial documentation plan](plans/2026-10-27-1100-docs-commercial-foundation-plan.md) records this knowledge-work scope, implementation units and verification. [TODO.md](../TODO.md) retains historical acceptance outcomes; an old no-push statement applies to its earlier task, not the newly authorized main source integration. [The scoped documentation review](release/documentation-review.md) records consequential corrections and honest execution limits. Durable lessons are kept in their owning decision, rights and release documents rather than duplicated as generic learning files.

Update the owning contract when behavior changes; add a dated decision rather than rewriting the history of a recommendation as an approval. Keep historical research reports intact, with corrections clearly labeled. A prospective commercial plan is not authorization to activate providers, bill users or publish the app.
