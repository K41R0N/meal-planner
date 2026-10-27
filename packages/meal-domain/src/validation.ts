import {
  emptyNutrition,
  mealTypes,
  type AppState,
  type ConsumptionEntry,
  type Filters,
  type IngredientLine,
  type MacroKey,
  type ManualShoppingItem,
  type MealType,
  type Nutrition,
  type PlanConfig,
  type PlannedMeal,
  type Recipe,
  type WeekPlan,
} from './types';
import { buildShoppingList } from './shopping';

type UnknownRecord = Record<string, unknown>;

const macroKeys: MacroKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];
const sortOrders = new Set(['popular', 'name', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'mealPrep', 'newest']);
const nutritionBases = new Set(['per_serving', 'per_recipe', 'unspecified', 'not_stated']);
const htmlTag = /<\/?[a-z][^>]*>/i;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (path: string, message: string): never => {
  throw new Error(`${path}: ${message}`);
};

const text = (value: unknown, path: string, allowEmpty = false): string => {
  if (typeof value !== 'string') return fail(path, 'must be text.');
  const result = value.trim();
  if (!allowEmpty && !result) fail(path, 'must not be empty.');
  if (htmlTag.test(result)) fail(path, 'must be plain text, not HTML.');
  return result;
};

const nullableText = (value: unknown, path: string, allowEmpty = false): string | null =>
  value === null ? null : text(value, path, allowEmpty);

const httpUrl = (value: unknown, path: string): string => {
  const result = text(value, path);
  if (!/^https?:\/\//i.test(result)) return fail(path, 'must be an http or https URL.');
  let parsed: URL;
  try {
    parsed = new URL(result);
  } catch {
    return fail(path, 'must be a valid URL.');
  }
  const authority = /^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i.exec(result)?.[1] ?? '';
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    || parsed.username
    || parsed.password
    || authority.includes('@')) {
    return fail(path, 'must be an http or https URL without embedded credentials.');
  }
  return result;
};

const nullableSourceUrl = (value: unknown, path: string): string | null =>
  value === undefined || value === null ? null : httpUrl(value, path);

const nullableImage = (value: unknown, path: string): string | null => {
  if (value === undefined || value === null) return null;
  const result = text(value, path);
  if (!result.startsWith('/')) return httpUrl(result, path);
  if (result.startsWith('//')) return fail(path, 'must not use a host-relative URL.');

  const pathOnly = result.split(/[?#]/, 1)[0];
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathOnly);
  } catch {
    return fail(path, 'must use a valid root-relative asset path.');
  }
  if (decodedPath.startsWith('//')
    || decodedPath.includes('\\')
    || decodedPath.includes('\0')
    || /(?:^|\/)\.\.?($|\/)/.test(decodedPath)) {
    return fail(path, 'must use a safe root-relative asset path.');
  }
  return result;
};

const finiteNonNegative = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fail(path, 'must be a finite non-negative number.');
  }
  return value;
};

const finiteNonNegativeOrNull = (value: unknown, path: string): number | null =>
  value === null ? null : finiteNonNegative(value, path);

const positiveOrNull = (value: unknown, path: string): number | null => {
  if (value === null) return null;
  const result = finiteNonNegative(value, path);
  if (result <= 0) fail(path, 'must be positive or null.');
  return result;
};

const isDateOnly = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const dateOnly = (value: unknown, path: string): string => {
  const result = text(value, path);
  if (!isDateOnly(result)) fail(path, 'must use a real YYYY-MM-DD date.');
  return result;
};

