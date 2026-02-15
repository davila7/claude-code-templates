const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const open = require('open');
const os = require('os');
const readline = require('readline');

class TeamsDashboard {
  constructor(options = {}) {
    this.options = options;
    this.app = express();
    this.port = 3338;
    this.httpServer = null;
    this.homeDir = os.homedir();
    this.claudeDir = path.join(this.homeDir, '.claude');
    this.projectsDir = path.join(this.claudeDir, 'projects');
    this.sessionCache = new Map();
  }

  async initialize() {
    if (!(await fs.pathExists(this.projectsDir))) {
      throw new Error(`Claude Code projects directory not found at ${this.projectsDir}`);
    }

    this.sessions = await this.discoverTeamSessions();
    this.setupWebServer();
  }

  async discoverTeamSessions() {
    const sessions = [];

    try {
      const projectDirs = await fs.readdir(this.projectsDir);

      for (const projectDir of projectDirs) {
        const projectPath = path.join(this.projectsDir, projectDir);
        const stat = await fs.stat(projectPath);
        if (!stat.isDirectory()) continue;

        const entries = await fs.readdir(projectPath);

        for (const entry of entries) {
          const entryPath = path.join(projectPath, entry);
          const entryStat = await fs.stat(entryPath);
          if (!entryStat.isDirectory()) continue;

          const subagentsDir = path.join(entryPath, 'subagents');
          if (!(await fs.pathExists(subagentsDir))) continue;

          const agentFiles = (await fs.readdir(subagentsDir))
            .filter(f => f.startsWith('agent-') && f.endsWith('.jsonl')
              && !f.includes('acompact-')); // Skip auto-compaction agents

          if (agentFiles.length === 0) continue;

          // Verify this is a real Team session (has TeamCreate/SendMessage/teammate-message)
          const leadFile = entryPath + '.jsonl';
          const isTeam = await this.detectTeamProtocol(leadFile);
          if (!isTeam) continue;

          // Read metadata efficiently: first/last lines only
          const metadata = await this.readSessionMetadata(entryPath, subagentsDir, agentFiles);

          sessions.push({
            id: entry,
            projectDir,
            projectName: this.decodeProjectDir(projectDir),
            path: entryPath,
            subagentsDir,
            agentFiles,
            agentCount: agentFiles.length,
            ...metadata
          });
        }
      }
    } catch (error) {
      console.warn(chalk.yellow('Warning: Error discovering team sessions'), error.message);
    }

    // Sort newest first
    sessions.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));
    return sessions;
  }

  decodeProjectDir(encoded) {
    // Convert "-Users-macbookpro16-Documents-..." to a readable path
    return encoded.replace(/^-/, '/').replace(/-/g, '/');
  }

  async detectTeamProtocol(leadFilePath) {
    // Scan lead JSONL for Team protocol tool_use: TeamCreate or SendMessage
    // These are the definitive signals — teammate-message XML can appear in documentation text
    if (!(await fs.pathExists(leadFilePath))) return false;

    try {
      const content = await fs.readFile(leadFilePath, 'utf8');
      return content.includes('"TeamCreate"') || content.includes('"SendMessage"');
    } catch (e) {
      return false;
    }
  }

  async readSessionMetadata(sessionPath, subagentsDir, agentFiles) {
    let startTime = null;
    let endTime = null;
    let leadAgentId = null;
    let gitBranch = null;
    let teammateNames = new Map();

    // Read lead session JSONL for start time (skip non-message types like file-history-snapshot)
    const leadFile = sessionPath + '.jsonl';
    if (await fs.pathExists(leadFile)) {
      try {
        const firstLines = await this.readFirstNLines(leadFile, 5);
        for (const line of firstLines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.timestamp && (parsed.type === 'user' || parsed.type === 'assistant')) {
              if (!startTime) startTime = parsed.timestamp;
              if (!gitBranch) gitBranch = parsed.gitBranch;
              break;
            }
          } catch (e) { /* skip malformed */ }
        }
        const lastLine = await this.readLastLine(leadFile);
        if (lastLine) {
          const parsed = JSON.parse(lastLine);
          if (parsed.timestamp && (!endTime || new Date(parsed.timestamp) > new Date(endTime))) {
            endTime = parsed.timestamp;
          }
        }
      } catch (e) { /* skip */ }
    }

    // Read each agent's first line for agent IDs and timestamps
    for (const agentFile of agentFiles) {
      const filePath = path.join(subagentsDir, agentFile);
      try {
        const firstLine = await this.readFirstLine(filePath);
        if (firstLine) {
          const parsed = JSON.parse(firstLine);
          const agentId = parsed.agentId || agentFile.replace('agent-', '').replace('.jsonl', '');

          if (!leadAgentId) leadAgentId = agentId;

          // Try to extract teammate name from teammate-message tags
          const content = parsed.message?.content || '';
          const nameMatch = content.match(/teammate_id="([^"]+)"/);
          if (nameMatch) {
            teammateNames.set(agentId, nameMatch[1]);
          }

          if (!startTime || new Date(parsed.timestamp) < new Date(startTime)) {
            startTime = parsed.timestamp;
          }
        }

        const lastLine = await this.readLastLine(filePath);
        if (lastLine) {
          const parsed = JSON.parse(lastLine);
          if (!endTime || new Date(parsed.timestamp) > new Date(endTime)) {
            endTime = parsed.timestamp;
          }
        }
      } catch (e) { /* skip */ }
    }

    return {
      startTime,
      endTime,
      gitBranch,
      leadAgentId,
      teammateNames: Object.fromEntries(teammateNames),
      duration: startTime && endTime
        ? new Date(endTime) - new Date(startTime)
        : null
    };
  }

  async readFirstLine(filePath) {
    const lines = await this.readFirstNLines(filePath, 1);
    return lines.length > 0 ? lines[0] : null;
  }

  async readFirstNLines(filePath, n) {
    return new Promise((resolve) => {
      const lines = [];
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
      rl.on('line', (line) => {
        lines.push(line.trim());
        if (lines.length >= n) {
          rl.close();
          stream.destroy();
          resolve(lines);
        }
      });
      rl.on('close', () => resolve(lines));
      rl.on('error', () => resolve(lines));
    });
  }

  async readLastLine(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const bufferSize = Math.min(8192, stats.size);
      if (bufferSize === 0) return null;

      const nativeFs = require('fs');
      const fd = nativeFs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(bufferSize);
      nativeFs.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
      nativeFs.closeSync(fd);

      const content = buffer.toString('utf8');
      const lines = content.split('\n').filter(l => l.trim());
      return lines.length > 0 ? lines[lines.length - 1].trim() : null;
    } catch (e) {
      return null;
    }
  }

  async parseFullSession(sessionId) {
    if (this.sessionCache.has(sessionId)) {
      return this.sessionCache.get(sessionId);
    }

    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return null;

    const events = [];
    const agents = new Map();
    const teammateNames = new Map();

    // Parse lead session
    const leadFile = session.path + '.jsonl';
    if (await fs.pathExists(leadFile)) {
      const leadEvents = await this.parseJSONLFile(leadFile, 'lead');
      events.push(...leadEvents);

      // Extract teammate names from lead's SendMessage/TeamCreate tool calls
      for (const event of leadEvents) {
        this.extractTeammateInfo(event, teammateNames);
      }

      // Register lead as an agent
      const leadStart = leadEvents.length > 0 ? leadEvents[0].timestamp : null;
      const leadEnd = leadEvents.length > 0 ? leadEvents[leadEvents.length - 1].timestamp : null;
      agents.set('lead', {
        id: 'lead',
        name: 'Lead',
        eventCount: leadEvents.length,
        startTime: leadStart,
        endTime: leadEnd,
        toolsUsed: this.countToolsUsed(leadEvents),
        messageCount: leadEvents.filter(e => e.type === 'assistant' && e.hasText).length,
        isLead: true
      });
    }

    // Parse each agent file
    const agentEventMap = new Map();
    for (const agentFile of session.agentFiles) {
      const filePath = path.join(session.subagentsDir, agentFile);
      const agentId = agentFile.replace('agent-', '').replace('.jsonl', '');
      const agentEvents = await this.parseJSONLFile(filePath, agentId);
      events.push(...agentEvents);
      agentEventMap.set(agentId, agentEvents);
    }

    // Resolve agent names by matching Task spawns (with input.name) to agent start times
    const nameMap = this.resolveAgentNames(events, agentEventMap);

    // Build agent info
    for (const [agentId, agentEvents] of agentEventMap) {
      const agentStart = agentEvents.length > 0 ? agentEvents[0].timestamp : null;
      const agentEnd = agentEvents.length > 0 ? agentEvents[agentEvents.length - 1].timestamp : null;
      const resolvedName = nameMap.get(agentId);

      // For unnamed agents, find who spawned them from teammate-message XML tags
      let spawnedBy = null;
      let taskSubject = null;
      if (!resolvedName) {
        for (const evt of agentEvents) {
          if (evt.type === 'user' && evt.textContent) {
            // Only match real teammate messages (content starts with the tag)
            const trimmed = evt.textContent.trim();
            if (trimmed.startsWith('<teammate-message')) {
              const m = trimmed.match(/<teammate-message\s+teammate_id="([^"]+)"/);
              if (m) { spawnedBy = m[1]; }
              // Extract task subject from JSON payload inside the tag
              const subjectMatch = trimmed.match(/"subject"\s*:\s*"([^"]+)"/);
              if (subjectMatch) { taskSubject = subjectMatch[1]; }
              if (spawnedBy) break;
            }
          }
        }
      }

      // If still no name and no spawner, try to match this agent to a lead Task spawn by timestamp
      if (!resolvedName && !spawnedBy) {
        const agentStart = agentEvents.length > 0 ? new Date(agentEvents[0].timestamp).getTime() : 0;
        for (const event of events.filter(e => e.agentId === 'lead')) {
          for (const tool of event.toolUse || []) {
            if (tool.name === 'Task' && !tool.input?.name) {
              const spawnTs = new Date(event.timestamp).getTime();
              if (Math.abs(agentStart - spawnTs) < 5000) {
                spawnedBy = 'Lead';
                break;
              }
            }
          }
          if (spawnedBy) break;
        }
      }

      agents.set(agentId, {
        id: agentId,
        name: resolvedName || taskSubject || (spawnedBy ? `${spawnedBy}/${agentId.substring(0, 4)}` : agentId.substring(0, 7)),
        eventCount: agentEvents.length,
        startTime: agentStart,
        endTime: agentEnd,
        toolsUsed: this.countToolsUsed(agentEvents),
        messageCount: agentEvents.filter(e => e.type === 'assistant' && e.hasText).length,
        spawnedBy
      });
    }

    // Sort events chronologically
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Build result
    const result = {
      id: session.id,
      projectName: session.projectName,
      gitBranch: session.gitBranch,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      agents: Object.fromEntries(agents),
      teammateNames: Object.fromEntries(teammateNames),
      events,
      communications: this.extractCommunications(events),
      tasks: this.extractTasks(events),
      stats: this.calculateSessionStats(events, agents)
    };

    this.sessionCache.set(sessionId, result);
    return result;
  }

  resolveAgentNames(allEvents, agentEventMap) {
    const nameMap = new Map();

    // Collect all Task tool_use blocks with input.name (agent spawn calls)
    const spawns = [];
    for (const event of allEvents) {
      for (const tool of event.toolUse || []) {
        if (tool.name === 'Task' && tool.input?.name) {
          spawns.push({ name: tool.input.name, timestamp: new Date(event.timestamp).getTime() });
        }
      }
    }
    spawns.sort((a, b) => a.timestamp - b.timestamp);

    // Get agent start times
    const agentStarts = [];
    for (const [agentId, events] of agentEventMap) {
      if (events.length > 0) {
        agentStarts.push({ id: agentId, timestamp: new Date(events[0].timestamp).getTime() });
      }
    }
    agentStarts.sort((a, b) => a.timestamp - b.timestamp);

    // Match each spawn to the closest agent that starts within 2 minutes after
    const usedAgents = new Set();
    for (const spawn of spawns) {
      let bestId = null, bestDiff = Infinity;
      for (const agent of agentStarts) {
        if (usedAgents.has(agent.id)) continue;
        const diff = agent.timestamp - spawn.timestamp;
        if (diff >= -2000 && diff < bestDiff && diff < 120000) {
          bestDiff = diff;
          bestId = agent.id;
        }
      }
      if (bestId) {
        nameMap.set(bestId, spawn.name);
        usedAgents.add(bestId);
      }
    }

    return nameMap;
  }

  async parseJSONLFile(filePath, agentId) {
    const events = [];
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);

          // Skip file-history-snapshot and other non-message types
          if (parsed.type === 'file-history-snapshot') continue;

          const msg = parsed.message || {};
          const contentBlocks = Array.isArray(msg.content) ? msg.content : [];
          const textContent = typeof msg.content === 'string'
            ? msg.content
            : contentBlocks.filter(b => b.type === 'text').map(b => b.text).join('\n');

          const toolUseBlocks = contentBlocks.filter(b => b.type === 'tool_use');
          const toolResultBlocks = contentBlocks.filter(b => b.type === 'tool_result');

          events.push({
            agentId: parsed.agentId || agentId,
            type: parsed.type, // 'user' or 'assistant'
            role: msg.role,
            timestamp: parsed.timestamp,
            textContent: textContent.substring(0, 2000), // Truncate for display
            hasText: textContent.length > 0,
            toolUse: toolUseBlocks.map(t => ({
              name: t.name,
              id: t.id,
              input: t.input
            })),
            toolResults: toolResultBlocks.map(t => ({
              tool_use_id: t.tool_use_id,
              content: typeof t.content === 'string'
                ? t.content.substring(0, 500)
                : JSON.stringify(t.content).substring(0, 500)
            })),
            model: msg.model,
            isSidechain: parsed.isSidechain
          });
        } catch (e) { /* skip malformed lines */ }
      }
    } catch (e) { /* skip unreadable files */ }

    return events;
  }

  extractTeammateInfo(event, teammateNames) {
    // From teammate-message XML tags
    const text = event.textContent || '';
    const matches = text.matchAll(/teammate_id="([^"]+)"/g);
    for (const match of matches) {
      const name = match[1];
      // The teammate_id is the name of the SENDER, which sends to event.agentId
      // We store it as a known name
      if (!teammateNames.has(name)) {
        // We don't know the agentId for the sender directly, but we can infer
      }
    }

    // From SendMessage tool_use
    for (const tool of event.toolUse || []) {
      if (tool.name === 'SendMessage' && tool.input) {
        if (tool.input.recipient) {
          // recipient is a name
        }
      }
      if (tool.name === 'Task' && tool.input?.name) {
        // Task tool spawning a named teammate
        const agentName = tool.input.name;
        // We'd need to correlate with agentId later
      }
    }

    // From teammate-message: the teammate_id is the sender name
    const teammateMatch = text.match(/<teammate-message\s+teammate_id="([^"]+)"/);
    if (teammateMatch) {
      // This message was RECEIVED by event.agentId FROM teammate_id
      // So teammate_id is a name we want to track
      const senderName = teammateMatch[1];
      // We can't directly map senderName to an agentId from this alone
      // but we store it for display
    }
  }

  extractCommunications(events) {
    const communications = [];

    for (const event of events) {
      // Check for teammate-message in user messages (must start with the tag to avoid documentation text)
      if (event.type === 'user' && event.textContent && event.textContent.trim().startsWith('<teammate-message')) {
        const match = event.textContent.match(/<teammate-message\s+teammate_id="([^"]+)"(?:\s+color="([^"]*)")?>\n?([\s\S]*?)\n?<\/teammate-message>/);
        if (match) {
          let messageContent = match[3];
          let parsedContent = null;

          try {
            parsedContent = JSON.parse(messageContent);
          } catch (e) {
            parsedContent = { text: messageContent };
          }

          communications.push({
            timestamp: event.timestamp,
            from: match[1],
            to: event.agentId,
            color: match[2] || null,
            content: parsedContent,
            messageType: parsedContent?.type || 'message',
            raw: messageContent.substring(0, 1000)
          });
        }
      }

      // Check for SendMessage tool_use in assistant messages
      for (const tool of event.toolUse || []) {
        if (tool.name === 'SendMessage' && tool.input) {
          communications.push({
            timestamp: event.timestamp,
            from: event.agentId,
            to: tool.input.recipient || 'unknown',
            content: {
              type: tool.input.type || 'message',
              text: tool.input.content || '',
              summary: tool.input.summary || ''
            },
            messageType: tool.input.type || 'message',
            raw: (tool.input.content || '').substring(0, 1000)
          });
        }
      }
    }

    communications.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return communications;
  }

  extractTasks(events) {
    const tasks = [];
    const taskMap = new Map();

    for (const event of events) {
      for (const tool of event.toolUse || []) {
        if (tool.name === 'TaskCreate' && tool.input) {
          const task = {
            id: null, // Will be set from tool result
            subject: tool.input.subject,
            description: tool.input.description,
            activeForm: tool.input.activeForm,
            createdBy: event.agentId,
            createdAt: event.timestamp,
            updates: []
          };
          tasks.push(task);
        }

        if (tool.name === 'TaskUpdate' && tool.input) {
          const update = {
            taskId: tool.input.taskId,
            status: tool.input.status,
            owner: tool.input.owner,
            updatedBy: event.agentId,
            updatedAt: event.timestamp,
            subject: tool.input.subject
          };

          // Find matching task and add update
          const existingTask = tasks.find(t =>
            t.id === tool.input.taskId ||
            (!t.id && tasks.indexOf(t).toString() === tool.input.taskId)
          );

          if (existingTask) {
            existingTask.updates.push(update);
            if (tool.input.status) existingTask.latestStatus = tool.input.status;
            if (tool.input.owner) existingTask.owner = tool.input.owner;
          } else {
            tasks.push({
              id: tool.input.taskId,
              subject: tool.input.subject || `Task #${tool.input.taskId}`,
              createdBy: 'unknown',
              createdAt: event.timestamp,
              latestStatus: tool.input.status,
              owner: tool.input.owner,
              updates: [update]
            });
          }
        }
      }
    }

    return tasks;
  }

  countToolsUsed(events) {
    const toolCounts = {};
    for (const event of events) {
      for (const tool of event.toolUse || []) {
        toolCounts[tool.name] = (toolCounts[tool.name] || 0) + 1;
      }
    }
    return toolCounts;
  }

  calculateSessionStats(events, agents) {
    const totalEvents = events.length;
    const userEvents = events.filter(e => e.type === 'user').length;
    const assistantEvents = events.filter(e => e.type === 'assistant').length;
    const toolUsages = events.reduce((sum, e) => sum + (e.toolUse?.length || 0), 0);

    const toolBreakdown = {};
    for (const event of events) {
      for (const tool of event.toolUse || []) {
        toolBreakdown[tool.name] = (toolBreakdown[tool.name] || 0) + 1;
      }
    }

    return {
      totalEvents,
      userEvents,
      assistantEvents,
      toolUsages,
      agentCount: agents.size,
      toolBreakdown
    };
  }

  setupWebServer() {
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      if (req.method === 'OPTIONS') return res.sendStatus(200);
      next();
    });

    this.app.use(express.static(path.join(__dirname, 'teams-dashboard-web')));

    // List all team sessions (lightweight)
    this.app.get('/api/sessions', async (req, res) => {
      try {
        this.sessions = await this.discoverTeamSessions();
        res.json({
          sessions: this.sessions.map(s => ({
            id: s.id,
            projectName: s.projectName,
            agentCount: s.agentCount,
            startTime: s.startTime,
            endTime: s.endTime,
            duration: s.duration,
            gitBranch: s.gitBranch,
            teammateNames: s.teammateNames
          })),
          count: this.sessions.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load sessions' });
      }
    });

    // Global summary stats
    this.app.get('/api/summary', async (req, res) => {
      try {
        res.json({
          totalSessions: this.sessions.length,
          totalAgents: this.sessions.reduce((sum, s) => sum + s.agentCount, 0),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load summary' });
      }
    });

    // Full session detail (triggers parse)
    this.app.get('/api/sessions/:id', async (req, res) => {
      try {
        const session = await this.parseFullSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        res.json({
          id: session.id,
          projectName: session.projectName,
          gitBranch: session.gitBranch,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          agents: session.agents,
          teammateNames: session.teammateNames,
          stats: session.stats
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load session' });
      }
    });

    // Timeline (paginated)
    this.app.get('/api/sessions/:id/timeline', async (req, res) => {
      try {
        const session = await this.parseFullSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const page = parseInt(req.query.page) || 0;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const start = page * pageSize;
        const events = session.events.slice(start, start + pageSize);

        res.json({
          events,
          total: session.events.length,
          page,
          pageSize,
          hasMore: start + pageSize < session.events.length
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load timeline' });
      }
    });

    // Communications
    this.app.get('/api/sessions/:id/communications', async (req, res) => {
      try {
        const session = await this.parseFullSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        res.json({
          communications: session.communications,
          count: session.communications.length
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load communications' });
      }
    });

    // Tasks
    this.app.get('/api/sessions/:id/tasks', async (req, res) => {
      try {
        const session = await this.parseFullSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        res.json({
          tasks: session.tasks,
          count: session.tasks.length
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load tasks' });
      }
    });

    // Single teammate detail
    this.app.get('/api/sessions/:id/teammates/:agentId', async (req, res) => {
      try {
        const session = await this.parseFullSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const agent = session.agents[req.params.agentId];
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        // Get agent-specific events
        const agentEvents = session.events
          .filter(e => e.agentId === req.params.agentId)
          .slice(0, 100);

        res.json({
          ...agent,
          recentEvents: agentEvents
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load teammate' });
      }
    });

    // Main route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'teams-dashboard-web', 'index.html'));
    });
  }

  async startServer() {
    return new Promise((resolve) => {
      this.httpServer = this.app.listen(this.port, async () => {
        console.log(chalk.green(`Teams dashboard started at http://localhost:${this.port}`));
        resolve();
      });
    });
  }

  async openBrowser() {
    const url = `http://localhost:${this.port}`;
    console.log(chalk.blue('Opening browser to Teams Dashboard...'));
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
    console.log(chalk.yellow('Teams dashboard stopped'));
  }
}

async function runTeamsDashboard(options = {}) {
  console.log(chalk.blue('Starting Agent Teams Dashboard...'));

  const dashboard = new TeamsDashboard(options);

  try {
    await dashboard.initialize();
    await dashboard.startServer();
    await dashboard.openBrowser();

    console.log(chalk.green('Teams dashboard is running!'));
    console.log(chalk.cyan(`Access at: http://localhost:${dashboard.port}`));
    console.log(chalk.gray('Press Ctrl+C to stop the server'));

    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nShutting down teams dashboard...'));
      dashboard.stop();
      process.exit(0);
    });

    await new Promise(() => {});
  } catch (error) {
    console.error(chalk.red('Failed to start teams dashboard:'), error.message);
    process.exit(1);
  }
}

module.exports = {
  runTeamsDashboard,
  TeamsDashboard
};
