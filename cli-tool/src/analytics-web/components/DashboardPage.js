/**
 * DashboardPage - Analytics overview page without conversations
 * Focuses on metrics, charts, and system performance data
 */
class DashboardPage {
  constructor(container, services) {
    this.container = container;
    this.dataService = services.data;
    this.stateService = services.state;
    this.chartService = services.chart;
    
    this.components = {};
    this.refreshInterval = null;
    this.isInitialized = false;
    
    // Subscribe to state changes
    this.unsubscribe = this.stateService.subscribe(this.handleStateChange.bind(this));
  }

  /**
   * Initialize the dashboard page
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('📊 Initializing DashboardPage...');
    
    try {
      console.log('📊 Step 1: Rendering dashboard...');
      await this.render();
      console.log('✅ Dashboard rendered');
      
      // Now that DOM is ready, we can show loading
      this.stateService.setLoading(true);
      
      console.log('📊 Step 2: Loading initial data...');
      await this.loadInitialData();
      console.log('✅ Initial data loaded');
      
      console.log('📊 Step 3: Initializing components with data...');
      await this.initializeComponents();
      console.log('✅ Components initialized');
      
      console.log('📊 Step 4: Starting periodic refresh...');
      this.startPeriodicRefresh();
      console.log('✅ Periodic refresh started');
      
      this.isInitialized = true;
      console.log('🎉 DashboardPage fully initialized!');
    } catch (error) {
      console.error('❌ Error during dashboard initialization:', error);
      // Even if there's an error, show the dashboard with fallback data
      this.showFallbackDashboard();
    } finally {
      console.log('📊 Clearing loading state...');
      this.stateService.setLoading(false);
    }
  }

  /**
   * Show fallback dashboard when initialization fails
   */
  showFallbackDashboard() {
    console.log('🆘 Showing fallback dashboard...');
    try {
      const demoData = {
        summary: {
          totalConversations: 0,
          claudeSessions: 0,
          claudeSessionsDetail: 'no sessions',
          totalTokens: 0,
          activeProjects: 0,
          dataSize: '0 MB'
        },
        detailedTokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0
        },
        conversations: []
      };
      
      this.updateSummaryDisplay(demoData.summary, demoData.detailedTokenUsage, demoData);
      this.updateLastUpdateTime();
      this.stateService.setError('Dashboard loaded in offline mode');
      this.isInitialized = true;
    } catch (fallbackError) {
      console.error('❌ Fallback dashboard also failed:', fallbackError);
    }
  }

  /**
   * Handle state changes from StateService
   * @param {Object} state - New state
   * @param {string} action - Action that caused the change
   */
  handleStateChange(state, action) {
    switch (action) {
      case 'update_conversations':
        this.updateSummaryDisplay(state.summary);
        break;
      case 'update_conversation_states':
        this.updateSystemStatus(state.conversationStates);
        break;
      case 'set_loading':
        this.updateLoadingState(state.isLoading);
        break;
      case 'set_error':
        this.updateErrorState(state.error);
        break;
    }
  }

  /**
   * Render the dashboard page structure
   */
  async render() {
    this.container.innerHTML = `
      <div class="dashboard-page">
        <!-- Page Header -->
        <div class="page-header">
          <div class="header-content">
            <div class="header-left">
              <div class="status-header">
                <span class="session-timer-status-dot active" id="session-status-dot"></span>
                <h1 class="page-title">
                  Claude Code Analytics Dashboard
                  <span class="version-badge">v1.10.1</span>
                </h1>
              </div>
              <div class="page-subtitle">
                Real-time monitoring and analytics for Claude Code sessions
              </div>
              <div class="last-update-header">
                <span class="last-update-label">last update:</span>
                <span id="last-update-header-text">Never</span>
              </div>
            </div>
            <div class="header-right">
              <div class="theme-switch-container" title="Toggle light/dark theme">
                <div class="theme-switch" id="header-theme-switch">
                  <div class="theme-switch-track">
                    <div class="theme-switch-thumb" id="header-theme-switch-thumb">
                      <span class="theme-switch-icon">🌙</span>
                    </div>
                  </div>
                </div>
              </div>
              <a href="https://github.com/anthropics/claude-code-templates" target="_blank" class="github-link" title="Star on GitHub">
                <span class="github-icon">⭐</span>
                Star on GitHub
              </a>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons-container">
          <button class="action-btn-small" id="refresh-dashboard" title="Refresh data">
            <span class="btn-icon-small">🔄</span>
            Refresh
          </button>
          <button class="action-btn-small" id="export-data" title="Export analytics data">
            <span class="btn-icon-small">📤</span>
            Export
          </button>
        </div>

        <!-- FEATURE: Conversation Limit Control for Dashboard
             Allows users to limit how many conversations are loaded in the analytics calculations.
             This prevents memory issues and improves performance for users with large histories.
             The selected limit is persisted in localStorage for a consistent experience across sessions. -->
        <div class="conversation-limit-container" style="margin: 20px 0; padding: 15px; background: var(--bg-secondary); border: 1px solid var(--border-primary); border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
            <label style="color: var(--text-secondary); font-size: 0.95rem;">
              Show
              <select id="dashboard-conversation-limit" class="filter-select" style="margin: 0 8px; min-width: 80px;">
                <option value="25">25</option>
                <option value="50" selected>50</option>
                <option value="75">75</option>
                <option value="100">100</option>
                <option value="125">125</option>
                <option value="150">150</option>
                <option value="175">175</option>
                <option value="200">200</option>
                <option value="all">All</option>
              </select>
              out of <span id="total-conversations-count" style="font-weight: bold;">0</span> conversations
            </label>
            <span id="limit-info" style="color: var(--text-secondary); font-size: 0.85rem; font-style: italic;"></span>
          </div>
        </div>

        <!-- Loading State -->
        <div class="loading-state" id="dashboard-loading" style="display: none;">
          <div class="loading-spinner"></div>
          <span class="loading-text">Loading dashboard...</span>
        </div>

        <!-- Error State -->
        <div class="error-state" id="dashboard-error" style="display: none;">
          <div class="error-content">
            <span class="error-icon">⚠️</span>
            <span class="error-message"></span>
            <button class="error-retry" id="retry-load">Retry</button>
          </div>
        </div>

        <!-- Main Dashboard Content -->
        <div class="dashboard-content">
          <!-- Key Metrics Cards -->
          <div class="metrics-cards-container">
            <!-- Conversations Card -->
            <div class="metric-card">
              <div class="metric-header">
                <div class="metric-icon">💬</div>
                <div class="metric-title">Conversations</div>
              </div>
              <div class="metric-primary">
                <span class="metric-primary-value" id="totalConversations">0</span>
                <span class="metric-primary-label">Total</span>
              </div>
              <div class="metric-secondary">
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">This Month:</span>
                  <span class="metric-secondary-value" id="conversationsMonth">0</span>
                </div>
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">This Week:</span>
                  <span class="metric-secondary-value" id="conversationsWeek">0</span>
                </div>
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">Active:</span>
                  <span class="metric-secondary-value" id="activeConversations">0</span>
                </div>
              </div>
            </div>

            <!-- Sessions Card -->
            <div class="metric-card">
              <div class="metric-header">
                <div class="metric-icon">⚡</div>
                <div class="metric-title">Sessions</div>
              </div>
              <div class="metric-primary">
                <span class="metric-primary-value" id="claudeSessions">0</span>
                <span class="metric-primary-label">Total</span>
              </div>
              <div class="metric-secondary">
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">This Month:</span>
                  <span class="metric-secondary-value" id="sessionsMonth">0</span>
                </div>
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">This Week:</span>
                  <span class="metric-secondary-value" id="sessionsWeek">0</span>
                </div>
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">Projects:</span>
                  <span class="metric-secondary-value" id="activeProjects">0</span>
                </div>
              </div>
            </div>

            <!-- Tokens Card -->
            <div class="metric-card">
              <div class="metric-header">
                <div class="metric-icon">🔢</div>
                <div class="metric-title">Tokens</div>
              </div>
              <div class="metric-primary">
                <span class="metric-primary-value" id="totalTokens">0</span>
                <span class="metric-primary-label">Total</span>
              </div>
              <div class="metric-secondary">
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">Input:</span>
                  <span class="metric-secondary-value" id="inputTokens">0</span>
                </div>
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">Output:</span>
                  <span class="metric-secondary-value" id="outputTokens">0</span>
                </div>
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">Cache:</span>
                  <span class="metric-secondary-value" id="cacheTokens">0</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Session Timer Section -->
          <div class="session-timer-section">
            <div class="section-title">
              <h2>Current Session</h2>
            </div>
            <div id="session-timer-container">
              <!-- SessionTimer component will be mounted here -->
            </div>
          </div>

          <!-- Date Range Controls -->
          <div class="chart-controls">
            <div class="chart-controls-left">
              <label class="filter-label">date range:</label>
              <input type="date" id="dateFrom" class="date-input">
              <span class="date-separator">to</span>
              <input type="date" id="dateTo" class="date-input">
              <button class="filter-btn" id="applyDateFilter">apply</button>
            </div>
          </div>

          <!-- Charts Container (2x2 Grid) -->
          <div class="charts-container">
            <div class="chart-card">
              <div class="chart-title">
                📊 token usage over time
              </div>
              <canvas id="tokenChart" class="chart-canvas"></canvas>
            </div>
            
            <div class="chart-card">
              <div class="chart-title">
                🎯 project activity distribution
              </div>
              <canvas id="projectChart" class="chart-canvas"></canvas>
            </div>
            
            <div class="chart-card">
              <div class="chart-title">
                🛠️ tool usage trends
              </div>
              <canvas id="toolChart" class="chart-canvas"></canvas>
            </div>
            
            <div class="chart-card">
              <div class="chart-title">
                ⚡ tool activity summary
              </div>
              <div id="toolSummary" class="tool-summary">
                <!-- Tool summary will be loaded here -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.initializeTheme();
  }

  /**
   * Initialize child components
   */
  async initializeComponents() {
    // Initialize SessionTimer if available
    const sessionTimerContainer = this.container.querySelector('#session-timer-container');
    if (sessionTimerContainer && typeof SessionTimer !== 'undefined') {
      try {
        this.components.sessionTimer = new SessionTimer(
          sessionTimerContainer,
          this.dataService,
          this.stateService
        );
        await this.components.sessionTimer.initialize();
      } catch (error) {
        console.warn('SessionTimer initialization failed:', error);
        // Show fallback content
        sessionTimerContainer.innerHTML = `
          <div class="session-timer-placeholder">
            <p>Session timer not available</p>
          </div>
        `;
      }
    }

    // Initialize Charts with data if available
    await this.initializeChartsAsync();
    
    // Initialize Activity Feed
    this.initializeActivityFeed();
  }

  /**
   * Initialize charts asynchronously to prevent blocking main dashboard
   */
  async initializeChartsAsync() {
    try {
      console.log('📊 Starting asynchronous chart initialization...');
      await this.initializeCharts();
      
      // Update charts with data if available
      if (this.allData) {
        console.log('📊 Updating charts with loaded data...');
        this.updateChartData(this.allData);
        console.log('✅ Charts updated with data');
      }
    } catch (error) {
      console.error('❌ Chart initialization failed, dashboard will work without charts:', error);
      // Dashboard continues to work without charts
    }
  }

  /**
   * Initialize charts (Token Usage, Project Distribution, Tool Usage)
   */
  async initializeCharts() {
    // Destroy existing charts if they exist
    if (this.components.tokenChart) {
      this.components.tokenChart.destroy();
      this.components.tokenChart = null;
    }
    if (this.components.projectChart) {
      this.components.projectChart.destroy();
      this.components.projectChart = null;
    }
    if (this.components.toolChart) {
      this.components.toolChart.destroy();
      this.components.toolChart = null;
    }

    // Longer delay to ensure DOM is fully ready and previous charts are destroyed
    await new Promise(resolve => setTimeout(resolve, 250));

    // Get canvas elements with strict validation
    const tokenCanvas = this.container.querySelector('#tokenChart');
    const projectCanvas = this.container.querySelector('#projectChart');
    const toolCanvas = this.container.querySelector('#toolChart');

    // Validate all canvas elements exist and are properly attached to DOM
    if (!tokenCanvas || !projectCanvas || !toolCanvas) {
      console.error('❌ Chart canvas elements not found in DOM');
      console.log('Available elements:', {
        tokenCanvas: !!tokenCanvas,
        projectCanvas: !!projectCanvas, 
        toolCanvas: !!toolCanvas
      });
      return; // Don't initialize charts if canvas elements are missing
    }

    // Verify canvas elements are properly connected to the DOM
    if (!document.body.contains(tokenCanvas) || 
        !document.body.contains(projectCanvas) || 
        !document.body.contains(toolCanvas)) {
      console.error('❌ Chart canvas elements not properly attached to DOM');
      return;
    }

    // Force destroy any existing Chart instances
    try {
      if (Chart.getChart(tokenCanvas)) {
        console.log('🧹 Destroying existing tokenChart instance');
        Chart.getChart(tokenCanvas).destroy();
      }
      if (Chart.getChart(projectCanvas)) {
        console.log('🧹 Destroying existing projectChart instance');
        Chart.getChart(projectCanvas).destroy();
      }
      if (Chart.getChart(toolCanvas)) {
        console.log('🧹 Destroying existing toolChart instance');
        Chart.getChart(toolCanvas).destroy();
      }
    } catch (error) {
      console.warn('Warning during chart cleanup:', error);
    }

    // Validate canvas dimensions and ensure they're properly sized
    const canvases = [tokenCanvas, projectCanvas, toolCanvas];
    for (const canvas of canvases) {
      if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
        console.error('❌ Canvas has zero dimensions, waiting for layout...');
        await new Promise(resolve => setTimeout(resolve, 100));
        if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
          console.error('❌ Canvas still has zero dimensions after wait');
          return;
        }
      }
    }

    // Token Usage Chart (Linear)
    if (tokenCanvas) {
      try {
        console.log('📊 Creating token chart...');
        this.components.tokenChart = new Chart(tokenCanvas, {
          type: 'line',
          data: {
            labels: [],
            datasets: [{
              label: 'Tokens',
              data: [],
              borderColor: '#d57455',
              backgroundColor: 'rgba(213, 116, 85, 0.1)',
              tension: 0.4,
              fill: true
            }]
          },
          options: this.getTokenChartOptions()
        });
        console.log('✅ Token chart created successfully');
      } catch (error) {
        console.error('❌ Error creating token chart:', error);
      }
    }

    // Project Activity Distribution Chart (Pie)
    if (projectCanvas) {
      try {
        console.log('📊 Creating project chart...');
        this.components.projectChart = new Chart(projectCanvas, {
          type: 'doughnut',
          data: {
            labels: [],
            datasets: [{
              data: [],
              backgroundColor: [
                '#d57455', '#3fb950', '#f97316', '#a5d6ff', 
                '#f85149', '#7d8590', '#ffd33d', '#bf91f3'
              ],
              borderWidth: 0
            }]
          },
          options: this.getProjectChartOptions()
        });
        console.log('✅ Project chart created successfully');
      } catch (error) {
        console.error('❌ Error creating project chart:', error);
      }
    }

    // Tool Usage Trends Chart (Bar)
    if (toolCanvas) {
      try {
        console.log('📊 Creating tool chart...');
        this.components.toolChart = new Chart(toolCanvas, {
          type: 'bar',
          data: {
            labels: [],
            datasets: [{
              label: 'Usage Count',
              data: [],
              backgroundColor: [
                'rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)',
                'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
                'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)'
              ],
              borderColor: [
                'rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)',
                'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'
              ],
              borderWidth: 1
            }]
          },
          options: this.getToolChartOptions()
        });
        console.log('✅ Tool chart created successfully');
      } catch (error) {
        console.error('❌ Error creating tool chart:', error);
      }
    }

    console.log('🎉 All charts initialized successfully');

    // Initialize date inputs
    this.initializeDateInputs();
  }

  /**
   * Get token chart options
   */
  getTokenChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          mode: 'nearest',
          backgroundColor: '#161b22',
          titleColor: '#d57455',
          bodyColor: '#c9d1d9',
          borderColor: '#30363d',
          borderWidth: 1,
          cornerRadius: 4,
          displayColors: false,
          animation: {
            duration: 200
          },
          callbacks: {
            title: function(context) {
              return `Date: ${context[0].label}`;
            },
            label: function(context) {
              return `Tokens: ${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: '#30363d'
          },
          ticks: {
            color: '#7d8590'
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#30363d'
          },
          ticks: {
            color: '#7d8590',
            callback: function(value) {
              return value.toLocaleString();
            }
          }
        }
      }
    };
  }

  /**
   * Get project chart options
   */
  getProjectChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#c9d1d9',
            padding: 15,
            usePointStyle: true
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: '#161b22',
          titleColor: '#d57455',
          bodyColor: '#c9d1d9',
          borderColor: '#30363d',
          borderWidth: 1,
          cornerRadius: 4,
          displayColors: false,
          animation: {
            duration: 200
          },
          callbacks: {
            title: function(context) {
              return `Project: ${context[0].label}`;
            },
            label: function(context) {
              const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${context.parsed.toLocaleString()} conversations (${percentage}%)`;
            }
          }
        }
      },
      cutout: '60%'
    };
  }

  /**
   * Get tool chart options
   */
  getToolChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          mode: 'nearest',
          backgroundColor: '#161b22',
          titleColor: '#d57455',
          bodyColor: '#c9d1d9',
          borderColor: '#30363d',
          borderWidth: 1,
          cornerRadius: 4,
          displayColors: false,
          animation: {
            duration: 200
          },
          callbacks: {
            title: function(context) {
              return `Tool: ${context[0].label}`;
            },
            label: function(context) {
              return `Usage: ${context.parsed.y.toLocaleString()} times`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: '#30363d'
          },
          ticks: {
            color: '#7d8590',
            maxRotation: 45
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#30363d'
          },
          ticks: {
            color: '#7d8590',
            stepSize: 1
          }
        }
      }
    };
  }

  /**
   * Initialize activity feed
   */
  initializeActivityFeed() {
    const activityFeed = this.container.querySelector('#activity-feed');
    
    // Check if activity feed element exists
    if (!activityFeed) {
      console.log('ℹ️ Activity feed element not found, skipping initialization');
      return;
    }
    
    // Sample activity data (would be replaced with real data)
    const activities = [
      {
        type: 'session_start',
        message: 'New Claude Code session started',
        timestamp: new Date(),
        icon: '🚀'
      },
      {
        type: 'conversation_update',
        message: 'Conversation state updated',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        icon: '💬'
      },
      {
        type: 'system_event',
        message: 'Analytics server started',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        icon: '⚡'
      }
    ];
    
    activityFeed.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <div class="activity-icon">${activity.icon}</div>
        <div class="activity-content">
          <div class="activity-message">${activity.message}</div>
          <div class="activity-time">${this.formatTimestamp(activity.timestamp)}</div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Format timestamp for display
   * @param {Date} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(timestamp) {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return timestamp.toLocaleDateString();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Refresh button
    const refreshBtn = this.container.querySelector('#refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    // Export button
    const exportBtn = this.container.querySelector('#export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // Date filter controls
    const applyDateFilter = this.container.querySelector('#applyDateFilter');
    if (applyDateFilter) {
      applyDateFilter.addEventListener('click', () => this.applyDateFilter());
    }

    // Token popover events
    const totalTokens = this.container.querySelector('#totalTokens');
    if (totalTokens) {
      totalTokens.addEventListener('mouseenter', () => this.showTokenPopover());
      totalTokens.addEventListener('mouseleave', () => this.hideTokenPopover());
      totalTokens.addEventListener('click', () => this.showTokenPopover());
    }

    // Error retry
    const retryBtn = this.container.querySelector('#retry-load');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadInitialData());
    }

    // Theme toggle (header)
    const headerThemeSwitch = this.container.querySelector('#header-theme-switch');
    if (headerThemeSwitch) {
      headerThemeSwitch.addEventListener('click', () => this.toggleTheme());
    }

    // FEATURE: Dashboard conversation limit dropdown handler
    // Loads saved preference from localStorage and handles changes
    const limitDropdown = this.container.querySelector('#dashboard-conversation-limit');
    if (limitDropdown) {
      // Load saved preference from localStorage
      const savedLimit = localStorage.getItem('dashboardConversationLimit') || '50';
      limitDropdown.value = savedLimit;
      
      // Handle dropdown changes
      limitDropdown.addEventListener('change', async (e) => {
        const newLimit = e.target.value;
        
        // Save to localStorage for persistence across sessions
        localStorage.setItem('dashboardConversationLimit', newLimit);
        
        // Update info text
        const limitInfo = this.container.querySelector('#limit-info');
        if (limitInfo) {
          limitInfo.textContent = 'Reloading with new limit...';
        }
        
        // Reload data with new limit
        await this.loadInitialData();
      });
    }
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      // ENHANCEMENT: Get user's selected conversation limit from dropdown
      // This allows the dashboard to load only the specified number of conversations,
      // preventing memory issues and improving performance
      const limitDropdown = this.container.querySelector('#dashboard-conversation-limit');
      const limit = limitDropdown ? limitDropdown.value : '50';
      
      // First, get the full data to know total count
      const fullData = await this.dataService.getConversations();
      const totalCount = fullData.conversations ? fullData.conversations.length : 0;
      
      // Update the total count display
      const totalCountSpan = this.container.querySelector('#total-conversations-count');
      if (totalCountSpan) {
        totalCountSpan.textContent = totalCount;
      }
      
      // Update info text based on limit
      const limitInfo = this.container.querySelector('#limit-info');
      if (limitInfo) {
        if (limit === 'all' || parseInt(limit) >= totalCount) {
          limitInfo.textContent = 'Showing all conversations';
        } else {
          limitInfo.textContent = `Limited for better performance`;
        }
      }
      
      // Now load the limited data if needed
      let conversationsData;
      if (limit === 'all' || parseInt(limit) >= totalCount) {
        // Use full data if showing all or limit exceeds total
        conversationsData = fullData;
      } else {
        // Load limited data through paginated endpoint
        const limitedData = await this.dataService.getConversationsPaginated(0, parseInt(limit));
        // Merge with full data's summary info
        conversationsData = {
          ...fullData,
          conversations: limitedData.conversations
        };
      }
      
      const statesData = await this.dataService.getConversationStates();

      this.stateService.updateConversations(conversationsData.conversations);
      this.stateService.updateSummary(conversationsData.summary);
      this.stateService.updateConversationStates(statesData);
      
      // Update dashboard with original format
      this.updateSummaryDisplay(
        conversationsData.summary, 
        conversationsData.detailedTokenUsage, 
        conversationsData
      );
      
      this.updateLastUpdateTime();
      this.updateChartData(conversationsData);
    } catch (error) {
      console.error('Error loading initial data:', error);
      
      // Try to provide fallback demo data
      const demoData = {
        summary: {
          totalConversations: 0,
          claudeSessions: 0,
          claudeSessionsDetail: 'no sessions',
          totalTokens: 0,
          activeProjects: 0,
          dataSize: '0 MB'
        },
        detailedTokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0
        },
        conversations: []
      };
      
      this.updateSummaryDisplay(demoData.summary, demoData.detailedTokenUsage, demoData);
      this.updateLastUpdateTime();
      this.stateService.setError('Using offline mode - server connection failed');
    }
  }

  /**
   * Refresh all data
   */
  async refreshData() {
    const refreshBtn = this.container.querySelector('#refresh-dashboard');
    if (!refreshBtn) return;
    
    refreshBtn.disabled = true;
    refreshBtn.classList.add('loading');
    
    const btnIcon = refreshBtn.querySelector('.btn-icon-small');
    if (btnIcon) {
      btnIcon.classList.add('spin');
    }

    try {
      this.dataService.clearCache();
      await this.loadInitialData();
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.stateService.setError('Failed to refresh data');
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('loading');
      
      if (btnIcon) {
        btnIcon.classList.remove('spin');
      }
    }
  }

  /**
   * Update summary display (New Cards format)
   * @param {Object} summary - Summary data
   * @param {Object} detailedTokenUsage - Detailed token breakdown
   * @param {Object} allData - Complete dataset
   */
  updateSummaryDisplay(summary, detailedTokenUsage, allData) {
    if (!summary) return;

    // Calculate additional metrics
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    // Update primary metrics
    const totalConversations = this.container.querySelector('#totalConversations');
    const claudeSessions = this.container.querySelector('#claudeSessions');
    const totalTokens = this.container.querySelector('#totalTokens');

    if (totalConversations) totalConversations.textContent = summary.totalConversations?.toLocaleString() || '0';
    if (claudeSessions) claudeSessions.textContent = summary.claudeSessions?.toLocaleString() || '0';
    if (totalTokens) totalTokens.textContent = summary.totalTokens?.toLocaleString() || '0';

    // Update conversation secondary metrics
    const conversationsMonth = this.container.querySelector('#conversationsMonth');
    const conversationsWeek = this.container.querySelector('#conversationsWeek');
    const activeConversations = this.container.querySelector('#activeConversations');

    if (conversationsMonth) conversationsMonth.textContent = this.calculateTimeRangeCount(allData?.conversations, thisMonth).toLocaleString();
    if (conversationsWeek) conversationsWeek.textContent = this.calculateTimeRangeCount(allData?.conversations, thisWeek).toLocaleString();
    if (activeConversations) activeConversations.textContent = summary.activeConversations?.toLocaleString() || '0';

    // Update session secondary metrics
    const sessionsMonth = this.container.querySelector('#sessionsMonth');
    const sessionsWeek = this.container.querySelector('#sessionsWeek');
    const activeProjects = this.container.querySelector('#activeProjects');

    if (sessionsMonth) sessionsMonth.textContent = Math.max(1, Math.floor((summary.claudeSessions || 0) * 0.3)).toLocaleString();
    if (sessionsWeek) sessionsWeek.textContent = Math.max(1, Math.floor((summary.claudeSessions || 0) * 0.1)).toLocaleString();
    if (activeProjects) activeProjects.textContent = summary.activeProjects?.toLocaleString() || '0';

    // Update token secondary metrics
    if (detailedTokenUsage) {
      this.updateTokenBreakdown(detailedTokenUsage);
    }

    // Store data for chart updates
    this.allData = allData;
  }

  /**
   * Calculate count of items within a time range
   * @param {Array} items - Items with lastModified property
   * @param {Date} fromDate - Start date
   * @returns {number} Count of items
   */
  calculateTimeRangeCount(items, fromDate) {
    if (!items || !Array.isArray(items)) return 0;
    
    return items.filter(item => {
      if (!item.lastModified) return false;
      const itemDate = new Date(item.lastModified);
      return itemDate >= fromDate;
    }).length;
  }

  /**
   * Update token breakdown in cards
   * @param {Object} tokenUsage - Detailed token usage
   */
  updateTokenBreakdown(tokenUsage) {
    const inputTokens = this.container.querySelector('#inputTokens');
    const outputTokens = this.container.querySelector('#outputTokens');
    const cacheTokens = this.container.querySelector('#cacheTokens');

    if (inputTokens) inputTokens.textContent = tokenUsage.inputTokens?.toLocaleString() || '0';
    if (outputTokens) outputTokens.textContent = tokenUsage.outputTokens?.toLocaleString() || '0';
    
    // Combine cache creation and read tokens
    const totalCache = (tokenUsage.cacheCreationTokens || 0) + (tokenUsage.cacheReadTokens || 0);
    if (cacheTokens) cacheTokens.textContent = totalCache.toLocaleString();
  }

  /**
   * Show token popover
   */
  showTokenPopover() {
    const popover = this.container.querySelector('#tokenPopover');
    if (popover) {
      popover.style.display = 'block';
    }
  }

  /**
   * Hide token popover
   */
  hideTokenPopover() {
    const popover = this.container.querySelector('#tokenPopover');
    if (popover) {
      popover.style.display = 'none';
    }
  }

  /**
   * Initialize date inputs
   */
  initializeDateInputs() {
    const dateFrom = this.container.querySelector('#dateFrom');
    const dateTo = this.container.querySelector('#dateTo');
    
    if (!dateFrom || !dateTo) return;

    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    dateFrom.value = sevenDaysAgo.toISOString().split('T')[0];
    dateTo.value = today.toISOString().split('T')[0];
  }

  /**
   * Get date range from inputs
   */
  getDateRange() {
    const dateFrom = this.container.querySelector('#dateFrom');
    const dateTo = this.container.querySelector('#dateTo');
    
    let fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7); // Default to 7 days ago
    let toDate = new Date();
    
    if (dateFrom && dateFrom.value) {
      fromDate = new Date(dateFrom.value);
    }
    if (dateTo && dateTo.value) {
      toDate = new Date(dateTo.value);
      toDate.setHours(23, 59, 59, 999); // Include full day
    }
    
    return { fromDate, toDate };
  }

  /**
   * Apply date filter
   */
  applyDateFilter() {
    if (this.allData) {
      this.updateChartData(this.allData);
    }
  }

  /**
   * Refresh charts
   */
  async refreshCharts() {
    const refreshBtn = this.container.querySelector('#refreshCharts');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'refreshing...';
    }

    try {
      await this.loadInitialData();
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'refresh charts';
      }
    }
  }

  /**
   * Update system status
   * @param {Object} states - Conversation states
   */
  updateSystemStatus(states) {
    const activeCount = Object.values(states).filter(state => state === 'active').length;
    
    // Update WebSocket status
    const wsStatus = this.container.querySelector('#websocket-status');
    if (wsStatus) {
      const indicator = wsStatus.querySelector('.status-indicator');
      indicator.className = `status-indicator ${activeCount > 0 ? 'connected' : 'disconnected'}`;
      wsStatus.lastChild.textContent = activeCount > 0 ? 'Connected' : 'Disconnected';
    }
  }

  /**
   * Update chart data with real analytics
   * @param {Object} data - Analytics data
   */
  updateChartData(data) {
    if (!data || !data.conversations) return;

    this.updateTokenChart(data.conversations);
    this.updateProjectChart(data.conversations);
    this.updateToolChart(data.conversations);
    this.updateToolSummary(data.conversations);
  }

  /**
   * Update token usage chart
   */
  updateTokenChart(conversations) {
    if (!this.components.tokenChart) {
      console.warn('Token chart not initialized');
      return;
    }

    const { fromDate, toDate } = this.getDateRange();
    const filteredConversations = conversations.filter(conv => {
      const convDate = new Date(conv.lastModified);
      return convDate >= fromDate && convDate <= toDate;
    });

    // Group by date and sum tokens
    const tokensByDate = {};
    filteredConversations.forEach(conv => {
      const date = new Date(conv.lastModified).toDateString();
      tokensByDate[date] = (tokensByDate[date] || 0) + (conv.tokens || 0);
    });

    const sortedDates = Object.keys(tokensByDate).sort((a, b) => new Date(a) - new Date(b));
    const labels = sortedDates.map(date => new Date(date).toLocaleDateString());
    const data = sortedDates.map(date => tokensByDate[date]);

    console.log('📊 Token chart - tokensByDate:', tokensByDate);
    console.log('📊 Token chart - Labels:', labels);
    console.log('📊 Token chart - Data:', data);

    this.components.tokenChart.data.labels = labels;
    this.components.tokenChart.data.datasets[0].data = data;
    this.components.tokenChart.update();
  }

  /**
   * Update project distribution chart
   */
  updateProjectChart(conversations) {
    if (!this.components.projectChart) {
      console.warn('Project chart not initialized');
      return;
    }

    const { fromDate, toDate } = this.getDateRange();
    const filteredConversations = conversations.filter(conv => {
      const convDate = new Date(conv.lastModified);
      return convDate >= fromDate && convDate <= toDate;
    });

    // Group by project and sum tokens
    const projectTokens = {};
    filteredConversations.forEach(conv => {
      const project = conv.project || 'Unknown';
      projectTokens[project] = (projectTokens[project] || 0) + (conv.tokens || 0);
    });

    const labels = Object.keys(projectTokens);
    const data = Object.values(projectTokens);

    this.components.projectChart.data.labels = labels;
    this.components.projectChart.data.datasets[0].data = data;
    this.components.projectChart.update();
  }

  /**
   * Update tool usage chart
   */
  updateToolChart(conversations) {
    if (!this.components.toolChart) {
      console.warn('Tool chart not initialized');
      return;
    }

    const { fromDate, toDate } = this.getDateRange();
    const toolStats = {};

    conversations.forEach(conv => {
      if (conv.toolUsage && conv.toolUsage.toolTimeline) {
        conv.toolUsage.toolTimeline.forEach(entry => {
          const entryDate = new Date(entry.timestamp);
          if (entryDate >= fromDate && entryDate <= toDate) {
            toolStats[entry.tool] = (toolStats[entry.tool] || 0) + 1;
          }
        });
      }
    });

    const sortedTools = Object.entries(toolStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const labels = sortedTools.map(([tool]) => tool.length > 15 ? tool.substring(0, 15) + '...' : tool);
    const data = sortedTools.map(([, count]) => count);

    this.components.toolChart.data.labels = labels;
    this.components.toolChart.data.datasets[0].data = data;
    this.components.toolChart.update();
  }

  /**
   * Update tool summary panel
   */
  updateToolSummary(conversations) {
    const toolSummary = this.container.querySelector('#toolSummary');
    if (!toolSummary) return;

    const { fromDate, toDate } = this.getDateRange();
    const toolStats = {};
    let totalToolCalls = 0;
    let conversationsWithTools = 0;

    conversations.forEach(conv => {
      if (conv.toolUsage && conv.toolUsage.toolTimeline) {
        let convHasTools = false;
        conv.toolUsage.toolTimeline.forEach(entry => {
          const entryDate = new Date(entry.timestamp);
          if (entryDate >= fromDate && entryDate <= toDate) {
            toolStats[entry.tool] = (toolStats[entry.tool] || 0) + 1;
            totalToolCalls++;
            convHasTools = true;
          }
        });
        if (convHasTools) conversationsWithTools++;
      }
    });

    const uniqueTools = Object.keys(toolStats).length;
    const topTool = Object.entries(toolStats).sort((a, b) => b[1] - a[1])[0];

    toolSummary.innerHTML = `
      <div class="tool-stat">
        <span class="tool-stat-label">Total Tool Calls</span>
        <span class="tool-stat-value">${totalToolCalls.toLocaleString()}</span>
      </div>
      <div class="tool-stat">
        <span class="tool-stat-label">Unique Tools Used</span>
        <span class="tool-stat-value">${uniqueTools}</span>
      </div>
      <div class="tool-stat">
        <span class="tool-stat-label">Conversation Coverage</span>
        <span class="tool-stat-value">${Math.round((conversationsWithTools / conversations.length) * 100)}%</span>
      </div>
      ${topTool ? `
        <div class="tool-top-tool">
          <div class="tool-icon">🛠️</div>
          <div class="tool-info">
            <div class="tool-name">${topTool[0]}</div>
            <div class="tool-usage">${topTool[1]} calls</div>
          </div>
        </div>
      ` : ''}
    `;
  }

  /**
   * Update usage chart
   * @param {string} period - Time period
   */
  updateUsageChart(period) {
    console.log('Updating usage chart period to:', period);
    // Implementation would update chart with new period data
    this.updateChartData();
  }

  /**
   * Update performance chart
   * @param {string} type - Chart type
   */
  updatePerformanceChart(type) {
    console.log('Updating performance chart type to:', type);
    // Implementation would update chart with new metric type
    this.updateChartData();
  }

  /**
   * Show all activity
   */
  showAllActivity() {
    console.log('Showing all activity');
    // Implementation would show expanded activity view
  }

  /**
   * Export data
   */
  exportData() {
    const exportBtn = this.container.querySelector('#export-data');
    if (!exportBtn) return;
    
    // Show loading state
    exportBtn.disabled = true;
    exportBtn.classList.add('loading');
    
    const btnIcon = exportBtn.querySelector('.btn-icon-small');
    if (btnIcon) {
      btnIcon.classList.add('spin');
    }
    
    try {
      const dashboardData = {
        summary: this.stateService.getStateProperty('summary'),
        states: this.stateService.getStateProperty('conversationStates'),
        exportDate: new Date().toISOString(),
        type: 'dashboard_analytics'
      };
      
      const dataStr = JSON.stringify(dashboardData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-analytics-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      this.stateService.setError('Failed to export data');
    } finally {
      // Restore button state after short delay to show completion
      setTimeout(() => {
        exportBtn.disabled = false;
        exportBtn.classList.remove('loading');
        
        if (btnIcon) {
          btnIcon.classList.remove('spin');
        }
      }, 500);
    }
  }

  /**
   * Initialize theme from localStorage
   */
  initializeTheme() {
    const savedTheme = localStorage.getItem('claude-analytics-theme') || 'dark';
    const body = document.body;
    const headerThumb = this.container.querySelector('#header-theme-switch-thumb');
    const headerIcon = headerThumb?.querySelector('.theme-switch-icon');
    
    body.setAttribute('data-theme', savedTheme);
    if (headerThumb && headerIcon) {
      if (savedTheme === 'light') {
        headerThumb.classList.add('light');
        headerIcon.textContent = '☀️';
      } else {
        headerThumb.classList.remove('light');
        headerIcon.textContent = '🌙';
      }
    }
  }

  /**
   * Toggle theme between light and dark
   */
  toggleTheme() {
    const body = document.body;
    const headerThumb = this.container.querySelector('#header-theme-switch-thumb');
    const headerIcon = headerThumb?.querySelector('.theme-switch-icon');
    
    // Also sync with global theme switch
    const globalThumb = document.getElementById('themeSwitchThumb');
    const globalIcon = globalThumb?.querySelector('.theme-switch-icon');
    
    const isLight = body.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    
    body.setAttribute('data-theme', newTheme);
    
    // Update header theme switch
    if (headerThumb && headerIcon) {
      headerThumb.classList.toggle('light', newTheme === 'light');
      headerIcon.textContent = newTheme === 'light' ? '☀️' : '🌙';
    }
    
    // Sync with global theme switch
    if (globalThumb && globalIcon) {
      globalThumb.classList.toggle('light', newTheme === 'light');
      globalIcon.textContent = newTheme === 'light' ? '☀️' : '🌙';
    }
    
    localStorage.setItem('claude-analytics-theme', newTheme);
  }

  /**
   * Update last update time
   */
  updateLastUpdateTime() {
    const currentTime = new Date().toLocaleTimeString();
    
    // Update both locations
    const lastUpdateText = this.container.querySelector('#last-update-text');
    const lastUpdateHeaderText = this.container.querySelector('#last-update-header-text');
    
    if (lastUpdateText) {
      lastUpdateText.textContent = currentTime;
    }
    if (lastUpdateHeaderText) {
      lastUpdateHeaderText.textContent = currentTime;
    }
  }

  /**
   * Start periodic refresh
   */
  startPeriodicRefresh() {
    this.refreshInterval = setInterval(async () => {
      try {
        const statesData = await this.dataService.getConversationStates();
        this.stateService.updateConversationStates(statesData);
        this.updateLastUpdateTime();
      } catch (error) {
        console.error('Error during periodic refresh:', error);
      }
    }, 30000); // Refresh every 30 seconds
  }

  /**
   * Stop periodic refresh
   */
  stopPeriodicRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Update loading state
   * @param {boolean} isLoading - Loading state
   */
  updateLoadingState(isLoading) {
    console.log(`🔄 Updating loading state to: ${isLoading}`);
    const loadingState = this.container.querySelector('#dashboard-loading');
    if (loadingState) {
      loadingState.style.display = isLoading ? 'flex' : 'none';
      console.log(`✅ Loading state updated successfully to: ${isLoading ? 'visible' : 'hidden'}`);
    } else {
      console.warn('⚠️ Loading element #dashboard-loading not found');
      // Fallback: show/hide global loading instead
      const globalLoading = document.querySelector('#global-loading');
      if (globalLoading) {
        globalLoading.style.display = isLoading ? 'flex' : 'none';
        console.log(`✅ Global loading fallback updated to: ${isLoading ? 'visible' : 'hidden'}`);
      } else {
        console.warn('⚠️ Global loading element #global-loading also not found');
      }
    }
  }

  /**
   * Update error state
   * @param {Error|string} error - Error object or message
   */
  updateErrorState(error) {
    const errorState = this.container.querySelector('#dashboard-error');
    const errorMessage = this.container.querySelector('.error-message');
    
    if (error) {
      if (errorMessage) {
        errorMessage.textContent = error.message || error;
      }
      if (errorState) {
        errorState.style.display = 'flex';
      }
    } else {
      if (errorState) {
        errorState.style.display = 'none';
      }
    }
  }

  /**
   * Destroy dashboard page
   */
  destroy() {
    this.stopPeriodicRefresh();
    
    // Cleanup Chart.js instances specifically
    if (this.components.tokenChart) {
      this.components.tokenChart.destroy();
      this.components.tokenChart = null;
    }
    if (this.components.projectChart) {
      this.components.projectChart.destroy();
      this.components.projectChart = null;
    }
    if (this.components.toolChart) {
      this.components.toolChart.destroy();
      this.components.toolChart = null;
    }
    
    // Force cleanup any remaining Chart.js instances on canvas elements
    if (this.container) {
      const canvases = this.container.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
          existingChart.destroy();
        }
      });
    }
    
    // Cleanup other components
    Object.values(this.components).forEach(component => {
      if (component && component.destroy && typeof component.destroy === 'function') {
        component.destroy();
      }
    });
    
    // Clear components object
    this.components = {};
    
    // Unsubscribe from state changes
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    this.isInitialized = false;
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DashboardPage;
}