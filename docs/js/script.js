// GitHub repository configuration
const GITHUB_CONFIG = {
    owner: 'davila7',
    repo: 'claude-code-templates',
    branch: 'main',
    templatesPath: 'cli-tool/src/templates.js'
};

// Framework logos using Devicon CDN (https://devicon.dev/)
const FRAMEWORK_ICONS = {
    // Languages
    'common': 'devicon-gear-plain', // Generic gear icon
    'javascript-typescript': 'devicon-javascript-plain',
    'python': 'devicon-python-plain',
    'ruby': 'devicon-ruby-plain',
    'rust': 'devicon-rust-plain',
    'go': 'devicon-go-plain',
    
    // JavaScript/TypeScript frameworks
    'react': 'devicon-react-original',
    'vue': 'devicon-vuejs-plain',
    'angular': 'devicon-angularjs-plain',
    'node': 'devicon-nodejs-plain',
    
    // Python frameworks
    'django': 'devicon-django-plain',
    'flask': 'devicon-flask-original',
    'fastapi': 'devicon-fastapi-plain',
    
    // Ruby frameworks
    'rails': 'devicon-rails-plain',
    'sinatra': 'devicon-ruby-plain', // Use Ruby icon for Sinatra
    
    // Default fallback
    'default': 'devicon-devicon-plain'
};

let templatesData = null;

// Fetch templates configuration from GitHub
async function fetchTemplatesConfig() {
    const grid = document.getElementById('unifiedGrid') || document.getElementById('templatesGrid');
    grid.innerHTML = '<div class="loading">Loading templates from GitHub...</div>';
    
    try {
        // Add cache-busting parameter to ensure we get the latest version
        const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.templatesPath}?t=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const templateFileContent = await response.text();
        
        // Parse the JavaScript file to extract TEMPLATES_CONFIG
        templatesData = parseTemplatesConfig(templateFileContent);
        
        if (templatesData) {
            generateTemplateCards();
        } else {
            throw new Error('Failed to parse templates configuration');
        }
        
    } catch (error) {
        console.error('Error fetching templates:', error);
        grid.innerHTML = `
            <div class="error-message">
                <h3>Error loading templates</h3>
                <p>Could not fetch templates from GitHub. Please try again later.</p>
                <button onclick="displayTemplates()" class="retry-btn">Retry</button>
            </div>
        `;
    }
}

// Parse the templates.js file content to extract TEMPLATES_CONFIG
function parseTemplatesConfig(fileContent) {
    try {
        // Extract TEMPLATES_CONFIG object from the file
        const configMatch = fileContent.match(/const TEMPLATES_CONFIG = ({[\s\S]*?});/);
        if (!configMatch) {
            throw new Error('TEMPLATES_CONFIG not found in file');
        }
        
        // Clean up the extracted object string and make it valid JSON
        let configString = configMatch[1];
        
        // Replace single quotes with double quotes
        configString = configString.replace(/'/g, '"');
        
        // Handle object property names without quotes
        configString = configString.replace(/(\w+):/g, '"$1":');
        
        // Remove trailing commas
        configString = configString.replace(/,(\s*[}\]])/g, '$1');
        
        // Parse the JSON
        const config = JSON.parse(configString);
        
        return config;
    } catch (error) {
        console.error('Error parsing templates config:', error);
        return null;
    }
}

// Generate template cards from fetched data
function generateTemplateCards() {
    const grid = document.getElementById('unifiedGrid');
    grid.innerHTML = '';
    
    if (!templatesData) {
        grid.innerHTML = '<div class="error-message">No templates data available</div>';
        return;
    }
    
    // Add the "Add New Template" card first
    const addTemplateCard = createAddTemplateCard();
    grid.appendChild(addTemplateCard);
    
    Object.entries(templatesData).forEach(([languageKey, languageData]) => {
        // Skip the 'common' template as we're replacing it with the Add Template card
        if (languageKey === 'common') {
            return;
        }
        
        // Create base language card (no framework)
        const baseCard = createTemplateCard(languageKey, languageData, 'none', {
            name: languageData.name,
            icon: getFrameworkIcon(languageKey),
            command: `npx claude-code-templates@latest --template=${languageKey} --yes`
        });
        grid.appendChild(baseCard);
        
        // Create framework-specific cards
        if (languageData.frameworks) {
            Object.entries(languageData.frameworks).forEach(([frameworkKey, frameworkData]) => {
                const frameworkCard = createTemplateCard(languageKey, languageData, frameworkKey, {
                    name: frameworkData.name,
                    icon: getFrameworkIcon(frameworkKey),
                    command: `npx claude-code-templates@latest --template=${languageKey} --yes`
                });
                grid.appendChild(frameworkCard);
            });
        }
    });
}

function createAddTemplateCard() {
    const card = document.createElement('div');
    card.className = 'template-card add-template-card';
    
    card.innerHTML = `
        <div class="card-inner">
            <div class="card-front">
                <div class="framework-logo">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                    </svg>
                </div>
                <h3 class="template-title">Add New Template</h3>
                <p class="template-description">Contribute a new language or framework to the community</p>
            </div>
        </div>
    `;
    
    // Add click handler to open contribution modal directly (no flip)
    card.addEventListener('click', () => {
        showContributeModal();
    });
    
    return card;
}

