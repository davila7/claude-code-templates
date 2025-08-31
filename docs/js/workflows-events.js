// Workflows Events - Handles events specific to workflows.html

class WorkflowManager {
    constructor() {
        this.workflowState = {
            agents: [], // New hierarchical structure: [{agent: {...}, subItems: []}]
            steps: [], // Legacy support
            properties: {
                name: '',
                description: '',
                tags: [],
                prompt: ''
            },
            components: {
                agents: [],
                commands: [],
                mcps: []
            }
        };
    }

    async init() {
        try {
            await this.loadComponents();
            this.setupEventListeners();
            this.initializeDragAndDrop();
            this.renderComponentsList();
            console.log('Workflow Builder initialized successfully');
        } catch (error) {
            console.error('Error initializing Workflow Builder:', error);
            this.showError('Failed to load components. Please refresh the page.');
        }
    }

    async loadComponents() {
        this.workflowState.components = await window.dataLoader.loadComponents();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('componentSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleComponentSearch(e));
        }

        // Canvas actions
        const previewBtn = document.getElementById('previewWorkflow');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewWorkflow());
        }

        const clearBtn = document.getElementById('clearCanvas');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearWorkflow());
        }

        const generateBtn = document.getElementById('generateWorkflow');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.openPropertiesModal());
        }

        // Properties modal
        const closePropertiesBtn = document.getElementById('closePropertiesModal');
        if (closePropertiesBtn) {
            closePropertiesBtn.addEventListener('click', () => this.closePropertiesModal());
        }

        const savePropertiesBtn = document.getElementById('saveWorkflowProperties');
        if (savePropertiesBtn) {
            savePropertiesBtn.addEventListener('click', () => this.saveAndGenerateWorkflow());
        }

        // Category accordion toggle
        document.querySelectorAll('.category-card-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('expanded');
            });
        });

        // Sub-folders toggle
        document.addEventListener('click', (event) => {
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

    renderComponentsList() {
        ['agents', 'commands', 'mcps'].forEach(type => {
            this.renderComponentsListByType(type, this.workflowState.components[type]);
        });
    }

    renderComponentsListByType(type, components) {
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
            const folderElement = this.createTreeFolder(category, categoryComponents, type);
            container.appendChild(folderElement);
        });
    }

    createTreeFolder(category, components, type) {
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
            const fileElement = this.createTreeFile(component);
            childrenContainer.appendChild(fileElement);
        });
        
        return folderElement;
    }

    createTreeFile(component) {
        const element = document.createElement('div');
        element.className = 'tree-file';
        element.draggable = true;
        element.dataset.componentType = component.type;
        element.dataset.componentName = component.name;
        element.dataset.componentPath = component.path;
        element.dataset.componentCategory = component.category;
        
        const fileIcon = this.getFileIcon(component.type);
        
        element.innerHTML = `
            <div class="tree-file-header">
                <span class="tree-icon file-icon">${fileIcon}</span>
                <span class="tree-file-name">${component.name}</span>
                <div class="tree-file-actions">
                    <button class="tree-action-btn" title="View Details" onclick="showWorkflowComponentDetails('${component.type}', '${component.name}', '${component.path}', '${component.category}')">ℹ️</button>
                    <button class="tree-action-btn" title="Add to Workflow" onclick="addComponentFromButton(event)">➕</button>
                </div>
            </div>
        `;
        
        return element;
    }

    getFileIcon(type) {
        const icons = { 'agent': '📄', 'command': '⚡', 'mcp': '⚙️' };
        return icons[type] || '📄';
    }

    initializeDragAndDrop() {
        const workflowSteps = document.getElementById('workflowSteps');
        if (!workflowSteps) return;

        document.addEventListener('dragstart', (event) => {
            if (event.target.closest('.tree-file')) {
                this.handleDragStart(event);
            }
        });

        // Main drop zone
        workflowSteps.addEventListener('dragover', this.handleDragOver);
        workflowSteps.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Enhanced drag enter/leave for better highlighting
        workflowSteps.addEventListener('dragenter', (e) => {
            e.preventDefault();
            const dropZone = e.target.closest('.drop-zone');
            const subDropZone = e.target.closest('.sub-item-drop-zone');
            const addItemBtn = e.target.closest('.add-agent-btn');
            
            if (dropZone && !subDropZone) {
                dropZone.classList.add('drag-over');
            } else if (subDropZone) {
                subDropZone.classList.add('drag-over');
            } else if (addItemBtn) {
                addItemBtn.classList.add('drag-over');
            }
        });

        workflowSteps.addEventListener('dragleave', (e) => {
            const dropZone = e.target.closest('.drop-zone');
            const subDropZone = e.target.closest('.sub-item-drop-zone');
            const addItemBtn = e.target.closest('.add-agent-btn');
            
            // Only remove if we're actually leaving the zone
            if (dropZone && !dropZone.contains(e.relatedTarget)) {
                dropZone.classList.remove('drag-over');
            }
            if (subDropZone && !subDropZone.contains(e.relatedTarget)) {
                subDropZone.classList.remove('drag-over');
            }
            if (addItemBtn && !addItemBtn.contains(e.relatedTarget)) {
                addItemBtn.classList.remove('drag-over');
            }
        });

        // Clean up drag-over class when drag ends
        document.addEventListener('dragend', () => {
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });
    }

    handleDragStart(event) {
        const treeFile = event.target.closest('.tree-file');
        const componentData = { ...treeFile.dataset };
        event.dataTransfer.setData('application/json', JSON.stringify(componentData));
        event.dataTransfer.effectAllowed = 'copy';
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }

    handleDrop(event) {
        event.preventDefault();
        
        // Don't handle drops on sub-item drop zones - those are handled by dropOnAgent
        if (event.target.closest('.sub-item-drop-zone')) {
            return;
        }
        
        event.target.closest('.drop-zone')?.classList.remove('drag-over');
        try {
            const componentData = JSON.parse(event.dataTransfer.getData('application/json'));
            this.addWorkflowStep(componentData);
        } catch (error) {
            console.error('Error handling drop:', error);
        }
    }

    addWorkflowStep(componentData, targetAgentId = null) {
        // Ensure agents array is initialized
        if (!this.workflowState.agents) {
            this.workflowState.agents = [];
        }
        
        const step = {
            id: `step_${Date.now()}`,
            type: componentData.componentType,
            name: componentData.componentName,
            path: componentData.componentPath,
            category: componentData.componentCategory,
            description: `Execute ${componentData.componentName}`,
            icon: this.getComponentIcon(componentData.componentType)
        };
        
        if (step.type === 'agent') {
            // Add as new agent
            this.workflowState.agents.push({
                agent: step,
                subItems: [],
                isMainLevel: true
            });
        } else if (targetAgentId && (step.type === 'command' || step.type === 'mcp')) {
            // Add as sub-item to specific agent - DON'T add to main flow
            const agentIndex = this.workflowState.agents.findIndex(a => a.agent.id === targetAgentId);
            if (agentIndex !== -1) {
                this.workflowState.agents[agentIndex].subItems.push(step);
                // Don't add to steps array - it's a sub-item
                this.renderWorkflowSteps();
                this.updateWorkflowStats();
                return;
            }
        } else if (step.type === 'command' || step.type === 'mcp') {
            // Add command/MCP as main level item (no sub-items)
            this.workflowState.agents.push({
                agent: step,
                subItems: null, // null indicates no sub-items allowed
                isMainLevel: true
            });
        }
        
        // Maintain legacy steps array for backwards compatibility (only for main level items)
        this.workflowState.steps.push(step);
        
        this.renderWorkflowSteps();
        this.updateWorkflowStats();
    }

    getComponentIcon(type) {
        const icons = { 'agent': '🤖', 'command': '⚡', 'mcp': '🔌' };
        return icons[type] || '📦';
    }

    renderWorkflowSteps() {
        const container = document.getElementById('workflowSteps');
        if (!container) return;

        const dropZone = container.querySelector('.drop-zone');
        const existingAgents = container.querySelectorAll('.workflow-agent');
        const existingSteps = container.querySelectorAll('.workflow-step');
        const existingIndicators = container.querySelectorAll('.add-agent-indicator');
        existingAgents.forEach(agent => agent.remove());
        existingSteps.forEach(step => step.remove());
        existingIndicators.forEach(indicator => indicator.remove());

        const agents = this.workflowState.agents || [];
        if (agents.length > 0) {
            if (dropZone) dropZone.style.display = 'none';
            
            agents.forEach((agentData, index) => {
                const mainStepNumber = index + 1;
                const agentElement = document.createElement('div');
                agentElement.className = 'workflow-agent';
                agentElement.dataset.agentId = agentData.agent.id;
                agentElement.dataset.stepNumber = mainStepNumber;
                
                // Check if this is a command/MCP in main flow (no sub-items)
                if (agentData.subItems === null) {
                    // Simple command/MCP item (no sub-items allowed)
                    agentElement.innerHTML = `
                        <div class="step-number">${mainStepNumber}</div>
                        <div class="agent-header">
                            <div class="step-icon">${agentData.agent.icon}</div>
                            <div class="step-content">
                                <div class="step-name">${agentData.agent.name}</div>
                                <div class="step-type">${agentData.agent.type}</div>
                            </div>
                            <div class="agent-actions">
                                <button class="agent-action" onclick="showWorkflowComponentDetails('${agentData.agent.type}', '${agentData.agent.name.replace(/'/g, "\\'")}')" title="Details">ℹ️</button>
                                <button class="agent-action" onclick="removeAgent('${agentData.agent.id}')" title="Remove">🗑️</button>
                            </div>
                        </div>
                    `;
                } else {
                    // Agent with potential sub-items
                    const subItemsHtml = agentData.subItems.map((subItem, subIndex) => `
                        <div class="sub-item" data-sub-item-id="${subItem.id}">
                            <div class="step-number">${mainStepNumber}.${subIndex + 1}</div>
                            <div class="step-icon">${subItem.icon}</div>
                            <div class="step-content">
                                <div class="step-name">${subItem.name}</div>
                                <div class="step-type">${subItem.type}</div>
                            </div>
                            <div class="agent-actions">
                                <button class="sub-item-action" onclick="showWorkflowComponentDetails('${subItem.type}', '${subItem.name.replace(/'/g, "\\'")}')" title="Details">ℹ️</button>
                                <button class="sub-item-action" onclick="removeSubItem('${agentData.agent.id}', '${subItem.id}')" title="Remove">🗑️</button>
                            </div>
                        </div>
                    `).join('');
                    
                    agentElement.innerHTML = `
                        <div class="step-number">${mainStepNumber}</div>
                        <div class="agent-header">
                            <div class="step-icon">${agentData.agent.icon}</div>
                            <div class="step-content">
                                <div class="step-name">${agentData.agent.name}</div>
                                <div class="step-type">${agentData.agent.type}</div>
                            </div>
                            <div class="agent-actions">
                                <button class="agent-action" onclick="showWorkflowComponentDetails('${agentData.agent.type}', '${agentData.agent.name.replace(/'/g, "\\'")}')" title="Details">ℹ️</button>
                                <button class="agent-action" onclick="removeAgent('${agentData.agent.id}')" title="Remove">🗑️</button>
                            </div>
                        </div>
                        <div class="agent-content">
                            <div class="agent-sub-items">
                                ${subItemsHtml}
                                <div class="sub-item-drop-zone" data-agent-id="${agentData.agent.id}" 
                                     ondrop="dropOnAgent(event, '${agentData.agent.id}')" 
                                     ondragover="allowDrop(event)"
                                     ondragenter="event.preventDefault(); event.target.classList.add('drag-over')"
                                     ondragleave="if (!event.target.contains(event.relatedTarget)) event.target.classList.remove('drag-over')">
                                    Drop commands or MCPs here
                                </div>
                            </div>
                        </div>
                    `;
                }
                container.appendChild(agentElement);
            });
            
            // Add one "add item" indicator at the end of all agents
            const addAgentIndicator = document.createElement('div');
            addAgentIndicator.className = 'add-agent-indicator';
            addAgentIndicator.innerHTML = `
                <div class="add-agent-btn" 
                     onclick="scrollToDropZone()"
                     ondrop="dropOnAddItem(event)" 
                     ondragover="allowDrop(event)">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,7H13V11H17V13H13V17H11V13H7V11H11V7Z"/>
                    </svg>
                    Add Next Item
                </div>
            `;
            container.appendChild(addAgentIndicator);
        } else {
            if (dropZone) dropZone.style.display = 'flex';
        }
    }

    updateWorkflowStats() {
        const stats = { agents: 0, commands: 0, mcps: 0 };
        let totalStepsCount = 0;
        
        // Count from hierarchical structure
        const agents = this.workflowState.agents || [];
        agents.forEach(agentData => {
            const agentType = agentData.agent.type;
            if (agentType === 'agent') {
                stats.agents++;
            } else if (agentType === 'command') {
                stats.commands++;
            } else if (agentType === 'mcp') {
                stats.mcps++;
            }
            totalStepsCount++; // Count main level item
            
            // Count sub-items (commands/MCPs inside agents)
            if (agentData.subItems && agentData.subItems.length > 0) {
                agentData.subItems.forEach(subItem => {
                    totalStepsCount++; // Count each sub-item for total
                    
                    // Count sub-items in their respective categories
                    if (subItem.type === 'command') {
                        stats.commands++;
                    } else if (subItem.type === 'mcp') {
                        stats.mcps++;
                    }
                });
            }
        });

        const agentCount = document.getElementById('agentCount');
        const commandCount = document.getElementById('commandCount');
        const mcpCount = document.getElementById('mcpCount');
        const totalSteps = document.getElementById('totalSteps');

        if (agentCount) agentCount.textContent = stats.agents;
        if (commandCount) commandCount.textContent = stats.commands;
        if (mcpCount) mcpCount.textContent = stats.mcps;
        if (totalSteps) totalSteps.textContent = totalStepsCount;
    }

    handleComponentSearch(event) {
        const searchTerm = event.target.value.toLowerCase();
        document.querySelectorAll('.tree-file').forEach(file => {
            const match = file.dataset.componentName.toLowerCase().includes(searchTerm);
            file.style.display = match ? '' : 'none';
        });
    }

    clearWorkflow() {
        if (confirm('Are you sure you want to clear the workflow?')) {
            this.workflowState.steps = [];
            this.workflowState.agents = [];
            this.renderWorkflowSteps();
            this.updateWorkflowStats();
        }
    }

    openPropertiesModal() {
        const agents = this.workflowState.agents || [];
        if (agents.length === 0) {
            this.showError('Add at least one agent to the workflow.');
            return;
        }
        const modal = document.getElementById('propertiesModal');
        if (modal) modal.style.display = 'block';
    }

    closePropertiesModal() {
        const modal = document.getElementById('propertiesModal');
        if (modal) modal.style.display = 'none';
    }

    saveAndGenerateWorkflow() {
        const nameInput = document.getElementById('workflowName');
        const descInput = document.getElementById('workflowDescription');
        const tagsInput = document.getElementById('workflowTags');
        const promptInput = document.getElementById('workflowPrompt');

        if (nameInput) this.workflowState.properties.name = nameInput.value;
        if (descInput) this.workflowState.properties.description = descInput.value;
        if (tagsInput) {
            this.workflowState.properties.tags = tagsInput.value.split(',').map(t => t.trim());
        }
        if (promptInput) this.workflowState.properties.prompt = promptInput.value.trim();
        
        if (!this.workflowState.properties.name) {
            this.showError('Workflow name is required.');
            return;
        }
        
        this.closePropertiesModal();
        this.generateWorkflow();
    }

    async generateWorkflow() {
        try {
            const workflowCommand = await this.generateWorkflowHash();
            const yamlContent = this.generateWorkflowYAML();
            this.showGenerateModal(workflowCommand, yamlContent);
        } catch (error) {
            console.error('Error generating workflow:', error);
            this.showError('Failed to generate workflow.');
        }
    }

    async generateWorkflowHash() {
        // NEW APPROACH: Generate component-based command instead of embedded hash
        const agents = this.workflowState.steps.filter(step => step.type === 'agent').map(step => step.path.replace(/\.md$/, ''));
        const commands = this.workflowState.steps.filter(step => step.type === 'command').map(step => step.path.replace(/\.md$/, ''));
        const mcps = this.workflowState.steps.filter(step => step.type === 'mcp').map(step => step.path.replace(/\.json$/, ''));
        
        // Generate YAML and encode it
        const yamlContent = this.generateWorkflowYAML();
        const encodedYaml = btoa(unescape(encodeURIComponent(yamlContent)));
        
        // Build command components for Method 1 (full command with embedded YAML)
        const commandParts = [];
        
        if (agents.length > 0) {
            commandParts.push(`--agent ${agents.join(',')}`);
        }
        
        if (commands.length > 0) {
            commandParts.push(`--command ${commands.join(',')}`);
        }
        
        if (mcps.length > 0) {
            commandParts.push(`--mcp ${mcps.join(',')}`);
        }
        
        // Add prompt parameter if provided
        if (this.workflowState.properties.prompt) {
            commandParts.push(`--prompt "${this.workflowState.properties.prompt}"`);
        }
        
        // Method 1: Full command with embedded YAML
        const fullCommand = `npx claude-code-templates@latest ${commandParts.join(' ')} --workflow ${encodedYaml}`;
        
        // Method 2: Components only command (without embedded YAML) 
        // Remove prompt from components-only command since YAML isn't included
        const componentsParts = commandParts.filter(part => !part.startsWith('--prompt'));
        const componentsOnlyCommand = componentsParts.length > 0 ? 
            `npx claude-code-templates@latest ${componentsParts.join(' ')}` : 
            '# No components to install';
        
        // Create a short hash for reference
        const shortHash = CryptoJS.SHA256(fullCommand).toString(CryptoJS.enc.Hex).substring(0, 8);
        
        // Store locally for reference
        localStorage.setItem(`workflow_${shortHash}`, JSON.stringify({
            fullCommand: fullCommand,
            componentsCommand: componentsOnlyCommand,
            yaml: yamlContent,
            metadata: this.workflowState.properties,
            timestamp: new Date().toISOString()
        }));
        
        return {
            fullCommand: fullCommand,
            componentsCommand: componentsOnlyCommand,
            yaml: yamlContent
        };
    }

    // Simple and reliable string compression with Unicode support
    compressString(str) {
        try {
            // Simple approach: remove redundant whitespace and use efficient encoding
            let compressed = str
                // Remove unnecessary whitespace
                .replace(/\s+/g, ' ')
                // Remove whitespace around common JSON characters
                .replace(/\s*([{}[\]:,])\s*/g, '$1')
                // Remove quotes around simple keys (where safe)
                .replace(/"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:/g, '$1:');
            
            // Use proper Unicode-safe Base64 encoding
            return btoa(unescape(encodeURIComponent(compressed)));
            
        } catch (error) {
            console.warn('Compression failed, using fallback:', error);
            // Last resort: just encode the original string
            try {
                return btoa(unescape(encodeURIComponent(str)));
            } catch (finalError) {
                // If even that fails, return the original string (will cause error later)
                console.error('All encoding methods failed:', finalError);
                return str;
            }
        }
    }

    // Decompress string (for CLI)
    decompressString(compressed) {
        try {
            // Since we're using simple Base64 encoding, just decode it
            return decodeURIComponent(escape(atob(compressed)));
        } catch (error) {
            throw new Error('Failed to decompress data: ' + error.message);
        }
    }

    async getComponentsData() {
        const componentsData = {};
        
        // Group components by type and get their full content
        for (const step of this.workflowState.steps) {
            if (!componentsData[step.type]) {
                componentsData[step.type] = [];
            }
            
            // Find the component in the loaded data
            const componentsList = this.workflowState.components[step.type + 's'] || [];
            const fullComponent = componentsList.find(c => c.name === step.name);
            
            if (fullComponent) {
                componentsData[step.type].push({
                    name: step.name,
                    path: step.path,
                    category: step.category,
                    content: fullComponent.content,
                    type: step.type
                });
            }
        }
        
        return componentsData;
    }

    generateWorkflowYAML() {
        // Ensure agents array exists and has valid structure
        const agents = this.workflowState.agents || [];
        const totalSteps = agents.reduce((total, agent) => total + 1 + (agent.subItems ? agent.subItems.length : 0), 0);
        
        const promptComment = this.workflowState.properties.prompt 
            ? `# Initial Prompt: ${this.workflowState.properties.prompt}\n`
            : '';
            
        return `# Workflow: ${this.workflowState.properties.name}
# Description: ${this.workflowState.properties.description}
${promptComment}# Generated: ${new Date().toISOString()}
# Agents: ${agents.length} total
# Components: ${totalSteps} total

name: "${this.workflowState.properties.name}"
description: "${this.workflowState.properties.description}"
tags: [${this.workflowState.properties.tags.map(tag => `"${tag}"`).join(', ')}]
version: "2.0.0"${this.workflowState.properties.prompt ? '\nprompt: "' + this.workflowState.properties.prompt + '"' : ''}

# Hierarchical workflow structure: Agents → Commands/MCPs
agents:
${agents.map((agentData, i) => `  - agent: ${i + 1}
    type: ${agentData.agent.type}
    name: "${agentData.agent.name}"
    path: "${agentData.agent.type === 'mcp' ? `.mcp.json#${agentData.agent.name}` : `.claude/${agentData.agent.type}s/${agentData.agent.path}`}"
    category: "${agentData.agent.category}"
    description: "${agentData.agent.description}"
    tasks:${(agentData.subItems && agentData.subItems.length > 0) ? agentData.subItems.map((subItem, j) => `
      - task: ${j + 1}
        type: ${subItem.type}
        name: "${subItem.name}"
        path: "${subItem.type === 'mcp' ? `.mcp.json#${subItem.name}` : `.claude/${subItem.type}s/${subItem.path}`}"
        category: "${subItem.category}"
        description: "${subItem.description}"`).join('') : `
      - task: 1
        type: "default"
        name: "No specific tasks assigned"
        description: "This agent has no specific commands or MCPs assigned"`}`).join('\n')}

execution:
  mode: "hierarchical"
  on_error: "stop"
  sequence: "agent-by-agent"
  
components:
  agents: [${agents.filter(a => a.agent.type === 'agent').map(a => `".claude/agents/${a.agent.path}"`).join(', ')}]
  commands: [${[...agents.filter(a => a.agent.type === 'command').map(a => `".claude/commands/${a.agent.path}"`), ...agents.flatMap(a => (a.subItems || []).filter(s => s.type === 'command').map(s => `".claude/commands/${s.path}`))].join(', ')}]
  mcps: [${[...agents.filter(a => a.agent.type === 'mcp').map(a => `".mcp.json#${a.agent.name}"`), ...agents.flatMap(a => (a.subItems || []).filter(s => s.type === 'mcp').map(s => `".mcp.json#${s.name}`))].join(', ')}]

# Instructions for Claude Code:
# This hierarchical workflow contains ${agents.length} agents with their assigned tasks.
# Each agent should be loaded first, then its associated commands and MCPs should be executed in sequence.`;
    }

    showGenerateModal(commandData, yaml) {
        const { fullCommand, componentsCommand } = commandData;

        const fullCommandEl = document.getElementById('fullCommand');
        const componentsOnlyCommandEl = document.getElementById('componentsOnlyCommand');
        const yamlEl = document.getElementById('yamlContent');
        const workflowFileNameEl = document.getElementById('workflowFileName');
        const modal = document.getElementById('generateModal');

        if (fullCommandEl) fullCommandEl.textContent = fullCommand;
        if (componentsOnlyCommandEl) componentsOnlyCommandEl.textContent = componentsCommand;
        if (yamlEl) yamlEl.textContent = yaml;
        
        // Update workflow file name dynamically
        if (workflowFileNameEl) {
            const workflowName = this.workflowState.properties.name || 'workflow';
            const fileName = `${workflowName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.yaml`;
            workflowFileNameEl.textContent = fileName;
        }
        
        // Show prompt indicator if prompt is provided
        const promptIndicator = document.getElementById('promptIndicator');
        const promptText = document.getElementById('promptText');
        if (promptIndicator && promptText) {
            if (this.workflowState.properties.prompt) {
                promptText.textContent = `"${this.workflowState.properties.prompt}"`;
                promptIndicator.style.display = 'flex';
            } else {
                promptIndicator.style.display = 'none';
            }
        }
        
        if (modal) modal.style.display = 'block';

        // Setup close modal functionality
        const closeModalBtn = document.getElementById('closeModal');
        if (closeModalBtn) {
            closeModalBtn.onclick = () => modal.style.display = 'none';
        }

        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

        // Add copy functionality to the buttons in the modal
        const copyFullCommandBtn = document.getElementById('copyFullCommand');
        if (copyFullCommandBtn) {
            copyFullCommandBtn.onclick = () => copyToClipboard(fullCommand, 'Full command copied!');
        }

        const copyComponentsCommandBtn = document.getElementById('copyComponentsCommand');
        if (copyComponentsCommandBtn) {
            copyComponentsCommandBtn.onclick = () => copyToClipboard(componentsCommand, 'Components command copied!');
        }

        // Original YAML buttons (in accordion)
        const copyYamlBtn = document.getElementById('copyYaml');
        if (copyYamlBtn) {
            copyYamlBtn.onclick = () => copyToClipboard(yamlEl.textContent, 'YAML content copied!');
        }

        const downloadYamlBtn = document.getElementById('downloadYaml');
        if (downloadYamlBtn) {
            downloadYamlBtn.onclick = () => {
                const filename = `${this.workflowState.properties.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'workflow'}.yaml`;
                const blob = new Blob([yaml], { type: 'text/yaml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showNotification('YAML downloaded successfully!', 'success');
            };
        }

        // Manual method YAML buttons
        const copyYamlManualBtn = document.getElementById('copyYamlManual');
        if (copyYamlManualBtn) {
            copyYamlManualBtn.onclick = () => copyToClipboard(yamlEl.textContent, 'YAML content copied!');
        }

        const downloadYamlManualBtn = document.getElementById('downloadYamlManual');
        if (downloadYamlManualBtn) {
            downloadYamlManualBtn.onclick = () => {
                const filename = `${this.workflowState.properties.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'workflow'}.yaml`;
                const blob = new Blob([yaml], { type: 'text/yaml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showNotification('YAML downloaded successfully!', 'success');
            };
        }

        const shareWorkflowBtn = document.getElementById('shareWorkflow');
        if (shareWorkflowBtn) {
            shareWorkflowBtn.onclick = () => {
                // For the new approach, we share the command directly
                navigator.clipboard.writeText(fullCommand).then(() => {
                    showNotification('Installation command copied to clipboard!', 'success');
                }).catch(err => {
                    console.error('Failed to copy command: ', err);
                    showNotification('Failed to copy command', 'error');
                });
            };
        }
    }

    previewWorkflow() {
        const agents = this.workflowState.agents || [];
        if (agents.length === 0) {
            this.showError('Add at least one component to preview the workflow.');
            return;
        }

        // Set default properties if not set
        if (!this.workflowState.properties.name) {
            this.workflowState.properties.name = 'Untitled Workflow';
        }
        if (!this.workflowState.properties.description) {
            this.workflowState.properties.description = 'Generated workflow preview';
        }
        if (!this.workflowState.properties.tags.length) {
            this.workflowState.properties.tags = ['preview'];
        }

        // Generate YAML content
        const yamlContent = this.generateWorkflowYAML();
        
        // Show in modal
        this.showPreviewModal(yamlContent);
    }

    showPreviewModal(yamlContent) {
        const modal = document.getElementById('previewModal');
        const yamlElement = document.getElementById('previewYamlContent');
        const lineNumbersElement = document.getElementById('previewLineNumbers');
        
        if (!modal || !yamlElement || !lineNumbersElement) return;

        // Apply syntax highlighting to YAML content
        const highlightedYaml = this.highlightYaml(yamlContent);
        yamlElement.innerHTML = highlightedYaml;
        yamlElement.className = 'yaml-syntax';
        
        // Generate line numbers
        const lines = yamlContent.split('\n');
        lineNumbersElement.innerHTML = lines.map((_, index) => 
            `<span>${index + 1}</span>`
        ).join('');

        // Show modal
        modal.style.display = 'block';

        // Setup event listeners
        this.setupPreviewModalListeners(yamlContent);
    }

    highlightYaml(yamlContent) {
        return yamlContent
            .split('\n')
            .map(line => this.highlightYamlLine(line))
            .join('\n');
    }

    highlightYamlLine(line) {
        // Handle comments (everything after #)
        if (line.trim().startsWith('#')) {
            return `<span class="yaml-comment">${this.escapeHtml(line)}</span>`;
        }
        
        // Handle lines with comments
        const commentIndex = line.indexOf('#');
        let mainPart = line;
        let commentPart = '';
        
        if (commentIndex > -1) {
            mainPart = line.substring(0, commentIndex);
            commentPart = `<span class="yaml-comment">${this.escapeHtml(line.substring(commentIndex))}</span>`;
        }
        
        // Handle key-value pairs
        const keyValueMatch = mainPart.match(/^(\s*)([\w-]+)(\s*:\s*)(.*)/);
        if (keyValueMatch) {
            const [, indent, key, colon, value] = keyValueMatch;
            
            let highlightedValue = value;
            
            // Highlight different value types
            if (value.trim().match(/^".*"$/)) {
                // String in quotes
                highlightedValue = `<span class="yaml-string">${this.escapeHtml(value)}</span>`;
            } else if (value.trim().match(/^[\d.]+$/)) {
                // Numbers
                highlightedValue = `<span class="yaml-number">${this.escapeHtml(value)}</span>`;
            } else if (value.trim().match(/^(true|false|yes|no|on|off)$/i)) {
                // Booleans
                highlightedValue = `<span class="yaml-boolean">${this.escapeHtml(value)}</span>`;
            } else if (value.trim().match(/^[\w\/-]+\.(md|json|yaml|yml)$/)) {
                // File paths
                highlightedValue = `<span class="yaml-path">${this.escapeHtml(value)}</span>`;
            } else if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
                // Arrays
                highlightedValue = `<span class="yaml-array">${this.escapeHtml(value)}</span>`;
            } else if (value.trim()) {
                // Regular strings
                highlightedValue = `<span class="yaml-string">${this.escapeHtml(value)}</span>`;
            }
            
            return `${this.escapeHtml(indent)}<span class="yaml-key">${this.escapeHtml(key)}</span><span class="yaml-punctuation">${this.escapeHtml(colon)}</span>${highlightedValue}${commentPart}`;
        }
        
        // Handle list items
        const listMatch = mainPart.match(/^(\s*-\s*)(.*)/);
        if (listMatch) {
            const [, listMarker, content] = listMatch;
            
            // Check if it's a key-value in list
            const listKeyValueMatch = content.match(/^([\w-]+)(\s*:\s*)(.*)/);
            if (listKeyValueMatch) {
                const [, key, colon, value] = listKeyValueMatch;
                let highlightedValue = value;
                
                if (value.trim().match(/^".*"$/)) {
                    highlightedValue = `<span class="yaml-string">${this.escapeHtml(value)}</span>`;
                } else if (value.trim().match(/^[\d.]+$/)) {
                    highlightedValue = `<span class="yaml-number">${this.escapeHtml(value)}</span>`;
                } else if (value.trim()) {
                    highlightedValue = `<span class="yaml-string">${this.escapeHtml(value)}</span>`;
                }
                
                return `<span class="yaml-list-item">${this.escapeHtml(listMarker)}</span><span class="yaml-key">${this.escapeHtml(key)}</span><span class="yaml-punctuation">${this.escapeHtml(colon)}</span>${highlightedValue}${commentPart}`;
            } else {
                return `<span class="yaml-list-item">${this.escapeHtml(listMarker)}</span><span class="yaml-string">${this.escapeHtml(content)}</span>${commentPart}`;
            }
        }
        
        // Handle section headers (main keys without indentation)
        const sectionMatch = mainPart.match(/^([\w-]+)(\s*:\s*)(.*)/);
        if (sectionMatch && !mainPart.startsWith(' ')) {
            const [, key, colon, value] = sectionMatch;
            return `<span class="yaml-section">${this.escapeHtml(key)}</span><span class="yaml-punctuation">${this.escapeHtml(colon)}</span><span class="yaml-string">${this.escapeHtml(value)}</span>${commentPart}`;
        }
        
        // Default: return line as is
        return `${this.escapeHtml(mainPart)}${commentPart}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupPreviewModalListeners(yamlContent) {
        // Close modal events
        const closeBtn = document.getElementById('closePreviewModal');
        const closeModalBtn = document.getElementById('closePreviewModalBtn');
        const modal = document.getElementById('previewModal');

        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }
        if (closeModalBtn) {
            closeModalBtn.onclick = () => modal.style.display = 'none';
        }

        // Copy YAML
        const copyBtn = document.getElementById('copyPreviewYaml');
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(yamlContent).then(() => {
                    showNotification('YAML copied to clipboard!', 'success');
                }).catch(() => {
                    showNotification('Failed to copy YAML', 'error');
                });
            };
        }

        // Download YAML
        const downloadBtn = document.getElementById('downloadPreviewYaml');
        if (downloadBtn) {
            downloadBtn.onclick = () => {
                const filename = `${this.workflowState.properties.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'workflow'}-preview.yaml`;
                const blob = new Blob([yamlContent], { type: 'text/yaml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showNotification('YAML downloaded successfully!', 'success');
            };
        }

        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    showError(message) {
        showNotification(message, 'error');
    }
}

// Global functions for workflow events (called from onclick)
function showWorkflowComponentDetails(type, name, path, category) {
    const component = window.dataLoader.findComponent(name, type);
    if (component) {
        showComponentModal(component);
    } else {
        console.warn('Component not found:', type, name);
    }
}

function addComponentFromButton(event) {
    const treeFile = event.target.closest('.tree-file');
    const componentData = { ...treeFile.dataset };
    if (window.workflowManager) {
        window.workflowManager.addWorkflowStep(componentData);
    }
}

function removeWorkflowStep(stepId) {
    if (window.workflowManager) {
        window.workflowManager.workflowState.steps = 
            window.workflowManager.workflowState.steps.filter(step => step.id !== stepId);
        window.workflowManager.renderWorkflowSteps();
        window.workflowManager.updateWorkflowStats();
    }
}

function removeAgent(agentId) {
    if (window.workflowManager && confirm('Remove this agent and all its associated commands/MCPs?')) {
        // Remove from agents array
        window.workflowManager.workflowState.agents = 
            window.workflowManager.workflowState.agents.filter(agentData => agentData.agent.id !== agentId);
        
        // Remove from legacy steps array
        window.workflowManager.workflowState.steps = 
            window.workflowManager.workflowState.steps.filter(step => step.id !== agentId);
        
        window.workflowManager.renderWorkflowSteps();
        window.workflowManager.updateWorkflowStats();
    }
}

function removeSubItem(agentId, subItemId) {
    if (window.workflowManager) {
        const agentIndex = window.workflowManager.workflowState.agents.findIndex(
            agentData => agentData.agent.id === agentId
        );
        if (agentIndex !== -1) {
            window.workflowManager.workflowState.agents[agentIndex].subItems = 
                window.workflowManager.workflowState.agents[agentIndex].subItems.filter(
                    subItem => subItem.id !== subItemId
                );
            
            // Remove from legacy steps array
            window.workflowManager.workflowState.steps = 
                window.workflowManager.workflowState.steps.filter(step => step.id !== subItemId);
            
            window.workflowManager.renderWorkflowSteps();
            window.workflowManager.updateWorkflowStats();
        }
    }
}

// Helper function to scroll to drop zone
function scrollToDropZone() {
    const dropZone = document.querySelector('.drop-zone');
    if (dropZone) {
        dropZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a brief highlight effect
        dropZone.classList.add('drag-over');
        setTimeout(() => {
            dropZone.classList.remove('drag-over');
        }, 1000);
    }
}

// Helper functions for drag and drop
function allowDrop(event) {
    event.preventDefault();
}

function dropOnAgent(event, agentId) {
    event.preventDefault();
    event.stopPropagation(); // Prevent the main drop handler from also firing
    
    // Remove drag-over class
    event.target.classList.remove('drag-over');
    
    try {
        const componentData = JSON.parse(event.dataTransfer.getData('application/json'));
        if (componentData.componentType === 'command' || componentData.componentType === 'mcp') {
            window.workflowManager.addWorkflowStep(componentData, agentId);
        }
    } catch (error) {
        console.error('Error handling agent drop:', error);
    }
}

function dropOnAddItem(event) {
    event.preventDefault();
    event.stopPropagation(); // Prevent the main drop handler from also firing
    
    // Remove drag-over class
    event.target.classList.remove('drag-over');
    event.target.closest('.add-agent-btn')?.classList.remove('drag-over');
    
    try {
        const componentData = JSON.parse(event.dataTransfer.getData('application/json'));
        // Add as main level item (no targetAgentId)
        window.workflowManager.addWorkflowStep(componentData);
    } catch (error) {
        console.error('Error handling add item drop:', error);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.workflowManager = new WorkflowManager();
    window.workflowManager.init();
});