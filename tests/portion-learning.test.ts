import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRecipes, validateState } from '../packages/meal-domain/src/validation';
import { experienceEngine as food } from '../packages/meal-domain/src/experience';
import { batchPlanning } from '../packages/meal-domain/src/batch-planner';
import { defaultFilters, emptyNutrition, type AppState } from '../packages/meal-domain/src/types';
import type { BatchPlanRequest } from '../packages/meal-domain/src/experience-types';

// Issue #46: a finished cook can teach the recipe its meal portion, only when the person says so.

const RECIPE_ID = 'youtube:icQDSc0Zj4c'; // 4 recipe servings, dinner
const DATE = '2026-10-26';

const seeded = (): AppState => {
  const recipes = validateRecipes(
    JSON.parse(fs.readFileSync('apps/web/public/data/recipe-bank.json', 'utf8')),
  ).filter((recipe) => recipe.id === RECIPE_ID);
  return food.ensureToday(
    food.ensureState({
      version: 1,
      recipes,
      plans: [],
      activePlanId: null,
      logs: [],
      targets: emptyNutrition(),
      shoppingChecks: {},
      manualShopping: {},
    }),
    DATE,
    'dinner',
  );
};

/** Cooks the published 4 servings and divides them into 8 boxes. */
const cookIntoBoxes = (rememberPortion?: boolean): AppState =>
  food.finishCook(
    food.startCook(seeded(), RECIPE_ID, 4, { id: 'cook', date: DATE, slot: 'dinner' }),
    'cook',
    {
      id: 'boxes',
      actualYield: 8,
      yieldUnit: 'box',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      ...(rememberPortion === undefined ? {} : { rememberPortion }),
    },
  );

const request: BatchPlanRequest = {
  weekStart: '2026-11-02',
  days: 7,
  people: 1,
  slots: ['dinner'],
  distinctRecipes: 1,
  targetPortions: 4,
  windows: [],
  filters: defaultFilters(),
  strictTiming: false,
  reuseReady: false,
  reuseOneOffs: false,
};

test('AE1: confirming one box as one meal stores the size it was measured at', () => {
  const done = cookIntoBoxes(true);
  const profile = done.experience!.recipeProfiles[RECIPE_ID];
  const batch = done.experience!.batches[0];
  assert.equal(profile.yieldUnit, 'box');
  assert.equal(profile.sourceUnitsPerPortion, 0.5, '4 recipe servings made 8 boxes');
  assert.equal(profile.portionSizeConfirmed, true);
  assert.equal(profile.portionObservedAt, batch.madeAt);
  assert.equal(profile.elapsedMinutes, null, 'no time was given, so none is learned');
});

test('AE2: without the explicit choice, the portion stays unconfirmed', () => {
  for (const choice of [undefined, false]) {
    const done = cookIntoBoxes(choice);
    assert.equal(done.experience!.recipeProfiles[RECIPE_ID], undefined);
    assert.equal(done.experience!.batches.length, 1, 'ready food is still recorded');
  }
});

test('the time and the portion learned in one cook are both kept', () => {
  const done = food.finishCook(
    food.startCook(seeded(), RECIPE_ID, 4, { id: 'cook', date: DATE, slot: 'dinner' }),
    'cook',
    {
      id: 'boxes',
      actualYield: 8,
      yieldUnit: 'box',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      elapsedMinutes: 50,
      rememberTiming: true,
      rememberPortion: true,
    },
  );
  const profile = done.experience!.recipeProfiles[RECIPE_ID];
  assert.equal(profile.elapsedMinutes, 50);
  assert.equal(profile.timingSourceServings, 4);
  assert.equal(profile.sourceUnitsPerPortion, 0.5);
  assert.equal(profile.portionSizeConfirmed, true);
});

test('AE3: later weeks plan in the confirmed size; earlier weeks keep theirs', () => {
  const before = seeded();
  const earlier = batchPlanning.proposeWeek(before, request, 'earlier').choices[0];
  assert.equal(earlier.sourceUnitsPerPortion, 1);
  assert.match(earlier.explanations.join(' '), /Portion size is not confirmed/);

  const learned = cookIntoBoxes(true);
  const withEarlier = {
    ...learned,
    experience: {
      ...learned.experience!,
      weeks: [{ ...batchPlanning.proposeWeek(before, request, 'earlier'), confirmed: true }],
      activeWeekId: 'earlier',
    },
  };
  const later = batchPlanning.proposeWeek(withEarlier, request, 'later').choices[0];
  assert.equal(later.sourceUnitsPerPortion, 0.5);
  assert.equal(later.sourceServings, later.portions * 0.5);
  assert.doesNotMatch(later.explanations.join(' '), /Portion size is not confirmed/);
  assert.equal(
    withEarlier.experience.weeks[0].choices[0].sourceUnitsPerPortion,
    1,
    'a saved week keeps the size it was planned with',
  );
  assert.equal(withEarlier.experience.batches[0].actualYield, 8, 'the cooked batch is unchanged');
});

test('AE4: editing the measured size by hand clears when it was measured', () => {
  const learned = cookIntoBoxes(true);
  const profile = learned.experience!.recipeProfiles[RECIPE_ID];
  const editable = { ...profile };
  delete editable.portionObservedAt;

  const unchanged = food.updateProfile(learned, RECIPE_ID, { ...editable, notes: 'kept' });
  assert.equal(
    unchanged.experience!.recipeProfiles[RECIPE_ID].portionObservedAt,
    profile.portionObservedAt,
    'an unrelated edit keeps the measurement',
  );
  for (const change of [
    { sourceUnitsPerPortion: 1 },
    { yieldUnit: 'bowl' },
    { portionSizeConfirmed: false },
  ]) {
    const edited = food.updateProfile(learned, RECIPE_ID, { ...editable, ...change });
    assert.equal(edited.experience!.recipeProfiles[RECIPE_ID].portionObservedAt, null);
  }
  assert.throws(
    () =>
      food.updateProfile(learned, RECIPE_ID, { ...editable, portionObservedAt: 'last Tuesday' }),
    /ISO 8601/,
  );
});

test('a learned portion survives backup and restore; older backups still restore', () => {
  const learned = cookIntoBoxes(true);
  const restored = validateState(JSON.parse(JSON.stringify(learned)));
  assert.deepEqual(
    restored.experience!.recipeProfiles[RECIPE_ID],
    learned.experience!.recipeProfiles[RECIPE_ID],
  );

  const older = JSON.parse(JSON.stringify(learned));
  delete older.experience.recipeProfiles[RECIPE_ID].portionObservedAt;
  const olderRestored = validateState(older);
  assert.equal(
    'portionObservedAt' in olderRestored.experience!.recipeProfiles[RECIPE_ID],
    false,
    'an absent field stays absent',
  );
});
