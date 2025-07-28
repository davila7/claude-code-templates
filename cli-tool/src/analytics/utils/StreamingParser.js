const readline = require('readline');
const fs = require('fs');

/**
 * Streaming JSONL parser to handle large conversation files without loading them entirely into memory
 */
class StreamingJSONLParser {
  /**
   * Parse a JSONL file line by line using async generator
   * @param {string} filepath - Path to the JSONL file
   * @yields {Object} Parsed JSON object from each line
   */
  async *parseFile(filepath) {
    const stream = fs.createReadStream(filepath);
    const rl = readline.createInterface({ 
      input: stream,
      crlfDelay: Infinity // Handle Windows line endings
    });
    
    let lineNumber = 0;
    for await (const line of rl) {
      lineNumber++;
      if (line.trim()) {
        try {
          yield JSON.parse(line);
        } catch (e) {
          console.warn(`Invalid JSON at line ${lineNumber} in ${filepath}: ${e.message}`);
        }
      }
    }
  }

  /**
   * Get the last N messages from a file without loading the entire file
   * @param {string} filepath - Path to the JSONL file
   * @param {number} n - Number of messages to retrieve
   * @returns {Promise<Array>} Array of last N messages
   */
  async getLastNMessages(filepath, n = 10) {
    const messages = [];
    for await (const message of this.parseFile(filepath)) {
      messages.push(message);
      if (messages.length > n) {
        messages.shift(); // Remove oldest message
      }
    }
    return messages;
  }

  /**
   * Count messages in a file without loading them
   * @param {string} filepath - Path to the JSONL file
   * @returns {Promise<number>} Total message count
   */
  async countMessages(filepath) {
    let count = 0;
    for await (const _ of this.parseFile(filepath)) {
      count++;
    }
    return count;
  }

  /**
   * Get file size and basic stats without reading content
   * @param {string} filepath - Path to the JSONL file
   * @returns {Promise<Object>} File statistics
   */
  async getFileStats(filepath) {
    const stats = await fs.promises.stat(filepath);
    return {
      size: stats.size,
      modified: stats.mtime,
      created: stats.birthtime,
      sizeInMB: (stats.size / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Extract metadata from filename and path
   * @param {string} filepath - Path to the JSONL file
   * @returns {Object} Extracted metadata
   */
  extractMetadata(filepath) {
    const path = require('path');
    const filename = path.basename(filepath, '.jsonl');
    const projectDir = path.basename(path.dirname(filepath));
    
    // Try to extract timestamp from filename
    const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    const dateCreated = timestampMatch ? new Date(timestampMatch[1]) : null;
    
    return {
      id: filename,
      projectId: projectDir,
      dateCreated,
      filepath
    };
  }
}

module.exports = StreamingJSONLParser;