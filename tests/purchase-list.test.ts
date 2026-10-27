import assert from 'node:assert/strict';
import test from 'node:test';
import { purchasePlanning } from '../packages/meal-domain/src/purchase-list.ts';
import {
  defaultFilters,
  emptyNutrition,
  type AppState,
  type Recipe,
} from '../packages/meal-domain/src/types.ts';
import type { BatchWeek, ExperienceState } from '../packages/meal-domain/src/experience-types.ts';

const recipe = (id: string, ingredientName = 'Rice', unit: string | null = 'g'): Recipe => ({
  id,
  name: id,
  roles: ['dinner'],
  tags: [],
  categories: [],
  ingredients: [
    {
      id: `${id}:ingredient`,
      name: ingredientName,
      quantity: 100,
      unit,
      quantityText: unit ? `100 ${unit}` : '100',
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

const exp = (): ExperienceState => ({
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
const state = (recipes: Recipe[], experience = exp()): AppState => ({
  version: 1,
  recipes,
  plans: [],
  activePlanId: null,
  logs: [],
  targets: emptyNutrition(),
  shoppingChecks: {},
  manualShopping: {},
  experience,
});
const week = (choices: BatchWeek['choices']): BatchWeek => ({
  id: 'week-1',
  label: 'Draft',
  weekStart: '2026-10-26',
  days: 1,
  people: 1,
  slots: ['dinner'],
  windows: [],
  choices,
  uses: [],
  confirmed: false,
  createdAt: '2026-10-26T00:00:00.000Z',
  legacyPlanId: null,
});

test('purchase requirements use each batch once, dedupe a linked one-off, and retain unknown lines for review', () => {
  const dinner = recipe('dinner');
  const app = state([dinner]);
  const withIntent = purchasePlanning.addIntent(app, dinner.id, 2, 'intent-1');
  const list = purchasePlanning.buildList(
    withIntent,
    week([
      {
        id: 'choice-1',
        recipeId: dinner.id,
        sourceServings: 2,
        portions: 2,
        sourceUnitsPerPortion: 1,
        windowId: null,
        locked: false,
        readyBatchId: null,
        reuseReady: false,
        shoppingIntentId: 'intent-1',
        explanations: [],
        timingFit: 'unknown',
      },
    ]),
  );
  assert.equal(list.scopeId, 'week-1');
  assert.equal(
    list.items.length,
    1,
    'the calendar and linked one-off do not procure the same batch twice',
  );
  assert.equal(list.items[0].quantity, 100);
  assert.deepEqual(list.items[0].intentionIds, ['intent-1']);

  const unknown = recipe('unknown');
  unknown.ingredients[0] = { ...unknown.ingredients[0], quantity: null, quantityText: 'to taste' };
  const unknownList = purchasePlanning.buildList(
    state([unknown]),
    week([
      {
        id: 'unknown-choice',
        recipeId: unknown.id,
        sourceServings: 2,
        portions: 2,
        sourceUnitsPerPortion: 1,
        windowId: null,
        locked: false,
        readyBatchId: null,
        reuseReady: false,
        shoppingIntentId: null,
        explanations: [],
        timingFit: 'unknown',
      },
    ]),
  );
  assert.equal(unknownList.items[0].quantity, null);
  assert.equal(unknownList.items[0].needsReview, true);
});

test('coverage stores measured amounts, purchase history survives clear, and water is the only automatic exclusion', () => {
  const dinner = recipe('dinner');
  const water = recipe('water', 'Water', 'ml');
  const mineral = recipe('mineral', 'Mineral water', 'ml');
  const app = state([dinner, water, mineral]);
  const draft = week([
    {
      id: 'dinner-choice',
      recipeId: dinner.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: null,
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
    {
      id: 'water-choice',
      recipeId: water.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: null,
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
    {
      id: 'mineral-choice',
      recipeId: mineral.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: null,
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
  ]);
  const first = purchasePlanning.buildList(app, draft);
  assert.equal(
    first.items.some((item) => item.name === 'Water'),
    false,
  );
  assert.equal(
    first.items.some((item) => item.name === 'Mineral water'),
    true,
  );
  const rice = first.items.find((item) => item.name === 'Rice')!;
  const covered = purchasePlanning.cover(app, rice, { kind: 'bought', quantity: 40 }, 'purchase-1');
  const second = purchasePlanning
    .buildList(covered, draft)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(second.remainingQuantity, 60);
  assert.equal(covered.experience!.purchases.length, 1);
  const cleared = purchasePlanning.cover(covered, second, { kind: 'clear' }, 'ignored');
  assert.equal(cleared.experience!.purchases.length, 1, 'clear only resets present coverage');
  assert.equal(
    purchasePlanning.buildList(cleared, draft).items.find((item) => item.name === 'Rice')!
      .remainingQuantity,
    100,
  );
});

test('explicit compatible preparation matches create one evidence-preserving row and reject composition changes', () => {
  const whole = recipe('whole', 'Whole chicken breast');
  const diced = recipe('diced', 'Diced chicken breast');
  const raw = recipe('raw', 'Raw chicken breast');
  const draft = week([
    {
      id: 'whole-choice',
      recipeId: whole.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: null,
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
    {
      id: 'diced-choice',
      recipeId: diced.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: null,
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
  ]);
  const app = state([whole, diced, raw]);
  const matched = purchasePlanning.approveMatch(
    app,
    ['Whole chicken breast', 'Diced chicken breast'],
    'Chicken breast',
    'Buy whole and dice it before cooking.',
    'match-1',
  );
  const row = purchasePlanning
    .buildList(matched, draft)
    .items.find((item) => item.name === 'Chicken breast')!;
  assert.equal(row.quantity, 200);
  assert.equal(row.contributions.length, 2);
  assert.match(row.notes.join(' '), /dice/i);
  assert.throws(
    () =>
      purchasePlanning.approveMatch(
        app,
        ['Raw chicken breast', 'Diced chicken breast'],
        'Chicken breast',
        'Prep it.',
        'bad-match',
      ),
    /same food stem/i,
  );
});

test('one-off coverage can follow the explicitly reused identity but unrelated coverage does not', () => {
  const dinner = recipe('dinner');
  const app = purchasePlanning.addIntent(state([dinner]), dinner.id, 2, 'intent-1');
  const adhocRice = purchasePlanning
    .buildList(app, null)
    .items.find((item) => item.name === 'Rice')!;
  const purchased = purchasePlanning.cover(
    app,
    adhocRice,
    { kind: 'bought', quantity: 100 },
    'purchase-1',
  );
  const linkedWeek = week([
    {
      id: 'linked-choice',
      recipeId: dinner.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: null,
      reuseReady: false,
      shoppingIntentId: 'intent-1',
      explanations: [],
      timingFit: 'unknown',
    },
  ]);
  const carried = purchasePlanning
    .buildList(purchased, linkedWeek)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(carried.covered, true);
  assert.equal(carried.coverage!.boughtQuantity, 100);
  const unlinkedWeek = week([
    { ...linkedWeek.choices[0], id: 'new-choice', shoppingIntentId: null },
  ]);
  const unrelated = purchasePlanning
    .buildList(purchased, unlinkedWeek)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(
    unrelated.covered,
    false,
    'older ad-hoc coverage cannot silently cover a new unlinked week',
  );
});

test('a completed linked batch preserves the required history and actual purchase record, but does not ask to buy its raw ingredients again', () => {
  const dinner = recipe('snapshot-dinner');
  dinner.ingredients[0] = { ...dinner.ingredients[0], quantity: 200, quantityText: '200 g' };
  const draft = week([
    {
      id: 'cooked-choice',
      recipeId: dinner.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: null,
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
  ]);
  const app = state([dinner]);
  const before = purchasePlanning.buildList(app, draft).items.find((item) => item.name === 'Rice')!;
  const bought = purchasePlanning.cover(
    app,
    before,
    { kind: 'bought', quantity: 40 },
    'purchase-before-cook',
  );
  bought.experience!.sessions = [
    {
      id: 'made-session',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      sourceServings: 2,
      stepIndex: 0,
      checkedIngredientIds: [],
      timers: [],
      startedAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
      finishedAt: null,
      weekId: 'week-1',
      choiceId: null,
    },
  ];
  bought.experience!.batches = [
    {
      id: 'made',
      sessionId: 'made-session',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      preparedSourceServings: 2,
      actualYield: 2,
      yieldUnit: 'portion',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-26T00:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: 'week-1',
      choiceId: null,
    },
  ];
  const linkedDraft = { ...draft, choices: [{ ...draft.choices[0], readyBatchId: 'made' }] };
  const stillCooking = purchasePlanning
    .buildList(bought, linkedDraft)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(
    stillCooking.remainingQuantity,
    160,
    'an unfinished session does not complete procurement',
  );
  assert.equal(stillCooking.covered, false);

  bought.experience!.sessions[0].finishedAt = '2026-10-26T01:00:00.000Z';
  const after = purchasePlanning
    .buildList(bought, linkedDraft)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(
    after.quantity,
    before.quantity,
    'the original required amount remains visible in history',
  );
  assert.deepEqual(
    after.contributions,
    before.contributions,
    'recipe contribution evidence is retained',
  );
  assert.equal(
    after.coverage!.boughtQuantity,
    40,
    'actual purchase evidence is retained without fabrication',
  );
  assert.equal(bought.experience!.purchases.length, 1);
  assert.equal(after.remainingQuantity, 0);
  assert.equal(after.covered, true);
  assert.match(after.remainingText, /no purchase needed now.*already prepared/i);
  const first = purchasePlanning.addIntent(bought, dinner.id, 2, 'intent-a');
  const duplicateTap = purchasePlanning.addIntent(first, dinner.id, 2, 'intent-b');
  assert.equal(duplicateTap.experience!.oneOffs.length, 1);
  assert.equal(duplicateTap.experience!.oneOffs[0].id, 'intent-a');
});

test('a finished session fulfills its original production dose after part of its retained batch is discarded', () => {
  const dinner = recipe('discarded-batch-dinner');
  const draft = week([
    {
      id: 'discarded-choice',
      recipeId: dinner.id,
      sourceServings: 4,
      portions: 4,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: 'discarded-batch',
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
  ]);
  const app = state([dinner]);
  app.experience!.sessions = [
    {
      id: 'discarded-session',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      sourceServings: 4,
      stepIndex: 0,
      checkedIngredientIds: [],
      timers: [],
      startedAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
      finishedAt: '2026-10-26T01:00:00.000Z',
      weekId: 'week-1',
      choiceId: null,
    },
  ];
  app.experience!.batches = [
    {
      id: 'discarded-batch',
      sessionId: 'discarded-session',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      preparedSourceServings: 3,
      actualYield: 3,
      yieldUnit: 'portion',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-26T01:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: 'week-1',
      choiceId: null,
    },
  ];
  const fulfilled = purchasePlanning
    .buildList(app, draft)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(fulfilled.quantity, 200, 'the full four-serving requirement remains in history');
  assert.equal(fulfilled.contributions[0].quantity, 200);
  assert.equal(
    fulfilled.remainingQuantity,
    0,
    'discarding one retained serving does not reopen procurement',
  );
  assert.match(fulfilled.remainingText, /200 g already prepared; 200 g retained in history/i);

  const withFreshIntent = purchasePlanning.addIntent(app, dinner.id, 4, 'fresh-after-discard');
  const fresh = purchasePlanning
    .buildList(withFreshIntent, draft)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(
    fresh.quantity,
    400,
    'the original requirement and fresh intention retain separate evidence',
  );
  assert.equal(fresh.contributions.length, 2);
  assert.equal(
    fresh.remainingQuantity,
    200,
    'the separate fresh intention still needs ingredients',
  );
});

test('shopping intent idempotence requires the same recipe ingredient snapshot, not cosmetic recipe changes', () => {
  const dinner = recipe('versioned-dinner');
  dinner.ingredients = [
    { ...dinner.ingredients[0], sourceText: '100 g rice' },
    {
      id: 'versioned-dinner:oil',
      name: 'Olive oil',
      quantity: 10,
      unit: 'ml',
      quantityText: '10 ml',
      sourceText: '10 ml olive oil',
      aisle: 'Pantry',
    },
  ];
  const first = purchasePlanning.addIntent(state([dinner]), dinner.id, 2, 'original-intent', 4);
  const cosmeticRecipe = {
    ...dinner,
    tags: ['quick'],
    favorite: true,
    mealPrepNotes: 'Made on Sunday.',
    ingredients: [...dinner.ingredients].reverse(),
  };
  const idempotent = purchasePlanning.addIntent(
    { ...first, recipes: [cosmeticRecipe] },
    dinner.id,
    2,
    'cosmetic-tap',
    4,
  );
  assert.equal(idempotent.experience!.oneOffs.length, 1);
  assert.equal(idempotent.experience!.oneOffs[0].id, 'original-intent');

  const revisedRecipe = {
    ...cosmeticRecipe,
    ingredients: [
      ...cosmeticRecipe.ingredients,
      {
        id: 'versioned-dinner:lemon',
        name: 'Lemon',
        quantity: 1,
        unit: null,
        quantityText: '1 lemon',
        sourceText: '1 lemon',
        aisle: 'Produce',
      },
    ],
  };
  const revised = purchasePlanning.addIntent(
    { ...idempotent, recipes: [revisedRecipe] },
    dinner.id,
    2,
    'revised-intent',
    4,
  );
  assert.equal(revised.experience!.oneOffs.length, 2);
  assert.equal(revised.experience!.oneOffs[0].recipeSnapshot.ingredients.length, 2);
  assert.equal(revised.experience!.oneOffs[1].recipeSnapshot.ingredients.length, 3);
  assert.throws(
    () =>
      purchasePlanning.addIntent(
        { ...idempotent, recipes: [revisedRecipe] },
        dinner.id,
        2,
        'original-intent',
        4,
      ),
    /already exists/i,
  );
});

test('prepared and fresh contributors share a required row while only the fresh remainder is needed now', () => {
  const prepared = recipe('prepared');
  prepared.ingredients[0] = { ...prepared.ingredients[0], quantity: 400, quantityText: '400 g' };
  const fresh = recipe('fresh');
  const app = state([prepared, fresh]);
  app.experience!.sessions = [
    {
      id: 'prepared-session',
      recipeId: prepared.id,
      recipeSnapshot: prepared,
      sourceServings: 2,
      stepIndex: 0,
      checkedIngredientIds: [],
      timers: [],
      startedAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
      finishedAt: '2026-10-26T01:00:00.000Z',
      weekId: 'week-1',
      choiceId: null,
    },
  ];
  app.experience!.batches = [
    {
      id: 'prepared-batch',
      sessionId: 'prepared-session',
      recipeId: prepared.id,
      recipeSnapshot: prepared,
      preparedSourceServings: 2,
      actualYield: 2,
      yieldUnit: 'portion',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-26T01:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: 'week-1',
      choiceId: null,
    },
  ];
  const draft = week([
    {
      id: 'prepared-choice',
      recipeId: prepared.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: 'prepared-batch',
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
    {
      id: 'fresh-choice',
      recipeId: fresh.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: null,
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
  ]);
  const initial = purchasePlanning
    .buildList(app, draft)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(initial.quantity, 500);
  const with300Bought = purchasePlanning.cover(
    app,
    initial,
    { kind: 'bought', quantity: 300 },
    'purchase-300',
  );
  const after300 = purchasePlanning
    .buildList(with300Bought, draft)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(after300.coverage!.boughtQuantity, 300);
  assert.equal(
    after300.coverage!.ownedQuantity,
    null,
    'preparation does not fabricate owned coverage',
  );
  assert.equal(after300.remainingQuantity, 100);
  assert.match(after300.remainingText, /100 g needed now.*400 g already prepared/i);

  const with450Bought = purchasePlanning.cover(
    app,
    initial,
    { kind: 'bought', quantity: 450 },
    'purchase-450',
  );
  const after450 = purchasePlanning
    .buildList(with450Bought, draft)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(after450.remainingQuantity, 50);
  assert.match(after450.remainingText, /50 g needed now.*400 g already prepared/i);
});

test('unknown amounts are covered only when every contributor was prepared', () => {
  const prepared = recipe('unknown-prepared');
  const pending = recipe('unknown-pending');
  prepared.ingredients[0] = {
    ...prepared.ingredients[0],
    quantity: null,
    quantityText: 'to taste',
  };
  pending.ingredients[0] = { ...pending.ingredients[0], quantity: null, quantityText: 'to taste' };
  const app = state([prepared, pending]);
  app.experience!.sessions = [
    {
      id: 'unknown-session',
      recipeId: prepared.id,
      recipeSnapshot: prepared,
      sourceServings: 2,
      stepIndex: 0,
      checkedIngredientIds: [],
      timers: [],
      startedAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
      finishedAt: '2026-10-26T01:00:00.000Z',
      weekId: 'week-1',
      choiceId: null,
    },
  ];
  app.experience!.batches = [
    {
      id: 'unknown-batch',
      sessionId: 'unknown-session',
      recipeId: prepared.id,
      recipeSnapshot: prepared,
      preparedSourceServings: 2,
      actualYield: 2,
      yieldUnit: 'portion',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-26T01:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: 'week-1',
      choiceId: null,
    },
  ];
  const allPrepared = week([
    {
      id: 'unknown-prepared-choice',
      recipeId: prepared.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: 'unknown-batch',
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
  ]);
  const covered = purchasePlanning
    .buildList(app, allPrepared)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(covered.remainingQuantity, null);
  assert.equal(covered.coverage, null, 'preparation does not synthesize a coverage record');
  assert.equal(covered.covered, true);
  assert.match(covered.remainingText, /no purchase needed now/i);

  const mixed: BatchWeek = {
    ...allPrepared,
    choices: [
      ...allPrepared.choices,
      {
        id: 'unknown-pending-choice',
        recipeId: pending.id,
        sourceServings: 2,
        portions: 2,
        sourceUnitsPerPortion: 1,
        windowId: null,
        locked: false,
        readyBatchId: null,
        reuseReady: false,
        shoppingIntentId: null,
        explanations: [],
        timingFit: 'unknown' as const,
      },
    ],
  };
  const review = purchasePlanning.buildList(app, mixed).items.find((item) => item.name === 'Rice')!;
  assert.equal(review.remainingQuantity, null);
  assert.equal(review.covered, false);
  assert.equal(review.needsReview, true);
  assert.match(review.remainingText, /review.*needed now/i);
});

test('a new shopping intent is not covered by an older matching prepared batch', () => {
  const dinner = recipe('old-batch-dinner');
  const app = purchasePlanning.addIntent(state([dinner]), dinner.id, 2, 'new-intent');
  app.experience!.sessions = [
    {
      id: 'old-session',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      sourceServings: 2,
      stepIndex: 0,
      checkedIngredientIds: [],
      timers: [],
      startedAt: '2026-10-25T00:00:00.000Z',
      updatedAt: '2026-10-25T00:00:00.000Z',
      finishedAt: '2026-10-25T01:00:00.000Z',
      weekId: null,
      choiceId: null,
    },
  ];
  app.experience!.batches = [
    {
      id: 'old-batch',
      sessionId: 'old-session',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      preparedSourceServings: 2,
      actualYield: 2,
      yieldUnit: 'portion',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-25T01:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: null,
      choiceId: null,
    },
  ];
  const row = purchasePlanning.buildList(app, null).items.find((item) => item.name === 'Rice')!;
  assert.equal(row.quantity, 100);
  assert.equal(row.remainingQuantity, 100);
  assert.equal(row.covered, false);
});

test('one-off carryover requires the same canonical item and carries only the paid proportion of a mixed old requirement', () => {
  const dinner = recipe('dinner');
  const app = purchasePlanning.addIntent(state([dinner]), dinner.id, 2, 'intent-1');
  const old = {
    ...week([
      {
        id: 'old-linked',
        recipeId: dinner.id,
        sourceServings: 2,
        portions: 2,
        sourceUnitsPerPortion: 1,
        windowId: null,
        locked: false,
        readyBatchId: null,
        reuseReady: false,
        shoppingIntentId: 'intent-1',
        explanations: [],
        timingFit: 'unknown',
      },
      {
        id: 'old-ordinary',
        recipeId: dinner.id,
        sourceServings: 2,
        portions: 2,
        sourceUnitsPerPortion: 1,
        windowId: null,
        locked: false,
        readyBatchId: null,
        reuseReady: false,
        shoppingIntentId: null,
        explanations: [],
        timingFit: 'unknown',
      },
    ]),
    id: 'old-week',
  };
  app.experience!.weeks = [old];
  app.experience!.groceryCoverage['old-week:shopping:rice:g'] = {
    ownedQuantity: null,
    boughtQuantity: 100,
    ownedUnspecified: false,
    boughtUnspecified: false,
    requiredAtCheck: 200,
    intentionIds: ['intent-1', 'old-ordinary'],
    scopeId: 'old-week',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };
  app.experience!.groceryCoverage['adhoc:shopping:garlic:g'] = {
    ownedQuantity: null,
    boughtQuantity: 100,
    ownedUnspecified: false,
    boughtUnspecified: false,
    requiredAtCheck: 100,
    intentionIds: ['intent-1'],
    scopeId: 'adhoc',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };
  const newWeek = {
    ...week([
      {
        id: 'new-linked',
        recipeId: dinner.id,
        sourceServings: 2,
        portions: 2,
        sourceUnitsPerPortion: 1,
        windowId: null,
        locked: false,
        readyBatchId: null,
        reuseReady: false,
        shoppingIntentId: 'intent-1',
        explanations: [],
        timingFit: 'unknown',
      },
    ]),
    id: 'new-week',
  };
  const carried = purchasePlanning
    .buildList(app, newWeek)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(
    carried.remainingQuantity,
    50,
    'only the one-off half of a mixed prior purchase may follow it',
  );
  assert.equal(carried.coverage!.boughtQuantity, 50);
});

test('legacy checks become exact known coverage and clear removes the legacy mapping instead of resurrecting it', () => {
  const dinner = recipe('legacy-dinner');
  const app = state([dinner]);
  app.shoppingChecks['legacy-plan:shopping:rice:g'] = 'checked';
  const legacyWeek = {
    ...week([
      {
        id: 'legacy-choice',
        recipeId: dinner.id,
        sourceServings: 2,
        portions: 2,
        sourceUnitsPerPortion: 1,
        windowId: null,
        locked: false,
        readyBatchId: null,
        reuseReady: false,
        shoppingIntentId: null,
        explanations: [],
        timingFit: 'unknown',
      },
    ]),
    legacyPlanId: 'legacy-plan',
  };
  app.experience!.weeks = [legacyWeek];
  const initial = purchasePlanning
    .buildList(app, legacyWeek)
    .items.find((item) => item.name === 'Rice')!;
  assert.equal(initial.covered, true);
  assert.equal(initial.coverage!.boughtQuantity, 100);
  assert.equal(initial.coverage!.boughtUnspecified, false);
  assert.match(initial.coverage!.updatedAt, /T.*Z$/);
  const cleared = purchasePlanning.cover(app, initial, { kind: 'clear' }, 'unused');
  assert.equal(cleared.shoppingChecks['legacy-plan:shopping:rice:g'], null);
  assert.equal(
    purchasePlanning.buildList(cleared, legacyWeek).items.find((item) => item.name === 'Rice')!
      .covered,
    false,
  );
});

test('approved matches use proven unit conversions and reconcile coverage from every original key', () => {
  const whole = recipe('whole', 'Whole chicken breast', 'tbsp');
  const diced = recipe('diced', 'Diced chicken breast', 'tsp');
  const app = state([whole, diced]);
  const draft = week([
    {
      id: 'whole-choice',
      recipeId: whole.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: null,
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
    {
      id: 'diced-choice',
      recipeId: diced.id,
      sourceServings: 2,
      portions: 2,
      sourceUnitsPerPortion: 1,
      windowId: null,
      locked: false,
      readyBatchId: null,
      reuseReady: false,
      shoppingIntentId: null,
      explanations: [],
      timingFit: 'unknown',
    },
  ]);
  const before = purchasePlanning.buildList(app, draft);
  const withWhole = purchasePlanning.cover(
    app,
    before.items.find((item) => item.name === 'Whole chicken breast')!,
    { kind: 'bought', quantity: 300 },
    'whole-purchase',
  );
  const withBoth = purchasePlanning.cover(
    withWhole,
    purchasePlanning
      .buildList(withWhole, draft)
      .items.find((item) => item.name === 'Diced chicken breast')!,
    { kind: 'bought', quantity: 100 },
    'diced-purchase',
  );
  const matched = purchasePlanning.approveMatch(
    withBoth,
    ['Whole chicken breast', 'Diced chicken breast'],
    'Chicken breast',
    'Buy whole and dice it.',
    'match-spoons',
  );
  const row = purchasePlanning
    .buildList(matched, draft)
    .items.find((item) => item.name === 'Chicken breast')!;
  assert.equal(
    row.quantity,
    400,
    'one tablespoon is converted to three teaspoons before aggregation',
  );
  assert.equal(row.unit, 'tsp');
  assert.equal(
    row.remainingQuantity,
    0,
    'coverage from both previously separate ingredients remains attached',
  );
  const recleared = purchasePlanning.cover(matched, row, { kind: 'owned' }, 'unused');
  assert.equal(
    purchasePlanning
      .buildList(recleared, draft)
      .items.find((item) => item.name === 'Chicken breast')!.coverage!.ownedUnspecified,
    false,
  );
});

test('manual rows reflect their checked state when present in the purchase-list model', () => {
  const dinner = recipe('manual-dinner');
  const app = state([dinner]);
  app.experience!.manualItems = [
    { id: 'manual-1', name: 'Napkins', quantityText: '1 pack', checked: true },
  ];
  const manual = purchasePlanning
    .buildList(app, null)
    .items.find((item) => item.name === 'Napkins')!;
  assert.equal(manual.covered, true);
  assert.equal(manual.remainingText, 'Covered');
});
