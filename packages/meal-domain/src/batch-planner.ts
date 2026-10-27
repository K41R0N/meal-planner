import { filterRecipes } from './catalog';
import type { BatchPlanningAPI } from './experience-api';
import type {
  BatchChoice,
  BatchPlanRequest,
  BatchUse,
  BatchWeek,
  CookingWindow,
  ExperienceState,
  PreparedBatch,
  RecipeProfile,
  SwapRequest,
} from './experience-types';
import { mealTypes, type AppState, type MealType, type Recipe } from './types';

const finitePositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const finiteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const now = (): string => new Date().toISOString();
const today = (): string => now().slice(0, 10);
const epsilon = 1e-9;

const generatedId = (prefix: string, used: Set<string>): string => {
  let candidate = `${prefix}-${
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }`;
  while (used.has(candidate)) candidate = `${prefix}-${Math.random().toString(36).slice(2, 12)}`;
  used.add(candidate);
  return candidate;
};

const copyWindow = (window: CookingWindow): CookingWindow => ({ ...window });
const copyUse = (use: BatchUse): BatchUse => ({ ...use });
const copyChoice = (choice: BatchChoice): BatchChoice => ({
  ...choice,
  explanations: [...choice.explanations],
});
const addUnique = (values: string[], value: string): string[] =>
  values.includes(value) ? values : [...values, value];

const dateOnly = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const checked = new Date(year, month - 1, day);
  return (
    checked.getFullYear() === year && checked.getMonth() === month - 1 && checked.getDate() === day
  );
};

const datesFor = (weekStart: string, days: number): string[] => {
  const [year, month, day] = weekStart.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  return Array.from({ length: days }, (_, offset) => {
    const value = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    return `${value.getFullYear().toString().padStart(4, '0')}-${(value.getMonth() + 1).toString().padStart(2, '0')}-${value.getDate().toString().padStart(2, '0')}`;
  });
};

const validTime = (value: string): boolean => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const [hours, minutes] = match.slice(1).map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
};

const compatible = (recipe: Recipe, slot: MealType): boolean => recipe.roles.includes(slot);

const profileFor = (state: AppState, recipeId: string): RecipeProfile =>
  state.experience?.recipeProfiles[recipeId] ?? {
    yieldUnit: 'portion',
    sourceUnitsPerPortion: 1,
    portionSizeConfirmed: false,
    activeMinutes: null,
    elapsedMinutes: null,
    reheatMinutes: null,
    equipment: [],
    equipmentConfirmed: false,
    reheatNotes: '',
    notes: '',
  };

const sourceUnitsFor = (profile: RecipeProfile): number =>
  finitePositive(profile.sourceUnitsPerPortion) ? profile.sourceUnitsPerPortion : 1;

const timingConfirmed = (profile: RecipeProfile): boolean =>
  finiteNonNegative(profile.activeMinutes) &&
  finiteNonNegative(profile.elapsedMinutes) &&
  profile.equipmentConfirmed;

const timingGap = (profile: RecipeProfile): string => {
  const gaps: string[] = [];
  if (!finiteNonNegative(profile.activeMinutes)) gaps.push('active time');
  if (!finiteNonNegative(profile.elapsedMinutes)) gaps.push('elapsed time');
  if (!profile.equipmentConfirmed) gaps.push('equipment');
  return gaps.length
    ? `Timing needs confirmation: ${gaps.join(', ')} are not confirmed. Source prep and cook labels are not treated as elapsed time.`
    : 'Timing needs confirmation.';
};

const sourceDoseConfirmed = (recipe: Recipe, sourceServings: number): boolean =>
  finitePositive(recipe.baseServings) && Math.abs(recipe.baseServings - sourceServings) < epsilon;

const validateRequest = (request: BatchPlanRequest): void => {
  if (!dateOnly(request.weekStart)) throw new Error('Week start must be a real YYYY-MM-DD date.');
  if (!Number.isInteger(request.days) || request.days < 1 || request.days > 7)
    throw new Error('Days must be a whole number from 1 to 7.');
  if (!finitePositive(request.people)) throw new Error('People must be a positive number.');
  if (!Array.isArray(request.slots) || request.slots.length === 0)
    throw new Error('Choose at least one meal slot.');
  if (
    new Set(request.slots).size !== request.slots.length ||
    request.slots.some((slot) => !mealTypes.includes(slot))
  ) {
    throw new Error('Meal slots must be valid and cannot be duplicated.');
  }
  if (!Number.isInteger(request.distinctRecipes) || request.distinctRecipes < 1)
    throw new Error('Requested distinct recipe count must be a positive whole number.');
  if (request.distinctRecipes > request.days * request.slots.length)
    throw new Error(
      'Requested distinct recipe count cannot exceed the available dated meal slots.',
    );
  if (!finitePositive(request.targetPortions))
    throw new Error('Target portions must be a positive number.');
  if (
    Number.isInteger(request.targetPortions) &&
    request.targetPortions < request.distinctRecipes
  ) {
    throw new Error(
      'An integral target needs at least one whole portion for each requested recipe; reduce recipe count or enter an explicit fractional target.',
    );
  }
  if (!Array.isArray(request.windows))
    throw new Error('Cooking windows must be provided as a list.');
  const inRange = new Set(datesFor(request.weekStart, request.days));
  const seen = new Set<string>();
  for (const window of request.windows) {
    if (!window.id.trim() || seen.has(window.id))
      throw new Error('Cooking windows need unique IDs.');
    seen.add(window.id);
    if (!inRange.has(window.date))
      throw new Error(`Cooking window ${window.id} is outside the requested week range.`);
    if (!validTime(window.startTime))
      throw new Error(`Cooking window ${window.id} needs a valid local start time.`);
    if (!finitePositive(window.availableMinutes))
      throw new Error(`Cooking window ${window.id} needs positive available minutes.`);
  }
};

const ingredientTerms = (recipe: Recipe): Set<string> =>
  new Set(
    recipe.ingredients
      .map((ingredient) => ingredient.name.toLocaleLowerCase().trim())
      .filter(Boolean),
  );
const overlapIngredient = (recipe: Recipe, selected: Recipe[]): string | null => {
  const terms = ingredientTerms(recipe);
  for (const other of selected)
    for (const term of ingredientTerms(other)) if (terms.has(term)) return term;
  return null;
};

