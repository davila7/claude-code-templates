/**
 * ToolDisplay - Dedicated component for displaying tool uses and results safely
 * Handles proper formatting, truncation, and escaping of tool content
 */
class ToolDisplay {
  constructor() {
    this.maxContentLength = 500;
    this.maxParamLength = 100;
  }

  /**
   * Render a tool use block
   * @param {Object} toolBlock - Tool use block
   * @param {Array} toolResults - Associated tool results (optional)
   * @returns {string} Safe HTML string
   */
  renderToolUse(toolBlock, toolResults = null) {
    const originalToolName = toolBlock.name || 'Unknown';
    const toolName = this.escapeHtml(originalToolName);
    const toolId = toolBlock.id ? toolBlock.id.slice(-8) : 'unknown';
    
    // Generate compact command representation
    const commandSummary = this.generateCompactCommand(toolName, toolBlock.input);
    
    // For ALL tools, ALWAYS add a "Show details" button
    const contentId = originalToolName.toLowerCase() + '_' + toolId + '_' + Date.now();
    
    // Try to find corresponding tool result in toolResults first
    let matchingResult = null;
    if (toolResults && Array.isArray(toolResults)) {
      matchingResult = toolResults.find(result => result.tool_use_id === toolBlock.id);
    }
    
    // Prepare comprehensive modal content for all tools (without tool results, as they're shown inline now)
    let modalContent = this.generateComprehensiveToolContent(toolName, toolBlock, null);
    
    // Store the tool content for modal display
    if (typeof window !== 'undefined') {
      window.storedContent = window.storedContent || {};
      window.storedContent[contentId] = modalContent;
      
      // Store tool data for all supported tools for custom modals
      const supportedTools = ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'TodoWrite'];
      if (supportedTools.includes(originalToolName)) {
        console.log(`🔧 ToolDisplay: Storing ${originalToolName} tool data for contentId:`, contentId);
        window.storedToolData = window.storedToolData || {};
        window.storedToolData[contentId] = {
          name: originalToolName,
          input: toolBlock.input || {},
          id: toolBlock.id,
          isToolDetails: true
        };
        console.log(`🔧 ToolDisplay: Stored tool data:`, window.storedToolData[contentId]);
      }
    }
    
    // Always show "Show details" for ALL tools
    const buttonClass = toolName === 'Bash' ? 'bash-cmd-btn' : 'tool-detail-btn';
    let showResultsButton = ` <button class="show-results-btn ${buttonClass}" data-content-id="${contentId}">Show details</button>`;
    
    let toolUseHtml = `
      <div class="terminal-tool tool-use compact">
        <span class="tool-command">${commandSummary}${showResultsButton}</span>
      </div>
    `;
    
    // Render associated tool results if they exist, with proper truncation
    if (matchingResult) {
      toolUseHtml += this.renderToolResultWithTruncation(matchingResult);
    }
    
