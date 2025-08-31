// Search functionality for Claude Code Templates
let searchActive = false;
let searchResults = [];
let allComponents = {};
let searchTimeout = null;

/**
 * Toggle search bar visibility
 */
function toggleSearch() {
    const container = document.getElementById('searchBarContainer');
    const input = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchToggleBtn');
    const categoryLabels = document.querySelectorAll('.category-filter-label');
    
    if (searchActive) {
        // Hide search and show category sections
        container.style.display = 'none';
        searchActive = false;
        searchBtn.classList.remove('active');
        clearSearch();
        
        // Show category filter labels/sections
        categoryLabels.forEach(label => {
            label.style.display = '';
        });
    } else {
        // Show search and hide category sections
        container.style.display = 'block';
        searchActive = true;
        searchBtn.classList.add('active');
        input.focus();
        
        // Hide category filter labels/sections only (keep filter buttons visible)
        categoryLabels.forEach(label => {
            label.style.display = 'none';
        });
        
        // Ensure components are loaded
        if (Object.keys(allComponents).length === 0) {
            loadComponentsForSearch();
        }
    }
}

/**
 * Handle search input - now only shows/hides clear button, doesn't trigger search
 */
function handleSearchInput(event) {
    const query = event.target.value;
    const clearBtn = document.getElementById('clearSearchBtn');
    
    // Show/hide clear button
    if (query.length > 0) {
        clearBtn.style.display = 'flex';
    } else {
        clearBtn.style.display = 'none';
        // If input is empty, restore previous view
        restorePreviousView();
    }
}

/**
 * Handle keyboard shortcuts in search
 */
function handleSearchKeydown(event) {
    if (event.key === 'Escape') {
        clearSearch();
    } else if (event.key === 'Enter') {
        event.preventDefault();
        const query = event.target.value.trim();
        if (query.length >= 3) {
            performSearch(query);
        } else if (query.length === 0) {
            restorePreviousView();
        }
    }
}

/**
 * Clear search and reset view
 */
function clearSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    input.value = '';
    clearBtn.style.display = 'none';
    
    // Clear search timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
    }
    
    // Restore previous view
    restorePreviousView();
    
    searchResults = [];
}

/**
 * Restore the previous view (before search was active)
 */
function restorePreviousView() {
    const resultsInfo = document.getElementById('searchResultsInfo');
    resultsInfo.style.display = 'none';
    
    // Show filters again
    showFilters();
    
    // Reset to current filter view
    const activeFilter = document.querySelector('.component-type-filters .filter-chip.active');
    if (activeFilter) {
        const filterType = activeFilter.getAttribute('data-filter');
        if (window.indexManager) {
            window.indexManager.displayCurrentFilter();
        }
    } else {
        // Fallback to agents if no active filter found
        if (window.indexManager) {
            window.indexManager.setFilter('agents');
        }
    }
}

/**
 * Load all components for search functionality
 */
async function loadComponentsForSearch() {
    try {
        // First try to load from main components.json
        const response = await fetch('components.json');
        if (response.ok) {
            const data = await response.json();
            
            // Process each category for search
            const categories = ['agents', 'commands', 'settings', 'hooks', 'mcps'];
            
            for (const category of categories) {
                if (data[category] && Array.isArray(data[category])) {
                    // Process components to make them search-friendly
                    allComponents[category] = data[category].map(component => ({
                        ...component,
                        // Normalize fields for better searching
                        title: component.name || component.title || 'Untitled',
                        displayName: (component.name || component.title || '').replace(/[-_]/g, ' '),
                        category: category,
                        searchableText: [
                            component.name || component.title,
                            component.description,
                            component.category,
                            ...(component.tags || []),
                            component.keywords || '',
                            component.path || ''
                        ].filter(Boolean).join(' ').toLowerCase(),
                        
                        // Ensure tags exist
                        tags: component.tags || [component.category].filter(Boolean)
                    }));
                }
            }
            
            console.log('Search data loaded successfully:', Object.keys(allComponents));
        } else {
            console.error('Failed to load components.json');
        }
    } catch (error) {
        console.error('Error loading components for search:', error);
        
        // Fallback: try to use cached data if available
        if (window.getSearchData) {
            const categories = ['agents', 'commands', 'settings', 'hooks', 'mcps'];
            for (const category of categories) {
                const data = window.getSearchData(category);
                if (data && data.length > 0) {
                    allComponents[category] = data;
                }
            }
        }
    }
}

