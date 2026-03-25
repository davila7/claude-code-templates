/**
 * ActivityHeatmap - GitHub-style contribution calendar for Claude Code activity
 * Shows daily Claude Code usage over the last year with orange theme
 */
class ActivityHeatmap {
  constructor(container, dataService) {
    this.container = container;
    this.dataService = dataService;
    this.activityData = null;
    this.tooltip = null;
    this.currentYear = new Date().getFullYear();
    this.currentMetric = 'messages'; // Default metric
    
    console.log('🔥 ActivityHeatmap initialized');
  }

  /**
   * Initialize the heatmap component
   */
  async initialize() {
    try {
      console.log('🔥 Initializing ActivityHeatmap...');
      await this.render();
      await this.loadActivityData();
      console.log('✅ ActivityHeatmap initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ActivityHeatmap:', error);
      this.showErrorState();
    }
  }

  /**
   * Render the heatmap structure
   */
  async render() {
    this.container.innerHTML = `
      <div class="activity-heatmap-container">
        <div class="heatmap-loading">
          <div class="heatmap-loading-spinner"></div>
          <span>Loading activity...</span>
        </div>
      </div>
      <div class="heatmap-tooltip" id="heatmap-tooltip">
        <div class="heatmap-tooltip-date"></div>
        <div class="heatmap-tooltip-activity"></div>
      </div>
    `;
    
    this.tooltip = document.getElementById('heatmap-tooltip');
  }

  /**
   * Load activity data from the API
   */
  async loadActivityData() {
    try {
      console.log('🔥 Loading activity data...');
      
      // Get complete activity data from backend (pre-processed with tools)
      const response = await this.dataService.cachedFetch('/api/activity');
      if (response && response.dailyActivity) {
        console.log(`🔥 Loaded pre-processed activity data: ${response.dailyActivity.length} active days`);
        
        // Use pre-processed data from backend instead of processing raw conversations
        const dailyActivityMap = new Map();
        response.dailyActivity.forEach(day => {
          dailyActivityMap.set(day.date, day);
        });
        
        this.activityData = this.processPrecomputedActivityData(dailyActivityMap);
        await this.renderHeatmap();
        this.updateTitle();
      } else {
        throw new Error('No activity data available');
      }
    } catch (error) {
      console.error('❌ Error loading activity data:', error);
      this.showErrorState();
    }
  }

  /**
   * Process pre-computed activity data from backend
   */
  processPrecomputedActivityData(dailyActivityMap) {
    console.log(`🔥 Processing ${dailyActivityMap.size} days of pre-computed data...`);
    
    // Calculate thresholds based on current metric
    const metricCounts = Array.from(dailyActivityMap.values())
      .map(activity => activity[this.currentMetric] || 0)
      .filter(count => count > 0)
      .sort((a, b) => a - b);

    const thresholds = this.calculateDynamicThresholds(metricCounts);
    
    // Calculate total activity for current metric
    let totalActivity = 0;
    let totalTools = 0;
    let totalMessages = 0;
    dailyActivityMap.forEach(activity => {
      totalActivity += activity[this.currentMetric] || 0;
      totalTools += activity.tools || 0;
      totalMessages += activity.messages || 0;
    });
    
    console.log(`🔥 Pre-computed data stats: ${totalMessages} messages, ${totalTools} tools`);
    console.log(`🔥 Current metric (${this.currentMetric}): ${totalActivity} total`);
    console.log(`🔥 Dynamic thresholds:`, thresholds);
    console.log(`🔥 Sample ${this.currentMetric} counts:`, metricCounts.slice(0, 10), '...', metricCounts.slice(-10));

    return {
      dailyActivity: dailyActivityMap,
      totalActivity,
      activeDays: dailyActivityMap.size,
      thresholds
    };
  }

