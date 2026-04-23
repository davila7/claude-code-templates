/**
 * AgentAnalyzer - Analyzes Claude Code specialized agent usage patterns
 * Extracts agent invocation data, usage frequency, and workflow patterns
 */
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

class AgentAnalyzer {
  constructor() {
    // Known Claude Code specialized agents
    this.AGENT_TYPES = {
      'general-purpose': {
        name: 'General Purpose',
        description: 'Multi-step tasks and research',
        color: '#3fb950',
        icon: '🔧'
      },
      'claude-code-best-practices': {
        name: 'Claude Code Best Practices',
        description: 'Workflow optimization and setup guidance',
        color: '#f97316',
        icon: '⚡'
      },
      'docusaurus-expert': {
        name: 'Docusaurus Expert',
        description: 'Documentation site management',
        color: '#0969da',
        icon: '📚'
      }
    };
  }

  /**
   * Analyze agent usage across all conversations
   * @param {Array} conversations - Array of conversation objects with parsed messages
   * @param {Object} dateRange - Optional date range filter
   * @returns {Object} Agent usage analysis
   */
  async analyzeAgentUsage(conversations, dateRange = null) {
    const agentStats = {};
    const agentTimeline = [];
    const agentWorkflows = {};
    let totalAgentInvocations = 0;
    const conversationsWithAgents = new Set();
    const pendingTaskIds = new Map();
    let agentSuccesses = 0;
    let agentFailures = 0;
    let executionToolCalls = 0;
    const EXECUTION_TOOLS = ['Edit', 'Write', 'Bash'];
    const conversationAgentTypes = new Map();
    const conversationMsgCounts = new Map();

    for (const conversation of conversations) {
      // Parse messages from JSONL file if not already parsed
      let messages = conversation.parsedMessages;
      if (!messages && conversation.filePath) {
        messages = await this.parseJsonlFile(conversation.filePath);
      }
      
      if (!messages) continue;

      messages.forEach(message => {
        // Skip if outside date range
        if (dateRange && !this.isWithinDateRange(message.timestamp, dateRange)) {
          return;
        }

        // Look for Task tool usage with subagent_type
        // Handle both direct message structure and nested message structure
        const messageContent = message.message ? message.message.content : message.content;
        const messageRole = message.message ? message.message.role : message.role;

        // Track per-conversation message counts for autonomy metric
        if (!conversationMsgCounts.has(conversation.id)) {
          conversationMsgCounts.set(conversation.id, { assistant: 0, user: 0 });
        }
        const convCounts = conversationMsgCounts.get(conversation.id);
        if (messageRole === 'assistant') convCounts.assistant++;
        if (messageRole === 'user') convCounts.user++;

        // Check for tool_result blocks to track agent success/failure
        if (messageContent && Array.isArray(messageContent)) {
          messageContent.forEach(content => {
            if (content.type === 'tool_result' && pendingTaskIds.has(content.tool_use_id)) {
              if (content.is_error === true) {
                agentFailures++;
              } else {
                agentSuccesses++;
              }
              pendingTaskIds.delete(content.tool_use_id);
            }
          });
        }

        if (messageRole === 'assistant' &&
            messageContent &&
            Array.isArray(messageContent)) {
          // Count execution tool calls (Edit, Write, Bash) by orchestrator
          messageContent.forEach(content => {
            if (content.type === 'tool_use' && EXECUTION_TOOLS.includes(content.name)) {
              executionToolCalls++;
            }
          });
          
          messageContent.forEach(content => {
            if (content.type === 'tool_use' &&
                (content.name === 'Task' || content.name === 'Agent') &&
                content.input &&
                content.input.subagent_type) {
              
              const agentType = content.input.subagent_type;
              const timestamp = new Date(message.timestamp);
              const prompt = content.input.prompt || content.input.description || 'No description';

              // Track tool_use_id for success/failure matching
              if (content.id) {
                pendingTaskIds.set(content.id, agentType);
              }

              conversationsWithAgents.add(conversation.id);

              // Track agent types per conversation for orchestration metric
              if (!conversationAgentTypes.has(conversation.id)) {
                conversationAgentTypes.set(conversation.id, new Set());
              }
              conversationAgentTypes.get(conversation.id).add(agentType);
              
              // Initialize agent stats
              if (!agentStats[agentType]) {
                agentStats[agentType] = {
                  type: agentType,
                  name: this.AGENT_TYPES[agentType]?.name || agentType,
                  description: this.AGENT_TYPES[agentType]?.description || 'Custom agent',
                  color: this.AGENT_TYPES[agentType]?.color || '#8b5cf6',
                  icon: this.AGENT_TYPES[agentType]?.icon || '🤖',
                  totalInvocations: 0,
                  uniqueConversations: new Set(),
                  firstUsed: timestamp,
                  lastUsed: timestamp,
                  prompts: [],
                  hourlyDistribution: new Array(24).fill(0),
                  dailyUsage: {}
                };
              }

              const stats = agentStats[agentType];
              
              // Update stats
              stats.totalInvocations++;
              stats.uniqueConversations.add(conversation.id);
              stats.lastUsed = new Date(Math.max(stats.lastUsed, timestamp));
              stats.firstUsed = new Date(Math.min(stats.firstUsed, timestamp));
              
              // Store prompt for analysis
              stats.prompts.push({
                text: prompt,
                timestamp: timestamp,
                conversationId: conversation.id
              });
              
              // Track hourly distribution
              const hour = timestamp.getHours();
              stats.hourlyDistribution[hour]++;
              
              // Track daily usage
              const dateKey = timestamp.toISOString().split('T')[0];
              stats.dailyUsage[dateKey] = (stats.dailyUsage[dateKey] || 0) + 1;
              
              // Add to timeline
              agentTimeline.push({
                timestamp: timestamp,
                agentType: agentType,
                agentName: stats.name,
                prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
                conversationId: conversation.id,
                color: stats.color,
                icon: stats.icon
              });
              
              totalAgentInvocations++;
            }
          });
        }
      });
    }

    // Count execution tool calls inside subagent JSONL files
    let delegatedExecutionCalls = 0;
    for (const conversation of conversations) {
      if (!conversation.filePath) continue;
      const convId = path.basename(conversation.filePath, '.jsonl');
      const subagentDir = path.join(path.dirname(conversation.filePath), convId, 'subagents');
      try {
        if (!await fs.pathExists(subagentDir)) continue;
        const subFiles = (await fs.readdir(subagentDir)).filter(f => f.endsWith('.jsonl'));
        for (const subFile of subFiles) {
          const subMessages = await this.parseJsonlFile(path.join(subagentDir, subFile));
          if (!subMessages) continue;
          for (const msg of subMessages) {
            // Apply same dateRange filter as main conversation messages
            if (dateRange && !this.isWithinDateRange(msg.timestamp, dateRange)) continue;
            const content = msg.message ? msg.message.content : msg.content;
            const role = msg.message ? msg.message.role : msg.role;
            if (role === 'assistant' && content && Array.isArray(content)) {
              for (const block of content) {
                if (block.type === 'tool_use' && EXECUTION_TOOLS.includes(block.name)) {
                  delegatedExecutionCalls++;
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip inaccessible subagent directories
      }
    }

    // Convert Sets to counts and finalize stats
    Object.keys(agentStats).forEach(agentType => {
      const stats = agentStats[agentType];
      stats.uniqueConversations = stats.uniqueConversations.size;
      stats.averageUsagePerConversation = stats.uniqueConversations > 0 ? 
        (stats.totalInvocations / stats.uniqueConversations).toFixed(1) : 0;
    });

    // Sort timeline by timestamp
    agentTimeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Calculate agent workflows (sequences of agent usage)
    const workflowPatterns = this.analyzeAgentWorkflows(agentTimeline);

    return {
      totalAgentInvocations,
      totalAgentTypes: Object.keys(agentStats).length,
      agentStats: Object.values(agentStats).sort((a, b) => b.totalInvocations - a.totalInvocations),
      agentTimeline,
      workflowPatterns,
      popularHours: this.calculatePopularHours(agentStats),
      usageByDay: this.calculateDailyUsage(agentStats),
      efficiency: this.calculateAgentEfficiency(agentStats, {
        totalConversations: conversations.length,
        conversationsWithAgents: conversationsWithAgents.size,
        agentSuccesses,
        agentFailures,
        executionToolCalls,
        delegatedExecutionCalls,
        totalAgentInvocations,
        conversationAgentTypes,
        conversationMsgCounts,
        conversationsWithAgentsSet: conversationsWithAgents
      })
    };
  }

  /**
   * Analyze agent workflow patterns
   * @param {Array} timeline - Chronological agent invocations
   * @returns {Object} Workflow patterns
   */
  analyzeAgentWorkflows(timeline) {
    const workflows = {};
    const SESSION_GAP_MINUTES = 30; // Minutes between workflow sessions

    let currentWorkflow = [];
    let lastTimestamp = null;

    timeline.forEach(event => {
      const currentTime = new Date(event.timestamp);
      
      // Start new workflow if gap is too large or first event
      if (!lastTimestamp || 
          (currentTime - lastTimestamp) > (SESSION_GAP_MINUTES * 60 * 1000)) {
        
        // Save previous workflow if it had multiple agents
        if (currentWorkflow.length > 1) {
          const workflowKey = currentWorkflow.map(e => e.agentType).join(' → ');
          workflows[workflowKey] = (workflows[workflowKey] || 0) + 1;
        }
        
        currentWorkflow = [event];
      } else {
        currentWorkflow.push(event);
      }
      
      lastTimestamp = currentTime;
    });

    // Don't forget the last workflow
    if (currentWorkflow.length > 1) {
      const workflowKey = currentWorkflow.map(e => e.agentType).join(' → ');
      workflows[workflowKey] = (workflows[workflowKey] || 0) + 1;
    }

    // Convert to sorted array
    return Object.entries(workflows)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 workflows
  }

  /**
   * Calculate popular usage hours across all agents
   * @param {Object} agentStats - Agent statistics
   * @returns {Array} Hour usage data
   */
  calculatePopularHours(agentStats) {
    const hourlyTotals = new Array(24).fill(0);
    
    Object.values(agentStats).forEach(stats => {
      stats.hourlyDistribution.forEach((count, hour) => {
        hourlyTotals[hour] += count;
      });
    });

    return hourlyTotals.map((count, hour) => ({
      hour,
      count,
      label: `${hour.toString().padStart(2, '0')}:00`
    }));
  }

  /**
   * Calculate daily usage across all agents
   * @param {Object} agentStats - Agent statistics
   * @returns {Array} Daily usage data
   */
  calculateDailyUsage(agentStats) {
    const dailyTotals = {};
    
    Object.values(agentStats).forEach(stats => {
      Object.entries(stats.dailyUsage).forEach(([date, count]) => {
        dailyTotals[date] = (dailyTotals[date] || 0) + count;
      });
    });

    return Object.entries(dailyTotals)
      .map(([date, count]) => ({
        date,
        count,
        timestamp: new Date(date)
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate agent efficiency metrics
   * @param {Object} agentStats - Agent statistics
   * @returns {Object} Efficiency metrics
   */
  calculateAgentEfficiency(agentStats, context = {}) {
    const agents = Object.values(agentStats);
    if (agents.length === 0) return {};

    const totalInvocations = agents.reduce((sum, agent) => sum + agent.totalInvocations, 0);
    const totalConversations = agents.reduce((sum, agent) => sum + agent.uniqueConversations, 0);

    const {
      agentSuccesses = 0,
      agentFailures = 0,
      executionToolCalls = 0,
      delegatedExecutionCalls = 0,
      totalAgentInvocations = 0,
      conversationAgentTypes = new Map(),
      conversationMsgCounts = new Map(),
      conversationsWithAgentsSet = new Set()
    } = context;

    // Delegation Rate: subagent execution calls / (subagent + orchestrator execution calls)
    // Measures how much execution work (Edit/Write/Bash) is delegated vs done directly
    const totalExecutionWork = delegatedExecutionCalls + executionToolCalls;
    const adoptionRate = totalExecutionWork > 0
      ? (delegatedExecutionCalls / totalExecutionWork * 100).toFixed(1)
      : '0.0';

    // Success Rate: % of agent invocations that completed without error
    const totalTracked = agentSuccesses + agentFailures;
    const successRate = totalTracked > 0
      ? (agentSuccesses / totalTracked * 100).toFixed(1)
      : '0.0';

    // Autonomy: assistant message ratio in agent-using conversations
    // Higher = less human intervention needed
    let agentConvAssistantMsgs = 0;
    let agentConvUserMsgs = 0;
    for (const convId of conversationsWithAgentsSet) {
      const counts = conversationMsgCounts.get(convId);
      if (counts) {
        agentConvAssistantMsgs += counts.assistant;
        agentConvUserMsgs += counts.user;
      }
    }
    const totalAgentConvMsgs = agentConvAssistantMsgs + agentConvUserMsgs;
    const timeEfficiency = totalAgentConvMsgs > 0
      ? (agentConvAssistantMsgs / totalAgentConvMsgs * 100).toFixed(1)
      : '0.0';

    // Orchestration: % of agent-using conversations with 2+ agent types
    let multiAgentConvs = 0;
    for (const [, types] of conversationAgentTypes) {
      if (types.size >= 2) multiAgentConvs++;
    }
    const workflowCompletion = conversationAgentTypes.size > 0
      ? (multiAgentConvs / conversationAgentTypes.size * 100).toFixed(1)
      : '0.0';

    return {
      averageInvocationsPerAgent: (totalInvocations / agents.length).toFixed(1),
      averageConversationsPerAgent: (totalConversations / agents.length).toFixed(1),
      mostUsedAgent: agents[0],
      agentDiversity: agents.length,
      adoptionRate,
      workflowCompletion,
      timeEfficiency,
      successRate
    };
  }

  /**
   * Parse JSONL file to extract messages
   * @param {string} filePath - Path to the JSONL file
   * @returns {Array} Array of parsed messages
   */
  async parseJsonlFile(filePath) {
    try {
      if (!await fs.pathExists(filePath)) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      return lines.map((line, index) => {
        try {
          // Skip empty or whitespace-only lines
          if (!line.trim()) {
            return null;
          }
          
          // Basic validation - must start with { and end with }
          const trimmed = line.trim();
          if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
            return null;
          }
          
          return JSON.parse(trimmed);
        } catch (error) {
          // Only log significant parsing errors to avoid spam from occasional corrupted lines
          if (index < 10 || index % 100 === 0) {
            console.warn(`Skipping corrupted JSONL line ${index + 1} in ${path.basename(filePath)}`);
          }
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.error(`Error reading JSONL file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Check if timestamp is within date range
   * @param {string|Date} timestamp - Message timestamp
   * @param {Object} dateRange - Date range with startDate and endDate
   * @returns {boolean} Whether timestamp is in range
   */
  isWithinDateRange(timestamp, dateRange) {
    if (!dateRange || (!dateRange.startDate && !dateRange.endDate)) return true;
    
    const messageDate = new Date(timestamp);
    const startDate = dateRange.startDate ? new Date(dateRange.startDate) : new Date(0);
    const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();
    
    return messageDate >= startDate && messageDate <= endDate;
  }

  /**
   * Generate agent usage summary for display
   * @param {Object} analysisResult - Result from analyzeAgentUsage
   * @returns {Object} Summary data
   */
  generateSummary(analysisResult) {
    const { totalAgentInvocations, totalAgentTypes, agentStats, efficiency } = analysisResult;
    
    return {
      totalInvocations: totalAgentInvocations,
      totalAgentTypes,
      topAgent: agentStats[0] || null,
      averageUsage: efficiency.averageInvocationsPerAgent,
      adoptionRate: efficiency.adoptionRate,
      summary: totalAgentInvocations > 0 ? 
        `${totalAgentInvocations} agent invocations across ${totalAgentTypes} different agents` :
        'No agent usage detected'
    };
  }
}

module.exports = AgentAnalyzer;