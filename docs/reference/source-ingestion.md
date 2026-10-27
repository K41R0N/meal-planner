# Source ingestion and recipe-bank lineage

## Purpose and current boundary

Meal Planner has two deliberately separate ingestion paths:

1. **The checked-in seed** at `apps/web/public/data/recipe-bank.json` is a 119-record, offline application input. It contains 100 `youtube:` records and 19 `legacy:` records (16 original recipes and 3 condiments).
2. **The interactive import service** is an optional server feature that turns one supplied YouTube URL or pasted source text into a **review draft**. It never saves a recipe by itself.

This document records how the historical source bank was selected, how the live single-video import works, and how to use the portable metadata collector/exporter without treating either as a live popularity service. It does not add a bulk extraction workflow or a new app feature.

## Historical Louis Howard selection: a dated snapshot

The sourced portion of the seed came from a historical preparation run over a **saved catalog of 242 Louis Howard channel entries**. The saved catalog was the universe for that run; it was not an independently verified statement about every video ever published by the channel. Metadata collection completed on **2026-10-27 UTC** (the historical manifest records `2026-10-27T01:00:41.665037+00:00`).

The rule was:

> Select the first 100 videos, in descending order of exact collected `view_count`, whose written YouTube descriptions contain an actual ingredient list with at least two ingredients.

The historical collector requested public metadata with `yt-dlp` in skip-download mode for all 242 catalog entries. It retained the returned integer `view_count`, title, description, upload date, channel/uploader metadata, canonical source URL, and thumbnail metadata. “Exact” means the integer value returned by the provider at collection time, in contrast with the channel-catalog display’s rounded view indicator. It does **not** mean a live count, a permanent ranking, an audited platform statistic, or a claim about current channel popularity.

The historical selector sorted all successfully collected metadata by descending integer `view_count`, with video ID as a deterministic tie-breaker. It then inspected descriptions in that order and stopped once 100 written-recipe-eligible records had been selected. Each source video remains a separate record: variants were not silently deduplicated.

### Eligibility and exclusions

A record qualified only when its **written description** supplied an ingredient list with at least two ingredients. A title, short-form promotion, review, bare external link, recipe mention, or unavailable/empty description did not qualify. The rule did not use captions, spoken content, third-party recipe pages, inferred ingredients, or nutritional estimation.

The historic extractor used an automated, source-grounded `has_written_recipe` classification to apply that explicit rule. It is not a human culinary judgment, diet claim, safety assessment, or a replacement for review. It also produced editable organization suggestions (meal types, tags, suggested aisle) and extraction-quality gaps. Those are clearly distinct from eligibility: only the ingredient-list rule decided whether a description could enter the top-100 selection; the suggestions were never treated as source facts.

A run with failed metadata rows could not honestly claim an exact top-100 result. The prior workflow failed rather than ranking a partial catalog. Videos with a valid metadata record but no qualifying written ingredient list were represented as examined exclusions, not converted to recipes. Nutrition without an explicit serving or whole-recipe basis remained `unspecified`; missing data remained `null`.

The checked-in app seed preserves the resulting view snapshot per sourced recipe in `viewCount` and `viewCountAt`, along with `sourceUrl`, `sourceName`, `creatorCredit`, source wording for ingredients where available, reported nutrition, nutrition basis, evidence, and `dataGaps`. The 19 original records intentionally have no source-view rank. Do not display or describe the sourced records as “today’s most viewed” or re-sort them as though their historical counts were current.

## Single-video import in the running app

The implementation lives in `server/app.ts`, `server/youtube-provider.ts`, and `server/recipe-extractor.ts`.

1. The browser sends `POST /api/recipes/preview` with a secure YouTube URL and optional `sourceText`.
2. If the user supplied source text, the server uses that text as the source. Otherwise it asks `yt-dlp` for public **metadata only**. It checks a sufficiently recipe-like description first, then tries available captions only when the description is insufficient. Manual captions are preferred over automatic captions.
3. The server sends bounded source text to the managed model and requires a strict JSON recipe draft. The normalizer retains only quantities, yields, macros, and nutrition bases supported by verbatim source evidence; unsupported values are cleared to `null` and surfaced as review warnings.
4. The browser shows the source, draft, and warnings. The user can correct fields and must actively save. No personal recipe, plan, or log is persisted by the server.

The provider uses `--skip-download`, `--no-playlist`, no media format selection, no account login, no cookies, and a scrubbed child environment. It has a 45-second subprocess deadline, retry limits, text/output caps, and block detection. A YouTube access block is reported as a block; it is not bypassed. The supported fallback is creator-provided written text pasted by the user. The current request path also has a 100 KB request body limit, an 80,000-character source-text limit, a 95-second end-to-end deadline, five requests per address per minute, and two active imports by default.

Captions are a runtime fallback only. They were not part of the historical written-description eligibility filter and must not be retroactively used to change the source-bank ranking claim.

## Server environment and managed model access

