import type { IngredientLine, Recipe, ShoppingContribution, ShoppingItem, WeekPlan } from './types';

interface UnitInfo {
  unit: string | null;
  key: string;
  factor: number;
}

interface Group {
  key: string;
  canonicalName: string;
  names: Set<string>;
  aisles: Set<string>;
  unit: string | null;
  quantity: number;
  hasKnownQuantity: boolean;
  hasUnknownQuantity: boolean;
  notes: Set<string>;
  contributions: ShoppingContribution[];
}

const safePluralAliases: Record<string, string> = {
  tomatoes: 'tomato',
  potatoes: 'potato',
  onions: 'onion',
  peppers: 'pepper',
  carrots: 'carrot',
  mushrooms: 'mushroom',
  eggs: 'egg',
  lemons: 'lemon',
  limes: 'lime',
  bananas: 'banana',
  avocados: 'avocado',
};

const normalizeName = (name: string): string => {
  const words = name.trim().toLocaleLowerCase().replace(/\s+/g, ' ').split(' ');
  const last = words.at(-1);
  if (last && safePluralAliases[last]) words[words.length - 1] = safePluralAliases[last];
  return words.join(' ');
};

const normalizeAisle = (aisle: string): string => aisle.trim() || 'Other';

const unitInfo = (unit: string | null): UnitInfo => {
  if (unit === null || unit.trim() === '') return { unit: null, key: 'count', factor: 1 };
  const value = unit.trim().toLocaleLowerCase().replace(/\.$/, '');
  if (value === 'g' || value === 'gram' || value === 'grams') return { unit: 'g', key: 'g', factor: 1 };
  if (value === 'kg' || value === 'kilogram' || value === 'kilograms') return { unit: 'g', key: 'g', factor: 1000 };
  if (value === 'ml' || value === 'millilitre' || value === 'millilitres' || value === 'milliliter' || value === 'milliliters') {
    return { unit: 'ml', key: 'ml', factor: 1 };
  }
  if (value === 'l' || value === 'litre' || value === 'litres' || value === 'liter' || value === 'liters') {
    return { unit: 'ml', key: 'ml', factor: 1000 };
  }
  if (value === 'tsp' || value === 'teaspoon' || value === 'teaspoons') return { unit: 'tsp', key: 'tsp', factor: 1 };
  if (value === 'tbsp' || value === 'tablespoon' || value === 'tablespoons') return { unit: 'tsp', key: 'tsp', factor: 3 };
  return { unit: value, key: `unit:${value}`, factor: 1 };
};

const hasRangeOrUnknownAmount = (ingredient: IngredientLine): boolean => {
  const raw = `${ingredient.quantityText} ${ingredient.sourceText ?? ''}`.toLocaleLowerCase();
  return /\d\s*(?:-|–|—|to)\s*\d/.test(raw)
    || /\b(to taste|as needed|as required|a handful|some)\b/.test(raw);
};

const hasAmbiguousCountBasis = (ingredient: IngredientLine): boolean => {
  if (ingredient.unit !== null) return false;
  const raw = `${ingredient.quantityText} ${ingredient.sourceText ?? ''}`.toLocaleLowerCase();
  return /\b(small|medium|large|heaped|rounded|generous|handful|pinch)\b/.test(raw);
};

const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

const displayName = (names: Set<string>): string =>
  [...names].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))[0];

const displayAisle = (aisles: Set<string>): string =>
  [...aisles].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))[0] ?? 'Other';

