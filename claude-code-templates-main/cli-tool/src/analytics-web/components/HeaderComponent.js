/**
 * HeaderComponent - Unified header for all analytics pages
 * Provides consistent branding, navigation, and controls across the application
 */
class HeaderComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      title: options.title || 'Claude Code Analytics Dashboard',
      subtitle: options.subtitle || 'Real-time monitoring and analytics for Claude Code sessions',
      showVersionBadge: options.showVersionBadge !== false,
      showLastUpdate: options.showLastUpdate !== false,
      showThemeSwitch: options.showThemeSwitch !== false,
      showGitHubLink: options.showGitHubLink !== false,
      version: options.version || 'v1.13.2', // Default fallback
      customActions: options.customActions || [],
      dataService: options.dataService || null, // DataService for dynamic version loading
      ...options
    };
    
    this.lastUpdateTime = null;
    this.updateInterval = null;
    this.actualVersion = this.options.version; // Will be updated dynamically
  }

  /**
   * Render the header component
   */
  render() {
    const headerHTML = `
      <div class="page-header">
        <div class="header-content">
          <div class="header-left">
            <div class="status-header">
              <span class="session-timer-status-dot active" id="session-status-dot"></span>
              <h1 class="page-title">
                ${this.options.title}
                ${this.options.showVersionBadge ? `<span class="version-badge" id="version-badge">${this.actualVersion}</span>` : ''}
              </h1>
            </div>
            <div class="page-subtitle">
              ${this.options.subtitle}
            </div>
            ${this.options.showLastUpdate ? `
              <div class="last-update-header">
                <span class="last-update-label">last update:</span>
                <span id="last-update-header-text">Never</span>
              </div>
            ` : ''}
          </div>
          <div class="header-right">
            ${this.options.showThemeSwitch ? `
              <div class="theme-switch-container" title="Toggle light/dark theme">
                <div class="theme-switch" id="header-theme-switch">
                  <div class="theme-switch-track">
                    <div class="theme-switch-thumb" id="header-theme-switch-thumb">
                      <span class="theme-switch-icon">🌙</span>
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}
            ${this.options.showGitHubLink ? `
              <a href="https://github.com/davila7/claude-code-templates" target="_blank" class="github-link" title="Star on GitHub">
                <span class="github-icon">⭐</span>
                Star on GitHub
              </a>
            ` : ''}
            ${this.renderCustomActions()}
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = headerHTML;
    this.bindEvents();
    this.initializeTheme();
    
    if (this.options.showLastUpdate) {
      this.updateLastUpdateTime();
      this.startUpdateInterval();
    }

    // Load version dynamically if DataService is available
    if (this.options.dataService) {
      this.loadVersion();
    }
  }

  /**
   * Render custom actions in header
   */
  renderCustomActions() {
    if (!this.options.customActions || this.options.customActions.length === 0) {
      return '';
    }

    return this.options.customActions.map(action => `
      <button class="header-action-btn" id="${action.id}" title="${action.title || action.label}">
        ${action.icon ? `<span class="btn-icon">${action.icon}</span>` : ''}
        ${action.label}
      </button>
    `).join('');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Theme toggle
    if (this.options.showThemeSwitch) {
      const themeSwitch = this.container.querySelector('#header-theme-switch');
      if (themeSwitch) {
        themeSwitch.addEventListener('click', () => this.toggleTheme());
      }
    }

    // Custom action handlers
    this.options.customActions.forEach(action => {
      const btn = this.container.querySelector(`#${action.id}`);
      if (btn && action.handler) {
        btn.addEventListener('click', action.handler);
      }
    });
  }

  /**
   * Initialize theme from localStorage
   */
  initializeTheme() {
    if (!this.options.showThemeSwitch) return;

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
    
    // Also sync with global theme switch if exists
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
    if (!this.options.showLastUpdate) return;

    const currentTime = new Date().toLocaleTimeString();
    const lastUpdateText = this.container.querySelector('#last-update-header-text');
    
    if (lastUpdateText) {
      lastUpdateText.textContent = currentTime;
    }
    
    this.lastUpdateTime = currentTime;
  }

  /**
   * Start periodic update of timestamp
   */
  startUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Update every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updateLastUpdateTime();
    }, 30000);
  }

  /**
   * Stop update interval
   */
  stopUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Load version dynamically from backend
   */
  async loadVersion() {
    if (!this.options.dataService) return;

    try {
      const versionData = await this.options.dataService.getVersion();
      if (versionData && versionData.version) {
        this.actualVersion = `v${versionData.version}`;
        this.updateVersionBadge();
      }
    } catch (error) {
      console.error('Error loading version:', error);
    }
  }

  /**
   * Update version badge in the DOM
   */
  updateVersionBadge() {
    const versionBadge = this.container.querySelector('#version-badge');
    if (versionBadge) {
      versionBadge.textContent = this.actualVersion;
    }
  }

  /**
   * Update header title
   * @param {string} title - New title
   */
  updateTitle(title) {
    this.options.title = title;
    const titleElement = this.container.querySelector('.page-title');
    if (titleElement) {
      titleElement.innerHTML = `
        ${title}
        ${this.options.showVersionBadge ? `<span class="version-badge" id="version-badge">${this.actualVersion}</span>` : ''}
      `;
    }
  }

  /**
   * Update header subtitle
   * @param {string} subtitle - New subtitle
   */
  updateSubtitle(subtitle) {
    this.options.subtitle = subtitle;
    const subtitleElement = this.container.querySelector('.page-subtitle');
    if (subtitleElement) {
      subtitleElement.textContent = subtitle;
    }
  }

  /**
   * Update status dot state
   * @param {boolean} active - Whether status should be active
   */
  updateStatusDot(active) {
    const statusDot = this.container.querySelector('#session-status-dot');
    if (statusDot) {
      statusDot.classList.toggle('active', active);
    }
  }

  /**
   * Get current theme
   * @returns {string} Current theme ('light' or 'dark')
   */
  getCurrentTheme() {
    return document.body.getAttribute('data-theme') || 'dark';
  }

  /**
   * Destroy header component
   */
  destroy() {
    this.stopUpdateInterval();
    this.container.innerHTML = '';
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HeaderComponent;
}