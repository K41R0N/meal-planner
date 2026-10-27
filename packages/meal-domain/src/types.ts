export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'drink' | 'side' | 'condiment';
export const mealTypes: MealType[] = ['breakfast','lunch','dinner','snack','dessert','drink','side','condiment'];
export type MacroKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium';
export type Nutrition = Record<MacroKey, number | null>;
export const emptyNutrition = (): Nutrition => ({calories:null,protein:null,carbs:null,fat:null,fiber:null,sugar:null,sodium:null});
export interface IngredientLine {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  quantityText: string;
  aisle: string;
  sourceText?: string;
}
export interface Recipe {
  id: string;
  name: string;
  roles: MealType[];
  tags: string[];
  categories: string[];
  ingredients: IngredientLine[];
  steps: string[];
  baseServings: number | null;
  nutrition: Nutrition;
  reportedNutrition: Nutrition;
  nutritionBasis: 'per_serving' | 'per_recipe' | 'unspecified' | 'not_stated';
  nutritionEvidence?: string;
  sourceUrl: string | null;
  sourceName: string;
  creatorCredit: string | null;
  viewCount: number | null;
  viewCountAt: string | null;
  image: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  mealPrepRating: number | null;
  mealPrepNotes: string;
  dataGaps: string[];
  favorite: boolean;
  addedAt: string;
}
export type SortOrder = 'popular' | 'name' | 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium' | 'mealPrep' | 'newest';
export interface Filters {
  search: string;
  role: MealType | 'all';
  tags: string[];
  categories: string[];
  includeIngredients: string[];
  excludeIngredients: string[];
  ranges: Partial<Record<MacroKey, {min?:number;max?:number}>>;
  minMealPrep?: number;
  favoritesOnly: boolean;
  nutritionMode: 'perServing' | 'reported';
  sort: SortOrder;
}
export const defaultFilters = (): Filters => ({search:'',role:'all',tags:[],categories:[],includeIngredients:[],excludeIngredients:[],ranges:{},favoritesOnly:false,nutritionMode:'perServing',sort:'popular'});
export interface PlanConfig {
  weekStart: string;
  days: number;
  people: number;
  slots: MealType[];
  uniqueRecipes: number;
  filters: Filters;
}
export interface PlannedMeal {
  id: string;
  date: string;
  slot: MealType;
  recipeId: string;
  servings: number;
  locked: boolean;
}
export interface WeekPlan {
  id: string;
  config: PlanConfig;
  meals: PlannedMeal[];
  createdAt: string;
}
export interface ShoppingContribution {
  recipeId: string;
  recipeName: string;
  servings: number;
  quantity: number | null;
  quantityText: string;
}
export interface ShoppingItem {
  key: string;
  name: string;
  aisle: string;
  quantity: number | null;
  unit: string | null;
  displayQuantity: string;
  needsReview: boolean;
  notes: string[];
  contributions: ShoppingContribution[];
}
export interface ConsumptionEntry {
  id: string;
  date: string;
  recipeId: string | null;
  name: string;
  servings: number;
  nutritionSnapshot: Nutrition;
  createdAt: string;
}
export interface NutritionTotals {
  values: Record<MacroKey, number>;
  known: Record<MacroKey, number>;
  count: number;
  incomplete: boolean;
}
export interface ManualShoppingItem { id:string; name:string; quantityText:string; checked:boolean; }
export interface AppState {
  version: 1;
  recipes: Recipe[];
  plans: WeekPlan[];
  activePlanId: string | null;
  logs: ConsumptionEntry[];
  targets: Nutrition;
  shoppingChecks: Record<string, 'checked' | 'owned' | null>;
  manualShopping: Record<string, ManualShoppingItem[]>;
}
