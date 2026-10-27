# Subscriptions and entitlements

*Decision status: proposed commercial model. Mealbook has no accounts, store products, trials, billing SDK, or paid endpoint today. Prices and limits below are hypotheses, not offers.*

## Proposed value boundary — Approved direction

The proposed commercial direction is Free plus one Pro tier: protect ownership of the personal recipe book and charge only for recurring, explainable automation and network cost. The supporting rationale and adjacent-market research are in [Mealbook commercial strategy](../research/market/commercial-strategy.md). This does not change the current offline PWA.

A **signed-in Free** account is a real account state, not a failed Pro lookup. It may have a personal book, manual entry/planning, groceries, cooking/consumption logging and Undo, export, and a finite allocation of successful reviewed assisted imports after a cost test. Failed, blocked, canceled, and duplicate previews do not consume it. The candidate five successful imports per month is not a committed limit.

A **Pro** account may receive a reviewed time/macro optimizer, cross-device sync, bulk import, and higher bounded assisted-import capacity. The candidate test is **$7.99 monthly or $49.99 annually**, with a 14-day trial; neither is settled. Every network feature needs a stated unit, window, overage behavior, and reset rule. Do not sell unlimited imports before measured provider, review, support, and abuse costs make a bound credible.

No expiry, cancellation, billing issue, or refund may ransom existing recipes: the locally available book, manual planning, cooking history, and export stay readable and usable under Free rules. If Pro sync expires, the service must still offer a documented read/download/export path for data already stored for the account; it must not make old recipes hostage to a renewal.

## Deterministic eligibility — Proposed

Commercial server work requires a verified signed-in account. The eligibility service evaluates a request as a pure, auditable decision over: account status; verified current entitlement; product/feature configuration version; request type; quota window/counters; region/platform support; and any quality prerequisite. It returns `allow`, `deny`, or `review` plus a stable reason code, remaining allowance where safe to disclose, retry/reset time, and policy version.

Examples: a Free user may be allowed a remaining reviewed import but denied bulk import; a Pro user may be denied the macro optimizer when selected recipes have insufficient source/user-confirmed nutrition; a deleted account is denied all service work; and a payment pending verification is not Pro. The client can render the result but cannot assert `isPro`, decrement quota, or unlock a paid API by itself. The API recalculates eligibility immediately before enqueueing costly work and records the decision alongside the operation.

Existing offline, unsigned-in local use remains a separate local mode, not a disguised subscription tier. A future account sign-in must explicitly import/partition local data as described in [data and sync](../architecture/data-and-sync.md).

## Agent access and service value — Proposed

The [approved agent direction](../architecture/agents/README.md) charges for Mealbook value, not inference the user's assistant supplies. The proposed Free account may connect supported assistants for bounded book/context reads, source review, safe manual-loop writes and ordinary planning/shopping operations within its service allowance. Basic owned-data access/export and corrections cannot be made hostage to Pro. Pro may add deterministic target fitting, durable multi-device sync, higher source-job capacity, bulk work and stronger repeat-week adaptation; no hosted LLM or unlimited agent calls is bundled by implication.

External reasoning can compose good plans under Free. That is legitimate value, not a reason to block a user's own assistant to force purchase. Pro must earn payment through measured service/optimizer/reliability value. The same server entitlement and quota policy applies to UI and MCP; tool-call splitting cannot defeat account-level source/grant limits. Count cost and successful-import usage separately: failed/blocked/cancelled requests should not consume the proposed paid successful-save allowance, but remain subject to bounded abuse/rate budgets.

The five/50 assisted-import allowances remain hypotheses. Define whether they count source acquisition, reviewed saved recipes or bulk jobs before pricing; an externally parsed draft does not consume Mealbook model tokens. Provider subscriptions, external API usage and client eligibility are separate from Mealbook Pro. A Pro purchase cannot unlock ChatGPT custom writes on an unsupported plan/platform. [Client eligibility](../research/agent-integrations/README.md) must appear before upgrade/connection promises.

## Store state and user experience — Proposed

The entitlement state machine must distinguish `trial_active`, `active`, `cancelled_active_until_expiry`, `grace`, `account_hold`, `expired`, `pending`, `refunded_or_revoked`, and `unknown`. Cancellation keeps Pro only through the verified period end. A pending transaction has no Pro access until the server verifies it. A verified renewal restores/continues access. A refund or revocation removes Pro services at the verified effective time while preserving the Free/read/export promise.

