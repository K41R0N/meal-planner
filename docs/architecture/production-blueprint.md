# Production blueprint

*Decision status: approved documentation direction only. This document does not approve a provider, implement services, or publish the product.*

## Current boundary — Implemented

Mealbook is a personal, Today-first offline PWA: React 19/Vite 6, shared TypeScript domain logic, IndexedDB, and local recovery checkpoints. Its Node 22 process serves static app assets and a bounded YouTube recipe preview. It has no accounts, payments, cloud personal-data database, sync, or exact macro-goal optimizer. Import defaults disabled in the container/configuration template; it is enabled explicitly in private Preview, which is not a public production-access approval. These are release facts in [README](../../README.md), [PRODUCT](../../PRODUCT.md), and [implementation evidence](../experience/implementation-evidence.md), not gaps this document closes.

The existing import bounds input, concurrency, and time; treats source text as untrusted; returns a review draft; and retains manual creator text. A commercial service must preserve those properties while moving identity, global abuse control, durable data, and entitlement decisions off the browser and single process.

## Product-aligned target topology — Approved direction

Keep the present React/Vite web client as the web surface. A later Expo Android client should share the TypeScript domain contracts and test fixtures, but must own native UI, local persistence adapters, secure credential handling, billing presentation, and Android lifecycle behavior. The two clients must not be treated as interchangeable wrappers.

Each client remains local-first:

- Web uses IndexedDB; Android uses SQLite. Both keep a durable operation outbox and an account-scoped local read model so cooking, portions, grocery work, and already-downloaded recipes still work offline.
- A versioned shared domain package holds validation, nutrition provenance semantics, shopping compatibility, snapshot rules, and operation schemas. Transport, authentication, and database models remain server-specific.
- A hosted API accepts authenticated commands and read queries. It verifies scope and entitlement, assigns server sequence numbers, and exposes conflict results. It is not a pass-through database connection.
- A background-job service runs source retrieval, recipe extraction, bulk import, reconciliation, and deletion jobs outside request handlers. A private relational database stores account data and an object store holds only approved large artifacts or encrypted raw inputs with lifecycle rules.

The existing hosted static build cannot safely become this architecture by adding a public import URL. A static frontend may still serve offline assets, but account APIs, paid work, jobs, and secrets require a separate authenticated service plane.

## Provider choice and service seams — Proposed

Use managed platform capabilities by default when a future Manus deployment is selected: runtime, secret store, backup-capable database, object storage, queue/scheduler, observability, and access control. This is a deployment preference, not provider approval or evidence that services exist today. Interfaces remain vendor-neutral:

- `IdentityGateway` returns a stable opaque account subject, verified session claims, and deletion status.
- `MealbookStore` performs transactional account-scoped reads/writes, operation idempotency, snapshots, and tombstones.
- `WorkQueue` accepts a typed job with an idempotency key, deadline, tenant scope, and cost budget.
- `BlobStore` issues scoped upload/download grants; it never exposes a bucket listing or durable public source-text URL.
- `EntitlementAuthority` answers a server-signed eligibility decision from the billing ledger. Its candidate implementation may integrate RevenueCat, but RevenueCat is not selected.

A relational-store decision remains open. Evaluate **MySQL** and **Postgres** against transactional invariants, JSON/indexing needs, migrations, backup/restore, regional availability, encryption, retention, cost, and operational ownership. Benchmark synchronization, conflict, ledger, restore, and deletion workloads before selection. Neither, nor Supabase or another database vendor, is accepted by this blueprint.

## Public-service trust boundary — Proposed

The edge/API layer must verify the session, apply global and per-account/device quotas, authenticate requests before accepting costly work, and emit a trace/correlation ID. Rate limiting must be shared and durable; the current in-memory IP limiter is not sufficient across instances. Paid import, bulk import, sync mutation, and export endpoints get separate quotas and back-pressure rather than a single generic limit.

For remote recipe sources, allow only supported HTTPS URL forms after canonical parsing. Resolve and re-check the destination after redirects, reject private/link-local/metadata addresses and non-allowlisted hosts, cap redirects/bytes/content type, and isolate retrieval egress from the database and metadata services. Keep an explicit pasted-text path because source access can fail. Do not download, cache, or expose YouTube audiovisual material; YouTube policy prohibits API clients from downloading, importing, backing up, caching, or storing copies without prior written approval. [1]

Treat creator text, captions, URLs, titles, and model output as hostile data. The extractor must keep its existing “data, not instructions” rule, use schema-constrained output, perform provenance validation, and have no tool, network, filesystem, or secret access beyond its narrowly scoped input/output job. Jobs run with a per-job identity, CPU/time/token/output ceilings, encrypted temporary files, no inherited deployment secrets, and a poison-job/dead-letter path. Human review stays required before a personal recipe is saved or distributed.

Secrets live only in the managed secret store and are rotated/revocable; clients receive no model, billing, or provider credentials. Logs must redact tokens, source text, health/nutrition entries, and payment payloads. Audit records contain identifiers, decisions, timing, and reason codes rather than recipe contents.

## Admission conditions for the hosted plane — Launch blocker

Do not expose a public paid endpoint until the following have design and test evidence: authenticated account scope, global quota enforcement, SSRF/egress tests, job isolation, abuse-response ownership, data deletion path, source/platform-rights review, billing authority, and production incident runbooks. The current import service is therefore **not public-release ready**, regardless of whether its private Preview flag is enabled.

The service API and the data model are intentionally detailed in [data and sync](data-and-sync.md). Commercial eligibility and store-event handling are intentionally detailed in [subscriptions](../commercial/subscriptions.md); neither document authorizes checkout or account creation.

## References — Approved direction

[1]: https://developers.google.com/youtube/terms/developer-policies "YouTube API Services developer policies"
