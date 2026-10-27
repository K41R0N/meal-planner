import assert from 'node:assert/strict';
import test from 'node:test';
import { batchPlanning } from '../packages/meal-domain/src/batch-planner.ts';
import { experienceEngine } from '../packages/meal-domain/src/experience.ts';
import { purchasePlanning } from '../packages/meal-domain/src/purchase-list.ts';
import {
  defaultFilters,
  emptyNutrition,
  type AppState,
  type Recipe,
} from '../packages/meal-domain/src/types.ts';
import type { ExperienceState } from '../packages/meal-domain/src/experience-types.ts';

const recipe = (): Recipe => ({
  id: 'integration-dinner',
  name: 'Integration dinner',
  roles: ['dinner'],
  tags: [],
  categories: [],
  ingredients: [
    { id: 'rice', name: 'Rice', quantity: 100, unit: 'g', quantityText: '100 g', aisle: 'Pantry' },
  ],
  steps: ['Cook the rice.'],
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

const experience = (): ExperienceState => ({
  version: 1,
  dailyChoices: [],
  sessions: [],
  batches: [],
  weeks: [],
  activeWeekId: null,
  oneOffs: [],
  recipeProfiles: {},
  purchaseMatches: [],
  groceryCoverage: {},
  purchases: [],
  manualItems: [],
  lastPlanRequest: null,
  groceryChanges: {},
  aisleOverrides: {},
  preferredSlot: 'dinner',
});

const state = (): AppState => ({
  version: 1,
  recipes: [recipe()],
  plans: [],
  activePlanId: null,
  logs: [],
  targets: emptyNutrition(),
  shoppingChecks: {},
  manualShopping: {},
  experience: experience(),
});

test('engine → draft → cover → validate → cook → consume → shopping preserves the linked one-off and cooked snapshot requirement', () => {
  const withIntent = purchasePlanning.addIntent(state(), 'integration-dinner', 2, 'one-off');
  const draft = batchPlanning.proposeWeek(
    withIntent,
    {
      weekStart: '2026-10-26',
      days: 2,
      people: 1,
      slots: ['dinner'],
      distinctRecipes: 1,
      targetPortions: 2,
      windows: [],
      filters: defaultFilters(),
      strictTiming: false,
      reuseReady: false,
      reuseOneOffs: true,
    },
    'integration-week',
  );
  const planned: AppState = {
    ...withIntent,
    experience: { ...withIntent.experience!, weeks: [draft], activeWeekId: draft.id },
  };
  const beforeCook = purchasePlanning
    .buildList(planned, draft)
    .items.find((item) => item.name === 'Rice')!;
  const covered = purchasePlanning.cover(
    planned,
    beforeCook,
    { kind: 'bought', quantity: 100 },
    'rice-purchase',
  );

  // Engine ensureState is the production validation boundary; coverage references the retained one-off identity.
  let working = experienceEngine.ensureState(covered);
  assert.equal(working.experience!.purchases.length, 1);
  assert.equal(working.experience!.groceryCoverage[beforeCook.key].boughtQuantity, 100);

  working = experienceEngine.ensureToday(working, '2026-10-26', 'dinner');
  const daily = working.experience!.dailyChoices.find(
    (choice) => choice.date === '2026-10-26' && choice.slot === 'dinner',
  )!;
  working = experienceEngine.startCook(working, daily.recipeId, 2, {
    id: 'integration-session',
    date: daily.date,
    slot: daily.slot,
    weekId: draft.id,
    choiceId: daily.id,
  });
  working = experienceEngine.finishCook(working, 'integration-session', {
    id: 'integration-batch',
    actualYield: 2,
    yieldUnit: 'portion',
    storage: 'fridge',
    storageNotes: '',
    reheatNotes: '',
  });
  working = experienceEngine.consume(
    working,
    'integration-batch',
    1,
    '2026-10-26',
    'integration-log',
    { dailyChoiceId: daily.id, useId: daily.useId! },
  );

  const afterCook = purchasePlanning
    .buildList(working, working.experience!.weeks[0])
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(
    afterCook.quantity,
    100,
    'a newly cooked non-reuse batch retains its original procurement requirement',
  );
  assert.equal(afterCook.covered, true);
  assert.equal(working.logs.length, 1);
  assert.equal(experienceEngine.availableUnits(working, 'integration-batch'), 1);
});
