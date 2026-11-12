import { BookOpen, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import { filterRecipes } from '@domain/catalog';
import { perServingNutrition } from '@domain/nutrition';
import {
  defaultFilters,
  emptyNutrition,
  mealTypes,
  type Filters,
  type IngredientLine,
  type MacroKey,
  type MealType,
  type Nutrition,
  type Recipe,
  type SortOrder,
} from '@domain/types';
import type { RecipeProfile } from '@domain/experience-types';
import {
  commaList,
  displayNumber,
  humanRole,
  macroLabels,
  macroUnits,
  makeId,
  parseIngredientText,
} from '../components/shared';
import type { MealbookUIProps } from '../mealbook-contract';
import { LabelledButton, RecipeCard } from './controls';
import './recipe-workspace.css';

const macroKeys: MacroKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];

type BookTab = 'all' | 'favorites' | 'week';

type RangeText = Record<MacroKey, { min: string; max: string }>;

interface AdvancedFilterDraft {
  role: Filters['role'];
  tags: string[];
  categories: string[];
  includeIngredients: string;
  excludeIngredients: string;
  ranges: RangeText;
  minMealPrep: string;
  favoritesOnly: boolean;
  nutritionMode: Filters['nutritionMode'];
  sort: SortOrder;
}

interface EditDraft {
  name: string;
  tags: string;
  categories: string;
  roles: MealType[];
  ingredients: string;
  steps: string;
  yieldText: string;
  mealPrepRating: string;
  mealPrepNotes: string;
  nutrition: Record<MacroKey, string>;
}

interface ProfileDraft {
  yieldUnit: string;
  sourceUnitsPerPortion: string;
  portionSizeConfirmed: boolean;
  activeMinutes: string;
  elapsedMinutes: string;
  reheatMinutes: string;
  equipmentConfirmed: boolean;
  reheatNotes: string;
  notes: string;
}

const sortOptions: Array<[SortOrder, string]> = [
  ['popular', 'Most viewed'],
  ['name', 'Name'],
  ['calories', 'Calories (low to high)'],
  ['protein', 'Protein (high to low)'],
  ['carbs', 'Carbs (low to high)'],
  ['fat', 'Fat (low to high)'],
  ['fiber', 'Fiber (high to low)'],
  ['sugar', 'Sugar (low to high)'],
  ['sodium', 'Sodium (low to high)'],
  ['mealPrep', 'Meal-prep rating (high to low)'],
  ['newest', 'Recently added'],
];

const numberText = (value: number | null): string => (value === null ? '' : String(value));

const emptyRangeText = (): RangeText => ({
  calories: { min: '', max: '' },
  protein: { min: '', max: '' },
  carbs: { min: '', max: '' },
  fat: { min: '', max: '' },
  fiber: { min: '', max: '' },
  sugar: { min: '', max: '' },
  sodium: { min: '', max: '' },
});

const rangeTextFromFilters = (filters: Filters): RangeText => {
  const ranges = emptyRangeText();
  for (const key of macroKeys) {
    ranges[key] = {
      min: filters.ranges[key]?.min === undefined ? '' : String(filters.ranges[key]!.min),
      max: filters.ranges[key]?.max === undefined ? '' : String(filters.ranges[key]!.max),
    };
  }
  return ranges;
};

const advancedDraftFromFilters = (filters: Filters): AdvancedFilterDraft => ({
  role: filters.role,
  tags: filters.tags,
  categories: filters.categories,
  includeIngredients: filters.includeIngredients.join(', '),
  excludeIngredients: filters.excludeIngredients.join(', '),
  ranges: rangeTextFromFilters(filters),
  minMealPrep: filters.minMealPrep === undefined ? '' : String(filters.minMealPrep),
  favoritesOnly: filters.favoritesOnly,
  nutritionMode: filters.nutritionMode,
  sort: filters.sort,
});

