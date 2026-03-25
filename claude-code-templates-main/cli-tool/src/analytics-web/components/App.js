/**
 * App - Main application component that handles routing and navigation
 * Orchestrates the sidebar, dashboard, and agents pages
 */
class App {
  constructor(container, services) {
    this.container = container;
    this.services = services;
    
    this.components = {};
    this.currentPage = null; // Don't set default page yet
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    if (this.isInitialized) return;
    
    try {
      await this.render();
      await this.initializeComponents();
      await this.setupRouting();
      this.bindEvents();
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing app:', error);
      this.showError('Failed to initialize application');
    }
  }

  /**
   * Render the application structure
   */
  async render() {
    this.container.innerHTML = `
      <div class="app">
        <!-- Sidebar Navigation -->
        <aside class="app-sidebar" id="app-sidebar">
          <!-- Sidebar component will be mounted here -->
        </aside>
        
        <!-- Main Content Area -->
        <main class="app-main" id="app-main">
          <div class="app-content" id="app-content">
            <!-- Page content will be mounted here -->
          </div>
        </main>
        
        <!-- Global Loading Overlay -->
        <div class="global-loading" id="global-loading" style="display: none;">
          <div class="loading-content">
            <div class="loading-spinner large"></div>
            <span class="loading-text">Loading...</span>
          </div>
        </div>
        
        <!-- Global Error Modal -->
        <div class="error-modal" id="error-modal" style="display: none;">
          <div class="error-modal-content">
            <div class="error-modal-header">
              <h3>Application Error</h3>
              <button class="error-modal-close" id="error-modal-close">×</button>
            </div>
            <div class="error-modal-body">
              <p class="error-modal-message" id="error-modal-message"></p>
            </div>
            <div class="error-modal-footer">
              <button class="btn btn-primary" id="error-modal-retry">Retry</button>
              <button class="btn btn-secondary" id="error-modal-dismiss">Dismiss</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Initialize child components
   */
  async initializeComponents() {
    // Initialize Sidebar
    const sidebarContainer = this.container.querySelector('#app-sidebar');
    if (typeof Sidebar !== 'undefined') {
      this.components.sidebar = new Sidebar(sidebarContainer, this.handleNavigation.bind(this));
    } else {
      throw new Error('Sidebar component not available. Check if components/Sidebar.js is loaded.');
    }
    
    // Initialize pages
    this.components.pages = {};
    
    // Don't load any page yet - wait for routing to determine the correct page
  }

  /**
   * Setup routing (hash-based routing for SPA behavior)
   */
  setupRouting() {
    // Handle browser navigation
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1) || 'dashboard';
      this.navigateToPage(hash);
    });
    
    // Set initial route
    const initialHash = window.location.hash.slice(1) || 'dashboard';
    this.navigateToPage(initialHash);
  }

  /**
   * Bind global event listeners
   */
  bindEvents() {
    // Sidebar toggle handler
    window.addEventListener('sidebar-toggle', (event) => {
      this.handleSidebarToggle(event.detail.collapsed);
    });
    
    // Error modal events
    const errorModalClose = this.container.querySelector('#error-modal-close');
    const errorModalDismiss = this.container.querySelector('#error-modal-dismiss');
    const errorModalRetry = this.container.querySelector('#error-modal-retry');
    
    errorModalClose.addEventListener('click', () => this.hideError());
    errorModalDismiss.addEventListener('click', () => this.hideError());
    errorModalRetry.addEventListener('click', () => this.retryLastAction());
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  /**
   * Handle navigation from sidebar
   * @param {string} page - Page to navigate to
   */
  async handleNavigation(page) {
    await this.navigateToPage(page);
  }

  /**
   * Navigate to a specific page
   * @param {string} page - Page to navigate to
   */
  async navigateToPage(page) {
    if (page === this.currentPage && this.currentPage !== null) return;
    
    try {
      this.showGlobalLoading();
      
      // Cleanup current page
      await this.cleanupCurrentPage();
      
      // Load new page
      await this.loadPage(page);
      
      // Update state
      this.currentPage = page;
      
      // Update URL hash
      window.location.hash = page;
      
      // Update sidebar active state
      if (this.components.sidebar) {
        this.components.sidebar.setActivePage(page);
      }
      
    } catch (error) {
      console.error('Error navigating to page:', page, error);
      this.showError(`Failed to load ${page} page`);
    } finally {
      this.hideGlobalLoading();
    }
  }

  /**
   * Load a specific page
   * @param {string} page - Page to load
   */
  async loadPage(page) {
    const contentContainer = this.container.querySelector('#app-content');
    
    if (!contentContainer) {
      throw new Error('App content container not found');
    }
    
    console.log(`🚀 Loading page: ${page} (optimized - single page load)`);
    
    // First, destroy any existing page component for this page
    if (this.components.pages[page] && this.components.pages[page].destroy) {
      console.log(`🧹 Destroying existing ${page} page component`);
      this.components.pages[page].destroy();
      this.components.pages[page] = null;
    }
    
    // Clear content container
    contentContainer.innerHTML = '';
    
    // Create new page component
    await this.createPageComponent(page, contentContainer);
    
    // Call showPage for any additional setup
    await this.showPage(page);
    
    console.log(`✅ Page '${page}' loaded successfully`);
  }

  /**
   * Create page component
   * @param {string} page - Page type
   * @param {HTMLElement} container - Container element
   */
  async createPageComponent(page, container) {
    // Cleanup existing page component if it exists
    if (this.components.pages[page] && this.components.pages[page].destroy) {
      this.components.pages[page].destroy();
    }
    
    switch (page) {
      case 'dashboard':
        if (typeof DashboardPage !== 'undefined') {
          this.components.pages.dashboard = new DashboardPage(container, this.services);
          await this.components.pages.dashboard.initialize();
        } else {
          throw new Error('DashboardPage component not available. Check if components/DashboardPage.js is loaded.');
        }
        break;
        
      case 'agents':
        if (typeof AgentsPage !== 'undefined') {
          this.components.pages.agents = new AgentsPage(container, this.services);
          await this.components.pages.agents.initialize();
          // Expose agentsPage globally for modal access
          if (typeof window !== 'undefined' && window.claudeAnalyticsApp) {
            window.claudeAnalyticsApp.agentsPage = this.components.pages.agents;
            console.log('✅ Exposed agentsPage globally for modal access');
          }
        } else {
          throw new Error('AgentsPage component not available. Check if components/AgentsPage.js is loaded.');
        }
        break;
        
      default:
        throw new Error(`Unknown page: ${page}`);
    }
  }

  /**
   * Show a specific page (simplified - loadPage handles everything)
   * @param {string} page - Page to show
   */
  async showPage(page) {
    // This method is now mainly for compatibility
    // The actual work is done in loadPage
    if (this.components.pages[page] && this.components.pages[page].onActivate) {
      try {
        await this.components.pages[page].onActivate();
      } catch (error) {
        console.warn(`Warning: onActivate failed for ${page}:`, error);
      }
    }
  }

  /**
   * Cleanup current page
   */
  async cleanupCurrentPage() {
    // Skip cleanup if no current page
    if (!this.currentPage) return;
    
    // Clean up global references
    if (this.currentPage === 'agents' && typeof window !== 'undefined' && window.claudeAnalyticsApp) {
      window.claudeAnalyticsApp.agentsPage = undefined;
      console.log('🧹 Cleaned up global agentsPage reference');
    }
    
    const currentPageComponent = this.components.pages[this.currentPage];
    if (currentPageComponent && currentPageComponent.onDeactivate) {
      await currentPageComponent.onDeactivate();
    }
  }

  /**
   * Handle sidebar toggle
   * @param {boolean} collapsed - Whether sidebar is collapsed
   */
  handleSidebarToggle(collapsed) {
    const appMain = this.container.querySelector('#app-main');
    appMain.classList.toggle('sidebar-collapsed', collapsed);
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + number keys for quick navigation
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      switch (e.key) {
        case '1':
          e.preventDefault();
          this.navigateToPage('dashboard');
          break;
        case '2':
          e.preventDefault();
          this.navigateToPage('agents');
          break;
        case 'r':
          e.preventDefault();
          this.refreshCurrentPage();
          break;
      }
    }
    
    // Escape key to close modals
    if (e.key === 'Escape') {
      this.hideError();
    }
  }

  /**
   * Refresh current page
   */
  async refreshCurrentPage() {
    const currentPageComponent = this.components.pages[this.currentPage];
    if (currentPageComponent && currentPageComponent.refreshData) {
      await currentPageComponent.refreshData();
    }
  }

  /**
   * Show global loading
   */
  showGlobalLoading() {
    const loadingOverlay = this.container.querySelector('#global-loading');
    loadingOverlay.style.display = 'flex';
  }

  /**
   * Hide global loading
   */
  hideGlobalLoading() {
    const loadingOverlay = this.container.querySelector('#global-loading');
    loadingOverlay.style.display = 'none';
  }

  /**
   * Show error modal
   * @param {string} message - Error message
   */
  showError(message) {
    const errorModal = this.container.querySelector('#error-modal');
    const errorMessage = this.container.querySelector('#error-modal-message');
    
    errorMessage.textContent = message;
    errorModal.style.display = 'flex';
    
    this.lastError = message;
  }

  /**
   * Hide error modal
   */
  hideError() {
    const errorModal = this.container.querySelector('#error-modal');
    errorModal.style.display = 'none';
  }

  /**
   * Retry last action that caused an error
   */
  async retryLastAction() {
    this.hideError();
    
    try {
      // Retry loading current page
      await this.loadPage(this.currentPage);
    } catch (error) {
      console.error('Retry failed:', error);
      this.showError('Retry failed. Please refresh the page.');
    }
  }

  /**
   * Get current page name
   * @returns {string} Current page name
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Get page component
   * @param {string} page - Page name
   * @returns {Object|null} Page component
   */
  getPageComponent(page) {
    return this.components.pages[page] || null;
  }

  /**
   * Check if page is loaded
   * @param {string} page - Page name
   * @returns {boolean} Whether page is loaded
   */
  isPageLoaded(page) {
    return !!this.components.pages[page];
  }

  /**
   * Destroy application
   */
  destroy() {
    // Cleanup pages
    Object.values(this.components.pages).forEach(page => {
      if (page.destroy) {
        page.destroy();
      }
    });
    
    // Cleanup sidebar
    if (this.components.sidebar && this.components.sidebar.destroy) {
      this.components.sidebar.destroy();
    }
    
    // Remove event listeners
    window.removeEventListener('hashchange', this.handleNavigation);
    window.removeEventListener('sidebar-toggle', this.handleSidebarToggle);
    document.removeEventListener('keydown', this.handleKeyboardShortcuts);
    
    this.isInitialized = false;
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}