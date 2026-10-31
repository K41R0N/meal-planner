import { emptyNutrition, type AppState, type Recipe } from './types';
import type { BatchWeek, SwapPreview, SwapRequest } from './experience-types';
import { experienceEngine as food } from './experience';
import { batchPlanning as planning } from './batch-planner';
import { purchasePlanning as purchases } from './purchase-list';
import { createConsumption } from './nutrition';
import { validateRecipes, validateState } from './validation';
import { reconcileToday, resolveCookingContext } from './today-reconciliation';
import {
  ApplicationError,
  type ApplicationCommand,
  type ApplicationSnapshot,
  type CommandEnvelope,
  type CommandOf,
  type CommandOutcome,
  type CommandType,
  type LedgerEntry,
  type OperationLedger,
  type ResultOf,
} from './application-contracts';

/** How many applied operations a snapshot remembers for replay. */
export const LEDGER_LIMIT = 500;

export const emptyLedger = (): OperationLedger => ({ entries: [] });

export const createSnapshot = (state: AppState): ApplicationSnapshot => ({
  state,
  ledger: emptyLedger(),
  revision: 0,
});

/** Two independent 32-bit string hashes (FNV-1a and a multiplicative variant), as hex. */
const hash64 = (text: string): string => {
  let a = 0x811c9dc5;
  let b = 0x9e3779b1;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x85ebca77);
    b ^= b >>> 13;
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
};

/**
 * A compact fingerprint of key-sorted JSON, so property order never changes it and a
 * ledger of large imports stays small. It only compares requests that share an
 * operation ID, which the caller chooses, so a non-cryptographic hash is enough.
 */
export function fingerprint(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === 'object')
      return Object.fromEntries(
        Object.keys(input as Record<string, unknown>)
          .filter((key) => (input as Record<string, unknown>)[key] !== undefined)
          .sort()
          .map((key) => [key, sort((input as Record<string, unknown>)[key])]),
      );
    return input;
  };
  const text = JSON.stringify(sort(value)) ?? 'undefined';
  return `${text.length}:${hash64(text)}`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const activeWeek = (state: AppState): BatchWeek | null =>
  state.experience?.weeks.find((week) => week.id === state.experience?.activeWeekId) ?? null;

const requireWeek = (state: AppState): BatchWeek => {
  const week = activeWeek(state);
  if (!week)
    throw new ApplicationError('NOT_FOUND', 'Choose a week first, or shop a single recipe.');
  return week;
};

const putWeek = (state: AppState, week: BatchWeek): AppState => {
  const experience = state.experience!;
  const exists = experience.weeks.some((item) => item.id === week.id);
  return {
    ...state,
    experience: {
      ...experience,
      weeks: exists
        ? experience.weeks.map((item) => (item.id === week.id ? week : item))
        : [...experience.weeks, week],
      activeWeekId: week.id,
    },
  };
};

const ingredientSignature = (recipe: Recipe): string =>
  JSON.stringify(
    recipe.ingredients.map((item) => [
      item.name.trim().toLocaleLowerCase(),
      item.quantity,
      item.unit?.trim().toLocaleLowerCase() ?? null,
    ]),
  );

/** Remembers the amount a grocery line showed before a change, so the list can flag it. */
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

/** Swap proposal and its grocery differences, without changing anything. */
export function previewSwap(state: AppState, request: SwapRequest): SwapPreview {
  const week = state.experience?.weeks.find((item) => item.id === request.weekId);
  if (!week) throw new ApplicationError('NOT_FOUND', 'That week could not be found.');
  const proposedWeek = planning.swap(state, week, request);
  const before = purchases.buildList(state, week);
  const after = purchases.buildList(putWeek(state, proposedWeek), proposedWeek);
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
  return { request, proposedWeek, changes };
}