const weightedPick = (candidates: Recipe[], selected: Recipe[]): Recipe => {
  const weighted = candidates.map((recipe) => ({
    recipe,
    weight: 1 + (recipe.favorite ? 3 : 0) + (overlapIngredient(recipe, selected) ? 2 : 0),
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.recipe;
  }
  return weighted.at(-1)!.recipe;
};

const chooseRecipes = (
  candidates: Recipe[],
  count: number,
  protectedIds = new Set<string>(),
  preferredIds = new Set<string>(),
): Recipe[] => {
  const protectedRecipes = candidates.filter((recipe) => protectedIds.has(recipe.id));
  if (protectedRecipes.length !== protectedIds.size)
    throw new Error('A retained cooked or locked choice no longer has its saved recipe.');
  if (protectedRecipes.length > count)
    throw new Error(
      `Retained cooked and locked choices use ${protectedRecipes.length} distinct recipes, more than the requested ${count}.`,
    );
  const selected = [...protectedRecipes];
  const remaining = candidates.filter((recipe) => !protectedIds.has(recipe.id));
  for (const recipe of remaining.filter((item) => preferredIds.has(item.id))) {
    if (selected.length === count) break;
    selected.push(recipe);
    remaining.splice(remaining.indexOf(recipe), 1);
  }
  while (selected.length < count) {
    if (remaining.length === 0)
      throw new Error(
        `Need exactly ${count} eligible recipes, but the available pool is too small.`,
      );
    const picked = weightedPick(remaining, selected);
    selected.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }
  return selected;
};

const distribute = (total: number, count: number): number[] => {
  if (!Number.isInteger(total)) return Array.from({ length: count }, () => total / count);
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index >= count - remainder ? 1 : 0));
};

const availableUnits = (state: AppState, batch: PreparedBatch): number => {
  const consumed = state.logs.reduce(
    (sum, log) =>
      log.batchId === batch.id && finiteNonNegative(log.batchUnits) ? sum + log.batchUnits : sum,
    0,
  );
  return Math.max(0, batch.actualYield - consumed);
};

/** A prepared batch remains tied to its captured recipe, not later book-only edits. */
const ingredientSignature = (recipe: Recipe): string[] =>
  recipe.ingredients
    .map((ingredient) =>
      JSON.stringify([
        ingredient.id.trim(),
        ingredient.name.trim().toLocaleLowerCase(),
        ingredient.quantity,
        ingredient.unit?.trim().toLocaleLowerCase() ?? null,
        ingredient.quantityText.trim().toLocaleLowerCase(),
        ingredient.sourceText?.trim().toLocaleLowerCase() ?? '',
      ]),
    )
    .sort();

const compatiblePreparedRecipe = (recipe: Recipe, snapshot: Recipe): boolean => {
  if (recipe.baseServings !== snapshot.baseServings) return false;
  const current = ingredientSignature(recipe);
  const prepared = ingredientSignature(snapshot);
  return (
    current.length === prepared.length && current.every((entry, index) => entry === prepared[index])
  );
};

/** Reservations are in meal portions; convert them through their saved source dose to actual batch units. */
const futureAllocatedActualUnits = (state: AppState, batch: PreparedBatch): number => {
  const experience = state.experience;
  if (
    !experience ||
    !finitePositive(batch.preparedSourceServings) ||
    !finitePositive(batch.actualYield)
  )
    return 0;
  const from = today();
  return experience.weeks.reduce((sum, week) => {
    if (!week.confirmed && week.id !== experience.activeWeekId) return sum;
    const choices = new Map(week.choices.map((choice) => [choice.id, choice]));
    return (
      sum +
      week.uses.reduce((allocated, use) => {
        const choice = choices.get(use.choiceId);
        if (
          !choice ||
          choice.readyBatchId !== batch.id ||
          use.skipped ||
          use.date < from ||
          !finitePositive(use.portions)
        )
          return allocated;
        const source =
          use.portions *
          sourceUnitsFor({
            ...profileFor(state, choice.recipeId),
            sourceUnitsPerPortion: choice.sourceUnitsPerPortion,
          });
        const expectedActualUnits = (source * batch.actualYield) / batch.preparedSourceServings;
        const consumedForUse = state.logs.reduce(
          (consumed, log) =>
            log.useId === use.id && log.batchId === batch.id && finiteNonNegative(log.batchUnits)
              ? consumed + log.batchUnits
              : consumed,
          0,
        );
        return allocated + Math.max(0, expectedActualUnits - consumedForUse);
      }, 0)
    );
  }, 0);
};

interface ReadyCandidate {
  batch: PreparedBatch;
  usableActualUnits: number;
  sourceServings: number;
  mealPortions: number;
}
const readyFor = (state: AppState, recipeId: string): ReadyCandidate | null => {
  const recipe = state.recipes.find((item) => item.id === recipeId);
  if (!recipe) return null;
  const profile = profileFor(state, recipeId);
  for (const batch of state.experience?.batches ?? []) {
    if (
      batch.recipeId !== recipeId ||
      !compatiblePreparedRecipe(recipe, batch.recipeSnapshot) ||
      !finitePositive(batch.actualYield) ||
      !finitePositive(batch.preparedSourceServings)
    )
      continue;
    const usableActualUnits = Math.max(
      0,
      availableUnits(state, batch) - futureAllocatedActualUnits(state, batch),
    );
    const sourceServings = (usableActualUnits * batch.preparedSourceServings) / batch.actualYield;
    const mealPortions = sourceServings / sourceUnitsFor(profile);
    if (mealPortions > epsilon) return { batch, usableActualUnits, sourceServings, mealPortions };
  }
  return null;
};

const activeIntentFor = (state: AppState, recipeId: string) =>
  (state.experience?.oneOffs ?? []).find(
    (intent) => intent.recipeId === recipeId && !intent.fulfilled,
  ) ?? null;

const baseExplanations = (recipe: Recipe, profile: RecipeProfile, selected: Recipe[]): string[] => {
  const explanations: string[] = [];
  if (recipe.favorite) explanations.push('Favorite recipe.');
  const shared = overlapIngredient(
    recipe,
    selected.filter((item) => item.id !== recipe.id),
  );
  if (shared) explanations.push(`Shares ${shared} with another chosen recipe.`);
  if (!profile.portionSizeConfirmed)
    explanations.push(
      'Portion size is not confirmed; source units stay separate from meal portions.',
    );
  if (recipe.baseServings === null)
    explanations.push('Recipe yield is unknown, so grocery quantities will need review.');
  if (!timingConfirmed(profile)) explanations.push(timingGap(profile));
  return explanations;
};

