// Stack Router - Handles company and technology specific stack pages
class StackRouter {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.init();
    }

    init() {
        // Listen for hash changes and initial load
        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('load', () => this.handleRouteChange());
        
        // Check for path-based routes on load
        this.handleRouteChange();
    }

    // Get company info from data loader
    getCompanyInfo(slug) {
        return window.dataLoader.getCompanyInfo(slug);
    }

    // Get technology info from data loader
    getTechnologyInfo(slug) {
        return window.dataLoader.getTechnologyInfo(slug);
    }

    // Handle route changes
    handleRouteChange() {
        const path = window.location.pathname;
        const hash = window.location.hash;
        
        // Check for company routes (/company/epic-games)
        const companyMatch = path.match(/\/company\/([^\/]+)/);
        if (companyMatch) {
            this.loadCompanyStack(companyMatch[1]);
            return;
        }

        // Check for technology routes (/technology/unity)
        const technologyMatch = path.match(/\/technology\/([^\/]+)/);
        if (technologyMatch) {
            this.loadTechnologyStack(technologyMatch[1]);
            return;
        }

        // Check for hash-based routes for development
        if (hash.startsWith('#/company/')) {
            const company = hash.replace('#/company/', '');
            this.loadCompanyStack(company);
            return;
        }

        if (hash.startsWith('#/technology/')) {
            const technology = hash.replace('#/technology/', '');
            this.loadTechnologyStack(technology);
            return;
        }

        if (hash === '#/companies') {
            this.loadAllCompaniesPage();
            return;
        }

        // Return to main page
        this.loadMainPage();
    }

    // Load company-specific stack page
    async loadCompanyStack(companySlug) {
        console.log('Loading company stack:', companySlug);
        
        const companyInfo = this.getCompanyInfo(companySlug);
        if (!companyInfo) {
            console.error('Company not found:', companySlug);
            return;
        }

        this.currentRoute = { type: 'company', slug: companySlug, info: companyInfo };
        
        // Wait for data to be loaded
        if (!window.dataLoader.componentsData) {
            await window.dataLoader.loadAllComponents();
        }
        
        // Get company stack components
        const stackComponents = window.dataLoader.getCompanyStack(companySlug);
        
        // Update page content
        this.renderStackPage(companyInfo, stackComponents, 'company');
        
        // Update page title and meta
        document.title = `${companyInfo.name} Stack - Claude Code Templates`;
        this.updateMetaTags(companyInfo, 'company');
    }

    // Load technology-specific stack page
    async loadTechnologyStack(techSlug) {
        console.log('Loading technology stack:', techSlug);
        
        const techInfo = this.getTechnologyInfo(techSlug);
        if (!techInfo) {
            console.error('Technology not found:', techSlug);
            return;
        }

        this.currentRoute = { type: 'technology', slug: techSlug, info: techInfo };
        
        // Wait for data to be loaded
        if (!window.dataLoader.componentsData) {
            await window.dataLoader.loadAllComponents();
        }
        
        // Get technology stack components
        const stackComponents = window.dataLoader.getTechnologyStack(techSlug);
        
        // Update page content
        this.renderStackPage(techInfo, stackComponents, 'technology');
        
        // Update page title and meta
        document.title = `${techInfo.name} Stack - Claude Code Templates`;
        this.updateMetaTags(techInfo, 'technology');
    }

    // Render stack page content
    renderStackPage(stackInfo, components, type) {
        const main = document.querySelector('main.terminal');
        if (!main) return;
        
        // Hide original content
        const originalSections = main.querySelectorAll('section:not(.stack-page)');
        originalSections.forEach(section => section.style.display = 'none');
        
        // Remove existing stack page if any
        const existingStackPage = main.querySelector('.stack-page');
        if (existingStackPage) {
            existingStackPage.remove();
        }
        
        // Create stack page
        const stackPageHTML = this.generateStackPageHTML(stackInfo, components, type);
        main.insertAdjacentHTML('afterbegin', stackPageHTML);
        
        // Initialize cart functionality for the new page
        if (window.initializeCartForStackPage) {
            window.initializeCartForStackPage();
        }
        
        // Update header to show back button
        this.updateHeaderForStack(stackInfo);
    }

    // Generate stack page HTML
    generateStackPageHTML(stackInfo, components, type) {
        const totalComponents = Object.values(components).reduce((sum, arr) => sum + arr.length, 0);
        
        return `
        <section class="stack-page">
            <!-- Stack Header -->
            <div class="stack-header">
                <div class="stack-info">
                    <div class="stack-logo">${stackInfo.logo}</div>
                    <div class="stack-details">
                        <h1>${stackInfo.name} Development Stack</h1>
                        <p class="stack-description">${stackInfo.description}</p>
                        <div class="stack-stats">
                            <div class="stack-stat">
                                <span class="stat-number">${totalComponents}</span>
                                <span class="stat-label">Components</span>
                            </div>
                            <div class="stack-stat">
                                <span class="stat-number">${components.agents.length}</span>
                                <span class="stat-label">Agents</span>
                            </div>
                            <div class="stack-stat">
                                <span class="stat-number">${components.commands.length}</span>
                                <span class="stat-label">Commands</span>
                            </div>
                            <div class="stack-stat">
                                <span class="stat-number">${components.mcps.length}</span>
                                <span class="stat-label">MCPs</span>
                            </div>
                        </div>
                        ${stackInfo.website ? `<a href="${stackInfo.website}" target="_blank" class="stack-website">Visit ${stackInfo.name} →</a>` : ''}
                    </div>
                </div>
            </div>
            
            <!-- Stack Components -->
            <div class="stack-components">
                ${this.generateStackComponentsHTML(components)}
            </div>
            
            <!-- Install All Section -->
            <div class="stack-install-all">
                <h3>🚀 Install Complete ${stackInfo.name} Stack</h3>
                <p>Get all ${totalComponents} components with a single command:</p>
                <div class="command-line">
                    <span class="prompt">$</span>
                    <code class="command" id="stackInstallCommand">${this.generateStackInstallCommand(components)}</code>
                    <button class="copy-btn" onclick="copyToClipboard(document.getElementById('stackInstallCommand').textContent)">Copy</button>
                </div>
            </div>
        </section>
        `;
    }

    // Generate components sections HTML
    generateStackComponentsHTML(components) {
        let html = '';
        
        const sections = [
            { type: 'agents', title: 'AI Agents', icon: '🤖', description: 'Specialized AI assistants for your workflow' },
            { type: 'commands', title: 'Commands', icon: '⚡', description: 'Ready-to-use automation commands' },
            { type: 'mcps', title: 'MCPs', icon: '🔌', description: 'Model Context Protocol integrations' }
        ];
        
        sections.forEach(section => {
            const items = components[section.type] || [];
            if (items.length > 0) {
                html += `
                <div class="stack-section">
                    <div class="stack-section-header">
                        <h3>${section.icon} ${section.title}</h3>
                        <p>${section.description}</p>
                        <span class="component-count">${items.length} ${items.length === 1 ? section.type.slice(0, -1) : section.type}</span>
                    </div>
                    <div class="stack-grid">
                        ${items.map(component => this.generateComponentCardHTML(component)).join('')}
                    </div>
                </div>
                `;
            }
        });
        
        return html;
    }

    // Generate component card HTML
    generateComponentCardHTML(component) {
        const { tags, companies, technologies } = window.dataLoader.getComponentMetadata(component.name);
        
        return `
        <div class="component-card stack-component" data-name="${component.name}" data-type="${component.type}">
            <div class="component-header">
                <h4>${component.name}</h4>
                <div class="component-actions">
                    <button class="add-to-cart-btn" onclick="addToCart('${component.name}', '${component.type}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,7H18V6A6,6 0 0,0 6,6V7H5A1,1 0 0,0 4,8V19A3,3 0 0,0 7,22H17A3,3 0 0,0 20,19V8A1,1 0 0,0 19,7M12,2A4,4 0 0,1 16,6V7H8V6A4,4 0 0,1 12,2M7,20A1,1 0 0,1 6,19V9H8V11A1,1 0 0,0 10,11A1,1 0 0,0 10,9V9H14V11A1,1 0 0,0 16,11A1,1 0 0,0 16,9V9H18V19A1,1 0 0,1 17,20H7M12,13A1,1 0 0,0 11,14A1,1 0 0,0 12,15A1,1 0 0,0 13,14A1,1 0 0,0 12,13Z"/>
                        </svg>
                        Add
                    </button>
                </div>
            </div>
            <div class="component-content">
                ${this.extractDescription(component.content)}
            </div>
            ${tags.length > 0 || technologies.length > 0 ? `
            <div class="component-tags">
                ${[...tags.slice(0, 3), ...technologies.slice(0, 2)].map(tag => 
                    `<span class="component-tag">${tag}</span>`
                ).join('')}
            </div>
            ` : ''}
        </div>
        `;
    }

    // Extract description from component content
    extractDescription(content) {
        const descMatch = content.match(/description:\s*(.+?)(?:\n|$)/);
        if (descMatch) {
            return descMatch[1].replace(/^['"]|['"]$/g, '').substring(0, 150) + '...';
        }
        return 'No description available';
    }

    // Generate install command for entire stack
    generateStackInstallCommand(components) {
        const allComponents = [...components.agents, ...components.commands, ...components.mcps];
        const componentArgs = allComponents.map(c => `--${c.type} ${c.name}`).join(' ');
        return `npx claude-code-templates@latest ${componentArgs}`;
    }

    // Update header for stack page
    updateHeaderForStack(stackInfo) {
        const header = document.querySelector('.header');
        if (!header) return;
        
        // Add back button
        let backButton = header.querySelector('.back-button');
        if (!backButton) {
            backButton = document.createElement('button');
            backButton.className = 'back-button';
            backButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>
                </svg>
                Back to Main
            `;
            backButton.onclick = () => this.goBack();
            
            const headerContent = header.querySelector('.header-content');
            if (headerContent) {
                headerContent.insertBefore(backButton, headerContent.firstChild);
            }
        }
    }

    // Update meta tags for SEO
    updateMetaTags(stackInfo, type) {
        // Update Open Graph tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDescription = document.querySelector('meta[property="og:description"]');
        
        if (ogTitle) {
            ogTitle.content = `${stackInfo.name} Development Stack - Claude Code Templates`;
        }
        
        if (ogDescription) {
            ogDescription.content = stackInfo.description;
        }
        
        // Update Twitter tags
        const twitterTitle = document.querySelector('meta[property="twitter:title"]');
        const twitterDescription = document.querySelector('meta[property="twitter:description"]');
        
        if (twitterTitle) {
            twitterTitle.content = `${stackInfo.name} Development Stack - Claude Code Templates`;
        }
        
        if (twitterDescription) {
            twitterDescription.content = stackInfo.description;
        }
    }

    // Navigate back to main page
    goBack() {
        // Remove stack page
        const stackPage = document.querySelector('.stack-page');
        if (stackPage) {
            stackPage.remove();
        }
        
        // Show original content
        const main = document.querySelector('main.terminal');
        if (main) {
            const originalSections = main.querySelectorAll('section:not(.stack-page)');
            originalSections.forEach(section => section.style.display = '');
        }
        
        // Remove back button
        const backButton = document.querySelector('.back-button');
        if (backButton) {
            backButton.remove();
        }
        
        // Reset route
        this.currentRoute = null;
        window.history.pushState({}, '', window.location.pathname);
        
        // Reset page title and meta
        document.title = 'Claude Code Templates';
        this.resetMetaTags();
    }

    // Load main page (reset everything)
    loadMainPage() {
        if (this.currentRoute) {
            this.goBack();
        }
    }

    // Reset meta tags to original values
    resetMetaTags() {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDescription = document.querySelector('meta[property="og:description"]');
        
        if (ogTitle) {
            ogTitle.content = 'Claude Code Templates - Ready-to-use configurations';
        }
        
        if (ogDescription) {
            ogDescription.content = 'Browse and install Claude Code configuration templates for different languages and frameworks. Includes 100+ agents, 159+ commands, 23+ MCPs, and 14+ templates.';
        }
    }

    // Load all companies page
    async loadAllCompaniesPage() {
        console.log('Loading all companies page');
        
        this.currentRoute = { type: 'companies', slug: 'all' };
        
        // Wait for data to be loaded
        if (!window.dataLoader.componentsData) {
            await window.dataLoader.loadAllComponents();
        }
        
        // Update page content
        this.renderAllCompaniesPage();
        
        // Update page title and meta
        document.title = 'All Development Stacks - Claude Code Templates';
        this.updateMetaTagsForAllCompanies();
    }

    // Render all companies page
    renderAllCompaniesPage() {
        const main = document.querySelector('main.terminal');
        if (!main) return;
        
        // Hide original content
        const originalSections = main.querySelectorAll('section:not(.stack-page)');
        originalSections.forEach(section => section.style.display = 'none');
        
        // Remove existing stack page if any
        const existingStackPage = main.querySelector('.stack-page');
        if (existingStackPage) {
            existingStackPage.remove();
        }
        
        // Get all companies from metadata
        const allCompanies = window.dataLoader.metadataData?.companies || {};
        
        // Create all companies page
        const allCompaniesHTML = this.generateAllCompaniesPageHTML(allCompanies);
        main.insertAdjacentHTML('afterbegin', allCompaniesHTML);
        
        // Update header to show back button
        this.updateHeaderForStack({ name: 'All Development Stacks' });
    }

    // Generate all companies page HTML
    generateAllCompaniesPageHTML(companies) {
        const companiesArray = Object.entries(companies);
        
        // Group companies by category
        const categories = {
            'AI & Machine Learning': ['openai', 'anthropic'],
            'Payments & E-commerce': ['stripe', 'shopify', 'shopify'],
            'CRM & Business': ['salesforce', 'hubspot', 'airtable', 'linear'],
            'Communication': ['twilio', 'slack', 'discord', 'sendgrid'],
            'Cloud & Infrastructure': ['aws', 'vercel', 'netlify', 'cloudflare', 'firebase', 'supabase'],
            'Databases': ['mongodb', 'planetscale'],
            'Development Tools': ['github', 'figma', 'adobe', 'atlassian', 'notion'],
            'Entertainment & Media': ['spotify', 'youtube', 'twitter'],
            'Game Development': ['unity-technologies', 'epic-games'],
            'Marketing': ['mailchimp', 'hubspot']
        };
        
        let categorizedHTML = '';
        let uncategorizedCompanies = [...companiesArray];
        
        // Generate categorized sections
        Object.entries(categories).forEach(([categoryName, companyIds]) => {
            const categoryCompanies = companyIds
                .map(id => companiesArray.find(([key]) => key === id))
                .filter(Boolean);
            
            if (categoryCompanies.length > 0) {
                categorizedHTML += `
                <div class="companies-category">
                    <h3 class="category-title">${categoryName}</h3>
                    <div class="companies-grid">
                        ${categoryCompanies.map(([key, company]) => {
                            // Remove from uncategorized list
                            uncategorizedCompanies = uncategorizedCompanies.filter(([k]) => k !== key);
                            return this.generateCompanyCardHTML(key, company);
                        }).join('')}
                    </div>
                </div>
                `;
            }
        });
        
        // Add uncategorized companies if any
        if (uncategorizedCompanies.length > 0) {
            categorizedHTML += `
            <div class="companies-category">
                <h3 class="category-title">Other Platforms</h3>
                <div class="companies-grid">
                    ${uncategorizedCompanies.map(([key, company]) => 
                        this.generateCompanyCardHTML(key, company)
                    ).join('')}
                </div>
            </div>
            `;
        }
        
        return `
        <section class="stack-page all-companies-page">
            <div class="stack-header">
                <div class="stack-info">
                    <div class="stack-logo">🏢</div>
                    <div class="stack-details">
                        <h1>All Development Stacks</h1>
                        <p class="stack-description">Complete list of companies and platforms with development APIs, SDKs, and integration opportunities</p>
                        <div class="stack-stats">
                            <div class="stack-stat">
                                <span class="stat-number">${companiesArray.length}</span>
                                <span class="stat-label">Companies</span>
                            </div>
                            <div class="stack-stat">
                                <span class="stat-number">${Object.keys(categories).length}</span>
                                <span class="stat-label">Categories</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="all-companies-content">
                ${categorizedHTML}
            </div>
        </section>
        `;
    }

    // Generate individual company card for all companies page
    generateCompanyCardHTML(companyKey, company) {
        return `
        <a href="#/company/${companyKey}" class="all-company-card" onclick="window.stackRouter?.navigateTo('#/company/${companyKey}')">
            <div class="company-card-logo">${company.logo}</div>
            <div class="company-card-info">
                <h4>${company.name}</h4>
                <p>${company.description}</p>
            </div>
            <div class="company-card-arrow">→</div>
        </a>
        `;
    }

    // Update meta tags for all companies page
    updateMetaTagsForAllCompanies() {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDescription = document.querySelector('meta[property="og:description"]');
        
        if (ogTitle) {
            ogTitle.content = 'All Development Stacks - Claude Code Templates';
        }
        
        if (ogDescription) {
            ogDescription.content = 'Browse all available development stacks for major companies and platforms. Find agents, commands, and MCPs for APIs like OpenAI, Stripe, Shopify, AWS, and more.';
        }
    }

    // Navigate programmatically
    navigateTo(path) {
        window.history.pushState({}, '', path);
        this.handleRouteChange();
    }
}

// Initialize router when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.stackRouter = new StackRouter();
});

// Make it available globally
window.StackRouter = StackRouter;