# Proposed Mealbook agent tool contract

This is a **future interface**, not a live endpoint or generated SDK. The [agent architecture](../../architecture/agents/README.md) owns application boundaries and [permissions](../../architecture/agents/permissions-and-trust.md) owns user approvals. These tools must call the same typed command/query handlers as the app, preserving the domain engines in `packages/meal-domain/`. Do not expose the entire browser `MealbookAction` union as a generic remote dispatcher.

## A small initial surface

Names below are proposed stable MCP names. Group related capabilities in documentation, not overlapping tools. Schemas should be generated from the shared application contracts when implemented, include bounds and nullable facts, and be versioned without silently changing existing semantics. A tool-only connector is the cross-client baseline; prompts/resources/UI extensions are optional enhancements, never necessary to complete the loop.

| Tool | Purpose and bounded inputs | Result and effect |
|---|---|---|
| `mealbook.get_context` | Requested section: Today, current week, prepared food, goals, preferences or capabilities; timezone/date and pagination where relevant | Minimal authorized context, record revisions, quality warnings and supported actions; never dumps the entire diary/book |
| `mealbook.search_recipes` | Text, ingredient/label/role/known-macro filters, sort, cursor, limit | Owned recipe summaries and evidence/completeness; unknown nutrition remains unknown |
| `mealbook.get_recipe` | Recipe ID and optional version; selected detail fields | Full recipe/version, portion basis, provenance and appropriate prepared snapshot; no lookup outside account scope |
| `mealbook.fetch_source` | One supported canonical URL or explicitly supplied text, source options, idempotency key | Source handle or job ID, method/status, retrieval date, content hash, warnings and section/chunk locations; no saved recipe |
| `mealbook.read_source` | Owner-scoped source handle, offset/section and bounded length | Exact source chunk, offsets/hash and truncation/remaining-data indicator; source text is untrusted data |
| `mealbook.validate_recipe_draft` | Source handle/version, candidate fields, field-level quote/offset evidence and labelled user corrections | Validated candidate, unsupported fields cleared/flagged, ambiguity/completeness report, draft handle; no book mutation |
| `mealbook.preview_week` | Saved recipe versions or a bounded selection request, explicit day/slot scope, people, portions, cooking windows, hard/soft constraints and target assumptions | Proposed week, feasibility, known nutrition/residuals and shopping delta; no active-week change |
| `mealbook.compare_weeks` | Two owner-scoped proposal/committed week IDs and revisions | Differences in meals, portions, timing, ready-food use, nutrition completeness and compatible ingredients |
| `mealbook.get_shopping_list` | Owned week/proposal or shopping-intent IDs, revision and optional aisle/cursor | Needed purchases, partial/unknown amounts, already-have/bought coverage and contribution evidence; does not buy or check off anything |
| `mealbook.preview_swap` | Exact week/use/batch choice and revision, scope, candidate recipe/version/portion change | Protected-choice checks plus meal/grocery/nutrition/timing delta; no swap applied |
| `mealbook.get_cooking_session` | Session or explicitly selected batch/recipe context | Persistent steps, ingredients, timers, source dose and state; finished snapshots stay immutable |
| `mealbook.prepare_change` | One operation from the closed typed registry, target revisions, exact operation payload and idempotency key | Canonical change preview, warnings, approval/grant requirement and status link; no editable-domain mutation |
| `mealbook.get_change` | Owner-scoped change ID | Pending/approved/applied/conflict status and exact result; status alone grants no permission |
| `mealbook.apply_change` | Change ID, same authenticated client and idempotency key | One transaction only when app approval or eligible standing permission exists; current invariants/revisions rechecked |
| `mealbook.get_job` | Job ID | Queued/running/completed/failed/cancelled status, progress/result/error, expiry and retry guidance |
| `mealbook.cancel_job` | Job ID and idempotency key | Stops pending source work where possible; does not undo a committed recipe/week or fabricate completion |

Initial discovery can expose only the allowed subset for the connected account/client. Capability flags distinguish evaluation from generation and goal fitting; current personal randomization is not silently renamed a solver. Add further tools only when the existing small surface cannot express a required action clearly. Query-only adapters may be needed for restrictive clients, with the actual supported surface tested before marketing.

## Closed change registry

`prepare_change` is not arbitrary record patching. Each operation has a dedicated application schema and handler. Candidate initial operations are:

- Promote a validated draft to the book; edit personal recipe metadata/content with evidence and nutrition-change rules.
- Select Today's recipe or confirmed prepared batch; add a recipe shopping intent; remove that intent.
- Confirm a week proposal; replace an uncooked meal/batch; change portions; move/skip a planned use; lock/unlock a choice.
- Report grocery coverage or explicitly approve a purchase-identity match; add/remove a manual item.
- Start/resume cooking and update a bounded session checklist/timer; confirm a finished batch's actual yield and user-provided storage notes.
- Record actual consumed units/date against a batch or explicit manual food; reverse a specific consumption entry.
- Set user targets/preferences; propose a specific recipe deletion while preserving historical snapshots.

