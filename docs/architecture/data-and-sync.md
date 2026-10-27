# Data and sync

*Decision status: proposed future data architecture. It does not migrate or upload the current private PWA data.*

## Version-one data contract — Implemented

The present `AppState` and `ExperienceState` are version-one, private device records. They contain recipes, plans, cooking sessions, prepared batches, grocery coverage/history, targets, and consumption entries; cooking and consumption already retain recipe/nutrition snapshots. [README](../../README.md) also documents JSON backup/restore and a 32 MB import limit. There is no account ID, server record, sync operation, billing ledger, or organization boundary today.

That distinction matters: planning is not cooking, cooking is not eating, and a prepared batch must not change because its book recipe is later edited. The target model preserves these product invariants rather than flattening the current state into mutable recipe rows.

## Common record envelope and ownership — Proposed

Every user-owned server entity uses an opaque `id`, `owner_account_id`, `schema_version`, timestamps, `created_by_device_id`, and `last_operation_id`. Mutable records carry `revision`; deletable records carry tombstone fields and an expiry policy. Server timestamps order acceptance; IDs must not encode personal content.

The server derives `owner_account_id` from the verified session and never accepts it as a client authority. Every query, blob grant, queue job, export, index, and cache key includes that derived owner scope. Required unique constraints include `account(identity_provider, provider_subject)`, `sync_operation(owner_account_id, operation_id)`, `device(owner_account_id, installation_id)`, and, where a source has a stable external identifier, `owned_recipe(owner_account_id, source_provider, source_external_id)`. The last constraint prevents an accidental duplicate retry; manual recipes have no artificial global uniqueness rule.

Local stores use separate databases or encrypted keyspaces for `local-v1`, `account:<opaque-id>`, and no active session. An account switch clears memory and keys; it must never expose, merge, upload, or search a prior cache. On logout, offer export then remove the signed-in cache and credentials.

## Core entities and immutable food facts — Proposed

`Account` holds identity references, status, consent/version markers, and deletion-request state. It does not contain a public profile or organization concept in the first commercial scope. `Device` holds the account-scoped installation ID, public key or credential reference, app/schema versions, registration/revocation times, and last successful sync.

`OwnedRecipe` holds user-edited recipe fields, `revision`, favourite/organization fields, source/provenance, nutrition provenance, and a soft-delete tombstone. Its provenance includes source provider, canonical locator, creator credit as supplied, acquisition method (`description`, `captions`, or `manual`), acquisition time, retained evidence policy, and review state. It is a private personal copy, not a claim that Mealbook licenses it for public redistribution.

A separately versioned `CatalogRecipe` is a licensed or original public-catalog record with `catalog_version`, rights/license record, territory/term, attribution, asset rights, and withdrawal state. `LibraryEntry(owner_account_id, catalog_recipe_id | owned_recipe_id)` lets a person save a catalog reference without turning their private-source import into catalog content. Search/index pipelines must partition these two origins. A paid public catalog is a **launch blocker** until its rights, creator attribution, withdrawal process, and platform use are reviewed.

`RecipeRevision` retains content when a meaningful edit wins or needs review. `Plan`, `PlanChoice`, `CookingSession`, `GroceryIntent`, `PurchaseRecord`, and `GroceryCoverage` are owned planning/workflow records with the same envelope.

`PreparedFood` is immutable after confirmation: `id`, owner, recipe ID, full recipe snapshot, source-servings, actual yield/unit, nutrition-per-unit snapshot, storage state/notes, made time, and provenance session. Its available amount is derived from immutable `PreparedFoodAllocation` and `Consumption` events, not overwritten by a recipe edit or a client counter. `Consumption` is likewise immutable: batch/recipe reference, recipe and nutrition snapshot, units/servings, occurred-at, and provenance. Undo creates a compensating `ConsumptionReversal` referencing the original consumption; it does not mutate a historical food/nutrition record. Server constraints reject an allocation or consumption that would make available portions negative, while allowing an explicit correction workflow with an audit reason.

## Sync protocol and conflicts — Proposed

Clients append typed operations to a local outbox before updating their local read model. An operation contains `operation_id`, `device_id`, monotonically increasing `client_sequence`, `schema_version`, entity type/ID, expected base revision, mutation payload, and client occurrence time. The server processes an operation transactionally under the derived account scope, records the operation ID, and returns the same accepted/rejected result for every retry. This provides at-least-once transport with idempotent effects.

A sync response includes accepted operations, a stable `server_sequence`, changed records/tombstones, conflict descriptors, and minimum schema. Tombstones persist until every active device advances past them or retention expires. A full snapshot serves stale or reinstalled devices.

Conflicts are deterministic and visible. Append-only food, consumption, purchase, and cooking-completion records merge by unique ID after invariant validation. Independent recipe metadata edits may resolve with a deterministic `(server accepted time, device ID, operation ID)` ordering and retain revision history. Concurrent edits to recipe title, ingredients, steps, nutrition provenance, or a plan’s locked choices do **not** silently blend text or quantities: the server creates a conflict variant or rejects with the current revision, and the client asks the user to keep, replace, or manually merge. Ready-food reservations, portion edits, and consumption are never last-write-wins; stale requests return `STOCK_CHANGED` and require a refreshed review.

Tombstones win against stale updates. A deleted personal recipe disappears from the editable book but remains as a labelled snapshot reference where history needs it. User-initiated purge is only permitted after dependent snapshots have been anonymized/retained according to the disclosed deletion rule; it cannot erase the facts of a completed consumption from another entity by accident.

If a device was uninstalled while offline, reinstallation has no authority to recreate its old cache. After sign-in it fetches the current snapshot. If an older offline installation later returns, its authenticated device registration, base revision, and operation IDs still apply; it can merge safe append-only events or receive conflicts, but cannot resurrect tombstoned records or overwrite newer food availability.

## Backup, migration, and deletion — Proposed

Migration from version-one begins locally. The client parses and validates a selected v1 backup into a staging vault, preserves the original backup for export, and shows the account to which the user is about to import. Only an explicit confirmation creates a server `migration_id`; `migration(owner_account_id, backup_fingerprint)` is unique so retries cannot duplicate food or intake. Existing recipe provenance, unknown nutrition values, prepared snapshots, and consumption records stay intact. Unsupported fields are reported, not discarded silently. Keep the current 32 MB limit as a reviewed starting boundary, then measure encrypted upload and mobile-memory behavior before changing it.

Local v1 data must not be automatically attached after a user signs in, nor uploaded when a different account later signs in on the same device. The user chooses export, retain local-only, or import into the currently visible account after a clear ownership confirmation.

Account deletion is an online authenticated operation: revoke sessions/devices, stop jobs, create a deletion case, remove application data and blobs according to the published schedule, and write only the minimal protected completion/audit record that the disclosed policy permits. Discard queued local operations and wipe the account keyspace. An offline device should show that deletion requires a connection; when it reconnects, server deletion/tombstones override its unsent edits. Google Play requires deletion initiation inside and outside an app that allows account creation, and requires associated data to be deleted rather than merely freezing the account. [1]

## Launch dependencies — Launch blocker

There is no accepted account schema, relational provider, authentication provider, sync service, migration executor, or deletion policy yet. Before implementation, test a multi-device prepared-food conflict, retry every mutation after a lost response, account switching on a shared Android device, v1 import retry, deletion while an old device is offline, and catalog-rights withdrawal. Production acceptance is owned by the release gates in [production readiness](../release/production-readiness.md).

## References — Approved direction

[1]: https://support.google.com/googleplay/android-developer/answer/10144311?hl=en "Google Play User Data and account deletion policy"
