# Agent service scaling and operations

**Proposed sequence, not deployed infrastructure.** Scale the Mealbook data/action service, not a Mealbook model fleet. The user's assistant performs inference; Mealbook still pays for data storage, retrieval, query/validation traffic, jobs, abuse controls and support. Start with a measured real-app vertical slice before committing to vendors or distributed components.

## Protocol and client compatibility

The official MCP revision **2026-07-28** removed protocol-level sessions and the old GET stream from modern Streamable HTTP. Each request declares its version/capabilities; transport metadata headers must agree with the body. Earlier clients initialize a session and need an explicit dual-era compatibility path. A modern-only server can fail against a legacy client even though both say “Streamable HTTP.” [1][2]

Choose the maintained official TypeScript server SDK after a compatibility spike. Its main branch now documents stable v2 split packages (`@modelcontextprotocol/server` and optional `@modelcontextprotocol/node` for the existing Node HTTP host); v1 lives on its maintenance branch. Do not copy outdated v1 setup instructions into a v2 deployment or assume SDK compatibility without a client test. Pin the selected versions in the implementation lockfile; no SDK was installed in this pass. [3]

Prefer disposable, stateless MCP handlers with explicit application job/change IDs. Where tested client support requires legacy sessions, isolate the compatibility adapter and keep necessary session/cursor state in bounded shared storage or use a documented affinity strategy. Business records, grants and approvals never live only in that session. Do not require optional MCP subscriptions, sampling, app UI, or task extensions to finish the ordinary tool flow.

Claude's hosted connector calls a publicly reachable endpoint through Anthropic's cloud, even when the user uses Desktop. A laptop-only/loopback bridge is for local developer clients, not a production Claude or ChatGPT consumer connection. Authenticated staging/public reachability or a deliberately configured secure development tunnel is a separate, approved deployment step. No tunnel/public endpoint is created by this plan.

The [client matrix](../../research/agent-integrations/README.md) is dated and must be rechecked at implementation and launch. Full custom-MCP writes in the researched ChatGPT path are not established for ordinary Pro/Plus/mobile users. Offer tested read-only or manual-review handoff where supported; never disguise writes as read tools to bypass client restrictions. Optional directory submissions can broaden discovery, but are separate policy/availability decisions.

## Stage A — Prove the private application's connection

Extract a typed query/command boundary from browser orchestration into shared application handlers. Use a user-paired loopback companion against the actual open private app for development, with the browser still the authority. Include the minimal permitted-source/evidence validator and trusted app prepare/review/apply policy in this local slice before enabling their tools; remote account/job units extend them later. It must preserve current backups, explicit approval, revisions and food invariants; a process cannot silently read another origin's IndexedDB. Return a clear disconnection state and make reconnect inspect prior operation outcomes.

**Exit evidence:** the same recipe/version, proposed week and shopping change appear in both the tool client and the actual web UI; an app edit appears in tool reads; interruption/replay does not duplicate effects. At least one local MCP client can complete a source-to-reviewed-book-to-week-to-shop scenario without operator inference keys. This is not a commercial remote release or proof of mobile consumer support.

Before expanding MCP-specific remote infrastructure, compare intended users' correction/shopping effort and successful completion against the ordinary manual loop, with predeclared outcome criteria. Improve a technically correct but unhelpful workflow before scaling it. Existing commercial account/sync work has its own independent product rationale; this gate does not cancel that roadmap or authorize recruiting a study now.

## Stage B — Account-scoped remote alpha

Implement the approved account/ownership/sync foundation before publishing personal-data tools. Use a transactional relational store for book versions, plans, batches, consumption, grants, operation outcomes and source-review jobs; object storage may hold permitted source artifacts. Keep the existing frontend/domain stack and add the smallest Node application/MCP service that meets auth, sync and client compatibility needs. A managed identity/database provider is a candidate to compare, not selected here.

Deploy one service instance plus a controlled source worker/queue and bounded staging tenants. Even one instance needs persisted operations, approvals, quota accounting and job state: restarting the process cannot lose an applied result or turn retries into duplicate consumes. Backups, migration rollback, owner-isolation tests and revocation precede external user access.