function createTemplateCard(languageKey, languageData, frameworkKey, frameworkData) {
    const card = document.createElement('div');
    card.className = `template-card ${languageData.comingSoon ? 'coming-soon' : ''}`;
    
    const displayName = frameworkKey === 'none' ? 
        frameworkData.name : 
        `${languageData.name.split('/')[0]}/${frameworkData.name}`;
    
    // Get download count for this template
    const templateKey = frameworkKey === 'none' ? languageKey : `${languageKey}/${frameworkKey}`;
    const downloadCount = getDownloadCount(templateKey, 'template');
    const downloadBadge = createDownloadBadge(downloadCount);
    
    card.innerHTML = `
        <div class="card-inner">
            <div class="card-front">
                ${languageData.comingSoon ? '<div class="coming-soon-badge">Coming Soon</div>' : ''}
                ${downloadBadge}
                <div class="framework-logo">
                    <i class="${frameworkData.icon} colored"></i>
                </div>
                <h3 class="template-title">${displayName}</h3>
                <p class="template-description">${languageData.description || ''}</p>
            </div>
            <div class="card-back">
                <div class="command-display">
                    <h3>Installation Options</h3>
                    <div class="command-code">${frameworkData.command}</div>
                    <div class="action-buttons">
                        <button class="view-files-btn" onclick="showInstallationFiles('${languageKey}', '${frameworkKey}', '${displayName}')">
                            📁 View Files
                        </button>
                        <button class="copy-command-btn" onclick="copyToClipboard('${frameworkData.command}')">
                            📋 Copy Command
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add click handler for card flip (only if not coming soon)
    if (!languageData.comingSoon) {
        card.addEventListener('click', (e) => {
            // Don't flip if clicking on buttons
            if (!e.target.closest('button')) {
                card.classList.toggle('flipped');
            }
        });
    }
    
    return card;
}

// Get framework icon from mapping
function getFrameworkIcon(framework) {
    return FRAMEWORK_ICONS[framework] || FRAMEWORK_ICONS['default'];
}

// Get installation files for a specific template
function getInstallationFiles(languageKey, frameworkKey) {
    if (!templatesData || !templatesData[languageKey]) {
        return [];
    }
    
    const languageData = templatesData[languageKey];
    let files = [...(languageData.files || [])];
    
    // Add framework-specific files if applicable
    if (frameworkKey !== 'none' && languageData.frameworks && languageData.frameworks[frameworkKey]) {
        const frameworkData = languageData.frameworks[frameworkKey];
        if (frameworkData.additionalFiles) {
            files = files.concat(frameworkData.additionalFiles);
        }
    }
    
    return files;
}

// Show installation files popup
function showInstallationFiles(languageKey, frameworkKey, displayName) {
    const files = getInstallationFiles(languageKey, frameworkKey);
    
    if (files.length === 0) {
        showCopyFeedback('No files to display');
        return;
    }
    
    // Generate GitHub folder URL
    const githubFolderUrl = getGithubFolderUrl(languageKey, frameworkKey);
    
    // Create modal HTML
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>📁 Installation Files - ${displayName}</h3>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <p class="modal-description">The following files will be installed in your project:</p>
                    <div class="files-table">
                        <div class="table-header">
                            <div class="column-header">File</div>
                            <div class="column-header">Destination</div>
                            <div class="column-header">Type</div>
                        </div>
                        ${files.map(file => `
                            <div class="table-row">
                                <div class="file-source">
                                    <a href="${getGithubFileUrl(languageKey, frameworkKey, file.source)}" target="_blank" class="file-link">
                                        ${file.source}
                                    </a>
                                </div>
                                <div class="file-destination">${file.destination}</div>
                                <div class="file-type">${getFileType(file.destination)}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-footer">
                        <p class="file-count">Total: ${files.length} file${files.length > 1 ? 's' : ''}</p>
                        <div class="modal-actions">
                            <a href="${githubFolderUrl}" target="_blank" class="github-folder-link">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                                View all files on GitHub
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listener for ESC key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeComponentModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// ===== ANALYTICS AND STATISTICS FUNCTIONALITY =====

/**
 * Load and display download statistics from GitHub-generated analytics
 */
async function loadDownloadStatistics() {
    try {
        // Fetch analytics data generated by GitHub Actions
        const response = await fetch('analytics/download-stats.json?t=' + Date.now());
        
        if (!response.ok) {
            console.log('Analytics data not available yet');
            hideStatisticsSection();
            return;
        }
        
        const analyticsData = await response.json();
        displayDownloadStatistics(analyticsData);
        
    } catch (error) {
        console.log('Analytics data not available:', error.message);
        hideStatisticsSection();
    }
}

/**
 * Display download statistics in the UI
 */
function displayDownloadStatistics(data) {
    // Update total downloads
    const totalElement = document.getElementById('totalDownloads');
    if (totalElement) {
        totalElement.textContent = formatNumber(data.total_downloads || 0);
    }
    
    // Update individual component type counts
    const typeElements = {
        agentDownloads: data.downloads_by_type?.agent || 0,
        commandDownloads: data.downloads_by_type?.command || 0,
        mcpDownloads: data.downloads_by_type?.mcp || 0,
        templateDownloads: data.downloads_by_type?.template || 0
    };
    
    Object.entries(typeElements).forEach(([elementId, count]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = formatNumber(count);
        }
    });
    
    // Find and display most popular component
    const popularElement = document.getElementById('popularComponent');
    if (popularElement && data.downloads_by_component) {
        const topComponent = Object.entries(data.downloads_by_component)[0];
        if (topComponent) {
            const [componentName, downloadCount] = topComponent;
            popularElement.textContent = formatComponentNameForDisplay(componentName);
            popularElement.setAttribute('title', `${formatNumber(downloadCount)} downloads`);
        } else {
            popularElement.textContent = '-';
        }
    }
    
    // Update last updated timestamp
    const lastUpdatedElement = document.getElementById('statsLastUpdated');
    if (lastUpdatedElement && data.last_updated) {
        const lastUpdated = new Date(data.last_updated);
        lastUpdatedElement.textContent = formatRelativeTime(lastUpdated);
    }
    
    // Show the statistics section
    showStatisticsSection();
    
    console.log('📊 Download statistics loaded successfully');
}

/**
 * Hide statistics section when data is not available
 */
function hideStatisticsSection() {
    // Keep statistics section visible even when data is not available
    // const statsSection = document.getElementById('downloadStatsSection');
    // if (statsSection) {
    //     statsSection.style.display = 'none';
    // }
}

/**
 * Show statistics section when data is available
 * Note: Stats section has been moved to dedicated page at /download-stats.html
 */
function showStatisticsSection() {
    // Stats section removed from main page - no action needed
    console.log('Stats available at /download-stats.html');
}

/**
 * Format numbers with thousands separators
 */
function formatNumber(num) {
    if (num === 0) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
    return (num / 1000000).toFixed(1) + 'M';
}

/**
 * Format component name for display (remove prefixes, capitalize)
 */
