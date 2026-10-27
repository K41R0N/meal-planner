import { ExternalLink, Heart, Minus, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { validateRecipes } from '@domain/index';
import { emptyNutrition, mealTypes, type IngredientLine, type MacroKey, type Recipe, type WeekPlan } from '@domain/types';
import { chosenBatchTargets } from '../state-utils';
import { allMacros, commaList, displayNumber, humanRole, isPositiveNumber, macroLabels, macroValue, makeId } from './shared';

interface RecipeDetailsProps {
  recipe: Recipe | null;
  recipes: Recipe[];
  plans: WeekPlan[];
  activePlanId: string | null;
  onClose: () => void;
  onUpdate: (recipe: Recipe) => void;
  onAddToWeek: (recipeId:string,planId:string,mealId:string,servings:number) => void;
  onReplaceChosenBatch: (recipeId:string,planId:string,oldRecipeId:string) => void;
  onStartPlanner: () => void;
}
function normalizedForm(recipe:Recipe,basis=recipe.nutritionBasis,yieldValue=recipe.baseServings):Recipe {
  const nutrition=emptyNutrition();
  if(basis==='per_serving')Object.assign(nutrition,recipe.reportedNutrition);
  if(basis==='per_recipe'&&yieldValue&&yieldValue>0)for(const key of allMacros)nutrition[key]=recipe.reportedNutrition[key]===null?null:recipe.reportedNutrition[key]!/yieldValue;
  return {...recipe,nutritionBasis:basis,baseServings:yieldValue,nutrition};
}

export function RecipeDetails({recipe,recipes,plans,activePlanId,onClose,onUpdate,onAddToWeek,onReplaceChosenBatch,onStartPlanner}:RecipeDetailsProps){
  const dialogRef=useRef<HTMLElement>(null);
  const [editing,setEditing]=useState(false);
  const [gapsOpen,setGapsOpen]=useState(false);
  const [servings,setServings]=useState('1');
  const [selectedMealId,setSelectedMealId]=useState('');
  const [selectedBatchId,setSelectedBatchId]=useState('');
  const [selectionMode,setSelectionMode]=useState<'batch'|'slot'>('batch');
  const [form,setForm]=useState<Recipe|null>(recipe);
  const [tagsText,setTagsText]=useState('');
  const [categoriesText,setCategoriesText]=useState('');
  const [stepsText,setStepsText]=useState('');
  const [editError,setEditError]=useState('');
  const activePlan=plans.find(plan=>plan.id===activePlanId)??null;
  const openMeals=useMemo(()=>activePlan?.meals.filter(meal=>!meal.locked)??[],[activePlan]);
  const compatibleOpenMeals=useMemo(()=>openMeals.filter(meal=>Boolean(recipe?.roles.includes(meal.slot)&&activePlan&&new Set(activePlan.meals.map(existing=>existing.id===meal.id?recipe.id:existing.recipeId)).size===activePlan.config.uniqueRecipes)),[openMeals,recipe,activePlan]);
  const batchTargets=useMemo(()=>recipe&&activePlan?chosenBatchTargets(activePlan,recipe,recipes):[],[recipe,activePlan,recipes]);

  useEffect(()=>{setEditing(false);setForm(recipe);setTagsText(recipe?.tags.join(', ')??'');setCategoriesText(recipe?.categories.join(', ')??'');setStepsText(recipe?.steps.join('\n')??'');setServings('1');setSelectedMealId('');setSelectedBatchId('');setSelectionMode('batch');setGapsOpen(false);setEditError('');},[recipe?.id]);
  useEffect(()=>{
    if(!recipe)return;
    const previous=document.activeElement as HTMLElement|null;
    const timeout=window.setTimeout(()=>dialogRef.current?.querySelector<HTMLElement>('button,input,select,textarea,a')?.focus(),0);
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();}
      if(event.key==='Tab'){
        const controls=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')??[]).filter(control=>control.offsetParent!==null);
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    window.addEventListener('keydown',keydown);
    return()=>{window.clearTimeout(timeout);window.removeEventListener('keydown',keydown);previous?.focus();};
  },[recipe?.id]);
  if(!recipe||!form)return null;
  const patch=(changes:Partial<Recipe>)=>setForm({...form,...changes});
  const updateNutrition=(key:MacroKey,value:string)=>{
    const parsed=value.trim()===''?null:Number(value);
    patch({nutrition:{...form.nutrition,[key]:Number.isFinite(parsed)?parsed:null}});
  };
  const updateReported=(key:MacroKey,value:string)=>{
    const parsed=value.trim()===''?null:Number(value);
    const next={...form,reportedNutrition:{...form.reportedNutrition,[key]:Number.isFinite(parsed)?parsed:null}};
    setForm(normalizedForm(next));
  };
  const patchIngredient=(id:string,changes:Partial<IngredientLine>)=>patch({ingredients:form.ingredients.map(ingredient=>ingredient.id===id?{...ingredient,...changes}:ingredient)});
  const saveEdits=(event:React.FormEvent)=>{
    event.preventDefault();
    try{
      const next=validateRecipes([{...form,tags:commaList(tagsText),categories:commaList(categoriesText),steps:stepsText.split('\n').map(step=>step.trim()).filter(Boolean)}])[0];
      onUpdate(next);setForm(next);setEditing(false);setEditError('');
    }catch(error){setEditError(error instanceof Error?error.message:'Check the recipe details.');}
  };
  const toggleEditing=()=>{if(editing){setForm(recipe);setEditing(false);setEditError('');}else{setForm(recipe);setTagsText(recipe.tags.join(', '));setCategoriesText(recipe.categories.join(', '));setStepsText(recipe.steps.join('\n'));setEditing(true);}};
  const ingredientScale=form.baseServings&&Number(servings)>0?Number(servings)/form.baseServings:null;
  const selectedMeal=compatibleOpenMeals.find(meal=>meal.id===selectedMealId);
  const selectedBatch=batchTargets.find(batch=>batch.id===selectedBatchId);

  return <div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="recipe-details" role="dialog" aria-modal="true" aria-labelledby="recipe-detail-title" ref={dialogRef}>
      <header className="recipe-details__header"><div><p className="eyebrow">{form.sourceName||'Personal recipe'}</p><h2 id="recipe-detail-title">{form.name}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close recipe"><X/></button></header>
      <div className="recipe-details__scroll">
        <div className="recipe-detail-actions"><button type="button" className={`button button--quiet ${form.favorite?'is-favorite':''}`} onClick={()=>{const next={...recipe,favorite:!recipe.favorite};setForm(next);onUpdate(next);}}><Heart size={17} fill={form.favorite?'currentColor':'none'}/> {form.favorite?'Saved favorite':'Save favorite'}</button><button type="button" className="button button--quiet" onClick={toggleEditing}><Pencil size={17}/> {editing?'Discard edits':'Edit details'}</button></div>
        {editing?<form className="detail-section edit-recipe" onSubmit={saveEdits}>
          <h3>Personal recipe details</h3>{editError&&<p className="form-error" role="alert">{editError}</p>}
          <div className="form-grid">
            <label className="field field--wide"><span>Recipe name</span><input required value={form.name} onChange={event=>patch({name:event.target.value})}/></label>
            <label className="field"><span>Tags</span><input value={tagsText} onChange={event=>setTagsText(event.target.value)} placeholder="comma separated"/></label>
            <label className="field"><span>Categories</span><input value={categoriesText} onChange={event=>setCategoriesText(event.target.value)} placeholder="comma separated"/></label>
            <fieldset className="filter-fieldset field--wide"><legend>Meal roles</legend><div className="chip-row">{mealTypes.map(role=><button type="button" className={`chip ${form.roles.includes(role)?'is-active':''}`} key={role} aria-pressed={form.roles.includes(role)} onClick={()=>patch({roles:form.roles.includes(role)?form.roles.filter(value=>value!==role):[...form.roles,role]})}>{humanRole(role)}</button>)}</div></fieldset>
            <label className="field"><span>Meal-prep rating</span><select value={form.mealPrepRating??''} onChange={event=>patch({mealPrepRating:event.target.value===''?null:Number(event.target.value)})}><option value="">Unrated</option>{[0,1,2,3,4,5].map(value=><option key={value} value={value}>{value}/5</option>)}</select></label>
            <label className="field"><span>Base yield / servings</span><input type="number" min="0.25" step="0.25" value={form.baseServings??''} onChange={event=>{const yieldValue=event.target.value===''?null:Number(event.target.value);setForm(form.nutritionBasis==='per_recipe'?normalizedForm(form,form.nutritionBasis,yieldValue):{...form,baseServings:yieldValue});}}/></label>
            <label className="field field--wide"><span>Prep notes</span><textarea value={form.mealPrepNotes} onChange={event=>patch({mealPrepNotes:event.target.value})} placeholder="Your notes, portions, freezer plan…"/></label>
          </div>
          <h4>Ingredients and shopping aisles</h4><p className="field-hint">Amounts describe the base recipe yield above. An empty amount stays unknown. Original ingredient evidence remains attached when available.</p>
          <div className="ingredient-edit-list">{form.ingredients.map(ingredient=><fieldset className="ingredient-edit-row" key={ingredient.id}>
            <label className="field"><span>Ingredient</span><input required value={ingredient.name} onChange={event=>patchIngredient(ingredient.id,{name:event.target.value})}/></label>
            <label className="field"><span>Amount</span><input type="number" min="0" step="any" value={ingredient.quantity??''} onChange={event=>patchIngredient(ingredient.id,{quantity:event.target.value===''?null:Number(event.target.value)})}/></label>
            <label className="field"><span>Unit</span><input value={ingredient.unit??''} onChange={event=>patchIngredient(ingredient.id,{unit:event.target.value.trim()||null})} placeholder="g, ml, tsp, count…"/></label>
            <label className="field"><span>Raw amount / note</span><input value={ingredient.quantityText} onChange={event=>patchIngredient(ingredient.id,{quantityText:event.target.value})} placeholder="to taste, 1 tin…"/></label>
            <label className="field"><span>Shopping aisle</span><input required value={ingredient.aisle} onChange={event=>patchIngredient(ingredient.id,{aisle:event.target.value})}/></label>
            <button type="button" className="icon-button icon-button--small" aria-label={`Remove ${ingredient.name}`} disabled={form.ingredients.length===1} onClick={()=>patch({ingredients:form.ingredients.filter(value=>value.id!==ingredient.id)})}><Trash2 size={16}/></button>
          </fieldset>)}</div>
          <button type="button" className="button button--quiet" onClick={()=>patch({ingredients:[...form.ingredients,{id:makeId('ingredient'),name:'',quantity:null,unit:null,quantityText:'',aisle:'other'}]})}><Plus size={16}/> Add ingredient</button>
          <label className="field steps-editor"><span>Cooking steps — one per line</span><textarea rows={6} value={stepsText} onChange={event=>setStepsText(event.target.value)}/></label>
          <h4>Nutrition basis and corrections</h4><p className="field-hint">Choose a basis only when you can confirm it. Written source evidence is retained; source values are not independently verified.</p>
          <label className="field"><span>Confirmed basis</span><select value={form.nutritionBasis} onChange={event=>setForm(normalizedForm(form,event.target.value as Recipe['nutritionBasis']))}><option value="not_stated">Not stated / unknown</option><option value="unspecified">Reported, basis unspecified</option><option value="per_serving">Per serving (confirmed)</option><option value="per_recipe">Whole recipe (confirmed)</option></select></label>
          <p className="field-hint">{form.nutritionBasis==='per_recipe'?'For whole-recipe values, edit the source-reported amounts or base yield; per-serving values update automatically.':form.nutritionBasis==='per_serving'?'These confirmed per-serving values are used for filters and logs.':'Values with an unknown basis cannot be used in serving totals. Confirm the basis first.'}</p>
          <div className="nutrition-editor">{allMacros.map(key=><label className="field" key={key}><span>{macroLabels[key]} per serving</span><input type="number" min="0" step="any" inputMode="decimal" disabled={form.nutritionBasis!=='per_serving'} value={form.nutrition[key]??''} onChange={event=>updateNutrition(key,event.target.value)} placeholder="Unknown"/></label>)}</div>
          <h4>Source-reported values</h4><p className="field-hint">Correct a transcription if needed. Confirming a basis converts these values; the original written evidence stays visible.</p>
          <div className="nutrition-editor">{allMacros.map(key=><label className="field" key={key}><span>{macroLabels[key]}</span><input type="number" min="0" step="any" inputMode="decimal" value={form.reportedNutrition[key]??''} onChange={event=>updateReported(key,event.target.value)} placeholder="Unknown"/></label>)}</div>
          <button type="submit" className="button">Save recipe edits</button>
        </form>:<>
          <section className="detail-section"><div className="detail-meta"><span>{form.roles.map(humanRole).join(' · ')||'No meal role yet'}</span>{form.mealPrepRating!==null&&<span><Star size={15}/> {displayNumber(form.mealPrepRating,0)}/5 meal prep</span>}</div>{form.tags.length>0&&<div className="chip-row">{form.tags.map(tag=><span className="chip chip--static" key={tag}>{tag}</span>)}</div>}</section>
          <section className="detail-section"><div className="section-heading"><h3>Ingredients</h3>{form.baseServings&&<label className="serving-preview"><span>Preview for</span><input type="number" min="0.25" step="0.25" value={servings} onChange={event=>setServings(event.target.value)} aria-label="Servings for ingredient preview"/><span>servings</span></label>}</div>{!form.baseServings&&<p className="field-hint">Base yield is unknown. Set it in Edit details before scaling.</p>}<ul className="ingredient-list">{form.ingredients.map(ingredient=>{const amount=ingredientScale!==null&&ingredient.quantity!==null?`${displayNumber(ingredient.quantity*ingredientScale)}${ingredient.unit?' '+ingredient.unit:''}`:ingredient.quantityText;return <li key={ingredient.id}>{amount&&<strong>{amount}</strong>} <span>{ingredient.name}</span></li>;})}</ul></section>
          <section className="detail-section"><h3>Cooking steps</h3>{form.steps.length?<ol className="steps-list">{form.steps.map((step,index)=><li key={`${index}-${step}`}>{step}</li>)}</ol>:<p className="quiet">Cooking steps have not been added.</p>}</section>
          <section className="detail-section"><h3>Nutrition</h3><div className="nutrition-comparison"><div><h4>Confirmed per serving</h4>{allMacros.map(key=><p key={key}><span>{macroLabels[key]}</span><strong>{macroValue(key,form.nutrition[key])}</strong></p>)}</div><div><h4>Reported by source</h4><p className="field-hint">Basis: {form.nutritionBasis.replace(/_/g,' ')}</p>{allMacros.map(key=><p key={key}><span>{macroLabels[key]}</span><strong>{macroValue(key,form.reportedNutrition[key])}</strong></p>)}</div></div>{form.nutritionEvidence&&<p className="source-note">{form.nutritionEvidence}</p>}</section>
          <section className="detail-section"><h3>Source</h3><p>{form.creatorCredit?form.creatorCredit+' · ':''}{form.sourceName||'Personal recipe'}</p>{form.viewCount!==null&&<p className="source-note">{new Intl.NumberFormat().format(form.viewCount)} views{form.viewCountAt?` · recorded ${form.viewCountAt}`:''}</p>}{form.sourceUrl&&<a className="source-link" href={form.sourceUrl} target="_blank" rel="noopener noreferrer">Open original source <ExternalLink size={15}/></a>}</section>
          {form.dataGaps.length>0&&<section className="detail-section data-gaps"><button type="button" className="disclosure" aria-expanded={gapsOpen} onClick={()=>setGapsOpen(value=>!value)}>{gapsOpen?<Minus size={16}/>:<Plus size={16}/>} Review missing source details</button>{gapsOpen&&<ul>{form.dataGaps.map(gap=><li key={gap}>{gap}</li>)}</ul>}</section>}
        </>}
        {!editing&&<section className="detail-section add-to-week"><h3>Use in your saved week</h3>{activePlan?<>
          <div className="chip-row"><button type="button" className={`chip ${selectionMode==='batch'?'is-active':''}`} aria-pressed={selectionMode==='batch'} onClick={()=>setSelectionMode('batch')}>Replace a recipe batch</button><button type="button" className={`chip ${selectionMode==='slot'?'is-active':''}`} aria-pressed={selectionMode==='slot'} onClick={()=>setSelectionMode('slot')}>One meal slot</button></div>
          {selectionMode==='batch'?(batchTargets.length?<><p className="field-hint">Use this chosen recipe in every occurrence of an unlocked batch. Existing portions and other recipes stay unchanged.</p><label className="field"><span>Batch to replace</span><select value={selectedBatchId} onChange={event=>setSelectedBatchId(event.target.value)}><option value="">Choose a batch</option>{batchTargets.map(batch=><option key={batch.id} value={batch.id}>{batch.name} · {batch.meals} meals · {displayNumber(batch.servings)} servings</option>)}</select></label><button type="button" className="button" disabled={!selectedBatch} onClick={()=>{if(selectedBatch)onReplaceChosenBatch(form.id,activePlan.id,selectedBatch.id);}}>Replace batch with this recipe</button></>:<p className="quiet">No unlocked batch matches this recipe's roles and the saved filters, or this recipe is already in the week. Unlock the batch, adjust the plan rules, or use a matching individual slot.</p>):(compatibleOpenMeals.length?<><label className="field"><span>Open plan slot</span><select value={selectedMealId} onChange={event=>setSelectedMealId(event.target.value)}><option value="">Choose a slot</option>{compatibleOpenMeals.map(meal=><option key={meal.id} value={meal.id}>{meal.date} · {humanRole(meal.slot)}{meal.recipeId===form.id?' (already here)':''}</option>)}</select></label><label className="field"><span>Servings</span><input type="number" min="0.25" step="0.25" value={servings} onChange={event=>setServings(event.target.value)}/></label><button type="button" className="button" disabled={!selectedMeal||!isPositiveNumber(servings)} onClick={()=>{if(selectedMeal&&isPositiveNumber(servings))onAddToWeek(form.id,activePlan.id,selectedMeal.id,Number(servings));}}>Use in selected slot</button></>:<p className="quiet">No matching open slot keeps the configured distinct-recipe count. Replace a whole batch instead.</p>)}
        </>:<><p className="quiet">Create a week first, then choose recipes or replace prepared batches.</p><button type="button" className="button" onClick={onStartPlanner}>Start a plan</button></>}</section>}
      </div>
    </section>
  </div>;
}
