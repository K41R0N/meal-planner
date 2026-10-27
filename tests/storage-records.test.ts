import assert from 'node:assert/strict';
import test from 'node:test';
import { selectStorageRecord, wrapStorageRecord } from '../apps/web/src/storage-records';

test('legacy private state remains readable without an envelope migration prerequisite', () => {
  const old = { version: 1, recipes: [{ id: 'kept' }] };
  assert.deepEqual(selectStorageRecord(old, null)?.state, old);
});

test('a newer fallback copy wins over an older IndexedDB copy after storage recovers', () => {
  const before = { version: 1, notes: 'before' };
  const after = { version: 1, notes: 'after' };
  const selected = selectStorageRecord(
    wrapStorageRecord(before, 100),
    JSON.stringify(wrapStorageRecord(after, 200)),
  );
  assert.deepEqual(selected?.state, after);
});

test('a successful later IndexedDB save wins over an old fallback without deleting the fallback', () => {
  assert.deepEqual(
    selectStorageRecord(
      wrapStorageRecord({ revision: 3 }, 300),
      JSON.stringify(wrapStorageRecord({ revision: 2 }, 200)),
    )?.state,
    { revision: 3 },
  );
});

test('a corrupt only copy throws instead of seeding and overwriting the user book', () => {
  assert.throws(() => selectStorageRecord(null, '{broken JSON'), /damaged|read|backup/i);
});

test('a damaged unused fallback does not block the intact IndexedDB copy', () => {
  assert.deepEqual(selectStorageRecord({ version: 1, intact: true }, '{broken JSON')?.state, {
    version: 1,
    intact: true,
  });
});

test('no saved copy is distinguishable from a corrupt saved copy', () => {
  assert.equal(selectStorageRecord(undefined, null), null);
});
