# Interaction and state contract

Design proposal only. This records user-facing behavior, not database/API implementation. All new batch/portion states below remain unimplemented until the redesign is approved.

## Launch and daily choice

A normal launch opens Today with a stable recipe, chosen from today's selected meal, then a pinned daily choice, then an explainable saved-book suggestion. Android sharing is the intentional exception: a shared link opens import review, not an unrelated recipe. Refresh does not reroll Today. The card remains after cooking or eating; an explicit meal switch or Next meal changes it.

Today keeps recipe identity and changes the primary action with state. Not cooked → Start cooking. Interrupted cook → Resume cooking. Confirmed ready batch → Have a portion. Eaten → Choose next meal, with the current recipe still readable. Have a portion confirms the actual amount; it never records consumption just because food was planned or cooked.

## Import and save

Canonicalize the supported YouTube reference, check whether that source is already saved, and show the saved recipe rather than silently duplicating it. Offer a variant/update deliberately. Different videos with the same dish name remain distinct and show source context.

Retrieval shows progress and can be cancelled without losing the link/text draft. A source failure preserves the draft and offers creator-text paste/manual repair. Review asks for title, usable ingredients, method, and yield when shopping scale needs it; nutrition, tags, categories, ratings and notes are collapsed. Save can succeed with unknown nutrition/time. A missing yield leaves a clear shopping-readiness gap, not a fabricated default.

Saving offers the next job in context: Cook today, Add to my week, or Keep in my book. Selecting one continues with the saved recipe already chosen; no second catalog search. The recipe stays available offline. A multi-recipe source must not blend separate methods; in the initial importer the user can supply the selected excerpt.

## Building a week

Start with cooking windows and desired meal/portion coverage; reveal advanced roles, nutrition constraints and date placement only when requested. A proposed week consists of a small set of batch cards. Each shows the recipe, intended yield, assigned portions, confirmed timing or timing gap, and shared-ingredient evidence. The schedule is a secondary view.

Selection honors user preferences/favorites and source data. Explain every recommendation: fits a confirmed window, uses an ingredient already selected, repeats a favorite, or needs timing confirmation. Do not imply diet quality, price savings or safe storage from a tag. Unknown timing cannot qualify as zero minutes under a strict time budget. A window fit needs confirmed elapsed time for the exact amount planned, either entered by the person or kept from a finished cook of that amount; time is never scaled to a different amount, and hands-on time is not inferred from elapsed time.

A swap has two visible scopes: this meal only or this uncooked batch. Show the shopping and portion change before confirmation. Keep locked choices. Reroll only uncooked/unlocked choices. If a feasible pool is too small, explain which constraint reduces it and offer a specific relaxation; do not ignore the constraint silently.

## Grocery review and shop

Before shopping, show remaining requirements, already-have amounts/confirmation, shared uses, and unresolved quantity lines. Group the actual list by aisle. A line can disclose its contributing recipes/batches without forcing the details on every row.

Known compatible quantities combine; variants and incompatible units remain separate. Cup-to-gram guesses do not occur. Already-have means the required amount is covered, not simply that the ingredient exists somewhere. Optional pantry quantities improve coverage, but no inventory setup is mandatory.

A later serving/recipe change recalculates requirements and highlights the delta. An increase invalidates a stale covered/bought amount as necessary; a decrease does not create a second purchase. Manual additions remain. Marking a meal eaten does not silently remove shopping lines or alter purchased history.

## Cook and portion production

Cooking starts in the chosen recipe's context, with scaled ingredients, a current step and readable progress. Current position, relevant ingredient checks and source-specified timer state survive navigation/interruption. A recipe with unknown yield asks the user to confirm the original yield before arithmetic scaling, or allows reading without pretending the amounts have scaled.

Ingredient amounts and method prose must remain consistent: ingredient scaling does not silently rewrite cooking times, temperatures, equipment capacity or hard-coded step amounts. Highlight original-quantity mentions for review until they can be bound safely to structured ingredients. Do not double oven time merely because portions doubled.

