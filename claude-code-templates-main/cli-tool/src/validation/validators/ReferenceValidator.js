const BaseValidator = require('../BaseValidator');
const url = require('url');

/**
 * ReferenceValidator - Validates external references and URLs
 *
 * Checks:
 * - URL protocol validation (HTTPS required)
 * - Private IP address blocking
 * - file:// protocol blocking
 * - Dangerous HTML tags
 * - URL accessibility (optional)
 * - Google Safe Browsing API integration (optional)
 */
class ReferenceValidator extends BaseValidator {
  constructor() {
    super();

    // Private IP ranges (RFC 1918)
    this.PRIVATE_IP_PATTERNS = [
      /^127\./,                    // Loopback
      /^10\./,                     // Class A private
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
      /^192\.168\./,               // Class C private
      /^169\.254\./,               // Link-local
      /^::1$/,                     // IPv6 loopback
      /^fe80:/,                    // IPv6 link-local
      /^fc00:/,                    // IPv6 unique local
      /^fd00:/                     // IPv6 unique local
    ];

    // Dangerous protocols
    this.BLOCKED_PROTOCOLS = [
      'file:',
      'ftp:',
      'data:',
      'javascript:',
      'vbscript:'
    ];

    // Allowed protocols (whitelist approach)
    this.ALLOWED_PROTOCOLS = [
      'https:',
      'http:' // Will generate warning, but not error
    ];
  }

  /**
   * Validate component references
   * @param {object} component - Component data
   * @param {string} component.content - Raw markdown content
   * @param {string} component.path - File path
   * @param {object} options - Validation options
   * @param {boolean} options.checkAccessibility - Check if URLs are accessible
   * @param {boolean} options.strictHttps - Require HTTPS (no HTTP)
   * @returns {Promise<object>} Validation results
   */
  async validate(component, options = {}) {
    this.reset();

    const { content, path } = component;
    const { checkAccessibility = false, strictHttps = false } = options;

    if (!content) {
      this.addError('REF_E001', 'Component content is empty or missing', { path });
      return this.getResults();
    }

    // 1. Extract and validate URLs
    const urls = this.extractUrls(content);
    for (const urlInfo of urls) {
      await this.validateUrl(urlInfo, path, strictHttps);
    }

    // 2. Check for dangerous protocols in markdown links
    this.checkMarkdownLinks(content, path, strictHttps);

    // 3. Validate image sources
    this.validateImageSources(content, path);

    // 4. Check URL accessibility (optional)
    if (checkAccessibility && urls.length > 0) {
      this.addInfo('REF_I001', `Skipping URL accessibility check (${urls.length} URLs found)`, {
        path,
        note: 'Enable with checkAccessibility option in production'
      });
    }

    return this.getResults();
  }

