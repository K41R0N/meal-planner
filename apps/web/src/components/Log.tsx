import { ClipboardPlus, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ConsumptionEntry, MacroKey, Nutrition, Recipe, WeekPlan } from '@domain/types';
import { emptyNutrition } from '@domain/types';
import { allMacros, displayNumber, localDate, macroLabels, macroUnits, makeId, nutrientCoverage, primaryMacros } from './shared';

interface LogProps {
  recipes: Recipe[]; plan: WeekPlan|null; logs:ConsumptionEntry[]; targets:Nutrition;
  onAddRecipeLog:(recipe:Recipe,servings:number,date:string)=>void;
  onAddManualLog:(entry:ConsumptionEntry)=>void;
  onDelete:(id:string)=>void;
  onTargets:(targets:Nutrition)=>void;
  onOpenRecipe:(recipe:Recipe)=>void;
}
const otherMacros:MacroKey[]=['fiber','sugar','sodium'];
function totalFor(entries:ConsumptionEntry[],key:MacroKey){return {key,value:entries.reduce((sum,entry)=>sum+(entry.nutritionSnapshot[key]??0),0),known:entries.filter(entry=>entry.nutritionSnapshot[key]!==null).length,complete:nutrientCoverage(entries,key)};}
function OtherNutrients({entries,label}:{entries:ConsumptionEntry[];label:string}){
  return <details className="other-nutrients"><summary>{label}</summary><dl>{otherMacros.map(key=>{const total=totalFor(entries,key);return <div key={key}><dt>{macroLabels[key]}</dt><dd>{total.known?`${displayNumber(total.value)} ${macroUnits[key]}`:'—'}<br/><small>{total.complete?'All entries covered':entries.length?`${total.known}/${entries.length} entries covered`:'No entries'}</small></dd></div>;})}</dl></details>;
}
function nonNegativeInput(value:string):number|null {const parsed=Number(value);return value.trim()===''||!Number.isFinite(parsed)||parsed<0?null:parsed;}

