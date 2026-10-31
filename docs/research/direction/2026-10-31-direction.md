# Direction from the October 31 evidence pass

October 31, 2026. Owner request: use the marketing harness, the ICP harness and the Ideabrowser connector to settle the app's direction, then build the infrastructure it needs. This file records what each source said, how strong it is, and the direction that follows. It changes no gate in [the roadmap](../../roadmap/commercial-release.md) and does not change the offering hypothesis in [STRATEGY.md](../../../STRATEGY.md). The decision is [D016](../../decisions/README.md).

Evidence tiers follow [the evals register](../../evals/README.md): `measured`, `observed`, `operator`, `reference`, `inferred`, `simulated`. Repeating a claim across derived documents does not make it independent.

## The question

Which direction should Mealbook commit to now, and which infrastructure does that direction require first? In scope: the product's distinctive job, who it is for first, the build order, and the infrastructure seams. Out of scope: price, a public position statement, channels and any contact with people. The marketing method forbids settling an offer, a position or a price from desk research alone, and this pass is desk research.

## What each source contributed

### Ideabrowser

- **Market data (`reference`, keyword level).** Among Ideabrowser's tracked keywords, "recommended daily protein intake" is a breakout (12,100 monthly searches, +6,775%) and "macro tracker for weight loss" is rising (1,300, +39%). There is no tracked keyword for meal prep, batch cooking or recipe-to-shopping-list. This shows growing search interest in protein targets. It does not show demand for a prep planner, or for Mealbook.
- **Market insights (`reference`, generated).** The only relevant curated insight is "GLP-1 Friendly Meal Planning & CPG" (high-protein recipes and grocery builds for GLP-1 users), with no audience evidence attached. No insight covers people who save recipes and prep for the week.
- **Idea database (`simulated`).** Searching "meal planning" and "recipe" returns 28 distinct generated ideas. Every one scores 8 or 9 for opportunity and for pain, so the scores do not separate good ideas from bad ones. The one closest to Mealbook ("adaptive meal app that syncs with GLP-1 cycles") claims "no direct competitors" without checking any. That claim is contradicted by [the 15-product benchmark](../market/commercial-strategy.md), and its medical framing is excluded by STRATEGY's non-goals. Generated ideas are not counted as evidence.
- **Owner profile (`operator`, kept private).** The owner's stated goal favors composable tools that work with open-source and paid components and are easy to adopt. Their profile lists regulatory risk as something to avoid. Capacity and budget constraints are recorded privately, not here; what matters is that they favor infrastructure with near-zero fixed cost.
- **Not used:** Ideabrowser's generated skills (Idea Roast, Founder-Idea Fit). Their output is a simulation, and the evals rules say simulations never count as evidence for a gate.

### Marketing foundation (four-domain pass over this repository)

Sources: [STRATEGY.md](../../../STRATEGY.md), [market report](../market/commercial-strategy.md) (October 27, `reference`), [agent-integration landscape](../agent-integrations/competitive-landscape.md) (October 27, `reference`), [go-to-market](../../commercial/go-to-market.md), [roadmap](../../roadmap/commercial-release.md), [data and sync](../../architecture/data-and-sync.md), [production blueprint](../../architecture/production-blueprint.md).

| Domain | Supported now | Not supported |
|---|---|---|
| **Offering** | A working personal loop: Today, cooking, ready food, eating with Undo, a week of batches, a purchase-aware list. Since October 30, finishing a cook teaches the planner how long a recipe takes (D015). `observed` in code and the EV-03 browser test. | Goal-fit planning, verified nutrition, accounts, sync, Android, billing. None of these is built. |
| **Market** | People pay for nearby jobs: capture (ReciMe), goal-based planning (Eat This Much), meal-prep portions (MealPrepPro), one-time recipe ownership (Paprika). `reference`. | Market size for this product; conversion; willingness to pay for Mealbook. |
| **Audience** | Adults who save recipes and prep toward calorie and protein targets: a founder hypothesis backed by the market report's reasoning (`inferred`) and the owner's own use (`operator`, n = 1). | Any observation of another person doing the job. No interviews, sessions or pilot exist. |
| **Alternatives** | Capture, MCP access, macro targets and AI-made menus are all documented elsewhere: CookBook combines capture, a manual week, targets and groceries; Mealie with its MCP server is the strongest open-source agent baseline; Pantry Aide runs MCP from plan to cart. `reference`. | That any competitor lacks a capability. "Not established" in public material is not absence. |

