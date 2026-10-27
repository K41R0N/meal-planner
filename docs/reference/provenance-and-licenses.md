# Provenance and licenses

## Principle: attribution is not permission

Meal Planner keeps source attribution so people can inspect where a recipe record came from. Attribution, a public URL, a creator handle, a thumbnail URL, or a historical collection note is **not** a copyright license, commercial-use permission, endorsement, nutritional validation, or a right to redistribute material. When commercial use, public deployment, asset replacement, or content syndication is considered, obtain and record the relevant permission separately.

This inventory describes the repository’s known categories and their handling. It is an engineering reference, not legal advice or a substitute for counsel/licensor terms.

## Asset and content inventory

| Category | Repository location / evidence | Current treatment | Rights and publishing posture |
| --- | --- | --- | --- |
| Application recipe seed | `apps/web/public/data/recipe-bank.json` | 119 app records: 100 historical source records and 19 original collection records | Recipe facts retain links, credits, evidence, gaps, and nulls. The seed is not a blanket right to republish creator descriptions, videos, names, or commercial recipes. |
| Creator/video thumbnails | Local `/images/<video-id>.jpg` references in the seed; generated during historical seed preparation | Presented as **Source thumbnail** by `RecipeVisual` when shown | A public thumbnail and creator credit do not automatically confer commercial or redistribution rights. Treat rights as unresolved unless a separate documented license/permission exists. Do not convert a creator face/thumbnail into implied dish photography. |
| Illustrative covers | `apps/web/public/images/covers/fajita.webp`, `risotto.webp`, `quiche.webp`; mapping in `apps/web/src/experience/controls.tsx` | Labeled **Illustrative cover** in the UI | These are not creator photography, source evidence, or nutrition evidence. Maintain a creation/procurement record before external redistribution; do not describe them as source assets. |
| Fallback art and icons | CSS fallback art in `controls.tsx`/`mealbook-ui.css`; Lucide React icons in UI code | Original typographic/CSS fallback and dependency-provided icons | Use an honest fallback when no permitted recipe image is available. Preserve required third-party notices/licenses for any packaged dependency. |
| General Sans font files | Local build output path `apps/web/public/fonts/`; build helper `scripts/prepare-fonts.mjs` | Helper obtains unmodified WOFF2 files from Fontshare for a licensee; CSS has system fallbacks | Raw font binaries are excluded from source distribution. Self-host only under the licensee’s applicable Fontshare/ITF FFL rights and embedding terms; do not treat the CSS reference as permission to commit or redistribute fonts. |
| Original UI/card implementation | `apps/web/src/experience/`, `DESIGN.md` | Atlantic/oyster/citrus implementation and paired-card mark | Mealbook’s current components and copy are repository implementation. The abstract inspiration does not transfer private source content. |
| Private research/Pip Decks material | Optional read-only reference `K41R0N/pip-decks-app`; not a runtime/build input | Not vendored, queried, copied, or redistributed | Private/purchased deck content, tactics, copy, images, and artwork remain outside this repo. Never bundle, reproduce, or derive “source data” from it. |
| Development tools/adapters | `tooling/THIRD_PARTY_NOTICE.md`, `.claude/`, `tooling/agent-tools/` | Development-only; excluded from application runtime graph/container | The notice identifies documented upstream MIT sources for the Awwwards/Jury wrappers and Vercel skill sources. Preserve upstream notices and exact license obligations when redistributing those adapters; do not imply that the application as a whole is MIT-licensed. |
| Runtime dependencies and `yt-dlp` | `package.json`, `pnpm-lock.yaml`, `server/requirements.txt` | React/Vite/IDB/Lucide runtime/build dependencies; `yt-dlp` for server metadata/captions | Inventory the exact released versions and their upstream licenses before a distribution. The portable collector invokes an installed tool; it does not embed its code or alter platform rights. |

## Source-bank provenance boundaries

