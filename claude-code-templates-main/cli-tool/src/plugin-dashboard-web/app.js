// Plugin Dashboard Application - Enhanced UX
class PluginDashboard {
  constructor() {
    this.data = {
      marketplaces: [],
      plugins: [],
      summary: {}
    };

    this.state = {
      selectedMarketplace: null,
      pluginStatusFilter: 'all',
      marketplaceStatusFilter: 'all',
      searchQuery: '',
      sortBy: 'status',
      viewMode: 'grid',
      sidebarCollapsed: false
    };
  }

  async init() {
    this.setupEventListeners();
    await this.loadData();
    this.restoreViewPreferences();
    this.startAutoRefresh();
  }

  setupEventListeners() {
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    // Marketplace filter buttons in sidebar
    document.querySelectorAll('.marketplace-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.target.dataset.filter;
        this.setMarketplaceStatusFilter(filter);
      });
    });

    // Plugin status filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const filter = e.currentTarget.dataset.filter;
        this.setPluginStatusFilter(filter);
      });
    });

    // Search input
    const searchInput = document.getElementById('pluginSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value.toLowerCase().trim();
        this.renderPlugins();
      });
    }

    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.state.sortBy = e.target.value;
        this.renderPlugins();
      });
    }

    // View mode toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.setViewMode(view);
      });
    });

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearAllFilters());
    }

    // Modal close handlers
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalOverlay = document.getElementById('pluginModal');

    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => this.closeModal());
    }

    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.closeModal();
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
      if (e.key === '/' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        searchInput?.focus();
      }
    });
  }

  async loadData() {
    try {
      const [marketplacesRes, pluginsRes, summaryRes] = await Promise.all([
        fetch('/api/marketplaces'),
        fetch('/api/plugins'),
        fetch('/api/summary')
      ]);

      const [marketplacesData, pluginsData, summaryData] = await Promise.all([
        marketplacesRes.json(),
        pluginsRes.json(),
        summaryRes.json()
      ]);

      this.data.marketplaces = marketplacesData.marketplaces || [];
      this.data.plugins = pluginsData.plugins || [];
      this.data.summary = summaryData;

      this.renderAll();
    } catch (error) {
      console.error('Error loading data:', error);
      this.showError('Failed to load dashboard data');
    }
  }

  renderAll() {
    this.updateSidebarStats();
    this.renderMarketplaces();
    this.renderPlugins();
    this.updateFilterCounts();
  }

  updateSidebarStats() {
    const totalPlugins = this.data.plugins.length;
    const enabledPlugins = this.data.plugins.filter(p => p.enabled).length;

    document.getElementById('sidebarTotalPlugins').textContent = totalPlugins;
    document.getElementById('sidebarEnabledPlugins').textContent = enabledPlugins;
  }

  getFilteredMarketplaces() {
    let filtered = [...this.data.marketplaces];

    if (this.state.marketplaceStatusFilter === 'enabled') {
      filtered = filtered.filter(m => m.enabled);
    } else if (this.state.marketplaceStatusFilter === 'disabled') {
      filtered = filtered.filter(m => !m.enabled);
    }

    return filtered;
  }

  renderMarketplaces() {
    const nav = document.getElementById('marketplaceNav');
    if (!nav) return;

    const marketplaces = this.getFilteredMarketplaces();

    document.getElementById('marketplaceCount').textContent = marketplaces.length;

    if (marketplaces.length === 0) {
      nav.innerHTML = `
        <div class="sidebar-empty">
          <p>No marketplaces found</p>
        </div>
      `;
      return;
    }

    // Add "All Plugins" option
    const allPluginsActive = this.state.selectedMarketplace === null ? 'active' : '';
    let html = `
      <button class="marketplace-item ${allPluginsActive}" data-marketplace="all">
        <span class="marketplace-icon">🧩</span>
        <div class="marketplace-info">
          <span class="marketplace-name">All Plugins</span>
          <span class="marketplace-count">${this.data.plugins.length} plugins</span>
        </div>
      </button>
    `;

    // Add individual marketplaces
    html += marketplaces.map(marketplace => {
      const isActive = this.state.selectedMarketplace === marketplace.name ? 'active' : '';
      const statusClass = marketplace.enabled ? 'enabled' : 'disabled';
      const icon = this.getMarketplaceIcon(marketplace.type);

      return `
        <button class="marketplace-item ${isActive} ${statusClass}" data-marketplace="${this.escapeHtml(marketplace.name)}">
          <span class="marketplace-icon">${icon}</span>
          <div class="marketplace-info">
            <span class="marketplace-name">${this.escapeHtml(marketplace.name)}</span>
            <span class="marketplace-count">${marketplace.pluginCount} plugins</span>
          </div>
          ${marketplace.enabled
            ? '<span class="marketplace-status enabled"></span>'
            : '<span class="marketplace-status disabled"></span>'}
        </button>
      `;
    }).join('');

    nav.innerHTML = html;

    // Add click handlers
    nav.querySelectorAll('.marketplace-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const marketplace = e.currentTarget.dataset.marketplace;
        this.selectMarketplace(marketplace === 'all' ? null : marketplace);
      });
    });
  }

  selectMarketplace(marketplaceName) {
    this.state.selectedMarketplace = marketplaceName;
    this.renderMarketplaces();
    this.renderPlugins();
    this.updatePageTitle();
  }

  updatePageTitle() {
    const nameEl = document.getElementById('currentMarketplaceName');
    const iconEl = document.getElementById('currentMarketplaceIcon');

    if (this.state.selectedMarketplace) {
      const marketplace = this.data.marketplaces.find(m => m.name === this.state.selectedMarketplace);
      nameEl.textContent = this.state.selectedMarketplace;
      iconEl.textContent = marketplace ? this.getMarketplaceIcon(marketplace.type) : '📦';
    } else {
      nameEl.textContent = 'All Plugins';
      iconEl.textContent = '🧩';
    }
  }

  getMarketplaceIcon(type) {
    const icons = {
      'GitHub': '🐙',
      'Git': '📁',
      'Local': '💻',
      'default': '📦'
    };
    return icons[type] || icons.default;
  }

  setMarketplaceStatusFilter(filter) {
    this.state.marketplaceStatusFilter = filter;

    document.querySelectorAll('.marketplace-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    this.renderMarketplaces();
  }

  setPluginStatusFilter(filter) {
    this.state.pluginStatusFilter = filter;

    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === filter);
    });

    this.renderPlugins();
  }

  getFilteredPlugins() {
    let filtered = [...this.data.plugins];

    // Filter by marketplace
    if (this.state.selectedMarketplace) {
      filtered = filtered.filter(p => p.marketplace === this.state.selectedMarketplace);
    }

    // Filter by status
    if (this.state.pluginStatusFilter === 'enabled') {
      filtered = filtered.filter(p => p.enabled);
    } else if (this.state.pluginStatusFilter === 'disabled') {
      filtered = filtered.filter(p => !p.enabled);
    }

    // Filter by search query
    if (this.state.searchQuery) {
      filtered = filtered.filter(p => {
        const searchStr = this.state.searchQuery;
        return (
          p.name.toLowerCase().includes(searchStr) ||
          p.description.toLowerCase().includes(searchStr) ||
          p.marketplace.toLowerCase().includes(searchStr) ||
          (p.category && p.category.toLowerCase().includes(searchStr))
        );
      });
    }

    // Sort plugins
    filtered = this.sortPlugins(filtered);

    return filtered;
  }

  sortPlugins(plugins) {
    const sorted = [...plugins];

    switch (this.state.sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'components':
        sorted.sort((a, b) => {
          const aTotal = Object.values(a.components).reduce((sum, val) => sum + val, 0);
          const bTotal = Object.values(b.components).reduce((sum, val) => sum + val, 0);
          return bTotal - aTotal;
        });
        break;
      case 'status':
        sorted.sort((a, b) => {
          if (a.enabled === b.enabled) return a.name.localeCompare(b.name);
          return a.enabled ? -1 : 1;
        });
        break;
    }

    return sorted;
  }

  updateFilterCounts() {
    const allPlugins = this.getFilteredPluginsBase();
    const enabled = allPlugins.filter(p => p.enabled).length;
    const disabled = allPlugins.filter(p => !p.enabled).length;

    document.getElementById('countAll').textContent = allPlugins.length;
    document.getElementById('countEnabled').textContent = enabled;
    document.getElementById('countDisabled').textContent = disabled;
  }

  getFilteredPluginsBase() {
    let filtered = [...this.data.plugins];

    if (this.state.selectedMarketplace) {
      filtered = filtered.filter(p => p.marketplace === this.state.selectedMarketplace);
    }

    if (this.state.searchQuery) {
      filtered = filtered.filter(p => {
        const searchStr = this.state.searchQuery;
        return (
          p.name.toLowerCase().includes(searchStr) ||
          p.description.toLowerCase().includes(searchStr) ||
          p.marketplace.toLowerCase().includes(searchStr) ||
          (p.category && p.category.toLowerCase().includes(searchStr))
        );
      });
    }

    return filtered;
  }

  renderPlugins() {
    const container = document.getElementById('pluginsContainer');
    const emptyState = document.getElementById('emptyState');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    if (!container) return;

    const plugins = this.getFilteredPlugins();
    this.updateFilterCounts();

    if (plugins.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'flex';

      const hasFilters = this.state.selectedMarketplace ||
                         this.state.pluginStatusFilter !== 'all' ||
                         this.state.searchQuery;

      clearFiltersBtn.style.display = hasFilters ? 'inline-block' : 'none';

      document.getElementById('emptyDescription').textContent = hasFilters
        ? 'Try adjusting your filters or search terms'
        : 'No plugins available in this marketplace';

      return;
    }

    emptyState.style.display = 'none';

    const viewClass = this.state.viewMode === 'list' ? 'plugins-list' : 'plugins-grid';
    container.className = `plugins-container ${viewClass}`;

    if (this.state.viewMode === 'grid') {
      container.innerHTML = plugins.map(plugin => this.renderPluginCard(plugin)).join('');
    } else {
      container.innerHTML = plugins.map(plugin => this.renderPluginListItem(plugin)).join('');
    }

    // Add click handlers to cards
    container.querySelectorAll('[data-plugin]').forEach(card => {
      card.addEventListener('click', () => {
        const pluginName = card.dataset.plugin;
        this.showPluginDetails(pluginName);
      });
    });
  }

  renderPluginCard(plugin) {
    const statusClass = plugin.enabled ? 'enabled' : 'disabled';
    const totalComponents = Object.values(plugin.components).reduce((sum, val) => sum + val, 0);

    return `
      <article class="plugin-card ${statusClass}" data-plugin="${this.escapeHtml(plugin.name)}">
        <div class="plugin-card-header">
          <div class="plugin-card-status ${statusClass}"></div>
          <h3 class="plugin-card-title">${this.escapeHtml(plugin.name)}</h3>
          <span class="plugin-card-version">v${plugin.version}</span>
        </div>

        <p class="plugin-card-description">${this.escapeHtml(plugin.description)}</p>

        <div class="plugin-card-components">
          <div class="component-badge" title="Agents">
            <span class="component-icon">🤖</span>
            <span class="component-value">${plugin.components.agents || 0}</span>
          </div>
          <div class="component-badge" title="Commands">
            <span class="component-icon">⚡</span>
            <span class="component-value">${plugin.components.commands || 0}</span>
          </div>
          <div class="component-badge" title="Hooks">
            <span class="component-icon">🪝</span>
            <span class="component-value">${plugin.components.hooks || 0}</span>
          </div>
          <div class="component-badge" title="MCPs">
            <span class="component-icon">🔌</span>
            <span class="component-value">${plugin.components.mcps || 0}</span>
          </div>
        </div>

        <div class="plugin-card-footer">
          <span class="plugin-card-marketplace">${this.escapeHtml(plugin.marketplace)}</span>
          <span class="plugin-card-total">${totalComponents} component${totalComponents !== 1 ? 's' : ''}</span>
        </div>
      </article>
    `;
  }

  renderPluginListItem(plugin) {
    const statusClass = plugin.enabled ? 'enabled' : 'disabled';
    const totalComponents = Object.values(plugin.components).reduce((sum, val) => sum + val, 0);

    return `
      <article class="plugin-list-item ${statusClass}" data-plugin="${this.escapeHtml(plugin.name)}">
        <div class="plugin-list-status ${statusClass}"></div>

        <div class="plugin-list-main">
          <div class="plugin-list-info">
            <h3 class="plugin-list-title">${this.escapeHtml(plugin.name)}</h3>
            <p class="plugin-list-description">${this.escapeHtml(plugin.description)}</p>
          </div>

          <div class="plugin-list-meta">
            <span class="plugin-list-version">v${plugin.version}</span>
            <span class="plugin-list-marketplace">${this.escapeHtml(plugin.marketplace)}</span>
          </div>
        </div>

        <div class="plugin-list-components">
          <div class="component-badge-sm" title="Agents">
            <span class="component-icon">🤖</span>
            <span class="component-value">${plugin.components.agents || 0}</span>
          </div>
          <div class="component-badge-sm" title="Commands">
            <span class="component-icon">⚡</span>
            <span class="component-value">${plugin.components.commands || 0}</span>
          </div>
          <div class="component-badge-sm" title="Hooks">
            <span class="component-icon">🪝</span>
            <span class="component-value">${plugin.components.hooks || 0}</span>
          </div>
          <div class="component-badge-sm" title="MCPs">
            <span class="component-icon">🔌</span>
            <span class="component-value">${plugin.components.mcps || 0}</span>
          </div>
        </div>

        <div class="plugin-list-action">
          <span class="action-icon">→</span>
        </div>
      </article>
    `;
  }

  showPluginDetails(pluginName) {
    const plugin = this.data.plugins.find(p => p.name === pluginName);
    if (!plugin) return;

    document.getElementById('modalPluginName').textContent = plugin.name;
    document.getElementById('modalPluginVersion').textContent = `v${plugin.version}`;

    const statusBadge = document.getElementById('modalPluginStatus');
    statusBadge.textContent = plugin.enabled ? 'Enabled' : 'Disabled';
    statusBadge.className = `modal-badge status-badge ${plugin.enabled ? 'enabled' : 'disabled'}`;

    document.getElementById('modalPluginDescription').textContent = plugin.description;

    // Components
    document.getElementById('modalComponents').innerHTML = `
      <div class="modal-component-card">
        <div class="modal-component-icon">🤖</div>
        <div class="modal-component-count">${plugin.components.agents || 0}</div>
        <div class="modal-component-label">Agents</div>
      </div>
      <div class="modal-component-card">
        <div class="modal-component-icon">⚡</div>
        <div class="modal-component-count">${plugin.components.commands || 0}</div>
        <div class="modal-component-label">Commands</div>
      </div>
      <div class="modal-component-card">
        <div class="modal-component-icon">🪝</div>
        <div class="modal-component-count">${plugin.components.hooks || 0}</div>
        <div class="modal-component-label">Hooks</div>
      </div>
      <div class="modal-component-card">
        <div class="modal-component-icon">🔌</div>
        <div class="modal-component-count">${plugin.components.mcps || 0}</div>
        <div class="modal-component-label">MCPs</div>
      </div>
    `;

    // Details
    document.getElementById('modalMarketplace').textContent = plugin.marketplace;

    // Conditional fields
    const authorCard = document.getElementById('modalAuthorCard');
    if (plugin.author) {
      authorCard.style.display = 'flex';
      document.getElementById('modalAuthor').textContent =
        typeof plugin.author === 'object' ? plugin.author.name : plugin.author;
    } else {
      authorCard.style.display = 'none';
    }

    const categoryCard = document.getElementById('modalCategoryCard');
    if (plugin.category) {
      categoryCard.style.display = 'flex';
      document.getElementById('modalCategory').textContent = plugin.category;
    } else {
      categoryCard.style.display = 'none';
    }

    const licenseCard = document.getElementById('modalLicenseCard');
    if (plugin.license) {
      licenseCard.style.display = 'flex';
      document.getElementById('modalLicense').textContent =
        typeof plugin.license === 'object' ? plugin.license.type : plugin.license;
    } else {
      licenseCard.style.display = 'none';
    }

    // Keywords
    const keywordsSection = document.getElementById('modalKeywordsSection');
    if (plugin.keywords && plugin.keywords.length > 0) {
      keywordsSection.style.display = 'block';
      document.getElementById('modalKeywords').innerHTML = plugin.keywords
        .map(kw => `<span class="keyword-tag">${this.escapeHtml(kw)}</span>`)
        .join('');
    } else {
      keywordsSection.style.display = 'none';
    }

    // Homepage
    const homepageSection = document.getElementById('modalHomepageSection');
    if (plugin.homepage) {
      homepageSection.style.display = 'block';
      document.getElementById('modalHomepage').href = plugin.homepage;
    } else {
      homepageSection.style.display = 'none';
    }

    // Render plugin actions and update command references
    this.renderPluginActions(plugin);
    this.updateCommandReferences(plugin);

    // Show modal
    document.getElementById('pluginModal').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // ==================== PLUGIN ACTIONS & COMMANDS ====================

  renderPluginActions(plugin) {
    const actionsContainer = document.getElementById('modalActions');
    if (!actionsContainer) return;

    const pluginIdentifier = `${plugin.name}@${plugin.marketplace}`;

    // Determine which buttons to show based on plugin status
    let buttons = [];

    if (!plugin.enabled) {
      // Plugin is disabled or not installed - show install button
      buttons.push({
        label: 'Install Plugin',
        icon: '📥',
        class: 'install-btn',
        command: 'install'
      });
    } else {
      // Plugin is enabled - show disable and uninstall buttons
      buttons.push({
        label: 'Disable Plugin',
        icon: '⏸️',
        class: 'disable-btn',
        command: 'disable'
      });
    }

    // Always show uninstall if enabled
    if (plugin.enabled) {
      buttons.push({
        label: 'Uninstall Plugin',
        icon: '🗑️',
        class: 'uninstall-btn',
        command: 'uninstall'
      });
    }

    // If disabled but installed, show enable button
    if (!plugin.enabled && this.isPluginInstalled(plugin)) {
      buttons.unshift({
        label: 'Enable Plugin',
        icon: '✅',
        class: 'enable-btn',
        command: 'enable'
      });
    }

    actionsContainer.innerHTML = buttons.map(btn => `
      <button class="action-button ${btn.class}" onclick="window.dashboard.copyPluginCommand('${btn.command}', '${this.escapeHtml(pluginIdentifier)}')">
        <span class="action-icon">${btn.icon}</span>
        ${btn.label}
      </button>
    `).join('');
  }

  isPluginInstalled(plugin) {
    // This is a simple heuristic - in a real implementation, you'd check the actual installation status
    return plugin.components.agents > 0 || plugin.components.commands > 0 ||
           plugin.components.hooks > 0 || plugin.components.mcps > 0;
  }

  updateCommandReferences(plugin) {
    const pluginIdentifier = `${plugin.name}@${plugin.marketplace}`;

    document.getElementById('installCommand').textContent = `/plugin install ${pluginIdentifier}`;
    document.getElementById('enableCommand').textContent = `/plugin enable ${pluginIdentifier}`;
    document.getElementById('disableCommand').textContent = `/plugin disable ${pluginIdentifier}`;
    document.getElementById('uninstallCommand').textContent = `/plugin uninstall ${pluginIdentifier}`;

    // Store current plugin for command copying
    this.currentPlugin = plugin;
  }

  copyCommand(commandType) {
    if (!this.currentPlugin) return;

    const pluginIdentifier = `${this.currentPlugin.name}@${this.currentPlugin.marketplace}`;
    const command = `/plugin ${commandType} ${pluginIdentifier}`;

    this.copyToClipboard(command);
    this.showToast(`Command copied: ${command}`);
  }

  copyPluginCommand(commandType, pluginIdentifier) {
    const command = `/plugin ${commandType} ${pluginIdentifier}`;
    this.copyToClipboard(command);
    this.showToast(`Command copied: ${command}`);
  }

  copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          console.log('Command copied to clipboard:', text);
        })
        .catch(err => {
          console.error('Failed to copy:', err);
          this.fallbackCopy(text);
        });
    } else {
      this.fallbackCopy(text);
    }
  }

  fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      console.log('Command copied to clipboard (fallback):', text);
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }

    document.body.removeChild(textarea);
  }

  showToast(message) {
    const toast = document.getElementById('commandToast');
    if (!toast) return;

    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  closeModal() {
    document.getElementById('pluginModal').classList.remove('active');
    document.body.style.overflow = '';
  }

  setViewMode(mode) {
    this.state.viewMode = mode;

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === mode);
    });

    this.renderPlugins();
    localStorage.setItem('pluginDashboardViewMode', mode);
  }

  toggleSidebar() {
    this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed', this.state.sidebarCollapsed);
    localStorage.setItem('sidebarCollapsed', this.state.sidebarCollapsed);
  }

  restoreViewPreferences() {
    const savedViewMode = localStorage.getItem('pluginDashboardViewMode');
    if (savedViewMode) {
      this.setViewMode(savedViewMode);
    }

    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState === 'true') {
      this.toggleSidebar();
    }
  }

  clearAllFilters() {
    this.state.selectedMarketplace = null;
    this.state.pluginStatusFilter = 'all';
    this.state.searchQuery = '';

    document.getElementById('pluginSearch').value = '';

    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === 'all');
    });

    this.renderMarketplaces();
    this.renderPlugins();
    this.updatePageTitle();
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    console.error(message);
  }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new PluginDashboard();
  window.dashboard.init();
});

  // ==================== REFRESH FUNCTIONALITY ====================