const timestamp = (value: unknown, path: string): string => {
  const result = text(value, path);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(result);
  if (!match) return fail(path, 'must use an ISO 8601 timestamp with a timezone.');
  const [year, month, day, hour, minute, second, fraction = '', , , offsetHour, offsetMinute] = match.slice(1);
  const [numericYear, numericMonth, numericDay, numericHour, numericMinute, numericSecond] = [year, month, day, hour, minute, second].map(Number);
  const date = new Date(Date.UTC(
    numericYear,
    numericMonth - 1,
    numericDay,
    numericHour,
    numericMinute,
    numericSecond,
    Number(fraction.slice(0, 3).padEnd(3, '0')),
  ));
  if (date.getUTCFullYear() !== numericYear
    || date.getUTCMonth() !== numericMonth - 1
    || date.getUTCDate() !== numericDay
    || date.getUTCHours() !== numericHour
    || date.getUTCMinutes() !== numericMinute
    || date.getUTCSeconds() !== numericSecond
    || (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59))
    ) {
    return fail(path, 'must use a real ISO 8601 timestamp with a timezone.');
  }
  return result;
};

const nullableTimestamp = (value: unknown, path: string): string | null =>
  value === null ? null : timestamp(value, path);

const stringArray = (value: unknown, path: string): string[] => {
  if (!Array.isArray(value)) return fail(path, 'must be an array of text.');
  return value.map((item, index) => text(item, `${path}[${index}]`));
};

const mealType = (value: unknown, path: string): MealType => {
  if (typeof value !== 'string' || !mealTypes.includes(value as MealType)) {
    fail(path, `must be one of: ${mealTypes.join(', ')}.`);
  }
  return value as MealType;
};

const nullableNutritionNumber = (value: unknown, path: string): number | null => {
  if (value === undefined || value === null) return null;
  return finiteNonNegative(value, path);
};

const nutrition = (value: unknown, path: string): Nutrition => {
  if (!isRecord(value)) return fail(path, 'must be a nutrition object.');
  const result = emptyNutrition();
  for (const key of macroKeys) result[key] = nullableNutritionNumber(value[key], `${path}.${key}`);
  return result;
};

const canonicalRecipeNutrition = (
  nutritionBasis: Recipe['nutritionBasis'],
  manualNutrition: Nutrition,
  reportedNutrition: Nutrition,
  baseServings: number | null,
): Nutrition => {
  if (nutritionBasis === 'per_serving') return manualNutrition;
  if (nutritionBasis !== 'per_recipe' || baseServings === null) return emptyNutrition();

  const result = emptyNutrition();
  for (const key of macroKeys) {
    const value = reportedNutrition[key];
    result[key] = value === null ? null : value / baseServings;
  }
  return result;
};

const ingredient = (value: unknown, path: string): IngredientLine => {
  if (!isRecord(value)) return fail(path, 'must be an ingredient object.');
  return {
    id: text(value.id, `${path}.id`),
    name: text(value.name, `${path}.name`),
    quantity: finiteNonNegativeOrNull(value.quantity, `${path}.quantity`),
    unit: nullableText(value.unit, `${path}.unit`),
    quantityText: text(value.quantityText, `${path}.quantityText`, true),
    aisle: text(value.aisle, `${path}.aisle`),
    ...(value.sourceText === undefined ? {} : { sourceText: text(value.sourceText, `${path}.sourceText`, true) }),
  };
};

