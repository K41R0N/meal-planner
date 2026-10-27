import { CalendarDays, ChevronDown, Lock, LockOpen, RefreshCw, Shuffle, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Filters, MealType, PlanConfig, Recipe, WeekPlan } from '@domain/types';
import { recipeNutrition } from '@domain/index';
import { defaultFilters, mealTypes } from '@domain/types';
import { RecipeCard } from './RecipeCard';
import { dateLabel, displayNumber, humanRole, localMonday, macroValue, primaryMacros, shortDate } from './shared';

interface PlanBuilderProps {
  recipes: Recipe[];
  plans: WeekPlan[];
  activePlan: WeekPlan | null;
  bookFilters: Filters;
  onSelectPlan: (id: string) => void;
  onGenerate: (config: PlanConfig, replaceCurrent: boolean) => boolean;
  onOpenRecipe: (recipe: Recipe) => void;
  onUpdateMeal: (mealId: string, changes: { servings?: number; locked?: boolean; recipeId?: string }) => void;
  onReplaceMeal: (mealId: string) => void;
  onReplaceBatch: (recipeId: string) => void;
}

function configFrom(plan: WeekPlan | null): PlanConfig {
  if (plan) return plan.config;
  return { weekStart: localMonday(), days: 7, people: 1, slots: ['breakfast', 'lunch', 'dinner'], uniqueRecipes: 5, filters: defaultFilters() };
}

