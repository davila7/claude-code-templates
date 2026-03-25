/**
 * StateService - Manages application state and state changes
 * Part of the modular frontend architecture
 */
class StateService {
  constructor() {
    this.state = {
      conversations: [],
      summary: {},
      chartData: {},
      selectedConversation: null,
      conversationStates: {},
      systemHealth: {},
      isLoading: false,
      error: null,
      lastUpdate: null
    };
    
    this.subscribers = new Set();
    this.stateHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Callback to call on state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get specific state property
   * @param {string} key - State property key
   * @returns {*} State property value
   */
  getStateProperty(key) {
    return this.state[key];
  }

  /**
   * Update state and notify subscribers
   * @param {Object} newState - New state object
   * @param {string} action - Action that caused the state change
   */
  setState(newState, action = 'setState') {
    // Save current state to history
    this.saveStateToHistory(action);

    // Update state
    this.state = {
      ...this.state,
      ...newState,
      lastUpdate: Date.now()
    };

    // Notify all subscribers
    this.notifySubscribers(action, newState);
  }

  /**
   * Update specific state property
   * @param {string} key - State property key
   * @param {*} value - New value
   * @param {string} action - Action that caused the change
   */
  setStateProperty(key, value, action = `set_${key}`) {
    this.setState({ [key]: value }, action);
  }

  /**
   * Save current state to history
   * @param {string} action - Action that caused the state change
   */
  saveStateToHistory(action) {
    this.stateHistory.push({
      state: { ...this.state },
      action,
      timestamp: Date.now()
    });

    // Keep history size manageable
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  /**
   * Notify all subscribers of state changes
   * @param {string} action - Action that caused the change
   * @param {Object} changedState - The state that changed
   */
  notifySubscribers(action, changedState) {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state, action, changedState);
      } catch (error) {
        console.error('Error in StateService subscriber:', error);
      }
    });
  }
  
  /**
   * Notify listeners with specific action and data (alias for real-time events)
   * @param {string} action - Action type
   * @param {Object} data - Event data
   */
  notifyListeners(action, data) {
    this.notifySubscribers(action, data);
  }

  /**
   * Update conversations data
   * @param {Array} conversations - New conversations data
   */
  updateConversations(conversations) {
    this.setState({ conversations }, 'update_conversations');
  }

  /**
   * Update conversation states for real-time updates
   * @param {Object} states - New conversation states
   */
  updateConversationStates(states) {
    this.setState({ conversationStates: states }, 'update_conversation_states');
  }

  /**
   * Update summary statistics
   * @param {Object} summary - New summary data
   */
  updateSummary(summary) {
    this.setState({ summary }, 'update_summary');
  }

  /**
   * Update chart data
   * @param {Object} chartData - New chart data
   */
  updateChartData(chartData) {
    this.setState({ chartData }, 'update_chart_data');
  }

  /**
   * Set selected conversation
   * @param {Object} conversation - Selected conversation
   */
  setSelectedConversation(conversation) {
    this.setState({ selectedConversation: conversation }, 'select_conversation');
  }

  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading(isLoading) {
    this.setState({ isLoading }, 'set_loading');
  }

  /**
   * Set error state
   * @param {Error|string} error - Error object or message
   */
  setError(error) {
    this.setState({ error }, 'set_error');
  }

  /**
   * Clear error state
   */
  clearError() {
    this.setState({ error: null }, 'clear_error');
  }

  /**
   * Update system health
   * @param {Object} health - System health data
   */
  updateSystemHealth(health) {
    this.setState({ systemHealth: health }, 'update_system_health');
  }

  /**
   * Handle conversation state change notification
   * @param {string} conversationId - ID of the conversation that changed
   * @param {string} newState - New state of the conversation
   */
  notifyConversationStateChange(conversationId, newState) {
    const currentStates = { ...this.state.conversationStates };
    currentStates[conversationId] = newState;
    
    this.setState({ conversationStates: currentStates }, 'conversation_state_change');
    
    // Also update the conversation in the conversations array
    const updatedConversations = this.state.conversations.map(conv => 
      conv.id === conversationId ? { ...conv, status: newState } : conv
    );
    
    this.setState({ conversations: updatedConversations }, 'update_conversation_status');
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Conversation ID
   * @returns {Object|null} Conversation object or null if not found
   */
  getConversationById(conversationId) {
    return this.state.conversations.find(conv => conv.id === conversationId) || null;
  }

  /**
   * Get conversations by status
   * @param {string} status - Conversation status
   * @returns {Array} Array of conversations with specified status
   */
  getConversationsByStatus(status) {
    return this.state.conversations.filter(conv => conv.status === status);
  }

  /**
   * Get state history
   * @returns {Array} State history
   */
  getStateHistory() {
    return [...this.stateHistory];
  }

  /**
   * Clear state history
   */
  clearStateHistory() {
    this.stateHistory = [];
  }

  /**
   * Reset state to initial values
   */
  resetState() {
    this.setState({
      conversations: [],
      summary: {},
      chartData: {},
      selectedConversation: null,
      conversationStates: {},
      systemHealth: {},
      isLoading: false,
      error: null,
      lastUpdate: null
    }, 'reset_state');
  }

  /**
   * Get state statistics
   * @returns {Object} State statistics
   */
  getStateStats() {
    return {
      subscribers: this.subscribers.size,
      historySize: this.stateHistory.length,
      conversationsCount: this.state.conversations.length,
      lastUpdate: this.state.lastUpdate,
      hasError: !!this.state.error,
      isLoading: this.state.isLoading
    };
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateService;
}