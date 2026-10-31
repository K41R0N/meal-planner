import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChefHat,
  ChevronDown,
  Circle,
  Clock3,
  ExternalLink,
  Heart,
  ListChecks,
  Lock,
  LockOpen,
  Plus,
  Search,
  Settings,
  ShoppingBasket,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  defaultFilters,
  emptyNutrition,
  mealTypes,
  type ConsumptionEntry,
  type Filters,
  type MealType,
  type Recipe,
} from '@domain/types';
import type {
  BatchChoice,
  BatchPlanRequest,
  BatchUse,
  CookingSession,
  CookingTimer,
  FoodStorage,
  PreparedBatch,
  PurchaseItem,
  RecipeProfile,
} from '@domain/experience-types';
import { defaultRecipeProfile, type MealbookUIProps } from '../mealbook-contract';
import {
  commaList,
  displayNumber,
  humanRole,
  makeId,
  parseIngredientText,
} from '../components/shared';
import './mealbook-ui.css';
import {
  AppDialog,
  DialogFeedbackContext,
  LabelledButton,
  RecipeVisual,
  cookTime,
  macroFacts,
  recipeTime,
} from './controls';
import { EnhancedRecipeBook, RecipeEditForm, RecipeProfileForm } from './RecipeWorkspace';
import { EnhancedHistory } from './HistoryWorkspace';
import { WindowEntry as WindowEditor } from './WindowEntry';
import { allMacros, macroLabels } from '../components/shared';

const RecipeImport = lazy(() =>
  import('../components/RecipeImport').then((module) => ({ default: module.RecipeImport })),
);

const NAV_ITEMS: Array<{
  page: 'today' | 'week' | 'recipes' | 'shopping';
  label: string;
  icon: typeof CalendarDays;
}> = [
  { page: 'today', label: 'Today', icon: CalendarDays },
  { page: 'week', label: 'My week', icon: CalendarDays },
  { page: 'recipes', label: 'Recipe book', icon: BookOpen },
  { page: 'shopping', label: 'Shop', icon: ShoppingBasket },
];