const recipe = (value: unknown, path: string): Recipe => {
  if (!isRecord(value)) return fail(path, 'must be a recipe object.');
  const roles = value.roles;
  const ingredients = value.ingredients;
  const steps = value.steps;
  const dataGaps = value.dataGaps;
  const favorite = value.favorite;
  const nutritionBasis = value.nutritionBasis;
  if (!Array.isArray(roles)) return fail(`${path}.roles`, 'must be an array.');
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return fail(`${path}.ingredients`, 'must contain at least one valid ingredient.');
  }
  if (!Array.isArray(steps)) return fail(`${path}.steps`, 'must be an array of text.');
  if (!Array.isArray(dataGaps)) return fail(`${path}.dataGaps`, 'must be an array of text.');
  if (typeof favorite !== 'boolean') return fail(`${path}.favorite`, 'must be true or false.');
  if (typeof nutritionBasis !== 'string' || !nutritionBases.has(nutritionBasis)) {
    return fail(`${path}.nutritionBasis`, 'must state a supported nutrition basis.');
  }

  const parsedBaseServings = positiveOrNull(value.baseServings, `${path}.baseServings`);
  const parsedNutrition = nutrition(value.nutrition, `${path}.nutrition`);
  const parsedReportedNutrition = nutrition(value.reportedNutrition, `${path}.reportedNutrition`);
  const canonicalNutrition = canonicalRecipeNutrition(
    nutritionBasis as Recipe['nutritionBasis'],
    parsedNutrition,
    parsedReportedNutrition,
    parsedBaseServings,
  );
  const mealPrepRating = finiteNonNegativeOrNull(value.mealPrepRating, `${path}.mealPrepRating`);
  if (mealPrepRating !== null && mealPrepRating > 5) {
    return fail(`${path}.mealPrepRating`, 'must be no greater than 5.');
  }

  return {
    id: text(value.id, `${path}.id`),
    name: text(value.name, `${path}.name`),
    roles: roles.map((role, index) => mealType(role, `${path}.roles[${index}]`)),
    tags: stringArray(value.tags, `${path}.tags`),
    categories: stringArray(value.categories, `${path}.categories`),
    ingredients: ingredients.map((item, index) => ingredient(item, `${path}.ingredients[${index}]`)),
    steps: stringArray(steps, `${path}.steps`),
    baseServings: parsedBaseServings,
    nutrition: canonicalNutrition,
    reportedNutrition: parsedReportedNutrition,
    nutritionBasis: nutritionBasis as Recipe['nutritionBasis'],
    ...(value.nutritionEvidence === undefined || value.nutritionEvidence === null
      ? {}
      : { nutritionEvidence: text(value.nutritionEvidence, `${path}.nutritionEvidence`, true) }),
    sourceUrl: nullableSourceUrl(value.sourceUrl, `${path}.sourceUrl`),
    sourceName: text(value.sourceName, `${path}.sourceName`),
    creatorCredit: nullableText(value.creatorCredit, `${path}.creatorCredit`),
    viewCount: finiteNonNegativeOrNull(value.viewCount, `${path}.viewCount`),
    viewCountAt: nullableTimestamp(value.viewCountAt, `${path}.viewCountAt`),
    image: nullableImage(value.image, `${path}.image`),
    prepMinutes: finiteNonNegativeOrNull(value.prepMinutes, `${path}.prepMinutes`),
    cookMinutes: finiteNonNegativeOrNull(value.cookMinutes, `${path}.cookMinutes`),
    mealPrepRating,
    mealPrepNotes: text(value.mealPrepNotes, `${path}.mealPrepNotes`, true),
    dataGaps: stringArray(dataGaps, `${path}.dataGaps`),
    favorite,
    addedAt: timestamp(value.addedAt, `${path}.addedAt`),
  };
};

const importedMacroNutrition = (value: unknown, path: string): Nutrition => {
  if (!isRecord(value)) return emptyNutrition();
  return {
    calories: nullableNutritionNumber(value.calories_kcal, `${path}.calories_kcal`),
    protein: nullableNutritionNumber(value.protein_g, `${path}.protein_g`),
    carbs: nullableNutritionNumber(value.carbs_g, `${path}.carbs_g`),
    fat: nullableNutritionNumber(value.fat_g, `${path}.fat_g`),
    fiber: nullableNutritionNumber(value.fiber_g, `${path}.fiber_g`),
    sugar: nullableNutritionNumber(value.sugar_g, `${path}.sugar_g`),
    sodium: nullableNutritionNumber(value.sodium_mg, `${path}.sodium_mg`),
  };
};

