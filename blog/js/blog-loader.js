/**
 * Blog Articles Dynamic Loader
 * Loads and renders blog articles from blog-articles.json
 */

class BlogLoader {
    constructor() {
        this.articles = [];
        this.filteredArticles = [];
        this.articlesContainer = null;
        this.searchInput = null;
        this.sortSelect = null;
        this.currentSearchTerm = '';
        this.currentSortBy = 'date-desc';
    }

    /**
     * Initialize the blog loader
     */
    async init() {
        try {
            this.articlesContainer = document.querySelector('.articles-grid');
            this.searchInput = document.getElementById('blog-search');
            this.sortSelect = document.getElementById('sort-by');

            if (!this.articlesContainer) {
                console.error('Articles container not found');
                return;
            }

            // Show loading state
            this.showLoading();

            // Load articles from JSON
            await this.loadArticles();

            // Setup event listeners
            this.setupEventListeners();

            // Render articles
            this.renderArticles();

        } catch (error) {
            console.error('Error initializing blog loader:', error);
            this.showError();
        }
    }

    /**
     * Setup event listeners for search and sort
     */
    setupEventListeners() {
        // Search input
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.currentSearchTerm = e.target.value.trim().toLowerCase();
                this.applyFiltersAndSort();
                this.updateClearButton();
            });
        }

        // Clear search button
        const clearSearchBtn = document.getElementById('clear-search');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                this.searchInput.value = '';
                this.currentSearchTerm = '';
                this.applyFiltersAndSort();
                this.updateClearButton();
                this.searchInput.focus();
            });
        }

        // Sort select
        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', (e) => {
                this.currentSortBy = e.target.value;
                this.applyFiltersAndSort();
            });
        }

        // Clear filters button
        const clearFiltersBtn = document.getElementById('clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.searchInput.value = '';
                this.currentSearchTerm = '';
                this.sortSelect.value = 'date-desc';
                this.currentSortBy = 'date-desc';
                this.applyFiltersAndSort();
                this.updateClearButton();
            });
        }
    }

    /**
     * Update clear button visibility
     */
    updateClearButton() {
        const clearSearchBtn = document.getElementById('clear-search');
        if (clearSearchBtn) {
            clearSearchBtn.style.display = this.currentSearchTerm ? 'flex' : 'none';
        }
    }

    /**
     * Apply filters and sorting
     */
    applyFiltersAndSort() {
        // Start with all articles
        this.filteredArticles = [...this.articles];

        // Apply search filter
        if (this.currentSearchTerm) {
            this.filteredArticles = this.filteredArticles.filter(article => {
                const searchableText = [
                    article.title,
                    article.description,
                    article.category,
                    ...article.tags
                ].join(' ').toLowerCase();

                return searchableText.includes(this.currentSearchTerm);
            });
        }

        // Apply sorting
        this.sortArticles(this.currentSortBy);

        // Update results info
        this.updateResultsInfo();

        // Re-render articles
        this.renderArticles();
    }

    /**
     * Sort articles based on selected option
     */
    sortArticles(sortBy) {
        const difficultyOrder = { basic: 1, intermediate: 2, advanced: 3 };

        // Helper function to parse date as local time
        const parseDate = (dateString) => {
            const [year, month, day] = dateString.split('-').map(Number);
            return new Date(year, month - 1, day);
        };

        switch (sortBy) {
            case 'date-asc':
                this.filteredArticles.sort((a, b) =>
                    parseDate(a.publishDate) - parseDate(b.publishDate)
                );
                break;
            case 'difficulty-asc':
                this.filteredArticles.sort((a, b) =>
                    difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
                );
                break;
            case 'difficulty-desc':
                this.filteredArticles.sort((a, b) =>
                    difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty]
                );
                break;
            case 'date-desc':
            default:
                // Newest first is now the default
                this.filteredArticles.sort((a, b) =>
                    parseDate(b.publishDate) - parseDate(a.publishDate)
                );
                break;
        }
    }

    /**
     * Update results info display
     */
    updateResultsInfo() {
        const resultsInfo = document.getElementById('results-info');
        const resultsCount = document.getElementById('results-count');
        const clearFiltersBtn = document.getElementById('clear-filters');

        if (!resultsInfo || !resultsCount) return;

        const isFiltered = this.currentSearchTerm || this.currentSortBy !== 'date-desc';
        const total = this.articles.length;
        const showing = this.filteredArticles.length;

        if (this.currentSearchTerm && showing === 0) {
            resultsInfo.style.display = 'flex';
            resultsCount.textContent = `No articles found for "${this.currentSearchTerm}"`;
            clearFiltersBtn.style.display = 'inline-flex';
        } else if (this.currentSearchTerm) {
            resultsInfo.style.display = 'flex';
            resultsCount.textContent = `Showing ${showing} of ${total} articles`;
            clearFiltersBtn.style.display = 'inline-flex';
        } else {
            resultsInfo.style.display = 'none';
            clearFiltersBtn.style.display = 'none';
        }
    }

    /**
     * Load articles from JSON file
     */
    async loadArticles() {
        try {
            const response = await fetch('blog-articles.json');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Sort articles by order field initially
            this.articles = data.articles.sort((a, b) => a.order - b.order);
            this.filteredArticles = [...this.articles];

            console.log(`Loaded ${this.articles.length} articles`);

        } catch (error) {
            console.error('Error loading articles:', error);
            throw error;
        }
    }

    /**
     * Render all articles to the DOM
     */
    renderArticles() {
        if (!this.filteredArticles || this.filteredArticles.length === 0) {
            if (this.currentSearchTerm) {
                this.showNoResults();
            } else {
                this.showEmpty();
            }
            return;
        }

        // Clear container
        this.articlesContainer.innerHTML = '';

        // Render each filtered article
        this.filteredArticles.forEach(article => {
            const articleCard = this.createArticleCard(article);
            this.articlesContainer.appendChild(articleCard);
        });
    }

    /**
     * Show no results message
     */
    showNoResults() {
        this.articlesContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem; color: #666; grid-column: 1 / -1;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem;">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="11" y1="16" x2="11.01" y2="16"></line>
                </svg>
                <h3 style="margin-bottom: 0.5rem; color: #00D084;">No articles found</h3>
                <p>Try adjusting your search terms or filters</p>
            </div>
        `;
    }

    /**
     * Create article card HTML element
     * @param {Object} article - Article data
     * @returns {HTMLElement} Article card element
     */
    createArticleCard(article) {
        const articleElement = document.createElement('article');
        articleElement.className = 'article-card';

        // Determine if it's external or local
        const isExternal = article.url.startsWith('http');
        const linkAttrs = isExternal
            ? 'target="_blank" rel="noopener noreferrer"'
            : '';

        // Create difficulty badge
        const difficultyBadge = this.getDifficultyBadge(article.difficulty);

        // Generate tags HTML
        const tagsHTML = article.tags
            .map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`)
            .join('');

        articleElement.innerHTML = `
            <a href="${this.escapeHtml(article.url)}" ${linkAttrs} class="article-link">
                <div class="article-image">
                    <img src="${this.escapeHtml(article.image)}"
                         alt="${this.escapeHtml(article.title)}"
                         loading="lazy">
                    <div class="article-category">${this.escapeHtml(article.category)}</div>
                </div>
                <div class="article-content">
                    <div class="article-meta">
                        <time datetime="${this.escapeHtml(article.publishDate)}">
                            ${this.formatDate(article.publishDate)}
                        </time>
                        <span class="read-time">${this.escapeHtml(article.readTime)}</span>
                        ${difficultyBadge}
                    </div>
                    <h2>${this.escapeHtml(article.title)}</h2>
                    <p>${this.escapeHtml(article.description)}</p>
                    <div class="article-tags">
                        ${tagsHTML}
                    </div>
                </div>
            </a>
        `;

        return articleElement;
    }

    /**
     * Get difficulty badge HTML
     * @param {string} difficulty - Difficulty level (basic, intermediate, advanced)
     * @returns {string} Badge HTML
     */
    getDifficultyBadge(difficulty) {
        const difficultyConfig = {
            basic: {
                label: 'Basic',
                color: '#00D084',
                textColor: '#000'
            },
            intermediate: {
                label: 'Intermediate',
                color: '#FFA500',
                textColor: '#000'
            },
            advanced: {
                label: 'Advanced',
                color: '#FF4444',
                textColor: '#FFF'
            }
        };

        const config = difficultyConfig[difficulty] || difficultyConfig.basic;

        return `<span class="tag difficulty-badge" style="margin-left: 8px; background: ${config.color}; color: ${config.textColor};">${config.label}</span>`;
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.articlesContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem; color: #00D084;">
                <div class="loading-spinner"></div>
                <p style="margin-top: 1rem;">Loading articles...</p>
            </div>
        `;
    }

    /**
     * Show error state
     */
    showError() {
        this.articlesContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem; color: #ff4444;">
                <p>⚠️ Error loading articles. Please try again later.</p>
            </div>
        `;
    }

    /**
     * Show empty state
     */
    showEmpty() {
        this.articlesContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem; color: #666;">
                <p>No articles available at the moment.</p>
            </div>
        `;
    }

    /**
     * Format date string to readable format
     * @param {string} dateString - ISO date string (YYYY-MM-DD)
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        // Parse date as local time to avoid timezone issues
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize blog loader when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const blogLoader = new BlogLoader();
    blogLoader.init();
});

// Add loading spinner CSS
const style = document.createElement('style');
style.textContent = `
    .loading-spinner {
        border: 3px solid rgba(0, 208, 132, 0.1);
        border-top: 3px solid #00D084;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
