const chalk = require('chalk');

/**
 * Fetch from GitHub with proper headers, timeout, and error handling
 * Provides helpful error messages for common issues like SSL certificate problems
 * @param {string} url - URL to fetch
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function fetchFromGitHub(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const { headers: customHeaders, ...restOptions } = options;
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        'User-Agent': 'claude-code-templates-cli',
        ...customHeaders
      },
      redirect: 'follow',
      signal: controller.signal
    });
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Provide helpful error messages for common issues
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after 30 seconds. Check your network connection.`);
    }
    
    // Extract the underlying cause for better error messages
    const cause = error.cause;
    if (cause) {
      const causeMessage = cause.message || cause.code || '';
      
      // SSL/TLS certificate errors
      if (causeMessage.includes('unable to get local issuer certificate') ||
          causeMessage.includes('UNABLE_TO_GET_ISSUER_CERT_LOCALLY') ||
          causeMessage.includes('certificate') ||
          causeMessage.includes('SSL') ||
          causeMessage.includes('TLS')) {
        throw new Error(
          `SSL certificate error: ${causeMessage}\n` +
          chalk.yellow('   This is usually caused by:\n') +
          chalk.yellow('   • Corporate proxy/firewall intercepting HTTPS\n') +
          chalk.yellow('   • Outdated Node.js CA certificates\n') +
          chalk.yellow('   • VPN or network security software\n\n') +
          chalk.cyan('   Possible fixes:\n') +
          chalk.cyan('   • Update Node.js: nvm install --lts --reinstall-packages-from=current\n') +
          chalk.cyan('   • Update CA certs: brew install ca-certificates (macOS)\n') +
          chalk.cyan('   • Temporary workaround: NODE_TLS_REJECT_UNAUTHORIZED=0 npx claude-code-templates ...')
        );
      }
      
      // DNS/Network errors
      if (causeMessage.includes('ENOTFOUND') || causeMessage.includes('EAI_AGAIN')) {
        throw new Error(
          `DNS resolution failed: ${causeMessage}\n` +
          chalk.yellow('   Cannot resolve github.com. Check your internet connection.')
        );
      }
      
      // Connection errors
      if (causeMessage.includes('ECONNREFUSED') || causeMessage.includes('ECONNRESET')) {
        throw new Error(
          `Connection failed: ${causeMessage}\n` +
          chalk.yellow('   Unable to connect to GitHub. Check your network or firewall settings.')
        );
      }
      
      // Generic network error with cause
      throw new Error(`Network error: ${causeMessage}`);
    }
    
    // Re-throw original error if no cause
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  fetchFromGitHub
};