export function FoodLog({recipes,plan,logs,targets,onAddRecipeLog,onAddManualLog,onDelete,onTargets,onOpenRecipe}:LogProps){
  const [date,setDate]=useState(localDate());
  const [selectedRecipeId,setSelectedRecipeId]=useState('');
  const [servings,setServings]=useState('1');
  const [error,setError]=useState('');
  const [manualOpen,setManualOpen]=useState(false);
  const [manualName,setManualName]=useState('');
  const [manualNutrition,setManualNutrition]=useState<Nutrition>(emptyNutrition());
  const daily=useMemo(()=>logs.filter(entry=>entry.date===date),[logs,date]);
  const weekly=useMemo(()=>{const anchor=new Date(`${date}T12:00:00`);const day=anchor.getDay()||7;anchor.setDate(anchor.getDate()-day+1);const start=localDate(anchor);const end=new Date(anchor);end.setDate(end.getDate()+7);return logs.filter(entry=>entry.date>=start&&entry.date<localDate(end));},[logs,date]);
  const plannedRecipeIds=plan?.meals.filter(meal=>meal.date===date).map(meal=>meal.recipeId)??[];
  const selections=[...new Set([...plannedRecipeIds,...recipes.map(recipe=>recipe.id)])].map(id=>recipes.find(recipe=>recipe.id===id)).filter((recipe):recipe is Recipe=>Boolean(recipe));
  const dailyTotals=primaryMacros.map(key=>totalFor(daily,key));
  const weeklyTotals=primaryMacros.map(key=>totalFor(weekly,key));
  const recipeLog=(event:React.FormEvent)=>{event.preventDefault();const recipe=recipes.find(item=>item.id===selectedRecipeId);const amount=Number(servings);if(!recipe||!Number.isFinite(amount)||amount<=0){setError('Choose a recipe and enter a positive serving amount.');return;}try{onAddRecipeLog(recipe,amount,date);setSelectedRecipeId('');setServings('1');setError('');}catch(reason){setError(reason instanceof Error?reason.message:'This meal could not be logged.');}};
  const manualLog=(event:React.FormEvent)=>{
    event.preventDefault();
    if(!manualName.trim()||/<\/?[a-z][^>]*>/i.test(manualName)){setError('Give this entry a plain-text food name.');return;}
    if(allMacros.some(key=>manualNutrition[key]!==null&&(!Number.isFinite(manualNutrition[key])||manualNutrition[key]!<0))){setError('Nutrition values must be zero or positive, or left blank.');return;}
    onAddManualLog({id:makeId('manual-log'),date,recipeId:null,name:manualName.trim(),servings:1,nutritionSnapshot:manualNutrition,createdAt:new Date().toISOString()});
    setManualName('');setManualNutrition(emptyNutrition());setManualOpen(false);setError('');
  };
  return <section className="page log-page" aria-labelledby="log-heading">
    <header className="page-heading"><div><p className="eyebrow"><ClipboardPlus size={15}/> Actual meals, not your plan</p><h1 id="log-heading">Food log</h1><p>Each entry keeps the nutrition known at the moment you log it.</p></div><label className="date-picker"><span>Log date</span><input type="date" required value={date} onChange={event=>{if(event.target.value)setDate(event.target.value);}}/></label></header>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="log-layout">
      <section className="log-entry-panel"><h2>Log a recipe</h2><form onSubmit={recipeLog} className="stack-form"><label className="field"><span>From this week or your book</span><select value={selectedRecipeId} onChange={event=>setSelectedRecipeId(event.target.value)}><option value="">Choose a recipe</option>{selections.map(recipe=><option key={recipe.id} value={recipe.id}>{plannedRecipeIds.includes(recipe.id)?'This plan · ':''}{recipe.name}</option>)}</select></label><label className="field"><span>Actual servings</span><input type="number" min="0.1" step="0.1" value={servings} onChange={event=>setServings(event.target.value)}/></label><button type="submit" className="button"><Plus size={18}/> Add to log</button></form><button type="button" className="text-button" onClick={()=>setManualOpen(value=>!value)}>{manualOpen?'Cancel manual entry':'Add a manual food'}</button>
        {manualOpen&&<form className="manual-log-form" onSubmit={manualLog}><label className="field"><span>Food name</span><input required value={manualName} onChange={event=>setManualName(event.target.value)}/></label><p className="field-hint">Enter total nutrition for this entry, not a per-portion value. Empty means unknown.</p><div className="nutrition-editor">{allMacros.map(key=><label className="field" key={key}><span>{macroLabels[key]} ({macroUnits[key]})</span><input type="number" min="0" step="any" inputMode="decimal" value={manualNutrition[key]??''} onChange={event=>setManualNutrition({...manualNutrition,[key]:nonNegativeInput(event.target.value)})}/></label>)}</div><button className="button" type="submit">Save manual entry</button></form>}
      </section>
      <section className="daily-summary"><h2>{date}</h2><div className="nutrition-total-grid">{dailyTotals.map(({key,value,known,complete})=>{const target=targets[key];return <div className={`total-cell ${complete?'':'is-incomplete'}`} key={key}><span>{macroLabels[key]}</span><strong>{known?`${displayNumber(value)} ${macroUnits[key]}`:'—'}</strong><small>{complete?'All entries covered':known?`Partial · ${known}/${daily.length} entries`:daily.length?'No confirmed values':'No entries'}</small>{target!==null&&complete&&<em>{displayNumber(Math.max(0,target-value))} {macroUnits[key]} remaining</em>}</div>;})}</div>
        {dailyTotals.some(total=>!total.complete&&daily.length)&&<p className="coverage-note">Some meals are missing a confirmed nutrition basis or values. Unknown amounts are not treated as zero.</p>}
        <OtherNutrients entries={daily} label="Other nutrients today"/>
        <h3>This week</h3><div className="weekly-mini-totals">{weeklyTotals.map(({key,value,known,complete})=><span key={key}>{macroLabels[key]}: {known?`${displayNumber(value)} ${macroUnits[key]}${complete?'':' · partial'}`:weekly.length?'Unknown':'No entries'}</span>)}</div><OtherNutrients entries={weekly} label="Other nutrients this week"/>
      </section>
    </div>
    <section className="targets-section"><h2>Personal targets</h2><p className="quiet">Optional. Leave blank to avoid a target. Remaining values appear only when every entry for that day is covered.</p><div className="nutrition-editor">{allMacros.map(key=><label className="field" key={key}><span>{macroLabels[key]} ({macroUnits[key]})</span><input type="number" min="0" step="any" inputMode="decimal" value={targets[key]??''} onChange={event=>onTargets({...targets,[key]:nonNegativeInput(event.target.value)})} placeholder="No target"/></label>)}</div></section>
    <section className="log-list"><h2>Logged on {date}</h2>{daily.length?daily.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(entry=>{
      const source=entry.recipeId?recipes.find(recipe=>recipe.id===entry.recipeId):null;
      return <article className="log-entry" key={entry.id}><div><strong>{entry.name}</strong><span>{entry.recipeId?`${entry.servings} serving${entry.servings===1?'':'s'}`:'Manual total entry'}</span>{source&&<button type="button" className="text-button text-button--inline" onClick={()=>onOpenRecipe(source)}>View recipe</button>}<OtherNutrients entries={[entry]} label="Other nutrient snapshot"/></div><div className="log-entry__macros">{primaryMacros.map(key=><span key={key}>{key==='calories'?'Cal':key.slice(0,1).toUpperCase()}: {entry.nutritionSnapshot[key]===null?'—':`${displayNumber(entry.nutritionSnapshot[key])}${macroUnits[key]}`}</span>)}</div><button type="button" className="icon-button icon-button--small" aria-label={`Delete ${entry.name} log entry`} onClick={()=>onDelete(entry.id)}><Trash2 size={17}/></button></article>;
    }):<div className="empty-state empty-state--short"><h3>No meals logged yet</h3><p>Log what you actually eat; planning does not add entries here.</p></div>}</section>
  </section>;
}