function dateFor(config: PlanConfig, offset: number): string {
  const date = new Date(`${config.weekStart}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function PlanBuilder({ recipes, plans, activePlan, bookFilters, onSelectPlan, onGenerate, onOpenRecipe, onUpdateMeal, onReplaceMeal, onReplaceBatch }: PlanBuilderProps) {
  const [showBuilder, setShowBuilder] = useState(!activePlan);
  const [useBookRules, setUseBookRules] = useState(false);
  const [replaceCurrent, setReplaceCurrent] = useState(Boolean(activePlan));
  const [config, setConfig] = useState<PlanConfig>(() => configFrom(activePlan));
  const [message, setMessage] = useState('');
  useEffect(() => { if (activePlan) { setConfig(configFrom(activePlan)); setReplaceCurrent(true); } }, [activePlan?.id]);
  const patch = (changes: Partial<PlanConfig>) => setConfig({ ...config, ...changes });
  const selectedFilters = useBookRules ? bookFilters : config.filters;
  const selectedRecipe = (id: string) => recipes.find(recipe => recipe.id === id) ?? null;
  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    let incomplete = false;
    if (!activePlan) return { values: result, incomplete: false };
    for (const meal of activePlan.meals) {
      const recipe = selectedRecipe(meal.recipeId);
      const nutrition = recipe ? recipeNutrition(recipe, meal.servings) : null;
      for (const macro of primaryMacros) {
        const value = nutrition?.[macro] ?? null;
        if (value === null) { incomplete = true; continue; }
        result[macro] = (result[macro] ?? 0) + value;
      }
    }
    return { values: result, incomplete };
  }, [activePlan, recipes]);
  const generate = () => {
    if (!config.slots.length) { setMessage('Choose at least one meal slot.'); return; }
    if (config.people < 1 || config.days < 1 || config.uniqueRecipes < 1) { setMessage('Days, people, and distinct recipes must all be at least 1.'); return; }
    setMessage('');
    if (onGenerate({ ...config, filters: selectedFilters }, Boolean(activePlan && replaceCurrent))) setShowBuilder(false);
  };
  const toggleSlot = (slot: MealType) => patch({ slots: config.slots.includes(slot) ? config.slots.filter(value => value !== slot) : [...config.slots, slot] });
  const dayMeals = (date: string) => activePlan?.meals.filter(meal => meal.date === date) ?? [];

  return <section className="page week-page" aria-labelledby="week-heading">
    <header className="page-heading"><div><p className="eyebrow"><CalendarDays size={15} /> Saved, not rerolled</p><h1 id="week-heading">This week</h1><p>{activePlan ? `${shortDate(activePlan.config.weekStart)} · ${activePlan.config.days} day${activePlan.config.days === 1 ? '' : 's'} · ${activePlan.config.people} ${activePlan.config.people === 1 ? 'person' : 'people'}` : 'Choose a plan that fits the week ahead.'}</p></div><button type="button" className="button" onClick={() => setShowBuilder(value => !value)}><Sparkles size={18} /> {showBuilder ? 'Close planner' : activePlan ? 'Edit plan' : 'Generate plan'}</button></header>
    {plans.length > 0 && <label className="plan-picker"><span>Saved week</span><select value={activePlan?.id ?? ''} onChange={event => onSelectPlan(event.target.value)}>{plans.map(plan => <option key={plan.id} value={plan.id}>{shortDate(plan.config.weekStart)} · {plan.config.days} days</option>)}</select></label>}
    {showBuilder && <section className="plan-builder"><div className="section-heading"><div><h2>{activePlan ? 'Plan settings' : 'Build a week'}</h2><p className="quiet">Your choices are saved. Generation never runs again unless you ask it to.</p></div></div>{message && <p className="form-error" role="alert">{message}</p>}<div className="form-grid"><label className="field"><span>Week starts Monday</span><input type="date" value={config.weekStart} onChange={event => patch({ weekStart: event.target.value })} /></label><label className="field"><span>Days</span><select value={config.days} onChange={event => patch({ days: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="field"><span>People</span><input type="number" min="1" value={config.people} onChange={event => patch({ people: Number(event.target.value) })} /></label><label className="field"><span>Distinct recipes</span><input type="number" min="1" value={config.uniqueRecipes} onChange={event => patch({ uniqueRecipes: Number(event.target.value) })} /></label><fieldset className="filter-fieldset field--wide"><legend>Meal slots</legend><div className="chip-row">{mealTypes.map(slot => <button type="button" key={slot} className={`chip ${config.slots.includes(slot) ? 'is-active' : ''}`} aria-pressed={config.slots.includes(slot)} onClick={() => toggleSlot(slot)}>{humanRole(slot)}</button>)}</div></fieldset></div><div className="planner-rules"><label className="toggle-line"><input type="checkbox" checked={useBookRules} onChange={event => setUseBookRules(event.target.checked)} /><span><strong>Use current recipe-book filters</strong><small>{useBookRules ? 'The current search and rules will define eligible recipes.' : 'No recipe-book rules are applied unless you choose this.'}</small></span></label>{useBookRules && <button type="button" className="text-button" onClick={() => { setUseBookRules(false); patch({ filters: defaultFilters() }); }}>Reset planner eligibility</button>}</div>{activePlan && <label className="toggle-line"><input type="checkbox" checked={replaceCurrent} onChange={event => setReplaceCurrent(event.target.checked)} /><span><strong>{replaceCurrent ? 'Replace this saved week' : 'Save as another week'}</strong><small>{replaceCurrent ? 'Locked slots are kept when possible; the rest are regenerated after confirmation.' : 'The current saved week stays in your history.'}</small></span></label>}<p className="storage-note">A 7-day plan does not mean 7-day refrigerator storage; use your own prep and freezing notes.</p><button type="button" className="button" onClick={generate}><Shuffle size={18} /> {activePlan && replaceCurrent ? 'Regenerate saved week' : 'Generate saved week'}</button></section>}
    {!activePlan ? <><section className="empty-state week-empty"><CalendarDays size={30} /><h2>A good week starts here</h2><p>Generate a saved plan, then adjust any open meal slot. Nothing is filled in automatically.</p><button type="button" className="button" onClick={() => setShowBuilder(true)}>Generate plan</button></section>{recipes.length > 0 && <section className="starter-recipes"><h2>Favorites and popular picks</h2><div className="horizontal-cards">{[...recipes].filter(recipe => recipe.favorite).concat([...recipes].filter(recipe => !recipe.favorite).sort((a, b) => (b.viewCount ?? -1) - (a.viewCount ?? -1))).filter((recipe, index, list) => list.findIndex(item => item.id === recipe.id) === index).slice(0, 6).map(recipe => <RecipeCard key={recipe.id} recipe={recipe} compact onOpen={onOpenRecipe} />)}</div></section>}</> : <>
      <section className="plan-total-strip" aria-label="Known planned nutrition"><div><strong>Planned nutrition</strong><span>{totals.incomplete ? 'Incomplete: meals without confirmed values are not counted.' : 'Known per-serving values across this plan.'}</span></div>{primaryMacros.map(macro => <span key={macro}>{macro === 'calories' ? 'Cal' : macro.slice(0, 1).toUpperCase()}: {totals.values[macro] === undefined ? '—' : macroValue(macro, totals.values[macro])}</span>)}</section>
      <div className="day-plan-list">{Array.from({ length: activePlan.config.days }, (_, day) => { const date = dateFor(activePlan.config, day); return <section className="day-section" key={date}><header><h2>{dateLabel(date)}</h2><span>{dayMeals(date).length} slot{dayMeals(date).length === 1 ? '' : 's'}</span></header><div className="plan-slots">{dayMeals(date).map(meal => { const recipe = selectedRecipe(meal.recipeId); const suitable = recipes.filter(item => item.roles.includes(meal.slot) && new Set(activePlan.meals.map(existing => existing.id === meal.id ? item.id : existing.recipeId)).size === activePlan.config.uniqueRecipes); return <article className={`planned-slot ${meal.locked ? 'is-locked' : ''}`} key={meal.id}><div className="planned-slot__top"><p className="eyebrow">{humanRole(meal.slot)}</p><button type="button" className="lock-button" aria-pressed={meal.locked} onClick={() => onUpdateMeal(meal.id, { locked: !meal.locked })}>{meal.locked ? <Lock size={15} /> : <LockOpen size={15} />}{meal.locked ? ' Locked' : ' Open'}</button></div>{recipe ? <RecipeCard recipe={recipe} compact onOpen={onOpenRecipe} /> : <p className="form-error">This recipe is no longer in your book.</p>}<div className="slot-controls"><label><span>Servings</span><input type="number" min="0.25" step="0.25" value={meal.servings} disabled={meal.locked} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value > 0) onUpdateMeal(meal.id, { servings: value }); }} /></label><label><span>Pick a {humanRole(meal.slot).toLowerCase()}</span><select value={meal.recipeId} disabled={meal.locked} onChange={event => onUpdateMeal(meal.id, { recipeId: event.target.value })}><option value={meal.recipeId}>{recipe?.name ?? 'Missing recipe'}</option>{suitable.filter(item => item.id !== meal.recipeId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" className="button button--quiet" disabled={meal.locked} onClick={() => onReplaceMeal(meal.id)}><RefreshCw size={16} /> Swap one</button>{recipe && <button type="button" className="button button--quiet" disabled={meal.locked} onClick={() => onReplaceBatch(recipe.id)}><RefreshCw size={16} /> Swap batch</button>}</div></article>; })}</div></section>; })}</div>
    </>}
  </section>;
}
