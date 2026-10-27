# Meal Planner: experience product contract

Status: **proposal for approval**, not implemented. This supersedes the old week-first opening and refinement-only visual brief if approved. The source repository, saved recipes, compatible-unit shopping arithmetic, source evidence and actual-log separation remain foundations. “Mealbook” is a working name for the visual proposals only; no repository rename is required.

## Product promise

Open the app and know what to do with today's recipe. Choose a small set of meals that fit the time you actually have, buy ingredients that work across those meals, and turn cooking into usable portions rather than a calendar full of intentions.

The primary user is the owner, using Android in a shop or kitchen and web for comfortable planning. Future users should inherit the same intelligible loops, not an organization switcher. Accounts, shared households and cloud synchronization are not part of this design approval.

## Jobs and constraints

The two hardest jobs, confirmed by the user, are finding time to cook and making a grocery list that maximizes the meals that can be made. The opening must be today's recipe, whether it has been cooked or not. Recipe cards are a cross-platform interaction, not an Android-only treatment. The product should anticipate needs through visible state and useful defaults, not through unexplained AI judgments or prescribed diet rules.

## Core loops

**Collect → use.** Share or paste a YouTube link; see whether it is already saved; retrieve available creator text; review the recipe; save it; choose “Cook today,” “Add to my week,” or “Keep in my book.” A saved recipe never requires a plan to be usable.

**Plan → shop → prepare.** Choose cooking opportunities and how many meals to cover; get a draft of recipe batches and portions; see ingredient reuse and timing gaps; keep favorites, replace one candidate, or reroll unlocked candidates; confirm portions; review what to buy; shop by aisle; cook the batches; confirm the actual yield and available portions.

**Today → action → repeat.** Open the same stable daily recipe card; start or resume cooking when uncooked, have a portion when ready, and explicitly confirm the amount eaten. Keep the recipe, replace it next time, or deliberately move to the next meal. Completing cooking does not count food as eaten.

**Interrupted week → recovery.** Missed prep, a shortened cooking window, a skipped meal or an unavailable ingredient changes only the affected work. Offer ready portions, a verified quick alternative, a single-meal swap or moving a cook window before offering to rebuild the week.

## Information architecture

Four primary destinations on phone and web: **Today, My week, Recipe book, Shop**. Cooking is a focused continuation of a recipe, not another destination. Nutrition is a Today detail/secondary history destination with direct log actions; importing belongs to the book and to Android sharing; settings, targets, backups and source management are secondary. No equal-weight navigation item for every technical capability.

Desktop adapts structurally: persistent navigation, an open recipe workspace and a supporting week/portion rail. Phone uses a thumb-reachable action, labeled bottom navigation and full-screen recipe/cooking views. The same recipe object and action labels connect both.

## Today's recipe contract

The first content is the actual recipe card and its next action, not totals, a calendar, onboarding statistics or a warning wall. Title, image when available, meal context, prepared/uncooked state and the primary action precede secondary macros and week summaries.

Choose from today's selected meal when a week exists. Otherwise use the user's pinned daily choice, then a saved-book suggestion within their chosen filters. Explain the reason in one sentence. A daily choice persists; refresh does not randomize it. If multiple meal slots exist, expose a small meal switcher. Consumption does not make the recipe disappear: the user can select the next meal deliberately. A new user with the starter bank can act immediately; a genuinely empty book offers one clear action to add a recipe.

The primary action follows real state: **Start cooking / Resume cooking** when uncooked; **Have a portion** when a confirmed batch is ready; **Choose next meal** after consumption while keeping the current recipe readable. “Have a portion” confirms actual quantity before saving a log. Planned meals never create actual logs.

## Time-aware weekly planning

Start with “When can you cook?” and the number of portions/meals to cover, with useful editable defaults. The draft is a few batch cards, not 21 empty calendar cells. Dates and meal slots remain available in an expandable schedule, and the user can preserve their original weekly replacement flow.

Separate hands-on time, elapsed cooking time and a session estimate. Source timing, user timing and unknown timing must remain distinguishable. A cook-time limit cannot interpret unknown as zero. Show “Time not confirmed” candidates separately and let the user include them explicitly. The current bank has limited explicit timing; this is a real data gap, not something animation fixes.

Show why a candidate fits: already selected ingredients, user favorites, confirmed available time or a user-set prep preference. “Use what I have” relies on user-confirmed ingredient amounts when claiming full meal coverage; a presence checkbox alone supports an overlap suggestion, not a guaranteed cookable-meal count.

Ingredient reuse means fewer unique purchase requirements across a feasible set of portions, not repeating the same dish every day. Preserve taste/variety choice and allow one nicer recipe. Do not claim price savings without prices or leftover-package optimization without package sizes.

