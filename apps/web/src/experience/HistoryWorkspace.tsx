import { ChevronDown, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  emptyNutrition,
  type ConsumptionEntry,
  type MacroKey,
  type Nutrition,
  type Recipe,
} from '@domain/types';
import type { PreparedBatch } from '@domain/experience-types';
import {
  allMacros,
  dateLabel,
  displayNumber,
  localDate,
  macroLabels,
  macroUnits,
  makeId,
} from '../components/shared';
import type { MealbookUIProps } from '../mealbook-contract';
import { LabelledButton, recipeTime } from './controls';

export interface MacroTotal {
  key: MacroKey;
  value: number;
  known: number;
  count: number;
  complete: boolean;
}

export type NutritionText = Record<MacroKey, string>;

const isKnownNutritionValue = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const nutritionText = (nutrition: Nutrition): NutritionText => ({
  calories: nutrition.calories === null ? '' : String(nutrition.calories),
  protein: nutrition.protein === null ? '' : String(nutrition.protein),
  carbs: nutrition.carbs === null ? '' : String(nutrition.carbs),
  fat: nutrition.fat === null ? '' : String(nutrition.fat),
  fiber: nutrition.fiber === null ? '' : String(nutrition.fiber),
  sugar: nutrition.sugar === null ? '' : String(nutrition.sugar),
  sodium: nutrition.sodium === null ? '' : String(nutrition.sodium),
});

export const emptyNutritionText = (): NutritionText => nutritionText(emptyNutrition());

/**
 * Accept an optional locale-style decimal only when saved. Draft text is intentionally
 * kept untouched in the inputs so a trailing decimal separator is never lost while typing.
 */
