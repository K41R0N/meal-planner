---
title: Learn portion size from a finished cook - Plan
type: feat
date: 2026-11-12
artifact_contract: ce-unified-plan/v1
product_contract_source: issue #46, D016 (track one), D015 (the timing pattern)
execution: code
---

# Learn portion size from a finished cook - Plan

## Goal Capsule

**Objective:** After cooking, a person can say that one of the units they made (a box, a bowl) is one meal, and from then on the planner counts useful portions in that unit instead of in unconfirmed recipe servings.

**Means:** An explicit, unticked-by-default choice in the finish dialog writes the recipe profile's existing portion fields with a "measured" date, the same way D015 learns time (KTD1–KTD2).

**Authority:** D016 (a week that learns from what actually happened), D005 (history and cooked snapshots are immutable), `PRODUCT.md` (snack pieces stay distinct from meals; unknown stays unknown), [the interaction contract](../experience/interaction-contract.md).

**Stop conditions:** Stop if learning a portion would change an existing week, a cooked batch or a log, or would need a new backup version.

**Execution profile:** One commit on `claude/meal-planner-roadmap-8lha17`, pushed with `[skip netlify]`.

---

## Product Contract

### Summary

The profile already holds `yieldUnit`, `sourceUnitsPerPortion` (recipe servings per meal) and `portionSizeConfirmed`, and every planner path already reads them, but nothing ever writes them from a real cook: every plan says "Portion size is not confirmed". The finish dialog gains "One {unit} is one meal". Ticking it stores the unit, `preparedSourceServings / actualYield` recipe servings per meal, the confirmation, and when it was measured.

### Requirements

- R1. The choice is explicit and unticked by default; nothing is confirmed without it. Pieces, slices and cups are never confirmed by the app on its own.
- R2. When ticked, the profile stores `yieldUnit`, `sourceUnitsPerPortion = preparedSourceServings / actualYield`, `portionSizeConfirmed = true` and `portionObservedAt`. A time learned in the same cook is kept as before.
- R3. Later proposals, grocery quantities and ready-food reuse use the confirmed size through the existing `sourceUnitsFor`. Existing weeks keep the `sourceUnitsPerPortion` saved on their choices; batches and logs are unchanged.
- R4. Editing the portion fields by hand clears `portionObservedAt`; leaving them unchanged keeps it. A write cannot store a timestamp restore would reject.
- R5. Version-one backups and backups without the new field restore unchanged.

### Acceptance Examples

- AE1. A 4-serving cook made into 8 boxes, ticked: one box is one meal, 0.5 recipe servings per meal, confirmed, measured at the finish time.
- AE2. The same cook, unticked: the profile's portion fields are untouched.
- AE3. After AE1, a new proposal for that recipe carries 0.5 recipe servings per portion and no "Portion size is not confirmed" explanation; an earlier week's choice keeps its old value.
- AE4. A hand edit of the unit or the per-meal amount clears the measured date.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Reuse the existing portion fields; add only provenance.** `portionObservedAt?: string | null` mirrors `timingObservedAt`: absent or null means entered by hand. No new planner logic is needed, because `sourceUnitsFor` and `portionSizeConfirmed` already drive planning and the eat dialog.
- KTD2. **One profile write per cook.** `finishCook` builds one updated profile from the time and the portion choices, so neither overwrites the other.
- KTD3. **The dialog states the arithmetic.** "One box = 0.5 recipe servings" is shown before the person ticks, so the size is never a hidden guess.

### Implementation Units

**U1. Domain.** `experience-types.ts` (profile field, action and API inputs), `experience-api.ts`, `experience.ts` (`finishCook`, `updateProfile` provenance), `experience-validation.ts` (optional timestamp), `application-contracts.ts` (`cook.finish` gains `rememberPortion`), `application-commands.ts`. Tests in `tests/portion-learning.test.ts` for AE1–AE4 and R5.

**U2. Web.** `MealbookUI.tsx` finish dialog checkbox with the per-meal arithmetic (and the time line names the prepared amount); `useMealbook.ts` passes the choice; recipe profile form notes when the size was measured. EV-03 ticks the choice and checks that it survives backup and restore.

## Verification Contract

`pnpm docs:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.

## Definition of Done

AE1–AE4 pass as tests; EV-03 green; `PRODUCT.md`, the interaction contract and D017 describe the behavior; #46 checklist updated.
