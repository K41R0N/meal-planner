import { AlertTriangle, BookOpen, CalendarDays, ChefHat, ListChecks, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildShoppingList,
  createConsumption,
  filterRecipes,
  generateWeek,
  replaceBatch,
  replaceMeal,
  validateRecipes,
  validateState,
} from '@domain/index';
import { defaultFilters, type AppState, type ConsumptionEntry, type Filters, type ManualShoppingItem, type Nutrition, type PlanConfig, type Recipe, type WeekPlan } from '@domain/types';
import { loadState, saveState, downloadJson } from './storage';
import { FoodLog } from './components/Log';
import { PlanBuilder } from './components/PlanBuilder';
import { RecipeBook } from './components/RecipeBook';
import { RecipeDetails } from './components/RecipeDetails';
import { RecipeImport } from './components/RecipeImport';
import { Settings } from './components/Settings';
import { Shopping } from './components/Shopping';
import { makeId } from './components/shared';
import { reconcileShoppingChecks, replaceWithChosenBatch, shoppingSignature } from './state-utils';
import { extractYouTubeReference, parseYouTubeReference } from '@domain/youtube';
import {recipeJsonFileFits,RECIPE_JSON_SIZE_MESSAGE} from './import-limits';

type Page = 'week' | 'recipes' | 'shopping' | 'log' | 'settings' | 'import';

const navItems: Array<{ page: Exclude<Page, 'settings' | 'import'>; label: string; icon: typeof CalendarDays }> = [
  { page: 'week', label: 'This Week', icon: CalendarDays },
  { page: 'recipes', label: 'Recipe Book', icon: BookOpen },
  { page: 'shopping', label: 'Shopping', icon: ListChecks },
  { page: 'log', label: 'Food Log', icon: ChefHat },
];

