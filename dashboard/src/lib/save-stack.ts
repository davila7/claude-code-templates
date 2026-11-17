// "Save as collection" for a stack (traction plan, initiative 9): one new
// collection with every component of the stack, using the existing collections
// API one item per call. Used by the cart and by the pending action that
// resumes after sign-in (lib/resume-pending-action.ts).

import type { Collection, CollectionItem } from './types';
import { cleanStackPath, singularType, type Stack, type StackItem, type StackType } from './stack-link.ts';

export interface StackCollectionsClient {
  create(token: string, name: string): Promise<Collection>;
  addItem(token: string, collectionId: string, item: { type: string; path: string; name: string; category?: string }): Promise<CollectionItem>;
}

// What the catalog says about a component: the collections API stores the
// catalog's own type, path (with extension), name and category, like the Save
// button on a component page does.
export interface CatalogEntry { type?: string; name: string; path: string; category?: string }
export type FetchByType = (type: StackType) => Promise<CatalogEntry[]>;

export interface ResolvedItem { item: StackItem; entry: CatalogEntry | null }

export async function resolveStackItems(items: StackItem[], fetchByType: FetchByType): Promise<ResolvedItem[]> {
  const byType = new Map<StackType, Map<string, CatalogEntry>>();
  for (const type of new Set(items.map((i) => i.type))) {
    let list: CatalogEntry[] = [];
    try { list = await fetchByType(type); } catch { /* treated as missing */ }
    byType.set(type, new Map(list.map((c) => [cleanStackPath(c.path ?? c.name), c])));
  }
  return items.map((item) => ({ item, entry: byType.get(item.type)?.get(item.path) ?? null }));
}

export function stackCollectionName(created: string): string {
  return `My stack (${created})`;
}

export interface SaveStackResult { collection: Collection; saved: number; missing: number; failed: number }

export async function saveStackAsCollection(
  api: StackCollectionsClient,
  token: string,
  stack: Stack,
  fetchByType: FetchByType,
): Promise<SaveStackResult> {
  const resolved = await resolveStackItems(stack.items, fetchByType);
  const found = resolved.filter((r) => r.entry);
  if (found.length === 0) throw new Error('None of these components is in the catalog any more');

  const collection = await api.create(token, stackCollectionName(stack.created));
  const added: CollectionItem[] = [];
  let failed = 0;
  for (const { item, entry } of found) {
    try {
      added.push(await api.addItem(token, collection.id, {
        type: entry!.type || singularType(item.type),
        path: entry!.path || item.path,
        name: entry!.name,
        category: entry!.category,
      }));
    } catch {
      failed++;
    }
  }
  return {
    collection: { ...collection, collection_items: added },
    saved: added.length,
    missing: resolved.length - found.length,
    failed,
  };
}
