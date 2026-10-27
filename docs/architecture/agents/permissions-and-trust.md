# Agent permissions and user control

A connected assistant is a delegated client, not the user’s account authority. These are proposed application rules approved in direction on October 27, 2026; they are not deployed authentication or approvals. The owner is Mealbook's command service, shared by UI and MCP. Tool descriptions, annotations and “the user said yes” text cannot replace this service policy.

## Connection authority

Use OAuth for the remote MCP resource, with protected-resource metadata, authorization-server discovery, PKCE, exact redirect validation and audience/resource-bound access tokens. Every HTTP request authenticates; no tokens in URLs, no acceptance or forwarding of Claude/OpenAI provider tokens. Support client registration mechanisms only as required by tested clients. The current MCP specification prefers client ID metadata documents and retains dynamic registration compatibility; an operator must not assume one registration path works everywhere. [1]

The user sees the requesting assistant/client, account, data categories, scopes and disconnect action. Initial access is minimal. Example application scopes are `recipes:read`, `sources:fetch`, `drafts:write`, `plans:read`, `plans:propose`, `shopping:read`, `cooking:read` and optional `nutrition:read`. Read of intake history is separate from reading recipe macros; do not export a food diary just to plan a week. Later write scopes allow requesting or applying permitted changes, not creating one's own approval.

Mealbook derives the account from the verified token, never from a model-supplied `accountId`. Every object, source handle, draft, proposal, approval, job, search index, export and cache lookup rechecks owner scope. Valid OAuth is necessary, not sufficient: current operation policy and entitlement are checked too.

The local development slice has no cloud account yet. It derives a local owner/client principal from explicit same-origin browser pairing and short-lived scoped credentials, not from agent-supplied identity. Trusted app approval is distinct from the delegated bridge credential; the bridge cannot mint or impersonate that approval. Local changes use the same typed policy, revisions, idempotency and real private-app repository. Remote OAuth/account authority extends this boundary later; “development” is not a bypass for stock, approval or snapshot rules.

## Four action classes

**Authorized reads and previews:** recipe search, scoped context, supported source fetch, quality validation, candidate weeks, grocery calculations and swap comparisons can run without a new action dialog within the connected user's scopes and bounded cost quota. A draft/preview may create a short-lived proposal record but does not alter the editable book, active week, available food or shopping coverage.

**Reversible application writes:** saving/editing recipes, selecting Today, confirming a week, moving a planned meal, changing labels/targets, locking choices and changing shopping coverage need explicit approval or a narrow user-created standing grant. The change preview shows what will change and its downstream quantities. Changing shopping coverage is a user report or explicit preauthorized action, not inferred from location/time.

**Real-world records:** cooking completion/actual yield, storage/defrost state, actual consumption and consumption Undo require specific explicit user confirmation. They never qualify for broad standing automation. A cooking guide may open/resume or update a confirmed checklist/timer under a suitable narrow grant, but never conclude that food exists or was eaten. “Plan four servings” is not “record four servings produced.”

**Destructive or sensitive actions:** deleting recipes/records, purging data, account deletion, transferring ownership, broad export of private history, creating permissions, changing consent, billing/checkout and provider connection remain explicit user-controlled actions. The initial MCP offers proposal/status for necessary record deletion, not an unrestricted admin endpoint. Account/billing/permission management is UI-only. A recipe deletion preserves required historical snapshots under the disclosed data lifecycle.

## A change cannot approve itself

A mutation first produces an immutable proposed change with `changeId`, operation type, canonical payload hash, affected IDs/revisions, numeric/source warnings and human-readable delta. Approval is bound to that exact change, account, client, affected revisions and a short expiry. Editing the change invalidates approval.

The MCP returns an approval-page link containing only an opaque identifier. It is **not** a bearer approval token. The user signs into Mealbook's trusted approval UI and approves the visible change through a user-session/CSRF-protected route; the assistant's OAuth scopes do not grant access to that approval route. Additional fresh authentication is appropriate for destructive/account operations. The initial cross-client baseline requires this app confirmation; a richer trusted client UI can be integrated later only if its attestation contract is verified.