function formatComponentNameForDisplay(componentName) {
    if (!componentName || componentName === 'unknown') return '-';
    
    // Handle template format (language/framework)
    if (componentName.includes('/')) {
        const parts = componentName.split('/');
        return parts.map(part => 
            part.replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
        ).join('/');
    }
    
    // Handle individual components
    return componentName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
        return diffMins <= 1 ? 'just now' : `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
        return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
        return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

/**
 * Refresh statistics data
 */
async function refreshStatistics() {
    const refreshButton = document.querySelector('.stats-refresh-btn');
    if (refreshButton) {
        refreshButton.textContent = 'Refreshing...';
        refreshButton.disabled = true;
    }
    
    await loadDownloadStatistics();
    
    if (refreshButton) {
        refreshButton.textContent = 'Refresh';
        refreshButton.disabled = false;
    }
}

// Auto-refresh statistics every 10 minutes
setInterval(loadDownloadStatistics, 10 * 60 * 1000);

// Close modal
function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

// Show contribute modal
function showContributeModal() {
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-content contribute-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>🚀 Contribute a New Template</h3>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="contribute-intro">
                        <p>Help expand Claude Code Templates by contributing new languages or frameworks! Follow these steps to submit your contribution:</p>
                    </div>
                    
                    <div class="contribute-steps">
                        <div class="contribute-step">
                            <div class="step-number-contrib">1</div>
                            <div class="step-content-contrib">
                                <h4>Fork the Repository</h4>
                                <p>Go to the <a href="https://github.com/davila7/claude-code-templates" target="_blank">main repository</a> and click "Fork" to create your own copy.</p>
                                <div class="step-command">
                                    <code>git clone https://github.com/YOUR_USERNAME/claude-code-templates.git</code>
                                    <button class="copy-btn" onclick="copyToClipboard('git clone https://github.com/YOUR_USERNAME/claude-code-templates.git')">Copy</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="contribute-step">
                            <div class="step-number-contrib">2</div>
                            <div class="step-content-contrib">
                                <h4>Choose Your Contribution Type</h4>
                                <div class="contribution-types">
                                    <div class="contrib-type">
                                        <strong>New Language:</strong> Add to <code>cli-tool/templates/</code>
                                        <br><small>Example: <code>cli-tool/templates/kotlin/</code></small>
                                    </div>
                                    <div class="contrib-type">
                                        <strong>New Framework:</strong> Add to <code>cli-tool/templates/{language}/examples/</code>
                                        <br><small>Example: <code>cli-tool/templates/python/examples/fastapi-app/</code></small>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="contribute-step">
                            <div class="step-number-contrib">3</div>
                            <div class="step-content-contrib">
                                <h4>Use Claude Code to Generate the Template</h4>
                                <p>Copy this prompt and use it with Claude Code to automatically generate the template structure:</p>
                                <div class="claude-prompt">
                                    <h5>📋 Claude Code Prompt:</h5>
                                    <div class="prompt-text">
                                        <pre>I want to contribute a new template to the claude-code-templates repository. 

Please help me create:
- A new [LANGUAGE/FRAMEWORK] template
- All necessary configuration files (CLAUDE.md, .claude/, .mcp.json)
- Update cli-tool/src/templates.js with the new configuration
- Include appropriate hooks and commands for this technology

The template should follow the existing patterns in the repository and include:
1. CLAUDE.md with language/framework-specific guidelines
2. .claude/commands/ with relevant development commands
3. .mcp.json with appropriate MCP configurations
4. Update templates.js with the new template definition

Target: [SPECIFY: New language (e.g., "Kotlin") OR new framework (e.g., "FastAPI for Python")]

Please analyze the existing templates in the repository first to understand the structure and patterns, then create the new template following the same conventions.</pre>
                                    </div>
                                    <button class="copy-btn copy-prompt-btn" onclick="copyToClipboard(document.querySelector('.prompt-text pre').textContent)">Copy Prompt</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="contribute-step">
                            <div class="step-number-contrib">4</div>
                            <div class="step-content-contrib">
                                <h4>Test Your Template</h4>
                                <p>Before submitting, test your template locally:</p>
                                <div class="step-command">
                                    <code>cd cli-tool && npm test</code>
                                    <button class="copy-btn" onclick="copyToClipboard('cd cli-tool && npm test')">Copy</button>
                                </div>
                                <div class="step-command">
                                    <code>node src/index.js --language=YOUR_LANGUAGE</code>
                                    <button class="copy-btn" onclick="copyToClipboard('node src/index.js --language=YOUR_LANGUAGE')">Copy</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="contribute-step">
                            <div class="step-number-contrib">5</div>
                            <div class="step-content-contrib">
                                <h4>Submit Pull Request</h4>
                                <p>Create a pull request with your changes:</p>
                                <div class="step-command">
                                    <code>git add . && git commit -m "feat: Add [LANGUAGE/FRAMEWORK] template"</code>
                                    <button class="copy-btn" onclick="copyToClipboard('git add . && git commit -m \"feat: Add [LANGUAGE/FRAMEWORK] template\"')">Copy</button>
                                </div>
                                <div class="step-command">
                                    <code>git push origin main</code>
                                    <button class="copy-btn" onclick="copyToClipboard('git push origin main')">Copy</button>
                                </div>
                                <p>Then go to GitHub and create a Pull Request with:</p>
                                <ul>
                                    <li>Clear title: "feat: Add [Language/Framework] template"</li>
                                    <li>Description of the template and its use cases</li>
                                    <li>Screenshots or examples if applicable</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div class="contribute-footer">
                        <div class="help-section">
                            <h4>Need Help?</h4>
                            <p>Check out <a href="https://github.com/davila7/claude-code-templates/blob/main/CONTRIBUTING.md" target="_blank">CONTRIBUTING.md</a> or open an issue on GitHub.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listener for ESC key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeComponentModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// ===== ANALYTICS AND STATISTICS FUNCTIONALITY =====

/**
 * Load and display download statistics from GitHub-generated analytics
 */
async function loadDownloadStatistics() {
    try {
        // Fetch analytics data generated by GitHub Actions
        const response = await fetch('analytics/download-stats.json?t=' + Date.now());
        
        if (!response.ok) {
            console.log('Analytics data not available yet');
            hideStatisticsSection();
            return;
        }
        
        const analyticsData = await response.json();
        displayDownloadStatistics(analyticsData);
        
    } catch (error) {
        console.log('Analytics data not available:', error.message);
        hideStatisticsSection();
    }
}

/**
 * Display download statistics in the UI
 */
function displayDownloadStatistics(data) {
    // Update total downloads
    const totalElement = document.getElementById('totalDownloads');
    if (totalElement) {
        totalElement.textContent = formatNumber(data.total_downloads || 0);
    }
    
    // Update individual component type counts
    const typeElements = {
        agentDownloads: data.downloads_by_type?.agent || 0,
        commandDownloads: data.downloads_by_type?.command || 0,
        mcpDownloads: data.downloads_by_type?.mcp || 0,
        templateDownloads: data.downloads_by_type?.template || 0
    };
    
    Object.entries(typeElements).forEach(([elementId, count]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = formatNumber(count);
        }
    });
    
    // Find and display most popular component
    const popularElement = document.getElementById('popularComponent');
    if (popularElement && data.downloads_by_component) {
        const topComponent = Object.entries(data.downloads_by_component)[0];
        if (topComponent) {
            const [componentName, downloadCount] = topComponent;
            popularElement.textContent = formatComponentNameForDisplay(componentName);
            popularElement.setAttribute('title', `${formatNumber(downloadCount)} downloads`);
        } else {
            popularElement.textContent = '-';
        }
    }
    
    // Update last updated timestamp
    const lastUpdatedElement = document.getElementById('statsLastUpdated');
    if (lastUpdatedElement && data.last_updated) {
        const lastUpdated = new Date(data.last_updated);
        lastUpdatedElement.textContent = formatRelativeTime(lastUpdated);
    }
    
    // Show the statistics section
    showStatisticsSection();
    
    console.log('📊 Download statistics loaded successfully');
}

/**
 * Hide statistics section when data is not available
 */
function hideStatisticsSection() {
    // Keep statistics section visible even when data is not available
    // const statsSection = document.getElementById('downloadStatsSection');
    // if (statsSection) {
    //     statsSection.style.display = 'none';
    // }
}

/**
 * Show statistics section when data is available
 * Note: Stats section has been moved to dedicated page at /download-stats.html
 */
function showStatisticsSection() {
    // Stats section removed from main page - no action needed
    console.log('Stats available at /download-stats.html');
}

/**
 * Format numbers with thousands separators
 */
function formatNumber(num) {
    if (num === 0) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
    return (num / 1000000).toFixed(1) + 'M';
}

/**
 * Format component name for display (remove prefixes, capitalize)
 */
function formatComponentNameForDisplay(componentName) {
    if (!componentName || componentName === 'unknown') return '-';
    
    // Handle template format (language/framework)
    if (componentName.includes('/')) {
        const parts = componentName.split('/');
        return parts.map(part => 
            part.replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
        ).join('/');
    }
    
    // Handle individual components
    return componentName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
        return diffMins <= 1 ? 'just now' : `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
        return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
        return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

/**
 * Refresh statistics data
 */
async function refreshStatistics() {
    const refreshButton = document.querySelector('.stats-refresh-btn');
    if (refreshButton) {
        refreshButton.textContent = 'Refreshing...';
        refreshButton.disabled = true;
    }
    
    await loadDownloadStatistics();
    
    if (refreshButton) {
        refreshButton.textContent = 'Refresh';
        refreshButton.disabled = false;
    }
}

// Auto-refresh statistics every 10 minutes
setInterval(loadDownloadStatistics, 10 * 60 * 1000);

// Get file type based on extension/name
function getFileType(filename) {
    if (filename.endsWith('.md')) return 'Documentation';
    if (filename.endsWith('.json')) return 'Configuration';
    if (filename.includes('.claude')) return 'Commands';
    if (filename.includes('commands')) return 'Commands';
    return 'Configuration';
}

// Generate GitHub folder URL for templates
function getGithubFolderUrl(languageKey, frameworkKey) {
    const baseUrl = 'https://github.com/davila7/claude-code-templates/tree/main/cli-tool/templates';
    
    if (frameworkKey === 'none' || !frameworkKey) {
        // Base language template
        return `${baseUrl}/${languageKey}`;
    } else {
        // Framework-specific template
        return `${baseUrl}/${languageKey}/examples/${frameworkKey}-app`;
    }
}

// Generate GitHub file URL for individual files
function getGithubFileUrl(languageKey, frameworkKey, filePath) {
    const baseUrl = 'https://github.com/davila7/claude-code-templates/blob/main/cli-tool/templates';
    return `${baseUrl}/${filePath}`;
}

// Copy to clipboard function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showCopyFeedback();
    }).catch(err => {
        console.error('Failed to copy: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showCopyFeedback();
        } catch (err) {
            console.error('Fallback copy failed: ', err);
        }
        document.body.removeChild(textArea);
    });
}

