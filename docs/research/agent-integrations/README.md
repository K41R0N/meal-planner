# Agent integration research

Observed October 27, 2026 from primary vendor and repository documentation. This research informs a proposed Mealbook connector; **no client connection or MCP endpoint has been implemented/tested for Mealbook**. Product/plan availability is not proof of exact protocol-version interoperability. Recheck vendor docs and exercise the target accounts before release.

## Compatibility and distribution

| Path | Documented eligibility and surface | Implication for Mealbook |
|---|---|---|
| Claude custom remote connector | Free (one custom connector), Pro, Max, Team and Enterprise; hosted cloud connection, web/Desktop primary setup; mobile custom setup beta | Best-supported initial consumer custom-connector path; public reachable HTTPS and per-user OAuth, subject to testing |
| Claude Connector Directory | Optional discovery/listing with its own review requirements | Not required for a controlled custom-URL alpha; submission is a separate release action |
| ChatGPT custom full MCP | Business and Enterprise/Edu web, with workspace/admin policies | Test full confirmed writes in eligible web workspaces; do not imply ordinary consumer/mobile universal support |
| ChatGPT Pro custom path | Official guide documents read/fetch, not full custom MCP; web only | Only the actually supported query surface and manual/app confirmation handoff; do not disguise writes as reads |
| ChatGPT public app/Plugins route | Directory distribution and optional Apps SDK UI have separate policies and availability | Potential broader consumer distribution; not an automatic substitute for restrictive private-custom eligibility |
| Local developer MCP client | A locally launched supported stdio/loopback client can be paired to the actual development app | Useful development proof; not a way for hosted consumer clients to access private IndexedDB without a deliberate bridge |
| Claude API connector / OpenAI Responses API | Developer-authenticated model API calls, separate usage billing | Not the chosen product path; consumer subscriptions do not pay these API invoices |

[Claude evidence](claude.md) includes setup, OAuth, tool/resource/prompt support, mobile and hosted-network limits. [ChatGPT evidence](chatgpt.md) includes full-write versus read/fetch eligibility, workspace controls, distribution and developer-API separation. The exact commercial launch promise must name tested hosts/platforms and availability, not “any ChatGPT or Claude subscriber.”

## Competition changes the claim

[The bounded prior-art scan](competitive-landscape.md) found official Edamam Food MCP, Pantry Aide's meal-plan/shopping/cart connector, Mealie plus a community MCP with URL/video/provider support, an unofficial Plan to Eat adapter and corroborating Tandoor/HowToCook integrations. These prove overlapping functions exist; they do not establish sales, active customer counts or missing undocumented competitor features.

The strongest alternative to benchmark is **Mealie plus its MCP**, not a generic nutrition chatbot. An official shared API, safer delegated authorization and a reviewable source-to-actual-food record can differentiate from brittle/reverse-engineered adapters. “Most agent-friendly” remains an ambition requiring a comparable outcome test, not current marketing copy.

Use the same difficult cases in Mealbook and the closest alternative: permissioned written recipe; missing/blocked text; YouTube with explicit recipe; multiple recipes; ambiguous units/yield/macros; edited composition; a changed week; actual prepared/eaten quantities. Measure source correction time, exact-field grounding, conflicting/unknown facts, reversible plan/shopping changes, explicit approvals, recovery, data portability and user success. Own-model choice or MCP alone is not the moat.

## Current standards

[Standards notes](standards.md) cite the primary MCP transport, authorization and tool specifications. Revision 2026-07-28 has a stateless core and changed modern Streamable HTTP; use the [scaling and compatibility plan](../../architecture/agents/scaling-and-operations.md), including tested fallback for older initialization-based clients. Tool annotations do not enforce application permission.

## Research boundaries

This pass visited public official docs and project documentation. It did not install/test competitor apps, log into providers, validate commercial endpoint uptime, inspect private stacks or treat repository/download counts as paid demand. All recommendations remain architecture and positioning inputs. The operative product rules live in [the agent architecture](../../architecture/agents/README.md), not an external researcher's suggested implementation list.
