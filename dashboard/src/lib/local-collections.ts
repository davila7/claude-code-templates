// Local-only collections (no auth required)
// Stored in localStorage for easy testing

export interface LocalCollectionItem {
  type: string;
  path: string;
  name: string;
  category?: string;
  files?: LocalComponentFile[]; // File structure for multi-file components
}

export interface LocalComponentFile {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: LocalComponentFile[];
}

export interface LocalCollection {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  items: LocalCollectionItem[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'claude_local_collections';

export const localCollections = {
  // Get all collections
  getAll(): LocalCollection[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Get single collection
  get(id: string): LocalCollection | null {
    const collections = this.getAll();
    return collections.find(c => c.id === id) || null;
  },

  // Create new collection
  create(name: string, description?: string): LocalCollection {
    const collections = this.getAll();
    const newCollection: LocalCollection = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      isPublic: false,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    collections.push(newCollection);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
    return newCollection;
  },

  // Update collection
  update(id: string, updates: Partial<LocalCollection>): LocalCollection | null {
    const collections = this.getAll();
    const index = collections.findIndex(c => c.id === id);
    if (index === -1) return null;

    collections[index] = {
      ...collections[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
    return collections[index];
  },

  // Delete collection
  delete(id: string): boolean {
    const collections = this.getAll();
    const filtered = collections.filter(c => c.id !== id);
    if (filtered.length === collections.length) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },

  // Add item to collection
  addItem(collectionId: string, item: LocalCollectionItem): boolean {
    const collection = this.get(collectionId);
    if (!collection) return false;

    // Check if item already exists
    const exists = collection.items.some(i => i.path === item.path && i.type === item.type);
    if (exists) return false;

    collection.items.push(item);
    this.update(collectionId, { items: collection.items });
    return true;
  },

  // Remove item from collection
  removeItem(collectionId: string, itemPath: string, itemType: string): boolean {
    const collection = this.get(collectionId);
    if (!collection) return false;

    const filtered = collection.items.filter(i => !(i.path === itemPath && i.type === itemType));
    if (filtered.length === collection.items.length) return false;

    this.update(collectionId, { items: filtered });
    return true;
  },

  // Save current cart as collection
  saveCartAsCollection(name: string, cart: any, description?: string): LocalCollection {
    const collection = this.create(name, description);
    
    // Add all cart items to collection
    for (const [type, items] of Object.entries(cart)) {
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          this.addItem(collection.id, {
            type,
            path: item.path,
            name: item.name,
            category: item.category,
          });
        }
      }
    }

    return this.get(collection.id)!;
  },
};
