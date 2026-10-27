# Portable recipe-import tools

These tools are intentionally separate from the application runtime. They use Python’s standard library except that the metadata collector invokes a locally installed `yt-dlp` executable. Neither tool needs a managed-model API key, cookies, account login, browser profile, or project-specific absolute path.

## `collect_youtube_metadata.py`

Collect a bounded list of public video metadata from a saved catalog. It is **metadata-only**: the command always uses `--skip-download`, never requests media formats/subtitles, ignores `yt-dlp` config files, sends no authentication/cookie/proxy options, performs no anti-bot workaround, and stops on a detected access block.

The input is a catalog you already have permission to process; the tool does not enumerate a channel or discover more videos. Required catalog fields:

```json
{
  "schema_version": 1,
  "channel_id": "optional-but-recommended-stable-channel-id",
  "channel_url": "https://www.youtube.com/@example",
  "entries": [
    {
      "id": "dQw4w9WgXcQ",
      "catalog_view_count": 0
    }
  ]
}
```

Only the 11-character video `id` is required inside each entry. `catalog_view_count` is retained as context in the catalog only; the collector never treats it as collected metadata or a rank.

```sh
python3 tools/recipe-import/collect_youtube_metadata.py \
  --catalog path/to/channel-catalog.json \
  --output-dir path/to/metadata \
  --manifest path/to/collection-manifest.json \
  --maximum-videos 50
```

`--maximum-videos` is mandatory and must be no greater than the catalog size. Optional controls are `--timeout-seconds`, `--metadata-output-limit-bytes`, `--yt-dlp`, and `--reuse-existing`. Every attempt is represented in the manifest. On an anonymous login/CAPTCHA/bot block, the tool writes a `blocked` result, stops before the next video, and exits nonzero. It will not retry with credentials or modified evasion settings.

The output records description and returned public metadata for the supplied IDs. It does not determine written-recipe eligibility, create a current ranking, establish channel completeness, grant rights to reuse source material, or download a thumbnail/media file.

## `export_bank.py`

Validate and export an existing Mealbook bank with no network access:

```sh
python3 tools/recipe-import/export_bank.py \
  --input apps/web/public/data/recipe-bank.json \
  --expected-count 119 \
  --validate

python3 tools/recipe-import/export_bank.py \
  --input apps/web/public/data/recipe-bank.json \
  --output-dir /tmp/mealbook-bank-export \
  --expected-count 119
```

The validation command is read-only. An export creates the following deterministic files in the requested output directory:

- `recipe-bank-export.json` — app-compatible records and export metadata.
- `recipes.csv`, `recipe-ingredients.csv`, `recipe-steps.csv` — readable relational tables.
- `recipes.sqlite` — relational SQLite export with recipe, provenance, quality, ingredient, step, and label tables.
- `export-summary.json` and `README.md` — count, null/provenance/nutrition-basis checks and use notes.

`--output-dir` must not already exist unless `--overwrite` is supplied. The exporter preserves JSON/SQLite nulls; CSV uses a blank cell for null. In particular, it does not fabricate source quantities, nutrition, nutrition bases, meal-prep ratings, provenance, or image rights.
