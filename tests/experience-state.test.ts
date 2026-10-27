import assert from 'node:assert/strict';
import test from 'node:test';
import { experienceEngine } from '../packages/meal-domain/src/experience';
import {
  emptyNutrition,
  type AppState,
  type Recipe,
  type WeekPlan,
} from '../packages/meal-domain/src/types';
import { validateState } from '../packages/meal-domain/src/validation';

const nutrition = (values: Partial<ReturnType<typeof emptyNutrition>> = {}) => ({
  ...emptyNutrition(),
  ...values,
});

const recipe = (id = 'stew', overrides: Partial<Recipe> = {}): Recipe => ({
  id,
  name: 'Weeknight stew',
  roles: ['dinner'],
  tags: [],
  categories: [],
  ingredients: [
    {
      id: `${id}:beans`,
      name: 'Beans',
      quantity: 400,
      unit: 'g',
      quantityText: '400 g',
      aisle: 'Pantry',
    },
  ],
  steps: ['Simmer gently.', 'Serve.'],
  baseServings: 4,
  nutrition: nutrition({ calories: 300, protein: 16, carbs: 40, fat: 8 }),
  reportedNutrition: nutrition(),
  nutritionBasis: 'per_serving',
  sourceUrl: null,
  sourceName: 'Test kitchen',
  creatorCredit: null,
  viewCount: null,
  viewCountAt: null,
  image: null,
  prepMinutes: 15,
  cookMinutes: 30,
  mealPrepRating: null,
  mealPrepNotes: '',
  dataGaps: [],
  favorite: false,
  addedAt: '2026-10-26T00:00:00.000Z',
  ...overrides,
});

const legacyPlan = (item: Recipe): WeekPlan => ({
  id: 'legacy-week',
  config: {
    weekStart: '2026-10-26',
    days: 2,
    people: 1,
    slots: ['dinner'],
    uniqueRecipes: 1,
    filters: {
      search: '',
      role: 'all',
      tags: [],
      categories: [],
      includeIngredients: [],
      excludeIngredients: [],
      ranges: {},
      favoritesOnly: false,
      nutritionMode: 'perServing',
      sort: 'popular',
    },
  },
  meals: [
    {
      id: 'legacy-1',
      date: '2026-10-26',
      slot: 'dinner',
      recipeId: item.id,
      servings: 2,
      locked: false,
    },
    {
      id: 'legacy-2',
      date: '2026-10-27',
      slot: 'dinner',
      recipeId: item.id,
      servings: 2,
      locked: false,
    },
  ],
  createdAt: '2026-10-26T00:00:00.000Z',
});

const legacyState = (): AppState => {
  const saved = recipe();
  const plan = legacyPlan(saved);
  return {
    version: 1,
    recipes: [saved],
    plans: [plan],
    activePlanId: plan.id,
    logs: [
      {
        id: 'manual-history',
        date: '2026-10-20',
        recipeId: null,
        name: 'Restaurant meal',
        servings: 1,
        nutritionSnapshot: nutrition({ calories: 650 }),
        createdAt: '2026-10-20T20:00:00.000Z',
      },
    ],
    targets: emptyNutrition(),
    shoppingChecks: {},
    manualShopping: {
      [plan.id]: [{ id: 'legacy-manual', name: 'Lemons', quantityText: '2', checked: false }],
    },
  };
};