const addIngredient = (
  groups: Map<string, Group>,
  recipe: Recipe,
  servings: number,
  ingredient: IngredientLine,
): void => {
  const yieldKnown = recipe.baseServings !== null && Number.isFinite(recipe.baseServings) && recipe.baseServings > 0;
  const explicitAmount = typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity) && ingredient.quantity >= 0;
  const ambiguous = hasRangeOrUnknownAmount(ingredient) || hasAmbiguousCountBasis(ingredient);
  const info = unitInfo(ingredient.unit);
  const rawQualifier = ambiguous && info.unit === null
    ? `:${ingredient.quantityText.trim().toLocaleLowerCase() || ingredient.sourceText?.trim().toLocaleLowerCase() || 'unspecified'}`
    : '';
  const canonicalName = normalizeName(ingredient.name);
  const key = `shopping:${canonicalName}:${info.key}${rawQualifier}`;
  const existing = groups.get(key) ?? {
    key,
    canonicalName,
    names: new Set<string>(),
    aisles: new Set<string>(),
    unit: info.unit,
    quantity: 0,
    hasKnownQuantity: false,
    hasUnknownQuantity: false,
    notes: new Set<string>(),
    contributions: [],
  };

  existing.names.add(ingredient.name.trim());
  existing.aisles.add(normalizeAisle(ingredient.aisle));
  let scaled: number | null = null;
  if (!yieldKnown) {
    existing.hasUnknownQuantity = true;
    existing.notes.add(`${recipe.name}: recipe yield is not stated, so this amount cannot be scaled.`);
  } else if (!explicitAmount) {
    existing.hasUnknownQuantity = true;
    existing.notes.add(`${recipe.name}: amount is not stated.`);
  } else if (ambiguous) {
    existing.hasUnknownQuantity = true;
    existing.notes.add(`${recipe.name}: source amount “${ingredient.quantityText || ingredient.sourceText || ingredient.name}” needs review.`);
  } else {
    scaled = ingredient.quantity! * servings / recipe.baseServings! * info.factor;
    existing.quantity += scaled;
    existing.hasKnownQuantity = true;
  }
  existing.contributions.push({
    recipeId: recipe.id,
    recipeName: recipe.name,
    servings,
    quantity: scaled,
    quantityText: ingredient.quantityText || ingredient.sourceText || '',
  });
  groups.set(key, existing);
};

/**
 * Creates an evidence-preserving shopping list. Only mass, volume, and spoon
 * conversions with explicit factors are merged; cups are never converted to grams.
 */
export const buildShoppingList = (plan: WeekPlan, recipes: Recipe[]): ShoppingItem[] => {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const groups = new Map<string, Group>();

  for (const meal of plan.meals) {
    const recipe = recipesById.get(meal.recipeId);
    if (!recipe) throw new Error(`Shopping list cannot be built because planned recipe "${meal.recipeId}" is unavailable.`);
    if (!Number.isFinite(meal.servings) || meal.servings <= 0) {
      throw new Error(`Shopping list cannot be built because servings for ${recipe.name} are invalid.`);
    }
    for (const ingredient of recipe.ingredients) addIngredient(groups, recipe, meal.servings, ingredient);
  }

  return [...groups.values()].map((group) => {
    const rawQuantities = [...new Set(group.contributions
      .map((contribution) => contribution.quantityText.trim())
      .filter(Boolean))];
    const notes = [...group.notes];
    if (group.aisles.size > 1) notes.push(`Aisle varies by recipe: ${[...group.aisles].sort().join(', ')}.`);
    const completeQuantity = group.hasKnownQuantity && !group.hasUnknownQuantity;
    const displayQuantity = group.hasKnownQuantity
      ? `${formatNumber(group.quantity)}${group.unit ? ` ${group.unit}` : ''}${group.hasUnknownQuantity ? ' + review' : ''}`
      : rawQuantities.length === 1
        ? rawQuantities[0]
        : rawQuantities.length > 1
          ? 'See recipe amounts'
          : 'Amount not stated';
    return {
      key: group.key,
      name: displayName(group.names),
      aisle: displayAisle(group.aisles),
      quantity: completeQuantity ? group.quantity : null,
      unit: group.unit,
      displayQuantity,
      needsReview: group.hasUnknownQuantity,
      notes,
      contributions: group.contributions,
    };
  }).sort((left, right) => {
    const aisle = left.aisle.localeCompare(right.aisle, undefined, { sensitivity: 'base' });
    if (aisle !== 0) return aisle;
    const name = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    return name !== 0 ? name : left.key.localeCompare(right.key);
  });
};