**Exit evidence:** verified user OAuth from the target client, real account records shared with signed-in PWA, explicit migration consent, approval/replay/stock/conflict tests, source-job deadline/cancel recovery and a measured cost ceiling. Anonymous public imports are not a substitute for account quotas.

## Stage C — Multi-instance service

Separate API/MCP instances from source acquisition workers. Put transactions and idempotency in the database, rate/quota reservations in shared storage, jobs in a durable queue, and permitted source blobs in owner-scoped object storage. No per-process in-memory import counter or IP map is the global quota. IP throttling complements account/client limits; it does not define ownership or paid entitlement.

Scale ordinary reads independently from expensive source work. Start with relational indexed search over owned metadata; introduce a separate search service only after measured query/load needs justify it. If introduced, every indexed document and query remains account-scoped. Public immutable data can be shared only where its permissions/licensing allow; private extracts, preferences and tool context cannot leak through a global cache keyed only by URL or recipe title.

Apply queue backpressure, bounded retry with terminal reasons, host/domain acquisition limits, resource/time caps and a fair per-account budget. Cancellation/revocation checks occur before costly work and before commit. Reserve cost atomically, reconcile it on terminal outcome, and keep failed/blocked/cancelled previews out of the paid successful-import counter while retaining operational abuse limits.

**Exit evidence:** worker/process loss and rolling deployments preserve job/approval/outcome state; concurrent replicas cannot exceed a grant or consume the final portion twice; source backlog is observable and contained; no account can access another through query, job, cache, export or index. Horizontal scaling is enabled by these proofs, not a diagram alone.

## Stage D — Broader distribution and reliability

Only add regional routing, separate read models, more specialized search or additional queues when measured bottlenecks and recovery needs justify them. Keep the authoritative record/version/permission service common. Native Android is another consumer of the same contract; do not build an Android-only agent book. Household roles are a separate later design, not an organization switcher smuggled into the first release.

Test client upgrades and tool-schema changes with an announced compatibility window and stable semantic versions. An unsupported client/capability gets an actionable error. Directory listing, rich MCP app cards and broader ChatGPT distribution follow platform review and verified availability; do not pay for acquisition into an unsupported connection path.

## Cost, performance and service observability

Measure cost per successful reviewed import, useful prep week and active account, including source jobs, storage, tool calls and support—not only model tokens we no longer buy. Rate-limit total validation/read calls and source attempts across UI and MCP so an agent cannot bypass allowances by splitting requests. Free and Pro service limits are owned by [subscriptions](../../commercial/subscriptions.md).

Initial operational objectives should be declared before alpha measurement, not advertised as results. Candidate targets: normal owned-data reads p95 under one second, fast mutation/approval acknowledgement under two seconds excluding human review, and durable source-job acknowledgement within two seconds. Source completion has a provider-specific deadline/status rather than an invented uniform success time. Tune these hypotheses against measured mobile/backend performance and the actual client timeout; they are not current benchmark scores or SLAs.

Record IDs, operation type, actor/client, latency, status/reason, grant/quota decision and schema/policy version. Do not put raw captions, recipe bodies, source tokens, diet/food diary entries or assistant conversations in generic logs. Retain security/audit data under a reviewed policy; separate user-facing action history from debugging telemetry.

Alert on isolation failures, repeated authorization errors, stuck jobs, quota reconciliation drift, approval replay, stock conflicts and source failure changes. Feature flags can disable source providers or **new agent writes** while preserving book reads/export and the ordinary cooking UI. A reconnect checks old committed outcomes; a rollback cannot forget them. Run restore, revoked-client, multi-device conflict and provider outage exercises before promising production availability.

## References

1. [MCP modern Streamable HTTP and legacy behavior](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
2. [MCP versioning and dual-era compatibility matrix](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
3. [Official TypeScript SDK: stable v2 and maintained v1](https://github.com/modelcontextprotocol/typescript-sdk)
4. [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
