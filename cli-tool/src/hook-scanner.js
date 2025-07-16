const fs = require('fs');
const path = require('path');

/**
 * Extracts and describes hooks from a settings.json file
 * @param {string} settingsPath - Path to the settings.json file
 * @returns {Array} Array of hook descriptions
 */
function getHooksFromSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) {
    return [];
  }

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const hooks = [];

    if (settings.hooks) {
      // Process PreToolUse hooks
      if (settings.hooks.PreToolUse) {
        settings.hooks.PreToolUse.forEach((hookGroup, index) => {
          hookGroup.hooks.forEach((hook, hookIndex) => {
            const hookId = `pre-${index}-${hookIndex}`;
            const description = getHookDescription(hook, hookGroup.matcher, 'PreToolUse');
            hooks.push({
              id: hookId,
              type: 'PreToolUse',
              matcher: hookGroup.matcher,
              description,
              originalHook: hook,
              originalGroup: hookGroup,
              checked: true // Default to checked
            });
          });
        });
      }

      // Process PostToolUse hooks
      if (settings.hooks.PostToolUse) {
        settings.hooks.PostToolUse.forEach((hookGroup, index) => {
          hookGroup.hooks.forEach((hook, hookIndex) => {
            const hookId = `post-${index}-${hookIndex}`;
            const description = getHookDescription(hook, hookGroup.matcher, 'PostToolUse');
            hooks.push({
              id: hookId,
              type: 'PostToolUse',
              matcher: hookGroup.matcher,
              description,
              originalHook: hook,
              originalGroup: hookGroup,
              checked: true // Default to checked
            });
          });
        });
      }

      // Process Notification hooks
      if (settings.hooks.Notification) {
        settings.hooks.Notification.forEach((hookGroup, index) => {
          hookGroup.hooks.forEach((hook, hookIndex) => {
            const hookId = `notification-${index}-${hookIndex}`;
            const description = getHookDescription(hook, hookGroup.matcher, 'Notification');
            hooks.push({
              id: hookId,
              type: 'Notification',
              matcher: hookGroup.matcher,
              description,
              originalHook: hook,
              originalGroup: hookGroup,
              checked: false // Default to unchecked for notifications
            });
          });
        });
      }

      // Process Stop hooks
      if (settings.hooks.Stop) {
        settings.hooks.Stop.forEach((hookGroup, index) => {
          hookGroup.hooks.forEach((hook, hookIndex) => {
            const hookId = `stop-${index}-${hookIndex}`;
            const description = getHookDescription(hook, hookGroup.matcher, 'Stop');
            hooks.push({
              id: hookId,
              type: 'Stop',
              matcher: hookGroup.matcher,
              description,
              originalHook: hook,
              originalGroup: hookGroup,
              checked: true // Default to checked
            });
          });
        });
      }
    }

    return hooks;
  } catch (error) {
    console.error(`Error parsing settings file ${settingsPath}:`, error.message);
    return [];
  }
}

/**
 * Generates a human-readable description for a hook
 * @param {Object} hook - The hook object
 * @param {string} matcher - The matcher pattern
 * @param {string} type - The hook type
 * @returns {string} Human-readable description
 */
