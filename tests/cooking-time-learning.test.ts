import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRecipes, validateState } from '../packages/meal-domain/src/validation';
import { experienceEngine as food } from '../packages/meal-domain/src/experience';
import { batchPlanning } from '../packages/meal-domain/src/batch-planner';
import {
  defaultFilters,
  emptyNutrition,
  type AppState,
  type Recipe,
} from '../packages/meal-domain/src/types';
import type { BatchPlanRequest, RecipeProfile } from '../packages/meal-domain/src/experience-types';

const seeded = (): AppState =>
  food.ensureToday(
    food.ensureState({
      version: 1,
      recipes: validateRecipes(
        JSON.parse(fs.readFileSync('apps/web/public/data/recipe-bank.json', 'utf8')),
      ),
      plans: [],
      activePlanId: null,
      logs: [],
      targets: emptyNutrition(),
      shoppingChecks: {},
      manualShopping: {},
    }),
    '2026-10-26',
    'dinner',
  );

const RECIPE_ID = 'youtube:icQDSc0Zj4c';
const finish = {
  id: 'timed-food',
  actualYield: 4,
  yieldUnit: 'box',
  storage: 'fridge' as const,
  storageNotes: '',
  reheatNotes: '',
};
const startTimed = (state: AppState): AppState =>
  food.startCook(state, RECIPE_ID, 4, { id: 'timed-cook', date: '2026-10-26', slot: 'dinner' });

test('a confirmed cook teaches the recipe its elapsed time for the amount cooked', () => {
  const done = food.finishCook(startTimed(seeded()), 'timed-cook', {
    ...finish,
    elapsedMinutes: 55,
    rememberTiming: true,
  });
  const profile = done.experience!.recipeProfiles[RECIPE_ID];
  assert.equal(profile.elapsedMinutes, 55);
  assert.equal(profile.timingSourceServings, 4);
  assert.equal(profile.timingObservedAt, done.experience!.batches[0].madeAt);
  assert.equal(profile.activeMinutes, null, 'hands-on time is not inferred from elapsed time');
  assert.equal(profile.equipmentConfirmed, false);
  assert.equal(profile.yieldUnit, 'box');

  const restored = validateState(JSON.parse(JSON.stringify(done)));
  assert.deepEqual(restored.experience!.recipeProfiles[RECIPE_ID], profile);
});

test('timing is learned only when the cook confirms it, and only when it is plausible', () => {
  const unconfirmed = food.finishCook(startTimed(seeded()), 'timed-cook', {
    ...finish,
    elapsedMinutes: 55,
    rememberTiming: false,
  });
  assert.equal(unconfirmed.experience!.recipeProfiles[RECIPE_ID], undefined);
  assert.equal(unconfirmed.experience!.batches.length, 1, 'ready food is still recorded');

  for (const elapsedMinutes of [0, -5, 1441, null, Number.NaN]) {
    assert.throws(
      () =>
        food.finishCook(startTimed(seeded()), 'timed-cook', {
          ...finish,
          elapsedMinutes,
          rememberTiming: true,
        }),
      /Cooking minutes/,
      `rejects ${elapsedMinutes}`,
    );
  }
});

const recipe = (id: string): Recipe => ({
  id,
  name: id,
  roles: ['dinner'],
  tags: [],
  categories: [],
  ingredients: [
    {
      id: `${id}:rice`,
      name: 'Rice',
      quantity: 100,
      unit: 'g',
      quantityText: '100 g',
      aisle: 'Pantry',
    },
  ],
  steps: ['Cook.'],
  baseServings: 2,
  nutrition: emptyNutrition(),
  reportedNutrition: emptyNutrition(),
  nutritionBasis: 'not_stated',
  sourceUrl: null,
  sourceName: 'Test kitchen',
  creatorCredit: null,
  viewCount: null,
  viewCountAt: null,
  image: null,
  prepMinutes: null,
  cookMinutes: null,
  mealPrepRating: null,
  mealPrepNotes: '',
  dataGaps: [],
  favorite: false,
  addedAt: '2026-10-26T00:00:00.000Z',
});

const learnedProfile: RecipeProfile = {
  yieldUnit: 'box',
  sourceUnitsPerPortion: 1,
  portionSizeConfirmed: false,
  activeMinutes: null,
  elapsedMinutes: 50,
  reheatMinutes: null,
  equipment: [],
  equipmentConfirmed: false,
  reheatNotes: '',
  notes: '',
  timingSourceServings: 4,
  timingObservedAt: '2026-10-20T19:05:00.000Z',
};

