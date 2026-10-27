# Upgrade integration review

**Scope:** read-only validation of the approved YouTube-import upgrade in the current working tree, with emphasis on import/server boundaries, provenance, save-to-plan/shopping behavior, offline backup compatibility, share target routing, and Cook Mode. No browser session, external network/LLM call, build, configuration change, or personal IndexedDB access was performed.

**Review status:** changes are **not ready to enable in the production container** until the blocking server finding below is fixed. The import API remains safely disabled by default in the Docker image. Separately, the parent agent is already fixing the `RecipeImport` restored-draft validation/initial-state issues; those in-progress fixes are intentionally excluded here to avoid duplicating that work.

## Evidence collected

- `pnpm test` was run by this reviewer: **26 passed, 0 failed**.
- I did not rerun TypeScript or the production build because the parent had concurrent build work; parent status reported those checks passing.
- Existing tests substantiate URL allowlisting/SSRF resistance, description-first acquisition, caption fallback, manual-text fallback, disabled-by-default import gating, numeric clearing for an unsupported *number*, source-evidence recipe validation, 119-recipe seed validity, plan replacement, shopping scaling, and nutrition-basis canonicalization.
- The development-plugin record is candid: native plugin registration was validated, but the Anthropic model-session check stopped for low credit. This review makes no claim of a successful native model-driven audit.

## Confirmed findings

### 1. Blocker — the Docker image cannot invoke its installed `yt-dlp` module

**Locations:** `Dockerfile:4-7`; `server/youtube-provider.ts:14-18`, `175-180`, `226-239`.

The Dockerfile creates `/opt/recipe-tools`, places that virtual environment first on `PATH`, and installs `yt-dlp` into it. The provider then replaces the child process environment with `MINIMAL_ENV`, whose `PATH` is only `/usr/local/bin:/usr/bin:/bin`, and spawns `python3 -m yt_dlp`. In the built image, that resolves to the system Python rather than `/opt/recipe-tools/bin/python3`; the system interpreter does not receive the package installed in the virtual environment. The first real metadata call will therefore fail with an unavailable `yt_dlp` module instead of retrieving source metadata.

This is masked by the current test suite because `tests/youtube-import-server.test.ts` injects a fake `YouTubeSourceProvider`; it does not execute `YtDlpYouTubeProvider` under the Docker runtime.

**Action:** preserve the approved virtual-environment executable in the scrubbed process environment (for example, put `/opt/recipe-tools/bin` first in `MINIMAL_ENV.PATH`), or pass a fixed, non-user-controlled Python executable path such as `/opt/recipe-tools/bin/python3`. Add a no-network test that verifies the spawned executable/environment can resolve `yt_dlp` in the production image. Do not enable `IMPORT_API_ENABLED=true` in production until this passes.

### 2. High — numeric provenance validation accepts invented ingredient units and semantically mislabelled macro values

**Locations:** `server/recipe-extractor.ts:109-116`, `343-354`, `408-421`, `426-446`; impact in `packages/meal-domain/src/shopping.ts:45-58`, `114-128`.

The prompt requires both number **and unit** support, but `normalizeRecipeDraft` only checks that the number appears in `rawSourceText`. It unconditionally keeps `ingredient.unit` when that check passes. For example, an extraction of source text `2 tomatoes` with `{ quantity: 2, unit: "kg" }` passes the present check, then the shopping engine treats it as 2,000 g. This is a source-grounding failure, not merely a review wording issue.

The same generic `numberInQuote` proof is used for all reported macros. It does not verify that a value is adjacent to the correct macro label or expected unit. Given evidence such as `Protein 30 g; Calories 500 kcal`, a swapped response (`calories: 30`, `protein: 500`) passes because both numbers occur somewhere in the quote. The basis regex is conservative, but it does not establish each macro’s label/value association. The review UI lets a user subsequently confirm a basis, so the incorrectly retained source-reported values can become actionable nutrition.

The existing clearing regression at `tests/youtube-import-server.test.ts:240-278` covers an invented numeric value (`99`), but not an unsupported unit or cross-labelled macro values.

