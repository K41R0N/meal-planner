import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildShoppingList,
  defaultFilters,
  emptyNutrition,
  filterRecipes,
  perServingNutrition,
  recipeNutrition,
  validateRecipes,
  validateState,
  type Nutrition,
  type Recipe,
  type WeekPlan,
} from '../packages/meal-domain/src/index.ts';

const nutrition = (values: Partial<Nutrition> = {}): Nutrition => ({ ...emptyNutrition(), ...values });

const makeRecipe = (id: string, overrides: Partial<Recipe> = {}): Recipe => ({
  id,
  name: id,
  roles: ['dinner'],
  tags: [],
  categories: [],
  ingredients: [{ id: `${id}:ingredient`, name: 'Tomato', quantity: 1, unit: 'g', quantityText: '1 g', aisle: 'Produce' }],
  steps: ['Cook.'],
  baseServings: 1,
  nutrition: nutrition({ calories: 100, protein: 20, carbs: 10, fat: 5 }),
  reportedNutrition: nutrition(),
  nutritionBasis: 'per_serving',
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
  ...overrides,
});

const makePlan = (recipe: Recipe): WeekPlan => ({
  id: 'plan-1',
  config: {
    weekStart: '2026-10-26',
    days: 1,
    people: 1,
    slots: ['dinner'],
    uniqueRecipes: 1,
    filters: defaultFilters(),
  },
  meals: [{ id: 'meal-1', date: '2026-10-26', slot: 'dinner', recipeId: recipe.id, servings: 1, locked: false }],
  createdAt: '2026-10-26T00:00:00.000Z',
});

test('per-recipe nutrition derives per-serving values and consumption snapshots scale them', () => {
  const recipe = makeRecipe('per-recipe', {
    baseServings: 4,
    nutritionBasis: 'per_recipe',
    nutrition: nutrition({ calories: 99 }),
    reportedNutrition: nutrition({ calories: 1600, protein: 80 }),
  });

  assert.deepEqual(perServingNutrition(recipe), nutrition({ calories: 400, protein: 20 }));
  assert.deepEqual(recipeNutrition(recipe, 2), nutrition({ calories: 800, protein: 40 }));
});

test('per-serving catalog filters and sorts ignore rogue nutrition when the basis is unknown', () => {
  const perRecipe = makeRecipe('per-recipe', {
    baseServings: 4,
    nutritionBasis: 'per_recipe',
    reportedNutrition: nutrition({ calories: 1600 }),
  });
  const unknownBasis = makeRecipe('unknown-basis', {
    nutritionBasis: 'unspecified',
    nutrition: nutrition({ calories: 1, protein: 999 }),
    reportedNutrition: nutrition({ calories: 1, protein: 999 }),
  });

  assert.deepEqual(perServingNutrition(unknownBasis), emptyNutrition());
  assert.deepEqual(
    filterRecipes([unknownBasis, perRecipe], {
      ...defaultFilters(),
      ranges: { calories: { max: 500 } },
      sort: 'calories',
    }).map((recipe) => recipe.id),
    ['per-recipe'],
  );
  assert.deepEqual(
    filterRecipes([unknownBasis, perRecipe], { ...defaultFilters(), sort: 'calories' }).map((recipe) => recipe.id),
    ['per-recipe', 'unknown-basis'],
  );
});

test('validation canonicalizes nutrition by basis and recomputes when per-recipe yield changes', () => {
  const common: Partial<Recipe> = {
    nutritionBasis: 'per_recipe',
    nutrition: nutrition({ calories: 999 }),
    reportedNutrition: nutrition({ calories: 1600 }),
  };
  const withFourServings = validateRecipes([makeRecipe('yield-four', { ...common, baseServings: 4 })])[0];
  const withEightServings = validateRecipes([makeRecipe('yield-eight', { ...common, baseServings: 8 })])[0];
  const unknownBasis = validateRecipes([makeRecipe('unknown', {
    nutritionBasis: 'not_stated',
    nutrition: nutrition({ calories: 200 }),
    reportedNutrition: nutrition({ calories: 1600 }),
  })])[0];
  const manualPerServing = validateRecipes([makeRecipe('manual', {
    nutritionBasis: 'per_serving',
    nutrition: nutrition({ calories: 250, fiber: null }),
    reportedNutrition: nutrition({ calories: 1600 }),
  })])[0];

  assert.equal(withFourServings.nutrition.calories, 400);
  assert.equal(withEightServings.nutrition.calories, 200);
  assert.equal(unknownBasis.nutrition.calories, null);
  assert.deepEqual(manualPerServing.nutrition, nutrition({ calories: 250, fiber: null }));
});

test('validation rejects unsafe source/image URLs, out-of-range meal-prep ratings, and malformed timestamps', () => {
  for (const sourceUrl of ['javascript:alert(1)', 'data:text/html,unsafe', 'https://user:pass@example.test/recipe']) {
    assert.throws(() => validateRecipes([makeRecipe('bad-source', { sourceUrl })]), /http or https|embedded credentials/);
  }
  assert.throws(
    () => validateRecipes([makeRecipe('bad-image', { image: '//untrusted.example/image.jpg' })]),
    /host-relative/,
  );
  assert.throws(() => validateRecipes([makeRecipe('bad-rating', { mealPrepRating: 6 })]), /no greater than 5/);
  assert.throws(() => validateRecipes([makeRecipe('bad-added-at', { addedAt: 'not-a-timestamp' })]), /ISO 8601/);
  assert.throws(() => validateRecipes([makeRecipe('bad-view-count-at', { viewCountAt: '2026-02-30T00:00:00Z' })]), /real ISO 8601/);
});

test('backup validation requires valid timestamps and current plan-scoped shopping references', () => {
  const recipe = makeRecipe('shopping-recipe');
  const plan = makePlan(recipe);
  const item = buildShoppingList(plan, [recipe])[0];
  const validState = {
    version: 1 as const,
    recipes: [recipe],
    plans: [plan],
    activePlanId: plan.id,
    logs: [{
      id: 'log-1',
      date: '2026-10-26',
      recipeId: recipe.id,
      name: recipe.name,
      servings: 1,
      nutritionSnapshot: recipeNutrition(recipe, 1),
      createdAt: '2026-10-26T00:00:00.000Z',
    }],
    targets: emptyNutrition(),
    shoppingChecks: { [`${plan.id}:${item.key}`]: 'checked' as const },
    manualShopping: { [plan.id]: [{ id: 'manual-1', name: 'Salt', quantityText: '', checked: false }] },
  };

  assert.equal(validateState(validState).shoppingChecks[`${plan.id}:${item.key}`], 'checked');
  assert.throws(
    () => validateState({ ...validState, plans: [{ ...plan, createdAt: 'not-a-timestamp' }] }),
    /ISO 8601/,
  );
  assert.throws(
    () => validateState({ ...validState, manualShopping: { missing: [] } }),
    /must reference a saved plan/,
  );
  assert.throws(
    () => validateState({ ...validState, shoppingChecks: { 'plan-1:stale-item': 'checked' } }),
    /must reference a current item/,
  );
});

test('the real 119-record bank, including its 100 Louis source entries, still validates', () => {
  const bank = JSON.parse(readFileSync(new URL('../apps/web/public/data/recipe-bank.json', import.meta.url), 'utf8')) as { recipes: unknown[] };
  const recipes = validateRecipes(bank);

  assert.equal(bank.recipes.length, 119);
  assert.equal(recipes.length, 119);
  assert.equal(recipes.filter((recipe) => recipe.id.startsWith('youtube:')).length, 100);
});
