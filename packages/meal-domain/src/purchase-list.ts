import { buildShoppingList } from './shopping';
import type { PurchasePlanningAPI } from './experience-api';
import type {
  BatchChoice,
  BatchWeek,
  ExperienceState,
  GroceryCoverage,
  PreparedBatch,
  PurchaseContribution,
  PurchaseItem,
  PurchaseList,
  PurchaseMatch,
  PurchaseRecord,
  ShoppingIntent,
} from './experience-types';
import {
  defaultFilters,
  type AppState,
  type IngredientLine,
  type Recipe,
  type ShoppingItem,
  type WeekPlan,
} from './types';

const finiteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const finitePositive = (value: unknown): value is number => finiteNonNegative(value) && value > 0;
const now = (): string => new Date().toISOString();
const legacyTimestamp = '1970-01-01T00:00:00.000Z';
const epsilon = 1e-9;

const emptyExperience = (): ExperienceState => ({
  version: 1,
  dailyChoices: [],
  sessions: [],
  batches: [],
  weeks: [],
  activeWeekId: null,
  oneOffs: [],
  recipeProfiles: {},
  purchaseMatches: [],
  groceryCoverage: {},
  purchases: [],
  manualItems: [],
  lastPlanRequest: null,
  groceryChanges: {},
  aisleOverrides: {},
  preferredSlot: 'dinner',
});
const experienceFor = (state: AppState): ExperienceState => state.experience ?? emptyExperience();

const cloneRecipe = (recipe: Recipe): Recipe => ({
  ...recipe,
  roles: [...recipe.roles],
  tags: [...recipe.tags],
  categories: [...recipe.categories],
  ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
  steps: [...recipe.steps],
  nutrition: { ...recipe.nutrition },
  reportedNutrition: { ...recipe.reportedNutrition },
  dataGaps: [...recipe.dataGaps],
  ...(recipe.sourceEvidence ? { sourceEvidence: { ...recipe.sourceEvidence } } : {}),
});

const normalize = (value: string): string => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};
const addUnique = (values: string[], value: string): string[] =>
  value && !values.includes(value) ? [...values, value] : values;

