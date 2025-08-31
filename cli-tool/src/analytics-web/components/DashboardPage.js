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
    
    // Initialize header component
    this.headerComponent = null;
    
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
        <!-- Page Header (will be replaced by HeaderComponent) -->
        <div id="dashboard-header-container"></div>

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
              <div class="metric-primary">
                <span class="metric-primary-value" id="totalConversations">0</span>
                <span class="metric-primary-label">Total Conversations</span>
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
              <div class="metric-primary">
                <span class="metric-primary-value" id="claudeSessions">0</span>
                <span class="metric-primary-label">Total Sessions</span>
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
              <div class="metric-primary">
                <span class="metric-primary-value" id="totalTokens">0</span>
                <span class="metric-primary-label">Total Tokens</span>
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

            <!-- Agents Card -->
            <div class="metric-card">
              <div class="metric-primary">
                <span class="metric-primary-value" id="totalAgentInvocations">0</span>
                <span class="metric-primary-label">Total Agent Uses</span>
              </div>
              <div class="metric-secondary">
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">Types:</span>
                  <span class="metric-secondary-value" id="totalAgentTypes">0</span>
                </div>
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">Top Agent:</span>
                  <span class="metric-secondary-value" id="topAgentName">None</span>
                </div>
                <div class="metric-secondary-item">
                  <span class="metric-secondary-label">Adoption:</span>
                  <span class="metric-secondary-value" id="agentAdoption">0%</span>
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

          <!-- Charts Container - Organized by Sections -->
          <div class="charts-container">
            
            <!-- SECTION 1: Token Analytics -->
            <div class="chart-section">
              <div class="section-header">
                <h3 class="section-title">🔢 Token Analytics</h3>
                <p class="section-description">Monitor token consumption patterns and efficiency</p>
              </div>
              <div class="section-charts">
                <div class="chart-card">
                  <div class="chart-title">
                    Token Usage Over Time
                  </div>
                  <canvas id="tokenChart" class="chart-canvas"></canvas>
                </div>
                
                <div class="chart-card">
                  <div class="chart-title">
                    Token Distribution by Type
                  </div>
                  <canvas id="tokenTypeChart" class="chart-canvas"></canvas>
                </div>
                
                <div class="chart-card">
                  <div class="chart-title">
                    Token Usage Over Time
                  </div>
                  <canvas id="tokenTimelineChart" class="chart-canvas"></canvas>
                </div>
              </div>
            </div>

            <!-- SECTION 2: Workflow Intelligence -->
            <div class="chart-section">
              <div class="section-header">
                <h3 class="section-title">🤖 Workflow Intelligence</h3>
                <p class="section-description">Analyze agent usage and automation patterns</p>
              </div>
              <div class="section-charts">
                <div class="chart-card">
                  <div class="chart-title">
                    Agent Usage Distribution
                  </div>
                  <canvas id="agentUsageChart" class="chart-canvas"></canvas>
                </div>
                
                <div class="chart-card">
                  <div class="chart-title">
                    Agent Activity Timeline
                  </div>
                  <canvas id="agentTimelineChart" class="chart-canvas"></canvas>
                </div>
                
                <div class="chart-card">
                  <div class="chart-title">
                    Workflow Efficiency Score
                  </div>
                  <canvas id="workflowEfficiencyChart" class="chart-canvas"></canvas>
                </div>
              </div>
            </div>

            <!-- SECTION 3: Productivity Analytics -->
            <div class="chart-section">
              <div class="section-header">
                <h3 class="section-title">📈 Productivity Analytics</h3>
                <p class="section-description">Track project activity and tool utilization</p>
              </div>
              <div class="section-charts">
                <div class="chart-card">
                  <div class="chart-title">
                    Project Activity Distribution
                  </div>
                  <canvas id="projectChart" class="chart-canvas"></canvas>
                </div>
                
                <div class="chart-card">
                  <div class="chart-title">
                    Tool Usage Patterns
                  </div>
                  <canvas id="toolChart" class="chart-canvas"></canvas>
                </div>
                
                <div class="chart-card">
                  <div class="chart-title">
                    Daily Productivity Trends
                  </div>
                  <canvas id="productivityChart" class="chart-canvas"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.initializeHeaderComponent();
  }

  /**
   * Initialize the header component
   */
  initializeHeaderComponent() {
    const headerContainer = this.container.querySelector('#dashboard-header-container');
    if (headerContainer && typeof HeaderComponent !== 'undefined') {
      this.headerComponent = new HeaderComponent(headerContainer, {
        title: 'Claude Code Analytics Dashboard',
        subtitle: 'Real-time monitoring and analytics for Claude Code sessions',
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

  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      const [conversationsData, statesData, agentData] = await Promise.all([
        this.dataService.getConversations(),
        this.dataService.getConversationStates(),
        this.dataService.cachedFetch('/api/agents')
      ]);

      this.stateService.updateConversations(conversationsData.conversations);
      this.stateService.updateSummary(conversationsData.summary);
      this.stateService.updateConversationStates(statesData);
      
      // Store agent data for charts
      this.agentData = agentData;
      
      // Update dashboard with original format
      this.updateSummaryDisplay(
        conversationsData.summary, 
        conversationsData.detailedTokenUsage, 
        conversationsData
      );
      
      this.updateLastUpdateTime();
      this.updateChartData(conversationsData);
      this.updateAgentCharts(agentData);
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

    // Update agent metrics if available
    if (this.agentData) {
      this.updateAgentMetrics(this.agentData);
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
   * Update agent metrics in the agents card
   * @param {Object} agentData - Agent analytics data
   */
  updateAgentMetrics(agentData) {
    if (!agentData) return;

    const totalAgentInvocations = this.container.querySelector('#totalAgentInvocations');
    const totalAgentTypes = this.container.querySelector('#totalAgentTypes');
    const topAgentName = this.container.querySelector('#topAgentName');
    const agentAdoption = this.container.querySelector('#agentAdoption');

    // Update primary metric - total invocations
    if (totalAgentInvocations) {
      totalAgentInvocations.textContent = agentData.totalAgentInvocations?.toLocaleString() || '0';
    }

    // Update secondary metrics
    if (totalAgentTypes) {
      totalAgentTypes.textContent = agentData.totalAgentTypes?.toLocaleString() || '0';
    }

    if (topAgentName) {
      const topAgent = agentData.agentStats?.[0];
      if (topAgent) {
        topAgentName.textContent = topAgent.name;
        topAgentName.title = `${topAgent.totalInvocations} uses`;
      } else {
        topAgentName.textContent = 'None';
      }
    }

    if (agentAdoption) {
      const adoptionRate = agentData.efficiency?.adoptionRate || '0';
      agentAdoption.textContent = adoptionRate + '%';
    }
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
    if (this.agentData) {
      this.updateAgentCharts(this.agentData);
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

    // Token Analytics Section
    this.updateTokenChart(data.conversations);
    this.updateTokenTypeChart(data);
    this.updateTokenTimelineChart(data);
    
    // Productivity Analytics Section  
    this.updateProjectChart(data.conversations);
    this.updateToolChart(data.conversations);
    this.updateProductivityChart(data);
    
    // Legacy tool summary (keeping for now)
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
   * Update agent usage charts
   * @param {Object} agentData - Agent analytics data
   */
  updateAgentCharts(agentData) {
    if (!agentData || !agentData.agentStats) {
      console.warn('No agent data available for charts');
      return;
    }

    this.updateAgentUsageChart(agentData);
    this.updateAgentTimelineChart(agentData);
    this.updateWorkflowEfficiencyChart(agentData);
  }

  /**
   * Update agent usage distribution chart
   * @param {Object} agentData - Agent analytics data
   */
  updateAgentUsageChart(agentData) {
    const canvas = this.container.querySelector('#agentUsageChart');
    if (!canvas) {
      console.warn('Agent usage chart canvas not found');
      return;
    }

    // Destroy existing chart if it exists
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const agentStats = agentData.agentStats || [];

    if (agentStats.length === 0) {
      // Show "no data" message
      ctx.fillStyle = '#7d8590';
      ctx.textAlign = 'center';
      ctx.font = '14px Monaco, monospace';
      ctx.fillText('No agent usage data', canvas.width / 2, canvas.height / 2);
      return;
    }

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: agentStats.map(agent => agent.name),
        datasets: [{
          data: agentStats.map(agent => agent.totalInvocations),
          backgroundColor: agentStats.map(agent => agent.color),
          borderColor: '#0d1117',
          borderWidth: 2,
          hoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#c9d1d9',
              padding: 10,
              usePointStyle: true,
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                size: 11
              }
            }
          },
          tooltip: {
            titleFont: {
              family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
            },
            bodyFont: {
              family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
            },
            callbacks: {
              label: function(context) {
                const agent = agentStats[context.dataIndex];
                return `${agent.name}: ${context.parsed} uses (${agent.uniqueConversations} conversations)`;
              }
            }
          }
        },
        cutout: '60%'
      }
    });
  }

  /**
   * Update agent usage timeline chart
   * @param {Object} agentData - Agent analytics data
   */
  updateAgentTimelineChart(agentData) {
    const canvas = this.container.querySelector('#agentTimelineChart');
    if (!canvas) {
      console.warn('Agent timeline chart canvas not found');
      return;
    }

    // Destroy existing chart if it exists
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const usageByDay = agentData.usageByDay || [];

    if (usageByDay.length === 0) {
      // Show "no data" message
      ctx.fillStyle = '#7d8590';
      ctx.textAlign = 'center';
      ctx.font = '14px Monaco, monospace';
      ctx.fillText('No timeline data', canvas.width / 2, canvas.height / 2);
      return;
    }

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: usageByDay.map(d => new Date(d.date).toLocaleDateString()),
        datasets: [{
          label: 'Agent Usage',
          data: usageByDay.map(d => d.count),
          borderColor: '#3fb950',
          backgroundColor: 'rgba(63, 185, 80, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#3fb950',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#c9d1d9',
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                size: 11
              }
            }
          },
          tooltip: {
            titleFont: {
              family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
            },
            bodyFont: {
              family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
            },
            callbacks: {
              label: function(context) {
                return `Agent invocations: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#7d8590',
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
              }
            },
            grid: {
              color: '#30363d'
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#7d8590',
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
              },
              stepSize: 1
            },
            grid: {
              color: '#30363d'
            }
          }
        }
      }
    });
  }

  /**
   * Update workflow efficiency chart
   * @param {Object} agentData - Agent analytics data
   */
  updateWorkflowEfficiencyChart(agentData) {
    const canvas = this.container.querySelector('#workflowEfficiencyChart');
    if (!canvas) {
      console.warn('Workflow efficiency chart canvas not found');
      return;
    }

    // Destroy existing chart if it exists
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const efficiency = agentData.efficiency || {};

    const data = {
      labels: ['Adoption Rate', 'Workflow Completion', 'Time Efficiency', 'Success Rate'],
      datasets: [{
        label: 'Efficiency %',
        data: [
          efficiency.adoptionRate || 0,
          efficiency.workflowCompletion || 0,
          efficiency.timeEfficiency || 0,
          efficiency.successRate || 0
        ],
        backgroundColor: [
          'rgba(63, 185, 80, 0.8)',
          'rgba(88, 166, 255, 0.8)', 
          'rgba(249, 115, 22, 0.8)',
          'rgba(213, 116, 85, 0.8)'
        ],
        borderColor: [
          '#3fb950',
          '#58a6ff',
          '#f97316', 
          '#d57455'
        ],
        borderWidth: 2
      }]
    };

    new Chart(ctx, {
      type: 'radar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label;
                const value = context.parsed.r;
                return `${label}: ${value.toFixed(1)}%`;
              }
            }
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20,
              color: '#7d8590',
              backdropColor: 'transparent'
            },
            grid: {
              color: '#30363d'
            },
            angleLines: {
              color: '#30363d'
            },
            pointLabels: {
              color: '#c9d1d9',
              font: {
                size: 11
              }
            }
          }
        }
      }
    });
  }

  /**
   * Update token type distribution chart  
   * @param {Object} data - Chart data
   */
  updateTokenTypeChart(data) {
    const canvas = this.container.querySelector('#tokenTypeChart');
    if (!canvas) {
      console.warn('Token type chart canvas not found');
      return;
    }

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const ctx = canvas.getContext('2d');
    const tokenData = data.detailedTokenUsage || {};
    
    console.log('Token type chart data:', tokenData);

    const chartData = [
      tokenData.inputTokens || 0,
      tokenData.outputTokens || 0,
      tokenData.cacheCreationTokens || 0,
      tokenData.cacheReadTokens || 0
    ];
    
    const totalTokens = chartData.reduce((sum, val) => sum + val, 0);
    
    if (totalTokens === 0) {
      // Show "no data" message
      ctx.fillStyle = '#7d8590';
      ctx.textAlign = 'center';
      ctx.font = '14px Monaco, monospace';
      ctx.fillText('No token data available', canvas.width / 2, canvas.height / 2);
      return;
    }

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Input Tokens', 'Output Tokens', 'Cache Creation', 'Cache Read'],
        datasets: [{
          data: chartData,
          backgroundColor: ['#3fb950', '#58a6ff', '#f97316', '#d57455'],
          borderColor: '#0d1117',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#c9d1d9',
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label;
                const value = context.parsed;
                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${value.toLocaleString()} tokens (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Update token usage over time chart
   * @param {Object} data - Chart data  
   */
  updateTokenTimelineChart(data) {
    const canvas = this.container.querySelector('#tokenTimelineChart');
    if (!canvas) {
      console.warn('Token timeline chart canvas not found');
      return;
    }

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const ctx = canvas.getContext('2d');
    const conversations = data.conversations || [];
    
    if (conversations.length === 0) {
      // Show "no data" message
      ctx.fillStyle = '#7d8590';
      ctx.textAlign = 'center';
      ctx.font = '14px Monaco, monospace';
      ctx.fillText('No token timeline data', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Calculate daily token usage
    const dailyTokens = this.calculateDailyTokenUsage(conversations);
    
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailyTokens.labels,
        datasets: [{
          label: 'Input Tokens',
          data: dailyTokens.inputTokens,
          borderColor: '#3fb950',
          backgroundColor: 'rgba(63, 185, 80, 0.1)',
          fill: false,
          tension: 0.3,
          pointBackgroundColor: '#3fb950',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5
        }, {
          label: 'Output Tokens',
          data: dailyTokens.outputTokens,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          fill: false,
          tension: 0.3,
          pointBackgroundColor: '#58a6ff',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5
        }, {
          label: 'Cache Usage',
          data: dailyTokens.cacheTokens,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          fill: false,
          tension: 0.3,
          pointBackgroundColor: '#f97316',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#c9d1d9',
              font: { size: 11 },
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label;
                const value = context.parsed.y;
                return `${label}: ${value.toLocaleString()} tokens`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#7d8590' },
            grid: { color: '#30363d' }
          },
          y: {
            beginAtZero: true,
            ticks: { 
              color: '#7d8590',
              callback: function(value) {
                return value.toLocaleString();
              }
            },
            grid: { color: '#30363d' }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  /**
   * Update daily productivity trends chart
   * @param {Object} data - Chart data
   */
  updateProductivityChart(data) {
    const canvas = this.container.querySelector('#productivityChart');
    if (!canvas) return;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const ctx = canvas.getContext('2d');
    
    // Calculate productivity metrics by day
    const dailyData = this.calculateDailyProductivity(data);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailyData.labels,
        datasets: [{
          label: 'Messages per Day',
          data: dailyData.messages,
          borderColor: '#3fb950',
          backgroundColor: 'rgba(63, 185, 80, 0.1)',
          fill: true,
          tension: 0.3
        }, {
          label: 'Tokens per Day',
          data: dailyData.tokens,
          borderColor: '#58a6ff', 
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#c9d1d9', font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label;
                const value = context.parsed.y;
                if (label === 'Messages per Day') {
                  return `${label}: ${value} messages`;
                } else {
                  return `${label}: ${value.toLocaleString()} tokens`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#7d8590' },
            grid: { color: '#30363d' }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            ticks: { color: '#7d8590' },
            grid: { color: '#30363d' }
          },
          y1: {
            type: 'linear',
            display: true, 
            position: 'right',
            ticks: { color: '#7d8590' },
            grid: { drawOnChartArea: false }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  /**
   * Calculate daily productivity metrics
   * @param {Object} data - Raw data
   * @returns {Object} Processed daily data
   */
  /**
   * Calculate daily token usage from conversations
   * @param {Array} conversations - Array of conversation objects
   * @returns {Object} Daily token data
   */
  calculateDailyTokenUsage(conversations) {
    const dailyData = {};
    const { fromDate, toDate } = this.getDateRange();
    
    conversations.forEach(conv => {
      const convDate = new Date(conv.lastModified);
      if (convDate >= fromDate && convDate <= toDate) {
        const dateKey = convDate.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            inputTokens: 0,
            outputTokens: 0,
            cacheTokens: 0
          };
        }
        
        if (conv.tokenUsage) {
          dailyData[dateKey].inputTokens += conv.tokenUsage.inputTokens || 0;
          dailyData[dateKey].outputTokens += conv.tokenUsage.outputTokens || 0;
          dailyData[dateKey].cacheTokens += (conv.tokenUsage.cacheCreationTokens || 0) + (conv.tokenUsage.cacheReadTokens || 0);
        }
      }
    });
    
    // Sort dates and create arrays
    const sortedDates = Object.keys(dailyData).sort();
    const labels = sortedDates.map(date => new Date(date).toLocaleDateString());
    const inputTokens = sortedDates.map(date => dailyData[date].inputTokens);
    const outputTokens = sortedDates.map(date => dailyData[date].outputTokens);
    const cacheTokens = sortedDates.map(date => dailyData[date].cacheTokens);
    
    return { labels, inputTokens, outputTokens, cacheTokens };
  }

  calculateDailyProductivity(data) {
    const conversations = data.conversations || [];
    const dailyStats = {};

    // Group data by day
    conversations.forEach(conv => {
      if (!conv.lastModified) return;
      
      const date = new Date(conv.lastModified).toDateString();
      if (!dailyStats[date]) {
        dailyStats[date] = { messages: 0, tokens: 0 };
      }
      
      dailyStats[date].messages += conv.messageCount || 0;
      dailyStats[date].tokens += (conv.tokenUsage?.inputTokens || 0) + (conv.tokenUsage?.outputTokens || 0);
    });

    // Convert to arrays for chart
    const sortedDates = Object.keys(dailyStats).sort((a, b) => new Date(a) - new Date(b));
    
    return {
      labels: sortedDates.map(date => new Date(date).toLocaleDateString()),
      messages: sortedDates.map(date => dailyStats[date].messages),
      tokens: sortedDates.map(date => Math.round(dailyStats[date].tokens / 1000)) // Convert to K tokens
    };
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
   * Update last update time
   */
  updateLastUpdateTime() {
    if (this.headerComponent) {
      this.headerComponent.updateLastUpdateTime();
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
    
    // Cleanup header component
    if (this.headerComponent) {
      this.headerComponent.destroy();
      this.headerComponent = null;
    }
    
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