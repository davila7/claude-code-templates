const fs = require('fs-extra');
const path = require('path');
const { loadComponentData } = require('./data-loader');
const { detectProject } = require('../utils');

/**
 * Detect project type from directory
 * @param {string} targetDir - Target directory to analyze
 * @returns {Promise<Object>} Project information
 */
async function detectProjectType(targetDir) {
  try {
    // Use existing detectProject utility
    const projectInfo = await detectProject(targetDir);
    
    return {
      type: projectInfo.detectedFramework || projectInfo.detectedLanguage || 'unknown',
      language: projectInfo.detectedLanguage,
      framework: projectInfo.detectedFramework,
      features: projectInfo.features || []
    };
  } catch (error) {
    return {
      type: 'unknown',
      language: null,
      framework: null,
      features: []
    };
  }
}

/**
 * Get recommended components for a project type
 * @param {string} projectType - Project type (nextjs, react, python, etc.)
 * @param {Object} options - Discovery options
 * @returns {Promise<Object>} Recommendations object
 */
async function getRecommendations(projectType, options = {}) {
  const { limit = 10 } = options;
  
  const data = await loadComponentData();
  
  // Collect all components
  const allComponents = [
    ...data.agents.map(c => ({ ...c, componentType: 'agents' })),
    ...data.commands.map(c => ({ ...c, componentType: 'commands' })),
    ...data.mcps.map(c => ({ ...c, componentType: 'mcps' })),
    ...data.skills.map(c => ({ ...c, componentType: 'skills' }))
  ];

  // Filter components relevant to project type
  const relevantComponents = allComponents.filter(component => {
    // Check if component supports this project type
    if (component.projectTypes) {
      return component.projectTypes.includes('all') || 
             component.projectTypes.includes(projectType);
    }
    return true;
  });

  // Categorize recommendations
  const recommendations = {
    projectType: projectType,
    essential: [],
    popular: [],
    trending: []
  };

  // Essential components (marked as essential for this project type)
  recommendations.essential = relevantComponents
    .filter(c => c.essential === true)
    .slice(0, 5);

  // If no essential components, pick top relevant ones
  if (recommendations.essential.length === 0) {
    recommendations.essential = relevantComponents
      .filter(c => {
        // Prioritize components with matching keywords
        if (c.keywords && c.keywords.length > 0) {
          return c.keywords.some(k => 
            k.toLowerCase().includes(projectType.toLowerCase())
          );
        }
        return false;
      })
      .slice(0, 5);
  }

  // Popular components (by download count)
  recommendations.popular = relevantComponents
    .filter(c => c.downloads && c.downloads > 0)
    .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
    .slice(0, 5);

  // Trending components (by growth percentage)
  recommendations.trending = relevantComponents
    .filter(c => c.trending && c.trending > 0)
    .sort((a, b) => (b.trending || 0) - (a.trending || 0))
    .slice(0, 5);

  return recommendations;
}

/**
 * Discover components for current directory
 * @param {string} targetDir - Target directory
 * @param {Object} options - Discovery options
 * @returns {Promise<Object>} Discovery results
 */
async function discoverComponents(targetDir, options = {}) {
  // Detect project type
  const projectInfo = await detectProjectType(targetDir);
  
  // Get recommendations based on project type
  const recommendations = await getRecommendations(
    projectInfo.type,
    options
  );

  return {
    projectInfo,
    recommendations
  };
}

/**
 * Get project-specific component suggestions
 * @param {string} targetDir - Target directory
 * @returns {Promise<Array>} Suggested components
 */
async function getProjectSuggestions(targetDir) {
  const projectInfo = await detectProjectType(targetDir);
  const data = await loadComponentData();

  const suggestions = [];

  // Suggest based on detected features
  if (projectInfo.features && projectInfo.features.length > 0) {
    for (const feature of projectInfo.features) {
      // Find components that match this feature
      const matching = [
        ...data.agents,
        ...data.commands,
        ...data.mcps,
        ...data.skills
      ].filter(c => {
        if (c.keywords) {
          return c.keywords.some(k => 
            k.toLowerCase().includes(feature.toLowerCase())
          );
        }
        return false;
      });

      suggestions.push(...matching);
    }
  }

  // Remove duplicates
  const unique = suggestions.filter((component, index, self) =>
    index === self.findIndex(c => c.id === component.id)
  );

  return unique.slice(0, 10);
}

/**
 * Get components by category
 * @param {string} category - Category name
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Components in category
 */
async function getComponentsByCategory(category, options = {}) {
  const { limit = 20, sortBy = 'downloads' } = options;
  
  const data = await loadComponentData();

  // Collect all components
  const allComponents = [
    ...data.agents.map(c => ({ ...c, componentType: 'agents' })),
    ...data.commands.map(c => ({ ...c, componentType: 'commands' })),
    ...data.mcps.map(c => ({ ...c, componentType: 'mcps' })),
    ...data.skills.map(c => ({ ...c, componentType: 'skills' }))
  ];

  // Filter by category
  const filtered = allComponents.filter(c => 
    c.category && c.category.toLowerCase() === category.toLowerCase()
  );

  // Sort
  let sorted = filtered;
  if (sortBy === 'downloads') {
    sorted = filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  } else if (sortBy === 'trending') {
    sorted = filtered.sort((a, b) => (b.trending || 0) - (a.trending || 0));
  } else if (sortBy === 'name') {
    sorted = filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  return sorted.slice(0, limit);
}

/**
 * Get all available categories
 * @returns {Promise<Array>} List of categories with counts
 */
async function getCategories() {
  const data = await loadComponentData();

  const categoryMap = new Map();

  // Collect all components
  const allComponents = [
    ...data.agents,
    ...data.commands,
    ...data.mcps,
    ...data.skills
  ];

  // Count components per category
  for (const component of allComponents) {
    if (component.category) {
      const count = categoryMap.get(component.category) || 0;
      categoryMap.set(component.category, count + 1);
    }
  }

  // Convert to array and sort by count
  const categories = Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return categories;
}

module.exports = {
  detectProjectType,
  getRecommendations,
  discoverComponents,
  getProjectSuggestions,
  getComponentsByCategory,
  getCategories
};