interface PlannedRecipe {
  recipe: Recipe;
  sourceServings: number;
  existing: boolean;
}
interface AssignedWindow {
  windowId: string | null;
  timingFit: BatchChoice['timingFit'];
}

interface ReadyAllocation {
  ready: ReadyCandidate | null;
  portions: number;
  freshPortions: number;
}

/** Integral targets use whole personal meal portions before any partial ready remainder. */
const readyAllocationFor = (
  ready: ReadyCandidate | null,
  desiredPortions: number,
  targetIsIntegral: boolean,
): ReadyAllocation => {
  if (!ready) return { ready: null, portions: 0, freshPortions: 0 };
  const available = Math.min(desiredPortions, ready.mealPortions);
  const portions = targetIsIntegral ? Math.floor(available + epsilon) : available;
  return { ready, portions: Math.max(0, portions), freshPortions: 0 };
};

/** Commit compatible ready portions first, then share the remaining target among recipes that still cook. */
const apportionReadyPortions = (
  state: AppState,
  recipes: Recipe[],
  portions: Map<string, number>,
  request: BatchPlanRequest,
): Map<string, ReadyAllocation> => {
  const allocations = new Map<string, ReadyAllocation>(
    recipes.map((recipe) => {
      const desiredPortions = portions.get(recipe.id) ?? 0;
      const ready = request.reuseReady ? readyFor(state, recipe.id) : null;
      return [
        recipe.id,
        readyAllocationFor(ready, desiredPortions, Number.isInteger(request.targetPortions)),
      ];
    }),
  );
  const freshRecipes = recipes.filter(
    (recipe) =>
      (portions.get(recipe.id) ?? 0) - (allocations.get(recipe.id)?.portions ?? 0) > epsilon,
  );
  const readyTotal = [...allocations.values()].reduce(
    (sum, allocation) => sum + allocation.portions,
    0,
  );
  const targetTotal = [...portions.values()].reduce((sum, value) => sum + value, 0);
  const freshDistribution = distribute(Math.max(0, targetTotal - readyTotal), freshRecipes.length);
  for (const [index, recipe] of freshRecipes.entries())
    allocations.get(recipe.id)!.freshPortions = freshDistribution[index];
  return allocations;
};

const plannedRecipes = (
  state: AppState,
  recipes: Recipe[],
  portions: Map<string, number>,
  request: BatchPlanRequest,
): PlannedRecipe[] => {
  const allocations = apportionReadyPortions(state, recipes, portions, request);
  return recipes.flatMap((recipe) => {
    const profile = profileFor(state, recipe.id);
    const allocation = allocations.get(recipe.id)!;
    const freshPortions = allocation.freshPortions;
    if (freshPortions <= epsilon) return [];
    const intent =
      !allocation.ready && request.reuseOneOffs ? activeIntentFor(state, recipe.id) : null;
    return [
      {
        recipe,
        sourceServings: intent ? intent.sourceServings : freshPortions * sourceUnitsFor(profile),
        existing: intent !== null,
      },
    ];
  });
};

/** Reserves new whole-recipe windows only after source quantities have been settled. */
const assignWindows = (
  state: AppState,
  plans: PlannedRecipe[],
  windows: CookingWindow[],
  strict: boolean,
): Map<string, AssignedWindow> | null => {
  const remaining = new Map(windows.map((window) => [window.id, window.availableMinutes]));
  const result = new Map<string, AssignedWindow>();
  const sorted = [...plans].sort(
    (left, right) =>
      (profileFor(state, right.recipe.id).elapsedMinutes ?? -1) -
      (profileFor(state, left.recipe.id).elapsedMinutes ?? -1),
  );
  for (const plan of sorted) {
    const profile = profileFor(state, plan.recipe.id);
    if (plan.existing) {
      result.set(plan.recipe.id, { windowId: null, timingFit: 'unknown' });
      continue;
    }
    if (!timingConfirmed(profile) || !sourceDoseConfirmed(plan.recipe, plan.sourceServings)) {
      if (strict) return null;
      result.set(plan.recipe.id, { windowId: null, timingFit: 'unknown' });
      continue;
    }
    const duration = profile.elapsedMinutes!;
    const fitting = windows
      .filter((window) => (remaining.get(window.id) ?? 0) >= duration)
      .sort(
        (left, right) => remaining.get(left.id)! - duration - (remaining.get(right.id)! - duration),
      );
    if (fitting.length === 0) {
      if (strict) return null;
      result.set(plan.recipe.id, { windowId: null, timingFit: 'over_budget' });
      continue;
    }
    const window = fitting[0];
    remaining.set(window.id, remaining.get(window.id)! - duration);
    result.set(plan.recipe.id, { windowId: window.id, timingFit: 'confirmed' });
  }
  return result;
};

