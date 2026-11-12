import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRecipes } from '../packages/meal-domain/src/validation';
import { experienceEngine as food } from '../packages/meal-domain/src/experience';
import { emptyNutrition, type AppState } from '../packages/meal-domain/src/types';
import {
  ApplicationError,
  type ApplicationCommand,
  type ApplicationSnapshot,
} from '../packages/meal-domain/src/application-contracts';
import {
  LEDGER_LIMIT,
  createSnapshot,
  executeCommand,
  fingerprint,
} from '../packages/meal-domain/src/application-commands';
import {
  MealbookApplication,
  createInMemoryRepository,
} from '../packages/meal-domain/src/application-service';

// Issue #31 / plan 2026-10-31-0900 U1 and U4: replay, key reuse, conflicts and serialized writes.

const DATE = '2026-10-26';
const RECIPE_ID = 'youtube:icQDSc0Zj4c';

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

const send = (snapshot: ApplicationSnapshot, operationId: string, command: ApplicationCommand) =>
  executeCommand(snapshot, { operationId, command, context: { date: DATE } });

const rejects = (fn: () => unknown, code: string) =>
  assert.throws(fn, (error: unknown) => error instanceof ApplicationError && error.code === code);

/** A snapshot with one finished batch of four portions. */
const withBatch = (): ApplicationSnapshot => {
  let snapshot = createSnapshot(seeded());
  snapshot = send(snapshot, 'op-start', {
    type: 'cook.start',
    sessionId: 'cook-1',
    recipeId: RECIPE_ID,
    sourceServings: 4,
  }).snapshot;
  return send(snapshot, 'op-finish', {
    type: 'cook.finish',
    sessionId: 'cook-1',
    batchId: 'batch-1',
    actualYield: 4,
    yieldUnit: 'box',
    storage: 'fridge',
    storageNotes: '',
    reheatNotes: '',
  }).snapshot;
};

const consume = (logId: string, units = 1, date = DATE): ApplicationCommand => ({
  type: 'food.consume',
  logId,
  batchId: 'batch-1',
  units,
  date,
});
// Today's meal takes one log; portions eaten on another day are not tied to it.
const YESTERDAY = '2026-10-25';

test('an identical retry returns the first result and changes nothing', () => {
  const ready = withBatch();
  const first = send(ready, 'op-eat', consume('log-1'));
  assert.equal(first.outcome.status, 'applied');
  assert.equal(food.availableUnits(first.snapshot.state, 'batch-1'), 3);

  const retry = send(first.snapshot, 'op-eat', consume('log-1'));
  assert.equal(retry.outcome.status, 'replayed');
  assert.deepEqual(retry.outcome.result, first.outcome.result);
  assert.equal(retry.outcome.revision, first.outcome.revision);
  assert.equal(retry.snapshot, first.snapshot, 'a replay returns the same snapshot');
  assert.equal(retry.snapshot.state.logs.length, 1);
  assert.equal(food.availableUnits(retry.snapshot.state, 'batch-1'), 3);
});

test('reusing an operation ID for a different change is rejected', () => {
  const first = send(withBatch(), 'op-eat', consume('log-1'));
  rejects(() => send(first.snapshot, 'op-eat', consume('log-1', 2)), 'OPERATION_KEY_REUSED');
  rejects(
    () =>
      executeCommand(first.snapshot, {
        operationId: 'op-eat',
        command: consume('log-1'),
        context: { date: '2026-10-27' },
      }),
    'OPERATION_KEY_REUSED',
  );
});

test('fingerprints ignore property order and undefined fields, and stay compact', () => {
  assert.equal(
    fingerprint({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } }),
    fingerprint({ a: { d: [1, { x: 1, y: 2 }] }, b: 1 }),
  );
  assert.notEqual(fingerprint({ units: 1 }), fingerprint({ units: 2 }));
  const large = fingerprint({ recipes: seeded().recipes });
  assert.ok(large.length < 32, 'a whole-book import is stored as a short fingerprint');
});

test('a stale base revision is a conflict and changes nothing', () => {
  const ready = withBatch();
  const prepared = ready.revision;
  const moved = send(ready, 'op-slot', { type: 'today.setSlot', slot: 'lunch' }).snapshot;
  rejects(
    () =>
      executeCommand(moved, {
        operationId: 'op-late',
        command: consume('log-late'),
        context: { date: DATE },
        baseRevision: prepared,
      }),
    'CONFLICT',
  );
  const current = executeCommand(moved, {
    operationId: 'op-current',
    command: consume('log-current'),
    context: { date: DATE },
    baseRevision: moved.revision,
  });
  assert.equal(current.outcome.revision, moved.revision + 1);
});

test('a failure after the handler (normalization) is still a coded error', () => {
  const broken = { ...createSnapshot(seeded()) };
  // Today normalization rejects a slot the record does not know; the handler itself accepts it.
  rejects(
    () =>
      send(broken, 'op-odd-slot', {
        type: 'today.setSlot',
        slot: 'midnight-snack' as unknown as 'lunch',
      }),
    'INVALID_INPUT',
  );
  assert.equal(broken.revision, 0);
});