const aisleForImportCategory = (category: string | null): string => {
  switch (category) {
    case 'produce': return 'Produce';
    case 'meat_fish': return 'Meat & Fish';
    case 'dairy_eggs': return 'Dairy & Eggs';
    case 'grains_bread': return 'Pantry';
    case 'spices_herbs': return 'Herbs & Spices';
    case 'frozen': return 'Frozen';
    default: return 'Other';
  }
};

const importedIngredient = (value: unknown, path: string, id: string): IngredientLine => {
  if (!isRecord(value)) return fail(path, 'must be an ingredient object.');
  const category = value.category === undefined || value.category === null
    ? null
    : text(value.category, `${path}.category`);
  const rawSource = value.source_text === undefined || value.source_text === null
    ? text(value.name, `${path}.name`)
    : text(value.source_text, `${path}.source_text`, true);

  return {
    id,
    name: text(value.name, `${path}.name`),
    quantity: value.quantity === undefined ? null : finiteNonNegativeOrNull(value.quantity, `${path}.quantity`),
    unit: value.unit === undefined ? null : nullableText(value.unit, `${path}.unit`),
    quantityText: value.quantity_text === undefined ? '' : text(value.quantity_text, `${path}.quantity_text`, true),
    aisle: aisleForImportCategory(category),
    sourceText: rawSource,
  };
};

