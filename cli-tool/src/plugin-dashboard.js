const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const open = require('open');
const os = require('os');

class PluginDashboard {
  constructor(options = {}) {
    this.options = options;
    this.app = express();
    this.port = 3336;
    this.httpServer = null;
    this.homeDir = os.homedir();
    this.claudeDir = path.join(this.homeDir, '.claude');
    this.settingsFile = path.join(this.claudeDir, 'settings.json');
  }

  async initialize() {
    // Check if Claude directory exists
    if (!(await fs.pathExists(this.claudeDir))) {
      throw new Error(`Claude Code directory not found at ${this.claudeDir}`);
    }

    // Load plugin data
    await this.loadPluginData();
    this.setupWebServer();
  }

  async loadPluginData() {
    try {
      // Read Claude settings to get marketplace and plugin info
      const settings = await this.readSettings();

      // Load marketplaces
      this.marketplaces = await this.loadMarketplaces(settings);

      // Load installed plugins
      this.plugins = await this.loadInstalledPlugins();

      // Load permissions (agents, commands, hooks, MCPs)
      this.permissions = await this.loadPermissions();

    } catch (error) {
      console.error(chalk.red('Error loading plugin data:'), error.message);
      throw error;
    }
  }

  async readSettings() {
    try {
      if (await fs.pathExists(this.settingsFile)) {
        const content = await fs.readFile(this.settingsFile, 'utf8');
        const settings = JSON.parse(content);

        // Extract enabled plugins from settings
        // Plugins are stored in settings.enabledPlugins as "plugin-name@marketplace-name": true
        this.enabledPlugins = new Set();
        if (settings.enabledPlugins && typeof settings.enabledPlugins === 'object') {
          for (const [key, value] of Object.entries(settings.enabledPlugins)) {
            if (value === true) {
              this.enabledPlugins.add(key);
            }
          }
        }

        return settings;
      }
      this.enabledPlugins = new Set();
      return {};
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not read settings file'), error.message);
      this.enabledPlugins = new Set();
      return {};
    }
  }

  async loadMarketplaces(settings) {
    const marketplaces = [];

    try {
      // Read known_marketplaces.json from plugins directory
      const knownMarketplacesFile = path.join(this.claudeDir, 'plugins', 'known_marketplaces.json');

      if (!(await fs.pathExists(knownMarketplacesFile))) {
        console.warn(chalk.yellow('Warning: known_marketplaces.json not found'));
        return [];
      }

      const content = await fs.readFile(knownMarketplacesFile, 'utf8');
      const knownMarketplacesData = JSON.parse(content);

      // Parse the marketplace configuration
      for (const [name, config] of Object.entries(knownMarketplacesData)) {
        // Load marketplace details including plugin count
        const marketplaceInfo = await this.loadMarketplaceDetails(name, config);

        // Check if marketplace is enabled (exists in the filesystem)
        const marketplacePath = path.join(this.claudeDir, 'plugins', 'marketplaces', name);
        const enabled = await fs.pathExists(marketplacePath);

        marketplaces.push({
          name,
          source: config,
          type: this.getMarketplaceType(config),
          enabled,
          pluginCount: marketplaceInfo.pluginCount || 0,
          lastUpdated: config.lastUpdated || null,
          url: this.getMarketplaceUrl(config)
        });
      }

      return marketplaces;
    } catch (error) {
      console.warn(chalk.yellow('Warning: Error loading marketplaces'), error.message);
      return [];
    }
  }

  getMarketplaceUrl(config) {
    const source = config.source || config;
    if (source.url) return source.url;
    if (source.repo) return `https://github.com/${source.repo}`;
    return null;
  }