test('a failing command leaves revision, ledger and state untouched, and is not recorded', () => {
  const ready = withBatch();
  rejects(() => send(ready, 'op-bad', consume('log-x', 99)), 'INVALID_INPUT');
  rejects(() => send(ready, 'op-missing', { type: 'week.confirm' }), 'NOT_FOUND');
  assert.equal(ready.revision, 2);
  assert.equal(ready.ledger.entries.length, 2);
  // The same ID can be used for a corrected command because the failure was not recorded.
  assert.equal(send(ready, 'op-bad', consume('log-x')).outcome.status, 'applied');
});

test('envelopes need an operation ID, a real date and a known command', () => {
  const snapshot = createSnapshot(seeded());
  rejects(
    () =>
      executeCommand(snapshot, {
        operationId: ' ',
        command: { type: 'today.next' },
        context: { date: DATE },
      }),
    'INVALID_INPUT',
  );
  rejects(
    () =>
      executeCommand(snapshot, {
        operationId: 'op',
        command: { type: 'today.next' },
        context: { date: '26/10/2026' },
      }),
    'INVALID_INPUT',
  );
  for (const date of ['2026-13-45', '2026-02-30'])
    rejects(
      () =>
        executeCommand(snapshot, {
          operationId: `op-${date}`,
          command: { type: 'today.setSlot', slot: 'lunch' },
          context: { date },
        }),
      'INVALID_INPUT',
    );
  rejects(
    () =>
      executeCommand(snapshot, {
        operationId: 'op',
        command: { type: 'book.erase' } as unknown as ApplicationCommand,
        context: { date: DATE },
      }),
    'INVALID_INPUT',
  );
  for (const type of ['constructor', 'toString', '__proto__'])
    rejects(
      () =>
        executeCommand(snapshot, {
          operationId: `op-${type}`,
          command: { type } as unknown as ApplicationCommand,
          context: { date: DATE },
        }),
      'INVALID_INPUT',
    );
});

test('the ledger keeps only the most recent operations', () => {
  let snapshot = createSnapshot(seeded());
  for (let index = 0; index < LEDGER_LIMIT + 5; index += 1)
    snapshot = send(snapshot, `op-${index}`, {
      type: 'today.setSlot',
      slot: index % 2 ? 'lunch' : 'dinner',
    }).snapshot;
  assert.equal(snapshot.ledger.entries.length, LEDGER_LIMIT);
  assert.equal(snapshot.ledger.entries[0].operationId, 'op-5');
  assert.equal(snapshot.revision, LEDGER_LIMIT + 5);
});

test('the ledger and revision never enter the saved book', () => {
  const ready = withBatch();
  assert.equal('ledger' in ready.state, false);
  assert.equal('revision' in ready.state, false);
  assert.equal(ready.state.version, 1);
});

test('service: a retried request after a lost answer records the portion once', async () => {
  const repository = createInMemoryRepository(withBatch());
  const app = new MealbookApplication(repository);
  const envelope = { operationId: 'op-eat', command: consume('log-1'), context: { date: DATE } };
  const first = await app.execute(envelope);
  const retry = await app.execute(envelope);
  assert.equal(first.status, 'applied');
  assert.equal(retry.status, 'replayed');
  assert.deepEqual(retry.result, { logId: 'log-1' });
  const stored = await app.read();
  assert.equal(stored.state.logs.length, 1);
  assert.equal(food.availableUnits(stored.state, 'batch-1'), 3);
});

test('service: two requests for the last portion cannot both take it', async () => {
  let ready = withBatch();
  ready = send(ready, 'op-eat-three', consume('log-0', 3, YESTERDAY)).snapshot;
  const app = new MealbookApplication(createInMemoryRepository(ready));
  const results = await Promise.allSettled([
    app.execute({
      operationId: 'op-a',
      command: consume('log-a', 1, YESTERDAY),
      context: { date: DATE },
    }),
    app.execute({
      operationId: 'op-b',
      command: consume('log-b', 1, YESTERDAY),
      context: { date: DATE },
    }),
  ]);
  assert.deepEqual(
    results.map((result) => result.status),
    ['fulfilled', 'rejected'],
  );
  const refused = results[1] as PromiseRejectedResult;
  assert.ok(refused.reason instanceof ApplicationError);
  assert.match(refused.reason.message, /portion|available|left/i);
  const stored = await app.read();
  assert.equal(food.availableUnits(stored.state, 'batch-1'), 0);
  assert.equal(stored.state.logs.filter((entry) => entry.batchId === 'batch-1').length, 2);
});

test('service: a write from another writer surfaces as a conflict', async () => {
  const repository = createInMemoryRepository(withBatch());
  const original = repository.read.bind(repository);
  let stale = true;
  repository.read = async () => {
    const snapshot = await original();
    if (!stale) return snapshot;
    stale = false;
    return { ...snapshot, revision: snapshot.revision - 1 };
  };
  const app = new MealbookApplication(repository);
  await assert.rejects(
    app.execute({ operationId: 'op-a', command: consume('log-a'), context: { date: DATE } }),
    (error: unknown) => error instanceof ApplicationError && error.code === 'CONFLICT',
  );
  const after = await app.read();
  assert.equal(after.state.logs.length, 0, 'nothing was written');
});
