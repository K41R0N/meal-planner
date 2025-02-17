// Main app functionality
let recipes = [];

// Fetch recipes data
async function fetchRecipes() {
    try {
        const response = await fetch('./data/recipes.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        recipes = data.recipes;
        displayDailySuggestions(recipes);
        displayRecipes();
    } catch (error) {
        console.error('Error loading recipes:', error);
        document.querySelector('.recipe-grid').innerHTML = `
            <div class="error-message">
                Unable to load recipes. Please try again later.
            </div>
        `;
    }
}

function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    
    card.innerHTML = `
        <h2>${recipe.name}</h2>
        <div class="recipe-type">${recipe.type}</div>
        ${createTagsSection(recipe.tags)}
        <button class="view-recipe">View Recipe</button>
    `;
    
    card.querySelector('.view-recipe').addEventListener('click', () => {
        showRecipeDetails(recipe);
    });
    
    return card;
}

function createTagsSection(tags) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'recipe-tags';
    
    // Calculate if tags will overflow one line
    // We'll assume each tag takes roughly 100px with padding and margin
    const approximateTagWidth = 100;
    const containerWidth = 300; // Approximate card width
    const maxTagsInRow = Math.floor(containerWidth / approximateTagWidth);
    
    if (tags.length > maxTagsInRow) {
        // Show only first few tags plus expand button
        const visibleTags = tags.slice(0, maxTagsInRow - 1);
        const hiddenCount = tags.length - (maxTagsInRow - 1);
        
        const tagsHTML = `
            ${visibleTags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            <span class="tags-expand">+${hiddenCount} tags</span>
        `;
        
        tagsContainer.innerHTML = tagsHTML;
        
        // Add click handler for expansion
        const expandButton = tagsContainer.querySelector('.tags-expand');
        expandButton.addEventListener('click', () => {
            tagsContainer.innerHTML = tags.map(tag => 
                `<span class="tag">${tag}</span>`
            ).join('');
            tagsContainer.classList.add('expanded');
        });
    } else {
        // If tags fit in one row, show them all
        tagsContainer.innerHTML = tags.map(tag => 
            `<span class="tag">${tag}</span>`
        ).join('');
    }
    
    return tagsContainer.outerHTML;
}

function showRecipeDetails(recipe) {
    let panel = document.querySelector('.recipe-detail-panel');
    let overlay = document.querySelector('.panel-overlay');
    
    if (!panel) {
        panel = document.createElement('div');
        panel.className = 'recipe-detail-panel';
        
        // Create overlay for mobile
        overlay = document.createElement('div');
        overlay.className = 'panel-overlay';
        document.body.appendChild(overlay);
        
        document.body.appendChild(panel);
    }

    // Populate panel content
    panel.innerHTML = `
        <button class="close-panel">&times;</button>
        <div class="recipe-detail-content">
            <div class="recipe-detail-header">
                <h2>${recipe.name}</h2>
                <div class="recipe-detail-type">${recipe.type}</div>
            </div>
            
            <div class="recipe-ingredients">
                <h3>Ingredients</h3>
                <div class="ingredients-list">
                    ${recipe.ingredients.map(ing => 
                        `<div>• ${ing.quantity} ${ing.name}</div>`
                    ).join('')}
                </div>
            </div>
            
            <div class="recipe-instructions">
                <h3>Instructions</h3>
                <div class="instructions-list">
                    ${recipe.instructions.map((step, index) => 
                        `<div>${index + 1}. ${step}</div>`
                    ).join('')}
                </div>
            </div>
        </div>
    `;

    // Handle close events
    const closePanel = () => {
        panel.classList.remove('open');
        overlay.classList.remove('active');
        document.querySelector('.main-wrapper').classList.remove('panel-open');
    };

    panel.querySelector('.close-panel').addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    // Open panel
    requestAnimationFrame(() => {
        panel.classList.add('open');
        overlay.classList.add('active');
        document.querySelector('.main-wrapper').classList.add('panel-open');
    });
}

function displayRecipes(recipesToShow = recipes) {
    const recipeGrid = document.querySelector('.recipe-grid');
    
    // Clear and add catalog class to the grid itself
    recipeGrid.innerHTML = '';
    recipeGrid.className = 'recipe-grid recipe-catalog';
    
    recipesToShow.forEach(recipe => {
        const card = createRecipeCard(recipe);
        recipeGrid.appendChild(card);
    });
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredRecipes = recipes.filter(recipe => 
            recipe.name.toLowerCase().includes(searchTerm) ||
            recipe.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
        displayRecipes(filteredRecipes);
    });
}

