import type { AppState, Filters, ManualShoppingItem, Recipe } from '@domain/types';
import type {
  BatchWeek,
  CookingSession,
  EatRequest,
  MealbookAction,
  MealbookPage,
  PreparedBatch,
  PurchaseList,
  RecipeProfile,
  SwapPreview,
  TodayContext,
} from '@domain/experience-types';

export interface MealbookModel {
  state: AppState;
  page: MealbookPage;
  date: string;
  today: TodayContext;
  week: BatchWeek | null;
  shopping: PurchaseList;
  cookSession: CookingSession | null;
  selectedRecipe: Recipe | null;
  selectedIntent: 'view' | 'cook' | 'week';
  selectedBatch: PreparedBatch | null;
  eating: EatRequest | null;
  swapPreview: SwapPreview | null;
  filters: Filters;
  initialSharedUrl: string | null;
  notice: string;
  noticeIsError: boolean;
  undoLogId: string | null;
  persistenceError: string;
  manualItems: ManualShoppingItem[];
}
export interface MealbookUIProps {
  model: MealbookModel;
  dispatch: (action: MealbookAction) => boolean;
  onRestore: (file: File) => Promise<void>;
  onBankImport: (file: File) => Promise<void>;
  onOpenExistingSource: (videoId: string) => boolean;
}
export const defaultRecipeProfile = (): RecipeProfile => ({
  yieldUnit: 'recipe serving',
  sourceUnitsPerPortion: 1,
  portionSizeConfirmed: false,
  activeMinutes: null,
  elapsedMinutes: null,
  reheatMinutes: null,
  equipment: [],
  equipmentConfirmed: false,
  reheatNotes: '',
  notes: '',
});
