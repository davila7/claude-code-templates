const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * Year in Review 2025 Analyzer
 * Generates comprehensive yearly statistics for Claude Code usage in 2025
 */
class YearInReview2025 {
  constructor() {
    this.year = 2025;
    this.yearStart = new Date('2025-01-01T00:00:00.000Z');
    this.yearEnd = new Date('2025-12-31T23:59:59.999Z');
  }

  /**
   * Generate complete 2025 year in review statistics
   * @param {Array} allConversations - All conversations from analytics
   * @param {string} claudeDir - Claude directory path for subagent analysis
   * @returns {Object} Complete year in review data
   */
  async generateYearInReview(allConversations, claudeDir) {
    // Filter conversations from 2025
    const conversations2025 = this.filterConversations2025(allConversations);

    console.log(`📅 Analyzing ${conversations2025.length} conversations from 2025...`);

    // Detect installed components
    const installedComponents = await this.detectInstalledComponents();

    // Analyze commands, skills, MCPs, and subagents
    const [commandsData, skillsData, mcpsData, subagentsData] = await Promise.all([
      this.analyzeCommands(),
      this.analyzeSkills(),
      this.analyzeMCPs(),
      claudeDir ? this.analyzeSubagents(claudeDir) : { subagents: [], total: 0 }
    ]);

    // Calculate all statistics
    const stats = {
      // Basic stats
      totalConversations: conversations2025.length,

      // Model usage
      models: this.analyzeModelUsage(conversations2025),

      // Tool usage, Agents, and MCPs
      toolsCount: this.countTools(conversations2025),
      agentsCount: this.countAgents(conversations2025),
      mcpCount: this.countMCPs(conversations2025),

      // Token usage
      tokens: this.calculateTokenUsage(conversations2025),

      // Streak analysis
      streak: this.calculateStreak(conversations2025),

      // Activity heatmap data (GitHub-style contribution graph)
      activityHeatmap: this.generateActivityHeatmap(conversations2025),

      // Installed components for Gource visualization
      componentInstalls: installedComponents,

      // Top projects
      topProjects: this.analyzeTopProjects(conversations2025),

      // Tool usage details
      toolUsage: this.analyzeToolUsage(conversations2025),

      // Time of day analysis
      timeOfDay: this.analyzeTimeOfDay(conversations2025),

      // Additional insights
      insights: this.generateInsights(conversations2025),

      // Commands, Skills, MCPs, Subagents (new data)
      commands: commandsData,
      skills: skillsData,
      mcps: mcpsData,
      subagents: subagentsData
    };

    return stats;
  }

  /**
   * Filter conversations from 2025
   * @param {Array} conversations - All conversations
   * @returns {Array} Conversations from 2025
   */
  filterConversations2025(conversations) {
    return conversations.filter(conv => {
      if (!conv.lastModified) return false;

      const date = new Date(conv.lastModified);
      return date >= this.yearStart && date <= this.yearEnd;
    });
  }

  /**
   * Count total tool calls across all conversations
   * @param {Array} conversations - 2025 conversations
   * @returns {Object} Tools count information
   */
  countTools(conversations) {
    let totalTools = 0;

    conversations.forEach(conv => {
      if (conv.toolUsage && conv.toolUsage.totalToolCalls) {
        totalTools += conv.toolUsage.totalToolCalls;
      }
    });

    return {
      total: totalTools,
      formatted: totalTools >= 1000 ? `${(totalTools / 1000).toFixed(1)}K` : totalTools.toString()
    };
  }

  /**
   * Count unique MCPs used across conversations
   * @param {Array} conversations - 2025 conversations
   * @returns {Object} MCP count information
   */
  countMCPs(conversations) {
    const mcpSet = new Set();

    conversations.forEach(conv => {
      // Try to extract MCP usage from conversation metadata
      // This is a simplified implementation - adjust based on actual data structure
      if (conv.mcpServers && Array.isArray(conv.mcpServers)) {
        conv.mcpServers.forEach(mcp => mcpSet.add(mcp));
      }
    });

    const count = mcpSet.size;
    return {
      total: count,
      formatted: count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count.toString()
    };
  }

