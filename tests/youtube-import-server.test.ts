import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';

import { createApp, type AppDependencies } from '../server/app.ts';
import type { ExtractedRecipe, RecipeExtractor } from '../server/recipe-extractor.ts';
import type { CaptionResult, YouTubeMetadata, YouTubeSourceProvider } from '../server/youtube-provider.ts';

const recipeText = [
  'Ingredients:',
  '- 2 tomatoes',
  '- 1 tbsp olive oil',
  'Method:',
  'Cook the tomatoes in the olive oil until softened, then serve warm.',
].join('\n');

const metadata = (overrides: Partial<YouTubeMetadata> = {}): YouTubeMetadata => ({
  videoId: 'CWyGvEJVML4',
  canonicalUrl: 'https://www.youtube.com/watch?v=CWyGvEJVML4',
  title: 'Tomato recipe',
  description: recipeText,
  descriptionTruncated: false,
  channel: 'Test creator',
  uploader: 'Test creator',
  viewCount: 42,
  uploadDate: '20261026',
  durationSeconds: 60,
  thumbnailUrl: 'https://i.ytimg.com/vi/CWyGvEJVML4/hqdefault.jpg',
  manualCaptionLanguages: ['en'],
  automaticCaptionLanguages: ['en'],
  ...overrides,
});

const sourceRecipe = (overrides: Partial<ExtractedRecipe> = {}): ExtractedRecipe => ({
  name: 'Tomato pan',
  roles: ['dinner'],
  tags: ['quick'],
  categories: ['Weeknight'],
  ingredients: [{ rawSourceText: '2 tomatoes', name: 'Tomatoes', quantity: 2, unit: null, aisle: 'produce' }],
  steps: ['Cook the tomatoes in olive oil.'],
  yield: 2,
  sourceReportedNutrition: {
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
    sugar: null,
    sodium: null,
  },
  nutritionBasis: 'not_stated',
  nutritionEvidence: null,
  warnings: [],
  ...overrides,
});