function showCopyFeedback() {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.textContent = 'Copied to clipboard!';
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #48bb78;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        font-weight: 500;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(feedback);
    
    // Remove feedback after 2 seconds
    setTimeout(() => {
        feedback.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(feedback);
        }, 300);
    }, 2000);
}

// Add CSS animations for feedback and error states
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .error-message {
        grid-column: 1 / -1;
        text-align: center;
        color: white;
        background: rgba(220, 53, 69, 0.2);
        border: 1px solid rgba(220, 53, 69, 0.3);
        border-radius: 12px;
        padding: 2rem;
    }
    
    .error-message h3 {
        margin-bottom: 1rem;
        font-size: 1.2rem;
    }
    
    .retry-btn {
        background: #dc3545;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        cursor: pointer;
        margin-top: 1rem;
        font-size: 0.9rem;
        transition: background 0.2s ease;
    }
    
    .retry-btn:hover {
        background: #c82333;
    }
`;
document.head.appendChild(style);

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Start with agents view (new default)
    setUnifiedFilter('agents');
    // Load download statistics
    loadDownloadStatistics();
});

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close all flipped cards
        document.querySelectorAll('.template-card.flipped').forEach(card => {
            card.classList.remove('flipped');
        });
    }
});

// Auto-refresh templates every 5 minutes to pick up changes
setInterval(fetchTemplatesConfig, 5 * 60 * 1000);

// ===== UNIFIED COMPONENTS FUNCTIONALITY =====

let componentsData = {
    agents: [],
    commands: [],
    mcps: []
};

let currentFilter = 'agents';
let currentCategoryFilter = 'all';
let allDataLoaded = false;
let downloadStats = null;
let availableCategories = {
    agents: new Set(),
    commands: new Set(),
    mcps: new Set()
};

// Unified filter functionality
function setUnifiedFilter(filter) {
    currentFilter = filter;
    currentCategoryFilter = 'all'; // Reset category filter when changing main filter
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const targetFilterBtn = document.querySelector(`[data-filter="${filter}"]`);
    if (targetFilterBtn) {
        targetFilterBtn.classList.add('active');
    }
    
    // Load and display content
    if (filter === 'templates') {
        displayTemplates();
    } else {
        loadAndDisplayComponents();
    }
}

// Set category filter
function setCategoryFilter(category) {
    currentCategoryFilter = category;
    
    // Update category filter buttons
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const targetBtn = document.querySelector(`[data-category="${category}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    // Regenerate the component display
    generateUnifiedComponentCards();
}

// Make setCategoryFilter available globally
window.setCategoryFilter = setCategoryFilter;

// Display templates (existing functionality)
function displayTemplates() {
    const unifiedGrid = document.getElementById('unifiedGrid');
    unifiedGrid.className = 'unified-grid templates-mode';
    
    if (templatesData) {
        generateTemplateCards();
    } else {
        unifiedGrid.innerHTML = '<div class="loading">Loading templates from GitHub...</div>';
        fetchTemplatesConfig();
    }
}

// Load and display components
async function loadAndDisplayComponents() {
    const unifiedGrid = document.getElementById('unifiedGrid');
    unifiedGrid.className = 'unified-grid components-mode';
    
    if (!allDataLoaded) {
        unifiedGrid.innerHTML = '<div class="loading">Loading components from GitHub...</div>';
        await loadAllComponentsData();
    }
    
    generateUnifiedComponentCards();
}

