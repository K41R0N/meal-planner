import { perServingNutrition } from './nutrition';
import { validateRecipes } from './validation';
import { validateExperienceState } from './experience-validation';
import type { ExperienceEngine } from './experience-api';
import type {
  BatchChoice,
  BatchUse,
  BatchWeek,
  CookingSession,
  CookingTimer,
  DailyChoice,
  ExperienceState,
  FoodStorage,
  PreparedBatch,
  RecipeProfile,
  TodayContext,
} from './experience-types';
import {
  emptyNutrition,
  mealTypes,
  type AppState,
  type ConsumptionEntry,
  type MealType,
  type Nutrition,
  type Recipe,
  type WeekPlan,
} from './types';

const htmlTag = /<\/?[a-z][^>]*>/i;
const storageStates = new Set<FoodStorage>(['unconfirmed', 'fridge', 'freezer', 'other']);

const fail = (message: string): never => {
  throw new Error(message);
};

const nonEmptyText = (value: unknown, label: string, allowEmpty = false, max = 10_000): string => {
  if (typeof value !== 'string') return fail(`${label} must be text.`);
  const result = value.trim();
  if (!allowEmpty && !result) return fail(`${label} must not be empty.`);
  if (result.length > max) return fail(`${label} must be no longer than ${max} characters.`);
  if (htmlTag.test(result)) return fail(`${label} must be plain text, not HTML.`);
  return result;
};

const finitePositive = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    return fail(`${label} must be a positive finite number.`);
  return value;
};

const finiteNonNegative = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    return fail(`${label} must be a finite non-negative number.`);
  return value;
};

/** A day: longer than any single cooking session the planner should fit into a window. */
const MAX_COOK_MINUTES = 24 * 60;

const learnedTiming = (value: unknown): number => {
  const minutes = finitePositive(value, 'Cooking minutes');
  if (minutes > MAX_COOK_MINUTES) return fail('Cooking minutes must be at most 24 hours.');
  return minutes;
};

const mealSlot = (value: unknown, label: string): MealType => {
  if (typeof value !== 'string' || !mealTypes.includes(value as MealType))
    return fail(`${label} must be a supported meal slot.`);
  return value as MealType;
};

const realDate = (value: unknown, label: string): string => {
  const result = nonEmptyText(value, label);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result);
  if (!match) return fail(`${label} must use a real YYYY-MM-DD date.`);
  const [year, month, day] = match.slice(1).map(Number);
  const checked = new Date(year, month - 1, day);
  if (
    checked.getFullYear() !== year ||
    checked.getMonth() !== month - 1 ||
    checked.getDate() !== day
  )
    return fail(`${label} must use a real YYYY-MM-DD date.`);
  return result;
};

const cloneNutrition = (nutrition: Nutrition): Nutrition => ({ ...nutrition });

const cloneRecipe = (recipe: Recipe): Recipe => ({
  ...recipe,
  roles: [...recipe.roles],
  tags: [...recipe.tags],
  categories: [...recipe.categories],
  ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
  steps: [...recipe.steps],
  nutrition: cloneNutrition(recipe.nutrition),
  reportedNutrition: cloneNutrition(recipe.reportedNutrition),
  dataGaps: [...recipe.dataGaps],
  ...(recipe.sourceEvidence === undefined ? {} : { sourceEvidence: { ...recipe.sourceEvidence } }),
});

const cloneTimers = (timers: CookingTimer[]): CookingTimer[] =>
  timers.map((timer) => ({ ...timer }));

const todayId = (date: string, slot: MealType): string => `today:${date}:${slot}`;
const now = (): string => new Date().toISOString();

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

const newRecipeProfile = (yieldUnit: string): RecipeProfile => ({
  yieldUnit,
  sourceUnitsPerPortion: 1,
  portionSizeConfirmed: false,
  activeMinutes: null,
  elapsedMinutes: null,
  reheatMinutes: null,
  equipment: [],
  equipmentConfirmed: false,
  reheatNotes: '',
  notes: '',
});

