// modal-helpers.js

// Show component modal
function showComponentModal(component) {
    const modalHTML = createComponentModalHTML(component);
    
    // Remove existing modal if present
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Render code preview
    renderCodePreview(component);

    // Add event listener for ESC key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeComponentModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Create component modal HTML
function createComponentModalHTML(component) {
    const typeConfig = {
        agent: { icon: '🤖', color: '#ff6b6b', badge: 'AGENT' },
        command: { icon: '⚡', color: '#4ecdc4', badge: 'COMMAND' },
        mcp: { icon: '🔌', color: '#45b7d1', badge: 'MCP' },
        template: { icon: '📦', color: '#f9a825', badge: 'TEMPLATE' }
    };
    
    const config = typeConfig[component.type] || typeConfig['template'];
    
    // Generate install command - remove .md extension from path
    let componentPath = component.path || component.name;
    if (componentPath.endsWith('.md')) {
        componentPath = componentPath.replace(/\.md$/, '');
    }
    if (componentPath.endsWith('.json')) {
        componentPath = componentPath.replace(/\.json$/, '');
    }
    const installCommand = `npx claude-code-templates@latest --${component.type}=${componentPath} --yes`;
    
    // Generate global agent command for agents only
    const globalAgentCommand = component.type === 'agent' ? `npx claude-code-templates@latest --create-agent ${componentPath}` : null;
    
    const description = getComponentDescription(component); // Full description

    // Construct GitHub URL
    let githubUrl = 'https://github.com/davila7/claude-code-templates/';
    if (component.type === 'template') {
        githubUrl += `tree/main/cli-tool/templates/${component.folderPath}`;
    } else {
        githubUrl += `blob/main/cli-tool/components/${component.type}s/${component.path}`;
    }

    return `
        <div class="modal-overlay" onclick="closeComponentModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="component-modal-title">
                        <span class="component-icon">${config.icon}</span>
                        <h3 style="color: var(--text-primary);">${formatComponentName(component.name)}</h3>
                        <div class="component-type-badge" style="background-color: ${config.color};">${config.badge}</div>
                    </div>
                    <button class="modal-close" onclick="closeComponentModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="component-details">
                        <div class="component-description">${component.type === 'mcp' ? (component.description || description) : description}</div>
                        
                        <div class="installation-section">
                            <h4>📦 Installation</h4>
                            <div class="command-line">
                                <code>${installCommand}</code>
                                <button class="copy-btn" data-command="${installCommand.replace(/"/g, '&quot;')}" onclick="copyToClipboard(this.dataset.command)">Copy</button>
                            </div>
                            ${globalAgentCommand ? `
                            <div class="global-agent-section">
                                <h4>🌍 Global Agent (Claude Code SDK)</h4>
                                <p class="global-agent-description">Create a global AI agent accessible from anywhere with zero configuration</p>
                                <div class="command-line">
                                    <code>${globalAgentCommand}</code>
                                    <button class="copy-btn" data-command="${globalAgentCommand.replace(/"/g, '&quot;')}" onclick="copyToClipboard(this.dataset.command)">Copy</button>
                                </div>
                                <div class="global-agent-usage">
                                    <div class="usage-example">
                                        <div class="usage-title">After installation, use from anywhere:</div>
                                        <div class="command-line usage-command">
                                            <code>${componentPath.split('/').pop()} "your prompt here"</code>
                                            <button class="copy-btn" data-command="${componentPath.split('/').pop()} &quot;your prompt here&quot;" onclick="copyToClipboard(this.dataset.command)">Copy</button>
                                        </div>
                                    </div>
                                    <div class="global-features">
                                        <div class="feature">✅ Works in scripts, CI/CD, npm tasks</div>
                                        <div class="feature">✅ Auto-detects project context</div>
                                        <div class="feature">✅ Powered by Claude Code SDK</div>
                                    </div>
                                </div>
                            </div>` : ''}
                        </div>

                        <div class="component-content">
                            <h4>📋 Component Details</h4>
                            <div class="code-editor" id="code-editor">
                                <div class="code-line-numbers" id="line-numbers"></div>
                                <div class="code-content">
                                    <pre id="code-viewer"><code>Loading content...</code></pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="add-to-cart-btn" 
                            data-type="${component.type}s" 
                            data-path="${componentPath}"
                            onclick="handleAddToCart('${component.name.replace(/'/g, "\\'")}', '${componentPath.replace(/'/g, "\\'")}', '${component.type}s', '${component.category ? component.category.replace(/'/g, "\\'") : 'Other'}', this); closeComponentModal();">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,7H18V6A2,2 0 0,0 16,4H8A2,2 0 0,0 6,6V7H5A1,1 0 0,0 4,8A1,1 0 0,0 5,9H6V19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V9H19A1,1 0 0,0 20,8A1,1 0 0,0 19,7M8,6H16V7H8V6M16,19H8V9H16V19Z"/>
                        </svg>
                        Add to Stack
                    </button>
                    <a href="${githubUrl}" target="_blank" class="github-folder-link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        View on GitHub
                    </a>
                </div>
            </div>
        </div>
    `;
}

