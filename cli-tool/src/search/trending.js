const { loadComponentData } = require('./data-loader');
const { trackingService } = require('../tracking-service');

/**
 * Get trending components based on recent download growth
 * @param {Object} options - Trending options
 * @param {string} options.category - Filter by category (agents, commands, mcps, skills)
 * @param {number} options.limit - Maximum results
 * @param {number} options.days - Days to analyze (default: 7)
 * @returns {Promise<Array>} Trending components
 */
async function getTrendingComponents(options = {}) {
  const {
    category = null,
    limit = 10,
    days = 7
  } = options;

  const data = await loadComponentData();

  // Collect all components
  let allComponents = [];

  if (category) {
    const categoryMap = {
      'agent': 'agents',
      'agents': 'agents',
      'command': 'commands',
      'commands': 'commands',
      'mcp': 'mcps',
      'mcps': 'mcps',
      'skill': 'skills',
      'skills': 'skills'
    };
    const key = categoryMap[category.toLowerCase()];
    if (key && data[key]) {
      allComponents = data[key].map(c => ({ ...c, componentType: key }));
    }
  } else {
    allComponents = [
      ...data.agents.map(c => ({ ...c, componentType: 'agents' })),
      ...data.commands.map(c => ({ ...c, componentType: 'commands' })),
      ...data.mcps.map(c => ({ ...c, componentType: 'mcps' })),
      ...data.skills.map(c => ({ ...c, componentType: 'skills' }))
    ];
  }

  // TODO: Integrate with actual analytics data from trackingService
  // For now, use mock trending data based on popularity field
  const trending = allComponents
    .filter(c => c.trending && c.trending > 0)
    .sort((a, b) => (b.trending || 0) - (a.trending || 0))
    .slice(0, limit);

  // If no trending data, return most popular
  if (trending.length === 0) {
    return allComponents
      .filter(c => c.downloads && c.downloads > 0)
      .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
      .slice(0, limit);
  }

  return trending;
}

/**
 * Get most popular components by total downloads
 * @param {Object} options - Popular options
 * @param {string} options.category - Filter by category
 * @param {number} options.limit - Maximum results
 * @returns {Promise<Array>} Popular components
 */
async function getPopularComponents(options = {}) {
  const {
    category = null,
    limit = 10
  } = options;

  const data = await loadComponentData();

  // Collect all components
  let allComponents = [];

  if (category) {
    const categoryMap = {
      'agent': 'agents',
      'agents': 'agents',
      'command': 'commands',
      'commands': 'commands',
      'mcp': 'mcps',
      'mcps': 'mcps',
      'skill': 'skills',
      'skills': 'skills'
    };
    const key = categoryMap[category.toLowerCase()];
    if (key && data[key]) {
      allComponents = data[key].map(c => ({ ...c, componentType: key }));
    }
  } else {
    allComponents = [
      ...data.agents.map(c => ({ ...c, componentType: 'agents' })),
      ...data.commands.map(c => ({ ...c, componentType: 'commands' })),
      ...data.mcps.map(c => ({ ...c, componentType: 'mcps' })),
      ...data.skills.map(c => ({ ...c, componentType: 'skills' }))
    ];
  }

  // Sort by downloads
  const popular = allComponents
    .filter(c => c.downloads && c.downloads > 0)
    .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
    .slice(0, limit);

  return popular;
}

/**
 * Get recently added components
 * @param {Object} options - Recent options
 * @param {number} options.limit - Maximum results
 * @param {number} options.days - Days to look back
 * @returns {Promise<Array>} Recent components
 */
async function getRecentComponents(options = {}) {
  const {
    limit = 10,
    days = 30
  } = options;

  const data = await loadComponentData();

  // Collect all components
  const allComponents = [
    ...data.agents.map(c => ({ ...c, componentType: 'agents' })),
    ...data.commands.map(c => ({ ...c, componentType: 'commands' })),
    ...data.mcps.map(c => ({ ...c, componentType: 'mcps' })),
    ...data.skills.map(c => ({ ...c, componentType: 'skills' }))
  ];

  // TODO: Add createdAt timestamp to components
  // For now, return random selection as "recent"
  const shuffled = allComponents.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, limit);
}

/**
 * Get component statistics
 * @returns {Promise<Object>} Statistics object
 */
async function getComponentStats() {
  const data = await loadComponentData();

  const stats = {
    total: 0,
    byType: {
      agents: data.agents.length,
      commands: data.commands.length,
      mcps: data.mcps.length,
      skills: data.skills.length
    },
    totalDownloads: 0,
    averageDownloads: 0,
    mostPopular: null,
    mostTrending: null
  };

  // Calculate totals
  stats.total = stats.byType.agents + stats.byType.commands + 
                stats.byType.mcps + stats.byType.skills;

  // Collect all components for download stats
  const allComponents = [
    ...data.agents,
    ...data.commands,
    ...data.mcps,
    ...data.skills
  ];

  // Calculate download stats
  stats.totalDownloads = allComponents.reduce((sum, c) => sum + (c.downloads || 0), 0);
  stats.averageDownloads = stats.total > 0 ? Math.round(stats.totalDownloads / stats.total) : 0;

  // Find most popular
  const withDownloads = allComponents.filter(c => c.downloads && c.downloads > 0);
  if (withDownloads.length > 0) {
    stats.mostPopular = withDownloads.reduce((max, c) => 
      (c.downloads || 0) > (max.downloads || 0) ? c : max
    );
  }

  // Find most trending
  const withTrending = allComponents.filter(c => c.trending && c.trending > 0);
  if (withTrending.length > 0) {
    stats.mostTrending = withTrending.reduce((max, c) => 
      (c.trending || 0) > (max.trending || 0) ? c : max
    );
  }

  return stats;
}

/**
 * Calculate trending score for a component
 * @param {Object} component - Component data
 * @param {Object} analytics - Analytics data
 * @returns {number} Trending score
 */
function calculateTrendingScore(component, analytics) {
  // TODO: Implement actual trending calculation based on:
  // - Recent downloads (last 7 days)
  // - Growth rate compared to previous period
  // - Velocity of growth
  // - Recency of downloads
  
  // For now, return mock score
  return component.trending || 0;
}

/**
 * Get component growth data
 * @param {string} componentId - Component ID
 * @param {number} days - Days to analyze
 * @returns {Promise<Object>} Growth data
 */
async function getComponentGrowth(componentId, days = 30) {
  // TODO: Integrate with actual analytics data
  // This would query download history and calculate growth metrics
  
  return {
    componentId,
    days,
    totalDownloads: 0,
    dailyAverage: 0,
    growthRate: 0,
    trend: 'stable', // 'growing', 'stable', 'declining'
    history: [] // Array of { date, downloads }
  };
}

module.exports = {
  getTrendingComponents,
  getPopularComponents,
  getRecentComponents,
  getComponentStats,
  calculateTrendingScore,
  getComponentGrowth
};
