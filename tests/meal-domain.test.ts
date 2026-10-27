import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildShoppingList,
  createConsumption,
  defaultFilters,
  emptyNutrition,
  filterRecipes,
  generateWeek,
  recipeNutrition,
  replaceBatch,
  replaceMeal,
  sumNutrition,
  validateRecipes,
  validateState,
  type Filters,
  type PlanConfig,
  type Recipe,
  type WeekPlan,
} from '../packages/meal-domain/src/index.ts';

const nutrition = (values: Partial<ReturnType<typeof emptyNutrition>> = {}) => ({ ...emptyNutrition(), ...values });

const makeRecipe = (id: string, overrides: Partial<Recipe> = {}): Recipe => ({
  id,
  name: id,
  roles: ['dinner'],
  tags: [],
  categories: [],
  ingredients: [{ id: `${id}:ingredient`, name: 'Tomato', quantity: 1, unit: 'g', quantityText: '1g', aisle: 'Produce' }],
  steps: ['Cook.'],
  baseServings: 1,
  nutrition: nutrition({ calories: 100, protein: 20, carbs: 10, fat: 5, fiber: 2, sugar: 1, sodium: 10 }),
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

const planConfig = (overrides: Partial<PlanConfig> = {}): PlanConfig => ({
  weekStart: '2026-10-26',
  days: 2,
  people: 2,
  slots: ['breakfast', 'dinner'],
  uniqueRecipes: 2,
  filters: defaultFilters(),
  ...overrides,
});

const mealPlan = (config: PlanConfig, meals: WeekPlan['meals']): WeekPlan => ({
  id: 'plan-1',
  config,
  meals,
  createdAt: '2026-10-26T00:00:00.000Z',
});

test('filterRecipes combines text, roles, labels, ingredients, favorites, ranges, and sort rules', () => {
  const chicken = makeRecipe('chicken', {
    name: 'Fast Chicken Bowl',
    roles: ['dinner'],
    tags: ['High Protein'],
    categories: ['Quick'],
    ingredients: [
      { id: 'chicken:1', name: 'Chicken breast', quantity: 200, unit: 'g', quantityText: '200g', aisle: 'Meat & Fish' },
      { id: 'chicken:2', name: 'Broccoli', quantity: 1, unit: null, quantityText: '1', aisle: 'Produce' },
    ],
    nutrition: nutrition({ calories: 500, protein: 60, fiber: 8 }),
    favorite: true,
  });
  const tofu = makeRecipe('tofu', {
    name: 'Tofu bowl',
    tags: ['Vegan'],
    categories: ['Quick'],
    ingredients: [{ id: 'tofu:1', name: 'Tofu', quantity: 200, unit: 'g', quantityText: '200g', aisle: 'Produce' }],
    nutrition: nutrition({ calories: 300, protein: 30, fiber: 5 }),
    favorite: true,
  });
  const unknown = makeRecipe('unknown', {
    nutrition: nutrition({ calories: null, protein: null, fiber: null }),
  });
  const strict: Filters = {
    ...defaultFilters(),
    search: 'chicken',
    role: 'dinner',
    tags: ['high protein'],
    categories: ['quick'],
    includeIngredients: ['broccoli'],
    excludeIngredients: ['tofu'],
    ranges: { protein: { min: 50 } },
    favoritesOnly: true,
    sort: 'protein',
  };
  assert.deepEqual(filterRecipes([tofu, unknown, chicken], strict).map((recipe) => recipe.id), ['chicken']);
  assert.deepEqual(
    filterRecipes([unknown, tofu, chicken], { ...defaultFilters(), sort: 'protein' }).map((recipe) => recipe.id),
    ['chicken', 'tofu', 'unknown'],
  );
  assert.deepEqual(
    filterRecipes([unknown, tofu], { ...defaultFilters(), ranges: { calories: { max: 400 } } }).map((recipe) => recipe.id),
    ['tofu'],
  );
});

test('generateWeek fills every local date/slot, uses exactly the requested recipes, and retains valid locks', () => {
  const breakfast = makeRecipe('breakfast', { roles: ['breakfast'] });
  const dinner = makeRecipe('dinner', { roles: ['dinner'] });
  const flexible = makeRecipe('flexible', { roles: ['breakfast', 'dinner'] });
  const config = planConfig();
  const first = generateWeek([breakfast, dinner, flexible], config);

  assert.equal(first.meals.length, 4);
  assert.equal(new Set(first.meals.map((meal) => meal.recipeId)).size, 2);
  assert.deepEqual([...new Set(first.meals.map((meal) => meal.date))], ['2026-10-26', '2026-10-27']);
  for (const meal of first.meals) {
    const recipe = [breakfast, dinner, flexible].find((item) => item.id === meal.recipeId)!;
    assert.ok(recipe.roles.includes(meal.slot));
  }

  const lockedPrevious = {
    ...first,
    meals: first.meals.map((meal) => meal.date === '2026-10-26' && meal.slot === 'breakfast'
      ? { ...meal, id: 'preserved-slot-id', recipeId: 'breakfast', servings: 3, locked: true }
      : meal),
  };
  const regenerated = generateWeek([breakfast, dinner, flexible], config, lockedPrevious);
  const locked = regenerated.meals.find((meal) => meal.id === 'preserved-slot-id')!;
  assert.deepEqual(
    { date: locked.date, slot: locked.slot, recipeId: locked.recipeId, servings: locked.servings, locked: locked.locked },
    { date: '2026-10-26', slot: 'breakfast', recipeId: 'breakfast', servings: 3, locked: true },
  );
  assert.equal(new Set(regenerated.meals.map((meal) => meal.recipeId)).size, 2);

  assert.throws(
    () => generateWeek([breakfast, dinner], { ...config, uniqueRecipes: 3 }),
    /Need exactly 3 eligible recipes/,
  );
  assert.throws(
    () => generateWeek([breakfast, dinner], { ...config, filters: { ...defaultFilters(), role: 'breakfast' } }),
    /eligible recipes|dinner slot/,
  );
});

test('replaceMeal and replaceBatch preserve configured count, slot roles, locks, ids, dates, and servings', () => {
  const a = makeRecipe('a', { roles: ['dinner'] });
  const b = makeRecipe('b', { roles: ['dinner'] });
  const c = makeRecipe('c', { roles: ['dinner'] });
  const config = planConfig({ days: 4, slots: ['dinner'], uniqueRecipes: 2 });
  const plan = mealPlan(config, [
    { id: 'm1', date: '2026-10-26', slot: 'dinner', recipeId: 'a', servings: 2, locked: false },
    { id: 'm2', date: '2026-10-27', slot: 'dinner', recipeId: 'a', servings: 3, locked: false },
    { id: 'm3', date: '2026-10-28', slot: 'dinner', recipeId: 'b', servings: 2, locked: false },
    { id: 'm4', date: '2026-10-29', slot: 'dinner', recipeId: 'b', servings: 2, locked: false },
  ]);
  const single = replaceMeal(plan, 'm1', [a, b, c]);
  assert.equal(single.meals.find((meal) => meal.id === 'm1')!.recipeId, 'b');
  assert.equal(new Set(single.meals.map((meal) => meal.recipeId)).size, 2);
  assert.throws(() => replaceMeal({ ...plan, meals: plan.meals.map((meal) => meal.id === 'm1' ? { ...meal, locked: true } : meal) }, 'm1', [a, b, c]), /Unlock/);

  const batch = replaceBatch(plan, 'a', [a, b, c]);
  assert.equal(batch.meals.filter((meal) => meal.id === 'm1' || meal.id === 'm2').every((meal) => meal.recipeId === 'c'), true);
  assert.deepEqual(batch.meals.find((meal) => meal.id === 'm2'), { id: 'm2', date: '2026-10-27', slot: 'dinner', recipeId: 'c', servings: 3, locked: false });
  assert.equal(new Set(batch.meals.map((meal) => meal.recipeId)).size, 2);
  assert.throws(
    () => replaceBatch({ ...plan, meals: plan.meals.map((meal) => meal.id === 'm2' ? { ...meal, locked: true } : meal) }, 'a', [a, b, c]),
    /Unlock every occurrence/,
  );
});

test('buildShoppingList deliberately totals repeated planned portions, compatible units, and review gaps', () => {
  const prepared = makeRecipe('prepared', {
    name: 'Prepared dinner',
    baseServings: 2,
    ingredients: [
      { id: 'prepared:tomato', name: 'Tomatoes', quantity: 1, unit: 'kg', quantityText: '1 kg', aisle: 'Produce' },
      { id: 'prepared:garlic', name: 'Garlic', quantity: 1, unit: 'tbsp', quantityText: '1 tbsp', aisle: 'Produce' },
    ],
  });
  const incomplete = makeRecipe('incomplete', {
    name: 'No known yield',
    baseServings: null,
    ingredients: [{ id: 'incomplete:rice', name: 'Dry rice', quantity: 200, unit: 'g', quantityText: '200g', aisle: 'Pantry' }],
  });
  const ranged = makeRecipe('ranged', {
    name: 'Ranged seasoning',
    ingredients: [{ id: 'ranged:spice', name: 'Chili flakes', quantity: null, unit: 'tsp', quantityText: '1-2 tsp', aisle: 'Herbs & Spices' }],
  });
  const plan = mealPlan(planConfig(), [
    { id: 'p1', date: '2026-10-26', slot: 'dinner', recipeId: 'prepared', servings: 2, locked: false },
    { id: 'p2', date: '2026-10-27', slot: 'dinner', recipeId: 'prepared', servings: 4, locked: false },
    { id: 'p3', date: '2026-10-27', slot: 'breakfast', recipeId: 'incomplete', servings: 2, locked: false },
    { id: 'p4', date: '2026-10-26', slot: 'breakfast', recipeId: 'ranged', servings: 1, locked: false },
  ]);
  const items = buildShoppingList(plan, [prepared, incomplete, ranged]);
  const tomatoes = items.find((item) => item.name.toLocaleLowerCase().startsWith('tomato'))!;
  const garlic = items.find((item) => item.name === 'Garlic')!;
  const rice = items.find((item) => item.name === 'Dry rice')!;
  const chili = items.find((item) => item.name === 'Chili flakes')!;
  assert.deepEqual({ quantity: tomatoes.quantity, unit: tomatoes.unit, contributions: tomatoes.contributions.length }, { quantity: 3000, unit: 'g', contributions: 2 });
  assert.deepEqual({ quantity: garlic.quantity, unit: garlic.unit }, { quantity: 9, unit: 'tsp' });
  assert.equal(rice.quantity, null);
  assert.equal(rice.needsReview, true);
  assert.match(rice.notes.join(' '), /yield is not stated/);
  assert.equal(chili.quantity, null);
  assert.equal(chili.displayQuantity, '1-2 tsp');
  assert.equal(chili.needsReview, true);
  assert.equal(tomatoes.key, buildShoppingList(plan, [prepared, incomplete, ranged]).find((item) => item.name.toLocaleLowerCase().startsWith('tomato'))!.key);
});

test('nutrition snapshots scale established per-serving data and totals stay visibly incomplete', () => {
  const recipe = makeRecipe('nutrition', { nutrition: nutrition({ calories: 100, protein: 25, carbs: 10, fat: 5, fiber: null }) });
  assert.deepEqual(recipeNutrition(recipe, 2), nutrition({ calories: 200, protein: 50, carbs: 20, fat: 10, fiber: null, sugar: null, sodium: null }));
  assert.deepEqual(recipeNutrition({ ...recipe, nutritionBasis: 'unspecified' }, 2), emptyNutrition());
  const consumed = createConsumption(recipe, 2, '2026-10-26');
  assert.equal(consumed.nutritionSnapshot.calories, 200);
  const totals = sumNutrition([consumed, { nutritionSnapshot: nutrition({ calories: 50, protein: null, carbs: 10, fat: 1 }) }]);
  assert.deepEqual(
    { calories: totals.values.calories, protein: totals.values.protein, knownProtein: totals.known.protein, count: totals.count, incomplete: totals.incomplete },
    { calories: 250, protein: 50, knownProtein: 1, count: 2, incomplete: true },
  );
  assert.deepEqual(sumNutrition([]), {
    values: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
    known: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
    count: 0,
    incomplete: false,
  });
});

test('validateRecipes supports bank and Louis envelopes; validateState permits orphaned log snapshots only', () => {
  const appRecipe = makeRecipe('bank-recipe', { roles: ['breakfast'] });
  assert.equal(validateRecipes({ schemaVersion: 1, recipes: [appRecipe] })[0].id, 'bank-recipe');
  assert.throws(() => validateRecipes([{ ...appRecipe, name: '<b>unsafe</b>' }]), /not HTML/);

  const louis = {
    schema_version: 1,
    recipes: [{
      id: 'youtube:example',
      title: 'Louis breakfast',
      source: { channel_name: 'Louis Howard', video_url: 'https://example.test/video', exact_view_count: 12, view_count_collected_at: '2026-10-26T00:00:00Z', original_creator_credit: '@creator' },
      servings: 2,
      ingredients: [{ name: 'Eggs', quantity: 2, unit: null, quantity_text: '2', source_text: '2 eggs', category: 'dairy_eggs' }],
      instructions: ['Cook the eggs.'],
      nutrition: {
        reported: { calories_kcal: 100, protein_g: 10, carbs_g: null, fat_g: 6, fiber_g: null, sugar_g: null, sodium_mg: null },
        reported_basis: 'per_serving',
        basis_evidence: 'Per serving',
        source_evidence: '100 calories',
        per_serving: { calories_kcal: 100, protein_g: 10, carbs_g: null, fat_g: 6, fiber_g: null, sugar_g: null, sodium_mg: null },
      },
      organization: { suggested_meal_types: ['breakfast'], suggested_tags: ['eggs'], user_tags: [], user_categories: [], meal_prep_rating: null, meal_prep_notes: null },
      prep_minutes: null,
      cook_minutes: null,
      data_gaps: ['Carbohydrates not stated.'],
    }],
  };
  const imported = validateRecipes(louis)[0];
  assert.deepEqual(imported.nutrition, nutrition({ calories: 100, protein: 10, carbs: null, fat: 6, fiber: null, sugar: null, sodium: null }));
  assert.match(imported.nutritionEvidence ?? '', /Per serving/);
  assert.match(imported.nutritionEvidence ?? '', /100 calories/);

  const config = planConfig({ days: 1, slots: ['breakfast'], uniqueRecipes: 1 });
  const plan = mealPlan(config, [{ id: 'state-meal', date: '2026-10-26', slot: 'breakfast', recipeId: 'bank-recipe', servings: 1, locked: false }]);
  const state = validateState({
    version: 1,
    recipes: [appRecipe],
    plans: [plan],
    activePlanId: 'plan-1',
    logs: [{ id: 'historic', date: '2026-10-20', recipeId: 'removed-recipe', name: 'Historic meal', servings: 1, nutritionSnapshot: nutrition({ calories: 300 }), createdAt: '2026-10-20T00:00:00Z' }],
    targets: emptyNutrition(),
    shoppingChecks: {},
    manualShopping: {},
  });
  assert.equal(state.logs[0].recipeId, 'removed-recipe');
  assert.throws(() => validateState({ ...state, plans: [{ ...plan, meals: [{ ...plan.meals[0], recipeId: 'missing' }] }] }), /references missing recipe/);
});