interface Applied<T extends CommandType> {
  state: AppState;
  result: ResultOf<T>;
}
type Handler<T extends CommandType> = (
  state: AppState,
  command: CommandOf<T>,
  date: string,
) => Applied<T>;

const changed = <T extends CommandType>(state: AppState): Applied<T> => ({
  state,
  result: {} as ResultOf<T>,
});
const slotOf = (state: AppState) => state.experience!.preferredSlot;

const handlers: { [T in CommandType]: Handler<T> } = {
  'today.setSlot': (state, command) =>
    changed({ ...state, experience: { ...state.experience!, preferredSlot: command.slot } }),

  'today.choose': (state, command, date) =>
    changed(
      food.chooseToday(state, date, slotOf(state), command.recipeId, {
        batchId: command.batchId,
        useId: command.useId,
      }),
    ),

  'today.next': (state, _command, date) => changed(food.nextMeal(state, date, slotOf(state))),

  'cook.start': (state, command, date) => {
    const slot = slotOf(state);
    let working = state;
    const recipe = state.recipes.find((item) => item.id === command.recipeId);
    if (!recipe) throw new ApplicationError('NOT_FOUND', 'That recipe is no longer in your book.');
    if (recipe.baseServings === null && command.sourceYield !== undefined) {
      const updated = validateRecipes([{ ...recipe, baseServings: command.sourceYield }])[0];
      working = {
        ...working,
        recipes: working.recipes.map((item) => (item.id === updated.id ? updated : item)),
      };
    }
    const alreadyRunning = working.experience!.sessions.some(
      (session) => session.recipeId === command.recipeId && !session.finishedAt,
    );
    if (command.extraBatch && !alreadyRunning) {
      if (!command.intentId)
        throw new ApplicationError('INVALID_INPUT', 'An extra batch needs a shopping intent ID.');
      working = food.chooseToday(working, date, slot, command.recipeId);
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
            return intent.recipeId === command.recipeId && completed
              ? { ...intent, fulfilled: true }
              : intent;
          }),
        },
      };
      working = purchases.addIntent(
        working,
        command.recipeId,
        command.sourceServings,
        command.intentId,
        command.sourceYield,
      );
    }
    const resolved = resolveCookingContext(working, {
      recipeId: command.recipeId,
      date,
      ...(!command.extraBatch ? { weekId: command.weekId, choiceId: command.choiceId } : {}),
    });
    const next = resolved.sessionId
      ? resolved.state
      : food.startCook(resolved.state, command.recipeId, command.sourceServings, {
          id: command.sessionId,
          date,
          slot,
          sourceYield: command.sourceYield,
          weekId: resolved.weekId ?? undefined,
          choiceId: resolved.dailyChoiceId,
        });
    const session =
      next.experience!.sessions.find(
        (item) => item.id === (resolved.sessionId ?? command.sessionId),
      ) ??
      next.experience!.sessions.find(
        (item) => item.recipeId === command.recipeId && !item.finishedAt,
      );
    if (!session)
      throw new ApplicationError('NOT_FOUND', 'The cooking session could not be opened.');
    return { state: next, result: { sessionId: session.id, resumed: Boolean(resolved.sessionId) } };
  },

  'cook.update': (state, command) =>
    changed(food.updateCook(state, command.sessionId, command.patch)),

  'cook.finish': (state, command, date) => {
    const session = state.experience!.sessions.find((item) => item.id === command.sessionId);
    if (session?.finishedAt) {
      const existing = state.experience!.batches.find((item) => item.sessionId === session.id);
      return { state, result: { batchId: existing?.id ?? null, alreadyFinished: true } };
    }
    let completed = food.finishCook(state, command.sessionId, {
      id: command.batchId,
      actualYield: command.actualYield,
      yieldUnit: command.yieldUnit,
      storage: command.storage,
      storageNotes: command.storageNotes,
      reheatNotes: command.reheatNotes,
      preparedSourceServings: command.preparedSourceServings,
      elapsedMinutes: command.elapsedMinutes,
      rememberTiming: command.rememberTiming,
    });
    const batch = completed.experience!.batches.find(
      (item) => item.sessionId === command.sessionId,
    );
    if (!batch || !session)
      return { state: completed, result: { batchId: batch?.id ?? null, alreadyFinished: false } };
    completed = {
      ...completed,
      experience: {
        ...completed.experience!,
        oneOffs: completed.experience!.oneOffs.map((intent) => {
          const sameDose = Math.abs(intent.sourceServings - session.sourceServings) < 0.000001;
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
    const slot = slotOf(state);
    const week = completed.experience!.weeks.find((item) => item.id === session.weekId);
    const use = week?.uses.find(
      (item) =>
        item.date === date &&
        item.slot === slot &&
        !item.skipped &&
        week.choices.find((choice) => choice.id === item.choiceId)?.readyBatchId === batch.id,
    );
    return {
      state: food.chooseToday(completed, date, slot, batch.recipeId, {
        batchId: batch.id,
        ...(use ? { useId: use.id } : {}),
      }),
      result: { batchId: batch.id, alreadyFinished: false },
    };
  },

  'food.consume': (state, command, date) => {
    const today = food.today(state, date, slotOf(state));
    return {
      state: food.consume(state, command.batchId, command.units, command.date, command.logId, {
        ...(command.date === date
          ? { dailyChoiceId: today.choice?.id, useId: command.useId ?? undefined }
          : {}),
      }),
      result: { logId: command.logId },
    };
  },

  'food.undo': (state, command) => {
    const entry = state.logs.find((item) => item.id === command.logId);
    return {
      state: food.undoConsumption(state, command.logId),
      result: { logId: command.logId, linkedToBatch: Boolean(entry?.batchId) },
    };
  },

  'recipe.add': (state, command) => {
    const checked = validateRecipes([command.recipe])[0];
    if (state.recipes.some((recipe) => recipe.id === checked.id))
      throw new ApplicationError(
        'ALREADY_EXISTS',
        'This recipe is already in your book. Your version was not overwritten.',
      );
    return changed({ ...state, recipes: [...state.recipes, checked] });
  },

  'recipe.update': (state, command) => {
    const previous = state.recipes.find((recipe) => recipe.id === command.recipe.id);
    if (!previous)
      throw new ApplicationError('NOT_FOUND', 'That recipe is no longer in your book.');
    let candidate = command.recipe;
    const compositionChanged = ingredientSignature(previous) !== ingredientSignature(candidate);
    if (compositionChanged && !command.nutritionConfirmed) {
      candidate = {
        ...candidate,
        nutrition: emptyNutrition(),
        nutritionBasis: 'unspecified',
        dataGaps: [
          ...new Set([...candidate.dataGaps, 'Ingredients changed; nutrition needs your review.']),
        ],
      };
    }
    if (command.nutritionConfirmed)
      candidate = {
        ...candidate,
        nutritionBasis: 'per_serving',
        nutritionEvidence:
          'Per-serving values explicitly reviewed by you after editing. Original written source remains available.',
      };
    if (
      !compositionChanged &&
      !command.nutritionConfirmed &&
      previous.nutritionBasis === 'per_serving' &&
      previous.baseServings &&
      candidate.baseServings &&
      previous.baseServings !== candidate.baseServings
    ) {
      const factor = previous.baseServings / candidate.baseServings;
      candidate = {
        ...candidate,
        nutrition: Object.fromEntries(
          Object.entries(previous.nutrition).map(([key, amount]) => [
            key,
            amount === null ? null : amount * factor,
          ]),
        ) as Recipe['nutrition'],
        nutritionEvidence:
          'Per-serving nutrition adjusted for your changed yield; ingredient totals and original reported values are unchanged.',
      };
    }
    const checked = validateRecipes([candidate])[0];
    return {
      state: {
        ...state,
        recipes: state.recipes.map((recipe) => (recipe.id === checked.id ? checked : recipe)),
      },
      result: { nutritionReset: compositionChanged && !command.nutritionConfirmed },
    };
  },

  'recipe.setProfile': (state, command) =>
    changed(food.updateProfile(state, command.recipeId, command.profile)),

  'recipe.import': (state, command) => {
    const imported = validateRecipes(command.recipes);
    const merged = new Map(state.recipes.map((recipe) => [recipe.id, recipe]));
    const replaced = imported.filter((recipe) => merged.has(recipe.id)).length;
    for (const recipe of imported) merged.set(recipe.id, recipe);
    return {
      state: { ...state, recipes: [...merged.values()] },
      result: { added: imported.length - replaced, replaced },
    };
  },

  'week.addRecipe': (state, command, date) => {
    const week = planning.addRecipe(
      state,
      activeWeek(state),
      command.recipeId,
      command.sourceServings,
      command.portions,
      command.newWeekId,
      date,
    );
    return { state: putWeek(state, week), result: { weekId: week.id } };
  },

  'week.propose': (state, command) => {
    const week = planning.proposeWeek(state, command.request, command.weekId);
    const next = putWeek(state, week);
    return {
      state: { ...next, experience: { ...next.experience!, lastPlanRequest: command.request } },
      result: { weekId: week.id },
    };
  },

  'week.select': (state, command) => {
    if (!state.experience!.weeks.some((week) => week.id === command.weekId))
      throw new ApplicationError('NOT_FOUND', 'That week is not available.');
    return changed({
      ...state,
      experience: { ...state.experience!, activeWeekId: command.weekId },
    });
  },

  'week.confirm': (state, _command, date) => {
    const week = requireWeek(state);
    return changed(reconcileToday(putWeek(state, { ...week, confirmed: true }), date, 'confirm'));
  },

  'week.reroll': (state) => {
    const week = requireWeek(state);
    const request = state.experience!.lastPlanRequest;
    if (!request)
      throw new ApplicationError(
        'INVALID_INPUT',
        'Choose cooking windows and portion preferences before generating fresh ideas for this imported week.',
      );
    return changed(putWeek(state, planning.rerollWeek(state, week, request)));
  },

  'week.lockChoice': (state, command) => {
    const week = requireWeek(state);
    return changed(
      putWeek(state, {
        ...week,
        choices: week.choices.map((choice) =>
          choice.id === command.choiceId ? { ...choice, locked: command.locked } : choice,
        ),
      }),
    );
  },

  'week.changePortions': (state, command) =>
    changed(
      putWeek(
        state,
        planning.changePortions(state, requireWeek(state), command.choiceId, command.portions),
      ),
    ),

  'week.moveUse': (state, command) =>
    changed(
      putWeek(
        state,
        planning.changeUse(state, requireWeek(state), command.useId, {
          date: command.date,
          slot: command.slot,
        }),
      ),
    ),

  'week.skipUse': (state, command) =>
    changed(
      putWeek(
        state,
        planning.changeUse(state, requireWeek(state), command.useId, { skipped: command.skipped }),
      ),
    ),

  'week.moveWindow': (state, command) =>
    changed(
      putWeek(
        state,
        planning.moveWindow(state, requireWeek(state), command.windowId, {
          date: command.date,
          startTime: command.startTime,
          availableMinutes: command.availableMinutes,
        }),
      ),
    ),

  'week.swap': (state, command, date) => {
    // Recomputed against the current record: a cook or portion change made while a
    // preview was open cannot be overwritten by that stale preview.
    const week = state.experience!.weeks.find((item) => item.id === command.request.weekId);
    if (!week)
      throw new ApplicationError('CONFLICT', 'That week changed while the preview was open.');
    const next = planning.swap(state, week, command.request);
    return changed(reconcileToday(putWeek(state, next), date, 'swap'));
  },

  'shop.addRecipe': (state, command) => {
    const recipe = state.recipes.find((item) => item.id === command.recipeId);
    const week = activeWeek(state);
    const alreadyInWeek = Boolean(
      week?.choices.some((choice) => {
        if (
          choice.recipeId !== command.recipeId ||
          choice.readyBatchId ||
          Math.abs(choice.sourceServings - command.sourceServings) > 0.000001
        )
          return false;
        const running = state.experience!.sessions.find(
          (session) =>
            session.weekId === week.id &&
            session.recipeId === choice.recipeId &&
            !session.finishedAt,
        );
        return (
          recipe &&
          (!running || ingredientSignature(running.recipeSnapshot) === ingredientSignature(recipe))
        );
      }),
    );
    if (alreadyInWeek) return { state, result: { alreadyInWeek } };
    return {
      state: purchases.addIntent(
        state,
        command.recipeId,
        command.sourceServings,
        command.intentId,
        command.sourceYield,
      ),
      result: { alreadyInWeek },
    };
  },

  'shop.removeIntent': (state, command) =>
    changed({
      ...state,
      experience: {
        ...state.experience!,
        oneOffs: state.experience!.oneOffs.map((intent) =>
          intent.id === command.intentId ? { ...intent, fulfilled: true } : intent,
        ),
      },
    }),

  'shop.cover': (state, command) => {
    const item = purchases
      .buildList(state, activeWeek(state))
      .items.find((line) => line.key === command.itemKey);
    if (!item)
      throw new ApplicationError(
        'CONFLICT',
        'That grocery requirement changed. Review the current list.',
      );
    const next = purchases.cover(
      state,
      item,
      { kind: command.kind, quantity: command.quantity },
      command.purchaseId,
    );
    const changes = { ...next.experience!.groceryChanges };
    delete changes[item.key];
    return changed({ ...next, experience: { ...next.experience!, groceryChanges: changes } });
  },

  'shop.match': (state, command) =>
    changed(
      purchases.approveMatch(
        state,
        command.names,
        command.purchaseName,
        command.prepNote,
        command.matchId,
      ),
    ),

  'shop.setAisle': (state, command) => {
    const aisle = command.aisle.trim();
    if (!aisle) throw new ApplicationError('INVALID_INPUT', 'Choose a grocery aisle.');
    return changed({
      ...state,
      experience: {
        ...state.experience!,
        aisleOverrides: { ...state.experience!.aisleOverrides, [command.itemKey]: aisle },
      },
    });
  },

  'shop.addManual': (state, command) => {
    const name = command.name.trim();
    if (!name) throw new ApplicationError('INVALID_INPUT', 'Add an item name.');
    return changed({
      ...state,
      experience: {
        ...state.experience!,
        manualItems: [
          ...state.experience!.manualItems,
          { id: command.itemId, name, quantityText: command.quantityText.trim(), checked: false },
        ],
      },
    });
  },

  'shop.toggleManual': (state, command) => updateManualItems(state, command.itemId, 'toggle'),
  'shop.removeManual': (state, command) => updateManualItems(state, command.itemId, 'remove'),

  'log.addRecipe': (state, command) => {
    const recipe = state.recipes.find((item) => item.id === command.recipeId);
    if (!recipe) throw new ApplicationError('NOT_FOUND', 'Choose a saved recipe to log.');
    if (state.logs.some((entry) => entry.id === command.logId))
      throw new ApplicationError('ALREADY_EXISTS', 'That food log already exists.');
    const entry = {
      ...createConsumption(recipe, command.servings, command.date),
      id: command.logId,
    };
    return { state: { ...state, logs: [...state.logs, entry] }, result: { logId: entry.id } };
  },

  'log.addManual': (state, command) => {
    if (state.logs.some((entry) => entry.id === command.entry.id))
      return { state, result: { logId: command.entry.id, duplicate: true } };
    return {
      state: validateState({ ...state, logs: [...state.logs, command.entry] }),
      result: { logId: command.entry.id, duplicate: false },
    };
  },

  'targets.set': (state, command) => changed(validateState({ ...state, targets: command.targets })),
};

function updateManualItems<T extends CommandType>(
  state: AppState,
  itemId: string,
  mode: 'toggle' | 'remove',
): Applied<T> {
  const update = <I extends { id: string; checked: boolean }>(items: I[]): I[] =>
    mode === 'remove'
      ? items.filter((item) => item.id !== itemId)
      : items.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item));
  return changed({
    ...state,
    manualShopping: Object.fromEntries(
      Object.entries(state.manualShopping).map(([key, items]) => [key, update(items)]),
    ),
    experience: { ...state.experience!, manualItems: update(state.experience!.manualItems) },
  });
}

const findEntry = (ledger: OperationLedger, operationId: string): LedgerEntry | undefined => {
  for (let index = ledger.entries.length - 1; index >= 0; index -= 1)
    if (ledger.entries[index].operationId === operationId) return ledger.entries[index];
  return undefined;
};

/**
 * Runs one command against a snapshot. Returns the next snapshot and the outcome, or
 * throws an `ApplicationError` and leaves the snapshot unchanged. A repeated operation
 * ID with the same command and context returns the first result without re-running.
 */
export function executeCommand<C extends ApplicationCommand>(
  snapshot: ApplicationSnapshot,
  envelope: CommandEnvelope<C>,
): { snapshot: ApplicationSnapshot; outcome: CommandOutcome<C> } {
  const { operationId, command, context } = envelope;
  if (typeof operationId !== 'string' || !operationId.trim())
    throw new ApplicationError('INVALID_INPUT', 'Every change needs an operation ID.');
  if (!context || !DATE_ONLY.test(context.date))
    throw new ApplicationError('INVALID_INPUT', 'The change needs today’s date as YYYY-MM-DD.');
  const type = command?.type;
  const handler =
    typeof type === 'string' && Object.prototype.hasOwnProperty.call(handlers, type)
      ? (handlers[type] as Handler<C['type']>)
      : undefined;
  if (!handler) throw new ApplicationError('INVALID_INPUT', 'That change is not supported.');

  const print = fingerprint({ command, context });
  const prior = findEntry(snapshot.ledger, operationId);
  if (prior) {
    if (prior.fingerprint !== print)
      throw new ApplicationError(
        'OPERATION_KEY_REUSED',
        'This operation ID was already used for a different change.',
      );
    return {
      snapshot,
      outcome: {
        operationId,
        status: 'replayed',
        revision: prior.revision,
        result: prior.result as ResultOf<C['type']>,
      },
    };
  }
  if (envelope.baseRevision !== undefined && envelope.baseRevision !== snapshot.revision)
    throw new ApplicationError(
      'CONFLICT',
      'Your book changed since this change was prepared. Review the current version and try again.',
    );

  const previous = snapshot.state.experience ? snapshot.state : food.ensureState(snapshot.state);
  let applied: Applied<C['type']>;
  try {
    applied = handler(previous, command as unknown as CommandOf<C['type']>, context.date);
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError(
      'INVALID_INPUT',
      error instanceof Error ? error.message : 'This change could not be completed.',
    );
  }
  let next = food.ensureState(applied.state);
  next = preserveGroceryChanges(previous, next);
  next = food.ensureToday(next, context.date, next.experience!.preferredSlot);

  const revision = snapshot.revision + 1;
  const entries = [
    ...snapshot.ledger.entries,
    { operationId, fingerprint: print, type: command.type, revision, result: applied.result },
  ];
  return {
    snapshot: {
      state: next,
      ledger: { entries: entries.slice(Math.max(0, entries.length - LEDGER_LIMIT)) },
      revision,
    },
    outcome: { operationId, status: 'applied', revision, result: applied.result },
  };
}
