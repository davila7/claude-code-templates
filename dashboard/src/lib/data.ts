import type { Component, ComponentsData, ComponentType } from './types';
import { COMPONENTS_JSON_URL } from './constants';

let cachedData: ComponentsData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchComponents(): Promise<ComponentsData> {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  // Resolve relative URLs for server-side fetching
  let url = COMPONENTS_JSON_URL;
  if (url.startsWith('/')) {
    const base = import.meta.env.SITE ?? `http://localhost:${import.meta.env.PORT ?? 4321}`;
    url = new URL(url, base).href;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: ComponentsData = await res.json();
    cachedData = data;
    cacheTimestamp = now;
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (cachedData) return cachedData;
    throw err;
  }
}

export function getCategories(components: Component[]): string[] {
  const cats = new Set<string>();
  for (const c of components) {
    if (c.category) cats.add(c.category);
  }
  return Array.from(cats).sort();
}

export function filterByCategory(components: Component[], category: string): Component[] {
  if (!category || category === 'all') return components;
  return components.filter((c) => c.category === category);
}

export function searchComponents(components: Component[], query: string): Component[] {
  if (!query.trim()) return components;
  const q = query.toLowerCase();
  return components.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.description?.toLowerCase().includes(q)) ||
      c.category?.toLowerCase().includes(q) ||
      c.content?.toLowerCase().includes(q)
  );
}

export function sortComponents(
  components: Component[],
  sortBy: 'downloads' | 'name' = 'downloads'
): Component[] {
  const sorted = [...components];
  if (sortBy === 'downloads') {
    sorted.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
  return sorted;
}

export function getComponentCounts(data: ComponentsData): Record<ComponentType, number> {
  return {
    skills: data.skills?.length ?? 0,
    agents: data.agents?.length ?? 0,
    commands: data.commands?.length ?? 0,
    settings: data.settings?.length ?? 0,
    hooks: data.hooks?.length ?? 0,
    mcps: data.mcps?.length ?? 0,
    templates: data.templates?.length ?? 0,
  };
}

export function getInstallCommand(component: Component): string {
  const typeFlag: Record<string, string> = {
    agent: '--agent',
    command: '--command',
    mcp: '--mcp',
    setting: '--setting',
    hook: '--hook',
    skill: '--skill',
    template: '--template',
  };
  const flag = typeFlag[component.type] ?? '--agent';
  const cleanPath = component.path?.replace(/\.(md|json)$/, '') ?? component.name;
  return `npx claude-code-templates@latest ${flag} ${cleanPath}`;
}