const planningState = (profile: RecipeProfile = learnedProfile): AppState => {
  const soup = recipe('soup');
  return food.ensureState({
    version: 1,
    recipes: [soup],
    plans: [],
    activePlanId: null,
    logs: [],
    targets: emptyNutrition(),
    shoppingChecks: {},
    manualShopping: {},
    experience: {
      ...food.ensureState({
        version: 1,
        recipes: [soup],
        plans: [],
        activePlanId: null,
        logs: [],
        targets: emptyNutrition(),
        shoppingChecks: {},
        manualShopping: {},
      }).experience!,
      recipeProfiles: { soup: profile },
    },
  });
};

const request = (targetPortions: number, availableMinutes: number): BatchPlanRequest => ({
  weekStart: '2026-11-02',
  days: 7,
  people: 1,
  slots: ['dinner'],
  distinctRecipes: 1,
  targetPortions,
  windows: [{ id: 'sunday', date: '2026-11-02', startTime: '17:00', availableMinutes }],
  filters: defaultFilters(),
  strictTiming: false,
  reuseReady: false,
  reuseOneOffs: false,
});

test('a learned time fits a window for the same amount without active time or equipment', () => {
  const fits = batchPlanning.proposeWeek(planningState(), request(4, 60), 'fits').choices[0];
  assert.deepEqual(
    { sourceServings: fits.sourceServings, timingFit: fits.timingFit, windowId: fits.windowId },
    { sourceServings: 4, timingFit: 'confirmed', windowId: 'sunday' },
  );
  assert.ok(!fits.explanations.some((text) => /time/i.test(text)), fits.explanations.join(' '));

  const tight = batchPlanning.proposeWeek(planningState(), request(4, 40), 'tight').choices[0];
  assert.equal(tight.timingFit, 'over_budget');
  assert.match(tight.explanations.join(' '), /No cooking window has 50 minutes left/);
});

test('a learned time is never scaled to a different amount', () => {
  const bigger = batchPlanning.proposeWeek(planningState(), request(6, 600), 'bigger').choices[0];
  assert.equal(bigger.sourceServings, 6);
  assert.equal(bigger.timingFit, 'unknown');
  assert.match(
    bigger.explanations.join(' '),
    /Your timed cook was 4 recipe servings; this batch is 6/,
  );
  assert.throws(
    () =>
      batchPlanning.proposeWeek(planningState(), { ...request(6, 600), strictTiming: true }, 'x'),
    /confirmed for that exact amount/,
  );
});

test('a time entered by hand applies to the published amount, as before', () => {
  const entered: RecipeProfile = {
    ...learnedProfile,
    timingSourceServings: null,
    timingObservedAt: null,
  };
  const atBase = batchPlanning.proposeWeek(planningState(entered), request(2, 60), 'base');
  assert.equal(atBase.choices[0].timingFit, 'confirmed');
  const unknownTime = batchPlanning.proposeWeek(
    planningState({ ...entered, elapsedMinutes: null }),
    request(2, 60),
    'unknown',
  ).choices[0];
  assert.equal(unknownTime.timingFit, 'unknown');
  assert.match(unknownTime.explanations.join(' '), /Cooking time is unknown/);
});

test('editing the time by hand clears its measured provenance; other edits keep it', () => {
  const state = planningState();
  const { timingSourceServings: _servings, timingObservedAt: _at, ...asEdited } = learnedProfile;
  const notesOnly = food.updateProfile(state, 'soup', { ...asEdited, notes: 'Use the big pot.' });
  assert.equal(notesOnly.experience!.recipeProfiles.soup.timingSourceServings, 4);
  assert.equal(
    notesOnly.experience!.recipeProfiles.soup.timingObservedAt,
    learnedProfile.timingObservedAt,
  );

  const retimed = food.updateProfile(state, 'soup', { ...asEdited, elapsedMinutes: 65 });
  assert.equal(retimed.experience!.recipeProfiles.soup.elapsedMinutes, 65);
  assert.equal(retimed.experience!.recipeProfiles.soup.timingSourceServings, null);
  assert.equal(retimed.experience!.recipeProfiles.soup.timingObservedAt, null);
});

test('version-one profiles without timing provenance still restore unchanged', () => {
  const { timingSourceServings: _servings, timingObservedAt: _at, ...versionOne } = learnedProfile;
  const restored = validateState(JSON.parse(JSON.stringify(planningState(versionOne))));
  assert.deepEqual(restored.experience!.recipeProfiles.soup, versionOne);

  const broken = JSON.parse(JSON.stringify(planningState()));
  broken.experience.recipeProfiles.soup.timingObservedAt = 'last Tuesday';
  assert.throws(() => validateState(broken), /timingObservedAt/);
});