// Render code preview in the modal
function renderCodePreview(component) {
    const viewer = document.getElementById('code-viewer');
    const lineNumbers = document.getElementById('line-numbers');
    if (!viewer) return;

    let content = component.content || "No content available.";
    let language = 'plaintext';

    if (component.path) {
        const extension = component.path.split('.').pop();
        switch (extension) {
            case 'md':
                language = 'markdown';
                break;
            case 'json':
                language = 'json';
                // Pretty print JSON
                try {
                    content = JSON.stringify(JSON.parse(content), null, 2);
                } catch (e) { /* Ignore parsing errors */ }
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

    // Show only a preview (first 15 lines) instead of full content
    const lines = content.split('\n');
    const previewLines = lines.slice(0, 15);
    const previewContent = previewLines.join('\n');
    
    // Add truncation indicator if content is longer
    const truncatedContent = lines.length > 15 ? previewContent + '\n...' : previewContent;

    const codeElement = viewer.querySelector('code');
    codeElement.innerHTML = highlightCode(truncatedContent, language);
    codeElement.className = `language-${language}`;

    // Generate line numbers for preview
    if (lineNumbers) {
        const previewLineNumbers = previewLines.map((_, index) => `<span>${index + 1}</span>`).join('');
        lineNumbers.innerHTML = previewLineNumbers;
    }
}

// Basic syntax highlighting
function highlightCode(content, language) {
    // First escape HTML entities
    let highlighted = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    if (language === 'markdown' || language === 'yaml') {
        // Highlight YAML/Markdown frontmatter keys (blue)
        highlighted = highlighted.replace(/^([a-zA-Z_-]+):/gm, '<span style="color: #569cd6;">$1</span>:');
        
        // Highlight strings in quotes (orange)
        highlighted = highlighted.replace(/&quot;([^&]+?)&quot;/g, '<span style="color: #ce9178;">&quot;$1&quot;</span>');
        
        // Highlight important keywords (light blue - like in the image)
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

// Close component modal
function closeComponentModal() {
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.remove();
    }
}

// Utility to get component description
function getComponentDescription(component, maxLength = 0) {
    let description = component.description || '';
    if (!description && component.content) {
        const descMatch = component.content.match(/description:\s*(.+?)(?:\n|$)/);
        if (descMatch) {
            description = descMatch[1].trim().replace(/^["']|["']$/g, '');
        } else {
            const lines = component.content.split('\n');
            const firstParagraph = lines.find(line => line.trim() && !line.startsWith('---') && !line.startsWith('#'));
            if (firstParagraph) {
                description = firstParagraph.trim();
            }
        }
    }
    if (!description) {
        description = `A ${component.type} component.`;
    }
    if (maxLength && description.length > maxLength) {
        description = description.substring(0, maxLength - 3) + '...';
    }
    return description;
}

// Utility to format component name
function formatComponentName(name) {
    return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Global function for component details (called from onclick)
function showComponentDetails(type, name, path, category) {
    let component;
    
    if (type === 'template') {
        if (window.indexManager && window.indexManager.templatesData) {
            Object.values(window.indexManager.templatesData).forEach(templates => {
                const found = templates.find(t => t.id === name);
                if (found) component = found;
            });
        }
    } else {
        if (window.indexManager && window.indexManager.componentsData) {
            const components = window.indexManager.componentsData[type + 's'] || [];
            component = components.find(c => c.name === name || c.path === path);
        }
    }
    
    if (component) {
        showComponentModal(component);
    } else {
        console.warn('Component not found:', type, name, 'path:', path, 'category:', category);
    }
}
