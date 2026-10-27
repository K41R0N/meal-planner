import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emptyNutrition } from '../packages/meal-domain/src/types.ts';
import {
  normalizeRecipeDraft,
  type ExtractedIngredient,
  type ExtractedRecipe,
} from '../server/recipe-extractor.ts';
import {
  minimalProviderEnvironment,
  selectCaptionLanguage,
  type YouTubeMetadata,
} from '../server/youtube-provider.ts';

const sourceNutrition = (values: Partial<ExtractedRecipe['sourceReportedNutrition']> = {}) => ({
  ...emptyNutrition(),
  ...values,
});

const metadata = (description: string): YouTubeMetadata => ({
  videoId: 'CWyGvEJVML4',
  canonicalUrl: 'https://www.youtube.com/watch?v=CWyGvEJVML4',
  title: 'Provenance fixture',
  description,
  descriptionTruncated: false,
  channel: 'Fixture creator',
  uploader: 'Fixture creator',
  viewCount: null,
  uploadDate: null,
  durationSeconds: null,
  thumbnailUrl: null,
  manualCaptionLanguages: [],
  automaticCaptionLanguages: [],
});

const ingredient = (overrides: Partial<ExtractedIngredient> = {}): ExtractedIngredient => ({
  rawSourceText: '2 tomatoes',
  name: 'Tomatoes',
  quantity: 2,
  unit: null,
  aisle: 'produce',
  ...overrides,
});

const extractedRecipe = (overrides: Partial<ExtractedRecipe> = {}): ExtractedRecipe => ({
  name: 'Fixture recipe',
  roles: [],
  tags: [],
  categories: [],
  ingredients: [ingredient()],
  steps: ['Cook the ingredients.'],
  yield: null,
  sourceReportedNutrition: sourceNutrition(),
  nutritionBasis: 'not_stated',
  nutritionEvidence: null,
  warnings: [],
  ...overrides,
});

const normalize = (sourceText: string, overrides: Partial<ExtractedRecipe> = {}) => normalizeRecipeDraft({
  extracted: extractedRecipe(overrides),
  metadata: metadata(sourceText),
  sourceText,
  method: 'description',
  captions: null,
  acquiredAt: '2026-10-27T02:02:33.708Z',
});

test('retains exact straight and unicode half-teaspoon evidence, but clears an unproved yield', () => {
  const source = 'Ingredients: 1/2 tsp cumin; ½ tsp paprika; 2 tomatoes.';
  const draft = normalize(source, {
    ingredients: [
      ingredient({ rawSourceText: '1/2 tsp cumin', name: 'Cumin', quantity: 0.5, unit: 'tsp' }),
      ingredient({ rawSourceText: '½ tsp paprika', name: 'Paprika', quantity: 0.5, unit: 'teaspoon' }),
      ingredient({ rawSourceText: '2 tomatoes', name: 'Tomatoes', quantity: 2, unit: null }),
    ],
    yield: 2,
  });

  assert.deepEqual(draft.recipe.ingredients.map(({ quantity, unit }) => ({ quantity, unit })), [
    { quantity: 0.5, unit: 'tsp' },
    { quantity: 0.5, unit: 'teaspoon' },
    { quantity: 2, unit: null },
  ]);
  assert.equal(draft.recipe.baseServings, null);
  assert.match(draft.warnings.join(' '), /yield was cleared/i);
});

test('clears invented mass units but retains a safe implicit count from 2 tomatoes', () => {
  const draft = normalize('Ingredients: 2 tomatoes.', {
    ingredients: [
      ingredient({ name: 'Invented weight', quantity: 2, unit: 'kg' }),
      ingredient({ name: 'Count only', quantity: 2, unit: 'count' }),
    ],
  });

  assert.deepEqual(draft.recipe.ingredients.map(({ quantity, unit }) => ({ quantity, unit })), [
    { quantity: null, unit: null },
    { quantity: 2, unit: null },
  ]);
  assert.match(draft.warnings.join(' '), /claimed unit/i);
});

