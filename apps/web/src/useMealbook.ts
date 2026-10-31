import { useEffect, useMemo, useRef, useState } from 'react';
import { validateRecipes, validateState } from '@domain/index';
import { defaultFilters, type AppState } from '@domain/types';
import { experienceEngine as food } from '@domain/experience';
import { purchasePlanning as purchases } from '@domain/purchase-list';
import { activeWeek, emptyLedger, executeCommand, previewSwap } from '@domain/application-commands';
import type {
  ApplicationCommand,
  CommandOutcome,
  OperationLedger,
} from '@domain/application-contracts';
import type {
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
  // Replay ledger and revision for the shared command boundary. Not part of the
  // saved book or its backups.
  const record = useRef<{ ledger: OperationLedger; revision: number }>({
    ledger: emptyLedger(),
    revision: 0,
  });
  /** Applies one command through the shared domain boundary, then saves and renders. */
  const run = <C extends ApplicationCommand>(command: C): CommandOutcome<C> => {
    const previous = current.current;
    if (!previous) throw new Error('Your recipe book is still opening.');
    const { snapshot, outcome } = executeCommand(
      { state: previous, ledger: record.current.ledger, revision: record.current.revision },
      { operationId: makeId('op'), command, context: { date } },
    );
    record.current = { ledger: snapshot.ledger, revision: snapshot.revision };
    const next = snapshot.state;
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
    return outcome;
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
          run({ type: 'today.setSlot', slot: action.slot });
          return true;
        case 'CHOOSE_TODAY':
          run({
            type: 'today.choose',
            recipeId: action.recipeId,
            batchId: action.batchId,
            useId: action.useId,
          });
          setSelectedRecipeId(null);
          navigate('today');
          return true;
        case 'NEXT_MEAL':
          run({ type: 'today.next' });
          return true;
        case 'START_COOK': {
          const { result } = run({
            type: 'cook.start',
            sessionId: makeId('cook'),
            recipeId: action.recipeId,
            sourceServings: action.sourceServings,
            sourceYield: action.sourceYield,
            weekId: action.weekId,
            choiceId: action.choiceId,
            extraBatch: action.extraBatch,
            intentId: action.extraBatch ? makeId('oneoff') : undefined,
          });
          cookReturn.current = page;
          cookReturnRecipe.current = selectedRecipeId;
          setCookSessionId(result.sessionId);
          setSelectedIntent('view');
          setSelectedRecipeId(null);
          if (result.resumed)
            announce(
              'Continuing your in-progress batch. Amount, checks, timers and steps are preserved.',
            );
          return true;
        }
        case 'UPDATE_COOK':
          run({ type: 'cook.update', sessionId: action.sessionId, patch: action.patch });
          return true;
        case 'FINISH_COOK':
          run({
            type: 'cook.finish',
            sessionId: action.sessionId,
            batchId: makeId('batch'),
            actualYield: action.actualYield,
            yieldUnit: action.yieldUnit,
            storage: action.storage,
            storageNotes: action.storageNotes,
            reheatNotes: action.reheatNotes,
            preparedSourceServings: action.preparedSourceServings,
            elapsedMinutes: action.elapsedMinutes,
            rememberTiming: action.rememberTiming,
          });
          setCookSessionId(null);
          navigate('today');
          announce('Food is ready. Nothing is logged until you confirm what you ate.');
          return true;
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
            run({
              type: 'today.choose',
              recipeId: batch.recipeId,
              batchId: batch.id,
              useId: compatibleUseId,
            });
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
          run({
            type: 'food.consume',
            logId: request.logId,
            batchId: request.batchId,
            units: action.units,
            date: action.date,
            useId: request.useId,
          });
          eatingRef.current = null;
          setEating(null);
          setUndoLogId(request.logId);
          announce('Portion logged and available food updated.');
          return true;
        }
        case 'UNDO_LOG': {
          const { result } = run({ type: 'food.undo', logId: action.logId });
          setUndoLogId(null);
          announce(
            result.linkedToBatch
              ? 'Undone. The log and available portions are restored.'
              : 'Food log removed. Unrelated prepared portions are unchanged.',
          );
          return true;
        }
        case 'UPDATE_PROFILE':
          run({ type: 'recipe.setProfile', recipeId: action.recipeId, profile: action.profile });
          announce('Your recipe preferences are saved.');
          return true;
        case 'UPDATE_RECIPE': {
          const { result } = run({
            type: 'recipe.update',
            recipe: action.recipe,
            nutritionConfirmed: action.nutritionConfirmed,
          });
          announce(
            result.nutritionReset
              ? 'Recipe updated. Review nutrition for the new ingredients; existing cooked food and logs are unchanged.'
              : 'Recipe updated.',
          );
          return true;
        }
        case 'ADD_RECIPE':
          run({ type: 'recipe.add', recipe: action.recipe });
          announce('Recipe added to your book.');
          return true;
        case 'ADD_TO_WEEK':
          run({
            type: 'week.addRecipe',
            newWeekId: makeId('week'),
            recipeId: action.recipeId,
            sourceServings: action.sourceServings,
            portions: action.portions,
          });
          setSelectedRecipeId(null);
          navigate('week');
          announce('Your recipe is selected in this week.');
          return true;
        case 'MAKE_WEEK':
          run({ type: 'week.propose', weekId: makeId('week'), request: action.request });
          navigate('week');
          announce('Review your batch choices and grocery impact before confirming.');
          return true;
        case 'SELECT_WEEK':
          run({ type: 'week.select', weekId: action.weekId });
          return true;
        case 'CONFIRM_WEEK':
          run({ type: 'week.confirm' });
          announce('Week confirmed. Your grocery list is ready to review.');
          return true;
        case 'REROLL_WEEK':
          run({ type: 'week.reroll' });
          announce('Fresh choices suggested. Locked and prepared food are unchanged.');
          return true;
        case 'LOCK_CHOICE':
          run({ type: 'week.lockChoice', choiceId: action.choiceId, locked: action.locked });
          return true;
        case 'CHANGE_PORTIONS':
          run({
            type: 'week.changePortions',
            choiceId: action.choiceId,
            portions: action.portions,
          });
          return true;
        case 'MOVE_USE':
          run({ type: 'week.moveUse', useId: action.useId, date: action.date, slot: action.slot });
          return true;
        case 'SKIP_USE':
          run({ type: 'week.skipUse', useId: action.useId, skipped: action.skipped });
          return true;
        case 'MOVE_WINDOW':
          run({
            type: 'week.moveWindow',
            windowId: action.windowId,
            date: action.date,
            startTime: action.startTime,
            availableMinutes: action.availableMinutes,
          });
          return true;
        case 'PREVIEW_SWAP': {
          const preview: SwapPreview = previewSwap(value, action.request);
          swapRef.current = preview;
          setSwapPreview(preview);
          return true;
        }
        case 'APPLY_SWAP': {
          const preview = swapRef.current;
          if (!preview) return false;
          run({ type: 'week.swap', request: preview.request });
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
          const { result } = run({
            type: 'shop.addRecipe',
            intentId: makeId('oneoff'),
            recipeId: action.recipeId,
            sourceServings: action.sourceServings,
            sourceYield: action.sourceYield,
          });
          setSelectedRecipeId(null);
          navigate('shopping');
          announce(
            result.alreadyInWeek
              ? 'This batch is already in your week. Shopping amounts are unchanged.'
              : 'This recipe is in your shopping list. No weekly setup needed.',
          );
          return true;
        }
        case 'REMOVE_SHOP_INTENT':
          run({ type: 'shop.removeIntent', intentId: action.intentId });
          return true;
        case 'COVER_ITEM':
          run({
            type: 'shop.cover',
            purchaseId: makeId('purchase'),
            itemKey: action.itemKey,
            kind: action.kind,
            quantity: action.quantity,
          });
          return true;
        case 'MATCH_PURCHASE':
          run({
            type: 'shop.match',
            matchId: makeId('match'),
            names: action.names,
            purchaseName: action.purchaseName,
            prepNote: action.prepNote,
          });
          announce(
            'Purchase items matched. Original recipe preparation is preserved; review any added prep time.',
          );
          return true;
        case 'SET_AISLE':
          run({ type: 'shop.setAisle', itemKey: action.itemKey, aisle: action.aisle });
          return true;
        case 'ADD_MANUAL_ITEM':
          run({
            type: 'shop.addManual',
            itemId: makeId('manual'),
            name: action.name,
            quantityText: action.quantityText,
          });
          return true;
        case 'TOGGLE_MANUAL_ITEM':
          run({ type: 'shop.toggleManual', itemId: action.id });
          return true;
        case 'REMOVE_MANUAL_ITEM':
          run({ type: 'shop.removeManual', itemId: action.id });
          return true;
        case 'ADD_RECIPE_LOG': {
          const { result } = run({
            type: 'log.addRecipe',
            logId: makeId('log'),
            recipeId: action.recipeId,
            servings: action.servings,
            date: action.date,
          });
          setUndoLogId(result.logId);
          announce('Actual food logged. No unrelated prepared batch was changed.');
          return true;
        }
        case 'ADD_MANUAL_LOG': {
          const { result } = run({ type: 'log.addManual', entry: action.entry });
          if (result.duplicate) return true;
          setUndoLogId(action.entry.id);
          announce('Food logged.');
          return true;
        }
        case 'SET_TARGETS':
          run({ type: 'targets.set', targets: action.targets });
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
    // The restored book replaces this one: earlier operations no longer apply to it.
    record.current = { ledger: emptyLedger(), revision: record.current.revision + 1 };
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
    run({ type: 'recipe.import', recipes: imported });
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