const choiceForLegacyMeal = (plan: WeekPlan, recipeId: string, index: number): BatchChoice => {
  const meals = plan.meals.filter((meal) => meal.recipeId === recipeId);
  const portions = meals.reduce((sum, meal) => sum + meal.servings, 0);
  return {
    id: `legacy:${plan.id}:choice:${index}`,
    recipeId,
    sourceServings: portions,
    portions,
    sourceUnitsPerPortion: 1,
    windowId: null,
    locked: meals.every((meal) => meal.locked),
    readyBatchId: null,
    reuseReady: false,
    shoppingIntentId: null,
    explanations: ['Adapted from the saved weekly plan.'],
    timingFit: 'unknown',
  };
};

const adaptLegacyPlan = (plan: WeekPlan): BatchWeek => {
  const byRecipe = new Map<string, BatchChoice>();
  let index = 0;
  for (const meal of plan.meals) {
    if (byRecipe.has(meal.recipeId)) continue;
    byRecipe.set(meal.recipeId, choiceForLegacyMeal(plan, meal.recipeId, index));
    index += 1;
  }
  const choices = [...byRecipe.values()];
  const uses: BatchUse[] = plan.meals.map((meal) => ({
    id: meal.id,
    choiceId: byRecipe.get(meal.recipeId)!.id,
    date: meal.date,
    slot: meal.slot,
    portions: meal.servings,
    locked: meal.locked,
    skipped: false,
  }));
  return {
    id: plan.id,
    label: `Week of ${plan.config.weekStart}`,
    weekStart: plan.config.weekStart,
    days: plan.config.days,
    people: plan.config.people,
    slots: [...plan.config.slots],
    windows: [],
    choices,
    uses,
    confirmed: true,
    createdAt: plan.createdAt,
    legacyPlanId: plan.id,
  };
};

const validateExistingExperience = (state: AppState): ExperienceState =>
  validateExperienceState(state.experience, {
    recipes: state.recipes,
    plans: state.plans,
    logs: state.logs,
    validateRecipe: (value) => validateRecipes([value])[0],
  });

const attachMissingLegacyPlans = (
  state: AppState,
  experience: ExperienceState,
): ExperienceState => {
  const adaptedPlanIds = new Set(
    experience.weeks.flatMap((week) => (week.legacyPlanId === null ? [] : [week.legacyPlanId])),
  );
  const missingPlans = state.plans.filter((plan) => !adaptedPlanIds.has(plan.id));
  if (missingPlans.length === 0) return experience;
  const existingWeekIds = new Set(experience.weeks.map((week) => week.id));
  for (const plan of missingPlans)
    if (existingWeekIds.has(plan.id)) {
      return fail(
        `Cannot adapt legacy plan "${plan.id}" because that batch-week id is already in use.`,
      );
    }
  const weeks = [...experience.weeks, ...missingPlans.map(adaptLegacyPlan)];
  const activeWeekId =
    experience.activeWeekId === null &&
    state.activePlanId !== null &&
    missingPlans.some((plan) => plan.id === state.activePlanId)
      ? state.activePlanId
      : experience.activeWeekId;
  return { ...experience, weeks, activeWeekId };
};

const ensure = (state: AppState): AppState => {
  const base =
    state.experience === undefined ? emptyExperience() : validateExistingExperience(state);
  const experience = attachMissingLegacyPlans(state, base);
  const activeWeekId =
    experience.activeWeekId === null &&
    state.activePlanId !== null &&
    experience.weeks.some((week) => week.id === state.activePlanId)
      ? state.activePlanId
      : experience.activeWeekId;
  if (state.experience === experience && activeWeekId === experience.activeWeekId) return state;
  return {
    ...state,
    experience:
      activeWeekId === experience.activeWeekId ? experience : { ...experience, activeWeekId },
  };
};

const withExperience = (state: AppState, experience: ExperienceState): AppState => ({
  ...state,
  experience,
});

const findWeekUse = (
  experience: ExperienceState,
  useId: string | null,
): { week: BatchWeek; use: BatchUse; choice: BatchChoice } | null => {
  if (useId === null) return null;
  for (const week of experience.weeks) {
    const use = week.uses.find((item) => item.id === useId);
    if (!use) continue;
    const choice = week.choices.find((item) => item.id === use.choiceId);
    if (choice) return { week, use, choice };
  }
  return null;
};

