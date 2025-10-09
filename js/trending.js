/**
 * Trending Page JavaScript
 * GitHub-inspired trending components page for Claude Code Templates
 */

class TrendingPage {
    constructor() {
        this.currentType = 'agents';
        this.currentRange = 'month'; // Changed from 'today' to 'month' to show real data
        this.data = null;

        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.renderHeroStats();
            this.renderPopularItems();
            this.renderChart();
            this.renderTrendingItems();
        } catch (error) {
            console.error('Failed to initialize trending page:', error);
            this.showError('Failed to load trending data');
        }
    }

    async loadData() {
        try {
            const response = await fetch('trending-data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.data = await response.json();
        } catch (error) {
            console.error('Error loading trending data:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Component tabs
        document.querySelectorAll('.component-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                // Remove active class from all tabs
                document.querySelectorAll('.component-tab').forEach(t => t.classList.remove('active'));

                // Add active class to clicked tab
                e.target.classList.add('active');

                // Update current type
                this.currentType = e.target.dataset.type;
                this.renderTrendingItems();
            });
        });

        // Date range filter
        const dateRange = document.getElementById('date-range');
        if (dateRange) {
            dateRange.addEventListener('change', (e) => {
                this.currentRange = e.target.value;
                this.renderTrendingItems();
            });
        }
    }

    renderHeroStats() {
        const container = document.getElementById('hero-stats');
        if (!container || !this.data || !this.data.globalStats) {
            return;
        }

        // Use real global statistics from the JSON
        const globalStats = this.data.globalStats;

        const stats = [
            {
                number: globalStats.totalComponents.toLocaleString(),
                label: 'Unique Components',
                change: 'Across 6 categories',
                positive: true
            },
            {
                number: globalStats.totalDownloads.toLocaleString(),
                label: 'Total Downloads',
                change: 'All time downloads',
                positive: true
            },
            {
                number: globalStats.totalCountries.toLocaleString(),
                label: 'Countries',
                change: 'Global reach',
                positive: true
            }
        ];

        container.innerHTML = stats.map(stat => `
            <div class="hero-stat-item">
                <div class="hero-stat-number">${stat.number}</div>
                <div class="hero-stat-label">${stat.label}</div>
                <div class="hero-stat-change ${stat.positive ? '' : 'negative'}">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                        <path d="${stat.positive ? 'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0zm7-3.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z' : 'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM3.25 8a.75.75 0 0 1 .75-.75h8a.75.75 0 0 1 0 1.5h-8A.75.75 0 0 1 3.25 8z'}"/>
                    </svg>
                    ${stat.change}
                </div>
            </div>
        `).join('');
    }

    renderPopularItems() {
        const container = document.getElementById('popular-categories');
        if (!container || !this.data || !this.data.trending) {
            return;
        }

        // Define categories to show and their display info (excluding templates)
        const categories = [
            { key: 'agents', title: 'Agents', icon: 'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z' },
            { key: 'commands', title: 'Commands', icon: 'M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM2.5 8a5.5 5.5 0 1 0 11 0 5.5 5.5 0 0 0-11 0z' },
            { key: 'mcps', title: 'MCPs', icon: 'M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c0 .026.009.051.025.072L2.5 7a.5.5 0 0 1 0 .708L1.025 9.133a.149.149 0 0 0-.025.072V10.5A1.5 1.5 0 0 0 2.5 12h2.793a.149.149 0 0 0 .072-.025L7 10.5a.5.5 0 0 1 .708 0l1.625 1.475c.021.016.046.025.072.025H12.5A1.5 1.5 0 0 0 14 10.5v-.793a.149.149 0 0 0-.025-.072L12.5 8a.5.5 0 0 1 0-.708l1.475-1.625a.149.149 0 0 0 .025-.072V4.5A1.5 1.5 0 0 0 12.5 3H9.707a.149.149 0 0 0-.072.025L8 4.5a.5.5 0 0 1-.708 0L5.867 3.025A.149.149 0 0 0 5.793 3H2.5z' },
            { key: 'settings', title: 'Settings', icon: 'M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z' },
            { key: 'hooks', title: 'Hooks', icon: 'M1.5 1.5A.5.5 0 0 0 1 2v4.8a2.5 2.5 0 0 0 2.5 2.5h9.793l-3.347 3.346a.5.5 0 0 0 .708.708l4.2-4.2a.5.5 0 0 0 0-.708l-4.2-4.2a.5.5 0 0 0-.708.708L13.293 8.3H3.5A1.5 1.5 0 0 1 2 6.8V2a.5.5 0 0 0-.5-.5z' }
        ];

        container.innerHTML = '';

        categories.forEach(category => {
            const categoryData = this.data.trending[category.key];
            if (!categoryData || !Array.isArray(categoryData) || categoryData.length === 0) {
                return;
            }

            // Sort by monthly downloads and take only the top 1
            const topItem = categoryData
                .sort((a, b) => (b.downloadsMonth || 0) - (a.downloadsMonth || 0))[0];

            const itemElement = this.createPopularItemCard(category, topItem);
            container.appendChild(itemElement);
        });
    }

    createPopularItemCard(category, item) {
        const itemElement = document.createElement('div');
        itemElement.className = 'popular-item';

        const totalDownloads = item.downloadsTotal || 0;

        itemElement.innerHTML = `
            <div class="popular-item-header">
                <div class="popular-item-info">
                    <div class="popular-item-type">${category.title}</div>
                    <h4 class="popular-item-name">${item.name}</h4>
                </div>
            </div>

            <div class="popular-total-downloads">
                <span class="total-number">${totalDownloads.toLocaleString()}</span>
                <span class="total-label">downloads</span>
            </div>

            <div class="popular-stats">
                <button class="popular-install-btn" onclick="showInstallModal('${item.id || item.name}')">
                    <svg class="popular-install-icon" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                    </svg>
                    Get
                </button>
            </div>
        `;

        return itemElement;
    }

    renderChart() {
        if (!this.data || !this.data.chartData) {
            console.warn('No chart data available');
            return;
        }

        const ctx = document.getElementById('downloadsChart');
        if (!ctx) {
            console.warn('Chart canvas not found');
            return;
        }

        // Chart colors matching terminal theme (excluding templates)
        const colors = {
            commands: '#10b981',    // emerald (green)
            agents: '#f59e0b',      // amber (yellow)
            mcps: '#3b82f6',        // blue
            settings: '#8b5cf6',    // violet
            hooks: '#f97316'        // orange
        };

        // Define the desired order for the legend (agents first - most popular, excluding templates)
        const categoryOrder = ['agents', 'commands', 'mcps', 'settings', 'hooks'];

        // Prepare datasets in the specified order
        const datasets = categoryOrder
            .filter(category => this.data.chartData.series[category]) // Only include categories that exist
            .map(category => ({
                label: category.charAt(0).toUpperCase() + category.slice(1),
                data: this.data.chartData.series[category],
                borderColor: colors[category] || '#6b7280',
                backgroundColor: (colors[category] || '#6b7280') + '20',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointBackgroundColor: colors[category] || '#6b7280',
                pointBorderColor: '#1f2937',
                pointBorderWidth: 2
            }));

        // Create chart
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.data.chartData.dates.map(date => {
                    return new Date(date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                    });
                }),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#d1d5db',
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20,
                            font: {
                                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1f2937',
                        titleColor: '#f3f4f6',
                        bodyColor: '#d1d5db',
                        borderColor: '#374151',
                        borderWidth: 1,
                        titleFont: {
                            family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
                        },
                        bodyFont: {
                            family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
                        },
                        filter: function(tooltipItem, data) {
                            return true; // Show all items
                        },
                        itemSort: function(a, b) {
                            // Sort tooltip items by download count (highest to lowest)
                            return b.parsed.y - a.parsed.y;
                        },
                        callbacks: {
                            title: function(context) {
                                return `Date: ${context[0].label}`;
                            },
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} downloads`;
                            },
                            labelColor: function(context) {
                                // Use the same colors as defined for the chart lines
                                const category = context.dataset.label.toLowerCase();
                                const color = colors[category] || '#6b7280';
                                return {
                                    borderColor: color,
                                    backgroundColor: color
                                };
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#374151',
                            borderColor: '#4b5563'
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                                size: 10
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: '#374151',
                            borderColor: '#4b5563'
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                                size: 10
                            },
                            callback: function(value) {
                                return value.toLocaleString();
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    renderTrendingItems() {
        const container = document.getElementById('trending-list');
        const items = this.getFilteredItems();

        if (items.length === 0) {
            container.innerHTML = this.getEmptyState();
            return;
        }

        container.innerHTML = '';
        items.forEach((item, index) => {
            const itemElement = this.createTrendingItem(item, index + 1);
            container.appendChild(itemElement);
        });
    }

    getFilteredItems() {
        let allItems = [];
        
        if (this.currentType === '') {
            // If no filter, get items from "all" category if it exists, 
            // otherwise combine all categories
            if (this.data.trending.all) {
                allItems = this.data.trending.all;
            } else {
                Object.values(this.data.trending).forEach(categoryItems => {
                    if (Array.isArray(categoryItems)) {
                        allItems = allItems.concat(categoryItems);
                    }
                });
            }
        } else {
            // Get items from selected category
            allItems = this.data.trending[this.currentType] || [];
        }
        
        // Sort by the current date range downloads (highest to lowest)
        allItems.sort((a, b) => {
            const aDownloads = this.getDownloadsForRange(a);
            const bDownloads = this.getDownloadsForRange(b);
            return bDownloads - aDownloads;
        });
        
        // For "all" categories, limit to top 10
        if (this.currentType === '') {
            allItems = allItems.slice(0, 10);
        }
        
        return allItems;
    }

    createTrendingItem(item, rank) {
        const itemElement = document.createElement('div');
        itemElement.className = 'trending-item';
        
        const category = item.category || 'general';
        const itemType = this.getItemType(item);
        const componentType = this.getComponentTypeLabel(item);
        const downloads = this.getDownloadsForRange(item);
        
        itemElement.innerHTML = `
            <div class="trending-rank">
                <span class="rank-number">#${rank}</span>
            </div>
            
            <div class="trending-content">
                <div class="trending-header">
                    <div class="trending-title">
                        <svg class="trending-icon" fill="currentColor" viewBox="0 0 16 16">
                            <path d="${this.getIconPath(itemType)}"/>
                        </svg>
                        <h3 class="trending-name">${item.name}</h3>
                        <span class="trending-category">${category}</span>
                    </div>
                    <button class="install-button" onclick="showInstallModal('${item.id || item.name}')">
                        <svg class="install-icon" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                        </svg>
                        Install
                    </button>
                </div>
                
                <div class="trending-metadata">
                    <div class="trending-downloads">
                        <svg class="meta-icon" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                        </svg>
                        <span>${downloads.toLocaleString()} downloads ${this.getRangeLabel()}</span>
                    </div>
                    <div class="trending-type-badge">${componentType}</div>
                </div>
            </div>
        `;

        return itemElement;
    }

    getDownloadsForRange(item) {
        switch(this.currentRange) {
            case 'today':
                return item.downloadsToday || 0;
            case 'week':
                return item.downloadsWeek || 0;
            case 'month':
                return item.downloadsMonth || 0;
            default:
                return item.downloadsToday || 0;
        }
    }

    getRangeLabel() {
        switch(this.currentRange) {
            case 'today':
                return 'today';
            case 'week':
                return 'this week';
            case 'month':
                return 'this month';
            default:
                return 'today';
        }
    }

    getComponentTypeLabel(item) {
        // Determine the component type from the item ID or context
        const id = item.id || '';
        
        if (id.includes('agent-') || id.startsWith('agent') || this.currentType === 'agents') {
            return 'Agent';
        } else if (id.includes('command-') || id.startsWith('command') || this.currentType === 'commands') {
            return 'Command';
        } else if (id.includes('setting-') || id.startsWith('setting') || this.currentType === 'settings') {
            return 'Settings';
        } else if (id.includes('hook-') || id.startsWith('hook') || this.currentType === 'hooks') {
            return 'Hooks';
        } else if (id.includes('mcp-') || id.startsWith('mcp') || this.currentType === 'mcps') {
            return 'MCP';
        } else if (id.includes('template-') || id.startsWith('template') || this.currentType === 'templates') {
            return 'Template';
        }
        
        // Fallback: try to determine from data structure
        if (item.expertise) return 'Agent';
        if (item.command) return 'Command';
        
        return 'Component';
    }

    renderContributors(contributors) {
        if (!contributors || contributors.length === 0) {
            return '';
        }

        const contributorElements = contributors.slice(0, 3).map(contributor => 
            `<img class="contributor-avatar" src="${contributor.avatar}" alt="${contributor.name}" title="${contributor.name}">`
        ).join('');

        return `
            <div class="meta-item">
                <span>Built by</span>
                <div class="contributors">
                    ${contributorElements}
                </div>
            </div>
        `;
    }

    renderTags(tags) {
        if (!tags || tags.length === 0) {
            return '';
        }

        const tagElements = tags.map(tag => 
            `<span class="tag">${tag}</span>`
        ).join('');

        return `<div class="tags">${tagElements}</div>`;
    }

    getLanguageClass(language) {
        const languageMap = {
            'JavaScript/TypeScript': 'typescript',
            'JavaScript': 'javascript',
            'TypeScript': 'typescript',
            'Node.js/Express': 'nodejs',
            'Python': 'python',
            'SQL/Node.js': 'sql',
            'Docker': 'docker',
            'C#/Unity': 'csharp',
            'Unity/Game Development': 'unity',
            'Git/Bash': 'git',
            'Multi-language': 'javascript',
            'Universal': 'javascript'
        };

        return languageMap[language] || 'javascript';
    }

    getItemType(item) {
        // Determine item type based on data structure or properties
        if (item.expertise) return 'agents';
        if (item.command) return 'commands';
        if (item.type === 'settings') return 'settings';
        if (item.type === 'hooks') return 'hooks';
        if (item.type === 'mcps') return 'mcps';
        if (item.type === 'templates') return 'templates';
        return 'commands'; // default
    }

    getIconPath(type) {
        const icons = {
            commands: 'M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM2.5 8a5.5 5.5 0 1 0 11 0 5.5 5.5 0 0 0-11 0z',
            agents: 'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z',
            settings: 'M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z',
            hooks: 'M1.5 1.5A.5.5 0 0 0 1 2v4.8a2.5 2.5 0 0 0 2.5 2.5h9.793l-3.347 3.346a.5.5 0 0 0 .708.708l4.2-4.2a.5.5 0 0 0 0-.708l-4.2-4.2a.5.5 0 0 0-.708.708L13.293 8.3H3.5A1.5 1.5 0 0 1 2 6.8V2a.5.5 0 0 0-.5-.5z',
            mcps: 'M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c0 .026.009.051.025.072L2.5 7a.5.5 0 0 1 0 .708L1.025 9.133a.149.149 0 0 0-.025.072V10.5A1.5 1.5 0 0 0 2.5 12h2.793a.149.149 0 0 0 .072-.025L7 10.5a.5.5 0 0 1 .708 0l1.625 1.475c.021.016.046.025.072.025H12.5A1.5 1.5 0 0 0 14 10.5v-.793a.149.149 0 0 0-.025-.072L12.5 8a.5.5 0 0 1 0-.708l1.475-1.625a.149.149 0 0 0 .025-.072V4.5A1.5 1.5 0 0 0 12.5 3H9.707a.149.149 0 0 0-.072.025L8 4.5a.5.5 0 0 1-.708 0L5.867 3.025A.149.149 0 0 0 5.793 3H2.5z',
            templates: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75zM7.25 4a.75.75 0 0 1 1.5 0v4.25H12a.75.75 0 0 1 0 1.5H8.75V12a.75.75 0 0 1-1.5 0V9.75H4a.75.75 0 0 1 0-1.5h3.25V4z'
        };

        return icons[type] || icons.commands;
    }

    getEmptyState() {
        return `
            <div class="empty-state">
                <svg class="empty-state-icon" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773l4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215Z"/>
                </svg>
                <h3>No trending items found</h3>
                <p>Try adjusting your filters or check back later for new trending content.</p>
            </div>
        `;
    }

    showError(message) {
        const container = document.getElementById('trending-list');
        container.innerHTML = `
            <div class="empty-state">
                <svg class="empty-state-icon" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
                </svg>
                <h3>Error Loading Data</h3>
                <p>${message}</p>
            </div>
        `;
    }

    showLoading() {
        const container = document.getElementById('trending-list');
        container.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Loading trending components...</p>
            </div>
        `;
    }
}