const chooseScheduledRecipes = (
  candidates: Recipe[],
  count: number,
  state: AppState,
  request: BatchPlanRequest,
  portionsFor: (recipes: Recipe[]) => Map<string, number>,
  protectedIds = new Set<string>(),
): {
  recipes: Recipe[];
  assignments: Map<string, AssignedWindow>;
  portions: Map<string, number>;
} => {
  if (candidates.length < count)
    throw new Error(
      `Need exactly ${count} eligible recipes, but only ${candidates.length} match the current filters and meal roles.`,
    );
  const preferredIds = new Set(
    candidates
      .filter(
        (recipe) =>
          (request.reuseReady && readyFor(state, recipe.id) !== null) ||
          (request.reuseOneOffs && activeIntentFor(state, recipe.id) !== null),
      )
      .map((recipe) => recipe.id),
  );
  const attempts = Math.max(20, Math.min(300, candidates.length * 20));
  let strictNeedsSourceDose = false;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const recipes = chooseRecipes(candidates, count, protectedIds, preferredIds);
    const portions = portionsFor(recipes);
    const plans = plannedRecipes(state, recipes, portions, request);
    if (request.strictTiming) {
      const cookPlans = plans.filter((plan) => !plan.existing);
      strictNeedsSourceDose ||= cookPlans.some(
        (plan) =>
          !timingConfirmed(profileFor(state, plan.recipe.id)) ||
          !sourceDoseConfirmed(plan.recipe, plan.sourceServings),
      );
      if (
        cookPlans.some(
          (plan) =>
            !timingConfirmed(profileFor(state, plan.recipe.id)) ||
            !sourceDoseConfirmed(plan.recipe, plan.sourceServings),
        )
      )
        continue;
      if (cookPlans.length > 0 && request.windows.length === 0) continue;
    }
    const assignments = assignWindows(state, plans, request.windows, request.strictTiming);
    if (assignments) return { recipes, assignments, portions };
  }
  if (request.strictTiming && strictNeedsSourceDose) {
    throw new Error(
      'Strict timing applies only to a recipe with confirmed active time, elapsed time, equipment, and its exact published source dose. Change the dose with timing review or turn off strict timing.',
    );
  }
  if (request.strictTiming && request.windows.length === 0)
    throw new Error(
      'Strict timing needs a real cooking window for every new batch; ready food does not need one.',
    );
  throw new Error(
    'The confirmed recipe times do not fit the supplied cooking windows when scheduled sequentially. Add capacity, reduce batches, or turn off strict timing to draft with timing gaps.',
  );
};

interface SlotTarget {
  date: string;
  slot: MealType;
  key: string;
}
interface AllocationSpec {
  choiceId: string;
  recipe: Recipe;
  portions: number;
}

/** One use consumes at most the number of people and no two uses claim one date-slot. */
const allocateUses = (
  specs: AllocationSpec[],
  dates: string[],
  slots: MealType[],
  people: number,
  occupied: Set<string>,
  usedIds: Set<string>,
): Map<string, BatchUse[]> => {
  const targets = dates
    .flatMap((date) => slots.map((slot) => ({ date, slot, key: `${date}|${slot}` })))
    .filter((target) => !occupied.has(target.key));
  const remaining = new Map(specs.map((spec) => [spec.choiceId, Math.max(0, spec.portions)]));
  const result = new Map(specs.map((spec) => [spec.choiceId, [] as BatchUse[]]));
  while (targets.length > 0) {
    const active = specs
      .filter((spec) => (remaining.get(spec.choiceId) ?? 0) > epsilon)
      .sort((left, right) => {
        const leftOptions = targets.filter((target) => compatible(left.recipe, target.slot)).length;
        const rightOptions = targets.filter((target) =>
          compatible(right.recipe, target.slot),
        ).length;
        return leftOptions - rightOptions || left.choiceId.localeCompare(right.choiceId);
      });
    if (active.length === 0) break;
    let assigned = false;
    for (const spec of active) {
      const targetIndex = targets.findIndex((target) => compatible(spec.recipe, target.slot));
      if (targetIndex < 0) continue;
      const left = remaining.get(spec.choiceId)!;
      const portions = Math.min(left, people);
      if (portions <= epsilon) continue;
      const [target] = targets.splice(targetIndex, 1);
      occupied.add(target.key);
      result.get(spec.choiceId)!.push({
        id: generatedId('use', usedIds),
        choiceId: spec.choiceId,
        date: target.date,
        slot: target.slot,
        portions,
        locked: false,
        skipped: false,
      });
      remaining.set(spec.choiceId, left - portions);
      assigned = true;
    }
    if (!assigned) break;
  }
  return result;
};

const totalUses = (uses: BatchUse[]): number =>
  uses.filter((use) => !use.skipped).reduce((sum, use) => sum + use.portions, 0);
const allocationNote = (choice: BatchChoice, scheduled: number): BatchChoice => {
  const allocated = Math.min(choice.portions, scheduled);
  if (choice.portions - allocated > epsilon) {
    choice.explanations = addUnique(
      choice.explanations,
      `${choice.portions - allocated} portions remain unassigned because no available date and meal-role slots remain; they stay visible for later allocation.`,
    );
  }
  return choice;
};

