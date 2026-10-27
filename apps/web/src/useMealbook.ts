import { useEffect, useMemo, useRef, useState } from 'react';
import { createConsumption, validateRecipes, validateState } from '@domain/index';
import { defaultFilters, emptyNutrition, type AppState, type Recipe } from '@domain/types';
import { experienceEngine as food } from '@domain/experience';
import { batchPlanning as planning } from '@domain/batch-planner';
import { purchasePlanning as purchases } from '@domain/purchase-list';
import type {
  BatchWeek,
  EatRequest,
  MealbookAction,
  MealbookPage,
  PurchaseList,
  SwapPreview,
} from '@domain/experience-types';
import { extractYouTubeReference, parseYouTubeReference } from '@domain/youtube';
import { loadState, saveState, downloadJson } from './storage';
import { localDate, makeId } from './components/shared';
import { RECIPE_JSON_SIZE_MESSAGE, recipeJsonFileFits } from './import-limits';
import type { MealbookModel } from './mealbook-contract';
import { reconcileToday, resolveCookingContext } from './today-reconciliation';

const pages = new Set<MealbookPage>([
  'today',
  'week',
  'recipes',
  'shopping',
  'log',
  'settings',
  'import',
]);
const pageFromHash = (): MealbookPage => {
  const page = window.location.hash.slice(1) as MealbookPage;
  return pages.has(page) ? page : 'today';
};
const activeWeek = (state: AppState): BatchWeek | null =>
  state.experience?.weeks.find((week) => week.id === state.experience?.activeWeekId) ?? null;

function sharedSource(): { url: string | null; hasShare: boolean } {
  const location = new URL(window.location.href);
  const url = location.searchParams.get('sharedUrl');
  const text = location.searchParams.get('sharedText');
  let reference: ReturnType<typeof parseYouTubeReference> | null = null;
  try {
    if (url) reference = parseYouTubeReference(url);
  } catch {
    /* Try text, never arbitrary URL. */
  }
  if (!reference && text) reference = extractYouTubeReference(text);
  return { url: reference?.url ?? null, hasShare: url !== null || text !== null };
}

const ingredientSignature = (recipe: Recipe): string =>
  JSON.stringify(
    recipe.ingredients.map((item) => [
      item.name.trim().toLocaleLowerCase(),
      item.quantity,
      item.unit?.trim().toLocaleLowerCase() ?? null,
    ]),
  );

function isPureServingScale(previous: Recipe, next: Recipe): boolean {
  if (
    !previous.baseServings ||
    !next.baseServings ||
    previous.ingredients.length !== next.ingredients.length
  )
    return false;
  const factor = next.baseServings / previous.baseServings;
  return previous.ingredients.every((ingredient, index) => {
    const other = next.ingredients[index];
    if (
      ingredient.name.trim().toLocaleLowerCase() !== other.name.trim().toLocaleLowerCase() ||
      (ingredient.unit?.trim().toLocaleLowerCase() ?? null) !==
        (other.unit?.trim().toLocaleLowerCase() ?? null)
    )
      return false;
    if (ingredient.quantity === null || other.quantity === null) {
      return (
        ingredient.quantity === other.quantity && ingredient.quantityText === other.quantityText
      );
    }
    return Math.abs(other.quantity - ingredient.quantity * factor) <= 0.000001;
  });
}

function preserveGroceryChanges(previous: AppState, next: AppState): AppState {
  if (!previous.experience || !next.experience) return next;
  const before = purchases.buildList(previous, activeWeek(previous));
  const after = purchases.buildList(next, activeWeek(next));
  if (before.scopeId !== after.scopeId) return next;
  const previousItems = new Map(before.items.map((item) => [item.key, item]));
  const changes = { ...next.experience.groceryChanges };
  for (const item of after.items) {
    const old = previousItems.get(item.key);
    if (old && old.displayQuantity !== item.displayQuantity && !changes[item.key])
      changes[item.key] = old.displayQuantity;
  }
  return { ...next, experience: { ...next.experience, groceryChanges: changes } };
}

