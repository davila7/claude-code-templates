import type { Collection, CollectionItem } from './types';

const API_BASE = '';

async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }

  return data;
}

export const collectionsApi = {
  /** List all collections with their items */
  async list(token: string): Promise<Collection[]> {
    const data = await apiFetch<{ collections: Collection[] }>('/api/collections', token);
    return data.collections;
  },

  /** Create a new collection */
  async create(token: string, name: string): Promise<Collection> {
    const data = await apiFetch<{ collection: Collection }>('/api/collections', token, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return data.collection;
  },

  /** Rename a collection */
  async rename(token: string, id: string, name: string): Promise<Collection> {
    const data = await apiFetch<{ collection: Collection }>(`/api/collections/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    return data.collection;
  },

  /** Delete a collection */
  async delete(token: string, id: string): Promise<void> {
    await apiFetch(`/api/collections/${id}`, token, { method: 'DELETE' });
  },

  /** Add a component to a collection */
  async addItem(
    token: string,
    collectionId: string,
    component: { type: string; path: string; name: string; category?: string }
  ): Promise<CollectionItem> {
    const data = await apiFetch<{ item: CollectionItem }>('/api/collections/items', token, {
      method: 'POST',
      body: JSON.stringify({
        collectionId,
        componentType: component.type,
        componentPath: component.path,
        componentName: component.name,
        componentCategory: component.category,
      }),
    });
    return data.item;
  },

  /** Remove an item from a collection */
  async removeItem(token: string, itemId: string, collectionId: string): Promise<void> {
    await apiFetch('/api/collections/items', token, {
      method: 'DELETE',
      body: JSON.stringify({ itemId, collectionId }),
    });
  },

  /** Move an item between collections */
  async moveItem(
    token: string,
    itemId: string,
    fromCollectionId: string,
    toCollectionId: string
  ): Promise<CollectionItem> {
    const data = await apiFetch<{ item: CollectionItem }>('/api/collections/items', token, {
      method: 'PATCH',
      body: JSON.stringify({ itemId, fromCollectionId, toCollectionId }),
    });
    return data.item;
  },
};