test('clears range endpoints and an unpaired unit while retaining the source wording for review', () => {
  const source = 'Ingredients: 1–2 cloves garlic; 1 tsp salt.';
  const draft = normalize(source, {
    ingredients: [
      ingredient({ rawSourceText: '1–2 cloves garlic', name: 'Garlic', quantity: 1, unit: 'cloves' }),
      ingredient({ rawSourceText: '1 tsp salt', name: 'Salt', quantity: null, unit: 'tsp' }),
    ],
  });

  assert.deepEqual(draft.recipe.ingredients.map(({ quantity, unit, quantityText }) => ({ quantity, unit, quantityText })), [
    { quantity: null, unit: null, quantityText: '1–2 cloves garlic' },
    { quantity: null, unit: null, quantityText: '1 tsp salt' },
  ]);
  assert.match(draft.warnings.join(' '), /range/i);
});

test('clears calorie and protein values when their own labels point to different values', () => {
  const evidence = 'Protein: 30g; Calories: 500 kcal';
  const draft = normalize(evidence, {
    sourceReportedNutrition: sourceNutrition({ calories: 30, protein: 500 }),
    nutritionBasis: 'per_serving',
    nutritionEvidence: evidence,
  });

  assert.equal(draft.recipe.reportedNutrition.calories, null);
  assert.equal(draft.recipe.reportedNutrition.protein, null);
  assert.equal(draft.recipe.nutritionBasis, 'not_stated');
  assert.match(draft.warnings.join(' '), /label, value, and expected unit/i);
});

test('rejects a protein value reported with milligrams rather than grams', () => {
  const evidence = 'Nutrition: Protein: 30mg';
  const draft = normalize(evidence, {
    sourceReportedNutrition: sourceNutrition({ protein: 30 }),
    nutritionEvidence: evidence,
  });

  assert.equal(draft.recipe.reportedNutrition.protein, null);
});

test('keeps nutrition values only when their matching labels and expected units are in the quoted evidence', () => {
  const evidence = 'Macros\nCalories: 677\nProtein: 67g\nCarbs: 39g\nFat: 27g';
  const draft = normalize(evidence, {
    sourceReportedNutrition: sourceNutrition({ calories: 677, protein: 67, carbs: 39, fat: 27 }),
    nutritionBasis: 'unspecified',
    nutritionEvidence: evidence,
  });

  assert.deepEqual(draft.recipe.reportedNutrition, sourceNutrition({ calories: 677, protein: 67, carbs: 39, fat: 27 }));
  assert.equal(draft.recipe.nutritionBasis, 'unspecified');
  assert.equal(draft.recipe.nutritionEvidence, evidence);
});

test('accepts compact P/C/F macro shorthand only when the evidence establishes nutrition context', () => {
  const evidence = 'Nutrition panel: 67gP, 39gC, 27gF';
  const draft = normalize(evidence, {
    sourceReportedNutrition: sourceNutrition({ protein: 67, carbs: 39, fat: 27 }),
    nutritionEvidence: evidence,
  });

  assert.deepEqual(draft.recipe.reportedNutrition, sourceNutrition({ protein: 67, carbs: 39, fat: 27 }));
});

test('caption language choice prefers exact English, then English variants, then sorted foreign captions', () => {
  assert.equal(selectCaptionLanguage(['es', 'en-US', 'en']), 'en');
  assert.equal(selectCaptionLanguage(['es', 'en-GB', 'en-US']), 'en-GB');
  assert.equal(selectCaptionLanguage(['fr', 'es']), 'es');
  assert.equal(selectCaptionLanguage([]), null);
});

test('the provider uses only its fixed scrubbed environment with the approved venv first', () => {
  const environment = minimalProviderEnvironment();
  const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

  assert.equal(Object.hasOwn(environment, 'MANUS_API_KEY'), false);
  assert.deepEqual(environment, {
    PATH: `/opt/recipe-tools/bin:${join(repositoryRoot, '.venv', 'bin')}:/usr/local/bin:/usr/bin:/bin`,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
  });
});