No raw SQL, arbitrary JSON patch, command execution, unrestricted network fetch, browser-control credential or model/provider key is accepted. Account/billing/grant management stays in trusted app UI. Real-world and destructive entries always use the explicit approval class defined in permissions.

## Source and inference contract

Source acquisition returns text/metadata that Mealbook is permitted to obtain. Written descriptions and permitted structured recipe pages are preferred; permitted captions are a separate availability state. The current YouTube provider's metadata-only extraction is a personal-preview mechanism, not proof of universal public-video caption access or a commercial source license. Blocked/missing/ambiguous sources return explicit status and a pasted-text/manual path. No automatic video/audio download or transcript promise.

A handle exposes exact bounded source chunks to the user's assistant, not a pretense that the model has watched the video. Default summaries should be compact; larger chunks are fetched deliberately. Validation checks evidence against the retrieved source version/hash, preserving offsets and meaningful field relationships, not just accepting a number that happens to appear somewhere. An LLM cannot self-certify ingredient quantity, macro label, nutrition basis or recipe yield. Multiple recipes in one source require explicit selection before promotion.

A user's correction may fill a missing value, but it is stored as user-entered evidence with its own basis. Externally reasoned estimates are clearly estimated and cannot become creator facts. Nutrition calculation needs reviewed dataset/conversion provenance. Unknown macros, allergens, fridge duration, package prices and unit conversions remain unknown. The source report and raw-source retention are governed by the data lifecycle, not by a chat transcript's lifetime.

## Result envelope and error recovery

Every result carries a concise human summary plus structured data conforming to an output schema. Use an application correlation/operation ID, capability/schema version, authoritative record revisions, exact warnings, pagination and allowed next steps. Numeric quantities include unit, serving basis, known/unknown status and provenance; a missing value is `null`, never a misleading zero. Record IDs and quantities are authoritative structured fields, not values the agent scrapes from prose.

Compatibility serialization follows the selected MCP version. The 2026-07-28 standard supports structured content and request-scoped results; older clients may need a serialized text representation. Tool annotations describe read/write, destructive, idempotent and open-world behavior accurately, but do not implement permissions.

| Application code | Client recovery |
|---|---|
| `UNAUTHENTICATED` / `FORBIDDEN` | Reauthorize the exact Mealbook resource/scope or stop; never substitute another account |
| `CLIENT_CAPABILITY_UNSUPPORTED` | Use the documented read-only/manual handoff, not a disguised write tool |
| `APP_DISCONNECTED` | Reopen/re-pair the local development app; no fake-store success |
| `SOURCE_BLOCKED` / `SOURCE_UNAVAILABLE` / `NO_WRITTEN_RECIPE` | Offer permitted pasted text/manual entry; do not fabricate source contents |
| `EVIDENCE_MISMATCH` / `RECIPE_AMBIGUOUS` | Retrieve the correct chunk or ask for recipe selection/correction |
| `NUTRITION_INCOMPLETE` / `PLAN_INFEASIBLE` | Explain gaps or failed constraints and request a changed scope/target; no full-goal claim |
| `APPROVAL_REQUIRED` / `APPROVAL_STALE` | Link exact app review; changed payload/revisions require a fresh preview |
| `CONFLICT` / `STOCK_CHANGED` | Read current state and propose a new change; never overwrite or overconsume |
| `IDEMPOTENCY_CONFLICT` | Use a new key only for a genuinely new intent, not to evade a rejected operation |
| `QUOTA_EXCEEDED` / `RATE_LIMITED` | Show bounded retry/reset information; no rotating accounts or fragmented calls |
| `HANDLE_EXPIRED` / `JOB_FAILED` | Recreate/retry deliberately under the same user's quota and source policy |

Protocol/auth errors and tool execution errors remain distinct; a warning or pending approval is not a completed write. JSON-RPC request IDs are transport identifiers, while the application operation key survives retries and connection changes. A request-scoped stream disconnect is not permission to assume an unknown commit failed; check `get_change`.

## Human parity and optional guidance

Provide optional prompts such as “make a useful prep week” and “capture a recipe safely,” and resources for domain glossary, user-approved rules and current capabilities. They must not become the only route to necessary context. Put concise operative instructions in tool descriptions/results so a tool-only consumer works.

After application writes, return canonical IDs/revisions, source warnings and an app deep link. The human sees the same approved book record, active week, shopping delta and immutable batch that the agent sees. Browser navigation commands are not required: an external assistant can hand the user a recipe/plan link and let the ordinary app take over. A separate fixture-backed planner does not satisfy this contract.

## References

1. [MCP tools: schemas, structured results and annotations](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
2. [MCP state and protocol version compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
3. [Current source-ingestion reference](../source-ingestion.md)
