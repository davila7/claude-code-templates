const BaseValidator = require('../BaseValidator');

/**
 * SemanticValidator - Validates component content for security threats
 *
 * Detects:
 * - Prompt injection attacks
 * - Jailbreak attempts
 * - Instruction override attempts
 * - Self-modification requests
 * - Credential harvesting patterns
 * - Malicious command execution patterns
 * - Role manipulation
 */
class SemanticValidator extends BaseValidator {
  constructor() {
    super();

    // Dangerous patterns for prompt injection and jailbreaks
    this.DANGEROUS_PATTERNS = [
      {
        pattern: /ignore\s+(all\s+)?(previous|prior|earlier|above)\s+(instructions?|prompts?|rules?|commands?)/gi,
        code: 'SEM_E001',
        message: 'Jailbreak pattern detected: Attempt to ignore previous instructions',
        severity: 'critical'
      },
      {
        pattern: /(system\s+prompt|developer\s+instructions?|hidden\s+prompt|internal\s+instructions?)/gi,
        code: 'SEM_E002',
        message: 'Prompt injection detected: Reference to system/developer instructions',
        severity: 'critical'
      },
      {
        pattern: /you\s+are\s+now\s+(a|an)\s+/gi,
        code: 'SEM_E003',
        message: 'Role manipulation detected: Attempt to redefine AI role',
        severity: 'high'
      },
      {
        pattern: /execute\s+the\s+following\s+(code|command|script)/gi,
        code: 'SEM_E004',
        message: 'Command execution attempt detected',
        severity: 'critical'
      },
      {
        pattern: /\b(fetch|retrieve|get|extract|obtain|steal|harvest|capture|collect)\s+(the\s+)?(user['']?s?\s+)?(auth\s+)?(token|key|password|credential|secret|api[\s_-]?key)/gi,
        code: 'SEM_E005',
        message: 'Credential harvesting pattern detected',
        severity: 'critical'
      },
      {
        pattern: /(open|spawn|exec|run)\s+(a\s+)?(shell|terminal|bash|cmd|powershell)/gi,
        code: 'SEM_E006',
        message: 'Shell access attempt detected',
        severity: 'critical'
      },
      {
        pattern: /(disable|bypass|override|skip)\s+(security|safety|filter|protection|validation)/gi,
        code: 'SEM_E007',
        message: 'Security bypass attempt detected',
        severity: 'critical'
      },
      {
        pattern: /always\s+(obey|follow|comply\s+with|execute)\s+the\s+user/gi,
        code: 'SEM_E008',
        message: 'Unconditional obedience instruction detected',
        severity: 'high'
      },
      {
        pattern: /(forget|disregard|remove)\s+(everything|all\s+previous|prior\s+context)/gi,
        code: 'SEM_E009',
        message: 'Context manipulation attempt detected',
        severity: 'high'
      },
      {
        pattern: /modify\s+your\s+(own\s+)?(code|behavior|instructions?|rules?)/gi,
        code: 'SEM_E010',
        message: 'Self-modification request detected',
        severity: 'high'
      }
    ];

    // Suspicious patterns (warnings, not errors)
    this.SUSPICIOUS_PATTERNS = [
      {
        pattern: /\bpretend\s+(you\s+are|to\s+be)\b/gi,
        code: 'SEM_W001',
        message: 'Suspicious instruction: Role pretending detected',
        severity: 'medium'
      },
      {
        pattern: /\b(jailbreak|DAN|ChatGPT\s+Developer\s+Mode)\b/gi,
        code: 'SEM_W002',
        message: 'Known jailbreak terminology detected',
        severity: 'medium'
      },
      {
        pattern: /output\s+raw\s+(code|text|data)/gi,
        code: 'SEM_W003',
        message: 'Raw output request (potential data exfiltration)',
        severity: 'low'
      },
      {
        pattern: /(repeat|echo)\s+after\s+me/gi,
        code: 'SEM_W004',
        message: 'Repetition instruction (potential prompt leakage)',
        severity: 'low'
      }
    ];

    // Sensitive data patterns
    this.SENSITIVE_DATA_PATTERNS = [
      {
        pattern: /(?:password|passwd|pwd)\s*[:=]\s*[^\s]+/gi,
        code: 'SEM_E011',
        message: 'Hardcoded password detected',
        severity: 'critical'
      },
      {
        pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi,
        code: 'SEM_E012',
        message: 'Hardcoded API key detected',
        severity: 'critical'
      },
      {
        pattern: /(?:secret|token)\s*[:=]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi,
        code: 'SEM_E013',
        message: 'Hardcoded secret/token detected',
        severity: 'critical'
      }
    ];
  }

