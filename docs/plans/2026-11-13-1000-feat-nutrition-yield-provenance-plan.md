---
title: Where each nutrition and yield figure came from - Plan
type: feat
date: 2026-11-13
artifact_contract: ce-unified-plan/v1
product_contract_source: issue #22, roadmap stage 1, D006, O004, P004
execution: code, after owner review
---

# Where each nutrition and yield figure came from - Plan

## Goal Capsule

**Objective:** Every calorie, macro and yield figure Mealbook shows says who supplied it: the creator, the person, a calculation, a reviewed process, or nobody on record. An edit that changes what goes into a recipe visibly marks the nutrition as needing review instead of leaving old figures standing.

**Means:** One optional `provenance` block on `Recipe`, read through a single function, written by the existing recipe commands (KTD1–KTD3). No figure changes value in the migration; only labels are added.

**Authority:** [D006](../decisions/README.md) (source evidence beats invented completeness), D005 (history is immutable), roadmap [stage 1](../roadmap/commercial-release.md), `PRODUCT.md`, [the interaction contract](../experience/interaction-contract.md). Open decision O004 and issue #28 decide which labels may count toward a goal fit; this plan only makes the labels available.

**Stop conditions:** Stop and report if a label cannot be added without changing a stored figure, a cooked batch, a log or the version-one backup format; if EV-01 or EV-03 cannot stay green; or if the seed review (U2) finds figures that do not match their quoted source.