    return toolUseHtml;
  }

  /**
   * Render a tool result block with truncation support
   * @param {Object} toolResultBlock - Tool result block
   * @returns {string} Safe HTML string
   */
  renderToolResultWithTruncation(toolResultBlock) {
    const toolId = toolResultBlock.tool_use_id ? toolResultBlock.tool_use_id.slice(-8) : 'unknown';
    const isError = toolResultBlock.is_error || false;
    
    // Generate enhanced result content with metadata
    const resultContent = this.generateEnhancedResultContent(toolResultBlock);
    const compactOutput = this.generateCompactOutput(resultContent, isError);
    
    return `
      <div class="terminal-tool tool-result compact ${isError ? 'error' : 'success'}" data-tool-use-id="${toolResultBlock.tool_use_id}">
        <span class="tool-prompt">⎿</span>
        <span class="tool-output-compact">${compactOutput}</span>
      </div>
    `;
  }

  /**
   * Render a tool result block (legacy method, kept for compatibility)
   * @param {Object} toolResultBlock - Tool result block
   * @returns {string} Safe HTML string
   */
  renderToolResult(toolResultBlock) {
    return this.renderToolResultWithTruncation(toolResultBlock);
  }

  /**
   * Generate enhanced result content including metadata
   * @param {Object} toolResultBlock - Tool result block
   * @returns {string} Enhanced result content
   */
  generateEnhancedResultContent(toolResultBlock) {
    let content = '';
    
    // Add return code interpretation if available
    if (toolResultBlock.returnCodeInterpretation && toolResultBlock.returnCodeInterpretation !== 'none') {
      content += `${toolResultBlock.returnCodeInterpretation}\n`;
    }
    
    // Add main content
    if (toolResultBlock.content) {
      if (content) content += '\n';
      content += toolResultBlock.content;
    }
    
    // Add stdout if different from content
    if (toolResultBlock.stdout && toolResultBlock.stdout !== toolResultBlock.content) {
      if (content) content += '\n';
      content += toolResultBlock.stdout;
    }
    
    // Add stderr if present
    if (toolResultBlock.stderr && toolResultBlock.stderr.trim()) {
      if (content) content += '\n';
      content += `stderr: ${toolResultBlock.stderr}`;
    }
    
    return content || '[Empty result]';
  }

  /**
   * Generate compact command representation for tool use
   * @param {string} toolName - Tool name
   * @param {Object} input - Tool input parameters
   * @returns {string} Compact command
   */
  generateCompactCommand(toolName, input) {
    if (!input || typeof input !== 'object') {
      return `${toolName}()`;
    }

    switch (toolName) {
      case 'Bash':
        if (input.command) {
          const command = this.escapeHtml(input.command);
          return `<span class="tool-name-bold">Bash </span>(${command})`;
        }
        break;
        
      case 'Read':
        if (input.file_path) {
          const fileName = input.file_path.split('/').pop();
          return `<span class="tool-name-bold">Read </span>(${this.escapeHtml(fileName)})`;
        }
        break;
        
      case 'Edit':
        if (input.file_path) {
          const fileName = input.file_path.split('/').pop();
          return `<span class="tool-name-bold">Edit </span>(${this.escapeHtml(fileName)})`;
        }
        break;
        
      case 'Write':
        if (input.file_path) {
          const fileName = input.file_path.split('/').pop();
          return `<span class="tool-name-bold">Write </span>(${this.escapeHtml(fileName)})`;
        }
        break;
        
      case 'Glob':
        if (input.pattern) {
          return `<span class="tool-name-bold">Glob </span>("${this.escapeHtml(input.pattern)}")`;
        }
        break;
        
      case 'Grep':
        if (input.pattern) {
          return `<span class="tool-name-bold">Grep </span>("${this.escapeHtml(input.pattern)}")`;
        }
        break;
        
      case 'TodoWrite':
        const todoCount = Array.isArray(input.todos) ? input.todos.length : 0;
        return `<span class="tool-name-bold">TodoWrite </span>(${todoCount} todos)`;
    }
    
    return `${toolName}()`;
  }

  /**
   * Generate compact output representation for tool results
   * @param {*} content - Tool result content
   * @param {boolean} _isError - Whether this is an error result (unused)
   * @returns {string} Compact output
   */
  generateCompactOutput(content, _isError) {
    if (typeof content === 'string') {
      // For JSON content, try to format it nicely
      if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(content);
          const formatted = JSON.stringify(parsed, null, 2);
          const lines = formatted.split('\n');
          if (lines.length > 5) {
            const preview = lines.slice(0, 5).join('\n');
            const remaining = lines.length - 5;
            const contentId = 'json_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
            
            if (typeof window !== 'undefined') {
              window.storedContent = window.storedContent || {};
              window.storedContent[contentId] = formatted;
            }
            
            return `<pre class="json-output">${this.escapeHtml(preview)}\n<span class="continuation">… +${remaining} lines hidden <button class="show-results-btn text-expand-btn" data-content-id="${contentId}">Show +${remaining} lines</button></span></pre>`;
          } else {
            return `<pre class="json-output">${this.escapeHtml(formatted)}</pre>`;
          }
        } catch (e) {
          // Fall through to regular text handling
        }
      }
      
      // For multi-line content, show first few lines with continuation
      const lines = content.split('\n');
      if (lines.length > 5) {
        const preview = lines.slice(0, 5).join('\n');
        const remaining = lines.length - 5;
        const contentId = 'content_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        
        // Store content in global storage without inline scripts
        if (typeof window !== 'undefined') {
          window.storedContent = window.storedContent || {};
          window.storedContent[contentId] = content;
        }
        
        return `<pre class="text-output">${this.escapeHtml(preview)}\n<span class="continuation">… +${remaining} lines hidden <button class="show-results-btn text-expand-btn" data-content-id="${contentId}">Show +${remaining} lines</button></span></pre>`;
      } else {
        return `<pre class="text-output">${this.escapeHtml(content)}</pre>`;
      }
    } else if (Array.isArray(content)) {
      return `<span class="array-output">[${content.length} items]</span>`;
    } else if (content && typeof content === 'object') {
      const keys = Object.keys(content);
      return `<span class="object-output">{${keys.length} properties}</span>`;
    }
    
    return '<span class="empty-output">[empty]</span>';
  }

  /**
   * Generate tool summary based on tool type
   * @param {string} toolName - Tool name
   * @param {Object} input - Tool input parameters
   * @returns {string} Tool summary
   */
  generateToolSummary(toolName, input) {
    if (!input || typeof input !== 'object') return '';

    switch (toolName) {
      case 'TodoWrite':
        const todoCount = Array.isArray(input.todos) ? input.todos.length : 0;
        return `${todoCount} todo${todoCount !== 1 ? 's' : ''}`;
        
      case 'Read':
        if (input.file_path) {
          const fileName = input.file_path.split('/').pop();
          return this.escapeHtml(fileName);
        }
        break;
        
      case 'Edit':
        if (input.file_path) {
          const fileName = input.file_path.split('/').pop();
          const changeSize = input.old_string ? input.old_string.length : 0;
          return `${this.escapeHtml(fileName)} (${changeSize}b)`;
        }
        break;
        
      case 'Bash':
        if (input.command) {
          const command = this.truncateText(input.command, 40);
          return `<span class="bash-command">${this.escapeHtml(command)}</span>`;
        }
        break;
        
      case 'Write':
        if (input.file_path) {
          const fileName = input.file_path.split('/').pop();
          const contentSize = input.content ? input.content.length : 0;
          return `${this.escapeHtml(fileName)} (${contentSize}b)`;
        }
        break;
        
      case 'Glob':
        if (input.pattern) {
          return `"${this.escapeHtml(input.pattern)}"`;
        }
        break;
        
      case 'Grep':
        if (input.pattern) {
          return `"${this.escapeHtml(input.pattern)}"`;
        }
        break;
    }
    
    return '';
  }


  /**
   * Format Bash command output with proper console styling
   * @param {string} content - Bash output content
   * @returns {string} Formatted HTML
   */
  formatBashOutput(content) {
    if (!content) return '';
    
    const lines = content.split('\n');
    const formattedLines = lines.map(line => {
      // Escape HTML first
      line = this.escapeHtml(line);
      
      // Highlight different types of output
      if (line.includes('Error:') || line.includes('ERROR') || line.includes('❌')) {
        return `<span class="console-error">${line}</span>`;
      } else if (line.includes('Warning:') || line.includes('WARN') || line.includes('⚠️')) {
        return `<span class="console-warning">${line}</span>`;
      } else if (line.includes('✅') || line.includes('SUCCESS')) {
        return `<span class="console-success">${line}</span>`;
      } else if (line.startsWith('>')) {
        return `<span class="console-command">${line}</span>`;
      } else if (line.includes('📊') || line.includes('🔧') || line.includes('⚡')) {
        return `<span class="console-info">${line}</span>`;
      } else {
        return `<span class="console-output">${line}</span>`;
      }
    });
    
    return formattedLines.join('<br>');
  }

  /**
   * Generate result preview
   * @param {*} content - Tool result content
   * @returns {string} Result preview
   */
  generateResultPreview(content) {
    if (typeof content === 'string') {
      if (content.length > 50) {
        const preview = this.truncateText(content, 50);
        return this.escapeHtml(preview);
      }
      return this.escapeHtml(content);
    } else if (Array.isArray(content)) {
      return `${content.length} items`;
    } else if (content && typeof content === 'object') {
      const keys = Object.keys(content);
      return `${keys.length} props`;
    }
    
    return '';
  }

  /**
   * Truncate text safely
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return String(text);
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Find tool result in globally stored messages
   * @param {string} toolUseId - Tool use ID to find result for
   * @returns {string|null} Tool result content if found
   */
  findToolResultInGlobalMessages(toolUseId) {
    // Try to find tool result in cached messages
    try {
      if (typeof window !== 'undefined' && window.currentMessages) {
        
        // First pass: Look for direct tool_result matches in any message
        for (let i = 0; i < window.currentMessages.length; i++) {
          const message = window.currentMessages[i];
          
          if (Array.isArray(message.content)) {
            for (let j = 0; j < message.content.length; j++) {
              const block = message.content[j];
              
              if (block.type === 'tool_result' && block.tool_use_id === toolUseId) {
                return block.content;
              }
            }
          }
        }
        
        // Second pass: Sequential search - look for tool_use then find matching tool_result
        let foundToolUse = false;
        let toolUseIndex = -1;
        
        for (let i = 0; i < window.currentMessages.length; i++) {
          const message = window.currentMessages[i];
          
          if (Array.isArray(message.content)) {
            for (const block of message.content) {
              if (block.type === 'tool_use' && block.id === toolUseId) {
                foundToolUse = true;
                toolUseIndex = i;
                break;
              }
            }
          }
          
          // If we found the tool_use, look for the result in subsequent messages
          if (foundToolUse) {
            for (let j = toolUseIndex; j < window.currentMessages.length; j++) {
              const laterMessage = window.currentMessages[j];
              if (Array.isArray(laterMessage.content)) {
                for (const laterBlock of laterMessage.content) {
                  if (laterBlock.type === 'tool_result' && laterBlock.tool_use_id === toolUseId) {
                    return laterBlock.content;
                  }
                }
              }
            }
            break; // Stop after finding tool_use and searching subsequent messages
          }
        }
      }
    } catch (error) {
      // Silently handle errors in tool result search
    }
    
    return null;
  }

  /**
   * Generate comprehensive tool content for modal display
   * @param {string} toolName - Name of the tool
   * @param {Object} toolBlock - Tool use block with input parameters
   * @param {string|null} resultContent - Tool result content if available
   * @returns {string} Comprehensive tool information for modal
   */
  generateComprehensiveToolContent(toolName, toolBlock, resultContent) {
    let content = `=== TOOL: ${toolName} ===\n\n`;
    
    // Tool ID and basic info
    content += `Tool ID: ${toolBlock.id || 'Unknown'}\n`;
    content += `Short ID: ${toolBlock.id ? toolBlock.id.slice(-8) : 'Unknown'}\n\n`;
    
    // Tool Input Parameters
    content += `--- INPUT PARAMETERS ---\n`;
    if (toolBlock.input && typeof toolBlock.input === 'object') {
      Object.entries(toolBlock.input).forEach(([key, value]) => {
        if (typeof value === 'string') {
          // For long strings, show preview + length
          if (value.length > 200) {
            content += `${key}: "${value.substring(0, 200)}..." [${value.length} characters total]\n`;
          } else {
            content += `${key}: "${value}"\n`;
          }
        } else {
          content += `${key}: ${JSON.stringify(value, null, 2)}\n`;
        }
      });
    } else {
      content += `No input parameters provided.\n`;
    }
    
    // Tool-specific details
    content += `\n--- TOOL DETAILS ---\n`;
    switch (toolName) {
      case 'Bash':
        content += `Command executed: ${toolBlock.input?.command || 'Unknown'}\n`;
        content += `Description: ${toolBlock.input?.description || 'No description provided'}\n`;
        content += `Timeout: ${toolBlock.input?.timeout || 'Default (120s)'}\n`;
        break;
      case 'Read':
        content += `File path: ${toolBlock.input?.file_path || 'Unknown'}\n`;
        content += `Offset: ${toolBlock.input?.offset || 'Start of file'}\n`;
        content += `Limit: ${toolBlock.input?.limit || 'Entire file'}\n`;
        break;
      case 'Write':
        content += `File path: ${toolBlock.input?.file_path || 'Unknown'}\n`;
        const contentLength = toolBlock.input?.content ? toolBlock.input.content.length : 0;
        content += `Content length: ${contentLength} characters\n`;
        break;
      case 'Edit':
        content += `File path: ${toolBlock.input?.file_path || 'Unknown'}\n`;
        content += `Replace all: ${toolBlock.input?.replace_all ? 'Yes' : 'No'}\n`;
        const oldLength = toolBlock.input?.old_string ? toolBlock.input.old_string.length : 0;
        const newLength = toolBlock.input?.new_string ? toolBlock.input.new_string.length : 0;
        content += `Old string length: ${oldLength} characters\n`;
        content += `New string length: ${newLength} characters\n`;
        break;
      case 'Glob':
        content += `Pattern: ${toolBlock.input?.pattern || 'Unknown'}\n`;
        content += `Search path: ${toolBlock.input?.path || 'Current directory'}\n`;
        break;
      case 'Grep':
        content += `Pattern: ${toolBlock.input?.pattern || 'Unknown'}\n`;
        content += `Include filter: ${toolBlock.input?.include || 'All files'}\n`;
        content += `Search path: ${toolBlock.input?.path || 'Current directory'}\n`;
        break;
      case 'TodoWrite':
        const todoCount = Array.isArray(toolBlock.input?.todos) ? toolBlock.input.todos.length : 0;
        content += `Number of todos: ${todoCount}\n`;
        break;
      default:
        content += `Tool-specific details not available for ${toolName}\n`;
    }
    
    return content;
  }

  /**
   * Bind events for tool displays (simplified for terminal style)
   * @param {Element} _container - Container element (unused in terminal style)
   */
  bindEvents(_container) {
    // No expand/collapse needed for terminal style - everything is compact
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolDisplay;
}