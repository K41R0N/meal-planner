import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateRecipes,generateWeek,buildShoppingList} from '../packages/meal-domain/src/index';
import {defaultFilters,emptyNutrition,type AppState} from '../packages/meal-domain/src/types';
import {chosenBatchTargets,replaceWithChosenBatch,reconcileShoppingChecks} from '../apps/web/src/state-utils';

const recipes=validateRecipes(JSON.parse(fs.readFileSync('apps/web/public/data/recipe-bank.json','utf8')));
const makePlan=()=>generateWeek(recipes,{weekStart:'2026-10-26',days:7,people:1,slots:['lunch','dinner'],uniqueRecipes:4,filters:defaultFilters()});

test('a user-chosen recipe can replace a repeated whole batch without count drift',()=>{
  const plan=makePlan();
  const chosen=recipes.find(recipe=>chosenBatchTargets(plan,recipe,recipes).length>0)!;
  assert.ok(chosen);
  const target=chosenBatchTargets(plan,chosen,recipes)[0];
  const next=replaceWithChosenBatch(plan,target.id,chosen,recipes);
  assert.equal(new Set(next.meals.map(meal=>meal.recipeId)).size,4);
  assert.equal(next.meals.filter(meal=>meal.recipeId===target.id).length,0);
  assert.equal(next.meals.filter(meal=>meal.recipeId===chosen.id).length,target.meals);
  assert.deepEqual(next.meals.map(meal=>[meal.id,meal.servings]),plan.meals.map(meal=>[meal.id,meal.servings]));
  const locked={...plan,meals:plan.meals.map(meal=>meal.recipeId===target.id?{...meal,locked:true}:meal)};
  assert.throws(()=>replaceWithChosenBatch(locked,target.id,chosen,recipes));
});

test('shopping checks survive unchanged amounts but increased portions are unchecked',()=>{
  const plan=makePlan();
  const items=buildShoppingList(plan,recipes);
  const checks=Object.fromEntries(items.map(item=>[`${plan.id}:${item.key}`,'checked' as const]));
  const state:AppState={version:1,recipes,plans:[plan],activePlanId:plan.id,logs:[],targets:emptyNutrition(),shoppingChecks:checks,manualShopping:{}};
  assert.deepEqual(reconcileShoppingChecks(state,{...state,plans:[{...plan}]}).shoppingChecks,checks);
  const changed={...plan,meals:plan.meals.map(meal=>({...meal,servings:meal.servings*2}))};
  const next=reconcileShoppingChecks(state,{...state,plans:[changed]});
  const oldByKey=new Map(items.map(item=>[item.key,item.displayQuantity]));
  const changedItems=buildShoppingList(changed,recipes).filter(item=>oldByKey.get(item.key)!==item.displayQuantity);
  assert.ok(changedItems.length>0);
  for(const item of changedItems)assert.equal(next.shoppingChecks[`${plan.id}:${item.key}`],undefined);
});

import {parseIngredientText} from '../apps/web/src/components/shared';
test('manual ingredient entry keeps descriptors and only parses explicit known units',()=>{
  const tomatoes=parseIngredientText('2 cherry tomatoes');assert.equal(tomatoes.name,'cherry tomatoes');assert.equal(tomatoes.quantity,2);assert.equal(tomatoes.unit,null);
  const chicken=parseIngredientText('200g chicken breast');assert.equal(chicken.quantity,200);assert.equal(chicken.unit,'g');assert.equal(chicken.name,'chicken breast');
  const oil=parseIngredientText('1/2 tbsp olive oil');assert.equal(oil.quantity,0.5);assert.equal(oil.unit,'tbsp');assert.equal(oil.name,'olive oil');
  const range=parseIngredientText('1-2 tbsp honey');assert.equal(range.quantity,null);assert.equal(range.name,'1-2 tbsp honey');
});