  async loadMarketplaceDetails(name, config) {
    try {
      // Try to read marketplace.json from the marketplace source
      const marketplacePath = path.join(this.claudeDir, 'plugins', 'marketplaces', name);
      const marketplaceJsonPath = path.join(marketplacePath, '.claude-plugin', 'marketplace.json');

      if (await fs.pathExists(marketplaceJsonPath)) {
        const content = await fs.readFile(marketplaceJsonPath, 'utf8');
        const marketplaceData = JSON.parse(content);
        return {
          pluginCount: marketplaceData.plugins ? marketplaceData.plugins.length : 0,
          marketplaceData
        };
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not load marketplace details for ${name}`));
    }

    return { pluginCount: 0 };
  }

  getMarketplaceType(config) {
    // Handle nested source structure
    const source = config.source || config;

    if (source.source === 'github') return 'GitHub';
    if (source.source === 'git') return 'Git';
    // Support both 'local' and 'directory' for filesystem-based marketplaces
    // 'directory' is used by Claude Code, 'local' for legacy compatibility
    if (source.source === 'local' || source.source === 'directory') return 'Local';
    if (source.source === 'url') return 'URL';
    return 'Unknown';
  }

  async loadInstalledPlugins() {
    const plugins = [];
    const pluginsMarketplacesDir = path.join(this.claudeDir, 'plugins', 'marketplaces');

    try {
      if (!(await fs.pathExists(pluginsMarketplacesDir))) {
        console.warn(chalk.yellow('Warning: plugins/marketplaces directory not found'));
        return [];
      }

      const marketplaceDirs = await fs.readdir(pluginsMarketplacesDir);

      for (const marketplaceDir of marketplaceDirs) {
        const marketplacePath = path.join(pluginsMarketplacesDir, marketplaceDir);
        const stat = await fs.stat(marketplacePath);

        if (!stat.isDirectory()) continue;

        // Check if this is a marketplace directory (contains .claude-plugin/marketplace.json)
        const marketplaceJsonPath = path.join(marketplacePath, '.claude-plugin', 'marketplace.json');

        if (await fs.pathExists(marketplaceJsonPath)) {
          // Load plugins from marketplace.json
          const marketplacePlugins = await this.loadPluginsFromMarketplace(marketplacePath, marketplaceDir);
          plugins.push(...marketplacePlugins);
          continue;
        }

        // Scan for plugin directories (legacy support)
        const pluginDirs = await fs.readdir(marketplacePath);

        for (const pluginDir of pluginDirs) {
          const pluginPath = path.join(marketplacePath, pluginDir);

          try {
            const pluginStat = await fs.stat(pluginPath);
            if (!pluginStat.isDirectory()) continue;

            // Read plugin.json
            const pluginJsonPath = path.join(pluginPath, '.claude-plugin', 'plugin.json');

            if (await fs.pathExists(pluginJsonPath)) {
              const pluginJson = JSON.parse(await fs.readFile(pluginJsonPath, 'utf8'));

              // Count components
              const components = await this.countPluginComponents(pluginPath);

              plugins.push({
                name: pluginJson.name,
                version: pluginJson.version || '1.0.0',
                description: pluginJson.description || 'No description',
                marketplace: marketplaceDir,
                path: pluginPath,
                components,
                author: pluginJson.author,
                homepage: pluginJson.homepage,
                license: pluginJson.license
              });
            }
          } catch (error) {
            console.warn(chalk.yellow(`Warning: Error loading plugin ${pluginDir}`), error.message);
          }
        }
      }

      return plugins;
    } catch (error) {
      console.warn(chalk.yellow('Warning: Error loading plugins'), error.message);
      return [];
    }
  }

  async loadPluginsFromMarketplace(marketplacePath, marketplaceName) {
    const plugins = [];

    try {
      const marketplaceJsonPath = path.join(marketplacePath, '.claude-plugin', 'marketplace.json');
      const content = await fs.readFile(marketplaceJsonPath, 'utf8');
      const marketplaceData = JSON.parse(content);

      if (!marketplaceData.plugins || !Array.isArray(marketplaceData.plugins)) {
        return [];
      }

      // Process each plugin definition
      for (const pluginDef of marketplaceData.plugins) {
        try {
          let components = {
            agents: 0,
            commands: 0,
            hooks: 0,
            mcps: 0
          };

          // Handle both string paths and object-based sources
          // Marketplace aggregators use object format {source: "url", url: "..."} to reference external repos
          // Individual plugins use string paths like "./" or "./plugins/name"
          const pluginSourcePath = typeof pluginDef.source === 'string'
            ? path.join(marketplacePath, pluginDef.source)
            : marketplacePath;

          // Check if plugin has inline component definitions (claude-code-templates style)
          if (pluginDef.agents || pluginDef.commands || pluginDef.mcpServers) {
            components = {
              agents: pluginDef.agents ? pluginDef.agents.length : 0,
              commands: pluginDef.commands ? pluginDef.commands.length : 0,
              hooks: pluginDef.hooks ? (Array.isArray(pluginDef.hooks) ? pluginDef.hooks.length : Object.keys(pluginDef.hooks).length) : 0,
              mcps: pluginDef.mcpServers ? pluginDef.mcpServers.length : 0
            };
          }
          // Otherwise, try to count from source directory (claude-code-plugins style)
          else if (typeof pluginDef.source === 'string') {
            if (await fs.pathExists(pluginSourcePath)) {
              components = await this.countPluginComponents(pluginSourcePath);
            }
          }

          // Check if plugin is enabled in settings.json
          const enabled = await this.isPluginEnabled(pluginDef.name, marketplaceName);

          plugins.push({
            name: pluginDef.name,
            version: pluginDef.version || '1.0.0',
            description: pluginDef.description || 'No description',
            marketplace: marketplaceName,
            path: pluginSourcePath,
            components,
            author: pluginDef.author,
            homepage: pluginDef.homepage,
            license: pluginDef.license,
            keywords: pluginDef.keywords || [],
            category: pluginDef.category,
            enabled
          });
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Error processing plugin ${pluginDef.name}`), error.message);
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Error loading plugins from marketplace ${marketplaceName}`), error.message);
    }

    return plugins;
  }

  async isPluginEnabled(pluginName, marketplace) {
    // Check if plugin is enabled in settings.json
    // Plugins are stored as "plugin-name@marketplace-name": true
    const pluginKey = `${pluginName}@${marketplace}`;
    return this.enabledPlugins && this.enabledPlugins.has(pluginKey);
  }

  async countPluginComponents(pluginPath) {
    const components = {
      agents: 0,
      commands: 0,
      hooks: 0,
      mcps: 0
    };

    try {
      // Count agents
      const agentsDir = path.join(pluginPath, 'agents');
      if (await fs.pathExists(agentsDir)) {
        const agentFiles = await fs.readdir(agentsDir);
        components.agents = agentFiles.filter(f => f.endsWith('.md')).length;
      }

      // Count commands
      const commandsDir = path.join(pluginPath, 'commands');
      if (await fs.pathExists(commandsDir)) {
        const commandFiles = await fs.readdir(commandsDir);
        components.commands = commandFiles.filter(f => f.endsWith('.md')).length;
      }

      // Count hooks
      const hooksFile = path.join(pluginPath, 'hooks', 'hooks.json');
      if (await fs.pathExists(hooksFile)) {
        const hooksData = JSON.parse(await fs.readFile(hooksFile, 'utf8'));
        components.hooks = Object.values(hooksData.hooks || {}).flat().length;
      }

      // Count MCPs
      const mcpFile = path.join(pluginPath, '.mcp.json');
      if (await fs.pathExists(mcpFile)) {
        const mcpData = JSON.parse(await fs.readFile(mcpFile, 'utf8'));
        components.mcps = Object.keys(mcpData.mcpServers || {}).length;
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Error counting components for plugin at ${pluginPath}`), error.message);
    }

    return components;
  }

  async loadPermissions() {
    const permissions = {
      agents: [],
      commands: [],
      hooks: [],
      mcps: []
    };

    try {
      // Load user-level permissions
      const userPermissions = await this.loadUserPermissions();

      // Load plugin permissions
      for (const plugin of this.plugins || []) {
        const pluginPermissions = await this.loadPluginPermissions(plugin);

        permissions.agents.push(...pluginPermissions.agents);
        permissions.commands.push(...pluginPermissions.commands);
        permissions.hooks.push(...pluginPermissions.hooks);
        permissions.mcps.push(...pluginPermissions.mcps);
      }

      // Add user permissions
      permissions.agents.push(...userPermissions.agents);
      permissions.commands.push(...userPermissions.commands);
      permissions.hooks.push(...userPermissions.hooks);
      permissions.mcps.push(...userPermissions.mcps);

      return permissions;
    } catch (error) {
      console.warn(chalk.yellow('Warning: Error loading permissions'), error.message);
      return permissions;
    }
  }

  async loadUserPermissions() {
    const permissions = {
      agents: [],
      commands: [],
      hooks: [],
      mcps: []
    };

    try {
      // Load user-level agents
      const userAgentsDir = path.join(this.claudeDir, 'agents');
      if (await fs.pathExists(userAgentsDir)) {
        const agentFiles = await fs.readdir(userAgentsDir);
        for (const file of agentFiles.filter(f => f.endsWith('.md'))) {
          permissions.agents.push({
            name: file.replace('.md', ''),
            source: 'User',
            plugin: null,
            path: path.join(userAgentsDir, file)
          });
        }
      }

      // Load user-level commands
      const userCommandsDir = path.join(this.claudeDir, 'commands');
      if (await fs.pathExists(userCommandsDir)) {
        const commandFiles = await fs.readdir(userCommandsDir);
        for (const file of commandFiles.filter(f => f.endsWith('.md'))) {
          permissions.commands.push({
            name: file.replace('.md', ''),
            source: 'User',
            plugin: null,
            path: path.join(userCommandsDir, file)
          });
        }
      }

      // Load user-level hooks
      const userHooksFile = path.join(this.claudeDir, 'hooks', 'hooks.json');
      if (await fs.pathExists(userHooksFile)) {
        const hooksData = JSON.parse(await fs.readFile(userHooksFile, 'utf8'));
        for (const [event, hooks] of Object.entries(hooksData.hooks || {})) {
          for (const hook of hooks) {
            permissions.hooks.push({
              name: `${event} hook`,
              event,
              source: 'User',
              plugin: null,
              config: hook
            });
          }
        }
      }

      // Load user-level MCPs
      const userMcpFile = path.join(this.claudeDir, '.mcp.json');
      if (await fs.pathExists(userMcpFile)) {
        const mcpData = JSON.parse(await fs.readFile(userMcpFile, 'utf8'));
        for (const [name, config] of Object.entries(mcpData.mcpServers || {})) {
          permissions.mcps.push({
            name,
            source: 'User',
            plugin: null,
            config
          });
        }
      }
    } catch (error) {
      console.warn(chalk.yellow('Warning: Error loading user permissions'), error.message);
    }

    return permissions;
  }

  async loadPluginPermissions(plugin) {
    const permissions = {
      agents: [],
      commands: [],
      hooks: [],
      mcps: []
    };

    try {
      // Load plugin agents
      const agentsDir = path.join(plugin.path, 'agents');
      if (await fs.pathExists(agentsDir)) {
        const agentFiles = await fs.readdir(agentsDir);
        for (const file of agentFiles.filter(f => f.endsWith('.md'))) {
          permissions.agents.push({
            name: file.replace('.md', ''),
            source: 'Plugin',
            plugin: plugin.name,
            path: path.join(agentsDir, file)
          });
        }
      }

      // Load plugin commands
      const commandsDir = path.join(plugin.path, 'commands');
      if (await fs.pathExists(commandsDir)) {
        const commandFiles = await fs.readdir(commandsDir);
        for (const file of commandFiles.filter(f => f.endsWith('.md'))) {
          permissions.commands.push({
            name: file.replace('.md', ''),
            source: 'Plugin',
            plugin: plugin.name,
            path: path.join(commandsDir, file)
          });
        }
      }

      // Load plugin hooks
      const hooksFile = path.join(plugin.path, 'hooks', 'hooks.json');
      if (await fs.pathExists(hooksFile)) {
        const hooksData = JSON.parse(await fs.readFile(hooksFile, 'utf8'));
        for (const [event, hooks] of Object.entries(hooksData.hooks || {})) {
          for (const hook of hooks) {
            permissions.hooks.push({
              name: `${event} hook`,
              event,
              source: 'Plugin',
              plugin: plugin.name,
              config: hook
            });
          }
        }
      }

      // Load plugin MCPs
      const mcpFile = path.join(plugin.path, '.mcp.json');
      if (await fs.pathExists(mcpFile)) {
        const mcpData = JSON.parse(await fs.readFile(mcpFile, 'utf8'));
        for (const [name, config] of Object.entries(mcpData.mcpServers || {})) {
          permissions.mcps.push({
            name,
            source: 'Plugin',
            plugin: plugin.name,
            config
          });
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Error loading plugin permissions for ${plugin.name}`), error.message);
    }

    return permissions;
  }

  setupWebServer() {
    // Add CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }

      next();
    });

    // Serve static files
    this.app.use(express.static(path.join(__dirname, 'plugin-dashboard-web')));

    // API endpoints - reload data on each request
    this.app.get('/api/marketplaces', async (req, res) => {
      try {
        await this.loadPluginData();
        res.json({
          marketplaces: this.marketplaces || [],
          count: (this.marketplaces || []).length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error loading marketplaces:', error);
        res.status(500).json({ error: 'Failed to load marketplaces' });
      }
    });

    this.app.get('/api/plugins', async (req, res) => {
      try {
        await this.loadPluginData();
        res.json({
          plugins: this.plugins || [],
          count: (this.plugins || []).length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error loading plugins:', error);
        res.status(500).json({ error: 'Failed to load plugins' });
      }
    });

    this.app.get('/api/permissions', async (req, res) => {
      try {
        await this.loadPluginData();
        res.json({
          permissions: this.permissions || {},
          counts: {
            agents: (this.permissions?.agents || []).length,
            commands: (this.permissions?.commands || []).length,
            hooks: (this.permissions?.hooks || []).length,
            mcps: (this.permissions?.mcps || []).length
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error loading permissions:', error);
        res.status(500).json({ error: 'Failed to load permissions' });
      }
    });

    this.app.get('/api/summary', async (req, res) => {
      try {
        await this.loadPluginData();
        res.json({
          marketplaces: (this.marketplaces || []).length,
          plugins: (this.plugins || []).length,
          permissions: {
            agents: (this.permissions?.agents || []).length,
            commands: (this.permissions?.commands || []).length,
            hooks: (this.permissions?.hooks || []).length,
            mcps: (this.permissions?.mcps || []).length,
            total: (this.permissions?.agents || []).length +
                   (this.permissions?.commands || []).length +
                   (this.permissions?.hooks || []).length +
                   (this.permissions?.mcps || []).length
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error loading summary:', error);
        res.status(500).json({ error: 'Failed to load summary' });
      }
    });

    // Main route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'plugin-dashboard-web', 'index.html'));
    });
  }

  async startServer() {
    return new Promise((resolve) => {
      this.httpServer = this.app.listen(this.port, async () => {
        console.log(chalk.green(`🔌 Plugin dashboard started at http://localhost:${this.port}`));
        resolve();
      });
    });
  }

  async openBrowser() {
    const url = `http://localhost:${this.port}`;
    console.log(chalk.blue('🌐 Opening browser to Plugin Dashboard...'));

    try {
      await open(url);
    } catch (error) {
      console.log(chalk.yellow('Could not open browser automatically. Please visit:'));
      console.log(chalk.cyan(url));
    }
  }

  stop() {
    if (this.httpServer) {
      this.httpServer.close();
    }
    console.log(chalk.yellow('Plugin dashboard stopped'));
  }
}

async function runPluginDashboard(options = {}) {
  console.log(chalk.blue('🔌 Starting Claude Code Plugin Dashboard...'));

  const dashboard = new PluginDashboard(options);

  try {
    await dashboard.initialize();
    await dashboard.startServer();
    await dashboard.openBrowser();

    console.log(chalk.green('✅ Plugin dashboard is running!'));
    console.log(chalk.cyan(`🌐 Access at: http://localhost:${dashboard.port}`));
    console.log(chalk.gray('Press Ctrl+C to stop the server'));

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 Shutting down plugin dashboard...'));
      dashboard.stop();
      process.exit(0);
    });

    // Keep the process running
    await new Promise(() => {});

  } catch (error) {
    console.error(chalk.red('❌ Failed to start plugin dashboard:'), error.message);
    process.exit(1);
  }
}

module.exports = {
  runPluginDashboard,
  PluginDashboard
};
