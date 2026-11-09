globalThis.process ??= {}; globalThis.process.env ??= {};
const API_BASE = "";
const MAX_RETRIES = 2;
async function apiFetch(path, token, options = {}) {
  let lastError = null;
  const attempts = options.method && options.method !== "GET" ? 1 : MAX_RETRIES + 1;
  for (let i = 0; i < attempts; i++) {
    try {
      if (i > 0) await new Promise((r) => setTimeout(r, 500 * i));
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      return data;
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) continue;
    }
  }
  throw lastError;
}
const collectionsApi = {
  /** List all collections with their items */
  async list(token) {
    const data = await apiFetch("/api/collections", token);
    return data.collections;
  },
  /** Create a new collection */
  async create(token, name) {
    const data = await apiFetch("/api/collections", token, {
      method: "POST",
      body: JSON.stringify({ name })
    });
    return data.collection;
  },
  /** Rename a collection */
  async rename(token, id, name) {
    const data = await apiFetch(`/api/collections/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ name })
    });
    return data.collection;
  },
  /** Delete a collection */
  async delete(token, id) {
    await apiFetch(`/api/collections/${id}`, token, { method: "DELETE" });
  },
  /** Add a component to a collection */
  async addItem(token, collectionId, component) {
    const data = await apiFetch("/api/collections/items", token, {
      method: "POST",
      body: JSON.stringify({
        collectionId,
        componentType: component.type,
        componentPath: component.path,
        componentName: component.name,
        componentCategory: component.category
      })
    });
    return data.item;
  },
  /** Remove an item from a collection */
  async removeItem(token, itemId, collectionId) {
    await apiFetch("/api/collections/items", token, {
      method: "DELETE",
      body: JSON.stringify({ itemId, collectionId })
    });
  },
  /** Move an item between collections */
  async moveItem(token, itemId, fromCollectionId, toCollectionId) {
    const data = await apiFetch("/api/collections/items", token, {
      method: "PATCH",
      body: JSON.stringify({ itemId, fromCollectionId, toCollectionId })
    });
    return data.item;
  }
};

export { collectionsApi as c };
