# Data lifecycle and inference register

Updated October 27, 2026. This is a current-state inventory plus **proposed** production policy. A purpose/retention label here is not a deployed TTL or legal policy. The privacy owner must approve the final periods and map them to implementation before public import access, account provisioning or a paid pilot.

## Current private-PWA behavior

| Data class/location | Trigger and purpose | Observed retention/deletion | Required release evidence |
|---|---|---|---|
| Personal recipes, plans, ready batches, grocery history, targets and consumption in IndexedDB | User saves/changes personal app state | Persists on that browser origin until user/browser clears it; no account/server copy | Document backup, browser eviction and origin-change consequences; test restore before clear |
| LocalStorage recovery envelope | User action invokes private save | Newest saved state checkpoint; browser storage limits can prevent it | Show errors and preserve recovery behavior; no claim of encrypted device data or unlimited capacity |
| Import review and raw editing draft in sessionStorage | User attempts/reviews an import | Session-scoped browser record; explicit clear/cancel paths depend on UI action | Test cancel/reopen/close and document that session recovery is not durable cross-device backup |
| Service-worker cache | First successful production download/activation | Public app shell, recipe seed and bundled images; private API responses bypass cache | Test cache updates/removal and offline behavior; do not put personal records in app asset caches |
| User-downloaded JSON/CSV/SQLite/ZIP backups | Explicit export/download | Outside app control; device/cloud destination retains according to its own policy | Warn that account/app deletion cannot delete copies the user or recipients keep |
| Source text/metadata/captions in Node import execution | Explicit import request, description first and permitted fallback | In-memory request/subprocess/job inputs in the current implementation; no app personal-data database | Verify process/temp/access/error logs and hosting/proxy retention before claiming immediate/zero retention |
| Model extraction request/response | Source text submitted for draft extraction | Managed provider boundary; app code does not establish provider retention, training use or region | Approve provider/subprocessor terms, minimized data and retention; record actual routing |
| Access/error/network/provider logs | Host/runtime/network handling | No complete operational retention inventory established | Disable content/token logging; inventory processor and operator access, retention and deletion |
| Repository starter bank and source images | Developer build/distribution | Source-controlled research snapshot and public app assets, not personal private state | Rights register and licensed/original public starter replacement before commercial distribution |

The current state is not end-to-end encrypted. IndexedDB/localStorage use browser protections; do not advertise an encryption property that the app does not implement. The phrase “server does not save personal recipes” does not establish that no vendor, proxy or OS log can retain request data.

## Current-versus-proposed model paths

**Current extraction path:** `server/recipe-extractor.ts` selects `gpt-6.1-sol` and makes a schema-constrained `POST /v1/chat/completions` to the server-configured managed base URL. The current source uses `MANUS_API_URL` / `MANUS_API_KEY`, falling back to `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY`; the model is not a general browser-configurable arbitrary-provider integration. Environment injection is required; `.env.example` is documentation and is not auto-loaded. The source text, source type/title/creator and canonical video URL may leave the server for extraction. No personal food-log history or billing record is needed by this request.

**Known configuration hazard / follow-up:** the present code applies `??` independently to URL and key, not atomically to a complete pair. A partial mixed environment can combine one family's URL with the other family's key. Configure exactly one complete matching family and unset the other. Before a commercial adapter is accepted, change configuration resolution to reject partial/mixed pairs and prove it with tests; this documentation-only pass does not change runtime code or claim that fix has shipped.

The model has no application tools and receives source text as untrusted data. Code validates schema, units/evidence and quantities, and the user reviews before save. A failed provider yields a visible error and retained review input; manual recipe entry remains available. Supplying creator text avoids source-retrieval failure but **does not** eliminate the model/provider dependency for assisted extraction. Core saved-recipe/cooking/plan/shop use remains offline without inference.

**Proposed decision path:** Ollaya/Laya or an alternative organization adapter is unimplemented and unhosted. Minimal recipe revisions/preferences would be sent only after the separate model, license, privacy and budget gates in [decision models](decision-models.md). No nutritional facts, allergy safety, storage safety, payment decision or account permission may be inferred by that service. Current hosted extraction and proposed self-hosted decisions are separate systems and promises.

**Development tools:** Native plugin packages are installed, but no native model output is used as evidence for this documentation pass. Planning and review guidance was applied with host-side research, file checks and scoped reviewers. Development credentials or machine-specific account information are not part of the application model contract.

## Proposed production retention policy — not approved or active

The final policy needs a purpose, lawful/consent basis where applicable, retention trigger/period, location/region, export coverage, deletion behavior, backup treatment and accountable owner for each class. Suggested engineering defaults to evaluate are:

- Temporary import inputs: no durable raw content by default; if needed for resumable review, private encrypted storage with an explicit short TTL, for example 24 hours. Obtain permission and disclose the exact actual duration before activating it.
- User recipes/plans/cooking/consumption: retained while the account is active and under the user's access/export/delete controls. Historical snapshots and user-requested purge require explicit behavior; do not use immutable events as an excuse to retain personal data forever.
- Minimal operational logs: content-free correlation, failure and cost facts for a bounded period, initially evaluate 30 days; access restricted and deletion verified. Never log raw source text, tokens or detailed dietary history by default.
- Backups: encrypted rotating snapshots, evaluate a 30-day horizon with documented deletion expiration and restore-suppression rules; a restore must reapply completed account deletions, not resurrect them.
- Billing/tax/fraud records: restricted and minimized under a reviewed legal retention schedule, separate from recipe deletion and marketing consent. Do not invent one universal retention period for every jurisdiction.
- Model proposals: keep accepted user edits as ordinary recipe organization; expire stale raw requests/caches and retain only the required versioned proposal provenance. No cross-user private-recipe cache leakage.

These are starting proposals, not compliance advice or product guarantees. The user-facing policy must state what is deleted immediately, delayed in backups, retained for legal obligations and outside our control in exported copies.

## Required lifecycle proof before commercial use

An accountable privacy/data owner must approve the inventory, processor agreements, actual regional/provider routing, data minimization and supported deletion/export. Engineering must demonstrate deletion of primary records, objects, search indexes, queues, caches and local account stores; expiry of backups/logs; suppression after restore; and a returning offline device that cannot resurrect deleted data. Support must distinguish deleting an account from cancelling a store subscription.

For a paid pilot, first approve and implement identity/authorization, the entitlement and refund lifecycle, consent/measurement, retention/deletion and support. An alternative **non-commercial usability study** has no payment/renewal claims and needs its own consent and data-handling approval. This documentation pass authorizes neither study execution nor commercial billing.