  /**
   * Process conversation data into daily activity counts (legacy method)
   */
  processActivityData(conversations) {
    const dailyActivity = new Map();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const today = new Date();

    console.log(`🔥 Processing ${conversations.length} conversations for activity data...`);
    console.log(`🔥 Date range: ${oneYearAgo.toLocaleDateString()} to ${today.toLocaleDateString()}`);
    console.log(`🔥 Cutoff timestamp: ${oneYearAgo.getTime()}`);

    let validConversations = 0;
    let latestDate = null;
    let oldestDate = null;
    let beforeOneYearCount = 0;
    
    // Sample some conversations to see their date formats and data structure
    console.log(`🔥 Sampling first 5 conversations:`);
    conversations.slice(0, 5).forEach((conv, i) => {
      console.log(`  ${i+1}: ${conv.filename} - lastModified: ${conv.lastModified} (${new Date(conv.lastModified).toLocaleDateString()})`);
      console.log(`      messages: ${conv.messageCount || 0}, tokens: ${conv.tokens || 0}, toolUsage: ${conv.toolUsage?.totalToolCalls || 0}`);
    });

    conversations.forEach((conversation, index) => {
      if (!conversation.lastModified) {
        if (index < 5) console.log(`⚠️ Conversation ${index} has no lastModified:`, conversation);
        return;
      }
      
      const date = new Date(conversation.lastModified);
      
      // Track date range
      if (!latestDate || date > latestDate) latestDate = date;
      if (!oldestDate || date < oldestDate) oldestDate = date;
      
      if (date < oneYearAgo) {
        beforeOneYearCount++;
        if (beforeOneYearCount <= 5) {
          console.log(`⚠️ Excluding old conversation: ${date.toISOString()} (${conversation.filename})`);
        }
        return;
      }

      validConversations++;
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const current = dailyActivity.get(dateKey) || {
        conversations: 0,
        tokens: 0,
        messages: 0,
        tools: 0
      };
      
      current.conversations += 1;
      current.tokens += conversation.tokens || 0;
      current.messages += conversation.messageCount || 0;
      current.tools += (conversation.toolUsage?.totalToolCalls || 0);
      
      dailyActivity.set(dateKey, current);
    });

    console.log(`🔥 Valid conversations in last year: ${validConversations}`);
    console.log(`🔥 Excluded conversations (older than 1 year): ${beforeOneYearCount}`);
    console.log(`🔥 Complete date range in data: ${oldestDate?.toLocaleDateString()} to ${latestDate?.toLocaleDateString()}`);
    console.log(`🔥 One year ago cutoff: ${oneYearAgo.toLocaleDateString()}`);
    
    // Show first and last few conversations for debugging
    const sortedDates = Array.from(dailyActivity.keys()).sort();
    console.log(`🔥 First 5 activity dates:`, sortedDates.slice(0, 5));
    console.log(`🔥 Last 5 activity dates:`, sortedDates.slice(-5));
    console.log(`🔥 Total activity days: ${sortedDates.length}`);

    // Calculate total activity for the year (based on current metric)
    let totalActivity = 0;
    dailyActivity.forEach(activity => {
      totalActivity += activity[this.currentMetric] || 0;
    });

    // Calculate dynamic thresholds based on data distribution
    const messageCounts = Array.from(dailyActivity.values())
      .map(activity => activity[this.currentMetric] || 0)
      .filter(count => count > 0)
      .sort((a, b) => a - b);

    const thresholds = this.calculateDynamicThresholds(messageCounts);
    
    // Calculate total tools for debugging
    let totalTools = 0;
    let totalMessages = 0;
    dailyActivity.forEach(activity => {
      totalTools += activity.tools || 0;
      totalMessages += activity.messages || 0;
    });
    
    console.log(`🔥 Processed activity data: ${dailyActivity.size} active days, ${totalActivity} total ${this.currentMetric}`);
    console.log(`🔥 Debug totals: ${totalMessages} messages, ${totalTools} tools`);
    console.log(`🔥 ${this.currentMetric} range: ${Math.min(...messageCounts)} to ${Math.max(...messageCounts)} ${this.currentMetric} per day`);
    console.log(`🔥 Dynamic thresholds:`, thresholds);
    console.log(`🔥 Sample ${this.currentMetric} counts:`, messageCounts.slice(0, 10), '...', messageCounts.slice(-10));

    return {
      dailyActivity,
      totalActivity,
      activeDays: dailyActivity.size,
      thresholds
    };
  }

