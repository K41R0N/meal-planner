import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRecipes, validateState } from '../packages/meal-domain/src/validation';
import { experienceEngine as food } from '../packages/meal-domain/src/experience';
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

// Issue #31 / plan 2026-10-31-0900 U2: commands keep the records and snapshots the UI made.

const DATE = '2026-10-26';
const KNOWN = 'youtube:icQDSc0Zj4c'; // per-serving nutrition, 4 servings
const UNKNOWN = 'youtube:vAJkxs0_lzw'; // calories unknown, 4 servings

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
const send = <C extends ApplicationCommand>(snapshot: ApplicationSnapshot, command: C) =>
  executeCommand(snapshot, {
    operationId: `op-${(counter += 1)}`,
    command,
    context: { date: DATE },
  });

const cookAndFinish = (recipeId: string, elapsedMinutes?: number) => {
  let snapshot = createSnapshot(seeded());
  const started = send(snapshot, {
    type: 'cook.start',
    sessionId: 'cook-1',
    recipeId,
    sourceServings: 4,
  });
  snapshot = started.snapshot;
  const finished = send(snapshot, {
    type: 'cook.finish',
    sessionId: 'cook-1',
    batchId: 'batch-1',
    actualYield: 4,
    yieldUnit: 'box',
    storage: 'fridge',
    storageNotes: '',
    reheatNotes: '',
    elapsedMinutes,
    rememberTiming: elapsedMinutes !== undefined,
  });
  return { started, finished, snapshot: finished.snapshot };
};

test('a scripted day keeps snapshots, learned time, stock and Undo', () => {
  const { started, finished, snapshot } = cookAndFinish(KNOWN, 55);
  assert.deepEqual(started.outcome.result, { sessionId: 'cook-1', resumed: false });
  assert.deepEqual(finished.outcome.result, { batchId: 'batch-1', alreadyFinished: false });

  const state = snapshot.state;
  const book = state.recipes.find((recipe) => recipe.id === KNOWN)!;
  const batch = state.experience!.batches.find((item) => item.id === 'batch-1')!;
  assert.deepEqual(batch.recipeSnapshot, book, 'the batch keeps the recipe as cooked');
  assert.equal(batch.preparedSourceServings, 4);
  assert.equal(food.availableUnits(state, 'batch-1'), 4);
  const profile = state.experience!.recipeProfiles[KNOWN];
  assert.equal(profile.elapsedMinutes, 55);
  assert.equal(profile.timingSourceServings, 4);
  assert.equal(food.today(state, DATE, 'dinner').choice?.batchId, 'batch-1');

  const again = send(snapshot, {
    type: 'cook.finish',
    sessionId: 'cook-1',
    batchId: 'batch-2',
    actualYield: 9,
    yieldUnit: 'box',
    storage: 'fridge',
    storageNotes: '',
    reheatNotes: '',
  });
  assert.deepEqual(again.outcome.result, { batchId: 'batch-1', alreadyFinished: true });
  assert.equal(
    again.snapshot.state.experience!.batches.length,
    1,
    'a finished cook stays finished',
  );

  const eaten = send(snapshot, {
    type: 'food.consume',
    logId: 'log-1',
    batchId: 'batch-1',
    units: 1,
    date: DATE,
  });
  const log = eaten.snapshot.state.logs.find((entry) => entry.id === 'log-1')!;
  assert.equal(log.batchId, 'batch-1');
  assert.ok(log.nutritionSnapshot.calories !== null);
  assert.equal(food.availableUnits(eaten.snapshot.state, 'batch-1'), 3);
  assert.equal(food.today(eaten.snapshot.state, DATE, 'dinner').choice?.logId, 'log-1');

  const undone = send(eaten.snapshot, { type: 'food.undo', logId: 'log-1' });
  assert.deepEqual(undone.outcome.result, { logId: 'log-1', linkedToBatch: true });
  assert.equal(undone.snapshot.state.logs.length, 0);
  assert.equal(food.availableUnits(undone.snapshot.state, 'batch-1'), 4);

  // The record still restores from a version-one style backup.
  const restored = validateState(JSON.parse(JSON.stringify(undone.snapshot.state)));
  assert.equal(restored.experience!.batches[0].id, 'batch-1');
});

test('unknown calories stay unknown through cooking and eating', () => {
  const { snapshot } = cookAndFinish(UNKNOWN);
  const batch = snapshot.state.experience!.batches[0];
  assert.equal(batch.recipeSnapshot.nutrition.calories, null);
  const eaten = send(snapshot, {
    type: 'food.consume',
    logId: 'log-u',
    batchId: batch.id,
    units: 1,
    date: DATE,
  });
  assert.equal(eaten.snapshot.state.logs[0].nutritionSnapshot.calories, null);
});

