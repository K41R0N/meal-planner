# Meal planning, recipe, and agent integrations: competitive landscape

**As of:** 2026-10-27
**Author:** Manus AI

“MCP exists” is not a defensible unique claim for Mealbook. There is a public, official commercial food-data MCP from Edamam, a hosted meal-planning-to-grocery MCP from Pantry Aide, and several code-backed MCP servers that give agents read/write control of a personal recipe book, planner, pantry, and shopping list. In particular, Mealie plus its community MCP server already reaches unusually far across URL and video import, recipe storage, planning, shopping, and cooking-adjacent records. [1] [3] [5] [8]

The viable distinction is therefore not the transport protocol. It is a source-aware, reviewable operational loop: preserve where a recipe came from and how it was extracted; make a user or agent explicitly promote a reviewed recipe version; plan a batch of meals from that trusted book; create a reversible shopping proposal; then reconcile what was actually cooked, substituted, and eaten into nutrition records. The sources below document fragments of that loop. They do not establish that no competitor offers it; where a feature is not documented, this report treats that as unknown rather than absent.

## Directly relevant documented products and integrations

### Edamam Food MCP and Meal Planner API — official commercial data layer

Edamam publishes a remote Streamable HTTP MCP endpoint, `https://mcp.edamam.com/mcp/food`. Its documented tool catalog is deliberately narrow: `get_food_nutrition` accepts text or barcodes and returns nutrients, labels, cautions, and resolved ingredients; `analyze_food_image` identifies food in an image and returns estimated nutrition. Calls require a bearer token made from an Edamam `app_id` and `app_key`. This is a real, supported MCP product, not a generic “ask an LLM for a meal plan” article. [1]

Edamam separately sells a conventional Meal Planner API that can create personalized plans up to two weeks, generate shopping lists, replace recipes, and integrate with Instacart. The Food MCP documentation does not expose those planner operations: its documented surface remains the two food/nutrition tools. That creates an integration seam for an agent product, but not a uniqueness claim: a builder can combine Edamam’s REST planner/data APIs with any MCP client today. Edamam’s terms also matter to product design: the page states that human end-user-driven requests are required, attribution is required, and caching is limited by plan. [1] [2]

**Confidence: high.** This is first-party documentation of a live endpoint, explicit authentication, exact tools, pricing/limits, and a separate planner API. The differentiation opportunity is orchestration, provenance, and user data ownership—not access to basic nutrition lookup.

### Pantry Aide MCP — hosted meal plan to retailer cart

Pantry Aide documents a remote MCP server at `https://pantryaide.com/mcp`, authenticated either through OAuth 2.1/Dynamic Client Registration or a bearer API key. Its public catalog lists 22 tools: recipes, weekly plan generation and replacement, pantry-aware shopping-list creation, Kroger product matching and cart submission, and an Instacart deep link. Its stated workflow is close to “plan five dinners, revise a day, regenerate the list, then send the cart.” [3]

This is the clearest commercial overlap with menu-to-shopping-to-checkout. It documents planning from a user’s own recipes and retailer-cart actions, but the public integration documentation does not describe customer-selected or self-hosted LLM providers, an extraction-validation review gate, or reconciliation of actual cooked portions to nutrition. Those omissions are not evidence that the service lacks them. The public repository is documentation only and says the application source is not included; its metadata shows three commits, last pushed on 2026-05-31. That makes the existence and tool surface credible, while limiting what can be inferred about implementation depth or current operational maturity. [3] [4]

**Confidence: medium.** Treat it as a product overlap to test, not as evidence of market scale. No package-download or registry statistic is used as a sales proxy.

### Mealie plus `rldiao/mealie-mcp-server` — strongest open-source functional baseline

Mealie itself is a long-running AGPL self-hosted recipe manager with a REST API, URL recipe import, weekly meal planning, and shopping lists. The official project describes it as a third-party-integrable REST backend; its public repository shows 5,743 commits. [7]

The separate MIT-licensed `rldiao/mealie-mcp-server` exposes that personal Mealie database to MCP clients. Its README documents 61 default tools for recipe CRUD and URL import, nutrition storage, ingredient parsing, meal-plan CRUD/bulk creation, shopping-list CRUD/bulk operations, and household organization. It accepts a Mealie instance URL and API key; it can use stdio, Streamable HTTP, or SSE. The repository includes tests, a changelog, pinned dependencies, and Docker instructions; GitHub metadata records a push on 2026-10-03 and shows that it is non-archived. [5] [6]