function localDate(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function numberFrom(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function preparedBatchFacts(batch: PreparedBatch): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  if (batch.nutritionPerUnit.calories !== null)
    facts.push({
      label: 'Calories',
      value: `${displayNumber(batch.nutritionPerUnit.calories, 0)} kcal`,
    });
  if (batch.nutritionPerUnit.protein !== null)
    facts.push({ label: 'Protein', value: `${displayNumber(batch.nutritionPerUnit.protein)} g` });
  return facts;
}

function profileFor(
  recipeId: string,
  profiles: Record<string, RecipeProfile> | undefined,
): RecipeProfile {
  return profiles?.[recipeId] ?? defaultRecipeProfile();
}

function pageTitle(page: string): string {
  if (page === 'week') return 'My week';
  if (page === 'recipes') return 'Recipe book';
  if (page === 'shopping') return 'Shop';
  if (page === 'log') return 'History & goals';
  if (page === 'settings') return 'Settings & backup';
  return 'Today’s recipe';
}

function PrimaryNav({
  page,
  dispatch,
  variant = 'desktop',
}: Pick<MealbookUIProps, 'dispatch'> & {
  page: MealbookUIProps['model']['page'];
  variant?: 'desktop' | 'mobile';
}) {
  return (
    <nav
      className={variant === 'desktop' ? 'mb-rail__nav' : 'mb-mobile-nav'}
      aria-label="Primary navigation"
    >
      {NAV_ITEMS.map(({ page: itemPage, label, icon: Icon }) => (
        <button
          key={itemPage}
          type="button"
          className={page === itemPage ? 'is-active' : ''}
          aria-current={page === itemPage ? 'page' : undefined}
          onClick={() => dispatch({ type: 'NAVIGATE', page: itemPage })}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function StartCookDialog({
  recipe,
  sourceServings,
  context,
  onClose,
  dispatch,
}: {
  recipe: Recipe;
  sourceServings: number;
  context: { weekId?: string; choiceId?: string };
  onClose: () => void;
  dispatch: MealbookUIProps['dispatch'];
}) {
  const [amount, setAmount] = useState(recipe.baseServings === null ? '' : String(sourceServings));
  const title =
    recipe.baseServings === null
      ? 'How many servings does the recipe make?'
      : 'Confirm cooking amount';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = numberFrom(amount, sourceServings);
    if (
      dispatch({
        type: 'START_COOK',
        recipeId: recipe.id,
        sourceServings: value,
        ...(recipe.baseServings === null ? { sourceYield: value } : {}),
        ...context,
      })
    )
      onClose();
  };
  return (
    <AppDialog open onClose={onClose} labelledBy="cook-amount-title">
      <form className="mb-dialog__surface" onSubmit={submit}>
        <header>
          <h2 id="cook-amount-title">{title}</h2>
          <button type="button" className="mb-icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        <p>
          {recipe.baseServings === null
            ? 'Check the original recipe and enter its yield. We’ll cook the written quantities unchanged and use your confirmed yield to count portions.'
            : 'You can start with the planned recipe amount or adjust it before entering cooking mode.'}
        </p>
        <label className="mb-field">
          <span>Source recipe servings</span>
          <input
            type="number"
            min="0.25"
            step="0.25"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <footer>
          <LabelledButton className="mb-button--quiet" onClick={onClose}>
            Cancel
          </LabelledButton>
          <LabelledButton type="submit">
            <ChefHat size={17} /> Start cooking
          </LabelledButton>
        </footer>
      </form>
    </AppDialog>
  );
}

function EatDialog({
  request,
  availableUnits,
  batch,
  dispatch,
}: {
  request: NonNullable<MealbookUIProps['model']['eating']>;
  availableUnits: number;
  batch?: PreparedBatch;
  dispatch: MealbookUIProps['dispatch'];
}) {
  const [units, setUnits] = useState(String(request.units));
  const [date, setDate] = useState(localDate());
  const submit = (event: FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'EAT_CONFIRM', units: numberFrom(units, request.units), date });
  };
  return (
    <AppDialog open onClose={() => dispatch({ type: 'EAT_CANCEL' })} labelledBy="eat-confirm-title">
      <form className="mb-dialog__surface" onSubmit={submit}>
        <header>
          <h2 id="eat-confirm-title">Have a portion</h2>
          <button
            type="button"
            className="mb-icon-button"
            onClick={() => dispatch({ type: 'EAT_CANCEL' })}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </header>
        <p>
          {batch?.storage === 'freezer'
            ? batch.reheatNotes
              ? `This batch is frozen. Reheat or defrost context: ${batch.reheatNotes}`
              : 'This batch is frozen. Reheat or defrost it using your source or manual guidance before confirming what you ate.'
            : availableUnits > 0
              ? `${displayNumber(availableUnits)} portion${availableUnits === 1 ? '' : 's'} are available. Opening this check does not log food.`
              : 'Confirm the amount you actually ate.'}
        </p>
        <div className="mb-two-fields">
          <label className="mb-field">
            <span>Actual {batch?.yieldUnit ?? 'portions'} eaten</span>
            <input
              type="number"
              min="0.0001"
              step="any"
              inputMode="decimal"
              max={availableUnits}
              value={units}
              onChange={(event) => setUnits(event.target.value)}
              required
            />
          </label>
          <label className="mb-field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
        </div>
        <footer>
          <LabelledButton
            className="mb-button--quiet"
            onClick={() => dispatch({ type: 'EAT_CANCEL' })}
          >
            Not yet
          </LabelledButton>
          <LabelledButton type="submit">
            <Check size={17} /> I ate this
          </LabelledButton>
        </footer>
      </form>
    </AppDialog>
  );
}

function TodayPage({ model, dispatch }: Pick<MealbookUIProps, 'model' | 'dispatch'>) {
  const { today } = model;
  const recipe = today.recipe;
  const [startPrompt, setStartPrompt] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const recipes = model.state.recipes;
  const remaining = (batch: PreparedBatch) =>
    Math.max(
      0,
      batch.actualYield -
        model.state.logs.reduce(
          (total, log) => (log.batchId === batch.id ? total + (log.batchUnits ?? 0) : total),
          0,
        ),
    );
  const readyBatches =
    model.state.experience?.batches.filter(
      (batch) => remaining(batch) > 0 && batch.id !== today.batch?.id,
    ) ?? [];
  const plannedSourceServings =
    today.plannedSourceServings > 0 ? today.plannedSourceServings : (recipe?.baseServings ?? 1);
  const startCooking = () => {
    if (!recipe) return;
    if (recipe.baseServings === null) {
      setStartPrompt(true);
      return;
    }
    dispatch({
      type: 'START_COOK',
      recipeId: recipe.id,
      sourceServings: plannedSourceServings,
      weekId: model.week?.id,
      choiceId: today.choice?.id,
      extraBatch: today.status === 'ready' && today.availableUnits <= 0,
    });
  };
  const todayFacts = today.batch
    ? preparedBatchFacts(today.batch)
    : recipe
      ? macroFacts(recipe)
      : [];
  const todayNutritionLabel = today.batch
    ? `per prepared ${today.batch.yieldUnit}`
    : 'per recipe serving';
  const cardState =
    today.status === 'ready'
      ? today.availableUnits > 0
        ? 'Ready to eat'
        : 'No ready portions left'
      : today.status === 'cooking'
        ? 'Cooking in progress'
        : today.status === 'eaten'
          ? 'Eaten today'
          : today.status === 'uncooked'
            ? 'To cook'
            : 'Choose a recipe';
  const portionText = today.batch
    ? today.availableUnits > 0
      ? `${displayNumber(today.availableUnits)} left`
      : 'No portions left'
    : recipe?.baseServings
      ? `Makes ${displayNumber(recipe.baseServings)}`
      : 'Yield to confirm';
  const firstChoices = recipes
    .filter((item) => item.id !== recipe?.id)
    .filter((item) => item.favorite || item.roles.includes(today.choice?.slot ?? 'dinner'))
    .slice(0, 5);

  return (
    <section className="mb-page mb-today" aria-labelledby="today-heading">
      <header className="mb-page-header">
        <div>
          <h1 id="today-heading">Today’s recipe</h1>
          <p>{today.reason || 'One clear next step for the food you want to make.'}</p>
        </div>
        <label className="mb-slot-select">
          <span>Meal</span>
          <select
            value={today.choice?.slot ?? 'dinner'}
            onChange={(event) =>
              dispatch({ type: 'SET_TODAY_SLOT', slot: event.target.value as MealType })
            }
          >
            {mealTypes.map((slot) => (
              <option key={slot} value={slot}>
                {humanRole(slot)}
              </option>
            ))}
          </select>
        </label>
      </header>
      {!recipe ? (
        <section className="mb-empty mb-empty--today">
          <ChefHat size={31} aria-hidden="true" />
          <h2>Choose a recipe for today</h2>
          <p>Your saved recipes are ready when you are. Planning a whole week is optional.</p>
          <div>
            <LabelledButton onClick={() => dispatch({ type: 'NAVIGATE', page: 'recipes' })}>
              Browse recipe book
            </LabelledButton>
            <LabelledButton
              className="mb-button--quiet"
              onClick={() => dispatch({ type: 'NAVIGATE', page: 'week' })}
            >
              Plan my week
            </LabelledButton>
          </div>
        </section>
      ) : (
        <div className="mb-today-grid">
          <article className="mb-today-card">
            <RecipeVisual recipe={recipe} large />
            <div className={`mb-state-band mb-state-band--${today.status}`}>
              <span>{cardState}</span>
              <b>{portionText}</b>
            </div>
            <div className="mb-today-card__copy">
              <h2>{recipe.name}</h2>
              {today.status === 'ready' && today.batch?.storage === 'freezer' ? (
                <p className="mb-callout">
                  Frozen portions need their saved defrost or reheat context before eating.
                </p>
              ) : null}
              {today.status === 'uncooked' && recipe.baseServings === null ? (
                <p className="mb-callout">
                  Yield is missing. You can read the source or confirm it when you start cooking.
                </p>
              ) : null}
              <p className="mb-today-time">
                {cookTime(recipe, model.state.experience?.recipeProfiles[recipe.id]) ??
                  'Cooking time not confirmed'}
              </p>
              {todayFacts.length > 0 && (
                <div className="mb-facts mb-facts--large">
                  {todayFacts.map((fact) => (
                    <span key={fact.label}>
                      {fact.value}
                      <small>{todayNutritionLabel}</small>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="mb-today-card__actions">
              {today.status === 'ready' && today.batch && today.availableUnits > 0 ? (
                <LabelledButton
                  onClick={() =>
                    dispatch({
                      type: 'EAT_OPEN',
                      batchId: today.batch!.id,
                      units: today.use?.portions,
                      useId: today.use?.id ?? undefined,
                    })
                  }
                >
                  Have a portion
                </LabelledButton>
              ) : null}
              {today.status === 'ready' && today.batch && today.availableUnits <= 0 ? (
                <>
                  <LabelledButton onClick={() => dispatch({ type: 'NEXT_MEAL' })}>
                    Choose next meal
                  </LabelledButton>
                  <LabelledButton className="mb-button--quiet" onClick={startCooking}>
                    Cook another
                  </LabelledButton>
                </>
              ) : null}
              {today.status === 'cooking' ? (
                <LabelledButton
                  onClick={() =>
                    dispatch({
                      type: 'START_COOK',
                      recipeId: recipe.id,
                      sourceServings: plannedSourceServings,
                      weekId: model.week?.id,
                      choiceId: today.choice?.id,
                      extraBatch: today.status === 'ready' && today.availableUnits <= 0,
                    })
                  }
                >
                  Resume cooking
                </LabelledButton>
              ) : null}
              {today.status === 'uncooked' ||
              (today.status === 'ready' && today.availableUnits <= 0) ? (
                <LabelledButton onClick={startCooking}>
                  <ChefHat size={17} /> Start cooking
                </LabelledButton>
              ) : null}
              {today.status === 'eaten' ? (
                <>
                  <LabelledButton onClick={() => dispatch({ type: 'NEXT_MEAL' })}>
                    Choose next meal
                  </LabelledButton>
                  {today.batch && today.availableUnits > 0 && (
                    <LabelledButton
                      className="mb-button--quiet"
                      onClick={() => dispatch({ type: 'EAT_OPEN', batchId: today.batch!.id })}
                    >
                      Have another portion
                    </LabelledButton>
                  )}
                </>
              ) : null}
              <div className="mb-inline-actions">
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'OPEN_RECIPE', recipeId: recipe.id, batchId: today.batch?.id })
                  }
                >
                  View recipe
                </button>
                {today.status !== 'ready' && (
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        ...(today.use
                          ? { type: 'NAVIGATE' as const, page: 'shopping' as const }
                          : {
                              type: 'SHOP_RECIPE' as const,
                              recipeId: recipe.id,
                              sourceServings: plannedSourceServings,
                            }),
                      })
                    }
                  >
                    Shop this meal
                  </button>
                )}
                <button type="button" onClick={() => setChooserOpen((value) => !value)}>
                  {chooserOpen ? 'Close choices' : 'Choose another meal'}
                </button>
              </div>
            </div>
          </article>
          <aside className="mb-support-rail" aria-label="Today support">
            <section>
              <h2>Ready for later</h2>
              {readyBatches.length ? (
                <ul className="mb-ready-list">
                  {readyBatches.slice(0, 4).map((batch) => (
                    <li key={batch.id}>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: 'CHOOSE_TODAY',
                            recipeId: batch.recipeId,
                            batchId: batch.id,
                          })
                        }
                      >
                        <span>{batch.recipeSnapshot.name}</span>
                        <b>
                          {displayNumber(remaining(batch))} {batch.yieldUnit}
                          {batch.storage === 'freezer' ? ' · frozen' : ''}
                        </b>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No other prepared portions are available right now.</p>
              )}
            </section>
            <section>
              <h2>Next cooking time</h2>
              {model.week?.windows.length ? (
                <ul className="mb-window-list">
                  {model.week.windows.slice(0, 2).map((window) => (
                    <li key={window.id}>
                      <strong>{window.date}</strong>
                      <span>
                        {window.startTime} · {displayNumber(window.availableMinutes, 0)} min
                        available
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Set a real cooking window before asking for a time-fit plan.</p>
              )}
              <LabelledButton
                className="mb-button--quiet"
                onClick={() => dispatch({ type: 'NAVIGATE', page: 'week' })}
              >
                Open my week
              </LabelledButton>
            </section>
          </aside>
          {chooserOpen && (
            <section className="mb-choice-tray" aria-label="Choose another meal">
              <header>
                <h2>Choose another meal</h2>
                <button
                  type="button"
                  className="mb-icon-button"
                  onClick={() => setChooserOpen(false)}
                  aria-label="Close meal choices"
                >
                  <X size={18} />
                </button>
              </header>
              {firstChoices.length ? (
                <div className="mb-choice-tray__list">
                  {firstChoices.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'CHOOSE_TODAY', recipeId: item.id });
                        setChooserOpen(false);
                      }}
                    >
                      <strong>{item.name}</strong>
                      <span>
                        {item.favorite
                          ? 'Favorite'
                          : item.roles.map(humanRole).join(', ') || 'Saved recipe'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p>Save another recipe to choose it here.</p>
              )}
            </section>
          )}
        </div>
      )}
      {startPrompt && recipe && (
        <StartCookDialog
          recipe={recipe}
          sourceServings={plannedSourceServings}
          context={{ weekId: model.week?.id, choiceId: today.choice?.id }}
          dispatch={dispatch}
          onClose={() => setStartPrompt(false)}
        />
      )}
    </section>
  );
}

function timerRemaining(timer: CookingTimer, now: number): number {
  if (timer.endsAt === null) return timer.remainingSeconds;
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

function timerLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function highlightOriginalQuantities(step: string, scaled: boolean): ReactNode {
  if (!scaled) return step;
  const parts = step.split(/(\b\d+(?:[./]\d+)?\b)/g);
  return parts.map((part, index) =>
    /\b\d+(?:[./]\d+)?\b/.test(part) ? (
      <mark key={`${part}-${index}`} title="Source quantity to check">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function TimerAddDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (timer: CookingTimer) => void;
}) {
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const durationSeconds = Math.round(numberFrom(minutes, 0) * 60);
    if (!label.trim() || durationSeconds <= 0) return;
    onAdd({
      id: makeId('timer'),
      label: label.trim(),
      durationSeconds,
      endsAt: Date.now() + durationSeconds * 1000,
      remainingSeconds: durationSeconds,
    });
    onClose();
  };
  return (
    <AppDialog open onClose={onClose} labelledBy="add-timer-title">
      <form className="mb-dialog__surface" onSubmit={submit}>
        <header>
          <h2 id="add-timer-title">Add a timer</h2>
          <button type="button" className="mb-icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        <p>
          Enter a duration from the recipe source or one you deliberately choose. Mealbook does not
          estimate a timer.
        </p>
        <label className="mb-field">
          <span>Timer label</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Bake"
            required
          />
        </label>
        <label className="mb-field">
          <span>Minutes</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            inputMode="decimal"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            required
          />
        </label>
        <footer>
          <LabelledButton className="mb-button--quiet" onClick={onClose}>
            Cancel
          </LabelledButton>
          <LabelledButton type="submit">Start timer</LabelledButton>
        </footer>
      </form>
    </AppDialog>
  );
}

/** Wall-clock minutes since the cook started, rounded to 5; empty when implausible (e.g. a session left open overnight). */
function measuredMinutes(startedAt: string): string {
  const minutes = (Date.now() - Date.parse(startedAt)) / 60_000;
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 360) return '';
  return String(Math.max(5, Math.round(minutes / 5) * 5));
}

function FinishCookDialog({
  session,
  profile,
  dispatch,
  onClose,
}: {
  session: CookingSession;
  profile: RecipeProfile;
  dispatch: MealbookUIProps['dispatch'];
  onClose: () => void;
}) {
  const [yieldValue, setYieldValue] = useState(String(session.sourceServings));
  const [yieldUnit, setYieldUnit] = useState(profile.yieldUnit || 'recipe serving');
  const [storage, setStorage] = useState<FoodStorage>('unconfirmed');
  const [storageNotes, setStorageNotes] = useState(profile.notes);
  const [reheatNotes, setReheatNotes] = useState(profile.reheatNotes);
  const [preparedSourceServings, setPreparedSourceServings] = useState(
    String(session.sourceServings),
  );
  const [minutesValue, setMinutesValue] = useState(() => measuredMinutes(session.startedAt));
  // Remembering is the default once a time is entered; unticking is the explicit choice.
  const [rememberTiming, setRememberTiming] = useState(true);
  const minutes = Number(minutesValue);
  const minutesValid = minutesValue.trim() !== '' && Number.isFinite(minutes) && minutes > 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      dispatch({
        type: 'FINISH_COOK',
        sessionId: session.id,
        actualYield: numberFrom(yieldValue, session.sourceServings),
        yieldUnit: yieldUnit.trim() || 'recipe serving',
        storage,
        storageNotes: storageNotes.trim(),
        reheatNotes: reheatNotes.trim(),
        preparedSourceServings: numberFrom(preparedSourceServings, session.sourceServings),
        elapsedMinutes: minutesValid ? minutes : null,
        rememberTiming: rememberTiming && minutesValid,
      })
    )
      onClose();
  };
  return (
    <AppDialog open onClose={onClose} labelledBy="finish-cook-title">
      <form className="mb-dialog__surface" onSubmit={submit}>
        <header>
          <h2 id="finish-cook-title">Finish cooking</h2>
          <button type="button" className="mb-icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        <p>Cooking creates ready food. It does not add anything to your food log.</p>
        <div className="mb-two-fields">
          <label className="mb-field">
            <span>How many did you make?</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              inputMode="decimal"
              value={yieldValue}
              onChange={(event) => setYieldValue(event.target.value)}
              required
            />
          </label>
          <label className="mb-field">
            <span>Yield unit</span>
            <input
              value={yieldUnit}
              onChange={(event) => setYieldUnit(event.target.value)}
              placeholder="portions"
              required
            />
          </label>
        </div>
        <label className="mb-field">
          <span>
            How long did it take? <small>Minutes from start to ready food.</small>
          </span>
          <input
            type="number"
            min="1"
            max="1440"
            step="1"
            inputMode="numeric"
            value={minutesValue}
            onChange={(event) => setMinutesValue(event.target.value)}
            placeholder="Leave empty if you're not sure"
          />
        </label>
        <label className="mb-check-row">
          <input
            type="checkbox"
            checked={rememberTiming && minutesValid}
            disabled={!minutesValid}
            onChange={(event) => setRememberTiming(event.target.checked)}
          />
          <span>
            <b>Remember this time for planning</b>
            <small>
              Future weeks can fit {displayNumber(session.sourceServings)} recipe servings into a
              cooking window. A different amount still needs its own time.
            </small>
          </span>
        </label>
        <label className="mb-field">
          <span>Storage now</span>
          <select
            value={storage}
            onChange={(event) => setStorage(event.target.value as FoodStorage)}
          >
            <option value="unconfirmed">Not confirmed</option>
            <option value="fridge">Fridge</option>
            <option value="freezer">Freezer</option>
            <option value="other">Other</option>
          </select>
        </label>
        <details className="mb-detail">
          <summary>Adjust for food lost or a changed batch</summary>
          <label className="mb-field">
            <span>
              Recipe-serving amount made{' '}
              <small>Only change if you lost or made a different amount.</small>
            </span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              inputMode="decimal"
              value={preparedSourceServings}
              onChange={(event) => setPreparedSourceServings(event.target.value)}
            />
          </label>
        </details>
        <details className="mb-detail">
          <summary>Storage and reheat notes</summary>
          <label className="mb-field">
            <span>Storage note</span>
            <textarea
              value={storageNotes}
              onChange={(event) => setStorageNotes(event.target.value)}
              placeholder="Only what you know or choose to note"
            />
          </label>
          <label className="mb-field">
            <span>Reheat or defrost note</span>
            <textarea
              value={reheatNotes}
              onChange={(event) => setReheatNotes(event.target.value)}
              placeholder="Leave empty if no instruction is available"
            />
          </label>
        </details>
        <footer>
          <LabelledButton className="mb-button--quiet" onClick={onClose}>
            Keep cooking
          </LabelledButton>
          <LabelledButton type="submit">
            <Check size={17} /> Confirm ready food
          </LabelledButton>
        </footer>
      </form>
    </AppDialog>
  );
}

function CookSurface({ model, dispatch }: Pick<MealbookUIProps, 'model' | 'dispatch'>) {
  const session = model.cookSession!;
  const recipe = session.recipeSnapshot;
  const profile = profileFor(recipe.id, model.state.experience?.recipeProfiles);
  const [now, setNow] = useState(() => Date.now());
  const [addingTimer, setAddingTimer] = useState(false);
  const [finishing, setFinishing] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  const step = recipe.steps[session.stepIndex] ?? null;
  const scale =
    recipe.baseServings && recipe.baseServings > 0
      ? session.sourceServings / recipe.baseServings
      : null;
  const scaled = scale !== null && Math.abs(scale - 1) > 0.001;
  const update = (
    patch: Partial<Pick<CookingSession, 'stepIndex' | 'checkedIngredientIds' | 'timers'>>,
  ) => dispatch({ type: 'UPDATE_COOK', sessionId: session.id, patch });
  const toggleIngredient = (id: string) =>
    update({
      checkedIngredientIds: session.checkedIngredientIds.includes(id)
        ? session.checkedIngredientIds.filter((value) => value !== id)
        : [...session.checkedIngredientIds, id],
    });
  const toggleTimer = (timer: CookingTimer) => {
    const remaining = timerRemaining(timer, now);
    const next =
      timer.endsAt === null
        ? { ...timer, endsAt: Date.now() + remaining * 1_000, remainingSeconds: remaining }
        : { ...timer, endsAt: null, remainingSeconds: remaining };
    update({ timers: session.timers.map((item) => (item.id === timer.id ? next : item)) });
  };
  return (
    <section className="mb-cook-surface" aria-labelledby="cook-heading">
      <header className="mb-cook-header">
        <div>
          <button
            type="button"
            className="mb-back-button"
            onClick={() => dispatch({ type: 'EXIT_COOK' })}
          >
            <ArrowLeft size={18} /> Back to today
          </button>
          <h1 id="cook-heading">{recipe.name}</h1>
          <p>
            {cookTime(recipe, model.state.experience?.recipeProfiles[recipe.id]) ||
              'Source time not confirmed'}{' '}
            ·{' '}
            {session.sourceServings
              ? `${displayNumber(session.sourceServings)} source servings`
              : 'Source amount to review'}
          </p>
        </div>
        <button
          type="button"
          className="mb-icon-button"
          onClick={() => dispatch({ type: 'EXIT_COOK' })}
          aria-label="Exit cooking mode"
        >
          <X size={20} />
        </button>
        <button type="button" className="mb-link-button" onClick={() => setFinishing(true)}>
          Already made it? Confirm portions
        </button>
      </header>
      <div className="mb-cook-layout">
        <div className="mb-cook-work">
          <section className="mb-cook-step" aria-live="polite">
            <span>
              Step {Math.min(session.stepIndex + 1, Math.max(recipe.steps.length, 1))} of{' '}
              {recipe.steps.length || 0}
            </span>
            <h2>
              {step
                ? highlightOriginalQuantities(step, scaled)
                : 'Review the finished recipe and confirm your actual yield.'}
            </h2>
            {scaled && (
              <p className="mb-source-quantity-note">
                Highlighted numbers are source wording. Check them against the scaled ingredient
                list; cooking times, temperatures, and equipment are not scaled.
              </p>
            )}
            <div className="mb-cook-controls">
              <LabelledButton
                className="mb-button--quiet"
                disabled={session.stepIndex <= 0}
                onClick={() => update({ stepIndex: Math.max(0, session.stepIndex - 1) })}
              >
                <ArrowLeft size={17} /> Previous
              </LabelledButton>
              {session.stepIndex < recipe.steps.length - 1 ? (
                <LabelledButton onClick={() => update({ stepIndex: session.stepIndex + 1 })}>
                  Next <ArrowRight size={17} />
                </LabelledButton>
              ) : (
                <LabelledButton onClick={() => setFinishing(true)}>
                  <Check size={17} /> Finish cooking
                </LabelledButton>
              )}
            </div>
          </section>
          <section className="mb-cook-section">
            <header>
              <div>
                <h2>Ingredients</h2>
                <p>
                  {scale !== null
                    ? `Scaled for ${displayNumber(session.sourceServings)} source servings.`
                    : 'Source amounts remain unscaled until yield is confirmed.'}
                </p>
              </div>
            </header>
            <ul className="mb-cook-ingredients">
              {recipe.ingredients.map((item) => {
                const checked = session.checkedIngredientIds.includes(item.id);
                const amount =
                  scale !== null && item.quantity !== null
                    ? `${displayNumber(item.quantity * scale)}${item.unit ? ` ${item.unit}` : ''}`
                    : item.quantityText;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={checked}
                      className={checked ? 'is-checked' : ''}
                      onClick={() => toggleIngredient(item.id)}
                    >
                      {checked ? (
                        <Check size={18} aria-hidden="true" />
                      ) : (
                        <Circle size={18} aria-hidden="true" />
                      )}
                      <span>
                        {amount && <b>{amount} </b>}
                        {item.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
        <aside className="mb-cook-rail">
          <section>
            <header>
              <h2>Timers</h2>
              <LabelledButton
                className="mb-button--quiet mb-button--small"
                onClick={() => setAddingTimer(true)}
              >
                <Plus size={16} /> Add
              </LabelledButton>
            </header>
            {session.timers.length ? (
              <ul className="mb-timer-list">
                {session.timers.map((timer) => {
                  const remaining = timerRemaining(timer, now);
                  const done = remaining === 0;
                  return (
                    <li key={timer.id}>
                      <div>
                        <strong>{timer.label}</strong>
                        <b className={done ? 'is-done' : ''}>
                          {done ? 'Done' : timerLabel(remaining)}
                        </b>
                      </div>
                      <button type="button" onClick={() => toggleTimer(timer)} disabled={done}>
                        {timer.endsAt === null ? 'Start' : 'Pause'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No recipe timer has been set yet.</p>
            )}
          </section>
          <section>
            <h2>Source & notes</h2>
            <p>
              {recipe.sourceName || 'Personal recipe'}
              {recipe.creatorCredit ? ` · ${recipe.creatorCredit}` : ''}
            </p>
            {recipe.sourceUrl && (
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                Open source <ExternalLink size={14} />
              </a>
            )}
            <p className="mb-quiet">
              Timers persist by their end time. A paused timer keeps its remaining duration.
            </p>
          </section>
        </aside>
      </div>
      {addingTimer && (
        <TimerAddDialog
          onClose={() => setAddingTimer(false)}
          onAdd={(timer) => update({ timers: [...session.timers, timer] })}
        />
      )}
      {finishing && (
        <FinishCookDialog
          session={session}
          profile={profile}
          dispatch={dispatch}
          onClose={() => setFinishing(false)}
        />
      )}
    </section>
  );
}

function nextWeekStart(start: string, days: number) {
  const date = new Date(`${start}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function WeekRequestForm({
  model,
  dispatch,
  newWeek = false,
}: Pick<MealbookUIProps, 'model' | 'dispatch'> & { newWeek?: boolean }) {
  const saved = model.state.experience?.lastPlanRequest;
  const [useBookFilters, setUseBookFilters] = useState(false);
  const [request, setRequest] = useState<BatchPlanRequest>(() =>
    saved
      ? {
          ...saved,
          ...(newWeek
            ? {
                weekStart:
                  model.date > (model.week?.weekStart ?? '')
                    ? model.date
                    : nextWeekStart(model.week?.weekStart ?? model.date, model.week?.days ?? 7),
                windows: [],
              }
            : {}),
        }
      : {
          weekStart: model.date || localDate(),
          days: 7,
          people: 1,
          slots: ['lunch', 'dinner'],
          distinctRecipes: 3,
          targetPortions: 10,
          windows: [],
          filters: {
            ...model.filters,
            search: '',
            role: 'all',
            tags: [],
            categories: [],
            includeIngredients: [],
            excludeIngredients: [],
            favoriteOnly: false,
            minMealPrep: undefined,
            ranges: {},
          },
          strictTiming: false,
          reuseReady: true,
          reuseOneOffs: true,
        },
  );
  const [advanced, setAdvanced] = useState(false);
  const patch = (changes: Partial<BatchPlanRequest>) =>
    setRequest((current) => ({ ...current, ...changes }));
  const toggleSlot = (slot: MealType) =>
    patch({
      slots: request.slots.includes(slot)
        ? request.slots.filter((value) => value !== slot)
        : [...request.slots, slot],
    });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    dispatch({
      type: 'MAKE_WEEK',
      request: { ...request, filters: useBookFilters ? model.filters : request.filters },
    });
  };
  return (
    <section className="mb-week-builder" aria-labelledby="build-week-heading">
      <header>
        <h1 id="build-week-heading">Make a week that fits</h1>
        <p>
          Start with time you can actually use, then choose useful portions. The defaults below are
          editable, not a record of your routine.
        </p>
      </header>
      <form onSubmit={submit}>
        <div className="mb-week-essentials">
          <label className="mb-field">
            <span>Useful portions</span>
            <input
              type="number"
              min="1"
              step="1"
              value={request.targetPortions}
              onChange={(event) => patch({ targetPortions: numberFrom(event.target.value, 10) })}
            />
          </label>
          <label className="mb-field">
            <span>Recipes to cook</span>
            <input
              type="number"
              min="1"
              step="1"
              value={request.distinctRecipes}
              onChange={(event) => patch({ distinctRecipes: numberFrom(event.target.value, 3) })}
            />
          </label>
        </div>
        <section className="mb-window-section">
          <div>
            <h2>When can you cook?</h2>
            <p>Only add times you want this plan to respect.</p>
          </div>
          {request.windows.length ? (
            <ul className="mb-window-chips">
              {request.windows.map((window) => (
                <li key={window.id}>
                  <span>
                    {window.date} · {window.startTime} · {displayNumber(window.availableMinutes, 0)}{' '}
                    min
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove window on ${window.date}`}
                    onClick={() =>
                      patch({ windows: request.windows.filter((item) => item.id !== window.id) })
                    }
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-empty-note">
              No cooking time has been assumed. Add at least one real window to ask for a time-fit
              plan.
            </p>
          )}
          <WindowEditor onAdd={(window) => patch({ windows: [...request.windows, window] })} />
        </section>
        <button
          type="button"
          className="mb-disclosure"
          aria-expanded={advanced}
          onClick={() => setAdvanced((value) => !value)}
        >
          {advanced ? 'Hide planning details' : 'Planning details'}
          <ChevronDown size={18} />
        </button>
        {advanced && (
          <div className="mb-advanced-grid">
            <label className="mb-check">
              <input
                type="checkbox"
                checked={useBookFilters}
                onChange={(event) => setUseBookFilters(event.target.checked)}
              />
              Use my current recipe-book filters
            </label>
            <p className="mb-quiet">
              Otherwise, saved planning preferences apply—not your temporary book search.
            </p>
            <label className="mb-field">
              <span>Week starts</span>
              <input
                type="date"
                value={request.weekStart}
                onChange={(event) => patch({ weekStart: event.target.value })}
              />
            </label>
            <label className="mb-field">
              <span>Days</span>
              <input
                type="number"
                min="1"
                max="7"
                value={request.days}
                onChange={(event) => patch({ days: numberFrom(event.target.value, 7) })}
              />
            </label>
            <label className="mb-field">
              <span>People</span>
              <input
                type="number"
                min="1"
                step="1"
                value={request.people}
                onChange={(event) => patch({ people: numberFrom(event.target.value, 1) })}
              />
            </label>
            <fieldset className="mb-fieldset">
              <legend>Meal roles</legend>
              <div className="mb-chip-row">
                {mealTypes.map((slot) => (
                  <button
                    type="button"
                    className={request.slots.includes(slot) ? 'is-active' : ''}
                    aria-pressed={request.slots.includes(slot)}
                    key={slot}
                    onClick={() => toggleSlot(slot)}
                  >
                    {humanRole(slot)}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="mb-check-row">
              <input
                type="checkbox"
                checked={request.strictTiming}
                onChange={(event) => patch({ strictTiming: event.target.checked })}
              />
              <span>
                <b>Only confirmed time fits</b>
                <small>Unknown cooking time will not be treated as zero.</small>
              </span>
            </label>
            <label className="mb-check-row">
              <input
                type="checkbox"
                checked={request.reuseReady}
                onChange={(event) => patch({ reuseReady: event.target.checked })}
              />
              <span>
                <b>Use ready food first</b>
                <small>Available batches can count before new cooking.</small>
              </span>
            </label>
            <label className="mb-check-row">
              <input
                type="checkbox"
                checked={request.reuseOneOffs}
                onChange={(event) => patch({ reuseOneOffs: event.target.checked })}
              />
              <span>
                <b>Include one-off shopping intentions</b>
                <small>Keep existing one-off ingredient work visible.</small>
              </span>
            </label>
            <button
              type="button"
              className="mb-link-button"
              onClick={() => dispatch({ type: 'NAVIGATE', page: 'recipes' })}
            >
              Adjust recipe filters in the book
            </button>
          </div>
        )}
        <footer className="mb-form-footer">
          <p>
            {request.windows.length
              ? 'Mealbook will show whether source timing is confirmed, unknown, or over budget.'
              : 'A flexible draft is allowed. Unknown timing is shown, not treated as a fit.'}
          </p>
          <LabelledButton type="submit" disabled={!request.slots.length}>
            <CalendarDays size={17} /> Make a small proposal
          </LabelledButton>
        </footer>
      </form>
    </section>
  );
}

function RecipePicker({
  recipes,
  excludeId,
  onPick,
  label = 'Find a saved recipe',
}: {
  recipes: Recipe[];
  excludeId?: string;
  onPick: (recipe: Recipe) => void;
  label?: string;
}) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const matches = useMemo(() => {
    const term = deferred.trim().toLocaleLowerCase();
    return recipes
      .filter(
        (recipe) =>
          recipe.id !== excludeId &&
          (!term ||
            `${recipe.name} ${recipe.ingredients.map((item) => item.name).join(' ')}`
              .toLocaleLowerCase()
              .includes(term)),
      )
      .slice(0, 5);
  }, [deferred, excludeId, recipes]);
  return (
    <div className="mb-recipe-picker">
      <label className="mb-search">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">{label}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={label}
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

function SwapControl({
  choice,
  weekId,
  recipes,
  uses,
  dispatch,
}: {
  choice: BatchChoice;
  weekId: string;
  recipes: Recipe[];
  uses: BatchUse[];
  dispatch: MealbookUIProps['dispatch'];
}) {
  const [candidate, setCandidate] = useState<Recipe | null>(null);
  const [scope, setScope] = useState<'batch' | 'meal'>('batch');
  const choiceUses = uses.filter((use) => use.choiceId === choice.id && !use.skipped);
  const targetId = scope === 'batch' ? choice.id : choiceUses[0]?.id;
  return (
    <div className="mb-swap-control">
      <div className="mb-chip-row">
        <button
          type="button"
          className={scope === 'batch' ? 'is-active' : ''}
          aria-pressed={scope === 'batch'}
          onClick={() => setScope('batch')}
        >
          Swap batch
        </button>
        <button
          type="button"
          className={scope === 'meal' ? 'is-active' : ''}
          aria-pressed={scope === 'meal'}
          disabled={!choiceUses.length}
          onClick={() => setScope('meal')}
        >
          Swap one meal
        </button>
      </div>
      <RecipePicker
        recipes={recipes}
        excludeId={choice.recipeId}
        label="Search saved recipes to swap"
        onPick={setCandidate}
      />
      {candidate && (
        <div className="mb-picked-recipe">
          <span>{candidate.name}</span>
          <button
            type="button"
            onClick={() => setCandidate(null)}
            aria-label={`Remove ${candidate.name}`}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <LabelledButton
        className="mb-button--quiet"
        disabled={!candidate || !targetId}
        onClick={() => {
          if (candidate && targetId)
            dispatch({
              type: 'PREVIEW_SWAP',
              request: { scope, weekId, targetId, recipeId: candidate.id },
            });
        }}
      >
        Preview grocery and portion change
      </LabelledButton>
    </div>
  );
}

function WeekPage({ model, dispatch }: Pick<MealbookUIProps, 'model' | 'dispatch'>) {
  const [makingAnother, setMakingAnother] = useState(false);
  const [editingWeekId, setEditingWeekId] = useState(model.week?.id);
  useEffect(() => {
    if (model.week?.id !== editingWeekId) {
      setMakingAnother(false);
      setEditingWeekId(model.week?.id);
    }
  }, [model.week?.id, editingWeekId]);
  const week = model.week;
  const recipesById = useMemo(
    () => new Map(model.state.recipes.map((recipe) => [recipe.id, recipe])),
    [model.state.recipes],
  );
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [swapUseId, setSwapUseId] = useState<string | null>(null);
  if (makingAnother)
    return (
      <section className="mb-page">
        <button type="button" className="mb-link-button" onClick={() => setMakingAnother(false)}>
          Back to this week
        </button>
        <WeekRequestForm model={model} dispatch={dispatch} newWeek />
      </section>
    );
  if (!week)
    return (
      <section className="mb-page mb-week">
        <WeekRequestForm model={model} dispatch={dispatch} />
      </section>
    );
  return (
    <section className="mb-page mb-week" aria-labelledby="week-heading">
      <header className="mb-page-header">
        <div>
          <h1 id="week-heading">My week</h1>
          <p>
            {week.confirmed
              ? 'Your meals and batches are planned. Prepared food stays separate from what you eat.'
              : 'Review the small proposal, then confirm only the choices you want.'}
          </p>
        </div>
        {model.state.experience?.weeks.length && (
          <label className="mb-slot-select">
            <LabelledButton className="mb-button--quiet" onClick={() => setMakingAnother(true)}>
              Plan another week
            </LabelledButton>
            <span>Saved week</span>
            <select
              value={week.id}
              onChange={(event) => dispatch({ type: 'SELECT_WEEK', weekId: event.target.value })}
            >
              {model.state.experience.weeks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label || item.weekStart}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <div className="mb-week-summary">
        <strong>
          {week.choices.reduce((total, choice) => total + choice.portions, 0)} planned portions
        </strong>
        <span>
          {week.choices.length} batch choice{week.choices.length === 1 ? '' : 's'} ·{' '}
          {week.windows.length} real cooking window{week.windows.length === 1 ? '' : 's'}
        </span>
      </div>
      <section className="mb-batch-list" aria-label="Batch choices">
        {week.choices.map((choice) => {
          const recipe =
            model.state.experience?.batches.find((batch) => batch.id === choice.readyBatchId)
              ?.recipeSnapshot ?? recipesById.get(choice.recipeId);
          const timing = choice.readyBatchId
            ? choice.reuseReady
              ? 'Already prepared · no recook'
              : 'Batch cooked'
            : choice.timingFit === 'confirmed'
              ? `Fits a confirmed window · ${displayNumber(
                  profileFor(choice.recipeId, model.state.experience?.recipeProfiles)
                    .elapsedMinutes ?? 0,
                )} min`
              : choice.timingFit === 'over_budget'
                ? 'Over the selected window'
                : 'Timing needs confirmation';
          return (
            <article className="mb-batch-card" key={choice.id}>
              <div className="mb-batch-card__head">
                <div>
                  <span className={`mb-fit-status is-${choice.timingFit}`}>{timing}</span>
                  <h2>{recipe?.name ?? 'Saved recipe unavailable'}</h2>
                  {recipe && (
                    <button
                      type="button"
                      className="mb-link-button"
                      onClick={() =>
                        dispatch({
                          type: 'OPEN_RECIPE',
                          recipeId: recipe.id,
                          batchId: choice.readyBatchId ?? undefined,
                        })
                      }
                    >
                      View recipe
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="mb-lock-button"
                  aria-pressed={choice.locked}
                  onClick={() =>
                    dispatch({ type: 'LOCK_CHOICE', choiceId: choice.id, locked: !choice.locked })
                  }
                >
                  {choice.locked ? <Lock size={16} /> : <LockOpen size={16} />}
                  {choice.locked ? 'Locked' : 'Open'}
                </button>
              </div>
              <div className="mb-batch-card__facts">
                <label className="mb-field">
                  <span>Planned portions</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={choice.portions}
                    disabled={choice.locked}
                    onChange={(event) => {
                      const portions = Number(event.target.value);
                      if (Number.isFinite(portions) && portions > 0)
                        dispatch({ type: 'CHANGE_PORTIONS', choiceId: choice.id, portions });
                    }}
                  />
                </label>
                <p>
                  <b>{displayNumber(choice.sourceServings)} recipe servings to make</b>
                  {choice.readyBatchId ? ' · Uses ready food' : ''}
                </p>
              </div>
              {choice.explanations.length > 0 && (
                <details className="mb-detail">
                  <summary>Why this recipe &amp; details to check</summary>
                  <ul className="mb-explanations">
                    {choice.explanations.map((explanation) => (
                      <li key={explanation}>{explanation}</li>
                    ))}
                  </ul>
                </details>
              )}{' '}
              {recipe && !choice.readyBatchId && (
                <LabelledButton
                  className="mb-button--quiet"
                  onClick={() =>
                    recipe.baseServings === null
                      ? dispatch({ type: 'OPEN_RECIPE', recipeId: recipe.id, intent: 'cook' })
                      : dispatch({
                          type: 'START_COOK',
                          recipeId: recipe.id,
                          sourceServings: choice.sourceServings,
                          weekId: week.id,
                          choiceId: choice.id,
                        })
                  }
                >
                  Cook this batch
                </LabelledButton>
              )}{' '}
              {!choice.locked && (
                <details className="mb-detail">
                  <summary>Change this choice</summary>
                  <SwapControl
                    choice={choice}
                    weekId={week.id}
                    recipes={model.state.recipes}
                    uses={week.uses}
                    dispatch={dispatch}
                  />
                </details>
              )}
            </article>
          );
        })}
      </section>
      <footer className="mb-week-actions">
        <div>
          <LabelledButton
            className="mb-button--quiet"
            onClick={() => dispatch({ type: 'REROLL_WEEK' })}
            disabled={week.choices.every((choice) => choice.locked)}
          >
            Refresh unlocked choices
          </LabelledButton>
          <button
            type="button"
            className="mb-disclosure"
            aria-expanded={scheduleOpen}
            onClick={() => setScheduleOpen((value) => !value)}
          >
            Schedule <ChevronDown size={18} />
          </button>
        </div>
        <LabelledButton
          onClick={() => dispatch({ type: 'CONFIRM_WEEK' })}
          disabled={week.confirmed}
        >
          {' '}
          {week.confirmed ? 'Week confirmed' : 'Confirm my week'}{' '}
        </LabelledButton>
      </footer>
      {scheduleOpen && (
        <section className="mb-schedule" aria-label="Schedule and windows">
          <h2>When you’ll eat</h2>
          <p>Move or skip a planned use without pretending food was eaten.</p>
          <div className="mb-schedule-grid">
            {week.uses.map((use) => {
              const choice = week.choices.find((item) => item.id === use.choiceId);
              const recipe = choice ? recipesById.get(choice.recipeId) : null;
              return (
                <article key={use.id}>
                  <h3>{recipe?.name ?? 'Saved recipe'}</h3>
                  <p>
                    {use.date} · {humanRole(use.slot)} · {displayNumber(use.portions)} portions
                  </p>
                  <div>
                    <label className="mb-field">
                      <span>Move to date</span>
                      <input
                        type="date"
                        value={use.date}
                        onChange={(event) =>
                          dispatch({
                            type: 'MOVE_USE',
                            useId: use.id,
                            date: event.target.value,
                            slot: use.slot,
                          })
                        }
                      />
                    </label>
                    <label className="mb-field">
                      <span>Meal</span>
                      <select
                        value={use.slot}
                        onChange={(event) =>
                          dispatch({
                            type: 'MOVE_USE',
                            useId: use.id,
                            date: use.date,
                            slot: event.target.value as MealType,
                          })
                        }
                      >
                        {mealTypes.map((slot) => (
                          <option key={slot} value={slot}>
                            {humanRole(slot)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <LabelledButton
                    className="mb-button--quiet"
                    onClick={() =>
                      dispatch({ type: 'SKIP_USE', useId: use.id, skipped: !use.skipped })
                    }
                  >
                    {use.skipped ? 'Put back in week' : 'Skip this meal'}
                  </LabelledButton>
                  <LabelledButton className="mb-button--quiet" onClick={() => setSwapUseId(use.id)}>
                    Replace this meal
                  </LabelledButton>
                </article>
              );
            })}
          </div>
          <h3>Cooking windows</h3>
          <div className="mb-window-list mb-window-list--editable">
            {week.windows.map((window) => (
              <label key={window.id}>
                <span>
                  {window.date} · {window.startTime}
                </span>
                <input
                  type="number"
                  min="1"
                  value={window.availableMinutes}
                  onChange={(event) =>
                    dispatch({
                      type: 'MOVE_WINDOW',
                      windowId: window.id,
                      date: window.date,
                      startTime: window.startTime,
                      availableMinutes: numberFrom(event.target.value, window.availableMinutes),
                    })
                  }
                  aria-label={`Minutes available on ${window.date}`}
                />
                <small>minutes</small>
              </label>
            ))}
          </div>
        </section>
      )}
      {swapUseId && (
        <AppDialog open onClose={() => setSwapUseId(null)} labelledBy="replace-meal-title">
          <section className="mb-dialog__surface">
            <h2 id="replace-meal-title">Choose a recipe for this meal</h2>
            <RecipePicker
              recipes={model.state.recipes}
              label="Search recipes for this meal"
              onPick={(recipe) => {
                if (
                  dispatch({
                    type: 'PREVIEW_SWAP',
                    request: {
                      scope: 'meal',
                      weekId: week.id,
                      targetId: swapUseId,
                      recipeId: recipe.id,
                    },
                  })
                )
                  setSwapUseId(null);
              }}
            />
            <LabelledButton className="mb-button--quiet" onClick={() => setSwapUseId(null)}>
              Cancel
            </LabelledButton>
          </section>
        </AppDialog>
      )}
      {model.swapPreview && (
        <SwapPreviewDialog model={model} preview={model.swapPreview} dispatch={dispatch} />
      )}
    </section>
  );
}

function SwapPreviewDialog({
  model,
  preview,
  dispatch,
}: {
  model: MealbookUIProps['model'];
  preview: NonNullable<MealbookUIProps['model']['swapPreview']>;
  dispatch: MealbookUIProps['dispatch'];
}) {
  const previousUse = model.week?.uses.find((use) => use.id === preview.request.targetId);
  const previousChoice = model.week?.choices.find(
    (choice) =>
      choice.id ===
      (preview.request.scope === 'batch' ? preview.request.targetId : previousUse?.choiceId),
  );
  const previousName =
    model.state.recipes.find((recipe) => recipe.id === previousChoice?.recipeId)?.name ??
    'Current recipe';
  const replacement = model.state.recipes.find((recipe) => recipe.id === preview.request.recipeId);
  return (
    <AppDialog
      open
      onClose={() => dispatch({ type: 'CANCEL_SWAP' })}
      labelledBy="swap-preview-title"
    >
      <section className="mb-dialog__surface">
        <header>
          <h2 id="swap-preview-title">Review this swap</h2>
          <button
            type="button"
            className="mb-icon-button"
            onClick={() => dispatch({ type: 'CANCEL_SWAP' })}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </header>
        <p>
          {preview.request.scope === 'batch'
            ? 'This uncooked batch will change.'
            : 'This planned meal will change.'}{' '}
          Review the actual portion and shopping changes before applying it.
        </p>
        <p className="mb-swap-recipes">
          <strong>{previousName}</strong>
          <ArrowRight size={18} />
          <strong>{replacement?.name ?? 'Replacement'}</strong>
        </p>
        {preview.changes.length === 0 && (
          <p className="mb-quiet">
            No known grocery quantities change. Uncertain amounts still need review.
          </p>
        )}
        <ul className="mb-change-list">
          {preview.changes.map((change) => (
            <li key={`${change.name}-${change.before}`}>
              <strong>{change.name}</strong>
              <span>{change.before}</span>
              <ArrowRight size={15} aria-hidden="true" />
              <b>{change.after}</b>
            </li>
          ))}
        </ul>
        <footer>
          <LabelledButton
            className="mb-button--quiet"
            onClick={() => dispatch({ type: 'CANCEL_SWAP' })}
          >
            Keep current choice
          </LabelledButton>
          <LabelledButton onClick={() => dispatch({ type: 'APPLY_SWAP' })}>
            Apply swap
          </LabelledButton>
        </footer>
      </section>
    </AppDialog>
  );
}

function ShopLine({
  item,
  dispatch,
}: {
  item: PurchaseItem;
  dispatch: MealbookUIProps['dispatch'];
}) {
  const [details, setDetails] = useState(false);
  const [quantity, setQuantity] = useState(
    item.remainingQuantity === null ? '' : String(item.remainingQuantity),
  );
  const [aisle, setAisle] = useState(item.aisle);
  const quantityValue = quantity.trim() === '' ? undefined : Number(quantity);
  return (
    <article className={`mb-shop-line ${item.covered ? 'is-covered' : ''}`}>
      <label className="mb-shop-check">
        <input
          type="checkbox"
          checked={item.covered}
          onChange={(event) =>
            dispatch({
              type: 'COVER_ITEM',
              itemKey: item.key,
              kind: event.target.checked ? 'bought' : 'clear',
            })
          }
        />
        <span>{item.covered ? <Check size={15} aria-hidden="true" /> : null}</span>
        <div>
          <strong>
            {item.covered
              ? ''
              : item.remainingQuantity !== null
                ? `${displayNumber(item.remainingQuantity)} ${item.unit && item.unit !== 'count' ? item.unit : ''} `
                : ''}
            {item.name}
          </strong>
          <small>{item.remainingText || (item.covered ? 'Covered' : 'Quantity to review')}</small>
          {item.displayQuantity && !item.covered && (
            <small>
              {item.needsReview
                ? `${item.displayQuantity} recorded; review full amounts`
                : `${item.displayQuantity} total for the recipes`}
            </small>
          )}
          {item.changedFrom && (
            <small className="mb-change-note">Changed from {item.changedFrom}</small>
          )}
        </div>
      </label>
      <div className="mb-shop-line__actions">
        <button type="button" onClick={() => setDetails((value) => !value)} aria-expanded={details}>
          {details ? 'Hide' : 'Details'}
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'COVER_ITEM',
              itemKey: item.key,
              kind: 'owned',
              ...(quantityValue !== undefined && Number.isFinite(quantityValue)
                ? { quantity: quantityValue }
                : {}),
            })
          }
        >
          Have it
        </button>
      </div>
      {details && (
        <div className="mb-shop-line__details">
          <p>
            {item.needsReview
              ? 'This amount or unit needs review before it can be combined safely.'
              : 'Compatible amounts are combined only where the model can support it.'}
          </p>
          {item.notes.map((note) => (
            <p key={note} className="mb-quiet">
              {note}
            </p>
          ))}
          <ul>
            {item.contributions.map((contribution) => (
              <li key={`${contribution.intentionId}-${contribution.recipeId}`}>
                <strong>{contribution.recipeName}</strong>
                <span>
                  {contribution.quantity === null
                    ? contribution.sourceText || 'Amount to review'
                    : `${displayNumber(contribution.quantity)} ${item.unit ?? ''}`}{' '}
                  {contribution.prepNote ? `· ${contribution.prepNote}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <div className="mb-shop-advanced">
            <label className="mb-field">
              <span>Partial amount on hand or bought</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <div>
              <LabelledButton
                className="mb-button--quiet"
                onClick={() =>
                  dispatch({
                    type: 'COVER_ITEM',
                    itemKey: item.key,
                    kind: 'owned',
                    ...(quantityValue !== undefined && Number.isFinite(quantityValue)
                      ? { quantity: quantityValue }
                      : {}),
                  })
                }
              >
                Save owned amount
              </LabelledButton>
              <LabelledButton
                className="mb-button--quiet"
                onClick={() =>
                  dispatch({
                    type: 'COVER_ITEM',
                    itemKey: item.key,
                    kind: 'bought',
                    ...(quantityValue !== undefined && Number.isFinite(quantityValue)
                      ? { quantity: quantityValue }
                      : {}),
                  })
                }
              >
                Save bought amount
              </LabelledButton>
            </div>
            <label className="mb-field">
              <span>Aisle</span>
              <input value={aisle} onChange={(event) => setAisle(event.target.value)} />
            </label>
            <LabelledButton
              className="mb-button--quiet"
              onClick={() =>
                dispatch({ type: 'SET_AISLE', itemKey: item.key, aisle: aisle.trim() })
              }
            >
              Save aisle
            </LabelledButton>
          </div>
        </div>
      )}
    </article>
  );
}

function ManualShop({
  items,
  dispatch,
}: {
  items: MealbookUIProps['model']['manualItems'];
  dispatch: MealbookUIProps['dispatch'];
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (dispatch({ type: 'ADD_MANUAL_ITEM', name: name.trim(), quantityText: quantity.trim() })) {
      setName('');
      setQuantity('');
    }
  };
  return (
    <section className="mb-manual-shop">
      <h2>Add an item</h2>
      <form onSubmit={submit}>
        <label className="mb-field">
          <span>Item</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="mb-field">
          <span>Amount or note</span>
          <input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Optional"
          />
        </label>
        <LabelledButton type="submit" className="mb-button--quiet">
          Add
        </LabelledButton>
      </form>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => dispatch({ type: 'TOGGLE_MANUAL_ITEM', id: item.id })}
                />{' '}
                <span>
                  {item.quantityText ? `${item.quantityText} ` : ''}
                  {item.name}
                </span>
              </label>
              <button
                type="button"
                onClick={() => dispatch({ type: 'REMOVE_MANUAL_ITEM', id: item.id })}
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ShoppingPage({ model, dispatch }: Pick<MealbookUIProps, 'model' | 'dispatch'>) {
  const grouped = useMemo(
    () =>
      model.shopping.items.reduce<Record<string, PurchaseItem[]>>((groups, item) => {
        const aisle = item.aisle || 'Review';
        (groups[aisle] ??= []).push(item);
        return groups;
      }, {}),
    [model.shopping.items],
  );
  const [matchesOpen, setMatchesOpen] = useState(false);
  return (
    <section className="mb-page mb-shop" aria-labelledby="shop-heading">
      <header className="mb-page-header">
        <div>
          <h1 id="shop-heading">Shop</h1>
          <p>
            Buy ingredients that support the meals you chose, with shared uses visible before
            checkout.
          </p>
        </div>
      </header>
      {model.shopping.items.length === 0 && model.manualItems.length === 0 ? (
        <section className="mb-empty">
          <ShoppingBasket size={32} aria-hidden="true" />
          <h2>Nothing to shop yet</h2>
          <p>
            Shop one saved recipe without building a full week, or start from the cooking time you
            have.
          </p>
          <div>
            <LabelledButton onClick={() => dispatch({ type: 'NAVIGATE', page: 'recipes' })}>
              Shop a recipe
            </LabelledButton>
            <LabelledButton
              className="mb-button--quiet"
              onClick={() => dispatch({ type: 'NAVIGATE', page: 'week' })}
            >
              Plan my week
            </LabelledButton>
          </div>
          <ManualShop items={model.manualItems} dispatch={dispatch} />
        </section>
      ) : (
        <>
          <section className="mb-shop-summary">
            <strong>
              {model.shopping.items.filter((item) => !item.covered).length} item
              {model.shopping.items.filter((item) => !item.covered).length === 1 ? '' : 's'}{' '}
              remaining
            </strong>
            <span>
              {model.week
                ? `${model.week.choices.length} batch choice${model.week.choices.length === 1 ? '' : 's'} in this shopping scope`
                : 'One-off and manual items stay separate from a weekly plan.'}
            </span>
          </section>
          {model.shopping.shared.length > 0 && (
            <section className="mb-shared-payoff">
              <h2>Shared ingredients first</h2>
              <p>
                These lines support more than one recipe or batch. Open a line to see the actual
                contributor arithmetic.
              </p>
              <ul>
                {model.shopping.shared.slice(0, 4).map((item) => (
                  <li key={item.key}>
                    <strong>
                      {item.displayQuantity ? `${item.displayQuantity} ` : ''}
                      {item.name}
                    </strong>
                    <span>{item.contributions.length} contributing recipes</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="mb-shop-groups">
            {Object.entries(grouped)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([aisle, items]) => (
                <section key={aisle}>
                  <h2>{aisle.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')}</h2>
                  {items.map((item) => (
                    <ShopLine key={item.key} item={item} dispatch={dispatch} />
                  ))}
                </section>
              ))}
          </div>
          {model.shopping.matches.length > 0 && (
            <section className="mb-purchase-matches">
              <button
                type="button"
                className="mb-disclosure"
                aria-expanded={matchesOpen}
                onClick={() => setMatchesOpen((value) => !value)}
              >
                Compatible purchase options <ChevronDown size={18} />
              </button>
              {matchesOpen && (
                <div>
                  {model.shopping.matches.map((match) => (
                    <article key={`${match.purchaseName}-${match.names.join('-')}`}>
                      <h2>{match.purchaseName}</h2>
                      <p>{match.names.join(' + ')}</p>
                      <p>{match.prepNote || 'No additional prep note supplied.'}</p>
                      <LabelledButton
                        className="mb-button--quiet"
                        onClick={() =>
                          dispatch({
                            type: 'MATCH_PURCHASE',
                            names: match.names,
                            purchaseName: match.purchaseName,
                            prepNote: match.prepNote,
                          })
                        }
                      >
                        Approve this match
                      </LabelledButton>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {model.shopping.excluded.length > 0 && (
            <details className="mb-detail">
              <summary>Excluded from this shopping list</summary>
              <p>
                Items such as plain water stay out of a normal purchase list unless you manually add
                them.
              </p>
              <ul>
                {model.shopping.excluded.map((item) => (
                  <li key={item.key}>{item.name}</li>
                ))}
              </ul>
            </details>
          )}
          <ManualShop items={model.manualItems} dispatch={dispatch} />
        </>
      )}
    </section>
  );
}

function RecipeDetail({ model, dispatch }: Pick<MealbookUIProps, 'model' | 'dispatch'>) {
  const recipe = model.selectedRecipe;
  const [editing, setEditing] = useState(false);
  const [addToWeek, setAddToWeek] = useState(false);
  const [startPrompt, setStartPrompt] = useState(false);
  const [sourceServings, setSourceServings] = useState(
    recipe?.baseServings ? String(recipe.baseServings) : '',
  );
  const [portions, setPortions] = useState('1');
  useEffect(() => {
    setEditing(false);
    setAddToWeek(model.selectedIntent === 'week');
    setStartPrompt(model.selectedIntent === 'cook' && recipe?.baseServings === null);
    setSourceServings(recipe?.baseServings ? String(recipe.baseServings) : '');
    setPortions(
      recipe?.baseServings
        ? String(
            recipe.baseServings /
              profileFor(recipe.id, model.state.experience?.recipeProfiles).sourceUnitsPerPortion,
          )
        : '1',
    );
    if (recipe && model.selectedIntent === 'cook' && recipe.baseServings !== null)
      dispatch({ type: 'START_COOK', recipeId: recipe.id, sourceServings: recipe.baseServings });
  }, [recipe?.id, model.selectedIntent, model.selectedBatch?.id]);
  if (!recipe) return null;
  const profile = profileFor(recipe.id, model.state.experience?.recipeProfiles);
  const sourceAmount = numberFrom(sourceServings, recipe.baseServings ?? 1);
  const startRecipeCooking = () => {
    if (recipe.baseServings === null) {
      setStartPrompt(true);
      return;
    }
    dispatch({ type: 'START_COOK', recipeId: recipe.id, sourceServings: sourceAmount });
  };
  return (
    <>
      <AppDialog
        open
        onClose={() => dispatch({ type: 'CLOSE_RECIPE' })}
        labelledBy="recipe-detail-title"
        className="mb-recipe-dialog"
      >
        <section className="mb-recipe-detail">
          <header className="mb-recipe-detail__header">
            <div>
              <h2 id="recipe-detail-title">{recipe.name}</h2>
              <p>{recipe.creatorCredit || recipe.sourceName || 'Personal recipe'}</p>
            </div>
            <button
              type="button"
              className="mb-icon-button"
              onClick={() => dispatch({ type: 'CLOSE_RECIPE' })}
              aria-label={`Close ${recipe.name}`}
            >
              <X size={20} />
            </button>
          </header>
          <div className="mb-recipe-detail__scroll">
            <RecipeVisual recipe={recipe} large />
            {model.selectedBatch ? (
              <div className="mb-recipe-detail__actions">
                <p className="mb-callout">
                  Recipe used for this prepared batch ·{' '}
                  {displayNumber(model.selectedBatch.actualYield)} {model.selectedBatch.yieldUnit}{' '}
                  made. Its ingredients and nutrition stay unchanged when you edit your book.
                </p>
                <LabelledButton
                  className="mb-button--quiet"
                  onClick={() => dispatch({ type: 'OPEN_RECIPE', recipeId: recipe.id })}
                >
                  Open current book recipe
                </LabelledButton>
              </div>
            ) : (
              <div className="mb-recipe-detail__actions">
                <LabelledButton
                  className="mb-button--quiet"
                  onClick={() =>
                    dispatch({
                      type: 'UPDATE_RECIPE',
                      recipe: { ...recipe, favorite: !recipe.favorite },
                    })
                  }
                >
                  <Heart size={17} fill={recipe.favorite ? 'currentColor' : 'none'} />{' '}
                  {recipe.favorite ? 'Favorite' : 'Save favorite'}
                </LabelledButton>
                <LabelledButton onClick={startRecipeCooking}>
                  <ChefHat size={17} /> Cook today
                </LabelledButton>
                <LabelledButton
                  className="mb-button--quiet"
                  onClick={() =>
                    dispatch({
                      type: 'SHOP_RECIPE',
                      recipeId: recipe.id,
                      sourceServings: sourceAmount,
                    })
                  }
                >
                  Shop this recipe
                </LabelledButton>
              </div>
            )}
            {editing ? (
              <RecipeEditForm
                recipe={recipe}
                dispatch={dispatch}
                onClose={() => setEditing(false)}
              />
            ) : (
              <>
                <section className="mb-detail-section">
                  <div className="mb-meta-row">
                    {recipe.roles.map(humanRole).join(' · ') || 'No meal role yet'}
                    {recipe.baseServings !== null ? (
                      <span>Makes {displayNumber(recipe.baseServings)}</span>
                    ) : (
                      <span>Yield unknown</span>
                    )}
                    {cookTime(recipe, model.state.experience?.recipeProfiles[recipe.id]) ? (
                      <span>
                        {cookTime(recipe, model.state.experience?.recipeProfiles[recipe.id])}
                      </span>
                    ) : null}
                  </div>
                  <div className="mb-chip-row">
                    {recipe.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </section>
                <section className="mb-detail-section">
                  <header>
                    <h3>Ingredients</h3>
                    <label className="mb-field mb-serving-field">
                      <span>Preview source servings</span>
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={sourceServings}
                        onChange={(event) => setSourceServings(event.target.value)}
                        placeholder="Unknown"
                      />
                    </label>
                  </header>
                  {recipe.baseServings === null && (
                    <p className="mb-callout">
                      The source yield is unknown. Ingredient quantities stay source-based until you
                      confirm it.
                    </p>
                  )}
                  <ul className="mb-ingredient-list">
                    {recipe.ingredients.map((item) => {
                      const scale = recipe.baseServings ? sourceAmount / recipe.baseServings : null;
                      const amount =
                        scale !== null && item.quantity !== null
                          ? `${displayNumber(item.quantity * scale)}${item.unit ? ` ${item.unit}` : ''}`
                          : item.quantityText;
                      return (
                        <li key={item.id}>
                          {amount && <b>{amount} </b>}
                          {item.name}
                        </li>
                      );
                    })}
                  </ul>
                </section>
                <section className="mb-detail-section">
                  <h3>Method</h3>
                  {recipe.steps.length ? (
                    <ol className="mb-method-list">
                      {recipe.steps.map((step, index) => (
                        <li key={`${index}-${step}`}>{step}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mb-quiet">No cooking method has been saved yet.</p>
                  )}
                </section>
                <section className="mb-detail-section">
                  <h3>Nutrition</h3>
                  {macroFacts(recipe).length ? (
                    <div className="mb-facts mb-facts--large">
                      {macroFacts(recipe).map((fact) => (
                        <span key={fact.label}>
                          {fact.value}
                          <small>published source serving</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-quiet">No confirmed per-serving nutrition is available.</p>
                  )}
                  <details className="mb-detail">
                    <summary>Reported nutrition and basis</summary>
                    <p>Basis: {recipe.nutritionBasis.replace('_', ' ')}</p>
                    <p>
                      Calories:{' '}
                      {recipe.reportedNutrition.calories === null
                        ? 'Unknown'
                        : `${displayNumber(recipe.reportedNutrition.calories)} kcal`}{' '}
                      · Protein:{' '}
                      {recipe.reportedNutrition.protein === null
                        ? 'Unknown'
                        : `${displayNumber(recipe.reportedNutrition.protein)} g`}
                    </p>
                    {recipe.nutritionEvidence && <p>{recipe.nutritionEvidence}</p>}
                  </details>
                </section>
                <details className="mb-detail">
                  <summary>All macros &amp; meal-prep notes</summary>
                  <p>
                    {model.selectedBatch
                      ? `Per prepared ${model.selectedBatch.yieldUnit}`
                      : 'Per recipe serving; unknown values stay unknown.'}
                  </p>
                  <dl className="mb-all-macros">
                    {allMacros.map((key) => (
                      <div key={key}>
                        <dt>{macroLabels[key]}</dt>
                        <dd>
                          {(model.selectedBatch?.nutritionPerUnit ?? recipe.nutrition)[key] === null
                            ? 'Unknown'
                            : displayNumber(
                                (model.selectedBatch?.nutritionPerUnit ?? recipe.nutrition)[key]!,
                              )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p>
                    Your prep rating:{' '}
                    {recipe.mealPrepRating === null ? 'Not rated' : `${recipe.mealPrepRating} / 5`}
                  </p>
                  {recipe.mealPrepNotes && <p>{recipe.mealPrepNotes}</p>}
                </details>
                <section className="mb-detail-section">
                  <h3>Source</h3>
                  <p>
                    {recipe.sourceName || 'Personal recipe'}
                    {recipe.creatorCredit ? ` · ${recipe.creatorCredit}` : ''}
                  </p>
                  {recipe.sourceUrl && (
                    <a
                      className="mb-source-link"
                      href={recipe.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open original source <ExternalLink size={15} />
                    </a>
                  )}
                  {recipe.sourceEvidence && (
                    <details className="mb-detail">
                      <summary>Original written source evidence</summary>
                      <p>{recipe.sourceEvidence.description}</p>
                    </details>
                  )}
                </section>
                {!model.selectedBatch && (
                  <details className="mb-detail">
                    <summary>Personal cooking profile</summary>
                    <RecipeProfileForm recipe={recipe} profile={profile} dispatch={dispatch} />
                  </details>
                )}
                {recipe.dataGaps.length > 0 && (
                  <details className="mb-detail">
                    <summary>Source details still missing</summary>
                    <ul>
                      {recipe.dataGaps.map((gap) => (
                        <li key={gap}>{gap}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {!model.selectedBatch && (
                  <section className="mb-detail-section">
                    <button
                      type="button"
                      className="mb-disclosure"
                      aria-expanded={addToWeek}
                      onClick={() => setAddToWeek((value) => !value)}
                    >
                      Add to my week <ChevronDown size={18} />
                    </button>
                    {addToWeek && (
                      <div className="mb-add-week">
                        <p>
                          Use this saved recipe directly; you do not need to search the whole book
                          again.
                        </p>
                        <div className="mb-two-fields">
                          <label className="mb-field">
                            <span>Source servings</span>
                            <input
                              type="number"
                              min="0.25"
                              step="0.25"
                              value={sourceServings}
                              onChange={(event) => setSourceServings(event.target.value)}
                            />
                          </label>
                          <label className="mb-field">
                            <span>Planned portions</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={portions}
                              onChange={(event) => setPortions(event.target.value)}
                            />
                          </label>
                        </div>
                        <LabelledButton
                          onClick={() =>
                            dispatch({
                              type: 'ADD_TO_WEEK',
                              recipeId: recipe.id,
                              sourceServings: numberFrom(sourceServings, recipe.baseServings ?? 1),
                              portions: numberFrom(portions, 1),
                            })
                          }
                        >
                          Add to my week
                        </LabelledButton>
                      </div>
                    )}
                  </section>
                )}
                {!model.selectedBatch && (
                  <LabelledButton className="mb-button--quiet" onClick={() => setEditing(true)}>
                    Edit recipe
                  </LabelledButton>
                )}
              </>
            )}
          </div>
        </section>
      </AppDialog>
      {startPrompt && (
        <StartCookDialog
          recipe={recipe}
          sourceServings={sourceAmount}
          context={{}}
          dispatch={dispatch}
          onClose={() => setStartPrompt(false)}
        />
      )}
    </>
  );
}

function SettingsPage({
  model,
  dispatch,
  onRestore,
  onBankImport,
}: Pick<MealbookUIProps, 'model' | 'dispatch' | 'onRestore' | 'onBankImport'>) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'restore' | 'bank' | null>(null);
  const choose = async (event: ChangeEvent<HTMLInputElement>, type: 'restore' | 'bank') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(type);
    setMessage('');
    try {
      if (type === 'restore') await onRestore(file);
      else await onBankImport(file);
      setMessage(
        type === 'restore'
          ? 'Backup restored on this device.'
          : 'Recipe bank merged into this device.',
      );
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'The file could not be processed.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="mb-page mb-settings" aria-labelledby="settings-heading">
      <header className="mb-page-header">
        <div>
          <h1 id="settings-heading">Settings & backup</h1>
          <p>Mealbook stays personal to this device. There are no accounts or organizations.</p>
        </div>
      </header>
      {message && (
        <p className="mb-notice" role="status">
          {message}
        </p>
      )}
      <section>
        <h2>Food history & goals</h2>
        <p>Review what you actually ate, undo a log, and adjust your calorie and macro targets.</p>
        <LabelledButton onClick={() => dispatch({ type: 'NAVIGATE', page: 'log' })}>
          History & goals
        </LabelledButton>
      </section>
      <section>
        <h2>Backup this device</h2>
        <p>Download a complete local backup before clearing browser data or moving devices.</p>
        <div>
          <LabelledButton onClick={() => dispatch({ type: 'EXPORT_BACKUP' })}>
            Download backup
          </LabelledButton>
          <label
            className={`mb-button mb-button--quiet mb-file-button ${busy ? 'is-disabled' : ''}`}
          >
            Restore backup
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy !== null}
              onChange={(event) => void choose(event, 'restore')}
            />
          </label>
        </div>
      </section>
      <section>
        <h2>Import recipe bank</h2>
        <p>
          Add a structured JSON recipe collection to your book. Existing recipes are only replaced
          after you confirm.
        </p>
        <label className={`mb-button mb-button--quiet mb-file-button ${busy ? 'is-disabled' : ''}`}>
          Choose recipe JSON
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy !== null}
            onChange={(event) => void choose(event, 'bank')}
          />
        </label>
        <p className="mb-quiet">Current book: {model.state.recipes.length} recipes.</p>
      </section>
      <section>
        <h2>Private by default</h2>
        <p>
          Saved recipes, cooking, shopping, and history work locally. New YouTube extraction may use
          a network request only after you choose to preview a source.
        </p>
      </section>
    </section>
  );
}

function ImportPage({
  model,
  dispatch,
  onOpenExistingSource,
}: Pick<MealbookUIProps, 'model' | 'dispatch' | 'onOpenExistingSource'>) {
  return (
    <Suspense
      fallback={
        <section className="mb-page">
          <div className="mb-loading">
            <span>Loading import review…</span>
          </div>
        </section>
      }
    >
      <RecipeImport
        initialUrl={model.initialSharedUrl}
        onBack={() => dispatch({ type: 'NAVIGATE', page: 'recipes' })}
        onOpenExisting={onOpenExistingSource}
        onSaveRecipe={(recipe) => dispatch({ type: 'ADD_RECIPE', recipe })}
        onOpenSaved={(recipe, intent) =>
          dispatch({ type: 'OPEN_RECIPE', recipeId: recipe.id, intent: intent ?? 'view' })
        }
      />
    </Suspense>
  );
}

export function MealbookUI({
  model,
  dispatch,
  onRestore,
  onBankImport,
  onOpenExistingSource,
}: MealbookUIProps) {
  const page = model.page;
  const cookMode = Boolean(model.cookSession);
  return (
    <DialogFeedbackContext.Provider value={{ text: model.notice, isError: model.noticeIsError }}>
      <div className="mealbook-ui">
        <a className="mb-skip-link" href="#mealbook-main">
          Skip to main content
        </a>
        <aside className="mb-rail">
          <button
            type="button"
            className="mb-wordmark"
            onClick={() => dispatch({ type: 'NAVIGATE', page: 'today' })}
          >
            Mealbook
          </button>
          <p>Personal meal book</p>
          <PrimaryNav page={page} dispatch={dispatch} />
          <div className="mb-rail__utility">
            <button
              type="button"
              className={page === 'log' ? 'is-active' : ''}
              onClick={() => dispatch({ type: 'NAVIGATE', page: 'log' })}
            >
              <ListChecks size={17} /> History & goals
            </button>
            <button
              type="button"
              className={page === 'settings' ? 'is-active' : ''}
              onClick={() => dispatch({ type: 'NAVIGATE', page: 'settings' })}
            >
              <Settings size={17} /> Settings & backup
            </button>
            <span>Private to this device</span>
          </div>
        </aside>
        <header className="mb-mobile-header">
          <button
            type="button"
            className="mb-wordmark"
            onClick={() => dispatch({ type: 'NAVIGATE', page: 'today' })}
          >
            Mealbook
          </button>
          <button
            type="button"
            className="mb-icon-button"
            onClick={() => dispatch({ type: 'NAVIGATE', page: 'settings' })}
            aria-label="Open settings"
          >
            <Settings size={20} />
          </button>
        </header>
        <main id="mealbook-main" className="mb-main" tabIndex={-1}>
          {model.persistenceError && (
            <p className="mb-notice mb-notice--error" role="alert">
              <AlertCircle size={17} /> {model.persistenceError}
            </p>
          )}
          {model.notice && (
            <p className="mb-notice" role="status">
              {model.notice}
            </p>
          )}
          {cookMode ? (
            <CookSurface model={model} dispatch={dispatch} />
          ) : page === 'today' ? (
            <TodayPage model={model} dispatch={dispatch} />
          ) : page === 'week' ? (
            <WeekPage model={model} dispatch={dispatch} />
          ) : page === 'recipes' ? (
            <EnhancedRecipeBook model={model} dispatch={dispatch} />
          ) : page === 'shopping' ? (
            <ShoppingPage model={model} dispatch={dispatch} />
          ) : page === 'log' ? (
            <EnhancedHistory model={model} dispatch={dispatch} />
          ) : page === 'settings' ? (
            <SettingsPage
              model={model}
              dispatch={dispatch}
              onRestore={onRestore}
              onBankImport={onBankImport}
            />
          ) : (
            <ImportPage
              model={model}
              dispatch={dispatch}
              onOpenExistingSource={onOpenExistingSource}
            />
          )}
        </main>
        <PrimaryNav page={page} dispatch={dispatch} variant="mobile" />
        {model.eating && (
          <EatDialog
            request={model.eating}
            availableUnits={model.today.availableUnits}
            batch={model.state.experience?.batches.find(
              (batch) => batch.id === model.eating!.batchId,
            )}
            dispatch={dispatch}
          />
        )}
        {model.selectedRecipe && !cookMode && <RecipeDetail model={model} dispatch={dispatch} />}
      </div>
    </DialogFeedbackContext.Provider>
  );
}
