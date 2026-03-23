/**
 * AI Component Generator
 * Uses engineered prompts to generate Claude Code components
 */

export type ComponentType = 'agent' | 'command' | 'skill' | 'hook' | 'setting';

export interface GenerateRequest {
  type: ComponentType;
  description: string;
  context?: {
    projectType?: string;
    frameworks?: string[];
    existingComponents?: string[];
  };
  options?: {
    model?: 'claude-3-5-sonnet' | 'gpt-4' | 'gemini-pro';
    temperature?: number;
    maxTokens?: number;
  };
}

export interface GenerateResponse {
  success: boolean;
  component?: {
    type: ComponentType;
    name: string;
    content: string;
    metadata: {
      generatedAt: string;
      model: string;
      tokensUsed: number;
    };
  };
  validation?: {
    format: 'valid' | 'invalid';
    content: 'valid' | 'invalid';
    safety: 'valid' | 'invalid';
    warnings: string[];
  };
  error?: string;
}

// System prompts for each component type
const SYSTEM_PROMPTS: Record<ComponentType, string> = {
  agent: `You are an expert AI agent designer for Claude Code.

Create a specialized agent based on the user's description.

CRITICAL REQUIREMENTS:
1. Start with YAML frontmatter between --- markers
2. Include: name (kebab-case), description, version (1.0.0), author (AI Generated), tags (array)
3. Write clear, actionable instructions
4. Be specific about responsibilities and process
5. Include examples of expected behavior
6. No placeholders - generate complete content
7. Focus on a single, clear purpose

OUTPUT ONLY THE MARKDOWN CONTENT, NO EXPLANATIONS.`,

  command: `You are an expert command designer for Claude Code.

Create an executable workflow command based on the user's description.

CRITICAL REQUIREMENTS:
1. Start with YAML frontmatter between --- markers
2. Include: name (kebab-case), description, version (1.0.0), author (AI Generated), tags (array), category
3. Write step-by-step executable instructions
4. Include actual code examples and commands
5. Specify prerequisites and verification steps
6. No placeholders - generate complete content

OUTPUT ONLY THE MARKDOWN CONTENT, NO EXPLANATIONS.`,

  skill: `You are an expert skill designer for Claude Code.

Create a reusable skill module based on the user's description.

CRITICAL REQUIREMENTS:
1. Start with YAML frontmatter between --- markers
2. Include: name (kebab-case), description, version (1.0.0), author (AI Generated), tags (array), capabilities (array)
3. Document clear interface (inputs/outputs)
4. Provide usage examples and API reference
5. List dependencies
6. No placeholders - generate complete content

OUTPUT ONLY THE MARKDOWN CONTENT, NO EXPLANATIONS.`,

  hook: `You are an expert automation designer for Claude Code hooks.

Create an event-driven hook based on the user's description.

VALID EVENT TYPES: fileEdited, fileCreated, fileDeleted, userTriggered, promptSubmit, agentStop, preToolUse, postToolUse
VALID ACTION TYPES: askAgent, runCommand

CRITICAL REQUIREMENTS:
1. Output ONLY valid JSON (no markdown, no explanations)
2. Include: name, version (1.0.0), description, when (event config), then (action config)
3. Use safe, reversible actions when possible
4. No placeholders

OUTPUT ONLY THE JSON, NO OTHER TEXT.`,

  setting: `You are an expert configuration designer for Claude Code settings.

Create a settings configuration based on the user's description.

VALID CATEGORIES: performance, editor, ai, security, workflow, appearance

CRITICAL REQUIREMENTS:
1. Output ONLY valid JSON (no markdown, no explanations)
2. Include: name, description, category, settings object
3. Use safe default values
4. Specify types and constraints
5. No placeholders

OUTPUT ONLY THE JSON, NO OTHER TEXT.`
};

// Example components for few-shot learning
const EXAMPLES: Record<ComponentType, string> = {
  agent: `---
name: code-reviewer
description: Expert code reviewer focusing on best practices and bugs
version: 1.0.0
author: AI Generated
tags: [code-review, quality, best-practices]
---

# Code Reviewer Agent

You are an expert code reviewer with deep knowledge of software engineering best practices.

## Core Responsibilities

1. **Code Quality Analysis**
   - Review code structure and organization
   - Identify code smells and anti-patterns
   - Check naming conventions

2. **Bug Detection**
   - Find logic errors and edge cases
   - Identify potential runtime errors

## Review Process

1. Read the entire code
2. Analyze at three levels: Architecture, Implementation, Details
3. Prioritize findings by severity
4. Provide specific, actionable feedback

## Constraints

- Focus on constructive feedback
- Provide specific examples
- Balance perfectionism with pragmatism`,

  command: `---
name: add-eslint
description: Set up ESLint with TypeScript support
version: 1.0.0
author: AI Generated
tags: [eslint, linting, setup]
category: code-quality
---

# Add ESLint Configuration

## What This Command Does

1. Installs ESLint and plugins
2. Creates configuration file
3. Adds lint scripts

## Prerequisites

- Node.js 18+
- TypeScript project

## Execution Steps

### 1. Install Dependencies

\`\`\`bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
\`\`\`

### 2. Create Configuration

Create \`.eslintrc.json\`:

\`\`\`json
{
  "parser": "@typescript-eslint/parser",
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"]
}
\`\`\`

## Verification

Run \`npm run lint\` - should complete without errors.`,

  skill: `---
name: pdf-processor
description: Extract and analyze PDF documents
version: 1.0.0
author: AI Generated
tags: [pdf, document, extraction]
capabilities: [read-pdf, extract-text]
---

# PDF Processor Skill

## Capabilities

### 1. Text Extraction

Extract text from PDF files.

**Usage:**
\`\`\`
Extract text from document.pdf
\`\`\`

## Dependencies

- pdf-parse (npm package)

## Installation

\`\`\`bash
npm install pdf-parse
\`\`\``,

  hook: `{
  "name": "lint-on-save",
  "version": "1.0.0",
  "description": "Run ESLint when TypeScript files are saved",
  "when": {
    "type": "fileEdited",
    "patterns": ["*.ts", "*.tsx"]
  },
  "then": {
    "type": "runCommand",
    "command": "npm run lint"
  }
}`,

  setting: `{
  "name": "mcp-timeouts",
  "description": "Configure timeout values for MCP operations",
  "category": "performance",
  "settings": {
    "connectionTimeout": {
      "value": 30000,
      "type": "number",
      "description": "Maximum time to wait for connection (ms)",
      "min": 5000,
      "max": 120000
    }
  }
}`
};