test('experience state adapts legacy plans and keeps a stable Today choice through cook, portions, undo, and validation', () => {
  const original = legacyState();
  let state = experienceEngine.ensureState(original);
  assert.equal(original.experience, undefined, 'ensureState does not mutate the legacy input');
  assert.equal(state.experience!.weeks[0].id, 'legacy-week');
  assert.equal(state.experience!.weeks[0].legacyPlanId, 'legacy-week');
  assert.equal(state.experience!.activeWeekId, 'legacy-week');
  assert.deepEqual(
    state.manualShopping,
    original.manualShopping,
    'legacy manual shopping remains legacy scoped data',
  );
  assert.equal(state.experience!.manualItems.length, 0);

  state = experienceEngine.ensureToday(state, '2026-10-26', 'dinner');
  const stable = state.experience!.dailyChoices[0];
  assert.deepEqual(
    { recipeId: stable.recipeId, useId: stable.useId, origin: stable.origin },
    { recipeId: 'stew', useId: 'legacy-1', origin: 'week' },
  );
  assert.equal(
    experienceEngine.ensureToday(state, '2026-10-26', 'dinner').experience!.dailyChoices[0].id,
    stable.id,
    'refresh does not reroll Today',
  );

  state = experienceEngine.startCook(state, 'stew', 4, {
    id: 'session-1',
    date: '2026-10-26',
    slot: 'dinner',
    sourceYield: 4,
    weekId: 'legacy-week',
    choiceId: stable.id,
  });
  state = experienceEngine.updateCook(state, 'session-1', {
    stepIndex: 1,
    checkedIngredientIds: ['stew:beans'],
    timers: [
      { id: 'simmer', label: 'Simmer', durationSeconds: 600, endsAt: null, remainingSeconds: 480 },
    ],
  });
  let today = experienceEngine.today(state, '2026-10-26', 'dinner');
  assert.equal(today.status, 'cooking');
  assert.equal(today.session!.stepIndex, 1);
  assert.equal(today.session!.timers[0].remainingSeconds, 480);

  state = experienceEngine.finishCook(state, 'session-1', {
    id: 'batch-1',
    actualYield: 6,
    yieldUnit: 'bowls',
    storage: 'fridge',
    storageNotes: 'Covered',
    reheatNotes: 'Warm slowly',
    preparedSourceServings: 4,
  });
  assert.equal(state.logs.length, 1, 'finishing cooking does not create a food log');
  const batch = state.experience!.batches[0];
  assert.equal(batch.actualYield, 6);
  assert.equal(batch.nutritionPerUnit.calories, 200, 'actual yield divides made-food nutrition');
  assert.equal(state.experience!.sessions[0].finishedAt !== null, true);
  state = experienceEngine.finishCook(state, 'session-1', {
    id: 'different-batch-id',
    actualYield: 6,
    yieldUnit: 'bowls',
    storage: 'fridge',
    storageNotes: 'Ignored repeat',
    reheatNotes: 'Ignored repeat',
    preparedSourceServings: 4,
  });
  assert.equal(state.experience!.batches.length, 1, 'repeated finish is idempotent');

  const storedSnapshotName = batch.recipeSnapshot.name;
  state = {
    ...state,
    recipes: [
      {
        ...state.recipes[0],
        name: 'Edited source recipe',
        nutrition: nutrition({ calories: 900 }),
      },
    ],
  };
  assert.equal(
    state.experience!.batches[0].recipeSnapshot.name,
    storedSnapshotName,
    'prepared recipes remain immutable after source edits',
  );

  state = experienceEngine.consume(state, 'batch-1', 1.5, '2026-10-26', 'ate-1', {
    dailyChoiceId: stable.id,
    useId: 'legacy-1',
  });
  assert.equal(state.logs.length, 2);
  assert.equal(state.logs.at(-1)!.nutritionSnapshot.calories, 300);
  assert.equal(experienceEngine.availableUnits(state, 'batch-1'), 4.5);
  assert.equal(experienceEngine.today(state, '2026-10-26', 'dinner').status, 'eaten');
  assert.equal(
    experienceEngine.consume(state, 'batch-1', 1.5, '2026-10-26', 'ate-1').logs.length,
    2,
    'same log id is idempotent',
  );
  assert.throws(
    () => experienceEngine.consume(state, 'batch-1', 10, '2026-10-26', 'too-much'),
    /available/i,
  );

  state = experienceEngine.undoConsumption(state, 'ate-1');
  assert.equal(state.logs.length, 1);
  assert.equal(experienceEngine.availableUnits(state, 'batch-1'), 6);
  assert.equal(experienceEngine.today(state, '2026-10-26', 'dinner').status, 'ready');

  state = {
    ...state,
    recipes: [...state.recipes, recipe('alternate', { name: 'Alternate dinner' })],
  };
  const eatenAgain = experienceEngine.consume(state, 'batch-1', 1, '2026-10-26', 'ate-next', {
    dailyChoiceId: stable.id,
    useId: 'legacy-1',
  });
  const next = experienceEngine.nextMeal(eatenAgain, '2026-10-26', 'dinner');
  assert.deepEqual(
    {
      id: next.experience!.dailyChoices[0].id,
      recipeId: next.experience!.dailyChoices[0].recipeId,
      logId: next.experience!.dailyChoices[0].logId,
    },
    { id: stable.id, recipeId: 'alternate', logId: null },
    'Next meal is explicit and replaces, rather than rerolling, the date-slot choice',
  );

  const carried = experienceEngine.chooseToday(next, '2026-11-02', 'dinner', 'stew', {
    batchId: 'batch-1',
  });
  assert.equal(
    experienceEngine.today(carried, '2026-11-02', 'dinner').status,
    'ready',
    'ready food remains usable across week boundaries',
  );
  const restored = validateState(JSON.parse(JSON.stringify(carried)));
  assert.equal(restored.experience!.batches[0].recipeSnapshot.name, storedSnapshotName);
  assert.equal(restored.logs[0].id, 'manual-history', 'manual historic logs remain independent');
});

test('unknown source yield requires confirmation before scaled cooking while retaining recipe reading', () => {
  const unknownYield = recipe('unknown-yield', { baseServings: null });
  const state: AppState = {
    ...legacyState(),
    recipes: [unknownYield],
    plans: [],
    activePlanId: null,
    manualShopping: {},
    shoppingChecks: {},
  };
  assert.throws(
    () =>
      experienceEngine.startCook(experienceEngine.ensureState(state), unknownYield.id, 2, {
        id: 'unknown-session',
        date: '2026-10-26',
        slot: 'dinner',
      }),
    /yield.*confirm|confirm.*yield/i,
  );
});