  /**
   * Calculate dynamic thresholds based on data distribution
   * Ensures that even 1 message shows visible color (like GitHub)
   */
  calculateDynamicThresholds(messageCounts) {
    if (messageCounts.length === 0) {
      return { level1: 1, level2: 5, level3: 15, level4: 30 };
    }

    const len = messageCounts.length;
    const max = messageCounts[len - 1];
    const min = messageCounts[0];
    
    // ALWAYS start level1 at 1 so any activity shows color
    let level1 = 1;
    let level2, level3, level4;
    
    if (len <= 4) {
      // Very few data points - simple distribution
      level2 = Math.max(2, Math.ceil(max * 0.3));
      level3 = Math.max(level2 + 1, Math.ceil(max * 0.6));
      level4 = Math.max(level3 + 1, Math.ceil(max * 0.8));
    } else {
      // Use percentiles but ensure good visual distribution
      const p33 = messageCounts[Math.floor(len * 0.33)] || 2;
      const p66 = messageCounts[Math.floor(len * 0.66)] || 3;
      const p85 = messageCounts[Math.floor(len * 0.85)] || 4;
      
      // Ensure reasonable spacing between levels
      level2 = Math.max(2, Math.min(p33, max * 0.2));
      level3 = Math.max(level2 + 1, Math.min(p66, max * 0.5));
      level4 = Math.max(level3 + 1, Math.min(p85, max * 0.75));
    }

    return { level1, level2, level3, level4 };
  }