During Google Play grace period, Pro access should continue and the app should direct the customer to correct payment. Google’s subscription guidance says entitlement remains during grace, while an account hold after grace should block subscription benefits; it also recommends responding to real-time notifications and checking the secure backend record. [1] In account hold or expired state, downgrade only Pro capabilities and preserve data readability/export. Do not invent a client-side grace period or extend access when the server cannot verify the state.

Provide an explicit **Restore purchases** action after sign-in; do not invoke it automatically because it can prompt for a store sign-in. Store restoration applies to purchases made with the same underlying store account. [2] A user manages a subscription on its purchase platform. Cross-store entitlement is therefore an account-level commercial policy to design and verify, not a promise that raw Play/Apple receipts transfer between unrelated stores.

The preferred first-release rule is **account required before checkout**. A guest/anonymous purchase is a launch blocker unless a separate design is approved. If tested later, it needs a random device-bound guest principal, clear pre-purchase warning that uninstall/device loss can break recovery, a one-time account-link flow, anti-takeover verification, audit trail, and expiry for unclaimed link tokens. It must never auto-attach a guest purchase to another account or transfer it merely because devices share a store account. Expiry of a guest link ends only the linking opportunity; local recipes remain readable/exportable and Free access remains available.

## Server ledger, verification, and reconciliation — Proposed

Use a server-owned immutable billing ledger independent of any client SDK. A `BillingEvent` stores provider/environment, provider and delivery IDs, opaque account mapping, product, event type, secure purchase reference, provider/receipt time, verification result, restricted payload hash/pointer, and processing version. Enforce uniqueness on `(provider, provider_event_id)` and delivery IDs; retain an ordered view without trusting network delivery order.

Webhook handlers verify provider signatures, deduplicate, persist before side effects, fetch/validate canonical store state where required, and recompute entitlements transactionally. A scheduled reconciliation compares active entitlements with provider/store records, flags missing/out-of-order events, and does not manufacture revenue or access when verification is unavailable. Google Play specifically advises backend lifecycle management and uniqueness checks for real-time notifications. [3] Provider/webhook signing keys, Google service credentials, and any RevenueCat API key live only in server secret storage; no client-only `isPro` flag is authoritative.

RevenueCat is a non-binding candidate for cross-platform receipt normalization, customer identity, and webhook delivery. If selected, its events must still feed the Mealbook ledger and reconciliation process. Its documentation shows cancellation/expiration, billing issue/grace, trial, and transfer flows can arrive with timing/order nuances. [4] Anonymous RevenueCat identifiers are device-cached and do not inherently share status across platforms; custom opaque account IDs are needed for cross-device identity, and merges/transfers require deliberate policy. [5] These facts reinforce the account-before-checkout default; they do not select RevenueCat.

## Store, privacy, and launch constraints — Launch blocker

Google Play’s Payments policy says Play Billing is required for in-app digital goods/services unless an exception applies, so an Android Pro release needs store-policy review rather than a generic web checkout assumption. [6] Refund, cancellation, renewal, grace, hold, restore, chargeback/revocation, and cross-account support rules must be present in user terms and support runbooks before pilot access. The public privacy policy and Data safety declaration must accurately name billing/subscription processors and their data flows.

The commercial endpoint stays disabled until the release checklist in [production readiness](../release/production-readiness.md) has accepted billing verification, pricing/terms, quota accounting, source-rights controls, account deletion, support operations, and reconciliation evidence. No content here is legal advice, a tax determination, a revenue forecast, or an assurance of store approval.

## References — Approved direction

[1]: https://developer.android.com/google/play/billing/lifecycle/subscriptions "Google Play subscription lifecycle"
[2]: https://www.revenuecat.com/docs/getting-started/restoring-purchases "RevenueCat restoring purchases"
[3]: https://developer.android.com/google/play/billing/lifecycle "Google Play purchase lifecycle and real-time developer notifications"
[4]: https://www.revenuecat.com/docs/integrations/webhooks/event-flows "RevenueCat common webhook flows"
[5]: https://www.revenuecat.com/docs/customers/identifying-customers "RevenueCat customer identification"
[6]: https://support.google.com/googleplay/android-developer/answer/10281818?hl=en "Google Play Payments policy"
