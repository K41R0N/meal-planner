import { filterRecipes } from './catalog';
import { validatePlanConfig } from './validation';
import type { Filters, MealType, PlanConfig, PlannedMeal, Recipe, WeekPlan } from './types';

interface SlotTarget {
  date: string;
  slot: MealType;
  key: string;
}

const randomId = (prefix: string): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};

const pick = <T>(items: T[]): T => {
  if (items.length === 0) throw new Error('No eligible recipe is available for this meal slot.');
  return items[Math.floor(Math.random() * items.length)];
};

const localDateRange = (weekStart: string, days: number): string[] => {
  const [year, month, day] = weekStart.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  });
};

const targetsFor = (config: PlanConfig): SlotTarget[] =>
  localDateRange(config.weekStart, config.days).flatMap((date) =>
    config.slots.map((slot) => ({ date, slot, key: `${date}|${slot}` })),
  );

const compatible = (recipe: Recipe, slot: MealType): boolean => recipe.roles.includes(slot);

/**
 * Finds a randomized matching that gives every newly selected recipe one slot.
 * Locks already count as an occurrence of their recipe.
 */
const matchSelectedRecipes = (
  recipeIds: string[],
  recipesById: Map<string, Recipe>,
  availableTargets: SlotTarget[],
): Map<string, SlotTarget> | null => {
  const recipeByTarget = new Map<string, string>();
  const targetByRecipe = new Map<string, SlotTarget>();

  const assign = (recipeId: string, visited: Set<string>): boolean => {
    const recipe = recipesById.get(recipeId);
    if (!recipe) return false;
    const options = shuffle(availableTargets.filter((target) => compatible(recipe, target.slot)));
    for (const target of options) {
      if (visited.has(target.key)) continue;
      visited.add(target.key);
      const displaced = recipeByTarget.get(target.key);
      if (!displaced || assign(displaced, visited)) {
        recipeByTarget.set(target.key, recipeId);
        targetByRecipe.set(recipeId, target);
        return true;
      }
    }
    return false;
  };

  for (const recipeId of shuffle(recipeIds)) {
    if (!assign(recipeId, new Set())) return null;
  }
  return targetByRecipe;
};

const preserveableLocks = (
  previous: WeekPlan | undefined,
  targets: SlotTarget[],
  candidatesById: Map<string, Recipe>,
): Map<string, PlannedMeal> => {
  const targetKeys = new Set(targets.map((target) => target.key));
  const locks = new Map<string, PlannedMeal>();
  if (!previous) return locks;

  for (const meal of previous.meals) {
    if (!meal.locked) continue;
    const key = `${meal.date}|${meal.slot}`;
    if (!targetKeys.has(key)) continue;
    if (locks.has(key)) throw new Error(`Cannot retain locks: more than one locked meal uses ${meal.date} ${meal.slot}.`);
    const recipe = candidatesById.get(meal.recipeId);
    if (!recipe || !compatible(recipe, meal.slot)) {
      throw new Error(`Cannot retain locked ${meal.slot} on ${meal.date}: its recipe no longer matches the current filters and role.`);
    }
    locks.set(key, meal);
  }
  return locks;
};

interface SelectionAttempt {
  recipeIds: Set<string>;
  representation: Map<string, SlotTarget>;
}