The historical source portion is a dated selection of 100 Louis Howard channel videos with written ingredient-list eligibility, not an editorial claim about recipe authorship or a current popularity chart. The seed stores `sourceUrl`, `sourceName`, `creatorCredit`, `viewCount`, `viewCountAt`, and, where available, ingredient source wording and nutrition evidence. These fields support traceability and user review.

The following statements are intentionally **not** made:

- A creator credit is not a license or permission to reuse the description, thumbnail, recipe, voice, captions, or video.
- A linked YouTube video is not automatically licensable for commercial display, cache, download, derivative recipe publication, or model training.
- A creator’s reported macro value is not independently verified nutrition data.
- A historical exact integer view count is not an authoritative current rank.
- A user-facing source link is not an endorsement by the source creator.
- A thumbnail is not proof that it depicts the cooked food, nor a permission to use it as marketing imagery.

The original 19 records are marked as an original recipe collection and have null external source/view fields. Their presence does not give permission to relabel sourced records as originals. Keep record IDs, source fields, nulls, and data gaps intact when exporting or migrating.

Raw source collection files, full written descriptions, and historic parsed extraction records are intentionally outside the app asset set. They can contain creator text and preparation metadata that require a separate retention and release decision. The existing seed is a technical research fixture, not a cleared public or commercial catalog. Source integration authorization does not establish creator rights; a release owner must choose a permitted fixture/catalog or obtain the required permissions before external product distribution.

## Images and public deployment checklist

Before exposing an image beyond the private/local app context:

1. Identify whether it is a creator thumbnail, user-uploaded image, generated illustration, stock asset, or original work.
2. Record the source URL, creator/rights holder, acquisition date, applicable license or written permission, allowed surfaces, attribution language, and expiry/revocation terms.
3. Verify commercial, promotional, modification, caching, and redistribution rights separately. “Publicly reachable” is not a license class.
4. Use the UI’s source/illustrative labels accurately. Replace an unlicensed thumbnail with the neutral fallback or a separately permitted asset; do not use a misleading stock substitute.
5. Keep credits accessible and do not remove embedded or required third-party notices.

The historical seed’s bundled source thumbnails should therefore be treated as a review item for any public/commercial release. Their existing source credit must be preserved, but credit alone is insufficient. The safer default is to remove unapproved image binaries/references or use the existing typographic fallback while permission is unresolved.

## Font embedding and fallback

`mealbook-ui.css` declares General Sans weights 400, 500, 600, and 700, then provides a platform fallback stack. `scripts/prepare-fonts.mjs` fetches unmodified WOFF2 assets only from Fontshare-controlled hosts, checks a WOFF2 signature and size, and continues with the fallback if unavailable. The build helper’s comments and `DESIGN.md` set the intended policy:

- the licensee, not an arbitrary repository user, must be entitled to self-host;
- raw Fontshare font binaries must not be committed or redistributed in public source bundles;
- font files must remain unmodified unless the governing font terms allow otherwise;
- an offline/system fallback must keep the product usable; and
- the actual Fontshare/ITF FFL terms must be checked for the intended distribution.

The current local font output path is ignored by Git. A release process should verify that no binary was accidentally added and that the destination deployment has an appropriate licensee and notice record.

## Code notices and release practice

The repository does not declare a blanket project license in this reference. Do not infer one from a dependency, a starter project, or an upstream adapter. For a release, produce a versioned software-bill-of-materials/notice review from the lockfile and exact artifact, then preserve upstream license text, attribution, and source-offer obligations where applicable.

`tooling/THIRD_PARTY_NOTICE.md` is intentionally narrow: it records development-only upstream source provenance and MIT declarations for specific skill/adaptor sources. Those tools are not application runtime dependencies. If copying, modifying, or redistributing any of them, use their own pinned upstream license and notice rather than this summary.

Finally, keep security credentials, signing material, account cookies, and private research out of source control and release archives. The portable ingestion tool deliberately requires no cookie or account; adding one would be a separate security, platform-policy, and legal review—not a silent configuration change.