const makeDraftChoices = (
  state: AppState,
  request: BatchPlanRequest,
  recipes: Recipe[],
  assignments: Map<string, AssignedWindow>,
  usedIds: Set<string>,
  portionsByRecipe: Map<string, number>,
  occupiedTargets = new Set<string>(),
): { choices: BatchChoice[]; uses: BatchUse[] } => {
  const choices: BatchChoice[] = [];
  const specs: AllocationSpec[] = [];
  const readyAllocations = apportionReadyPortions(state, recipes, portionsByRecipe, request);
  for (const recipe of recipes) {
    const profile = profileFor(state, recipe.id);
    const desiredPortions = portionsByRecipe.get(recipe.id) ?? 0;
    const readyAllocation = readyAllocations.get(recipe.id)!;
    const ready = readyAllocation.ready;
    const readyPortions = readyAllocation.portions;
    const freshPortions = readyAllocation.freshPortions;
    const intent = !ready && request.reuseOneOffs ? activeIntentFor(state, recipe.id) : null;
    const assigned = assignments.get(recipe.id) ?? {
      windowId: null,
      timingFit: 'unknown' as const,
    };
    const addChoice = (
      choice: Omit<BatchChoice, 'id' | 'recipeId' | 'locked'>,
      scheduled: number,
    ): void => {
      const id = generatedId('choice', usedIds);
      choices.push({ id, recipeId: recipe.id, locked: false, ...choice });
      if (scheduled > epsilon) specs.push({ choiceId: id, recipe, portions: scheduled });
    };

    if (ready && readyPortions > epsilon) {
      const sourceServings = readyPortions * sourceUnitsFor(profile);
      const actualUnits =
        (sourceServings * ready.batch.actualYield) / ready.batch.preparedSourceServings;
      let explanations = addUnique(
        baseExplanations(recipe, profile, recipes),
        `Uses ${actualUnits} available ${ready.batch.yieldUnit} units from a prepared batch; it will not be bought or cooked again.`,
      );
      const extraPortions = Math.max(0, ready.mealPortions - readyPortions);
      if (extraPortions > epsilon)
        explanations = addUnique(
          explanations,
          `${extraPortions} extra ready meal portions remain available for later allocation.`,
        );
      if (ready.batch.storage === 'freezer')
        explanations = addUnique(
          explanations,
          'Frozen food needs user-confirmed reheat or defrost instructions; none are invented.',
        );
      if (ready.batch.storage === 'unconfirmed')
        explanations = addUnique(
          explanations,
          'Storage is not confirmed; no storage-safety or reheat claim is made.',
        );
      addChoice(
        {
          sourceServings,
          portions: readyPortions,
          sourceUnitsPerPortion: sourceUnitsFor(profile),
          windowId: null,
          readyBatchId: ready.batch.id,
          reuseReady: true,
          shoppingIntentId: null,
          explanations,
          timingFit: 'unknown',
        },
        readyPortions,
      );
    }

    if (freshPortions <= epsilon) continue;
    if (intent) {
      const portions = intent.sourceServings / sourceUnitsFor(profile);
      let explanations = addUnique(
        baseExplanations(recipe, profile, recipes),
        'Reuses the explicit one-off shopping intention, so it will not be procured twice.',
      );
      if (portions + epsilon < desiredPortions)
        explanations = addUnique(
          explanations,
          `The linked one-off provides ${portions} meal portions, leaving ${desiredPortions - portions} requested portions uncovered.`,
        );
      if (portions - desiredPortions > epsilon)
        explanations = addUnique(
          explanations,
          `${portions - desiredPortions} linked one-off portions remain visible for later allocation.`,
        );
      addChoice(
        {
          sourceServings: intent.sourceServings,
          portions,
          sourceUnitsPerPortion: sourceUnitsFor(profile),
          windowId: assigned.windowId,
          readyBatchId: null,
          reuseReady: false,
          shoppingIntentId: intent.id,
          explanations,
          timingFit: assigned.timingFit,
        },
        Math.min(desiredPortions, portions),
      );
      continue;
    }

    let explanations = baseExplanations(recipe, profile, recipes);
    if (ready) {
      explanations = addUnique(
        explanations,
        `Freshly prepares ${freshPortions} portions to complete the requested target after ready-food allocation.`,
      );
      if (readyPortions <= epsilon && ready.mealPortions > epsilon)
        explanations = addUnique(
          explanations,
          'A partial ready amount remains available but is not treated as a complete meal portion.',
        );
    }
    addChoice(
      {
        sourceServings: freshPortions * sourceUnitsFor(profile),
        portions: freshPortions,
        sourceUnitsPerPortion: sourceUnitsFor(profile),
        windowId: assigned.windowId,
        readyBatchId: null,
        reuseReady: false,
        shoppingIntentId: null,
        explanations,
        timingFit: assigned.timingFit,
      },
      freshPortions,
    );
  }
  const allocated = allocateUses(
    specs,
    datesFor(request.weekStart, request.days),
    request.slots,
    request.people,
    occupiedTargets,
    usedIds,
  );
  for (const choice of choices) allocationNote(choice, totalUses(allocated.get(choice.id) ?? []));
  return { choices, uses: choices.flatMap((choice) => allocated.get(choice.id) ?? []) };
};

const useForDailyChoice = (
  state: AppState,
  week: BatchWeek,
  dailyChoiceId: string | null,
): BatchUse | null => {
  if (dailyChoiceId === null) return null;
  const daily = state.experience?.dailyChoices.find((choice) => choice.id === dailyChoiceId);
  if (!daily?.useId) return null;
  return week.uses.find((use) => use.id === daily.useId) ?? null;
};

const preparedOrCookingChoice = (
  state: AppState,
  week: BatchWeek,
  choice: BatchChoice,
): boolean => {
  if (choice.readyBatchId !== null) return true;
  const experience = state.experience;
  if (!experience) return false;
  const hasDailyUse = (dailyChoiceId: string | null): boolean =>
    useForDailyChoice(state, week, dailyChoiceId)?.choiceId === choice.id;
  return (
    experience.batches.some((batch) => batch.weekId === week.id && hasDailyUse(batch.choiceId)) ||
    experience.sessions.some(
      (session) => session.weekId === week.id && hasDailyUse(session.choiceId),
    )
  );
};

const useIsProtected = (state: AppState, use: BatchUse): boolean => {
  if (use.locked || state.logs.some((log) => log.useId === use.id)) return true;
  return (state.experience?.dailyChoices ?? []).some(
    (daily) =>
      daily.useId === use.id &&
      (daily.logId !== null || daily.sessionId !== null || daily.batchId !== null),
  );
};

const sequentialTiming = (
  state: AppState,
  choices: BatchChoice[],
  windows: CookingWindow[],
): BatchChoice[] => {
  const capacity = new Map(windows.map((window) => [window.id, window.availableMinutes]));
  const consumed = new Map<string, number>();
  return choices.map((original) => {
    const choice = copyChoice(original);
    const profile = profileFor(state, choice.recipeId);
    const recipe = recipeById(state, choice.recipeId);
    if (choice.reuseReady || choice.readyBatchId !== null) {
      choice.timingFit = 'unknown';
      return choice;
    }
    if (!timingConfirmed(profile)) {
      choice.timingFit = 'unknown';
      choice.explanations = addUnique(choice.explanations, timingGap(profile));
      return choice;
    }
    if (!sourceDoseConfirmed(recipe, choice.sourceServings)) {
      choice.timingFit = 'unknown';
      choice.explanations = addUnique(
        choice.explanations,
        'Quantity changed from the published source dose; confirm timing and equipment capacity before claiming this batch fits.',
      );
      return choice;
    }
    if (!choice.windowId || !capacity.has(choice.windowId)) {
      choice.timingFit = 'unknown';
      choice.explanations = addUnique(
        choice.explanations,
        'Choose a real cooking window before claiming a timing fit.',
      );
      return choice;
    }
    const used = consumed.get(choice.windowId) ?? 0;
    const required = profile.elapsedMinutes!;
    const available = capacity.get(choice.windowId)!;
    if (used + required > available) {
      choice.timingFit = 'over_budget';
      choice.explanations = addUnique(
        choice.explanations,
        `Sequential elapsed time exceeds the ${choice.windowId} window capacity.`,
      );
      return choice;
    }
    consumed.set(choice.windowId, used + required);
    choice.timingFit = 'confirmed';
    return choice;
  });
};

const recipeById = (state: AppState, recipeId: string): Recipe => {
  const recipe = state.recipes.find((item) => item.id === recipeId);
  if (!recipe) throw new Error(`Saved recipe "${recipeId}" is unavailable.`);
  return recipe;
};

