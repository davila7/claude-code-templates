const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const QRCode = require('qrcode');

/**
 * SessionSharing - Handles exporting and importing Claude Code sessions
 * Uses x0.at - a simple, reliable file hosting service
 */
class SessionSharing {
  constructor(conversationAnalyzer) {
    this.conversationAnalyzer = conversationAnalyzer;
    this.uploadService = 'x0.at';
    this.uploadUrl = 'https://x0.at';
  }

  /**
   * Export and share a conversation session
   * @param {string} conversationId - Conversation ID to share
   * @param {Object} conversationData - Full conversation data object
   * @param {Object} options - Share options (messageLimit, etc.)
   * @returns {Promise<Object>} Share result with URL, command, and QR code
   */
  async shareSession(conversationId, conversationData, options = {}) {
    console.log(chalk.blue(`📤 Preparing session ${conversationId} for sharing...`));

    try {
      // 1. Export session to structured JSON format
      const sessionExport = await this.exportSessionData(conversationId, conversationData, options);

      // 2. Upload to x0.at
      const uploadUrl = await this.uploadToX0(sessionExport, conversationId);

      // 3. Generate share command
      const shareCommand = `npx claude-code-templates@latest --clone-session "${uploadUrl}"`;

      // 4. Generate QR code
      const qrCode = await this.generateQRCode(shareCommand);

      console.log(chalk.green(`✅ Session shared successfully!`));
      console.log(chalk.cyan(`📋 Share command: ${shareCommand}`));
      console.log(chalk.gray(`🔗 Direct URL: ${uploadUrl}`));
      console.log(chalk.yellow(`⚠️  Files kept for 3-100 days (based on size)`));
      console.log(chalk.gray(`🔓 Note: Files are not encrypted by default`));

      return {
        success: true,
        uploadUrl,
        shareCommand,
        expiresIn: 'After first download',
        conversationId,
        qrCode,
        messageCount: sessionExport.conversation.messageCount,
        totalMessageCount: sessionExport.conversation.totalMessageCount,
        wasLimited: sessionExport.conversation.wasLimited
      };
    } catch (error) {
      console.error(chalk.red('❌ Failed to share session:'), error.message);
      throw error;
    }
  }

  /**
   * Export session data to standardized format
   * @param {string} conversationId - Conversation ID
   * @param {Object} conversationData - Conversation metadata
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Exported session object
   */
  async exportSessionData(conversationId, conversationData, options = {}) {
    // Get all messages from the conversation
    const allMessages = await this.conversationAnalyzer.getParsedConversation(conversationData.filePath);

    // Limit messages to avoid large file sizes (default: last 100 messages)
    const messageLimit = options.messageLimit || 100;
    const messages = allMessages.slice(-messageLimit);

    // Convert parsed messages back to JSONL format (original Claude Code format)
    const jsonlMessages = messages.map(msg => {
      // Reconstruct original JSONL entry format
      const entry = {
        uuid: msg.uuid || msg.id,
        type: msg.role === 'assistant' ? 'assistant' : 'user',
        timestamp: msg.timestamp.toISOString(),
        message: {
          id: msg.id,
          role: msg.role,
          content: msg.content
        }
      };

      // Add model info for assistant messages
      if (msg.model) {
        entry.message.model = msg.model;
      }

      // Add usage info
      if (msg.usage) {
        entry.message.usage = msg.usage;
      }

      // Add compact summary flag if present
      if (msg.isCompactSummary) {
        entry.isCompactSummary = true;
      }

      return entry;
    });

    // Create export package
    const exportData = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      conversation: {
        id: conversationId,
        project: conversationData.project || 'Unknown',
        created: conversationData.created,
        lastModified: conversationData.lastModified,
        messageCount: messages.length,
        totalMessageCount: allMessages.length,
        wasLimited: allMessages.length > messageLimit,
        tokens: conversationData.tokens,
        model: conversationData.modelInfo?.primaryModel || 'Unknown'
      },
      messages: jsonlMessages,
      metadata: {
        exportTool: 'claude-code-templates',
        exportVersion: require('../package.json').version || '1.0.0',
        messageLimit: messageLimit,
        description: 'Claude Code session export - can be cloned with: npx claude-code-templates@latest --clone-session <url>'
      }
    };

