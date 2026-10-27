import { ArrowLeft, ArrowRight, Check, Circle, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Recipe } from '@domain/types';
import {displayNumber} from './shared';

interface WakeLockHandle { release:()=>Promise<void>; released:boolean; }
type WakeNavigator=Navigator&{wakeLock?:{request:(kind:'screen')=>Promise<WakeLockHandle>}};

export function CookMode({recipe,servings,onExit}:{recipe:Recipe;servings:number;onExit:()=>void}){
  const [step,setStep]=useState(0);
  const [checked,setChecked]=useState<string[]>([]);
  const [keepAwake,setKeepAwake]=useState(false);
  const [awakeError,setAwakeError]=useState('');
  const headingRef=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{headingRef.current?.focus();},[step]);
  useEffect(()=>{
    if(!keepAwake)return;
    let live=true;let lock:WakeLockHandle|null=null;
    const acquire=async()=>{
      if(document.visibilityState==='hidden')return;
      if(!(navigator as WakeNavigator).wakeLock){setAwakeError('This browser cannot keep the screen awake.');setKeepAwake(false);return;}
      try{const next=await (navigator as WakeNavigator).wakeLock!.request('screen');if(!live){await next.release();return;}lock=next;setAwakeError('');}
      catch{if(live){setAwakeError('Screen-awake access was not available. Your cooking steps still work.');setKeepAwake(false);}}
    };
    void acquire();const visible=()=>{if(document.visibilityState==='visible'&&(!lock||lock.released))void acquire();};
    document.addEventListener('visibilitychange',visible);
    return()=>{live=false;document.removeEventListener('visibilitychange',visible);if(lock&&!lock.released)void lock.release().catch(()=>{});};
  },[keepAwake]);
  const finished=step>=recipe.steps.length;
  const scale=recipe.baseServings&&servings>0?servings/recipe.baseServings:null;
  return <section className="cook-mode">
    <div className="cook-mode__toolbar"><button type="button" className="text-button" onClick={onExit}><ArrowLeft size={16}/> Back to recipe</button><label className="toggle-line"><input type="checkbox" checked={keepAwake} onChange={event=>setKeepAwake(event.target.checked)}/><span>Keep screen awake</span></label></div>
    {awakeError&&<p className="field-hint" role="status">{awakeError}</p>}
    <div className="cook-mode__step" aria-live="polite"><p>{finished?'Steps complete':`Step ${step+1} of ${recipe.steps.length}`}</p><h3 tabIndex={-1} ref={headingRef}>{finished?'Ready when you are.':recipe.steps[step]}</h3>{finished&&<p>Enjoy your meal. This does not automatically add anything to your food log.</p>}</div>
    <div className="cook-mode__controls"><button type="button" className="button button--quiet" disabled={step===0} onClick={()=>setStep(value=>Math.max(0,value-1))}><ArrowLeft size={17}/> Previous</button>{finished?<button type="button" className="button" onClick={()=>{setStep(0);setChecked([]);}}><RotateCcw size={17}/> Start again</button>:<button type="button" className="button" onClick={()=>setStep(value=>value+1)}>{step===recipe.steps.length-1?'Finish steps':'Next step'} <ArrowRight size={17}/></button>}</div>
    <h4>Ingredients {scale!==null?`for ${displayNumber(servings)} servings`: '— source amounts'}</h4>
    <p className="field-hint">Tap an ingredient as you use it. These checks do not change your shopping list.</p>
    <ul className="cook-ingredients">{recipe.ingredients.map(item=>{const done=checked.includes(item.id);const amount=scale!==null&&item.quantity!==null?`${displayNumber(item.quantity*scale)}${item.unit?' '+item.unit:''}`:item.quantityText;return <li key={item.id}><button type="button" className={done?'is-used':''} aria-pressed={done} onClick={()=>setChecked(current=>done?current.filter(id=>id!==item.id):[...current,item.id])}>{done?<Check size={19}/>:<Circle size={19}/>}<span>{amount&&<strong>{amount} </strong>}{item.name}</span></button></li>;})}</ul>
  </section>;
}