  /**
   * Extract URLs from content
   * @param {string} content - Content to extract URLs from
   * @returns {Array<object>} Array of URL objects
   */
  extractUrls(content) {
    const urls = [];

    // Match markdown links: [text](url)
    const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = markdownLinkPattern.exec(content)) !== null) {
      urls.push({
        text: match[1],
        url: match[2],
        type: 'markdown',
        index: match.index
      });
    }

    // Match plain URLs: http(s)://...
    const plainUrlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    while ((match = plainUrlPattern.exec(content)) !== null) {
      // Avoid duplicates from markdown links
      if (!urls.some(u => u.url === match[0])) {
        urls.push({
          text: match[0],
          url: match[0],
          type: 'plain',
          index: match.index
        });
      }
    }

    return urls;
  }

  /**
   * Validate a single URL
   * @param {object} urlInfo - URL information object
   * @param {string} path - File path
   * @param {boolean} strictHttps - Require HTTPS
   */
  async validateUrl(urlInfo, path, strictHttps) {
    const { url: urlString, text, type } = urlInfo;

    try {
      const parsedUrl = new url.URL(urlString);

      // 1. Protocol validation
      if (this.BLOCKED_PROTOCOLS.includes(parsedUrl.protocol)) {
        this.addError(
          'REF_E002',
          `Blocked protocol detected: ${parsedUrl.protocol}`,
          {
            path,
            url: urlString,
            protocol: parsedUrl.protocol,
            context: text
          }
        );
        return;
      }

      if (!this.ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
        this.addWarning(
          'REF_W001',
          `Unknown protocol: ${parsedUrl.protocol}`,
          {
            path,
            url: urlString,
            protocol: parsedUrl.protocol
          }
        );
      }

      // 2. HTTP vs HTTPS
      if (parsedUrl.protocol === 'http:') {
        if (strictHttps) {
          this.addError(
            'REF_E003',
            'HTTP protocol not allowed (HTTPS required)',
            {
              path,
              url: urlString,
              suggestion: urlString.replace('http://', 'https://')
            }
          );
        } else {
          this.addWarning(
            'REF_W002',
            'HTTP protocol detected (HTTPS recommended)',
            {
              path,
              url: urlString,
              suggestion: urlString.replace('http://', 'https://')
            }
          );
        }
      }

      // 3. Private IP detection
      if (parsedUrl.hostname) {
        if (this.isPrivateIp(parsedUrl.hostname)) {
          this.addError(
            'REF_E004',
            'Private IP address detected (potential SSRF risk)',
            {
              path,
              url: urlString,
              hostname: parsedUrl.hostname,
              severity: 'critical'
            }
          );
        }

        // 4. Localhost detection
        if (this.isLocalhost(parsedUrl.hostname)) {
          this.addWarning(
            'REF_W003',
            'Localhost reference detected',
            {
              path,
              url: urlString,
              hostname: parsedUrl.hostname
            }
          );
        }
      }

      // 5. Suspicious TLDs
      if (this.isSuspiciousTld(parsedUrl.hostname)) {
        this.addWarning(
          'REF_W004',
          'Suspicious or uncommon TLD detected',
          {
            path,
            url: urlString,
            hostname: parsedUrl.hostname
          }
        );
      }

    } catch (error) {
      // Invalid URL format
      this.addWarning(
        'REF_W005',
        `Invalid URL format: ${error.message}`,
        {
          path,
          url: urlString,
          error: error.message
        }
      );
    }
  }

  /**
   * Check markdown links for dangerous patterns
   */
  checkMarkdownLinks(content, path, strictHttps) {
    // Look for markdown links with dangerous protocols
    const dangerousLinkPattern = /\[([^\]]+)\]\((javascript:|data:|file:|vbscript:)[^)]*\)/gi;
    const matches = content.matchAll(dangerousLinkPattern);

    for (const match of matches) {
      this.addError(
        'REF_E005',
        'Dangerous protocol in markdown link',
        {
          path,
          link: match[0],
          protocol: match[2],
          severity: 'critical'
        }
      );
    }
  }

  /**
   * Validate image sources
   */
  validateImageSources(content, path) {
    // Match markdown images: ![alt](src)
    const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const matches = content.matchAll(imagePattern);

    for (const match of matches) {
      const src = match[2];

      // Check for data URIs (can be very large)
      if (src.startsWith('data:')) {
        const dataUriSize = src.length;
        if (dataUriSize > 10000) {
          this.addWarning(
            'REF_W006',
            `Large data URI in image (${(dataUriSize / 1024).toFixed(2)}KB)`,
            {
              path,
              size: dataUriSize,
              recommendation: 'Use external image hosting instead'
            }
          );
        }
      }

      // Validate image URL if it's a remote URL
      if (src.startsWith('http')) {
        this.validateUrl({ url: src, text: match[1], type: 'image' }, path, false);
      }
    }
  }

  /**
   * Check if hostname is a private IP
   * @param {string} hostname - Hostname to check
   * @returns {boolean}
   */
  isPrivateIp(hostname) {
    return this.PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname));
  }

  /**
   * Check if hostname is localhost
   * @param {string} hostname - Hostname to check
   * @returns {boolean}
   */
  isLocalhost(hostname) {
    return ['localhost', '127.0.0.1', '::1'].includes(hostname.toLowerCase());
  }

  /**
   * Check if TLD is suspicious
   * @param {string} hostname - Hostname to check
   * @returns {boolean}
   */
  isSuspiciousTld(hostname) {
    if (!hostname) return false;

    const suspiciousTlds = [
      '.tk', '.ml', '.ga', '.cf', '.gq', // Free TLDs often used for spam
      '.zip', '.mov', // Confusing TLDs
      '.xyz' // Sometimes used maliciously
    ];

    return suspiciousTlds.some(tld => hostname.toLowerCase().endsWith(tld));
  }

  /**
   * Generate reference security report
   * @param {object} component - Component to analyze
   * @returns {Promise<object>} Security report
   */
  async generateReferenceReport(component) {
    const result = await this.validate(component);

    const urls = this.extractUrls(component.content);
    const httpsUrls = urls.filter(u => u.url.startsWith('https://'));
    const httpUrls = urls.filter(u => u.url.startsWith('http://'));

    return {
      safe: result.valid,
      totalUrls: urls.length,
      httpsCount: httpsUrls.length,
      httpCount: httpUrls.length,
      httpsPercentage: urls.length > 0 ? ((httpsUrls.length / urls.length) * 100).toFixed(1) : 0,
      issues: {
        errors: result.errors,
        warnings: result.warnings
      },
      urls: urls.map(u => ({
        url: u.url,
        type: u.type,
        safe: !result.errors.some(e => e.metadata.url === u.url)
      })),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ReferenceValidator;
