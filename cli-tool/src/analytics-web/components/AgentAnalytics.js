/**
 * AgentAnalytics - Component for displaying agent usage analytics and charts
 * Shows comprehensive agent usage statistics, trends, and workflow patterns
 */
class AgentAnalytics {
  constructor(container, services) {
    this.container = container;
    this.dataService = services.data;
    this.stateService = services.state;
    
    this.agentData = null;
    this.charts = {};
    this.isInitialized = false;
    
    // Date filter state
    this.dateFilters = {
      startDate: null,
      endDate: null
    };
    
    // Subscribe to data refresh events
    this.dataService.onDataRefresh(this.handleDataRefresh.bind(this));
  }

  /**
   * Initialize the agent analytics component
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.stateService.setLoading(true);
      await this.render();
      await this.loadAgentData();
      this.setupEventListeners();
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing agent analytics:', error);
      this.stateService.setError(error);
    } finally {
      this.stateService.setLoading(false);
    }
  }

  /**
   * Render the agent analytics UI
   */
  async render() {
    this.container.innerHTML = `
      <div class="agent-analytics">
        <!-- Header Section -->
        <div class="analytics-header">
          <div class="header-content">
            <h2 class="analytics-title">
              <span class="title-icon">🤖</span>
              Agent Usage Analytics
            </h2>
            <p class="analytics-subtitle">Specialized Claude Code agent usage patterns and workflow insights</p>
          </div>
          
          <!-- Date Filter Controls -->
          <div class="date-filters">
            <div class="filter-group">
              <label for="start-date">From:</label>
              <input type="date" id="start-date" class="date-input">
            </div>
            <div class="filter-group">
              <label for="end-date">To:</label>
              <input type="date" id="end-date" class="date-input">
            </div>
            <button class="refresh-btn" id="refresh-analytics">
              <span class="btn-icon">🔄</span>
              Refresh
            </button>
          </div>
        </div>

        <!-- Summary Metrics -->
        <div class="metrics-grid" id="metrics-grid">
          <div class="metric-card loading">
            <div class="metric-icon">🔄</div>
            <div class="metric-content">
              <div class="metric-value">Loading...</div>
              <div class="metric-label">Agent Data</div>
            </div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-container">
          <!-- Agent Usage Overview -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Agent Usage Distribution</h3>
              <p>Total invocations per specialized agent type</p>
            </div>
            <div class="chart-content">
              <canvas id="agent-usage-chart" width="400" height="200"></canvas>
            </div>
          </div>

          <!-- Usage Timeline -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Agent Usage Timeline</h3>
              <p>Agent invocations over time showing workflow patterns</p>
            </div>
            <div class="chart-content">
              <canvas id="agent-timeline-chart" width="400" height="200"></canvas>
            </div>
          </div>

          <!-- Hourly Usage Pattern -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Popular Usage Hours</h3>
              <p>Agent activity distribution throughout the day</p>
            </div>
            <div class="chart-content">
              <canvas id="hourly-usage-chart" width="400" height="200"></canvas>
            </div>
          </div>

          <!-- Agent Efficiency Metrics -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Agent Workflow Efficiency</h3>
              <p>Usage patterns and adoption rates across different agents</p>
            </div>
            <div class="chart-content">
              <div class="efficiency-metrics" id="efficiency-metrics">
                <div class="efficiency-loading">Loading efficiency data...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Detailed Agent Stats -->
        <div class="agent-details-section">
          <h3>Detailed Agent Statistics</h3>
          <div class="agent-stats-grid" id="agent-stats-grid">
            <div class="stats-loading">Loading agent statistics...</div>
          </div>
        </div>

        <!-- Workflow Patterns -->
        <div class="workflow-patterns-section" id="workflow-patterns-section" style="display: none;">
          <h3>Agent Workflow Patterns</h3>
          <p>Common sequences of agent usage within workflow sessions</p>
          <div class="workflow-patterns" id="workflow-patterns">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Load agent analytics data from API
   */
  async loadAgentData() {
    try {
      const params = new URLSearchParams();
      if (this.dateFilters.startDate) {
        params.append('startDate', this.dateFilters.startDate);
      }
      if (this.dateFilters.endDate) {
        params.append('endDate', this.dateFilters.endDate);
      }
      
      const url = `/api/agents${params.toString() ? '?' + params.toString() : ''}`;
      this.agentData = await this.dataService.cachedFetch(url);
      
      if (this.agentData) {
        this.updateMetrics();
        this.renderCharts();
        this.renderAgentStats();
        this.renderWorkflowPatterns();
      } else {
        this.renderNoData();
      }
    } catch (error) {
      console.error('Error loading agent data:', error);
      this.renderError(error);
    }
  }

  /**
   * Update summary metrics
   */
  updateMetrics() {
    const metricsGrid = this.container.querySelector('#metrics-grid');
    if (!metricsGrid || !this.agentData) return;

    const { summary, totalAgentInvocations, totalAgentTypes, efficiency } = this.agentData;

    metricsGrid.innerHTML = `
      <div class="metric-card primary">
        <div class="metric-icon">🚀</div>
        <div class="metric-content">
          <div class="metric-value">${totalAgentInvocations}</div>
          <div class="metric-label">Total Invocations</div>
        </div>
      </div>
      
      <div class="metric-card secondary">
        <div class="metric-icon">🤖</div>
        <div class="metric-content">
          <div class="metric-value">${totalAgentTypes}</div>
          <div class="metric-label">Agent Types Used</div>
        </div>
      </div>
      
      <div class="metric-card success">
        <div class="metric-icon">⭐</div>
        <div class="metric-content">
          <div class="metric-value">${efficiency.adoptionRate}%</div>
          <div class="metric-label">Adoption Rate</div>
        </div>
      </div>
      
      <div class="metric-card info">
        <div class="metric-icon">📊</div>
        <div class="metric-content">
          <div class="metric-value">${efficiency.averageInvocationsPerAgent}</div>
          <div class="metric-label">Avg. per Agent</div>
        </div>
      </div>
    `;
  }

  /**
   * Render all charts
   */
  renderCharts() {
    if (!this.agentData) return;

    this.renderAgentUsageChart();
    this.renderTimelineChart();
    this.renderHourlyUsageChart();
    this.renderEfficiencyMetrics();
  }

  /**
   * Render agent usage distribution chart
   */
  renderAgentUsageChart() {
    const canvas = this.container.querySelector('#agent-usage-chart');
    if (!canvas || !this.agentData.agentStats) return;

    // Destroy existing chart
    if (this.charts.usage) {
      this.charts.usage.destroy();
    }

    const ctx = canvas.getContext('2d');
    const agentStats = this.agentData.agentStats;

    this.charts.usage = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: agentStats.map(agent => agent.name),
        datasets: [{
          data: agentStats.map(agent => agent.totalInvocations),
          backgroundColor: agentStats.map(agent => agent.color),
          borderColor: 'var(--bg-primary)',
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
              color: 'var(--text-primary)',
              padding: 20,
              usePointStyle: true,
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
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
                return `${agent.name}: ${context.parsed} invocations (${agent.uniqueConversations} conversations)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Render agent usage timeline chart
   */
  renderTimelineChart() {
    const canvas = this.container.querySelector('#agent-timeline-chart');
    if (!canvas || !this.agentData.usageByDay) return;

    // Destroy existing chart
    if (this.charts.timeline) {
      this.charts.timeline.destroy();
    }

    const ctx = canvas.getContext('2d');
    const timelineData = this.agentData.usageByDay;

    this.charts.timeline = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timelineData.map(d => new Date(d.date).toLocaleDateString()),
        datasets: [{
          label: 'Agent Invocations',
          data: timelineData.map(d => d.count),
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
              color: 'var(--text-primary)',
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
              }
            }
          },
          tooltip: {
            titleFont: {
              family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
            },
            bodyFont: {
              family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: 'var(--text-secondary)',
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
              }
            },
            grid: {
              color: 'var(--border-primary)'
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: 'var(--text-secondary)',
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
              }
            },
            grid: {
              color: 'var(--border-primary)'
            }
          }
        }
      }
    });
  }

  /**
   * Render hourly usage pattern chart
   */
  renderHourlyUsageChart() {
    const canvas = this.container.querySelector('#hourly-usage-chart');
    if (!canvas || !this.agentData.popularHours) return;

    // Destroy existing chart
    if (this.charts.hourly) {
      this.charts.hourly.destroy();
    }

    const ctx = canvas.getContext('2d');
    const hourlyData = this.agentData.popularHours;

    this.charts.hourly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: hourlyData.map(h => h.label),
        datasets: [{
          label: 'Agent Invocations',
          data: hourlyData.map(h => h.count),
          backgroundColor: 'rgba(217, 116, 85, 0.6)',
          borderColor: '#d57455',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: 'var(--text-primary)',
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
              }
            }
          },
          tooltip: {
            titleFont: {
              family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
            },
            bodyFont: {
              family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: 'var(--text-secondary)',
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
              }
            },
            grid: {
              color: 'var(--border-primary)'
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: 'var(--text-secondary)',
              font: {
                family: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
              }
            },
            grid: {
              color: 'var(--border-primary)'
            }
          }
        }
      }
    });
  }

  /**
   * Render efficiency metrics
   */
  renderEfficiencyMetrics() {
    const container = this.container.querySelector('#efficiency-metrics');
    if (!container || !this.agentData.efficiency) return;

    const { efficiency, agentStats } = this.agentData;
    const mostUsedAgent = efficiency.mostUsedAgent;

    container.innerHTML = `
      <div class="efficiency-grid">
        <div class="efficiency-card">
          <div class="efficiency-icon">🎯</div>
          <div class="efficiency-content">
            <div class="efficiency-value">${efficiency.averageInvocationsPerAgent}</div>
            <div class="efficiency-label">Avg. Invocations/Agent</div>
          </div>
        </div>
        
        <div class="efficiency-card">
          <div class="efficiency-icon">📈</div>
          <div class="efficiency-content">
            <div class="efficiency-value">${efficiency.adoptionRate}%</div>
            <div class="efficiency-label">Adoption Rate</div>
          </div>
        </div>
        
        <div class="efficiency-card">
          <div class="efficiency-icon">${mostUsedAgent ? mostUsedAgent.icon : '🤖'}</div>
          <div class="efficiency-content">
            <div class="efficiency-value">${mostUsedAgent ? mostUsedAgent.name : 'None'}</div>
            <div class="efficiency-label">Most Used Agent</div>
          </div>
        </div>
        
        <div class="efficiency-card">
          <div class="efficiency-icon">🔧</div>
          <div class="efficiency-content">
            <div class="efficiency-value">${efficiency.agentDiversity}</div>
            <div class="efficiency-label">Agent Diversity</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render detailed agent statistics
   */
  renderAgentStats() {
    const container = this.container.querySelector('#agent-stats-grid');
    if (!container || !this.agentData.agentStats) return;

    container.innerHTML = this.agentData.agentStats.map(agent => `
      <div class="agent-stat-card">
        <div class="agent-stat-header">
          <div class="agent-stat-icon">${agent.icon}</div>
          <div class="agent-stat-info">
            <h4>${agent.name}</h4>
            <p>${agent.description}</p>
          </div>
          <div class="agent-stat-badge" style="background-color: ${agent.color}20; color: ${agent.color};">
            ${agent.totalInvocations} uses
          </div>
        </div>
        
        <div class="agent-stat-metrics">
          <div class="stat-metric">
            <span class="metric-label">Conversations:</span>
            <span class="metric-value">${agent.uniqueConversations}</span>
          </div>
          <div class="stat-metric">
            <span class="metric-label">Avg. per conversation:</span>
            <span class="metric-value">${agent.averageUsagePerConversation}</span>
          </div>
          <div class="stat-metric">
            <span class="metric-label">First used:</span>
            <span class="metric-value">${new Date(agent.firstUsed).toLocaleDateString()}</span>
          </div>
          <div class="stat-metric">
            <span class="metric-label">Last used:</span>
            <span class="metric-value">${new Date(agent.lastUsed).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render workflow patterns
   */
  renderWorkflowPatterns() {
    const section = this.container.querySelector('#workflow-patterns-section');
    const container = this.container.querySelector('#workflow-patterns');
    
    if (!container || !this.agentData.workflowPatterns) return;

    if (this.agentData.workflowPatterns.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    container.innerHTML = this.agentData.workflowPatterns.map(pattern => `
      <div class="workflow-pattern">
        <div class="pattern-flow">${pattern.pattern}</div>
        <div class="pattern-count">${pattern.count} times</div>
      </div>
    `).join('');
  }

  /**
   * Render no data state
   */
  renderNoData() {
    this.container.innerHTML = `
      <div class="no-agent-data">
        <div class="no-data-content">
          <div class="no-data-icon">🤖</div>
          <h3>No Agent Usage Data</h3>
          <p>No specialized Claude Code agents have been used yet.</p>
          <div class="agent-types">
            <h4>Available Agent Types:</h4>
            <ul>
              <li><strong>general-purpose:</strong> Multi-step tasks and research</li>
              <li><strong>claude-code-best-practices:</strong> Workflow optimization</li>
              <li><strong>docusaurus-expert:</strong> Documentation management</li>
            </ul>
          </div>
          <button class="refresh-btn" onclick="this.loadAgentData()">
            <span class="btn-icon">🔄</span>
            Refresh Data
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError(error) {
    this.container.innerHTML = `
      <div class="agent-analytics-error">
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <h3>Error Loading Agent Data</h3>
          <p>${error.message || 'Failed to load agent analytics data'}</p>
          <button class="refresh-btn" onclick="this.loadAgentData()">
            <span class="btn-icon">🔄</span>
            Try Again
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Date filter change handlers
    const startDateInput = this.container.querySelector('#start-date');
    const endDateInput = this.container.querySelector('#end-date');
    const refreshBtn = this.container.querySelector('#refresh-analytics');

    if (startDateInput) {
      startDateInput.addEventListener('change', (e) => {
        this.dateFilters.startDate = e.target.value;
      });
    }

    if (endDateInput) {
      endDateInput.addEventListener('change', (e) => {
        this.dateFilters.endDate = e.target.value;
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshData();
      });
    }
  }

  /**
   * Refresh analytics data
   */
  async refreshData() {
    try {
      const refreshBtn = this.container.querySelector('#refresh-analytics');
      if (refreshBtn) {
        refreshBtn.disabled = true;
        const icon = refreshBtn.querySelector('.btn-icon');
        if (icon) icon.style.animation = 'spin 1s linear infinite';
      }

      await this.loadAgentData();
    } catch (error) {
      console.error('Error refreshing agent data:', error);
    } finally {
      const refreshBtn = this.container.querySelector('#refresh-analytics');
      if (refreshBtn) {
        refreshBtn.disabled = false;
        const icon = refreshBtn.querySelector('.btn-icon');
        if (icon) icon.style.animation = '';
      }
    }
  }

  /**
   * Handle data refresh events
   */
  handleDataRefresh(data, source) {
    if (source === 'agents' || source === 'all') {
      this.loadAgentData();
    }
  }

  /**
   * Destroy the component and cleanup
   */
  destroy() {
    // Destroy charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.charts = {};

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }

    this.isInitialized = false;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentAnalytics;
}