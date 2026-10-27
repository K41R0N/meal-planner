# Meal Planner upgrade — 2026-10-26

## Available in the review app

The app now connects YouTube video text to a reviewable personal recipe, then to the saved week and calculated shopping list. **Recipe Book → Import from YouTube** is the entry point. Descriptions are read first, then available captions if needed. If anonymous access is blocked or useful text is absent, paste the written recipe yourself. No media download or hidden recipe save occurs.

Review title, ingredients, amounts/units, yield, cooking steps, meal roles and organization before saving. Confirm source nutrition's serving basis only when it is justified. Missing macros and uncertain quantities stay unknown. The saved detail lets you replace an unlocked recipe batch or choose a compatible meal slot; shopping recalculates using the same portions/yields. Existing video IDs open the saved recipe rather than overwriting it.

A focused **Start cooking** view adds step-by-step progress, ingredient checks and optional screen-awake access. Cooking does not silently log calories or alter grocery check-offs. The existing 119-entry book, editable weekly plans, grocery reconciliation and actual-portion food log remain intact.

Import drafts retain corrections while navigating away and returning within the browser session. A newly shared video cannot silently reuse a previous draft. Comma-separated tags/categories and multi-line steps preserve typing separators. Original source evidence stays visible after saving and survives backups. Both backup and recipe-bank JSON imports support the same 32 MiB limit. Core saved-recipe/planning/shopping/cooking use remains offline after initial app caching; new extraction needs internet.

## Development tools installed

Native project-scoped **Compound Engineering 3.33.0**, **Impeccable 4.8.0**, **Awwwards + Jury** from pinned juliobsz sources, plus **Vercel React Best Practices / Web Design Guidelines** project skills are installed in this cloud workspace. Upstream Awwwards/Jury skill content was preserved unchanged inside validated explicit native plugin packages. All four native registrations are enabled with no loading errors. The actual Impeccable detector reports zero mechanical findings on the active web source; that is not a claim of a design award or comprehensive UX certification.

The available Anthropic API account rejected the native Claude Code model-session check for insufficient credit. No repeated native model calls or successful native model-driven audit are claimed. Manus development and the separate managed app extractor worked; a real Louis Howard description produced a 15-ingredient, 10-step draft. See `development-plugins.md` for pinned revisions and restoration instructions. Hooks, inline skill-shell execution, peers, Live mode, auto-shipping and unrelated connectors remain off. Plugins are not app runtime dependencies.

## Review and limits

The scoped review identified and the implementation corrected: Docker/local Python extractor resolution; invented units and swapped/wrong-unit macro claims; mismatched backup limits; non-English caption fallback; streamed request error handling; restored draft/share mismatches; and proxy Host-origin compatibility. Regression checks cover these corrections, existing bank validation, safe URL parsing, plan replacements, grocery quantity checks and source-evidence backups. A final build is verified separately.

This is still a **personal-first PWA review version**, not a native Android APK, multi-user service or a publicly released replacement. An installed PWA on a published HTTPS origin is required to verify Android OS sharing in daily use. Browser storage can be evicted; keep backups. Newly imported external thumbnails may need a connection even when recipe text works offline.

The optional self-hosted Ollaya/Laya organization service is not deployed. Production online imports intentionally default off until release/access controls are selected. No user GitHub branch push or existing deployment replacement is performed in this phase. The updated source is prepared in the existing meal-planner feature branch; the managed workspace is only its review/build mirror.

## Final verification

The final suite passes **42 tests**, strict TypeScript and the production build. A second real import, **Cheesy Crispy Smashed Potato Bites!**, was confirmed absent from the initial bank and produced **15 ingredients and 9 steps** from its written description. Its per-bite nutrition and bite yield are explicitly flagged for human serving-basis review rather than silently converted into meal-serving totals. The real API kept the full source text; targeted UI checks used a controlled review fixture built from those extracted facts on a separate test origin, never the existing Preview/device profile.