const selectionAttempt = (
  candidates: Recipe[],
  targets: SlotTarget[],
  locks: Map<string, PlannedMeal>,
  uniqueRecipes: number,
): SelectionAttempt | null => {
  const candidatesById = new Map(candidates.map((recipe) => [recipe.id, recipe]));
  const selected = new Set(Array.from(locks.values(), (meal) => meal.recipeId));
  if (selected.size > uniqueRecipes) return null;

  const unlockedTargets = targets.filter((target) => !locks.has(target.key));
  const rolesToCover = shuffle([...new Set(unlockedTargets.map((target) => target.slot))]);
  for (const role of rolesToCover) {
    const alreadyCovered = [...selected].some((id) => compatible(candidatesById.get(id) as Recipe, role));
    if (alreadyCovered) continue;
    const choices = candidates.filter((recipe) => compatible(recipe, role) && !selected.has(recipe.id));
    if (choices.length === 0) return null;
    selected.add(pick(choices).id);
  }
  if (selected.size > uniqueRecipes) return null;

  const remaining = shuffle(candidates.filter((recipe) => !selected.has(recipe.id)));
  while (selected.size < uniqueRecipes && remaining.length > 0) selected.add(remaining.shift()!.id);
  if (selected.size !== uniqueRecipes) return null;

  // Every unlocked configured role still needs at least one recipe in the selected set.
  if (unlockedTargets.some((target) => ![...selected].some((id) => compatible(candidatesById.get(id) as Recipe, target.slot)))) {
    return null;
  }

  const lockedRecipeIds = new Set(Array.from(locks.values(), (meal) => meal.recipeId));
  const needingOccurrence = [...selected].filter((id) => !lockedRecipeIds.has(id));
  const representation = matchSelectedRecipes(needingOccurrence, candidatesById, unlockedTargets);
  return representation ? { recipeIds: selected, representation } : null;
};

/**
 * Randomly creates a complete, saved week. It never relaxes filters, roles,
 * requested distinct count, or valid in-range locks.
 */
export const generateWeek = (recipes: Recipe[], config: PlanConfig, previous?: WeekPlan): WeekPlan => {
  const validConfig = validatePlanConfig(config);
  const targets = targetsFor(validConfig);
  const filtered = filterRecipes(recipes, validConfig.filters);
  const candidates = filtered.filter((recipe) => validConfig.slots.some((slot) => compatible(recipe, slot)));
  const candidatesById = new Map(candidates.map((recipe) => [recipe.id, recipe]));
  const locks = preserveableLocks(previous, targets, candidatesById);

  if (candidates.length < validConfig.uniqueRecipes) {
    throw new Error(`Need exactly ${validConfig.uniqueRecipes} eligible recipes, but only ${candidates.length} match the current filters and meal roles.`);
  }
  const lockedCount = new Set(Array.from(locks.values(), (meal) => meal.recipeId)).size;
  if (lockedCount > validConfig.uniqueRecipes) {
    throw new Error(`The retained locks use ${lockedCount} distinct recipes, more than the requested ${validConfig.uniqueRecipes}.`);
  }
  for (const slot of validConfig.slots) {
    if (!candidates.some((recipe) => compatible(recipe, slot))) {
      throw new Error(`No eligible recipe is available for the ${slot} slot under the current filters.`);
    }
  }

  let selection: SelectionAttempt | null = null;
  // Randomized construction avoids bias while bounded attempts keep offline planning responsive.
  for (let attempt = 0; attempt < 500 && !selection; attempt += 1) {
    selection = selectionAttempt(candidates, targets, locks, validConfig.uniqueRecipes);
  }
  if (!selection) {
    throw new Error(`Cannot place exactly ${validConfig.uniqueRecipes} distinct eligible recipes across the configured slots while honoring locks. Adjust the recipe count, slots, filters, or locks.`);
  }

  const selectedRecipes = [...selection.recipeIds].map((id) => candidatesById.get(id)!);
  const previousBySlot = new Map<string, PlannedMeal>();
  for (const meal of previous?.meals ?? []) {
    const key = `${meal.date}|${meal.slot}`;
    if (!previousBySlot.has(key)) previousBySlot.set(key, meal);
  }
  const usedMealIds = new Set<string>();
  const meals: PlannedMeal[] = targets.map((target) => {
    const locked = locks.get(target.key);
    const representedRecipe = [...selection.representation.entries()]
      .find(([, representedTarget]) => representedTarget.key === target.key)?.[0];
    const recipeId = locked?.recipeId
      ?? representedRecipe
      ?? pick(selectedRecipes.filter((recipe) => compatible(recipe, target.slot))).id;
    const prior = previousBySlot.get(target.key);
    const keepPriorId = prior && !usedMealIds.has(prior.id) ? prior.id : randomId('meal');
    usedMealIds.add(keepPriorId);
    return {
      id: keepPriorId,
      date: target.date,
      slot: target.slot,
      recipeId,
      servings: locked && Number.isFinite(locked.servings) && locked.servings > 0 ? locked.servings : validConfig.people,
      locked: Boolean(locked),
    };
  });

  return {
    id: previous?.id ?? randomId('plan'),
    config: validConfig,
    meals,
    createdAt: new Date().toISOString(),
  };
};

