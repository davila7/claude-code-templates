// AI Prompts for Component Generation

export const ERROR_MESSAGES = {
  AUTH_REQUIRED: 'Authentication required',
  INVALID_INPUT: 'Invalid input: description must be at least 20 characters',
  RATE_LIMIT: 'Rate limit exceeded. Please upgrade to Pro for unlimited generations.',
  API_ERROR: 'Failed to generate component. Please try again.',
};

export function buildSystemPrompt(type: string): string {
  const basePrompt = `You are an expert at creating Claude Code components. Generate high-quality, production-ready ${type} that follow best practices.`;

  const typeSpecificPrompts: Record<string, string> = {
    agents: `${basePrompt}

Agents should:
- Have clear, focused responsibilities
- Include practical examples
- Use proper YAML frontmatter with name, description, and color
- Follow the agent template structure
- Include relevant tool usage patterns`,

    commands: `${basePrompt}

Commands should:
- Have descriptive names and descriptions
- Include clear step-by-step instructions
- Use proper markdown formatting
- Include examples where helpful
- Follow the command template structure`,

    hooks: `${basePrompt}

Hooks should:
- Be valid JSON with proper structure
- Include name, version, description
- Have clear when/then conditions
- Use appropriate event types
- Include helpful comments`,

    mcps: `${basePrompt}

MCP configurations should:
- Be valid JSON
- Include proper server configuration
- Have clear command and args
- Include environment variables if needed
- Follow MCP best practices`,

    skills: `${basePrompt}

Skills should:
- Have clear learning objectives
- Include practical examples
- Use proper markdown formatting
- Be well-structured and easy to follow
- Include references where helpful`,
  };

  return typeSpecificPrompts[type] || basePrompt;
}

export function buildUserPrompt(type: string, description: string, context?: any): string {
  let prompt = `Create a ${type} component based on this description:\n\n${description}`;

  if (context) {
    prompt += `\n\nAdditional context:\n${JSON.stringify(context, null, 2)}`;
  }

  prompt += `\n\nGenerate only the component content, no explanations or markdown code blocks.`;

  return prompt;
}

export interface ValidationResult {
  format: 'valid' | 'invalid';
  content: 'valid' | 'invalid';
  safety: 'valid' | 'invalid';
  warnings: string[];
}

export function validateComponent(type: string, content: string): ValidationResult {
  const warnings: string[] = [];
  let format: 'valid' | 'invalid' = 'valid';
  let contentValid: 'valid' | 'invalid' = 'valid';
  let safety: 'valid' | 'invalid' = 'valid';

  // Format validation
  if (type === 'hooks' || type === 'mcps' || type === 'settings') {
    try {
      JSON.parse(content);
    } catch {
      format = 'invalid';
      warnings.push('Invalid JSON format');
    }
  }

  if (type === 'agents' || type === 'commands' || type === 'skills') {
    if (!content.includes('---')) {
      warnings.push('Missing YAML frontmatter');
    }
  }

  // Content validation
  if (content.length < 50) {
    contentValid = 'invalid';
    warnings.push('Content too short');
  }

  if (content.length > 50000) {
    contentValid = 'invalid';
    warnings.push('Content too long');
  }

  // Safety validation
  const dangerousPatterns = [
    /rm\s+-rf/i,
    /eval\(/i,
    /exec\(/i,
    /__import__/i,
    /os\.system/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      safety = 'invalid';
      warnings.push('Potentially dangerous code detected');
      break;
    }
  }

  return {
    format,
    content: contentValid,
    safety,
    warnings,
  };
}
