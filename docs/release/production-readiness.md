# Production readiness

*Decision status: documentation-only commercial-release design pass. Every future release gate below is unchecked; no deployment, Android package, account system, checkout, or public paid endpoint is approved by this document.*

## Present release boundary — Implemented

Evidence reports a TypeScript check, 87 regression tests, a production web build, and narrow private-PWA browser scenarios. It also says the lab measurements are not field guarantees; see [implementation evidence](../experience/implementation-evidence.md). The Mealbook replacement/commercial service has no accounts, cloud personal-data store, billing, sync, Android package or public release. A separate **legacy prototype is already publicly deployed on Netlify**; its deploy ID/source SHA must remain unchanged during source integration, as recorded in [source integration](source-integration.md). The Docker default keeps `IMPORT_API_ENABLED=false`.

## Ownership and evidence checklist — Launch blocker

A release manager may not convert “planned” work into launch approval. Each gate needs a named accountable owner and an archived artifact, and all items below remain unchecked now.

- [ ] **Product owner:** approve promise, country scope, paid/free terms, price/tax display, cancellation/trial wording, and unavailable features. Evidence: signed decision and store-copy review.
- [ ] **Engineering lead:** approve isolation, API/database choice, migration compatibility, flags, rollback, capacity, and dependencies. Evidence: threat model, decisions, load/migration tests, and release manifest.
- [ ] **Security owner:** test auth, account-route authorization, SSRF, prompt containment, global limits, secrets, job isolation, scanning, and incident contacts. Evidence: remediation-tracked security test and access review.
- [ ] **Data/privacy owner:** approve the public privacy policy, retention/deletion schedule, data map, subprocessors, consent/disclosure copy, export format, account-deletion web page, and store Data safety declaration. Evidence: policy-to-implementation mapping and deletion drill.
- [ ] **Content-rights owner:** approve the public catalog, creator credit, source-text retention, thumbnail/media use, takedown workflow, and permitted source pathways. Evidence: rights register and platform review. The current private seed is not evidence of a licensed paid catalog.
- [ ] **Mobile/release owner:** build signed Android artifacts, protect signing keys, configure Play Console access with least privilege, complete required declarations, test upgrade/install/uninstall/restore, and prepare a staged rollout/revert plan. Evidence: reproducible signed-build receipt, test-track results, signing-key recovery record, and Play submission checklist.
- [ ] **QA and accessibility owner:** test sign-in, offline recovery, switching, conflicts, billing, deletion, screen readers, keyboard, touch, motion, contrast, and errors on physical devices. Evidence: device matrix, defects, accessibility audit, and moderated usability sessions. Existing lab checks are not substitutes.
- [ ] **Support/finance owner:** approve refund, cancellation, duplicate-purchase, account-recovery, source-takedown, and incident playbooks; staff an escalation path. Evidence: rehearsed tickets, support macros, ledger reconciliation report, and on-call roster.

## Safety, source, and public API controls — Launch blocker

A paid endpoint remains blocked until it authenticates the caller before consuming model/source resources; applies global, account, device, and entitlement-aware quotas; and returns understandable retry/limit reasons. Measure successful imports, duplicate/no-op requests, blocked URLs, model tokens, source-provider failures, job retries, queue age, and cost per successful reviewed draft. Never convert a payment into a promise that every video will work.

Source retrieval must maintain canonical URL validation, host/redirect/IP checks, body caps, separated egress, and an explicit creator-provided-text fallback. The extraction model receives untrusted source data only, has no tools or deployment secrets, and must not infer nutrition, allergies, medical suitability, food safety, or creator rights. Google’s policy prohibits unauthorized handling of YouTube audiovisual copies; it does not grant rights to republish recipe expression simply because a source can be viewed. [1]

Mealbook must not make medical, treatment, diagnostic, allergy-safety, or “safe for you” claims. Nutrition and targets remain user-entered or provenance-labelled planning information with unknowns shown as unknown. Google Play’s health policy requires relevant health declarations/privacy disclosures and prohibits misleading or potentially harmful health functionality; it also describes disclaimer expectations for non-medical apps with health/medical functionality. [2] This is a product/policy requirement, not a HIPAA claim or legal assurance.

## Proposed service objectives and operational telemetry — Proposed

No SLO is measured yet. The following are proposed acceptance thresholds to instrument before a pilot, not promises to users: monthly authenticated sync/API availability of at least 99.9% excluding announced maintenance; p95 lightweight sync/read latency under 500 ms; p95 accepted import completion under 75 seconds; import timeout/error rate below 3% excluding correctly rejected requests; and 99% of verified store/webhook events reconciled within five minutes. Baselines must be measured across real regions and physical devices before any external claim.

Proposed recovery objectives are RPO no greater than 15 minutes for durable account records and no greater than 24 hours for noncritical approved blobs, with RTO no greater than four hours for core account/sync service. These targets require encrypted backups, point-in-time recovery where supported, tested access to keys, and a documented dependency map. They have not been achieved or accepted.

