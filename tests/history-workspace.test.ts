import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyNutrition, type ConsumptionEntry } from '../packages/meal-domain/src/types.ts';
import {
  dailyMacroTotals,
  parseOptionalDecimal,
  remainingBatchUnits,
} from '../apps/web/src/experience/HistoryWorkspace.tsx';

const log = (
  id: string,
  nutritionSnapshot: ConsumptionEntry['nutritionSnapshot'],
  batchId?: string,
  batchUnits?: number,
): ConsumptionEntry => ({
  id,
  date: '2026-10-26',
  recipeId: 'recipe-1',
  name: 'Saved recipe',
  servings: 1,
  nutritionSnapshot,
  createdAt: '2026-10-26T12:00:00.000Z',
  ...(batchId ? { batchId, batchUnits } : {}),
});

test('daily macro totals retain known subtotals while marking each incomplete field honestly', () => {
  const first = { ...emptyNutrition(), calories: 400, protein: 30, carbs: 42, sodium: 0 };
  const second = { ...emptyNutrition(), calories: 200, carbs: 15 };
  const totals = new Map(
    dailyMacroTotals([log('one', first), log('two', second)]).map((total) => [total.key, total]),
  );

  assert.deepEqual(totals.get('calories'), {
    key: 'calories',
    value: 600,
    known: 2,
    count: 2,
    complete: true,
  });
  assert.deepEqual(totals.get('protein'), {
    key: 'protein',
    value: 30,
    known: 1,
    count: 2,
    complete: false,
  });
  assert.deepEqual(
    totals.get('sodium'),
    { key: 'sodium', value: 0, known: 1, count: 2, complete: false },
    'a known zero remains known rather than becoming an unknown zero',
  );
  assert.deepEqual(totals.get('fiber'), {
    key: 'fiber',
    value: 0,
    known: 0,
    count: 2,
    complete: false,
  });
});

test('optional decimal parsing accepts a comma only when saving and rejects a negative value', () => {
  assert.equal(parseOptionalDecimal('', 'Calories'), null);
  assert.equal(parseOptionalDecimal(' 2,5 ', 'Calories'), 2.5);
  assert.equal(parseOptionalDecimal('2.5', 'Calories'), 2.5);
  assert.throws(() => parseOptionalDecimal('-1', 'Calories'), /zero or more/);
});

test('only batch-linked log units change a prepared batch remaining amount', () => {
  const nutrition = emptyNutrition();
  const logs = [log('batch-log', nutrition, 'batch-1', 1.5), log('ordinary-recipe-log', nutrition)];

  assert.equal(remainingBatchUnits({ id: 'batch-1', actualYield: 4 }, logs), 2.5);
});