const uniqueText = (items: string[]): string[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Converts one record from the documented Louis JSON export without inferring missing facts. */
export const convertImportedRecipe = (input: unknown): Recipe => {
  if (!isRecord(input)) return fail('Imported recipe', 'must be an object.');
  const id = text(input.id, 'Imported recipe.id');
  const source = input.source;
  const organization = input.organization;
  const importedNutrition = input.nutrition;
  const ingredients = input.ingredients;
  const instructions = input.instructions;
  if (!isRecord(source)) return fail(`Imported recipe ${id}.source`, 'must be an object.');
  if (!isRecord(organization)) return fail(`Imported recipe ${id}.organization`, 'must be an object.');
  if (!isRecord(importedNutrition)) return fail(`Imported recipe ${id}.nutrition`, 'must be an object.');
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return fail(`Imported recipe ${id}.ingredients`, 'must contain at least one ingredient.');
  }
  if (!Array.isArray(instructions)) return fail(`Imported recipe ${id}.instructions`, 'must be an array of text.');

  const rolesRaw = organization.suggested_meal_types;
  if (!Array.isArray(rolesRaw)) return fail(`Imported recipe ${id}.organization.suggested_meal_types`, 'must be an array.');
  const roles = rolesRaw.map((role, index) => mealType(role, `Imported recipe ${id}.organization.suggested_meal_types[${index}]`));
  const suggestedTags = organization.suggested_tags === undefined ? []
    : stringArray(organization.suggested_tags, `Imported recipe ${id}.organization.suggested_tags`);
  const userTags = organization.user_tags === undefined ? []
    : stringArray(organization.user_tags, `Imported recipe ${id}.organization.user_tags`);
  const categories = organization.user_categories === undefined ? []
    : stringArray(organization.user_categories, `Imported recipe ${id}.organization.user_categories`);
  const reportedBasis = importedNutrition.reported_basis;
  const nutritionBasis = reportedBasis === 'per_serving'
    ? 'per_serving'
    : reportedBasis === 'per_recipe'
      ? 'per_recipe'
      : reportedBasis === 'not_stated'
        ? 'not_stated'
        : 'unspecified';
  const evidenceParts = [importedNutrition.basis_evidence, importedNutrition.source_evidence]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .filter((value, index, all) => all.findIndex((candidate) => candidate === value) === index);
  const sourceEvidence = evidenceParts.length > 0 ? evidenceParts.join('\n\n') : undefined;
  const extraction = isRecord(input.extraction) ? input.extraction : null;
  const addedAtRaw = source.view_count_collected_at ?? extraction?.extracted_at ?? '1970-01-01T00:00:00.000Z';

  const candidate: Recipe = {
    id,
    name: text(input.title, `Imported recipe ${id}.title`),
    roles,
    tags: uniqueText([...suggestedTags, ...userTags]),
    categories,
    ingredients: ingredients.map((item, index) =>
      importedIngredient(item, `Imported recipe ${id}.ingredients[${index}]`, `${id}:ingredient:${index + 1}`)),
    steps: stringArray(instructions, `Imported recipe ${id}.instructions`),
    baseServings: input.servings === undefined || input.servings === null
      ? null
      : positiveOrNull(input.servings, `Imported recipe ${id}.servings`),
    nutrition: nutritionBasis === 'per_serving'
      ? importedMacroNutrition(importedNutrition.per_serving, `Imported recipe ${id}.nutrition.per_serving`)
      : emptyNutrition(),
    reportedNutrition: importedMacroNutrition(importedNutrition.reported, `Imported recipe ${id}.nutrition.reported`),
    nutritionBasis,
    ...(sourceEvidence === undefined || sourceEvidence === null
      ? {}
      : { nutritionEvidence: text(sourceEvidence, `Imported recipe ${id}.nutrition evidence`, true) }),
    sourceUrl: source.video_url === undefined ? null : nullableText(source.video_url, `Imported recipe ${id}.source.video_url`),
    sourceName: source.channel_name === undefined || source.channel_name === null
      ? 'Imported recipe'
      : text(source.channel_name, `Imported recipe ${id}.source.channel_name`),
    creatorCredit: source.original_creator_credit === undefined
      ? null
      : nullableText(source.original_creator_credit, `Imported recipe ${id}.source.original_creator_credit`),
    viewCount: source.exact_view_count === undefined || source.exact_view_count === null
      ? null
      : finiteNonNegative(source.exact_view_count, `Imported recipe ${id}.source.exact_view_count`),
    viewCountAt: source.view_count_collected_at === undefined
      ? null
      : nullableTimestamp(source.view_count_collected_at, `Imported recipe ${id}.source.view_count_collected_at`),
    image: null,
    prepMinutes: input.prep_minutes === undefined || input.prep_minutes === null
      ? null
      : finiteNonNegative(input.prep_minutes, `Imported recipe ${id}.prep_minutes`),
    cookMinutes: input.cook_minutes === undefined || input.cook_minutes === null
      ? null
      : finiteNonNegative(input.cook_minutes, `Imported recipe ${id}.cook_minutes`),
    mealPrepRating: organization.meal_prep_rating === undefined || organization.meal_prep_rating === null
      ? null
      : finiteNonNegative(organization.meal_prep_rating, `Imported recipe ${id}.organization.meal_prep_rating`),
    mealPrepNotes: organization.meal_prep_notes === undefined || organization.meal_prep_notes === null
      ? ''
      : text(organization.meal_prep_notes, `Imported recipe ${id}.organization.meal_prep_notes`, true),
    dataGaps: input.data_gaps === undefined ? [] : stringArray(input.data_gaps, `Imported recipe ${id}.data_gaps`),
    favorite: false,
    addedAt: timestamp(addedAtRaw, `Imported recipe ${id}.addedAt`),
  };

  return recipe(candidate, `Imported recipe ${id}`);
};

/** Accepts app recipes, a schemaVersion 1 bank, or the Louis {recipes: [...]} export. */
export const validateRecipes = (input: unknown): Recipe[] => {
  const rawRecipes = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.recipes)
      ? input.recipes
      : fail('Recipes', 'must be a recipe array or an object with a recipes array.');
  if (rawRecipes.length === 0) fail('Recipes', 'must contain at least one recipe.');

  const imported = isRecord(input)
    && ('schema_version' in input || rawRecipes.some((item) => isRecord(item) && 'title' in item && !('name' in item)));
  const recipes = rawRecipes.map((item, index) =>
    imported ? convertImportedRecipe(item) : recipe(item, `Recipes[${index}]`));
  const ids = new Set<string>();
  for (const item of recipes) {
    if (ids.has(item.id)) fail('Recipes', `contains duplicate id "${item.id}".`);
    ids.add(item.id);
  }
  return recipes;
};

