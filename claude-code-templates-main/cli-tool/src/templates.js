const path = require('path');
const { getCommandsForLanguageAndFramework } = require('./command-scanner');

const TEMPLATES_CONFIG = {
  'common': {
    name: 'Common (Language-agnostic)',
    description: 'Universal configuration for any project',
    files: [
      { source: 'common/CLAUDE.md', destination: 'CLAUDE.md' }
    ]
  },
  'javascript-typescript': {
    name: 'JavaScript/TypeScript',
    description: 'Optimized for modern JS/TS development',
    files: [
      { source: 'javascript-typescript/CLAUDE.md', destination: 'CLAUDE.md' },
      { source: 'javascript-typescript/.claude', destination: '.claude' },
      { source: 'javascript-typescript/.claude/settings.json', destination: '.claude/settings.json' },
      { source: 'javascript-typescript/.mcp.json', destination: '.mcp.json' }
    ],
    frameworks: {
      'react': {
        name: 'React',
        additionalFiles: [
          { source: 'javascript-typescript/examples/react-app/.claude/commands', destination: '.claude/commands' }
        ]
      },
      'vue': {
        name: 'Vue.js',
        additionalFiles: [
          { source: 'javascript-typescript/examples/vue-app/.claude/commands', destination: '.claude/commands' }
        ]
      },
      'angular': {
        name: 'Angular',
        additionalFiles: [
          { source: 'javascript-typescript/examples/angular-app/.claude/commands', destination: '.claude/commands' }
        ]
      },
      'node': {
        name: 'Node.js',
        additionalFiles: [
          { source: 'javascript-typescript/examples/node-api/.claude/commands', destination: '.claude/commands' }
        ]
      }
    }
  },
  'python': {
    name: 'Python',
    description: 'Optimized for Python development',
    files: [
      { source: 'python/CLAUDE.md', destination: 'CLAUDE.md' },
      { source: 'python/.claude', destination: '.claude' },
      { source: 'python/.claude/settings.json', destination: '.claude/settings.json' },
      { source: 'python/.mcp.json', destination: '.mcp.json' }
    ],
    frameworks: {
      'django': {
        name: 'Django',
        additionalFiles: [
          { source: 'python/examples/django-app/.claude/commands', destination: '.claude/commands' },
          { source: 'python/examples/django-app/CLAUDE.md', destination: 'CLAUDE.md' }
        ]
      },
      'flask': {
        name: 'Flask',
        additionalFiles: [
          { source: 'python/examples/flask-app/.claude/commands', destination: '.claude/commands' }
        ]
      },
      'fastapi': {
        name: 'FastAPI',
        additionalFiles: [
          { source: 'python/examples/fastapi-app/.claude/commands', destination: '.claude/commands' }
        ]
      }
    }
  },
  'ruby': {
    name: 'Ruby',
    description: 'Optimized for Ruby development with modern tools',
    files: [
      { source: 'ruby/CLAUDE.md', destination: 'CLAUDE.md' },
      { source: 'ruby/.claude', destination: '.claude' },
      { source: 'ruby/.claude/settings.json', destination: '.claude/settings.json' },
      { source: 'ruby/.mcp.json', destination: '.mcp.json' }
    ],
    frameworks: {
      'rails': {
        name: 'Ruby on Rails 8',
        additionalFiles: [
          { source: 'ruby/examples/rails-app/.claude/commands', destination: '.claude/commands' },
          { source: 'ruby/examples/rails-app/CLAUDE.md', destination: 'CLAUDE.md' }
        ]
      },
      'sinatra': {
        name: 'Sinatra',
        additionalFiles: [
          { source: 'ruby/examples/sinatra-app/.claude/commands', destination: '.claude/commands' }
        ]
      }
    }
  },
  'rust': {
    name: 'Rust',
    description: 'Optimized for Rust development',
    comingSoon: true,
    files: [
      { source: 'rust/.mcp.json', destination: '.mcp.json' }
    ]
  },
  'go': {
    name: 'Go',
    description: 'Optimized for Go development', 
    comingSoon: true,
    files: [
      { source: 'go/.mcp.json', destination: '.mcp.json' }
    ]
  }
};

function getAvailableLanguages() {
  return Object.keys(TEMPLATES_CONFIG).map(key => ({
    value: key,
    name: TEMPLATES_CONFIG[key].name,
    description: TEMPLATES_CONFIG[key].description,
    disabled: TEMPLATES_CONFIG[key].comingSoon ? 'Coming Soon' : false
  }));
}

function getFrameworksForLanguage(language) {
  const config = TEMPLATES_CONFIG[language];
  if (!config || !config.frameworks) return [];
  
  return Object.keys(config.frameworks).map(key => ({
    value: key,
    name: config.frameworks[key].name
  }));
}

function getTemplateConfig(selections) {
  const { language, framework, commands = [] } = selections;
  const baseConfig = TEMPLATES_CONFIG[language];
  
  if (!baseConfig) {
    throw new Error(`Unknown language template: ${language}`);
  }
  
  let files = [...baseConfig.files];
  
  // Add framework-specific files
  if (framework && framework !== 'none' && baseConfig.frameworks && baseConfig.frameworks[framework]) {
    const frameworkConfig = baseConfig.frameworks[framework];
    if (frameworkConfig.additionalFiles) {
      files = files.concat(frameworkConfig.additionalFiles);
    }
  }
  
  // Handle command selection
  let selectedCommands = [];
  if (commands && commands.length > 0) {
    const availableCommands = getCommandsForLanguageAndFramework(language, framework);
    selectedCommands = availableCommands.filter(cmd => commands.includes(cmd.name));
  }
  
  return {
    language,
    framework,
    files,
    selectedCommands,
    config: baseConfig
  };
}

module.exports = {
  TEMPLATES_CONFIG,
  getAvailableLanguages,
  getFrameworksForLanguage,
  getTemplateConfig
};