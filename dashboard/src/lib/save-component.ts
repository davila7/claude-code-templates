import type { Collection, CollectionItem } from './types';

// One "save" of a component for a signed-in user, shared by the bookmark
// button and the pending action that resumes after sign-in.
//
// - Already in a collection: nothing is written.
// - No collections yet (first save): creates "My components" with the item;
//   the caller then opens /my-components, which shows its install command.
// - Otherwise: adds it to the first collection (the API lists them by position).

export const FIRST_COLLECTION_NAME = 'My components';

export interface SaveItem { type: string; path: string; name: string; category?: string }
export type SaveStatus = 'first' | 'added' | 'already';

export interface CollectionsClient {
  list(token: string): Promise<Collection[]>;
  create(token: string, name: string): Promise<Collection>;
  addItem(token: string, collectionId: string, item: SaveItem): Promise<CollectionItem>;
}

export function findSavedIn(collections: Collection[], item: Pick<SaveItem, 'type' | 'path'>): Collection | undefined {
  return collections.find((c) =>
    c.collection_items?.some((i) => i.component_type === item.type && i.component_path === item.path),
  );
}

export async function saveComponent(
  api: CollectionsClient,
  token: string,
  item: SaveItem,
  known?: Collection[],
): Promise<{ status: SaveStatus; collection: Collection }> {
  const collections = known ?? (await api.list(token));
  const existing = findSavedIn(collections, item);
  if (existing) return { status: 'already', collection: existing };

  if (collections.length === 0) {
    const created = await api.create(token, FIRST_COLLECTION_NAME);
    const added = await api.addItem(token, created.id, item);
    return { status: 'first', collection: { ...created, collection_items: [added] } };
  }

  const target = collections[0];
  const added = await api.addItem(token, target.id, item);
  return { status: 'added', collection: { ...target, collection_items: [...(target.collection_items ?? []), added] } };
}

export function myComponentsUrl(collectionId?: string): string {
  return collectionId ? `/my-components?collection=${encodeURIComponent(collectionId)}` : '/my-components';
}

// Lets every bookmark button on the page show the new state.
export const COLLECTIONS_CHANGED_EVENT = 'aitmpl:collections-changed';
export interface CollectionsChangedDetail { type: string; path: string; collectionId: string }
