// Component Page JavaScript
class ComponentPageManager {
    constructor() {
        this.component = null;
        this.dataLoader = null;
        this.init();
    }

    async init() {
        console.log('Initializing Component Page Manager...');
        
        // Initialize data loader
        this.dataLoader = window.dataLoader || new DataLoader();
        
        // Load component from URL parameters
        await this.loadComponentFromURL();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    async loadComponentFromURL() {
        let componentType, componentName, componentPath;
        
        // Check if we're using SEO-friendly URLs: /component/type/name
        const pathParts = window.location.pathname.split('/').filter(part => part);
        if (pathParts.length >= 3 && pathParts[0] === 'component') {
            componentType = decodeURIComponent(pathParts[1]);
            componentName = decodeURIComponent(pathParts[2]);
            console.log('SEO URL Parameters:', { componentType, componentName });
        } else {
            // Fallback to query parameters
            const urlParams = new URLSearchParams(window.location.search);
            componentType = urlParams.get('type');
            componentName = urlParams.get('name');
            componentPath = urlParams.get('path');
            console.log('Query Parameters:', { componentType, componentName, componentPath });
        }

        if (!componentType || (!componentName && !componentPath)) {
            this.showError('Missing component parameters in URL');
            return;
        }

        try {
            // Load all components data
            const componentsData = await this.dataLoader.loadAllComponents();
            
            if (!componentsData) {
                throw new Error('Failed to load components data');
            }

            // Find the component
            const categoryKey = componentType + 's'; // Convert 'agent' to 'agents'
            const components = componentsData[categoryKey] || [];
            
            let component = null;
            
            // Try to find by name first, then by path
            if (componentName) {
                component = components.find(c => c.name === componentName);
                
                // If not found, try to find by path that ends with the component name
                if (!component) {
                    component = components.find(c => {
                        // Check if path ends with componentName.md or componentName.json
                        const pathEnd = `${componentName}.md`;
                        const pathEndJson = `${componentName}.json`;
                        return c.path && (c.path.endsWith(pathEnd) || c.path.endsWith(pathEndJson));
                    });
                }
            }
            
            if (!component && componentPath) {
                component = components.find(c => c.path === componentPath);
            }

            if (!component) {
                throw new Error(`Component not found: ${componentType}/${componentName || componentPath}`);
            }

            this.component = {
                ...component,
                type: componentType
            };

            await this.renderComponent();

        } catch (error) {
            console.error('Error loading component:', error);
            this.showError(error.message);
        }
    }

    async renderComponent() {
        if (!this.component) {
            this.showError('No component data available');
            return;
        }

        console.log('Rendering component:', this.component);

        // Hide loading state
        document.getElementById('loadingState').style.display = 'none';
        
        // Show component content
        document.getElementById('componentContent').style.display = 'block';

        // Render component header
        this.renderComponentHeader();
        
        // Render component description
        this.renderComponentDescription();
        
        // Render installation section
        this.renderInstallationSection();
        
        // Render component code
        await this.renderComponentCode();
        
        // Render GitHub link
        this.renderGitHubLink();
        
        // Update page metadata
        this.updatePageMetadata();
    }


    renderComponentHeader() {
        const typeConfig = {
            agent: { icon: '🤖', color: '#ff6b6b', badge: 'AGENT' },
            command: { icon: '⚡', color: '#4ecdc4', badge: 'COMMAND' },
            mcp: { icon: '🔌', color: '#45b7d1', badge: 'MCP' },
            setting: { icon: '⚙️', color: '#9c88ff', badge: 'SETTING' },
            hook: { icon: '🪝', color: '#ff8c42', badge: 'HOOK' },
            template: { icon: '📦', color: '#f9a825', badge: 'TEMPLATE' }
        };

        const config = typeConfig[this.component.type] || typeConfig.template;
        const formattedName = this.formatComponentName(this.component.name);

        // Update icon with null check
        const iconElement = document.getElementById('componentIcon');
        if (iconElement) {
            iconElement.textContent = config.icon;
        }
        
        // Update title with null check
        const titleElement = document.getElementById('componentTitle');
        if (titleElement) {
            titleElement.textContent = formattedName;
        }
        
        // Update type badge with null check
        const typeBadge = document.getElementById('componentTypeBadge');
        if (typeBadge) {
            typeBadge.textContent = config.badge;
            typeBadge.style.backgroundColor = config.color;
        }
        
        // Update category - restored for original design
        const category = this.component.category || 'General';
        const categoryElement = document.getElementById('componentCategory');
        if (categoryElement) {
            categoryElement.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        }

        // Update download badge
        const downloadBadge = document.getElementById('componentDownloadBadge');
        const downloadCount = document.getElementById('downloadCount');
        if (downloadBadge && downloadCount) {
            const downloads = this.component.downloads || 0;
            if (downloads > 0) {
                downloadBadge.style.display = 'inline-flex';
                downloadCount.textContent = this.formatNumber(downloads);
                downloadBadge.title = `${downloads.toLocaleString()} downloads`;
            } else {
                downloadBadge.style.display = 'none';
            }
        }

        // Add to cart button is set up in setupEventListeners()
    }

    renderComponentDescription() {
        const description = this.getComponentDescription();
        const descriptionElement = document.getElementById('componentDescription');
        if (descriptionElement) {
            descriptionElement.textContent = description;
        }
    }

    renderInstallationSection() {
        const componentPath = this.getCleanPath();
        const basicInstallCommand = `npx claude-code-templates@latest --${this.component.type}=${componentPath} --yes`;
        
        // Update basic installation command
        const basicInstallElement = document.getElementById('basicInstallCommand');
        if (basicInstallElement) {
            basicInstallElement.textContent = basicInstallCommand;
        }

        // Handle agent-specific sections
        if (this.component.type === 'agent') {
            this.renderGlobalAgentSection(componentPath);
            this.renderE2BSandboxSection(componentPath);
        } else {
            // Hide agent-specific sections for non-agents
            const globalAgentSection = document.getElementById('globalAgentSection');
            const e2bSandboxSection = document.getElementById('e2bSandboxSection');
            
            if (globalAgentSection) globalAgentSection.style.display = 'none';
            if (e2bSandboxSection) e2bSandboxSection.style.display = 'none';
        }
    }

    renderGlobalAgentSection(componentPath) {
        const globalAgentSection = document.getElementById('globalAgentSection');
        const globalAgentCommand = `npx claude-code-templates@latest --create-agent ${componentPath}`;
        const globalUsageCommand = `${componentPath.split('/').pop()} "your prompt here"`;

        const globalAgentCommandElement = document.getElementById('globalAgentCommand');
        const globalUsageCommandElement = document.getElementById('globalUsageCommand');
        
        if (globalAgentCommandElement) {
            globalAgentCommandElement.textContent = globalAgentCommand;
        }
        if (globalUsageCommandElement) {
            globalUsageCommandElement.textContent = globalUsageCommand;
        }
        
        if (globalAgentSection) {
            globalAgentSection.style.display = 'block';
        }
    }

    renderE2BSandboxSection(componentPath) {
        const e2bSandboxSection = document.getElementById('e2bSandboxSection');
        const e2bSandboxCommand = `npx claude-code-templates@latest --sandbox e2b --agent=${componentPath} --prompt "your development task"`;

        const e2bSandboxCommandElement = document.getElementById('e2bSandboxCommand');
        if (e2bSandboxCommandElement) {
            e2bSandboxCommandElement.textContent = e2bSandboxCommand;
        }
        
        if (e2bSandboxSection) {
            e2bSandboxSection.style.display = 'block';
        }
    }

    async renderComponentCode() {
        try {
            let content = this.component.content || 'No content available.';
            let language = 'plaintext';

            // Determine language based on file extension
            if (this.component.path) {
                const extension = this.component.path.split('.').pop();
                switch (extension) {
                    case 'md':
                        language = 'markdown';
                        break;
                    case 'json':
                        language = 'json';
                        // Pretty print JSON
                        try {
                            content = JSON.stringify(JSON.parse(content), null, 2);
                        } catch (e) { 
                            console.warn('Could not parse JSON content:', e);
                        }
                        break;
                    case 'js':
                        language = 'javascript';
                        break;
                    case 'yml':
                    case 'yaml':
                        language = 'yaml';
                        break;
                }
            }

            // Update code language indicator
            const codeLanguageElement = document.getElementById('codeLanguage');
            if (codeLanguageElement) {
                codeLanguageElement.textContent = language;
            }

            // Render code with syntax highlighting
            const codeElement = document.querySelector('#codeContent code');
            if (codeElement) {
                codeElement.innerHTML = this.highlightCode(content, language);
                codeElement.className = `language-${language}`;
            }

            // Generate line numbers
            const lines = content.split('\n');
            const lineNumbers = lines.map((_, index) => `<span>${index + 1}</span>`).join('');
            const lineNumbersElement = document.getElementById('lineNumbers');
            if (lineNumbersElement) {
                lineNumbersElement.innerHTML = lineNumbers;
            }

        } catch (error) {
            console.error('Error rendering component code:', error);
            const codeElement = document.querySelector('#codeContent code');
            if (codeElement) {
                codeElement.textContent = 'Error loading component content.';
            }
        }
    }

    renderGitHubLink() {
        const githubUrl = this.generateGitHubURL();
        const githubLinkElement = document.getElementById('githubLink');
        if (githubLinkElement) {
            githubLinkElement.href = githubUrl;
        }
    }

    generateGitHubURL() {
        let githubUrl = 'https://github.com/davila7/claude-code-templates/';
        
        if (this.component.type === 'template') {
            githubUrl += `tree/main/cli-tool/templates/${this.component.folderPath || ''}`;
        } else {
            const componentPath = this.component.path || this.component.name;
            githubUrl += `blob/main/cli-tool/components/${this.component.type}s/${componentPath}`;
        }
        
        return githubUrl;
    }



    setupEventListeners() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.loadComponentFromURL();
        });
        
        // Handle Add to Stack button
        const addToCartBtn = document.getElementById('addToCartBtn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.component) {
                    // Debug logging for production
                    console.log('=== Add to Cart Debug ===');
                    console.log('Component object:', this.component);
                    console.log('Component type:', this.component.type);
                    console.log('Component name:', this.component.name);
                    console.log('Component path:', this.component.path);
                    
                    // Check if cartManager exists
                    if (typeof addToCart === 'function') {
                        // Convert component type to plural format
                        const componentType = this.getComponentTypePlural();
                        
                        console.log('Plural type for cart:', componentType);
                        
                        if (!componentType) {
                            console.error('Failed to get component type plural');
                            alert('Unable to determine component type. Please refresh the page.');
                            return;
                        }
                        
                        if (this.component.name && this.component.path) {
                            // Create component object that matches cart manager expectations
                            // Clean component name (remove .md extension and format properly)
                            const cleanName = this.getCleanComponentName();
                            const componentItem = {
                                name: cleanName,
                                path: this.component.path,
                                category: this.component.category
                            };
                            console.log('Sending to cart:', componentItem, componentType);
                            addToCart(componentItem, componentType);
                        } else {
                            console.error('Missing component name or path:', this.component);
                            alert('Unable to add component: missing component information');
                        }
                    } else {
                        console.error('Cart functionality not available');
                        console.log('typeof addToCart:', typeof addToCart);
                        console.log('window.addToCart:', window.addToCart);
                        // Fallback: show a message or redirect to main page
                        alert('Cart functionality not available. Please return to the main page to add components to your stack.');
                    }
                } else {
                    console.error('No component data available');
                    alert('Component data not loaded. Please refresh the page.');
                }
            });
        }
    }
    
    getComponentType() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('type');
    }
    
    getComponentTypePlural() {
        // Get type from the component object itself
        const type = this.component?.type;
        
        if (!type) {
            console.error('Component type not found in component object');
            return null;
        }
        
        // Convert singular type to plural for cart manager
        const typeMapping = {
            'agent': 'agents',
            'command': 'commands',
            'setting': 'settings',
            'hook': 'hooks',
            'mcp': 'mcps',
            'template': 'templates'
        };
        
        return typeMapping[type] || type + 's';
    }
    
    getComponentFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('name') || urlParams.get('path');
    }
    
    getCleanComponentName() {
        if (!this.component || !this.component.name) {
            return 'Unknown Component';
        }
        
        let cleanName = this.component.name;
        
        // Remove .md extension if present
        if (cleanName.endsWith('.md')) {
            cleanName = cleanName.slice(0, -3);
        }
        
        // Convert kebab-case or snake_case to Title Case
        cleanName = cleanName
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
            
        return cleanName;
    }

    updatePageMetadata() {
        const cleanName = this.getCleanComponentName(this.component.name);
        const description = this.getComponentDescription();
        const typeCapitalized = this.component.type.charAt(0).toUpperCase() + this.component.type.slice(1);
        const category = this.component.category || 'Development';
        
        // Enhanced page title with component type and category
        const pageTitle = `${cleanName} ${typeCapitalized} - Claude Code Templates`;
        const enhancedDescription = `${description} | ${typeCapitalized} for ${category} | Claude Code Templates - AI-powered development tools`;
        
        // Generate proper canonical URL for SEO
        const canonicalURL = this.generateCanonicalURL();

        // Update page title
        document.title = pageTitle;
        const pageTitleElement = document.getElementById('page-title');
        if (pageTitleElement) {
            pageTitleElement.textContent = pageTitle;
        }

        // Update meta description
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.content = enhancedDescription;
        }

        // Update keywords
        const metaKeywords = document.querySelector('meta[name="keywords"]');
        if (metaKeywords) {
            metaKeywords.content = `${cleanName}, ${this.component.type}, ${category}, Claude Code, AI development, automation, ${this.component.type}s, templates`;
        }

        // Update canonical URL
        const canonicalLink = document.getElementById('canonical-url');
        if (canonicalLink) {
            canonicalLink.href = canonicalURL;
        }

        // Update Open Graph meta tags
        const ogUrl = document.getElementById('og-url');
        const ogTitle = document.getElementById('og-title');
        const ogDescription = document.getElementById('og-description');
        
        if (ogUrl) ogUrl.content = canonicalURL;
        if (ogTitle) ogTitle.content = pageTitle;
        if (ogDescription) ogDescription.content = enhancedDescription;

        // Update Twitter meta tags
        const twitterUrl = document.getElementById('twitter-url');
        const twitterTitle = document.getElementById('twitter-title');
        const twitterDescription = document.getElementById('twitter-description');
        
        if (twitterUrl) twitterUrl.content = canonicalURL;
        if (twitterTitle) twitterTitle.content = pageTitle;
        if (twitterDescription) twitterDescription.content = enhancedDescription;

        // Add structured data for better SEO
        this.addStructuredData(cleanName, description, typeCapitalized, category, canonicalURL);
    }

    generateCanonicalURL() {
        // Generate SEO-friendly canonical URL
        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.includes('5500');
        
        if (!isLocal && this.component.type && this.component.name) {
            // Use SEO-friendly URL for production
            let cleanName = this.component.name;
            if (cleanName.endsWith('.md')) {
                cleanName = cleanName.slice(0, -3);
            }
            if (cleanName.endsWith('.json')) {
                cleanName = cleanName.slice(0, -5);
            }
            
            const baseUrl = window.location.origin;
            return `${baseUrl}/component/${encodeURIComponent(this.component.type)}/${encodeURIComponent(cleanName)}`;
        }
        
        // Fallback to current URL
        return window.location.href;
    }

    addStructuredData(name, description, type, category, url) {
        // Remove existing structured data
        const existingScript = document.getElementById('component-structured-data');
        if (existingScript) {
            existingScript.remove();
        }

        // Add new structured data
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": name,
            "applicationCategory": "DeveloperApplication",
            "applicationSubCategory": `${type} Component`,
            "description": description,
            "operatingSystem": ["Windows", "macOS", "Linux"],
            "url": url,
            "author": {
                "@type": "Organization",
                "name": "Claude Code Templates Community"
            },
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
            },
            "keywords": `${name}, ${type}, ${category}, Claude Code, AI development`,
            "programmingLanguage": type === "command" ? "Shell" : "Configuration",
            "relatedLink": "https://www.anthropic.com/claude-code"
        };

        const script = document.createElement('script');
        script.id = 'component-structured-data';
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(structuredData, null, 2);
        document.head.appendChild(script);
    }


    // Utility methods
    formatComponentName(name) {
        return name.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return num.toString();
    }

    getComponentDescription() {
        let description = this.component.description || '';
        
        if (!description && this.component.content) {
            const descMatch = this.component.content.match(/description:\s*(.+?)(?:\n|$)/);
            if (descMatch) {
                description = descMatch[1].trim().replace(/^["']|["']$/g, '');
            } else {
                const lines = this.component.content.split('\n');
                const firstParagraph = lines.find(line => 
                    line.trim() && !line.startsWith('---') && !line.startsWith('#')
                );
                if (firstParagraph) {
                    description = firstParagraph.trim();
                }
            }
        }
        
        if (!description) {
            description = `A ${this.component.type} component for enhanced development workflow.`;
        }
        
        return description;
    }

    getCleanPath() {
        let componentPath = this.component.path || this.component.name;
        
        // Remove file extensions
        if (componentPath.endsWith('.md') || componentPath.endsWith('.json')) {
            componentPath = componentPath.replace(/\.(md|json)$/, '');
        }
        
        return componentPath;
    }

    highlightCode(content, language) {
        // Basic syntax highlighting (same as modal)
        let highlighted = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        if (language === 'markdown' || language === 'yaml') {
            // Highlight YAML/Markdown frontmatter keys (blue)
            highlighted = highlighted.replace(/^([a-zA-Z_-]+):/gm, '<span style="color: #569cd6;">$1</span>:');
            
            // Highlight strings in quotes (orange)
            highlighted = highlighted.replace(/&quot;([^&]+?)&quot;/g, '<span style="color: #ce9178;">&quot;$1&quot;</span>');
            
            // Highlight important keywords (light blue)
            highlighted = highlighted.replace(/\b(hackathon|strategy|AI|solution|ideation|evaluation|projects|feedback|concepts|feasibility|guidance|agent|specialist|brainstorming|winning|judge|feedback|Context|User|Examples)\b/gi, '<span style="color: #4fc1ff;">$1</span>');
            
            // Highlight markdown headers (blue)
            highlighted = highlighted.replace(/^(#+)\s*(.+)$/gm, '<span style="color: #569cd6;">$1</span> <span style="color: #dcdcaa;">$2</span>');
            
            // Highlight code in backticks
            highlighted = highlighted.replace(/`([^`]+)`/g, '<span style="color: #ce9178;">$1</span>');
            
            // Highlight YAML separators
            highlighted = highlighted.replace(/^---$/gm, '<span style="color: #808080;">---</span>');
        }
        
        return highlighted;
    }

    showError(message) {
        console.error('Component page error:', message);
        
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('componentContent').style.display = 'none';
        document.getElementById('errorState').style.display = 'block';
        
        // Update error message if needed
        const errorElement = document.querySelector('#errorState p');
        if (errorElement && message !== 'Missing component parameters in URL') {
            errorElement.textContent = message;
        }
    }

    // Static method to create URL for component
    static createComponentURL(type, name, path) {
        // Detect if we're in local development
        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.includes('5500');
        
        if (!isLocal && type && name) {
            // Use SEO-friendly URL structure for production: /component/type/name
            let cleanName = name;
            if (cleanName.endsWith('.md')) {
                cleanName = cleanName.slice(0, -3);
            }
            if (cleanName.endsWith('.json')) {
                cleanName = cleanName.slice(0, -5);
            }
            
            return `component/${encodeURIComponent(type)}/${encodeURIComponent(cleanName)}`;
        }
        
        // Use query parameters for local development or fallback
        const params = new URLSearchParams();
        params.set('type', type);
        if (name) params.set('name', name);
        if (path) params.set('path', path);
        
        return `component.html?${params.toString()}`;
    }
}

// Global function for creating component URLs (used by other scripts)
function createComponentURL(type, name, path) {
    return ComponentPageManager.createComponentURL(type, name, path);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.componentPageManager = new ComponentPageManager();
});

// Export for other scripts
window.ComponentPageManager = ComponentPageManager;

// Component Share functionality
function toggleComponentShareDropdown() {
    const shareDropdown = document.getElementById('componentShareDropdown');
    if (shareDropdown) {
        shareDropdown.classList.toggle('open');
    }
}

function shareComponentOnTwitter() {
    const componentManager = window.componentPageManager;
    let message;
    
    if (componentManager && componentManager.component) {
        const cleanName = componentManager.getCleanComponentName(componentManager.component.name);
        const type = componentManager.component.type.charAt(0).toUpperCase() + componentManager.component.type.slice(1);
        const category = componentManager.component.category || 'Development';
        const canonicalURL = componentManager.generateCanonicalURL();
        
        message = `🚀 Found this amazing ${cleanName} ${type} for Claude Code!

Perfect for ${category.toLowerCase()} workflows with AI-powered automation.

${canonicalURL}

#ClaudeCode #AI #Development #${category.replace(/\s+/g, '')} #Automation`;
    } else {
        // Fallback message
        const componentTitle = document.getElementById('componentTitle')?.textContent || 'Claude Code Component';
        const currentURL = window.location.href;
        message = `🚀 Check out this ${componentTitle} for Claude Code!

Perfect for AI-powered development workflows.

${currentURL}

#ClaudeCode #AI #Development`;
    }
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
    window.open(twitterUrl, '_blank');
    
    // Close dropdown after sharing
    const shareDropdown = document.getElementById('componentShareDropdown');
    if (shareDropdown) {
        shareDropdown.classList.remove('open');
    }
}

function shareComponentOnThreads() {
    const componentManager = window.componentPageManager;
    let message;
    
    if (componentManager && componentManager.component) {
        const cleanName = componentManager.getCleanComponentName(componentManager.component.name);
        const type = componentManager.component.type.charAt(0).toUpperCase() + componentManager.component.type.slice(1);
        const category = componentManager.component.category || 'Development';
        const canonicalURL = componentManager.generateCanonicalURL();
        
        message = `🚀 Found this amazing ${cleanName} ${type} for Claude Code!

Perfect for ${category.toLowerCase()} workflows with AI-powered automation.

${canonicalURL}

#ClaudeCode #AI #Development #${category.replace(/\s+/g, '')} #Automation`;
    } else {
        // Fallback message
        const componentTitle = document.getElementById('componentTitle')?.textContent || 'Claude Code Component';
        const currentURL = window.location.href;
        message = `🚀 Check out this ${componentTitle} for Claude Code!

Perfect for AI-powered development workflows.

${currentURL}

#ClaudeCode #AI #Development`;
    }
    
    const threadsUrl = `https://threads.net/intent/post?text=${encodeURIComponent(message)}`;
    window.open(threadsUrl, '_blank');
    
    // Close dropdown after sharing
    const shareDropdown = document.getElementById('componentShareDropdown');
    if (shareDropdown) {
        shareDropdown.classList.remove('open');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const shareDropdown = document.getElementById('componentShareDropdown');
    if (shareDropdown && !shareDropdown.contains(e.target)) {
        shareDropdown.classList.remove('open');
    }
});