const activePlannedUse = (
  experience: ExperienceState,
  date: string,
  slot: MealType,
): { week: BatchWeek; use: BatchUse; choice: BatchChoice } | null => {
  if (experience.activeWeekId === null) return null;
  const week = experience.weeks.find((item) => item.id === experience.activeWeekId);
  if (!week) return null;
  const use = week.uses.find((item) => item.date === date && item.slot === slot && !item.skipped);
  if (!use) return null;
  const choice = week.choices.find((item) => item.id === use.choiceId);
  return choice ? { week, use, choice } : null;
};

const usableSavedRecipes = (recipes: Recipe[], slot?: MealType): Recipe[] =>
  recipes
    .filter(
      (recipe) =>
        recipe.name.trim().length > 0 && recipe.ingredients.length > 0 && recipe.steps.length > 0,
    )
    .slice()
    .sort((left, right) => {
      if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
      if (slot && left.roles.includes(slot) !== right.roles.includes(slot))
        return left.roles.includes(slot) ? -1 : 1;
      if (left.viewCount !== right.viewCount)
        return (right.viewCount ?? -1) - (left.viewCount ?? -1);
      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    });

const nutritionPerUnit = (
  recipe: Recipe,
  preparedSourceServings: number,
  actualYield: number,
): Nutrition => {
  const perServing = perServingNutrition(recipe);
  const result = emptyNutrition();
  for (const key of Object.keys(result) as Array<keyof Nutrition>) {
    const value = perServing[key];
    result[key] = value === null ? null : (value * preparedSourceServings) / actualYield;
  }
  return result;
};

const scaleNutrition = (nutrition: Nutrition, units: number): Nutrition => {
  const result = emptyNutrition();
  for (const key of Object.keys(result) as Array<keyof Nutrition>) {
    const value = nutrition[key];
    result[key] = value === null ? null : value * units;
  }
  return result;
};

const detachDailyAssociations = (
  experience: ExperienceState,
  dailyChoiceId: string,
): ExperienceState => ({
  ...experience,
  sessions: experience.sessions.map((session) =>
    session.choiceId === dailyChoiceId ? { ...session, choiceId: null } : session,
  ),
  batches: experience.batches.map((batch) =>
    batch.choiceId === dailyChoiceId ? { ...batch, choiceId: null } : batch,
  ),
});

const updateWeekReadyBatch = (
  experience: ExperienceState,
  weekId: string | null,
  useId: string | null,
  recipeId: string,
  batchId: string,
): ExperienceState => {
  if (weekId === null) return experience;
  const week = experience.weeks.find((item) => item.id === weekId);
  if (!week) return experience;
  const source = findWeekUse(experience, useId);
  const targetChoiceId =
    source?.week.id === weekId
      ? source.choice.id
      : week.choices.find((choice) => choice.recipeId === recipeId && choice.readyBatchId === null)
          ?.id;
  if (!targetChoiceId) return experience;
  return {
    ...experience,
    weeks: experience.weeks.map((item) =>
      item.id !== weekId
        ? item
        : {
            ...item,
            choices: item.choices.map((choice) =>
              choice.id === targetChoiceId ? { ...choice, readyBatchId: batchId } : choice,
            ),
          },
    ),
  };
};

const validateTimer = (value: CookingTimer, index: number): CookingTimer => {
  const id = nonEmptyText(value.id, `Timer ${index + 1} id`);
  const label = nonEmptyText(value.label, `Timer ${index + 1} label`);
  const durationSeconds = finitePositive(value.durationSeconds, `Timer ${index + 1} duration`);
  const remainingSeconds = finiteNonNegative(
    value.remainingSeconds,
    `Timer ${index + 1} remaining time`,
  );
  if (remainingSeconds > durationSeconds)
    return fail(`Timer ${index + 1} remaining time cannot exceed its duration.`);
  const endsAt =
    value.endsAt === null ? null : finiteNonNegative(value.endsAt, `Timer ${index + 1} end time`);
  return { id, label, durationSeconds, endsAt, remainingSeconds };
};