const startApi = async (dependencies: AppDependencies) => {
  const app = createApp({
    importEnabled: () => true,
    now: () => new Date('2026-10-26T21:00:00.000Z'),
    ...dependencies,
  });
  const server = createServer((request, response) => {
    void app(request, response).then((handled) => {
      if (!handled && !response.writableEnded) response.end();
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port.');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
};

const post = async (baseUrl: string, body: unknown, headers: Record<string, string> = {}) => {
  const response = await fetch(`${baseUrl}/api/recipes/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
};

const provider = (options: {
  metadata?: YouTubeMetadata;
  captions?: CaptionResult;
  onMetadata?: () => void;
  onCaptions?: () => void;
} = {}): YouTubeSourceProvider => ({
  metadata: async () => {
    options.onMetadata?.();
    return options.metadata ?? metadata();
  },
  captions: async () => {
    options.onCaptions?.();
    return options.captions ?? { status: 'unavailable', text: null, kind: null };
  },
});

const extractor = (result: ExtractedRecipe, onExtract?: (input: Parameters<RecipeExtractor['extract']>[0]) => void): RecipeExtractor => ({
  extract: async (input) => {
    onExtract?.(input);
    return result;
  },
});

test('rejects malformed and cross-site URL imports before source retrieval', async () => {
  let metadataCalls = 0;
  const api = await startApi({ sourceProvider: provider({ onMetadata: () => { metadataCalls += 1; } }), extractor: extractor(sourceRecipe()) });
  try {
    const invalid = await post(api.url, { url: 'https://example.com/watch?v=CWyGvEJVML4' });
    assert.equal(invalid.status, 422);
    assert.equal((invalid.body.error as { code: string }).code, 'INVALID_YOUTUBE_URL');
    const crossSite = await post(api.url, { url: 'https://www.youtube.com/watch?v=CWyGvEJVML4' }, {
      Origin: 'https://attacker.example',
      'Sec-Fetch-Site': 'cross-site',
    });
    assert.equal(crossSite.status, 403);
    assert.equal((crossSite.body.error as { code: string }).code, 'CROSS_SITE_REQUEST_REJECTED');
    assert.equal(metadataCalls, 0);
  } finally {
    await api.close();
  }
});

test('enforces the bounded manual source-text payload before model or provider work', async () => {
  let modelCalls = 0;
  const api = await startApi({
    sourceProvider: provider(),
    extractor: extractor(sourceRecipe(), () => { modelCalls += 1; }),
  });
  try {
    const result = await post(api.url, {
      url: 'https://www.youtube.com/watch?v=CWyGvEJVML4',
      sourceText: 'a'.repeat(80_001),
    });
    assert.equal(result.status, 413);
    assert.equal((result.body.error as { code: string }).code, 'SOURCE_TEXT_TOO_LARGE');
    assert.equal(modelCalls, 0);
  } finally {
    await api.close();
  }
});

test('uses written description first and returns a review-only stable draft with provenance', async () => {
  let captionCalls = 0;
  const api = await startApi({
    sourceProvider: provider({ onCaptions: () => { captionCalls += 1; } }),
    extractor: extractor(sourceRecipe()),
  });
  try {
    const result = await post(api.url, { url: 'https://youtu.be/CWyGvEJVML4' });
    assert.equal(result.status, 200);
    const recipe = result.body.recipe as Record<string, unknown>;
    const source = result.body.source as Record<string, unknown>;
    assert.equal(recipe.id, 'youtube:CWyGvEJVML4');
    assert.equal(recipe.sourceUrl, 'https://www.youtube.com/watch?v=CWyGvEJVML4');
    assert.equal(recipe.image, 'https://i.ytimg.com/vi/CWyGvEJVML4/hqdefault.jpg');
    assert.deepEqual(recipe.sourceEvidence, {
      method: 'description',
      description: recipeText,
      captions: null,
      acquiredAt: '2026-10-26T21:00:00.000Z',
    });
    assert.equal(source.method, 'description');
    assert.equal(captionCalls, 0);
  } finally {
    await api.close();
  }
});

test('falls back to available captions only after an inadequate description', async () => {
  const captionText = 'Ingredients: 2 tomatoes\nMethod: Cook tomatoes slowly in a pan until tender.';
  let modelInput: Parameters<RecipeExtractor['extract']>[0] | undefined;
  const api = await startApi({
    sourceProvider: provider({
      metadata: metadata({ description: 'See the video for ingredients.' }),
      captions: { status: 'available', text: captionText, kind: 'manual' },
    }),
    extractor: extractor(sourceRecipe(), (input) => { modelInput = input; }),
  });
  try {
    const result = await post(api.url, { url: 'https://www.youtube.com/watch?v=CWyGvEJVML4' });
    assert.equal(result.status, 200);
    assert.equal(modelInput?.sourceKind, 'captions');
    assert.equal(modelInput?.sourceText, captionText);
    assert.equal((result.body.source as Record<string, unknown>).method, 'captions');
  } finally {
    await api.close();
  }
});

test('returns a paste hint rather than a fake recipe when captions are unavailable', async () => {
  let modelCalls = 0;
  const api = await startApi({
    sourceProvider: provider({ metadata: metadata({ description: null }) }),
    extractor: extractor(sourceRecipe(), () => { modelCalls += 1; }),
  });
  try {
    const result = await post(api.url, { url: 'https://www.youtube.com/watch?v=CWyGvEJVML4' });
    assert.equal(result.status, 422);
    assert.equal((result.body.error as { code: string }).code, 'SOURCE_INSUFFICIENT');
    assert.match(String(result.body.pasteHint), /Paste/i);
    assert.equal(modelCalls, 0);
  } finally {
    await api.close();
  }
});

test('accepts explicit manual source text without invoking YouTube and marks it for review', async () => {
  let metadataCalls = 0;
  let modelInput: Parameters<RecipeExtractor['extract']>[0] | undefined;
  const manual = 'Ingredients:\n2 tomatoes\nMethod:\nCook the tomatoes gently in olive oil and serve.';
  const api = await startApi({
    sourceProvider: provider({ onMetadata: () => { metadataCalls += 1; } }),
    extractor: extractor(sourceRecipe(), (input) => { modelInput = input; }),
  });
  try {
    const result = await post(api.url, {
      url: 'https://www.youtube.com/watch?v=CWyGvEJVML4',
      sourceText: manual,
    });
    assert.equal(result.status, 200);
    assert.equal(metadataCalls, 0);
    assert.equal(modelInput?.sourceKind, 'manual');
    assert.equal(modelInput?.sourceText, manual);
    const source = result.body.source as Record<string, unknown>;
    assert.equal(source.method, 'manual');
    const recipe = result.body.recipe as Record<string, unknown>;
    assert.equal((recipe.sourceEvidence as Record<string, unknown>).method, 'manual');
  } finally {
    await api.close();
  }
});

test('clears unsupported numeric claims and preserves unknown nutrition rather than estimating it', async () => {
  const api = await startApi({
    sourceProvider: provider(),
    extractor: extractor(sourceRecipe({
      ingredients: [{ rawSourceText: '2 tomatoes', name: 'Tomatoes', quantity: 99, unit: 'g', aisle: 'produce' }],
      sourceReportedNutrition: {
        calories: 999,
        protein: 20,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: null,
      },
      nutritionBasis: 'per_serving',
      nutritionEvidence: 'Ingredients: 2 tomatoes',
    })),
  });
  try {
    const result = await post(api.url, { url: 'https://www.youtube.com/watch?v=CWyGvEJVML4' });
    assert.equal(result.status, 200);
    const recipe = result.body.recipe as Record<string, unknown>;
    const ingredient = (recipe.ingredients as Array<Record<string, unknown>>)[0];
    assert.equal(ingredient.quantity, null);
    assert.deepEqual(recipe.reportedNutrition, {
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
    });
    assert.equal(recipe.nutritionBasis, 'not_stated');
    assert.match((recipe.dataGaps as string[]).join(' '), /cleared/i);
  } finally {
    await api.close();
  }
});

test('reports disabled capability and does not permit paid preview calls by default', async () => {
  const app = createApp({ importEnabled: () => false });
  const server = createServer((request, response) => { void app(request, response); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const capabilities = await fetch(`${baseUrl}/api/import/capabilities`);
    assert.equal(capabilities.status, 200);
    assert.equal((await capabilities.json() as { available: boolean }).available, false);
    const preview = await post(baseUrl, { url: 'https://www.youtube.com/watch?v=CWyGvEJVML4' });
    assert.equal(preview.status, 503);
    assert.equal((preview.body.error as { code: string }).code, 'IMPORT_DISABLED');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