// Initialize the trending page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.trendingPageInstance = new TrendingPage();
});

// Modal functionality
function showInstallModal(componentName) {
    const modal = document.getElementById('installModal');
    const commandText = document.getElementById('commandText');

    // Determine the component type from the current filter or component name
    let componentType = 'command'; // default
    let componentCategory = '';

    // Get the current trending page instance to check the type
    if (window.trendingPageInstance) {
        componentType = window.trendingPageInstance.currentType || 'commands';

        // Find the component in the data to get its category
        const items = window.trendingPageInstance.data.trending[componentType] || [];
        const item = items.find(i => (i.id || i.name) === componentName);
        if (item && item.category) {
            componentCategory = item.category;
        }
    }

    // Convert plural to singular for the command flag
    const typeMap = {
        'agents': 'agent',
        'commands': 'command',
        'settings': 'setting',
        'hooks': 'hook',
        'mcps': 'mcp',
        'templates': 'template'
    };

    const flagType = typeMap[componentType] || 'command';

    // Clean the component name by removing prefixes
    let cleanName = componentName;
    const prefixesToRemove = ['agent-', 'command-', 'setting-', 'hook-', 'mcp-', 'template-'];

    for (const prefix of prefixesToRemove) {
        if (cleanName.startsWith(prefix)) {
            cleanName = cleanName.substring(prefix.length);
            break;
        }
    }

    // Build the full component path: category/name
    const componentPath = componentCategory ? `${componentCategory}/${cleanName}` : cleanName;

    // Update the command with the correct flag and full component path
    const command = `npx claude-code-templates@latest --${flagType} ${componentPath} --yes`;
    commandText.textContent = command;

    // Show the modal
    modal.classList.add('show');

    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
}

