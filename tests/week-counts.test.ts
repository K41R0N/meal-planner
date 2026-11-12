import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRecipes } from '../packages/meal-domain/src/validation';
import { experienceEngine as food } from '../packages/meal-domain/src/experience';
import { purchasePlanning as purchases } from '../packages/meal-domain/src/purchase-list';
import { defaultFilters, emptyNutrition, type AppState } from '../packages/meal-domain/src/types';
import type { BatchPlanRequest } from '../packages/meal-domain/src/experience-types';
import type {
  ApplicationCommand,
  ApplicationSnapshot,
} from '../packages/meal-domain/src/application-contracts';
import {
  activeWeek,
  createSnapshot,
  executeCommand,
} from '../packages/meal-domain/src/application-commands';
import {
  USEFUL_WEEK_COUNT_FIELDS,
  WEEK_ACTIVITY_FIELDS,
  countUsefulWeeks,
  weekCountsText,
} from '../packages/meal-domain/src/week-counts';

// Issue #47: useful and repeat weeks counted on the device, with counts and dates only.

const DATE = '2026-10-26';

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
    DATE,
    'dinner',
  );

let counter = 0;
const send = (snapshot: ApplicationSnapshot, command: ApplicationCommand) =>
  executeCommand(snapshot, {
    operationId: `op-${(counter += 1)}`,
    command,
    context: { date: DATE },
  }).snapshot;

const request = (weekStart: string): BatchPlanRequest => ({
  weekStart,
  days: 7,
  people: 1,
  slots: ['dinner'],
  distinctRecipes: 1,
  targetPortions: 4,
  windows: [
    { id: `window-${weekStart}`, date: weekStart, startTime: '17:00', availableMinutes: 120 },
  ],
  filters: defaultFilters(),
  strictTiming: false,
  reuseReady: false,
  reuseOneOffs: false,
});

/** Plans and confirms a week; optionally covers one grocery line and cooks its first batch. */
const planWeek = (
  start: ApplicationSnapshot,
  weekId: string,
  weekStart: string,
  steps: { shop?: boolean; cook?: boolean; confirm?: boolean } = {},
): ApplicationSnapshot => {
  let snapshot = send(start, { type: 'week.propose', weekId, request: request(weekStart) });
  if (steps.confirm !== false) snapshot = send(snapshot, { type: 'week.confirm' });
  const week = activeWeek(snapshot.state)!;
  if (steps.shop) {
    const line = purchases.buildList(snapshot.state, week).items[0];
    snapshot = send(snapshot, {
      type: 'shop.cover',
      purchaseId: `purchase-${weekId}`,
      itemKey: line.key,
      kind: 'bought',
    });
  }
  if (steps.cook) {
    const choice = week.choices[0];
    const recipe = snapshot.state.recipes.find((item) => item.id === choice.recipeId)!;
    snapshot = send(snapshot, {
      type: 'cook.start',
      sessionId: `cook-${weekId}`,
      recipeId: choice.recipeId,
      sourceServings: choice.sourceServings,
      // As in the UI: a recipe without a recorded yield needs one before it can be cooked.
      ...(recipe.baseServings === null ? { sourceYield: choice.sourceServings } : {}),
      weekId: week.id,
      choiceId: choice.id,
    });
    snapshot = send(snapshot, {
      type: 'cook.finish',
      sessionId: `cook-${weekId}`,
      batchId: `batch-${weekId}`,
      actualYield: 4,
      yieldUnit: 'box',
      storage: 'fridge',
      storageNotes: 'private note',
      reheatNotes: '',
    });
  }
  return snapshot;
};

test('an empty book has no weeks and no useful week', () => {
  assert.deepEqual(countUsefulWeeks(seeded()), {
    weeks: [],
    usefulWeeks: 0,
    firstUsefulWeek: null,
    secondUsefulWeek: null,
    cooksOutsideWeeks: 0,
  });
});