export const parseOptionalDecimal = (raw: string, label: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized =
    trimmed.includes(',') && !trimmed.includes('.') ? trimmed.replace(',', '.') : trimmed;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${label} must be zero or more, or left blank.`);
  return value;
};

export const parsePositiveDecimal = (raw: string, label: string): number => {
  const value = parseOptionalDecimal(raw, label);
  if (value === null || value <= 0) throw new Error(`${label} must be greater than zero.`);
  return value;
};

export const nutritionFromText = (values: NutritionText): Nutrition => {
  const nutrition = emptyNutrition();
  for (const key of allMacros) nutrition[key] = parseOptionalDecimal(values[key], macroLabels[key]);
  return nutrition;
};

/**
 * Totals only add confirmed values. `value` is therefore a known subtotal when
 * `complete` is false, never a made-up daily total with unknown values treated as zero.
 */
export const dailyMacroTotals = (
  entries: Array<Pick<ConsumptionEntry, 'nutritionSnapshot'>>,
): MacroTotal[] =>
  allMacros.map((key) => {
    let value = 0;
    let known = 0;
    for (const entry of entries) {
      const amount = entry.nutritionSnapshot[key];
      if (isKnownNutritionValue(amount)) {
        value += amount;
        known += 1;
      }
    }
    return {
      key,
      value,
      known,
      count: entries.length,
      complete: entries.length > 0 && known === entries.length,
    };
  });

/** Uses the same batchUnits ledger as the food engine; non-batch recipe logs never affect it. */
export const remainingBatchUnits = (
  batch: Pick<PreparedBatch, 'id' | 'actualYield'>,
  logs: Pick<ConsumptionEntry, 'batchId' | 'batchUnits'>[],
): number =>
  batch.actualYield -
  logs.reduce(
    (total, log) =>
      log.batchId === batch.id && isKnownNutritionValue(log.batchUnits) && log.batchUnits > 0
        ? total + log.batchUnits
        : total,
    0,
  );

const coverageLabel = (total: MacroTotal): string => {
  if (total.count === 0) return 'No log entries for this date.';
  if (total.complete) return `Complete · ${total.known}/${total.count} log entries known`;
  return `Incomplete · ${total.known}/${total.count} log entries known`;
};

const totalValueLabel = (total: MacroTotal): string => {
  if (total.known === 0) return '—';
  return `${displayNumber(total.value)} ${macroUnits[total.key]}`;
};

const goalStatus = (total: MacroTotal, target: number | null): string | null => {
  if (target === null) return null;
  if (total.count === 0) return 'No log entries to compare with this target.';
  if (!total.complete) return 'Target status unavailable until every log has a known value.';
  if (total.value >= target) return 'Target reached with complete log coverage.';
  return `${displayNumber(target - total.value)} ${macroUnits[total.key]} remaining with complete log coverage.`;
};

const plural = (count: number, singular: string): string =>
  `${count} ${singular}${count === 1 ? '' : 's'}`;

const logQuantityLabel = (log: ConsumptionEntry, batch: PreparedBatch | undefined): string => {
  if (log.batchId) {
    const units = typeof log.batchUnits === 'number' ? log.batchUnits : log.servings;
    return batch
      ? `Prepared batch · ${displayNumber(units)} ${batch.yieldUnit}`
      : `Prepared batch · ${displayNumber(units)} units (batch record unavailable)`;
  }
  if (log.recipeId)
    return `${displayNumber(log.servings)} recipe-source serving${log.servings === 1 ? '' : 's'}`;
  return 'Manual total entry';
};

function NutritionSnapshot({ nutrition }: { nutrition: Nutrition }) {
  const known = allMacros.filter((key) => isKnownNutritionValue(nutrition[key])).length;
  return (
    <details className="mb-detail">
      <summary>Nutrition snapshot · {plural(known, 'field')} known</summary>
      <div className="mb-two-fields">
        {allMacros.map((key) => (
          <p key={key}>
            <strong>{macroLabels[key]}</strong>
            <br />
            {isKnownNutritionValue(nutrition[key])
              ? `${displayNumber(nutrition[key])} ${macroUnits[key]}`
              : 'Unknown'}
          </p>
        ))}
      </div>
    </details>
  );
}

export function ActualCalendar({
  date,
  logs,
  onDateChange,
}: {
  date: string;
  logs: ConsumptionEntry[];
  onDateChange: (date: string) => void;
}) {
  const recordedDates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) counts.set(log.date, (counts.get(log.date) ?? 0) + 1);
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.value.localeCompare(left.value))
      .slice(0, 8);
  }, [logs]);

  return (
    <section className="mb-history-entry" aria-label="Browse actual food log dates">
      <label className="mb-slot-select">
        <span>View date</span>
        <input
          type="date"
          value={date}
          onChange={(event) => {
            if (event.target.value) onDateChange(event.target.value);
          }}
        />
      </label>
      {recordedDates.length > 0 && (
        <>
          <p className="mb-quiet">
            Recorded dates are shown as log records, not as meal portions or source servings.
          </p>
          <div className="mb-chip-row" aria-label="Dates with log records">
            {recordedDates.map((item) => (
              <button
                key={item.value}
                type="button"
                className={item.value === date ? 'is-active' : ''}
                aria-pressed={item.value === date}
                onClick={() => onDateChange(item.value)}
              >
                {dateLabel(item.value)} · {plural(item.count, 'log record')}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function RecipeSearch({
  recipes,
  onPick,
}: {
  recipes: Recipe[];
  onPick: (recipe: Recipe) => void;
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const matches = useMemo(() => {
    const term = deferredQuery.trim().toLocaleLowerCase();
    if (!term) return [];
    return recipes
      .filter((recipe) =>
        `${recipe.name} ${recipe.ingredients.map((item) => item.name).join(' ')}`
          .toLocaleLowerCase()
          .includes(term),
      )
      .slice(0, 5);
  }, [deferredQuery, recipes]);

  return (
    <div className="mb-recipe-picker">
      <label className="mb-search">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Search your saved recipes</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your saved recipes"
        />
      </label>
      {query.trim() && (
        <div className="mb-recipe-picker__results">
          {matches.length ? (
            matches.map((recipe) => (
              <button
                type="button"
                key={recipe.id}
                onClick={() => {
                  onPick(recipe);
                  setQuery('');
                }}
              >
                <strong>{recipe.name}</strong>
                <span>{recipeTime(recipe) || 'Time not confirmed'}</span>
              </button>
            ))
          ) : (
            <p>No saved recipes match that search.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DailyTotals({ entries, targets }: { entries: ConsumptionEntry[]; targets: Nutrition }) {
  const totals = useMemo(() => dailyMacroTotals(entries), [entries]);
  return (
    <section className="mb-history-list" aria-labelledby="daily-totals-heading">
      <h2 id="daily-totals-heading">Actual nutrition</h2>
      <p className="mb-quiet">
        Totals add only confirmed snapshot values. A field remains incomplete when any logged entry
        leaves it unknown.
      </p>
      <div className="mb-two-fields">
        {totals.map((total) => {
          const status = goalStatus(total, targets[total.key]);
          return (
            <article className="mb-history-entry" key={total.key}>
              <h3>{macroLabels[total.key]}</h3>
              <strong>
                {total.complete
                  ? totalValueLabel(total)
                  : total.known
                    ? `Known subtotal · ${totalValueLabel(total)}`
                    : 'Unknown'}
              </strong>
              <p className="mb-quiet">{coverageLabel(total)}</p>
              {status && <p className="mb-quiet">{status}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReadyBatchAlternatives({
  recipe,
  batches,
  logs,
  dispatch,
}: {
  recipe: Recipe;
  batches: PreparedBatch[];
  logs: ConsumptionEntry[];
  dispatch: MealbookUIProps['dispatch'];
}) {
  const ready = useMemo(
    () =>
      batches
        .map((batch) => ({ batch, remaining: remainingBatchUnits(batch, logs) }))
        .filter((item) => item.remaining > 0),
    [batches, logs],
  );
  if (!ready.length) return null;

  return (
    <div className="mb-callout">
      <strong>Prepared food is available</strong>
      <p>
        Logging {recipe.name} below creates a separate recipe-source log and does not change
        prepared food. To eat prepared food, open one explicit portion confirmation instead.
      </p>
      {ready.map(({ batch, remaining }) => (
        <div key={batch.id}>
          <p>
            <strong>{batch.recipeSnapshot.name}</strong>
            <br />
            {displayNumber(remaining)} {batch.yieldUnit} remaining
          </p>
          <LabelledButton
            className="mb-button--quiet mb-button--small"
            onClick={() => dispatch({ type: 'EAT_OPEN', batchId: batch.id })}
          >
            Have a portion
          </LabelledButton>
        </div>
      ))}
    </div>
  );
}

export function EnhancedHistory({ model, dispatch }: Pick<MealbookUIProps, 'model' | 'dispatch'>) {
  const [date, setDate] = useState(() => model.date || localDate());
  const [browseOpen, setBrowseOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [servings, setServings] = useState('1');
  const [manualName, setManualName] = useState('');
  const [manualNutrition, setManualNutrition] = useState<NutritionText>(emptyNutritionText);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [targetNutrition, setTargetNutrition] = useState<NutritionText>(() =>
    nutritionText(model.state.targets),
  );
  const [formError, setFormError] = useState('');

  const logs = useMemo(
    () =>
      model.state.logs
        .filter((log) => log.date === date)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [date, model.state.logs],
  );
  const batchById = useMemo(
    () => new Map((model.state.experience?.batches ?? []).map((batch) => [batch.id, batch])),
    [model.state.experience?.batches],
  );
  const selectedRecipe = useMemo(
    () => model.state.recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [model.state.recipes, selectedRecipeId],
  );
  const selectedRecipeBatches = useMemo(
    () =>
      (model.state.experience?.batches ?? []).filter(
        (batch) => batch.recipeId === selectedRecipe?.id,
      ),
    [model.state.experience?.batches, selectedRecipe?.id],
  );
  const feedback = model.noticeIsError && model.notice ? model.notice : formError;

  useEffect(() => {
    if (selectedRecipeId && !model.state.recipes.some((recipe) => recipe.id === selectedRecipeId))
      setSelectedRecipeId(null);
  }, [model.state.recipes, selectedRecipeId]);

  const addRecipeLog = () => {
    if (!selectedRecipe) {
      setFormError('Choose a saved recipe before adding a recipe log.');
      return;
    }
    try {
      const amount = parsePositiveDecimal(servings, 'Actual recipe-source servings');
      setFormError('');
      const saved = dispatch({
        type: 'ADD_RECIPE_LOG',
        recipeId: selectedRecipe.id,
        servings: amount,
        date,
      });
      if (!saved) {
        setFormError(
          'The recipe log was not saved. Your selection and values are still here to review.',
        );
        return;
      }
      setSelectedRecipeId(null);
      setServings('1');
      setEntryOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The recipe log could not be saved.');
    }
  };

  const addManualLog = (event: FormEvent) => {
    event.preventDefault();
    if (!manualName.trim()) {
      setFormError('Add a food name before saving a manual entry.');
      return;
    }
    try {
      const entry: ConsumptionEntry = {
        id: makeId('manual-log'),
        date,
        recipeId: null,
        name: manualName.trim(),
        servings: 1,
        nutritionSnapshot: nutritionFromText(manualNutrition),
        createdAt: new Date().toISOString(),
      };
      setFormError('');
      const saved = dispatch({ type: 'ADD_MANUAL_LOG', entry });
      if (!saved) {
        setFormError(
          'The manual entry was not saved. Your name and nutrition values are still here to review.',
        );
        return;
      }
      setManualName('');
      setManualNutrition(emptyNutritionText());
      setManualOpen(false);
      setEntryOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The manual entry could not be saved.');
    }
  };

  const saveTargets = () => {
    try {
      const targets = nutritionFromText(targetNutrition);
      setFormError('');
      const saved = dispatch({ type: 'SET_TARGETS', targets });
      if (!saved) setFormError('Goals were not saved. Your values are still here to review.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Goals could not be saved.');
    }
  };

  const openGoals = () => {
    if (!goalsOpen) setTargetNutrition(nutritionText(model.state.targets));
    setGoalsOpen((value) => !value);
  };

  const openHistoricalRecipe = (log: ConsumptionEntry) => {
    if (!log.recipeId) return;
    // Parent accepts batchId here so a batch log can open its immutable prepared-recipe snapshot.
    const action = {
      type: 'OPEN_RECIPE' as const,
      recipeId: log.recipeId,
      ...(log.batchId ? { batchId: log.batchId } : {}),
    };
    dispatch(action);
  };

  return (
    <section className="mb-page mb-history" aria-labelledby="history-heading">
      <header className="mb-page-header">
        <div>
          <h1 id="history-heading">History &amp; goals</h1>
          <p>
            Food is logged when you confirm it was eaten, not when you plan or cook it. Viewing{' '}
            {dateLabel(date)}.
          </p>
        </div>
        <button
          type="button"
          className="mb-disclosure"
          aria-expanded={browseOpen}
          onClick={() => setBrowseOpen((value) => !value)}
        >
          Browse dates <ChevronDown size={18} />
        </button>
      </header>

      {feedback && (
        <p className="mb-form-error" role="alert">
          {feedback}
        </p>
      )}
      {browseOpen && <ActualCalendar date={date} logs={model.state.logs} onDateChange={setDate} />}
      <DailyTotals entries={logs} targets={model.state.targets} />

      <section className="mb-history-entry">
        <button
          type="button"
          className="mb-disclosure"
          aria-expanded={entryOpen}
          onClick={() => setEntryOpen((value) => !value)}
        >
          Log something you ate <ChevronDown size={18} />
        </button>
        {entryOpen && (
          <div>
            <p>
              Recipe logs and manual entries are optional. A saved-recipe log never changes
              prepared-batch stock.
            </p>
            <RecipeSearch
              recipes={model.state.recipes}
              onPick={(recipe) => {
                setSelectedRecipeId(recipe.id);
                setFormError('');
              }}
            />
            {selectedRecipe && (
              <div className="mb-picked-recipe">
                <span>{selectedRecipe.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedRecipeId(null)}
                  aria-label={`Remove ${selectedRecipe.name}`}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <div className="mb-two-fields">
              <label className="mb-field">
                <span>Actual recipe-source servings</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={servings}
                  onChange={(event) => setServings(event.target.value)}
                  placeholder="1"
                />
              </label>
              <div className="mb-history-entry__actions">
                <LabelledButton disabled={!selectedRecipe} onClick={addRecipeLog}>
                  Log selected recipe
                </LabelledButton>
                <button
                  type="button"
                  className="mb-link-button"
                  onClick={() => setManualOpen((value) => !value)}
                >
                  {manualOpen ? 'Cancel manual entry' : 'Add manual food'}
                </button>
              </div>
            </div>
            {selectedRecipe && (
              <ReadyBatchAlternatives
                recipe={selectedRecipe}
                batches={selectedRecipeBatches}
                logs={model.state.logs}
                dispatch={dispatch}
              />
            )}
            {manualOpen && (
              <form className="mb-manual-log" onSubmit={addManualLog}>
                <label className="mb-field">
                  <span>Food name</span>
                  <input
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    required
                  />
                </label>
                <p>
                  Nutrition applies to this whole manual entry. All fields are optional; empty stays
                  unknown. Decimal commas or decimal points are accepted when you save.
                </p>
                <div className="mb-two-fields">
                  {allMacros.map((key) => (
                    <label className="mb-field" key={key}>
                      <span>
                        {macroLabels[key]} ({macroUnits[key]})
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={manualNutrition[key]}
                        onChange={(event) =>
                          setManualNutrition((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        placeholder="Unknown"
                      />
                    </label>
                  ))}
                </div>
                <LabelledButton type="submit">Save manual entry</LabelledButton>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="mb-history-list" aria-labelledby="log-list-heading">
        <h2 id="log-list-heading">Logged on {dateLabel(date)}</h2>
        {logs.length ? (
          <ul>
            {logs.map((log) => {
              const batch = log.batchId ? batchById.get(log.batchId) : undefined;
              return (
                <li key={log.id}>
                  <div>
                    <strong>{log.name}</strong>
                    <span>{logQuantityLabel(log, batch)}</span>
                  </div>
                  <div>
                    {log.recipeId && (
                      <button
                        type="button"
                        className="mb-link-button"
                        onClick={() => openHistoricalRecipe(log)}
                      >
                        {log.batchId ? 'View prepared recipe at time of log' : 'View recipe'}
                      </button>
                    )}
                    <NutritionSnapshot nutrition={log.nutritionSnapshot} />
                    <LabelledButton
                      className="mb-button--quiet mb-button--small"
                      onClick={() => dispatch({ type: 'UNDO_LOG', logId: log.id })}
                    >
                      Undo / remove log
                    </LabelledButton>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mb-empty mb-empty--short">
            <h3>No meals logged yet</h3>
            <p>Use Today’s “Have a portion” confirmation, or add an actual meal here.</p>
          </div>
        )}
      </section>

      <section className="mb-goals">
        <button
          type="button"
          className="mb-disclosure"
          aria-expanded={goalsOpen}
          onClick={openGoals}
        >
          Personal goals <ChevronDown size={18} />
        </button>
        {goalsOpen && (
          <div>
            <p>
              Optional daily targets. Empty means no target. A target is only compared when that
              nutrient has complete log coverage for the day.
            </p>
            <div className="mb-two-fields">
              {allMacros.map((key) => (
                <label className="mb-field" key={key}>
                  <span>
                    Daily {macroLabels[key].toLocaleLowerCase()} ({macroUnits[key]})
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={targetNutrition[key]}
                    onChange={(event) =>
                      setTargetNutrition((current) => ({ ...current, [key]: event.target.value }))
                    }
                    placeholder="No target"
                  />
                </label>
              ))}
            </div>
            <LabelledButton className="mb-button--quiet" onClick={saveTargets}>
              Save goals
            </LabelledButton>
          </div>
        )}
      </section>
    </section>
  );
}
