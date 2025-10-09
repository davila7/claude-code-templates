/**
 * Plugin Detail Page Manager
 * Handles loading and displaying plugin details
 */

class PluginPageManager {
    constructor() {
        this.pluginData = null;
        this.allPlugins = [];
        this.pluginName = this.getPluginNameFromURL();
    }

    /**
     * Get plugin name from URL path
     */
    getPluginNameFromURL() {
        const path = window.location.pathname;
        const segments = path.split('/').filter(segment => segment);

        // URL format: /plugin/plugin-name
        if (segments[0] === 'plugin' && segments[1]) {
            return segments[1];
        }

        return null;
    }

    /**
     * Initialize the page
     */
    async init() {
        if (!this.pluginName) {
            this.showError();
            return;
        }

        try {
            // Load components data
            await this.loadComponentsData();

            // Find the plugin
            this.pluginData = this.findPlugin(this.pluginName);

            if (!this.pluginData) {
                this.showError();
                return;
            }

            // Render the plugin details
            this.renderPluginDetails();
            this.renderRelatedPlugins();

            // Update page title
            document.title = `${this.formatPluginName(this.pluginData.name)} - Claude Code Templates`;

            // Setup keyboard listeners
            this.setupKeyboardListeners();

        } catch (error) {
            console.error('Error loading plugin:', error);
            this.showError();
        }
    }

