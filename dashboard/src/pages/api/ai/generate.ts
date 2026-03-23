import type { APIRoute } from 'astro';
import { generateComponent } from '../../../lib/anthropic-client';
import {
  buildSystemPrompt,
  buildUserPrompt,
  validateComponent,
  ERROR_MESSAGES,
} from '../../../lib/ai-prompts';
import type { GenerateRequest, GenerateResponse } from '../../../lib/types';
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.DATABASE_URL);

async function checkRateLimit(
  userId: string
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const usage = await sql`
    SELECT * FROM ai_usage_limits
    WHERE clerk_user_id = ${userId}
  `;

  const getNextMonthStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  };

  if (usage.length === 0) {
    // First time user
    await sql`
      INSERT INTO ai_usage_limits (clerk_user_id, generations_this_month, last_generation_at)
      VALUES (${userId}, 1, NOW())
    `;
    return { allowed: true, remaining: 4, resetAt: getNextMonthStart() };
  }

  const limit = usage[0];
  const lastGen = new Date(limit.last_generation_at);
  const now = new Date();

  // Check if month has reset
  if (lastGen.getMonth() !== now.getMonth() || lastGen.getFullYear() !== now.getFullYear()) {
    await sql`
      UPDATE ai_usage_limits
      SET generations_this_month = 1, last_generation_at = NOW()
      WHERE clerk_user_id = ${userId}
    `;
    return {
      allowed: true,
      remaining: limit.monthly_limit - 1,
      resetAt: getNextMonthStart(),
    };
  }

  // Check limit
  if (limit.generations_this_month >= limit.monthly_limit && !limit.is_pro) {
    return { allowed: false, remaining: 0, resetAt: getNextMonthStart() };
  }

  // Increment counter
  await sql`
    UPDATE ai_usage_limits
    SET generations_this_month = generations_this_month + 1,
        last_generation_at = NOW()
    WHERE clerk_user_id = ${userId}
  `;

  return {
    allowed: true,
    remaining: limit.monthly_limit - limit.generations_this_month - 1,
    resetAt: getNextMonthStart(),
  };
}

function extractComponentName(content: string, type: string): string {
  // Try to extract name from YAML frontmatter
  const yamlMatch = content.match(/^---\s*\nname:\s*(.+?)\n/m);
  if (yamlMatch) {
    return yamlMatch[1].trim();
  }

  // Try to extract from JSON
  if (type === 'hooks' || type === 'settings' || type === 'mcps') {
    try {
      const parsed = JSON.parse(content);
      if (parsed.name) return parsed.name;
    } catch {
      // Ignore parse errors
    }
  }

  // Fallback to generated name
  return `ai-generated-${type}-${Date.now()}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Auth check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: ERROR_MESSAGES.AUTH_REQUIRED,
        } as GenerateResponse),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract user ID from token (simplified - in production use proper Clerk verification)
    const userId = authHeader.replace('Bearer ', '');

    // 2. Parse request
    const body = (await request.json()) as GenerateRequest;
    const { type, description, context } = body;

    // 3. Validate input
    if (!description || description.length < 20) {
      return new Response(
        JSON.stringify({
          success: false,
          error: ERROR_MESSAGES.INVALID_INPUT,
        } as GenerateResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check rate limit
    const rateLimit = await checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: ERROR_MESSAGES.RATE_LIMIT,
          rateLimitRemaining: 0,
        } as GenerateResponse),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Build prompts
    const systemPrompt = buildSystemPrompt(type);
    const userPrompt = buildUserPrompt(type, description, context);

    // 6. Generate component
    const result = await generateComponent(systemPrompt, userPrompt);

    // 7. Validate output
    const validation = validateComponent(type, result.content);

    // 8. Extract component name
    const componentName = extractComponentName(result.content, type);

    // 9. Track in database
    await sql`
      INSERT INTO ai_generations (
        clerk_user_id,
        component_type,
        user_description,
        generated_content,
        component_name,
        model_used,
        tokens_used,
        generation_time_ms,
        status,
        validation_passed,
        validation_warnings,
        project_context
      ) VALUES (
        ${userId},
        ${type},
        ${description},
        ${result.content},
        ${componentName},
        ${'claude-3-5-sonnet-20241022'},
        ${result.tokensUsed},
        ${result.generationTime},
        ${'success'},
        ${validation.format === 'valid' && validation.content === 'valid' && validation.safety === 'valid'},
        ${validation.warnings},
        ${JSON.stringify(context || {})}
      )
    `;

    // 10. Return response
    return new Response(
      JSON.stringify({
        success: true,
        component: {
          name: componentName,
          content: result.content,
          metadata: {
            model: 'claude-3-5-sonnet-20241022',
            tokensUsed: result.tokensUsed,
            generationTime: result.generationTime,
          },
        },
        validation,
        rateLimitRemaining: rateLimit.remaining,
      } as GenerateResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AI generation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: ERROR_MESSAGES.API_ERROR,
      } as GenerateResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
