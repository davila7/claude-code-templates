export interface Component {
  name: string;
  path: string;
  category: string;
  type: string;
  content: string;
  description?: string;
  url?: string;
  downloads?: number;
}

export interface ComponentsData {
  agents: Component[];
  commands: Component[];
  mcps: Component[];
  settings: Component[];
  hooks: Component[];
  skills: Component[];
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
  templates: CartItem[];
}

export interface FeaturedItem {
  name: string;
  description: string;
  logo: string;
  url: string;
  tag: string;
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