Mealie makes the “users own the LLM” direction less differentiated on its own. Its official AI integration supports any OpenAI-compatible provider and gives Ollama as a self-hosted example. Its Import with AI feature can ingest text, HTML, JSON, images, URLs, and videos; a YouTube or Instagram URL is transcribed when an audio provider is configured, and the URL is saved as the recipe source. The MCP wrapper exposes this as an opt-in write operation and explicitly says the imported recipe should be reviewed for accuracy. [5] [8]

The important gap is not that Mealie cannot capture sources. It can. Rather, its public material describes AI-assisted import followed by review, not a first-class, auditable validation workflow that keeps extracted evidence, field-level confidence/conflicts, recipe-version promotion, plan diffs, and post-cook actuals connected. That is a product hypothesis, not a claim that the capability is absent.

**Confidence: high for the documented functionality; medium for the proposed distinction.** This is the most important build-vs-integrate reference point because it combines self-hosted user data, model/provider choice, URL/video ingestion, MCP tools, meal plans, and shopping lists.

### Plan to Eat MCP — broad personal-data agent control, but unofficial and brittle by design

`plan-to-eat-mcp` documents 36 tools over a Plan to Eat recipe book, planner, freezer, and shopping list. It supports recipe CRUD, weekly-planner manipulation, leftovers/freezer tracking, and editable shopping-list lines. It also includes a Claude Code plugin and skills, showing that agent workflow guidance can be distributed alongside an MCP server rather than left solely to the model. [9]

It is explicitly unofficial: the author says it is reverse-engineered from the live web app because there is no public Plan to Eat API, warns that endpoints may change, and authenticates with the user’s email/password before caching cookie sessions. GitHub metadata shows a last push on 2026-10-16, but that recency does not change the dependency risk created by private, reverse-engineered endpoints and password-based login. [9] [10]

**Confidence: high that the code documents these capabilities; low-to-medium as a dependable production dependency.** It is strong evidence that an agent-accessible personal recipe book/planner is no longer novel, while also showing why an official, stable API and safer delegated authorization can be part of Mealbook’s value.

## Two corroborating open-source examples

HowToCook-MCP wraps the public HowToCook recipe corpus with category and recipe search, daily suggestions, and a weekly-plan tool that accepts allergies, avoid items, and party size. It supports local stdio, HTTP, and SSE transports and requires no user-account connection in its documented setup. The public repository was last pushed on 2026-07-08. This is credible evidence that basic “LLM recommends a weekly menu through MCP” is commodity functionality, even though it is not a personal recipe-book or nutrition system. [11] [12]

Tandoor.mcp is another source-backed community server. It documents URL recipe import, meal-plan bulk scheduling, pantry-based suggestions, shopping-list operations, pantry tracking, and cooking-history logging; it requires a self-hosted Tandoor URL and API token. Its last public push was 2026-04-19, so it is better used as corroborating evidence than as a maintenance benchmark. [13] [14]

## What can credibly differentiate Mealbook

A Mealbook pitch should not lead with “the recipe MCP.” It should lead with a durable household food record that an arbitrary user-selected LLM can operate safely. Mealie shows that self-hosting, a user-controlled provider, source import, and MCP access can coexist. Pantry Aide shows that chat-to-cart is also already documented. [3] [5] [8]

The more specific differentiated-value hypothesis is **trusted recipe operations, not generated menus**. The product can make a source URL, video transcript, pasted text, or creator recipe a candidate rather than silently turning it into ground truth. Store the raw source reference and retrieval time, extraction method, source attribution/licensing notes, structured field-level evidence, nutritional data source and calculation version, and a clear human/agent confirmation state. A canonical recipe version should change only through a visible review or promotion action. This is especially useful for videos and web pages where stated quantities, transcript wording, and the finished dish may conflict.

