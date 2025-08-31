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
        
        if (messageRole === 'assistant' && 
            messageContent && 
            Array.isArray(messageContent)) {
          
          messageContent.forEach(content => {
            if (content.type === 'tool_use' && 
                content.name === 'Task' && 
                content.input && 
                content.input.subagent_type) {
              
              const agentType = content.input.subagent_type;
              const timestamp = new Date(message.timestamp);
              const prompt = content.input.prompt || content.input.description || 'No description';
              
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
      efficiency: this.calculateAgentEfficiency(agentStats)
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
  calculateAgentEfficiency(agentStats) {
    const agents = Object.values(agentStats);
    if (agents.length === 0) return {};

    const totalInvocations = agents.reduce((sum, agent) => sum + agent.totalInvocations, 0);
    const totalConversations = agents.reduce((sum, agent) => sum + agent.uniqueConversations, 0);

    return {
      averageInvocationsPerAgent: (totalInvocations / agents.length).toFixed(1),
      averageConversationsPerAgent: (totalConversations / agents.length).toFixed(1),
      mostUsedAgent: agents[0],
      agentDiversity: agents.length,
      adoptionRate: (agents.filter(a => a.totalInvocations > 1).length / agents.length * 100).toFixed(1)
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
          // Only log the error occasionally to avoid spam
          if (index % 10 === 0) {
            console.warn(`Error parsing JSONL line ${index + 1} in ${filePath}:`, error.message.substring(0, 100));
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