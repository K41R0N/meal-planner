import type {
  ConsumptionEntry,
  Filters,
  ManualShoppingItem,
  MealType,
  Nutrition,
  Recipe,
} from './types';

export type FoodStorage = 'unconfirmed' | 'fridge' | 'freezer' | 'other';
export interface CookingWindow {
  id: string;
  date: string;
  startTime: string;
  availableMinutes: number;
}
export interface RecipeProfile {
  yieldUnit: string;
  sourceUnitsPerPortion: number;
  portionSizeConfirmed: boolean;
  activeMinutes: number | null;
  elapsedMinutes: number | null;
  reheatMinutes: number | null;
  equipment: string[];
  equipmentConfirmed: boolean;
  reheatNotes: string;
  notes: string;
}
export interface CookingTimer {
  id: string;
  label: string;
  durationSeconds: number;
  endsAt: number | null;
  remainingSeconds: number;
}
export interface CookingSession {
  id: string;
  recipeId: string;
  recipeSnapshot: Recipe;
  sourceServings: number;
  stepIndex: number;
  checkedIngredientIds: string[];
  timers: CookingTimer[];
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  weekId: string | null;
  choiceId: string | null;
}
export interface PreparedBatch {
  id: string;
  sessionId: string;
  recipeId: string;
  recipeSnapshot: Recipe;
  preparedSourceServings: number;
  actualYield: number;
  yieldUnit: string;
  nutritionPerUnit: Nutrition;
  madeAt: string;
  storage: FoodStorage;
  storageNotes: string;
  reheatNotes: string;
  weekId: string | null;
  choiceId: string | null;
}
export interface DailyChoice {
  id: string;
  date: string;
  slot: MealType;
  recipeId: string;
  origin: 'week' | 'pinned' | 'book' | 'ready';
  useId: string | null;
  batchId: string | null;
  sessionId: string | null;
  logId: string | null;
}
export interface BatchChoice {
  id: string;
  recipeId: string;
  sourceServings: number;
  portions: number;
  sourceUnitsPerPortion: number;
  windowId: string | null;
  locked: boolean;
  readyBatchId: string | null;
  reuseReady: boolean;
  shoppingIntentId: string | null;
  explanations: string[];
  timingFit: 'confirmed' | 'unknown' | 'over_budget';
}
export interface BatchUse {
  id: string;
  choiceId: string;
  date: string;
  slot: MealType;
  portions: number;
  locked: boolean;
  skipped: boolean;
}
export interface BatchWeek {
  id: string;
  label: string;
  weekStart: string;
  days: number;
  people: number;
  slots: MealType[];
  windows: CookingWindow[];
  choices: BatchChoice[];
  uses: BatchUse[];
  confirmed: boolean;
  createdAt: string;
  legacyPlanId: string | null;
}
export interface ShoppingIntent {
  id: string;
  recipeId: string;
  recipeSnapshot: Recipe;
  sourceServings: number;
  createdAt: string;
  fulfilled: boolean;
}
export interface PurchaseMatch {
  id: string;
  names: string[];
  purchaseName: string;
  prepNote: string;
  confirmedAt: string;
}
export interface GroceryCoverage {
  ownedQuantity: number | null;
  boughtQuantity: number | null;
  ownedUnspecified: boolean;
  boughtUnspecified: boolean;
  requiredAtCheck: number | null;
  intentionIds: string[];
  scopeId: string;
  updatedAt: string;
}
export interface PurchaseRecord {
  id: string;
  itemKey: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  intentionIds: string[];
  scopeId: string;
  purchasedAt: string;
}
export interface BatchPlanRequest {
  weekStart: string;
  days: number;
  people: number;
  slots: MealType[];
  distinctRecipes: number;
  targetPortions: number;
  windows: CookingWindow[];
  filters: Filters;
  strictTiming: boolean;
  reuseReady: boolean;
  reuseOneOffs: boolean;
}
export interface ExperienceState {
  version: 1;
  dailyChoices: DailyChoice[];
  sessions: CookingSession[];
  batches: PreparedBatch[];
  weeks: BatchWeek[];
  activeWeekId: string | null;
  oneOffs: ShoppingIntent[];
  recipeProfiles: Record<string, RecipeProfile>;
  purchaseMatches: PurchaseMatch[];
  groceryCoverage: Record<string, GroceryCoverage>;
  purchases: PurchaseRecord[];
  manualItems: ManualShoppingItem[];
  lastPlanRequest: BatchPlanRequest | null;
  groceryChanges: Record<string, string>;
  aisleOverrides: Record<string, string>;
  preferredSlot: MealType;
}
export interface TodayContext {
  choice: DailyChoice | null;
  recipe: Recipe | null;
  session: CookingSession | null;
  batch: PreparedBatch | null;
  availableUnits: number;
  use: BatchUse | null;
  status: 'uncooked' | 'cooking' | 'ready' | 'eaten' | 'empty';
  reason: string;
  plannedSourceServings: number;
}
export interface PurchaseContribution {
  intentionId: string;
  recipeId: string;
  recipeName: string;
  quantity: number | null;
  sourceText: string;
  prepNote: string;
}
export interface PurchaseItem {
  key: string;
  name: string;
  aisle: string;
  quantity: number | null;
  unit: string | null;
  displayQuantity: string;
  remainingQuantity: number | null;
  remainingText: string;
  covered: boolean;
  needsReview: boolean;
  changedFrom: string | null;
  coverage: GroceryCoverage | null;
  contributions: PurchaseContribution[];
  intentionIds: string[];
  notes: string[];
}
export interface PurchaseList {
  scopeId: string;
  items: PurchaseItem[];
  shared: PurchaseItem[];
  excluded: PurchaseItem[];
  matches: Array<{ names: string[]; purchaseName: string; prepNote: string }>;
}
export interface EatRequest {
  batchId: string;
  logId: string;
  units: number;
  useId: string | null;
}
export interface SwapRequest {
  scope: 'batch' | 'meal';
  weekId: string;
  targetId: string;
  recipeId: string;
}
export interface SwapPreview {
  request: SwapRequest;
  proposedWeek: BatchWeek;
  changes: Array<{ name: string; before: string; after: string }>;
}
export type MealbookPage =
  | 'today'
  | 'week'
  | 'recipes'
  | 'shopping'
  | 'log'
  | 'settings'
  | 'import';
