/**
 * SessionTimer Component
 * Displays current session information, timing, token usage, and Max plan limits
 */
class SessionTimer {
  constructor(container, dataService, stateService) {
    this.container = container;
    this.dataService = dataService;
    this.stateService = stateService;
    this.sessionData = null;
    this.updateInterval = null;
    this.isInitialized = false;
    this.refreshInterval = 5000; // 5 seconds to reduce server load
    this.SESSION_DURATION = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
    this.isTooltipVisible = false; // Track tooltip state globally
  }

  /**
   * Initialize the session timer component
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await this.render();
      await this.loadSessionData();
      this.startAutoUpdate();
      this.isInitialized = true;
      
      console.log('📊 SessionTimer component initialized');
    } catch (error) {
      console.error('Error initializing SessionTimer:', error);
      this.showError('Failed to initialize session timer');
    }
  }

  /**
   * Render the session timer UI
   */
  async render() {
    this.container.innerHTML = `
      <div class="session-timer-accordion">
        <div class="session-timer-header" onclick="window.sessionTimer?.toggleAccordion()">
          <div class="session-timer-title-section">
            <span class="session-timer-chevron">▼</span>
            <h3 class="session-timer-title">Current Session</h3>
          </div>
          <div class="session-timer-status-inline">
            <span class="session-timer-status-dot"></span>
            <span class="session-timer-status-text">Loading...</span>
          </div>
        </div>
        
        <div class="session-timer-content" id="session-timer-content">
          <div class="session-loading-state">
            <div class="session-spinner"></div>
            <span>Loading session data...</span>
          </div>
          
          <div class="session-display" style="display: none;">
            <!-- Session timer display will be populated here -->
          </div>
          
          <div class="session-warnings">
            <!-- Warnings will be displayed here -->
          </div>
        </div>
      </div>
    `;

    // Make component globally accessible for button clicks
    window.sessionTimer = this;
    this.isExpanded = true; // Start expanded
  }

  /**
   * Load session data from API
   */
  async loadSessionData() {
    try {
      this.sessionData = await this.dataService.getSessionData();
      this.updateDisplay();
    } catch (error) {
      console.error('Error loading session data:', error);
      this.showError('Failed to load session data');
    }
  }