/**
 * Perform search across all loaded components
 */
function performSearch(query) {
    if (!query || query.length < 3) {
        updateSearchResults([]);
        showFilters(); // Show filters when no search
        return;
    }
    
    // Hide filters during search
    hideFilters();
    
    const normalizedQuery = query.toLowerCase().trim();
    const results = [];
    const categoryMatches = new Set();
    
    // Search across all categories except templates
    Object.keys(allComponents).forEach(category => {
        if (category === 'templates') return; // Skip templates
        
        const components = allComponents[category];
        if (!components || !Array.isArray(components)) return;
        
        components.forEach(component => {
            const matchScore = calculateMatchScore(component, normalizedQuery, category);
            
            if (matchScore > 0) {
                results.push({
                    ...component,
                    category: category,
                    matchScore: matchScore,
                    matchType: getMatchType(component, normalizedQuery, category)
                });
                categoryMatches.add(category);
            }
        });
    });
    
    // Sort by match score (highest first)
    results.sort((a, b) => b.matchScore - a.matchScore);
    
    searchResults = results;
    updateSearchResults(results, categoryMatches);
    displaySearchResults(results);
}

/**
 * Calculate match score for a component
 */
function calculateMatchScore(component, query, category) {
    let score = 0;
    
    // Category name match (highest priority)
    if (category.includes(query)) {
        score += 100;
    }
    
    // Component name/title match
    const name = (component.name || component.title || '').toLowerCase();
    if (name.includes(query)) {
        score += name.startsWith(query) ? 80 : 60;
    }
    
    // Description match
    const description = (component.description || '').toLowerCase();
    if (description.includes(query)) {
        score += 30;
    }
    
    // Tags match
    if (component.tags && Array.isArray(component.tags)) {
        const tagMatch = component.tags.some(tag => 
            tag.toLowerCase().includes(query)
        );
        if (tagMatch) {
            score += 40;
        }
    }
    
    // Keywords match (for settings/hooks)
    if (component.keywords) {
        const keywordMatch = component.keywords.toLowerCase().includes(query);
        if (keywordMatch) {
            score += 25;
        }
    }
    
    // Path match (for file-based components)
    if (component.path) {
        const pathMatch = component.path.toLowerCase().includes(query);
        if (pathMatch) {
            score += 15;
        }
    }
    
    return score;
}

/**
 * Get match type for display
 */
function getMatchType(component, query, category) {
    const name = (component.name || component.title || '').toLowerCase();
    const description = (component.description || '').toLowerCase();
    
    if (category.includes(query)) return 'category';
    if (name.includes(query)) return 'name';
    if (description.includes(query)) return 'description';
    if (component.tags && component.tags.some(tag => tag.toLowerCase().includes(query))) return 'tag';
    if (component.keywords && component.keywords.toLowerCase().includes(query)) return 'keyword';
    if (component.path && component.path.toLowerCase().includes(query)) return 'path';
    
    return 'other';
}

/**
 * Update search results info display
 */
function updateSearchResults(results, categoryMatches = new Set()) {
    const resultsInfo = document.getElementById('searchResultsInfo');
    const resultsCount = document.getElementById('resultsCount');
    const filterTags = document.getElementById('searchFilterTags');
    
    if (results.length === 0) {
        resultsInfo.style.display = 'none';
        return;
    }
    
    resultsInfo.style.display = 'block';
    
    // Update count with terminal-style format
    const count = results.length;
    resultsCount.textContent = `Found(${count} result${count !== 1 ? 's' : ''})`;
    
    // Update category tags
    if (categoryMatches.size > 0) {
        const categoryIcons = {
            agents: '🤖',
            commands: '⚡',
            settings: '⚙️',
            hooks: '🪝',
            mcps: '🔌'
        };
        
        const tags = Array.from(categoryMatches).map(category => {
            const icon = categoryIcons[category] || '';
            const name = category.charAt(0).toUpperCase() + category.slice(1);
            return `<span class="search-category-tag">${icon} ${name}</span>`;
        }).join('');
        
        filterTags.innerHTML = tags;
    } else {
        filterTags.innerHTML = '';
    }
}