const uniqueLabels = (recipes: Recipe[], field: 'tags' | 'categories'): string[] =>
  [...new Set(recipes.flatMap((recipe) => recipe[field]).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );

const parseOptionalNumber = (
  raw: string,
  label: string,
  { minimum = 0, maximum = Number.POSITIVE_INFINITY }: { minimum?: number; maximum?: number } = {},
): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Keep the draft exactly as typed. A single decimal comma is interpreted only when saving.
  const normalized =
    trimmed.includes(',') && !trimmed.includes('.') ? trimmed.replace(',', '.') : trimmed;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be a number from ${minimum}${Number.isFinite(maximum) ? ` to ${maximum}` : ' or more'}.`,
    );
  }
  return value;
};

const parsePositiveNumber = (raw: string, label: string): number => {
  const value = parseOptionalNumber(raw, label, { minimum: Number.EPSILON });
  if (value === null) throw new Error(`${label} is required.`);
  return value;
};

const nutritionText = (nutrition: Nutrition): Record<MacroKey, string> => ({
  calories: numberText(nutrition.calories),
  protein: numberText(nutrition.protein),
  carbs: numberText(nutrition.carbs),
  fat: numberText(nutrition.fat),
  fiber: numberText(nutrition.fiber),
  sugar: numberText(nutrition.sugar),
  sodium: numberText(nutrition.sodium),
});

const nutritionFromText = (values: Record<MacroKey, string>): Nutrition => {
  const nutrition = {} as Nutrition;
  for (const key of macroKeys) nutrition[key] = parseOptionalNumber(values[key], macroLabels[key]);
  return nutrition;
};

const nutritionEquals = (left: Nutrition, right: Nutrition): boolean =>
  macroKeys.every((key) => left[key] === right[key]);

const nutritionDraftDiffers = (values: Record<MacroKey, string>, baseline: Nutrition): boolean => {
  try {
    return !nutritionEquals(nutritionFromText(values), baseline);
  } catch {
    return true;
  }
};

const hasIngredientName = (text: string, name: string): boolean => {
  const normalizedText = text.trim().toLocaleLowerCase();
  const normalizedName = name.trim().toLocaleLowerCase();
  return Boolean(normalizedText && normalizedName && normalizedText.includes(normalizedName));
};

/**
 * Builds complete, editable ingredient lines without turning a stored quantity into a food-less line.
 * The original IngredientLine objects are intentionally retained on save when this returned text is unchanged.
 */
export const ingredientEditorText = (recipe: Pick<Recipe, 'ingredients'>): string =>
  recipe.ingredients
    .map((ingredient) => {
      const sourceText = ingredient.sourceText?.trim() ?? '';
      const quantityText = ingredient.quantityText.trim();
      if (hasIngredientName(sourceText, ingredient.name)) return sourceText;
      if (hasIngredientName(quantityText, ingredient.name)) return quantityText;

      const storedAmount =
        quantityText ||
        [ingredient.quantity === null ? '' : String(ingredient.quantity), ingredient.unit ?? '']
          .filter(Boolean)
          .join(' ');
      return [storedAmount, ingredient.name.trim()].filter(Boolean).join(' ');
    })
    .join('\n');

const editDraftFromRecipe = (recipe: Recipe): EditDraft => ({
  name: recipe.name,
  tags: recipe.tags.join(', '),
  categories: recipe.categories.join(', '),
  roles: recipe.roles,
  ingredients: ingredientEditorText(recipe),
  steps: recipe.steps.join('\n'),
  yieldText: numberText(recipe.baseServings),
  mealPrepRating: numberText(recipe.mealPrepRating),
  mealPrepNotes: recipe.mealPrepNotes,
  nutrition: nutritionText(perServingNutrition(recipe)),
});

const profileDraftFromProfile = (profile: RecipeProfile): ProfileDraft => ({
  yieldUnit: profile.yieldUnit,
  sourceUnitsPerPortion: String(profile.sourceUnitsPerPortion),
  portionSizeConfirmed: profile.portionSizeConfirmed,
  activeMinutes: numberText(profile.activeMinutes),
  elapsedMinutes: numberText(profile.elapsedMinutes),
  reheatMinutes: numberText(profile.reheatMinutes),
  equipmentConfirmed: profile.equipmentConfirmed,
  reheatNotes: profile.reheatNotes,
  notes: profile.notes,
});

const tabLabel = (tab: BookTab): string => {
  if (tab === 'favorites') return 'Favorites';
  if (tab === 'week') return 'In my week';
  return 'All recipes';
};

const filterSummary = (filters: Filters): string[] => {
  const summary: string[] = [];
  if (filters.role !== 'all') summary.push(humanRole(filters.role));
  if (filters.tags.length) summary.push(`tags: ${filters.tags.join(', ')}`);
  if (filters.categories.length) summary.push(`categories: ${filters.categories.join(', ')}`);
  if (filters.includeIngredients.length)
    summary.push(`includes: ${filters.includeIngredients.join(', ')}`);
  if (filters.excludeIngredients.length)
    summary.push(`excludes: ${filters.excludeIngredients.join(', ')}`);
  if (filters.minMealPrep !== undefined) summary.push(`meal prep ${filters.minMealPrep}/5+`);
  if (filters.favoritesOnly) summary.push('favorites only');
  for (const key of macroKeys) {
    const range = filters.ranges[key];
    if (!range) continue;
    const lower = range.min === undefined ? '' : `≥${displayNumber(range.min)} `;
    const upper = range.max === undefined ? '' : `≤${displayNumber(range.max)} `;
    summary.push(`${macroLabels[key]} ${[lower, upper].filter(Boolean).join(' ')}`.trim());
  }
  if (filters.nutritionMode === 'reported') summary.push('source-reported values');
  if (filters.sort !== 'popular')
    summary.push(
      `sorted by ${sortOptions.find(([value]) => value === filters.sort)?.[1].toLocaleLowerCase() ?? filters.sort}`,
    );
  return summary;
};

function FilterChips({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="mb-fieldset">
      <legend>{label}</legend>
      <div className="mb-chip-row mb-workspace-chip-row">
        {values.length ? (
          values.map((value) => {
            const active = selected.includes(value);
            return (
              <button
                type="button"
                key={value}
                className={active ? 'is-active' : ''}
                aria-pressed={active}
                onClick={() =>
                  onChange(
                    active ? selected.filter((item) => item !== value) : [...selected, value],
                  )
                }
              >
                {value}
              </button>
            );
          })
        ) : (
          <p className="mb-quiet">No {label.toLocaleLowerCase()} have been added yet.</p>
        )}
      </div>
    </fieldset>
  );
}

export function EnhancedRecipeBook({
  model,
  dispatch,
}: Pick<MealbookUIProps, 'model' | 'dispatch'>) {
  const [tab, setTab] = useState<BookTab>('all');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [draft, setDraft] = useState<AdvancedFilterDraft>(() =>
    advancedDraftFromFilters(model.filters),
  );
  const [filterError, setFilterError] = useState('');
  const [shown, setShown] = useState(9);
  const deferredSearch = useDeferredValue(model.filters.search);
  const tags = useMemo(() => uniqueLabels(model.state.recipes, 'tags'), [model.state.recipes]);
  const categories = useMemo(
    () => uniqueLabels(model.state.recipes, 'categories'),
    [model.state.recipes],
  );
  const effectiveFilters = useMemo<Filters>(
    () => ({ ...model.filters, search: deferredSearch }),
    [deferredSearch, model.filters],
  );
  const filtered = useMemo(() => {
    const domainFiltered = filterRecipes(model.state.recipes, effectiveFilters);
    const weekRecipeIds = new Set(model.week?.choices.map((choice) => choice.recipeId) ?? []);
    return domainFiltered.filter((recipe) => {
      if (tab === 'favorites') return recipe.favorite;
      if (tab === 'week') return weekRecipeIds.has(recipe.id);
      return true;
    });
  }, [effectiveFilters, model.state.recipes, model.week, tab]);

  useEffect(() => setShown(9), [model.filters, tab]);

  const patchSearch = (search: string) => {
    dispatch({ type: 'SET_FILTERS', filters: { ...model.filters, search } });
  };

  const toggleAdvanced = () => {
    if (!advancedOpen) {
      setDraft(advancedDraftFromFilters(model.filters));
      setFilterError('');
    }
    setAdvancedOpen((open) => !open);
  };

  const applyAdvancedFilters = () => {
    try {
      const ranges: Filters['ranges'] = {};
      for (const key of macroKeys) {
        const min = parseOptionalNumber(draft.ranges[key].min, `Minimum ${macroLabels[key]}`);
        const max = parseOptionalNumber(draft.ranges[key].max, `Maximum ${macroLabels[key]}`);
        if (min !== null && max !== null && min > max) {
          throw new Error(`${macroLabels[key]} minimum cannot be greater than its maximum.`);
        }
        if (min !== null || max !== null)
          ranges[key] = {
            ...(min !== null ? { min } : {}),
            ...(max !== null ? { max } : {}),
          };
      }
      const minMealPrep = parseOptionalNumber(draft.minMealPrep, 'Minimum meal-prep rating', {
        maximum: 5,
      });
      const filters: Filters = {
        ...model.filters,
        role: draft.role,
        tags: draft.tags,
        categories: draft.categories,
        includeIngredients: commaList(draft.includeIngredients),
        excludeIngredients: commaList(draft.excludeIngredients),
        ranges,
        ...(minMealPrep === null ? {} : { minMealPrep }),
        favoritesOnly: draft.favoritesOnly,
        nutritionMode: draft.nutritionMode,
        sort: draft.sort,
      };
      if (minMealPrep === null) delete filters.minMealPrep;
      if (!dispatch({ type: 'SET_FILTERS', filters })) {
        setFilterError('Those filters could not be applied. Keep your entries and try again.');
        return;
      }
      setFilterError('');
    } catch (error) {
      setFilterError(
        error instanceof Error ? error.message : 'Check the advanced filter values and try again.',
      );
    }
  };

  const resetFilters = () => {
    const reset = defaultFilters();
    if (dispatch({ type: 'SET_FILTERS', filters: reset })) {
      setDraft(advancedDraftFromFilters(reset));
      setFilterError('');
    }
  };

  const activeSummary = filterSummary(model.filters);

  return (
    <section className="mb-page mb-book" aria-labelledby="book-heading">
      <header className="mb-page-header">
        <div>
          <h1 id="book-heading">Your recipe book</h1>
          <p>
            Search your saved recipes, keep favorites close, and narrow the book only when you need
            to.
          </p>
        </div>
        <div className="mb-header-actions">
          <LabelledButton
            className="mb-button--quiet"
            onClick={() => setManualOpen((open) => !open)}
          >
            {manualOpen ? 'Close manual recipe' : 'Add a recipe'}
          </LabelledButton>
          <LabelledButton onClick={() => dispatch({ type: 'NAVIGATE', page: 'import' })}>
            Import from YouTube
          </LabelledButton>
        </div>
      </header>

      {manualOpen && <ManualRecipeForm dispatch={dispatch} onDone={() => setManualOpen(false)} />}

      <div className="mb-book-tools">
        <label className="mb-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">
            Search recipes, ingredients, source names, and method text
          </span>
          <input
            value={model.filters.search}
            onChange={(event) => patchSearch(event.target.value)}
            placeholder="Search recipes or ingredients"
          />
        </label>
        <div className="mb-tab-row" role="tablist" aria-label="Recipe collections">
          {(['all', 'favorites', 'week'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? 'is-active' : ''}
              onClick={() => setTab(value)}
            >
              {tabLabel(value)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mb-filter-button"
          aria-expanded={advancedOpen}
          onClick={toggleAdvanced}
        >
          <SlidersHorizontal size={17} /> {advancedOpen ? 'Close filters' : 'Advanced filters'}
        </button>
      </div>

      {advancedOpen && (
        <section className="mb-book-filters" aria-label="Advanced recipe filters">
          <div className="mb-workspace-filter-grid">
            <label className="mb-field">
              <span>Meal role</span>
              <select
                value={draft.role}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    role: event.target.value as Filters['role'],
                  }))
                }
              >
                <option value="all">All meal roles</option>
                {mealTypes.map((role) => (
                  <option key={role} value={role}>
                    {humanRole(role)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-field">
              <span>Sort</span>
              <select
                value={draft.sort}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sort: event.target.value as SortOrder }))
                }
              >
                {sortOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-field">
              <span>
                Minimum meal-prep rating <small>0 through 5; leave blank for any rating.</small>
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={draft.minMealPrep}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, minMealPrep: event.target.value }))
                }
                placeholder="Any rating"
              />
            </label>
          </div>

          <FilterChips
            label="Categories"
            values={categories}
            selected={draft.categories}
            onChange={(categories) => setDraft((current) => ({ ...current, categories }))}
          />
          <FilterChips
            label="Tags"
            values={tags}
            selected={draft.tags}
            onChange={(tags) => setDraft((current) => ({ ...current, tags }))}
          />

          <div className="mb-workspace-filter-grid">
            <label className="mb-field">
              <span>
                Include ingredients <small>Comma separated; every term must be present.</small>
              </span>
              <input
                value={draft.includeIngredients}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, includeIngredients: event.target.value }))
                }
                placeholder="e.g. chickpeas, lemon"
              />
            </label>
            <label className="mb-field">
              <span>
                Exclude ingredients <small>Comma separated; any matching term is excluded.</small>
              </span>
              <input
                value={draft.excludeIngredients}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, excludeIngredients: event.target.value }))
                }
                placeholder="e.g. peanuts"
              />
            </label>
          </div>

          <fieldset className="mb-fieldset">
            <legend>Nutrition range</legend>
            <p className="mb-quiet">
              Unknown values are never treated as zero. They do not match an active range and sort
              after known values.
            </p>
            <div className="mb-workspace-macro-grid">
              {macroKeys.map((key) => (
                <div className="mb-workspace-macro-range" key={key}>
                  <span>
                    {macroLabels[key]} <small>({macroUnits[key]})</small>
                  </span>
                  <label>
                    <span className="sr-only">Minimum {macroLabels[key]}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draft.ranges[key].min}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          ranges: {
                            ...current.ranges,
                            [key]: { ...current.ranges[key], min: event.target.value },
                          },
                        }))
                      }
                      placeholder="Min"
                    />
                  </label>
                  <span aria-hidden="true">–</span>
                  <label>
                    <span className="sr-only">Maximum {macroLabels[key]}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draft.ranges[key].max}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          ranges: {
                            ...current.ranges,
                            [key]: { ...current.ranges[key], max: event.target.value },
                          },
                        }))
                      }
                      placeholder="Max"
                    />
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="mb-fieldset">
            <legend>Nutrition value type</legend>
            <label className="mb-check-row">
              <input
                type="radio"
                name="recipe-book-nutrition-mode"
                checked={draft.nutritionMode === 'perServing'}
                onChange={() =>
                  setDraft((current) => ({ ...current, nutritionMode: 'perServing' }))
                }
              />
              <span>
                <b>Normalized per serving</b>
                <small>
                  Uses confirmed per-serving values. Whole-recipe reports normalize only when a
                  recipe yield is known; unknown-basis values stay unknown.
                </small>
              </span>
            </label>
            <label className="mb-check-row">
              <input
                type="radio"
                name="recipe-book-nutrition-mode"
                checked={draft.nutritionMode === 'reported'}
                onChange={() => setDraft((current) => ({ ...current, nutritionMode: 'reported' }))}
              />
              <span>
                <b>Reported source values</b>
                <small>
                  Whole-recipe and unknown-basis reports may not be comparable to a serving. Use
                  this view as reported, not as a normalized nutrition claim.
                </small>
              </span>
            </label>
          </fieldset>

          <label className="mb-check-row">
            <input
              type="checkbox"
              checked={draft.favoritesOnly}
              onChange={(event) =>
                setDraft((current) => ({ ...current, favoritesOnly: event.target.checked }))
              }
            />
            <span>
              <b>Favorites only</b>
              <small>Keep only recipes you marked for reuse.</small>
            </span>
          </label>
          {filterError && (
            <p className="mb-form-error" role="alert">
              {filterError}
            </p>
          )}
          <footer className="mb-workspace-filter-actions">
            <LabelledButton className="mb-button--quiet" onClick={resetFilters}>
              Reset filters
            </LabelledButton>
            <LabelledButton onClick={applyAdvancedFilters}>Apply advanced filters</LabelledButton>
          </footer>
        </section>
      )}

      <p className="mb-workspace-filter-summary">
        <b>Active view:</b> {tabLabel(tab)}
        {activeSummary.length ? <> · {activeSummary.join(' · ')}</> : ' · no advanced filters'}
      </p>
      <p className="mb-result-count">
        {filtered.length} recipe{filtered.length === 1 ? '' : 's'} found
      </p>
      {filtered.length ? (
        <div className="mb-book-grid">
          {filtered.slice(0, shown).map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onOpen={() => dispatch({ type: 'OPEN_RECIPE', recipeId: recipe.id })}
            />
          ))}
        </div>
      ) : (
        <section className="mb-empty">
          <BookOpen size={30} aria-hidden="true" />
          <h2>No recipes match this view</h2>
          <p>Try removing a range, revising an ingredient term, or resetting the filters.</p>
        </section>
      )}
      {shown < filtered.length && (
        <div className="mb-load-more">
          <LabelledButton
            className="mb-button--quiet"
            onClick={() => setShown((value) => value + 9)}
          >
            Load 9 more recipes
          </LabelledButton>
        </div>
      )}
    </section>
  );
}

function ManualRecipeForm({
  dispatch,
  onDone,
}: {
  dispatch: MealbookUIProps['dispatch'];
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [yieldText, setYieldText] = useState('');
  const [roles, setRoles] = useState<MealType[]>([]);
  const [error, setError] = useState('');

  const toggleRole = (role: MealType) =>
    setRoles((current) =>
      current.includes(role) ? current.filter((value) => value !== role) : [...current, role],
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const parsedIngredients = parseChangedIngredients(ingredients);
      const method = steps
        .split('\n')
        .map((step) => step.trim())
        .filter(Boolean);
      if (!name.trim() || !method.length) {
        throw new Error('Add a title, at least one ingredient, and one method step.');
      }
      const recipe: Recipe = {
        id: makeId('recipe'),
        name: name.trim(),
        roles,
        tags: [],
        categories: [],
        ingredients: parsedIngredients,
        steps: method,
        baseServings: parseOptionalNumber(yieldText, 'Yield / servings', {
          minimum: Number.EPSILON,
        }),
        nutrition: emptyNutrition(),
        reportedNutrition: emptyNutrition(),
        nutritionBasis: 'not_stated',
        sourceUrl: null,
        sourceName: 'Personal recipe',
        creatorCredit: null,
        viewCount: null,
        viewCountAt: null,
        image: null,
        prepMinutes: null,
        cookMinutes: null,
        mealPrepRating: null,
        mealPrepNotes: '',
        dataGaps: [],
        favorite: false,
        addedAt: new Date().toISOString(),
      };
      if (!dispatch({ type: 'ADD_RECIPE', recipe })) {
        setError(
          'This recipe could not be added. Your entries are still here so you can correct them.',
        );
        return;
      }
      onDone();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Check the recipe details and try again.',
      );
    }
  };

  return (
    <form className="mb-manual-recipe" onSubmit={submit}>
      <header>
        <h2>Add a manual recipe</h2>
        <p>
          Start with what you need to cook and shop. Nutrition and organization can be added later.
        </p>
      </header>
      {error && (
        <p className="mb-form-error" role="alert">
          {error}
        </p>
      )}
      <label className="mb-field">
        <span>Recipe title</span>
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <fieldset className="mb-fieldset">
        <legend>
          Meal roles <small>Optional</small>
        </legend>
        <div className="mb-chip-row mb-workspace-chip-row">
          {mealTypes.map((role) => (
            <button
              type="button"
              key={role}
              className={roles.includes(role) ? 'is-active' : ''}
              aria-pressed={roles.includes(role)}
              onClick={() => toggleRole(role)}
            >
              {humanRole(role)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mb-field">
        <span>
          Ingredients{' '}
          <small>One per line; keep your source wording if amounts are uncertain.</small>
        </span>
        <textarea
          rows={5}
          value={ingredients}
          onChange={(event) => setIngredients(event.target.value)}
          placeholder={'e.g. 400 g chickpeas\n1 lemon'}
          required
        />
      </label>
      <label className="mb-field">
        <span>
          Method <small>One step per line.</small>
        </span>
        <textarea
          rows={5}
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          required
        />
      </label>
      <label className="mb-field">
        <span>
          Yield / servings <small>Optional</small>
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={yieldText}
          onChange={(event) => setYieldText(event.target.value)}
          placeholder="Unknown"
        />
      </label>
      <footer>
        <LabelledButton className="mb-button--quiet" onClick={onDone}>
          Cancel
        </LabelledButton>
        <LabelledButton type="submit">Save recipe</LabelledButton>
      </footer>
    </form>
  );
}

export function RecipeEditForm({
  recipe,
  dispatch,
  onClose,
}: {
  recipe: Recipe;
  dispatch: MealbookUIProps['dispatch'];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EditDraft>(() => editDraftFromRecipe(recipe));
  const [initialIngredientText, setInitialIngredientText] = useState(() =>
    ingredientEditorText(recipe),
  );
  const [nutritionReviewed, setNutritionReviewed] = useState(false);
  const [organizationOpen, setOrganizationOpen] = useState(false);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(editDraftFromRecipe(recipe));
    setInitialIngredientText(ingredientEditorText(recipe));
    setNutritionReviewed(false);
    setOrganizationOpen(false);
    setNutritionOpen(false);
    setError('');
  }, [recipe.id]);

  const normalizedBaseline = perServingNutrition(recipe);
  const hasNutritionEdits = nutritionDraftDiffers(draft.nutrition, normalizedBaseline);

  const toggleRole = (role: MealType) =>
    setDraft((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((value) => value !== role)
        : [...current.roles, role],
    }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      if (!draft.name.trim()) throw new Error('Add a recipe title before saving.');
      const baseServings = parseOptionalNumber(draft.yieldText, 'Yield / servings', {
        minimum: Number.EPSILON,
      });
      const mealPrepRating = parseOptionalNumber(draft.mealPrepRating, 'Meal-prep rating', {
        maximum: 5,
      });
      const ingredientsChanged = draft.ingredients !== initialIngredientText;
      const ingredients = ingredientsChanged
        ? parseChangedIngredients(draft.ingredients)
        : recipe.ingredients;
      const nutrition = nutritionFromText(draft.nutrition);

      if (hasNutritionEdits && !nutritionReviewed) {
        throw new Error('Check the nutrition review box before saving changed nutrition values.');
      }

      const next: Recipe = {
        ...recipe,
        name: draft.name.trim(),
        tags: commaList(draft.tags),
        categories: commaList(draft.categories),
        roles: draft.roles,
        ingredients,
        steps: draft.steps
          .split('\n')
          .map((step) => step.trim())
          .filter(Boolean),
        baseServings,
        mealPrepRating,
        mealPrepNotes: draft.mealPrepNotes,
        ...(nutritionReviewed
          ? {
              // These are the user's confirmed per-serving values. Preserve the imported/source report verbatim.
              nutritionBasis: 'per_serving' as const,
              nutrition,
            }
          : {}),
      };

      const updated = dispatch({
        type: 'UPDATE_RECIPE',
        recipe: next,
        ...(nutritionReviewed ? { nutritionConfirmed: true } : {}),
      });
      if (!updated) {
        setError(
          'This recipe could not be saved. Your edits are still here so you can correct them.',
        );
        return;
      }
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Check the recipe details and try again.',
      );
    }
  };

  const currentBasisMessage =
    recipe.nutritionBasis === 'per_recipe' && recipe.baseServings === null
      ? 'This source reports whole-recipe nutrition but the yield is unknown, so there is no normalized baseline yet.'
      : recipe.nutritionBasis === 'unspecified' || recipe.nutritionBasis === 'not_stated'
        ? 'The source nutrition basis is not established, so normalized values may be unknown.'
        : 'The fields start with the current normalized per-serving values; blank means unknown.';

  return (
    <form className="mb-recipe-edit" onSubmit={submit}>
      <h3>Edit recipe</h3>
      <p>
        Ingredients keep their original source details until you change their text. Changing
        ingredients leaves nutrition for review unless you explicitly confirm the per-serving values
        below.
      </p>
      {error && (
        <p className="mb-form-error" role="alert">
          {error}
        </p>
      )}
      <label className="mb-field">
        <span>Title</span>
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          required
        />
      </label>
      <fieldset className="mb-fieldset">
        <legend>Meal roles</legend>
        <div className="mb-chip-row mb-workspace-chip-row">
          {mealTypes.map((role) => (
            <button
              type="button"
              key={role}
              className={draft.roles.includes(role) ? 'is-active' : ''}
              aria-pressed={draft.roles.includes(role)}
              onClick={() => toggleRole(role)}
            >
              {humanRole(role)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mb-two-fields">
        <label className="mb-field">
          <span>Tags</span>
          <input
            value={draft.tags}
            onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
            placeholder="Comma separated"
          />
        </label>
        <label className="mb-field">
          <span>Categories</span>
          <input
            value={draft.categories}
            onChange={(event) =>
              setDraft((current) => ({ ...current, categories: event.target.value }))
            }
            placeholder="Comma separated"
          />
        </label>
      </div>
      <label className="mb-field">
        <span>
          Yield / servings <small>Leave blank if unknown.</small>
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={draft.yieldText}
          onChange={(event) =>
            setDraft((current) => ({ ...current, yieldText: event.target.value }))
          }
          placeholder="Unknown"
        />
      </label>
      <label className="mb-field">
        <span>
          Ingredients{' '}
          <small>
            One per line. Original ingredient records are retained exactly when this text is
            unchanged.
          </small>
        </span>
        <textarea
          rows={6}
          value={draft.ingredients}
          onChange={(event) =>
            setDraft((current) => ({ ...current, ingredients: event.target.value }))
          }
        />
      </label>
      <label className="mb-field">
        <span>
          Method <small>One step per line.</small>
        </span>
        <textarea
          rows={6}
          value={draft.steps}
          onChange={(event) => setDraft((current) => ({ ...current, steps: event.target.value }))}
        />
      </label>

      <button
        type="button"
        className="mb-disclosure"
        aria-expanded={organizationOpen}
        onClick={() => setOrganizationOpen((open) => !open)}
      >
        Organization & meal prep <ChevronDown size={18} />
      </button>
      {organizationOpen && (
        <div className="mb-workspace-disclosure-panel">
          <label className="mb-field">
            <span>
              Meal-prep rating <small>0 to 5; leave blank if you have not rated it.</small>
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draft.mealPrepRating}
              onChange={(event) =>
                setDraft((current) => ({ ...current, mealPrepRating: event.target.value }))
              }
              placeholder="Unrated"
            />
          </label>
          <label className="mb-field">
            <span>Meal-prep notes</span>
            <textarea
              value={draft.mealPrepNotes}
              onChange={(event) =>
                setDraft((current) => ({ ...current, mealPrepNotes: event.target.value }))
              }
              placeholder="What makes this easier or harder to prep ahead?"
            />
          </label>
        </div>
      )}

      <button
        type="button"
        className="mb-disclosure"
        aria-expanded={nutritionOpen}
        onClick={() => setNutritionOpen((open) => !open)}
      >
        Nutrition review <ChevronDown size={18} />
      </button>
      {nutritionOpen && (
        <div className="mb-workspace-disclosure-panel">
          <p className="mb-quiet">{currentBasisMessage}</p>
          <div
            className="mb-workspace-macro-baseline"
            aria-label="Current normalized nutrition baseline"
          >
            {macroKeys.map((key) => (
              <span key={key}>
                <b>{macroLabels[key]}</b>{' '}
                {normalizedBaseline[key] === null
                  ? 'Unknown'
                  : `${displayNumber(normalizedBaseline[key])} ${macroUnits[key]}`}
              </span>
            ))}
          </div>
          <div className="mb-workspace-nutrition-editor">
            {macroKeys.map((key) => (
              <label className="mb-field" key={key}>
                <span>
                  {macroLabels[key]} per serving <small>({macroUnits[key]})</small>
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.nutrition[key]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      nutrition: { ...current.nutrition, [key]: event.target.value },
                    }))
                  }
                  placeholder="Unknown"
                />
              </label>
            ))}
          </div>
          <label className="mb-check-row">
            <input
              type="checkbox"
              checked={nutritionReviewed}
              onChange={(event) => setNutritionReviewed(event.target.checked)}
            />
            <span>
              <b>I reviewed these as per-serving values</b>
              <small>
                This confirmation saves the seven values above as your normalized serving values.
                Source-reported nutrition is left unchanged.
              </small>
            </span>
          </label>
        </div>
      )}

      <footer>
        <LabelledButton className="mb-button--quiet" onClick={onClose}>
          Cancel
        </LabelledButton>
        <LabelledButton type="submit">Save recipe edits</LabelledButton>
      </footer>
    </form>
  );
}

function parseChangedIngredients(text: string): IngredientLine[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) throw new Error('Keep at least one ingredient, or cancel this edit.');
  return lines.map(parseIngredientText);
}

export function RecipeProfileForm({
  recipe,
  profile,
  dispatch,
}: {
  recipe: Recipe;
  profile: RecipeProfile;
  dispatch: MealbookUIProps['dispatch'];
}) {
  const [draft, setDraft] = useState<ProfileDraft>(() => profileDraftFromProfile(profile));
  const [equipmentText, setEquipmentText] = useState(() => profile.equipment.join(', '));
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(profileDraftFromProfile(profile));
    setEquipmentText(profile.equipment.join(', '));
    setError('');
  }, [recipe.id]);

  const save = () => {
    try {
      const yieldUnit = draft.yieldUnit.trim();
      if (!yieldUnit) throw new Error('Name the yield or meal portion unit before saving.');
      const next: RecipeProfile = {
        yieldUnit,
        sourceUnitsPerPortion: parsePositiveNumber(
          draft.sourceUnitsPerPortion,
          'Recipe servings in one meal portion',
        ),
        portionSizeConfirmed: draft.portionSizeConfirmed,
        activeMinutes: parseOptionalNumber(draft.activeMinutes, 'Confirmed active minutes'),
        elapsedMinutes: parseOptionalNumber(draft.elapsedMinutes, 'Confirmed elapsed minutes'),
        reheatMinutes: parseOptionalNumber(draft.reheatMinutes, 'Reheat or defrost minutes'),
        equipment: commaList(equipmentText),
        equipmentConfirmed: draft.equipmentConfirmed,
        reheatNotes: draft.reheatNotes,
        notes: draft.notes,
      };
      if (!dispatch({ type: 'UPDATE_PROFILE', recipeId: recipe.id, profile: next })) {
        setError(
          'This cooking profile could not be saved. Your entries are still here so you can correct them.',
        );
        return;
      }
      setError('');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Check the cooking profile and try again.',
      );
    }
  };

  return (
    <section className="mb-profile-form">
      <h3>Your cooking profile</h3>
      <p>
        These are your notes for this recipe as it is published. They do not claim that a scaled
        batch has the same timing or portion size.
      </p>
      {error && (
        <p className="mb-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="mb-two-fields">
        <label className="mb-field">
          <span>Yield or meal portion unit</span>
          <input
            value={draft.yieldUnit}
            onChange={(event) =>
              setDraft((current) => ({ ...current, yieldUnit: event.target.value }))
            }
            placeholder="e.g. bowl, portion"
          />
        </label>
        <label className="mb-field">
          <span>Recipe servings in one meal portion</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.sourceUnitsPerPortion}
            onChange={(event) =>
              setDraft((current) => ({ ...current, sourceUnitsPerPortion: event.target.value }))
            }
          />
        </label>
        <label className="mb-field">
          <span>
            Confirmed active minutes <small>For the published recipe amount.</small>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={draft.activeMinutes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, activeMinutes: event.target.value }))
            }
            placeholder="Unknown"
          />
        </label>
        <label className="mb-field">
          <span>
            Confirmed elapsed minutes{' '}
            <small>
              {profile.timingObservedAt &&
              draft.elapsedMinutes === numberText(profile.elapsedMinutes)
                ? `Measured when you cooked ${displayNumber(profile.timingSourceServings ?? 0)} recipe servings on ${new Date(profile.timingObservedAt).toLocaleDateString()}. Editing it makes it apply to the published amount.`
                : 'For the published recipe amount.'}
            </small>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={draft.elapsedMinutes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, elapsedMinutes: event.target.value }))
            }
            placeholder="Unknown"
          />
        </label>
        <label className="mb-field">
          <span>Reheat or defrost minutes</span>
          <input
            type="text"
            inputMode="numeric"
            value={draft.reheatMinutes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, reheatMinutes: event.target.value }))
            }
            placeholder="Unknown"
          />
        </label>
      </div>
      <label className="mb-check-row">
        <input
          type="checkbox"
          checked={draft.portionSizeConfirmed}
          onChange={(event) =>
            setDraft((current) => ({ ...current, portionSizeConfirmed: event.target.checked }))
          }
        />
        <span>
          <b>Meal portion confirmed</b>
          <small>
            Confirm only when you know how much of the published recipe makes one meal portion for
            you.
          </small>
        </span>
      </label>
      <label className="mb-field">
        <span>
          Equipment you use <small>Comma separated; parsed only when you save.</small>
        </span>
        <input
          value={equipmentText}
          onChange={(event) => setEquipmentText(event.target.value)}
          placeholder="e.g. 24 cm skillet, blender"
        />
      </label>
      <label className="mb-check-row">
        <input
          type="checkbox"
          checked={draft.equipmentConfirmed}
          onChange={(event) =>
            setDraft((current) => ({ ...current, equipmentConfirmed: event.target.checked }))
          }
        />
        <span>
          <b>Equipment confirmed</b>
          <small>These are the tools you have actually used or checked for this recipe.</small>
        </span>
      </label>
      <label className="mb-field">
        <span>Reheat or defrost notes</span>
        <textarea
          value={draft.reheatNotes}
          onChange={(event) =>
            setDraft((current) => ({ ...current, reheatNotes: event.target.value }))
          }
          placeholder="Your useful reheat or defrost note"
        />
      </label>
      <label className="mb-field">
        <span>Personal notes</span>
        <textarea
          value={draft.notes}
          onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          placeholder="What you would do next time"
        />
      </label>
      <LabelledButton className="mb-button--quiet" onClick={save}>
        Save cooking profile
      </LabelledButton>
    </section>
  );
}
