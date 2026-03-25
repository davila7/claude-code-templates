/**
 * Charts - Handles chart display and management
 * Part of the modular frontend architecture
 */
class Charts {
  constructor(container, dataService, stateService) {
    this.container = container;
    this.dataService = dataService;
    this.stateService = stateService;
    this.charts = {};
    
    // Subscribe to state changes
    this.unsubscribe = this.stateService.subscribe(this.handleStateChange.bind(this));
  }

  /**
   * Initialize charts
   */
  async initialize() {
    await this.loadChartData();
    this.setupCharts();
  }

  /**
   * Handle state changes from StateService
   * @param {Object} state - New state
   * @param {string} action - Action that caused the change
   */
  handleStateChange(state, action) {
    if (action === 'update_chart_data') {
      this.updateCharts(state.chartData);
    }
  }

  /**
   * Load chart data from API
   */
  async loadChartData() {
    try {
      const chartData = await this.dataService.getChartData();
      this.stateService.updateChartData(chartData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  }

  /**
   * Setup chart instances
   */
  setupCharts() {
    // This would be called from Dashboard component
    // which already has Chart.js integration
  }

  /**
   * Update charts with new data
   * @param {Object} chartData - New chart data
   */
  updateCharts(chartData) {
    // Update existing charts with new data
    Object.keys(this.charts).forEach(chartId => {
      const chart = this.charts[chartId];
      if (chartData[chartId]) {
        chart.data = chartData[chartId];
        chart.update();
      }
    });
  }

  /**
   * Create a new chart
   * @param {string} id - Chart ID
   * @param {HTMLElement} canvas - Canvas element
   * @param {Object} config - Chart configuration
   */
  createChart(id, canvas, config) {
    if (typeof Chart === 'undefined') {
      console.error('Chart.js not loaded');
      return null;
    }

    this.charts[id] = new Chart(canvas, config);
    return this.charts[id];
  }

  /**
   * Destroy specific chart
   * @param {string} id - Chart ID
   */
  destroyChart(id) {
    if (this.charts[id]) {
      this.charts[id].destroy();
      delete this.charts[id];
    }
  }

  /**
   * Cleanup all charts
   */
  destroy() {
    Object.keys(this.charts).forEach(id => {
      this.destroyChart(id);
    });
    
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Charts;
}