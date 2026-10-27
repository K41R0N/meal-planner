import type {
  ConsumptionEntry,
  Filters,
  MacroKey,
  MealType,
  Nutrition,
  Recipe,
  WeekPlan,
} from './types';
import { emptyNutrition, mealTypes } from './types';
import type {
  BatchChoice,
  BatchPlanRequest,
  BatchUse,
  BatchWeek,
  CookingSession,
  CookingTimer,
  CookingWindow,
  DailyChoice,
  ExperienceState,
  FoodStorage,
  GroceryCoverage,
  PreparedBatch,
  PurchaseMatch,
  PurchaseRecord,
  RecipeProfile,
  ShoppingIntent,
} from './experience-types';

type UnknownRecord = Record<string, unknown>;
type RecipeValidator = (value: unknown, path: string) => Recipe;

const macroKeys: MacroKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];
const sortOrders = new Set([
  'popular',
  'name',
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'sodium',
  'mealPrep',
  'newest',
]);
const storageKinds = new Set<FoodStorage>(['unconfirmed', 'fridge', 'freezer', 'other']);
const timingFits = new Set<BatchChoice['timingFit']>(['confirmed', 'unknown', 'over_budget']);
const choiceOrigins = new Set<DailyChoice['origin']>(['week', 'pinned', 'book', 'ready']);
const htmlTag = /<\/?[a-z][^>]*>/i;
const MAX_TEXT = 10_000;
const MAX_NOTES = 32_000;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const fail = (path: string, message: string): never => {
  throw new Error(`${path}: ${message}`);
};

const text = (
  value: unknown,
  path: string,
  options: { allowEmpty?: boolean; max?: number } = {},
): string => {
  if (typeof value !== 'string') return fail(path, 'must be text.');
  const result = value.trim();
  if (!options.allowEmpty && !result) return fail(path, 'must not be empty.');
  if (result.length > (options.max ?? MAX_TEXT))
    return fail(path, `must be no longer than ${options.max ?? MAX_TEXT} characters.`);
  if (htmlTag.test(result)) return fail(path, 'must be plain text, not HTML.');
  return result;
};

const nullableText = (
  value: unknown,
  path: string,
  options: { allowEmpty?: boolean; max?: number } = {},
): string | null => (value === null ? null : text(value, path, options));

const finite = (value: unknown, path: string, minimum = 0): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum)
    return fail(path, `must be a finite number no less than ${minimum}.`);
  return value;
};

const positive = (value: unknown, path: string): number => {
  const result = finite(value, path, 0);
  if (result <= 0) return fail(path, 'must be positive.');
  return result;
};

const nullableFinite = (value: unknown, path: string): number | null =>
  value === null ? null : finite(value, path);
const nullablePositive = (value: unknown, path: string): number | null =>
  value === null ? null : positive(value, path);

const integer = (value: unknown, path: string, minimum = 0): number => {
  const result = finite(value, path, minimum);
  if (!Number.isInteger(result)) return fail(path, 'must be a whole number.');
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
  if (!isDateOnly(result)) return fail(path, 'must use a real YYYY-MM-DD date.');
  return result;
};

const timestamp = (value: unknown, path: string): string => {
  const result = text(value, path);
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      result,
    );
  if (!match) return fail(path, 'must use an ISO 8601 timestamp with a timezone.');
  const [year, month, day, hour, minute, second, fraction = '', , , offsetHour, offsetMinute] =
    match.slice(1);
  const [numericYear, numericMonth, numericDay, numericHour, numericMinute, numericSecond] = [
    year,
    month,
    day,
    hour,
    minute,
    second,
  ].map(Number);
  const checked = new Date(
    Date.UTC(
      numericYear,
      numericMonth - 1,
      numericDay,
      numericHour,
      numericMinute,
      numericSecond,
      Number(fraction.slice(0, 3).padEnd(3, '0')),
    ),
  );
  if (
    checked.getUTCFullYear() !== numericYear ||
    checked.getUTCMonth() !== numericMonth - 1 ||
    checked.getUTCDate() !== numericDay ||
    checked.getUTCHours() !== numericHour ||
    checked.getUTCMinutes() !== numericMinute ||
    checked.getUTCSeconds() !== numericSecond ||
    (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59))
  ) {
    return fail(path, 'must use a real ISO 8601 timestamp with a timezone.');
  }
  return result;
};

const nullableTimestamp = (value: unknown, path: string): string | null =>
  value === null ? null : timestamp(value, path);

const timeOfDay = (value: unknown, path: string): string => {
  const result = text(value, path);
  const match = /^(\d{2}):(\d{2})$/.exec(result);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59)
    return fail(path, 'must use a real HH:MM time.');
  return result;
};