  /**
   * Render the heatmap calendar
   */
  async renderHeatmap() {
    if (!this.activityData) return;

    const { dailyActivity, totalActivity } = this.activityData;
    
    // Generate calendar structure
    const calendarData = this.generateCalendarData(dailyActivity);
    
    const container = this.container.querySelector('.activity-heatmap-container');
    const modeClass = this.currentMetric === 'tools' ? 'tools-mode' : '';
    container.className = `activity-heatmap-container ${modeClass}`;
    container.innerHTML = `
      <div class="heatmap-header">
        <div class="heatmap-legend">
          <span class="heatmap-legend-text">Less</span>
          <div class="heatmap-legend-scale">
            <div class="heatmap-legend-square level-0"></div>
            <div class="heatmap-legend-square level-1"></div>
            <div class="heatmap-legend-square level-2"></div>
            <div class="heatmap-legend-square level-3"></div>
            <div class="heatmap-legend-square level-4"></div>
          </div>
          <span class="heatmap-legend-more">More</span>
        </div>
      </div>
      <div class="heatmap-grid">
        <div class="heatmap-months" id="heatmap-months-container">
          ${calendarData.months.map((month, index) => 
            `<div class="heatmap-month" data-week-index="${index}">${month}</div>`
          ).join('')}
        </div>
        <div class="heatmap-weekdays">
          <div class="heatmap-weekday">Mon</div>
          <div class="heatmap-weekday"></div>
          <div class="heatmap-weekday">Wed</div>
          <div class="heatmap-weekday"></div>
          <div class="heatmap-weekday">Fri</div>
          <div class="heatmap-weekday"></div>
          <div class="heatmap-weekday"></div>
        </div>
        <div class="heatmap-weeks">
          ${calendarData.weeks.map(week => this.renderWeek(week, dailyActivity)).join('')}
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.attachSettingsListeners();
    this.positionMonthLabels();
    
    // Re-position months on window resize
    this.resizeHandler = () => this.positionMonthLabels();
    window.addEventListener('resize', this.resizeHandler);
  }

  /**
   * Position month labels based on actual week positions
   */
  positionMonthLabels() {
    setTimeout(() => {
      const weeksContainer = this.container.querySelector('.heatmap-weeks');
      const monthsContainer = this.container.querySelector('#heatmap-months-container');
      const monthElements = monthsContainer?.querySelectorAll('.heatmap-month');
      const weekElements = weeksContainer?.children;

      if (!weeksContainer || !monthsContainer || !monthElements || !weekElements) return;

      // Calculate the actual width and position of each week column
      Array.from(monthElements).forEach((monthEl, index) => {
        if (index < weekElements.length && monthEl.textContent.trim()) {
          const weekEl = weekElements[index];
          const weekRect = weekEl.getBoundingClientRect();
          const containerRect = monthsContainer.getBoundingClientRect();
          
          // Position month label at the start of its corresponding week
          const leftPosition = weekRect.left - containerRect.left;
          monthEl.style.left = `${leftPosition}px`;
        }
      });
    }, 50); // Small delay to ensure DOM is fully rendered
  }

  /**
   * Generate calendar structure for the last year
   */
  generateCalendarData(dailyActivity) {
    const today = new Date();
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999); // End of today
    
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    oneYearAgo.setDate(today.getDate() + 1);

    // Find the start of the week (Sunday) for the start date
    const startDate = new Date(oneYearAgo);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const weeks = [];
    const months = [];
    const current = new Date(startDate);
    
    // Generate weeks first - include today completely
    while (current <= todayEnd) {
      const week = [];
      
      for (let day = 0; day < 7; day++) {
        if (current <= todayEnd) {
          const dayDate = new Date(current);
          week.push(dayDate);
        } else {
          week.push(null);
        }
        current.setDate(current.getDate() + 1);
      }
      
      weeks.push(week);
    }

    // Generate month labels - show when month changes
    let lastDisplayedMonth = -1;
    
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      let monthName = '';
      
      if (week && week.length > 0) {
        // Get the most representative day of the week (middle of week)
        const middleDay = week[3] || week[2] || week[1] || week[0];
        
        if (middleDay) {
          const currentMonth = middleDay.getMonth();
          
          // Show month name if it's the first occurrence or if month changed
          if (currentMonth !== lastDisplayedMonth) {
            monthName = middleDay.toLocaleDateString('en-US', { month: 'short' });
            lastDisplayedMonth = currentMonth;
          }
        }
      }
      
      months.push(monthName);
    }

    return { weeks, months };
  }

  /**
   * Render a week column
   */
  renderWeek(week, dailyActivity) {
    const weekHtml = week.map(date => {
      if (!date) return '<div class="heatmap-day empty"></div>';
      
      const dateKey = date.toISOString().split('T')[0];
      const activity = dailyActivity.get(dateKey);
      const level = this.getActivityLevel(activity);
      const modeClass = this.currentMetric === 'tools' ? 'tools-mode' : '';
      
      
      return `
        <div class="heatmap-day level-${level} ${modeClass}" 
             data-date="${dateKey}" 
             data-activity='${JSON.stringify(activity || { conversations: 0, tokens: 0, messages: 0, tools: 0 })}'>
        </div>
      `;
    }).join('');
    
    return `<div class="heatmap-week">${weekHtml}</div>`;
  }

  /**
   * Calculate activity level based on current metric using dynamic thresholds
   */
  getActivityLevel(activity) {
    if (!activity) return 0;
    
    const metricValue = activity[this.currentMetric] || 0;
    if (metricValue === 0) return 0;
    
    const thresholds = this.activityData?.thresholds;
    
    if (!thresholds) {
      // Fallback to static levels if thresholds not available
      if (metricValue >= 50) return 4;
      if (metricValue >= 30) return 3;
      if (metricValue >= 15) return 2;
      if (metricValue >= 1) return 1;
      return 0;
    }
    
    // Use dynamic thresholds for better distribution
    if (metricValue >= thresholds.level4) return 4;
    if (metricValue >= thresholds.level3) return 3;
    if (metricValue >= thresholds.level2) return 2;
    if (metricValue >= thresholds.level1) return 1;
    
    return 0;
  }

  /**
   * Attach event listeners for tooltips and interactions
   */
  attachEventListeners() {
    const days = this.container.querySelectorAll('.heatmap-day');
    
    days.forEach(day => {
      day.addEventListener('mouseenter', (e) => this.showTooltip(e));
      day.addEventListener('mouseleave', () => this.hideTooltip());
      day.addEventListener('mousemove', (e) => this.updateTooltipPosition(e));
    });
  }

  /**
   * Attach event listeners for settings dropdown
   */
  attachSettingsListeners() {
    // Remove existing listeners first to prevent duplicates
    this.removeSettingsListeners();
    
    const settingsButton = document.querySelector('.heatmap-settings');
    const dropdown = document.getElementById('heatmap-settings-dropdown');
    const metricOptions = dropdown?.querySelectorAll('.heatmap-metric-option');

    console.log('🔥 Attaching settings listeners:', {
      settingsButton: !!settingsButton,
      dropdown: !!dropdown,
      metricOptions: metricOptions?.length || 0
    });

    if (settingsButton && dropdown) {
      // Store references to handlers for cleanup
      this.settingsClickHandler = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        console.log('🔥 Settings dropdown toggled:', dropdown.classList.contains('show'));
      };

      this.documentClickHandler = (e) => {
        if (!settingsButton.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.remove('show');
        }
      };

      // Add event listeners
      settingsButton.addEventListener('click', this.settingsClickHandler);
      document.addEventListener('click', this.documentClickHandler);
    }

    // Handle metric selection
    if (metricOptions) {
      this.metricHandlers = [];
      metricOptions.forEach(option => {
        const handler = (e) => {
          const metric = e.target.dataset.metric;
          this.changeMetric(metric);
          
          // Update active state
          metricOptions.forEach(opt => opt.classList.remove('active'));
          e.target.classList.add('active');
          
          // Close dropdown
          dropdown.classList.remove('show');
        };
        
        option.addEventListener('click', handler);
        this.metricHandlers.push({ element: option, handler });
      });
    }
  }

  /**
   * Remove existing settings event listeners to prevent duplicates
   */
  removeSettingsListeners() {
    const settingsButton = document.querySelector('.heatmap-settings');
    
    if (this.settingsClickHandler && settingsButton) {
      settingsButton.removeEventListener('click', this.settingsClickHandler);
    }
    
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
    }
    
    if (this.metricHandlers) {
      this.metricHandlers.forEach(({ element, handler }) => {
        element.removeEventListener('click', handler);
      });
      this.metricHandlers = [];
    }
  }

  /**
   * Change the activity metric (messages or tools)
   */
  async changeMetric(metric) {
    console.log(`🔥 Changing metric to: ${metric}`);
    this.currentMetric = metric;
    
    // Recalculate thresholds based on new metric
    if (this.activityData) {
      await this.recalculateForMetric(metric);
      await this.renderHeatmap();
      this.updateTitle();
    }
  }

  /**
   * Recalculate activity data for the new metric
   */
  async recalculateForMetric(metric) {
    const { dailyActivity } = this.activityData;
    
    // Recalculate thresholds based on the new metric
    const metricCounts = Array.from(dailyActivity.values())
      .map(activity => activity[metric] || 0)
      .filter(count => count > 0)
      .sort((a, b) => a - b);

    const thresholds = this.calculateDynamicThresholds(metricCounts);
    
    // Calculate new total activity
    let totalActivity = 0;
    dailyActivity.forEach(activity => {
      totalActivity += activity[metric] || 0;
    });

    this.activityData.thresholds = thresholds;
    this.activityData.totalActivity = totalActivity;
    
    console.log(`🔥 Recalculated for ${metric}:`, thresholds);
    console.log(`🔥 New total: ${totalActivity}`);
  }

  /**
   * Show tooltip on day hover
   */
  showTooltip(event) {
    const day = event.target;
    const date = day.dataset.date;
    const activity = JSON.parse(day.dataset.activity || '{}');
    
    if (!date) return;

    // Fix timezone issue: parse date as local instead of UTC
    const [year, month, dayNum] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, dayNum); // month is 0-indexed
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });

    const currentValue = activity[this.currentMetric] || 0;
    const otherMetric = this.currentMetric === 'messages' ? 'conversations' : 'messages';
    const otherValue = activity[otherMetric] || 0;
    
    let activityText = `No ${this.currentMetric}`;
    if (currentValue > 0) {
      const suffix = currentValue === 1 ? '' : 's';
      activityText = `${currentValue} ${this.currentMetric.slice(0, -1)}${suffix}`;
      
      if (otherValue > 0) {
        const otherSuffix = otherValue === 1 ? '' : 's';
        const otherLabel = otherMetric === 'conversations' ? 'conversation' : 'message';
        activityText += ` • ${otherValue} ${otherLabel}${otherSuffix}`;
      }
    }

    this.tooltip.querySelector('.heatmap-tooltip-date').textContent = formattedDate;
    this.tooltip.querySelector('.heatmap-tooltip-activity').textContent = activityText;
    
    this.tooltip.classList.add('show');
    this.updateTooltipPosition(event);
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    this.tooltip.classList.remove('show');
  }

  /**
   * Update tooltip position
   */
  updateTooltipPosition(event) {
    const tooltip = this.tooltip;
    const rect = tooltip.getBoundingClientRect();
    
    let x = event.pageX + 10;
    let y = event.pageY - rect.height - 10;
    
    // Adjust if tooltip would go off screen
    if (x + rect.width > window.innerWidth) {
      x = event.pageX - rect.width - 10;
    }
    
    if (y < window.scrollY) {
      y = event.pageY + 10;
    }
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  /**
   * Update the title with total activity count
   */
  updateTitle() {
    if (!this.activityData) return;
    
    const { totalActivity } = this.activityData;
    const titleElement = document.getElementById('activity-total');
    
    if (titleElement) {
      // Ensure totalActivity is a number
      const activityCount = totalActivity || 0;
      
      if (this.currentMetric === 'messages') {
        titleElement.innerHTML = `${this.formatNumber(activityCount)} <span style="color: #ff7f50;">Claude Code</span> ${this.currentMetric} in the last year`;
      } else if (this.currentMetric === 'tools') {
        titleElement.innerHTML = `${this.formatNumber(activityCount)} <span style="color: #ff7f50;">Claude Code</span> ${this.currentMetric} in the last year`;
      } else {
        titleElement.innerHTML = `${this.formatNumber(activityCount)} ${this.currentMetric} in the last year`;
      }
    }
  }

  /**
   * Format large numbers with commas
   */
  formatNumber(num) {
    // Handle undefined, null, or non-numeric values
    if (num == null || typeof num !== 'number' || isNaN(num)) {
      return '0';
    }
    
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toLocaleString();
  }

  /**
   * Show error state
   */
  showErrorState() {
    const container = this.container.querySelector('.activity-heatmap-container');
    container.innerHTML = `
      <div class="heatmap-empty-state">
        <div class="heatmap-empty-icon">📊</div>
        <div class="heatmap-empty-text">Unable to load activity data</div>
        <div class="heatmap-empty-subtext">Please try refreshing the page</div>
      </div>
    `;
  }

  /**
   * Clear cache and refresh the heatmap data
   */
  async clearCacheAndRefresh() {
    try {
      console.log('🔥 Clearing cache and refreshing heatmap data...');
      
      // Clear frontend cache
      this.dataService.clearCache();
      
      // Clear backend cache
      await fetch('/api/clear-cache', { method: 'POST' });
      
      // Force reload activity data
      await this.loadActivityData();
      this.positionMonthLabels();
      
      console.log('✅ Cache cleared and data refreshed');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

  /**
   * Refresh the heatmap data
   */
  async refresh() {
    console.log('🔥 Refreshing heatmap data...');
    await this.loadActivityData();
    this.positionMonthLabels();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
    
    // Remove resize listener
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    // Remove settings listeners
    this.removeSettingsListeners();
    
    console.log('🔥 ActivityHeatmap destroyed');
  }
}

// Make it globally available
window.ActivityHeatmap = ActivityHeatmap;