**Execution profile:** Nothing is implemented until the owner reviews this plan and answers the three questions under [Owner decisions](#owner-decisions). After that, one issue per unit, in the order under Sequencing.

---

## Product Contract

### Summary

`Recipe` already separates per-serving figures (`nutrition`) from the figures as given (`reportedNutrition`), with a basis and a quoted source passage. What it cannot say is who supplied a figure. Four things the app does today lose that information:

| What happens today | What is lost |
|---|---|
| Starting a cook on a recipe with no yield asks for one and saves it to the recipe (`cook.start`, `sourceYield`) | The person's yield becomes indistinguishable from a creator's |
| Reviewing nutrition after an ingredient edit overwrites `nutritionEvidence` with an app sentence (`recipe.update`, `nutritionConfirmed`) | The creator's quoted passage, and any machine-readable sign that the person entered the figures |
| Changing only the yield re-divides per-serving figures and overwrites `nutritionEvidence` | The creator's quote and the creator's original yield |
| The 19 original-collection recipes carry yields of 1 or 4 with no source | Whether anyone ever stated them |

Checked on the bundled library at `a53b4df` (119 recipes): all 252 known per-serving figures appear verbatim in their recipe's quoted passage; 58 yields come from a creator's description; 19 yields (all `legacy:` entries) have no recorded origin; 40 of the 65 recipes with calories and protein quote "per serving" or "per portion" literally, 21 quote another unit ("per wrap", "per bar", "per slice") and 4 need a human read. These are `measured` by ad-hoc script, not yet an eval result; U6 makes them one.

### Requirements

- R1. Yield, nutrition basis and each of the seven nutrition figures carry one origin from a single vocabulary: `creator-reported`, `user-entered`, `dataset-calculated`, `verified`, `unknown`.
- R2. A missing figure is always `unknown`. A figure that is present but whose origin nobody recorded is also `unknown`, shown as "Source not recorded", and keeps its value.
- R3. Adding labels changes no stored number. Every existing EV-02 count stays the same (see [Predeclared EV-02 changes](#predeclared-ev-02-changes)).
- R4. A creator's figures, yield and quoted passage are never overwritten by an edit. The person's figure is stored beside them with its own label.
- R5. An ingredient change (name, quantity or unit) clears per-serving nutrition as it does today and marks it "needs review" with the reason. The mark stays until the person reviews.
- R6. A yield change keeps the creator's batch total: per-serving figures are re-divided, the creator's original yield is kept, and the figures are shown as the creator's, divided by the person's yield.
- R7. Cooking sessions, cooked batches, shopping intents and logs are never rewritten. Records made after this change carry the labels the recipe had at that moment; older records show no origin.
- R8. Version-one backups restore unchanged and get labels by the rules in KTD4. The backup version stays 1.
- R9. `dataset-calculated` and `verified` are defined but cannot be written or restored until the work that produces them exists.
- R10. Cards and recipe detail show the origin in words, never by colour alone, and never describe a creator's figure as checked.

### Acceptance Examples

- AE1 (R1, R3). The bundled recipe "Cheesy chicken fajita pasta bake" shows its calories as "From the creator", with the quoted passage one tap away; its numbers are the same as before.
- AE2 (R2). An original-collection smoothie shows "Makes 1 · source not recorded". Scaling ingredients still works.
- AE3 (R4, existing behavior kept). A recipe with no yield is started with "makes 4": the recipe's yield becomes 4, labelled "Set by you".
- AE4 (R5). Chicken is changed from 500 g to 800 g: per-serving nutrition becomes unknown, the card says "Nutrition needs review", and detail still shows what the creator reported for the original recipe, with the quote intact.
- AE5 (R5). After AE4 the person enters their own calories and protein: those two read "Entered by you", the other figures stay unknown, and the review mark clears.
- AE6 (R6). A creator's 400 kcal per serving for 4 servings, changed to 5 servings: 320 kcal, shown as "From the creator, divided by your yield of 5"; changing back to 4 returns 400 and the plain creator label.
- AE7 (R7). A batch cooked before AE4 keeps its nutrition per portion and its recipe snapshot; a log made from it is unchanged.
- AE8 (R8). A backup made before this change restores with every figure identical; bundled recipes the person never changed get the bundled labels; a yield the person added to a bundled recipe is "Set by you".
- AE9 (R9). A backup edited by hand to say `verified` is rejected with a message naming the field.

### Scope Boundaries

In scope: the type, the read path, validation, the edit rules, labels for the 119 bundled recipes, labels for existing personal books and restored backups, labels on cards, recipe detail, the edit form and import review, EV-02 counts by origin, and the owning documents.

Out of scope: calculating nutrition from ingredients (its own step in the roadmap, needing unit, edible-portion and yield tests first), and with it ingredient identity, preparation state and dataset version; any goal-fit rule (#28); gap codes (#25, boundary set in KTD6); timing labels (#26, vocabulary shared in KTD1); origin on food-log entries; the portable export format in `tools/recipe-import/`; rights to the bundled recipes (#27).

---

## Planning Contract

### Key Technical Decisions

- **KTD1. One vocabulary, one optional block.**

  ```ts
  export type FigureOrigin =
    | 'creator-reported' | 'user-entered' | 'dataset-calculated' | 'verified' | 'unknown';

  export interface RecipeProvenance {
    yield: FigureOrigin;
    nutritionBasis: FigureOrigin;
    nutrition: Record<MacroKey, FigureOrigin>;
    /** The yield the creator stated, kept when the person sets a different one. */
    creatorYield: number | null;
    /** The source called its nutrition figures approximate ("~", "around", "rough"). */
    approximate: boolean;
    /** Set when an edit invalidated nutrition; cleared only by the person's review. */
    needsReview: 'ingredients-changed' | null;
    recordedAt: string;
  }
  // Recipe gains: provenance?: RecipeProvenance
  ```

  `observed` (a value measured from the person's own finished cook) is the sixth word in the shared vocabulary. It applies to time and portion size, which live on the recipe profile (`timingObservedAt`, and `portionObservedAt` once D017 merges), not to these fields. #26 uses the same words for timing.

- **KTD2. One read path.** `provenanceOf(recipe)` returns the stored block, or labels inferred by KTD4 when there is none. Nothing else reads `recipe.provenance`. `nutritionStanding(recipe, keys)` returns either usable or the list of reasons it is not (`value-unknown`, `basis-unknown`, `yield-unknown`, `origin-not-recorded`, `needs-review`); #28 decides what to do with each reason.

- **KTD3. The existing commands write the labels; no new edit surface.** `recipe.update` and `cook.start` set origins by comparing the incoming recipe with the stored one. `recipe.add` accepts a validated block from the caller, because only the review screen knows which figures the person changed; a recipe added without one is labelled by KTD4. `nutritionEvidence` becomes creator text only: the two app-written sentences are no longer stored there, since `provenance` says the same thing in a form the app can read.

- **KTD4. Labels for records that have none, in this order.**
  1. A figure that is `null` is `unknown`. If every nutrition figure is `null` and the gaps include the app's "Ingredients changed" sentence, `needsReview` is set.
  2. The recipe is in the bundled library and the field equals the bundled value: take the bundled label. A per-serving figure that equals the bundled figure re-divided by the stored yield also keeps the bundled label. Otherwise, or where the bundled value is `null`, it is `user-entered`.
  3. `nutritionEvidence` begins with the app's "explicitly reviewed by you" sentence: known nutrition figures and the basis are `user-entered`.
  4. `nutritionEvidence` begins with the app's "adjusted for your changed yield" sentence: yield is `user-entered`; nutrition figures are `unknown` origin, because the earlier state was overwritten.
  5. The recipe has a source link and a quoted passage, and the figure appears in that passage: `creator-reported`.
  6. Anything else that has a value: `unknown` origin ("Source not recorded").

  Rule 2 needs the bundled library, which only the web client holds, so the client sends it once through a new idempotent command, `recipe.recordProvenance`, after load and after restore. The command writes labels to book recipes only. Without it (offline first load, another surface) rules 1 and 3–6 still apply through KTD2 and nothing is stored.

- **KTD5. Snapshots are copied, never upgraded.** `cloneRecipe` deep-copies `provenance`, so a session, batch or shopping intent made after this change records the labels of that moment. `validateRecipe` accepts a snapshot without the block and leaves it without. KTD4 is never applied to a snapshot: an older batch shows "Source not recorded at the time".

- **KTD6. Unknowns are defined once.** A nutrition or yield gap is whatever `provenanceOf` and the field say; #25's codes (`yield.unknown`, `nutrition.fiber.unknown`, `nutrition.approximate`, `nutrition.needs-review`) are derived from them and never stored separately. The free-text `dataGaps` stay as they are in this plan; the "Ingredients changed; nutrition needs your review." sentence is still appended so an older build restoring a newer backup shows it.

- **KTD7. Reserved levels fail closed.** Validation accepts `creator-reported`, `user-entered` and `unknown`. `dataset-calculated` and `verified` are rejected on restore and import until their own issues add the writer and the evidence each needs (dataset and version; the review record).

### Edit rules

| Edit | Stored figures | Labels |
|---|---|---|
| Ingredient name, quantity or unit changes; nutrition not reviewed | Per-serving nutrition cleared, basis `unspecified` (as today); reported figures, quote and yield kept | All nutrition `unknown`; `needsReview: 'ingredients-changed'` |
| Person reviews nutrition (enters or confirms figures) | Per-serving figures as entered; basis `per_serving` | Each figure entered or confirmed `user-entered`; basis `user-entered`; `needsReview` cleared |
| Person changes one figure, ingredients unchanged | That figure | That figure `user-entered`; others unchanged |
| Person changes only the yield, creator figures per serving | Per-serving = reported × `creatorYield` ÷ new yield; reported figures unchanged | Yield `user-entered`, or `creator-reported` again when it equals `creatorYield`; nutrition labels unchanged; shown as divided by the person's yield while the two differ |
| Person sets a yield where there was none (edit form or starting a cook) | Yield; per-serving figures computed if the basis is whole-recipe | Yield `user-entered`; `creatorYield` stays `null` |
| Person sets the basis where the source did not state one | Per-serving figures per that basis | Basis `user-entered`; figures keep `creator-reported` |
| Steps, name, tags, notes, timing change | None | None |
| Import replaces a recipe with the same ID | Whole record, as today | The incoming record's block |

An ingredient change does not touch the yield label. Yield is how many servings the person divides the result into; the app cannot know whether extra chicken makes a fifth serving.

### What stays unchanged in history (D005)

`CookingSession.recipeSnapshot`, `PreparedBatch.recipeSnapshot`, `PreparedBatch.nutritionPerUnit`, `ShoppingIntent.recipeSnapshot` and `ConsumptionEntry.nutritionSnapshot` are never written by any unit in this plan. Daily totals keep reporting incomplete coverage from known values exactly as now.

### Labels in the interface

| Origin | Card (quiet line under calories and protein) | Detail, per figure |
|---|---|---|
| `creator-reported` | "From the creator" | "From the creator · not checked by Mealbook", with the quote |
| `creator-reported`, approximate | "From the creator · approximate" | Same, plus "The creator calls these approximate" |
| `creator-reported`, yield set by the person | "From the creator, your yield" | "From the creator, divided by your yield of N" |
| `user-entered` | "Entered by you" | "Entered by you" and the date |
| Mixed across the two card figures | "Mixed sources" | Each figure labelled |
| `unknown`, value present | "Source not recorded" | "Source not recorded" |
| `unknown`, no value | Nothing shown (as today) | "Not stated" |
| Needs review | Caution line: "Nutrition needs review" | Reason, the creator's original figures, and the review action |

Yield line: "Makes 4 · from the creator", "Makes 4 · set by you", "Makes 1 · source not recorded", or today's missing-yield prompt. The current "published source serving" caption under each figure is replaced by these labels. Card additions use existing supporting-text and caution styles in [the card system](../reference/card-system.md); no new colour.

### Predeclared EV-02 changes

Baseline: [2026-10-28 at `39b1916`](../evals/results/2026-10-28-ev-02-library-coverage-r2.json). Declared before any implementation run.

**Must not change (R3):** recipes 119; yield known 77; calories and protein 65; four macros 55; four macros and yield 42; any reported nutrition 89; basis counts 68 / 17 / 27 / 7; recipes with gaps 119; ingredient-line counts. A difference in any of these is a defect in the migration.

**New counts and expected values:**

| Count | Expected | Basis for the expectation |
|---|---|---|
| Yield `creator-reported` | 58 | All `youtube:` entries with a yield |
| Yield `unknown` origin, value present | 19 (or 0, with 19 `user-entered`, under owner decision 1) | All `legacy:` entries |
| Yield `unknown`, no value | 42 | Unchanged from baseline |
| Calories and protein both `creator-reported` | 65 | Every figure found in its quote |
| Any nutrition figure `user-entered`, `dataset-calculated` or `verified` | 0 | Nothing in the bundled library was entered by a user or calculated |
| Per-serving basis `creator-reported` | 61 to 65 of the 65 | 40 literal "per serving/portion"; 21 name a countable unit; 4 decided in U2 review |
| Nutrition marked approximate | 28, give or take 3 | Pattern match on quotes and gap sentences; fixed by U2 review |
| Four macros and yield, every input with a recorded origin | 38 to 42 | 42 minus any recipe whose basis U2 marks `unknown` |
| Needs review | 0 | No bundled recipe has been edited |

A result outside a stated range is reported as such with the recipes that caused it; the range is not adjusted afterwards (evals rule 1).

**Targets.** EV-02 stays descriptive for values. One threshold is set: after U2, 100% of present figures in the bundled library have a stored label, and 0 are `creator-reported` without a quote that contains the figure. Coverage targets for values themselves (how many recipes must have four macros and a yield) belong to #28 and the stage gate, because raising them means changing which recipes ship, not how they are labelled.

### Owner decisions

1. **The 19 original-collection yields.** Recommended: "Source not recorded". They are 1 or 4 for every entry and no source states them. The alternative, "Entered by you", is true only on the owner's own device and false for anyone else who receives the bundled library.
2. **A unit other than "serving".** Recommended: when the creator quotes figures "per wrap", "per bar" or "per slice" and the yield counts the same thing, the basis is `creator-reported`. The alternative, requiring the literal word, would mark 21 recipes' basis as not recorded.
3. **Wording.** "From the creator · not checked by Mealbook" on detail. D006 says source-reported values are not verified facts; this states it where the figure is read.

If approved, the decision registry gains one entry (D018; D017 is taken by the unmerged portion-learning work): provenance levels for nutrition and yield, the edit rules above, and the three answers.

### Assumptions and Dependencies

No new dependencies. The current validator rebuilds a recipe from known fields and drops the rest (checked at `a53b4df`), so an older build that restores a newer backup keeps every figure and loses only the labels, which KTD4 re-infers. #23 (unknown nutrition never becomes zero) should merge first or alongside U1; it guards R2 and R3. The two unmerged Stage 2 commits (`ccfccd9`, `13296e4`) touch the recipe profile, not `Recipe`, and do not conflict.

### Sequencing

U1 → U2 → U3 → U4 → U5, with U6 after U2. U1–U3 change no screen. Each unit is one issue and one pull request.

---

## Implementation Units

### U1. Vocabulary, read path and validation

**Goal:** The type, `provenanceOf`, `nutritionStanding`, inference rules 1 and 3–6, validation and snapshot copying. **Requirements:** R1, R2, R7, R9. **Dependencies:** none.

**Files:** `packages/meal-domain/src/types.ts`, `packages/meal-domain/src/provenance.ts` (new), `packages/meal-domain/src/validation.ts`, `packages/meal-domain/src/experience.ts` (`cloneRecipe`), `packages/meal-domain/src/index.ts`, `tests/provenance.test.ts`.

**Test scenarios:** a `null` figure with a non-`unknown` label is rejected; a reserved level is rejected naming the field (AE9); a recipe without the block validates and stays without it; each inference rule on a fixture; a snapshot round-trips with and without the block; a session started from a labelled recipe carries a copy that later recipe edits do not change.

**Verification:** `pnpm typecheck`, `pnpm test`.

### U2. Labels for the 119 bundled recipes

**Goal:** Every bundled recipe carries a stored, human-reviewed block. **Requirements:** R1–R3. **Dependencies:** U1, owner decisions 1 and 2.

**Files:** `apps/web/public/data/recipe-bank.json`, `scripts/evals/annotate-provenance.mjs` (new, proposes labels and prints every recipe it could not decide), `docs/reference/repository-map.md`.

**Approach:** The script proposes; a person reads the 25 non-literal basis quotes and the approximate flags and records each decision in the pull request. `creatorYield` equals the bundled yield for `youtube:` entries. No value, quote or gap sentence changes; the diff is additions only.

**Test scenarios:** every bundled recipe validates; every `creator-reported` figure appears in its quote; the "must not change" counts are identical to the baseline.

**Verification:** `pnpm test`, `pnpm eval:coverage`, `pnpm build`.

### U3. Edit rules in the commands

**Goal:** The table under Edit rules, in `recipe.update` and `cook.start`; `recipe.add` validates a supplied block. **Requirements:** R4–R6. **Dependencies:** U1.

**Files:** `packages/meal-domain/src/application-commands.ts`, `packages/meal-domain/src/provenance.ts`, `tests/application-command-parity.test.ts`, `tests/provenance-edits.test.ts` (new).

**Approach:** One function, `provenanceAfterEdit(previous, next, { nutritionConfirmed })`, called by `recipe.update`; `cook.start` uses it for the yield it saves. `recipe.update` keeps returning `nutritionReset`. The yield-only path derives from `creatorYield` instead of the previous per-serving figures, so repeated yield changes cannot drift (AE6).

**Test scenarios:** AE3–AE6; one row of the edit table per test; the creator's quote survives every edit; a steps-only edit changes no label; existing parity tests pass with the two evidence-sentence assertions moved to labels.

**Verification:** `pnpm test`.

### U4. Existing books and restored backups

**Goal:** `recipe.recordProvenance` and its two call sites. **Requirements:** R3, R8. **Dependencies:** U2, U3.

**Files:** `packages/meal-domain/src/application-contracts.ts`, `packages/meal-domain/src/application-commands.ts`, `apps/web/src/useMealbook.ts`, `apps/web/src/storage.ts`, `tests/provenance-migration.test.ts` (new), `tests/e2e/core-loop.spec.ts`.

**Approach:** The command takes the bundled library as a reference, labels only book recipes that have no block, and reports how many it labelled. It is skipped when every recipe already has one. It never touches `experience`.

**Test scenarios:** AE8; a version-one fixture restores with identical figures, plans, batches and logs (deep equality on everything except the new block); running the command twice changes nothing the second time; a bundled recipe whose ingredients the person changed is not given bundled nutrition labels.

**Verification:** `pnpm test`, `pnpm build`, `pnpm test:e2e` (EV-03 backup test extended to check a label survives export and restore).

### U5. Labels on cards, detail, the edit form and import review

**Goal:** The interface table above. **Requirements:** R5, R10. **Dependencies:** U3, U4, owner decision 3.

**Files:** `apps/web/src/experience/controls.tsx` (card and `macroFacts`), `apps/web/src/experience/MealbookUI.tsx` (detail, Today card yield line), `apps/web/src/experience/RecipeWorkspace.tsx` (edit form), `apps/web/src/components/RecipeImport.tsx` (review marks which figures the person changed), `apps/web/src/experience/mealbook-ui.css`, `tests/e2e/core-loop.spec.ts`.

**Approach:** Presentational only; every string comes from one `originLabel` helper so wording is changed in one place. The edit form shows the creator's figures read-only beside the person's fields. The unused `apps/web/src/components/RecipeDetails.tsx` is not extended.

**Test scenarios:** AE1, AE2, AE4 in EV-03 at phone and desktop sizes; labels are text nodes, not titles or colours; EV-07 run on the changed screens.

**Verification:** `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`.

### U6. EV-02 by origin, and the owning documents

**Goal:** The predeclared counts become a recorded result; documents describe the delivered behavior. **Requirements:** R3. **Dependencies:** U2 (script), U5 (documents).

**Files:** `scripts/evals/library-coverage.mjs`, `docs/evals/results/<date>-ev-02-library-coverage.json` (new file, never an edit), `docs/evals/README.md`, `PRODUCT.md`, `docs/experience/interaction-contract.md`, `docs/reference/card-system.md`, `docs/reference/source-ingestion.md`, `docs/architecture/data-and-sync.md` (`OwnedRecipe` nutrition provenance), `docs/reference/agents/tool-contract.md` (provenance field names), `docs/decisions/README.md` (D018).

**Verification:** `pnpm docs:check`; the result file compared line by line against the table above, with every out-of-range count explained.

---

## Verification Contract

`pnpm docs:check`, `pnpm typecheck`, `pnpm test` (EV-01), `pnpm build`, `pnpm test:e2e` (EV-03) for every unit that touches code; `pnpm eval:coverage` for U2 and U6. CI runs the same steps on push.

## Definition of Done

- AE1–AE9 pass as tests; EV-01 and EV-03 green; EV-02 result recorded and compared with the predeclared table.
- A version-one backup restores with identical figures and history.
- No command writes an app sentence into `nutritionEvidence`.
- `PRODUCT.md`, the interaction contract, the card system and D018 describe the behavior.
- #25, #26 and #28 are updated to point at `provenanceOf` and `nutritionStanding`; #28 is unblocked.
