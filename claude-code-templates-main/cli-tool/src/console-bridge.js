const chalk = require('chalk');
const { spawn, exec } = require('child_process');
const WebSocket = require('ws');
const EventEmitter = require('events');
const fs = require('fs');

/**
 * ConsoleBridge - Bridges Claude Code console interactions with WebSocket
 * Intercepts stdin/stdout to enable web-based interactions
 */
class ConsoleBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      port: options.port || 3334,
      debug: options.debug || false,
      ...options
    };
    
    this.wss = null;
    this.clients = new Set();
    this.currentInteraction = null;
    this.interactionQueue = [];
    this.isProcessingInteraction = false;
    
    // Pattern recognition for Claude Code prompts
    this.promptPatterns = [
      /Do you want to proceed\?/,
      /\s*❯\s*1\.\s*Yes/,
      /\s*2\.\s*Yes,\s*and\s*(add|don't ask)/,
      /\s*3\.\s*No,\s*and\s*tell\s*Claude/,
      /Choose an option \(1-\d+\):/,
      /Enter your choice:/,
      /Please provide input:/
    ];
    
    // Track multi-line prompt building
    this.promptBuffer = [];
    this.isCapturingPrompt = false;
    this.promptTimeout = null;
  }

  /**
   * Initialize the console bridge
   */
  async initialize() {
    console.log(chalk.blue('🌉 Initializing Console Bridge...'));
    
    try {
      await this.setupWebSocketServer();
      this.setupProcessMonitoring();
      
      console.log(chalk.green('✅ Console Bridge initialized successfully'));
      console.log(chalk.cyan(`🔌 WebSocket server running on port ${this.options.port}`));
      
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Console Bridge:'), error);
      return false;
    }
  }

  /**
   * Setup WebSocket server for web interface communication
   */
  async setupWebSocketServer() {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocket.Server({ 
        port: this.options.port,
        host: 'localhost'
      });

      this.wss.on('connection', (ws) => {
        console.log(chalk.blue('🔌 Web interface connected to Console Bridge'));
        this.clients.add(ws);
        
        // Send current interaction if any
        if (this.currentInteraction) {
          ws.send(JSON.stringify({
            type: 'console_interaction',
            data: this.currentInteraction
          }));
        }

        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message);
            this.handleWebMessage(data);
          } catch (error) {
            console.error(chalk.red('❌ Invalid message from web interface:'), error);
          }
        });

        ws.on('close', () => {
          console.log(chalk.yellow('🔌 Web interface disconnected from Console Bridge'));
          this.clients.delete(ws);
        });

        ws.on('error', (error) => {
          console.error(chalk.red('❌ WebSocket error:'), error);
          this.clients.delete(ws);
        });
      });

      this.wss.on('listening', resolve);
      this.wss.on('error', reject);
    });
  }

  /**
   * Setup monitoring of Claude Code processes
   */
  setupProcessMonitoring() {
    // Monitor for new Claude Code processes
    setInterval(() => {
      this.scanForClaudeProcesses();
    }, 5000);

    // Initial scan
    this.scanForClaudeProcesses();
  }

  /**
   * Scan for running Claude Code processes
   */
  async scanForClaudeProcesses() {
    try {
      const { exec } = require('child_process');
      
      exec('ps aux | grep -E "claude[^-]|Claude" | grep -v grep', (error, stdout) => {
        if (error) return;
        
        const processes = stdout.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              pid: parts[1],
              command: parts.slice(10).join(' '),
              user: parts[0]
            };
          })
          .filter(proc => 
            proc.command.includes('claude') && 
            !proc.command.includes('claude-code-templates') &&
            !proc.command.includes('grep')
          );

        if (processes.length > 0) {
          this.debug('Found Claude processes:', processes);
          
          // Attempt to attach to the most likely Claude Code process
          const claudeProcess = processes.find(p => 
            p.command.includes('claude') && 
            !p.command.includes('Helper') &&
            !p.command.includes('.app')
          );
          
          if (claudeProcess && claudeProcess.pid !== this.attachedPid) {
            this.attemptProcessAttachment(claudeProcess.pid);
          }
        }
      });
    } catch (error) {
      this.debug('Error scanning for Claude processes:', error);
    }
  }

  /**
   * Attempt to attach to a Claude Code process
   */
  async attemptProcessAttachment(pid) {
    try {
      this.debug(`Attempting to attach to Claude process ${pid}`);
      
      // Get terminal device for this process
      const terminalInfo = await this.getProcessTerminal(pid);
      if (!terminalInfo) {
        console.warn(chalk.yellow(`⚠️ Could not determine terminal for process ${pid}`));
        return;
      }
      
      this.attachedPid = pid;
      this.terminalDevice = terminalInfo.tty;
      
      console.log(chalk.green(`✅ Attached to Claude Code process ${pid} on ${terminalInfo.tty}`));
      
      // Start monitoring terminal output
      await this.startTerminalMonitoring(terminalInfo.tty);
      
      // For development, also simulate some prompts
      this.simulatePromptDetection();
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to attach to process ${pid}:`), error);
    }
  }

  /**
   * Get terminal device information for a process
   * @param {string} pid - Process ID
   * @returns {Promise<Object|null>} Terminal information
   */
  async getProcessTerminal(pid) {
    return new Promise((resolve) => {
      exec(`lsof -p ${pid} | grep -E "(tty|pts)" | head -1`, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null);
          return;
        }
        
        const parts = stdout.trim().split(/\s+/);
        const ttyPath = parts[parts.length - 1]; // Last part is the device path
        
        if (ttyPath.startsWith('/dev/')) {
          resolve({
            tty: ttyPath,
            pid: pid
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Start monitoring terminal output for prompts
   * @param {string} ttyPath - Path to terminal device
   */
  async startTerminalMonitoring(ttyPath) {
    try {
      console.log(chalk.blue(`📡 Starting terminal monitoring for ${ttyPath}`));
      
      // Use script command to capture terminal output
      // This creates a typescript of the terminal session
      const logFile = `/tmp/claude-terminal-${this.attachedPid}.log`;
      
      // Monitor using tail -f approach on the terminal device (if readable)
      this.startTerminalPolling(ttyPath, logFile);
      
    } catch (error) {
      console.error(chalk.red('❌ Error starting terminal monitoring:'), error);
    }
  }

  /**
   * Poll terminal for new output
   * @param {string} ttyPath - Terminal device path
   * @param {string} logFile - Log file path
   */
  startTerminalPolling(ttyPath, logFile) {
    // Try to read directly from terminal device (may need permissions)
    if (this.terminalPollingInterval) {
      clearInterval(this.terminalPollingInterval);
    }
    
    let lastPosition = 0;
    let outputBuffer = '';
    
    this.terminalPollingInterval = setInterval(async () => {
      try {
        // Try to read the screen content using a more accessible approach
        // Use script to capture current terminal state
        exec(`script -q /dev/null tail -n 50 ${ttyPath}`, { timeout: 1000 }, (error, stdout, stderr) => {
          if (!error && stdout) {
            // Look for prompt patterns in the output
            this.analyzeTerminalOutput(stdout);
          }
        });
        
        // Alternative: monitor process output through ps
        this.monitorProcessStatus();
        
      } catch (error) {
        this.debug('Terminal polling error:', error.message);
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Monitor the Claude Code process status for changes
   */
  monitorProcessStatus() {
    if (!this.attachedPid) return;
    
    exec(`ps -p ${this.attachedPid} -o state,time,command`, (error, stdout) => {
      if (error) {
        // Process might have ended
        console.log(chalk.yellow('🔄 Monitored Claude Code process ended'));
        this.attachedPid = null;
        return;
      }
      
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) {
        const processLine = lines[1];
        const state = processLine.split(/\s+/)[0];
        
        // Check if process is waiting for input (state: T, S+)
        if (state.includes('T') || state.includes('S+')) {
          this.debug('Process appears to be waiting for input');
          // This might indicate a prompt is active
        }
      }
    });
  }

  /**
   * Analyze terminal output for prompts
   * @param {string} output - Terminal output to analyze
   */
  analyzeTerminalOutput(output) {
    const lines = output.split('\n');
    const recentLines = lines.slice(-10); // Last 10 lines
    const fullText = recentLines.join('\n');
    
    // Check for Claude Code prompt patterns
    for (const pattern of this.promptPatterns) {
      if (pattern.test(fullText)) {
        console.log(chalk.yellow('🎯 Potential prompt detected in terminal output!'));
        console.log(chalk.gray('Lines:', recentLines.slice(-5).join(' | ')));
        
        // Try to extract and parse the prompt
        this.handleDetectedPrompt(fullText);
        break;
      }
    }
  }

  /**
   * Simulate prompt detection (placeholder for actual implementation)
   * In reality, this would intercept actual Claude Code output
   */
  simulatePromptDetection() {
    // This is a simulation - in reality we'd parse actual output
    setTimeout(() => {
      if (Math.random() > 0.7) { // Simulate occasional prompts
        this.handleDetectedPrompt(`Read file

  Search(pattern: "(?:Yes|No|yes|no)(?:,\\s*and\\s*don't\\s*ask\\s*again)?", path:
  "../../../../../../../.claude/projects/-Users-username-Projects-project-name", include: "*.jsonl")

Do you want to proceed?
❯ 1. Yes
  2. Yes, and add ~/.claude/projects/-Users-username-Projects-project-name as a working directory for this session
  3. No, and tell Claude what to do differently (esc)`);
      }
      
      // Continue simulation
      setTimeout(() => this.simulatePromptDetection(), 10000 + Math.random() * 20000);
    }, 5000);
  }

  /**
   * Handle detected prompt from Claude Code
   */
  handleDetectedPrompt(promptText) {
    //console.log(chalk.yellow('🤖 Claude Code prompt detected:'));
    //console.log(chalk.gray(promptText));
    
    const interaction = this.parsePrompt(promptText);
    
    if (interaction) {
      this.currentInteraction = {
        ...interaction,
        id: 'claude-prompt-' + Date.now(),
        timestamp: new Date().toISOString()
      };
      
      // Send to web interface
      this.broadcastToClients({
        type: 'console_interaction',
        data: this.currentInteraction
      });
      
      //console.log(chalk.blue('📡 Sent prompt to web interface'));
    }
  }

  /**
   * Parse Claude Code prompt text into structured interaction
   */
  parsePrompt(promptText) {
    const lines = promptText.split('\n').map(line => line.trim());
    
    // Look for the main prompt question
    const promptLine = lines.find(line => 
      line.includes('Do you want to proceed?') ||
      line.includes('Choose an option') ||
      line.includes('Enter your choice') ||
      line.includes('Please provide input')
    );
    
    if (!promptLine) return null;
    
    // Look for numbered options
    const optionLines = lines.filter(line => 
      /^\s*❯?\s*\d+\.\s*/.test(line) || 
      /^\s*\d+\.\s*/.test(line)
    );
    
    if (optionLines.length > 0) {
      // Choice-based prompt
      const options = optionLines.map(line => 
        line.replace(/^\s*❯?\s*\d+\.\s*/, '').trim()
      );
      
      // Extract tool description (usually the first few lines)
      const descriptionLines = lines.slice(0, lines.indexOf(lines.find(l => l.includes('Do you want'))) || 3);
      const description = descriptionLines.join('\n').trim();
      
      return {
        type: 'choice',
        tool: this.extractToolName(description),
        description,
        prompt: promptLine,
        options
      };
    } else {
      // Text input prompt
      return {
        type: 'text',
        tool: 'Console Input',
        description: lines.slice(0, -1).join('\n').trim(),
        prompt: promptLine
      };
    }
  }

  /**
   * Extract tool name from description
   */
  extractToolName(description) {
    const toolMatch = description.match(/^([A-Za-z]+)(\(|$)/);
    return toolMatch ? toolMatch[1] : 'Tool';
  }

  /**
   * Handle message from web interface
   */
  handleWebMessage(data) {
    if (data.type === 'console_response' && this.currentInteraction) {
      console.log(chalk.green('📱 Received response from web interface:'), data.data);
      
      // In a real implementation, this would send the response to Claude Code
      this.sendResponseToClaudeCode(data.data);
      
      this.currentInteraction = null;
    }
  }

  /**
   * Send response back to Claude Code process
   * This attempts to write directly to the terminal device
   */
  sendResponseToClaudeCode(response) {
    console.log(chalk.blue('🔄 Sending response to Claude Code...'));
    
    if (!this.attachedPid || !this.terminalDevice) {
      console.warn(chalk.yellow('⚠️ No attached process - falling back to simulation'));
      this.simulateResponse(response);
      return;
    }
    
    if (response.type === 'choice') {
      // Send the choice number (1-indexed)
      const choiceNumber = response.value + 1;
      console.log(chalk.green(`✅ Choice selected: ${choiceNumber} - ${response.text}`));
      
      this.writeToTerminal(choiceNumber.toString() + '\n');
      
    } else if (response.type === 'text') {
      console.log(chalk.green(`✅ Text input: "${response.value}"`));
      
      this.writeToTerminal(response.value + '\n');
      
    } else if (response.type === 'cancel') {
      console.log(chalk.yellow('🚫 User cancelled interaction'));
      
      // Send ESC key or Ctrl+C
      this.writeToTerminal('\x1b'); // ESC key
    }
  }

  /**
   * Write text to the terminal device
   * @param {string} text - Text to write
   */
  writeToTerminal(text) {
    if (!this.terminalDevice) {
      console.warn(chalk.yellow('⚠️ No terminal device available'));
      return;
    }
    
    try {
      // Try different approaches to send input to the terminal
      
      // Method 1: Use expect script to send input
      const expectScript = `
        spawn -open [open ${this.terminalDevice} w]
        send "${text.replace(/"/g, '\\"')}"
        close
      `;
      
      exec(`expect -c '${expectScript}'`, (error, stdout, stderr) => {
        if (error) {
          console.log(chalk.yellow('⚠️ Expect method failed, trying alternative...'));
          this.tryAlternativeInput(text);
        } else {
          console.log(chalk.green('✅ Input sent via expect'));
        }
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Error writing to terminal:'), error);
      this.tryAlternativeInput(text);
    }
  }

  /**
   * Try alternative method to send input
   * @param {string} text - Text to send
   */
  tryAlternativeInput(text) {
    // Method 2: Try using osascript (AppleScript on macOS) to send keystrokes
    if (process.platform === 'darwin') {
      const script = `
        tell application "Terminal"
          do script "${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" in front window
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error) => {
        if (error) {
          console.log(chalk.yellow('⚠️ AppleScript method failed, falling back to simulation'));
          this.simulateResponse({ type: 'choice', value: parseInt(text) - 1, text: text.trim() });
        } else {
          console.log(chalk.green('✅ Input sent via AppleScript'));
        }
      });
    } else {
      // On Linux, try using xdotool or similar
      console.log(chalk.yellow('⚠️ Non-macOS platform - input simulation not implemented'));
      this.simulateResponse({ type: 'choice', value: parseInt(text) - 1, text: text.trim() });
    }
  }

  /**
   * Simulate response (fallback when real interaction fails)
   * @param {Object} response - Response object
   */
  simulateResponse(response) {
    if (response.type === 'choice') {
      const choiceNumber = response.value + 1;
      console.log(chalk.gray(`[Simulated] Sending "${choiceNumber}" to Claude Code stdin`));
    } else if (response.type === 'text') {
      console.log(chalk.gray(`[Simulated] Sending "${response.value}" to Claude Code stdin`));
    } else if (response.type === 'cancel') {
      console.log(chalk.gray('[Simulated] Sending ESC to Claude Code stdin'));
    }
  }

  /**
   * Broadcast message to all connected web clients
   */
  broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Debug logging
   */
  debug(...args) {
    if (this.options.debug) {
      console.log(chalk.gray('[ConsoleBridge Debug]'), ...args);
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    console.log(chalk.yellow('🛑 Shutting down Console Bridge...'));
    
    // Stop terminal monitoring
    if (this.terminalPollingInterval) {
      clearInterval(this.terminalPollingInterval);
      this.terminalPollingInterval = null;
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    this.clients.clear();
    this.attachedPid = null;
    this.terminalDevice = null;
    
    console.log(chalk.green('✅ Console Bridge shutdown complete'));
  }
}

module.exports = ConsoleBridge;