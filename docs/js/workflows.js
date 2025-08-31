// Workflow Builder JavaScript

// Global state
let workflowState = {
    steps: [],
    properties: {
        name: '',
        description: '',
        tags: []
    },
    components: {
        agents: [],
        commands: [],
        mcps: []
    }
};

// GitHub API configuration
const GITHUB_CONFIG = {
    owner: 'davila7',
    repo: 'claude-code-templates',
    branch: 'main'
};

// Initialize the workflow builder
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Workflow Builder...');
    showLoadingSpinner();
    
    try {
        await loadAllComponents();
        initializeDragAndDrop();
        initializeEventListeners();
        initializeModalEventListeners();
        initializeSortableSteps();
        console.log('Workflow Builder initialized successfully');
    } catch (error) {
        console.error('Error initializing Workflow Builder:', error);
        showError('Failed to load components. Please refresh the page.');
    } finally {
        hideLoadingSpinner();
    }
});

// Load all components from GitHub using the Git Trees API
async function loadAllComponents() {
    console.log('Loading components from components.json...');
    try {
        const response = await fetch('components.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const allComponents = await response.json();

        workflowState.components = {
            agents: allComponents.agents.sort((a, b) => a.path.localeCompare(b.path)),
            commands: allComponents.commands.sort((a, b) => a.path.localeCompare(b.path)),
            mcps: allComponents.mcps.sort((a, b) => a.path.localeCompare(b.path))
        };

        renderComponentsList('agents', workflowState.components.agents);
        renderComponentsList('commands', workflowState.components.commands);
        renderComponentsList('mcps', workflowState.components.mcps);

        console.log(`Loaded ${workflowState.components.agents.length} agents, ${workflowState.components.commands.length} commands, ${workflowState.components.mcps.length} MCPs`);

    } catch (error) {
        console.error('Error loading components:', error);
        loadComponentsWithFallback();
    }
}

async function loadComponentsWithFallback() {
    console.log("Using fallback data due to API error.");
    const [agents, commands, mcps] = [
        getFallbackComponentData('agents'),
        getFallbackComponentData('commands'),
        getFallbackComponentData('mcps')
    ];
    workflowState.components = { agents, commands, mcps };
    renderComponentsList('agents', agents);
    renderComponentsList('commands', commands);
    renderComponentsList('mcps', mcps);
}

// Get fallback component data
function getFallbackComponentData(type) {
    const fallbackData = {
        agents: [
            { name: 'code-reviewer', path: 'development/code-reviewer', category: 'development', type: 'agent', icon: '🤖' },
            { name: 'documentation-writer', path: 'development/documentation-writer', category: 'development', type: 'agent', icon: '🤖' },
            { name: 'bug-hunter', path: 'development/bug-hunter', category: 'development', type: 'agent', icon: '🤖' },
            { name: 'security-auditor', path: 'security/security-auditor', category: 'security', type: 'agent', icon: '🤖' },
            { name: 'performance-optimizer', path: 'optimization/performance-optimizer', category: 'optimization', type: 'agent', icon: '🤖' }
        ],
        commands: [
            { name: 'git-setup', path: 'development/git-setup', category: 'development', type: 'command', icon: '⚡' },
            { name: 'project-init', path: 'development/project-init', category: 'development', type: 'command', icon: '⚡' },
            { name: 'docker-setup', path: 'devops/docker-setup', category: 'devops', type: 'command', icon: '⚡' },
            { name: 'test-runner', path: 'testing/test-runner', category: 'testing', type: 'command', icon: '⚡' },
            { name: 'build-pipeline', path: 'devops/build-pipeline', category: 'devops', type: 'command', icon: '⚡' }
        ],
        mcps: [
            { name: 'database-connector', path: 'database/database-connector', category: 'database', type: 'mcp', icon: '🔌' },
            { name: 'api-client', path: 'api/api-client', category: 'api', type: 'mcp', icon: '🔌' },
            { name: 'file-manager', path: 'system/file-manager', category: 'system', type: 'mcp', icon: '🔌' },
            { name: 'redis-cache', path: 'database/redis-cache', category: 'database', type: 'mcp', icon: '🔌' },
            { name: 'email-service', path: 'communication/email-service', category: 'communication', type: 'mcp', icon: '🔌' }
        ]
    };
    
    const typeKey = type;
    const data = fallbackData[typeKey] || [];
    console.log(`Loaded ${data.length} fallback ${type} components`);
    return data;
}

// Get icon for component type
function getComponentIcon(type) {
    const icons = { 'agent': '🤖', 'command': '⚡', 'mcp': '🔌' };
    return icons[type] || '📦';
}

// Render components list in the UI
function renderComponentsList(type, components) {
    const container = document.getElementById(`${type}-tree`);
    const countElement = document.getElementById(`${type}-count`);
    
    if (!container || !countElement) return;
    
    countElement.textContent = components.length;
    container.innerHTML = '';
    
    const groupedComponents = components.reduce((acc, component) => {
        const category = component.category === 'root' ? 'general' : component.category;
        if (!acc[category]) acc[category] = [];
        acc[category].push(component);
        return acc;
    }, {});
    
    Object.entries(groupedComponents).forEach(([category, categoryComponents]) => {
        const folderElement = createTreeFolder(category, categoryComponents, type);
        container.appendChild(folderElement);
    });
}

// Create tree folder element
function createTreeFolder(category, components, type) {
    const folderElement = document.createElement('div');
    folderElement.className = 'tree-node';
    const folderId = `${type}-${category.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
    
    folderElement.innerHTML = `
        <div class="tree-node-header" data-folder="${folderId}">
            <span class="tree-icon folder-icon">📁</span>
            <span class="tree-label">${category}</span>
            <span class="tree-count">${components.length}</span>
            <span class="tree-arrow">▶</span>
        </div>
        <div class="tree-children" id="${folderId}"></div>
    `;
    
    const childrenContainer = folderElement.querySelector('.tree-children');
    components.forEach(component => {
        const fileElement = createTreeFile(component);
        childrenContainer.appendChild(fileElement);
    });
    
    return folderElement;
}

// Create tree file element
function createTreeFile(component) {
    const element = document.createElement('div');
    element.className = 'tree-file';
    element.draggable = true;
    element.dataset.componentType = component.type;
    element.dataset.componentName = component.name;
    element.dataset.componentPath = component.path;
    element.dataset.componentCategory = component.category;
    
    element.innerHTML = `
        <div class="tree-file-header">
            <span class="tree-icon file-icon">${getFileIcon(component.type)}</span>
            <span class="tree-file-name">${component.name}</span>
            <div class="tree-file-actions">
                <button class="tree-action-btn" title="View Details" onclick="showComponentDetails('${component.type}', '${component.name}', '${component.path}', '${component.category}')">ℹ️</button>
                <button class="tree-action-btn" title="Add to Workflow" onclick="addComponentFromButton(event)">➕</button>
            </div>
        </div>
    `;
    return element;
}

// Get file icon based on type
function getFileIcon(type) {
    const icons = { 'agent': '📄', 'command': '⚡', 'mcp': '⚙️' };
    return icons[type] || '📄';
}

// Initialize drag and drop
function initializeDragAndDrop() {
    const workflowSteps = document.getElementById('workflowSteps');
    document.addEventListener('dragstart', (event) => {
        if (event.target.closest('.tree-file')) {
            handleDragStart(event);
        }
    });
    workflowSteps.addEventListener('dragover', handleDragOver);
    workflowSteps.addEventListener('drop', handleDrop);
    workflowSteps.addEventListener('dragenter', (e) => e.target.closest('.drop-zone')?.classList.add('drag-over'));
    workflowSteps.addEventListener('dragleave', (e) => e.target.closest('.drop-zone')?.classList.remove('drag-over'));
}

function handleDragStart(event) {
    const treeFile = event.target.closest('.tree-file');
    const componentData = { ...treeFile.dataset };
    event.dataTransfer.setData('application/json', JSON.stringify(componentData));
    event.dataTransfer.effectAllowed = 'copy';
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
}

function handleDrop(event) {
    event.preventDefault();
    event.target.closest('.drop-zone')?.classList.remove('drag-over');
    try {
        const componentData = JSON.parse(event.dataTransfer.getData('application/json'));
        addWorkflowStep(componentData);
    } catch (error) {
        console.error('Error handling drop:', error);
    }
}

function addComponentFromButton(event) {
    const treeFile = event.target.closest('.tree-file');
    const componentData = { ...treeFile.dataset };
    addWorkflowStep(componentData);
}

function addWorkflowStep(componentData) {
    const step = {
        id: `step_${Date.now()}`,
        type: componentData.componentType,
        name: componentData.componentName,
        path: componentData.componentPath,
        category: componentData.componentCategory,
        description: `Execute ${componentData.componentName}`,
        icon: getComponentIcon(componentData.componentType)
    };
    workflowState.steps.push(step);
    renderWorkflowSteps();
    updateWorkflowStats();
}

function renderWorkflowSteps() {
    const container = document.getElementById('workflowSteps');
    const dropZone = container.querySelector('.drop-zone');
    const existingSteps = container.querySelectorAll('.workflow-step');
    existingSteps.forEach(step => step.remove());

    if (workflowState.steps.length > 0) {
        dropZone.style.display = 'none';
        workflowState.steps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'workflow-step';
            stepElement.dataset.stepId = step.id;
            stepElement.innerHTML = `
                <div class="step-number">${index + 1}</div>
                <div class="step-icon">${step.icon}</div>
                <div class="step-content">
                    <div class="step-name">${step.name}</div>
                    <div class="step-type">${step.type}</div>
                </div>
                <div class="step-actions">
                    <button class="step-action details" onclick="showComponentDetails('${step.type}', '${step.name}', '${step.path}', '${step.category}')">ℹ️</button>
                    <button class="step-action remove" onclick="removeStep('${step.id}')">🗑️</button>
                </div>
            `;
            container.appendChild(stepElement);
        });
    } else {
        dropZone.style.display = 'flex';
    }
    initializeSortableSteps();
}

function initializeSortableSteps() {
    const workflowSteps = document.getElementById('workflowSteps');
    if (workflowState.steps.length > 0) {
        new Sortable(workflowSteps, {
            animation: 150,
            onEnd: (evt) => {
                const movedStep = workflowState.steps.splice(evt.oldIndex, 1)[0];
                workflowState.steps.splice(evt.newIndex, 0, movedStep);
                renderWorkflowSteps();
            }
        });
    }
}

function removeStep(stepId) {
    workflowState.steps = workflowState.steps.filter(step => step.id !== stepId);
    renderWorkflowSteps();
    updateWorkflowStats();
}

function updateWorkflowStats() {
    const stats = { agents: 0, commands: 0, mcps: 0 };
    workflowState.steps.forEach(step => stats[step.type + 's']++);
    document.getElementById('agentCount').textContent = stats.agents;
    document.getElementById('commandCount').textContent = stats.commands;
    document.getElementById('mcpCount').textContent = stats.mcps;
    document.getElementById('totalSteps').textContent = workflowState.steps.length;
}

function initializeEventListeners() {
    document.getElementById('componentSearch').addEventListener('input', handleComponentSearch);
    document.getElementById('clearCanvas').addEventListener('click', clearWorkflow);
    document.getElementById('generateWorkflow').addEventListener('click', openPropertiesModal);
    document.getElementById('closePropertiesModal').addEventListener('click', closePropertiesModal);
    document.getElementById('saveWorkflowProperties').addEventListener('click', saveAndGenerateWorkflow);
    
    // Category accordion toggle
    document.querySelectorAll('.category-card-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('expanded');
        });
    });

    // Add event listener for sub-folders
    document.addEventListener('click', function(event) {
        const header = event.target.closest('.tree-node-header');
        if (header) {
            const children = header.nextElementSibling;
            if (children && children.classList.contains('tree-children')) {
                header.classList.toggle('expanded');
                children.classList.toggle('expanded');
            }
        }
    });
}

function handleComponentSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    document.querySelectorAll('.tree-file').forEach(file => {
        const match = file.dataset.componentName.toLowerCase().includes(searchTerm);
        file.style.display = match ? '' : 'none';
    });
}

function clearWorkflow() {
    if (confirm('Are you sure you want to clear the workflow?')) {
        workflowState.steps = [];
        renderWorkflowSteps();
        updateWorkflowStats();
    }
}

function openPropertiesModal() {
    if (workflowState.steps.length === 0) {
        showError('Add at least one component to the workflow.');
        return;
    }
    document.getElementById('propertiesModal').style.display = 'block';
}

function closePropertiesModal() {
    document.getElementById('propertiesModal').style.display = 'none';
}

function saveAndGenerateWorkflow() {
    workflowState.properties.name = document.getElementById('workflowName').value;
    workflowState.properties.description = document.getElementById('workflowDescription').value;
    workflowState.properties.tags = document.getElementById('workflowTags').value.split(',').map(t => t.trim());
    
    if (!workflowState.properties.name) {
        showError('Workflow name is required.');
        return;
    }
    
    closePropertiesModal();
    generateWorkflow();
}

async function generateWorkflow() {
    showLoadingSpinner();
    try {
        const workflowHash = await generateWorkflowHash();
        const yamlContent = generateWorkflowYAML();
        showGenerateModal(workflowHash, yamlContent);
    } catch (error) {
        console.error('Error generating workflow:', error);
    } finally {
        hideLoadingSpinner();
    }
}

async function generateWorkflowHash() {
    const dataString = JSON.stringify(workflowState);
    const hash = CryptoJS.SHA256(dataString).toString(CryptoJS.enc.Hex).substring(0, 12);
    localStorage.setItem(`workflow_${hash}`, dataString);
    return hash;
}

function generateWorkflowYAML() {
    return `# Workflow: ${workflowState.properties.name}\n` +
           `steps:\n` +
           workflowState.steps.map((step, i) => `  - step: ${i+1}\n    type: ${step.type}\n    name: "${step.name}"`).join('\n');
}

function showGenerateModal(hash, yaml) {
    document.getElementById('workflowCommand').textContent = `npx claude-code-templates@latest --workflow:#${hash}`;
    document.getElementById('yamlContent').textContent = yaml;
    document.getElementById('generateModal').style.display = 'block';
}

function showLoadingSpinner() { document.getElementById('loadingSpinner').style.display = 'flex'; }
function hideLoadingSpinner() { document.getElementById('loadingSpinner').style.display = 'none'; }
function showError(msg) { alert(msg); }

async function showComponentDetails(type, name, path, category) {
    const component = workflowState.components[type + 's'].find(c => c.name === name);
    if (!component) {
        console.warn('Component not found:', type, name);
        return;
    }

    showComponentModal(component);
}

// Show detailed component modal (recreated from original version)
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
                                <pre><code>${component.content ? component.content.substring(0, 500) + (component.content.length > 500 ? '...' : '') : 'No content available.'}</code></pre>
                            </div>
                        </div>
                        
                        <div class="modal-actions">
                            <button class="github-folder-link" onclick="viewOnGitHub('${component.path}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                                View on GitHub
                            </button>
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
}