    /**
     * Setup keyboard event listeners
     */
    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            // ESC key closes modal
            if (e.key === 'Escape') {
                const modal = document.getElementById('installModal');
                if (modal.style.display === 'flex') {
                    this.closeInstallModal();
                }
            }
        });
    }

    /**
     * Load components.json
     */
    async loadComponentsData() {
        try {
            const response = await fetch('/components.json');
            if (!response.ok) {
                throw new Error('Failed to load components data');
            }
            const data = await response.json();
            this.allPlugins = data.plugins || [];
        } catch (error) {
            console.error('Error loading components:', error);
            throw error;
        }
    }

    /**
     * Find plugin by name
     */
    findPlugin(name) {
        return this.allPlugins.find(plugin => plugin.name === name);
    }

    /**
     * Format name (convert kebab-case to Title Case)
     */
    formatPluginName(name) {
        return this.formatComponentName(name);
    }

    /**
     * Format component name (convert kebab-case to Title Case)
     * Handles both "name" and "category/name" formats
     */
    formatComponentName(name) {
        // Extract just the filename if it includes a category path
        const displayName = name.includes('/') ? name.split('/').pop() : name;

        return displayName
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Render plugin details
     */
    renderPluginDetails() {
        const plugin = this.pluginData;

        // Update hero section
        document.getElementById('pluginName').textContent = this.formatPluginName(plugin.name);
        document.getElementById('pluginDescription').textContent = plugin.description;
        document.getElementById('pluginVersion').textContent = `v${plugin.version}`;
        document.getElementById('pluginAuthor').textContent = plugin.author || 'Claude Code Templates';

        // Render keywords
        const keywordsContainer = document.getElementById('pluginKeywords');
        keywordsContainer.innerHTML = plugin.keywords
            .map(keyword => `<span class="keyword-badge">${keyword}</span>`)
            .join('');

        // Update installation commands
        document.getElementById('installPluginCmd').textContent = `/plugin install ${plugin.name}`;

        // Render components sections
        this.renderComponents(plugin);

        // Show content, hide loading
        document.getElementById('loading').style.display = 'none';
        document.getElementById('pluginContent').style.display = 'block';
    }

    /**
     * Render components (commands, agents, MCPs)
     */
    renderComponents(plugin) {
        // Commands
        if (plugin.commands && plugin.commands > 0) {
            document.getElementById('commandsSection').style.display = 'block';
            document.getElementById('commandsCount').textContent = plugin.commands;

            const commandsList = document.getElementById('commandsList');
            commandsList.innerHTML = this.generateComponentItems(
                plugin.commandsList || [],
                'command',
                'commands'
            );
        }

        // Agents
        if (plugin.agents && plugin.agents > 0) {
            document.getElementById('agentsSection').style.display = 'block';
            document.getElementById('agentsCount').textContent = plugin.agents;

            const agentsList = document.getElementById('agentsList');
            agentsList.innerHTML = this.generateComponentItems(
                plugin.agentsList || [],
                'agent',
                'agents'
            );
        }

        // MCPs
        if (plugin.mcpServers && plugin.mcpServers > 0) {
            document.getElementById('mcpsSection').style.display = 'block';
            document.getElementById('mcpsCount').textContent = plugin.mcpServers;

            const mcpsList = document.getElementById('mcpsList');
            mcpsList.innerHTML = this.generateComponentItems(
                plugin.mcpServersList || [],
                'mcp',
                'mcps'
            );
        }
    }

    /**
     * Generate component items with install commands
     */
    generateComponentItems(componentNames, componentType, pluralType) {
        if (!componentNames || componentNames.length === 0) {
            return '<li>No components available</li>';
        }

        return componentNames.map((name, index) => {
            const formattedName = this.formatComponentName(name);
            const installCommand = `npx claude-code-templates@latest --${componentType} ${name}`;

            return `
                <li class="component-item" data-index="${index}">
                    <span class="component-name">${formattedName}</span>
                    <button class="component-install-btn" onclick="window.pluginPageManager.showInstallCommand('${installCommand.replace(/'/g, "\\'")}', event)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                        Install
                    </button>
                </li>
            `;
        }).join('');
    }

    /**
     * Show install command in a modal
     */
    showInstallCommand(command, event) {
        event.stopPropagation();

        // Store current command
        this.currentCommand = command;

        // Update modal content
        document.getElementById('modalCommand').textContent = command;

        // Show modal
        const modal = document.getElementById('installModal');
        modal.style.display = 'flex';

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close install modal
     */
    closeInstallModal() {
        const modal = document.getElementById('installModal');
        modal.style.display = 'none';

        // Restore body scroll
        document.body.style.overflow = 'auto';
    }

    /**
     * Copy command from modal
     */
    copyModalCommand() {
        const command = this.currentCommand;

        navigator.clipboard.writeText(command).then(() => {
            const button = document.querySelector('.modal-copy-btn');
            const originalHTML = button.innerHTML;

            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                </svg>
                Copied!
            `;

            setTimeout(() => {
                button.innerHTML = originalHTML;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    }

    /**
     * Render related plugins (based on shared keywords)
     */
    renderRelatedPlugins() {
        const currentPlugin = this.pluginData;
        const relatedPlugins = this.findRelatedPlugins(currentPlugin);

        const container = document.getElementById('relatedPlugins');

        if (relatedPlugins.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No related plugins found.</p>';
            return;
        }

        container.innerHTML = relatedPlugins
            .map(plugin => this.createRelatedPluginCard(plugin))
            .join('');
    }

    /**
     * Find related plugins based on shared keywords
     */
    findRelatedPlugins(currentPlugin) {
        const currentKeywords = new Set(currentPlugin.keywords);

        return this.allPlugins
            .filter(plugin => plugin.name !== currentPlugin.name)
            .map(plugin => {
                // Count shared keywords
                const sharedKeywords = plugin.keywords.filter(k => currentKeywords.has(k)).length;
                return { plugin, sharedKeywords };
            })
            .filter(item => item.sharedKeywords > 0)
            .sort((a, b) => b.sharedKeywords - a.sharedKeywords)
            .slice(0, 3) // Show top 3 related plugins
            .map(item => item.plugin);
    }

    /**
     * Create related plugin card HTML
     */
    createRelatedPluginCard(plugin) {
        return `
            <a href="/plugin/${plugin.name}" class="related-plugin-card">
                <h3>${this.formatPluginName(plugin.name)}</h3>
                <p>${plugin.description}</p>
                <div class="related-plugin-stats">
                    ${plugin.commands > 0 ? `<span class="related-plugin-stat"><span class="stat-icon">⚡</span>${plugin.commands}</span>` : ''}
                    ${plugin.agents > 0 ? `<span class="related-plugin-stat"><span class="stat-icon">🤖</span>${plugin.agents}</span>` : ''}
                    ${plugin.mcpServers > 0 ? `<span class="related-plugin-stat"><span class="stat-icon">🔌</span>${plugin.mcpServers}</span>` : ''}
                </div>
            </a>
        `;
    }

    /**
     * Show error state
     */
    showError() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'flex';
    }
}

/**
 * Copy command to clipboard
 */
function copyCommand(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent;

    navigator.clipboard.writeText(text).then(() => {
        // Show feedback
        const button = event.target.closest('.copy-btn');
        const originalHTML = button.innerHTML;

        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
            </svg>
            Copied!
        `;

        setTimeout(() => {
            button.innerHTML = originalHTML;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pluginPageManager = new PluginPageManager();
    window.pluginPageManager.init();
});