// Load all components data
async function loadAllComponentsData() {
    try {
        const response = await fetch('components.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        componentsData = data;
        collectAvailableCategories();
        allDataLoaded = true;
    } catch (error) {
        console.error('Error loading components:', error);
        const unifiedGrid = document.getElementById('unifiedGrid');
        unifiedGrid.innerHTML = `
            <div class="error-message">
                <h3>Error loading components</h3>
                <p>Could not fetch components from local data. Please try again later.</p>
                <button onclick="loadAndDisplayComponents()" class="retry-btn">Retry</button>
            </div>
        `;
    }
}

// Update category sub-filters in the unified-filter-bar
function updateCategorySubFilters() {
    const unifiedFilterBar = document.querySelector('.unified-filter-bar');
    
    // Remove existing category filters
    const existingCategoryFilters = unifiedFilterBar.querySelector('.category-filter-row');
    if (existingCategoryFilters) {
        existingCategoryFilters.remove();
    }
    
    // Get categories for current filter type
    const currentCategories = Array.from(availableCategories[currentFilter] || []).sort();
    
    if (currentCategories.length <= 1 || currentFilter === 'templates') {
        // Don't show sub-filters if there's only one category, none, or templates
        return;
    }
    
    // Create category filter row
    const categoryFilterRow = document.createElement('div');
    categoryFilterRow.className = 'category-filter-row';
    categoryFilterRow.innerHTML = `
        <div class="category-filter-label">Categories:</div>
        <div class="category-filter-buttons">
            <button class="category-filter-btn ${currentCategoryFilter === 'all' ? 'active' : ''}" 
                    data-category="all">
                All
            </button>
            ${currentCategories.map(category => `
                <button class="category-filter-btn ${currentCategoryFilter === category ? 'active' : ''}" 
                        data-category="${category}">
                    ${formatComponentName(category)}
                </button>
            `).join('')}
        </div>
    `;
    
    // Add click event listeners
    categoryFilterRow.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setCategoryFilter(btn.getAttribute('data-category'));
        });
    });
    
    // Append to unified filter bar
    unifiedFilterBar.appendChild(categoryFilterRow);
}

// Generate unified component cards
function generateUnifiedComponentCards() {
    const unifiedGrid = document.getElementById('unifiedGrid');
    unifiedGrid.innerHTML = '';
    
    // Update category sub-filters in the unified-filter-bar
    updateCategorySubFilters();
    
    // Get filtered components
    const filteredComponents = getFilteredComponents();
    
    // Add "Add New" card based on current filter
    if (currentFilter !== 'templates') {
        const addCard = createAddComponentCard(currentFilter);
        unifiedGrid.appendChild(addCard);
    }
    
    // Add component cards
    filteredComponents.forEach(component => {
        const card = createComponentCard(component);
        unifiedGrid.appendChild(card);
    });
    
    // Update filter button with count
    updateFilterCount();
}

// Update filter button count
function updateFilterCount() {
    const filterBtn = document.querySelector(`[data-filter="${currentFilter}"]`);
    if (filterBtn && currentFilter !== 'templates') {
        const components = componentsData[currentFilter];
        if (components && Array.isArray(components)) {
            const count = components.length;
            const originalText = filterBtn.textContent.split('(')[0].trim();
            filterBtn.textContent = `${originalText} (${count})`;
        }
    }
}

// Get filtered components based on current filter and category filter
function getFilteredComponents() {
    if (currentFilter === 'templates') {
        return [];
    }
    
    let components = componentsData[currentFilter] || [];
    
    // Apply category filter if not 'all'
    if (currentCategoryFilter !== 'all') {
        components = components.filter(component => {
            const category = component.category || 'general';
            return category === currentCategoryFilter;
        });
    }
    
    return components;
}

// Collect available categories from loaded components
function collectAvailableCategories() {
    // Reset categories
    availableCategories.agents.clear();
    availableCategories.commands.clear();
    availableCategories.mcps.clear();
    
    // Collect categories from each component type
    if (componentsData.agents && Array.isArray(componentsData.agents)) {
        componentsData.agents.forEach(component => {
            const category = component.category || 'general';
            availableCategories.agents.add(category);
        });
    }
    
    if (componentsData.commands && Array.isArray(componentsData.commands)) {
        componentsData.commands.forEach(component => {
            const category = component.category || 'general';  
            availableCategories.commands.add(category);
        });
    }
    
    if (componentsData.mcps && Array.isArray(componentsData.mcps)) {
        componentsData.mcps.forEach(component => {
            const category = component.category || 'general';
            availableCategories.mcps.add(category);
        });
    }
}

// Load components data from GitHub (legacy function for compatibility)
async function loadComponentsData() {
    // Redirect to unified loading function
    await loadAndDisplayComponents();
}

// Load specific component type from GitHub
async function loadComponentType(type) {
    const baseUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/cli-tool/components/${type}`;
    
    try {
        const response = await fetch(baseUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const files = await response.json();
        const componentPromises = files.map(async (file) => {
            if (file.name.endsWith('.md') || file.name.endsWith('.json')) {
                // Direct file in root level
                const contentResponse = await fetch(file.download_url);
                const content = await contentResponse.text();
                
                return {
                    name: file.name.replace(/\.(md|json)$/, ''),
                    type: type,
                    filename: file.name,
                    content: content,
                    url: file.html_url,
                    category: null // No category for root level components
                };
            } else if (file.type === 'dir') {
                // Handle subdirectories for all component types (categories)
                try {
                    const categoryResponse = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/cli-tool/components/${type}/${file.name}`);
                    if (categoryResponse.ok) {
                        const categoryFiles = await categoryResponse.json();
                        const categoryComponentPromises = categoryFiles.map(async (categoryFile) => {
                            if (categoryFile.name.endsWith('.md') || categoryFile.name.endsWith('.json')) {
                                const contentResponse = await fetch(categoryFile.download_url);
                                const content = await contentResponse.text();
                                
                                return {
                                    name: `${file.name}/${categoryFile.name.replace(/\.(md|json)$/, '')}`,
                                    type: type,
                                    filename: categoryFile.name,
                                    content: content,
                                    url: categoryFile.html_url,
                                    category: file.name
                                };
                            }
                            return null;
                        });
                        
                        const categoryComponents = await Promise.all(categoryComponentPromises);
                        return categoryComponents.filter(c => c !== null);
                    }
                } catch (error) {
                    console.warn(`Warning: Could not load category ${file.name}:`, error);
                    return [];
                }
            }
            return null;
        });
        
        const componentsNested = await Promise.all(componentPromises);
        // Flatten the array since subdirectories return arrays
        const components = componentsNested.flat().filter(c => c !== null);
        return components;
        
    } catch (error) {
        console.error(`Error loading ${type}:`, error);
        return [];
    }
}

// Generate component cards with filter functionality
function generateComponentCards() {
    const componentsGrid = document.getElementById('componentsGrid');
    
    // Create filter bar
    const filterBar = createComponentFilterBar();
    
    // Create components container
    const componentsContainer = document.createElement('div');
    componentsContainer.className = 'components-container';
    
    // Create Add New cards for each category
    const addAgentCard = createAddComponentCard('agents');
    const addCommandCard = createAddComponentCard('commands');
    const addMcpCard = createAddComponentCard('mcps');
    
    // Filter and display components
    const filteredComponents = getFilteredComponents();
    
    componentsContainer.innerHTML = '';
    
    // Add "Add New" cards based on filter
    if (currentFilter === 'all' || currentFilter === 'agents') {
        componentsContainer.appendChild(addAgentCard);
    }
    if (currentFilter === 'all' || currentFilter === 'commands') {
        componentsContainer.appendChild(addCommandCard);
    }
    if (currentFilter === 'all' || currentFilter === 'mcps') {
        componentsContainer.appendChild(addMcpCard);
    }
    
    // Add component cards
    filteredComponents.forEach(component => {
        const card = createComponentCard(component);
        componentsContainer.appendChild(card);
    });
    
    componentsGrid.innerHTML = '';
    componentsGrid.appendChild(filterBar);
    componentsGrid.appendChild(componentsContainer);
}

