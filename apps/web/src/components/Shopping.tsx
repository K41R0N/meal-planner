import { Check, ChevronDown, Clipboard, PackagePlus, ShoppingBasket, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ManualShoppingItem, ShoppingItem, WeekPlan } from '@domain/types';

interface ShoppingProps {
  plan: WeekPlan | null;
  items: ShoppingItem[];
  checks: Record<string, 'checked' | 'owned' | null>;
  changedAmounts: Record<string,string>;
  manualItems: ManualShoppingItem[];
  onSetCheck: (key: string, value: 'checked' | 'owned' | null) => void;
  onAddManual: (name: string, quantityText: string) => void;
  onToggleManual: (id: string) => void;
  onRemoveManual: (id: string) => void;
}

function readableAisle(aisle: string): string {
  return aisle.replace(/[_-]/g,' ').replace(/\b\w/g,char=>char.toUpperCase()) || 'Review';
}
function itemText(items: ShoppingItem[], manuals: ManualShoppingItem[], checks: ShoppingProps['checks'], planId:string):string {
  const lines=items.filter(item=>!checks[`${planId}:${item.key}`]).map(item=>`${item.displayQuantity?item.displayQuantity+' ':''}${item.name}${item.needsReview?' (review amount)':''}`);
  for(const item of manuals)if(!item.checked)lines.push(`${item.quantityText?item.quantityText+' ':''}${item.name}`);
  return lines.join('\n');
}

export function Shopping({plan,items,checks,changedAmounts,manualItems,onSetCheck,onAddManual,onToggleManual,onRemoveManual}:ShoppingProps){
  const [name,setName]=useState('');
  const [quantity,setQuantity]=useState('');
  const [toast,setToast]=useState('');
  const grouped=useMemo(()=>items.reduce<Record<string,ShoppingItem[]>>((groups,item)=>{(groups[item.aisle||'review']??=[]).push(item);return groups;},{}),[items]);
  const outstanding=plan?items.filter(item=>!checks[`${plan.id}:${item.key}`]).length+manualItems.filter(item=>!item.checked).length:0;
  const addManual=(event:React.FormEvent)=>{event.preventDefault();if(!name.trim())return;onAddManual(name.trim(),quantity.trim());setName('');setQuantity('');};
  const copy=async()=>{
    if(!plan)return;
    const text=itemText(items,manualItems,checks,plan.id);
    if(!text){setToast('Nothing left to copy.');return;}
    try{await navigator.clipboard.writeText(text);setToast('Shopping list copied.');}
    catch{
      const input=document.createElement('textarea');input.value=text;input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.select();
      try{if(!document.execCommand('copy'))throw new Error('Copy unavailable');setToast('Shopping list copied.');}
      catch{setToast('Copy is unavailable in this browser.');}
      input.remove();
    }
    window.setTimeout(()=>setToast(''),3000);
  };
  return <section className="page shopping-page" aria-labelledby="shopping-heading">
    <header className="page-heading"><div><p className="eyebrow"><ShoppingBasket size={15}/> Derived from your saved week</p><h1 id="shopping-heading">Shopping</h1><p>{plan?`${outstanding} ${outstanding===1?'item':'items'} to pick up`:'Choose a saved week to build a list.'}</p></div>{plan&&<button type="button" className="button button--quiet" onClick={copy}><Clipboard size={18}/> Copy list</button>}</header>
    {toast&&<div className="toast" role="status">{toast}</div>}
    {!plan?<div className="empty-state"><ShoppingBasket size={30}/><h2>No plan, no list</h2><p>Generate or select a saved week and compatible ingredient quantities will be combined here.</p></div>:<>
      <p className="field-hint">Plan changes recalculate amounts. Changed items are unchecked; unchanged items keep their status. Edit a recipe's ingredients to change its shopping aisle.</p>
      {items.length===0&&manualItems.length===0?<div className="empty-state"><ShoppingBasket size={30}/><h2>This week has no ingredients to list</h2><p>Add recipes with ingredients to the plan.</p></div>:<div className="shopping-groups">
        {Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([aisle,aisleItems])=><section className="shopping-group" key={aisle}><h2>{readableAisle(aisle)}</h2>{aisleItems.map(item=>{
          const key=`${plan.id}:${item.key}`;const state=checks[key]??null;const changed=changedAmounts[key];
          return <article className={`shopping-item ${state?'is-done':''} ${changed?'has-changed-amount':''}`} key={item.key}>
            <label className="check-label"><input type="checkbox" checked={state==='checked'} onChange={event=>onSetCheck(key,event.target.checked?'checked':null)}/><span className="check-visual">{state==='checked'&&<Check size={14}/>}</span><span><strong>{item.displayQuantity?item.displayQuantity+' ':''}{item.name}</strong>{item.needsReview&&<small>Review amount / unit</small>}{changed&&<small className="quantity-changed">Updated — previously {changed}. Review this amount.</small>}</span></label>
            <div className="shopping-item__actions"><button type="button" className={`owned-button ${state==='owned'?'is-owned':''}`} aria-pressed={state==='owned'} onClick={()=>onSetCheck(key,state==='owned'?null:'owned')}>{state==='owned'?'Already have':'Have it'}</button><details><summary>Sources <ChevronDown size={15}/></summary><ul>{item.contributions.map((contribution,index)=><li key={`${contribution.recipeId}-${index}`}>{contribution.recipeName} · {contribution.quantityText||'amount to review'} · {contribution.servings} servings</li>)}</ul>{item.notes.length>0&&<p className="field-hint">{item.notes.join(' ')}</p>}</details></div>
          </article>;
        })}</section>)}
      </div>}
      <form className="manual-shopping-form" onSubmit={addManual}><h2><PackagePlus size={19}/> Add an item</h2><label className="field"><span>Item</span><input required value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. dish soap"/></label><label className="field"><span>Amount / note</span><input value={quantity} onChange={event=>setQuantity(event.target.value)} placeholder="Optional"/></label><button type="submit" className="button button--quiet">Add</button></form>
      {manualItems.length>0&&<section className="shopping-group manual-group"><h2>Added by you</h2>{manualItems.map(item=><article className={`shopping-item ${item.checked?'is-done':''}`} key={item.id}><label className="check-label"><input type="checkbox" checked={item.checked} onChange={()=>onToggleManual(item.id)}/><span className="check-visual">{item.checked&&<Check size={14}/>}</span><span><strong>{item.quantityText?item.quantityText+' ':''}{item.name}</strong></span></label><button type="button" className="icon-button icon-button--small" aria-label={`Remove ${item.name}`} onClick={()=>onRemoveManual(item.id)}><Trash2 size={16}/></button></article>)}</section>}
    </>}
  </section>;
}