const mealType = (value: unknown, path: string): MealType => {
  if (typeof value !== 'string' || !mealTypes.includes(value as MealType))
    return fail(path, `must be one of: ${mealTypes.join(', ')}.`);
  return value as MealType;
};

const stringArray = (
  value: unknown,
  path: string,
  options: { allowEmpty?: boolean; max?: number } = {},
): string[] => {
  if (!Array.isArray(value)) return fail(path, 'must be an array of text.');
  return value.map((item, index) => text(item, `${path}[${index}]`, options));
};

const unique = <T extends string>(items: T[], path: string): T[] => {
  if (new Set(items).size !== items.length) fail(path, 'must not contain duplicates.');
  return items;
};

const nutrition = (value: unknown, path: string): Nutrition => {
  if (!isRecord(value)) return fail(path, 'must be a nutrition object.');
  const result = emptyNutrition();
  for (const key of macroKeys)
    result[key] = value[key] === null ? null : finite(value[key], `${path}.${key}`);
  return result;
};

const filters = (value: unknown, path: string): Filters => {
  if (!isRecord(value)) return fail(path, 'must be a filters object.');
  const role = value.role === 'all' ? 'all' : mealType(value.role, `${path}.role`);
  if (!isRecord(value.ranges)) return fail(`${path}.ranges`, 'must be an object.');
  const ranges: Filters['ranges'] = {};
  for (const key of macroKeys) {
    const raw = value.ranges[key];
    if (raw === undefined) continue;
    if (!isRecord(raw)) return fail(`${path}.ranges.${key}`, 'must be an object.');
    const min = raw.min === undefined ? undefined : finite(raw.min, `${path}.ranges.${key}.min`);
    const max = raw.max === undefined ? undefined : finite(raw.max, `${path}.ranges.${key}.max`);
    if (min === undefined && max === undefined)
      return fail(`${path}.ranges.${key}`, 'needs a minimum or maximum.');
    if (min !== undefined && max !== undefined && min > max)
      return fail(`${path}.ranges.${key}`, 'minimum cannot exceed maximum.');
    ranges[key] = { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
  }
  if (value.nutritionMode !== 'perServing' && value.nutritionMode !== 'reported')
    return fail(`${path}.nutritionMode`, 'must be perServing or reported.');
  if (typeof value.sort !== 'string' || !sortOrders.has(value.sort))
    return fail(`${path}.sort`, 'is not a supported sort order.');
  if (typeof value.favoritesOnly !== 'boolean')
    return fail(`${path}.favoritesOnly`, 'must be true or false.');
  const minMealPrep =
    value.minMealPrep === undefined ? undefined : finite(value.minMealPrep, `${path}.minMealPrep`);
  return {
    search: text(value.search, `${path}.search`, { allowEmpty: true }),
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

const cookingWindow = (value: unknown, path: string): CookingWindow => {
  if (!isRecord(value)) return fail(path, 'must be a cooking window.');
  return {
    id: text(value.id, `${path}.id`),
    date: dateOnly(value.date, `${path}.date`),
    startTime: timeOfDay(value.startTime, `${path}.startTime`),
    availableMinutes: finite(value.availableMinutes, `${path}.availableMinutes`),
  };
};

const timer = (value: unknown, path: string): CookingTimer => {
  if (!isRecord(value)) return fail(path, 'must be a cooking timer.');
  const durationSeconds = positive(value.durationSeconds, `${path}.durationSeconds`);
  const remainingSeconds = finite(value.remainingSeconds, `${path}.remainingSeconds`);
  if (remainingSeconds > durationSeconds)
    return fail(`${path}.remainingSeconds`, 'cannot exceed durationSeconds.');
  const endsAt = value.endsAt === null ? null : finite(value.endsAt, `${path}.endsAt`);
  return {
    id: text(value.id, `${path}.id`),
    label: text(value.label, `${path}.label`),
    durationSeconds,
    endsAt,
    remainingSeconds,
  };
};

const recipeProfile = (value: unknown, path: string): RecipeProfile => {
  if (!isRecord(value)) return fail(path, 'must be a recipe profile.');
  if (typeof value.portionSizeConfirmed !== 'boolean')
    return fail(`${path}.portionSizeConfirmed`, 'must be true or false.');
  if (typeof value.equipmentConfirmed !== 'boolean')
    return fail(`${path}.equipmentConfirmed`, 'must be true or false.');
  return {
    yieldUnit: text(value.yieldUnit, `${path}.yieldUnit`),
    sourceUnitsPerPortion: positive(value.sourceUnitsPerPortion, `${path}.sourceUnitsPerPortion`),
    portionSizeConfirmed: value.portionSizeConfirmed,
    activeMinutes: nullableFinite(value.activeMinutes, `${path}.activeMinutes`),
    elapsedMinutes: nullableFinite(value.elapsedMinutes, `${path}.elapsedMinutes`),
    reheatMinutes: nullableFinite(value.reheatMinutes, `${path}.reheatMinutes`),
    equipment: unique(stringArray(value.equipment, `${path}.equipment`), `${path}.equipment`),
    equipmentConfirmed: value.equipmentConfirmed,
    reheatNotes: text(value.reheatNotes, `${path}.reheatNotes`, {
      allowEmpty: true,
      max: MAX_NOTES,
    }),
    notes: text(value.notes, `${path}.notes`, { allowEmpty: true, max: MAX_NOTES }),
  };
};

const planRequest = (value: unknown, path: string): BatchPlanRequest => {
  if (!isRecord(value)) return fail(path, 'must be a batch plan request.');
  if (!Array.isArray(value.slots) || value.slots.length === 0)
    return fail(`${path}.slots`, 'must contain at least one meal role.');
  const slots = unique(
    value.slots.map((item, index) => mealType(item, `${path}.slots[${index}]`)),
    `${path}.slots`,
  );
  const rawWindows = value.windows;
  if (!Array.isArray(rawWindows)) return fail(`${path}.windows`, 'must be an array.');
  const windows = rawWindows.map((item, index) => cookingWindow(item, `${path}.windows[${index}]`));
  unique(
    windows.map((item) => item.id),
    `${path}.windows`,
  );
  const days = integer(value.days, `${path}.days`, 1);
  if (days > 7) return fail(`${path}.days`, 'must be no greater than 7.');
  if (
    typeof value.strictTiming !== 'boolean' ||
    typeof value.reuseReady !== 'boolean' ||
    typeof value.reuseOneOffs !== 'boolean'
  ) {
    return fail(path, 'must contain true or false planning flags.');
  }
  return {
    weekStart: dateOnly(value.weekStart, `${path}.weekStart`),
    days,
    people: positive(value.people, `${path}.people`),
    slots,
    distinctRecipes: integer(value.distinctRecipes, `${path}.distinctRecipes`, 1),
    targetPortions: positive(value.targetPortions, `${path}.targetPortions`),
    windows,
    filters: filters(value.filters, `${path}.filters`),
    strictTiming: value.strictTiming,
    reuseReady: value.reuseReady,
    reuseOneOffs: value.reuseOneOffs,
  };
};

const batchChoice = (value: unknown, path: string): BatchChoice => {
  if (!isRecord(value)) return fail(path, 'must be a batch choice.');
  if (typeof value.locked !== 'boolean' || typeof value.reuseReady !== 'boolean')
    return fail(path, 'must contain true or false batch flags.');
  if (
    typeof value.timingFit !== 'string' ||
    !timingFits.has(value.timingFit as BatchChoice['timingFit'])
  )
    return fail(`${path}.timingFit`, 'must be confirmed, unknown, or over_budget.');
  return {
    id: text(value.id, `${path}.id`),
    recipeId: text(value.recipeId, `${path}.recipeId`),
    sourceServings: positive(value.sourceServings, `${path}.sourceServings`),
    portions: positive(value.portions, `${path}.portions`),
    sourceUnitsPerPortion: positive(value.sourceUnitsPerPortion, `${path}.sourceUnitsPerPortion`),
    windowId: nullableText(value.windowId, `${path}.windowId`),
    locked: value.locked,
    readyBatchId: nullableText(value.readyBatchId, `${path}.readyBatchId`),
    reuseReady: value.reuseReady,
    shoppingIntentId: nullableText(value.shoppingIntentId, `${path}.shoppingIntentId`),
    explanations: stringArray(value.explanations, `${path}.explanations`),
    timingFit: value.timingFit as BatchChoice['timingFit'],
  };
};

const batchUse = (value: unknown, path: string): BatchUse => {
  if (!isRecord(value)) return fail(path, 'must be a batch use.');
  if (typeof value.locked !== 'boolean' || typeof value.skipped !== 'boolean')
    return fail(path, 'must contain true or false use flags.');
  return {
    id: text(value.id, `${path}.id`),
    choiceId: text(value.choiceId, `${path}.choiceId`),
    date: dateOnly(value.date, `${path}.date`),
    slot: mealType(value.slot, `${path}.slot`),
    portions: positive(value.portions, `${path}.portions`),
    locked: value.locked,
    skipped: value.skipped,
  };
};

const batchWeek = (value: unknown, path: string): BatchWeek => {
  if (!isRecord(value)) return fail(path, 'must be a batch week.');
  if (!Array.isArray(value.slots) || value.slots.length === 0)
    return fail(`${path}.slots`, 'must contain at least one meal role.');
  const slots = unique(
    value.slots.map((item, index) => mealType(item, `${path}.slots[${index}]`)),
    `${path}.slots`,
  );
  const days = integer(value.days, `${path}.days`, 1);
  if (days > 7) return fail(`${path}.days`, 'must be no greater than 7.');
  if (typeof value.confirmed !== 'boolean')
    return fail(`${path}.confirmed`, 'must be true or false.');
  const rawWindows = value.windows;
  const rawChoices = value.choices;
  const rawUses = value.uses;
  if (!Array.isArray(rawWindows) || !Array.isArray(rawChoices) || !Array.isArray(rawUses))
    return fail(path, 'must have windows, choices, and uses arrays.');
  const windows = rawWindows.map((item, index) => cookingWindow(item, `${path}.windows[${index}]`));
  unique(
    windows.map((item) => item.id),
    `${path}.windows`,
  );
  const choices = rawChoices.map((item, index) => batchChoice(item, `${path}.choices[${index}]`));
  unique(
    choices.map((item) => item.id),
    `${path}.choices`,
  );
  const uses = rawUses.map((item, index) => batchUse(item, `${path}.uses[${index}]`));
  unique(
    uses.map((item) => item.id),
    `${path}.uses`,
  );
  return {
    id: text(value.id, `${path}.id`),
    label: text(value.label, `${path}.label`),
    weekStart: dateOnly(value.weekStart, `${path}.weekStart`),
    days,
    people: positive(value.people, `${path}.people`),
    slots,
    windows,
    choices,
    uses,
    confirmed: value.confirmed,
    createdAt: timestamp(value.createdAt, `${path}.createdAt`),
    legacyPlanId: nullableText(value.legacyPlanId, `${path}.legacyPlanId`),
  };
};

const dailyChoice = (value: unknown, path: string): DailyChoice => {
  if (!isRecord(value)) return fail(path, 'must be a daily choice.');
  if (typeof value.origin !== 'string' || !choiceOrigins.has(value.origin as DailyChoice['origin']))
    return fail(`${path}.origin`, 'must be week, pinned, book, or ready.');
  return {
    id: text(value.id, `${path}.id`),
    date: dateOnly(value.date, `${path}.date`),
    slot: mealType(value.slot, `${path}.slot`),
    recipeId: text(value.recipeId, `${path}.recipeId`),
    origin: value.origin as DailyChoice['origin'],
    useId: nullableText(value.useId, `${path}.useId`),
    batchId: nullableText(value.batchId, `${path}.batchId`),
    sessionId: nullableText(value.sessionId, `${path}.sessionId`),
    logId: nullableText(value.logId, `${path}.logId`),
  };
};

const cookingSession = (
  value: unknown,
  path: string,
  validateRecipe: RecipeValidator,
): CookingSession => {
  if (!isRecord(value)) return fail(path, 'must be a cooking session.');
  const snapshot = validateRecipe(value.recipeSnapshot, `${path}.recipeSnapshot`);
  const checkedIngredientIds = unique(
    stringArray(value.checkedIngredientIds, `${path}.checkedIngredientIds`),
    `${path}.checkedIngredientIds`,
  );
  const ingredientIds = new Set(snapshot.ingredients.map((item) => item.id));
  for (const ingredientId of checkedIngredientIds)
    if (!ingredientIds.has(ingredientId))
      return fail(
        `${path}.checkedIngredientIds`,
        `references missing snapshot ingredient "${ingredientId}".`,
      );
  const rawTimers = value.timers;
  if (!Array.isArray(rawTimers)) return fail(`${path}.timers`, 'must be an array.');
  const timers = rawTimers.map((item, index) => timer(item, `${path}.timers[${index}]`));
  unique(
    timers.map((item) => item.id),
    `${path}.timers`,
  );
  const stepIndex = integer(value.stepIndex, `${path}.stepIndex`);
  if (snapshot.steps.length > 0 && stepIndex >= snapshot.steps.length)
    return fail(`${path}.stepIndex`, 'must reference a snapshot method step.');
  return {
    id: text(value.id, `${path}.id`),
    recipeId: text(value.recipeId, `${path}.recipeId`),
    recipeSnapshot: snapshot,
    sourceServings: positive(value.sourceServings, `${path}.sourceServings`),
    stepIndex,
    checkedIngredientIds,
    timers,
    startedAt: timestamp(value.startedAt, `${path}.startedAt`),
    updatedAt: timestamp(value.updatedAt, `${path}.updatedAt`),
    finishedAt: nullableTimestamp(value.finishedAt, `${path}.finishedAt`),
    weekId: nullableText(value.weekId, `${path}.weekId`),
    choiceId: nullableText(value.choiceId, `${path}.choiceId`),
  };
};

const preparedBatch = (
  value: unknown,
  path: string,
  validateRecipe: RecipeValidator,
): PreparedBatch => {
  if (!isRecord(value)) return fail(path, 'must be a prepared batch.');
  const storage = value.storage;
  if (typeof storage !== 'string' || !storageKinds.has(storage as FoodStorage))
    return fail(`${path}.storage`, 'must be a supported storage state.');
  const snapshot = validateRecipe(value.recipeSnapshot, `${path}.recipeSnapshot`);
  return {
    id: text(value.id, `${path}.id`),
    sessionId: text(value.sessionId, `${path}.sessionId`),
    recipeId: text(value.recipeId, `${path}.recipeId`),
    recipeSnapshot: snapshot,
    preparedSourceServings: positive(
      value.preparedSourceServings,
      `${path}.preparedSourceServings`,
    ),
    actualYield: positive(value.actualYield, `${path}.actualYield`),
    yieldUnit: text(value.yieldUnit, `${path}.yieldUnit`),
    nutritionPerUnit: nutrition(value.nutritionPerUnit, `${path}.nutritionPerUnit`),
    madeAt: timestamp(value.madeAt, `${path}.madeAt`),
    storage: storage as FoodStorage,
    storageNotes: text(value.storageNotes, `${path}.storageNotes`, {
      allowEmpty: true,
      max: MAX_NOTES,
    }),
    reheatNotes: text(value.reheatNotes, `${path}.reheatNotes`, {
      allowEmpty: true,
      max: MAX_NOTES,
    }),
    weekId: nullableText(value.weekId, `${path}.weekId`),
    choiceId: nullableText(value.choiceId, `${path}.choiceId`),
  };
};

const shoppingIntent = (
  value: unknown,
  path: string,
  validateRecipe: RecipeValidator,
): ShoppingIntent => {
  if (!isRecord(value)) return fail(path, 'must be a shopping intent.');
  const snapshot = validateRecipe(value.recipeSnapshot, `${path}.recipeSnapshot`);
  if (typeof value.fulfilled !== 'boolean')
    return fail(`${path}.fulfilled`, 'must be true or false.');
  return {
    id: text(value.id, `${path}.id`),
    recipeId: text(value.recipeId, `${path}.recipeId`),
    recipeSnapshot: snapshot,
    sourceServings: positive(value.sourceServings, `${path}.sourceServings`),
    createdAt: timestamp(value.createdAt, `${path}.createdAt`),
    fulfilled: value.fulfilled,
  };
};

const purchaseMatch = (value: unknown, path: string): PurchaseMatch => {
  if (!isRecord(value)) return fail(path, 'must be a purchase match.');
  const names = unique(stringArray(value.names, `${path}.names`), `${path}.names`);
  if (names.length === 0)
    return fail(`${path}.names`, 'must contain at least one ingredient name.');
  return {
    id: text(value.id, `${path}.id`),
    names,
    purchaseName: text(value.purchaseName, `${path}.purchaseName`),
    prepNote: text(value.prepNote, `${path}.prepNote`, { allowEmpty: true, max: MAX_NOTES }),
    confirmedAt: timestamp(value.confirmedAt, `${path}.confirmedAt`),
  };
};

const groceryCoverage = (value: unknown, path: string): GroceryCoverage => {
  if (!isRecord(value)) return fail(path, 'must be grocery coverage.');
  if (typeof value.ownedUnspecified !== 'boolean' || typeof value.boughtUnspecified !== 'boolean')
    return fail(path, 'must contain true or false coverage flags.');
  return {
    ownedQuantity: nullableFinite(value.ownedQuantity, `${path}.ownedQuantity`),
    boughtQuantity: nullableFinite(value.boughtQuantity, `${path}.boughtQuantity`),
    ownedUnspecified: value.ownedUnspecified,
    boughtUnspecified: value.boughtUnspecified,
    requiredAtCheck: nullableFinite(value.requiredAtCheck, `${path}.requiredAtCheck`),
    intentionIds: unique(
      stringArray(value.intentionIds, `${path}.intentionIds`),
      `${path}.intentionIds`,
    ),
    scopeId: text(value.scopeId, `${path}.scopeId`),
    updatedAt: timestamp(value.updatedAt, `${path}.updatedAt`),
  };
};

const purchaseRecord = (value: unknown, path: string): PurchaseRecord => {
  if (!isRecord(value)) return fail(path, 'must be a purchase record.');
  return {
    id: text(value.id, `${path}.id`),
    itemKey: text(value.itemKey, `${path}.itemKey`),
    name: text(value.name, `${path}.name`),
    quantity: nullableFinite(value.quantity, `${path}.quantity`),
    unit: nullableText(value.unit, `${path}.unit`),
    intentionIds: unique(
      stringArray(value.intentionIds, `${path}.intentionIds`),
      `${path}.intentionIds`,
    ),
    scopeId: text(value.scopeId, `${path}.scopeId`),
    purchasedAt: timestamp(value.purchasedAt, `${path}.purchasedAt`),
  };
};

const manualItems = (value: unknown, path: string): ExperienceState['manualItems'] => {
  if (!Array.isArray(value)) return fail(path, 'must be an array.');
  const items = value.map((raw, index) => {
    if (!isRecord(raw)) return fail(`${path}[${index}]`, 'must be a manual shopping item.');
    if (typeof raw.checked !== 'boolean')
      return fail(`${path}[${index}].checked`, 'must be true or false.');
    return {
      id: text(raw.id, `${path}[${index}].id`),
      name: text(raw.name, `${path}[${index}].name`),
      quantityText: text(raw.quantityText, `${path}[${index}].quantityText`, { allowEmpty: true }),
      checked: raw.checked,
    };
  });
  unique(
    items.map((item) => item.id),
    path,
  );
  return items;
};

const stringRecord = (value: unknown, path: string): Record<string, string> => {
  if (!isRecord(value)) return fail(path, 'must be an object.');
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value))
    result[text(key, `${path} key`)] = text(item, `${path}.${key}`, { allowEmpty: true });
  return result;
};

export interface ExperienceValidationContext {
  recipes: readonly Recipe[];
  plans: readonly WeekPlan[];
  logs: readonly ConsumptionEntry[];
  validateRecipe: RecipeValidator;
}

/** Validates only the optional redesign extension; legacy state is validated separately. */
export const validateExperienceState = (
  value: unknown,
  context: ExperienceValidationContext,
): ExperienceState => {
  const path = 'Backup.experience';
  if (!isRecord(value)) return fail(path, 'must be an object.');
  if (value.version !== 1) return fail(`${path}.version`, 'must be 1.');
  const rawDailyChoices = value.dailyChoices;
  const rawSessions = value.sessions;
  const rawBatches = value.batches;
  const rawWeeks = value.weeks;
  const rawOneOffs = value.oneOffs;
  const rawPurchaseMatches = value.purchaseMatches;
  const rawPurchases = value.purchases;
  const rawManualItems = value.manualItems;
  const requiredArrays: Array<[string, unknown]> = [
    ['dailyChoices', rawDailyChoices],
    ['sessions', rawSessions],
    ['batches', rawBatches],
    ['weeks', rawWeeks],
    ['oneOffs', rawOneOffs],
    ['purchaseMatches', rawPurchaseMatches],
    ['purchases', rawPurchases],
    ['manualItems', rawManualItems],
  ];
  for (const [key, collection] of requiredArrays)
    if (!Array.isArray(collection)) return fail(`${path}.${key}`, 'must be an array.');
  if (
    !isRecord(value.recipeProfiles) ||
    !isRecord(value.groceryCoverage) ||
    !isRecord(value.groceryChanges) ||
    !isRecord(value.aisleOverrides)
  )
    return fail(path, 'contains an invalid keyed collection.');

  const recipesById = new Map(context.recipes.map((item) => [item.id, item]));
  const plansById = new Map(context.plans.map((item) => [item.id, item]));
  const dailyChoices = (rawDailyChoices as unknown[]).map((item, index) =>
    dailyChoice(item, `${path}.dailyChoices[${index}]`),
  );
  unique(
    dailyChoices.map((item) => item.id),
    `${path}.dailyChoices`,
  );
  unique(
    dailyChoices.map((item) => `${item.date}|${item.slot}`),
    `${path}.dailyChoices`,
  );
  const sessions = (rawSessions as unknown[]).map((item, index) =>
    cookingSession(item, `${path}.sessions[${index}]`, context.validateRecipe),
  );
  unique(
    sessions.map((item) => item.id),
    `${path}.sessions`,
  );
  const batches = (rawBatches as unknown[]).map((item, index) =>
    preparedBatch(item, `${path}.batches[${index}]`, context.validateRecipe),
  );
  unique(
    batches.map((item) => item.id),
    `${path}.batches`,
  );
  unique(
    batches.map((item) => item.sessionId),
    `${path}.batches`,
  );
  const weeks = (rawWeeks as unknown[]).map((item, index) =>
    batchWeek(item, `${path}.weeks[${index}]`),
  );
  unique(
    weeks.map((item) => item.id),
    `${path}.weeks`,
  );
  const oneOffs = (rawOneOffs as unknown[]).map((item, index) =>
    shoppingIntent(item, `${path}.oneOffs[${index}]`, context.validateRecipe),
  );
  unique(
    oneOffs.map((item) => item.id),
    `${path}.oneOffs`,
  );
  const purchaseMatches = (rawPurchaseMatches as unknown[]).map((item, index) =>
    purchaseMatch(item, `${path}.purchaseMatches[${index}]`),
  );
  unique(
    purchaseMatches.map((item) => item.id),
    `${path}.purchaseMatches`,
  );
  const purchases = (rawPurchases as unknown[]).map((item, index) =>
    purchaseRecord(item, `${path}.purchases[${index}]`),
  );
  unique(
    purchases.map((item) => item.id),
    `${path}.purchases`,
  );
  const profiles: Record<string, RecipeProfile> = {};
  for (const [recipeId, profile] of Object.entries(value.recipeProfiles)) {
    if (!recipesById.has(recipeId))
      return fail(`${path}.recipeProfiles.${recipeId}`, 'references a missing saved recipe.');
    profiles[text(recipeId, `${path}.recipeProfiles key`)] = recipeProfile(
      profile,
      `${path}.recipeProfiles.${recipeId}`,
    );
  }
  const coverage: Record<string, GroceryCoverage> = {};
  for (const [key, item] of Object.entries(value.groceryCoverage))
    coverage[text(key, `${path}.groceryCoverage key`)] = groceryCoverage(
      item,
      `${path}.groceryCoverage.${key}`,
    );
  const activeWeekId = nullableText(value.activeWeekId, `${path}.activeWeekId`);
  const lastPlanRequest =
    value.lastPlanRequest === null
      ? null
      : planRequest(value.lastPlanRequest, `${path}.lastPlanRequest`);
  const result: ExperienceState = {
    version: 1,
    dailyChoices,
    sessions,
    batches,
    weeks,
    activeWeekId,
    oneOffs,
    recipeProfiles: profiles,
    purchaseMatches,
    groceryCoverage: coverage,
    purchases,
    manualItems: manualItems(rawManualItems, `${path}.manualItems`),
    lastPlanRequest,
    groceryChanges: stringRecord(value.groceryChanges, `${path}.groceryChanges`),
    aisleOverrides: stringRecord(value.aisleOverrides, `${path}.aisleOverrides`),
    preferredSlot: mealType(value.preferredSlot, `${path}.preferredSlot`),
  };

  const weeksById = new Map(weeks.map((item) => [item.id, item]));
  if (activeWeekId !== null && !weeksById.has(activeWeekId))
    return fail(`${path}.activeWeekId`, 'must reference a saved batch week or be null.');
  const choicesById = new Map<string, BatchChoice>();
  const usesById = new Map<string, BatchUse>();
  const windowsById = new Set<string>();
  for (const week of weeks) {
    if (week.legacyPlanId !== null) {
      if (!plansById.has(week.legacyPlanId))
        return fail(`${path}.weeks.${week.id}.legacyPlanId`, 'references a missing legacy plan.');
      if (week.id !== week.legacyPlanId)
        return fail(
          `${path}.weeks.${week.id}.legacyPlanId`,
          'must use the same id as its adapted legacy plan.',
        );
    }
    for (const window of week.windows) windowsById.add(window.id);
    for (const choice of week.choices) {
      if (choicesById.has(choice.id))
        return fail(`${path}.weeks`, `contains duplicate batch choice id "${choice.id}".`);
      if (!recipesById.has(choice.recipeId))
        return fail(
          `${path}.weeks.${week.id}.choices.${choice.id}.recipeId`,
          'references a missing saved recipe.',
        );
      choicesById.set(choice.id, choice);
    }
    for (const use of week.uses) {
      if (usesById.has(use.id))
        return fail(`${path}.weeks`, `contains duplicate batch use id "${use.id}".`);
      const choice = week.choices.find((item) => item.id === use.choiceId);
      if (!choice)
        return fail(
          `${path}.weeks.${week.id}.uses.${use.id}.choiceId`,
          'must reference a choice in the same batch week.',
        );
      // Meal eligibility is checked when proposing/moving a meal, not against
      // subsequently edited book labels when restoring its saved placement.
      usesById.set(use.id, use);
    }
    for (const choice of week.choices) {
      if (choice.windowId !== null && !week.windows.some((item) => item.id === choice.windowId))
        return fail(
          `${path}.weeks.${week.id}.choices.${choice.id}.windowId`,
          'must reference a window in the same batch week.',
        );
    }
  }

  const sessionsById = new Map(sessions.map((item) => [item.id, item]));
  const batchesById = new Map(batches.map((item) => [item.id, item]));
  const dailyById = new Map(dailyChoices.map((item) => [item.id, item]));
  const oneOffsById = new Map(oneOffs.map((item) => [item.id, item]));
  const logsById = new Map(context.logs.map((item) => [item.id, item]));
  for (const session of sessions) {
    if (session.recipeSnapshot.id !== session.recipeId)
      return fail(`${path}.sessions.${session.id}.recipeSnapshot`, 'must match recipeId.');
    if (session.weekId !== null && !weeksById.has(session.weekId))
      return fail(`${path}.sessions.${session.id}.weekId`, 'references a missing batch week.');
    if (session.choiceId !== null) {
      const choice = dailyById.get(session.choiceId);
      if (!choice)
        return fail(
          `${path}.sessions.${session.id}.choiceId`,
          'references a missing daily choice.',
        );
      if (choice.recipeId !== session.recipeId)
        return fail(`${path}.sessions.${session.id}.choiceId`, 'must match the selected recipe.');
    }
  }
  for (const batch of batches) {
    const session = sessionsById.get(batch.sessionId);
    if (!session)
      return fail(`${path}.batches.${batch.id}.sessionId`, 'references a missing cooking session.');
    if (batch.recipeSnapshot.id !== batch.recipeId || session.recipeId !== batch.recipeId)
      return fail(
        `${path}.batches.${batch.id}.recipeSnapshot`,
        'must match its cooking session recipe.',
      );
    if (session.finishedAt === null)
      return fail(
        `${path}.batches.${batch.id}.sessionId`,
        'must reference a finished cooking session.',
      );
    if (batch.weekId !== null && !weeksById.has(batch.weekId))
      return fail(`${path}.batches.${batch.id}.weekId`, 'references a missing batch week.');
    if (batch.choiceId !== null) {
      const choice = dailyById.get(batch.choiceId);
      if (!choice)
        return fail(`${path}.batches.${batch.id}.choiceId`, 'references a missing daily choice.');
      if (choice.recipeId !== batch.recipeId || choice.batchId !== batch.id)
        return fail(
          `${path}.batches.${batch.id}.choiceId`,
          'must match the attached daily choice.',
        );
    }
  }
  for (const oneOff of oneOffs)
    if (oneOff.recipeSnapshot.id !== oneOff.recipeId)
      return fail(`${path}.oneOffs.${oneOff.id}.recipeSnapshot`, 'must match recipeId.');
  for (const choice of dailyChoices) {
    if (choice.batchId !== null) {
      const batch = batchesById.get(choice.batchId);
      if (!batch)
        return fail(
          `${path}.dailyChoices.${choice.id}.batchId`,
          'references a missing prepared batch.',
        );
      if (batch.recipeId !== choice.recipeId)
        return fail(`${path}.dailyChoices.${choice.id}.batchId`, 'must match the selected recipe.');
    } else if (!recipesById.has(choice.recipeId)) {
      return fail(
        `${path}.dailyChoices.${choice.id}.recipeId`,
        'references a missing saved recipe.',
      );
    }
    if (choice.sessionId !== null && !sessionsById.has(choice.sessionId))
      return fail(
        `${path}.dailyChoices.${choice.id}.sessionId`,
        'references a missing cooking session.',
      );
    if (choice.useId !== null && !usesById.has(choice.useId))
      return fail(`${path}.dailyChoices.${choice.id}.useId`, 'references a missing batch use.');
    if (choice.logId !== null && !logsById.has(choice.logId))
      return fail(
        `${path}.dailyChoices.${choice.id}.logId`,
        'references a missing consumption entry.',
      );
  }
  for (const week of weeks)
    for (const choice of week.choices) {
      if (choice.readyBatchId !== null) {
        const batch = batchesById.get(choice.readyBatchId);
        if (!batch)
          return fail(
            `${path}.weeks.${week.id}.choices.${choice.id}.readyBatchId`,
            'references a missing prepared batch.',
          );
        if (batch.recipeId !== choice.recipeId)
          return fail(
            `${path}.weeks.${week.id}.choices.${choice.id}.readyBatchId`,
            'must match the selected recipe.',
          );
      }
      if (choice.shoppingIntentId !== null && !oneOffsById.has(choice.shoppingIntentId))
        return fail(
          `${path}.weeks.${week.id}.choices.${choice.id}.shoppingIntentId`,
          'references a missing shopping intention.',
        );
    }
  // Coverage/purchase identifiers may refer to prior weekly choices, removed
  // manual items or completed one-offs. They are validated bounded strings,
  // not live foreign keys: purchase history must survive a recipe swap.
  for (const log of context.logs) {
    if (log.batchId === undefined) continue;
    const batch = batchesById.get(log.batchId);
    if (!batch)
      return fail(`Backup.logs.${log.id}.batchId`, 'references a missing prepared batch.');
    if (log.batchUnits === undefined || !Number.isFinite(log.batchUnits) || log.batchUnits <= 0)
      return fail(
        `Backup.logs.${log.id}.batchUnits`,
        'must be a positive finite amount for a batch log.',
      );
    if (log.recipeId !== batch.recipeId)
      return fail(`Backup.logs.${log.id}.recipeId`, 'must match its prepared batch recipe.');
    if (log.useId !== undefined && !usesById.has(log.useId))
      return fail(`Backup.logs.${log.id}.useId`, 'references a missing batch use.');
  }
  for (const batch of batches) {
    const consumed = context.logs
      .filter((log) => log.batchId === batch.id)
      .reduce((sum, log) => sum + (log.batchUnits ?? 0), 0);
    if (consumed > batch.actualYield)
      return fail(`${path}.batches.${batch.id}`, 'has logged portions above its actual yield.');
  }
  return result;
};
