import {
  emptyNutrition,
  type ConsumptionEntry,
  type MacroKey,
  type Nutrition,
  type NutritionTotals,
  type Recipe,
} from './types';

const macroKeys: MacroKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];

const isKnownAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const knownNutrition = (nutrition: Nutrition): Nutrition => {
  const result = emptyNutrition();
  for (const key of macroKeys) result[key] = isKnownAmount(nutrition[key]) ? nutrition[key] : null;
  return result;
};

const scaleNutrition = (nutrition: Nutrition, multiplier: number): Nutrition => {
  const scaled = emptyNutrition();
  for (const key of macroKeys) {
    const value = nutrition[key];
    scaled[key] = isKnownAmount(value) ? value * multiplier : null;
  }
  return scaled;
};

const randomId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `consumption-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const isDateOnly = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

/** Returns canonical nutrition for one serving only when its basis is established. */
export const perServingNutrition = (recipe: Recipe): Nutrition => {
  if (recipe.nutritionBasis === 'per_serving') return knownNutrition(recipe.nutrition);
  if (recipe.nutritionBasis === 'per_recipe'
    && typeof recipe.baseServings === 'number'
    && Number.isFinite(recipe.baseServings)
    && recipe.baseServings > 0) {
    return scaleNutrition(knownNutrition(recipe.reportedNutrition), 1 / recipe.baseServings);
  }
  return emptyNutrition();
};

/** Scales nutrition whose per-serving basis is explicitly established or derived. */
export const recipeNutrition = (recipe: Recipe, servings: number): Nutrition => {
  if (!Number.isFinite(servings) || servings < 0) {
    throw new Error('Servings must be a non-negative finite number.');
  }
  return scaleNutrition(perServingNutrition(recipe), servings);
};

/** Creates an immutable historical total, rather than a per-serving log value. */
export const createConsumption = (recipe: Recipe, servings: number, date: string): ConsumptionEntry => {
  if (!Number.isFinite(servings) || servings <= 0) {
    throw new Error('Consumed servings must be a positive finite number.');
  }
  if (!isDateOnly(date)) throw new Error('Consumption date must use a real YYYY-MM-DD date.');

  return {
    id: randomId(),
    date,
    recipeId: recipe.id,
    name: recipe.name,
    servings,
    nutritionSnapshot: recipeNutrition(recipe, servings),
    createdAt: new Date().toISOString(),
  };
};

export const sumNutrition = (
  entries: Pick<ConsumptionEntry, 'nutritionSnapshot'>[],
): NutritionTotals => {
  const values: Record<MacroKey, number> = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  };
  const known: Record<MacroKey, number> = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  };

  for (const entry of entries) {
    for (const key of macroKeys) {
      const value = entry.nutritionSnapshot[key];
      if (isKnownAmount(value)) {
        values[key] += value;
        known[key] += 1;
      }
    }
  }

  const incomplete = entries.length > 0
    && (['calories', 'protein', 'carbs', 'fat'] as const).some((key) => known[key] !== entries.length);

  return { values, known, count: entries.length, incomplete };
};