    // Log information about exported messages
    if (allMessages.length > messageLimit) {
      console.log(chalk.yellow(`⚠️  Session has ${allMessages.length} messages, exporting last ${messageLimit} messages`));
    } else {
      console.log(chalk.gray(`📊 Exporting ${messages.length} messages`));
    }

    return exportData;
  }

  /**
   * Upload session to x0.at
   * @param {Object} sessionData - Session export data
   * @param {string} conversationId - Conversation ID for filename
   * @returns {Promise<string>} Upload URL
   */
  async uploadToX0(sessionData, conversationId) {
    const tmpDir = path.join(os.tmpdir(), 'claude-code-sessions');
    await fs.ensureDir(tmpDir);

    const tmpFile = path.join(tmpDir, `session-${conversationId}.json`);

    try {
      // Write session data to temp file
      await fs.writeFile(tmpFile, JSON.stringify(sessionData, null, 2), 'utf8');

      console.log(chalk.gray(`📁 Created temp file: ${tmpFile}`));
      console.log(chalk.gray(`📤 Uploading to x0.at...`));

      // Upload to x0.at using curl with form data
      // x0.at API: curl -F'file=@yourfile.png' https://x0.at
      // Response: Direct URL in plain text
      const { stdout, stderr } = await execAsync(
        `curl -s -F "file=@${tmpFile}" ${this.uploadUrl}`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );

      // x0.at returns URL directly in plain text
      const uploadUrl = stdout.trim();

      // Validate response
      if (!uploadUrl || !uploadUrl.startsWith('http')) {
        throw new Error(`Invalid response from x0.at: ${uploadUrl || stderr}`);
      }

      console.log(chalk.green(`✅ Uploaded to x0.at successfully`));
      console.log(chalk.yellow(`⚠️  Files kept for 3-100 days (based on size)`));
      console.log(chalk.gray(`🔓 Note: Files are not encrypted by default`));

      // Clean up temp file
      await fs.remove(tmpFile);

      return uploadUrl;
    } catch (error) {
      // Clean up temp file on error
      await fs.remove(tmpFile).catch(() => {});
      throw error;
    }
  }

  /**
   * Clone a session from a shared URL
   * Downloads the session and places it in the correct Claude Code location
   * @param {string} url - URL to download session from
   * @param {Object} options - Clone options
   * @returns {Promise<Object>} Result with session path
   */
  async cloneSession(url, options = {}) {
    console.log(chalk.blue(`📥 Downloading session from ${url}...`));

    try {
      // 1. Download session data
      const sessionData = await this.downloadSession(url);

      // 2. Validate session data
      this.validateSessionData(sessionData);

      console.log(chalk.green(`✅ Session downloaded successfully`));
      console.log(chalk.gray(`📊 Project: ${sessionData.conversation.project}`));
      console.log(chalk.gray(`💬 Messages: ${sessionData.conversation.messageCount}`));
      console.log(chalk.gray(`🤖 Model: ${sessionData.conversation.model}`));

      // 3. Install session in Claude Code directory
      const installResult = await this.installSession(sessionData, options);

      console.log(chalk.green(`\n✅ Session installed successfully!`));
      console.log(chalk.cyan(`📂 Location: ${installResult.sessionPath}`));

      // Show resume command
      const resumeCommand = `claude --resume ${installResult.projectPath} ${installResult.conversationId}`;
      console.log(chalk.yellow(`\n💡 To continue this conversation, run:`));
      console.log(chalk.white(`\n   ${resumeCommand}\n`));
      console.log(chalk.gray(`   Or open Claude Code to see it in your sessions list`));

      return installResult;
    } catch (error) {
      console.error(chalk.red('❌ Failed to clone session:'), error.message);
      throw error;
    }
  }

  /**
   * Download session data from URL
   * @param {string} url - URL to download from
   * @returns {Promise<Object>} Session data
   */
  async downloadSession(url) {
    try {
      // Use curl to download (works with x0.at and other services)
      const { stdout, stderr } = await execAsync(`curl -L "${url}"`, {
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large sessions
      });

      if (stderr && !stdout) {
        throw new Error(`Download failed: ${stderr}`);
      }

      // Parse JSON response
      const sessionData = JSON.parse(stdout);
      return sessionData;
    } catch (error) {
      if (error.message.includes('Unexpected token')) {
        throw new Error('Invalid session file - corrupted or not a Claude Code session');
      }
      throw error;
    }
  }

  /**
   * Validate session data structure
   * @param {Object} sessionData - Session data to validate
   * @throws {Error} If validation fails
   */
  validateSessionData(sessionData) {
    if (!sessionData.version) {
      throw new Error('Invalid session file - missing version');
    }

    if (!sessionData.conversation || !sessionData.conversation.id) {
      throw new Error('Invalid session file - missing conversation data');
    }

    if (!sessionData.messages || !Array.isArray(sessionData.messages)) {
      throw new Error('Invalid session file - missing or invalid messages');
    }

    if (sessionData.messages.length === 0) {
      throw new Error('Invalid session file - no messages found');
    }
  }

  /**
   * Install session in Claude Code directory structure
   * @param {Object} sessionData - Session data to install
   * @param {Object} options - Installation options
   * @returns {Promise<Object>} Installation result
   */
  async installSession(sessionData, options = {}) {
    const homeDir = os.homedir();
    const claudeDir = path.join(homeDir, '.claude');

    // Determine project directory
    const projectName = sessionData.conversation.project || 'shared-session';
    const projectDirName = this.sanitizeProjectName(projectName);

    // Create project directory structure
    // Format: ~/.claude/projects/-path-to-project/
    const projectDir = path.join(claudeDir, 'projects', projectDirName);
    await fs.ensureDir(projectDir);

    // Generate conversation filename with original ID
    const conversationId = sessionData.conversation.id;
    const conversationFile = path.join(projectDir, `${conversationId}.jsonl`);

    // Convert messages back to JSONL format (one JSON object per line)
    const jsonlContent = sessionData.messages
      .map(msg => JSON.stringify(msg))
      .join('\n');

    // Write conversation file
    await fs.writeFile(conversationFile, jsonlContent, 'utf8');

    console.log(chalk.gray(`📝 Created conversation file: ${conversationFile}`));

    // Create or update settings.json
    const settingsFile = path.join(projectDir, 'settings.json');
    const settings = {
      projectName: sessionData.conversation.project,
      projectPath: options.projectPath || process.cwd(),
      sharedSession: true,
      originalExport: {
        exportedAt: sessionData.exported_at,
        exportTool: sessionData.metadata?.exportTool,
        exportVersion: sessionData.metadata?.exportVersion
      },
      importedAt: new Date().toISOString()
    };

    await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf8');

    console.log(chalk.gray(`⚙️  Created settings file: ${settingsFile}`));

    return {
      success: true,
      sessionPath: conversationFile,
      projectDir,
      projectPath: settings.projectPath,
      conversationId,
      messageCount: sessionData.messages.length
    };
  }

  /**
   * Generate QR code for share command
   * @param {string} command - Command to encode in QR
   * @returns {Promise<Object>} QR code data (Data URL for web display)
   */
  async generateQRCode(command) {
    try {
      // Generate QR code as Data URL (for web display)
      const qrDataUrl = await QRCode.toDataURL(command, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return {
        dataUrl: qrDataUrl,
        command: command
      };
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not generate QR code:'), error.message);
      return {
        dataUrl: null,
        command: command
      };
    }
  }

  /**
   * Sanitize project name for directory usage
   * @param {string} projectName - Original project name
   * @returns {string} Sanitized name
   */
  sanitizeProjectName(projectName) {
    // Replace spaces and special chars with hyphens
    return projectName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
  }
}

module.exports = SessionSharing;