export type MealbookAction =
  | { type: 'NAVIGATE'; page: MealbookPage }
  | { type: 'OPEN_RECIPE'; recipeId: string; intent?: 'view' | 'cook' | 'week'; batchId?: string }
  | { type: 'CLOSE_RECIPE' }
  | { type: 'SET_FILTERS'; filters: Filters }
  | { type: 'SET_TODAY_SLOT'; slot: MealType }
  | { type: 'CHOOSE_TODAY'; recipeId: string; batchId?: string; useId?: string }
  | { type: 'NEXT_MEAL' }
  | {
      type: 'START_COOK';
      recipeId: string;
      sourceServings: number;
      sourceYield?: number;
      weekId?: string;
      choiceId?: string;
      extraBatch?: boolean;
    }
  | {
      type: 'UPDATE_COOK';
      sessionId: string;
      patch: Partial<Pick<CookingSession, 'stepIndex' | 'checkedIngredientIds' | 'timers'>>;
    }
  | {
      type: 'FINISH_COOK';
      sessionId: string;
      actualYield: number;
      yieldUnit: string;
      storage: FoodStorage;
      storageNotes: string;
      reheatNotes: string;
      preparedSourceServings?: number;
    }
  | { type: 'EXIT_COOK' }
  | { type: 'EAT_OPEN'; batchId: string; units?: number; useId?: string }
  | { type: 'EAT_CANCEL' }
  | { type: 'EAT_CONFIRM'; units: number; date: string }
  | { type: 'UNDO_LOG'; logId: string }
  | { type: 'UPDATE_PROFILE'; recipeId: string; profile: RecipeProfile }
  | { type: 'UPDATE_RECIPE'; recipe: Recipe; nutritionConfirmed?: boolean }
  | { type: 'ADD_RECIPE'; recipe: Recipe }
  | { type: 'ADD_TO_WEEK'; recipeId: string; sourceServings: number; portions: number }
  | { type: 'MAKE_WEEK'; request: BatchPlanRequest }
  | { type: 'SELECT_WEEK'; weekId: string }
  | { type: 'CONFIRM_WEEK' }
  | { type: 'REROLL_WEEK' }
  | { type: 'LOCK_CHOICE'; choiceId: string; locked: boolean }
  | { type: 'CHANGE_PORTIONS'; choiceId: string; portions: number }
  | { type: 'MOVE_USE'; useId: string; date: string; slot: MealType }
  | { type: 'SKIP_USE'; useId: string; skipped: boolean }
  | {
      type: 'MOVE_WINDOW';
      windowId: string;
      date: string;
      startTime: string;
      availableMinutes: number;
    }
  | { type: 'PREVIEW_SWAP'; request: SwapRequest }
  | { type: 'APPLY_SWAP' }
  | { type: 'CANCEL_SWAP' }
  | { type: 'SHOP_RECIPE'; recipeId: string; sourceServings: number; sourceYield?: number }
  | { type: 'REMOVE_SHOP_INTENT'; intentId: string }
  | { type: 'COVER_ITEM'; itemKey: string; kind: 'owned' | 'bought' | 'clear'; quantity?: number }
  | { type: 'MATCH_PURCHASE'; names: string[]; purchaseName: string; prepNote: string }
  | { type: 'SET_AISLE'; itemKey: string; aisle: string }
  | { type: 'ADD_MANUAL_ITEM'; name: string; quantityText: string }
  | { type: 'TOGGLE_MANUAL_ITEM'; id: string }
  | { type: 'REMOVE_MANUAL_ITEM'; id: string }
  | { type: 'ADD_RECIPE_LOG'; recipeId: string; servings: number; date: string }
  | { type: 'ADD_MANUAL_LOG'; entry: ConsumptionEntry }
  | { type: 'SET_TARGETS'; targets: Nutrition }
  | { type: 'EXPORT_BACKUP' };