// Helper functions for the modal
function formatComponentName(name) {
    return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function generateInstallCommand(component) {
    return `npx claude-code-templates@latest --${component.type} "${component.path}"`;
}

function getComponentDescription(component) {
    if (!component.content) {
        return 'No description available.';
    }
    
    // Try to extract description from frontmatter
    const descMatch = component.content.match(/description:\s*(.+?)(?:\n|$)/);
    if (descMatch) {
        return descMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    
    // Use first paragraph if no frontmatter description
    const lines = component.content.split('\n');
    const firstParagraph = lines.find(line => line.trim() && !line.startsWith('---') && !line.startsWith('#'));
    if (firstParagraph) {
        return firstParagraph.trim();
    }
    
    return 'No description available.';
}

function viewOnGitHub(path) {
    const url = `https://github.com/davila7/claude-code-templates/tree/main/${path}`;
    window.open(url, '_blank');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showSuccess('Command copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

function closeComponentModal() {
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.remove();
    }
}

function initializeModalEventListeners() {
    // Component modal event listeners
    document.getElementById('closeComponentModal').addEventListener('click', closeComponentModal);
    document.getElementById('closeComponentModalBtn').addEventListener('click', closeComponentModal);
    document.getElementById('addComponentToWorkflow').addEventListener('click', () => {
        const componentData = JSON.parse(document.getElementById('componentModal').dataset.currentComponent);
        addWorkflowStep({
            componentType: componentData.type,
            componentName: componentData.name,
            componentPath: componentData.path,
            componentCategory: componentData.category
        });
        closeComponentModal();
    });
    document.getElementById('copyUsageCommand').addEventListener('click', () => {
        const command = document.getElementById('componentModalUsage').textContent;
        navigator.clipboard.writeText(command).then(() => showSuccess('Command copied!'));
    });

    // Generate modal event listeners
    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            document.getElementById('generateModal').style.display = 'none';
        });
    }

    const copyCommand = document.getElementById('copyCommand');
    if (copyCommand) {
        copyCommand.addEventListener('click', () => {
            const command = document.getElementById('workflowCommand').textContent;
            navigator.clipboard.writeText(command).then(() => showSuccess('Command copied!'));
        });
    }

    const copyYaml = document.getElementById('copyYaml');
    if (copyYaml) {
        copyYaml.addEventListener('click', () => {
            const yaml = document.getElementById('yamlContent').textContent;
            navigator.clipboard.writeText(yaml).then(() => showSuccess('YAML copied!'));
        });
    }

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

function showSuccess(message) {
    // Simple success notification
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 2000);
}

// Add functions to window object for inline event handlers
window.removeStep = removeStep;
window.showComponentDetails = showComponentDetails;
window.addComponentFromButton = addComponentFromButton;