const eligibleForSlot = (recipes: Recipe[], filters: Filters, slot: MealType): Recipe[] =>
  filterRecipes(recipes, filters).filter((recipe) => compatible(recipe, slot));

const planWithReplacement = (plan: WeekPlan, mealId: string, recipeId: string): WeekPlan => ({
  ...plan,
  meals: plan.meals.map((meal) => meal.id === mealId ? { ...meal, recipeId } : { ...meal }),
});

/** Replaces one unlocked occurrence without silently changing the configured distinct count. */
export const replaceMeal = (
  plan: WeekPlan,
  mealId: string,
  recipes: Recipe[],
  filters?: Filters,
): WeekPlan => {
  const config = validatePlanConfig(plan.config);
  const target = plan.meals.find((meal) => meal.id === mealId);
  if (!target) throw new Error('That planned meal no longer exists.');
  if (target.locked) throw new Error('Unlock this meal before replacing it.');

  const currentIds = new Set(plan.meals.map((meal) => meal.recipeId));
  const candidates = eligibleForSlot(recipes, filters ?? config.filters, target.slot)
    .filter((recipe) => recipe.id !== target.recipeId)
    .filter((recipe) => {
      const replacement = planWithReplacement(plan, mealId, recipe.id);
      return new Set(replacement.meals.map((meal) => meal.recipeId)).size === config.uniqueRecipes;
    });
  const newRecipeCandidates = candidates.filter((recipe) => !currentIds.has(recipe.id));
  const choices = newRecipeCandidates.length > 0 ? newRecipeCandidates : candidates;
  if (choices.length === 0) {
    throw new Error(`No eligible ${target.slot} replacement can preserve exactly ${config.uniqueRecipes} distinct recipes. Adjust filters or the requested recipe count.`);
  }
  return planWithReplacement(plan, mealId, pick(choices).id);
};

/** Replaces every unlocked use of one recipe with one new recipe eligible for all affected roles. */
export const replaceBatch = (
  plan: WeekPlan,
  recipeId: string,
  recipes: Recipe[],
  filters?: Filters,
): WeekPlan => {
  const config = validatePlanConfig(plan.config);
  const occurrences = plan.meals.filter((meal) => meal.recipeId === recipeId);
  if (occurrences.length === 0) throw new Error('That recipe is not in this plan.');
  if (occurrences.some((meal) => meal.locked)) throw new Error('Unlock every occurrence before replacing this recipe batch.');

  const currentIds = new Set(plan.meals.map((meal) => meal.recipeId));
  const affectedRoles = new Set(occurrences.map((meal) => meal.slot));
  const candidates = filterRecipes(recipes, filters ?? config.filters)
    .filter((recipe) => !currentIds.has(recipe.id))
    .filter((recipe) => [...affectedRoles].every((slot) => compatible(recipe, slot)))
    .filter((recipe) => {
      const replacedIds = new Set(plan.meals.map((meal) => meal.recipeId === recipeId ? recipe.id : meal.recipeId));
      return replacedIds.size === config.uniqueRecipes;
    });
  if (candidates.length === 0) {
    throw new Error(`No new eligible recipe can replace every ${[...affectedRoles].join(' and ')} occurrence while preserving exactly ${config.uniqueRecipes} distinct recipes.`);
  }

  const replacementId = pick(candidates).id;
  return {
    ...plan,
    meals: plan.meals.map((meal) => meal.recipeId === recipeId ? { ...meal, recipeId: replacementId } : { ...meal }),
  };
};
