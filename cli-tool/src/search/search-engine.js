const { loadComponentData } = require('./data-loader');

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between query and text
 * @param {string} query - Search query
 * @param {string} text - Text to match against
 * @param {number} weight - Score weight multiplier
 * @returns {number} Similarity score
 */
function calculateSimilarity(query, text, weight = 1) {
  if (!text) return 0;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match gets highest score
  if (textLower === queryLower) {
    return 100 * weight;
  }

  // Contains query gets high score
  if (textLower.includes(queryLower)) {
    return 80 * weight;
  }

  // Word boundary match
  const words = textLower.split(/[\s-_]/);
  for (const word of words) {
    if (word === queryLower) {
      return 70 * weight;
    }
    if (word.startsWith(queryLower)) {
      return 60 * weight;
    }
  }

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(queryLower, textLower);
  const maxLength = Math.max(queryLower.length, textLower.length);
  const similarity = 1 - (distance / maxLength);

  if (similarity > 0.7) {
    return similarity * 50 * weight;
  }

  return 0;
}

/**
 * Calculate component relevance score
 * @param {Object} component - Component to score
 * @param {string} query - Search query
 * @returns {number} Relevance score
 */
function scoreComponent(component, query) {
  let score = 0;

  // Name match (highest weight)
  score += calculateSimilarity(query, component.name, 3);
  score += calculateSimilarity(query, component.displayName, 3);

  // Description match
  score += calculateSimilarity(query, component.description, 2);

  // Keywords match
  if (component.keywords && component.keywords.length > 0) {
    for (const keyword of component.keywords) {
      score += calculateSimilarity(query, keyword, 2);
    }
  }

  // Category match
  score += calculateSimilarity(query, component.category, 1.5);

  // Boost popular components slightly
  if (component.popularity === 'high') {
    score *= 1.1;
  }

  return score;
}

/**
 * Search components across all types
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {string} options.category - Filter by category (agents, commands, mcps, skills)
 * @param {string} options.projectType - Filter by project type
 * @param {number} options.limit - Maximum results to return
 * @param {number} options.minScore - Minimum relevance score threshold
 * @returns {Promise<Object>} Search results grouped by type
 */
async function searchComponents(query, options = {}) {
  const {
    category = null,
    projectType = null,
    limit = 20,
    minScore = 10
  } = options;

  // Load all component data
  const data = await loadComponentData();

  // Collect all components
  let allComponents = [];

  // Filter by category if specified
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
    // Include all types
    allComponents = [
      ...data.agents.map(c => ({ ...c, componentType: 'agents' })),
      ...data.commands.map(c => ({ ...c, componentType: 'commands' })),
      ...data.mcps.map(c => ({ ...c, componentType: 'mcps' })),
      ...data.skills.map(c => ({ ...c, componentType: 'skills' }))
    ];
  }

  // Filter by project type if specified
  if (projectType) {
    allComponents = allComponents.filter(c => 
      c.projectTypes.includes('all') || c.projectTypes.includes(projectType)
    );
  }

  // Score and filter components
  const scoredComponents = allComponents
    .map(component => ({
      ...component,
      score: scoreComponent(component, query)
    }))
    .filter(c => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Group results by type
  const results = {
    agents: scoredComponents.filter(c => c.componentType === 'agents'),
    commands: scoredComponents.filter(c => c.componentType === 'commands'),
    mcps: scoredComponents.filter(c => c.componentType === 'mcps'),
    skills: scoredComponents.filter(c => c.componentType === 'skills'),
    total: scoredComponents.length,
    query: query
  };

  return results;
}

/**
 * Get search suggestions based on partial query
 * @param {string} partialQuery - Partial search query
 * @param {number} limit - Maximum suggestions
 * @returns {Promise<string[]>} Suggested search terms
 */
async function getSearchSuggestions(partialQuery, limit = 5) {
  const data = await loadComponentData();
  const suggestions = new Set();

  const queryLower = partialQuery.toLowerCase();

  // Collect suggestions from component names and keywords
  const allComponents = [
    ...data.agents,
    ...data.commands,
    ...data.mcps,
    ...data.skills
  ];

  for (const component of allComponents) {
    // Check name
    if (component.name.toLowerCase().includes(queryLower)) {
      suggestions.add(component.name);
    }

    // Check keywords
    if (component.keywords) {
      for (const keyword of component.keywords) {
        if (keyword.toLowerCase().includes(queryLower)) {
          suggestions.add(keyword);
        }
      }
    }

    if (suggestions.size >= limit) break;
  }

  return Array.from(suggestions).slice(0, limit);
}

/**
 * Get related components based on a component
 * @param {string} componentId - Component ID
 * @param {number} limit - Maximum related components
 * @returns {Promise<Array>} Related components
 */
async function getRelatedComponents(componentId, limit = 5) {
  const data = await loadComponentData();

  // Find the source component
  let sourceComponent = null;
  for (const type of ['agents', 'commands', 'mcps', 'skills']) {
    sourceComponent = data[type].find(c => c.id === componentId);
    if (sourceComponent) break;
  }

  if (!sourceComponent) {
    return [];
  }

  // Find components with similar keywords or category
  const allComponents = [
    ...data.agents,
    ...data.commands,
    ...data.mcps,
    ...data.skills
  ].filter(c => c.id !== componentId);

  const scored = allComponents.map(component => {
    let score = 0;

    // Same category
    if (component.category === sourceComponent.category) {
      score += 10;
    }

    // Shared keywords
    if (sourceComponent.keywords && component.keywords) {
      const sharedKeywords = sourceComponent.keywords.filter(k => 
        component.keywords.includes(k)
      );
      score += sharedKeywords.length * 5;
    }

    // Same project types
    if (sourceComponent.projectTypes && component.projectTypes) {
      const sharedTypes = sourceComponent.projectTypes.filter(t => 
        component.projectTypes.includes(t) && t !== 'all'
      );
      score += sharedTypes.length * 3;
    }

    return { ...component, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = {
  searchComponents,
  getSearchSuggestions,
  getRelatedComponents,
  scoreComponent
};