The server is the only place that reads managed-model credentials. `ManagedRecipeExtractor` calls:

```text
POST {base URL}/v1/chat/completions
Authorization: Bearer {API key}
model: gpt-6.1-sol
```

It resolves a matching endpoint/key pair from `MANUS_API_URL` and `MANUS_API_KEY`, falling back independently to `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` when the corresponding `MANUS_*` value is absent. Configure a matching pair in the approved managed server environment; do not expose either key to the browser, static build, client bundle, logs, or checked-in files. The extractor returns `EXTRACTION_UNAVAILABLE` when either required runtime value is unavailable or unusable.

The current fallback is independent per field, **not atomic pair selection**: a partial environment can mix one endpoint with the other family's credential. Configure exactly one complete family and unset the other. Rejecting partial/mixed pairs in code is a recorded pre-commercial follow-up in [the inference register](../architecture/data-lifecycle.md), not a change implemented by this documentation pass.

`.env.example` keeps managed secret placeholders blank and uses the safe `IMPORT_API_ENABLED=false` default. This Node server does not load dotenv files itself, so a local shell, container orchestrator, or approved deployment environment must inject values before starting the service. The non-secret controls are `IMPORT_API_ENABLED` (the route is enabled only when it equals `true`), `STATIC_ROOT`, and `PORT`. The Docker image deliberately sets `IMPORT_API_ENABLED=false`; production must supply an approved access policy before enabling a paid import endpoint.

A normal local server sequence is:

```sh
pnpm build
IMPORT_API_ENABLED=true pnpm exec tsx server/index.ts
```

`GET /api/health` is a health check. `GET /api/import/capabilities` reports whether import is enabled. `POST /api/recipes/preview` is cross-site guarded and is a preview/review endpoint, not a public bulk API.

### Batch extraction is intentionally out of scope

The historical preparation workspace used a managed model to classify/extract descriptions, but its absolute-path client and raw source bundle are not part of this repository’s portable toolchain. Do not repurpose the interactive server endpoint for bulk collection. Before any future batch project, use a portable provider adapter with documented credentials, limits, retention policy, cost controls, and retry accounting; then have a person review source evidence and rights. No such batch script is added here.

## Portable metadata collector

`tools/recipe-import/collect_youtube_metadata.py` is a metadata-only CLI for a **user-supplied saved channel catalog**. It is not a channel crawler, ranking pipeline, or media downloader. It depends on a locally installed `yt-dlp`, Python’s standard library, public anonymous access, and the platform’s availability/terms.

The catalog must describe a known finite set of video IDs. A minimal shape is:

```json
{
  "schema_version": 1,
  "channel_id": "channel-id-if-known",
  "channel_url": "https://www.youtube.com/@example",
  "entries": [
    {"id": "dQw4w9WgXcQ", "catalog_view_count": 0}
  ]
}
```

`catalog_view_count` is optional context only and is never used to replace collected metadata. The command requires an explicit maximum, output directory, and failure manifest:

```sh
python3 tools/recipe-import/collect_youtube_metadata.py \
  --catalog path/to/channel-catalog.json \
  --output-dir path/to/metadata \
  --manifest path/to/collection-manifest.json \
  --maximum-videos 50
```

For each attempted ID, the tool writes selected metadata and records `ok`, `failed`, `blocked`, or `reused` in the manifest. It makes one no-retry request at a time, has explicit timeout/output caps, and stops immediately on a detected login/CAPTCHA/bot block. It never passes cookies, authentication, proxy, login, config, media download, subtitle-download, or anti-bot-evasion options to `yt-dlp`. A nonzero exit status leaves the manifest as the authoritative failure record. Use `--reuse-existing` only to reuse matching successful metadata files from a previous run.

The collector captures a new snapshot if it succeeds. It cannot, by itself, establish the historical 242-video coverage, written-recipe qualification, or top-100 selection. Those steps require a complete, dated catalog, a separately documented eligibility review, and an explicit result statement.

## Portable 119-bank export

`tools/recipe-import/export_bank.py` reads a bank JSON file and uses only the Python standard library to emit a self-contained JSON export, three readable CSV tables, SQLite, a README, and a deterministic summary. It makes no network request and does not need model credentials.

Validate the checked-in seed without writing output:

```sh
python3 tools/recipe-import/export_bank.py \
  --input apps/web/public/data/recipe-bank.json \
  --expected-count 119 \
  --validate
```

Create an export outside the repository working tree:

```sh
python3 tools/recipe-import/export_bank.py \
  --input apps/web/public/data/recipe-bank.json \
  --output-dir /tmp/mealbook-bank-export \
  --expected-count 119
```

The export preserves ingredient `quantity` as `null` where unknown, source wording, reported and normalized macros separately, `nutritionBasis`, evidence, quality gaps, user-rating placeholders, source URLs/credits, historical view snapshot fields, and original-record null provenance. CSV blanks represent JSON/SQLite nulls; use the JSON or SQLite output whenever that distinction is material.