const filters = (value: unknown, path: string): Filters => {
  if (!isRecord(value)) return fail(path, 'must be a filters object.');
  const role = value.role === 'all' ? 'all' : mealType(value.role, `${path}.role`);
  const rangesRaw = value.ranges;
  if (!isRecord(rangesRaw)) return fail(`${path}.ranges`, 'must be an object.');
  const ranges: Filters['ranges'] = {};
  for (const key of macroKeys) {
    if (rangesRaw[key] === undefined) continue;
    if (!isRecord(rangesRaw[key])) return fail(`${path}.ranges.${key}`, 'must be an object.');
    const range = rangesRaw[key];
    const min = range.min === undefined ? undefined : finiteNonNegative(range.min, `${path}.ranges.${key}.min`);
    const max = range.max === undefined ? undefined : finiteNonNegative(range.max, `${path}.ranges.${key}.max`);
    if (min === undefined && max === undefined) fail(`${path}.ranges.${key}`, 'needs a minimum or maximum.');
    if (min !== undefined && max !== undefined && min > max) fail(`${path}.ranges.${key}`, 'minimum cannot exceed maximum.');
    ranges[key] = { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
  }
  if (value.nutritionMode !== 'perServing' && value.nutritionMode !== 'reported') {
    return fail(`${path}.nutritionMode`, 'must be perServing or reported.');
  }
  if (typeof value.sort !== 'string' || !sortOrders.has(value.sort)) return fail(`${path}.sort`, 'is not a supported sort order.');
  if (typeof value.favoritesOnly !== 'boolean') return fail(`${path}.favoritesOnly`, 'must be true or false.');
  const minMealPrep = value.minMealPrep === undefined ? undefined : finiteNonNegative(value.minMealPrep, `${path}.minMealPrep`);

  return {
    search: text(value.search, `${path}.search`, true),
    role,
    tags: stringArray(value.tags, `${path}.tags`),
    categories: stringArray(value.categories, `${path}.categories`),
    includeIngredients: stringArray(value.includeIngredients, `${path}.includeIngredients`),
    excludeIngredients: stringArray(value.excludeIngredients, `${path}.excludeIngredients`),
    ranges,
    ...(minMealPrep === undefined ? {} : { minMealPrep }),
    favoritesOnly: value.favoritesOnly,
    nutritionMode: value.nutritionMode,
    sort: value.sort as Filters['sort'],
  };
};

/** Validates plan settings before a generator or backup restore uses them. */
export const validatePlanConfig = (value: unknown, path = 'Plan config'): PlanConfig => {
  if (!isRecord(value)) return fail(path, 'must be an object.');
  const days = value.days;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 7) {
    return fail(`${path}.days`, 'must be a whole number from 1 to 7.');
  }
  const people = value.people;
  if (typeof people !== 'number' || !Number.isFinite(people) || people <= 0) {
    return fail(`${path}.people`, 'must be a positive finite number.');
  }
  const slotsRaw = value.slots;
  if (!Array.isArray(slotsRaw) || slotsRaw.length === 0) return fail(`${path}.slots`, 'must contain at least one meal role.');
  const slots = slotsRaw.map((slot, index) => mealType(slot, `${path}.slots[${index}]`));
  if (new Set(slots).size !== slots.length) return fail(`${path}.slots`, 'cannot contain the same meal role twice.');
  const uniqueRecipes = value.uniqueRecipes;
  if (typeof uniqueRecipes !== 'number' || !Number.isInteger(uniqueRecipes) || uniqueRecipes < 1
    || uniqueRecipes > days * slots.length) {
    return fail(`${path}.uniqueRecipes`, `must be a whole number from 1 to ${days * slots.length}.`);
  }
  return {
    weekStart: dateOnly(value.weekStart, `${path}.weekStart`),
    days,
    people,
    slots,
    uniqueRecipes,
    filters: filters(value.filters, `${path}.filters`),
  };
};

