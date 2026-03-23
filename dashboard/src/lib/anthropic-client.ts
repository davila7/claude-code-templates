import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: import.meta.env.ANTHROPIC_API_KEY,
});

export async function generateComponent(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<{
  content: string;
  tokensUsed: number;
  generationTime: number;
}> {
  const startTime = Date.now();

  const response = await client.messages.create({
    model: options.model || 'claude-3-5-sonnet-20241022',
    max_tokens: options.maxTokens || 4000,
    temperature: options.temperature || 0.7,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  const content =
    response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    content,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    generationTime: Date.now() - startTime,
  };
}

export async function streamComponent(
  systemPrompt: string,
  userPrompt: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const stream = await client.messages.stream({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      onChunk(chunk.delta.text);
    }
  }
}
