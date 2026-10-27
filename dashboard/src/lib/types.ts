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
  version?: string;
  scannedAt?: string;
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