export function useMealbook() {
  const [state, setState] = useState<AppState | null>(null);
  const current = useRef<AppState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [persistenceError, setPersistenceError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [undoLogId, setUndoLogId] = useState<string | null>(null);
  const [shared] = useState(sharedSource);
  const [page, setPage] = useState<MealbookPage>(() => (shared.url ? 'import' : pageFromHash()));
  const [date, setDate] = useState(localDate);
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<'view' | 'cook' | 'week'>('view');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [cookSessionId, setCookSessionId] = useState<string | null>(null);
  const cookReturn = useRef<MealbookPage>('today');
  const cookReturnRecipe = useRef<string | null>(null);
  const [eating, setEating] = useState<EatRequest | null>(null);
  const eatingRef = useRef<EatRequest | null>(null);
  const [swapPreview, setSwapPreview] = useState<SwapPreview | null>(null);
  const swapRef = useRef<SwapPreview | null>(null);
  const saveTimer = useRef<number | null>(null);
  const saveGeneration = useRef(0);
  const restoring = useRef(false);

  const announce = (message: string, isError = false) => {
    setNoticeIsError(isError);
    setNotice(message);
  };
  const navigate = (next: MealbookPage) => {
    if (window.location.hash !== `#${next}`) window.location.hash = next;
    else setPage(next);
  };
  const commit = (updater: (previous: AppState) => AppState): AppState => {
    const previous = current.current;
    if (!previous) throw new Error('Your recipe book is still opening.');
    let next = updater(previous);
    next = food.ensureState(next);
    next = preserveGroceryChanges(previous, next);
    next = food.ensureToday(next, date, next.experience!.preferredSlot);
    current.current = next;
    saveGeneration.current += 1;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    void saveState(next)
      .then(() => setPersistenceError(''))
      .catch((error) =>
        setPersistenceError(
          error instanceof Error ? error.message : 'Changes could not be saved to this device.',
        ),
      );
    setState(next);
    return next;
  };
  const putWeek = (previous: AppState, week: BatchWeek): AppState => {
    const experience = previous.experience!;
    const exists = experience.weeks.some((item) => item.id === week.id);
    return {
      ...previous,
      experience: {
        ...experience,
        weeks: exists
          ? experience.weeks.map((item) => (item.id === week.id ? week : item))
          : [...experience.weeks, week],
        activeWeekId: week.id,
      },
    };
  };
  const requireWeek = (value: AppState): BatchWeek => {
    const week = activeWeek(value);
    if (!week) throw new Error('Choose a week first, or shop a single recipe.');
    return week;
  };

  useEffect(() => {
    let live = true;
    loadState()
      .then((value) => {
        if (!live) return;
        const migrated = food.ensureState(value);
        const next = food.ensureToday(migrated, localDate(), migrated.experience!.preferredSlot);
        current.current = next;
        setState(next);
        setLoaded(true);
      })
      .catch((error) => {
        if (!live) return;
        setLoadError(
          error instanceof Error ? error.message : 'Your saved book could not be opened.',
        );
        setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!shared.hasShare) return;
    const location = new URL(window.location.href);
    location.searchParams.delete('sharedUrl');
    location.searchParams.delete('sharedText');
    if (shared.url) location.hash = 'import';
    window.history.replaceState(
      window.history.state,
      '',
      `${location.pathname}${location.search}${location.hash}`,
    );
    if (!shared.url)
      announce(
        'This share did not contain a supported YouTube link. You can paste one in your recipe book.',
      );
  }, [shared]);

  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash());
      setSelectedRecipeId(null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!loaded || !state) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    const generation = saveGeneration.current;
    saveTimer.current = window.setTimeout(() => {
      if (generation !== saveGeneration.current || restoring.current) return;
      saveState(state)
        .then(() => setPersistenceError(''))
        .catch((error) =>
          setPersistenceError(
            error instanceof Error ? error.message : 'Changes could not be saved to this device.',
          ),
        );
    }, 350);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [state, loaded]);

  useEffect(() => {
    const flush = () => {
      if (!current.current || !loaded || restoring.current) return;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      void saveState(current.current)
        .then(() => setPersistenceError(''))
        .catch((error) =>
          setPersistenceError(
            error instanceof Error
              ? error.message
              : 'Export a backup before closing; device storage is unavailable.',
          ),
        );
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
      else {
        const nextDate = localDate();
        if (nextDate !== date) {
          setDate(nextDate);
          const value = current.current;
          if (value?.experience) {
            const next = food.ensureToday(value, nextDate, value.experience.preferredSlot);
            current.current = next;
            setState(next);
          }
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [loaded, date]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), undoLogId ? 12000 : 6500);
    return () => window.clearTimeout(timer);
  }, [notice, undoLogId]);

  const dispatch = (action: MealbookAction): boolean => {
    try {
      if (restoring.current)
        throw new Error('Your backup is restoring. Please wait before making another change.');
      const value = current.current;
      if (!value?.experience) throw new Error('Your recipe book is still opening.');
      const experience = value.experience;
      switch (action.type) {
        case 'NAVIGATE':
          navigate(action.page);
          return true;
        case 'OPEN_RECIPE':
          setSelectedIntent(action.intent ?? 'view');
          setSelectedBatchId(action.batchId ?? null);
          setSelectedRecipeId(action.recipeId);
          return true;
        case 'CLOSE_RECIPE':
          setSelectedRecipeId(null);
          return true;
        case 'SET_FILTERS':
          setFilters(action.filters);
          return true;
        case 'SET_TODAY_SLOT':
          commit((previous) => ({
            ...previous,
            experience: { ...previous.experience!, preferredSlot: action.slot },
          }));
          return true;
        case 'CHOOSE_TODAY':
          commit((previous) =>
            food.chooseToday(previous, date, experience.preferredSlot, action.recipeId, {
              batchId: action.batchId,
              useId: action.useId,
            }),
          );
          setSelectedRecipeId(null);
          navigate('today');
          return true;
        case 'NEXT_MEAL':
          commit((previous) => food.nextMeal(previous, date, experience.preferredSlot));
          return true;
        case 'START_COOK': {
          const id = makeId('cook');
          let working = value;
          const currentRecipe = value.recipes.find((recipe) => recipe.id === action.recipeId);
          if (currentRecipe?.baseServings === null && action.sourceYield !== undefined) {
            const updated = validateRecipes([
              { ...currentRecipe, baseServings: action.sourceYield },
            ])[0];
            working = {
              ...working,
              recipes: working.recipes.map((recipe) =>
                recipe.id === updated.id ? updated : recipe,
              ),
            };
          }
          const alreadyRunning = working.experience!.sessions.some(
            (session) => session.recipeId === action.recipeId && !session.finishedAt,
          );
          if (action.extraBatch && !alreadyRunning) {
            working = food.chooseToday(working, date, experience.preferredSlot, action.recipeId);
            working = {
              ...working,
              experience: {
                ...working.experience!,
                oneOffs: working.experience!.oneOffs.map((intent) => {
                  const completed = working.experience!.batches.some(
                    (batch) =>
                      batch.recipeId === intent.recipeId &&
                      batch.preparedSourceServings >= intent.sourceServings &&
                      batch.madeAt >= intent.createdAt,
                  );
                  return intent.recipeId === action.recipeId && completed
                    ? { ...intent, fulfilled: true }
                    : intent;
                }),
              },
            };
            working = purchases.addIntent(
              working,
              action.recipeId,
              action.sourceServings,
              makeId('oneoff'),
              action.sourceYield,
            );
          }
          const resolved = resolveCookingContext(working, {
            recipeId: action.recipeId,
            date,
            ...(!action.extraBatch ? { weekId: action.weekId, choiceId: action.choiceId } : {}),
          });
          const next = commit(() =>
            resolved.sessionId
              ? resolved.state
              : food.startCook(resolved.state, action.recipeId, action.sourceServings, {
                  id,
                  date,
                  slot: experience.preferredSlot,
                  sourceYield: action.sourceYield,
                  weekId: resolved.weekId ?? undefined,
                  choiceId: resolved.dailyChoiceId,
                }),
          );
          const session =
            next.experience!.sessions.find((item) => item.id === (resolved.sessionId ?? id)) ??
            next.experience!.sessions.find(
              (item) => item.recipeId === action.recipeId && !item.finishedAt,
            );
          if (!session) throw new Error('The cooking session could not be opened.');
          cookReturn.current = page;
          cookReturnRecipe.current = selectedRecipeId;
          setCookSessionId(session.id);
          setSelectedIntent('view');
          setSelectedRecipeId(null);
          if (resolved.sessionId)
            announce(
              'Continuing your in-progress batch. Amount, checks, timers and steps are preserved.',
            );
          return true;
        }
        case 'UPDATE_COOK':
          commit((previous) => food.updateCook(previous, action.sessionId, action.patch));
          return true;
        case 'FINISH_COOK': {
          commit((previous) => {
            const session = previous.experience!.sessions.find(
              (item) => item.id === action.sessionId,
            );
            if (session?.finishedAt) return previous;
            let completed = food.finishCook(previous, action.sessionId, {
              id: makeId('batch'),
              actualYield: action.actualYield,
              yieldUnit: action.yieldUnit,
              storage: action.storage,
              storageNotes: action.storageNotes,
              reheatNotes: action.reheatNotes,
              preparedSourceServings: action.preparedSourceServings,
            });
            const batch = completed.experience!.batches.find(
              (item) => item.sessionId === action.sessionId,
            );
            if (!batch || !session) return completed;
            completed = {
              ...completed,
              experience: {
                ...completed.experience!,
                oneOffs: completed.experience!.oneOffs.map((intent) => {
                  const sameDose =
                    Math.abs(intent.sourceServings - session.sourceServings) < 0.000001;
                  const sameRecipe =
                    intent.recipeId === session.recipeId &&
                    intent.recipeSnapshot.baseServings === session.recipeSnapshot.baseServings &&
                    ingredientSignature(intent.recipeSnapshot) ===
                      ingredientSignature(session.recipeSnapshot);
                  return !intent.fulfilled && sameDose && sameRecipe
                    ? { ...intent, fulfilled: true }
                    : intent;
                }),
              },
            };
            const week = completed.experience!.weeks.find((item) => item.id === session.weekId);
            const use = week?.uses.find(
              (item) =>
                item.date === date &&
                item.slot === experience.preferredSlot &&
                !item.skipped &&
                week.choices.find((choice) => choice.id === item.choiceId)?.readyBatchId ===
                  batch.id,
            );
            return food.chooseToday(completed, date, experience.preferredSlot, batch.recipeId, {
              batchId: batch.id,
              ...(use ? { useId: use.id } : {}),
            });
          });
          setCookSessionId(null);
          navigate('today');
          announce('Food is ready. Nothing is logged until you confirm what you ate.');
          return true;
        }
        case 'EXIT_COOK':
          setCookSessionId(null);
          navigate(cookReturn.current);
          if (cookReturnRecipe.current)
            window.setTimeout(() => setSelectedRecipeId(cookReturnRecipe.current), 0);
          return true;
        case 'EAT_OPEN': {
          if (eatingRef.current?.batchId === action.batchId) return true;
          const batch = experience.batches.find((item) => item.id === action.batchId);
          if (!batch) throw new Error('That prepared batch could not be found.');
          const available = food.availableUnits(value, batch.id);
          if (available <= 0) throw new Error('There are no portions left in this batch.');
          const today = food.today(value, date, experience.preferredSlot);
          const useWeek = experience.weeks.find((week) =>
            week.uses.some((use) => use.id === action.useId),
          );
          const use = useWeek?.uses.find((item) => item.id === action.useId);
          const plannedChoice = useWeek?.choices.find((item) => item.id === use?.choiceId);
          const compatibleUseId =
            plannedChoice?.readyBatchId === batch.id &&
            use?.date === date &&
            use.slot === experience.preferredSlot
              ? action.useId
              : undefined;
          if (
            today.choice?.recipeId !== batch.recipeId ||
            today.choice.batchId !== batch.id ||
            today.choice.logId !== null ||
            today.choice.useId !== (compatibleUseId ?? null)
          ) {
            commit((previous) =>
              food.chooseToday(previous, date, experience.preferredSlot, batch.recipeId, {
                batchId: batch.id,
                useId: compatibleUseId,
              }),
            );
          }
          const profile = experience.recipeProfiles[batch.recipeId];
          const plannedActualUnits =
            compatibleUseId && profile?.portionSizeConfirmed && use && plannedChoice
              ? (use.portions * plannedChoice.sourceUnitsPerPortion * batch.actualYield) /
                batch.preparedSourceServings
              : null;
          const units = plannedActualUnits ?? action.units ?? Math.min(1, available);
          const request: EatRequest = {
            batchId: batch.id,
            logId: makeId('eaten'),
            units: Math.min(units, available),
            useId: compatibleUseId ?? null,
          };
          eatingRef.current = request;
          setEating(request);
          return true;
        }
        case 'EAT_CANCEL':
          eatingRef.current = null;
          setEating(null);
          return true;
        case 'EAT_CONFIRM': {
          const request = eatingRef.current;
          if (!request) return false;
          const today = food.today(value, date, experience.preferredSlot);
          commit((previous) =>
            food.consume(previous, request.batchId, action.units, action.date, request.logId, {
              ...(action.date === date
                ? { dailyChoiceId: today.choice?.id, useId: request.useId ?? undefined }
                : {}),
            }),
          );
          eatingRef.current = null;
          setEating(null);
          setUndoLogId(request.logId);
          announce('Portion logged and available food updated.');
          return true;
        }
        case 'UNDO_LOG':
          commit((previous) => food.undoConsumption(previous, action.logId));
          setUndoLogId(null);
          announce(
            value.logs.find((entry) => entry.id === action.logId)?.batchId
              ? 'Undone. The log and available portions are restored.'
              : 'Food log removed. Unrelated prepared portions are unchanged.',
          );
          return true;
        case 'UPDATE_PROFILE':
          commit((previous) => food.updateProfile(previous, action.recipeId, action.profile));
          announce('Your recipe preferences are saved.');
          return true;
        case 'UPDATE_RECIPE': {
          const previousRecipe = value.recipes.find((recipe) => recipe.id === action.recipe.id);
          if (!previousRecipe) throw new Error('That recipe is no longer in your book.');
          let candidate = action.recipe;
          const compositionChanged =
            ingredientSignature(previousRecipe) !== ingredientSignature(candidate);
          if (compositionChanged && !action.nutritionConfirmed) {
            candidate = {
              ...candidate,
              nutrition: emptyNutrition(),
              nutritionBasis: 'unspecified',
              dataGaps: [
                ...new Set([
                  ...candidate.dataGaps,
                  'Ingredients changed; nutrition needs your review.',
                ]),
              ],
            };
          }
          if (action.nutritionConfirmed)
            candidate = {
              ...candidate,
              nutritionBasis: 'per_serving',
              nutritionEvidence:
                'Per-serving values explicitly reviewed by you after editing. Original written source remains available.',
            };
          if (
            !compositionChanged &&
            !action.nutritionConfirmed &&
            previousRecipe.nutritionBasis === 'per_serving' &&
            previousRecipe.baseServings &&
            candidate.baseServings &&
            previousRecipe.baseServings !== candidate.baseServings
          ) {
            const factor = previousRecipe.baseServings / candidate.baseServings;
            candidate = {
              ...candidate,
              nutrition: Object.fromEntries(
                Object.entries(previousRecipe.nutrition).map(([key, amount]) => [
                  key,
                  amount === null ? null : amount * factor,
                ]),
              ) as Recipe['nutrition'],
              nutritionEvidence:
                'Per-serving nutrition adjusted for your changed yield; ingredient totals and original reported values are unchanged.',
            };
          }
          const checked = validateRecipes([candidate])[0];
          commit((previous) => ({
            ...previous,
            recipes: previous.recipes.map((recipe) =>
              recipe.id === checked.id ? checked : recipe,
            ),
          }));
          announce(
            compositionChanged && !action.nutritionConfirmed
              ? 'Recipe updated. Review nutrition for the new ingredients; existing cooked food and logs are unchanged.'
              : 'Recipe updated.',
          );
          return true;
        }
        case 'ADD_RECIPE': {
          const checked = validateRecipes([action.recipe])[0];
          if (value.recipes.some((recipe) => recipe.id === checked.id))
            throw new Error(
              'This recipe is already in your book. Your version was not overwritten.',
            );
          commit((previous) => ({ ...previous, recipes: [...previous.recipes, checked] }));
          announce('Recipe added to your book.');
          return true;
        }
        case 'ADD_TO_WEEK': {
          const week = planning.addRecipe(
            value,
            activeWeek(value),
            action.recipeId,
            action.sourceServings,
            action.portions,
            makeId('week'),
            date,
          );
          commit((previous) => putWeek(previous, week));
          setSelectedRecipeId(null);
          navigate('week');
          announce('Your recipe is selected in this week.');
          return true;
        }
        case 'MAKE_WEEK': {
          const week = planning.proposeWeek(value, action.request, makeId('week'));
          commit((previous) => {
            const next = putWeek(previous, week);
            return {
              ...next,
              experience: { ...next.experience!, lastPlanRequest: action.request },
            };
          });
          navigate('week');
          announce('Review your batch choices and grocery impact before confirming.');
          return true;
        }
        case 'SELECT_WEEK':
          if (!experience.weeks.some((week) => week.id === action.weekId))
            throw new Error('That week is not available.');
          commit((previous) => ({
            ...previous,
            experience: { ...previous.experience!, activeWeekId: action.weekId },
          }));
          return true;
        case 'CONFIRM_WEEK': {
          const week = requireWeek(value);
          const confirmed = { ...week, confirmed: true };
          commit((previous) => reconcileToday(putWeek(previous, confirmed), date, 'confirm'));
          announce('Week confirmed. Your grocery list is ready to review.');
          return true;
        }
        case 'REROLL_WEEK': {
          const week = requireWeek(value);
          if (!experience.lastPlanRequest)
            throw new Error(
              'Choose cooking windows and portion preferences before generating fresh ideas for this imported week.',
            );
          const next = planning.rerollWeek(value, week, experience.lastPlanRequest);
          commit((previous) => putWeek(previous, next));
          announce('Fresh choices suggested. Locked and prepared food are unchanged.');
          return true;
        }
        case 'LOCK_CHOICE': {
          const week = requireWeek(value);
          const next = {
            ...week,
            choices: week.choices.map((choice) =>
              choice.id === action.choiceId ? { ...choice, locked: action.locked } : choice,
            ),
          };
          commit((previous) => putWeek(previous, next));
          return true;
        }
        case 'CHANGE_PORTIONS': {
          const next = planning.changePortions(
            value,
            requireWeek(value),
            action.choiceId,
            action.portions,
          );
          commit((previous) => putWeek(previous, next));
          return true;
        }
        case 'MOVE_USE': {
          const next = planning.changeUse(value, requireWeek(value), action.useId, {
            date: action.date,
            slot: action.slot,
          });
          commit((previous) => putWeek(previous, next));
          return true;
        }
        case 'SKIP_USE': {
          const next = planning.changeUse(value, requireWeek(value), action.useId, {
            skipped: action.skipped,
          });
          commit((previous) => putWeek(previous, next));
          return true;
        }
        case 'MOVE_WINDOW': {
          const next = planning.moveWindow(value, requireWeek(value), action.windowId, {
            date: action.date,
            startTime: action.startTime,
            availableMinutes: action.availableMinutes,
          });
          commit((previous) => putWeek(previous, next));
          return true;
        }
        case 'PREVIEW_SWAP': {
          const week = experience.weeks.find((item) => item.id === action.request.weekId);
          if (!week) throw new Error('That week could not be found.');
          const proposedWeek = planning.swap(value, week, action.request);
          const before = purchases.buildList(value, week);
          const previewState = putWeek(value, proposedWeek);
          const after = purchases.buildList(previewState, proposedWeek);
          const oldItems = new Map(before.items.map((item) => [item.key, item]));
          const newItems = new Map(after.items.map((item) => [item.key, item]));
          const changes: SwapPreview['changes'] = [];
          for (const key of new Set([...oldItems.keys(), ...newItems.keys()])) {
            const old = oldItems.get(key),
              next = newItems.get(key);
            if (old?.displayQuantity !== next?.displayQuantity)
              changes.push({
                name: next?.name ?? old!.name,
                before: old?.displayQuantity ?? 'Not needed',
                after: next?.displayQuantity ?? 'No longer needed',
              });
          }
          const preview: SwapPreview = { request: action.request, proposedWeek, changes };
          swapRef.current = preview;
          setSwapPreview(preview);
          return true;
        }
        case 'APPLY_SWAP': {
          const preview = swapRef.current;
          if (!preview) return false;
          // Recompute against the live state: a cooking completion or portion
          // change while the preview is open cannot be overwritten by a stale draft.
          const week = experience.weeks.find((item) => item.id === preview.request.weekId);
          if (!week) throw new Error('That week changed while the preview was open.');
          const next = planning.swap(value, week, preview.request);
          commit((previous) => reconcileToday(putWeek(previous, next), date, 'swap'));
          swapRef.current = null;
          setSwapPreview(null);
          announce('Recipe swapped. Review changed grocery amounts.');
          return true;
        }
        case 'CANCEL_SWAP':
          swapRef.current = null;
          setSwapPreview(null);
          return true;
        case 'SHOP_RECIPE': {
          const recipe = value.recipes.find((item) => item.id === action.recipeId);
          const week = activeWeek(value);
          const included = week?.choices.some((choice) => {
            if (
              choice.recipeId !== action.recipeId ||
              choice.readyBatchId ||
              Math.abs(choice.sourceServings - action.sourceServings) > 0.000001
            )
              return false;
            const running = value.experience!.sessions.find(
              (session) =>
                session.weekId === week.id &&
                session.recipeId === choice.recipeId &&
                !session.finishedAt,
            );
            return (
              recipe &&
              (!running ||
                ingredientSignature(running.recipeSnapshot) === ingredientSignature(recipe))
            );
          });
          if (included) {
            setSelectedRecipeId(null);
            navigate('shopping');
            announce('This batch is already in your week. Shopping amounts are unchanged.');
            return true;
          }
          commit((previous) =>
            purchases.addIntent(
              previous,
              action.recipeId,
              action.sourceServings,
              makeId('oneoff'),
              action.sourceYield,
            ),
          );
          setSelectedRecipeId(null);
          navigate('shopping');
          announce('This recipe is in your shopping list. No weekly setup needed.');
          return true;
        }
        case 'REMOVE_SHOP_INTENT':
          commit((previous) => ({
            ...previous,
            experience: {
              ...previous.experience!,
              oneOffs: previous.experience!.oneOffs.map((intent) =>
                intent.id === action.intentId ? { ...intent, fulfilled: true } : intent,
              ),
            },
          }));
          return true;
        case 'COVER_ITEM': {
          const list = purchases.buildList(value, activeWeek(value));
          const item = list.items.find((line) => line.key === action.itemKey);
          if (!item) throw new Error('That grocery requirement changed. Review the current list.');
          commit((previous) => {
            const next = purchases.cover(
              previous,
              item,
              { kind: action.kind, quantity: action.quantity },
              makeId('purchase'),
            );
            const changes = { ...next.experience!.groceryChanges };
            delete changes[item.key];
            return { ...next, experience: { ...next.experience!, groceryChanges: changes } };
          });
          return true;
        }
        case 'MATCH_PURCHASE':
          commit((previous) =>
            purchases.approveMatch(
              previous,
              action.names,
              action.purchaseName,
              action.prepNote,
              makeId('match'),
            ),
          );
          announce(
            'Purchase items matched. Original recipe preparation is preserved; review any added prep time.',
          );
          return true;
        case 'SET_AISLE':
          if (!action.aisle.trim()) throw new Error('Choose a grocery aisle.');
          commit((previous) => ({
            ...previous,
            experience: {
              ...previous.experience!,
              aisleOverrides: {
                ...previous.experience!.aisleOverrides,
                [action.itemKey]: action.aisle.trim(),
              },
            },
          }));
          return true;
        case 'ADD_MANUAL_ITEM':
          if (!action.name.trim()) throw new Error('Add an item name.');
          commit((previous) => ({
            ...previous,
            experience: {
              ...previous.experience!,
              manualItems: [
                ...previous.experience!.manualItems,
                {
                  id: makeId('manual'),
                  name: action.name.trim(),
                  quantityText: action.quantityText.trim(),
                  checked: false,
                },
              ],
            },
          }));
          return true;
        case 'TOGGLE_MANUAL_ITEM':
        case 'REMOVE_MANUAL_ITEM': {
          const update = <T extends { id: string; checked: boolean }>(items: T[]): T[] =>
            action.type === 'REMOVE_MANUAL_ITEM'
              ? items.filter((item) => item.id !== action.id)
              : items.map((item) =>
                  item.id === action.id ? { ...item, checked: !item.checked } : item,
                );
          commit((previous) => ({
            ...previous,
            manualShopping: Object.fromEntries(
              Object.entries(previous.manualShopping).map(([key, items]) => [key, update(items)]),
            ),
            experience: {
              ...previous.experience!,
              manualItems: update(previous.experience!.manualItems),
            },
          }));
          return true;
        }
        case 'ADD_RECIPE_LOG': {
          const recipe = value.recipes.find((item) => item.id === action.recipeId);
          if (!recipe) throw new Error('Choose a saved recipe to log.');
          const entry = createConsumption(recipe, action.servings, action.date);
          commit((previous) => ({ ...previous, logs: [...previous.logs, entry] }));
          setUndoLogId(entry.id);
          announce('Actual food logged. No unrelated prepared batch was changed.');
          return true;
        }
        case 'ADD_MANUAL_LOG':
          if (value.logs.some((entry) => entry.id === action.entry.id)) return true;
          commit((previous) =>
            validateState({ ...previous, logs: [...previous.logs, action.entry] }),
          );
          setUndoLogId(action.entry.id);
          announce('Food logged.');
          return true;
        case 'SET_TARGETS':
          commit((previous) => validateState({ ...previous, targets: action.targets }));
          return true;
        case 'EXPORT_BACKUP':
          downloadJson(value, `mealbook-backup-${date}.json`);
          return true;
      }
    } catch (error) {
      announce(
        error instanceof Error ? error.message : 'This change could not be completed.',
        true,
      );
      return false;
    }
  };

  const readJson = async (file: File): Promise<unknown> => {
    if (!(file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')))
      throw new Error('Choose a JSON file.');
    if (!recipeJsonFileFits(file.size)) throw new Error(RECIPE_JSON_SIZE_MESSAGE);
    try {
      return JSON.parse(await file.text());
    } catch {
      throw new Error('That file is not valid JSON.');
    }
  };
  const restore = async (file: File) => {
    const restored = validateState(await readJson(file));
    if (
      !window.confirm(
        'Restore this backup and replace this device’s recipes, weeks, cooked portions, shopping, targets and food history?',
      )
    )
      throw new Error('Restore cancelled.');
    const migrated = food.ensureState(restored);
    const next = food.ensureToday(migrated, date, migrated.experience!.preferredSlot);
    saveGeneration.current += 1;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    restoring.current = true;
    try {
      await saveState(next);
    } finally {
      restoring.current = false;
    }
    current.current = next;
    setState(next);
    setLoadError('');
    setLoaded(true);
    setCookSessionId(null);
    eatingRef.current = null;
    setEating(null);
    swapRef.current = null;
    setSwapPreview(null);
    announce('Backup restored on this device.');
  };
  const importBank = async (file: File) => {
    const imported = validateRecipes(await readJson(file));
    const value = current.current;
    if (!value) throw new Error('Your recipe book is not open yet.');
    const currentIds = new Set(value.recipes.map((recipe) => recipe.id));
    const overlapping = imported.filter((recipe) => currentIds.has(recipe.id));
    if (
      overlapping.length &&
      !window.confirm(
        `${overlapping.length} matching recipe IDs already exist. Overwrite only those book recipes? Prepared-food and historical log snapshots will stay unchanged.`,
      )
    )
      throw new Error('Import cancelled.');
    commit((previous) => {
      const merged = new Map(previous.recipes.map((recipe) => [recipe.id, recipe]));
      for (const recipe of imported) merged.set(recipe.id, recipe);
      return { ...previous, recipes: [...merged.values()] };
    });
    announce('Recipes imported into your book.');
  };
  const openExistingSource = (videoId: string): boolean => {
    const recipe = current.current?.recipes.find((item) => {
      if (item.id === `youtube:${videoId}`) return true;
      try {
        return Boolean(item.sourceUrl && parseYouTubeReference(item.sourceUrl).videoId === videoId);
      } catch {
        return false;
      }
    });
    if (!recipe) return false;
    navigate('recipes');
    // Hash navigation clears previous overlays. Keep this selected recipe after
    // the navigation event, without forcing another book search.
    window.setTimeout(() => setSelectedRecipeId(recipe.id), 0);
    announce('This source is already in your book. Your saved version is unchanged.');
    return true;
  };

  const model = useMemo<MealbookModel | null>(() => {
    if (!state?.experience) return null;
    const week = activeWeek(state);
    const shopping: PurchaseList = purchases.buildList(state, week);
    const today = food.today(state, date, state.experience.preferredSlot);
    const legacyManual = week?.legacyPlanId ? (state.manualShopping[week.legacyPlanId] ?? []) : [];
    const selectedBatch = selectedRecipeId
      ? (state.experience.batches.find((batch) => batch.id === selectedBatchId) ?? null)
      : null;
    const manualIds = new Set(state.experience.manualItems.map((item) => item.id));
    shopping.items = shopping.items.filter(
      (item) => !item.intentionIds.some((id) => manualIds.has(id)),
    );
    return {
      state,
      page,
      date,
      today,
      week,
      shopping,
      cookSession:
        state.experience.sessions.find((session) => session.id === cookSessionId) ?? null,
      selectedRecipe:
        selectedBatch?.recipeSnapshot ??
        (selectedRecipeId
          ? (state.recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null)
          : null),
      selectedIntent,
      selectedBatch,
      eating,
      swapPreview,
      filters,
      initialSharedUrl: shared.url,
      notice,
      noticeIsError,
      undoLogId,
      persistenceError,
      manualItems: [...state.experience.manualItems, ...legacyManual],
    };
  }, [
    state,
    page,
    date,
    cookSessionId,
    selectedRecipeId,
    selectedBatchId,
    selectedIntent,
    eating,
    swapPreview,
    filters,
    shared.url,
    notice,
    noticeIsError,
    undoLogId,
    persistenceError,
  ]);

  return { loaded, loadError, model, dispatch, restore, importBank, openExistingSource };
}
