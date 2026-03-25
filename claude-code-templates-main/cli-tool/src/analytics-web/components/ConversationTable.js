/**
 * ConversationTable - Handles the conversations table display and interactions
 * Part of the modular frontend architecture
 */
class ConversationTable {
  constructor(container, dataService, stateService) {
    this.container = container;
    this.dataService = dataService;
    this.stateService = stateService;
    this.conversations = [];
    this.currentFilter = 'all';
    this.currentSort = { field: 'lastModified', direction: 'desc' };
    this.pageSize = 50;
    this.currentPage = 1;
    
    // Subscribe to state changes
    this.unsubscribe = this.stateService.subscribe(this.handleStateChange.bind(this));
  }

  /**
   * Initialize the conversation table
   */
  async initialize() {
    this.render();
    this.bindEvents();
    await this.loadConversations();
  }

  /**
   * Handle state changes from StateService
   * @param {Object} state - New state
   * @param {string} action - Action that caused the change
   */
  handleStateChange(state, action) {
    if (action === 'update_conversations' || action === 'update_conversation_states') {
      this.conversations = state.conversations;
      this.updateTable();
    }
  }

  /**
   * Render the conversation table structure
   */
  render() {
    this.container.innerHTML = `
      <div class="conversation-table-container">
        <div class="table-header">
          <div class="table-controls">
            <div class="filter-controls">
              <select class="filter-select" id="status-filter">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="waiting">Waiting</option>
                <option value="idle">Idle</option>
                <option value="completed">Completed</option>
              </select>
              <input type="text" class="search-input" placeholder="Search conversations..." id="search-input">
            </div>
            <div class="pagination-info">
              <span id="pagination-text">Showing 0 of 0 conversations</span>
            </div>
          </div>
        </div>
        
        <div class="table-wrapper">
          <table class="conversation-table">
            <thead>
              <tr>
                <th class="sortable" data-field="status">Status</th>
                <th class="sortable" data-field="id">ID</th>
                <th class="sortable" data-field="project">Project</th>
                <th class="sortable" data-field="tokens">Tokens</th>
                <th class="sortable" data-field="lastModified">Last Modified</th>
                <th class="sortable" data-field="messages">Messages</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="conversation-tbody">
              <tr class="loading-row">
                <td colspan="7" class="loading-cell">Loading conversations...</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="table-footer">
          <div class="pagination-controls">
            <button class="pagination-btn" id="prev-page" disabled>Previous</button>
            <span id="page-info">Page 1 of 1</span>
            <button class="pagination-btn" id="next-page" disabled>Next</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Filter and search
    const statusFilter = this.container.querySelector('#status-filter');
    const searchInput = this.container.querySelector('#search-input');
    
    statusFilter.addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.currentPage = 1;
      this.updateTable();
    });

    searchInput.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.currentPage = 1;
      this.updateTable();
    });

    // Sorting
    const sortHeaders = this.container.querySelectorAll('.sortable');
    sortHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const field = header.dataset.field;
        this.handleSort(field);
      });
    });

    // Pagination
    const prevBtn = this.container.querySelector('#prev-page');
    const nextBtn = this.container.querySelector('#next-page');
    
    prevBtn.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.updateTable();
      }
    });

    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(this.getFilteredConversations().length / this.pageSize);
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.updateTable();
      }
    });
  }

  /**
   * Load conversations from data service
   */
  async loadConversations() {
    try {
      const data = await this.dataService.getConversations();
      this.conversations = data.conversations || [];
      this.updateTable();
    } catch (error) {
      console.error('Error loading conversations:', error);
      this.showError('Failed to load conversations');
    }
  }

  /**
   * Handle sorting
   * @param {string} field - Field to sort by
   */
  handleSort(field) {
    if (this.currentSort.field === field) {
      this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSort.field = field;
      this.currentSort.direction = 'asc';
    }
    this.updateTable();
  }

  /**
   * Get filtered conversations based on current filter and search
   * @returns {Array} Filtered conversations
   */
  getFilteredConversations() {
    let filtered = [...this.conversations];

    // Apply status filter
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(conv => conv.status === this.currentFilter);
    }

    // Apply search filter
    if (this.searchTerm) {
      filtered = filtered.filter(conv => 
        conv.id.toLowerCase().includes(this.searchTerm) ||
        conv.project.toLowerCase().includes(this.searchTerm) ||
        conv.filename.toLowerCase().includes(this.searchTerm)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[this.currentSort.field];
      let bValue = b[this.currentSort.field];

      // Handle different data types
      if (this.currentSort.field === 'lastModified') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (this.currentSort.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }

  /**
   * Update the table display
   */
  updateTable() {
    const filtered = this.getFilteredConversations();
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const pageData = filtered.slice(startIndex, endIndex);

    this.renderTableBody(pageData);
    this.updatePagination(filtered.length);
    this.updateSortHeaders();
  }

  /**
   * Render table body with conversation data
   * @param {Array} conversations - Conversations to display
   */
  renderTableBody(conversations) {
    const tbody = this.container.querySelector('#conversation-tbody');
    
    if (conversations.length === 0) {
      tbody.innerHTML = `
        <tr class="no-data-row">
          <td colspan="7" class="no-data-cell">
            ${this.currentFilter === 'all' ? 'No conversations found' : `No ${this.currentFilter} conversations found`}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = conversations.map(conv => `
      <tr class="conversation-row" data-id="${conv.id}">
        <td class="status-cell">
          <span class="status-badge status-${conv.status}">${conv.status}</span>
        </td>
        <td class="id-cell">
          <span class="conversation-id" title="${conv.id}">${conv.id.slice(0, 8)}...</span>
        </td>
        <td class="project-cell">
          <span class="project-name">${conv.project}</span>
        </td>
        <td class="tokens-cell">
          <span class="token-count">${conv.tokens.toLocaleString()}</span>
        </td>
        <td class="modified-cell">
          <span class="modified-time" title="${conv.lastModified}">
            ${this.formatRelativeTime(conv.lastModified)}
          </span>
        </td>
        <td class="messages-cell">
          <span class="message-count">${conv.messages}</span>
        </td>
        <td class="actions-cell">
          <button class="action-btn view-btn" data-id="${conv.id}" title="View details">
            👁️
          </button>
          <button class="action-btn refresh-btn" data-id="${conv.id}" title="Refresh status">
            🔄
          </button>
        </td>
      </tr>
    `).join('');

    // Bind action buttons
    this.bindActionButtons();
  }