**Action:** replace number-only proof with field-aware evidence checks. For ingredients, retain a numeric quantity only when the source quote supports both quantity and the normalized unit; otherwise clear at least the unit and, where the amount is no longer meaningful, the quantity, while retaining the original wording and a warning. For nutrition, match each macro against its own accepted label/unit context (for example `calories`/`kcal`, `protein`/`g`, `sodium`/`mg`) and clear unverifiable values. Add focused, fixture-sized tests for `2 tomatoes` → claimed `kg`, and for swapped calorie/protein values in the same evidence quote.

### 3. Medium — the UI rejects backups above 8 MB despite the restore implementation accepting up to 32 MB

**Locations:** `apps/web/src/components/Settings.tsx:17-24`; `apps/web/src/App.tsx:291-295`.

`Settings.choose` rejects every selected JSON file over 8 MiB before it invokes the supplied restore handler. The actual parser in `App.readJson` is configured for up to 32 MiB. Consequently, the approved 32 MB restore capacity is unreachable from the user-facing restore control. Source evidence can materially increase a backup’s size, making this more than a theoretical mismatch.

**Action:** use one shared backup-size constant and set both the Settings picker gate and `readJson` to the approved 32 MiB policy (with matching user copy). Add boundary tests around the shared limit; this does not require a giant 100-item fixture.

### 4. Medium — caption fallback silently ignores available non-English captions

**Locations:** `server/youtube-provider.ts:264-267`, `337-360`.

The provider chooses only `en` or an `en-*` language. When a video has, for example, an available manual `es` caption and no English caption, it returns `unavailable`, even though captions exist. The product and UI state that available captions are used when descriptions are insufficient; neither documents an English-only limitation.

**Action:** retain English preference, then fall back deterministically to an available manual caption language and then an available automatic-caption language (or document and surface a deliberate language restriction). Add a provider test with a non-English caption-language list and a mocked caption download; no live YouTube request is needed.

### 5. Medium — chunked oversized requests can lose the required JSON error response

**Locations:** `server/app.ts:81-108`, `342-357`.

For a request without an oversized `Content-Length`, `readJsonBody` calls `request.destroy()` once streamed bytes exceed 100 KiB. Destroying the request/socket triggers the response `close` handler, which aborts the response controller. The route catch deliberately does not call `errorResponse` when that controller is aborted or the response is destroyed. The client therefore receives a connection failure rather than the intended `413` JSON error envelope. The declared-content-length branch does return the JSON error correctly, so this only affects streamed/chunked oversized bodies.

**Action:** stop parsing after the limit but drain/resume the request rather than destroying the socket, guard settlement/listeners, and send the normal `413 REQUEST_TOO_LARGE` response. Add a raw chunked `http.request` regression that exceeds the body cap without a `Content-Length` and asserts the status plus JSON envelope.

## Verified behavior outside the findings

- **URL and SSRF boundary:** `parseYouTubeReference` admits only canonical HTTPS YouTube video IDs/hosts, rejects credentials, ports, non-video paths, and look-alikes; the server passes only its canonical generated URL to `yt-dlp` (`packages/meal-domain/src/youtube.ts:3-28`; `server/app.ts:251-257`). Existing parser/server tests cover malformed and cross-site cases.
- **Credentials and persistence boundary:** model credentials are read only in the server extractor and sent server-side; the server has no recipe/plan/log persistence code. The client uses relative API requests and the service worker explicitly bypasses `/api/` caching (`server/recipe-extractor.ts:208-218`, `301-314`; `scripts/generate-sw.mjs:19-27`).
- **Production gating:** the Docker image defaults `IMPORT_API_ENABLED=false`, and the API rejects paid preview calls when disabled (`Dockerfile:20-21`; `server/app.ts:236-239`; test at `tests/youtube-import-server.test.ts:280-298`).
- **Review/edit/save flow:** the review surface provides title, yield, tags, categories, roles, ingredients, source wording, and steps controls before an explicit save. Unknown quantity may remain `null`, and nutrition remains non-actionable until a basis is confirmed (`apps/web/src/components/RecipeImport.tsx:298-308`).
- **Duplicate identity guard:** a save uses `youtube:<videoId>` and `App.openExistingYouTubeRecipe` also detects a canonical YouTube source URL, so an existing saved recipe is opened rather than overwritten (`apps/web/src/components/RecipeImport.tsx:228-253`; `apps/web/src/App.tsx:164-196`).
- **Existing plans and shopping state:** adding an unplanned recipe leaves existing shopping signatures unchanged; once selected through the existing batch/slot controls, shopping uses the same domain scaling and reconciliation path (`apps/web/src/App.tsx:164-180`, `241-264`; `apps/web/src/state-utils.ts:8-20`; `packages/meal-domain/src/shopping.ts:84-186`). Existing regression tests cover batch replacement and preservation/unchecking of shopping checks.
- **Source-evidence compatibility:** `sourceEvidence` is optional, validated, copied into a canonical `Recipe`, and therefore survives `validateState` recipe validation (`packages/meal-domain/src/types.ts:41-46`; `packages/meal-domain/src/validation.ts:237-275`, `613-663`). The recipe-level evidence validation test passes. A focused full-backup round-trip evidence test would still be useful, but no evidence-loss defect was found in this trace.
- **Sharing and offline UX:** the manifest declares a GET share target with `sharedUrl` and `sharedText`, and the app accepts a URL directly or extracts one from shared text (`apps/web/public/manifest.webmanifest:12-17`; `apps/web/src/App.tsx:40-57`). The service worker excludes API responses while caching local app assets.
- **Cook Mode:** ingredient checks are local UI state; the Wake Lock request follows an explicit user checkbox, releases on cleanup, and reports unsupported/denied access without breaking step navigation (`apps/web/src/components/CookMode.tsx:9-39`).