  /**
   * Refresh session data manually
   */
  async refreshSessionData() {
    const refreshBtn = this.container.querySelector('.session-refresh-btn button');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
      await this.loadSessionData();
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
      }
    }
  }

  /**
   * Update the display with current session data
   */
  updateDisplay() {
    if (!this.sessionData) return;

    const loadingState = this.container.querySelector('.session-loading-state');
    const sessionDisplay = this.container.querySelector('.session-display');
    const warningsContainer = this.container.querySelector('.session-warnings');
    
    // Update title with plan name
    const titleElement = this.container.querySelector('.session-timer-title');
    if (titleElement && this.sessionData.limits) {
      titleElement.textContent = `Current Session - ${this.sessionData.limits.name}`;
    }

    if (loadingState) loadingState.style.display = 'none';
    if (sessionDisplay) sessionDisplay.style.display = 'block';

    // Update session display
    this.renderSessionInfo(sessionDisplay);
    
    // Update warnings
    this.renderWarnings(warningsContainer);
  }

  /**
   * Load Claude session information
   */
  async loadClaudeSessionInfo() {
    try {
      const response = await fetch('/api/claude/session');
      if (!response.ok) throw new Error('Failed to fetch session info');
      return await response.json();
    } catch (error) {
      console.error('Error loading Claude session info:', error);
      return null;
    }
  }

  /**
   * Render session information
   */
  async renderSessionInfo(container) {
    const { timer, userPlan, monthlyUsage, limits } = this.sessionData;
    
    // Load Claude session info
    const claudeSessionInfo = await this.loadClaudeSessionInfo();
    
    // Update header status
    this.updateHeaderStatus(timer, claudeSessionInfo);
    
    if (!timer.hasActiveSession) {
      container.innerHTML = `
        <div class="session-timer-empty">
          <div class="session-timer-empty-text">No active session</div>
          <div class="session-timer-empty-subtext">Start a conversation to begin tracking</div>
        </div>
      `;
      return;
    }

    // Calculate progress colors based on usage
    const timeProgressPercentage = Math.round(((this.SESSION_DURATION - timer.timeRemaining) / this.SESSION_DURATION) * 100);
    
    const getProgressColor = (percentage) => {
      if (percentage < 50) return '#3fb950';
      if (percentage < 80) return '#f97316';
      return '#f85149';
    };

    // For messages, use a relative progress based on typical usage patterns
    // Since Claude uses dynamic limits, we'll show relative activity level
    const messageActivityLevel = Math.min(100, (timer.messagesUsed / (timer.messagesEstimate || 45)) * 100);
    const messageProgressColor = timer.messagesEstimate ? getProgressColor(messageActivityLevel) : '#3fb950';
    const timeProgressColor = getProgressColor(timeProgressPercentage);
    
    // Format time remaining with better UX
    const formatTimeRemaining = (ms) => {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((ms % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    };

    container.innerHTML = `
      <div class="session-timer-compact">
        
        <div class="session-timer-row">
          <div class="session-timer-time-compact">
            <div class="session-timer-time-value">${claudeSessionInfo && claudeSessionInfo.hasSession ? 
              (claudeSessionInfo.estimatedTimeRemaining.isExpired ? 'Expired' : claudeSessionInfo.estimatedTimeRemaining.formatted) : 
              formatTimeRemaining(timer.timeRemaining)
            }</div>
            <div class="session-timer-time-label">remaining</div>
          </div>
          
          <div class="session-timer-progress-compact">
            <div class="session-timer-progress-item">
              <div class="session-timer-progress-header">
                <span class="session-timer-progress-label">Messages</span>
                <span class="session-timer-progress-value">
                  ${timer.messagesUsed}${timer.messagesEstimate ? `/${timer.messagesEstimate} est.` : ''}
                  <span class="session-timer-info-icon" data-tooltip="message-info" title="Message calculation info">
                    ℹ️
                  </span>
                </span>
              </div>
              <div class="session-timer-progress-bar">
                <div class="session-timer-progress-fill" 
                     style="width: ${messageActivityLevel}%; background-color: ${messageProgressColor};"></div>
              </div>
              ${timer.usageDetails && timer.usageDetails.shortMessages > 0 ? `
              <div class="session-timer-usage-details">
                <small>Short: ${timer.usageDetails.shortMessages}, Long: ${timer.usageDetails.longMessages}</small>
              </div>
              ` : ''}
            </div>
            
            <div class="session-timer-progress-item">
              <div class="session-timer-progress-header">
                <span class="session-timer-progress-label">Session Time</span>
                <span class="session-timer-progress-value">${claudeSessionInfo && claudeSessionInfo.hasSession ? 
                  `${claudeSessionInfo.sessionDuration.formatted}/${claudeSessionInfo.sessionLimit.formatted}` : 
                  `${formatTimeRemaining(this.SESSION_DURATION - timer.timeRemaining)}/5h`
                }</span>
              </div>
              <div class="session-timer-progress-bar">
                <div class="session-timer-progress-fill" 
                     style="width: ${claudeSessionInfo && claudeSessionInfo.hasSession ? 
                       Math.min(100, (claudeSessionInfo.sessionDuration.ms / claudeSessionInfo.sessionLimit.ms) * 100) : 
                       timeProgressPercentage
                     }%; background-color: ${claudeSessionInfo && claudeSessionInfo.hasSession ? 
                       (claudeSessionInfo.estimatedTimeRemaining.isExpired ? '#f85149' : 
                        claudeSessionInfo.estimatedTimeRemaining.ms < 600000 ? '#f97316' : '#3fb950') : 
                       timeProgressColor
                     };"></div>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    `;
    
    // Add popover to the container
    this.addPopover(container);
    
    // Add popover event listeners
    this.setupPopoverEvents(container);
  }
  
  /**
   * Add popover to the container
   */
  addPopover(container) {
    // Check if popover already exists
    const existingPopover = document.getElementById('message-info-tooltip');
    if (existingPopover) {
      // Don't recreate if it already exists, just return
      return;
    }
    
    // Create popover HTML
    const popoverHTML = `
      <div class="session-timer-tooltip" id="message-info-tooltip" style="display: ${this.isTooltipVisible ? 'block' : 'none'};">
        <div class="session-timer-tooltip-content">
          <h4>Claude Pro Plan Usage</h4>
          <p>Shows user messages (prompts) sent in this session. Claude Pro doesn't have fixed message limits - usage is based on message complexity, conversation length, and current capacity.</p>
          <p>The "45 est." is a rough estimate for typical short messages (~200 sentences). You may send more or fewer messages depending on complexity.</p>
          <p><strong>Projects benefit from caching</strong> - repeated content uses fewer resources, allowing more messages.</p>
          <div class="session-timer-tooltip-link">
            <a href="https://support.anthropic.com/en/articles/9797557-usage-limit-best-practices" target="_blank" rel="noopener noreferrer">
              <i class="fas fa-external-link-alt"></i> Usage Limit Best Practices
            </a>
          </div>
        </div>
      </div>
    `;
    
    // Add popover to document body for better positioning
    document.body.insertAdjacentHTML('beforeend', popoverHTML);
  }
  
  /**
   * Setup popover event listeners
   */
  setupPopoverEvents(container) {
    const infoIcon = container.querySelector('.session-timer-info-icon');
    const tooltip = document.getElementById('message-info-tooltip');
    
    if (infoIcon && tooltip) {
      // Remove existing listeners to prevent duplicates
      const existingClickHandler = infoIcon.clickHandler;
      if (existingClickHandler) {
        infoIcon.removeEventListener('click', existingClickHandler);
      }
      
      // Create new click handler
      const clickHandler = (e) => {
        e.stopPropagation();
        if (this.isTooltipVisible) {
          this.hideTooltip(tooltip);
          this.isTooltipVisible = false;
        } else {
          this.showTooltip(tooltip, infoIcon);
          this.isTooltipVisible = true;
        }
      };
      
      // Store handler reference for cleanup
      infoIcon.clickHandler = clickHandler;
      
      // Add click listener
      infoIcon.addEventListener('click', clickHandler);
      
      // Setup document click listener only once
      if (!this.documentClickSetup) {
        document.addEventListener('click', (e) => {
          if (this.isTooltipVisible && !tooltip.contains(e.target) && !infoIcon.contains(e.target)) {
            this.hideTooltip(tooltip);
            this.isTooltipVisible = false;
          }
        });
        this.documentClickSetup = true;
      }
      
      // Prevent tooltip from closing when clicking inside it
      tooltip.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }
  
  /**
   * Show tooltip with positioning
   */
  showTooltip(tooltip, trigger) {
    const rect = trigger.getBoundingClientRect();
    tooltip.style.display = 'block';
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Position tooltip below the icon
    tooltip.style.left = `${rect.left - tooltipRect.width / 2 + rect.width / 2}px`;
    tooltip.style.top = `${rect.bottom + 10}px`;
    
    // Adjust position if tooltip goes off-screen horizontally
    const viewportWidth = window.innerWidth;
    const tooltipLeft = parseInt(tooltip.style.left);
    
    if (tooltipLeft < 10) {
      tooltip.style.left = '10px';
    } else if (tooltipLeft + tooltipRect.width > viewportWidth - 10) {
      tooltip.style.left = `${viewportWidth - tooltipRect.width - 10}px`;
    }
    
    // Adjust position if tooltip goes off-screen vertically
    const viewportHeight = window.innerHeight;
    const tooltipTop = parseInt(tooltip.style.top);
    
    if (tooltipTop + tooltipRect.height > viewportHeight - 10) {
      // If it goes off-screen below, position it above the trigger
      tooltip.style.top = `${rect.top - tooltipRect.height - 10}px`;
    }
    
    this.isTooltipVisible = true;
  }
  
  /**
   * Hide tooltip
   */
  hideTooltip(tooltip) {
    tooltip.style.display = 'none';
    this.isTooltipVisible = false;
  }

  /**
   * Render warnings if any
   */
  renderWarnings(container) {
    if (!this.sessionData || !this.sessionData.warnings || this.sessionData.warnings.length === 0) {
      container.innerHTML = '';
      return;
    }

    const warnings = this.sessionData.warnings
      .filter(warning => warning.type.includes('session') || warning.type.includes('monthly'))
      .slice(0, 3); // Show max 3 warnings

    if (warnings.length === 0) {
      container.innerHTML = '';
      return;
    }

    const warningHtml = warnings.map(warning => `
      <div class="session-warning ${warning.level}">
        <i class="fas ${this.getWarningIcon(warning.level)}"></i>
        <span>${warning.message}</span>
        ${warning.timeRemaining ? `<small>Time remaining: ${this.formatTimeRemaining(warning.timeRemaining)}</small>` : ''}
      </div>
    `).join('');

    container.innerHTML = `<div class="warnings-list">${warningHtml}</div>`;
  }

  /**
   * Get message estimate based on current plan
   */
  getMessageEstimate() {
    if (!this.sessionData || !this.sessionData.limits) return 45;
    return this.sessionData.limits.estimatedMessagesPerSession || 45;
  }

  /**
   * Get plan badge CSS class
   */
  getPlanBadgeClass(planType) {
    const classes = {
      'premium': 'plan-premium',
      'standard': 'plan-standard',
      'pro': 'plan-pro'
    };
    return classes[planType] || 'plan-standard';
  }

  /**
   * Get warning icon based on level
   */
  getWarningIcon(level) {
    const icons = {
      'error': 'fa-exclamation-triangle',
      'warning': 'fa-exclamation-circle',
      'info': 'fa-info-circle'
    };
    return icons[level] || 'fa-info-circle';
  }

  /**
   * Format time remaining for display
   */
  formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return '0m';
    
    const hours = Math.floor(milliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Format numbers with appropriate units
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Show error message
   */
  showError(message) {
    const loadingState = this.container.querySelector('.session-loading-state');
    const sessionDisplay = this.container.querySelector('.session-display');
    
    if (loadingState) loadingState.style.display = 'none';
    if (sessionDisplay) {
      sessionDisplay.style.display = 'block';
      sessionDisplay.innerHTML = `
        <div class="session-timer-error">
          <div class="session-timer-error-text">${message}</div>
          <button class="session-timer-retry-btn" onclick="window.sessionTimer?.refreshSessionData()">Retry</button>
        </div>
      `;
    }
  }

  /**
   * Start automatic updates
   */
  startAutoUpdate() {
    // Update every 1 second for real-time display
    this.updateInterval = setInterval(() => {
      this.loadSessionData();
    }, this.refreshInterval);
  }

  /**
   * Stop automatic updates
   */
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Handle real-time updates
   */
  handleRealtimeUpdate(data) {
    if (data.type === 'session_update' && data.sessionData) {
      this.sessionData = data.sessionData;
      this.updateDisplay();
    }
  }

  /**
   * Toggle accordion open/closed
   */
  toggleAccordion() {
    const content = this.container.querySelector('#session-timer-content');
    const chevron = this.container.querySelector('.session-timer-chevron');
    
    if (this.isExpanded) {
      content.style.display = 'none';
      chevron.textContent = '▶';
      this.isExpanded = false;
    } else {
      content.style.display = 'block';
      chevron.textContent = '▼';
      this.isExpanded = true;
    }
  }
  
  /**
   * Update header status display
   */
  updateHeaderStatus(timer, claudeSessionInfo) {
    const statusDot = this.container.querySelector('.session-timer-status-dot');
    const statusText = this.container.querySelector('.session-timer-status-text');
    
    // If we have Claude session info, prioritize that
    if (claudeSessionInfo && claudeSessionInfo.hasSession) {
      if (claudeSessionInfo.estimatedTimeRemaining.isExpired) {
        statusDot.className = 'session-timer-status-dot expired';
        statusText.textContent = 'Session Expired';
      } else if (claudeSessionInfo.estimatedTimeRemaining.ms < 600000) { // < 10 minutes
        statusDot.className = 'session-timer-status-dot warning';
        statusText.textContent = 'Ending Soon';
      } else {
        statusDot.className = 'session-timer-status-dot active';
        statusText.textContent = 'Active';
      }
    } else if (!timer.hasActiveSession) {
      statusDot.className = 'session-timer-status-dot inactive';
      statusText.textContent = 'Inactive';
    } else if (timer.timeRemaining < 600000) {
      statusDot.className = 'session-timer-status-dot warning';
      statusText.textContent = 'Ending Soon';
    } else {
      statusDot.className = 'session-timer-status-dot active';
      statusText.textContent = 'Active';
    }
  }

  /**
   * Cleanup component
   */
  destroy() {
    this.stopAutoUpdate();
    if (window.sessionTimer === this) {
      delete window.sessionTimer;
    }
    this.isInitialized = false;
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionTimer;
}

// Global registration for browser
if (typeof window !== 'undefined') {
  window.SessionTimer = SessionTimer;
}