  /**
   * Bind action button events
   */
  bindActionButtons() {
    const viewBtns = this.container.querySelectorAll('.view-btn');
    const refreshBtns = this.container.querySelectorAll('.refresh-btn');

    viewBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const conversationId = e.target.dataset.id;
        this.viewConversation(conversationId);
      });
    });

    refreshBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const conversationId = e.target.dataset.id;
        this.refreshConversation(conversationId);
      });
    });
  }

  /**
   * View conversation details
   * @param {string} conversationId - ID of conversation to view
   */
  viewConversation(conversationId) {
    const conversation = this.conversations.find(conv => conv.id === conversationId);
    if (conversation) {
      this.stateService.setSelectedConversation(conversation);
      // Could trigger a modal or navigation to detail view
      console.log('Viewing conversation:', conversation);
    }
  }

  /**
   * Refresh conversation status
   * @param {string} conversationId - ID of conversation to refresh
   */
  async refreshConversation(conversationId) {
    try {
      // Force refresh of conversation states
      this.dataService.clearCacheEntry('/api/conversation-state');
      const states = await this.dataService.getConversationStates();
      this.stateService.updateConversationStates(states);
    } catch (error) {
      console.error('Error refreshing conversation:', error);
    }
  }

  /**
   * Update pagination controls
   * @param {number} totalItems - Total number of items
   */
  updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / this.pageSize);
    const startItem = (this.currentPage - 1) * this.pageSize + 1;
    const endItem = Math.min(this.currentPage * this.pageSize, totalItems);

    // Update pagination text
    const paginationText = this.container.querySelector('#pagination-text');
    paginationText.textContent = `Showing ${startItem}-${endItem} of ${totalItems} conversations`;

    // Update page info
    const pageInfo = this.container.querySelector('#page-info');
    pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;

    // Update button states
    const prevBtn = this.container.querySelector('#prev-page');
    const nextBtn = this.container.querySelector('#next-page');
    
    prevBtn.disabled = this.currentPage === 1;
    nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
  }

  /**
   * Update sort headers visual state
   */
  updateSortHeaders() {
    const headers = this.container.querySelectorAll('.sortable');
    headers.forEach(header => {
      header.classList.remove('sort-asc', 'sort-desc');
      if (header.dataset.field === this.currentSort.field) {
        header.classList.add(`sort-${this.currentSort.direction}`);
      }
    });
  }

  /**
   * Format relative time
   * @param {string} dateString - Date string to format
   * @returns {string} Formatted relative time
   */
  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    const tbody = this.container.querySelector('#conversation-tbody');
    tbody.innerHTML = `
      <tr class="error-row">
        <td colspan="7" class="error-cell">
          <span class="error-message">⚠️ ${message}</span>
        </td>
      </tr>
    `;
  }

  /**
   * Update conversation state in real-time
   * @param {string} conversationId - ID of conversation
   * @param {string} newState - New state
   */
  updateConversationState(conversationId, newState) {
    const conversation = this.conversations.find(conv => conv.id === conversationId);
    if (conversation) {
      conversation.status = newState;
      this.updateTable();
    }
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConversationTable;
}