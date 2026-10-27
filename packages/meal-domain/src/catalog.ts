import { perServingNutrition } from './nutrition';
import { type Filters, type MacroKey, type Nutrition, type Recipe, type SortOrder } from './types';

const macroKeys: MacroKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

const nutritionFor = (recipe: Recipe, mode: Filters['nutritionMode']): Nutrition =>
  mode === 'reported' ? recipe.reportedNutrition : perServingNutrition(recipe);

const includesNeedle = (haystack: string, needle: string): boolean => normalize(haystack).includes(normalize(needle));

const recipeSearchText = (recipe: Recipe): string => [
  recipe.name,
  recipe.sourceName,
  recipe.creatorCredit ?? '',
  ...recipe.tags,
  ...recipe.categories,
  ...recipe.ingredients.map((ingredient) => ingredient.name),
  ...recipe.steps,
].join(' ');

const hasAllLabels = (available: string[], requested: string[]): boolean =>
  requested.every((label) => available.some((value) => normalize(value) === normalize(label)));

const matchesRanges = (nutrition: Nutrition, filters: Filters): boolean =>
  macroKeys.every((key) => {
    const range = filters.ranges[key];
    if (!range) return true;
    const value = nutrition[key];
    if (value === null) return false;
    return (range.min === undefined || value >= range.min)
      && (range.max === undefined || value <= range.max);
  });

const numericCompare = (left: number | null, right: number | null, direction: 1 | -1): number => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return (left - right) * direction;
};

const dateCompare = (left: string, right: string): number => {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0;
  if (!Number.isFinite(leftTime)) return 1;
  if (!Number.isFinite(rightTime)) return -1;
  return rightTime - leftTime;
};

const sortRecipes = (recipes: Recipe[], order: SortOrder, mode: Filters['nutritionMode']): Recipe[] => {
  const sorted = [...recipes];
  sorted.sort((left, right) => {
    let comparison = 0;
    const leftNutrition = nutritionFor(left, mode);
    const rightNutrition = nutritionFor(right, mode);

    switch (order) {
      case 'name':
        comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
        break;
      case 'popular':
        comparison = numericCompare(left.viewCount, right.viewCount, -1);
        break;
      case 'newest':
        comparison = dateCompare(left.addedAt, right.addedAt);
        break;
      case 'mealPrep':
        comparison = numericCompare(left.mealPrepRating, right.mealPrepRating, -1);
        break;
      case 'protein':
      case 'fiber':
        comparison = numericCompare(leftNutrition[order], rightNutrition[order], -1);
        break;
      case 'calories':
      case 'carbs':
      case 'fat':
      case 'sugar':
      case 'sodium':
        comparison = numericCompare(leftNutrition[order], rightNutrition[order], 1);
        break;
    }

    if (comparison !== 0) return comparison;
    comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    return comparison !== 0 ? comparison : left.id.localeCompare(right.id);
  });
  return sorted;
};

/**
 * Applies every selected filter conjunctively. Numeric ranges deliberately reject
 * unknown values: an absent macro is not evidence that it meets a threshold.
 */
export const filterRecipes = (recipes: Recipe[], filters: Filters): Recipe[] => {
  const filtered = recipes.filter((recipe) => {
    if (filters.search.trim() && !includesNeedle(recipeSearchText(recipe), filters.search)) return false;
    if (filters.role !== 'all' && !recipe.roles.includes(filters.role)) return false;
    if (!hasAllLabels(recipe.tags, filters.tags)) return false;
    if (!hasAllLabels(recipe.categories, filters.categories)) return false;
    if (!filters.includeIngredients.every((term) =>
      recipe.ingredients.some((ingredient) => includesNeedle(ingredient.name, term)),
    )) return false;
    if (filters.excludeIngredients.some((term) =>
      recipe.ingredients.some((ingredient) => includesNeedle(ingredient.name, term)),
    )) return false;
    if (filters.favoritesOnly && !recipe.favorite) return false;
    if (filters.minMealPrep !== undefined
      && (recipe.mealPrepRating === null || recipe.mealPrepRating < filters.minMealPrep)) return false;
    return matchesRanges(nutritionFor(recipe, filters.nutritionMode), filters);
  });

  return sortRecipes(filtered, filters.sort, filters.nutritionMode);
};