const assertWeekRange = (week: BatchWeek, date: string): void => {
  if (!dateOnly(date) || !new Set(datesFor(week.weekStart, week.days)).has(date))
    throw new Error('Meal date must stay inside this saved week range.');
};
const assertUseSlot = (recipe: Recipe, slot: MealType): void => {
  if (!mealTypes.includes(slot)) throw new Error('Meal slot is not valid.');
  if (!compatible(recipe, slot))
    throw new Error(`${recipe.name} is not saved for the ${slot} role.`);
};

const portionsForRequest =
  (request: BatchPlanRequest) =>
  (recipes: Recipe[]): Map<string, number> =>
    new Map(
      recipes.map((recipe, index) => [
        recipe.id,
        distribute(request.targetPortions, recipes.length)[index],
      ]),
    );

const proposeWeek = (state: AppState, request: BatchPlanRequest, id: string): BatchWeek => {
  validateRequest(request);
  if (!id.trim()) throw new Error('A saved draft needs an ID.');
  const filtered = filterRecipes(state.recipes, request.filters);
  const candidates = filtered.filter((recipe) =>
    request.slots.some((slot) => compatible(recipe, slot)),
  );
  for (const slot of request.slots)
    if (!candidates.some((recipe) => compatible(recipe, slot)))
      throw new Error(
        `No eligible recipe is available for the ${slot} role under the selected filters.`,
      );
  const { recipes, assignments, portions } = chooseScheduledRecipes(
    candidates,
    request.distinctRecipes,
    state,
    request,
    portionsForRequest(request),
  );
  const draft = makeDraftChoices(state, request, recipes, assignments, new Set<string>(), portions);
  return {
    id,
    label: `Week of ${request.weekStart}`,
    weekStart: request.weekStart,
    days: request.days,
    people: request.people,
    slots: [...request.slots],
    windows: request.windows.map(copyWindow),
    choices: draft.choices,
    uses: draft.uses,
    confirmed: false,
    createdAt: now(),
    legacyPlanId: null,
  };
};

const rerollWeek = (state: AppState, week: BatchWeek, request: BatchPlanRequest): BatchWeek => {
  const rerollRequest: BatchPlanRequest = {
    ...request,
    weekStart: week.weekStart,
    days: week.days,
    people: week.people,
    slots: [...week.slots],
    windows: week.windows.map(copyWindow),
  };
  validateRequest(rerollRequest);
  const protectedChoices = week.choices.filter(
    (choice) => choice.locked || preparedOrCookingChoice(state, week, choice),
  );
  const protectedIds = new Set(protectedChoices.map((choice) => choice.recipeId));
  const filtered = filterRecipes(state.recipes, rerollRequest.filters).filter((recipe) =>
    rerollRequest.slots.some((slot) => compatible(recipe, slot)),
  );
  const protectedRecipes = [...protectedIds].map((recipeId) => recipeById(state, recipeId));
  const candidates = [
    ...new Map([...filtered, ...protectedRecipes].map((recipe) => [recipe.id, recipe])).values(),
  ];
  if (protectedIds.size > request.distinctRecipes)
    throw new Error(
      `Retained cooked and locked choices use ${protectedIds.size} distinct recipes, more than the requested ${request.distinctRecipes}.`,
    );
  const retainedPortions = protectedChoices.reduce((sum, choice) => sum + choice.portions, 0);
  const remainingPortions = Math.max(0, rerollRequest.targetPortions - retainedPortions);
  const newRecipeCount = rerollRequest.distinctRecipes - protectedIds.size;
  if (
    newRecipeCount > 0 &&
    Number.isInteger(remainingPortions) &&
    remainingPortions < newRecipeCount
  ) {
    throw new Error(
      'Retained batches leave too few whole portions for every newly requested recipe. Reduce the recipe count or enter an explicit fractional target.',
    );
  }
  const plannedForReroll = (recipes: Recipe[]): Map<string, number> => {
    const newRecipes = recipes.filter((recipe) => !protectedIds.has(recipe.id));
    const distribution = distribute(remainingPortions, Math.max(1, newRecipes.length));
    return new Map(
      recipes.map((recipe) => {
        const retained = protectedChoices.find((choice) => choice.recipeId === recipe.id);
        return [
          recipe.id,
          retained?.portions ?? distribution[newRecipes.findIndex((item) => item.id === recipe.id)],
        ];
      }),
    );
  };
  const { recipes, assignments, portions } = chooseScheduledRecipes(
    candidates,
    rerollRequest.distinctRecipes,
    state,
    rerollRequest,
    plannedForReroll,
    protectedIds,
  );
  const newRecipes = recipes.filter((recipe) => !protectedIds.has(recipe.id));
  const usedIds = new Set([
    ...week.choices.map((choice) => choice.id),
    ...week.uses.map((use) => use.id),
  ]);
  const retainedIds = new Set(protectedChoices.map((choice) => choice.id));
  const retainedUses = week.uses.filter((use) => retainedIds.has(use.choiceId)).map(copyUse);
  const occupiedTargets = new Set(retainedUses.map((use) => `${use.date}|${use.slot}`));
  const regenerated = makeDraftChoices(
    state,
    rerollRequest,
    newRecipes,
    assignments,
    usedIds,
    new Map(newRecipes.map((recipe) => [recipe.id, portions.get(recipe.id) ?? 0])),
    occupiedTargets,
  );
  return {
    ...week,
    choices: sequentialTiming(
      state,
      [...protectedChoices.map(copyChoice), ...regenerated.choices],
      week.windows,
    ),
    uses: [...retainedUses, ...regenerated.uses],
  };
};

