// State Management
const state = {
  skills: [],
  filteredSkills: [],
  currentFilter: 'all',
  currentSort: 'name',
  currentView: 'grid',
  searchQuery: '',
  currentSkill: null
};

// API Base URL
const API_BASE = '';

// Initialize Dashboard
async function initDashboard() {
  setupEventListeners();
  await loadSkills();
  renderSkills();
  updateStats();
}

// Setup Event Listeners
function setupEventListeners() {
  // Sidebar toggle
  document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);

  // Search
  document.getElementById('skillSearch')?.addEventListener('input', handleSearch);

  // Refresh
  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    await loadSkills();
    renderSkills();
    updateStats();
  });

  // View toggles
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view;
      setView(view);
    });
  });

  // Source filters (sidebar)
  document.querySelectorAll('.source-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filter = e.currentTarget.dataset.filter;
      setSourceFilter(filter);
    });
  });

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const filter = e.currentTarget.dataset.filter;
      setFilter(filter);
    });
  });

  // Sort
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    state.currentSort = e.target.value;
    renderSkills();
  });

  // Modal
  document.getElementById('closeModal')?.addEventListener('click', closeModal);
  document.getElementById('skillModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'skillModal') closeModal();
  });


  // Clear filters
  document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
}

// Load Skills from API
async function loadSkills() {
  try {
    const response = await fetch(`${API_BASE}/api/skills`);
    const data = await response.json();
    state.skills = data.skills || [];
    state.filteredSkills = [...state.skills];
    applyFiltersAndSearch();
  } catch (error) {
    console.error('Error loading skills:', error);
    showError('Failed to load skills');
  }
}

// Apply Filters and Search
function applyFiltersAndSearch() {
  let filtered = [...state.skills];

  // Apply source filter
  if (state.currentFilter !== 'all') {
    filtered = filtered.filter(skill =>
      skill.source.toLowerCase() === state.currentFilter.toLowerCase()
    );
  }

  // Apply search
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(skill =>
      skill.name.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query)
    );
  }

  // Apply sorting
  filtered.sort((a, b) => {
    switch (state.currentSort) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'files':
        return (b.fileCount || 0) - (a.fileCount || 0);
      case 'modified':
        return new Date(b.lastModified) - new Date(a.lastModified);
      default:
        return 0;
    }
  });

  state.filteredSkills = filtered;
}

// Render Skills Grid/List
function renderSkills() {
  const container = document.getElementById('skillsContainer');
  const emptyState = document.getElementById('emptyState');

  if (!container) return;

  if (state.filteredSkills.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'flex';
    updateEmptyState();
    return;
  }

  container.style.display = 'grid';
  emptyState.style.display = 'none';

  container.innerHTML = state.filteredSkills.map(skill => createSkillCard(skill)).join('');

  // Add click listeners
  container.querySelectorAll('.skill-card').forEach((card, index) => {
    card.addEventListener('click', () => openSkillModal(state.filteredSkills[index]));
  });
}

// Create Skill Card HTML
function createSkillCard(skill) {
  const sourceBadgeClass = skill.source.toLowerCase();
  const lastModified = formatDate(skill.lastModified);

  return `
    <div class="skill-card">
      <div class="skill-card-header">
        <h3 class="skill-card-title">${escapeHtml(skill.name)}</h3>
        <span class="skill-source-badge ${sourceBadgeClass}">${skill.source}</span>
      </div>
      <p class="skill-card-description">${escapeHtml(skill.description)}</p>
      <div class="skill-card-meta">
        <div class="skill-meta-item">
          <span class="skill-meta-icon">📁</span>
          <span class="skill-meta-value">${skill.fileCount} files</span>
        </div>
        <div class="skill-meta-item">
          <span class="skill-meta-icon">📅</span>
          <span class="skill-meta-value">${lastModified}</span>
        </div>
      </div>
    </div>
  `;
}

