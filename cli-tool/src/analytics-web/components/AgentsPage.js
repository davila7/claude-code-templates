/**
 * AgentsPage - Dedicated page for managing and viewing agent conversations
 * Handles conversation display, filtering, and detailed analysis
 */
class AgentsPage {
  constructor(container, services) {
    this.container = container;
    this.dataService = services.data;
    this.stateService = services.state;
    
    this.components = {};
    this.filters = {
      status: 'all',
      timeRange: '7d',
      search: ''
    };
    this.isInitialized = false;
    
    // Make available globally for mobile sidebar integration
    window.agentsPageInstance = this;
    
    // Initialize header component
    this.headerComponent = null;
    
    // Pagination state for conversations
    this.pagination = {
      currentPage: 0,
      limit: 10,
      hasMore: true,
      isLoading: false
    };
    
    // Pagination state for messages
    this.messagesPagination = {
      currentPage: 0,
      limit: 10,
      hasMore: true,
      isLoading: false,
      conversationId: null
    };
    
    // Loaded conversations cache
    this.loadedConversations = [];
    this.loadedMessages = new Map(); // Cache messages by conversation ID (now stores paginated data)
    
    // Agent data
    this.agents = [];
    this.selectedAgentId = null;
    this.selectedConversationId = null;
    this.selectedConversationContext = null;
    
    // State transition tracking for enhanced user experience
    this.lastMessageTime = new Map(); // Track when last message was received per conversation
    
    // Initialize tool display component
    this.toolDisplay = new ToolDisplay();
    
    // Subscribe to state changes
    this.unsubscribe = this.stateService.subscribe(this.handleStateChange.bind(this));
    
    // Subscribe to DataService events for real-time updates
    this.dataService.addEventListener((type, data) => {
      if (type === 'new_message') {
        console.log('🔄 WebSocket: New message received', { conversationId: data.conversationId });
        this.handleNewMessage(data.conversationId, data.message, data.metadata);
      } else if (type === 'console_interaction') {
        console.log('🔄 WebSocket: Console interaction request received', data);
        this.showConsoleInteraction(data);
      }
    });
  }

  /**
   * Initialize the agents page
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.stateService.setLoading(true);
      await this.render();
      await this.initializeComponents();
      await this.loadAgentsData();
      await this.loadConversationsData();
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing agents page:', error);
      this.stateService.setError(error);
    } finally {
      this.stateService.setLoading(false);
    }
  }

  /**
   * Handle state changes from StateService (WebSocket updates)
   * @param {Object} state - New state
   * @param {string} action - Action that caused the change
   */
  handleStateChange(state, action) {
    switch (action) {
      case 'update_conversations':
        // Don't replace loaded conversations, just update states
        break;
      case 'update_conversation_states':
        console.log('🔄 WebSocket: Conversation states updated', { count: Object.keys(state.conversationStates?.activeStates || state.conversationStates || {}).length });
        
        // Handle both direct states object and nested structure
        const activeStates = state.conversationStates?.activeStates || state.conversationStates || {};
        
        this.updateConversationStates(activeStates);
        break;
      case 'set_loading':
        this.updateLoadingState(state.isLoading);
        break;
      case 'set_error':
        this.updateErrorState(state.error);
        break;
      case 'conversation_state_change':
        this.handleConversationStateChange(state);
        break;
      case 'data_refresh':
        // On real-time data refresh, update conversation states but keep pagination
        this.updateConversationStatesOnly();
        break;
      case 'new_message':
        // Handle new message in real-time
        this.handleNewMessage(state.conversationId, state.message, state.metadata);
        break;
    }
  }
  
  /**
   * Handle new message received via WebSocket
   * @param {string} conversationId - Conversation ID that received new message
   * @param {Object} message - New message object
   * @param {Object} metadata - Additional metadata
   */
  handleNewMessage(conversationId, message, metadata) {
    // Log essential message info for debugging
    console.log('🔄 WebSocket: Processing new message', {
      conversationId,
      role: message?.role,
      hasTools: Array.isArray(message?.content) ? message.content.some(b => b.type === 'tool_use') : false,
      hasToolResults: !!message?.toolResults
    });

    // Always update the message cache for this conversation
    const existingMessages = this.loadedMessages.get(conversationId) || [];
    
    
    // Track message timing for better state transitions
    const now = Date.now();
    this.lastMessageTime.set(conversationId, now);
    
    // IMMEDIATE STATE TRANSITION based on message appearance
    if (this.selectedConversationId === conversationId) {
      if (message?.role === 'user') {
        // User message just appeared - Claude immediately starts working
        console.log('⚡ User message detected - Claude starting work immediately');
        this.updateStateBanner(conversationId, 'Claude Code working...');
      } else if (message?.role === 'assistant') {
        // Assistant message appeared - analyze for specific state
        const intelligentState = this.analyzeMessageForState(message, existingMessages);
        console.log(`🤖 Assistant message detected - state: ${intelligentState}`);
        this.updateStateBanner(conversationId, intelligentState);
        
        // No additional timeout needed - state is determined by message content
      }
    }
    
    // Check if we already have this message (avoid duplicates)
    const messageExists = existingMessages.some(msg => 
      msg.id === message.id || 
      (msg.timestamp === message.timestamp && msg.role === message.role)
    );
    
    if (!messageExists) {
      // Add new message to the end
      const updatedMessages = [...existingMessages, message];
      this.loadedMessages.set(conversationId, updatedMessages);
      
      // Refresh only the conversation states to show updated status/timestamp
      // Don't do full reload as it can interfere with message cache
      this.updateConversationStatesOnly();
      
      // If this conversation is currently selected, update the messages view
      if (this.selectedConversationId === conversationId) {
        // Re-render messages with new message
        this.renderCachedMessages(updatedMessages, false);
        
        // Auto-scroll to new message
        this.scrollToBottom();
      }
      
      // Show notification
      this.showNewMessageNotification(message, metadata);
    }
  }

  /**
   * Update only conversation states without affecting pagination
   */
  async updateConversationStatesOnly() {
    try {
      const statesData = await this.dataService.getConversationStates();
      const activeStates = statesData?.activeStates || {};
      
      // Update StateService with fresh states
      this.stateService.updateConversationStates(activeStates);
      
      // Update states in already loaded conversations
      this.updateConversationStateElements(activeStates);
      
      // Update banner if we have a selected conversation
      if (this.selectedConversationId && activeStates[this.selectedConversationId]) {
        this.updateStateBanner(this.selectedConversationId, activeStates[this.selectedConversationId]);
      }
      
    } catch (error) {
      console.error('Error updating conversation states:', error);
    }
  }

  /**
   * Analyze a message to determine intelligent conversation state
   * @param {Object} message - The message to analyze
   * @param {Array} existingMessages - Previous messages in conversation
   * @returns {string} Intelligent state description
   */
  analyzeMessageForState(message, existingMessages = []) {
    const role = message?.role;
    const content = message?.content;
    const hasToolResults = !!message?.toolResults && message.toolResults.length > 0;
    const messageTime = new Date(message?.timestamp || Date.now());
    const now = new Date();
    const messageAge = (now - messageTime) / 1000; // seconds
    
    if (role === 'assistant') {
      // Analyze assistant messages with enhanced logic
      if (Array.isArray(content)) {
        const hasToolUse = content.some(block => block.type === 'tool_use');
        const hasText = content.some(block => block.type === 'text');
        const textBlocks = content.filter(block => block.type === 'text');
        const toolUseBlocks = content.filter(block => block.type === 'tool_use');
        
        // Enhanced tool execution detection with immediate response
        if (hasToolUse) {
          const toolNames = toolUseBlocks.map(tool => tool.name).join(', ');
          
          if (!hasToolResults) {
            // Tool just sent - immediate execution state
            console.log(`🔧 Tools detected: ${toolNames} - showing execution state`);
            
            if (toolNames.includes('bash') || toolNames.includes('edit') || toolNames.includes('write') || toolNames.includes('multiedit')) {
              return 'Executing tools...';
            } else if (toolNames.includes('read') || toolNames.includes('grep') || toolNames.includes('glob') || toolNames.includes('task')) {
              return 'Analyzing code...';
            } else if (toolNames.includes('webfetch') || toolNames.includes('websearch')) {
              return 'Fetching data...';
            }
            return 'Awaiting tool response...';
          } else {
            // Has tool results - Claude is processing them
            console.log(`📊 Tools completed: ${toolNames} - analyzing results`);
            return 'Analyzing results...';
          }
        }
        
        // Enhanced text analysis
        if (hasText) {
          const textContent = textBlocks.map(block => block.text).join(' ').toLowerCase();
          
          // Working indicators
          if (textContent.includes('let me') || 
              textContent.includes('i\'ll') ||
              textContent.includes('i will') ||
              textContent.includes('i\'m going to') ||
              textContent.includes('let\'s') ||
              textContent.includes('first, i\'ll') ||
              textContent.includes('now i\'ll')) {
            return 'Claude Code working...';
          }
          
          // Analysis indicators
          if (textContent.includes('analyzing') ||
              textContent.includes('examining') ||
              textContent.includes('looking at') ||
              textContent.includes('reviewing')) {
            return 'Analyzing code...';
          }
          
          // Completion indicators
          if (textContent.includes('completed') ||
              textContent.includes('finished') ||
              textContent.includes('done') ||
              textContent.includes('successfully')) {
            return 'Task completed';
          }
          
          // User input needed - enhanced detection
          if (textContent.endsWith('?') || 
              textContent.includes('what would you like') ||
              textContent.includes('how can i help') ||
              textContent.includes('would you like me to') ||
              textContent.includes('should i') ||
              textContent.includes('do you want') ||
              textContent.includes('let me know') ||
              textContent.includes('please let me know') ||
              textContent.includes('what do you think') ||
              textContent.includes('any questions')) {
            return 'Waiting for your response';
          }
          
          // Error/problem indicators
          if (textContent.includes('error') ||
              textContent.includes('failed') ||
              textContent.includes('problem') ||
              textContent.includes('issue')) {
            return 'Encountered issue';
          }
        }
      }
      
      // Recent assistant message suggests waiting for user
      if (messageAge < 300) { // Extended to 5 minutes
        return 'Waiting for your response';
      }
      
      // Default for older assistant messages
      return 'Idle';
      
    } else if (role === 'user') {
      // User just sent a message - Claude should be processing
      if (messageAge < 10) {
        return 'Claude Code working...';
      } else if (messageAge < 60) {
        return 'Awaiting response...';
      }
      
      // Older user messages suggest Claude might be working on something complex
      return 'Processing request...';
    }
    
    // Enhanced timing analysis
    const lastMessage = existingMessages[existingMessages.length - 1];
    if (lastMessage) {
      const timeSinceLastMessage = Date.now() - new Date(lastMessage.timestamp).getTime();
      
      if (timeSinceLastMessage < 30000) { // Less than 30 seconds
        return lastMessage.role === 'user' ? 'Claude Code working...' : 'Recently active';
      } else if (timeSinceLastMessage < 180000) { // Less than 3 minutes
        return 'Idle';
      } else if (timeSinceLastMessage < 1800000) { // Less than 30 minutes
        return 'Waiting for your response';
      }
    }
    
    return 'Inactive';
  }
  

  /**
   * Show console interaction panel for Yes/No prompts
   * @param {Object} interactionData - Interaction data from Claude Code
   */
  showConsoleInteraction(interactionData) {
    const panel = this.container.querySelector('#console-interaction-panel');
    const description = this.container.querySelector('#interaction-description');
    const prompt = this.container.querySelector('#interaction-prompt');
    const choices = this.container.querySelector('#interaction-choices');
    const textInput = this.container.querySelector('#interaction-text-input');
    
    // Show the panel
    panel.style.display = 'block';
    
    // Set up the interaction content
    if (interactionData.description) {
      description.innerHTML = `
        <div class="tool-action">
          <strong>${interactionData.tool || 'Action'}:</strong>
          <div class="tool-details">${interactionData.description}</div>
        </div>
      `;
    }
    
    if (interactionData.prompt) {
      prompt.textContent = interactionData.prompt;
    }
    
    // Handle different interaction types
    if (interactionData.type === 'choice' && interactionData.options) {
      // Show multiple choice options
      choices.style.display = 'block';
      textInput.style.display = 'none';
      
      const choicesHtml = interactionData.options.map((option, index) => `
        <label class="interaction-choice">
          <input type="radio" name="console-choice" value="${index}" ${index === 0 ? 'checked' : ''}>
          <span class="choice-number">${index + 1}.</span>
          <span class="choice-text">${option}</span>
        </label>
      `).join('');
      
      choices.innerHTML = choicesHtml;
      
    } else if (interactionData.type === 'text') {
      // Show text input
      choices.style.display = 'none';
      textInput.style.display = 'block';
      
      const textarea = this.container.querySelector('#console-text-input');
      textarea.focus();
    }
    
    // Store interaction data for submission
    this.currentInteraction = interactionData;
    
    // Bind event listeners
    this.bindInteractionEvents();
  }

  /**
   * Hide console interaction panel
   */
  hideConsoleInteraction() {
    const panel = this.container.querySelector('#console-interaction-panel');
    panel.style.display = 'none';
    this.currentInteraction = null;
  }