`apply_change` requires the same authenticated delegated client plus an existing approved record or matching standing-grant authorization. It cannot supply an arbitrary `approved: true`, mint a grant or claim an agent-authored approval message. The service revalidates revisions, facts, stock, policy and entitlement immediately before transaction commit. Changed inputs return `CONFLICT` or `APPROVAL_STALE` with a new preview; they do not silently apply a different recipe/week than the user saw.

Approval states are `pending`, `approved`, `denied`, `expired`, `applied`, `cancelled` and `stale`. A disconnect/lost response is not approval or cancellation. A client checks the exact change status; an applied retry returns the original result. Transport reconnection does not recreate a change or duplicate its effects.

## Narrow standing grants

A grant is created in the app by the user, with permitted operation types, client, source/collection/record scope, count/cost ceiling, date range or expiry, revision policy and revocation. Example: “save at most five source-grounded drafts from links I provide into New imports today; leave missing macros unknown.” That is not permission to overwrite existing recipes, import arbitrary domains or change the week's groceries. A standing grant for draft saves cannot authorize actual intake, destructive actions, billing or further delegation.

The service checks the grant atomically and accounts for each use with the operation ledger. Batch ceilings and lifetime ceilings cannot be defeated by concurrent requests or splitting calls. No default forever grant, wildcard database mutation or generic `execute_sql`/shell/browser tool. Users see active grants and their recent actions and can revoke them. Revocation blocks new work and uncommitted mutations; committed work remains visible and explicitly undoable where supported.

## Concurrency, idempotency and job boundaries

Every side-effecting request has an application idempotency key, delegated client, operation type and canonical payload fingerprint. Reuse with identical input returns the existing result; reuse with different input returns `IDEMPOTENCY_CONFLICT`. MCP JSON-RPC request IDs are not durable business idempotency keys. A consume retry cannot decrement food twice; two devices cannot consume the same final portion under stale revisions.

The application transaction enforces stock, immutable food snapshots, protected plan choices and source-based arithmetic. Optimistic revisions protect edits; row-level transactional checks protect portion allocation. A read-modify-write model loop is never a database lock or stock reservation.

Long source work uses explicit job IDs and cancellation/status. Cancelling transport does not undo already committed records; cancelling a job stops bounded pending work where possible. Results and proposal handles are owner-scoped and expire under the disclosed retention policy. A revoked client cannot poll an old source handle to bypass revocation.

## Untrusted internet input and disclosure

Fetched HTML, recipe text, captions, titles and externally generated drafts remain untrusted data. Sanitize rendered markup and links; forbid private/link-local source URLs, unsafe redirects and arbitrary fetches; retain source-acquisition limits. Never allow source text to create tool definitions, modify scopes or cause an unrequested tool call. Quoted “system instructions” inside a recipe are recipe input, not authority.

Send the assistant only requested, bounded context. The client/provider's retention policy is external to Mealbook; consent and export disclose that data may enter the user's assistant conversation. Do not promise end-to-end encryption, zero vendor retention or user-subscription availability we do not control. Mealbook still avoids provider API-key collection and minimizes its own content logs.

Tool annotations help clients present risk, but MCP itself says clients must not trust arbitrary annotations as a security boundary. [2] Permissions, tenant ownership and approvals are enforced by application policy irrespective of what a host prompts.

## Required proofs before enabling writes

An unapproved change fails even if the client passes `approved:true`. A forged/cross-account approval ID fails; stale revisions require new review. Grant limits survive parallel retries; revoked tokens/grants deny reads and queued commit. Interrupted apply returns one result and one food/grocery effect. Real-world completion is unavailable through a standing grant. Malicious recipe text cannot escalate any permission. These are future acceptance tests, not checks already run on the personal app.

## References

[1]: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization "MCP authorization and scoped resources"
[2]: https://modelcontextprotocol.io/specification/2026-07-28/server/tools "MCP tools and untrusted annotations"
[3]: https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices "MCP token, consent, SSRF and scope security"