const todayContext = (state: AppState, date: string, slot: MealType): TodayContext => {
  const experience = state.experience;
  if (!experience)
    return {
      choice: null,
      recipe: null,
      session: null,
      batch: null,
      availableUnits: 0,
      use: null,
      status: 'empty',
      reason: 'No meal selected yet.',
      plannedSourceServings: 0,
    };
  const choice =
    experience.dailyChoices.find((item) => item.date === date && item.slot === slot) ?? null;
  if (choice === null) {
    const planned = activePlannedUse(experience, date, slot);
    const recipe = planned
      ? (state.recipes.find((item) => item.id === planned.choice.recipeId) ?? null)
      : null;
    return {
      choice: null,
      recipe,
      session: null,
      batch:
        planned?.choice.readyBatchId === null || planned === null
          ? null
          : (experience.batches.find((item) => item.id === planned.choice.readyBatchId) ?? null),
      availableUnits:
        planned?.choice.readyBatchId === null || planned === null
          ? 0
          : available(state, planned.choice.readyBatchId),
      use: planned?.use ?? null,
      status: recipe === null ? 'empty' : 'uncooked',
      reason: recipe === null ? 'No meal selected yet.' : 'A planned meal is available to choose.',
      plannedSourceServings: planned?.choice.sourceServings ?? recipe?.baseServings ?? 0,
    };
  }
  const batch =
    choice.batchId === null
      ? null
      : (experience.batches.find((item) => item.id === choice.batchId) ?? null);
  const session =
    choice.sessionId === null
      ? null
      : (experience.sessions.find((item) => item.id === choice.sessionId) ?? null);
  const useMatch = findWeekUse(experience, choice.useId);
  const recipe =
    batch?.recipeSnapshot ??
    session?.recipeSnapshot ??
    state.recipes.find((item) => item.id === choice.recipeId) ??
    null;
  const availableUnits = batch === null ? 0 : available(state, batch.id);
  const status: TodayContext['status'] =
    choice.logId !== null
      ? 'eaten'
      : session !== null && session.finishedAt === null
        ? 'cooking'
        : batch !== null
          ? 'ready'
          : recipe !== null
            ? 'uncooked'
            : 'empty';
  const reason =
    status === 'eaten'
      ? 'This meal was logged; choose the next meal when ready.'
      : status === 'cooking'
        ? 'Cooking is in progress.'
        : status === 'ready'
          ? 'Ready portions are available.'
          : status === 'uncooked'
            ? 'This meal has not been cooked yet.'
            : 'The selected meal is no longer available.';
  return {
    choice,
    recipe,
    session,
    batch,
    availableUnits,
    use: useMatch?.use ?? null,
    status,
    reason,
    plannedSourceServings:
      useMatch?.choice.sourceServings ?? session?.sourceServings ?? recipe?.baseServings ?? 0,
  };
};

const available = (state: AppState, batchId: string): number => {
  const experience = state.experience;
  const batch = experience?.batches.find((item) => item.id === batchId);
  if (!batch) return fail(`Prepared batch "${batchId}" was not found.`);
  const consumed = state.logs.reduce(
    (sum, log) =>
      log.batchId === batchId &&
      typeof log.batchUnits === 'number' &&
      Number.isFinite(log.batchUnits) &&
      log.batchUnits > 0
        ? sum + log.batchUnits
        : sum,
    0,
  );
  return batch.actualYield - consumed;
};

const choose = (
  state: AppState,
  date: string,
  slot: MealType,
  recipeId: string,
  context?: { batchId?: string; useId?: string },
  origin: DailyChoice['origin'] = 'pinned',
): AppState => {
  let working = ensure(state);
  const experience = working.experience!;
  realDate(date, 'Today date');
  mealSlot(slot, 'Today slot');
  const recipe = working.recipes.find((item) => item.id === recipeId);
  const batch =
    context?.batchId === undefined
      ? null
      : experience.batches.find((item) => item.id === context.batchId);
  if (context?.batchId !== undefined && !batch)
    return fail(`Prepared batch "${context.batchId}" was not found.`);
  if (batch && batch.recipeId !== recipeId)
    return fail('The prepared batch must match the selected recipe.');
  if (!recipe && !batch) return fail(`Saved recipe "${recipeId}" was not found.`);
  const use = context?.useId === undefined ? null : findWeekUse(experience, context.useId);
  if (context?.useId !== undefined && !use)
    return fail(`Batch use "${context.useId}" was not found.`);
  if (use !== null && use.choice.recipeId !== recipeId)
    return fail('The selected batch use must match the selected recipe.');
  const existing = experience.dailyChoices.find((item) => item.date === date && item.slot === slot);
  let nextExperience = existing ? detachDailyAssociations(experience, existing.id) : experience;
  const daily: DailyChoice = {
    id: existing?.id ?? todayId(date, slot),
    date,
    slot,
    recipeId,
    origin: batch === null ? origin : 'ready',
    useId: use?.use.id ?? null,
    batchId: batch?.id ?? null,
    sessionId: null,
    logId: null,
  };
  nextExperience = {
    ...nextExperience,
    dailyChoices: nextExperience.dailyChoices.some((item) => item.id === daily.id)
      ? nextExperience.dailyChoices.map((item) => (item.id === daily.id ? daily : item))
      : [...nextExperience.dailyChoices, daily],
  };
  return withExperience(working, nextExperience);
};