  /**
   * Bind event listeners for console interaction
   */
  bindInteractionEvents() {
    const submitBtn = this.container.querySelector('#interaction-submit');
    const cancelBtn = this.container.querySelector('#interaction-cancel');
    
    // Remove existing listeners
    submitBtn.replaceWith(submitBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    
    // Get fresh references
    const newSubmitBtn = this.container.querySelector('#interaction-submit');
    const newCancelBtn = this.container.querySelector('#interaction-cancel');
    
    newSubmitBtn.addEventListener('click', () => this.handleInteractionSubmit());
    newCancelBtn.addEventListener('click', () => this.handleInteractionCancel());
    
    // Handle Enter key for text input
    const textarea = this.container.querySelector('#console-text-input');
    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
          this.handleInteractionSubmit();
        }
      });
    }
  }

  /**
   * Handle interaction submission
   */
  async handleInteractionSubmit() {
    if (!this.currentInteraction) return;
    
    let response;
    
    if (this.currentInteraction.type === 'choice') {
      const selectedChoice = this.container.querySelector('input[name="console-choice"]:checked');
      if (selectedChoice) {
        response = {
          type: 'choice',
          value: parseInt(selectedChoice.value),
          text: this.currentInteraction.options[selectedChoice.value]
        };
      }
    } else if (this.currentInteraction.type === 'text') {
      const textarea = this.container.querySelector('#console-text-input');
      response = {
        type: 'text',
        value: textarea.value.trim()
      };
    }
    
    if (response) {
      // Send response via WebSocket
      try {
        await this.sendConsoleResponse(this.currentInteraction.id, response);
        console.log('🔄 WebSocket: Console interaction response sent', { id: this.currentInteraction.id, response });
        this.hideConsoleInteraction();
      } catch (error) {
        console.error('Error sending console response:', error);
        // Show error in UI
        this.showInteractionError('Failed to send response. Please try again.');
      }
    }
  }

  /**
   * Handle interaction cancellation
   */
  async handleInteractionCancel() {
    if (!this.currentInteraction) return;
    
    try {
      await this.sendConsoleResponse(this.currentInteraction.id, { type: 'cancel' });
      console.log('🔄 WebSocket: Console interaction cancelled', { id: this.currentInteraction.id });
      this.hideConsoleInteraction();
    } catch (error) {
      console.error('Error cancelling console interaction:', error);
      this.hideConsoleInteraction(); // Hide anyway on cancel
    }
  }

  /**
   * Send console response via WebSocket
   * @param {string} interactionId - Interaction ID
   * @param {Object} response - Response data
   */
  async sendConsoleResponse(interactionId, response) {
    // Send through DataService which will route to WebSocket
    if (this.dataService && this.dataService.webSocketService) {
      this.dataService.webSocketService.send({
        type: 'console_response',
        data: {
          interactionId,
          response
        }
      });
    } else {
      throw new Error('WebSocket service not available');
    }
  }

  /**
   * Show error in interaction panel
   * @param {string} message - Error message
   */
  showInteractionError(message) {
    const panel = this.container.querySelector('#console-interaction-panel');
    const existingError = panel.querySelector('.interaction-error');
    
    if (existingError) {
      existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'interaction-error';
    errorDiv.textContent = message;
    
    const content = panel.querySelector('.interaction-content');
    content.insertBefore(errorDiv, content.querySelector('.interaction-actions'));
    
    // Remove error after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 5000);
  }

  
  /**
   * Update conversation state elements in the DOM
   * @param {Object} activeStates - Active conversation states
   */
  updateConversationStateElements(activeStates) {
    const conversationItems = this.container.querySelectorAll('.sidebar-conversation-item');
    
    conversationItems.forEach(item => {
      const conversationId = item.dataset.id;
      const state = activeStates[conversationId] || 'unknown';
      const stateClass = this.getStateClass(state);
      const stateLabel = this.getStateLabel(state);
      
      // Update status dot
      const statusDot = item.querySelector('.status-dot');
      if (statusDot) {
        statusDot.className = `status-dot ${stateClass}`;
      }
      
      // Update status badge
      const statusBadge = item.querySelector('.sidebar-conversation-badge');
      if (statusBadge) {
        statusBadge.className = `sidebar-conversation-badge ${stateClass}`;
        statusBadge.textContent = stateLabel;
      }
    });
  }

  /**
   * Render the agents page structure
   */
  async render() {
    this.container.innerHTML = `
      <div class="agents-page">
        <!-- Mobile Chat Header (only visible on mobile) -->
        <div class="mobile-chat-header-bar" id="mobile-chat-header" style="display: none;">
          <button class="mobile-back-btn" id="mobile-back-btn">←</button>
          <div class="mobile-chat-info">
            <div class="mobile-chat-title" id="mobile-chat-title">Select a conversation</div>
            <div class="mobile-chat-subtitle" id="mobile-chat-subtitle"></div>
          </div>
        </div>
        
        <!-- Page Header (will be replaced by HeaderComponent) -->
        <div id="agents-header-container"></div>

        <!-- Filters Section -->
        <div class="conversations-filters">
          <div class="filters-row">
            <div class="filter-group">
              <label class="filter-label">Status:</label>
              <select class="filter-select" id="status-filter">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label class="filter-label">Time Range:</label>
              <select class="filter-select" id="time-filter">
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d" selected>Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
            
            <div class="filter-group search-group">
              <label class="filter-label">Search:</label>
              <div class="search-input-container">
                <input type="text" class="filter-input search-input" id="search-filter" placeholder="Search conversations, projects, or messages...">
                <button class="search-clear" id="clear-search" title="Clear search">×</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Agents Section - Instagram Stories Style -->
        <div class="agents-section" id="agents-section" style="display: none;">
          <div class="agents-stories-container">
            <div class="agents-stories" id="agents-list">
              <!-- Agent circles will be rendered here -->
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div class="loading-state" id="conversations-loading" style="display: none;">
          <div class="loading-spinner"></div>
          <span class="loading-text">Loading conversations...</span>
        </div>

        <!-- Error State -->
        <div class="error-state" id="conversations-error" style="display: none;">
          <div class="error-content">
            <span class="error-icon">⚠️</span>
            <span class="error-message"></span>
            <button class="error-retry" id="retry-load">Retry</button>
          </div>
        </div>

        <!-- Console Interaction Panel (Hidden by default) -->
        <div id="console-interaction-panel" class="console-interaction-panel" style="display: none;">
          <div class="interaction-header">
            <div class="interaction-title">
              <span class="interaction-icon">⚡</span>
              <span class="interaction-text">Claude Code needs your input</span>
            </div>
            <button class="interaction-close" onclick="this.hideConsoleInteraction()">&times;</button>
          </div>
          
          <div class="interaction-content">
            <div id="interaction-description" class="interaction-description">
              <!-- Tool description will be inserted here -->
            </div>
            
            <div id="interaction-prompt" class="interaction-prompt">
              Do you want to proceed?
            </div>
            
            <!-- Multi-choice options -->
            <div id="interaction-choices" class="interaction-choices" style="display: none;">
              <!-- Radio button choices will be inserted here -->
            </div>
            
            <!-- Text input area -->
            <div id="interaction-text-input" class="interaction-text-input" style="display: none;">
              <label for="console-text-input">Your response:</label>
              <textarea id="console-text-input" placeholder="Type your response here..." rows="4"></textarea>
            </div>
            
            <div class="interaction-actions">
              <button id="interaction-submit" class="interaction-btn primary">Submit</button>
              <button id="interaction-cancel" class="interaction-btn secondary">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Two Column Layout -->
        <div class="conversations-layout">
          <!-- Left Sidebar: Conversations List -->
          <div class="conversations-sidebar">
            <div class="sidebar-header">
              <h3>Chats</h3>
              <span class="conversation-count" id="sidebar-count">0</span>
            </div>
            <div class="conversations-list" id="conversations-list">
              <!-- Conversation items will be rendered here -->
            </div>
            
            <!-- Load More Indicator -->
            <div class="load-more-indicator" id="load-more-indicator" style="display: none;">
              <div class="loading-spinner"></div>
              <span class="loading-text">Loading more conversations...</span>
            </div>
          </div>
          
          <!-- Right Panel: Messages Detail -->
          <div class="messages-panel">
            <div class="messages-header" id="messages-header">
              <div class="selected-conversation-info">
                <h3 id="selected-conversation-title">Select a chat</h3>
                <div class="selected-conversation-meta" id="selected-conversation-meta"></div>
              </div>
              <div class="messages-actions">
                <button class="action-btn-small" id="export-conversation" title="Export conversation">
                  <span class="btn-icon-small">📁</span>
                  Export
                </button>
              </div>
            </div>
            
            <div class="messages-content" id="messages-content">
              <div class="no-conversation-selected">
                <div class="no-selection-icon">💬</div>
                <h4>No conversation selected</h4>
                <p>Choose a conversation from the sidebar to view its messages</p>
              </div>
            </div>
            
            <!-- Message Input Area -->
            <div class="message-input-area" id="message-input-area" style="display: none;">
              <div class="input-container">
                <div class="input-row">
                  <textarea 
                    class="message-input" 
                    id="message-input" 
                    placeholder="Send a message to Claude Code..." 
                    rows="1"
                    maxlength="5000"></textarea>
                  <button class="send-btn" id="send-message-btn" disabled>
                    📤
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Conversation State Banner -->
            <div class="conversation-state-banner" id="conversation-state-banner" style="display: none;">
              <div class="state-indicator">
                <span class="state-dot" id="state-dot"></span>
                <span class="state-text" id="state-text">Ready</span>
              </div>
              <div class="state-timestamp" id="state-timestamp"></div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" id="empty-state" style="display: none;">
          <div class="empty-content">
            <span class="empty-icon">💬</span>
            <h3>No conversations found</h3>
            <p>No agent conversations match your current filters.</p>
            <button class="empty-action" id="clear-filters">Clear Filters</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.setupInfiniteScroll();
    this.initializeHeaderComponent();
  }

  /**
   * Initialize the header component
   */
  initializeHeaderComponent() {
    const headerContainer = this.container.querySelector('#agents-header-container');
    if (headerContainer && typeof HeaderComponent !== 'undefined') {
      this.headerComponent = new HeaderComponent(headerContainer, {
        title: 'Claude Code Chats',
        subtitle: 'Monitor and analyze Claude Code agent interactions in real-time',
        version: 'v1.13.2', // Fallback version
        showVersionBadge: true,
        showLastUpdate: true,
        showThemeSwitch: true,
        showGitHubLink: true,
        dataService: this.dataService // Pass DataService for dynamic version loading
      });
      
      this.headerComponent.render();
    }
  }

  /**
   * Initialize child components
   */
  async initializeComponents() {
    // Initialize ConversationTable for detailed view if available
    const tableContainer = this.container.querySelector('#conversations-table');
    if (tableContainer && typeof ConversationTable !== 'undefined') {
      try {
        this.components.conversationTable = new ConversationTable(
          tableContainer,
          this.dataService,
          this.stateService
        );
        await this.components.conversationTable.initialize();
      } catch (error) {
        console.warn('ConversationTable initialization failed:', error);
        // Show fallback content
        tableContainer.innerHTML = `
          <div class="conversation-table-placeholder">
            <p>Detailed table view not available</p>
          </div>
        `;
      }
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Filter controls
    const statusFilter = this.container.querySelector('#status-filter');
    statusFilter.addEventListener('change', (e) => this.updateFilter('status', e.target.value));

    const timeFilter = this.container.querySelector('#time-filter');
    timeFilter.addEventListener('change', (e) => this.updateFilter('timeRange', e.target.value));

    const searchInput = this.container.querySelector('#search-filter');
    searchInput.addEventListener('input', (e) => this.updateFilter('search', e.target.value));

    const clearSearch = this.container.querySelector('#clear-search');
    clearSearch.addEventListener('click', () => this.clearSearch());

    // Error retry
    const retryBtn = this.container.querySelector('#retry-load');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadConversationsData());
    }

    // Clear filters
    const clearFiltersBtn = this.container.querySelector('#clear-filters');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearAllFilters());
    }


    // Refresh agents
    const refreshAgentsBtn = this.container.querySelector('#refresh-agents');
    if (refreshAgentsBtn) {
      refreshAgentsBtn.addEventListener('click', () => this.refreshAgents());
    }
    
    // Message input handling
    const messageInput = this.container.querySelector('#message-input');
    const sendBtn = this.container.querySelector('#send-message-btn');
    
    if (messageInput && sendBtn) {
      // Auto-resize textarea
      const autoResize = (textarea) => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      };
      
      // Enable/disable send button based on input content
      messageInput.addEventListener('input', (e) => {
        const hasContent = e.target.value.trim().length > 0;
        sendBtn.disabled = !hasContent || !this.selectedConversationId;
        autoResize(e.target);
      });
      
      // Send message on button click
      sendBtn.addEventListener('click', () => this.sendMessage());
      
      // Send message on Enter (Shift+Enter for new line)
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }
    
    // Mobile back button
    const mobileBackBtn = this.container.querySelector('#mobile-back-btn');
    if (mobileBackBtn) {
      mobileBackBtn.addEventListener('click', () => this.handleMobileBack());
    }
  }
  
  /**
   * Setup infinite scroll for conversations list
   */
  setupInfiniteScroll() {
    const conversationsContainer = this.container.querySelector('#conversations-list');
    if (!conversationsContainer) return;
    
    conversationsContainer.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = conversationsContainer;
      const threshold = 100; // Load more when 100px from bottom
      
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        this.loadMoreConversations();
      }
    });
  }
  
  /**
   * Update loading indicator
   * @param {boolean} isLoading - Whether to show loading indicator
   */
  updateLoadingIndicator(isLoading) {
    const loadingIndicator = this.container.querySelector('#load-more-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    }
  }

  /**
   * Load agents data from API
   */
  async loadAgentsData() {
    try {
      const agentsData = await this.dataService.cachedFetch('/api/agents');
      
      if (agentsData && agentsData.agents) {
        this.agents = agentsData.agents;
        this.renderAgents();
      } else {
        this.agents = [];
        this.renderAgents(); // This will hide the section if no agents
      }
      
    } catch (error) {
      console.error('Error loading agents data:', error);
      this.agents = [];
      this.renderAgents(); // This will hide the section if no agents
    }
  }

  /**
   * Render global agents in the agents list (user-level only)
   */
  renderAgents() {
    const agentsList = this.container.querySelector('#agents-list');
    const agentsSection = this.container.querySelector('#agents-section');
    
    if (!agentsList || !agentsSection) return;
    
    // Filter available agents for the current conversation
    const availableAgents = this.agents.filter(agent => agent.level === 'user' || agent.level === 'project');
    
    if (availableAgents.length === 0) {
      // Hide entire agents section when no agents
      agentsSection.style.display = 'none';
      return;
    }
    
    // Show agents section
    agentsSection.style.display = 'block';
    
    // Render agent story items (Instagram-style circles)
    const agentsHTML = availableAgents.map(agent => {
      const avatarText = this.getAvatarText(agent.name);
      const isActive = this.selectedAgentId === agent.name;
      
      return `
        <div class="agent-story-item" data-agent-id="${agent.name}" title="${agent.name} - ${agent.level === 'project' ? 'Project Agent' : 'Global Agent'}">
          <div class="agent-story-avatar ${isActive ? 'active' : ''}" style="background: linear-gradient(135deg, ${agent.color}, #f97316)">
            ${avatarText}
            <div class="agent-story-status"></div>
          </div>
          <span class="agent-story-name">${agent.name}</span>
        </div>
      `;
    }).join('');
    
    agentsList.innerHTML = agentsHTML;
    
    // Bind agent events
    this.bindAgentEvents();
  }

  /**
   * Bind events for agent items
   */
  bindAgentEvents() {
    const agentItems = this.container.querySelectorAll('.agent-story-item');
    
    agentItems.forEach(item => {
      item.addEventListener('click', () => {
        const agentId = item.dataset.agentId;
        this.selectAgent(agentId);
      });
    });
  }

  /**
   * Select an agent (opens modal with details)
   * @param {string} agentId - Agent ID
   */
  selectAgent(agentId) {
    const agent = this.agents.find(a => a.name === agentId);
    if (agent) {
      this.openAgentModal(agent);
    }
  }

  /**
   * Open agent details modal
   * @param {Object} agent - Agent object
   */
  openAgentModal(agent) {
    // If this is a specific tool, open the custom tool modal
    if (agent.isToolDetails) {
      this.openToolModal(agent);
      return;
    }

    const modalHTML = `
      <div class="agent-modal-overlay" id="agent-modal-overlay">
        <div class="agent-modal">
          <div class="agent-modal-header">
            <div class="agent-modal-title">
              <div class="agent-title-main">
                <div class="agent-dot" style="background-color: ${agent.color}"></div>
                <div class="agent-title-info">
                  <h3>${agent.name}</h3>
                  <div class="agent-subtitle">
                    <span class="agent-level-badge ${agent.level}">${agent.level === 'project' ? 'Project Agent' : 'User Agent'}</span>
                    ${agent.projectName ? `<span class="agent-project-name">• ${agent.projectName}</span>` : ''}
                  </div>
                </div>
              </div>
            </div>
            <button class="agent-modal-close" id="agent-modal-close">&times;</button>
          </div>
          
          <div class="agent-modal-content">
            <div class="agent-info-section">
              <h4>Description</h4>
              <p>${agent.description}</p>
            </div>
            
            ${agent.projectName ? `
              <div class="agent-info-section">
                <h4>Project</h4>
                <p>${agent.projectName}</p>
              </div>
            ` : ''}
            
            <div class="agent-info-section">
              <h4>Tools Access</h4>
              <p>${agent.tools && agent.tools.length > 0 
                ? `Has access to: ${agent.tools.join(', ')}` 
                : 'Has access to all available tools'}</p>
            </div>
            
            <div class="agent-info-section">
              <h4>System Prompt</h4>
              <div class="agent-system-prompt">${agent.systemPrompt ? agent.systemPrompt.replace(/\n/g, '<br>') : 'No system prompt available'}</div>
            </div>
            
            <div class="agent-usage-tips">
              <h4>💡 How to Use This Agent</h4>
              <div class="usage-tips-content">
                <p><strong>To invoke this agent explicitly:</strong></p>
                <code class="usage-example">Use the ${agent.name} agent to [describe your request]</code>
                
                <p><strong>Alternative ways to invoke:</strong></p>
                <ul>
                  <li><code>Ask the ${agent.name} agent to [task]</code></li>
                  <li><code>Have the ${agent.name} agent [action]</code></li>
                  <li><code>Let the ${agent.name} agent handle [request]</code></li>
                </ul>
                
                <p><strong>Best practices:</strong></p>
                <ul>
                  <li>Be specific about what you want the agent to do</li>
                  <li>Provide context when needed</li>
                  <li>The agent will automatically use appropriate tools</li>
                </ul>
              </div>
            </div>
            
            <div class="agent-metadata">
              <small><strong>File:</strong> ${agent.filePath}</small><br>
              <small><strong>Last modified:</strong> ${new Date(agent.lastModified).toLocaleString()}</small>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bind close events
    document.getElementById('agent-modal-close').addEventListener('click', () => this.closeAgentModal());
    document.getElementById('agent-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'agent-modal-overlay') {
        this.closeAgentModal();
      }
    });
    
    // ESC key to close - store reference for cleanup
    this.modalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeAgentModal();
      }
    };
    document.addEventListener('keydown', this.modalKeydownHandler);
  }

  /**
   * Open tool-specific modal for any tool
   * @param {Object} toolData - Tool data object
   */
  openToolModal(toolData) {
    switch (toolData.name) {
      case 'Read':
        this.openReadToolModal(toolData);
        break;
      case 'Edit':
        this.openEditToolModal(toolData);
        break;
      case 'Write':
        this.openWriteToolModal(toolData);
        break;
      case 'Bash':
        this.openBashToolModal(toolData);
        break;
      case 'Glob':
        this.openGlobToolModal(toolData);
        break;
      case 'Grep':
        this.openGrepToolModal(toolData);
        break;
      case 'TodoWrite':
        this.openTodoWriteToolModal(toolData);
        break;
      default:
        // Fallback to generic agent modal for unknown tools
        this.openAgentModal({...toolData, isToolDetails: false});
        break;
    }
  }

  /**
   * Open Read tool specific modal
   * @param {Object} readToolData - Read tool data
   */
  openReadToolModal(readToolData) {
    const input = readToolData.input || {};
    const filePath = input.file_path || 'Unknown file';
    const fileName = filePath.split('/').pop() || 'Unknown';
    const fileExtension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'txt';
    const offset = input.offset;
    const limit = input.limit;
    const toolId = readToolData.id || 'unknown';
    
    // Analyze file context for project
    const isConfigFile = ['json', 'yml', 'yaml', 'toml', 'ini', 'conf', 'config'].includes(fileExtension);
    const isDocFile = ['md', 'txt', 'rst', 'adoc'].includes(fileExtension);
    const isCodeFile = ['js', 'ts', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'css', 'html', 'jsx', 'tsx'].includes(fileExtension);
    const isProjectRoot = fileName.toLowerCase().includes('claude') || fileName.toLowerCase().includes('readme') || fileName.toLowerCase().includes('package');
    const isTestFile = fileName.toLowerCase().includes('test') || fileName.toLowerCase().includes('spec');
    
    let fileCategory = '';
    let filePurpose = '';
    let contextIcon = '📄';
    
    if (isProjectRoot) {
      fileCategory = 'Project Documentation';
      filePurpose = 'Understanding project structure and setup';
      contextIcon = '📋';
    } else if (fileName.toLowerCase().includes('claude')) {
      fileCategory = 'Claude Configuration';
      filePurpose = 'Reading project instructions for AI assistant';
      contextIcon = '🤖';
    } else if (isConfigFile) {
      fileCategory = 'Configuration File';
      filePurpose = 'Understanding project settings and dependencies';
      contextIcon = '⚙️';
    } else if (isDocFile) {
      fileCategory = 'Documentation';
      filePurpose = 'Reading project documentation or specifications';
      contextIcon = '📚';
    } else if (isTestFile) {
      fileCategory = 'Test File';
      filePurpose = 'Analyzing test cases and specifications';
      contextIcon = '🧪';
    } else if (isCodeFile) {
      fileCategory = 'Source Code';
      filePurpose = 'Analyzing implementation and logic';
      contextIcon = '💻';
    } else {
      fileCategory = 'Project File';
      filePurpose = 'Reading project-related content';
      contextIcon = '📄';
    }
    
    // Get directory context
    const pathParts = filePath.split('/');
    const projectContext = pathParts.includes('claude-code-templates') ? 'Claude Code Templates Project' : 'Current Project';
    const relativeDir = pathParts.slice(-3, -1).join('/') || 'root';
    
    const modalHTML = `
      <div class="agent-modal-overlay" id="agent-modal-overlay">
        <div class="agent-modal read-tool-modal">
          <div class="agent-modal-header">
            <div class="agent-modal-title">
              <div class="agent-title-main">
                <div class="tool-icon read-tool">
                  <span style="font-size: 20px;">${contextIcon}</span>
                </div>
                <div class="agent-title-info">
                  <h3>File Read: ${fileName}</h3>
                  <div class="agent-subtitle">
                    <span class="tool-type-badge">${fileCategory}</span>
                    <span class="tool-id-badge">ID: ${toolId.slice(-8)}</span>
                  </div>
                </div>
              </div>
            </div>
            <button class="agent-modal-close" id="agent-modal-close">&times;</button>
          </div>
          
          <div class="agent-modal-content">
            <div class="raw-parameters-section primary-section">
              <h4>🔧 Tool Parameters</h4>
              <div class="raw-params-container">
                <pre class="raw-params-json">${JSON.stringify(input, null, 2)}</pre>
              </div>
              <div class="params-summary">
                <span class="param-chip">Tool ID: ${toolId.slice(-8)}</span>
                <span class="param-chip">File: ${fileName}</span>
                ${offset ? `<span class="param-chip">From line: ${offset}</span>` : ''}
                ${limit ? `<span class="param-chip">Lines: ${limit}</span>` : '<span class="param-chip">Complete file</span>'}
              </div>
            </div>

            <div class="read-operation-section">
              <h4>📖 Read Operation Details</h4>
              <div class="operation-details">
                <div class="operation-item">
                  <span class="operation-label">Full Path:</span>
                  <code class="operation-value">${filePath}</code>
                </div>
                ${offset ? `
                  <div class="operation-item">
                    <span class="operation-label">Starting Line:</span>
                    <code class="operation-value">${offset}</code>
                  </div>
                ` : `
                  <div class="operation-item">
                    <span class="operation-label">Read Scope:</span>
                    <code class="operation-value">From beginning</code>
                  </div>
                `}
                ${limit ? `
                  <div class="operation-item">
                    <span class="operation-label">Lines Read:</span>
                    <code class="operation-value">${limit} lines</code>
                  </div>
                ` : `
                  <div class="operation-item">
                    <span class="operation-label">Read Scope:</span>
                    <code class="operation-value">Complete file</code>
                  </div>
                `}
                <div class="operation-item">
                  <span class="operation-label">Tool ID:</span>
                  <code class="operation-value">${toolId}</code>
                </div>
              </div>
            </div>


            <div class="file-insights-section">
              <h4>📊 File Insights</h4>
              <div class="insights-grid">
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">${contextIcon}</span>
                    <span class="insight-title">File Classification</span>
                  </div>
                  <div class="insight-content">${fileCategory}</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">📍</span>
                    <span class="insight-title">Location Context</span>
                  </div>
                  <div class="insight-content">${relativeDir}</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">🎯</span>
                    <span class="insight-title">Read Strategy</span>
                  </div>
                  <div class="insight-content">${offset && limit ? `Partial read (${limit} lines from ${offset})` : limit ? `Limited read (${limit} lines)` : offset ? `From line ${offset}` : 'Complete file'}</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">🚀</span>
                    <span class="insight-title">Project Impact</span>
                  </div>
                  <div class="insight-content">${filePurpose}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bind close events
    document.getElementById('agent-modal-close').addEventListener('click', () => this.closeAgentModal());
    document.getElementById('agent-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'agent-modal-overlay') {
        this.closeAgentModal();
      }
    });
    
    // ESC key to close - store reference for cleanup
    this.modalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeAgentModal();
      }
    };
    document.addEventListener('keydown', this.modalKeydownHandler);
  }

  /**
   * Open Edit tool specific modal
   * @param {Object} editToolData - Edit tool data
   */
  openEditToolModal(editToolData) {
    const input = editToolData.input || {};
    const filePath = input.file_path || 'Unknown file';
    const fileName = filePath.split('/').pop() || 'Unknown';
    const oldString = input.old_string || '';
    const newString = input.new_string || '';
    const replaceAll = input.replace_all || false;
    const toolId = editToolData.id || 'unknown';
    
    const modalHTML = `
      <div class="agent-modal-overlay" id="agent-modal-overlay">
        <div class="agent-modal edit-tool-modal">
          <div class="agent-modal-header">
            <div class="agent-modal-title">
              <div class="agent-title-main">
                <div class="tool-icon edit-tool">
                  <span style="font-size: 20px;">✏️</span>
                </div>
                <div class="agent-title-info">
                  <h3>File Edit: ${fileName}</h3>
                  <div class="agent-subtitle">
                    <span class="tool-type-badge">File Modification</span>
                    <span class="tool-id-badge">ID: ${toolId.slice(-8)}</span>
                  </div>
                </div>
              </div>
            </div>
            <button class="agent-modal-close" id="agent-modal-close">&times;</button>
          </div>
          
          <div class="agent-modal-content">
            <div class="raw-parameters-section primary-section">
              <h4>🔧 Tool Parameters</h4>
              <div class="raw-params-container">
                <pre class="raw-params-json">${JSON.stringify(input, null, 2)}</pre>
              </div>
              <div class="params-summary">
                <span class="param-chip">Tool ID: ${toolId.slice(-8)}</span>
                <span class="param-chip">File: ${fileName}</span>
                <span class="param-chip">Replace All: ${replaceAll ? 'Yes' : 'No'}</span>
                <span class="param-chip">Change Size: ${oldString.length} → ${newString.length} chars</span>
              </div>
            </div>

            <div class="edit-changes-section">
              <div class="diff-header-section">
                <h4>📝 Edit Diff</h4>
                <div class="diff-mode-toggle">
                  <button class="diff-mode-btn active" data-mode="lines" onclick="window.switchDiffMode('lines', this)">
                    <span>📋</span> By Lines
                  </button>
                  <button class="diff-mode-btn" data-mode="compact" onclick="window.switchDiffMode('compact', this)">
                    <span>🔍</span> Smart Diff
                  </button>
                </div>
              </div>
              <div class="diff-container" id="diff-container">
                ${this.generateDiffView(oldString, newString, 'lines')}
              </div>
            </div>


            <div class="file-insights-section">
              <h4>📊 Edit Insights</h4>
              <div class="insights-grid">
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">📄</span>
                    <span class="insight-title">Target File</span>
                  </div>
                  <div class="insight-content">${fileName}</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">📏</span>
                    <span class="insight-title">Content Change</span>
                  </div>
                  <div class="insight-content">${oldString.length > newString.length ? 'Reduced' : oldString.length < newString.length ? 'Expanded' : 'Same'} (${newString.length - oldString.length > 0 ? '+' : ''}${newString.length - oldString.length} chars)</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">🔄</span>
                    <span class="insight-title">Replace Mode</span>
                  </div>
                  <div class="insight-content">${replaceAll ? 'All Occurrences' : 'First Occurrence'}</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">🎯</span>
                    <span class="insight-title">Edit Type</span>
                  </div>
                  <div class="insight-content">${oldString.length === 0 ? 'Addition' : newString.length === 0 ? 'Deletion' : 'Modification'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bind close events
    document.getElementById('agent-modal-close').addEventListener('click', () => this.closeAgentModal());
    document.getElementById('agent-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'agent-modal-overlay') {
        this.closeAgentModal();
      }
    });
    
    // ESC key to close
    this.modalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeAgentModal();
      }
    };
    document.addEventListener('keydown', this.modalKeydownHandler);
    
    // Store the tool data for mode switching
    window.currentEditData = { oldString, newString };
    
    // Add global function for diff mode switching
    const self = this;
    window.switchDiffMode = function(mode, button) {
      // Update button states
      document.querySelectorAll('.diff-mode-btn').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update diff content
      const container = document.getElementById('diff-container');
      if (container && window.currentEditData) {
        container.innerHTML = self.generateDiffView(
          window.currentEditData.oldString, 
          window.currentEditData.newString, 
          mode
        );
      }
    };
  }

  /**
   * Generate diff view for edit changes
   * @param {string} oldText - Original text
   * @param {string} newText - New text
   * @param {string} mode - 'lines' or 'compact'
   * @returns {string} HTML diff view
   */
  generateDiffView(oldText, newText, mode = 'lines') {
    if (mode === 'compact') {
      return this.generateSmartDiff(oldText, newText);
    }
    
    // Split text into lines for better diff visualization
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    
    // Limit lines for display (show first 20 lines max)
    const maxLines = 20;
    const oldDisplay = oldLines.slice(0, maxLines);
    const newDisplay = newLines.slice(0, maxLines);
    const oldTruncated = oldLines.length > maxLines;
    const newTruncated = newLines.length > maxLines;
    
    let diffHtml = '<div class="diff-editor">';
    
    // Header with file info
    diffHtml += `
      <div class="diff-header">
        <span class="diff-stats">-${oldLines.length} lines, +${newLines.length} lines</span>
      </div>
    `;
    
    // Old text (removed lines)
    if (oldDisplay.length > 0) {
      diffHtml += '<div class="diff-section removed">';
      oldDisplay.forEach((line) => {
        diffHtml += `
          <div class="diff-line removed-line">
            <span class="line-prefix">-</span>
            <span class="line-content">${this.escapeHtml(line) || ' '}</span>
          </div>
        `;
      });
      if (oldTruncated) {
        diffHtml += `
          <div class="diff-line truncated">
            <span class="line-prefix"></span>
            <span class="line-content">... ${oldLines.length - maxLines} more lines ...</span>
          </div>
        `;
      }
      diffHtml += '</div>';
    }
    
    // New text (added lines)
    if (newDisplay.length > 0) {
      diffHtml += '<div class="diff-section added">';
      newDisplay.forEach((line) => {
        diffHtml += `
          <div class="diff-line added-line">
            <span class="line-prefix">+</span>
            <span class="line-content">${this.escapeHtml(line) || ' '}</span>
          </div>
        `;
      });
      if (newTruncated) {
        diffHtml += `
          <div class="diff-line truncated">
            <span class="line-prefix"></span>
            <span class="line-content">... ${newLines.length - maxLines} more lines ...</span>
          </div>
        `;
      }
      diffHtml += '</div>';
    }
    
    diffHtml += '</div>';
    
    return diffHtml;
  }

  /**
   * Generate smart diff that shows only changed sections
   * @param {string} oldText - Original text
   * @param {string} newText - New text
   * @returns {string} HTML smart diff view
   */
  generateSmartDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    
    // Find differences using simple line-by-line comparison
    const changes = this.findLineChanges(oldLines, newLines);
    
    let diffHtml = '<div class="diff-editor smart-diff">';
    
    // Header with file info
    diffHtml += `
      <div class="diff-header">
        <span class="diff-stats">Smart diff showing ${changes.length} change block${changes.length !== 1 ? 's' : ''}</span>
      </div>
    `;
    
    if (changes.length === 0) {
      diffHtml += `
        <div class="no-changes">
          <span class="no-changes-text">No line-level changes detected (whitespace or formatting only)</span>
        </div>
      `;
    } else {
      changes.forEach((change, index) => {
        diffHtml += `<div class="change-block" data-change-index="${index}">`;
        
        // Show removed lines
        if (change.removed.length > 0) {
          change.removed.forEach(line => {
            diffHtml += `
              <div class="diff-line removed-line smart">
                <span class="line-prefix">-</span>
                <span class="line-content">${this.escapeHtml(line) || ' '}</span>
              </div>
            `;
          });
        }
        
        // Show added lines
        if (change.added.length > 0) {
          change.added.forEach(line => {
            diffHtml += `
              <div class="diff-line added-line smart">
                <span class="line-prefix">+</span>
                <span class="line-content">${this.escapeHtml(line) || ' '}</span>
              </div>
            `;
          });
        }
        
        diffHtml += '</div>';
        
        // Add separator between change blocks (except for the last one)
        if (index < changes.length - 1) {
          diffHtml += '<div class="change-separator">⋯</div>';
        }
      });
    }
    
    diffHtml += '</div>';
    
    return diffHtml;
  }

  /**
   * Find line changes between old and new text
   * @param {string[]} oldLines - Original lines
   * @param {string[]} newLines - New lines
   * @returns {Array} Array of change blocks
   */
  findLineChanges(oldLines, newLines) {
    const changes = [];
    
    // Simple approach: if texts are different, show both
    // This can be enhanced with more sophisticated diff algorithms
    if (oldLines.join('\n') !== newLines.join('\n')) {
      // For now, treat as one big change block
      // This could be enhanced to find actual line-by-line differences
      changes.push({
        removed: oldLines.slice(0, 10), // Limit to first 10 lines
        added: newLines.slice(0, 10)    // Limit to first 10 lines
      });
    }
    
    return changes;
  }

  /**
   * Open Write tool specific modal
   * @param {Object} writeToolData - Write tool data
   */
  openWriteToolModal(writeToolData) {
    const input = writeToolData.input || {};
    const filePath = input.file_path || 'Unknown file';
    const fileName = filePath.split('/').pop() || 'Unknown';
    const fileExtension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'txt';
    const content = input.content || '';
    const toolId = writeToolData.id || 'unknown';
    
    // Analyze file context
    const isConfigFile = ['json', 'yml', 'yaml', 'toml', 'ini', 'conf', 'config'].includes(fileExtension);
    const isDocFile = ['md', 'txt', 'rst', 'adoc'].includes(fileExtension);
    const isCodeFile = ['js', 'ts', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'css', 'html', 'jsx', 'tsx'].includes(fileExtension);
    const isProjectRoot = fileName.toLowerCase().includes('claude') || fileName.toLowerCase().includes('readme') || fileName.toLowerCase().includes('package');
    
    let fileCategory = '';
    let contextIcon = '📝';
    
    if (isProjectRoot) {
      fileCategory = 'Project Documentation';
      contextIcon = '📋';
    } else if (fileName.toLowerCase().includes('claude')) {
      fileCategory = 'Claude Configuration';
      contextIcon = '🤖';
    } else if (isConfigFile) {
      fileCategory = 'Configuration File';
      contextIcon = '⚙️';
    } else if (isDocFile) {
      fileCategory = 'Documentation';
      contextIcon = '📚';
    } else if (isCodeFile) {
      fileCategory = 'Source Code';
      contextIcon = '💻';
    } else {
      fileCategory = 'Project File';
      contextIcon = '📝';
    }
    
    const modalHTML = `
      <div class="agent-modal-overlay" id="agent-modal-overlay">
        <div class="agent-modal write-tool-modal">
          <div class="agent-modal-header">
            <div class="agent-modal-title">
              <div class="agent-title-main">
                <div class="tool-icon write-tool">
                  <span style="font-size: 20px;">${contextIcon}</span>
                </div>
                <div class="agent-title-info">
                  <h3>File Creation: ${fileName}</h3>
                  <div class="agent-subtitle">
                    <span class="tool-type-badge">${fileCategory}</span>
                    <span class="tool-id-badge">ID: ${toolId.slice(-8)}</span>
                  </div>
                </div>
              </div>
            </div>
            <button class="agent-modal-close" id="agent-modal-close">&times;</button>
          </div>
          
          <div class="agent-modal-content">
            <div class="raw-parameters-section primary-section">
              <h4>🔧 Tool Parameters</h4>
              <div class="raw-params-container">
                <pre class="raw-params-json">${JSON.stringify(input, null, 2)}</pre>
              </div>
              <div class="params-summary">
                <span class="param-chip">Tool ID: ${toolId.slice(-8)}</span>
                <span class="param-chip">File: ${fileName}</span>
                <span class="param-chip">Size: ${content.length} characters</span>
                <span class="param-chip">Type: ${fileExtension.toUpperCase()}</span>
              </div>
            </div>

            <div class="file-content-section">
              <div class="content-header-section">
                <h4>📄 File Content Preview</h4>
                <div class="content-stats">
                  <span class="content-stat">${content.split('\\n').length} lines</span>
                  <span class="content-stat">${content.length} chars</span>
                  <span class="content-stat">${Math.round(content.length / 1024 * 100) / 100} KB</span>
                </div>
              </div>
              <div class="content-preview-container">
                <pre class="content-preview">${this.escapeHtml(content.substring(0, 1000))}${content.length > 1000 ? '\\n\\n... [truncated, showing first 1000 characters]' : ''}</pre>
              </div>
            </div>


            <div class="file-insights-section">
              <h4>📊 Creation Insights</h4>
              <div class="insights-grid">
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">${contextIcon}</span>
                    <span class="insight-title">File Type</span>
                  </div>
                  <div class="insight-content">${fileCategory}</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">📏</span>
                    <span class="insight-title">Content Size</span>
                  </div>
                  <div class="insight-content">${content.length} characters</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">📊</span>
                    <span class="insight-title">Structure</span>
                  </div>
                  <div class="insight-content">${content.split('\\n').length} lines</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">🚀</span>
                    <span class="insight-title">Purpose</span>
                  </div>
                  <div class="insight-content">${content.length === 0 ? 'Empty file' : content.length < 100 ? 'Simple file' : content.length < 1000 ? 'Medium file' : 'Large file'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bind close events
    document.getElementById('agent-modal-close').addEventListener('click', () => this.closeAgentModal());
    document.getElementById('agent-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'agent-modal-overlay') {
        this.closeAgentModal();
      }
    });
    
    // ESC key to close
    this.modalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeAgentModal();
      }
    };
    document.addEventListener('keydown', this.modalKeydownHandler);
  }

  /**
   * Open Glob tool specific modal
   * @param {Object} globToolData - Glob tool data
   */
  openGlobToolModal(globToolData) {
    console.log('🔍 Opening Glob tool modal with data:', globToolData);
    
    if (!globToolData || !globToolData.input) {
      console.warn('⚠️ Glob tool data missing or invalid');
      return;
    }

    // Extract Glob parameters
    const pattern = globToolData.input.pattern || '';
    const searchPath = globToolData.input.path || '(current directory)';
    
    // Categorize glob pattern
    let patternType = 'General';
    let patternDescription = 'File pattern search';
    
    if (pattern.includes('**')) {
      patternType = 'Recursive';
      patternDescription = 'Deep directory search with recursive matching';
    } else if (pattern.includes('*')) {
      patternType = 'Wildcard';
      patternDescription = 'Basic wildcard pattern matching';
    } else if (pattern.includes('.')) {
      patternType = 'Extension';
      patternDescription = 'File extension filtering';
    } else if (pattern.includes('/')) {
      patternType = 'Path-based';
      patternDescription = 'Directory structure pattern';
    }

    // Detect pattern specifics
    const isJavaScript = pattern.includes('.js') || pattern.includes('.ts') || pattern.includes('.jsx') || pattern.includes('.tsx');
    const isStyles = pattern.includes('.css') || pattern.includes('.scss') || pattern.includes('.sass');
    const isMarkdown = pattern.includes('.md') || pattern.includes('.mdx');
    const isConfig = pattern.includes('config') || pattern.includes('.json') || pattern.includes('.yml') || pattern.includes('.yaml');
    
    let projectContext = '';
    if (isJavaScript) projectContext = 'JavaScript/TypeScript files';
    else if (isStyles) projectContext = 'Stylesheet files';
    else if (isMarkdown) projectContext = 'Documentation files';
    else if (isConfig) projectContext = 'Configuration files';
    else projectContext = 'General file search';

    const modalContent = `
      <div class="agent-modal-header">
        <div class="agent-modal-title">
          <div class="agent-title-main">
            <div class="tool-icon glob-tool">
              <span style="font-size: 20px;">🔍</span>
            </div>
            <div class="agent-title-info">
              <h3>Glob Pattern: ${this.escapeHtml(pattern)}</h3>
              <div class="agent-subtitle">
                <span class="tool-type-badge">${patternType}</span>
                <span class="tool-id-badge">ID: ${globToolData.id ? globToolData.id.slice(-8) : 'unknown'}</span>
              </div>
            </div>
          </div>
        </div>
        <button class="agent-modal-close" id="agent-modal-close">&times;</button>
      </div>
      
      <div class="agent-modal-content">
        <!-- Primary Section: Tool Parameters -->
        <div class="raw-parameters-section primary-section">
          <h4>🔧 Tool Parameters</h4>
          <div class="raw-params-container">
            <pre class="raw-params-json">${this.escapeHtml(JSON.stringify(globToolData.input, null, 2))}</pre>
          </div>
        </div>

        <!-- Pattern Analysis -->
        <div class="glob-pattern-section">
          <h4>🎯 Pattern Analysis</h4>
          <div class="tool-details-grid">
            <div class="tool-detail-item">
              <span class="tool-detail-label">Search Pattern:</span>
              <span class="tool-detail-value pattern-display">${this.escapeHtml(pattern)}</span>
            </div>
            <div class="tool-detail-item">
              <span class="tool-detail-label">Pattern Type:</span>
              <span class="tool-detail-value">${patternType}</span>
            </div>
            <div class="tool-detail-item">
              <span class="tool-detail-label">Description:</span>
              <span class="tool-detail-value">${patternDescription}</span>
            </div>
            <div class="tool-detail-item">
              <span class="tool-detail-label">Search Location:</span>
              <span class="tool-detail-value">${this.escapeHtml(searchPath)}</span>
            </div>
            <div class="tool-detail-item">
              <span class="tool-detail-label">Target Files:</span>
              <span class="tool-detail-value">${projectContext}</span>
            </div>
          </div>
        </div>

        <!-- Pattern Breakdown -->
        <div class="glob-components-section">
          <h4>🧩 Pattern Components</h4>
          <div class="pattern-breakdown">
            ${this.analyzeGlobPattern(pattern)}
          </div>
        </div>

        <!-- File Discovery Insights -->
        <div class="glob-insights-section">
          <h4>📊 Discovery Insights</h4>
          <div class="tool-insights">
            <div class="insight-item">
              <span class="insight-label">Scope:</span>
              <span class="insight-value">${pattern.includes('**') ? 'Recursive (all subdirectories)' : 'Current level only'}</span>
            </div>
            <div class="insight-item">
              <span class="insight-label">Efficiency:</span>
              <span class="insight-value">${pattern.length > 20 ? 'Complex pattern (slower)' : 'Simple pattern (fast)'}</span>
            </div>
            <div class="insight-item">
              <span class="insight-label">Match Strategy:</span>
              <span class="insight-value">${pattern.includes('*') ? 'Wildcard matching' : 'Exact pattern'}</span>
            </div>
            <div class="insight-item">
              <span class="insight-label">File Context:</span>
              <span class="insight-value">${projectContext}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const modalHTML = `
      <div class="agent-modal-overlay" id="agent-modal-overlay">
        <div class="agent-modal glob-tool-modal">
          ${modalContent}
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bind close events
    document.getElementById('agent-modal-close').addEventListener('click', () => this.closeAgentModal());
    document.getElementById('agent-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'agent-modal-overlay') {
        this.closeAgentModal();
      }
    });
    
    // ESC key to close - store reference for cleanup
    this.modalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeAgentModal();
      }
    };
    document.addEventListener('keydown', this.modalKeydownHandler);
  }

  /**
   * Analyze glob pattern components
   * @param {string} pattern - Glob pattern to analyze
   * @returns {string} HTML breakdown of pattern
   */
  analyzeGlobPattern(pattern) {
    if (!pattern) return '<span class="pattern-empty">No pattern specified</span>';
    
    const components = [];
    const parts = pattern.split('/');
    
    parts.forEach((part, index) => {
      let description = '';
      let type = 'literal';
      
      if (part === '**') {
        description = 'Recursive directory wildcard (matches any nested path)';
        type = 'recursive';
      } else if (part.includes('*')) {
        if (part === '*') {
          description = 'Match any single directory or filename';
          type = 'wildcard';
        } else if (part.startsWith('*.')) {
          description = `Match files with ${part.substring(2)} extension`;
          type = 'extension';
        } else {
          description = 'Partial wildcard match';
          type = 'partial-wildcard';
        }
      } else if (part.includes('?')) {
        description = 'Single character wildcard';
        type = 'char-wildcard';
      } else if (part.includes('[') && part.includes(']')) {
        description = 'Character class match';
        type = 'char-class';
      } else if (part) {
        description = 'Literal directory/filename';
        type = 'literal';
      }
      
      if (part) {
        components.push(`
          <div class="pattern-component ${type}">
            <code class="pattern-part">${this.escapeHtml(part)}</code>
            <span class="pattern-desc">${description}</span>
          </div>
        `);
      }
    });
    
    return components.length > 0 ? components.join('') : '<span class="pattern-empty">Empty pattern</span>';
  }

  /**
   * Open Grep tool specific modal
   * @param {Object} grepToolData - Grep tool data
   */
  openGrepToolModal(grepToolData) {
    console.log('🔍 Opening Grep tool modal with data:', grepToolData);
    
    if (!grepToolData || !grepToolData.input) {
      console.warn('⚠️ Grep tool data missing or invalid');
      return;
    }

    // Extract Grep parameters
    const pattern = grepToolData.input.pattern || '';
    const searchPath = grepToolData.input.path || '(current directory)';
    const outputMode = grepToolData.input.output_mode || 'files_with_matches';
    const glob = grepToolData.input.glob || '';
    const type = grepToolData.input.type || '';
    const caseInsensitive = grepToolData.input['-i'] || false;
    const contextBefore = grepToolData.input['-B'] || 0;
    const contextAfter = grepToolData.input['-A'] || 0;
    const contextAround = grepToolData.input['-C'] || 0;
    const showLineNumbers = grepToolData.input['-n'] || false;
    const multiline = grepToolData.input.multiline || false;
    
    // Analyze search pattern
    let patternType = 'Literal';
    let patternComplexity = 'Simple';
    let searchScope = 'Text content';
    
    // Detect regex patterns
    if (pattern.includes('.*') || pattern.includes('.+') || pattern.includes('\\w') || pattern.includes('\\d')) {
      patternType = 'Regular Expression';
      patternComplexity = 'Complex';
    } else if (pattern.includes('*') || pattern.includes('?') || pattern.includes('[') || pattern.includes(']')) {
      patternType = 'Wildcard Pattern';
      patternComplexity = 'Moderate';
    }
    
    // Detect specific search types
    if (pattern.includes('function') || pattern.includes('class') || pattern.includes('import')) {
      searchScope = 'Code structure';
    } else if (pattern.includes('TODO') || pattern.includes('FIXME') || pattern.includes('NOTE')) {
      searchScope = 'Code comments';
    } else if (pattern.includes('error') || pattern.includes('Error') || pattern.includes('exception')) {
      searchScope = 'Error handling';
    } else if (pattern.includes('test') || pattern.includes('spec') || pattern.includes('describe')) {
      searchScope = 'Test code';
    }
    
    // File type analysis
    let fileContext = 'All files';
    if (type) {
      switch (type) {
        case 'js': fileContext = 'JavaScript files'; break;
        case 'ts': fileContext = 'TypeScript files'; break;
        case 'py': fileContext = 'Python files'; break;
        case 'go': fileContext = 'Go files'; break;
        case 'rust': fileContext = 'Rust files'; break;
        case 'java': fileContext = 'Java files'; break;
        case 'css': fileContext = 'CSS files'; break;
        case 'html': fileContext = 'HTML files'; break;
        case 'md': fileContext = 'Markdown files'; break;
        default: fileContext = `${type} files`; break;
      }
    } else if (glob) {
      if (glob.includes('*.js') || glob.includes('*.ts')) fileContext = 'JavaScript/TypeScript files';
      else if (glob.includes('*.py')) fileContext = 'Python files';
      else if (glob.includes('*.md')) fileContext = 'Documentation files';
      else if (glob.includes('*.css') || glob.includes('*.scss')) fileContext = 'Stylesheet files';
      else fileContext = `Files matching "${glob}"`;
    }

    const modalContent = `
      <div class="agent-modal-header">
        <div class="agent-modal-title">
          <div class="agent-title-main">
            <div class="tool-icon grep-tool">
              <span style="font-size: 20px;">🔍</span>
            </div>
            <div class="agent-title-info">
              <h3>Grep Search: ${this.escapeHtml(pattern)}</h3>
              <div class="agent-subtitle">
                <span class="tool-type-badge">${patternType}</span>
                <span class="tool-id-badge">ID: ${grepToolData.id ? grepToolData.id.slice(-8) : 'unknown'}</span>
              </div>
            </div>
          </div>
        </div>
        <button class="agent-modal-close" id="agent-modal-close">&times;</button>
      </div>
      
      <div class="agent-modal-content">
        <!-- Primary Section: Tool Parameters -->
        <div class="raw-parameters-section primary-section">
          <h4>🔧 Tool Parameters</h4>
          <div class="raw-params-container">
            <pre class="raw-params-json">${this.escapeHtml(JSON.stringify(grepToolData.input, null, 2))}</pre>
          </div>
        </div>

        <!-- Search Configuration -->
        <div class="grep-config-section">
          <h4>🎯 Search Configuration</h4>
          <div class="tool-details-grid">
            <div class="tool-detail-item">
              <span class="tool-detail-label">Search Pattern:</span>
              <span class="tool-detail-value search-pattern">${this.escapeHtml(pattern)}</span>
            </div>
            <div class="tool-detail-item">
              <span class="tool-detail-label">Pattern Type:</span>
              <span class="tool-detail-value">${patternType}</span>
            </div>
            <div class="tool-detail-item">
              <span class="tool-detail-label">Complexity:</span>
              <span class="tool-detail-value">${patternComplexity}</span>
            </div>
            <div class="tool-detail-item">
              <span class="tool-detail-label">Search Location:</span>
              <span class="tool-detail-value">${this.escapeHtml(searchPath)}</span>
            </div>
            <div class="tool-detail-item">
              <span class="tool-detail-label">Target Files:</span>
              <span class="tool-detail-value">${fileContext}</span>
            </div>
            <div class="tool-detail-item">
              <span class="tool-detail-label">Output Mode:</span>
              <span class="tool-detail-value">${outputMode.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        <!-- Search Options -->
        <div class="grep-options-section">
          <h4>⚙️ Search Options</h4>
          <div class="search-options">
            ${this.generateGrepOptionsDisplay(grepToolData.input)}
          </div>
        </div>

        <!-- Pattern Analysis -->
        <div class="grep-pattern-section">
          <h4>🧩 Pattern Analysis</h4>
          <div class="pattern-analysis">
            ${this.analyzeGrepPattern(pattern)}
          </div>
        </div>

        <!-- Search Insights -->
        <div class="grep-insights-section">
          <h4>📊 Search Insights</h4>
          <div class="tool-insights">
            <div class="insight-item">
              <span class="insight-label">Search Scope:</span>
              <span class="insight-value">${searchScope}</span>
            </div>
            <div class="insight-item">
              <span class="insight-label">Case Sensitivity:</span>
              <span class="insight-value">${caseInsensitive ? 'Case insensitive' : 'Case sensitive'}</span>
            </div>
            <div class="insight-item">
              <span class="insight-label">Multiline Mode:</span>
              <span class="insight-value">${multiline ? 'Enabled (cross-line patterns)' : 'Disabled (single-line only)'}</span>
            </div>
            <div class="insight-item">
              <span class="insight-label">Context Lines:</span>
              <span class="insight-value">${contextAround > 0 ? `${contextAround} lines around` : contextBefore > 0 || contextAfter > 0 ? `${contextBefore} before, ${contextAfter} after` : 'None'}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const modalHTML = `
      <div class="agent-modal-overlay" id="agent-modal-overlay">
        <div class="agent-modal grep-tool-modal">
          ${modalContent}
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bind close events
    document.getElementById('agent-modal-close').addEventListener('click', () => this.closeAgentModal());
    document.getElementById('agent-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'agent-modal-overlay') {
        this.closeAgentModal();
      }
    });
    
    // ESC key to close - store reference for cleanup
    this.modalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeAgentModal();
      }
    };
    document.addEventListener('keydown', this.modalKeydownHandler);
  }

  /**
   * Generate Grep options display
   * @param {Object} input - Grep input parameters
   * @returns {string} HTML for options display
   */
  generateGrepOptionsDisplay(input) {
    const options = [];
    
    if (input['-i']) options.push({ name: 'Case Insensitive (-i)', status: 'enabled', desc: 'Ignore case when matching' });
    if (input['-n']) options.push({ name: 'Line Numbers (-n)', status: 'enabled', desc: 'Show line numbers in output' });
    if (input.multiline) options.push({ name: 'Multiline Mode', status: 'enabled', desc: 'Allow patterns to span multiple lines' });
    if (input['-A']) options.push({ name: `After Context (-A ${input['-A']})`, status: 'enabled', desc: `Show ${input['-A']} lines after matches` });
    if (input['-B']) options.push({ name: `Before Context (-B ${input['-B']})`, status: 'enabled', desc: `Show ${input['-B']} lines before matches` });
    if (input['-C']) options.push({ name: `Around Context (-C ${input['-C']})`, status: 'enabled', desc: `Show ${input['-C']} lines around matches` });
    if (input.glob) options.push({ name: `File Filter (--glob)`, status: 'enabled', desc: `Only search files matching "${input.glob}"` });
    if (input.type) options.push({ name: `File Type (--type)`, status: 'enabled', desc: `Only search ${input.type} files` });
    if (input.head_limit) options.push({ name: `Result Limit`, status: 'enabled', desc: `Limit to first ${input.head_limit} results` });
    
    if (options.length === 0) {
      return '<div class="no-options">Using default search options</div>';
    }
    
    return options.map(option => `
      <div class="search-option ${option.status}">
        <div class="option-header">
          <span class="option-name">${option.name}</span>
          <span class="option-status ${option.status}">${option.status}</span>
        </div>
        <div class="option-desc">${option.desc}</div>
      </div>
    `).join('');
  }

  /**
   * Analyze grep pattern components
   * @param {string} pattern - Grep pattern to analyze
   * @returns {string} HTML breakdown of pattern
   */
  analyzeGrepPattern(pattern) {
    if (!pattern) return '<div class="pattern-empty">No pattern specified</div>';
    
    const analysis = [];
    
    // Detect regex components
    if (pattern.includes('.*')) {
      analysis.push({ component: '.*', desc: 'Match any characters (zero or more)', type: 'regex' });
    }
    if (pattern.includes('.+')) {
      analysis.push({ component: '.+', desc: 'Match any characters (one or more)', type: 'regex' });
    }
    if (pattern.includes('\\w')) {
      analysis.push({ component: '\\w', desc: 'Match word characters (letters, digits, underscore)', type: 'regex' });
    }
    if (pattern.includes('\\d')) {
      analysis.push({ component: '\\d', desc: 'Match digit characters (0-9)', type: 'regex' });
    }
    if (pattern.includes('\\s')) {
      analysis.push({ component: '\\s', desc: 'Match whitespace characters', type: 'regex' });
    }
    if (pattern.includes('^')) {
      analysis.push({ component: '^', desc: 'Match start of line', type: 'anchor' });
    }
    if (pattern.includes('$')) {
      analysis.push({ component: '$', desc: 'Match end of line', type: 'anchor' });
    }
    if (pattern.includes('|')) {
      analysis.push({ component: '|', desc: 'Logical OR (alternative patterns)', type: 'operator' });
    }
    
    // Detect character classes
    const charClassMatch = pattern.match(/\[([^\]]+)\]/g);
    if (charClassMatch) {
      charClassMatch.forEach(match => {
        analysis.push({ component: match, desc: `Match any character in the set: ${match}`, type: 'charclass' });
      });
    }
    
    // Detect groups
    const groupMatch = pattern.match(/\(([^)]+)\)/g);
    if (groupMatch) {
      groupMatch.forEach(match => {
        analysis.push({ component: match, desc: `Capture group: ${match}`, type: 'group' });
      });
    }
    
    if (analysis.length === 0) {
      return '<div class="pattern-simple">Simple literal text search</div>';
    }
    
    return analysis.map(item => `
      <div class="pattern-component ${item.type}">
        <code class="pattern-part">${this.escapeHtml(item.component)}</code>
        <span class="pattern-desc">${item.desc}</span>
      </div>
    `).join('');
  }

  /**
   * Open TodoWrite tool specific modal
   * @param {Object} todoToolData - TodoWrite tool data
   */
  openTodoWriteToolModal(todoToolData) {
    console.log('📝 Opening TodoWrite tool modal with data:', todoToolData);
    
    if (!todoToolData || !todoToolData.input) {
      console.warn('⚠️ TodoWrite tool data missing or invalid');
      return;
    }

    // Extract TodoWrite parameters
    const todos = todoToolData.input.todos || [];
    const todoCount = todos.length;
    
    // Analyze todos
    const statusCounts = {
      pending: 0,
      in_progress: 0,
      completed: 0
    };
    
    const priorityCounts = {
      high: 0,
      medium: 0,
      low: 0
    };
    
    todos.forEach(todo => {
      if (statusCounts.hasOwnProperty(todo.status)) {
        statusCounts[todo.status]++;
      }
      if (priorityCounts.hasOwnProperty(todo.priority)) {
        priorityCounts[todo.priority]++;
      }
    });
    
    // Calculate completion rate
    const completionRate = todoCount > 0 ? Math.round((statusCounts.completed / todoCount) * 100) : 0;
    
    // Find longest and shortest todos
    const todoLengths = todos.map(todo => todo.content.length);
    const avgLength = todoLengths.length > 0 ? Math.round(todoLengths.reduce((a, b) => a + b, 0) / todoLengths.length) : 0;

    const modalContent = `
      <div class="agent-modal-header">
        <div class="agent-modal-title">
          <div class="agent-title-main">
            <div class="tool-icon todo-tool">
              <span style="font-size: 20px;">📝</span>
            </div>
            <div class="agent-title-info">
              <h3>Todo Management: ${todoCount} tasks</h3>
              <div class="agent-subtitle">
                <span class="tool-type-badge">${completionRate}% Complete</span>
                <span class="tool-id-badge">ID: ${todoToolData.id ? todoToolData.id.slice(-8) : 'unknown'}</span>
              </div>
            </div>
          </div>
        </div>
        <button class="agent-modal-close" id="agent-modal-close">&times;</button>
      </div>
      
      <div class="agent-modal-content">
        <!-- Primary Section: Tool Parameters -->
        <div class="raw-parameters-section primary-section">
          <h4>🔧 Tool Parameters</h4>
          <div class="raw-params-container">
            <pre class="raw-params-json">${this.escapeHtml(JSON.stringify(todoToolData.input, null, 2))}</pre>
          </div>
        </div>

        <!-- Todo Summary -->
        <div class="todo-summary-section">
          <h4>📊 Todo Summary</h4>
          <div class="todo-summary">
            <div class="summary-stats">
              <div class="stat-item">
                <span class="stat-number">${todoCount}</span>
                <span class="stat-label">Total Todos</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">${completionRate}%</span>
                <span class="stat-label">Completion Rate</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">${avgLength}</span>
                <span class="stat-label">Avg Length</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Status Breakdown -->
        <div class="todo-status-section">
          <h4>📈 Status Breakdown</h4>
          <div class="status-breakdown">
            <div class="status-item pending">
              <div class="status-info">
                <span class="status-name">Pending</span>
                <span class="status-count">${statusCounts.pending}</span>
              </div>
              <div class="status-bar">
                <div class="status-fill" style="width: ${todoCount > 0 ? (statusCounts.pending / todoCount) * 100 : 0}%"></div>
              </div>
            </div>
            <div class="status-item in-progress">
              <div class="status-info">
                <span class="status-name">In Progress</span>
                <span class="status-count">${statusCounts.in_progress}</span>
              </div>
              <div class="status-bar">
                <div class="status-fill" style="width: ${todoCount > 0 ? (statusCounts.in_progress / todoCount) * 100 : 0}%"></div>
              </div>
            </div>
            <div class="status-item completed">
              <div class="status-info">
                <span class="status-name">Completed</span>
                <span class="status-count">${statusCounts.completed}</span>
              </div>
              <div class="status-bar">
                <div class="status-fill" style="width: ${todoCount > 0 ? (statusCounts.completed / todoCount) * 100 : 0}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Priority Distribution -->
        <div class="todo-priority-section">
          <h4>🎯 Priority Distribution</h4>
          <div class="priority-distribution">
            <div class="priority-item high">
              <span class="priority-label">High Priority</span>
              <span class="priority-count">${priorityCounts.high}</span>
            </div>
            <div class="priority-item medium">
              <span class="priority-label">Medium Priority</span>
              <span class="priority-count">${priorityCounts.medium}</span>
            </div>
            <div class="priority-item low">
              <span class="priority-label">Low Priority</span>
              <span class="priority-count">${priorityCounts.low}</span>
            </div>
          </div>
        </div>

        <!-- Todo Items -->
        <div class="todo-items-section">
          <h4>📋 Todo Items</h4>
          <div class="todo-items">
            ${this.generateTodoItemsDisplay(todos)}
          </div>
        </div>
      </div>
    `;

    const modalHTML = `
      <div class="agent-modal-overlay" id="agent-modal-overlay">
        <div class="agent-modal todo-tool-modal">
          ${modalContent}
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bind close events
    document.getElementById('agent-modal-close').addEventListener('click', () => this.closeAgentModal());
    document.getElementById('agent-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'agent-modal-overlay') {
        this.closeAgentModal();
      }
    });
    
    // ESC key to close - store reference for cleanup
    this.modalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeAgentModal();
      }
    };
    document.addEventListener('keydown', this.modalKeydownHandler);
  }

  /**
   * Generate todo items display
   * @param {Array} todos - Array of todo items
   * @returns {string} HTML for todo items
   */
  generateTodoItemsDisplay(todos) {
    if (!todos || todos.length === 0) {
      return '<div class="no-todos">No todos found</div>';
    }
    
    return todos.map((todo, index) => `
      <div class="todo-item ${todo.status} ${todo.priority}">
        <div class="todo-header">
          <span class="todo-index">#${index + 1}</span>
          <span class="todo-status ${todo.status}">${todo.status.replace('_', ' ')}</span>
          <span class="todo-priority ${todo.priority}">${todo.priority}</span>
        </div>
        <div class="todo-content">${this.escapeHtml(todo.content)}</div>
        <div class="todo-meta">
          <span class="todo-id">ID: ${todo.id}</span>
          <span class="todo-length">${todo.content.length} chars</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Open Bash tool specific modal
   * @param {Object} bashToolData - Bash tool data
   */
  openBashToolModal(bashToolData) {
    const input = bashToolData.input || {};
    const command = input.command || 'Unknown command';
    const description = input.description || '';
    const timeout = input.timeout || 120000; // Default 2 minutes
    const toolId = bashToolData.id || 'unknown';
    
    // Analyze command type
    const isGitCommand = command.startsWith('git ');
    const isNpmCommand = command.startsWith('npm ') || command.startsWith('yarn ') || command.startsWith('pnpm ');
    const isFileCommand = command.includes('ls') || command.includes('cat') || command.includes('find') || command.includes('grep');
    const isBuildCommand = command.includes('build') || command.includes('compile') || command.includes('make');
    const isTestCommand = command.includes('test') || command.includes('jest') || command.includes('mocha');
    const isSystemCommand = command.includes('ps') || command.includes('kill') || command.includes('sudo');
    
    let commandCategory = '';
    let contextIcon = '⚡';
    
    if (isGitCommand) {
      commandCategory = 'Git Operation';
      contextIcon = '🔧';
    } else if (isNpmCommand) {
      commandCategory = 'Package Management';
      contextIcon = '📦';
    } else if (isBuildCommand) {
      commandCategory = 'Build Process';
      contextIcon = '🔨';
    } else if (isTestCommand) {
      commandCategory = 'Testing';
      contextIcon = '🧪';
    } else if (isFileCommand) {
      commandCategory = 'File Operations';
      contextIcon = '📁';
    } else if (isSystemCommand) {
      commandCategory = 'System Command';
      contextIcon = '🖥️';
    } else {
      commandCategory = 'Shell Command';
      contextIcon = '⚡';
    }
    
    // Parse command for better display
    const commandParts = command.split(' ');
    const mainCommand = commandParts[0] || '';
    const args = commandParts.slice(1).join(' ') || '';
    
    const modalHTML = `
      <div class="agent-modal-overlay" id="agent-modal-overlay">
        <div class="agent-modal bash-tool-modal">
          <div class="agent-modal-header">
            <div class="agent-modal-title">
              <div class="agent-title-main">
                <div class="tool-icon bash-tool">
                  <span style="font-size: 20px;">${contextIcon}</span>
                </div>
                <div class="agent-title-info">
                  <h3>Command: ${mainCommand}</h3>
                  <div class="agent-subtitle">
                    <span class="tool-type-badge">${commandCategory}</span>
                    <span class="tool-id-badge">ID: ${toolId.slice(-8)}</span>
                  </div>
                </div>
              </div>
            </div>
            <button class="agent-modal-close" id="agent-modal-close">&times;</button>
          </div>
          
          <div class="agent-modal-content">
            <div class="raw-parameters-section primary-section">
              <h4>🔧 Tool Parameters</h4>
              <div class="raw-params-container">
                <pre class="raw-params-json">${JSON.stringify(input, null, 2)}</pre>
              </div>
              <div class="params-summary">
                <span class="param-chip">Tool ID: ${toolId.slice(-8)}</span>
                <span class="param-chip">Command: ${mainCommand}</span>
                <span class="param-chip">Timeout: ${timeout/1000}s</span>
                ${description ? `<span class="param-chip">Described: Yes</span>` : `<span class="param-chip">Described: No</span>`}
              </div>
            </div>

            <div class="command-execution-section">
              <div class="command-header-section">
                <h4>💻 Command Execution</h4>
                <div class="command-stats">
                  <span class="command-stat">${commandParts.length} parts</span>
                  <span class="command-stat">${command.length} chars</span>
                  <span class="command-stat">${timeout/1000}s timeout</span>
                </div>
              </div>
              <div class="command-display-container">
                <div class="command-line">
                  <span class="command-prompt">$</span>
                  <span class="command-text">${this.escapeHtml(command)}</span>
                </div>
                ${description ? `
                  <div class="command-description">
                    <span class="description-label">Description:</span>
                    <span class="description-text">${this.escapeHtml(description)}</span>
                  </div>
                ` : ''}
              </div>
            </div>

            <div class="command-analysis-section">
              <h4>🔍 Command Analysis</h4>
              <div class="analysis-grid">
                <div class="analysis-item">
                  <span class="analysis-label">Main Command:</span>
                  <code class="analysis-value">${this.escapeHtml(mainCommand)}</code>
                </div>
                ${args ? `
                  <div class="analysis-item">
                    <span class="analysis-label">Arguments:</span>
                    <code class="analysis-value">${this.escapeHtml(args)}</code>
                  </div>
                ` : ''}
                <div class="analysis-item">
                  <span class="analysis-label">Category:</span>
                  <code class="analysis-value">${commandCategory}</code>
                </div>
                <div class="analysis-item">
                  <span class="analysis-label">Timeout:</span>
                  <code class="analysis-value">${timeout === 120000 ? 'Default (2min)' : `${timeout/1000}s`}</code>
                </div>
              </div>
            </div>

            <div class="file-insights-section">
              <h4>📊 Execution Insights</h4>
              <div class="insights-grid">
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">${contextIcon}</span>
                    <span class="insight-title">Command Type</span>
                  </div>
                  <div class="insight-content">${commandCategory}</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">⏱️</span>
                    <span class="insight-title">Timeout</span>
                  </div>
                  <div class="insight-content">${timeout/1000} seconds</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">📝</span>
                    <span class="insight-title">Complexity</span>
                  </div>
                  <div class="insight-content">${commandParts.length < 3 ? 'Simple' : commandParts.length < 6 ? 'Medium' : 'Complex'}</div>
                </div>
                <div class="insight-card">
                  <div class="insight-header">
                    <span class="insight-icon">🎯</span>
                    <span class="insight-title">Documentation</span>
                  </div>
                  <div class="insight-content">${description ? 'Documented' : 'No description'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bind close events
    document.getElementById('agent-modal-close').addEventListener('click', () => this.closeAgentModal());
    document.getElementById('agent-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'agent-modal-overlay') {
        this.closeAgentModal();
      }
    });
    
    // ESC key to close
    this.modalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeAgentModal();
      }
    };
    document.addEventListener('keydown', this.modalKeydownHandler);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return String(text);
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Close agent modal
   */
  closeAgentModal() {
    const modal = document.getElementById('agent-modal-overlay');
    if (modal) {
      modal.remove();
    }
    if (this.modalKeydownHandler) {
      document.removeEventListener('keydown', this.modalKeydownHandler);
      this.modalKeydownHandler = null;
    }
  }

  /**
   * Show agents loading state
   * @param {boolean} show - Whether to show loading
   */
  showAgentsLoading(show) {
    const loading = this.container.querySelector('#agents-loading');
    const list = this.container.querySelector('#agents-list');
    
    if (loading && list) {
      loading.style.display = show ? 'flex' : 'none';
      list.style.display = show ? 'none' : 'block';
    }
  }

  /**
   * Show agents empty state
   */
  showAgentsEmpty() {
    const empty = this.container.querySelector('#agents-empty');
    const list = this.container.querySelector('#agents-list');
    const count = this.container.querySelector('#agents-count');
    
    if (empty && list && count) {
      empty.style.display = 'flex';
      list.style.display = 'none';
      count.textContent = '0 agents'; 
    }
  }

  /**
   * Hide agents empty state
   */
  hideAgentsEmpty() {
    const empty = this.container.querySelector('#agents-empty');
    if (empty) {
      empty.style.display = 'none';
    }
  }

  /**
   * Get project-specific agents for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Array} Array of project agents for this conversation
   */
  getAgentsForConversation(conversationId) {
    const conversations = this.stateService.getStateProperty('conversations') || [];
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    if (!conversation || !conversation.project) {
      // Return empty array if no project (global agents are shown in main section)
      return [];
    }
    
    const projectName = conversation.project;
    
    // Return only project agents for this specific project
    return this.agents.filter(agent => 
      agent.level === 'project' && agent.projectName === projectName
    );
  }

  /**
   * Show project agents modal
   * @param {string} conversationId - Conversation ID
   */
  showProjectAgents(conversationId) {
    const conversations = this.stateService.getStateProperty('conversations') || [];
    const conversation = conversations.find(conv => conv.id === conversationId);
    const projectAgents = this.getAgentsForConversation(conversationId);
    
    const projectName = conversation?.project || 'Unknown Project';
    const chatTitle = conversation?.title || `Chat ${conversationId.slice(-8)}`;
    
    const modalHTML = `
      <div class="agent-modal-overlay" id="project-agents-modal-overlay">
        <div class="agent-modal project-agents-modal">
          <div class="agent-modal-header">
            <div class="agent-modal-title">
              <div class="agent-title-main">
                <div class="project-icon">📁</div>
                <div class="agent-title-info">
                  <h3>Project Agents</h3>
                  <div class="agent-subtitle">
                    <span class="project-info">${chatTitle}</span>
                    <span class="agent-project-name">• ${projectName}</span>
                  </div>
                </div>
              </div>
            </div>
            <button class="agent-modal-close" id="project-agents-modal-close">&times;</button>
          </div>
          
          <div class="agent-modal-content">
            ${projectAgents.length === 0 ? `
              <div class="no-agents-message">
                <div class="no-agents-icon">🤖</div>
                <h4>No project agents</h4>
                <p>This project doesn't have any specific agents configured.</p>
                <p>Create agents in your project's <code>.claude/agents/</code> directory to see them here.</p>
                <p><strong>Note:</strong> Global agents are available in the main agents section.</p>
              </div>
            ` : `
              <div class="project-agents-grid">
                ${projectAgents.map(agent => `
                  <div class="project-agent-card" data-agent-id="${agent.name}">
                    <div class="project-agent-header">
                      <div class="agent-dot" style="background-color: ${agent.color}"></div>
                      <div class="project-agent-info">
                        <h4>${agent.name}</h4>
                        <span class="agent-level-badge ${agent.level}">${agent.level === 'project' ? 'Project' : 'User'}</span>
                      </div>
                    </div>
                    <div class="project-agent-description">
                      ${this.truncateText(agent.description, 100)}
                    </div>
                    <div class="project-agent-footer">
                      <span class="project-agent-tools">${agent.tools && agent.tools.length > 0 ? `${agent.tools.length} tools` : 'All tools'}</span>
                      <button class="project-agent-details-btn" data-agent-id="${agent.name}">Details</button>
                    </div>
                  </div>
                `).join('')}
              </div>
              
              <div class="usage-instruction">
                <h4>💡 How to use these agents</h4>
                <p>In your conversation, mention any agent by name:</p>
                <div class="usage-examples">
                  ${projectAgents.slice(0, 3).map(agent => 
                    `<code class="usage-example">Use the ${agent.name} agent to help with this task</code>`
                  ).join('')}
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bind close events
    document.getElementById('project-agents-modal-close').addEventListener('click', () => this.closeProjectAgentsModal());
    document.getElementById('project-agents-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'project-agents-modal-overlay') {
        this.closeProjectAgentsModal();
      }
    });
    
    // Bind agent detail buttons
    const detailButtons = document.querySelectorAll('.project-agent-details-btn');
    detailButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const agentId = btn.dataset.agentId;
        const agent = this.agents.find(a => a.name === agentId);
        if (agent) {
          this.closeProjectAgentsModal();
          this.openAgentModal(agent);
        }
      });
    });
    
    // ESC key to close
    this.projectModalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeProjectAgentsModal();
      }
    };
    document.addEventListener('keydown', this.projectModalKeydownHandler);
  }

  /**
   * Close project agents modal
   */
  closeProjectAgentsModal() {
    const modal = document.getElementById('project-agents-modal-overlay');
    if (modal) {
      modal.remove();
    }
    if (this.projectModalKeydownHandler) {
      document.removeEventListener('keydown', this.projectModalKeydownHandler);
      this.projectModalKeydownHandler = null;
    }
  }

  /**
   * Refresh agents data
   */
  async refreshAgents() {
    const refreshBtn = this.container.querySelector('#refresh-agents');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      const iconElement = refreshBtn.querySelector('.btn-icon');
      if (iconElement) {
        iconElement.style.animation = 'spin 1s linear infinite';
      }
    }

    try {
      // Just reload agents data without clearing cache
      await this.loadAgentsData();
    } catch (error) {
      console.error('Error refreshing agents:', error);
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        const iconElement = refreshBtn.querySelector('.btn-icon');
        if (iconElement) {
          iconElement.style.animation = '';
        }
      }
    }
  }

  /**
   * Load initial conversations data using paginated API
   */
  async loadConversationsData() {
    try {
      
      // Reset pagination state
      this.pagination = {
        currentPage: 0,
        limit: 10,
        hasMore: true,
        isLoading: false
      };
      this.loadedConversations = [];
      this.loadedMessages.clear(); // Clear message cache too
      
      // Clear the list container
      const listContainer = this.container.querySelector('#conversations-list');
      if (listContainer) {
        listContainer.innerHTML = '';
      }
      
      // Hide empty state initially
      this.hideEmptyState();
      
      // Load first page and states
      await this.loadMoreConversations();
      
      
    } catch (error) {
      console.error('Error loading conversations data:', error);
      this.stateService.setError('Failed to load conversations data');
    }
  }
  
  /**
   * Load more conversations (pagination)
   */
  async loadMoreConversations() {
    if (this.pagination.isLoading || !this.pagination.hasMore) {
      return;
    }
    
    try {
      
      this.pagination.isLoading = true;
      this.updateLoadingIndicator(true);
      
      const [conversationsData, statesData] = await Promise.all([
        this.dataService.getConversationsPaginated(this.pagination.currentPage, this.pagination.limit),
        this.dataService.getConversationStates()
      ]);
      
      
      // Update pagination info
      this.pagination.hasMore = conversationsData.pagination.hasMore;
      this.pagination.currentPage = conversationsData.pagination.page + 1;
      this.pagination.totalCount = conversationsData.pagination.totalCount;
      
      // Get only NEW conversations for this page
      const newConversations = conversationsData.conversations;
      
      // Add new conversations to loaded list
      this.loadedConversations.push(...newConversations);
      
      
      // Extract activeStates from the response structure
      const activeStates = statesData?.activeStates || {};
      
      // Update state with correct format
      this.stateService.updateConversations(this.loadedConversations);
      this.stateService.updateConversationStates(activeStates);
      
      
      // For initial load (page 0), replace content. For subsequent loads, append
      const isInitialLoad = conversationsData.pagination.page === 0;
      this.renderConversationsList(
        isInitialLoad ? this.loadedConversations : newConversations, 
        activeStates, 
        !isInitialLoad
      );
      
    } catch (error) {
      console.error('Error loading more conversations:', error);
      this.stateService.setError('Failed to load more conversations');
    } finally {
      this.pagination.isLoading = false;
      this.updateLoadingIndicator(false);
    }
  }

  /**
   * Render conversations list
   * @param {Array} conversations - Conversations data
   * @param {Object} states - Conversation states
   * @param {boolean} append - Whether to append or replace content
   */
  renderConversationsList(conversations, states, append = false) {
    const listContainer = this.container.querySelector('#conversations-list');
    if (!listContainer) {
      console.warn('conversations-list element not found in AgentsPage - component may not be active');
      return;
    }
    const filteredConversations = this.filterConversations(conversations, states);
    
    // Calculate count based on filters
    let countToShow;
    const hasActiveFilters = this.hasActiveFilters();
    
    if (!hasActiveFilters && this.pagination && this.pagination.totalCount) {
      // No filters active, show total count from server
      countToShow = this.pagination.totalCount;
    } else {
      // Filters active, count filtered loaded conversations  
      const conversationsToCount = this.loadedConversations && this.loadedConversations.length > 0 
        ? this.loadedConversations 
        : conversations;
      const allFilteredConversations = this.filterConversations(conversationsToCount, states);
      countToShow = allFilteredConversations.length;
    }
    
    this.updateResultsCount(countToShow, hasActiveFilters);
    this.updateClearFiltersButton();
    
    if (filteredConversations.length === 0 && !append) {
      this.showEmptyState();
      return;
    }
    
    this.hideEmptyState();
    
    const conversationHTML = filteredConversations.map(conv => {
      const state = states[conv.id] || 'unknown';
      const stateClass = this.getStateClass(state);
      
      // Check for agent usage
      const agentColor = this.getAgentColorForConversation(conv.id);
      const agentName = this.getAgentNameForConversation(conv.id);
      
      // Generate title with agent indicator
      const titleColor = agentColor ? `style="color: ${agentColor}; border-left: 3px solid ${agentColor}; padding-left: 8px;"` : '';
      const agentIndicator = agentName ? `<span class="agent-indicator-small" style="background-color: ${agentColor}" title="Using ${agentName} agent">🤖</span>` : '';
      
      const lastMessageTime = conv.lastActivity ? this.formatTimeForChat(new Date(conv.lastActivity)) : '';
      const hasUnread = this.hasUnreadMessages(conv.id);
      const unreadCount = hasUnread ? this.getUnreadCount(conv.id) : 0;
      const projectName = conv.project || 'Unknown Project';
      const avatarText = this.getAvatarText(projectName);
      
      return `
        <div class="sidebar-conversation-item" data-id="${conv.id}" ${agentColor ? `data-agent-color="${agentColor}"` : ''}>
          <div class="sidebar-conversation-header">
            <div class="sidebar-conversation-title">
              <div class="chat-avatar">${avatarText}</div>
              <div class="sidebar-conversation-info">
                <h4 class="sidebar-conversation-name">${projectName}</h4>
                <div class="sidebar-conversation-meta">
                  <span class="sidebar-meta-item">
                    <span class="status-dot ${stateClass}"></span>
                    ${this.getStateLabel(state)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="sidebar-conversation-preview">
            <p class="sidebar-preview-text">${this.getSimpleConversationPreview(conv)}</p>
            <div class="sidebar-conversation-time">
              ${lastMessageTime}
              ${hasUnread ? `<span class="unread-indicator">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    if (append) {
      listContainer.insertAdjacentHTML('beforeend', conversationHTML);
    } else {
      listContainer.innerHTML = conversationHTML;
    }
    
    // Bind card actions
    this.bindListActions();
  }

  /**
   * Bind list action events
   */
  bindListActions() {
    // Export conversation button
    const exportBtn = this.container.querySelector('#export-conversation');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        if (this.selectedConversationId) {
          this.exportSingleConversation(this.selectedConversationId);
        }
      });
    }

    // Click on sidebar conversation item to select and view
    const conversationItems = this.container.querySelectorAll('.sidebar-conversation-item');
    conversationItems.forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't select conversation if clicking on agents button
        if (e.target.closest('.conversation-agents-btn')) {
          return;
        }
        const conversationId = item.dataset.id;
        this.selectConversation(conversationId);
      });
    });

    // Bind agents button clicks
    const agentsButtons = this.container.querySelectorAll('.conversation-agents-btn');
    agentsButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const conversationId = btn.dataset.conversationId;
        this.showProjectAgents(conversationId);
      });
    });
  }

  /**
   * Select and display a conversation
   * @param {string} conversationId - Conversation ID
   */
  async selectConversation(conversationId) {
    // Update selected conversation state
    this.selectedConversationId = conversationId;
    
    // Update UI to show selection
    this.updateSelectedConversation();
    
    // Show message input area
    this.showMessageInput();
    
    // Load and display conversation messages
    await this.loadConversationMessages(conversationId);
    
    // Update conversation context for sending messages
    await this.updateConversationContext(conversationId);
  }
  
  /**
   * Update selected conversation in sidebar
   */
  updateSelectedConversation() {
    // Remove previous selection
    const previousSelected = this.container.querySelector('.sidebar-conversation-item.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }
    
    // Add selection to current item
    const currentItem = this.container.querySelector(`[data-id="${this.selectedConversationId}"]`);
    if (currentItem) {
      currentItem.classList.add('selected');
    }
    
    // Update header with conversation info
    const conversations = this.stateService.getStateProperty('conversations') || [];
    const conversation = conversations.find(conv => conv.id === this.selectedConversationId);
    
    if (conversation) {
      const titleElement = this.container.querySelector('#selected-conversation-title');
      const metaElement = this.container.querySelector('#selected-conversation-meta');
      
      if (titleElement) {
        const projectName = conversation.project || 'Unknown Project';
        const conversationId = conversation.id.slice(-8);
        const baseTitle = `${projectName} • ${conversationId}`;
        const agentName = this.getAgentNameForConversation(conversation.id);
        const agentColor = this.getAgentColorForConversation(conversation.id);
        
        if (agentName && agentColor) {
          titleElement.innerHTML = `
            <span style="color: ${agentColor}; border-left: 3px solid ${agentColor}; padding-left: 8px;">
              ${baseTitle}
            </span>
            <span class="agent-badge" style="background-color: ${agentColor};" title="Using ${agentName} agent">
              🤖 ${agentName}
            </span>
          `;
        } else {
          titleElement.textContent = baseTitle;
        }
      }
      
      if (metaElement) {
        const messageCount = conversation.messageCount || 0;
        const lastActivity = this.formatRelativeTime(new Date(conversation.lastModified));
        metaElement.innerHTML = `
          <span class="meta-item">
            <span class="meta-icon">📁</span>
            ${conversation.project || 'Unknown Project'}
          </span>
          <span class="meta-item">
            <span class="meta-icon">💬</span>
            ${messageCount} message${messageCount !== 1 ? 's' : ''}
          </span>
          <span class="meta-item">
            <span class="meta-icon">🕒</span>
            ${lastActivity}
          </span>
        `;
      }
    }
    
    // Update mobile header if on mobile
    this.updateMobileHeader(conversation);
    
    // Show and update the state banner
    this.showStateBanner(this.selectedConversationId);
  }
  
  /**
   * Load and display conversation messages (with caching)
   * @param {string} conversationId - Conversation ID
   */
  async loadConversationMessages(conversationId) {
    // Reset pagination for new conversation
    this.messagesPagination = {
      currentPage: 0,
      limit: 10,
      hasMore: true,
      isLoading: false,
      conversationId: conversationId
    };
    
    // Clear cached messages for this conversation
    this.loadedMessages.delete(conversationId);
    
    // Load first page of messages
    await this.loadMoreMessages(conversationId, true);
  }

  /**
   * Show and update conversation state banner
   * @param {string} conversationId - Conversation ID
   */
  showStateBanner(conversationId) {
    const banner = this.container.querySelector('#conversation-state-banner');
    if (!banner) return;
    
    // Show the banner
    banner.style.display = 'flex';
    
    // Get current state from WebSocket or cache
    const conversationStates = this.stateService.getStateProperty('conversationStates') || {};
    const currentState = conversationStates[conversationId] || 'unknown';
    
    
    // If we don't have the state yet, try to fetch it after a short delay
    if (currentState === 'unknown') {
      setTimeout(() => {
        this.fetchConversationState(conversationId);
      }, 100);
    }
    
    // Update banner with current state
    this.updateStateBanner(conversationId, currentState);
  }

  /**
   * Update conversation state banner
   * @param {string} conversationId - Conversation ID  
   * @param {string} state - Current conversation state
   */
  updateStateBanner(conversationId, state) {
    const banner = this.container.querySelector('#conversation-state-banner');
    const stateDot = this.container.querySelector('#state-dot');
    const stateText = this.container.querySelector('#state-text');
    const stateTimestamp = this.container.querySelector('#state-timestamp');
    
    
    if (!banner || !stateDot || !stateText || !stateTimestamp) {
      return;
    }
    
    // Map states to user-friendly messages with enhanced descriptions
    const stateMessages = {
      'Claude Code working...': {
        text: '🤖 Claude is thinking and working...',
        description: 'Claude is processing your request',
        class: 'status-working',
        icon: '🧠'
      },
      'Awaiting tool response...': {
        text: '⚡ Waiting for tool execution...',
        description: 'Claude is waiting for tool results',
        class: 'status-tool-pending',
        icon: '🔧'
      },
      'Executing tools...': {
        text: '🔧 Executing tools...',
        description: 'Claude is running system tools',
        class: 'status-tool-executing',
        icon: '⚡'
      },
      'Analyzing results...': {
        text: '📊 Analyzing tool results...',
        description: 'Claude is processing tool outputs',
        class: 'status-analyzing',
        icon: '🔍'
      },
      'Analyzing code...': {
        text: '🔍 Analyzing code...',
        description: 'Claude is examining code or files',
        class: 'status-analyzing',
        icon: '📝'
      },
      'Fetching data...': {
        text: '🌐 Fetching data...',
        description: 'Claude is retrieving web content or external data',
        class: 'status-fetching',
        icon: '📶'
      },
      'Task completed': {
        text: '✅ Task completed',
        description: 'Claude has finished the requested task',
        class: 'status-completed',
        icon: '✨'
      },
      'Processing request...': {
        text: '⚙️ Processing request...',
        description: 'Claude is working on a complex request',
        class: 'status-processing',
        icon: '🔄'
      },
      'Encountered issue': {
        text: '⚠️ Encountered issue',
        description: 'Claude found an error or problem',
        class: 'status-error',
        icon: '🚟'
      },
      'Awaiting user input...': {
        text: '💬 Awaiting your input',
        description: 'Claude needs your response to continue',
        class: 'status-waiting',
        icon: '💭'
      },
      'Waiting for your response': {
        text: '💬 Waiting for your response',
        description: 'Claude is ready for your next message',
        class: 'status-waiting-response',
        icon: '📝'
      },
      'Awaiting response...': {
        text: '⏳ Awaiting Claude response',
        description: 'Waiting for Claude to respond',
        class: 'status-waiting',
        icon: '🤔'
      },
      'Recently active': {
        text: '🟢 Recently active',
        description: 'Conversation was active recently',
        class: 'status-active',
        icon: '✨'
      },
      'Idle': {
        text: '😴 Conversation idle',
        description: 'No recent activity',
        class: 'status-idle',
        icon: '💤'
      },
      'Inactive': {
        text: '⚪ Inactive',
        description: 'Conversation has been inactive',
        class: 'status-idle',
        icon: '⏸️'
      },
      'Old': {
        text: '📚 Archived conversation',
        description: 'No recent activity in this conversation',
        class: 'status-idle',
        icon: '📁'
      },
      'unknown': {
        text: '🔄 Loading conversation state...',
        description: 'Determining conversation status',
        class: 'status-loading',
        icon: '⏳'
      }
    };
    
    const stateInfo = stateMessages[state] || stateMessages['unknown'];
    
    // Update dot class with enhanced styling
    stateDot.className = `state-dot ${stateInfo.class}`;
    
    // Check for agent usage
    const agentName = this.getAgentNameForConversation(conversationId);
    const agentColor = this.getAgentColorForConversation(conversationId);
    
    // Update text with icon, description, and agent info
    let stateTextContent = stateInfo.text;
    let stateDescriptionContent = stateInfo.description;
    
    // If an agent is detected and state indicates work, update the message
    if (agentName && (stateInfo.class.includes('working') || stateInfo.class.includes('executing') || stateInfo.class.includes('analyzing'))) {
      stateTextContent = `🤖 ${agentName} agent working...`;
      stateDescriptionContent = `The ${agentName} agent is processing your request`;
      
      // Apply agent color to the dot
      if (agentColor) {
        stateDot.style.backgroundColor = agentColor;
        stateDot.style.borderColor = agentColor;
      }
    }
    
    stateText.innerHTML = `
      <span class="state-text-main">${stateTextContent}</span>
      <span class="state-text-description">${stateDescriptionContent}</span>
    `;
    
    // Add tooltip for additional context
    stateText.title = stateInfo.description;
    
    // Update timestamp with more context
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    stateTimestamp.innerHTML = `
      <span class="timestamp-label">Last updated:</span>
      <span class="timestamp-value">${timeString}</span>
    `;
    
    // Add pulsing animation for active states
    if (stateInfo.class.includes('working') || stateInfo.class.includes('executing') || stateInfo.class.includes('analyzing')) {
      stateDot.classList.add('pulse-animation');
      setTimeout(() => stateDot.classList.remove('pulse-animation'), 3000);
    }
    
  }

  /**
   * Fetch conversation state from API
   * @param {string} conversationId - Conversation ID
   */
  async fetchConversationState(conversationId) {
    try {
      const stateData = await this.dataService.getConversationStates();
      
      if (stateData && stateData.activeStates && stateData.activeStates[conversationId]) {
        const state = stateData.activeStates[conversationId];
        
        // Update the StateService with the new data
        this.stateService.updateConversationStates(stateData.activeStates);
        
        // Update the banner with the real state
        this.updateStateBanner(conversationId, state);
      } else {
        // Keep showing unknown for now
      }
    } catch (error) {
      console.error('Error fetching conversation state:', error);
    }
  }

  /**
   * Hide conversation state banner
   */
  hideStateBanner() {
    const banner = this.container.querySelector('#conversation-state-banner');
    if (banner) {
      banner.style.display = 'none';
    }
  }

  /**
   * Auto-scroll to bottom of messages
   */
  scrollToBottom() {
    const messagesContent = this.container.querySelector('#messages-content');
    if (messagesContent) {
      messagesContent.scrollTop = messagesContent.scrollHeight;
    }
  }

  /**
   * Show notification for new message
   * @param {Object} message - New message object
   * @param {Object} metadata - Message metadata
   */
  showNewMessageNotification(message, metadata) {
    // Update banner if it's showing to reflect new activity
    if (this.selectedConversationId) {
      const banner = this.container.querySelector('#conversation-state-banner');
      if (banner && banner.style.display !== 'none') {
        // Temporarily highlight the banner to show activity
        banner.style.backgroundColor = 'rgba(213, 116, 85, 0.1)';
        setTimeout(() => {
          banner.style.backgroundColor = '';
        }, 1000);
      }
    }
    
    // Could add visual indicator for new message (pulse, notification badge, etc.)
  }

  /**
   * Load more messages (for infinite scroll)
   * @param {string} conversationId - Conversation ID
   * @param {boolean} isInitialLoad - Whether this is the initial load
   */
  async loadMoreMessages(conversationId, isInitialLoad = false) {
    const messagesContent = this.container.querySelector('#messages-content');
    if (!messagesContent) return;
    
    // Prevent concurrent loading
    if (this.messagesPagination.isLoading || !this.messagesPagination.hasMore) {
      return;
    }
    
    // Ensure we're loading for the correct conversation
    if (this.messagesPagination.conversationId !== conversationId) {
      return;
    }
    
    try {
      this.messagesPagination.isLoading = true;
      
      if (isInitialLoad) {
        // Show loading state for initial load
        messagesContent.innerHTML = `
          <div class="messages-loading">
            <div class="loading-spinner"></div>
            <span>Loading messages...</span>
          </div>
        `;
      } else {
        // Show loading indicator at top for infinite scroll
        this.showMessagesLoadingIndicator(true);
      }
      
      // Fetch paginated messages from the server
      const messagesData = await this.dataService.cachedFetch(
        `/api/conversations/${conversationId}/messages?page=${this.messagesPagination.currentPage}&limit=${this.messagesPagination.limit}`
      );
      
      if (messagesData && messagesData.messages) {
        // Update pagination state - handle both paginated and non-paginated responses
        if (messagesData.pagination) {
          // Paginated response
          this.messagesPagination.hasMore = messagesData.pagination.hasMore;
          this.messagesPagination.currentPage = messagesData.pagination.page + 1;
        } else {
          // Non-paginated response (fallback) - treat as complete data
          this.messagesPagination.hasMore = false;
          this.messagesPagination.currentPage = 1;
        }
        
        // Get existing messages or initialize
        let existingMessages = this.loadedMessages.get(conversationId) || [];
        
        if (isInitialLoad) {
          // For initial load, replace all messages
          existingMessages = messagesData.messages;
        } else {
          // For infinite scroll, prepend older messages (they come in chronological order)
          existingMessages = [...messagesData.messages, ...existingMessages];
        }
        
        // Cache the combined messages
        this.loadedMessages.set(conversationId, existingMessages);
        
        // Render messages
        this.renderCachedMessages(existingMessages, !isInitialLoad);
        
        // Setup scroll listener for infinite scroll (only on initial load)
        if (isInitialLoad) {
          this.setupMessagesScrollListener(conversationId);
        }
        
        
      } else if (isInitialLoad) {
        messagesContent.innerHTML = `
          <div class="no-messages-found">
            <div class="no-messages-icon">💭</div>
            <h4>No messages found</h4>
            <p>This conversation has no messages or they could not be loaded.</p>
          </div>
        `;
      }
      
    } catch (error) {
      console.error('Error loading messages:', error);
      
      if (isInitialLoad) {
        messagesContent.innerHTML = `
          <div class="messages-error">
            <span class="error-icon">⚠️</span>
            <span>Failed to load messages</span>
            <button class="retry-messages" data-conversation-id="${conversationId}">Retry</button>
          </div>
        `;
        
        // Bind retry button event
        const retryBtn = messagesContent.querySelector('.retry-messages');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            this.loadConversationMessages(conversationId);
          });
        }
      }
    } finally {
      this.messagesPagination.isLoading = false;
      if (!isInitialLoad) {
        this.showMessagesLoadingIndicator(false);
      }
    }
  }
  
  /**
   * Render cached messages
   * @param {Array} messages - Array of messages
   * @param {boolean} prepend - Whether to prepend messages (for infinite scroll)
   */
  renderCachedMessages(messages, prepend = false) {
    
    
    const messagesContent = this.container.querySelector('#messages-content');
    if (!messagesContent) {
      console.warn(`⚠️ messages-content element not found!`);
      return;
    }
    
    // Store messages globally for tool result lookup
    if (typeof window !== 'undefined') {
      window.currentMessages = messages;
    }
    
    const messageHTML = `
      <div class="messages-loading-indicator" style="display: none;">
        <div class="loading-spinner small"></div>
        <span>Loading older messages...</span>
      </div>
      <div class="messages-list">
        ${messages.map(msg => this.renderMessage(msg)).join('')}
      </div>
    `;
    
    if (prepend) {
      // For infinite scroll, we need to maintain scroll position
      const oldScrollHeight = messagesContent.scrollHeight;
      
      // Update content
      messagesContent.innerHTML = messageHTML;
      
      // Restore scroll position relative to the bottom
      const newScrollHeight = messagesContent.scrollHeight;
      const scrollDifference = newScrollHeight - oldScrollHeight;
      messagesContent.scrollTop += scrollDifference;
    } else {
      // Initial load - just replace content and scroll to bottom
      messagesContent.innerHTML = messageHTML;
      
      // Scroll to bottom for new conversation load
      setTimeout(() => {
        messagesContent.scrollTop = messagesContent.scrollHeight;
      }, 100);
    }
    
    // Bind tool display events
    this.toolDisplay.bindEvents(messagesContent);
  }

  /**
   * Show/hide messages loading indicator
   * @param {boolean} show - Whether to show the indicator
   */
  showMessagesLoadingIndicator(show) {
    const messagesContent = this.container.querySelector('#messages-content');
    if (!messagesContent) return;
    
    const indicator = messagesContent.querySelector('.messages-loading-indicator');
    if (indicator) {
      indicator.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * Setup scroll listener for infinite scroll in messages
   * @param {string} conversationId - Current conversation ID
   */
  setupMessagesScrollListener(conversationId) {
    const messagesContent = this.container.querySelector('#messages-content');
    if (!messagesContent) return;
    
    // Remove existing listener if any
    if (this.messagesScrollListener) {
      messagesContent.removeEventListener('scroll', this.messagesScrollListener);
    }
    
    // Create new listener
    this.messagesScrollListener = () => {
      // Check if we've scrolled near the top (for loading older messages)
      const scrollTop = messagesContent.scrollTop;
      const threshold = 100; // pixels from top
      
      if (scrollTop <= threshold && this.messagesPagination.hasMore && !this.messagesPagination.isLoading) {
        this.loadMoreMessages(conversationId, false);
      }
    };
    
    // Add listener
    messagesContent.addEventListener('scroll', this.messagesScrollListener);
  }
  
  /**
   * Render a single message with terminal-style formatting
   * @param {Object} message - Message object
   * @returns {string} HTML string
   */
  renderMessage(message) {
    const timestamp = this.formatRelativeTime(new Date(message.timestamp));
    const fullTimestamp = new Date(message.timestamp).toLocaleString();
    // Compact summaries should be displayed as assistant messages even if marked as 'user'
    const isUser = message.role === 'user' && !message.isCompactSummary;
    
    // Detect if message contains tools
    const hasTools = Array.isArray(message.content) && 
                    message.content.some(block => block.type === 'tool_use');
    const toolCount = hasTools ? 
                     message.content.filter(block => block.type === 'tool_use').length : 0;
    
    return `
      <div class="message message-${isUser ? 'user' : 'assistant'}" data-message-id="${message.id || ''}">
        <div class="message-bubble">
          <div class="message-content">
            ${this.formatMessageContent(message.content, message)}
          </div>
          <div class="message-meta">
            <span class="message-time" title="${fullTimestamp}">${timestamp}</span>
            ${hasTools ? `<span class="tool-indicator">🔧 ${toolCount}</span>` : ''}
            ${message.usage && (message.usage.input_tokens > 0 || message.usage.output_tokens > 0) ? `
              <span class="token-indicator">
                Input: ${message.usage.input_tokens} • Output: ${message.usage.output_tokens}
              </span>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  
  /**
   * Format message content with support for text and tool calls
   * @param {string|Array} content - Message content
   * @returns {string} Formatted HTML
   */
  formatMessageContent(content, message = null) {
    let result = '';
    
    // Handle different content formats
    if (Array.isArray(content)) {
      // Assistant messages with content blocks
      content.forEach((block, index) => {
        if (block.type === 'text') {
          result += this.formatTextContent(block.text);
        } else if (block.type === 'tool_use') {
          // Log only tool rendering for debugging
          console.log('🔧 WebSocket: Rendering tool', { name: block.name, hasResults: !!message?.toolResults });
          result += this.toolDisplay.renderToolUse(block, message?.toolResults);
        } else if (block.type === 'tool_result') {
          result += this.toolDisplay.renderToolResult(block);
        }
      });
    } else if (typeof content === 'string' && content.trim() !== '') {
      // User messages with plain text - check for special patterns
      if (content.includes('Tool Result') && content.length > 1000) {
        // This is likely a large tool result that should be handled specially
        result += this.formatLargeToolResult(content);
      } else {
        // Check if this is a confirmation response "[ok]" or similar
        const enhancedContent = this.enhanceConfirmationMessage(content, message);
        result = this.formatTextContent(enhancedContent);
      }
    } else if (content && typeof content === 'object') {
      // Handle edge cases where content might be an object
      result = this.formatTextContent(JSON.stringify(content, null, 2));
    }
    
    return result || '<em class="empty-content">No displayable content available</em>';
  }
  
  /**
   * Format regular text content with enhanced Markdown support
   * @param {string} text - Text content
   * @returns {string} Formatted HTML
   */
  /**
   * Apply markdown formatting to HTML-escaped text
   * @param {string} escapedText - HTML-escaped text to format
   * @returns {string} Formatted text with markdown styling
   */
  applyMarkdownFormatting(escapedText) {
    let formattedText = escapedText;
    
    // 1. Code blocks (must be first to avoid conflicts)
    formattedText = formattedText
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block" data-language="$1"><code>$2</code></pre>');
    
    // 2. Headers (h1-h6)
    formattedText = formattedText
      .replace(/^### (.*$)/gm, '<h3 class="markdown-h3">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="markdown-h2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="markdown-h1">$1</h1>')
      .replace(/^#### (.*$)/gm, '<h4 class="markdown-h4">$1</h4>')
      .replace(/^##### (.*$)/gm, '<h5 class="markdown-h5">$1</h5>')
      .replace(/^###### (.*$)/gm, '<h6 class="markdown-h6">$1</h6>');
    
    // 3. Bold and italic text
    formattedText = formattedText
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em class="markdown-bold-italic">$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="markdown-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="markdown-italic">$1</em>')
      .replace(/\_\_\_(.*?)\_\_\_/g, '<strong><em class="markdown-bold-italic">$1</em></strong>')
      .replace(/\_\_(.*?)\_\_/g, '<strong class="markdown-bold">$1</strong>')
      .replace(/\_(.*?)\_/g, '<em class="markdown-italic">$1</em>');
    
    // 4. Strikethrough
    formattedText = formattedText
      .replace(/~~(.*?)~~/g, '<del class="markdown-strikethrough">$1</del>');
    
    // 5. Links
    formattedText = formattedText
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="markdown-link" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // 6. Inline code (after other formatting to avoid conflicts)
    formattedText = formattedText
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // 7. Lists (unordered)
    formattedText = formattedText
      .replace(/^[\s]*[\*\-\+][\s]+(.*)$/gm, '<li class="markdown-list-item">$1</li>');
    
    // 8. Lists (ordered)
    formattedText = formattedText
      .replace(/^[\s]*\d+\.[\s]+(.*)$/gm, '<li class="markdown-ordered-item">$1</li>');
    
    // 9. Wrap consecutive list items in ul/ol tags
    formattedText = formattedText
      .replace(/(<li class="markdown-list-item">.*<\/li>)/gs, (match) => {
        return '<ul class="markdown-list">' + match + '</ul>';
      })
      .replace(/(<li class="markdown-ordered-item">.*<\/li>)/gs, (match) => {
        return '<ol class="markdown-ordered-list">' + match + '</ol>';
      });
    
    // 10. Blockquotes
    formattedText = formattedText
      .replace(/^&gt;[\s]*(.*)$/gm, '<blockquote class="markdown-blockquote">$1</blockquote>');
    
    // 11. Horizontal rules
    formattedText = formattedText
      .replace(/^[\s]*---[\s]*$/gm, '<hr class="markdown-hr">')
      .replace(/^[\s]*\*\*\*[\s]*$/gm, '<hr class="markdown-hr">');
    
    // 12. Line breaks (last to avoid conflicts)
    formattedText = formattedText
      .replace(/\n\n/g, '</p><p class="markdown-paragraph">')
      .replace(/\n/g, '<br>');
    
    // 13. Wrap in paragraph if not already wrapped
    if (!formattedText.includes('<p') && !formattedText.includes('<h') && 
        !formattedText.includes('<ul') && !formattedText.includes('<ol') && 
        !formattedText.includes('<blockquote')) {
      formattedText = '<p class="markdown-paragraph">' + formattedText + '</p>';
    }
    
    return formattedText;
  }

  formatTextContent(text) {
    if (!text || text.trim() === '') return '';
    
    // Escape HTML to prevent XSS
    const escapeHtml = (str) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };
    
    // Check if text is too long and needs truncation
    const lines = text.split('\n');
    const maxVisibleLines = 20; // Increased from 5 to 20 for better visibility
    
    if (lines.length > maxVisibleLines) {
      const visibleLines = lines.slice(0, maxVisibleLines);
      const hiddenLinesCount = lines.length - maxVisibleLines;
      const contentId = 'text_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // Store full content for modal
      if (typeof window !== 'undefined') {
        window.storedContent = window.storedContent || {};
        window.storedContent[contentId] = text;
      }
      
      const previewText = escapeHtml(visibleLines.join('\n'));
      const showMoreButton = `<button class="show-results-btn text-expand-btn" data-content-id="${contentId}">Show +${hiddenLinesCount} lines</button>`;
      
      // Apply markdown formatting to preview
      let formattedPreview = this.applyMarkdownFormatting(previewText);
      
      return `<div class="text-content-preview">${formattedPreview}<div class="text-expand-section"><span class="continuation">… +${hiddenLinesCount} lines hidden</span> ${showMoreButton}</div></div>`;
    }
    
    // For non-truncated content, apply full formatting
    let formattedText = escapeHtml(text);
    formattedText = this.applyMarkdownFormatting(formattedText);
    
    return formattedText;
  }

  /**
   * Format large tool result content safely
   * @param {string} content - Large tool result content
   * @returns {string} Safe formatted content
   */
  formatLargeToolResult(content) {
    // Extract tool result ID if present
    const toolIdMatch = content.match(/Tool Result\s+([A-Za-z0-9]+)/);
    const toolId = toolIdMatch ? toolIdMatch[1] : 'unknown';
    
    const escapeHtml = (str) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };
    
    const preview = content.length > 80 
      ? escapeHtml(content.substring(0, 80)) + '...' 
      : escapeHtml(content);
    
    return `
      <div class="terminal-tool tool-result large">
        <span class="tool-prompt">></span>
        <span class="tool-status">[LARGE]</span>
        <span class="tool-id">[${toolId}]</span>
        <span class="tool-output">${content.length}b: ${preview}</span>
      </div>
    `;
  }

  /**
   * Enhance confirmation messages like "[ok]" with context information
   * @param {string} content - Original message content
   * @param {Object} message - Full message object with metadata
   * @returns {string} Enhanced message content
   */
  enhanceConfirmationMessage(content, message) {
    const trimmedContent = content.trim();
    
    // Detect simple confirmation patterns
    const confirmationPatterns = [
      /^\[ok\]$/i,
      /^ok$/i,
      /^yes$/i,
      /^\[yes\]$/i,
      /^y$/i,
      /^\[y\]$/i,
      /^1$/,  // Choice selection
      /^2$/,
      /^3$/
    ];
    
    const isConfirmation = confirmationPatterns.some(pattern => pattern.test(trimmedContent));
    
    if (isConfirmation && message) {
      // Try to extract context from the message timestamp
      const messageTime = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : 'unknown time';
      
      // Enhanced display for confirmation messages
      return `${content} <span class="confirmation-context">(User confirmation at ${messageTime})</span>`;
    }
    
    // For other potential confirmation-like messages, check if they seem like choices
    if (/^[1-9]$/.test(trimmedContent)) {
      return `${content} <span class="confirmation-context">(Menu selection)</span>`;
    }
    
    // Check for common CLI responses
    if (/^(continue|proceed|accept|confirm|done)$/i.test(trimmedContent)) {
      return `${content} <span class="confirmation-context">(User command)</span>`;
    }
    
    return content;
  }

  /**
   * Detect which agent is being used in a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Object|null} Agent info or null if no agent detected
   */
  detectAgentInConversation(conversationId) {
    const messages = this.loadedMessages.get(conversationId) || [];
    
    // Look for agent indicators in recent messages
    for (let i = messages.length - 1; i >= Math.max(0, messages.length - 10); i--) {
      const message = messages[i];
      
      if (message.role === 'assistant' && message.content) {
        let contentText = '';
        
        // Extract text content from message
        if (Array.isArray(message.content)) {
          contentText = message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join(' ');
        } else if (typeof message.content === 'string') {
          contentText = message.content;
        }
        
        // Check for agent usage patterns
        const agentPatterns = [
          /use(?:s|d)?\s+the\s+([a-zA-Z0-9\-_]+)\s+(?:sub\s+)?agent/i,
          /([a-zA-Z0-9\-_]+)\s+agent\s+(?:to|for|will)/i,
          /delegat(?:e|ing)\s+(?:to|task|this)\s+(?:the\s+)?([a-zA-Z0-9\-_]+)\s+agent/i,
          /invok(?:e|ing)\s+(?:the\s+)?([a-zA-Z0-9\-_]+)\s+agent/i
        ];
        
        for (const pattern of agentPatterns) {
          const match = contentText.match(pattern);
          if (match) {
            const detectedAgentName = match[1].toLowerCase();
            
            // Find matching agent from our loaded agents
            const agent = this.agents.find(a => 
              a.name.toLowerCase() === detectedAgentName ||
              a.name.toLowerCase().replace(/-/g, '') === detectedAgentName.replace(/-/g, '')
            );
            
            if (agent) {
              return {
                agent,
                detectedAt: message.timestamp,
                confidence: 'high'
              };
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Get agent color for conversation
   * @param {string} conversationId - Conversation ID
   * @returns {string|null} Agent color or null
   */
  getAgentColorForConversation(conversationId) {
    const agentInfo = this.detectAgentInConversation(conversationId);
    return agentInfo ? agentInfo.agent.color : null;
  }

  /**
   * Get agent name for conversation
   * @param {string} conversationId - Conversation ID
   * @returns {string|null} Agent name or null
   */
  getAgentNameForConversation(conversationId) {
    const agentInfo = this.detectAgentInConversation(conversationId);
    return agentInfo ? agentInfo.agent.name : null;
  }

  /**
   * Format relative time
   * @param {Date} date - Date to format
   * @returns {string} Relative time string
   */
  formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  /**
   * Update clear filters button visibility
   */
  updateClearFiltersButton() {
    const clearBtn = this.container.querySelector('#clear-filters');
    if (!clearBtn) return; // Guard against null when AgentsPage isn't rendered
    
    const hasActiveFilters = this.filters.status !== 'all' || 
                           this.filters.timeRange !== '7d' || 
                           this.filters.search !== '';
    clearBtn.style.display = hasActiveFilters ? 'inline-block' : 'none';
  }

  /**
   * Handle list action
   * @param {string} action - Action type
   * @param {string} conversationId - Conversation ID
   */
  handleListAction(action, conversationId) {
    switch (action) {
      case 'view':
        this.viewConversation(conversationId);
        break;
    }
  }

  /**
   * Filter conversations based on current filters
   * @param {Array} conversations - All conversations
   * @param {Object} states - Conversation states
   * @returns {Array} Filtered conversations
   */
  filterConversations(conversations, states) {
    let filtered = conversations;
    
    // Filter by status
    if (this.filters.status !== 'all') {
      filtered = filtered.filter(conv => {
        const state = states[conv.id] || 'unknown';
        const category = this.getStateCategory(state);
        return category === this.filters.status;
      });
    }
    
    // Filter by time range
    const timeRange = this.getTimeRangeMs(this.filters.timeRange);
    if (timeRange > 0) {
      const cutoff = Date.now() - timeRange;
      filtered = filtered.filter(conv => {
        const lastModified = new Date(conv.lastModified).getTime();
        return lastModified >= cutoff;
      });
    }
    
    // Filter by search
    if (this.filters.search) {
      const searchLower = this.filters.search.toLowerCase();
      filtered = filtered.filter(conv => {
        return (conv.title || '').toLowerCase().includes(searchLower) ||
               (conv.project || '').toLowerCase().includes(searchLower) ||
               (conv.lastMessage || '').toLowerCase().includes(searchLower);
      });
    }
    
    return filtered;
  }

  /**
   * Get time range in milliseconds
   * @param {string} range - Time range string
   * @returns {number} Milliseconds
   */
  getTimeRangeMs(range) {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return ranges[range] || 0;
  }

  /**
   * Get state category for filtering
   * @param {string} state - Detailed conversation state
   * @returns {string} Category: 'active' or 'inactive'
   */
  getStateCategory(state) {
    // Active states - conversation is currently being used or recently active
    const activeStates = [
      'Claude Code working...',
      'Awaiting user input...',
      'User typing...',
      'Awaiting response...',
      'Recently active'
    ];
    
    // Inactive states - conversation is idle or old
    const inactiveStates = [
      'Idle',
      'Inactive',
      'Old',
      'unknown'
    ];
    
    if (activeStates.includes(state)) {
      return 'active';
    } else if (inactiveStates.includes(state)) {
      return 'inactive';
    } else {
      // Default for any unknown states
      return 'inactive';
    }
  }

  /**
   * Get simple conversation preview text (avoids repeating metadata)
   * @param {Object} conv - Conversation object
   * @returns {string} Preview text
   */
  getSimpleConversationPreview(conv) {
    // If we have a last message, show it (this is the most useful info)
    if (conv.lastMessage && conv.lastMessage.trim()) {
      const lastMsg = conv.lastMessage.trim();
      
      // Check if last message is a simple confirmation and try to make it more descriptive
      if (this.isSimpleConfirmation(lastMsg)) {
        const messageCount = conv.messageCount || 0;
        const lastActivity = conv.lastModified ? this.formatRelativeTime(new Date(conv.lastModified)) : 'recently';
        return `User confirmed action • ${messageCount} messages • ${lastActivity}`;
      }
      
      // Check if it's a tool-related message
      if (lastMsg.includes('Tool Result') || lastMsg.includes('[Tool:')) {
        return `Tool execution completed • ${this.truncateText(lastMsg, 60)}`;
      }
      
      return this.truncateText(lastMsg, 80);
    }
    
    // For empty conversations, show descriptive text
    const messageCount = conv.messageCount || 0;
    if (messageCount === 0) {
      return 'Empty conversation - click to start chatting';
    }
    
    // For conversations without lastMessage but with messages, show informative text
    const lastActivity = conv.lastModified ? this.formatRelativeTime(new Date(conv.lastModified)) : 'unknown';
    return `${messageCount} messages • Last activity ${lastActivity}`;
  }
  
  /**
   * Check if a message is a simple confirmation
   * @param {string} message - Message content
   * @returns {boolean} True if it's a simple confirmation
   */
  isSimpleConfirmation(message) {
    const trimmed = message.trim();
    const confirmationPatterns = [
      /^\[ok\]$/i,
      /^ok$/i,
      /^yes$/i,
      /^\[yes\]$/i,
      /^y$/i,
      /^\[y\]$/i,
      /^[1-9]$/,  // Choice selection
      /^(continue|proceed|accept|confirm|done)$/i
    ];
    
    return confirmationPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Get conversation preview text (legacy method - still used in other places)
   * @param {Object} conv - Conversation object
   * @param {string} state - Conversation state
   * @returns {string} Preview text
   */
  getConversationPreview(conv, state) {
    // If we have a last message, show it
    if (conv.lastMessage && conv.lastMessage.trim()) {
      return this.truncateText(conv.lastMessage, 60);
    }
    
    // Otherwise, show conversation info based on state and metadata
    const messageCount = conv.messageCount || 0;
    
    if (messageCount === 0) {
      return `Empty conversation • Project: ${conv.project || 'Unknown'}`;
    }
    
    // Show state-based preview
    if (state === 'Claude Code working...') {
      return `Claude is working • ${messageCount} messages`;
    } else if (state === 'Awaiting user input...') {
      return `Waiting for your input • ${messageCount} messages`;
    } else if (state === 'User typing...') {
      return `Ready for your message • ${messageCount} messages`;
    } else if (state === 'Recently active') {
      return `Recently active • ${messageCount} messages`;
    } else {
      return `${messageCount} messages • Last active ${this.formatRelativeTime(new Date(conv.lastModified))}`;
    }
  }

  /**
   * Get state CSS class
   * @param {string} state - Conversation state
   * @returns {string} CSS class
   */
  getStateClass(state) {
    const stateClasses = {
      'Claude Code working...': 'status-active',
      'Awaiting user input...': 'status-waiting',
      'User typing...': 'status-typing',
      'Awaiting response...': 'status-pending',
      'Recently active': 'status-recent',
      'Idle': 'status-idle',
      'Inactive': 'status-inactive',
      'Old': 'status-old',
      'unknown': 'status-unknown'
    };
    return stateClasses[state] || 'status-unknown';
  }

  /**
   * Get state label
   * @param {string} state - Conversation state
   * @returns {string} Human readable label
   */
  getStateLabel(state) {
    const stateLabels = {
      'Claude Code working...': 'Working',
      'Awaiting user input...': 'Awaiting input',
      'User typing...': 'Typing',
      'Awaiting response...': 'Awaiting response',
      'Recently active': 'Recent',
      'Idle': 'Idle',
      'Inactive': 'Inactive',
      'Old': 'Old',
      'unknown': 'Unknown'
    };
    return stateLabels[state] || state;
  }

  /**
   * Truncate text to specified length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Update filter
   * @param {string} filterName - Filter name
   * @param {string} value - Filter value
   */
  updateFilter(filterName, value) {
    this.filters[filterName] = value;
    // When filters change, restart from beginning
    this.refreshFromBeginning();
  }

  /**
   * Clear search
   */
  clearSearch() {
    const searchInput = this.container.querySelector('#search-filter');
    if (!searchInput) return; // Guard against null when AgentsPage isn't rendered
    
    searchInput.value = '';
    this.updateFilter('search', '');
  }

  /**
   * Clear all filters
   */
  clearAllFilters() {
    this.filters = {
      status: 'all',
      timeRange: '7d',
      search: ''
    };
    
    // Reset UI
    const statusFilter = this.container.querySelector('#status-filter');
    const timeFilter = this.container.querySelector('#time-filter');
    const searchFilter = this.container.querySelector('#search-filter');
    
    if (statusFilter) statusFilter.value = 'all';
    if (timeFilter) timeFilter.value = '7d';
    if (searchFilter) searchFilter.value = '';
    
    // Restart from beginning when clearing filters
    this.refreshFromBeginning();
  }

  /**
   * Refresh conversations display
   */
  refreshConversationsDisplay() {
    const conversations = this.stateService.getStateProperty('conversations') || [];
    const statesData = this.stateService.getStateProperty('conversationStates') || {};
    // Extract activeStates from the stored state data
    const activeStates = statesData?.activeStates || {};
    this.renderConversationsList(conversations, activeStates);
  }
  
  /**
   * Refresh from beginning - resets pagination
   */
  async refreshFromBeginning() {
    // Clear cache
    this.loadedConversations = [];
    this.loadedMessages.clear();
    
    // Reset pagination
    this.pagination = {
      currentPage: 0,
      limit: 10,
      hasMore: true,
      isLoading: false
    };
    
    // Clear list and reload
    const listContainer = this.container.querySelector('#conversations-list');
    if (listContainer) {
      listContainer.innerHTML = '';
    }
    
    await this.loadConversationsData();
  }

  /**
   * Refresh conversations data
   */
  async refreshConversations() {
    const refreshBtn = this.container.querySelector('#refresh-conversations');
    if (!refreshBtn) return; // Guard against null when AgentsPage isn't rendered
    
    refreshBtn.disabled = true;
    const iconElement = refreshBtn.querySelector('.btn-icon');
    if (iconElement) {
      iconElement.style.animation = 'spin 1s linear infinite';
    }

    try {
      // Clear both server and client cache to force fresh data
      await this.dataService.clearServerCache('conversations');
      await this.loadConversationsData();
    } catch (error) {
      console.error('Error refreshing conversations:', error);
      this.stateService.setError('Failed to refresh conversations');
    } finally {
      refreshBtn.disabled = false;
      if (iconElement) {
        iconElement.style.animation = '';
      }
    }
  }

  /**
   * Check if there are active filters
   * @returns {boolean} True if filters are active
   */
  hasActiveFilters() {
    const searchInput = this.container.querySelector('#conversation-search');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    // Check if search filter is active
    if (searchTerm) {
      return true;
    }
    
    // Check if state filters are active
    const filterButtons = this.container.querySelectorAll('.filter-btn');
    const activeFilters = Array.from(filterButtons).filter(btn => 
      btn.classList.contains('active') && btn.getAttribute('data-state') !== 'all'
    );
    
    return activeFilters.length > 0;
  }

  /**
   * Update results count
   * @param {number} count - Number of results
   * @param {boolean} hasActiveFilters - Whether filters are active
   */
  updateResultsCount(count, hasActiveFilters = false) {
    // Update main results count
    const resultsCount = this.container.querySelector('#results-count');
    if (resultsCount) {
      let countText = `${count} conversation${count !== 1 ? 's' : ''} found`;
      if (hasActiveFilters && this.pagination && this.pagination.totalCount && count < this.pagination.totalCount) {
        countText += ` (filtered from ${this.pagination.totalCount})`;
      }
      resultsCount.textContent = countText;
    }
    
    // Update sidebar count
    const sidebarCount = this.container.querySelector('#sidebar-count');
    if (sidebarCount) {
      sidebarCount.textContent = count;
    }
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    const conversationsList = this.container.querySelector('#conversations-list');
    const emptyState = this.container.querySelector('#empty-state');
    if (!conversationsList || !emptyState) return; // Guard against null when AgentsPage isn't rendered
    
    conversationsList.style.display = 'none';
    emptyState.style.display = 'flex';
  }

  /**
   * Hide empty state
   */
  hideEmptyState() {
    const conversationsList = this.container.querySelector('#conversations-list');
    const emptyState = this.container.querySelector('#empty-state');
    if (!conversationsList || !emptyState) return; // Guard against null when AgentsPage isn't rendered
    
    conversationsList.style.display = 'block';
    emptyState.style.display = 'none';
  }

  /**
   * Toggle between grid and table view
   * @param {string} view - View type ('grid' or 'table')
   */
  toggleView(view) {
    const toggleBtns = this.container.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    const gridElement = this.container.querySelector('#conversations-grid');
    const tableSection = this.container.querySelector('.conversations-table-section');
    
    if (!gridElement || !tableSection) return; // Guard against null when AgentsPage isn't rendered
    
    const gridSection = gridElement.parentNode;

    if (view === 'table') {
      gridSection.style.display = 'none';
      tableSection.style.display = 'block';
    } else {
      gridSection.style.display = 'block';
      tableSection.style.display = 'none';
    }
  }

  /**
   * View conversation details
   * @param {string} conversationId - Conversation ID
   */
  viewConversation(conversationId) {
    // This would open a detailed conversation view
    // Implementation would show conversation details modal or navigate to detail page
  }

  /**
   * Export single conversation
   * @param {string} conversationId - Conversation ID
   */
  exportSingleConversation(conversationId) {
    const conversations = this.stateService.getStateProperty('conversations') || [];
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    if (conversation) {
      const dataStr = JSON.stringify(conversation, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `conversation-${conversationId}-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Export all conversations
   */
  exportConversations() {
    const conversations = this.stateService.getStateProperty('conversations') || [];
    const states = this.stateService.getStateProperty('conversationStates') || {};
    const filteredConversations = this.filterConversations(conversations, states);
    
    const dataStr = JSON.stringify({
      conversations: filteredConversations,
      states: states,
      exportDate: new Date().toISOString(),
      filters: this.filters
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `claude-conversations-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * Update conversations display
   * @param {Array} conversations - Conversations data
   */
  updateConversationsDisplay(conversations) {
    const statesData = this.stateService.getStateProperty('conversationStates') || {};
    const activeStates = statesData?.activeStates || {};
    this.renderConversationsList(conversations, activeStates);
  }

  /**
   * Update conversation states
   * @param {Object} activeStates - Active conversation states (direct object, not nested)
   */
  updateConversationStates(activeStates) {
    if (!this.isInitialized) {
      console.warn('AgentsPage: updateConversationStates called before initialization');
      return;
    }
    
    // Check if we're still on the agents page by verifying our key element exists
    const conversationsContainer = this.container.querySelector('#conversations-list');
    if (!conversationsContainer) {
      console.log('AgentsPage: Not on agents page, skipping conversation states update');
      return;
    }
    
    const conversations = this.stateService.getStateProperty('conversations') || [];
    
    
    // Re-render conversation list with new states
    this.renderConversationsList(conversations, activeStates || {});
    
    // Update banner if we have a selected conversation
    if (this.selectedConversationId && activeStates && activeStates[this.selectedConversationId]) {
      this.updateStateBanner(this.selectedConversationId, activeStates[this.selectedConversationId]);
    }
  }

  /**
   * Handle conversation state change
   * @param {Object} _state - New state (unused but required by interface)
   */
  handleConversationStateChange(_state) {
    this.refreshConversationsDisplay();
  }

  /**
   * Update loading state
   * @param {boolean} isLoading - Loading state
   */
  updateLoadingState(isLoading) {
    const loadingState = this.container.querySelector('#conversations-loading');
    if (loadingState) {
      loadingState.style.display = isLoading ? 'flex' : 'none';
    }
  }

  /**
   * Update error state
   * @param {Error|string} error - Error object or message
   */
  updateErrorState(error) {
    const errorState = this.container.querySelector('#conversations-error');
    const errorMessage = this.container.querySelector('.error-message');
    
    if (errorState && errorMessage) {
      if (error) {
        errorMessage.textContent = error.message || error;
        errorState.style.display = 'flex';
      } else {
        errorState.style.display = 'none';
      }
    }
  }

  /**
   * Show message input area when conversation is selected
   */
  showMessageInput() {
    const inputArea = this.container.querySelector('#message-input-area');
    if (inputArea) {
      inputArea.style.display = 'block';
    }
  }
  
  /**
   * Hide message input area
   */
  hideMessageInput() {
    const inputArea = this.container.querySelector('#message-input-area');
    if (inputArea) {
      inputArea.style.display = 'none';
    }
  }
  
  /**
   * Update conversation context for sending messages
   */
  async updateConversationContext(conversationId) {
    const conversations = this.stateService.getStateProperty('conversations') || [];
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    if (conversation) {
      this.selectedConversationContext = {
        sessionId: conversationId,
        projectPath: conversation.projectPath || null,
        lastActivity: conversation.lastModified
      };
      
      // Session info removed from UI for cleaner design
      
      // Enable send button if there's text in input
      const messageInput = this.container.querySelector('#message-input');
      const sendBtn = this.container.querySelector('#send-message-btn');
      if (messageInput && sendBtn) {
        sendBtn.disabled = messageInput.value.trim().length === 0;
      }
    }
  }
  
  /**
   * Send message to Claude Code via API proxy
   */
  async sendMessage() {
    const messageInput = this.container.querySelector('#message-input');
    const sendBtn = this.container.querySelector('#send-message-btn');
    
    if (!messageInput || !sendBtn || !this.selectedConversationContext) {
      console.error('Missing required elements or context for sending message');
      return;
    }
    
    const messageContent = messageInput.value.trim();
    if (!messageContent) {
      return;
    }
    
    // Disable UI while sending
    sendBtn.disabled = true;
    sendBtn.innerHTML = '⏳';
    messageInput.disabled = true;
    
    try {
      // Send message via Claude API Proxy
      const response = await fetch('http://localhost:3335/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.selectedConversationContext.sessionId,
          message: messageContent,
          projectPath: this.selectedConversationContext.projectPath
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Clear input
        messageInput.value = '';
        
        // Show success feedback with instructions
        this.showMessageFeedback(
          'Message sent to Claude Code! Switch to your Claude Code terminal to see the response.', 
          'success'
        );
        
        // Show additional instruction
        setTimeout(() => {
          this.showMessageFeedback(
            '💡 Tip: Make sure Claude Code is active and waiting for input in your terminal.', 
            'info'
          );
        }, 2000);
        
        // Monitor for Claude Code response
        this.startResponseMonitor();
        
        // Optionally reload messages after a delay to show the new message
        setTimeout(() => {
          this.loadConversationMessages(this.selectedConversationId);
        }, 1000);
        
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      this.showMessageFeedback(`Error: ${error.message}`, 'error');
    } finally {
      // Re-enable UI
      sendBtn.disabled = false;
      sendBtn.innerHTML = '📤';
      messageInput.disabled = false;
      messageInput.focus();
    }
  }
  
  /**
   * Show feedback message for message sending
   */
  showMessageFeedback(message, type = 'info') {
    const inputArea = this.container.querySelector('#message-input-area');
    if (!inputArea) return;
    
    // Remove existing feedback
    const existingFeedback = inputArea.querySelector('.message-feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = `message-feedback message-feedback-${type}`;
    feedback.textContent = message;
    
    // Add styles
    feedback.style.cssText = `
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 0.8rem;
      margin-top: 8px;
      animation: fadeIn 0.3s ease;
      ${type === 'success' ? 'background: rgba(63, 185, 80, 0.1); color: var(--text-success); border: 1px solid rgba(63, 185, 80, 0.3);' : ''}
      ${type === 'error' ? 'background: rgba(248, 81, 73, 0.1); color: var(--text-error); border: 1px solid rgba(248, 81, 73, 0.3);' : ''}
      ${type === 'info' ? 'background: rgba(165, 214, 255, 0.1); color: var(--text-info); border: 1px solid rgba(165, 214, 255, 0.3);' : ''}
    `;
    
    inputArea.appendChild(feedback);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => feedback.remove(), 300);
      }
    }, 3000);
  }
  
  /**
   * Start monitoring for Claude Code response to sent message
   */
  startResponseMonitor() {
    if (this.responseMonitorInterval) {
      clearInterval(this.responseMonitorInterval);
    }
    
    const sessionId = this.selectedConversationId;
    let lastMessageCount = 0;
    let checkCount = 0;
    const maxChecks = 20; // Check for 60 seconds (20 checks * 3 seconds)
    
    // Get current message count
    const currentMessages = this.loadedMessages.get(sessionId) || [];
    lastMessageCount = currentMessages.length;
    
    console.log(`🔍 Starting response monitor for session ${sessionId} (current: ${lastMessageCount} messages)`);
    
    this.responseMonitorInterval = setInterval(async () => {
      checkCount++;
      
      try {
        // Reload conversation to check for new messages
        await this.loadConversationMessages(sessionId, false); // Don't reset pagination
        
        const updatedMessages = this.loadedMessages.get(sessionId) || [];
        
        if (updatedMessages.length > lastMessageCount) {
          console.log(`✅ Response detected! Messages: ${lastMessageCount} -> ${updatedMessages.length}`);
          
          // New message detected - show success notification
          this.showMessageFeedback('🎉 Claude Code responded!', 'success');
          
          // Stop monitoring
          clearInterval(this.responseMonitorInterval);
          this.responseMonitorInterval = null;
          return;
        }
        
        // Stop after max checks
        if (checkCount >= maxChecks) {
          console.log(`⏰ Response monitor timeout for session ${sessionId}`);
          this.showMessageFeedback(
            'No response yet. Check your Claude Code terminal or try sending the message again.', 
            'info'
          );
          
          clearInterval(this.responseMonitorInterval);
          this.responseMonitorInterval = null;
        }
        
      } catch (error) {
        console.error('Error in response monitor:', error);
        clearInterval(this.responseMonitorInterval);
        this.responseMonitorInterval = null;
      }
    }, 3000); // Check every 3 seconds instead of 1
  }
  
  /**
   * Format time for chat display (relative time)
   */
  formatTimeForChat(date) {
    if (!date) return '';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.floor(days/7)}w`;
    
    // For older messages, show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  
  /**
   * Get avatar text from name (first letter or initials)
   */
  getAvatarText(name) {
    if (!name) return 'C';
    
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    
    // Take first letter of first and second word
    return (words[0].charAt(0) + (words[1] ? words[1].charAt(0) : '')).toUpperCase();
  }
  
  /**
   * Check if conversation has unread messages (placeholder)
   */
  hasUnreadMessages(conversationId) {
    // For now, we'll assume no unread messages
    // In a real implementation, this would check against local storage or server state
    return false;
  }
  
  /**
   * Get unread message count (placeholder)
   */
  getUnreadCount(conversationId) {
    // For now, return 0
    // In a real implementation, this would return actual unread count
    return 0;
  }

  /**
   * Destroy agents page
   */
  destroy() {
    // Cleanup header component
    if (this.headerComponent) {
      this.headerComponent.destroy();
      this.headerComponent = null;
    }
    
    // Cleanup components
    Object.values(this.components).forEach(component => {
      if (component.destroy) {
        component.destroy();
      }
    });
    
    // Cleanup scroll listeners
    const messagesContent = this.container.querySelector('#messages-content');
    if (messagesContent && this.messagesScrollListener) {
      messagesContent.removeEventListener('scroll', this.messagesScrollListener);
    }
    
    // Cleanup response monitor
    if (this.responseMonitorInterval) {
      clearInterval(this.responseMonitorInterval);
      this.responseMonitorInterval = null;
    }
    
    // Unsubscribe from state changes
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    this.isInitialized = false;
  }
  
  /**
   * Handle mobile back button click
   */
  handleMobileBack() {
    if (this.isMobile()) {
      // Hide mobile header
      const mobileHeader = this.container.querySelector('#mobile-chat-header');
      if (mobileHeader) {
        mobileHeader.style.display = 'none';
      }
      
      // Clear selected conversation
      this.selectedConversationId = null;
      
      // Hide conversation details
      const conversationDetails = this.container.querySelector('.conversation-details');
      if (conversationDetails) {
        conversationDetails.style.display = 'none';
      }
      
      // Update selected conversation UI
      const previousSelected = this.container.querySelector('.sidebar-conversation-item.selected');
      if (previousSelected) {
        previousSelected.classList.remove('selected');
      }
      
      // Show the mobile chat submenu to return to conversation list
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && window.sidebarInstance) {
        window.sidebarInstance.toggleMobileChatSubmenu();
      }
    }
  }
  
  /**
   * Update mobile header with conversation info
   * @param {Object} conversation - Conversation object
   */
  updateMobileHeader(conversation) {
    if (!this.isMobile()) return;
    
    const mobileHeader = this.container.querySelector('#mobile-chat-header');
    const titleElement = this.container.querySelector('#mobile-chat-title');
    const subtitleElement = this.container.querySelector('#mobile-chat-subtitle');
    
    if (mobileHeader && titleElement && subtitleElement && conversation) {
      // Show mobile header
      mobileHeader.style.display = 'flex';
      
      // Update title and subtitle
      const projectName = conversation.project || 'Unknown Project';
      const conversationId = conversation.id.slice(-8);
      
      titleElement.textContent = projectName;
      subtitleElement.textContent = `Conversation ${conversationId}`;
    }
  }
  
  /**
   * Check if device is mobile
   * @returns {boolean}
   */
  isMobile() {
    return window.innerWidth <= 768;
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentsPage;
}