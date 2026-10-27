import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRecipes, validateState } from '../packages/meal-domain/src/validation';
import { experienceEngine as food } from '../packages/meal-domain/src/experience';
import { batchPlanning as planning } from '../packages/meal-domain/src/batch-planner';
import { purchasePlanning as purchases } from '../packages/meal-domain/src/purchase-list';
import { emptyNutrition, type AppState } from '../packages/meal-domain/src/types';

const base = (): AppState =>
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
  });

test('a real recipe can become a week, bought groceries and a valid private backup', () => {
  const initial = base();
  const recipe = initial.recipes.find((item) => item.id === 'youtube:icQDSc0Zj4c')!;
  const week = planning.addRecipe(
    initial,
    null,
    recipe.id,
    recipe.baseServings!,
    4,
    'integration-week',
    '2026-10-26',
  );
  const state = {
    ...initial,
    experience: { ...initial.experience!, weeks: [week], activeWeekId: week.id },
  };
  const item = purchases.buildList(state, week).items.find((line) => line.quantity !== null)!;
  const bought = purchases.cover(state, item, { kind: 'bought' }, 'integration-purchase');
  const restored = validateState(JSON.parse(JSON.stringify(bought)));
  assert.equal(restored.experience!.purchases.length, 1);
  assert.equal(
    purchases.buildList(restored, week).items.find((line) => line.key === item.key)!.covered,
    true,
  );
});

test('a resumed cooking session retains its snapshot, step and checks', () => {
  const initial = food.ensureToday(base(), '2026-10-26', 'dinner');
  const recipe = initial.recipes.find((item) => item.id === 'youtube:icQDSc0Zj4c')!;
  const started = food.startCook(initial, recipe.id, 4, {
    id: 'resume-me',
    date: '2026-10-26',
    slot: 'dinner',
  });
  const updated = food.updateCook(started, 'resume-me', {
    stepIndex: 1,
    checkedIngredientIds: [recipe.ingredients[0].id],
  });
  const resumed = food.startCook(updated, recipe.id, 4, {
    id: 'resume-me',
    date: '2026-10-26',
    slot: 'dinner',
  });
  assert.equal(resumed.experience!.sessions.length, 1);
  assert.equal(resumed.experience!.sessions[0].stepIndex, 1);
  assert.deepEqual(resumed.experience!.sessions[0].checkedIngredientIds, [
    recipe.ingredients[0].id,
  ]);
});

test('cooking another batch detaches the prior daily link without rewriting available food', () => {
  const initial = food.ensureToday(base(), '2026-10-26', 'dinner');
  const recipe = initial.recipes.find((item) => item.id === 'youtube:icQDSc0Zj4c')!;
  const first = food.startCook(initial, recipe.id, 4, {
    id: 'cook-first',
    date: '2026-10-26',
    slot: 'dinner',
  });
  const ready = food.finishCook(first, 'cook-first', {
    id: 'food-first',
    actualYield: 4,
    yieldUnit: 'portion',
    storage: 'fridge',
    storageNotes: '',
    reheatNotes: '',
  });
  const second = food.startCook(ready, recipe.id, 4, {
    id: 'cook-second',
    date: '2026-10-26',
    slot: 'dinner',
  });
  const finished = food.finishCook(second, 'cook-second', {
    id: 'food-second',
    actualYield: 4,
    yieldUnit: 'portion',
    storage: 'fridge',
    storageNotes: '',
    reheatNotes: '',
  });
  const restored = validateState(finished);
  assert.equal(food.availableUnits(restored, 'food-first'), 4);
  assert.equal(food.availableUnits(restored, 'food-second'), 4);
});