function closeInstallModal() {
    const modal = document.getElementById('installModal');
    modal.classList.remove('show');
    
    // Restore body scrolling
    document.body.style.overflow = '';
    
    // Hide copy feedback
    const feedback = document.getElementById('copyFeedback');
    feedback.classList.remove('show');
}

function copyInstallCommand() {
    const commandText = document.getElementById('commandText');
    const copyFeedback = document.getElementById('copyFeedback');
    const copyButton = document.querySelector('.copy-button');
    
    // Copy to clipboard
    navigator.clipboard.writeText(commandText.textContent).then(() => {
        // Show success feedback
        copyFeedback.classList.add('show');
        
        // Temporarily change button text
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = `
            <svg class="copy-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
            Copied!
        `;
        
        // Reset after 2 seconds
        setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyFeedback.classList.remove('show');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        // Fallback for older browsers
        fallbackCopyTextToClipboard(commandText.textContent);
    });
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        const copyFeedback = document.getElementById('copyFeedback');
        copyFeedback.classList.add('show');
        setTimeout(() => {
            copyFeedback.classList.remove('show');
        }, 2000);
    } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
    }
    
    document.body.removeChild(textArea);
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeInstallModal();
    }
});

// Add some utility functions for future enhancements
window.TrendingUtils = {
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};