function getHookDescription(hook, matcher, type) {
  const command = hook.command || '';
  
  // Extract key patterns for more specific descriptions
  if (command.includes('jq -r') && command.includes('bash-command-log')) {
    return 'Log all Bash commands for debugging';
  }
  
  if (command.includes('console\\.log')) {
    return 'Block console.log statements in JS/TS files';
  }
  
  if (command.includes('print(') && command.includes('py$')) {
    return 'Block print() statements in Python files';
  }
  
  if (command.includes('puts\\|p ') && command.includes('rb$')) {
    return 'Block puts/p statements in Ruby files';
  }
  
  if (command.includes('fmt.Print') && command.includes('go$')) {
    return 'Block fmt.Print statements in Go files';
  }
  
  if (command.includes('println!') && command.includes('rs$')) {
    return 'Block println! macros in Rust files';
  }
  
  if (command.includes('npm audit') || command.includes('pip-audit') || command.includes('bundle audit') || command.includes('cargo audit')) {
    return 'Security audit for dependencies';
  }
  
  if (command.includes('prettier --write')) {
    return 'Auto-format JS/TS files with Prettier';
  }
  
  if (command.includes('black') && command.includes('py$')) {
    return 'Auto-format Python files with Black';
  }
  
  if (command.includes('rubocop -A') && command.includes('rb$')) {
    return 'Auto-format Ruby files with RuboCop';
  }
  
  if (command.includes('rubocop') && command.includes('rb$') && !command.includes('-A')) {
    return 'Run Ruby linting with RuboCop';
  }
  
  if (command.includes('brakeman')) {
    return 'Run Ruby security scan with Brakeman';
  }
  
  if (command.includes('isort') && command.includes('py$')) {
    return 'Auto-sort Python imports with isort';
  }
  
  if (command.includes('gofmt') && command.includes('go$')) {
    return 'Auto-format Go files with gofmt';
  }
  
  if (command.includes('goimports')) {
    return 'Auto-format Go imports with goimports';
  }
  
  if (command.includes('rustfmt') && command.includes('rs$')) {
    return 'Auto-format Rust files with rustfmt';
  }
  
  if (command.includes('tsc --noEmit')) {
    return 'Run TypeScript type checking';
  }
  
  if (command.includes('flake8') && !command.includes('git diff')) {
    return 'Run Python linting with flake8';
  }
  
  if (command.includes('mypy')) {
    return 'Run Python type checking with mypy';
  }
  
  if (command.includes('go vet') && !command.includes('git diff')) {
    return 'Run Go static analysis with go vet';
  }
  
  if (command.includes('cargo check')) {
    return 'Run Rust compilation checks';
  }
  
  if (command.includes('cargo clippy') && !command.includes('git diff')) {
    return 'Run Rust linting with clippy';
  }
  
  if (command.includes('import \\* from')) {
    return 'Warn about wildcard imports';
  }
  
  if (command.includes('jest') || command.includes('vitest')) {
    return 'Auto-run tests for modified files';
  }
  
  if (command.includes('pytest')) {
    return 'Auto-run Python tests for modified files';
  }
  
  if (command.includes('rspec')) {
    return 'Auto-run Ruby tests with RSpec';
  }
  
  if (command.includes('go test')) {
    return 'Auto-run Go tests for modified files';
  }
  
  if (command.includes('cargo test')) {
    return 'Auto-run Rust tests for modified files';
  }
  
  if (command.includes('eslint') && command.includes('git diff')) {
    return 'Run ESLint on changed files';
  }
  
  if (command.includes('flake8') && command.includes('git diff')) {
    return 'Run Python linting on changed files';
  }
  
  if (command.includes('bandit')) {
    return 'Run Python security analysis';
  }
  
  if (command.includes('go vet') && command.includes('git diff')) {
    return 'Run Go analysis on changed files';
  }
  
  if (command.includes('staticcheck')) {
    return 'Run Go static analysis on changed files';
  }
  
  if (command.includes('cargo clippy') && command.includes('git diff')) {
    return 'Run Rust linting on changed files';
  }
  
  if (command.includes('bundlesize') || command.includes('webpack-bundle-analyzer')) {
    return 'Analyze bundle size impact';
  }
  
  if (command.includes('notifications.log')) {
    return 'Log Claude Code notifications';
  }

  // Generate description based on command analysis
  if (command.includes('eslint')) {
    return 'Run ESLint linting';
  } else if (command.includes('prettier')) {
    return 'Format code with Prettier';
  } else if (command.includes('tsc')) {
    return 'TypeScript type checking';
  } else if (command.includes('jest') || command.includes('vitest')) {
    return 'Run tests automatically';
  } else if (command.includes('audit')) {
    return 'Security audit for dependencies';
  } else if (command.includes('bundlesize') || command.includes('bundle')) {
    return 'Bundle size analysis';
  } else if (command.includes('console.log')) {
    return 'Detect console.log statements';
  } else if (command.includes('import')) {
    return 'Import statement validation';
  } else if (command.includes('log')) {
    return 'Logging functionality';
  } else {
    // Fallback: use type and matcher
    const matcherDesc = matcher || 'all tools';
    return `${type} hook for ${matcherDesc}`;
  }
}

/**
 * Gets hooks for a specific language
 * @param {string} language - The programming language
 * @returns {Array} Array of available hooks for the language
 */
function getHooksForLanguage(language) {
  const templateDir = path.join(__dirname, '../templates', language);
  const settingsPath = path.join(templateDir, '.claude', 'settings.json');
  
  return getHooksFromSettings(settingsPath);
}

/**
 * Filters hooks based on user selection
 * @param {Object} originalSettings - Original settings object
 * @param {Array} selectedHookIds - Array of selected hook IDs
 * @param {Array} availableHooks - Array of available hooks
 * @returns {Object} Filtered settings object
 */