/**
 * Display search results in the grid
 */
function displaySearchResults(results) {
    const unifiedGrid = document.getElementById('unifiedGrid');
    
    if (!unifiedGrid) {
        console.error('Unified grid not found');
        return;
    }
    
    // Clear current content
    unifiedGrid.innerHTML = '';
    
    if (results.length === 0) {
        // Show no results message
        unifiedGrid.innerHTML = `
            <div class="no-search-results">
                <div class="no-results-icon">🔍</div>
                <h3>No components found</h3>
                <p>Try searching for:</p>
                <ul class="search-suggestions">
                    <li><strong>Categories:</strong> agents, commands, settings, hooks, mcps</li>
                    <li><strong>Technologies:</strong> react, python, git, telegram, api</li>
                    <li><strong>Features:</strong> security, performance, automation, notifications</li>
                </ul>
            </div>
        `;
        return;
    }
    
    // Group results by category for better organization
    const groupedResults = {};
    results.forEach(result => {
        if (!groupedResults[result.category]) {
            groupedResults[result.category] = [];
        }
        groupedResults[result.category].push(result);
    });
    
    // Render grouped results in specific order
    let html = '';
    const categoryOrder = ['agents', 'commands', 'settings', 'hooks', 'mcps'];
    
    categoryOrder.forEach(category => {
        if (!groupedResults[category]) return;
        const categoryResults = groupedResults[category];
        const categoryIcon = getCategoryIcon(category);
        const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
        
        html += `
            <div class="search-category-section">
                <h3 class="search-category-header">
                    <span class="category-icon">${categoryIcon}</span>
                    ${categoryName} (${categoryResults.length})
                </h3>
                <div class="search-category-grid">
        `;
        
        categoryResults.forEach(component => {
            html += generateComponentCard(component, category);
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    unifiedGrid.innerHTML = html;
}

/**
 * Get category icon
 */
function getCategoryIcon(category) {
    const icons = {
        agents: '🤖',
        commands: '⚡',
        settings: '⚙️',
        hooks: '🪝',
        mcps: '🔌'
    };
    return icons[category] || '📦';
}

/**
 * Generate component card HTML (matching existing template-card format)
 */
function generateComponentCard(component, category) {
    // Generate install command - remove .md extension from path
    let componentPath = component.path || component.name;
    // Remove .md or .json extensions from path
    if (componentPath.endsWith('.md') || componentPath.endsWith('.json')) {
        componentPath = componentPath.replace(/\.(md|json)$/, '');
    }
    const installCommand = `npx claude-code-templates@latest --${component.type}=${componentPath} --yes`;
    
    const typeConfig = {
        agent: { icon: '🤖', color: '#ff6b6b' },
        command: { icon: '⚡', color: '#4ecdc4' },
        mcp: { icon: '🔌', color: '#45b7d1' },
        setting: { icon: '⚙️', color: '#9c88ff' },
        hook: { icon: '🪝', color: '#ff8c42' }
    };
    
    const config = typeConfig[component.type];
    
    // Escape quotes and special characters for onclick attributes
    const escapedType = component.type.replace(/'/g, "\\'");
    const escapedName = (component.name || '').replace(/'/g, "\\'");
    const escapedPath = (component.path || component.name || '').replace(/'/g, "\\'");
    const escapedCategory = (component.category || 'general').replace(/'/g, "\\'");
    const escapedCommand = installCommand.replace(/'/g, "\\'");
    
    // Create category label (use "General" if no category)
    const categoryName = component.category || 'general';
    const categoryLabel = `<div class="category-label">${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}</div>`;
    
    // Format component name
    const formattedName = (component.name || '').split(/[-_]/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    // Get description
    const description = component.description || 'Component for enhanced development workflow';
    const truncatedDescription = description.length > 80 ? description.substring(0, 80) + '...' : description;
    
    return `
        <div class="template-card" data-type="${component.type}">
            <div class="card-inner">
                <div class="card-front">
                    ${categoryLabel}
                    <div class="framework-logo" style="color: ${config.color}">
                        <span class="component-icon">${config.icon}</span>
                    </div>
                    <h3 class="template-title">${formattedName}</h3>
                    <p class="template-description">${truncatedDescription}</p>
                </div>
                <div class="card-back">
                    <div class="command-display">
                        <h3>Installation Command</h3>
                        <div class="command-code-container">
                            <div class="command-code">${installCommand}</div>
                            <button class="copy-overlay-btn" onclick="copyToClipboard('${escapedCommand}'); event.stopPropagation();" title="Copy command">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                </svg>
                                Copy Command
                            </button>
                        </div>
                        <div class="card-actions">
                            <button class="view-files-btn" onclick="showComponentDetails('${escapedType}', '${escapedName}', '${escapedPath}', '${escapedCategory}')">
                                📁 View Details
                            </button>
                            <button class="add-to-cart-btn" 
                                    data-type="${component.type}s" 
                                    data-path="${componentPath}"
                                    onclick="handleAddToCart('${escapedName}', '${componentPath}', '${component.type}s', '${escapedCategory}', this)">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19,7H18V6A2,2 0 0,0 16,4H8A2,2 0 0,0 6,6V7H5A1,1 0 0,0 4,8A1,1 0 0,0 5,9H6V19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V9H19A1,1 0 0,0 20,8A1,1 0 0,0 19,7M8,6H16V7H8V6M16,19H8V9H16V19Z"/>
                                </svg>
                                Add to Stack
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate installation command for component
 */
function generateInstallCommand(component, category) {
    let name = component.name || component.path || component.title;
    let categoryParam = category.slice(0, -1); // Remove 's' from category name
    
    // Handle special cases for category parameters
    if (category === 'settings' || category === 'hooks') {
        // Use the path if available for settings and hooks
        if (component.path) {
            name = component.path.replace(/\.(json|md)$/, ''); // Remove file extension
        }
        categoryParam = category.slice(0, -1); // 'setting' or 'hook'
    }
    
    return `npx claude-code-templates@latest --${categoryParam}=${name} --yes`;
}

/**
 * Show all components except templates
 */
function showAllComponents() {
    // This function should integrate with existing filter logic
    if (typeof setUnifiedFilter === 'function') {
        setUnifiedFilter('agents'); // Default to agents
    }
}

// Search result cards now use the global click handler from index-events.js
// No need for custom toggleCard function

// Initialize search functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load components for search
    loadComponentsForSearch();
    
    // Add CSS for search functionality if not already present
    if (!document.getElementById('search-styles')) {
        const searchStyles = document.createElement('style');
        searchStyles.id = 'search-styles';
        searchStyles.textContent = `
            .search-btn.active {
                background-color: var(--accent-color, #00d4aa) !important;
                color: var(--bg-color, #0a0e0f) !important;
            }
            
            .search-bar-container {
                margin-top: 1rem;
                padding: 0 1rem;
                animation: slideDown 0.3s ease-out;
            }
            
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .search-input-wrapper {
                position: relative;
                display: flex;
                align-items: center;
                background: var(--card-bg, #1a1f23);
                border: 1px solid var(--border-color, #2a3338);
                border-radius: 8px;
                padding: 0.75rem 1rem;
                transition: border-color 0.2s ease;
            }
            
            .search-input-wrapper:focus-within {
                border-color: var(--accent-color, #00d4aa);
                box-shadow: 0 0 0 2px var(--accent-color, #00d4aa)20;
            }
            
            .search-icon {
                margin-right: 0.75rem;
                color: var(--text-dim, #8892a0);
            }
            
            .search-input {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                color: var(--text-color, #ffffff);
                font-size: 1rem;
                font-family: 'Inter', sans-serif;
            }
            
            .search-input::placeholder {
                color: var(--text-dim, #8892a0);
            }
            
            .clear-search-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                margin-left: 0.5rem;
                background: transparent;
                border: none;
                border-radius: 4px;
                color: var(--text-dim, #8892a0);
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .clear-search-btn:hover {
                background: var(--hover-bg, #2a3338);
                color: var(--text-color, #ffffff);
            }
            
            .search-results-info {
                margin-top: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 1rem;
            }
            
            .results-count {
                color: var(--text-dim, #8892a0);
                font-size: 0.9rem;
            }
            
            .search-filters {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                flex-wrap: wrap;
            }
            
            .search-filter-label {
                color: var(--text-dim, #8892a0);
                font-size: 0.85rem;
            }
            
            .search-category-tag {
                background: var(--accent-color, #00d4aa)20;
                color: var(--accent-color, #00d4aa);
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 500;
            }
            
            .no-search-results {
                text-align: center;
                padding: 3rem 2rem;
                color: var(--text-dim, #8892a0);
            }
            
            .no-results-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            
            .no-search-results h3 {
                color: var(--text-color, #ffffff);
                margin-bottom: 1rem;
            }
            
            .search-suggestions {
                text-align: left;
                max-width: 400px;
                margin: 1.5rem auto 0;
            }
            
            .search-suggestions li {
                margin-bottom: 0.5rem;
                padding-left: 1rem;
            }
            
            .search-category-section {
                margin-bottom: 2rem;
            }
            
            .search-category-header {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--border-color, #2a3338);
                color: var(--text-color, #ffffff);
                font-size: 1.25rem;
                font-weight: 600;
            }
            
            .category-icon {
                font-size: 1.5rem;
            }
            
            .search-category-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 1.5rem;
            }
            
            .search-result-card {
                transition: all 0.3s ease;
                cursor: pointer;
            }
            
            /* Ensure search result cards inherit flip behavior */
            .search-result-card .card-inner {
                transition: transform 0.6s;
                transform-style: preserve-3d;
            }
            
            .search-result-card.flipped .card-inner {
                transform: rotateY(180deg);
            }
            
            .search-result-card .component-type-badge {
                background: var(--accent-color, #00d4aa)20;
                color: var(--accent-color, #00d4aa);
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: capitalize;
            }
            
            .search-result-card .card-title {
                color: var(--text-primary, #ffffff);
                font-size: 1.1rem;
                font-weight: normal;
                margin: 0.75rem 0 0.5rem 0;
                text-transform: capitalize;
            }
            
            .search-result-card .card-description {
                color: var(--text-secondary, #8892a0);
                font-size: 0.8rem;
                line-height: 1.4;
                text-align: center;
                margin-bottom: 1rem;
            }
            
            /* Card back should match main template card styles */
            .search-result-card .card-back {
                background: var(--bg-tertiary);
                padding: 1.5rem;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
            }
            
            .search-result-card .card-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                margin-top: auto;
            }
            
            .search-result-card .tag {
                background: var(--hover-bg, #2a3338);
                color: var(--text-dim, #8892a0);
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: 500;
            }
            
            .search-result-card .tag-more {
                background: var(--accent-color, #00d4aa)30;
                color: var(--accent-color, #00d4aa);
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: 600;
            }
            
            .search-result-card .card-back h3 {
                color: var(--text-primary, #ffffff);
                font-size: 0.85rem;
                font-weight: normal;
                margin-bottom: 0.5rem;
                text-align: center;
            }
            
            .search-result-card .command-display {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                padding: 0;
            }
            
            .search-result-card .command-code-container {
                position: relative;
                width: 100%;
                display: flex;
                align-items: center;
                background: var(--bg-tertiary);
                border: 1px solid var(--border-secondary);
                border-radius: 4px;
                padding: 8px 12px;
                margin-bottom: 0.5rem;
                flex-shrink: 0;
            }
            
            .search-result-card .command-code {
                flex: 1;
                color: var(--text-primary, #ffffff);
                font-size: 0.75rem;
                font-family: 'Monaco', 'Menlo', monospace;
                overflow-x: auto;
                white-space: nowrap;
                padding-right: 8px;
            }
            
            .search-result-card .copy-overlay-btn {
                background: var(--text-accent, #00d4aa);
                border: none;
                color: var(--bg-primary, #0a0e0f);
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 10px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 4px;
                opacity: 0;
                transform: translateX(10px);
                position: absolute;
                right: 6px;
                z-index: 2;
            }
            
            .search-result-card .command-code-container:hover .copy-overlay-btn {
                opacity: 1;
                transform: translateX(0);
            }
            
            .search-result-card .copy-overlay-btn:hover {
                background: var(--text-success, #22c55e);
                transform: translateX(0) translateY(-1px);
                box-shadow: 0 2px 8px rgba(0, 212, 170, 0.3);
            }
            
            .search-result-card .btn {
                background: var(--accent-color, #00d4aa);
                color: var(--bg-color, #0a0e0f);
                border: none;
                padding: 0.75rem 1rem;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                width: 100%;
            }
            
            .search-result-card .btn:hover {
                background: var(--accent-color, #00d4aa)90;
                transform: translateY(-1px);
            }
            
            /* View Details and Add to Stack buttons */
            .search-result-card .view-files-btn {
                background: rgba(0, 255, 0, 0.2); /* Debug background */
                border: 2px solid lime; /* Debug border */
                color: var(--text-color, #ffffff);
                padding: 0.4rem 0.6rem;
                border-radius: 4px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.3rem;
                width: 100%;
                margin-bottom: 0;
                font-size: 0.75rem;
            }
            
            .search-result-card .view-files-btn:hover {
                background: var(--hover-bg, #2a3338);
                border-color: var(--accent-color, #00d4aa);
                transform: translateY(-1px);
            }
            
            .search-result-card .add-to-cart-btn {
                background: rgba(255, 255, 0, 0.5); /* Debug background */
                border: 2px solid yellow; /* Debug border */
                color: black; /* Debug text color */
                padding: 0.4rem 0.6rem;
                border-radius: 4px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.3rem;
                width: 100%;
                font-size: 0.75rem;
            }
            
            .search-result-card .add-to-cart-btn:hover {
                background: var(--accent-color, #00d4aa)90;
                transform: translateY(-1px);
            }
            
            .search-result-card .add-to-cart-btn.added {
                background: var(--success-color, #22c55e);
                color: var(--bg-color, #0a0e0f);
            }
            
            /* Card actions container */
            .search-result-card .card-actions {
                display: flex;
                flex-direction: column;
                gap: 0.4rem;
                width: 100%;
                margin-top: auto;
                background: rgba(255, 0, 0, 0.1); /* Debug background */
                border: 1px solid red; /* Debug border */
                padding: 4px; /* Debug padding */
            }
            
            @media (max-width: 768px) {
                .search-results-info {
                    flex-direction: column;
                    align-items: flex-start;
                }
                
                .search-category-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(searchStyles);
    }
});

/**
 * Hide filter elements during search
 */
function hideFilters() {
    const filterGroup = document.querySelector('.filter-group');
    const componentCategories = document.getElementById('componentCategories');
    
    if (filterGroup) {
        filterGroup.style.display = 'none';
    }
    
    if (componentCategories) {
        componentCategories.style.display = 'none';
    }
}

/**
 * Show filter elements when search is cleared
 */
function showFilters() {
    const filterGroup = document.querySelector('.filter-group');
    const componentCategories = document.getElementById('componentCategories');
    
    if (filterGroup) {
        filterGroup.style.display = 'flex';
    }
    
    if (componentCategories) {
        componentCategories.style.display = 'block';
    }
}