// Create filter bar for components
function createComponentFilterBar() {
    const filterBar = document.createElement('div');
    filterBar.className = 'component-filter-bar';
    
    const totalCounts = {
        all: componentsData.agents.length + componentsData.commands.length + componentsData.mcps.length,
        agents: componentsData.agents.length,
        commands: componentsData.commands.length,
        mcps: componentsData.mcps.length
    };
    
    filterBar.innerHTML = `
        <div class="filter-label">$ Filter Components</div>
        <div class="filter-buttons">
            <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" onclick="setComponentFilter('all')">
                All (${totalCounts.all})
            </button>
            <button class="filter-btn ${currentFilter === 'agents' ? 'active' : ''}" onclick="setComponentFilter('agents')">
                🤖 Agents (${totalCounts.agents})
            </button>
            <button class="filter-btn ${currentFilter === 'commands' ? 'active' : ''}" onclick="setComponentFilter('commands')">
                ⚡ Commands (${totalCounts.commands})
            </button>
            <button class="filter-btn ${currentFilter === 'mcps' ? 'active' : ''}" onclick="setComponentFilter('mcps')">
                🔌 MCPs (${totalCounts.mcps})
            </button>
        </div>
    `;
    
    return filterBar;
}

// Set component filter
function setComponentFilter(filter) {
    currentFilter = filter;
    generateComponentCards();
}


// Create Add Component card
function createAddComponentCard(type) {
    const card = document.createElement('div');
    card.className = 'template-card add-template-card add-component-card';
    
    const typeConfig = {
        agents: { 
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
            </svg>`, 
            name: 'Agent', 
            description: 'Create a new AI specialist agent' 
        },
        commands: { 
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
            </svg>`, 
            name: 'Command', 
            description: 'Add a custom slash command' 
        },
        mcps: { 
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
            </svg>`, 
            name: 'MCP', 
            description: 'Build a Model Context Protocol integration' 
        }
    };
    
    const config = typeConfig[type];
    
    card.innerHTML = `
        <div class="card-inner">
            <div class="card-front">
                <div class="framework-logo">
                    ${config.icon}
                </div>
                <h3 class="template-title">Add New ${config.name}</h3>
                <p class="template-description">${config.description}</p>
            </div>
        </div>
    `;
    
    // Add click handler to open contribution modal directly (no flip)
    card.addEventListener('click', () => {
        showComponentContributeModal(type);
    });
    
    return card;
}

// Create individual component card
function createComponentCard(component) {
    const card = document.createElement('div');
    card.className = 'template-card';
    
    const typeConfig = {
        agent: { icon: '🤖', color: '#ff6b6b' },
        command: { icon: '⚡', color: '#4ecdc4' },
        mcp: { icon: '🔌', color: '#45b7d1' }
    };
    
    const config = typeConfig[component.type];
    const installCommand = generateInstallCommand(component);
    
    // Get download count for this component
    const downloadCount = getDownloadCount(component.name, component.type);
    const downloadBadge = createDownloadBadge(downloadCount);
    
    // Create category label for all components (use "General" if no category)
    const categoryName = component.category || 'general';
    const categoryLabel = `<div class="category-label">${formatComponentName(categoryName)}</div>`;
    
    card.innerHTML = `
        <div class="card-inner">
            <div class="card-front">
                ${downloadBadge}
                ${categoryLabel}
                <div class="framework-logo" style="color: ${config.color}">
                    <span class="component-icon">${config.icon}</span>
                </div>
                <h3 class="template-title">${formatComponentName(component.name)}</h3>
                <p class="template-description">${getComponentDescription(component)}</p>
            </div>
            <div class="card-back">
                <div class="command-display">
                    <h3>Installation Command</h3>
                    <div class="command-code">${installCommand}</div>
                    <div class="action-buttons">
                        <button class="view-files-btn" onclick="showComponentDetails('${component.type}', '${component.name}')">
                            📁 View Details
                        </button>
                        <button class="copy-command-btn" onclick="copyToClipboard('${installCommand}')">
                            📋 Copy Command
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add click handler for card flip
    card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            card.classList.toggle('flipped');
        }
    });
    
    return card;
}

// Generate install command for component
function generateInstallCommand(component) {
    if (component.type === 'agent') {
        return `npx claude-code-templates@latest --agent=${component.name} --yes`;
    } else if (component.type === 'command') {
        return `npx claude-code-templates@latest --command=${component.name} --yes`;
    } else if (component.type === 'mcp') {
        // Remove .json extension from MCP names for the command
        const mcpName = component.name.replace(/\.json$/, '');
        return `npx claude-code-templates@latest --mcp=${mcpName} --yes`;
    }
    return `npx claude-code-templates@latest`;
}


// Get installation notes (removed to match template cards design)
function getInstallationNotes() {
    return '';
}