  /**
   * Analyze model usage patterns
   * @param {Array} conversations - 2025 conversations
   * @returns {Array} Top models used
   */
  analyzeModelUsage(conversations) {
    const modelCounts = new Map();

    conversations.forEach(conv => {
      if (conv.modelInfo && conv.modelInfo.primaryModel) {
        const model = conv.modelInfo.primaryModel;
        modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
      }
    });

    // Convert to array and sort by usage
    const models = Array.from(modelCounts.entries())
      .map(([name, count]) => ({
        name: this.formatModelName(name),
        count,
        percentage: (count / conversations.length * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);

    return models.slice(0, 3); // Top 3 models
  }

  /**
   * Format model name for display
   * @param {string} modelName - Raw model name
   * @returns {string} Formatted model name
   */
  formatModelName(modelName) {
    if (!modelName) return 'Auto';

    // Map common model names
    const nameMap = {
      'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
      'claude-3-sonnet': 'Claude 3 Sonnet',
      'claude-3-opus': 'Claude 3 Opus',
      'claude-3-haiku': 'Claude 3 Haiku',
      'claude-sonnet-4-5-20250929': 'Claude 4.5 Sonnet',
      'claude-opus-4-5-20251101': 'Claude Opus 4.5'
    };

    return nameMap[modelName] || modelName;
  }

  /**
   * Count unique agents used
   * @param {Array} conversations - 2025 conversations
   * @returns {number} Number of unique agents
   */
  countAgents(conversations) {
    const agents = new Set();

    conversations.forEach(conv => {
      // Count unique agent sessions/conversations
      if (conv.id) {
        agents.add(conv.id);
      }
    });

    // Return count in thousands for display
    const count = agents.size;
    return {
      total: count,
      formatted: count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count.toString()
    };
  }


  /**
   * Calculate total token usage
   * @param {Array} conversations - 2025 conversations
   * @returns {Object} Token usage information
   */
  calculateTokenUsage(conversations) {
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheTokens = 0;

    conversations.forEach(conv => {
      if (conv.tokenUsage) {
        totalTokens += conv.tokenUsage.total || 0;
        inputTokens += conv.tokenUsage.inputTokens || 0;
        outputTokens += conv.tokenUsage.outputTokens || 0;
        cacheTokens += conv.tokenUsage.cacheReadTokens || 0;
      } else {
        // Fallback to estimated tokens
        totalTokens += conv.tokens || 0;
      }
    });

    // Format in billions
    const billions = totalTokens / 1000000000;

    return {
      total: totalTokens,
      billions: billions.toFixed(2),
      formatted: billions >= 1 ? `${billions.toFixed(2)}B` : `${(totalTokens / 1000000).toFixed(0)}M`,
      breakdown: {
        input: inputTokens,
        output: outputTokens,
        cache: cacheTokens
      }
    };
  }

  /**
   * Calculate longest and current streak
   * @param {Array} conversations - 2025 conversations
   * @returns {Object} Streak information
   */
  calculateStreak(conversations) {
    if (conversations.length === 0) {
      return { longest: 0, current: 0, formatted: '0d' };
    }

    // Create set of active days
    const activeDays = new Set();
    conversations.forEach(conv => {
      if (conv.lastModified) {
        const date = new Date(conv.lastModified);
        const dayKey = date.toISOString().split('T')[0];
        activeDays.add(dayKey);
      }
    });

    // Convert to sorted array
    const sortedDays = Array.from(activeDays).sort();

    // Calculate longest streak
    let longestStreak = 1;
    let currentStreakCount = 1;

    for (let i = 1; i < sortedDays.length; i++) {
      const prevDate = new Date(sortedDays[i - 1]);
      const currDate = new Date(sortedDays[i]);

      const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreakCount++;
        longestStreak = Math.max(longestStreak, currentStreakCount);
      } else {
        currentStreakCount = 1;
      }
    }

    // Calculate current streak (from most recent day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentStreak = 0;

    const lastDay = new Date(sortedDays[sortedDays.length - 1]);
    const daysSinceLastActivity = Math.round((today - lastDay) / (1000 * 60 * 60 * 24));

    if (daysSinceLastActivity <= 1) {
      // Activity today or yesterday, calculate backward streak
      let checkDate = new Date(lastDay);
      currentStreak = 1;

      for (let i = sortedDays.length - 2; i >= 0; i--) {
        const prevDate = new Date(sortedDays[i]);
        const diff = Math.round((checkDate - prevDate) / (1000 * 60 * 60 * 24));

        if (diff === 1) {
          currentStreak++;
          checkDate = prevDate;
        } else {
          break;
        }
      }
    }

    return {
      longest: longestStreak,
      current: currentStreak,
      formatted: `${longestStreak}d`,
      activeDays: activeDays.size
    };
  }

  /**
   * Calculate number of active days
   * @param {Array} conversations - Conversations
   * @returns {number} Number of active days
   */
  calculateActiveDays(conversations) {
    const activeDays = new Set();
    conversations.forEach(conv => {
      if (conv.lastModified) {
        const date = new Date(conv.lastModified);
        const dayKey = date.toISOString().split('T')[0];
        activeDays.add(dayKey);
      }
    });
    return activeDays.size;
  }

  /**
   * Generate activity heatmap data (GitHub-style)
   * @param {Array} conversations - 2025 conversations
   * @returns {Array} Heatmap data by week
   */
  generateActivityHeatmap(conversations) {
    console.log(`\n🔥🔥🔥 GENERATING HEATMAP for ${conversations.length} conversations\n`);

    // Create map of day -> activity count, tools, and models
    const dailyActivity = new Map();

    conversations.forEach((conv, idx) => {
      if (conv.lastModified) {
        const date = new Date(conv.lastModified);
        const dayKey = date.toISOString().split('T')[0];

        if (idx < 3) {
          console.log(`  📝 Conv ${idx}: id=${conv.id}, tokens=${conv.tokens}, tokenUsage.total=${conv.tokenUsage?.total}`);
        }

        const current = dailyActivity.get(dayKey) || {
          count: 0,
          tools: [],
          models: [],
          modelCounts: {},
          toolCounts: {},
          tokens: 0
        };
        current.count += 1;

        // Add tokens from this conversation
        if (conv.tokenUsage && conv.tokenUsage.total) {
          current.tokens += conv.tokenUsage.total;
          if (idx < 3) console.log(`  💎 Added ${conv.tokenUsage.total} tokens from conv ${conv.id} to ${dayKey}`);
        } else if (conv.tokens) {
          current.tokens += conv.tokens;
          if (idx < 3) console.log(`  💎 Added ${conv.tokens} tokens (fallback) from conv ${conv.id} to ${dayKey}`);
        } else {
          if (idx < 3) console.log(`  ⚠️  Conv ${conv.id} has NO token data`);
        }

        // Count tool usage with actual numbers from toolStats
        if (conv.toolUsage && conv.toolUsage.toolStats) {
          Object.entries(conv.toolUsage.toolStats).forEach(([tool, count]) => {
            if (!current.tools.includes(tool)) {
              current.tools.push(tool);
            }
            // Add the actual count from this conversation
            current.toolCounts[tool] = (current.toolCounts[tool] || 0) + count;
          });
        }

        // Count model usage using totalToolCalls as proxy for activity
        if (conv.modelInfo && conv.modelInfo.primaryModel) {
          const model = conv.modelInfo.primaryModel;
          if (!current.models.includes(model)) {
            current.models.push(model);
          }
          // Use totalToolCalls as proxy for model activity (each tool call ≈ one model response)
          const activityCount = (conv.toolUsage && conv.toolUsage.totalToolCalls) || 1;
          current.modelCounts[model] = (current.modelCounts[model] || 0) + activityCount;
        }

        dailyActivity.set(dayKey, current);
      }
    });

    // Generate full year grid (52-53 weeks)
    const weeks = [];
    const startDate = new Date(this.yearStart);

    // Start from first Sunday of the year or week before
    const firstDay = startDate.getDay();
    if (firstDay !== 0) {
      startDate.setDate(startDate.getDate() - firstDay);
    }

    let currentWeek = [];
    let currentDate = new Date(startDate);

    while (currentDate <= this.yearEnd || currentWeek.length > 0) {
      const dayKey = currentDate.toISOString().split('T')[0];
      const dayData = dailyActivity.get(dayKey) || {
        count: 0,
        tools: [],
        models: [],
        toolCounts: {},
        modelCounts: {},
        tokens: 0
      };

      // Determine intensity level (0-4 like GitHub)
      let level = 0;
      if (dayData.count > 0) level = 1;
      if (dayData.count >= 3) level = 2;
      if (dayData.count >= 6) level = 3;
      if (dayData.count >= 10) level = 4;

      currentWeek.push({
        date: dayKey,
        count: dayData.count,
        tools: dayData.tools,
        models: dayData.models,
        toolCounts: dayData.toolCounts,
        modelCounts: dayData.modelCounts,
        tokens: dayData.tokens,
        level,
        day: currentDate.getDay()
      });

      // If Sunday (end of week) or last day, push week
      if (currentDate.getDay() === 6 || currentDate > this.yearEnd) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }

      currentDate.setDate(currentDate.getDate() + 1);

      // Safety check
      if (weeks.length > 60) break;
    }

    return weeks;
  }


  /**
   * Analyze top projects worked on
   * @param {Array} conversations - 2025 conversations
   * @returns {Array} Top projects
   */
  analyzeTopProjects(conversations) {
    const projectActivity = new Map();

    conversations.forEach(conv => {
      const project = conv.project || 'Unknown';
      const current = projectActivity.get(project) || { count: 0, tokens: 0 };

      current.count += 1;
      current.tokens += conv.tokens || 0;

      projectActivity.set(project, current);
    });

    return Array.from(projectActivity.entries())
      .map(([name, data]) => ({
        name,
        conversations: data.count,
        tokens: data.tokens
      }))
      .sort((a, b) => b.conversations - a.conversations)
      .slice(0, 5);
  }

  /**
   * Analyze tool usage patterns
   * @param {Array} conversations - 2025 conversations
   * @returns {Object} Tool usage statistics
   */
  analyzeToolUsage(conversations) {
    let totalToolCalls = 0;
    const toolTypes = new Map();

    conversations.forEach(conv => {
      if (conv.toolUsage) {
        totalToolCalls += conv.toolUsage.totalToolCalls || 0;

        if (conv.toolUsage.toolStats) {
          Object.entries(conv.toolUsage.toolStats).forEach(([tool, count]) => {
            toolTypes.set(tool, (toolTypes.get(tool) || 0) + count);
          });
        }
      }
    });

    const topTools = Array.from(toolTypes.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total: totalToolCalls,
      topTools
    };
  }

  /**
   * Analyze time of day usage patterns
   * @param {Array} conversations - 2025 conversations
   * @returns {Object} Time of day statistics
   */
  analyzeTimeOfDay(conversations) {
    const hourCounts = new Array(24).fill(0);

    conversations.forEach(conv => {
      if (conv.lastModified) {
        const date = new Date(conv.lastModified);
        const hour = date.getHours();
        hourCounts[hour]++;
      }
    });

    // Find peak hour
    let peakHour = 0;
    let peakCount = 0;

    hourCounts.forEach((count, hour) => {
      if (count > peakCount) {
        peakCount = count;
        peakHour = hour;
      }
    });

    return {
      peakHour,
      peakHourFormatted: `${peakHour}:00 - ${peakHour + 1}:00`,
      hourlyDistribution: hourCounts
    };
  }

  /**
   * Detect installed components from .claude directory
   * @returns {Promise<Array>} List of component installations
   */
  async detectInstalledComponents() {
    const components = [];
    const os = require('os');
    const fs = require('fs-extra');
    const path = require('path');

    try {
      const claudeDir = path.join(os.homedir(), '.claude');
      const localDir = path.join(claudeDir, 'local');

      // Check if local directory exists
      if (await fs.pathExists(localDir)) {
        const settings = await fs.readJSON(path.join(claudeDir, 'settings.json')).catch(() => ({}));

        // Extract MCPs from settings
        if (settings.mcpServers) {
          Object.keys(settings.mcpServers).forEach(mcpName => {
            components.push({
              type: 'mcp',
              name: mcpName,
              date: new Date('2025-01-15') // Default date - could be improved
            });
          });
        }

        // Extract enabled plugins
        if (settings.enabledPlugins) {
          Object.entries(settings.enabledPlugins).forEach(([pluginName, enabled]) => {
            if (enabled) {
              components.push({
                type: 'skill',
                name: pluginName.split('@')[0],
                date: new Date('2025-02-01')
              });
            }
          });
        }
      }
    } catch (error) {
      console.warn('Could not detect installed components:', error.message);
    }

    return components;
  }

  /**
   * Generate insights and fun facts
   * @param {Array} conversations - 2025 conversations
   * @returns {Array} Insights
   */
  generateInsights(conversations) {
    const insights = [];

    // Total messages
    const totalMessages = conversations.reduce((sum, conv) => sum + (conv.messageCount || 0), 0);
    insights.push(`Sent ${totalMessages.toLocaleString()} messages`);

    // Average session length
    const avgMessages = Math.round(totalMessages / conversations.length);
    insights.push(`Average ${avgMessages} messages per conversation`);

    // Most productive day
    const dailyActivity = new Map();
    conversations.forEach(conv => {
      if (conv.lastModified) {
        const dayKey = new Date(conv.lastModified).toISOString().split('T')[0];
        dailyActivity.set(dayKey, (dailyActivity.get(dayKey) || 0) + 1);
      }
    });

    const mostProductiveDay = Array.from(dailyActivity.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (mostProductiveDay) {
      const date = new Date(mostProductiveDay[0]);
      insights.push(`Most productive: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
    }

    return insights;
  }

  /**
   * Analyze command usage from history
   * @returns {Promise<Object>} Command usage data
   */
  async analyzeCommands() {
    const fs = require('fs-extra');
    const os = require('os');
    const path = require('path');

    try {
      const historyPath = path.join(os.homedir(), '.claude', 'history.jsonl');
      if (!await fs.pathExists(historyPath)) {
        return { commands: [], total: 0, events: [] };
      }

      const content = await fs.readFile(historyPath, 'utf8');
      const lines = content.trim().split('\n').filter(l => l.trim());

      const commandCounts = new Map();
      const commandEvents = []; // Track each command execution with timestamp

      lines.forEach(line => {
        try {
          const entry = JSON.parse(line);
          if (entry.display && entry.display.startsWith('/')) {
            const cmd = entry.display.trim();
            // Extract base command (before space or arguments)
            const baseCmd = cmd.split(' ')[0];
            commandCounts.set(baseCmd, (commandCounts.get(baseCmd) || 0) + 1);

            // Extract timestamp and add to events
            if (entry.timestamp) {
              const timestamp = new Date(entry.timestamp);
              // Only include 2025 events
              if (timestamp.getFullYear() === 2025) {
                commandEvents.push({
                  name: baseCmd,
                  timestamp: timestamp,
                  display: entry.display
                });
              }
            }
          }
        } catch (e) {
          // Skip invalid lines
        }
      });

      const commands = Array.from(commandCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      return {
        commands: commands.slice(0, 20), // Top 20 commands
        total: commands.reduce((sum, cmd) => sum + cmd.count, 0),
        events: commandEvents.sort((a, b) => a.timestamp - b.timestamp) // Sort by date
      };
    } catch (error) {
      console.warn('Could not analyze commands:', error.message);
      return { commands: [], total: 0, events: [] };
    }
  }

  /**
   * Analyze installed skills
   * @returns {Promise<Object>} Skills data
   */
  async analyzeSkills() {
    const fs = require('fs-extra');
    const os = require('os');
    const path = require('path');

    try {
      const skillsPath = path.join(os.homedir(), '.claude', 'skills');
      if (!await fs.pathExists(skillsPath)) {
        return { skills: [], total: 0, events: [] };
      }

      const items = await fs.readdir(skillsPath);
      const skills = [];
      const skillEvents = [];

      for (const item of items) {
        const itemPath = path.join(skillsPath, item);
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
          const installedAt = stats.birthtime;
          skills.push({
            name: item,
            installedAt: installedAt
          });

          // Only include 2025 skills
          if (installedAt.getFullYear() === 2025) {
            skillEvents.push({
              name: item,
              timestamp: installedAt
            });
          }
        }
      }

      return {
        skills: skills.sort((a, b) => b.installedAt - a.installedAt),
        total: skills.length,
        events: skillEvents.sort((a, b) => a.timestamp - b.timestamp)
      };
    } catch (error) {
      console.warn('Could not analyze skills:', error.message);
      return { skills: [], total: 0, events: [] };
    }
  }

  /**
   * Analyze installed MCPs
   * @returns {Promise<Object>} MCPs data
   */
  async analyzeMCPs() {
    const fs = require('fs-extra');
    const os = require('os');
    const path = require('path');

    try {
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      if (!await fs.pathExists(settingsPath)) {
        return { mcps: [], total: 0, events: [] };
      }

      const content = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(content);
      const stats = await fs.stat(settingsPath);
      const modifiedAt = stats.mtime; // Use file modification time as fallback

      const mcps = [];
      const mcpEvents = [];

      if (settings.enabledPlugins) {
        Object.entries(settings.enabledPlugins).forEach(([name, enabled], index) => {
          if (enabled) {
            mcps.push({ name, enabled });

            // Only include 2025 MCPs
            // Use modification time with slight offset for each MCP
            if (modifiedAt.getFullYear() === 2025) {
              const timestamp = new Date(modifiedAt.getTime() + (index * 1000)); // 1 second apart
              mcpEvents.push({
                name: name,
                timestamp: timestamp
              });
            }
          }
        });
      }

      return {
        mcps: mcps,
        total: mcps.length,
        events: mcpEvents.sort((a, b) => a.timestamp - b.timestamp)
      };
    } catch (error) {
      console.warn('Could not analyze MCPs:', error.message);
      return { mcps: [], total: 0, events: [] };
    }
  }

  /**
   * Analyze subagent usage
   * @param {string} claudeDir - Claude directory path
   * @returns {Promise<Object>} Subagents data
   */
  async analyzeSubagents(claudeDir) {
    const fs = require('fs-extra');
    const path = require('path');

    try {
      const projectsDir = path.join(claudeDir, 'projects');
      if (!await fs.pathExists(projectsDir)) {
        return { subagents: [], total: 0, events: [] };
      }

      const agentData = new Map(); // Map of agent ID -> { id, timestamp }
      const projects = await fs.readdir(projectsDir);

      // Search for agent files in all project directories
      for (const project of projects) {
        const projectPath = path.join(projectsDir, project);
        const stats = await fs.stat(projectPath);

        if (stats.isDirectory()) {
          const files = await fs.readdir(projectPath);
          const agentFiles = files.filter(f => f.startsWith('agent-') && f.endsWith('.jsonl'));

          for (const file of agentFiles) {
            const match = file.match(/agent-(.+)\.jsonl$/);
            if (match) {
              const agentId = match[1];

              // Read only first 2 lines for performance (don't read entire file)
              try {
                const filePath = path.join(projectPath, file);
                const readline = require('readline');
                const fileStream = require('fs').createReadStream(filePath);
                const rl = readline.createInterface({
                  input: fileStream,
                  crlfDelay: Infinity
                });

                let timestamp = null;
                let agentType = 'Agent';
                let lineCount = 0;
                const lines = [];

                // Read only first 2 lines
                for await (const line of rl) {
                  if (line.trim()) {
                    lines.push(line.trim());
                    lineCount++;
                    if (lineCount >= 2) break; // Stop after 2 lines
                  }
                }
                rl.close();
                fileStream.close();

                // Get timestamp from first line
                if (lines[0]) {
                  const firstEntry = JSON.parse(lines[0]);
                  if (firstEntry.timestamp) {
                    timestamp = new Date(firstEntry.timestamp);
                  }
                }

                // Try to extract agent type from second line (assistant response)
                if (lines[1]) {
                  const secondEntry = JSON.parse(lines[1]);
                  if (secondEntry.message && secondEntry.message.content) {
                    const content = Array.isArray(secondEntry.message.content)
                      ? secondEntry.message.content[0]?.text
                      : secondEntry.message.content;

                    // Look for agent type indicators in the response (check first 500 chars only)
                    if (content) {
                      const lowerContent = content.substring(0, 500).toLowerCase();

                      // Plan agents
                      if (lowerContent.includes('planning mode') ||
                          lowerContent.includes('read-only')) {
                        agentType = 'Plan';
                      }
                      // Explore agents
                      else if (lowerContent.includes('explore') ||
                               lowerContent.includes('search')) {
                        agentType = 'Explore';
                      }
                      // Default to Plan for most agents
                      else {
                        agentType = 'Plan';
                      }
                    }
                  }
                }

                // Only store the earliest timestamp for each agent
                if (!agentData.has(agentId) || (timestamp && timestamp < agentData.get(agentId).timestamp)) {
                  agentData.set(agentId, { id: agentId, timestamp, type: agentType });
                }
              } catch (e) {
                // If we can't read timestamp, just add the agent without timestamp
                if (!agentData.has(agentId)) {
                  agentData.set(agentId, { id: agentId, timestamp: null, type: 'Agent' });
                }
              }
            }
          }
        }
      }

      const subagents = Array.from(agentData.values());

      // Group subagents by type for cleaner visualization
      const groupedByType = {};
      subagents.forEach(agent => {
        const type = agent.type || 'Unknown';
        if (!groupedByType[type]) {
          groupedByType[type] = { count: 0, timestamps: [] };
        }
        groupedByType[type].count++;
        if (agent.timestamp && agent.timestamp.getFullYear() === 2025) {
          groupedByType[type].timestamps.push(agent.timestamp);
        }
      });

      // Create events grouped by type (one event per type per day)
      const subagentEvents = [];
      Object.entries(groupedByType).forEach(([type, data]) => {
        // Group timestamps by day to avoid too many events
        const dayMap = new Map();
        data.timestamps.forEach(ts => {
          const dayKey = ts.toISOString().split('T')[0];
          if (!dayMap.has(dayKey)) {
            dayMap.set(dayKey, { count: 0, timestamp: ts });
          }
          dayMap.get(dayKey).count++;
        });

        // Create one event per day per type
        dayMap.forEach((dayData, dayKey) => {
          subagentEvents.push({
            name: type, // Just "Plan" or "Explore", not "Plan-a68a"
            timestamp: dayData.timestamp,
            type: type,
            count: dayData.count // How many times used that day
          });
        });
      });

      subagentEvents.sort((a, b) => a.timestamp - b.timestamp);

      return {
        subagents: Object.entries(groupedByType).map(([type, data]) => ({
          type,
          count: data.count
        })),
        total: subagents.length,
        events: subagentEvents,
        grouped: groupedByType // Include grouped data for display
      };
    } catch (error) {
      console.warn('Could not analyze subagents:', error.message);
      return { subagents: [], total: 0, events: [] };
    }
  }
}

module.exports = YearInReview2025;
