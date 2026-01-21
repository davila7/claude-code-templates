const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const open = require('open');
const os = require('os');
const yaml = require('js-yaml');

class SkillDashboard {
  constructor(options = {}) {
    this.options = options;
    this.app = express();
    this.port = 3337;
    this.httpServer = null;
    this.homeDir = os.homedir();
    this.claudeDir = path.join(this.homeDir, '.claude');
    this.personalSkillsDir = path.join(this.claudeDir, 'skills');
  }

  async initialize() {
    // Load skills data
    await this.loadSkillsData();
    this.setupWebServer();
  }

  async loadSkillsData() {
    try {
      // Load personal skills
      console.log(chalk.gray(`📂 Scanning personal skills: ${this.personalSkillsDir}`));
      this.personalSkills = await this.loadSkillsFromDirectory(this.personalSkillsDir, 'Personal');
      console.log(chalk.gray(`✓ Found ${this.personalSkills.length} personal skill(s)`));

      // Load project skills (if in a project directory)
      const projectSkillsDir = path.join(process.cwd(), '.claude', 'skills');
      console.log(chalk.gray(`📂 Scanning project skills: ${projectSkillsDir}`));
      this.projectSkills = await this.loadSkillsFromDirectory(projectSkillsDir, 'Project');
      console.log(chalk.gray(`✓ Found ${this.projectSkills.length} project skill(s)`));

      // Load plugin skills from marketplaces
      console.log(chalk.gray(`📂 Scanning plugin skills from marketplaces`));
      this.pluginSkills = await this.loadPluginSkills();
      console.log(chalk.gray(`✓ Found ${this.pluginSkills.length} plugin skill(s)`));

      // Combine all skills
      this.skills = [...this.personalSkills, ...this.projectSkills, ...this.pluginSkills];
      console.log(chalk.green(`✅ Total skills loaded: ${this.skills.length}`));

    } catch (error) {
      console.error(chalk.red('Error loading skills data:'), error.message);
      throw error;
    }
  }

