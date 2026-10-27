import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { acceptsGzip, encodeStatic } from '../server/static-compression.ts';

test('gzip respects explicit client support and q=0', () => {
  assert.equal(acceptsGzip('gzip, deflate, br'), true);
  assert.equal(acceptsGzip('br, gzip;q=0'), false);
  assert.equal(acceptsGzip('gzip;q=0.5'), true);
  assert.equal(acceptsGzip(undefined), false);
});
test('static JSON is compressed losslessly, raw clients and images stay unchanged', async () => {
  const original = Buffer.from(
    JSON.stringify({
      recipes: Array.from({ length: 100 }, () => ({
        name: 'A recipe',
        protein: 57,
        ingredients: ['chicken', 'pasta', 'peppers'],
      })),
    }),
  );
  const encoded = await encodeStatic(original, 'application/json; charset=utf-8', 'gzip');
  assert.equal(encoded.encoding, 'gzip');
  assert.ok(encoded.body.length < original.length);
  assert.deepEqual(gunzipSync(encoded.body), original);
  assert.deepEqual(await encodeStatic(original, 'application/json', undefined), { body: original });
  assert.deepEqual(await encodeStatic(original, 'image/webp', 'gzip'), { body: original });
});
