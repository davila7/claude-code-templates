/**
 * Main application entry point for the modular analytics dashboard
 * This replaces the embedded JavaScript in index.html
 */

/**
 * AnalyticsDashboard - Main application class
 * Orchestrates all services and components
 */
class AnalyticsDashboard {
  constructor() {
    this.services = {};
    this.components = {};
    this.isInitialized = false;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Analytics Dashboard...');
      
      await this.initializeServices();
      await this.initializeComponents();
      await this.startApplication();
      
      this.isInitialized = true;
      console.log('✅ Analytics Dashboard initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Analytics Dashboard:', error);
      this.showError('Failed to initialize dashboard: ' + error.message);
    }
  }

  /**
   * Initialize all services
   */
  async initializeServices() {
    console.log('🔧 Initializing services...');
    
    // Initialize WebSocketService
    this.services.webSocket = new WebSocketService();
    
    // Initialize DataService with WebSocket integration
    this.services.data = new DataService(this.services.webSocket);
    
    // Initialize StateService
    this.services.state = new StateService();
    
    // Initialize Charts service (placeholder)
    this.services.chart = new Charts(null, this.services.data, this.services.state);
    
    // Setup DataService -> StateService integration for real-time updates
    this.services.data.addEventListener((type, data) => {
      switch (type) {
        case 'new_message':
          // Route new message events to StateService which will notify AgentsPage
          this.services.state.notifyListeners('new_message', data);
          break;
        case 'conversation_state_change':
          // Route state changes to StateService
          this.services.state.notifyListeners('conversation_state_change', data);
          break;
        case 'data_refresh':
          // Route data refresh events to StateService
          this.services.state.notifyListeners('data_refresh', data);
          break;
      }
    });
    
    // Connect WebSocket (will fallback to polling if connection fails)
    try {
      await this.services.webSocket.connect();
      console.log('✅ WebSocket connected successfully');
    } catch (error) {
      console.log('⚠️ WebSocket connection failed, falling back to polling');
    }
    
    // Start periodic data refresh (will adjust based on WebSocket availability)
    this.services.data.startPeriodicRefresh();
    
    console.log('✅ Services initialized');
  }

  /**
   * Initialize all components
   */
  async initializeComponents() {
    console.log('🎨 Initializing components...');
    
    // Get main container
    const container = document.getElementById('app') || document.body;
    
    // Initialize Dashboard component
    this.components.dashboard = new Dashboard(container, this.services);
    await this.components.dashboard.initialize();
    
    console.log('✅ Components initialized');
  }

  /**
   * Start the application
   */
  async startApplication() {
    console.log('🎯 Starting application...');
    
    // Setup global error handling
    this.setupErrorHandling();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Setup visibility change handling
    this.setupVisibilityHandling();
    
    console.log('✅ Application started');
  }

  /**
   * Setup global error handling
   */
  setupErrorHandling() {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.services.state.setError(`Application error: ${event.error.message}`);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.services.state.setError(`Promise rejection: ${event.reason.message || event.reason}`);
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ctrl/Cmd + R - Refresh data
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        this.refreshData();
      }
      
      // Ctrl/Cmd + E - Export data
      if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
        event.preventDefault();
        this.exportData();
      }
      
      // Escape - Clear errors
      if (event.key === 'Escape') {
        this.services.state.clearError();
      }
    });
  }

  /**
   * Setup visibility change handling
   */
  setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is hidden - pause updates
        this.services.data.stopPeriodicRefresh();
      } else {
        // Page is visible - resume updates
        this.services.data.startPeriodicRefresh();
        // Immediately refresh data
        this.refreshData();
      }
    });
  }

  /**
   * Refresh all data
   */
  async refreshData() {
    console.log('🔄 Refreshing data...');
    try {
      this.services.data.clearCache();
      
      const [conversationsData, statesData] = await Promise.all([
        this.services.data.getConversations(),
        this.services.data.getConversationStates()
      ]);

      this.services.state.updateConversations(conversationsData.conversations);
      this.services.state.updateSummary(conversationsData.summary);
      this.services.state.updateConversationStates(statesData);
      
      console.log('✅ Data refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh data:', error);
      this.services.state.setError('Failed to refresh data: ' + error.message);
    }
  }

  /**
   * Export data
   */
  exportData() {
    if (this.components.dashboard) {
      this.components.dashboard.exportData();
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    // Create error display if components aren't ready
    const errorDiv = document.createElement('div');
    errorDiv.className = 'initialization-error';
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f85149;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 10000;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    errorDiv.innerHTML = `
      <strong>Initialization Error</strong><br>
      ${message}
      <button onclick="this.parentElement.remove()" style="
        background: none;
        border: none;
        color: white;
        float: right;
        cursor: pointer;
        font-size: 16px;
        margin-top: -5px;
      ">×</button>
    `;
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 10000);
  }

  /**
   * Cleanup and destroy application
   */
  destroy() {
    console.log('🧹 Cleaning up application...');
    
    // Stop services
    if (this.services.data) {
      this.services.data.stopPeriodicRefresh();
    }
    
    // Destroy components
    Object.values(this.components).forEach(component => {
      if (component.destroy) {
        component.destroy();
      }
    });
    
    // Clear references
    this.services = {};
    this.components = {};
    this.isInitialized = false;
    
    console.log('✅ Application cleaned up');
  }

  /**
   * Get application statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      services: Object.keys(this.services).length,
      components: Object.keys(this.components).length,
      dataServiceStats: this.services.data ? this.services.data.getCacheStats() : null,
      stateServiceStats: this.services.state ? this.services.state.getStateStats() : null
    };
  }
}

// Global application instance
let analyticsApp = null;

/**
 * Initialize the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📱 DOM Content Loaded - Starting Analytics Dashboard');
  
  try {
    analyticsApp = new AnalyticsDashboard();
    await analyticsApp.initialize();
    
    // Make app available globally for debugging
    window.analyticsApp = analyticsApp;
    
    // Add development helpers
    if (window.location.hostname === 'localhost') {
      window.refreshDashboard = () => analyticsApp.refreshData();
      window.getAppStats = () => analyticsApp.getStats();
      console.log('🔧 Development helpers available: refreshDashboard(), getAppStats()');
    }
    
  } catch (error) {
    console.error('❌ Failed to start Analytics Dashboard:', error);
  }
});

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  if (analyticsApp) {
    analyticsApp.destroy();
  }
});

/**
 * Handle browser back/forward navigation
 */
window.addEventListener('popstate', () => {
  if (analyticsApp) {
    analyticsApp.refreshData();
  }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsDashboard;
}