  /**
   * Validate component semantics and content
   * @param {object} component - Component data
   * @param {string} component.content - Raw markdown content
   * @param {string} component.path - File path
   * @param {string} component.type - Component type
   * @param {object} options - Validation options
   * @param {boolean} options.strict - Enable strict mode (warnings become errors)
   * @returns {Promise<object>} Validation results
   */
  async validate(component, options = {}) {
    this.reset();

    const { content, path, type } = component;
    const { strict = false } = options;

    if (!content) {
      this.addError('SEM_E001', 'Component content is empty or missing', { path });
      return this.getResults();
    }

    // 1. Check for dangerous patterns
    this.checkDangerousPatterns(content, path);

    // 2. Check for suspicious patterns
    this.checkSuspiciousPatterns(content, path, strict);

    // 3. Check for sensitive data
    this.checkSensitiveData(content, path);

    // 4. Check for HTML/Script injection in markdown
    this.checkHtmlInjection(content, path);

    // 5. Context-specific validation based on component type
    if (type === 'agent') {
      this.validateAgentContent(content, path);
    } else if (type === 'command') {
      this.validateCommandContent(content, path);
    }

    return this.getResults();
  }

  /**
   * Check for dangerous patterns
   */
  checkDangerousPatterns(content, path) {
    for (const { pattern, code, message, severity } of this.DANGEROUS_PATTERNS) {
      const matches = content.matchAll(pattern);
      const matchArray = Array.from(matches);

      if (matchArray.length > 0) {
        const contexts = matchArray.map(m => {
          const lineInfo = this.getLineFromIndex(content, m.index);
          return {
            text: m[0],
            index: m.index,
            line: lineInfo.line,
            column: lineInfo.column,
            position: lineInfo.position,
            lineText: lineInfo.lineText,
            context: this.getContext(content, m.index, 50)
          };
        });

        this.addError(code, message, {
          path,
          severity,
          matches: contexts.length,
          examples: contexts.slice(0, 3) // Show first 3 matches
        });
      }
    }
  }

  /**
   * Check for suspicious patterns
   */
  checkSuspiciousPatterns(content, path, strict) {
    for (const { pattern, code, message, severity } of this.SUSPICIOUS_PATTERNS) {
      const matches = content.matchAll(pattern);
      const matchArray = Array.from(matches);

      if (matchArray.length > 0) {
        const contexts = matchArray.map(m => {
          const lineInfo = this.getLineFromIndex(content, m.index);
          return {
            text: m[0],
            index: m.index,
            line: lineInfo.line,
            column: lineInfo.column,
            position: lineInfo.position,
            lineText: lineInfo.lineText,
            context: this.getContext(content, m.index, 50)
          };
        });

        if (strict) {
          this.addError(code, message + ' (strict mode)', {
            path,
            severity,
            matches: contexts.length,
            examples: contexts.slice(0, 3)
          });
        } else {
          this.addWarning(code, message, {
            path,
            severity,
            matches: contexts.length,
            examples: contexts.slice(0, 3)
          });
        }
      }
    }
  }

  /**
   * Check for sensitive data (passwords, API keys, etc.)
   */
  checkSensitiveData(content, path) {
    for (const { pattern, code, message, severity } of this.SENSITIVE_DATA_PATTERNS) {
      const matches = content.matchAll(pattern);
      const matchArray = Array.from(matches);

      if (matchArray.length > 0) {
        const contexts = matchArray.map(m => {
          const lineInfo = this.getLineFromIndex(content, m.index);
          return {
            text: m[0].replace(/[:=].*/, ':=<REDACTED>'), // Redact the value
            index: m.index,
            line: lineInfo.line,
            column: lineInfo.column,
            position: lineInfo.position,
            lineText: lineInfo.lineText.replace(/[:=].*/, ':=<REDACTED>') // Redact in line text too
          };
        });

        this.addError(code, message, {
          path,
          severity,
          matches: contexts.length,
          examples: contexts.slice(0, 3)
        });
      }
    }
  }