const plainTapWater = (name: string): boolean => {
  const value = normalize(name)
    .replace(/[(),.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return value === 'water' || value === 'tap water' || value === 'water tap';
};

const prepWords = new Set(['whole', 'diced', 'chopped', 'sliced', 'minced', 'grated', 'julienned']);
const protectedFoodWords = new Set([
  'raw',
  'cooked',
  'uncooked',
  'smoked',
  'beef',
  'pork',
  'turkey',
  'chicken',
  'lamb',
  'veal',
  'fish',
  'shrimp',
  'crab',
  'salmon',
  'tuna',
  'dairy',
  'milk',
  'butter',
  'cheese',
  'yogurt',
  'fat',
  'fat-free',
  'nonfat',
  'low-fat',
  'full-fat',
  'gluten',
  'allergen',
]);
const wordsFor = (name: string): string[] =>
  normalize(name)
    .replace(/[(),]/g, ' ')
    .split(/[\s/]+/)
    .filter(Boolean);
const preparationFor = (name: string): string =>
  wordsFor(name)
    .filter((word) => prepWords.has(word))
    .join(', ');
const prepNoteFor = (name: string): string => {
  const preparation = preparationFor(name);
  return preparation ? `Recipe calls for ${preparation} preparation.` : '';
};
const prepStem = (name: string): string =>
  wordsFor(name)
    .filter((word) => !prepWords.has(word))
    .join(' ');
const protectedSignature = (name: string): string =>
  wordsFor(name)
    .filter((word) => protectedFoodWords.has(word))
    .sort()
    .join('|');

/** Only conversions already proven in shopping.ts may be used by an explicit match. */
interface UnitInfo {
  unit: string | null;
  key: string;
  factor: number;
}
const unitInfo = (unit: string | null): UnitInfo => {
  if (!unit || !unit.trim()) return { unit: null, key: 'count', factor: 1 };
  const value = normalize(unit).replace(/\.$/, '');
  if (value === 'g' || value === 'gram' || value === 'grams')
    return { unit: 'g', key: 'g', factor: 1 };
  if (value === 'kg' || value === 'kilogram' || value === 'kilograms')
    return { unit: 'g', key: 'g', factor: 1000 };
  if (
    value === 'ml' ||
    value === 'millilitre' ||
    value === 'millilitres' ||
    value === 'milliliter' ||
    value === 'milliliters'
  )
    return { unit: 'ml', key: 'ml', factor: 1 };
  if (
    value === 'l' ||
    value === 'litre' ||
    value === 'litres' ||
    value === 'liter' ||
    value === 'liters'
  )
    return { unit: 'ml', key: 'ml', factor: 1000 };
  if (value === 'tsp' || value === 'teaspoon' || value === 'teaspoons')
    return { unit: 'tsp', key: 'tsp', factor: 1 };
  if (value === 'tbsp' || value === 'tablespoon' || value === 'tablespoons')
    return { unit: 'tsp', key: 'tsp', factor: 3 };
  return { unit: value, key: `unit:${value}`, factor: 1 };
};

const compatiblePurchaseNames = (names: string[]): boolean => {
  if (names.length < 2) return false;
  const stems = names.map(prepStem);
  const signatures = names.map(protectedSignature);
  return (
    stems[0].length > 0 &&
    stems.every((stem) => stem === stems[0]) &&
    signatures.every((signature) => signature === signatures[0]) &&
    names.some((name) => preparationFor(name).length > 0)
  );
};

interface Requirement {
  intentionId: string;
  recipe: Recipe;
  sourceServings: number;
  preparedSourceServings: number | null;
}

const recipeForChoice = (state: AppState, recipeId: string): Recipe => {
  const recipe = state.recipes.find((value) => value.id === recipeId);
  if (!recipe)
    throw new Error(
      `Shopping cannot be calculated because saved recipe "${recipeId}" is unavailable.`,
    );
  return recipe;
};

const weeklyChoiceForDaily = (
  state: AppState,
  week: BatchWeek,
  dailyChoiceId: string | null,
): BatchChoice | null => {
  if (dailyChoiceId === null) return null;
  const daily = state.experience?.dailyChoices.find((item) => item.id === dailyChoiceId);
  const use =
    daily?.useId === null || daily?.useId === undefined
      ? null
      : week.uses.find((item) => item.id === daily.useId);
  return use ? (week.choices.find((item) => item.id === use.choiceId) ?? null) : null;
};

/** Cooked recipes retain their own snapshot even if the book recipe later changes. */
const snapshotForChoice = (state: AppState, week: BatchWeek, choice: BatchChoice): Recipe => {
  const experience = experienceFor(state);
  const direct =
    choice.readyBatchId === null
      ? null
      : (experience.batches.find((batch) => batch.id === choice.readyBatchId) ?? null);
  if (direct) return direct.recipeSnapshot;
  const batch = experience.batches.find(
    (item) =>
      item.weekId === week.id && weeklyChoiceForDaily(state, week, item.choiceId)?.id === choice.id,
  );
  if (batch) return batch.recipeSnapshot;
  const session = experience.sessions.find(
    (item) =>
      item.weekId === week.id && weeklyChoiceForDaily(state, week, item.choiceId)?.id === choice.id,
  );
  return session?.recipeSnapshot ?? recipeForChoice(state, choice.recipeId);
};

/** A PreparedBatch is procurement evidence only when its linked session actually finished. */
const finishedBatchForChoice = (
  state: AppState,
  week: BatchWeek,
  choice: BatchChoice,
): PreparedBatch | null => {
  const experience = experienceFor(state);
  const finished = (batch: PreparedBatch | undefined): batch is PreparedBatch => {
    if (!batch || batch.recipeId !== choice.recipeId) return false;
    const session = experience.sessions.find((item) => item.id === batch.sessionId);
    return (
      session !== undefined && session.recipeId === choice.recipeId && session.finishedAt !== null
    );
  };
  const direct =
    choice.readyBatchId === null
      ? undefined
      : experience.batches.find((batch) => batch.id === choice.readyBatchId);
  if (finished(direct)) return direct;
  return (
    experience.batches.find(
      (batch) =>
        batch.weekId === week.id &&
        weeklyChoiceForDaily(state, week, batch.choiceId)?.id === choice.id &&
        finished(batch),
    ) ?? null
  );
};

const preparedSourceServingsForChoice = (
  state: AppState,
  week: BatchWeek,
  choice: BatchChoice,
): number | null => {
  const batch = finishedBatchForChoice(state, week, choice);
  if (!batch) return null;
  const session = experienceFor(state).sessions.find((item) => item.id === batch.sessionId);
  // A retained batch can be reduced after cooking. Its session records what was actually produced
  // and therefore what ingredient procurement it fulfilled; never fulfill beyond this choice.
  const productionSourceServings =
    session && finitePositive(session.sourceServings)
      ? session.sourceServings
      : batch.preparedSourceServings;
  return finitePositive(productionSourceServings)
    ? Math.min(choice.sourceServings, productionSourceServings)
    : null;
};

const requirementsFor = (
  state: AppState,
  week: BatchWeek | null,
): { requirements: Requirement[]; linked: Set<string>; fulfilled: ShoppingIntent[] } => {
  const experience = experienceFor(state);
  const linked = new Set<string>();
  const requirements: Requirement[] = [];
  if (week) {
    for (const choice of week.choices) {
      // A finished batch remains a shopping requirement unless it was explicitly selected as ready reuse.
      if (choice.reuseReady) continue;
      if (!finitePositive(choice.sourceServings))
        throw new Error(
          `Shopping cannot be calculated because source servings for choice "${choice.id}" are invalid.`,
        );
      const intent = choice.shoppingIntentId
        ? (experience.oneOffs.find((value) => value.id === choice.shoppingIntentId) ?? null)
        : null;
      if (choice.shoppingIntentId) linked.add(choice.shoppingIntentId);
      requirements.push({
        intentionId: choice.shoppingIntentId ?? choice.id,
        recipe: intent ? intent.recipeSnapshot : snapshotForChoice(state, week, choice),
        sourceServings: choice.sourceServings,
        preparedSourceServings: preparedSourceServingsForChoice(state, week, choice),
      });
    }
  }
  const fulfilled: ShoppingIntent[] = [];
  for (const intent of experience.oneOffs) {
    if (linked.has(intent.id)) continue;
    if (intent.fulfilled) {
      fulfilled.push(intent);
      continue;
    }
    if (!finitePositive(intent.sourceServings))
      throw new Error(`Shopping intention "${intent.id}" has invalid source servings.`);
    requirements.push({
      intentionId: intent.id,
      recipe: intent.recipeSnapshot,
      sourceServings: intent.sourceServings,
      preparedSourceServings: null,
    });
  }
  return { requirements, linked, fulfilled };
};

const sourceRows = (requirement: Requirement): ShoppingItem[] => {
  const slot = requirement.recipe.roles[0] ?? 'dinner';
  const plan: WeekPlan = {
    id: `purchase-${requirement.intentionId}`,
    config: {
      weekStart: '2000-01-01',
      days: 1,
      people: 1,
      slots: [slot],
      uniqueRecipes: 1,
      filters: defaultFilters(),
    },
    meals: [
      {
        id: requirement.intentionId,
        date: '2000-01-01',
        slot,
        recipeId: requirement.recipe.id,
        servings: requirement.sourceServings,
        locked: false,
      },
    ],
    createdAt: '2000-01-01T00:00:00.000Z',
  };
  return buildShoppingList(plan, [requirement.recipe]);
};

interface PurchaseGroup {
  originalKey: string;
  originalKeys: string[];
  name: string;
  aisle: string;
  quantity: number | null;
  unit: string | null;
  displayQuantity: string;
  needsReview: boolean;
  notes: string[];
  contributions: PurchaseContribution[];
  preparedContributionCount: number;
  fullyPreparedContributionCount: number;
  preparationFulfilledQuantity: number;
  intentionIds: string[];
  manual: boolean;
}

const mergeGroup = (
  groups: Map<string, PurchaseGroup>,
  row: ShoppingItem,
  requirement: Requirement,
): void => {
  const preparationScale =
    requirement.preparedSourceServings === null
      ? null
      : Math.min(1, requirement.preparedSourceServings / requirement.sourceServings);
  const incoming: PurchaseGroup = {
    originalKey: row.key,
    originalKeys: [row.key],
    name: row.name,
    aisle: row.aisle,
    quantity: row.quantity,
    unit: row.unit,
    displayQuantity: row.displayQuantity,
    needsReview: row.needsReview,
    notes: [...row.notes],
    intentionIds: [requirement.intentionId],
    manual: false,
    contributions: row.contributions.map((contribution) => ({
      intentionId: requirement.intentionId,
      recipeId: contribution.recipeId,
      recipeName: contribution.recipeName,
      quantity: contribution.quantity,
      sourceText: contribution.quantityText,
      prepNote: prepNoteFor(row.name),
    })),
    preparedContributionCount: preparationScale === null ? 0 : row.contributions.length,
    fullyPreparedContributionCount:
      preparationScale !== null && preparationScale >= 1 - epsilon ? row.contributions.length : 0,
    preparationFulfilledQuantity:
      preparationScale === null || row.quantity === null ? 0 : row.quantity * preparationScale,
  };
  const existing = groups.get(row.key);
  if (!existing) {
    groups.set(row.key, incoming);
    return;
  }
  const knownQuantities = existing.quantity !== null && incoming.quantity !== null;
  existing.quantity = knownQuantities ? existing.quantity! + incoming.quantity! : null;
  existing.needsReview = existing.needsReview || incoming.needsReview || !knownQuantities;
  existing.displayQuantity =
    existing.quantity !== null
      ? `${formatNumber(existing.quantity)}${existing.unit ? ` ${existing.unit}` : ''}${existing.needsReview ? ' + review' : ''}`
      : existing.displayQuantity;
  for (const note of incoming.notes) existing.notes = addUnique(existing.notes, note);
  for (const id of incoming.intentionIds)
    existing.intentionIds = addUnique(existing.intentionIds, id);
  existing.contributions.push(...incoming.contributions);
  existing.preparedContributionCount += incoming.preparedContributionCount;
  existing.fullyPreparedContributionCount += incoming.fullyPreparedContributionCount;
  existing.preparationFulfilledQuantity += incoming.preparationFulfilledQuantity;
};

const compatibleGroupUnits = (groups: PurchaseGroup[]): UnitInfo | null => {
  const infos = groups.map((group) => unitInfo(group.unit));
  return infos.length > 0 && infos.every((info) => info.key === infos[0].key) ? infos[0] : null;
};

const mergeApprovedMatches = (
  groups: PurchaseGroup[],
  matches: PurchaseMatch[],
): PurchaseGroup[] => {
  let remaining = [...groups];
  for (const match of matches) {
    const expected = match.names.map(normalize);
    if (!compatiblePurchaseNames(match.names)) continue;
    const selected = remaining.filter((group) => expected.includes(normalize(group.name)));
    if (
      selected.length !== expected.length ||
      !expected.every((name) => selected.some((group) => normalize(group.name) === name))
    )
      continue;
    const canonical = compatibleGroupUnits(selected);
    if (!canonical) continue;
    const allKnown = selected.every((group) => group.quantity !== null);
    const quantity = allKnown
      ? selected.reduce(
          (sum, group) => sum + (group.quantity! * unitInfo(group.unit).factor) / canonical.factor,
          0,
        )
      : null;
    const needsReview = selected.some((group) => group.needsReview) || !allKnown;
    const notes = selected.reduce(
      (all, group) => group.notes.reduce(addUnique, all),
      [] as string[],
    );
    const preparationFulfilledQuantity = selected.reduce(
      (sum, group) =>
        sum + (group.preparationFulfilledQuantity * unitInfo(group.unit).factor) / canonical.factor,
      0,
    );
    const originalKeys = [...new Set(selected.flatMap((group) => group.originalKeys))].sort();
    const merged: PurchaseGroup = {
      originalKey: originalKeys[0],
      originalKeys,
      name: match.purchaseName,
      aisle: [...selected].sort((left, right) => left.aisle.localeCompare(right.aisle))[0].aisle,
      quantity,
      unit: canonical.unit,
      displayQuantity:
        quantity === null
          ? 'Review recipe amounts'
          : `${formatNumber(quantity)}${canonical.unit ? ` ${canonical.unit}` : ''}${needsReview ? ' + review' : ''}`,
      needsReview,
      notes: addUnique(
        addUnique(notes, `${match.prepNote} Original recipe preparation is retained.`),
        'Added purchase preparation may change hands-on time; confirm timing before relying on a cooking-window fit.',
      ),
      contributions: selected.flatMap((group) => group.contributions),
      preparedContributionCount: selected.reduce(
        (sum, group) => sum + group.preparedContributionCount,
        0,
      ),
      fullyPreparedContributionCount: selected.reduce(
        (sum, group) => sum + group.fullyPreparedContributionCount,
        0,
      ),
      preparationFulfilledQuantity,
      intentionIds: selected.reduce(
        (all, group) => group.intentionIds.reduce(addUnique, all),
        [] as string[],
      ),
      manual: false,
    };
    remaining = remaining.filter((group) => !selected.includes(group));
    remaining.push(merged);
  }
  return remaining;
};

const scopeFor = (state: AppState, explicit: BatchWeek | null | undefined): BatchWeek | null => {
  if (explicit === null) return null;
  if (explicit !== undefined) return explicit;
  const experience = state.experience;
  return experience?.weeks.find((week) => week.id === experience.activeWeekId) ?? null;
};
const scopeFromKey = (key: string): string => {
  for (const marker of [':shopping:', ':manual:']) {
    const index = key.indexOf(marker);
    if (index >= 0) return key.slice(0, index);
  }
  return key.split(':')[0] || 'adhoc';
};
const originalKeyFromCoverageKey = (key: string): string | null => {
  for (const marker of [':shopping:', ':manual:']) {
    const index = key.indexOf(marker);
    if (index >= 0) return key.slice(index + 1);
  }
  return null;
};

const groupsForScope = (state: AppState, week: BatchWeek | null): Map<string, PurchaseGroup> => {
  const groups = new Map<string, PurchaseGroup>();
  for (const requirement of requirementsFor(state, week).requirements)
    for (const row of sourceRows(requirement)) mergeGroup(groups, row, requirement);
  return groups;
};

const sumNullable = (values: Array<number | null>): number | null =>
  values.some((value) => value !== null)
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
const combineCoverage = (
  coverages: GroceryCoverage[],
  scopeId: string,
  requiredAtCheck: number | null,
  intentionIds: string[],
): GroceryCoverage | null => {
  if (coverages.length === 0) return null;
  return {
    ownedQuantity: sumNullable(coverages.map((coverage) => coverage.ownedQuantity)),
    boughtQuantity: sumNullable(coverages.map((coverage) => coverage.boughtQuantity)),
    ownedUnspecified: coverages.some((coverage) => coverage.ownedUnspecified),
    boughtUnspecified: coverages.some((coverage) => coverage.boughtUnspecified),
    requiredAtCheck,
    intentionIds: [
      ...new Set([...coverages.flatMap((coverage) => coverage.intentionIds), ...intentionIds]),
    ],
    scopeId,
    updatedAt:
      coverages
        .map((coverage) => coverage.updatedAt)
        .sort()
        .at(-1) ?? now(),
  };
};

const legacyCoverage = (
  state: AppState,
  week: BatchWeek | null,
  group: PurchaseGroup,
  scopeId: string,
): GroceryCoverage | null => {
  if (!week?.legacyPlanId) return null;
  const statuses = group.originalKeys
    .map((key) => state.shoppingChecks[`${week.legacyPlanId}:${key}`])
    .filter((value): value is 'checked' | 'owned' => value === 'checked' || value === 'owned');
  if (statuses.length === 0) return null;
  // Legacy checks represented the then-known required quantity, never an endless unspecified pantry claim.
  const amount = group.quantity;
  return {
    ownedQuantity: statuses.includes('owned') ? amount : null,
    boughtQuantity: statuses.includes('checked') ? amount : null,
    ownedUnspecified: false,
    boughtUnspecified: false,
    requiredAtCheck: amount,
    intentionIds: [...group.intentionIds],
    scopeId,
    updatedAt: legacyTimestamp,
  };
};

const contributionShare = (
  source: PurchaseGroup | undefined,
  carriedIds: Set<string>,
  fallbackIds: string[],
): number => {
  if (source && source.quantity !== null && source.quantity > 0) {
    const carried = source.contributions.filter((contribution) =>
      carriedIds.has(contribution.intentionId),
    );
    if (carried.length > 0 && carried.every((contribution) => contribution.quantity !== null)) {
      return Math.min(
        1,
        Math.max(
          0,
          carried.reduce((sum, contribution) => sum + contribution.quantity!, 0) / source.quantity,
        ),
      );
    }
  }
  return fallbackIds.length > 0 && fallbackIds.every((id) => carriedIds.has(id)) ? 1 : 0;
};

const carriedCoverage = (
  state: AppState,
  experience: ExperienceState,
  scopeId: string,
  group: PurchaseGroup,
): GroceryCoverage | null => {
  const oneOffIds = new Set(experience.oneOffs.map((intent) => intent.id));
  const relevant = new Set(group.intentionIds.filter((id) => oneOffIds.has(id)));
  if (relevant.size === 0) return null;
  const carried: GroceryCoverage[] = [];
  for (const [key, candidate] of Object.entries(experience.groceryCoverage)) {
    if (candidate.scopeId === scopeId) continue;
    const original = originalKeyFromCoverageKey(key);
    // The same one-off is not enough: food and canonical unit identity must also be the same.
    if (original === null || !group.originalKeys.includes(original)) continue;
    const overlapping = new Set(candidate.intentionIds.filter((id) => relevant.has(id)));
    if (overlapping.size === 0) continue;
    const oldWeek =
      candidate.scopeId === 'adhoc'
        ? null
        : (experience.weeks.find((week) => week.id === candidate.scopeId) ?? null);
    const source = groupsForScope(state, oldWeek).get(original);
    const share = contributionShare(source, overlapping, candidate.intentionIds);
    if (share <= 0) continue;
    carried.push({
      ownedQuantity: candidate.ownedQuantity === null ? null : candidate.ownedQuantity * share,
      boughtQuantity: candidate.boughtQuantity === null ? null : candidate.boughtQuantity * share,
      ownedUnspecified: share >= 1 - epsilon && candidate.ownedUnspecified,
      boughtUnspecified: share >= 1 - epsilon && candidate.boughtUnspecified,
      requiredAtCheck:
        candidate.requiredAtCheck === null ? null : candidate.requiredAtCheck * share,
      intentionIds: [...overlapping],
      scopeId,
      updatedAt: candidate.updatedAt,
    });
  }
  return combineCoverage(carried, scopeId, group.quantity, group.intentionIds);
};

const coverageFor = (
  experience: ExperienceState,
  state: AppState,
  week: BatchWeek | null,
  scopeId: string,
  group: PurchaseGroup,
): GroceryCoverage | null => {
  const direct = group.originalKeys
    .map((key) => experience.groceryCoverage[`${scopeId}:${key}`])
    .filter(
      (coverage): coverage is GroceryCoverage =>
        coverage !== undefined && coverage.scopeId === scopeId,
    );
  const directCoverage = combineCoverage(direct, scopeId, group.quantity, group.intentionIds);
  if (directCoverage) return directCoverage;
  return (
    carriedCoverage(state, experience, scopeId, group) ??
    legacyCoverage(state, week, group, scopeId)
  );
};

const materialize = (
  state: AppState,
  experience: ExperienceState,
  week: BatchWeek | null,
  group: PurchaseGroup,
  scopeId: string,
): PurchaseItem => {
  const key = `${scopeId}:${group.originalKey}`;
  const coverage = coverageFor(experience, state, week, scopeId, group);
  const exactCovered = (coverage?.ownedQuantity ?? 0) + (coverage?.boughtQuantity ?? 0);
  const unspecified = Boolean(coverage?.ownedUnspecified || coverage?.boughtUnspecified);
  const allContributorsPrepared =
    group.contributions.length > 0 &&
    group.fullyPreparedContributionCount === group.contributions.length;
  const hasPreparedContribution = group.preparedContributionCount > 0;
  const preparedQuantityText = `${formatNumber(group.preparationFulfilledQuantity)}${
    group.unit ? ` ${group.unit}` : ''
  }`;
  const requiredQuantityText =
    group.quantity === null
      ? null
      : `${formatNumber(group.quantity)}${group.unit ? ` ${group.unit}` : ''}`;
  const remainingQuantity =
    group.quantity === null
      ? null
      : Math.max(0, group.quantity - Math.max(exactCovered, group.preparationFulfilledQuantity));
  const covered =
    unspecified ||
    (group.quantity === null && allContributorsPrepared) ||
    (remainingQuantity !== null && remainingQuantity <= 0);
  const remainingText =
    group.quantity === null
      ? covered
        ? allContributorsPrepared
          ? 'No purchase needed now — preparation is complete; recipe amount remains in history.'
          : 'Covered after confirmation'
        : hasPreparedContribution
          ? 'Review amount needed now — a prepared batch covers part of the retained requirement.'
          : 'Review cupboard quantity'
      : covered
        ? hasPreparedContribution
          ? `No purchase needed now — ${preparedQuantityText} already prepared; ${requiredQuantityText} retained in history.`
          : 'Covered'
        : hasPreparedContribution
          ? `${formatNumber(remainingQuantity!)}${group.unit ? ` ${group.unit}` : ''} needed now — ${preparedQuantityText} already prepared; ${requiredQuantityText} retained in history.`
          : `${formatNumber(remainingQuantity!)}${group.unit ? ` ${group.unit}` : ''} remaining`;
  const override = experience.aisleOverrides[key] ?? experience.aisleOverrides[group.originalKey];
  return {
    key,
    name: group.name,
    aisle: override?.trim() || group.aisle || 'Other',
    quantity: group.quantity,
    unit: group.unit,
    displayQuantity: group.displayQuantity,
    remainingQuantity,
    remainingText,
    covered,
    needsReview: group.needsReview || group.quantity === null,
    changedFrom:
      experience.groceryChanges[key] ?? experience.groceryChanges[group.originalKey] ?? null,
    coverage,
    contributions: group.contributions,
    intentionIds: [...group.intentionIds],
    notes: [...group.notes],
  };
};

const suggestionPairs = (
  groups: PurchaseGroup[],
  approved: PurchaseMatch[],
): PurchaseList['matches'] => {
  const existing = new Set(
    approved.map((match) => [...match.names.map(normalize)].sort().join('|')),
  );
  const suggestions: PurchaseList['matches'] = [];
  for (let left = 0; left < groups.length; left += 1)
    for (let right = left + 1; right < groups.length; right += 1) {
      const first = groups[left];
      const second = groups[right];
      const names = [first.name, second.name];
      const key = [...names.map(normalize)].sort().join('|');
      if (
        existing.has(key) ||
        !compatiblePurchaseNames(names) ||
        !compatibleGroupUnits([first, second])
      )
        continue;
      suggestions.push({
        names,
        purchaseName: first.name,
        prepNote: `Confirm the added preparation work: retain ${preparationFor(first.name) || 'original'} and ${preparationFor(second.name) || 'original'} recipe prep.`,
      });
    }
  return suggestions;
};

const buildList = (state: AppState, requestedWeek?: BatchWeek | null): PurchaseList => {
  const week = scopeFor(state, requestedWeek);
  const experience = experienceFor(state);
  const scopeId = week?.id ?? 'adhoc';
  const { requirements, fulfilled } = requirementsFor(state, week);
  const groups = new Map<string, PurchaseGroup>();
  for (const requirement of requirements)
    for (const row of sourceRows(requirement)) mergeGroup(groups, row, requirement);
  for (const manual of experience.manualItems) {
    const originalKey = `manual:${manual.id}`;
    groups.set(originalKey, {
      originalKey,
      originalKeys: [originalKey],
      name: manual.name,
      aisle: 'Other',
      quantity: null,
      unit: null,
      displayQuantity: manual.quantityText || 'Amount not stated',
      needsReview: !manual.quantityText,
      notes: ['Manual item.'],
      contributions: [],
      preparedContributionCount: 0,
      fullyPreparedContributionCount: 0,
      preparationFulfilledQuantity: 0,
      intentionIds: [manual.id],
      manual: true,
    });
  }
  const rawGroups = [...groups.values()];
  const water = rawGroups.filter((group) => !group.manual && plainTapWater(group.name));
  const purchasable = rawGroups.filter((group) => group.manual || !plainTapWater(group.name));
  const matched = mergeApprovedMatches(purchasable, experience.purchaseMatches);
  const manualById = new Map(experience.manualItems.map((item) => [item.id, item]));
  const items = matched
    .map((group) => {
      const item = materialize(state, experience, week, group, scopeId);
      const manualId = group.manual ? group.intentionIds[0] : null;
      if (manualId && manualById.get(manualId)?.checked)
        return { ...item, covered: true, remainingQuantity: 0, remainingText: 'Covered' };
      return item;
    })
    .sort(
      (left, right) =>
        left.aisle.localeCompare(right.aisle) ||
        left.name.localeCompare(right.name) ||
        left.key.localeCompare(right.key),
    );
  const excluded = water.map((group) => materialize(state, experience, week, group, scopeId));
  for (const intent of fulfilled)
    excluded.push({
      key: `${scopeId}:fulfilled:${intent.id}`,
      name: intent.recipeSnapshot.name,
      aisle: 'Other',
      quantity: null,
      unit: null,
      displayQuantity: 'Already fulfilled',
      remainingQuantity: 0,
      remainingText: 'Already fulfilled',
      covered: true,
      needsReview: false,
      changedFrom: null,
      coverage: null,
      contributions: [
        {
          intentionId: intent.id,
          recipeId: intent.recipeId,
          recipeName: intent.recipeSnapshot.name,
          quantity: null,
          sourceText: '',
          prepNote: '',
        },
      ],
      intentionIds: [intent.id],
      notes: ['One-off shopping intention is already fulfilled.'],
    });
  return {
    scopeId,
    items,
    shared: items.filter((item) => item.contributions.length > 1),
    excluded,
    matches: suggestionPairs(matched, experience.purchaseMatches),
  };
};

const addIntent = (
  state: AppState,
  recipeId: string,
  sourceServings: number,
  id: string,
  sourceYield?: number,
): AppState => {
  if (!id.trim()) throw new Error('Shopping intention needs an ID.');
  if (!finitePositive(sourceServings))
    throw new Error('Shopping source servings must be a positive number.');
  if (sourceYield !== undefined && !finitePositive(sourceYield))
    throw new Error('Confirmed source yield must be a positive number when supplied.');
  const recipe = recipeForChoice(state, recipeId);
  const experience = experienceFor(state);
  const snapshot = cloneRecipe(recipe);
  if (sourceYield !== undefined) snapshot.baseServings = sourceYield;
  const sameSnapshot = (left: Recipe, right: Recipe): boolean => {
    const ingredientSignature = (ingredient: IngredientLine): string =>
      JSON.stringify([
        ingredient.id,
        ingredient.name,
        ingredient.unit,
        ingredient.quantity,
        ingredient.quantityText,
        ingredient.sourceText ?? null,
      ]);
    return (
      left.baseServings === right.baseServings &&
      left.ingredients.map(ingredientSignature).sort().join('|') ===
        right.ingredients.map(ingredientSignature).sort().join('|')
    );
  };
  const equivalent = experience.oneOffs.find(
    (intent) =>
      !intent.fulfilled &&
      intent.recipeId === recipeId &&
      Math.abs(intent.sourceServings - sourceServings) < epsilon &&
      sameSnapshot(intent.recipeSnapshot, snapshot),
  );
  if (equivalent) return state.experience ? state : { ...state, experience };
  if (experience.oneOffs.some((intent) => intent.id === id))
    throw new Error('That shopping intention already exists.');
  return {
    ...state,
    experience: {
      ...experience,
      oneOffs: [
        ...experience.oneOffs,
        {
          id,
          recipeId,
          recipeSnapshot: snapshot,
          sourceServings,
          createdAt: now(),
          fulfilled: false,
        },
      ],
    },
  };
};

const matchedGroupForItem = (
  state: AppState,
  experience: ExperienceState,
  scopeId: string,
  itemKey: string,
): PurchaseGroup | null => {
  const week =
    scopeId === 'adhoc'
      ? null
      : (experience.weeks.find((candidate) => candidate.id === scopeId) ?? null);
  const groups = mergeApprovedMatches(
    [...groupsForScope(state, week).values()].filter((group) => !plainTapWater(group.name)),
    experience.purchaseMatches,
  );
  return groups.find((group) => `${scopeId}:${group.originalKey}` === itemKey) ?? null;
};

const cover = (
  state: AppState,
  item: PurchaseItem,
  input: { kind: 'owned' | 'bought' | 'clear'; quantity?: number },
  id: string,
): AppState => {
  if (!item.key.trim()) throw new Error('Purchase item is missing its stable key.');
  const experience = experienceFor(state);
  const scopeId = scopeFromKey(item.key);
  const original = originalKeyFromCoverageKey(item.key);
  if (original?.startsWith('manual:')) {
    const manualId = original.slice('manual:'.length);
    if (experience.manualItems.some((manual) => manual.id === manualId)) {
      const checked = input.kind !== 'clear';
      return {
        ...state,
        experience: {
          ...experience,
          manualItems: experience.manualItems.map((manual) =>
            manual.id === manualId ? { ...manual, checked } : manual,
          ),
        },
      };
    }
  }
  if (input.quantity !== undefined && !finitePositive(input.quantity))
    throw new Error('Covered quantity must be a positive number when supplied.');
  const group = matchedGroupForItem(state, experience, scopeId, item.key);
  const keys = group?.originalKeys ?? (original ? [original] : []);
  const stored = experience.groceryCoverage[item.key];
  const existing =
    stored?.scopeId === scopeId
      ? stored
      : item.coverage?.scopeId === scopeId
        ? item.coverage
        : null;
  const coverage = { ...experience.groceryCoverage };
  if (input.kind === 'clear') {
    for (const key of keys) delete coverage[`${scopeId}:${key}`];
    delete coverage[item.key];
    const week = experience.weeks.find((candidate) => candidate.id === scopeId) ?? null;
    const shoppingChecks = { ...state.shoppingChecks };
    if (week?.legacyPlanId)
      for (const key of keys) shoppingChecks[`${week.legacyPlanId}:${key}`] = null;
    return { ...state, shoppingChecks, experience: { ...experience, groceryCoverage: coverage } };
  }
  const inferred = input.quantity ?? item.remainingQuantity ?? item.quantity;
  // A known zero remainder stays known; it must not become an unspecified forever-cover flag.
  const amount = finiteNonNegative(inferred) ? inferred : null;
  const base: GroceryCoverage = {
    ownedQuantity: existing?.ownedQuantity ?? null,
    boughtQuantity: existing?.boughtQuantity ?? null,
    ownedUnspecified: existing?.ownedUnspecified ?? false,
    boughtUnspecified: existing?.boughtUnspecified ?? false,
    requiredAtCheck: item.quantity,
    intentionIds: [...new Set([...(existing?.intentionIds ?? []), ...item.intentionIds])],
    scopeId,
    updatedAt: now(),
  };
  // Replacing a merged item coalesces any older pre-match rows into its canonical first key.
  for (const key of keys)
    if (`${scopeId}:${key}` !== item.key) delete coverage[`${scopeId}:${key}`];
  const purchases = [...experience.purchases];
  if (input.kind === 'owned') {
    base.ownedQuantity = amount;
    base.ownedUnspecified = amount === null;
  } else {
    if (!id.trim()) throw new Error('A purchase record needs an ID.');
    if (purchases.some((purchase) => purchase.id === id))
      throw new Error('That purchase record already exists.');
    base.boughtQuantity = (base.boughtQuantity ?? 0) + (amount ?? 0);
    base.boughtUnspecified = base.boughtUnspecified || amount === null;
    const record: PurchaseRecord = {
      id,
      itemKey: item.key,
      name: item.name,
      quantity: amount,
      unit: item.unit,
      intentionIds: [...item.intentionIds],
      scopeId,
      purchasedAt: now(),
    };
    purchases.push(record);
  }
  coverage[item.key] = base;
  return { ...state, experience: { ...experience, groceryCoverage: coverage, purchases } };
};

const matchingIngredients = (state: AppState, names: string[]): IngredientLine[] => {
  const wanted = new Set(names.map(normalize));
  const lines: IngredientLine[] = [];
  for (const recipe of state.recipes)
    lines.push(...recipe.ingredients.filter((line) => wanted.has(normalize(line.name))));
  for (const intent of state.experience?.oneOffs ?? [])
    lines.push(
      ...intent.recipeSnapshot.ingredients.filter((line) => wanted.has(normalize(line.name))),
    );
  return lines;
};

const approveMatch = (
  state: AppState,
  names: string[],
  purchaseName: string,
  prepNote: string,
  id: string,
): AppState => {
  if (!id.trim()) throw new Error('Purchase match needs an ID.');
  const cleaned = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (cleaned.length < 2 || cleaned.length !== names.length)
    throw new Error(
      'Choose at least two distinct ingredient names for an explicit purchase match.',
    );
  if (!purchaseName.trim()) throw new Error('Choose the purchase name explicitly.');
  if (!prepNote.trim())
    throw new Error('Confirm the added preparation work before approving a purchase match.');
  if (!compatiblePurchaseNames(cleaned))
    throw new Error(
      'Purchase matches require the same food stem with explicit whole, diced, chopped, sliced, or other preparation suffixes.',
    );
  const lines = matchingIngredients(state, cleaned);
  if (lines.length < cleaned.length)
    throw new Error(
      'Each matched ingredient must be present in saved recipe or one-off source data.',
    );
  if (new Set(lines.map((line) => unitInfo(line.unit).key)).size !== 1)
    throw new Error(
      'Purchase matches need identical canonical units or a proven mass, volume, or spoon conversion; incompatible measures are kept separate.',
    );
  const experience = experienceFor(state);
  if (experience.purchaseMatches.some((match) => match.id === id))
    throw new Error('That purchase match already exists.');
  const key = [...cleaned.map(normalize)].sort().join('|');
  const purchaseMatches = experience.purchaseMatches.filter(
    (match) => [...match.names.map(normalize)].sort().join('|') !== key,
  );
  purchaseMatches.push({
    id,
    names: cleaned,
    purchaseName: purchaseName.trim(),
    prepNote: prepNote.trim(),
    confirmedAt: now(),
  });
  return { ...state, experience: { ...experience, purchaseMatches } };
};

export const purchasePlanning: PurchasePlanningAPI = { buildList, addIntent, cover, approveMatch };
