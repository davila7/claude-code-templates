import type { APIRoute } from 'astro';
import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import { jsonResponse } from '../../../lib/api/cors';

const componentTypes: Record<string, { icon: string; color: number }> = {
  skills: { icon: '🎨', color: 0x9b59b6 },
  agents: { icon: '🤖', color: 0xff6b6b },
  commands: { icon: '⚡', color: 0x4ecdc4 },
  mcps: { icon: '🔌', color: 0x95e1d3 },
  settings: { icon: '⚙️', color: 0xf9ca24 },
  hooks: { icon: '🪝', color: 0x6c5ce7 },
  templates: { icon: '📋', color: 0xa8e6cf },
  plugins: { icon: '🧩', color: 0xffd93d },
};

let cachedComponents: Record<string, unknown[]> | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000;

async function getComponents(): Promise<Record<string, unknown[]>> {
  const now = Date.now();
  if (cachedComponents && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION) {
    return cachedComponents;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch('https://www.aitmpl.com/components.json', {
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  cachedComponents = (await response.json()) as Record<string, unknown[]>;
  cacheTimestamp = now;
  return cachedComponents;
}

interface Component {
  name: string;
  category?: string;
  description?: string;
  content?: string;
  downloads?: number;
  type?: string;
  score?: number;
}

function searchComponents(
  components: Record<string, unknown[]>,
  query: string,
  type: string | null = null,
): Component[] {
  const results: Component[] = [];
  const lowerQuery = query.toLowerCase();
  const typesToSearch = type ? [type] : Object.keys(componentTypes);

  for (const componentType of typesToSearch) {
    const componentList = (components[componentType] || []) as Component[];
    for (const component of componentList) {
      if (
        component.name.toLowerCase().includes(lowerQuery) ||
        component.category?.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          ...component,
          type: componentType,
          score:
            component.name.toLowerCase() === lowerQuery
              ? 100
              : component.name.toLowerCase().startsWith(lowerQuery)
                ? 50
                : 20,
        });
      }
    }
  }
  return results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);
}

function createEmbed(component: Component, type = 'info') {
  const typeConfig = componentTypes[component.type || ''];
  const icon = typeConfig?.icon || '📦';
  const color = typeConfig?.color || 0x00d9ff;

  const typeLabel =
    component.type === 'agents'
      ? 'agent'
      : component.type === 'commands'
        ? 'command'
        : component.type === 'mcps'
          ? 'mcp'
          : component.type === 'settings'
            ? 'setting'
            : component.type === 'hooks'
              ? 'hook'
              : component.type;
  const category = component.category || 'general';
  const url = `https://www.aitmpl.com/component/${typeLabel}/${category}/${component.name}`;

  if (type === 'install') {
    const flagName = component.type === 'templates' ? 'template' : component.type;
    const installCommand = `npx claude-code-templates@latest --${flagName} ${component.name}`;
    return {
      title: `${icon} Install ${component.name}`,
      description: 'Copy and paste this command in your terminal:',
      color: 0x00d9ff,
      url,
      fields: [
        { name: 'Installation Command', value: `\`\`\`bash\n${installCommand}\n\`\`\``, inline: false },
        { name: 'Component Page', value: `[View on aitmpl.com](${url})`, inline: false },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  return {
    title: `${icon} ${component.name}`,
    url,
    description: component.description || component.content?.substring(0, 200) || 'No description',
    color,
    fields: [
      { name: 'Type', value: `\`${component.type}\``, inline: true },
      { name: 'Category', value: component.category || 'N/A', inline: true },
      { name: 'Downloads', value: `${component.downloads || 0}`, inline: true },
      { name: 'Component Page', value: `[View on aitmpl.com](${url})`, inline: false },
    ],
    timestamp: new Date().toISOString(),
  };
}

export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.text();
  const body = JSON.parse(rawBody);

  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  const publicKey = import.meta.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const isValidRequest = verifyKey(rawBody, signature as string, timestamp as string, publicKey);
  if (!isValidRequest) {
    return jsonResponse({ error: 'Invalid request signature' }, 401);
  }

  const interaction = body;

  if (interaction.type === InteractionType.PING) {
    return jsonResponse({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    try {
      const components = await getComponents();
      const commandName = interaction.data.name;
      const options = interaction.data.options || [];
      let response: Record<string, unknown> | undefined;

      if (commandName === 'search') {
        const query = options.find((o: { name: string }) => o.name === 'query')?.value;
        const type = options.find((o: { name: string }) => o.name === 'type')?.value;
        const results = searchComponents(components, query, type);
        response = {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: `Search Results for "${query}"`,
                description: `Found ${results.length} result(s)`,
                color: 0x00d9ff,
                fields: results.map((c, i) => {
                  const tLabel =
                    c.type === 'agents'
                      ? 'agent'
                      : c.type === 'commands'
                        ? 'command'
                        : c.type === 'mcps'
                          ? 'mcp'
                          : c.type === 'settings'
                            ? 'setting'
                            : c.type === 'hooks'
                              ? 'hook'
                              : c.type;
                  const cat = c.category || 'general';
                  const cUrl = `https://www.aitmpl.com/component/${tLabel}/${cat}/${c.name}`;
                  return {
                    name: `${i + 1}. ${componentTypes[c.type || '']?.icon || '📦'} ${c.name}`,
                    value: `**Type:** ${c.type} | **Downloads:** ${c.downloads || 0}\n[View on aitmpl.com](${cUrl})`,
                    inline: false,
                  };
                }),
                timestamp: new Date().toISOString(),
              },
            ],
          },
        };
      } else if (commandName === 'info' || commandName === 'install') {
        const name = options.find((o: { name: string }) => o.name === 'name')?.value;
        const type = options.find((o: { name: string }) => o.name === 'type')?.value;
        let component: Component | null = null;
        const types = type ? [type] : Object.keys(componentTypes);
        for (const t of types) {
          const found = (components[t] as Component[])?.find((c) => c.name === name);
          if (found) {
            component = { ...found, type: t };
            break;
          }
        }
        if (!component) {
          response = {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `Component "${name}" not found. Use \`/search\` to find components.`, flags: 64 },
          };
        } else {
          response = {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { embeds: [createEmbed(component, commandName)] },
          };
        }
      } else if (commandName === 'popular' || commandName === 'random') {
        const type = options.find((o: { name: string }) => o.name === 'type')?.value;
        const componentList = (components[type] || []) as Component[];
        let component: Component | undefined;
        if (commandName === 'popular') {
          const sorted = [...componentList].sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
          component = sorted[0];
        } else {
          component = componentList[Math.floor(Math.random() * componentList.length)];
        }
        if (component) {
          response = {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { embeds: [createEmbed({ ...component, type })] },
          };
        }
      }

      return jsonResponse(response);
    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'An error occurred', flags: 64 },
      });
    }
  }

  return jsonResponse({ error: 'Unknown interaction type' }, 400);
};