function setupSearchModule() {
    const wrapper = document.querySelector('.main-wrapper');
    
    // Create search module
    const searchModule = document.createElement('div');
    searchModule.className = 'search-module';
    
    // Create inner container
    const searchModuleInner = document.createElement('div');
    searchModuleInner.className = 'search-module-inner';
    
    searchModuleInner.innerHTML = `
        <div class="search-container">
            <input type="text" id="searchInput" placeholder="Search recipes...">
        </div>
        <button class="filter-button">
            <span>Filter</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
        </button>
        <div class="meal-filter">
            ${['Any', 'Breakfast', 'Lunch', 'Dinner']
                .map(type => `<button data-type="${type.toLowerCase()}">${type}</button>`)
                .join('')}
        </div>
    `;
    
    searchModule.appendChild(searchModuleInner);
    
    // Insert before wrapper instead of main content
    wrapper.parentNode.insertBefore(searchModule, wrapper);
    
    // Setup event listeners
    setupSearch();
    setupFilters(searchModuleInner);
}

function setupFilters(searchModule) {
    const filterButton = searchModule.querySelector('.filter-button');
    const filterMenu = searchModule.querySelector('.meal-filter');
    const filterButtons = filterMenu.querySelectorAll('button');
    
    // Ensure menu is hidden initially
    filterMenu.classList.remove('active');
    filterButton.classList.remove('active');
    
    filterButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent document click from immediately closing
        filterButton.classList.toggle('active');
        filterMenu.classList.toggle('active');
    });
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const type = button.dataset.type;
            const filtered = type === 'any' 
                ? recipes 
                : recipes.filter(recipe => recipe.meal_time === type);
            displayRecipes(filtered);
            filterMenu.classList.remove('active');
            filterButton.classList.remove('active');
        });
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!searchModule.contains(e.target)) {
            filterMenu.classList.remove('active');
            filterButton.classList.remove('active');
        }
    });
}

// Function to get daily recipe suggestions
function getDailySuggestions(recipes) {
    // Get current date to use as seed for consistent daily suggestions
    const today = new Date().toDateString();
    
    // Simple hash function to generate a consistent number from the date
    const hashDate = str => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash);
    };

    const dateHash = hashDate(today);

    // Filter recipes by meal time
    const smoothies = recipes.filter(recipe => recipe.type === 'smoothie');
    const mains = recipes.filter(recipe => recipe.type === 'main');
    const soups = recipes.filter(recipe => recipe.type === 'soup');

    // Select one recipe from each category using the date hash
    const breakfast = smoothies[dateHash % smoothies.length];
    const lunch = mains[dateHash % mains.length];
    const dinner = soups[dateHash % soups.length];

    return {
        breakfast,
        lunch,
        dinner
    };
}

// Function to display daily suggestions
function displayDailySuggestions(recipes) {
    const suggestions = getDailySuggestions(recipes);
    
    const suggestionsHTML = `
        <div class="daily-suggestions">
            <h2>Today's Suggested Meals</h2>
            <div class="suggestion-cards">
                <div class="suggestion-card">
                    <h3>Breakfast</h3>
                    <p>${suggestions.breakfast.name}</p>
                    ${createTagsSection(suggestions.breakfast.tags)}
                    <button class="view-recipe" data-recipe-type="breakfast">View Recipe</button>
                </div>
                <div class="suggestion-card">
                    <h3>Lunch</h3>
                    <p>${suggestions.lunch.name}</p>
                    ${createTagsSection(suggestions.lunch.tags)}
                    <button class="view-recipe" data-recipe-type="lunch">View Recipe</button>
                </div>
                <div class="suggestion-card">
                    <h3>Dinner</h3>
                    <p>${suggestions.dinner.name}</p>
                    ${createTagsSection(suggestions.dinner.tags)}
                    <button class="view-recipe" data-recipe-type="dinner">View Recipe</button>
                </div>
            </div>
        </div>
    `;

    // Insert suggestions at the top of the main content
    const mainContent = document.querySelector('.main-content');
    mainContent.insertAdjacentHTML('afterbegin', suggestionsHTML);

    // Add event listeners to the view recipe buttons
    const suggestionButtons = mainContent.querySelectorAll('.daily-suggestions .view-recipe');
    suggestionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mealType = button.getAttribute('data-recipe-type');
            showRecipeDetails(suggestions[mealType]);
        });
    });
}

// When the DOM loads, setup the app
document.addEventListener('DOMContentLoaded', () => {
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'main-wrapper';
    
    // Create container if it doesn't exist
    let container = document.querySelector('.container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'container';
        document.body.appendChild(container);
    }
    
    // Wrap container
    container.parentNode.insertBefore(wrapper, container);
    wrapper.appendChild(container);
    
    // Initialize app
    fetchRecipes();
    setupSearchModule();
}); 