Events must be structured, tenant-scoped, and content-minimized: authentication/session changes; API authorization and quota decisions; sync accepted/rejected/conflict/tombstone counts; job queued/started/finished/failed/cost; backup/restore/deletion milestones; billing event receipt/verification/reconciliation; and deployment/config changes. Alert on error budget burn, queue age, authorization anomalies, deletion failures, webhook backlog, restore failures, and abnormal unit cost. Do not log recipe text, nutrition logs, tokens, payment payloads, or raw sources merely to make dashboards convenient.

## Agent service readiness — Future evidence gates

The [agent architecture](../architecture/agents/README.md) and [future plan](../plans/2026-10-27-1205-feat-agent-friendly-mealbook-plan.md) are documented, not a running MCP/account service. Before public personal-data access or writes, prove shared app/API/tool records, explicit migration consent, OAuth discovery/audience/scope handling, ownership on every handle/job/cache, client revoke and source-text containment. Tool hints and provider “always allow” do not replace the [application approval contract](../architecture/agents/permissions-and-trust.md).

- [ ] Tested client/plan/platform/protocol matrix and truthful connection/upgrade copy, including ChatGPT read/fetch versus full custom-write limits.
- [ ] Real bidirectional UI/tool record parity, owned deep links and local-bridge disconnection; no fixture-only success or supposed remote IndexedDB access.
- [ ] Specific approval, changed-payload/stale-revision rejection, narrow grant ceilings and one-use actual cooking/eating/destructive confirmation.
- [ ] Durable idempotency and multi-client stock/quantity invariants, shared quotas/jobs and revoke/cancel/worker-loss recovery.
- [ ] Source acquisition versus external draft validation without provider model keys in the new path; disclosed data sent to the user's assistant.
- [ ] Content-minimized audit/history, safe export/read access under Free/expiry, staged write flags and measured service cost/recovery.

The ordinary manual app remains useful when the assistant/client/provider is unavailable. [Agent service objectives](../architecture/agents/scaling-and-operations.md) cover end-to-end tool acknowledgement/read hypotheses separately from the application API latency goals above; no SLO or compatibility test is claimed achieved by this documentation pass.

## Required runbooks and rollback behavior — Proposed

For **API or job outage**, on-call disables expensive job admission, preserves local-first core behavior, posts status, drains/retries only idempotent work, and documents client recovery. For **data restore**, the incident lead freezes writes, selects the recovery point, restores to isolated infrastructure, validates ownership/index/operation invariants, reconciles accepted operations after the recovery point, obtains approval, then reopens writes. A quarterly restore exercise must demonstrate the proposed RPO/RTO with evidence.

For **bad deployment or migration**, use additive, forward-compatible migrations, feature flags, canary rollout, and a compatibility window for the previous client. Roll back code first; do not “roll back” destructive data with an untested script. For **billing discrepancy/refund**, preserve the raw provider notice in a restricted ledger, verify it against the provider, recalculate entitlement, notify support, and reconcile before manual adjustment. For **rights/safety takedown**, disable the relevant catalog/import source, retain only necessary audit facts, remove public exposure, and communicate the user-facing fallback.

## Distribution, privacy, and store compliance — Launch blocker

Android release requires protected signing material, separate test/production credentials, reproducible versioned builds, upgrade testing, crash/ANR monitoring, published privacy/support/deletion URLs, accurate data-safety disclosures, and physical-device evidence. Store-billed digital Pro functionality normally requires Google Play’s billing system under Google’s Payments policy. [3] A server purchase lifecycle is still required because cancellation, refund/revocation, renewal, or a store-side change may occur outside the app; Google recommends backend lifecycle management with real-time developer notifications and verification. [4]

If accounts are introduced, Google Play requires a discoverable in-app and external deletion path and deletion of associated data rather than account freezing. [5] The privacy policy must describe actual collection, sharing, retention, and deletion behavior, including SDKs and billing processors. Obtain qualified legal/privacy review for applicable jurisdictions; this document offers no compliance certification or legal assurance.

## Go/no-go — Launch blocker

Go is prohibited until every relevant unchecked gate is accepted with dated evidence, the proposed objectives have a measured baseline, restore and rollback drills pass, source/catalog and privacy decisions are approved, and subscriptions are server-verified as specified in [subscriptions](../commercial/subscriptions.md). The correct present state is **no public commercial release**.

## References — Approved direction

[1]: https://developers.google.com/youtube/terms/developer-policies "YouTube API Services developer policies"
[2]: https://support.google.com/googleplay/android-developer/answer/16679511?hl=en "Google Play Health Content and Services policy"
[3]: https://support.google.com/googleplay/android-developer/answer/10281818?hl=en "Google Play Payments policy"
[4]: https://developer.android.com/google/play/billing/lifecycle "Google Play purchase lifecycle and real-time developer notifications"
[5]: https://support.google.com/googleplay/android-developer/answer/10144311?hl=en "Google Play User Data and account deletion policy"