// Format component name for display
function formatComponentName(name) {
    // Handle subcategorized agents (e.g., "deep-research-team/academic-researcher")
    if (name.includes('/')) {
        const parts = name.split('/');
        const actualName = parts[parts.length - 1]; // Get the last part after the slash
        return actualName
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return name
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

// Get component description
function getComponentDescription(component) {
    return `A component of type '${component.type}' for Claude Code.`;
}

// Show component details modal
async function showComponentDetails(type, name) {
    const component = componentsData[type + 's'].find(c => c.name === name);
    if (!component) return;

    const modal = document.getElementById('componentModal');
    document.getElementById('componentModalTitle').textContent = name;
    document.getElementById('componentModalType').textContent = type;
    document.getElementById('componentModalCategory').textContent = component.category;
    document.getElementById('componentModalPath').textContent = component.path;
    document.getElementById('componentModalUsage').textContent = `cct --${type} "${component.path}"`;

    const descriptionElement = document.getElementById('componentModalDescription');
    descriptionElement.textContent = component.content || 'No content available.';
    modal.style.display = 'block';
}

// Show component contribute modal
function showComponentContributeModal(type) {
    const typeConfig = {
        agents: { 
            name: 'Agent', 
            description: 'AI specialist that handles specific development tasks',
            example: 'python-testing-specialist',
            structure: '- Agent metadata (name, description, color)\n- Core expertise areas\n- When to use guidelines\n- Code examples and patterns'
        },
        commands: { 
            name: 'Command', 
            description: 'Custom slash command for Claude Code',
            example: 'optimize-bundle',
            structure: '- Command description and usage\n- Task breakdown\n- Process steps\n- Best practices and examples'
        },
        mcps: { 
            name: 'MCP', 
            description: 'Model Context Protocol integration',
            example: 'redis-integration',
            structure: '- MCP server configuration\n- Connection parameters\n- Environment variables\n- Usage examples'
        }
    };
    
    const config = typeConfig[type];
    
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-content contribute-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>📝 Contribute a New ${config.name}</h3>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="contribute-intro">
                        <p>Help expand Claude Code by contributing a new ${config.name.toLowerCase()}! Follow these steps:</p>
                    </div>
                    
                    <div class="contribute-steps">
                        <div class="contribute-step">
                            <div class="step-number-contrib">1</div>
                            <div class="step-content-contrib">
                                <h4>Create Your ${config.name}</h4>
                                <p>Add your ${config.name.toLowerCase()} to: <code>cli-tool/components/${type}/</code></p>
                                <div class="component-structure">
                                    <strong>Structure should include:</strong>
                                    <pre>${config.structure}</pre>
                                </div>
                                <div class="step-command">
                                    <strong>Example filename:</strong> <code>${config.example}.${type === 'mcps' ? 'json' : 'md'}</code>
                                </div>
                            </div>
                        </div>
                        
                        <div class="contribute-step">
                            <div class="step-number-contrib">2</div>
                            <div class="step-content-contrib">
                                <h4>Follow the Pattern</h4>
                                <p>Check existing ${type} in the repository to understand the structure and conventions.</p>
                                <div class="step-command">
                                    <a href="https://github.com/davila7/claude-code-templates/tree/main/cli-tool/components/${type}" target="_blank" class="github-folder-link">
                                        📁 View existing ${type}
                                    </a>
                                </div>
                            </div>
                        </div>
                        
                        <div class="contribute-step">
                            <div class="step-number-contrib">3</div>
                            <div class="step-content-contrib">
                                <h4>Test Your Component</h4>
                                <p>Ensure your ${config.name.toLowerCase()} works correctly with Claude Code.</p>
                                <div class="step-command">
                                    <code>cd cli-tool && npm test</code>
                                    <button class="copy-btn" onclick="copyToClipboard('cd cli-tool && npm test')">Copy</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="contribute-step">
                            <div class="step-number-contrib">4</div>
                            <div class="step-content-contrib">
                                <h4>Submit Pull Request</h4>
                                <p>Submit your contribution with proper documentation:</p>
                                <div class="step-command">
                                    <code>git add cli-tool/components/${type}/${config.example}.${type === 'mcps' ? 'json' : 'md'}</code>
                                    <button class="copy-btn" onclick="copyToClipboard('git add cli-tool/components/${type}/${config.example}.${type === 'mcps' ? 'json' : 'md'}')">Copy</button>
                                </div>
                                <div class="step-command">
                                    <code>git commit -m "feat: Add ${config.example} ${config.name.toLowerCase()}"</code>
                                    <button class="copy-btn" onclick="copyToClipboard('git commit -m \"feat: Add ${config.example} ${config.name.toLowerCase()}\"')">Copy</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="contribute-footer">
                        <div class="help-section">
                            <h4>Need Help?</h4>
                            <p>Check existing ${type} for examples or open an issue on GitHub for guidance.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    modal.className = 'modal contribute-component-modal';
    document.body.appendChild(modal);
    
    // Add event listener for ESC key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeComponentModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// ===== ANALYTICS AND STATISTICS FUNCTIONALITY =====

/**
 * Load and display download statistics from GitHub-generated analytics
 */
async function loadDownloadStatistics() {
    try {
        // Fetch analytics data generated by GitHub Actions
        const response = await fetch('analytics/download-stats.json?t=' + Date.now());
        
        if (!response.ok) {
            console.log('Analytics data not available yet');
            hideStatisticsSection();
            return;
        }
        
        const analyticsData = await response.json();
        displayDownloadStatistics(analyticsData);
        
    } catch (error) {
        console.log('Analytics data not available:', error.message);
        hideStatisticsSection();
    }
}

/**
 * Display download statistics in the UI
 */
function displayDownloadStatistics(data) {
    // Update total downloads
    const totalElement = document.getElementById('totalDownloads');
    if (totalElement) {
        totalElement.textContent = formatNumber(data.total_downloads || 0);
    }
    
    // Update individual component type counts
    const typeElements = {
        agentDownloads: data.downloads_by_type?.agent || 0,
        commandDownloads: data.downloads_by_type?.command || 0,
        mcpDownloads: data.downloads_by_type?.mcp || 0,
        templateDownloads: data.downloads_by_type?.template || 0
    };
    
    Object.entries(typeElements).forEach(([elementId, count]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = formatNumber(count);
        }
    });
    
    // Find and display most popular component
    const popularElement = document.getElementById('popularComponent');
    if (popularElement && data.downloads_by_component) {
        const topComponent = Object.entries(data.downloads_by_component)[0];
        if (topComponent) {
            const [componentName, downloadCount] = topComponent;
            popularElement.textContent = formatComponentNameForDisplay(componentName);
            popularElement.setAttribute('title', `${formatNumber(downloadCount)} downloads`);
        } else {
            popularElement.textContent = '-';
        }
    }
    
    // Update last updated timestamp
    const lastUpdatedElement = document.getElementById('statsLastUpdated');
    if (lastUpdatedElement && data.last_updated) {
        const lastUpdated = new Date(data.last_updated);
        lastUpdatedElement.textContent = formatRelativeTime(lastUpdated);
    }
    
    // Show the statistics section
    showStatisticsSection();
    
    console.log('📊 Download statistics loaded successfully');
}

/**
 * Hide statistics section when data is not available
 */
function hideStatisticsSection() {
    // Keep statistics section visible even when data is not available
    // const statsSection = document.getElementById('downloadStatsSection');
    // if (statsSection) {
    //     statsSection.style.display = 'none';
    // }
}

/**
 * Show statistics section when data is available
 * Note: Stats section has been moved to dedicated page at /download-stats.html
 */
function showStatisticsSection() {
    // Stats section removed from main page - no action needed
    console.log('Stats available at /download-stats.html');
}

/**
 * Format numbers with thousands separators
 */
function formatNumber(num) {
    if (num === 0) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
    return (num / 1000000).toFixed(1) + 'M';
}

/**
 * Format component name for display (remove prefixes, capitalize)
 */
function formatComponentNameForDisplay(componentName) {
    if (!componentName || componentName === 'unknown') return '-';
    
    // Handle template format (language/framework)
    if (componentName.includes('/')) {
        const parts = componentName.split('/');
        return parts.map(part => 
            part.replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
        ).join('/');
    }
    
    // Handle individual components
    return componentName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
        return diffMins <= 1 ? 'just now' : `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
        return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
        return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

/**
 * Refresh statistics data
 */
async function refreshStatistics() {
    const refreshButton = document.querySelector('.stats-refresh-btn');
    if (refreshButton) {
        refreshButton.textContent = 'Refreshing...';
        refreshButton.disabled = true;
    }
    
    await loadDownloadStatistics();
    
    if (refreshButton) {
        refreshButton.textContent = 'Refresh';
        refreshButton.disabled = false;
    }
}

// Auto-refresh statistics every 10 minutes
setInterval(loadDownloadStatistics, 10 * 60 * 1000);

// Show detailed component modal
function showComponentModal(component) {
    const typeConfig = {
        agent: { icon: '🤖', color: '#ff6b6b', label: 'AGENT' },
        command: { icon: '⚡', color: '#4ecdc4', label: 'COMMAND' },
        mcp: { icon: '🔌', color: '#45b7d1', label: 'MCP' }
    };
    
    const config = typeConfig[component.type];
    const installCommand = generateInstallCommand(component);
    
    const modalHTML = `
        <div class="modal-overlay" onclick="closeComponentModal()">
            <div class="modal-content component-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="component-modal-title">
                        <span class="component-icon" style="color: ${config.color}">${config.icon}</span>
                        <h3>${formatComponentName(component.name)}</h3>
                        <span class="component-type-badge" style="background: ${config.color}">${config.label}</span>
                    </div>
                    <button class="modal-close" onclick="closeComponentModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="component-details">
                        <div class="component-description">
                            ${getComponentDescription(component)}
                        </div>
                        
                        <div class="installation-section">
                            <h4>📦 Installation</h4>
                            <div class="command-line">
                                <code>${installCommand}</code>
                                <button class="copy-btn" onclick="copyToClipboard('${installCommand}')">Copy</button>
                            </div>
                        </div>
                        
                        <div class="component-content">
                            <h4>📋 Component Details</h4>
                            <div class="component-preview">
                                <pre><code>${component.content ? component.content.substring(0, 500) : 'No content available'}${component.content && component.content.length > 500 ? '...' : ''}</code></pre>
                            </div>
                        </div>
                        
                        <div class="modal-actions">
                            <a href="${component.url}" target="_blank" class="github-folder-link">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                                View on GitHub
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listener for ESC key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeComponentModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// ===== ANALYTICS AND STATISTICS FUNCTIONALITY =====

/**
 * Load and display download statistics from GitHub-generated analytics
 */
async function loadDownloadStatistics() {
    try {
        // Fetch analytics data generated by GitHub Actions
        const response = await fetch('analytics/download-stats.json?t=' + Date.now());
        
        if (!response.ok) {
            console.log('Analytics data not available yet');
            hideStatisticsSection();
            return;
        }
        
        const analyticsData = await response.json();
        displayDownloadStatistics(analyticsData);
        
    } catch (error) {
        console.log('Analytics data not available:', error.message);
        hideStatisticsSection();
    }
}

/**
 * Display download statistics in the UI
 */
function displayDownloadStatistics(data) {
    // Update total downloads
    // Store download stats globally for use in cards
    downloadStats = data;
    const totalElement = document.getElementById('totalDownloads');
    if (totalElement) {
        totalElement.textContent = formatNumber(data.total_downloads || 0);
    }
    
    // Update individual component type counts
    const typeElements = {
        agentDownloads: data.downloads_by_type?.agent || 0,
        commandDownloads: data.downloads_by_type?.command || 0,
        mcpDownloads: data.downloads_by_type?.mcp || 0,
        templateDownloads: data.downloads_by_type?.template || 0
    };
    
    Object.entries(typeElements).forEach(([elementId, count]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = formatNumber(count);
        }
    });
    
    // Find and display most popular component
    const popularElement = document.getElementById('popularComponent');
    if (popularElement && data.downloads_by_component) {
        const topComponent = Object.entries(data.downloads_by_component)[0];
        if (topComponent) {
            const [componentName, downloadCount] = topComponent;
            popularElement.textContent = formatComponentNameForDisplay(componentName);
            popularElement.setAttribute('title', `${formatNumber(downloadCount)} downloads`);
        } else {
            popularElement.textContent = '-';
        }
    }
    
    // Update last updated timestamp
    const lastUpdatedElement = document.getElementById('statsLastUpdated');
    if (lastUpdatedElement && data.last_updated) {
        const lastUpdated = new Date(data.last_updated);
        lastUpdatedElement.textContent = formatRelativeTime(lastUpdated);
    }
    
    // Show the statistics section
    showStatisticsSection();
    
    // Regenerate cards with download counts
    if (currentFilter === 'templates' && templatesData) {
        generateTemplateCards();
    } else if (allDataLoaded) {
        generateUnifiedComponentCards();
    }
    
    console.log('📊 Download statistics loaded successfully');
}

/**
 * Hide statistics section when data is not available
 */
function hideStatisticsSection() {
    // Keep statistics section visible even when data is not available
    // const statsSection = document.getElementById('downloadStatsSection');
    // if (statsSection) {
    //     statsSection.style.display = 'none';
    // }
}

/**
 * Show statistics section when data is available
 * Note: Stats section has been moved to dedicated page at /download-stats.html
 */
function showStatisticsSection() {
    // Stats section removed from main page - no action needed
    console.log('Stats available at /download-stats.html');
}

/**
 * Format numbers with thousands separators
 */
function formatNumber(num) {
    if (num === 0) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
    return (num / 1000000).toFixed(1) + 'M';
}

/**
 * Format component name for display (remove prefixes, capitalize)
 */
function formatComponentNameForDisplay(componentName) {
    if (!componentName || componentName === 'unknown') return '-';
    
    // Handle template format (language/framework)
    if (componentName.includes('/')) {
        const parts = componentName.split('/');
        return parts.map(part => 
            part.replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
        ).join('/');
    }
    
    // Handle individual components
    return componentName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
        return diffMins <= 1 ? 'just now' : `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
        return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
        return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

/**
 * Refresh statistics data
 */
async function refreshStatistics() {
    const refreshButton = document.querySelector('.stats-refresh-btn');
    if (refreshButton) {
        refreshButton.textContent = 'Refreshing...';
        refreshButton.disabled = true;
    }
    
    await loadDownloadStatistics();
    
    if (refreshButton) {
        refreshButton.textContent = 'Refresh';
        refreshButton.disabled = false;
    }
}

// Auto-refresh statistics every 10 minutes
setInterval(loadDownloadStatistics, 10 * 60 * 1000);

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('componentModal');
    const closeBtn = document.getElementById('closeComponentModal');
    const closeBtnFooter = document.getElementById('closeComponentModalBtn');

    if (modal && closeBtn && closeBtnFooter) {
        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn.addEventListener('click', closeModal);
        closeBtnFooter.addEventListener('click', closeModal);

        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeComponentModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeComponentModal();
            }
        });
    }
});

/**
 * Get download count for a specific component
 */
function getDownloadCount(componentName, componentType) {
    if (!downloadStats || !downloadStats.downloads_by_component) {
        return 0;
    }
    
    // For templates, the name format is "language/framework"
    if (componentType === 'template') {
        return downloadStats.downloads_by_component[componentName] || 0;
    }
    
    // For individual components (agents, commands, mcps)
    return downloadStats.downloads_by_component[componentName] || 0;
}

/**
 * Create download count badge HTML
 */
function createDownloadBadge(count) {
    if (count === 0) return '';
    
    return `<div class="download-badge" title="${count} downloads">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>
        </svg>
        ${formatNumber(count)}
    </div>`;
}