test('editing ingredients resets nutrition for review and leaves cooked snapshots alone', () => {
  const { snapshot } = cookAndFinish(KNOWN);
  const book = snapshot.state.recipes.find((recipe) => recipe.id === KNOWN)!;
  const edited = {
    ...book,
    ingredients: book.ingredients.map((item, index) =>
      index === 0 ? { ...item, quantity: (item.quantity ?? 1) * 2 } : item,
    ),
  };
  const updated = send(snapshot, { type: 'recipe.update', recipe: edited });
  assert.deepEqual(updated.outcome.result, { nutritionReset: true });
  const after = updated.snapshot.state.recipes.find((recipe) => recipe.id === KNOWN)!;
  assert.equal(after.nutrition.calories, null);
  assert.equal(after.nutritionBasis, 'unspecified');
  assert.ok(after.dataGaps.includes('Ingredients changed; nutrition needs your review.'));
  assert.deepEqual(
    updated.snapshot.state.experience!.batches[0].recipeSnapshot,
    book,
    'ready food keeps the recipe it was cooked from',
  );
});

test('changing only the yield rescales per-serving nutrition', () => {
  const snapshot = createSnapshot(seeded());
  const book = snapshot.state.recipes.find((recipe) => recipe.id === KNOWN)!;
  assert.equal(book.baseServings, 4);
  const updated = send(snapshot, { type: 'recipe.update', recipe: { ...book, baseServings: 8 } });
  assert.deepEqual(updated.outcome.result, { nutritionReset: false });
  const after = updated.snapshot.state.recipes.find((recipe) => recipe.id === KNOWN)!;
  assert.equal(after.nutrition.calories, (book.nutrition.calories as number) / 2);
});

const request: BatchPlanRequest = {
  weekStart: '2026-11-02',
  days: 7,
  people: 1,
  slots: ['dinner'],
  distinctRecipes: 1,
  targetPortions: 4,
  windows: [{ id: 'sunday', date: '2026-11-02', startTime: '17:00', availableMinutes: 120 }],
  filters: defaultFilters(),
  strictTiming: false,
  reuseReady: false,
  reuseOneOffs: false,
};

test('a week can be proposed, confirmed and shopped through commands', () => {
  let snapshot = createSnapshot(seeded());
  const proposed = send(snapshot, { type: 'week.propose', weekId: 'week-1', request });
  assert.deepEqual(proposed.outcome.result, { weekId: 'week-1' });
  snapshot = send(proposed.snapshot, { type: 'week.confirm' }).snapshot;
  const week = activeWeek(snapshot.state)!;
  assert.equal(week.confirmed, true);
  assert.deepEqual(snapshot.state.experience!.lastPlanRequest, request);

  const choice = week.choices[0];
  const shopped = send(snapshot, {
    type: 'shop.addRecipe',
    intentId: 'intent-1',
    recipeId: choice.recipeId,
    sourceServings: choice.sourceServings,
  });
  assert.deepEqual(shopped.outcome.result, { alreadyInWeek: true });
  assert.equal(
    shopped.snapshot.state.experience!.oneOffs.length,
    snapshot.state.experience!.oneOffs.length,
    'a batch already in the week adds no shopping intent',
  );

  const other = snapshot.state.recipes.find((recipe) => recipe.id !== choice.recipeId)!;
  const extra = send(snapshot, {
    type: 'shop.addRecipe',
    intentId: 'intent-2',
    recipeId: other.id,
    sourceServings: other.baseServings ?? 1,
  });
  assert.deepEqual(extra.outcome.result, { alreadyInWeek: false });
  assert.ok(extra.snapshot.state.experience!.oneOffs.some((intent) => intent.id === 'intent-2'));
});

test('manual shopping items and logs use the IDs the caller supplies', () => {
  let snapshot = createSnapshot(seeded());
  snapshot = send(snapshot, {
    type: 'shop.addManual',
    itemId: 'manual-1',
    name: '  Oat milk ',
    quantityText: ' 1 carton ',
  }).snapshot;
  assert.deepEqual(snapshot.state.experience!.manualItems.at(-1), {
    id: 'manual-1',
    name: 'Oat milk',
    quantityText: '1 carton',
    checked: false,
  });
  snapshot = send(snapshot, { type: 'shop.toggleManual', itemId: 'manual-1' }).snapshot;
  assert.equal(snapshot.state.experience!.manualItems.at(-1)!.checked, true);
  snapshot = send(snapshot, { type: 'shop.removeManual', itemId: 'manual-1' }).snapshot;
  assert.equal(
    snapshot.state.experience!.manualItems.some((item) => item.id === 'manual-1'),
    false,
  );

  const logged = send(snapshot, {
    type: 'log.addRecipe',
    logId: 'log-r',
    recipeId: KNOWN,
    servings: 1,
    date: DATE,
  });
  assert.deepEqual(logged.outcome.result, { logId: 'log-r' });
  const entry = logged.snapshot.state.logs[0];
  assert.equal(entry.id, 'log-r');
  const duplicate = send(logged.snapshot, { type: 'log.addManual', entry });
  assert.deepEqual(duplicate.outcome.result, { logId: 'log-r', duplicate: true });
  assert.equal(duplicate.snapshot.state.logs.length, 1);
});
