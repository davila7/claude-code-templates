import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import axios from 'axios';

const componentTypes = {
  skills: { icon: '🎨', color: 0x9B59B6 },
  agents: { icon: '🤖', color: 0xFF6B6B },
  commands: { icon: '⚡', color: 0x4ECDC4 },
  mcps: { icon: '🔌', color: 0x95E1D3 },
  settings: { icon: '⚙️', color: 0xF9CA24 },
  hooks: { icon: '🪝', color: 0x6C5CE7 },
  templates: { icon: '📋', color: 0xA8E6CF },
  plugins: { icon: '🧩', color: 0xFFD93D },
};

let cachedComponents = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

async function getComponents() {
  const now = Date.now();
  if (cachedComponents && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedComponents;
  }
  const response = await axios.get('https://aitmpl.com/components.json', { timeout: 10000 });
  cachedComponents = response.data;
  cacheTimestamp = now;
  return cachedComponents;
}

function searchComponents(components, query, type = null) {
  const results = [];
  const lowerQuery = query.toLowerCase();
  const typesToSearch = type ? [type] : Object.keys(componentTypes);

  for (const componentType of typesToSearch) {
    const componentList = components[componentType] || [];
    for (const component of componentList) {
      if (component.name.toLowerCase().includes(lowerQuery) || component.category?.toLowerCase().includes(lowerQuery)) {
        results.push({
          ...component,
          type: componentType,
          score: component.name.toLowerCase() === lowerQuery ? 100 : component.name.toLowerCase().startsWith(lowerQuery) ? 50 : 20
        });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}

function createEmbed(component, type = 'info') {
  const typeConfig = componentTypes[component.type];
  const icon = typeConfig?.icon || '📦';
  const color = typeConfig?.color || 0x00D9FF;

  const typeLabel = component.type === 'agents' ? 'agent' : component.type === 'commands' ? 'command' : component.type === 'mcps' ? 'mcp' : component.type === 'settings' ? 'setting' : component.type === 'hooks' ? 'hook' : component.type;
  const category = component.category || 'general';
  const url = `https://www.aitmpl.com/component/${typeLabel}/${category}/${component.name}`;

  if (type === 'install') {
    const flagName = component.type === 'templates' ? 'template' : component.type;
    const installCommand = `npx claude-code-templates@latest --${flagName} ${component.name}`;
    return {
      title: `${icon} Install ${component.name}`,
      description: 'Copy and paste this command in your terminal:',
      color: 0x00D9FF,
      url: url,
      fields: [
        { name: 'Installation Command', value: `\`\`\`bash\n${installCommand}\n\`\`\``, inline: false },
        { name: 'Component Page', value: `[View on aitmpl.com](${url})`, inline: false }
      ],
      timestamp: new Date().toISOString(),
    };
  }

  return {
    title: `${icon} ${component.name}`,
    url: url,
    description: component.description || component.content?.substring(0, 200) || 'No description',
    color: color,
    fields: [
      { name: 'Type', value: `\`${component.type}\``, inline: true },
      { name: 'Category', value: component.category || 'N/A', inline: true },
      { name: 'Downloads', value: `${component.downloads || 0}`, inline: true },
      { name: 'Component Page', value: `[View on aitmpl.com](${url})`, inline: false }
    ],
    timestamp: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const rawBody = JSON.stringify(req.body);

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey);
  if (!isValidRequest) {
    return res.status(401).json({ error: 'Invalid request signature' });
  }

  const interaction = req.body;

  if (interaction.type === InteractionType.PING) {
    return res.status(200).json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    try {
      const components = await getComponents();
      const commandName = interaction.data.name;
      const options = interaction.data.options || [];
      let response;

      if (commandName === 'search') {
        const query = options.find(o => o.name === 'query')?.value;
        const type = options.find(o => o.name === 'type')?.value;
        const results = searchComponents(components, query, type);
        response = {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [{
              title: `🔍 Search Results for "${query}"`,
              description: `Found ${results.length} result(s)`,
              color: 0x00D9FF,
              fields: results.map((c, i) => {
                const typeLabel = c.type === 'agents' ? 'agent' : c.type === 'commands' ? 'command' : c.type === 'mcps' ? 'mcp' : c.type === 'settings' ? 'setting' : c.type === 'hooks' ? 'hook' : c.type;
                const category = c.category || 'general';
                const url = `https://www.aitmpl.com/component/${typeLabel}/${category}/${c.name}`;
                return {
                  name: `${i + 1}. ${componentTypes[c.type].icon} ${c.name}`,
                  value: `**Type:** ${c.type} | **Downloads:** ${c.downloads || 0}\n[View on aitmpl.com](${url})`,
                  inline: false
                };
              }),
              timestamp: new Date().toISOString()
            }]
          }
        };
      } else if (commandName === 'info' || commandName === 'install') {
        const name = options.find(o => o.name === 'name')?.value;
        const type = options.find(o => o.name === 'type')?.value;
        let component = null;
        const types = type ? [type] : Object.keys(componentTypes);
        for (const t of types) {
          const found = components[t]?.find(c => c.name === name);
          if (found) {
            component = { ...found, type: t };
            break;
          }
        }
        if (!component) {
          response = {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `Component "${name}" not found. Use \`/search\` to find components.`, flags: 64 }
          };
        } else {
          response = {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { embeds: [createEmbed(component, commandName)] }
          };
        }
      } else if (commandName === 'popular' || commandName === 'random') {
        const type = options.find(o => o.name === 'type')?.value;
        const componentList = components[type] || [];
        let component;
        if (commandName === 'popular') {
          const sorted = [...componentList].sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
          component = sorted[0];
        } else {
          component = componentList[Math.floor(Math.random() * componentList.length)];
        }
        if (component) {
          response = {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { embeds: [createEmbed({ ...component, type })] }
          };
        }
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error('Error:', error);
      return res.status(200).json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '❌ An error occurred', flags: 64 }
      });
    }
  }

  return res.status(400).json({ error: 'Unknown interaction type' });
}
