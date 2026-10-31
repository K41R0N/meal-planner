import type { AppState, MealType, Recipe } from './types';
import type {
  BatchPlanRequest,
  BatchWeek,
  CookingSession,
  DailyChoice,
  FoodStorage,
  PurchaseItem,
  PurchaseList,
  RecipeProfile,
  SwapRequest,
  TodayContext,
} from './experience-types';

export interface ExperienceEngine {
  ensureState(state: AppState): AppState;
  ensureToday(state: AppState, date: string, slot: MealType): AppState;
  today(state: AppState, date: string, slot: MealType): TodayContext;
  chooseToday(
    state: AppState,
    date: string,
    slot: MealType,
    recipeId: string,
    context?: { batchId?: string; useId?: string },
  ): AppState;
  nextMeal(state: AppState, date: string, slot: MealType): AppState;
  startCook(
    state: AppState,
    recipeId: string,
    sourceServings: number,
    context: {
      id: string;
      date: string;
      slot: MealType;
      sourceYield?: number;
      weekId?: string;
      choiceId?: string;
    },
  ): AppState;
  updateCook(
    state: AppState,
    sessionId: string,
    patch: Partial<Pick<CookingSession, 'stepIndex' | 'checkedIngredientIds' | 'timers'>>,
  ): AppState;
  finishCook(
    state: AppState,
    sessionId: string,
    input: {
      id: string;
      actualYield: number;
      yieldUnit: string;
      storage: FoodStorage;
      storageNotes: string;
      reheatNotes: string;
      preparedSourceServings?: number;
      /** Confirmed start-to-ready minutes for this cook; stored on the recipe profile only when `rememberTiming` is true. */
      elapsedMinutes?: number | null;
      rememberTiming?: boolean;
    },
  ): AppState;
  availableUnits(state: AppState, batchId: string): number;
  consume(
    state: AppState,
    batchId: string,
    units: number,
    date: string,
    logId: string,
    context?: { dailyChoiceId?: string; useId?: string },
  ): AppState;
  undoConsumption(state: AppState, logId: string): AppState;
  updateProfile(state: AppState, recipeId: string, profile: RecipeProfile): AppState;
}
export interface BatchPlanningAPI {
  proposeWeek(state: AppState, request: BatchPlanRequest, id: string): BatchWeek;
  rerollWeek(state: AppState, week: BatchWeek, request: BatchPlanRequest): BatchWeek;
  changePortions(state: AppState, week: BatchWeek, choiceId: string, portions: number): BatchWeek;
  changeUse(
    state: AppState,
    week: BatchWeek,
    useId: string,
    patch: { date?: string; slot?: MealType; skipped?: boolean },
  ): BatchWeek;
  moveWindow(
    state: AppState,
    week: BatchWeek,
    windowId: string,
    patch: { date: string; startTime: string; availableMinutes: number },
  ): BatchWeek;
  swap(state: AppState, week: BatchWeek, request: SwapRequest): BatchWeek;
  addRecipe(
    state: AppState,
    week: BatchWeek | null,
    recipeId: string,
    sourceServings: number,
    portions: number,
    id: string,
    date: string,
  ): BatchWeek;
}
export interface PurchasePlanningAPI {
  buildList(state: AppState, week?: BatchWeek | null): PurchaseList;
  addIntent(
    state: AppState,
    recipeId: string,
    sourceServings: number,
    id: string,
    sourceYield?: number,
  ): AppState;
  cover(
    state: AppState,
    item: PurchaseItem,
    input: { kind: 'owned' | 'bought' | 'clear'; quantity?: number },
    id: string,
  ): AppState;
  approveMatch(
    state: AppState,
    names: string[],
    purchaseName: string,
    prepNote: string,
    id: string,
  ): AppState;
}