// Open Skill Modal
async function openSkillModal(skill) {
  state.currentSkill = skill;

  // Populate modal header
  document.getElementById('modalSkillName').textContent = skill.name;

  const sourceBadge = document.getElementById('modalSourceBadge');
  sourceBadge.textContent = skill.source;
  sourceBadge.className = `source-badge skill-source-badge ${skill.source.toLowerCase()}`;

  // Populate modal footer
  document.getElementById('modalFileCount').textContent = skill.fileCount;
  document.getElementById('modalLastModified').textContent = formatDate(skill.lastModified);
  document.getElementById('modalSource').textContent = skill.source;

  // Render loading levels
  renderLoadingLevels(skill);

  // Show modal
  document.getElementById('skillModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Render Loading Levels (new system based on official docs)
function renderLoadingLevels(skill) {
  // Level 1: Metadata
  document.getElementById('metadataName').textContent = skill.name;
  document.getElementById('metadataDescription').textContent = skill.description;

  // Allowed tools in metadata
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    const toolsField = document.getElementById('metadataToolsField');
    const toolsContainer = document.getElementById('metadataTools');
    toolsField.style.display = 'flex';

    const tools = Array.isArray(skill.allowedTools) ? skill.allowedTools : skill.allowedTools.split(',').map(t => t.trim());
    toolsContainer.innerHTML = tools.map(tool =>
      `<span class="tool-chip-small">${escapeHtml(tool)}</span>`
    ).join('');
  } else {
    document.getElementById('metadataToolsField').style.display = 'none';
  }

  // Level 2: Instructions (SKILL.md)
  document.getElementById('level2FileSize').textContent = skill.mainFileSize;

  // Level 3+: Resources & Code
  const instructionsFiles = [];
  const codeFiles = [];
  const resourceFiles = [];

  // Categorize files
  const allFiles = [
    ...(skill.supportingFiles.onDemand || []),
    ...(skill.supportingFiles.progressive || [])
  ];

  allFiles.forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'md') {
      instructionsFiles.push(file);
    } else if (['py', 'js', 'ts', 'sh', 'bash'].includes(ext)) {
      codeFiles.push(file);
    } else {
      resourceFiles.push(file);
    }
  });

  // Render categories
  renderResourceCategory('instructions', instructionsFiles);
  renderResourceCategory('code', codeFiles);
  renderResourceCategory('resources', resourceFiles);

  // Show empty state if no resources
  const hasResources = instructionsFiles.length > 0 || codeFiles.length > 0 || resourceFiles.length > 0;
  document.getElementById('emptyResources').style.display = hasResources ? 'none' : 'flex';
}

// Render Resource Category
function renderResourceCategory(categoryName, files) {
  const category = document.getElementById(`${categoryName}Category`);
  const count = document.getElementById(`${categoryName}Count`);
  const filesContainer = document.getElementById(`${categoryName}Files`);

  if (files.length > 0) {
    category.style.display = 'block';
    count.textContent = files.length;

    filesContainer.innerHTML = files.map(file => {
      const icon = getFileIcon(file.type);
      return `
        <div class="resource-file">
          <span class="file-icon">${icon}</span>
          <span class="file-name">${escapeHtml(file.relativePath)}</span>
          <span class="file-size">${formatFileSize(file.size)}</span>
        </div>
      `;
    }).join('');
  } else {
    category.style.display = 'none';
  }
}

// Note: File viewing functionality removed as per requirements
// Modal now focuses on showing the 3-level loading structure

// Close Modal
function closeModal() {
  document.getElementById('skillModal').classList.remove('active');
  document.body.style.overflow = '';
  state.currentSkill = null;
}

// Set Filter
function setFilter(filter) {
  state.currentFilter = filter;

  // Update UI
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });

  document.querySelectorAll('.source-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  applyFiltersAndSearch();
  renderSkills();
  updateStats();
}

// Set Source Filter (sidebar)
function setSourceFilter(filter) {
  setFilter(filter);
}

// Handle Search
function handleSearch(e) {
  state.searchQuery = e.target.value;
  applyFiltersAndSearch();
  renderSkills();
  updateStats();
}

// Set View
function setView(view) {
  state.currentView = view;

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  const container = document.getElementById('skillsContainer');
  container.classList.toggle('list-view', view === 'list');
}

// Clear Filters
function clearFilters() {
  state.currentFilter = 'all';
  state.searchQuery = '';
  document.getElementById('skillSearch').value = '';

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === 'all');
  });

  applyFiltersAndSearch();
  renderSkills();
  updateStats();
}

// Update Stats
function updateStats() {
  const total = state.skills.length;
  const personal = state.skills.filter(s => s.source === 'Personal').length;
  const project = state.skills.filter(s => s.source === 'Project').length;
  const plugin = state.skills.filter(s => s.source === 'Plugin').length;

  // Sidebar stats
  document.getElementById('sidebarTotalSkills').textContent = total;
  document.getElementById('sidebarPersonalSkills').textContent = personal;

  // Filter counts - always show totals, not filtered counts
  document.getElementById('countAll').textContent = total;
  document.getElementById('countPersonal').textContent = personal;
  document.getElementById('countProject').textContent = project;
  document.getElementById('countPlugin').textContent = plugin;
}

// Update Empty State
function updateEmptyState() {
  const description = document.getElementById('emptyDescription');
  const clearBtn = document.getElementById('clearFiltersBtn');

  if (state.searchQuery || state.currentFilter !== 'all') {
    description.textContent = 'No skills match your current filters or search.';
    clearBtn.style.display = 'inline-block';
  } else {
    description.textContent = 'No skills installed. Add skills to ~/.claude/skills or .claude/skills';
    clearBtn.style.display = 'none';
  }
}

// Toggle Sidebar
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('collapsed');
}

// Utility Functions
function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatFileSize(bytes) {
  if (typeof bytes === 'string') return bytes;
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type) {
  const icons = {
    markdown: '📝',
    python: '🐍',
    javascript: '📜',
    typescript: '📘',
    shell: '🖥️',
    json: '📋',
    yaml: '⚙️',
    text: '📄',
    html: '🌐',
    css: '🎨',
    unknown: '📄'
  };
  return icons[type] || icons.unknown;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  console.error(message);
  // Could add a toast notification here
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initDashboard);