  async loadSkillsFromDirectory(skillsDir, source) {
    const skills = [];

    try {
      if (!(await fs.pathExists(skillsDir))) {
        console.log(chalk.gray(`  ℹ Directory does not exist: ${skillsDir}`));
        return skills;
      }

      const skillDirs = await fs.readdir(skillsDir);
      console.log(chalk.gray(`  📁 Found ${skillDirs.length} item(s) in ${skillsDir}`));

      for (const skillDir of skillDirs) {
        // Skip hidden files and directories
        if (skillDir.startsWith('.')) continue;

        const skillPath = path.join(skillsDir, skillDir);

        try {
          const stat = await fs.stat(skillPath);
          if (!stat.isDirectory()) {
            console.log(chalk.gray(`  ⊘ Skipping non-directory: ${skillDir}`));
            continue;
          }

          // Look for SKILL.md
          const skillMdPath = path.join(skillPath, 'SKILL.md');

          if (await fs.pathExists(skillMdPath)) {
            console.log(chalk.gray(`  ✓ Found SKILL.md in ${skillDir}`));
            const skillData = await this.parseSkill(skillMdPath, skillPath, skillDir, source);
            if (skillData) {
              skills.push(skillData);
              console.log(chalk.green(`  ✅ Loaded skill: ${skillData.name}`));
            }
          } else {
            console.log(chalk.gray(`  ⊘ No SKILL.md in ${skillDir}`));
          }
        } catch (error) {
          console.warn(chalk.yellow(`  ⚠ Error loading skill ${skillDir}:`), error.message);
        }
      }

      return skills;
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Error loading skills from ${skillsDir}:`), error.message);
      return skills;
    }
  }

  async loadPluginSkills() {
    const skills = [];
    const pluginsDir = path.join(this.claudeDir, 'plugins', 'marketplaces');

    try {
      if (!(await fs.pathExists(pluginsDir))) {
        console.log(chalk.gray(`  ℹ Plugins directory does not exist: ${pluginsDir}`));
        return skills;
      }

      const marketplaces = await fs.readdir(pluginsDir);
      console.log(chalk.gray(`  📁 Found ${marketplaces.length} marketplace(s)`));

      for (const marketplace of marketplaces) {
        if (marketplace.startsWith('.')) continue;

        const marketplacePath = path.join(pluginsDir, marketplace, 'plugins');

        if (!(await fs.pathExists(marketplacePath))) {
          continue;
        }

        const plugins = await fs.readdir(marketplacePath);
        console.log(chalk.gray(`  📦 Scanning marketplace: ${marketplace} (${plugins.length} plugin(s))`));

        for (const plugin of plugins) {
          if (plugin.startsWith('.')) continue;

          const skillsPath = path.join(marketplacePath, plugin, 'skills');

          if (!(await fs.pathExists(skillsPath))) {
            continue;
          }

          const skillDirs = await fs.readdir(skillsPath);

          for (const skillDir of skillDirs) {
            if (skillDir.startsWith('.')) continue;

            const skillPath = path.join(skillsPath, skillDir);
            const stat = await fs.stat(skillPath);

            if (!stat.isDirectory()) {
              continue;
            }

            const skillMdPath = path.join(skillPath, 'SKILL.md');

            if (await fs.pathExists(skillMdPath)) {
              console.log(chalk.gray(`  ✓ Found plugin skill: ${skillDir} from ${marketplace}`));
              const skillData = await this.parseSkill(skillMdPath, skillPath, skillDir, 'Plugin');
              if (skillData) {
                skills.push(skillData);
                console.log(chalk.green(`  ✅ Loaded plugin skill: ${skillData.name}`));
              }
            }
          }
        }
      }

      return skills;
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Error loading plugin skills:`), error.message);
      return skills;
    }
  }

  async parseSkill(skillMdPath, skillPath, skillDirName, source) {
    try {
      const content = await fs.readFile(skillMdPath, 'utf8');

      // Parse YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let frontmatter = {};
      let markdownContent = content;

      if (frontmatterMatch) {
        try {
          frontmatter = yaml.load(frontmatterMatch[1]);
          markdownContent = content.substring(frontmatterMatch[0].length).trim();
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Could not parse YAML frontmatter for ${skillDirName}`));
        }
      }

      // Get file stats
      const stats = await fs.stat(skillMdPath);

      // Scan for supporting files
      const supportingFiles = await this.scanSupportingFiles(skillPath);

      // Categorize files by loading strategy
      const categorizedFiles = this.categorizeFiles(supportingFiles, markdownContent);

      return {
        name: frontmatter.name || skillDirName,
        description: frontmatter.description || 'No description available',
        allowedTools: frontmatter['allowed-tools'] || frontmatter.allowedTools || null,
        source,
        path: skillPath,
        mainFile: 'SKILL.md',
        mainFilePath: skillMdPath,
        mainFileSize: this.formatFileSize(stats.size),
        lastModified: stats.mtime,
        fileCount: supportingFiles.length + 1, // +1 for SKILL.md
        supportingFiles: categorizedFiles,
        rawContent: content,
        markdownContent
      };
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Error parsing skill ${skillDirName}`), error.message);
      return null;
    }
  }

  async scanSupportingFiles(skillPath) {
    const files = [];
    const self = this; // Preserve 'this' context

    async function scanDirectory(dir, relativePath = '') {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relPath = relativePath ? path.join(relativePath, entry) : entry;

        try {
          const stat = await fs.stat(fullPath);

          if (stat.isDirectory()) {
            await scanDirectory(fullPath, relPath);
          } else if (entry !== 'SKILL.md') {
            files.push({
              name: entry,
              path: fullPath,
              relativePath: relPath,
              size: stat.size,
              isDirectory: false,
              type: self.getFileType(entry) // Use self instead of this
            });
          }
        } catch (error) {
          // Skip files we can't read
        }
      }
    }

    try {
      await scanDirectory(skillPath);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Error scanning skill directory ${skillPath}`), error.message);
    }

    return files;
  }

  categorizeFiles(files, markdownContent) {
    const categorized = {
      alwaysLoaded: ['SKILL.md'],
      onDemand: [],
      progressive: []
    };

    // Parse referenced files from markdown content
    const referencedFiles = this.extractReferencedFiles(markdownContent);

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();

      // Check if file is referenced in SKILL.md
      const isReferenced = referencedFiles.some(ref =>
        file.relativePath.includes(ref) || ref.includes(file.name)
      );

      // Categorize based on file type and references
      if (isReferenced && ext === '.md') {
        categorized.onDemand.push(file);
      } else if (ext === '.md') {
        categorized.onDemand.push(file);
      } else if (file.relativePath.startsWith('scripts/') ||
                 file.relativePath.startsWith('templates/') ||
                 ext === '.py' || ext === '.js' || ext === '.sh') {
        categorized.progressive.push(file);
      } else {
        categorized.onDemand.push(file);
      }
    }

    return categorized;
  }

  extractReferencedFiles(markdownContent) {
    const references = [];

    // Match markdown links: [text](file.md)
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkPattern.exec(markdownContent)) !== null) {
      const href = match[2];
      // Only include relative file references (not URLs)
      if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('#')) {
        references.push(href);
      }
    }

    return references;
  }

  getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const typeMap = {
      '.md': 'markdown',
      '.py': 'python',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.sh': 'shell',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.txt': 'text',
      '.html': 'html',
      '.css': 'css'
    };
    return typeMap[ext] || 'unknown';
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

    // JSON middleware
    this.app.use(express.json());

    // Serve static files
    this.app.use(express.static(path.join(__dirname, 'skill-dashboard-web')));

    // API endpoints - reload data on each request
    this.app.get('/api/skills', async (req, res) => {
      try {
        await this.loadSkillsData();
        res.json({
          skills: this.skills || [],
          count: (this.skills || []).length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error loading skills:', error);
        res.status(500).json({ error: 'Failed to load skills' });
      }
    });

    this.app.get('/api/skills/:name', async (req, res) => {
      try {
        await this.loadSkillsData();
        const skillName = req.params.name;
        const skill = this.skills.find(s =>
          s.name === skillName ||
          s.name.toLowerCase().replace(/\s+/g, '-') === skillName.toLowerCase()
        );

        if (!skill) {
          return res.status(404).json({ error: 'Skill not found' });
        }

        res.json({
          skill,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error loading skill:', error);
        res.status(500).json({ error: 'Failed to load skill' });
      }
    });

    this.app.get('/api/skills/:name/file/*', async (req, res) => {
      try {
        const skillName = req.params.name;
        const filePath = req.params[0]; // Capture the wildcard path

        await this.loadSkillsData();
        const skill = this.skills.find(s =>
          s.name === skillName ||
          s.name.toLowerCase().replace(/\s+/g, '-') === skillName.toLowerCase()
        );

        if (!skill) {
          return res.status(404).json({ error: 'Skill not found' });
        }

        const fullPath = path.join(skill.path, filePath);

        // Security check: ensure the file is within the skill directory
        const normalizedPath = path.normalize(fullPath);
        if (!normalizedPath.startsWith(skill.path)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        if (!(await fs.pathExists(fullPath))) {
          return res.status(404).json({ error: 'File not found' });
        }

        const content = await fs.readFile(fullPath, 'utf8');
        const stats = await fs.stat(fullPath);

        res.json({
          content,
          path: filePath,
          size: this.formatFileSize(stats.size),
          lastModified: stats.mtime,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error loading file:', error);
        res.status(500).json({ error: 'Failed to load file' });
      }
    });

    this.app.get('/api/summary', async (req, res) => {
      try {
        await this.loadSkillsData();
        const personalCount = this.skills.filter(s => s.source === 'Personal').length;
        const projectCount = this.skills.filter(s => s.source === 'Project').length;
        const pluginCount = this.skills.filter(s => s.source === 'Plugin').length;

        res.json({
          total: this.skills.length,
          personal: personalCount,
          project: projectCount,
          plugin: pluginCount,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error loading summary:', error);
        res.status(500).json({ error: 'Failed to load summary' });
      }
    });

    // Main route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'skill-dashboard-web', 'index.html'));
    });
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      const tryPort = (port) => {
        this.httpServer = this.app.listen(port, async () => {
          this.port = port;
          console.log(chalk.green(`🎯 Skills dashboard started at http://localhost:${this.port}`));
          resolve();
        }).on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(chalk.yellow(`⚠️  Port ${port} is in use, trying ${port + 1}...`));
            tryPort(port + 1);
          } else {
            reject(err);
          }
        });
      };

      tryPort(this.port);
    });
  }

  async openBrowser() {
    const url = `http://localhost:${this.port}`;
    console.log(chalk.blue('🌐 Opening browser to Skills Dashboard...'));

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
    console.log(chalk.yellow('Skills dashboard stopped'));
  }
}

async function runSkillDashboard(options = {}) {
  console.log(chalk.blue('🎯 Starting Claude Code Skills Dashboard...'));

  const dashboard = new SkillDashboard(options);

  try {
    await dashboard.initialize();
    await dashboard.startServer();
    await dashboard.openBrowser();

    console.log(chalk.green('✅ Skills dashboard is running!'));
    console.log(chalk.cyan(`🌐 Access at: http://localhost:${dashboard.port}`));
    console.log(chalk.gray('Press Ctrl+C to stop the server'));

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 Shutting down skills dashboard...'));
      dashboard.stop();
      process.exit(0);
    });

    // Keep the process running
    await new Promise(() => {});

  } catch (error) {
    console.error(chalk.red('❌ Failed to start skills dashboard:'), error.message);
    process.exit(1);
  }
}

module.exports = {
  runSkillDashboard,
  SkillDashboard
};