  /**
   * Check for HTML/Script injection attempts
   */
  checkHtmlInjection(content, path) {
    const dangerousTags = [
      { tag: '<script', code: 'SEM_E014', message: '<script> tag detected (XSS risk)' },
      { tag: '<iframe', code: 'SEM_E015', message: '<iframe> tag detected (injection risk)' },
      { tag: 'javascript:', code: 'SEM_E016', message: 'javascript: protocol detected (XSS risk)' },
      { tag: 'onclick=', code: 'SEM_E017', message: 'Inline event handler detected (XSS risk)' },
      { tag: 'onerror=', code: 'SEM_E018', message: 'onerror handler detected (XSS risk)' }
    ];

    for (const { tag, code, message } of dangerousTags) {
      const lowerContent = content.toLowerCase();
      if (lowerContent.includes(tag.toLowerCase())) {
        const index = lowerContent.indexOf(tag.toLowerCase());
        const lineInfo = this.getLineFromIndex(content, index);

        this.addError(code, message, {
          path,
          severity: 'critical',
          line: lineInfo.line,
          column: lineInfo.column,
          position: lineInfo.position,
          lineText: lineInfo.lineText,
          context: this.getContext(content, index, 50)
        });
      }
    }
  }

  /**
   * Validate agent-specific content
   */
  validateAgentContent(content, path) {
    // Check for overly permissive instructions
    const overlyPermissivePatterns = [
      {
        pattern: /do\s+anything\s+(the\s+)?user\s+(asks|wants|requests)/gi,
        warning: 'Overly permissive instruction: "do anything user asks"'
      },
      {
        pattern: /no\s+limitations?/gi,
        warning: 'Overly permissive instruction: "no limitations"'
      },
      {
        pattern: /unrestricted\s+access/gi,
        warning: 'Overly permissive instruction: "unrestricted access"'
      }
    ];

    for (const { pattern, warning } of overlyPermissivePatterns) {
      const matches = content.matchAll(pattern);
      const matchArray = Array.from(matches);

      if (matchArray.length > 0) {
        const firstMatch = matchArray[0];
        const lineInfo = this.getLineFromIndex(content, firstMatch.index);

        this.addWarning('SEM_W005', warning, {
          path,
          line: lineInfo.line,
          column: lineInfo.column,
          position: lineInfo.position,
          lineText: lineInfo.lineText
        });
      }
    }
  }

  /**
   * Validate command-specific content
   */
  validateCommandContent(content, path) {
    // Check for dangerous command patterns
    const dangerousCommands = [
      {
        pattern: /rm\s+-rf\s+\//gi,
        message: 'Dangerous command: rm -rf /'
      },
      {
        pattern: /:(){ :|:& };:/gi,
        message: 'Fork bomb detected'
      },
      {
        pattern: /dd\s+if=.*of=\/dev\/(sd|hd)/gi,
        message: 'Dangerous disk operation detected'
      }
    ];

    for (const { pattern, message } of dangerousCommands) {
      const matches = content.matchAll(pattern);
      const matchArray = Array.from(matches);

      if (matchArray.length > 0) {
        const firstMatch = matchArray[0];
        const lineInfo = this.getLineFromIndex(content, firstMatch.index);

        this.addError('SEM_E019', message, {
          path,
          severity: 'critical',
          line: lineInfo.line,
          column: lineInfo.column,
          position: lineInfo.position,
          lineText: lineInfo.lineText
        });
      }
    }
  }

  /**
   * Get context around a match
   * @param {string} content - Full content
   * @param {number} index - Match index
   * @param {number} contextLength - Characters before/after to include
   * @returns {string} Context string
   */
  getContext(content, index, contextLength = 50) {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + contextLength);
    const context = content.substring(start, end);

    return (start > 0 ? '...' : '') + context + (end < content.length ? '...' : '');
  }

  /**
   * Generate security report
   * @param {object} component - Component to analyze
   * @returns {Promise<object>} Security report
   */
  async generateSecurityReport(component) {
    const result = await this.validate(component);

    const criticalIssues = result.errors.filter(e => e.metadata.severity === 'critical');
    const highIssues = result.errors.filter(e => e.metadata.severity === 'high');
    const mediumIssues = result.warnings.filter(w => w.metadata.severity === 'medium');
    const lowIssues = result.warnings.filter(w => w.metadata.severity === 'low');

    return {
      safe: result.valid && result.warningCount === 0,
      riskLevel: this.calculateRiskLevel(criticalIssues.length, highIssues.length, mediumIssues.length),
      summary: {
        critical: criticalIssues.length,
        high: highIssues.length,
        medium: mediumIssues.length,
        low: lowIssues.length
      },
      issues: {
        critical: criticalIssues,
        high: highIssues,
        medium: mediumIssues,
        low: lowIssues
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate overall risk level
   */
  calculateRiskLevel(critical, high, medium) {
    if (critical > 0) return 'CRITICAL';
    if (high > 0) return 'HIGH';
    if (medium > 0) return 'MEDIUM';
    return 'LOW';
  }
}

module.exports = SemanticValidator;
