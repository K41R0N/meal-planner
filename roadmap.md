# Meal Planner App Roadmap

- I'm only allowed to have one main meal for lunch, dinner is always a soup, and breakfast is always a smoothie. Do not suggest recipes that don't follow this structure. If it's not a smoothie, a vinaigrette or a soup, it's always a meal

- I want to deploy this project on Netlify, no external APIs. Maybe a search algorithm, or a way to use an LLM chatbot to get dynamic suggestions on recipes based on my intention (I'm traveling for a week and need something simple but nutritious, I'm looking to lose 5 pounds in the next month)

- Eventually, I will need a macro counter to make sure I'm getting a balanced diet with my recipes, but this should come at a later stage.

- I want this app to be mobile native, so responsive design is a must.

- I want to eventually add a price tracking functionality for the ingredients, so I could also categorize on how to make the most nutritious yet cheapest meals, this will require my manual input when I'm shopping for the ingredients.

- I would like to add special tags to the recipes like (quick, meal-prep friendly, superfood, high in protein, etc) This would make navigation and the search function quite a lot more useful.

- Another stretch goal would be to add a localization function to the app so it displays the recipe in any language based on user input


#Site design notes

## Desktop Layout (> 768px):
Side-panel recipe details (33.33vw width)
2. Main content shifts left when panel opens
3-column grid for recipe catalog
3-column grid for daily suggestions
Consistent card styling with shadows and borders
Hover animations and transitions
Horizontal tag display with overflow handling

## Mobile Layout (≤ 768px):
Bottom-sheet recipe details (85vh height)
Overlay and blur effect when panel is open
Single column layout for all cards
Vertical stacking for daily suggestions
Maintained card styling from desktop
Drag indicator for bottom sheet
Proper spacing and text sizing for mobile
Tags wrap to multiple lines
Touch-friendly button sizes
Scrollable meal filters
Shared Features:
Consistent color scheme
Box shadow and border styling
Card hover effects
Tag system
View Recipe button placement
Meal type color coding
Typography scale
Spacing system

## Phase 1: Data Structure Setup
1. **Recipe Taxonomy**
   - Create JSON data structure for recipes:
   ```javascript
   {
     "id": "unique-id",
     "name": "Recipe Name",
     "type": "smoothie|main|soup",
     "meal_time": "breakfast|lunch|dinner",
     "ingredients": [
       { "name": "ingredient", "quantity": "1/2 cup", "category": "oils" }
     ],
     "instructions": ["step 1", "step 2"],
     "servings": 4
   }
   ```
   
2. **Ingredient Database**
   - Convert shopping list to JSON:
   ```javascript
   {
     "name": "Coconut Oil",
     "category": "oils",
     "purchase_frequency": "monthly",
     "typical_quantity": "500ml jar"
   }
   ```

## Phase 2: Core Features
1. **Daily Meal Framework**
   - Fixed structure:
   ```javascript
   const dailyTemplate = {
     breakfast: { type: "smoothie", options: 3 },
     lunch: { type: "main", options: 5 },
     dinner: { type: "soup", options: 2 }
   }
   ```

2. **Weekly Planner Engine**
   - Algorithm requirements:
   - No repeated recipes within 3 days
   - Check ingredient availability
   - Generate shopping list based on selections

## Phase 3: Tech Stack
**Core Stack:**
- HTML/CSS/JS (Vanilla)
- Parcel (Zero-config bundler)
- Netlify (Static site hosting)
- LocalStorage (User preferences)

**Mobile-First Approach:**
- CSS Grid/Flexbox for layouts
- PWA capabilities for app-like feel
- Touch-optimized UI components

**Future-Proofing:**
- JAMstack architecture
- i18n localization support
- Price tracking schema
- Nutrition database structure

## Phase 4: Development Milestones
### Immediate Priorities (Month 1)
1. Week 1: Data Preparation
   - Add recipe tags: quick, meal-prep, superfood, high-protein
   - Implement basic search filters

2. Week 2: Basic Functionality
   - Responsive recipe cards
   - Mobile-friendly meal grid

3. Week 3: Advanced Features
   - Shopping list price logger (CSV export)

### Medium-Term Goals (Month 2-3)
1. Intelligent Suggestions
   - Rule-based search algorithm
   - LLM integration (local plugin architecture)
   - Travel-friendly meal filters

2. Nutrition System
   - Macro counter foundation
   - USDA nutrition data mapping

### Long-Term Vision
1. Recipe Scaling:
   - Budget optimizer (price/quantity/nutrition ratio)

2. Dietary Tracking:
   - Weight loss/gain planner
   - Auto-generated meal plans

3. Integration:
   - Multi-language support (i18n)
   - Offline-first capabilities
   - Cross-device sync

## Security & Privacy
- All data stays local by default
- Optional Netlify Identity for cloud sync
- Data validation/sanitization for manual inputs

## Future Expansion
4. Localization Features:
   - Recipe language switcher
   - Measurement system converter
   - Regional ingredient substitutions

5. Price Tracking:
   - Manual price entry UI
   - Historical price charts
   - Budget meal suggestions

**Immediate Next Steps:**
4. Create sample recipe JSON with new tags
5. Set up Netlify project structure
6. Implement basic responsive layout

The system is designed to:
- Maintain your strict meal program structure
- Allow controlled expansion through the data files
- Prevent recipe repetition while ensuring nutritional variety
- Generate accurate shopping lists based on weekly plans

Would you like to start with Phase 1 implementation?