test('a week planned but never cooked is not useful; an unconfirmed draft says so', () => {
  let snapshot = planWeek(createSnapshot(seeded()), 'week-a', '2026-11-02', { shop: true });
  snapshot = planWeek(snapshot, 'week-b', '2026-11-09', { confirm: false });
  const counts = countUsefulWeeks(snapshot.state);
  assert.deepEqual(
    counts.weeks.map((week) => ({ ...week })),
    [
      {
        weekStart: '2026-11-02',
        planConfirmed: true,
        shoppingLines: 1,
        cooksFinished: 0,
        useful: false,
      },
      {
        weekStart: '2026-11-09',
        planConfirmed: false,
        shoppingLines: 0,
        cooksFinished: 0,
        useful: false,
      },
    ],
  );
  assert.equal(counts.usefulWeeks, 0);
});

test('a cook without a plan counts outside weeks and makes no week useful', () => {
  let snapshot = createSnapshot(seeded());
  const recipe = snapshot.state.recipes[0];
  snapshot = send(snapshot, {
    type: 'cook.start',
    sessionId: 'cook-loose',
    recipeId: recipe.id,
    sourceServings: recipe.baseServings ?? 1,
  });
  snapshot = send(snapshot, {
    type: 'cook.finish',
    sessionId: 'cook-loose',
    batchId: 'batch-loose',
    actualYield: 2,
    yieldUnit: 'box',
    storage: 'fridge',
    storageNotes: '',
    reheatNotes: '',
  });
  const counts = countUsefulWeeks(snapshot.state);
  assert.deepEqual(counts.weeks, []);
  assert.equal(counts.cooksOutsideWeeks, 1);
  assert.equal(counts.firstUsefulWeek, null);
});

test('two useful weeks give the first and the repeat week', () => {
  let snapshot = planWeek(createSnapshot(seeded()), 'week-1', '2026-11-02', {
    shop: true,
    cook: true,
  });
  snapshot = planWeek(snapshot, 'week-2', '2026-11-09', { shop: true, cook: true });
  const counts = countUsefulWeeks(snapshot.state);
  assert.equal(counts.usefulWeeks, 2);
  assert.equal(counts.firstUsefulWeek, '2026-11-02');
  assert.equal(counts.secondUsefulWeek, '2026-11-09');
  assert.deepEqual(
    counts.weeks.map((week) => [week.shoppingLines, week.cooksFinished, week.useful]),
    [
      [1, 1, true],
      [1, 1, true],
    ],
  );
  assert.equal(counts.cooksOutsideWeeks, 0);
});

test('the counts expose only reviewed fields and no food content', () => {
  let snapshot = planWeek(createSnapshot(seeded()), 'week-1', '2026-11-02', {
    shop: true,
    cook: true,
  });
  snapshot = planWeek(snapshot, 'week-2', '2026-11-09');
  const counts = countUsefulWeeks(snapshot.state);
  assert.deepEqual(Object.keys(counts).sort(), [...USEFUL_WEEK_COUNT_FIELDS].sort());
  for (const week of counts.weeks)
    assert.deepEqual(Object.keys(week).sort(), [...WEEK_ACTIVITY_FIELDS].sort());

  // Nothing a person typed or ate can appear: names, notes, ids of recipes or purchases.
  const text = JSON.stringify(counts);
  for (const recipe of snapshot.state.recipes) {
    assert.equal(text.includes(recipe.name), false, `recipe name leaked: ${recipe.name}`);
    assert.equal(text.includes(recipe.id), false, `recipe id leaked: ${recipe.id}`);
  }
  for (const purchase of snapshot.state.experience!.purchases)
    assert.equal(text.includes(purchase.name), false, 'purchase name leaked');
  assert.equal(text.includes('private note'), false);
  assert.equal(text.includes('week-1'), false, 'internal week ids stay out');
});

test('the weekly-log text carries counts and dates, newest week first', () => {
  let snapshot = planWeek(createSnapshot(seeded()), 'week-1', '2026-11-02', {
    shop: true,
    cook: true,
  });
  snapshot = planWeek(snapshot, 'week-2', '2026-11-09', { shop: true });
  const text = weekCountsText(countUsefulWeeks(snapshot.state));
  assert.equal(
    text,
    [
      'Mealbook weeks (counts only)',
      'Useful weeks: 1 (first 2026-11-02)',
      'Cooks outside planned weeks: 0',
      '2026-11-09: plan confirmed, 1 shopping item, 0 cooks',
      '2026-11-02: plan confirmed, 1 shopping item, 1 cook, useful',
    ].join('\n'),
  );
});