const reallocateChoiceUses = (
  state: AppState,
  week: BatchWeek,
  choice: BatchChoice,
  portions: number,
): BatchUse[] => {
  const targetUses = week.uses.filter((use) => use.choiceId === choice.id);
  const retained = targetUses
    .filter((use) => use.skipped || useIsProtected(state, use))
    .map(copyUse);
  const protectedPortions = totalUses(retained);
  if (protectedPortions - portions > epsilon)
    throw new Error('Locked, cooked, or logged meal uses already exceed the new planned portions.');
  const mutableIds = new Set(
    targetUses.filter((use) => !retained.some((saved) => saved.id === use.id)).map((use) => use.id),
  );
  const otherUses = week.uses
    .filter((use) => !mutableIds.has(use.id) && use.choiceId !== choice.id)
    .map(copyUse);
  const occupied = new Set([...otherUses, ...retained].map((use) => `${use.date}|${use.slot}`));
  const ids = new Set([
    ...week.choices.map((item) => item.id),
    ...week.uses.map((item) => item.id),
  ]);
  const allocation =
    allocateUses(
      [
        {
          choiceId: choice.id,
          recipe: recipeById(state, choice.recipeId),
          portions: Math.max(0, portions - protectedPortions),
        },
      ],
      datesFor(week.weekStart, week.days),
      week.slots,
      week.people,
      occupied,
      ids,
    ).get(choice.id) ?? [];
  return [...otherUses, ...retained, ...allocation];
};

const changePortions = (
  state: AppState,
  week: BatchWeek,
  choiceId: string,
  portions: number,
): BatchWeek => {
  if (!finitePositive(portions)) throw new Error('Planned portions must be a positive number.');
  const target = week.choices.find((choice) => choice.id === choiceId);
  if (!target) throw new Error('That batch choice no longer exists.');
  if (target.locked) throw new Error('Unlock this batch before changing its portions.');
  const recipe = recipeById(state, target.recipeId);
  const cooked = preparedOrCookingChoice(state, week, target);
  const profile = profileFor(state, target.recipeId);
  const uses = reallocateChoiceUses(state, week, target, portions);
  const choices = week.choices.map((choice) => {
    if (choice.id !== choiceId) return copyChoice(choice);
    const changed = copyChoice(choice);
    changed.portions = portions;
    if (!cooked && !choice.reuseReady) changed.sourceServings = portions * sourceUnitsFor(profile);
    if (cooked)
      changed.explanations = addUnique(
        changed.explanations,
        'Prepared yield is fixed; changing planned portions does not rewrite the cooked batch.',
      );
    return allocationNote(changed, totalUses(uses.filter((use) => use.choiceId === choiceId)));
  });
  return { ...week, choices: sequentialTiming(state, choices, week.windows), uses };
};

const changeUse = (
  state: AppState,
  week: BatchWeek,
  useId: string,
  patch: { date?: string; slot?: MealType; skipped?: boolean },
): BatchWeek => {
  const target = week.uses.find((use) => use.id === useId);
  if (!target) throw new Error('That planned meal no longer exists.');
  const choice = week.choices.find((item) => item.id === target.choiceId);
  if (!choice) throw new Error('That meal no longer has a batch choice.');
  if (target.locked || choice.locked)
    throw new Error('Unlock this meal and batch before editing it.');
  if (useIsProtected(state, target))
    throw new Error(
      'A logged or cooking meal cannot be moved, skipped, or rewritten as another historical meal.',
    );
  const recipe = recipeById(state, choice.recipeId);
  const date = patch.date ?? target.date;
  const slot = patch.slot ?? target.slot;
  assertWeekRange(week, date);
  assertUseSlot(recipe, slot);
  if (week.uses.some((use) => use.id !== target.id && use.date === date && use.slot === slot))
    throw new Error('Another planned meal already uses that date and slot.');
  return {
    ...week,
    choices: week.choices.map(copyChoice),
    uses: week.uses.map((use) =>
      use.id === useId
        ? { ...use, date, slot, ...(patch.skipped === undefined ? {} : { skipped: patch.skipped }) }
        : copyUse(use),
    ),
  };
};

const moveWindow = (
  state: AppState,
  week: BatchWeek,
  windowId: string,
  patch: { date: string; startTime: string; availableMinutes: number },
): BatchWeek => {
  const oldWindow = week.windows.find((window) => window.id === windowId);
  if (!oldWindow) throw new Error('That cooking window no longer exists.');
  assertWeekRange(week, patch.date);
  if (!validTime(patch.startTime))
    throw new Error('Cooking window needs a valid local start time.');
  if (!finitePositive(patch.availableMinutes))
    throw new Error('Cooking window needs positive available minutes.');
  const windows = week.windows.map((window) =>
    window.id === windowId ? { ...window, ...patch } : copyWindow(window),
  );
  return {
    ...week,
    windows,
    choices: sequentialTiming(state, week.choices, windows),
    uses: week.uses.map(copyUse),
  };
};

const choiceForReplacement = (
  state: AppState,
  recipe: Recipe,
  portions: number,
  windowId: string | null,
  id: string,
  allowReadyReuse = false,
): BatchChoice => {
  const profile = profileFor(state, recipe.id);
  const ready =
    allowReadyReuse && state.experience?.lastPlanRequest?.reuseReady
      ? readyFor(state, recipe.id)
      : null;
  const reuseReady = ready !== null && ready.mealPortions + epsilon >= portions;
  const sourceServings = portions * sourceUnitsFor(profile);
  let explanations = baseExplanations(recipe, profile, [recipe]);
  if (reuseReady && ready) {
    const actualUnits =
      (sourceServings * ready.batch.actualYield) / ready.batch.preparedSourceServings;
    explanations = addUnique(
      explanations,
      `Uses ${actualUnits} available ${ready.batch.yieldUnit} units from a prepared batch; it will not be bought or cooked again.`,
    );
  }
  return {
    id,
    recipeId: recipe.id,
    portions,
    sourceServings,
    sourceUnitsPerPortion: sourceUnitsFor(profile),
    windowId: reuseReady ? null : windowId,
    locked: false,
    readyBatchId: reuseReady && ready ? ready.batch.id : null,
    reuseReady,
    shoppingIntentId: null,
    explanations,
    timingFit: 'unknown',
  };
};

const explicitSwapNotes = (
  choice: BatchChoice,
  recipe: Recipe,
  slots: MealType[],
  outsideSavedFilters: boolean,
): BatchChoice => {
  const updated = copyChoice(choice);
  if (outsideSavedFilters)
    updated.explanations = addUnique(
      updated.explanations,
      'Your explicit choice is outside saved planning filters.',
    );
  const exceptionalSlots = [...new Set(slots.filter((slot) => !compatible(recipe, slot)))];
  if (exceptionalSlots.length > 0)
    updated.explanations = addUnique(
      updated.explanations,
      `Placed in the ${exceptionalSlots.join(' and ')} slot${exceptionalSlots.length === 1 ? '' : 's'} by your explicit choice; saved recipe roles remain unchanged.`,
    );
  return updated;
};