Changing a candidate previews the effects on cooking work, portions and groceries. Cooked food is not silently rewritten by a plan change; reroll only uncooked/unlocked candidates. A plan may suggest two cooking opportunities without asserting seven days of refrigerator safety. Storage suitability remains user-confirmed or explicitly sourced.

## Recipe-book and review contract

Recipe cards present the food first: useful name, image, favorite, role, confirmed time or timing gap, and the most relevant calories/protein values when usable. Other macros, source evidence, taxonomy and editing are progressively disclosed. Unknown values are not zero. Search and user-controlled filters combine; no hidden “healthy” eligibility judgment.

Use collections such as favorites, recent saves and this week's selected recipes as shortcuts. Tap opens the same focused detail from Today, book, week and imports. Selection and overflow actions are visible; gestures may accelerate but never be required. The useful Pip Decks transfers are a recognizable card, a focused viewer, a sequence with position/progress, and interruption-resume behavior. Essential recipe data must not be hidden behind a flip.

Review separates three readiness questions: **Can I cook it?** ingredients/method; **Can I shop accurately?** yield and known amounts; **Can I count it?** confirmed nutrition basis. Missing macros do not block saving or cooking. Missing yield does not block the book, but prevents reliable grocery scaling until confirmed. Show the raw source beside the field that needs attention rather than forcing a complete database editor on every import.

For the first implementation, import one primary recipe per draft; a multi-recipe video must not be silently blended into one invented method. Detect ambiguity and let the user supply the chosen recipe excerpt. A future multi-recipe chooser is an explicit extension, not a capability claimed now.

## Shopping contract

The list is the shopping task, grouped by aisle, with large checks, quantities, concise variants and a remaining-items view. A compact header says which portions/batches it covers and what changed. Review needed amounts sit in a clear pre-shop section; ordinary source evidence is expandable.

Aggregate only equivalent ingredient variants and compatible units. Never convert cups to grams without a supported ingredient-specific conversion. “Already have” asks whether the required amount is covered, without forcing a full pantry inventory. Reuse cards explain the meals an ingredient serves. A changed plan updates requirements; increased amounts must not remain falsely “covered” by old checks.

Optional later pantry quantities can enable stronger “how many meals can I make?” answers. They are not a forced setup step. Without quantities, say “uses ingredients you've marked as available,” not “you can make six meals.”

## Preparation, portions and logging

A cooking session resumes its current step after interruption. Large method text, scaled ingredients, visible progress and no editing clutter. A timer may help a source-specified step; no unsourced cooking or reheating instructions. Screen-awake behavior is optional and platform-dependent, not a requirement to access the recipe.

Finishing a batch confirms actual yield; it creates ready portions, not calorie entries. Storage is labeled by the user. Eating confirms the actual amount, updates remaining portions and saves a nutrition snapshot with coverage. Cooking completion and consumption confirmation are idempotent, reversible actions. A duplicate tap cannot manufacture portions or double-log a meal.

Changes to planned portions do not retroactively change the cooked yield. A batch swap after cooking changes future plans only and keeps the existing food visible. Logging incomplete nutrition remains allowed and visibly incomplete.

## Experience principles

One strong action per context. Keep the recipe identity visible across handoffs. Use safe defaults with visible reasons. Ask for information when the current decision needs it, not to complete a profile. Persist meaningful progress locally. Make changing one's mind cheap with clear scope and undo. Never guilt the user for an interrupted week.

## Outcome measures for the next build

Measure task success and friction rather than aesthetic praise: first useful action from launch; saved source recipe → chosen batch → correct shopping list; time to a feasible first week; extra unique ingredients introduced by a swap; interrupted cooking recovery; ready-portion accuracy; and explicit actual-log coverage. Set quantitative targets after measuring the existing flow and testing the redesigned one with the owner. No invented user-study results or conversion claims.

## Deliberately deferred

Public release and GitHub push, native APK distribution, hosted Ollaya/Laya, accounts/multi-user/shared pantry, unattended channel crawling, price-based shopping optimization, automatic package-size leftovers, and invented nutrition/storage recommendations. These do not replace the core experience work.

## First-use without a week

A saved recipe can be cooked or shopped one-off. “Shop this meal” asks for portions, shows known requirements and gaps, and does not require a calendar. Empty Shop offers “Shop a recipe” and “Plan my week.” Starting cooking opens a gather-ingredients/recipe continuation; it does not assert the ingredients are already on hand. Source thumbnails belong to source attribution, not automatically to dish photography. Missing dish images get an honest fallback until the user chooses a permitted actual image.
