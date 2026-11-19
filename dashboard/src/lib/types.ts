export interface Component {
  name: string;
  path: string;
  category: string;
  type: string;
  content: string;
  description?: string;
  author?: string;
  version?: string;
  license?: string;
  keywords?: string[];
  url?: string;
  downloads?: number;
  references?: string[];
  skillspector?: SkillSpectorResult;
  /** External skills: the code lives in another repo, downloaded from this commit at install time. */
  source?: ExternalSource;
  /** Plugins: what the plugin ships, by kind; names are shown after the plugin prefix (/{plugin}:{skill}). */
  contains?: PluginContents;
}

export type PluginContents = Partial<Record<
  'skills' | 'commands' | 'agents' | 'hooks' | 'mcpServers' | 'lspServers' | 'outputStyles' | 'themes' | 'bin' | 'monitors',
  string[]
>>;

export interface ExternalSource {
  repo: string;
  path: string;
  commit: string;
  license: string;
  url: string;
  requires?: string[];
}

export interface SkillSpectorFinding {
  id: string;
  category: string;
  severity: string;
  title: string;
  file: string;
  line?: number | null;
  count: number;
}

// NVIDIA SkillSpector static scan, written by scripts/skillspector_catalog.py.
export interface SkillSpectorResult {
  score: number;
  severity: string;
  recommendation: string;
  issueCount: number;
  analysis?: string;
  findings: SkillSpectorFinding[];
  /** Every observation per category (findings holds only the top groups). Missing on results scanned before 2026-11-19. */
  categories?: Record<string, number>;
  version?: string;
  scannedAt?: string;
}

/** Source lines around one SkillSpector finding (content file `scanSnippets`, aligned with `findings`). */
export interface ScanSnippet {
  start: number;
  lines: string[];
}

// NVIDIA SkillEvaluator Harness Check per skill, written by scripts/harness_catalog.py.
// Display-only, like SkillSpector: never used for ordering, search or ranking.
export interface HarnessNote {
  id: string;
  effect: string;
  message: string;
  fix: string;
}

export interface HarnessAgent {
  /** claude-code | codex | copilot-cli | opencode | hermes | openclaw */
  id: string;
  /** loads | degraded | not_loaded */
  status: string;
  /** Agent release the loading rules were verified on. */
  verified: string;
  notes: HarnessNote[];
}

export interface HarnessResult {
  agents: HarnessAgent[];
  version?: string;
  checkedAt?: string;
}

export interface ComponentsData {
  agents: Component[];
  commands: Component[];
  mcps: Component[];
  settings: Component[];
  hooks: Component[];
  skills: Component[];
  loops: Component[];
  mods: Component[];
  templates: Component[];
}

export type ComponentType = keyof ComponentsData;

export interface CartItem {
  name: string;
  path: string;
  category: string;
  description: string;
  icon: string;
}

export interface Cart {
  agents: CartItem[];
  commands: CartItem[];
  settings: CartItem[];
  hooks: CartItem[];
  mcps: CartItem[];
  skills: CartItem[];
  loops: CartItem[];
  mods: CartItem[];
  templates: CartItem[];
}

export interface FeaturedLink {
  label: string;
  url: string;
}

export interface FeaturedItem {
  name: string;
  description: string;
  logo: string;
  url: string;
  tag: string;
  tagColor: string;
  category: string;
  ctaLabel: string;
  ctaUrl: string;
  websiteUrl: string;
  installCommand?: string;
  metadata: Record<string, string>;
  links: FeaturedLink[];
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  component_type: string;
  component_path: string;
  component_name: string;
  component_category: string | null;
  added_at: string;
}

export interface Collection {
  id: string;
  clerk_user_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
  collection_items: CollectionItem[];
}