**Strongest counterevidence.** FoodiePrep markets YouTube capture plus calorie- and protein-aware weekly plans with automatic portions. If its planner draws from the imported personal book and reuses cooked food, the gap below narrows to execution quality alone.

### ICP harness methods

- **Funnel map method.** In practice only the first and last moves of a funnel leave public traces; the middle moves run on data the owner holds. Applied to [funnel map v0](../../growth/funnel-map.md): every Mealbook move from "captures" to "second useful week" happens inside the app, and the app records nothing that can be counted without reading personal food data. The middle of the funnel can only be observed if the app derives its own content-free counts.
- **Attention graduation framework.** How much a system may do on its own should follow demonstrated depth, with exact steps done by scripts and a model only in declared slots. That matches the existing agent contract: Mealbook's deterministic code owns arithmetic, stock and history; the user's assistant proposes; the user confirms anything that happened in the real world.
- **Simulation rule.** A simulated persona's reaction is never filed as audience evidence. The same rule already governs Mealbook's evals.

## What the evidence settles

1. **The positioning stays.** "Your recipes. A prep week that fits your goals and your time. One shopping list." Nothing in this pass contradicts it, and nothing new supports changing it.
2. **What is distinctive is the record, not the features.** Capture, assistant access, macro targets and generated menus are commodities. What is not documented elsewhere is a week planned from the person's own book that then learns from what actually happened: the time a cook really took (built), the portions a batch really made (#46), and the ready food that carries into next week (built). This is a hypothesis about difference, not a claim of uniqueness.
3. **Protein targets are the first goal, with no medical framing.** The search trend is consistent with leading on protein. GLP-1 users stay a parked segment: medical framing is excluded by STRATEGY and by the owner's risk profile.
4. **The infrastructure has to be open, local-first and nearly free to run.** The owner's goals and constraints, the bring-your-own-assistant decision (D010–D012) and the Mealie baseline all point the same way: the person's data stays on their device by default, sync is optional, inference is never hosted, and every surface (web, Android, the person's assistant) uses one deterministic command layer.

## Infrastructure this direction requires, in order

1. **One command boundary (#31, roadmap 3A U1).** Every change to the food record goes through typed commands with operation IDs and replay-safe results, executed by shared domain code instead of the web hook. Android, sync, assistant access and pilot counts all depend on it. It needs no provider and no spending. Plan: [shared command boundary](../../plans/2026-10-31-0900-feat-application-command-boundary-plan.md).
2. **Content-free counts derived on the device.** "Useful week" and "second useful week" computed from the record itself, so the weekly dogfood log (EV-08) and a later consented pilot can count the middle of the funnel without reading recipes, targets or intake.
3. **Local assistant bridge (3A U2).** The real app paired with a local MCP server through the same commands, before any remote service.
4. **Accounts and sync (Stage 3, 3A U3).** Only after an owner decision on providers and budget. The repository port built in step 1 is where a hosted store plugs in.

## What this pass cannot conclude

- Whether anyone other than the owner wants a planner that learns from actual cooking. The next evidence is EV-08 (owner, weekly) and EV-10 (supervised sessions, Stage 2).
- Price and packaging. STRATEGY proposes a subscription for automation and sync. Paprika's one-time model suggests a one-time local license may fit people who never sync. That is an open question for the Stage 4 pilot, not a decision.
- Whether the GLP-1 segment is worth pursuing. Parked until a non-medical framing has evidence.
- Channels. Not assessed: there is no evidence about where these people can be reached with permission.