const localDateRange = (weekStart: string, days: number): string[] => {
  const [year, month, day] = weekStart.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  });
};

const plan = (value: unknown, path: string, recipesById: Map<string, Recipe>): WeekPlan => {
  if (!isRecord(value)) return fail(path, 'must be a plan object.');
  const config = validatePlanConfig(value.config, `${path}.config`);
  const rawMeals = value.meals;
  if (!Array.isArray(rawMeals)) return fail(`${path}.meals`, 'must be an array.');
  const validDates = new Set(localDateRange(config.weekStart, config.days));
  const expectedSlots = new Set<string>();
  for (const date of validDates) for (const slot of config.slots) expectedSlots.add(`${date}|${slot}`);
  if (rawMeals.length !== expectedSlots.size) {
    return fail(`${path}.meals`, `must contain exactly ${expectedSlots.size} configured meal slots.`);
  }

  const mealIds = new Set<string>();
  const seenSlots = new Set<string>();
  const meals: PlannedMeal[] = rawMeals.map((raw, index) => {
    const mealPath = `${path}.meals[${index}]`;
    if (!isRecord(raw)) return fail(mealPath, 'must be a planned meal object.');
    const id = text(raw.id, `${mealPath}.id`);
    if (mealIds.has(id)) fail(mealPath, `duplicates meal id "${id}".`);
    mealIds.add(id);
    const date = dateOnly(raw.date, `${mealPath}.date`);
    const slot = mealType(raw.slot, `${mealPath}.slot`);
    const slotKey = `${date}|${slot}`;
    if (!expectedSlots.has(slotKey)) fail(mealPath, 'is outside this plan’s configured date and slot range.');
    if (seenSlots.has(slotKey)) fail(mealPath, 'duplicates a configured date and slot.');
    seenSlots.add(slotKey);
    const recipeId = text(raw.recipeId, `${mealPath}.recipeId`);
    const linkedRecipe = recipesById.get(recipeId);
    if (!linkedRecipe) return fail(mealPath, `references missing recipe "${recipeId}".`);
    if (!linkedRecipe.roles.includes(slot)) return fail(mealPath, `recipe "${recipeId}" is not eligible for ${slot}.`);
    const servings = finiteNonNegative(raw.servings, `${mealPath}.servings`);
    if (servings <= 0) fail(`${mealPath}.servings`, 'must be positive.');
    const locked = raw.locked;
    if (typeof locked !== 'boolean') return fail(`${mealPath}.locked`, 'must be true or false.');
    return { id, date, slot, recipeId, servings, locked };
  });
  if (seenSlots.size !== expectedSlots.size) fail(`${path}.meals`, 'does not fill every configured slot.');
  if (new Set(meals.map((item) => item.recipeId)).size !== config.uniqueRecipes) {
    fail(`${path}.meals`, `must use exactly ${config.uniqueRecipes} distinct recipes.`);
  }
  return {
    id: text(value.id, `${path}.id`),
    config,
    meals,
    createdAt: timestamp(value.createdAt, `${path}.createdAt`),
  };
};

const consumption = (value: unknown, path: string): ConsumptionEntry => {
  if (!isRecord(value)) return fail(path, 'must be a consumption entry.');
  const servings = finiteNonNegative(value.servings, `${path}.servings`);
  if (servings <= 0) fail(`${path}.servings`, 'must be positive.');
  return {
    id: text(value.id, `${path}.id`),
    date: dateOnly(value.date, `${path}.date`),
    recipeId: nullableText(value.recipeId, `${path}.recipeId`),
    name: text(value.name, `${path}.name`),
    servings,
    nutritionSnapshot: nutrition(value.nutritionSnapshot, `${path}.nutritionSnapshot`),
    createdAt: timestamp(value.createdAt, `${path}.createdAt`),
  };
};