function pageFromHash(): Page {
  const name = window.location.hash.replace(/^#/, '');
  return name === 'recipes' || name === 'shopping' || name === 'log' || name === 'settings' || name === 'week' || name === 'import' ? name : 'week';
}

function sharedYouTubeUrlFromLocation(): { url: string | null; hasShare: boolean } {
  const location = new URL(window.location.href);
  const sharedUrl = location.searchParams.get('sharedUrl');
  const sharedText = location.searchParams.get('sharedText');
  if (sharedUrl === null && sharedText === null) return { url: null, hasShare: false };
  let reference = null;
  try { reference = sharedUrl ? parseYouTubeReference(sharedUrl) : null; } catch { /* Shared text may contain the usable link instead. */ }
  if (!reference && sharedText) reference = extractYouTubeReference(sharedText);
  return { url: reference?.url ?? null, hasShare: true };
}

function removeSharedImportQuery(routeToImport: boolean): void {
  const location = new URL(window.location.href);
  location.searchParams.delete('sharedUrl');
  location.searchParams.delete('sharedText');
  if (routeToImport) location.hash = '#import';
  window.history.replaceState(window.history.state, '', `${location.pathname}${location.search}${location.hash}`);
}

function planWithChange(plan: WeekPlan, mealId: string, changes: { servings?: number; locked?: boolean; recipeId?: string }): WeekPlan {
  return { ...plan, meals: plan.meals.map(meal => meal.id === mealId ? { ...meal, ...changes } : meal) };
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [persistenceError, setPersistenceError] = useState('');
  const [notice, setNotice] = useState('');
  const [sharedImport] = useState(sharedYouTubeUrlFromLocation);
  const [page, setPage] = useState<Page>(() => sharedImport.url ? 'import' : pageFromHash());
  const [filters, setFilters] = useState<Filters>(() => defaultFilters());
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const previousShopping = useRef<{planId:string;items:Map<string,{signature:string;amount:string}>} | null>(null);
  const [changedShoppingAmounts, setChangedShoppingAmounts] = useState<Record<string,string>>({});
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    loadState().then(next => {
      if (!live) return;
      stateRef.current = next;
      setState(next);
      setLoaded(true);
    }).catch(error => {
      if (!live) return;
      setLoadError(error instanceof Error ? error.message : 'The saved recipe book could not be opened.');
      setLoaded(true);
    });
    return () => { live = false; };
  }, []);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => {
    if (sharedImport.hasShare) removeSharedImportQuery(Boolean(sharedImport.url));
  }, [sharedImport]);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!loaded || !state) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveState(state).then(() => setPersistenceError('')).catch(error => setPersistenceError(error instanceof Error ? error.message : 'This browser could not save changes on this device.'));
    }, 450);
    return () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); };
  }, [state, loaded]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden' || !stateRef.current || !loaded) return;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveState(stateRef.current).then(() => setPersistenceError('')).catch(error => setPersistenceError(error instanceof Error ? error.message : 'This browser could not save changes on this device.'));
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loaded]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const navigate = (next: Page) => {
    const hash = `#${next}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    else setPage(next);
  };
  const updateState = (updater: (current: AppState) => AppState) => {
    const current = stateRef.current;
    if (!current) return;
    const next = reconcileShoppingChecks(current, updater(current));
    stateRef.current = next;
    setState(next);
  };
  const activePlan = state?.plans.find(plan => plan.id === state.activePlanId) ?? null;
  const selectedRecipe = selectedRecipeId ? state?.recipes.find(recipe => recipe.id === selectedRecipeId) ?? null : null;
  const filteredRecipes = useMemo(() => state ? filterRecipes(state.recipes, filters) : [], [state, filters]);
  const shoppingItems = useMemo(() => {
    if (!state || !activePlan) return [];
    try { return buildShoppingList(activePlan, state.recipes); }
    catch (error) { setTimeout(() => setNotice(error instanceof Error ? error.message : 'Shopping list could not be calculated.'), 0); return []; }
  }, [state, activePlan]);

  useEffect(() => {
    if(!activePlan){previousShopping.current=null;setChangedShoppingAmounts({});return;}
    const items=new Map(shoppingItems.map(item=>[item.key,{signature:shoppingSignature(item),amount:item.displayQuantity||'unspecified amount'}]));
    const previous=previousShopping.current;
    if(previous?.planId===activePlan.id){
      const changes:Record<string,string>={};
      for(const [key,item] of items){const old=previous.items.get(key);if(old&&old.signature!==item.signature)changes[`${activePlan.id}:${key}`]=old.amount;}
      if(Object.keys(changes).length)setChangedShoppingAmounts(current=>({...current,...changes}));
    }else setChangedShoppingAmounts({});
    previousShopping.current={planId:activePlan.id,items};
  },[activePlan,shoppingItems]);

  const updateRecipe = (recipe: Recipe) => {
    try {
      const validated = validateRecipes([recipe])[0];
      updateState(current => ({ ...current, recipes: current.recipes.map(item => item.id === validated.id ? validated : item) }));
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Recipe edits could not be saved.'); }
  };
  const addRecipe = (recipe: Recipe): boolean => {
    try {
      const validated = validateRecipes([recipe])[0];
      const current = stateRef.current;
      if (!current) {
        setNotice('The recipe book is not ready yet.');
        return false;
      }
      if (current.recipes.some(item => item.id === validated.id)) {
        setNotice('That recipe is already in your book. It was not overwritten.');
        return false;
      }
      const next = reconcileShoppingChecks(current, { ...current, recipes: [...current.recipes, validated] });
      stateRef.current = next;
      setState(next);
      setNotice('Recipe added to your book.');
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Recipe could not be added.');
      return false;
    }
  };
  const openExistingYouTubeRecipe = (videoId: string): boolean => {
    const existing = stateRef.current?.recipes.find(recipe => {
      if (recipe.id === `youtube:${videoId}`) return true;
      if (!recipe.sourceUrl) return false;
      try { return parseYouTubeReference(recipe.sourceUrl).videoId === videoId; } catch { return false; }
    });
    if (!existing) return false;
    setSelectedRecipeId(existing.id);
    navigate('recipes');
    setNotice('This video is already in your recipe book. Your saved recipe was not overwritten.');
    return true;
  };
  const selectPlan = (id: string) => updateState(current => ({ ...current, activePlanId: id }));
  const generatePlan = (config: PlanConfig, replaceCurrent: boolean): boolean => {
    if (!state) return false;
    const current = activePlan;
    if (replaceCurrent && current && !window.confirm('Regenerate this saved week? Locked slots will be kept when possible; open slots will be replaced.')) return false;
    try {
      const generated = generateWeek(state.recipes, config, replaceCurrent && current ? current : undefined);
      const plan = replaceCurrent && current ? { ...generated, id: current.id } : generated;
      updateState(previous => ({
        ...previous,
        plans: replaceCurrent && current ? previous.plans.map(item => item.id === current.id ? plan : item) : [...previous.plans, plan],
        activePlanId: plan.id,
      }));
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : 'The week could not be generated.'); return false; }
  };
  const updateMeal = (mealId: string, changes: { servings?: number; locked?: boolean; recipeId?: string }) => {
    if (!state || !activePlan) return;
    const meal = activePlan.meals.find(item => item.id === mealId);
    if (!meal || (meal.locked && (changes.recipeId || changes.servings))) { setNotice('Unlock this slot before changing its recipe or servings.'); return; }
    if (changes.recipeId) {
      const candidateRecipe = state.recipes.find(recipe => recipe.id === changes.recipeId);
      if (!candidateRecipe?.roles.includes(meal.slot)) { setNotice('Choose a recipe that has this meal role.'); return; }
      const candidate = planWithChange(activePlan, mealId, changes);
      if (new Set(candidate.meals.map(item => item.recipeId)).size !== candidate.config.uniqueRecipes) { setNotice(`Keep exactly ${candidate.config.uniqueRecipes} distinct recipes in this saved week, or regenerate it with a new count.`); return; }
    }
    const updated = planWithChange(activePlan, mealId, changes);
    updateState(current => ({ ...current, plans: current.plans.map(plan => plan.id === updated.id ? updated : plan) }));
  };
  const replaceOne = (mealId: string) => {
    if (!state || !activePlan) return;
    try {
      const updated = replaceMeal(activePlan, mealId, state.recipes, activePlan.config.filters);
      updateState(current => ({ ...current, plans: current.plans.map(plan => plan.id === updated.id ? updated : plan) }));
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No replacement could be selected with this plan’s rules.'); }
  };
  const replaceWholeBatch = (recipeId: string) => {
    if (!state || !activePlan) return;
    try {
      const updated = replaceBatch(activePlan, recipeId, state.recipes, activePlan.config.filters);
      updateState(current => ({ ...current, plans: current.plans.map(plan => plan.id === updated.id ? updated : plan) }));
    } catch (error) { setNotice(error instanceof Error ? error.message : 'This batch could not be replaced while preserving the plan rules.'); }
  };
  const replaceChosenBatch = (recipeId:string,planId:string,oldRecipeId:string) => {
    if(!state)return;
    const plan=state.plans.find(item=>item.id===planId);
    const recipe=state.recipes.find(item=>item.id===recipeId);
    if(!plan||!recipe)return;
    try{
      const updated=replaceWithChosenBatch(plan,oldRecipeId,recipe,state.recipes);
      updateState(current=>({...current,plans:current.plans.map(item=>item.id===plan.id?updated:item)}));
      setSelectedRecipeId(null);
      setNotice('Your chosen recipe replaced the batch. Changed grocery amounts were unchecked.');
    }catch(error){setNotice(error instanceof Error?error.message:'This chosen batch could not be replaced.');}
  };
  const addToWeek = (recipeId: string, planId: string, mealId: string, servings: number) => {
    if (!state || !Number.isFinite(servings) || servings <= 0) return;
    const plan = state.plans.find(item => item.id === planId);
    const meal = plan?.meals.find(item => item.id === mealId);
    const recipe = state.recipes.find(item => item.id === recipeId);
    if (!plan || !meal || !recipe || meal.locked) { setNotice('That slot is no longer available.'); return; }
    if (!recipe.roles.includes(meal.slot)) { setNotice(`Choose a recipe marked for ${meal.slot} to use this slot.`); return; }
    const updated = planWithChange(plan, mealId, { recipeId, servings });
    if (new Set(updated.meals.map(item => item.recipeId)).size !== updated.config.uniqueRecipes) { setNotice(`This plan keeps exactly ${updated.config.uniqueRecipes} distinct recipes. Use Swap one or edit the plan settings to change that count.`); return; }
    updateState(current => ({ ...current, plans: current.plans.map(item => item.id === plan.id ? updated : item), activePlanId: plan.id }));
    setSelectedRecipeId(null);
    setNotice('Recipe added to the selected plan slot.');
  };
  const setShoppingCheck = (key: string, value: 'checked' | 'owned' | null) => {
    updateState(current => ({ ...current, shoppingChecks: { ...current.shoppingChecks, [key]: value } }));
    setChangedShoppingAmounts(current=>{const next={...current};delete next[key];return next;});
  };
  const addManualShopping = (name: string, quantityText: string) => {
    if (!activePlan) return;
    const item: ManualShoppingItem = { id: makeId('shopping'), name, quantityText, checked: false };
    updateState(current => ({ ...current, manualShopping: { ...current.manualShopping, [activePlan.id]: [...(current.manualShopping[activePlan.id] ?? []), item] } }));
  };
  const toggleManualShopping = (id: string) => {
    if (!activePlan) return;
    updateState(current => ({ ...current, manualShopping: { ...current.manualShopping, [activePlan.id]: (current.manualShopping[activePlan.id] ?? []).map(item => item.id === id ? { ...item, checked: !item.checked } : item) } }));
  };
  const removeManualShopping = (id: string) => {
    if (!activePlan) return;
    updateState(current => ({ ...current, manualShopping: { ...current.manualShopping, [activePlan.id]: (current.manualShopping[activePlan.id] ?? []).filter(item => item.id !== id) } }));
  };
  const addRecipeLog = (recipe: Recipe, servings: number, date: string) => {
    const entry = createConsumption(recipe, servings, date);
    updateState(current => ({ ...current, logs: [...current.logs, entry] }));
  };
  const addManualLog = (entry: ConsumptionEntry) => updateState(current => ({ ...current, logs: [...current.logs, entry] }));
  const deleteLog = (id: string) => updateState(current => ({ ...current, logs: current.logs.filter(entry => entry.id !== id) }));
  const setTargets = (targets: Nutrition) => updateState(current => ({ ...current, targets }));
  const exportState = () => { if (state) downloadJson(state, `meal-planner-backup-${new Date().toISOString().slice(0, 10)}.json`); };
  const readJson = async (file: File): Promise<unknown> => {
    if (!(file.type === 'application/json' || file.name.toLowerCase().endsWith('.json'))) throw new Error('Choose a JSON file.');
    if (!recipeJsonFileFits(file.size)) throw new Error(RECIPE_JSON_SIZE_MESSAGE);
    try { return JSON.parse(await file.text()); } catch { throw new Error('That file is not valid JSON.'); }
  };
  const restoreBackup = async (file: File) => {
    const parsed = await readJson(file);
    const restored = validateState(parsed);
    if (!window.confirm('Restore this backup and replace every local recipe, plan, shopping check, target, and food log?')) throw new Error('Restore cancelled.');
    stateRef.current = restored;
    setState(restored);
  };
  const importBank = async (file: File) => {
    const parsed = await readJson(file);
    const imported = validateRecipes(parsed);
    if (!state) return;
    const currentIds = new Set(state.recipes.map(recipe => recipe.id));
    const overlaps = imported.filter(recipe => currentIds.has(recipe.id));
    if (overlaps.length && !window.confirm(`${overlaps.length} recipe ID${overlaps.length === 1 ? '' : 's'} already exist on this device. Overwrite only those matching recipes with this import?`)) throw new Error('Import cancelled.');
    const merged = new Map(state.recipes.map(recipe => [recipe.id, recipe]));
    for (const recipe of imported) merged.set(recipe.id, recipe);
    updateState(current => ({ ...current, recipes: [...merged.values()] }));
  };

  if (!loaded) return <main className="app-loading"><ChefHat size={30} /><h1>Meal Planner</h1><p>Opening your recipe book…</p></main>;
  if (loadError || !state) return <main className="app-loading app-loading--error"><AlertTriangle size={30} /><h1>Recipe book unavailable</h1><p>{loadError || 'No local state could be opened.'}</p><button className="button" type="button" onClick={() => window.location.reload()}>Try again</button></main>;

  return <div className="app-shell">
    <aside className="desktop-sidebar"><a href="#week" className="brand" onClick={() => navigate('week')}><span className="brand-mark"><ChefHat size={19} /></span><span>Meal<br />Planner</span></a><nav aria-label="Primary navigation">{navItems.map(({ page: itemPage, label, icon: Icon }) => <a href={`#${itemPage}`} key={itemPage} className={page === itemPage ? 'is-active' : ''} aria-current={page === itemPage ? 'page' : undefined} onClick={() => navigate(itemPage)}><Icon size={19} /><span>{label}</span></a>)}</nav><div className="sidebar-bottom"><a href="#settings" className={page === 'settings' ? 'is-active' : ''} onClick={() => navigate('settings')}><SettingsIcon size={19} /><span>Settings</span></a><p>Private to this device</p></div></aside>
    <div className="app-main"><header className="mobile-topbar"><a className="brand" href="#week" onClick={() => navigate('week')}><span className="brand-mark"><ChefHat size={18} /></span><span>Meal Planner</span></a><a href="#settings" className="icon-button" aria-label="Open settings" onClick={() => navigate('settings')}><SettingsIcon size={20} /></a></header>{persistenceError && <div className="persistence-warning" role="alert"><AlertTriangle size={18} /><span>{persistenceError}</span></div>}{notice && <div className="app-notice" role="status">{notice}</div>}
      {page === 'week' && <PlanBuilder recipes={state.recipes} plans={state.plans} activePlan={activePlan} bookFilters={filters} onSelectPlan={selectPlan} onGenerate={generatePlan} onOpenRecipe={recipe => setSelectedRecipeId(recipe.id)} onUpdateMeal={updateMeal} onReplaceMeal={replaceOne} onReplaceBatch={replaceWholeBatch} />}
      {page === 'recipes' && <RecipeBook recipes={state.recipes} filteredRecipes={filteredRecipes} filters={filters} onFiltersChange={setFilters} onOpenRecipe={recipe => setSelectedRecipeId(recipe.id)} onAddRecipe={addRecipe} onImportFromYouTube={() => navigate('import')} />}
      {page === 'import' && <RecipeImport initialUrl={sharedImport.url} onBack={() => navigate('recipes')} onOpenExisting={openExistingYouTubeRecipe} onSaveRecipe={addRecipe} onOpenSaved={recipe => { setSelectedRecipeId(recipe.id); navigate('recipes'); }} />}
      {page === 'shopping' && <Shopping plan={activePlan} items={shoppingItems} checks={state.shoppingChecks} changedAmounts={changedShoppingAmounts} manualItems={activePlan ? state.manualShopping[activePlan.id] ?? [] : []} onSetCheck={setShoppingCheck} onAddManual={addManualShopping} onToggleManual={toggleManualShopping} onRemoveManual={removeManualShopping} />}
      {page === 'log' && <FoodLog recipes={state.recipes} plan={activePlan} logs={state.logs} targets={state.targets} onAddRecipeLog={addRecipeLog} onAddManualLog={addManualLog} onDelete={deleteLog} onTargets={setTargets} onOpenRecipe={recipe => setSelectedRecipeId(recipe.id)} />}
      {page === 'settings' && <Settings state={state} onExport={exportState} onRestore={restoreBackup} onBankImport={importBank} />}
    </div>
    <nav className="mobile-nav" aria-label="Primary navigation">{navItems.map(({ page: itemPage, label, icon: Icon }) => <a href={`#${itemPage}`} key={itemPage} className={page === itemPage ? 'is-active' : ''} aria-current={page === itemPage ? 'page' : undefined} onClick={() => navigate(itemPage)}><Icon size={20} /><span>{label}</span></a>)}</nav>
    <RecipeDetails recipe={selectedRecipe} recipes={state.recipes} plans={state.plans} activePlanId={state.activePlanId} onClose={() => setSelectedRecipeId(null)} onUpdate={updateRecipe} onAddToWeek={addToWeek} onReplaceChosenBatch={replaceChosenBatch} onStartPlanner={() => { setSelectedRecipeId(null); navigate('week'); }} />
  </div>;
}