/**
 * Build the complete prompt for AI generation
 */
export function buildPrompt(request: GenerateRequest): { system: string; user: string } {
  const { type, description, context } = request;
  
  const systemPrompt = SYSTEM_PROMPTS[type];
  const example = EXAMPLES[type];
  
  let userPrompt = `USER REQUEST:\n${description}\n\n`;
  
  // Add context if provided
  if (context) {
    userPrompt += `ADDITIONAL CONTEXT:\n`;
    if (context.projectType) userPrompt += `- Project Type: ${context.projectType}\n`;
    if (context.frameworks?.length) userPrompt += `- Frameworks: ${context.frameworks.join(', ')}\n`;
    if (context.existingComponents?.length) userPrompt += `- Similar Components: ${context.existingComponents.join(', ')}\n`;
    userPrompt += `\n`;
  }
  
  // Add example for reference
  userPrompt += `EXAMPLE ${type.toUpperCase()} (for reference):\n${example}\n\n`;
  
  // Add quality checklist
  userPrompt += `QUALITY CHECKLIST:\n`;
  userPrompt += `✓ Clear, specific instructions\n`;
  userPrompt += `✓ Actionable steps\n`;
  userPrompt += `✓ Includes examples\n`;
  userPrompt += `✓ No placeholders\n`;
  userPrompt += `✓ Professional language\n\n`;
  
  userPrompt += `NOW GENERATE THE ${type.toUpperCase()} BASED ON THE USER REQUEST ABOVE.`;
  
  return { system: systemPrompt, user: userPrompt };
}

/**
 * Validate generated component
 */
export function validateComponent(type: ComponentType, content: string): {
  format: 'valid' | 'invalid';
  content: 'valid' | 'invalid';
  safety: 'valid' | 'invalid';
  warnings: string[];
} {
  const warnings: string[] = [];
  let format: 'valid' | 'invalid' = 'valid';
  let contentValid: 'valid' | 'invalid' = 'valid';
  let safety: 'valid' | 'invalid' = 'valid';
  
  // Format validation
  if (type === 'hook' || type === 'setting') {
    // Should be valid JSON
    try {
      JSON.parse(content);
    } catch {
      format = 'invalid';
      warnings.push('Invalid JSON format');
    }
  } else {
    // Should have YAML frontmatter
    if (!content.startsWith('---')) {
      format = 'invalid';
      warnings.push('Missing YAML frontmatter');
    }
    
    // Check for required fields
    if (!content.includes('name:')) warnings.push('Missing name field');
    if (!content.includes('description:')) warnings.push('Missing description field');
    if (!content.includes('version:')) warnings.push('Missing version field');
  }
  
  // Content validation
  if (content.length < 200) {
    contentValid = 'invalid';
    warnings.push('Content too short (minimum 200 characters)');
  }
  
  // Check for placeholders
  const placeholders = ['{', '}', '[TODO]', '[REPLACE', 'PLACEHOLDER'];
  for (const placeholder of placeholders) {
    if (content.includes(placeholder)) {
      contentValid = 'invalid';
      warnings.push(`Contains placeholder: ${placeholder}`);
    }
  }
  
  // Safety validation
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,  // Dangerous delete
    /eval\(/,  // Code execution
    /exec\(/,  // Command execution
    /password\s*=\s*["'][^"']+["']/i,  // Hardcoded password
    /api[_-]?key\s*=\s*["'][^"']+["']/i,  // Hardcoded API key
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      safety = 'invalid';
      warnings.push(`Potentially unsafe content detected: ${pattern.source}`);
    }
  }
  
  return {
    format,
    content: contentValid,
    safety,
    warnings
  };
}

/**
 * Extract component name from generated content
 */
export function extractComponentName(type: ComponentType, content: string): string {
  if (type === 'hook' || type === 'setting') {
    try {
      const json = JSON.parse(content);
      return json.name || 'unnamed-component';
    } catch {
      return 'unnamed-component';
    }
  } else {
    // Extract from YAML frontmatter
    const match = content.match(/name:\s*([^\n]+)/);
    return match ? match[1].trim() : 'unnamed-component';
  }
}