const manualShopping = (
  value: unknown,
  path: string,
  planIds: ReadonlySet<string>,
): Record<string, ManualShoppingItem[]> => {
  if (!isRecord(value)) return fail(path, 'must be an object keyed by plan id.');
  const result: Record<string, ManualShoppingItem[]> = {};
  for (const [planId, rawItems] of Object.entries(value)) {
    if (!planIds.has(planId)) return fail(`${path}.${planId}`, 'must reference a saved plan.');
    if (!Array.isArray(rawItems)) return fail(`${path}.${planId}`, 'must be an array.');
    result[planId] = rawItems.map((raw, index) => {
      const itemPath = `${path}.${planId}[${index}]`;
      if (!isRecord(raw)) return fail(itemPath, 'must be a manual shopping item.');
      if (typeof raw.checked !== 'boolean') return fail(`${itemPath}.checked`, 'must be true or false.');
      return {
        id: text(raw.id, `${itemPath}.id`),
        name: text(raw.name, `${itemPath}.name`),
        quantityText: text(raw.quantityText, `${itemPath}.quantityText`, true),
        checked: raw.checked,
      };
    });
  }
  return result;
};

/** Validates a complete offline backup and returns a safe, canonical state copy. */
export const validateState = (input: unknown): AppState => {
  if (!isRecord(input)) return fail('Backup', 'must be an object.');
  if (input.version !== 1) return fail('Backup.version', 'must be 1.');
  const recipes = validateRecipes(input.recipes);
  const recipesById = new Map(recipes.map((item) => [item.id, item]));
  const rawPlans = input.plans;
  if (!Array.isArray(rawPlans)) return fail('Backup.plans', 'must be an array.');
  const plans = rawPlans.map((item, index) => plan(item, `Backup.plans[${index}]`, recipesById));
  const planIds = new Set<string>();
  for (const item of plans) {
    if (planIds.has(item.id)) fail('Backup.plans', `contains duplicate id "${item.id}".`);
    planIds.add(item.id);
  }
  const activePlanId = nullableText(input.activePlanId, 'Backup.activePlanId');
  if (activePlanId !== null && !planIds.has(activePlanId)) fail('Backup.activePlanId', 'must reference a saved plan or be null.');
  const rawLogs = input.logs;
  if (!Array.isArray(rawLogs)) return fail('Backup.logs', 'must be an array.');
  const logs = rawLogs.map((item, index) => consumption(item, `Backup.logs[${index}]`));
  const logIds = new Set<string>();
  for (const item of logs) {
    if (logIds.has(item.id)) fail('Backup.logs', `contains duplicate id "${item.id}".`);
    logIds.add(item.id);
  }
  const rawShoppingChecks = input.shoppingChecks;
  if (!isRecord(rawShoppingChecks)) return fail('Backup.shoppingChecks', 'must be an object.');
  const shoppingChecks: AppState['shoppingChecks'] = {};
  const validShoppingCheckKeys = new Set(
    plans.flatMap((plan) =>
      buildShoppingList(plan, recipes).map((item) => `${plan.id}:${item.key}`)),
  );
  for (const [key, value] of Object.entries(rawShoppingChecks)) {
    if (!validShoppingCheckKeys.has(key)) {
      return fail(`Backup.shoppingChecks.${key}`, 'must reference a current item in a saved plan.');
    }
    if (value !== 'checked' && value !== 'owned' && value !== null) {
      return fail(`Backup.shoppingChecks.${key}`, 'must be checked, owned, or null.');
    }
    shoppingChecks[key] = value;
  }

  return {
    version: 1,
    recipes,
    plans,
    activePlanId,
    logs,
    targets: nutrition(input.targets, 'Backup.targets'),
    shoppingChecks,
    manualShopping: manualShopping(input.manualShopping, 'Backup.manualShopping', planIds),
  };
};