function filterHooksBySelection(originalSettings, selectedHookIds, availableHooks) {
  if (!originalSettings.hooks) {
    return originalSettings;
  }

  const filteredSettings = JSON.parse(JSON.stringify(originalSettings));
  filteredSettings.hooks = {};

  // Create a map of selected hooks for quick lookup
  const selectedHooks = new Map();
  availableHooks.forEach(hook => {
    if (selectedHookIds.includes(hook.id)) {
      selectedHooks.set(hook.id, hook);
    }
  });

  // Group selected hooks by type
  const hooksByType = {
    PreToolUse: [],
    PostToolUse: [],
    Notification: [],
    Stop: []
  };

  selectedHooks.forEach(hook => {
    if (hooksByType[hook.type]) {
      hooksByType[hook.type].push(hook);
    }
  });

  // Rebuild hook structure
  Object.keys(hooksByType).forEach(type => {
    if (hooksByType[type].length > 0) {
      filteredSettings.hooks[type] = [];
      
      // Group hooks by matcher and originalGroup
      const groupMap = new Map();
      
      hooksByType[type].forEach(hook => {
        const groupKey = `${hook.matcher}-${JSON.stringify(hook.originalGroup.matcher)}`;
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            matcher: hook.originalGroup.matcher,
            hooks: []
          });
        }
        groupMap.get(groupKey).hooks.push(hook.originalHook);
      });
      
      filteredSettings.hooks[type] = Array.from(groupMap.values());
    }
  });

  return filteredSettings;
}

/**
 * Extracts and describes MCPs from a .mcp.json file
 * @param {string} mcpPath - Path to the .mcp.json file
 * @returns {Array} Array of MCP descriptions
 */
function getMCPsFromFile(mcpPath) {
  if (!fs.existsSync(mcpPath)) {
    return [];
  }

  try {
    const mcpData = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    const mcps = [];

    if (mcpData.mcpServers) {
      Object.keys(mcpData.mcpServers).forEach((serverId) => {
        const server = mcpData.mcpServers[serverId];
        mcps.push({
          id: serverId,
          name: server.name || serverId,
          description: server.description || 'No description available',
          command: server.command,
          args: server.args || [],
          env: server.env || {},
          originalServer: server,
          checked: getDefaultMCPSelection(serverId) // Default selection logic
        });
      });
    }

    return mcps;
  } catch (error) {
    console.error(`Error parsing MCP file ${mcpPath}:`, error.message);
    return [];
  }
}

/**
 * Determines default selection for MCP servers
 * @param {string} serverId - The MCP server ID
 * @returns {boolean} Whether the MCP should be selected by default
 */
function getDefaultMCPSelection(serverId) {
  // Default to checked for commonly useful MCPs
  const defaultSelected = [
    'filesystem',
    'memory-bank',
    'sequential-thinking',
    'typescript-sdk',
    'python-sdk',
    'rust-sdk',
    'go-sdk'
  ];
  
  return defaultSelected.includes(serverId);
}

/**
 * Gets MCPs for a specific language
 * @param {string} language - The programming language
 * @returns {Array} Array of available MCPs for the language
 */
function getMCPsForLanguage(language) {
  const templateDir = path.join(__dirname, '../templates', language);
  const mcpPath = path.join(templateDir, '.mcp.json');
  
  return getMCPsFromFile(mcpPath);
}

/**
 * Filters MCPs based on user selection
 * @param {Object} originalMCPData - Original MCP data object
 * @param {Array} selectedMCPIds - Array of selected MCP IDs
 * @param {Array} availableMCPs - Array of available MCPs
 * @returns {Object} Filtered MCP data object
 */
function filterMCPsBySelection(originalMCPData, selectedMCPIds, availableMCPs) {
  if (!originalMCPData.mcpServers) {
    return originalMCPData;
  }

  const filteredMCPData = {
    mcpServers: {}
  };

  // Create a map of selected MCPs for quick lookup
  const selectedMCPs = new Map();
  availableMCPs.forEach(mcp => {
    if (selectedMCPIds.includes(mcp.id)) {
      selectedMCPs.set(mcp.id, mcp);
    }
  });

  // Add selected MCPs to filtered data
  selectedMCPs.forEach((mcp, mcpId) => {
    filteredMCPData.mcpServers[mcpId] = mcp.originalServer;
  });

  return filteredMCPData;
}

module.exports = {
  getHooksFromSettings,
  getHooksForLanguage,
  filterHooksBySelection,
  getHookDescription,
  getMCPsFromFile,
  getMCPsForLanguage,
  filterMCPsBySelection
};