Finishing cooking confirms actual yield. It creates ready portions, not food-log entries. A repeated completion tap is idempotent. Storage is chosen/confirmed by the user; no blanket seven-day refrigeration rule. Existing ready food cannot become a different recipe because a future plan was swapped.

## Eat, log and repeat

Have a portion opens a compact confirmation with the actual portion amount, defaulted from the planned use but editable. Confirmation records a nutrition snapshot and decreases available portions. Unknown nutrient fields remain unknown; aggregate totals display incomplete coverage. Duplicate confirmation is prevented and Undo reverses both the log and portion change.

A separate food-log entry remains available for meals outside the plan, without pretending a cooked batch exists. Manual/restaurant food does not deduct an unrelated batch. Changing recipe ingredients after cooking does not retroactively change the existing batch or historical nutrition snapshots.

Composition changes require nutrition review; original source macros must not silently become validated values for a modified ingredient mix. Pure serving scale uses a confirmed serving basis. A dated note such as “needs more sauce” or “took longer” can inform the next reuse without forcing a rating form.

## Missed prep, skips and shortages

Missed prep offers ready portions, a verified quick alternative, moving the cook window, or changing one meal. Skip/move changes the plan intention; it does not mark food eaten or destroy ready portions. If actual yield is lower than planned, show uncovered uses and offer reducing/replacing those uses. If it is higher, keep extra portions visible for later allocation.

Changing planned portions after a batch is cooked does not rewrite actual yield. A cross-week carryover remains available food and is offered before buying/cooking more of the same meal. Explain shortages or overlap plainly; no streak reset, failure badge or guilt language.

## Shared interaction grammar

Same recipe card, same action labels and same order on web and Android. Phone uses a focused full-screen recipe/cooking continuation and thumb-reachable primary action; web uses a wider workspace and supporting rail. Both support labeled standard controls. Tactile selection/peek/progress may enhance the card, but a drag, flip, swipe or long press is never the only way to complete a job.

Back returns to the initiating context. Cancel keeps safe drafts. Destructive actions get context and confirmation; routine reversible choices use undo. Editing and diagnostics never dominate the default cooking or shopping surface. All proposed state remains private on-device in this personal-first version.

## No-plan and missing-ingredient shopping

Today must not become unusable before a weekly plan exists. From a saved recipe or its ingredient check, “Shop this meal” creates a one-off shopping intention with user-confirmed portions and known scaling, rather than requiring seven days of calendar setup. Shop's empty state offers “Shop a recipe” and “Plan my week,” not a terminal “No plan, no list.” Manual items remain possible. A later weekly plan can merge the intention only with visible contributor/quantity changes; it must not buy the same one-off batch again silently. Starting cooking is reading/preparation, not a claim that the user owns every ingredient.

## Purchase identity versus recipe preparation

A useful reuse layer can propose that whole chicken breast and diced chicken breast refer to the same purchasable food, while retaining each recipe's original prep requirement. Such matching needs explicit user approval and compatible amounts; it must not silently equate different meats, dairy fat percentages, allergens, sizes, cooked/raw weights or cup/gram measures. Buying whole rather than pre-diced may add preparation work and must be visible to time planning. A composition substitution marks nutrition for review; a purchase/prep association alone is not permission to replace the recipe's ingredients or original source data.

## Reheat is not consumption

Ready-food availability distinguishes refrigerated, frozen and other user-confirmed storage states. “Have a portion” opens the relevant saved reheat/defrost context before an explicit “I ate this” confirmation. Merely opening it does not deduct a portion or create a log. Missing instructions stay missing with a source/manual path; the app does not invent a microwave time, safe date or defrost procedure. Frozen does not mean ready to eat instantly. The Today card remains recognizable while the relevant next action is shown.