const swap = (state: AppState, week: BatchWeek, request: SwapRequest): BatchWeek => {
  if (request.weekId !== week.id)
    throw new Error('Swap request does not belong to this saved week.');
  const replacement = recipeById(state, request.recipeId);
  const activeFilters = state.experience?.lastPlanRequest?.filters;
  const outsideSavedFilters =
    activeFilters !== null && activeFilters !== undefined
      ? filterRecipes([replacement], activeFilters).length === 0
      : false;
  const usedIds = new Set([
    ...week.choices.map((choice) => choice.id),
    ...week.uses.map((use) => use.id),
  ]);
  if (request.scope === 'batch') {
    const target = week.choices.find((choice) => choice.id === request.targetId);
    if (!target) throw new Error('That batch choice no longer exists.');
    if (target.locked) throw new Error('Unlock this batch before swapping it.');
    if (preparedOrCookingChoice(state, week, target))
      throw new Error(
        'A cooked, ready, or in-progress batch cannot be transformed into another recipe. Swap one future meal instead.',
      );
    const targetSlots = week.uses
      .filter((use) => use.choiceId === target.id)
      .map((use) => use.slot);
    const updated = explicitSwapNotes(
      choiceForReplacement(state, replacement, target.portions, target.windowId, target.id, true),
      replacement,
      targetSlots,
      outsideSavedFilters,
    );
    return {
      ...week,
      choices: sequentialTiming(
        state,
        week.choices.map((choice) => (choice.id === target.id ? updated : copyChoice(choice))),
        week.windows,
      ),
      uses: week.uses.map(copyUse),
    };
  }
  const targetUse = week.uses.find((use) => use.id === request.targetId);
  if (!targetUse) throw new Error('That planned meal no longer exists.');
  const targetChoice = week.choices.find((choice) => choice.id === targetUse.choiceId);
  if (!targetChoice) throw new Error('That meal no longer has a batch choice.');
  if (targetUse.locked || targetChoice.locked)
    throw new Error('Unlock this meal and batch before swapping it.');
  if (useIsProtected(state, targetUse))
    throw new Error('A logged or in-progress meal cannot be transformed into another recipe.');
  const replacementId = generatedId('choice', usedIds);
  const newChoice = explicitSwapNotes(
    choiceForReplacement(
      state,
      replacement,
      targetUse.portions,
      targetChoice.windowId,
      replacementId,
      true,
    ),
    replacement,
    [targetUse.slot],
    outsideSavedFilters,
  );
  const choices = week.choices.map(copyChoice);
  if (!preparedOrCookingChoice(state, week, targetChoice)) {
    const remaining = targetChoice.portions - targetUse.portions;
    if (remaining > epsilon) {
      const source = choices.find((choice) => choice.id === targetChoice.id)!;
      const profile = profileFor(state, source.recipeId);
      source.portions = remaining;
      source.sourceServings = remaining * sourceUnitsFor(profile);
    } else {
      choices.splice(
        choices.findIndex((choice) => choice.id === targetChoice.id),
        1,
      );
    }
  }
  choices.push(newChoice);
  return {
    ...week,
    choices: sequentialTiming(state, choices, week.windows),
    uses: week.uses.map((use) =>
      use.id === targetUse.id ? { ...use, choiceId: replacementId } : copyUse(use),
    ),
  };
};

const addRecipe = (
  state: AppState,
  week: BatchWeek | null,
  recipeId: string,
  sourceServings: number,
  portions: number,
  id: string,
  date: string,
): BatchWeek => {
  const recipe = recipeById(state, recipeId);
  if (!finitePositive(sourceServings) || !finitePositive(portions))
    throw new Error('Source servings and planned portions must be positive numbers.');
  if (!dateOnly(date)) throw new Error('Meal date must be a real YYYY-MM-DD date.');
  if (week && week.choices.some((choice) => choice.recipeId === recipeId)) return week;
  const profile = profileFor(state, recipeId);
  const preferred = state.experience?.preferredSlot;
  const slot = preferred && compatible(recipe, preferred) ? preferred : recipe.roles[0];
  if (!slot) throw new Error(`${recipe.name} has no saved meal role.`);
  const createChoice = (choiceId: string): BatchChoice => ({
    ...choiceForReplacement(state, recipe, portions, null, choiceId),
    sourceServings,
    sourceUnitsPerPortion: sourceServings / portions,
    explanations: addUnique(
      baseExplanations(recipe, profile, [recipe]),
      'Added directly from the saved recipe.',
    ),
  });
  if (!week) {
    const usedIds = new Set<string>();
    const choice = createChoice(generatedId('choice', usedIds));
    const allocated =
      allocateUses(
        [{ choiceId: choice.id, recipe, portions }],
        datesFor(date, 7),
        [slot],
        1,
        new Set(),
        usedIds,
      ).get(choice.id) ?? [];
    allocationNote(choice, totalUses(allocated));
    return {
      id,
      label: `Draft for ${date}`,
      weekStart: date,
      days: 7,
      people: 1,
      slots: [slot],
      windows: [],
      choices: [choice],
      uses: allocated,
      confirmed: false,
      createdAt: now(),
      legacyPlanId: null,
    };
  }
  const usedIds = new Set([
    ...week.choices.map((choice) => choice.id),
    ...week.uses.map((use) => use.id),
  ]);
  const choice = createChoice(generatedId('choice', usedIds));
  const occupied = new Set(week.uses.map((use) => `${use.date}|${use.slot}`));
  const allocated =
    allocateUses(
      [{ choiceId: choice.id, recipe, portions }],
      datesFor(week.weekStart, week.days),
      week.slots,
      week.people,
      occupied,
      usedIds,
    ).get(choice.id) ?? [];
  allocationNote(choice, totalUses(allocated));
  return {
    ...week,
    choices: sequentialTiming(state, [...week.choices.map(copyChoice), choice], week.windows),
    uses: [...week.uses.map(copyUse), ...allocated],
  };
};

export const batchPlanning: BatchPlanningAPI = {
  proposeWeek,
  rerollWeek,
  changePortions,
  changeUse,
  moveWindow,
  swap,
  addRecipe,
};