## Test gaps worth closing with small fixtures

In addition to the regressions named in the findings, the test suite should add: a full `validateState` backup fixture containing `sourceEvidence`; successful duplicate lookup through a non-ID canonical `sourceUrl`; and an imported recipe added to a plan followed by shopping-check reconciliation. These are small deterministic cases, not a request for a huge import fixture or live service/model test.

## Resolution and final evidence — parent integration

All five confirmed findings were corrected after this review. The provider's fixed PATH now includes `/opt/recipe-tools/bin` followed by the module-derived project `.venv/bin`, then system locations; no provider secrets are inherited. Caption selection retains English preference but accepts deterministic non-English manual/automatic fallbacks. Exact numeric/unit association clears invented mass claims and quantity ranges, recognizes supported fractions, and verifies each macro's own label and unit rather than merely finding its number. Yield stays unknown without explicit serving evidence.

The Settings picker and full-state parser now share the 32 MiB boundary. Streamed oversized JSON drains without destroying its response and returns a tested JSON 413. Same-origin Fetch Metadata protects genuine app requests across the public-origin/internal-Host proxy boundary. Saved review drafts are validated without resetting human-confirmed nutrition, and new shared videos prompt before discarding another review. Raw tags/categories/steps preserve commas and newlines during editing.

Final automatic evidence: **40 tests passed, 0 failed**, strict TypeScript passed, and `pnpm build` completed. The installed Impeccable detector returned **0 mechanical findings** on `apps/web/src`; this is not a subjective UX score or an award. New regressions include a full source-evidence backup round-trip, restored-draft/basis preservation, the shared backup boundary, chunked 413, proxy-origin behavior, supported fractions, invented/swapped/wrong-unit quantities/macros, multilingual caption selection and scrubbed interpreter paths.

A real metadata-and-managed-model import of the Louis Howard Smashburger Toasty description produced **15 ingredients and 10 steps**, preserving the explicitly reported 677 calories / 67 g protein / 39 g carbs / 27 g fat while leaving serving yield and per-serving totals unknown. No recipe was saved by that API check. The prepared Docker definition was not publicly deployed, and a real Android OS share-target/native APK test remains deferred to a published installed origin. Production paid imports remain disabled by default.

Final follow-through: **42 tests** now pass after adding canonical grocery-aisle aliases and source-confirmed removal of preparation-section suffixes (not dietary variants). The model schema requests canonical aisle names and ingredient identities, so duplicate main/sauce ingredients can consolidate without inventing quantities. Two real API imports were verified; the second video was absent from the initial 119-entry bank. Targeted browser checks at a separate test origin confirmed preserved trailing commas/newlines, explicit save into the shared recipe detail, cooking step progress, a one-recipe snack plan, chosen whole-batch replacement, and recalculated groceries showing the imported potatoes and cottage cheese. The test draft was controlled data constructed from real extracted facts; it did not alter the existing Preview origin or the user's phone data. The actual API response retains the full original text. Android OS-level sharing remains a deferred installed-origin check.