The same record should carry through the workflow. A weekly batch menu should declare the recipe versions, serving assumptions, leftovers, constraints, and planned nutrition. A shopping list should be a reproducible derivation with a diff when recipes or servings change. Cooking should log substitutions, weighed amounts when known, servings actually produced/eaten, leftovers, and notes. “Actual nutrition” should remain explicitly estimated unless measured data supports it, with the estimate tied back to the nutrient source and recipe/cook versions. This produces an audit trail an agent can reason over instead of a conversational answer that evaporates after checkout.

For an agent-friendly interface, prefer a small, composable, state-aware tool surface over dozens of overlapping verbs: `capture_recipe_candidate`, `inspect_source_evidence`, `validate_recipe_fields`, `promote_recipe_version`, `propose_batch_menu`, `diff_menu`, `derive_shopping_list`, `record_cook`, and `reconcile_actual_nutrition`. Read/propose operations should be separate from writes; cart submission, recipe promotion, and nutrition overrides should require an explicit confirmation token. That design directly addresses the hazards surfaced by existing integrations: Pantry Aide documents destructive cart submission, Mealie documents that some bulk writes are not atomic, and the Plan to Eat adapter has to preserve an authenticated cookie session. [3] [5] [9]

## Decision and next steps

**Decision:** Do not claim uniqueness from “MCP exists,” “agent can make meal plans,” “agent can manage a recipe book,” or “user can bring a model.” Each is already publicly documented. A defensible positioning is: **an LLM-agnostic, user-owned recipe evidence and execution system that turns imperfect web/video sources into reviewed recipe versions and connects planned menus to actual cooking and nutrition.** This is a differentiated-value hypothesis, not a measured claim of uniqueness.

The next validation should be capability-focused rather than another broad competitor audit:

1. Build a thin vertical slice with the eight stateful tools above and one portable local data store. Prove that the same data is usable from at least two MCP clients/models, including a user-operated provider.
2. Run a source-to-actuals scenario with five deliberately difficult inputs: a normal recipe page, a blocked or incomplete page, a YouTube recipe, a video containing multiple recipes, and a recipe whose cooked substitutions change nutrition. Measure extraction review time, correction rate, and whether the shopping-list/menu diff is understandable.
3. Benchmark only against the closest alternatives: run the identical scenario in Mealie plus its MCP server and, if authorized later, Pantry Aide. Score observable outcomes—source traceability, required confirmations, plan reproducibility, shopping-list diffs, handling of actual portions, and provider/data portability—not app-store ratings or download counts.
4. Decide the boundary deliberately. If Mealbook needs licensed recipe/nutrition data, use a provider such as Edamam through terms-compliant, user-initiated calls and preserve attribution/retention constraints in the data model. If it instead relies on user-supplied sources, make provenance and review quality the product rather than attempting to copy a third-party recipe corpus. [1] [2]

## References

[1]: https://developer.edamam.com/mcp-edamam-food "Edamam Food MCP documentation"
[2]: https://developer.edamam.com/meal-planner-api "Edamam Meal Planner API"
[3]: https://github.com/hsearcy/pantry-aide-mcp "Pantry Aide MCP repository"
[4]: https://api.github.com/repos/hsearcy/pantry-aide-mcp "Pantry Aide MCP repository metadata"
[5]: https://github.com/rldiao/mealie-mcp-server "Mealie MCP Server repository"
[6]: https://api.github.com/repos/rldiao/mealie-mcp-server "Mealie MCP Server repository metadata"
[7]: https://github.com/mealie-recipes/mealie "Mealie official repository"
[8]: https://mealie.io/documentation/getting-started/installation/ai-providers/ "Mealie AI integration documentation"
[9]: https://github.com/alex-zwingli/plan-to-eat-mcp/blob/main/README.md "Plan to Eat MCP README"
[10]: https://api.github.com/repos/alex-zwingli/plan-to-eat-mcp "Plan to Eat MCP repository metadata"
[11]: https://github.com/worryzyy/HowToCook-mcp/blob/master/README_EN.md "HowToCook MCP README"
[12]: https://api.github.com/repos/worryzyy/HowToCook-mcp "HowToCook MCP repository metadata"
[13]: https://github.com/oculairmedia/Tandoor.mcp "Tandoor MCP Server repository"
[14]: https://api.github.com/repos/oculairmedia/Tandoor.mcp "Tandoor MCP Server repository metadata"