export const experienceEngine: ExperienceEngine = {
  ensureState(state) {
    return ensure(state);
  },

  ensureToday(state, date, slot) {
    const working = ensure(state);
    realDate(date, 'Today date');
    mealSlot(slot, 'Today slot');
    const experience = working.experience!;
    if (experience.dailyChoices.some((choice) => choice.date === date && choice.slot === slot))
      return working;
    const planned = activePlannedUse(experience, date, slot);
    if (planned) {
      return choose(
        working,
        date,
        slot,
        planned.choice.recipeId,
        {
          useId: planned.use.id,
          ...(planned.choice.readyBatchId === null ? {} : { batchId: planned.choice.readyBatchId }),
        },
        'week',
      );
    }
    const ready = experience.batches.find(
      (batch) => available(working, batch.id) > 0 && batch.recipeSnapshot.roles.includes(slot),
    );
    if (ready) return choose(working, date, slot, ready.recipeId, { batchId: ready.id }, 'ready');
    const saved = usableSavedRecipes(working.recipes, slot)[0];
    return saved ? choose(working, date, slot, saved.id, undefined, 'book') : working;
  },

  today(state, date, slot) {
    realDate(date, 'Today date');
    mealSlot(slot, 'Today slot');
    return todayContext(ensure(state), date, slot);
  },

  chooseToday(state, date, slot, recipeId, context) {
    return choose(state, date, slot, recipeId, context, 'pinned');
  },

  nextMeal(state, date, slot) {
    const working = ensureTodayForNext(state, date, slot);
    const experience = working.experience!;
    const current = experience.dailyChoices.find(
      (choice) => choice.date === date && choice.slot === slot,
    );
    const choices = usableSavedRecipes(working.recipes, slot).filter(
      (recipe) => recipe.id !== current?.recipeId,
    );
    if (choices.length === 0) return working;
    return choose(working, date, slot, choices[0].id, undefined, 'book');
  },

  startCook(state, recipeId, sourceServings, context) {
    finitePositive(sourceServings, 'Cooking source servings');
    const date = realDate(context.date, 'Cooking date');
    const slot = mealSlot(context.slot, 'Cooking slot');
    const sessionId = nonEmptyText(context.id, 'Cooking session id');
    let working = ensure(state);
    const recipe = working.recipes.find((item) => item.id === recipeId);
    if (!recipe) return fail(`Saved recipe "${recipeId}" was not found.`);
    const sourceYield =
      context.sourceYield === undefined
        ? undefined
        : finitePositive(context.sourceYield, 'Confirmed original yield');
    if (recipe.baseServings === null && sourceYield === undefined) {
      return fail(
        'Confirm the recipe’s original yield before scaling ingredients; the original method remains available to read.',
      );
    }
    const existing = working.experience!.sessions.find((session) => session.id === sessionId);
    if (existing) {
      if (existing.recipeId !== recipeId)
        return fail(`Cooking session id "${sessionId}" is already used for another recipe.`);
      return working;
    }
    let current =
      working.experience!.dailyChoices.find(
        (choice) => choice.date === date && choice.slot === slot,
      ) ?? null;
    if (context.choiceId !== undefined) {
      current =
        working.experience!.dailyChoices.find((choice) => choice.id === context.choiceId) ?? null;
      if (!current) return fail(`Daily choice "${context.choiceId}" was not found.`);
    }
    if (current === null || current.recipeId !== recipeId) {
      working = choose(working, date, slot, recipeId, undefined, 'pinned');
      current = working.experience!.dailyChoices.find(
        (choice) => choice.date === date && choice.slot === slot,
      )!;
    }
    const running = working.experience!.sessions.find(
      (session) => session.id === current!.sessionId && session.finishedAt === null,
    );
    if (running) return working;
    if (current.batchId !== null || current.logId !== null || current.sessionId !== null) {
      const cleared = detachDailyAssociations(working.experience!, current.id);
      current = { ...current, batchId: null, sessionId: null, logId: null };
      working = withExperience(working, {
        ...cleared,
        dailyChoices: cleared.dailyChoices.map((choice) =>
          choice.id === current!.id ? current! : choice,
        ),
      });
    }
    const linkedUse = findWeekUse(working.experience!, current.useId);
    const weekId = context.weekId ?? linkedUse?.week.id ?? null;
    if (weekId !== null && !working.experience!.weeks.some((week) => week.id === weekId))
      return fail(`Batch week "${weekId}" was not found.`);
    const snapshot = cloneRecipe(
      recipe.baseServings === null && sourceYield !== undefined
        ? { ...recipe, baseServings: sourceYield }
        : recipe,
    );
    const startedAt = now();
    const session: CookingSession = {
      id: sessionId,
      recipeId,
      recipeSnapshot: snapshot,
      sourceServings,
      stepIndex: 0,
      checkedIngredientIds: [],
      timers: [],
      startedAt,
      updatedAt: startedAt,
      finishedAt: null,
      weekId,
      choiceId: current.id,
    };
    const experience = working.experience!;
    return withExperience(working, {
      ...experience,
      sessions: [...experience.sessions, session],
      dailyChoices: experience.dailyChoices.map((choice) =>
        choice.id === current!.id ? { ...choice, sessionId: session.id } : choice,
      ),
    });
  },

  updateCook(state, sessionId, patch) {
    const working = ensure(state);
    const experience = working.experience!;
    const current = experience.sessions.find((session) => session.id === sessionId);
    if (!current) return fail(`Cooking session "${sessionId}" was not found.`);
    if (current.finishedAt !== null) return fail('A finished cooking session cannot be updated.');
    let stepIndex = current.stepIndex;
    let checkedIngredientIds = current.checkedIngredientIds;
    let timers = current.timers;
    if ('stepIndex' in patch && patch.stepIndex !== undefined) {
      if (
        !Number.isInteger(patch.stepIndex) ||
        patch.stepIndex < 0 ||
        (current.recipeSnapshot.steps.length > 0 &&
          patch.stepIndex >= current.recipeSnapshot.steps.length)
      )
        return fail('Cooking step must reference a recipe method step.');
      stepIndex = patch.stepIndex;
    }
    if ('checkedIngredientIds' in patch && patch.checkedIngredientIds !== undefined) {
      const ingredientIds = new Set(
        current.recipeSnapshot.ingredients.map((ingredient) => ingredient.id),
      );
      checkedIngredientIds = patch.checkedIngredientIds.map((ingredientId) =>
        nonEmptyText(ingredientId, 'Checked ingredient id'),
      );
      if (new Set(checkedIngredientIds).size !== checkedIngredientIds.length)
        return fail('Checked ingredients must not contain duplicates.');
      for (const ingredientId of checkedIngredientIds)
        if (!ingredientIds.has(ingredientId))
          return fail(`Checked ingredient "${ingredientId}" is not part of this recipe snapshot.`);
    }
    if ('timers' in patch && patch.timers !== undefined) {
      timers = patch.timers.map(validateTimer);
      if (new Set(timers.map((timer) => timer.id)).size !== timers.length)
        return fail('Cooking timers must have unique ids.');
    }
    const updated: CookingSession = {
      ...current,
      stepIndex,
      checkedIngredientIds: [...checkedIngredientIds],
      timers: cloneTimers(timers),
      updatedAt: now(),
    };
    return withExperience(working, {
      ...experience,
      sessions: experience.sessions.map((session) =>
        session.id === sessionId ? updated : session,
      ),
    });
  },

  finishCook(state, sessionId, input) {
    const working = ensure(state);
    let experience = working.experience!;
    const session = experience.sessions.find((item) => item.id === sessionId);
    if (!session) return fail(`Cooking session "${sessionId}" was not found.`);
    const prior = experience.batches.find((batch) => batch.sessionId === sessionId);
    if (prior) return working;
    const batchId = nonEmptyText(input.id, 'Prepared batch id');
    if (experience.batches.some((batch) => batch.id === batchId))
      return fail(`Prepared batch id "${batchId}" is already in use.`);
    const actualYield = finitePositive(input.actualYield, 'Actual divided yield');
    const preparedSourceServings =
      input.preparedSourceServings === undefined
        ? session.sourceServings
        : finitePositive(input.preparedSourceServings, 'Prepared source servings');
    const yieldUnit = nonEmptyText(input.yieldUnit, 'Yield unit');
    if (!storageStates.has(input.storage))
      return fail('Storage must be a supported storage state.');
    const storageNotes = nonEmptyText(input.storageNotes, 'Storage notes', true, 32_000);
    const reheatNotes = nonEmptyText(input.reheatNotes, 'Reheat notes', true, 32_000);
    const learnedMinutes = input.rememberTiming ? learnedTiming(input.elapsedMinutes) : null;
    const finishedAt = now();
    const batch: PreparedBatch = {
      id: batchId,
      sessionId: session.id,
      recipeId: session.recipeId,
      recipeSnapshot: cloneRecipe(session.recipeSnapshot),
      preparedSourceServings,
      actualYield,
      yieldUnit,
      nutritionPerUnit: nutritionPerUnit(
        session.recipeSnapshot,
        preparedSourceServings,
        actualYield,
      ),
      madeAt: finishedAt,
      storage: input.storage,
      storageNotes,
      reheatNotes,
      weekId: session.weekId,
      choiceId: session.choiceId,
    };
    experience = {
      ...experience,
      sessions: experience.sessions.map((item) =>
        item.id === session.id ? { ...item, finishedAt, updatedAt: finishedAt } : item,
      ),
      batches: [...experience.batches, batch],
      dailyChoices: experience.dailyChoices.map((choice) =>
        choice.id === session.choiceId
          ? { ...choice, sessionId: session.id, batchId: batch.id }
          : choice,
      ),
    };
    experience = updateWeekReadyBatch(
      experience,
      session.weekId,
      session.choiceId === null
        ? null
        : (experience.dailyChoices.find((choice) => choice.id === session.choiceId)?.useId ?? null),
      session.recipeId,
      batch.id,
    );
    if (learnedMinutes !== null) {
      // A confirmed cook teaches the recipe how long this amount takes, so later weeks can fit it into a window.
      const existing = experience.recipeProfiles[session.recipeId];
      experience = {
        ...experience,
        recipeProfiles: {
          ...experience.recipeProfiles,
          [session.recipeId]: {
            ...(existing ?? newRecipeProfile(yieldUnit)),
            elapsedMinutes: learnedMinutes,
            timingSourceServings: session.sourceServings,
            timingObservedAt: finishedAt,
          },
        },
      };
    }
    return withExperience(working, experience);
  },

  availableUnits(state, batchId) {
    return available(ensure(state), batchId);
  },

  consume(state, batchId, units, date, logId, context) {
    let working = ensure(state);
    const experience = working.experience!;
    const batch = experience.batches.find((item) => item.id === batchId);
    if (!batch) return fail(`Prepared batch "${batchId}" was not found.`);
    const id = nonEmptyText(logId, 'Consumption log id');
    if (working.logs.some((log) => log.id === id)) return working;
    const consumedUnits = finitePositive(units, 'Consumed portions');
    const consumedDate = realDate(date, 'Consumption date');
    const left = available(working, batchId);
    if (consumedUnits > left) return fail(`Only ${left} prepared portions are available.`);
    const dailyChoiceId = context?.dailyChoiceId ?? batch.choiceId;
    const choice =
      dailyChoiceId === null || dailyChoiceId === undefined
        ? null
        : (experience.dailyChoices.find((item) => item.id === dailyChoiceId) ?? null);
    if (dailyChoiceId !== null && dailyChoiceId !== undefined && !choice)
      return fail(`Daily choice "${dailyChoiceId}" was not found.`);
    if (choice?.logId !== null && choice?.logId !== undefined)
      return fail(
        'This meal already has a consumption entry; choose the next meal before logging another portion here.',
      );
    if (choice !== null && choice.recipeId !== batch.recipeId)
      return fail('The daily choice must match the prepared batch recipe.');
    const useId = context?.useId ?? choice?.useId ?? null;
    if (useId !== null) {
      const use = findWeekUse(experience, useId);
      if (!use) return fail(`Batch use "${useId}" was not found.`);
      if (use.choice.recipeId !== batch.recipeId)
        return fail('The batch use must match the prepared batch recipe.');
    }
    const log: ConsumptionEntry = {
      id,
      date: consumedDate,
      recipeId: batch.recipeId,
      name: batch.recipeSnapshot.name,
      servings: consumedUnits,
      nutritionSnapshot: scaleNutrition(batch.nutritionPerUnit, consumedUnits),
      createdAt: now(),
      batchId,
      batchUnits: consumedUnits,
      ...(useId === null ? {} : { useId }),
    };
    return withExperience(
      { ...working, logs: [...working.logs, log] },
      {
        ...experience,
        dailyChoices:
          choice === null
            ? experience.dailyChoices
            : experience.dailyChoices.map((item) =>
                item.id === choice.id ? { ...item, logId: id } : item,
              ),
      },
    );
  },

  undoConsumption(state, logId) {
    const working = ensure(state);
    const experience = working.experience!;
    if (!working.logs.some((log) => log.id === logId)) return working;
    return withExperience(
      { ...working, logs: working.logs.filter((log) => log.id !== logId) },
      {
        ...experience,
        dailyChoices: experience.dailyChoices.map((choice) =>
          choice.logId === logId ? { ...choice, logId: null } : choice,
        ),
      },
    );
  },

  updateProfile(state, recipeId, profile) {
    const working = ensure(state);
    if (!working.recipes.some((recipe) => recipe.id === recipeId))
      return fail(`Saved recipe "${recipeId}" was not found.`);
    const checked: RecipeProfile = {
      yieldUnit: nonEmptyText(profile.yieldUnit, 'Yield unit'),
      sourceUnitsPerPortion: finitePositive(
        profile.sourceUnitsPerPortion,
        'Source units per portion',
      ),
      portionSizeConfirmed: profile.portionSizeConfirmed,
      activeMinutes:
        profile.activeMinutes === null
          ? null
          : finiteNonNegative(profile.activeMinutes, 'Active minutes'),
      elapsedMinutes:
        profile.elapsedMinutes === null
          ? null
          : finiteNonNegative(profile.elapsedMinutes, 'Elapsed minutes'),
      reheatMinutes:
        profile.reheatMinutes === null
          ? null
          : finiteNonNegative(profile.reheatMinutes, 'Reheat minutes'),
      equipment: profile.equipment.map((item) => nonEmptyText(item, 'Equipment item')),
      equipmentConfirmed: profile.equipmentConfirmed,
      reheatNotes: nonEmptyText(profile.reheatNotes, 'Reheat notes', true, 32_000),
      notes: nonEmptyText(profile.notes, 'Profile notes', true, 32_000),
    };
    if (
      typeof checked.portionSizeConfirmed !== 'boolean' ||
      typeof checked.equipmentConfirmed !== 'boolean'
    )
      return fail('Profile confirmations must be true or false.');
    if (new Set(checked.equipment).size !== checked.equipment.length)
      return fail('Equipment must not contain duplicates.');
    // Timing provenance follows the elapsed time: kept while it is unchanged, cleared when it is edited by hand.
    const previous = working.experience!.recipeProfiles[recipeId];
    const keepsTiming =
      previous !== undefined && previous.elapsedMinutes === checked.elapsedMinutes;
    checked.timingSourceServings =
      profile.timingSourceServings === undefined
        ? keepsTiming
          ? (previous.timingSourceServings ?? null)
          : null
        : profile.timingSourceServings === null
          ? null
          : finitePositive(profile.timingSourceServings, 'Timing recipe servings');
    checked.timingObservedAt =
      profile.timingObservedAt === undefined
        ? keepsTiming
          ? (previous.timingObservedAt ?? null)
          : null
        : profile.timingObservedAt === null
          ? null
          : nonEmptyText(profile.timingObservedAt, 'Timing observation time');
    return withExperience(working, {
      ...working.experience!,
      recipeProfiles: { ...working.experience!.recipeProfiles, [recipeId]: checked },
    });
  },
};

const ensureTodayForNext = (state: AppState, date: string, slot: MealType): AppState => {
  const working = ensure(state);
  realDate(date, 'Today date');
  mealSlot(slot, 'Today slot');
  return working.experience!.dailyChoices.some(
    (choice) => choice.date === date && choice.slot === slot,
  )
    ? working
    : experienceEngine.ensureToday(working, date, slot);
};
