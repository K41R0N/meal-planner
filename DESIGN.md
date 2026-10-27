# Mealbook design system

Approved by the user on 26 October 2026 at 22:04. The app is a Today-first, batch-first personal recipe book. This is the cross-platform web/PWA design now and the later Android client's visual/interaction foundation. It replaces the previous cream/serif prototype style; the old brief is retained in docs/experience/previous-design.md.

## Identity and hierarchy

The design is an Atlantic/oyster/citrus food-card system. Deep Atlantic (#16425a) carries structure and selected navigation; oyster (#f2f7f7) separates surfaces; white is the reading space; citrus (#f4b743) identifies the single primary action. Text uses readable Atlantic and muted #5b7483, never washed-out gray. Source labels stay quiet but available. General Sans is the workhorse family, with system sans fallback and tabular numeric amounts.

The ownable motif is a recognizable recipe card with a small card-notch/portion-state band. The same identity and action vocabulary carry into Today, the week and cooking; it is not a decorative flip mechanism. The wordmark pairs compact letterforms with an independent paired-card mark, not purchased Pip Decks artwork. Generated concept covers are labeled illustrative; actual YouTube artwork is identified as a video thumbnail; other recipes use an honest typographic/icon fallback.

## Four destinations, one loop

Today, My week, Recipe book and Shop are primary. History/goals, settings/backup, source diagnostics, full macro tables and advanced organization are secondary. Today leads with recipe identity and Start cooking / Resume cooking / Have a portion / Choose next meal. Batch planning leads with actual cooking opportunities and desired portions, then explains a small proposal; calendar placement is a supporting view. Shop uses aisle rows and remaining needs. Cooking focuses on the current step and progress.

## Cross-platform grammar

On phone: focused continuation, a labeled four-item bottom navigation and a thumb-reachable primary action. On web: the same card anatomy, labels and decision facts in a wider workspace with a useful supporting rail. Do not just stretch a phone screen. Reuse the tactile card selection and contextual peek idea from the user’s Storyteller reference, never purchased content. Important jobs have standard labeled buttons; swipe/flip/drag/long-press is optional, never required.

## State and recovery

A plan, a cooking session, available food, bought ingredients and eaten food are different states. The card remains readable after cooking/eating; it does not reroll on refresh. One-off cooking/shopping works before a week exists. Missing time/nutrition remains missing; a source prep/cook sum is not a verified time fit. Already-have means adequate quantity confirmed, not vague cupboard presence. Resume, local swap, move, Undo and preserved drafts are normal paths, not error afterthoughts.

## Interaction quality

One next action per surface; progressive detail instead of simultaneous forms. Standard controls have hover, focus, active, disabled, loading and error behavior. First-focus skip link, accessible names matching titles, visible focus, readable contrast and 44px touch targets. Motion confirms state in 150–220ms; reduced motion gets the same information immediately. No scroll hijack, gratuitous 3D, autoplay video or animated dashboard entrance. Paginate recipe cards and lazy-load non-leading imagery; do not eagerly render 119 choices or a 119-option log select.

## Asset and font terms

Food studies for the three matching recipes are illustrative covers, not actual creator photography or nutritional evidence. Raw Fontshare closed-source fonts are not committed or put in public source bundles. The app build obtains the licensee’s own unmodified font files directly from Fontshare for permitted self-hosted use; an offline/system fallback is available. Official terms: https://www.fontshare.com/licenses/itf-ffl.

Product/interaction contracts and detailed art direction are retained in docs/experience/. These are accepted design decisions, not evidence that every flow has passed implementation verification.
