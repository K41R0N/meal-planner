import { buildShoppingList, filterRecipes } from '@domain/index';
import type { AppState, Recipe, ShoppingItem, WeekPlan } from '@domain/types';

export function shoppingSignature(item: ShoppingItem): string {
  return JSON.stringify([item.displayQuantity,item.unit,item.needsReview,item.notes]);
}

export function reconcileShoppingChecks(current: AppState, next: AppState): AppState {
  if (current.plans === next.plans && current.recipes === next.recipes) return next;
  const checks={...next.shoppingChecks};
  for (const plan of next.plans) {
    const previous=current.plans.find(item=>item.id===plan.id);
    if (!previous) continue;
    const oldItems=new Map(buildShoppingList(previous,current.recipes).map(item=>[item.key,shoppingSignature(item)]));
    const newItems=new Map(buildShoppingList(plan,next.recipes).map(item=>[item.key,shoppingSignature(item)]));
    for (const [key,oldSignature] of oldItems) {
      if (newItems.get(key)!==oldSignature) delete checks[`${plan.id}:${key}`];
    }
  }
  return {...next,shoppingChecks:checks};
}

export function chosenBatchTargets(plan: WeekPlan, recipe: Recipe, recipes: Recipe[]): Array<{id:string;name:string;meals:number;servings:number}> {
  if (!filterRecipes([recipe],plan.config.filters).length) return [];
  if (plan.meals.some(meal=>meal.recipeId===recipe.id)) return [];
  const ids=[...new Set(plan.meals.map(meal=>meal.recipeId))];
  return ids.flatMap(id=>{
    const meals=plan.meals.filter(meal=>meal.recipeId===id);
    if(meals.some(meal=>meal.locked||!recipe.roles.includes(meal.slot)))return [];
    return [{id,name:recipes.find(value=>value.id===id)?.name??'Recipe batch',meals:meals.length,servings:meals.reduce((sum,meal)=>sum+meal.servings,0)}];
  });
}

export function replaceWithChosenBatch(plan: WeekPlan, oldRecipeId: string, recipe: Recipe, recipes: Recipe[]): WeekPlan {
  if(!chosenBatchTargets(plan,recipe,recipes).some(target=>target.id===oldRecipeId)) {
    throw new Error('Choose an unlocked batch whose meal roles and saved filters match this recipe. The replacement must keep the configured recipe count.');
  }
  const updated={...plan,meals:plan.meals.map(meal=>meal.recipeId===oldRecipeId?{...meal,recipeId:recipe.id}:meal)};
  if(new Set(updated.meals.map(meal=>meal.recipeId)).size!==updated.config.uniqueRecipes)throw new Error('This replacement would change the configured distinct-recipe count.');
  return updated;
}
