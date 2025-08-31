// Data Loader - Handles loading component data from various sources
class DataLoader {
    constructor() {
        this.componentsData = null;
        this.fullComponentsData = null; // Store full data for accurate counts
        this.templatesData = null; // Deprecated - templates now in components.json
        this.metadataData = null; // External metadata for tags, companies, technologies
        this.loadingStates = {
            components: false
        };
        this.cache = new Map();
        this.TIMEOUT_MS = 8000; // 8 seconds timeout
        this.ITEMS_PER_PAGE = 50; // Lazy loading batch size
    }

    // Load all components at once (simplified approach)
    async loadAllComponents() {
        try {
            this.loadingStates.components = true;
            this.showLoadingState('components', true);
            
            const cacheKey = 'all_components';
            if (this.cache.has(cacheKey)) {
                this.showLoadingState('components', false);
                this.loadingStates.components = false;
                return this.cache.get(cacheKey);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
            
            const response = await fetch('components.json', {
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'max-age=300' // 5 minutes cache
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const allData = await response.json();
            
            // Store both full and component data
            this.fullComponentsData = allData;
            this.componentsData = allData;
            
            // Load metadata
            await this.loadMetadata();
            
            this.cache.set(cacheKey, allData);
            
            this.showLoadingState('components', false);
            this.loadingStates.components = false;
            
            return this.componentsData;
        } catch (error) {
            this.showLoadingState('components', false);
            this.loadingStates.components = false;
            
            if (error.name === 'AbortError') {
                console.error('Components loading timed out after', this.TIMEOUT_MS + 'ms');
                this.showError('Loading timed out. Using fallback data.');
            } else {
                console.error('Error loading components:', error);
                this.showError('Failed to load components. Using fallback data.');
            }
            
            return this.getFallbackComponentData();
        }
    }
    
    // Load components with lazy loading and timeout (kept for backward compatibility)
    async loadComponents(page = 1, itemsPerPage = this.ITEMS_PER_PAGE) {
        try {
            this.loadingStates.components = true;
            this.showLoadingState('components', true);
            
            const cacheKey = `components_${page}_${itemsPerPage}`;
            if (this.cache.has(cacheKey)) {
                this.showLoadingState('components', false);
                this.loadingStates.components = false;
                return this.cache.get(cacheKey);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
            
            const response = await fetch('components.json', {
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'max-age=300' // 5 minutes cache
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const fullData = await response.json();
            
            // Store full data for accurate counts (only on first load)
            if (page === 1) {
                this.fullComponentsData = fullData;
            }
            
            // Apply pagination to reduce memory usage
            const paginatedData = this.paginateComponents(fullData, page, itemsPerPage);
            
            // Store full data for templates if it exists
            if (fullData.templates && page === 1) {
                paginatedData.templates = fullData.templates; // Templates don't need pagination
            }
            
            this.cache.set(cacheKey, paginatedData);
            this.componentsData = paginatedData;
            
            this.showLoadingState('components', false);
            this.loadingStates.components = false;
            
            return this.componentsData;
        } catch (error) {
            this.showLoadingState('components', false);
            this.loadingStates.components = false;
            
            if (error.name === 'AbortError') {
                console.error('Components loading timed out after', this.TIMEOUT_MS + 'ms');
                this.showError('Loading timed out. Using fallback data.');
            } else {
                console.error('Error loading components:', error);
                this.showError('Failed to load components. Using fallback data.');
            }
            
            return this.getFallbackComponentData();
        }
    }

    // Get fallback component data when components.json is unavailable
    getFallbackComponentData() {
        return {
            agents: [
                { name: 'code-reviewer', path: 'development/code-reviewer', category: 'development', type: 'agent', content: 'AI-powered code reviewer that analyzes your code for best practices, security issues, and optimization opportunities.' },
                { name: 'documentation-writer', path: 'development/documentation-writer', category: 'development', type: 'agent', content: 'Generates comprehensive documentation for your codebase, including API docs, README files, and inline comments.' },
                { name: 'bug-hunter', path: 'development/bug-hunter', category: 'development', type: 'agent', content: 'Specialized in finding and fixing bugs through systematic code analysis and testing.' },
                { name: 'security-auditor', path: 'security/security-auditor', category: 'security', type: 'agent', content: 'Performs security audits on your code to identify vulnerabilities and security best practices.' },
                { name: 'performance-optimizer', path: 'optimization/performance-optimizer', category: 'optimization', type: 'agent', content: 'Analyzes and optimizes code performance, identifying bottlenecks and suggesting improvements.' }
            ],
            commands: [
                { name: 'git-setup', path: 'development/git-setup', category: 'development', type: 'command', content: 'Sets up Git repository with best practices, including .gitignore, hooks, and workflow configurations.' },
                { name: 'project-init', path: 'development/project-init', category: 'development', type: 'command', content: 'Initializes new projects with proper structure, dependencies, and configuration files.' },
                { name: 'docker-setup', path: 'devops/docker-setup', category: 'devops', type: 'command', content: 'Creates Docker configurations including Dockerfile, docker-compose, and container optimization.' },
                { name: 'test-runner', path: 'testing/test-runner', category: 'testing', type: 'command', content: 'Sets up comprehensive testing frameworks and runs automated test suites.' },
                { name: 'build-pipeline', path: 'devops/build-pipeline', category: 'devops', type: 'command', content: 'Configures CI/CD pipelines for automated building, testing, and deployment.' }
            ],
            mcps: [
                { name: 'database-connector', path: 'database/database-connector', category: 'database', type: 'mcp', content: 'Connects to various databases and provides query and management capabilities.' },
                { name: 'api-client', path: 'api/api-client', category: 'api', type: 'mcp', content: 'HTTP client for interacting with REST APIs and web services.' },
                { name: 'file-manager', path: 'system/file-manager', category: 'system', type: 'mcp', content: 'File system operations including reading, writing, and organizing files.' },
                { name: 'redis-cache', path: 'database/redis-cache', category: 'database', type: 'mcp', content: 'Redis caching implementation for improved application performance.' },
                { name: 'email-service', path: 'communication/email-service', category: 'communication', type: 'mcp', content: 'Email sending and management service with template support.' }
            ]
        };
    }

    // Load templates - now using components.json data (templates deprecated)
    async loadTemplates() {
        try {
            // Templates are now included in components.json as 'templates' section
            // This method is kept for backward compatibility
            if (this.componentsData && this.componentsData.templates) {
                this.templatesData = { templates: this.componentsData.templates };
                return this.templatesData;
            }
            
            // If components aren't loaded yet, try to load them
            if (!this.componentsData) {
                await this.loadComponents();
                if (this.componentsData && this.componentsData.templates) {
                    this.templatesData = { templates: this.componentsData.templates };
                    return this.templatesData;
                }
            }
            
            // Return empty if no templates in components.json
            console.warn('No templates found in components.json');
            this.templatesData = {};
            return this.templatesData;
        } catch (error) {
            console.error('Error loading templates from components:', error);
            this.templatesData = {};
            return this.templatesData;
        }
    }

    // Parse the templates.js file content to extract TEMPLATES_CONFIG
    parseTemplatesConfig(fileContent) {
        try {
            const configMatch = fileContent.match(/const TEMPLATES_CONFIG = ({[\s\S]*?});/);
            if (!configMatch) {
                throw new Error('TEMPLATES_CONFIG not found in file');
            }
            
            let configString = configMatch[1];
            configString = configString.replace(/'/g, '"');
            configString = configString.replace(/(\w+):/g, '"$1":');
            configString = configString.replace(/,(\s*[}\]])/g, '$1');
            
            const config = JSON.parse(configString);
            return this.transformTemplatesData(config);
        } catch (error) {
            console.error('Error parsing templates config:', error);
            throw error;
        }
    }

    // Transform templates data to a unified format
    transformTemplatesData(config) {
        const unified = {};
        
        Object.entries(config).forEach(([category, items]) => {
            unified[category] = Object.entries(items).map(([key, template]) => ({
                id: key,
                name: template.name,
                description: template.description || '',
                type: 'template',
                category: category,
                folderPath: template.folderPath || '',
                content: template.description || '',
                files: template.files || [],
                ...template
            }));
        });

        return unified;
    }

    // Get all components as a flat array
    getAllComponents() {
        if (!this.componentsData) return [];
        
        const allComponents = [];
        ['agents', 'commands', 'mcps'].forEach(type => {
            if (this.componentsData[type]) {
                allComponents.push(...this.componentsData[type]);
            }
        });
        
        return allComponents;
    }

    // Find component by name and type
    findComponent(name, type) {
        if (!this.componentsData) return null;
        
        const typeKey = type + 's';
        if (!this.componentsData[typeKey]) return null;
        
        return this.componentsData[typeKey].find(component => component.name === name);
    }

    // Get components by type
    getComponentsByType(type) {
        if (!this.componentsData) return [];
        
        const typeKey = type + 's';
        return this.componentsData[typeKey] || [];
    }
    
    // Paginate components data to reduce memory usage
    paginateComponents(fullData, page, itemsPerPage) {
        const paginatedData = {
            agents: [],
            commands: [],
            mcps: [],
            templates: [] // Include templates in pagination structure
        };
        
        ['agents', 'commands', 'mcps'].forEach(type => {
            if (fullData[type]) {
                const startIndex = (page - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                paginatedData[type] = fullData[type].slice(startIndex, endIndex);
            }
        });
        
        // Templates don't need pagination - include all if available
        if (fullData.templates) {
            paginatedData.templates = fullData.templates;
        }
        
        return paginatedData;
    }
    
    // Show loading states
    showLoadingState(type, isLoading) {
        const loadingElement = document.getElementById(`${type}-loading`);
        const contentElement = document.getElementById(`${type}-content`);
        
        if (loadingElement && contentElement) {
            if (isLoading) {
                loadingElement.style.display = 'flex';
                contentElement.style.opacity = '0.5';
            } else {
                loadingElement.style.display = 'none';
                contentElement.style.opacity = '1';
            }
        }
        
        // Also update any loading spinners in the UI
        const spinners = document.querySelectorAll('.loading-spinner');
        spinners.forEach(spinner => {
            spinner.style.display = isLoading ? 'block' : 'none';
        });
    }
    
    // Show error messages
    showError(message) {
        // Try to use existing notification system
        if (window.showNotification) {
            window.showNotification(message, 'error', 5000);
        } else {
            console.warn(message);
            // Create simple toast notification
            const toast = document.createElement('div');
            toast.className = 'error-toast';
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f85149;
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                z-index: 1000;
                font-size: 14px;
                max-width: 300px;
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        }
    }
    
    // Load more components (no longer needed but kept for compatibility)
    async loadMoreComponents(page) {
        // All components are now loaded at once, so this method returns null
        console.log('loadMoreComponents called but not needed - all data loaded initially');
        return null;
    }
    
    // Get the total counts from full data for accurate filter counts
    getTotalCounts() {
        if (this.fullComponentsData) {
            return {
                agents: this.fullComponentsData.agents ? this.fullComponentsData.agents.length : 0,
                commands: this.fullComponentsData.commands ? this.fullComponentsData.commands.length : 0,
                mcps: this.fullComponentsData.mcps ? this.fullComponentsData.mcps.length : 0,
                settings: this.fullComponentsData.settings ? this.fullComponentsData.settings.length : 0,
                hooks: this.fullComponentsData.hooks ? this.fullComponentsData.hooks.length : 0,
                templates: this.fullComponentsData.templates ? this.fullComponentsData.templates.length : 0
            };
        }
        
        // Fallback to current loaded data
        return {
            agents: this.componentsData?.agents?.length || 0,
            commands: this.componentsData?.commands?.length || 0,
            mcps: this.componentsData?.mcps?.length || 0,
            settings: this.componentsData?.settings?.length || 0,
            hooks: this.componentsData?.hooks?.length || 0,
            templates: this.componentsData?.templates?.length || 0
        };
    }

    // Load external metadata
    async loadMetadata() {
        try {
            const cacheKey = 'metadata';
            if (this.cache.has(cacheKey)) {
                this.metadataData = this.cache.get(cacheKey);
                return this.metadataData;
            }

            const response = await fetch('components-metadata.json', {
                headers: {
                    'Cache-Control': 'max-age=300' // 5 minutes cache
                }
            });
            
            if (!response.ok) {
                console.warn('Could not load metadata file, using empty metadata');
                this.metadataData = { metadata: {}, companies: {}, technologies: {} };
                return this.metadataData;
            }
            
            this.metadataData = await response.json();
            this.cache.set(cacheKey, this.metadataData);
            
            return this.metadataData;
        } catch (error) {
            console.warn('Error loading metadata:', error);
            this.metadataData = { metadata: {}, companies: {}, technologies: {} };
            return this.metadataData;
        }
    }

    // Get metadata for component (external metadata takes priority over frontmatter)
    getComponentMetadata(componentName) {
        if (!this.metadataData) {
            return { tags: [], companies: [], technologies: [] };
        }
        
        const metadata = this.metadataData.metadata[componentName];
        if (metadata) {
            return {
                tags: metadata.tags || [],
                companies: metadata.companies || [],
                technologies: metadata.technologies || []
            };
        }
        
        // Fallback to empty metadata
        return { tags: [], companies: [], technologies: [] };
    }

    // Extract tags from component frontmatter (kept as fallback)
    extractTagsFromFrontmatter(content) {
        if (!content) return { tags: [], companies: [], technologies: [] };
        
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) return { tags: [], companies: [], technologies: [] };
        
        const frontmatter = frontmatterMatch[1];
        
        // Extract tags array
        const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/s);
        const tags = tagsMatch 
            ? tagsMatch[1].split(',').map(tag => tag.trim().replace(/['"]/g, ''))
            : [];
        
        // Extract companies array
        const companiesMatch = frontmatter.match(/companies:\s*\[(.*?)\]/s);
        const companies = companiesMatch 
            ? companiesMatch[1].split(',').map(company => company.trim().replace(/['"]/g, ''))
            : [];
            
        // Extract technologies array
        const technologiesMatch = frontmatter.match(/technologies:\s*\[(.*?)\]/s);
        const technologies = technologiesMatch 
            ? technologiesMatch[1].split(',').map(tech => tech.trim().replace(/['"]/g, ''))
            : [];
        
        return { tags, companies, technologies };
    }

    // Get all unique tags from components
    getAllTags() {
        const allTags = new Set();
        this.getAllComponents().forEach(component => {
            const { tags } = this.getComponentMetadata(component.name);
            tags.forEach(tag => allTags.add(tag));
        });
        return Array.from(allTags).sort();
    }

    // Get all unique companies from components
    getAllCompanies() {
        const allCompanies = new Set();
        this.getAllComponents().forEach(component => {
            const { companies } = this.getComponentMetadata(component.name);
            companies.forEach(company => allCompanies.add(company));
        });
        return Array.from(allCompanies).sort();
    }

    // Get all unique technologies from components
    getAllTechnologies() {
        const allTechnologies = new Set();
        this.getAllComponents().forEach(component => {
            const { technologies } = this.getComponentMetadata(component.name);
            technologies.forEach(tech => allTechnologies.add(tech));
        });
        return Array.from(allTechnologies).sort();
    }

    // Get company info from metadata
    getCompanyInfo(companySlug) {
        if (!this.metadataData || !this.metadataData.companies) {
            return null;
        }
        return this.metadataData.companies[companySlug] || null;
    }

    // Get technology info from metadata
    getTechnologyInfo(techSlug) {
        if (!this.metadataData || !this.metadataData.technologies) {
            return null;
        }
        return this.metadataData.technologies[techSlug] || null;
    }

    // Filter components by tags, companies, or technologies
    filterComponentsByTags(filterOptions = {}) {
        const { tags = [], companies = [], technologies = [], type = null } = filterOptions;
        
        let filteredComponents = this.getAllComponents();
        
        // Filter by type if specified
        if (type) {
            filteredComponents = filteredComponents.filter(component => component.type === type);
        }
        
        // Filter by tags, companies, or technologies
        if (tags.length > 0 || companies.length > 0 || technologies.length > 0) {
            filteredComponents = filteredComponents.filter(component => {
                const componentMeta = this.getComponentMetadata(component.name);
                
                const hasMatchingTag = tags.length === 0 || tags.some(tag => 
                    componentMeta.tags.includes(tag)
                );
                
                const hasMatchingCompany = companies.length === 0 || companies.some(company => 
                    componentMeta.companies.includes(company)
                );
                
                const hasMatchingTechnology = technologies.length === 0 || technologies.some(tech => 
                    componentMeta.technologies.includes(tech)
                );
                
                return hasMatchingTag || hasMatchingCompany || hasMatchingTechnology;
            });
        }
        
        return filteredComponents;
    }

    // Get components for a specific company stack
    getCompanyStack(companySlug) {
        const companyComponents = this.filterComponentsByTags({ companies: [companySlug] });
        
        // Group by type
        const groupedComponents = {
            agents: companyComponents.filter(c => c.type === 'agent'),
            commands: companyComponents.filter(c => c.type === 'command'),
            mcps: companyComponents.filter(c => c.type === 'mcp'),
            settings: companyComponents.filter(c => c.type === 'setting'),
            hooks: companyComponents.filter(c => c.type === 'hook'),
            templates: companyComponents.filter(c => c.type === 'template')
        };
        
        return groupedComponents;
    }

    // Get components for a specific technology stack
    getTechnologyStack(techSlug) {
        const techComponents = this.filterComponentsByTags({ technologies: [techSlug] });
        
        // Group by type
        const groupedComponents = {
            agents: techComponents.filter(c => c.type === 'agent'),
            commands: techComponents.filter(c => c.type === 'command'),
            mcps: techComponents.filter(c => c.type === 'mcp'),
            settings: techComponents.filter(c => c.type === 'setting'),
            hooks: techComponents.filter(c => c.type === 'hook'),
            templates: techComponents.filter(c => c.type === 'template')
        };
        
        return groupedComponents;
    }

    // Get all settings components
    getSettings() {
        if (!this.componentsData) return [];
        return this.componentsData.settings || [];
    }

    // Get all hooks components
    getHooks() {
        if (!this.componentsData) return [];
        return this.componentsData.hooks || [];
    }

    // Get settings by category
    getSettingsByCategory(category) {
        const settings = this.getSettings();
        return settings.filter(setting => setting.category === category);
    }

    // Get hooks by category
    getHooksByCategory(category) {
        const hooks = this.getHooks();
        return hooks.filter(hook => hook.category === category);
    }

    // Get all setting categories
    getSettingCategories() {
        const settings = this.getSettings();
        const categories = new Set();
        settings.forEach(setting => {
            if (setting.category) {
                categories.add(setting.category);
            }
        });
        return Array.from(categories).sort();
    }

    // Get all hook categories
    getHookCategories() {
        const hooks = this.getHooks();
        const categories = new Set();
        hooks.forEach(hook => {
            if (hook.category) {
                categories.add(hook.category);
            }
        });
        return Array.from(categories).sort();
    }
}

// Global instance
window.dataLoader = new DataLoader();