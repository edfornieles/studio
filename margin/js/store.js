// Local library storage (IndexedDB), with an in-memory fallback for private
// browsing. Uses the prototype's database name so existing libraries carry over.

const DB_NAME = 'margin-library-v2';
const DB_VERSION = 2; // v1: books. v2: + files (original PDFs), audio (narration cache)

function req(r) {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

class IdbStore {
  constructor(db) { this.db = db; this.memory = false; }
  tx(name, mode = 'readonly') { return this.db.transaction(name, mode).objectStore(name); }
  async all() { return (await req(this.tx('books').getAll())).map(normalizeBook); }
  async get(id) { const b = await req(this.tx('books').get(id)); return b ? normalizeBook(b) : null; }
  put(book) { return req(this.tx('books', 'readwrite').put(book)); }
  async remove(id) {
    await req(this.tx('books', 'readwrite').delete(id));
    await req(this.tx('files', 'readwrite').delete(id));
  }
  putFile(id, blob) { return req(this.tx('files', 'readwrite').put({ id, blob, saved: Date.now() })); }
  async getFile(id) { return (await req(this.tx('files').get(id)))?.blob || null; }
  audioGet(key) { return req(this.tx('audio').get(key)).catch(() => null); }
  audioPut(key, blob) { return req(this.tx('audio', 'readwrite').put(blob, key)).catch(() => null); }
}

class MemoryStore {
  constructor() { this.books = new Map(); this.files = new Map(); this.audio = new Map(); this.memory = true; }
  async all() { return [...this.books.values()].map(normalizeBook); }
  async get(id) { const b = this.books.get(id); return b ? normalizeBook(b) : null; }
  async put(b) { this.books.set(b.id, structuredClone(b)); }
  async remove(id) { this.books.delete(id); this.files.delete(id); }
  async putFile(id, blob) { this.files.set(id, blob); }
  async getFile(id) { return this.files.get(id) || null; }
  async audioGet(key) { return this.audio.get(key) || null; }
  async audioPut(key, blob) { this.audio.set(key, blob); }
}

export async function openStore(log = () => {}) {
  try {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
    };
    const db = await req(r);
    try { if (navigator.storage?.persist) log('storage', 'persist: ' + await navigator.storage.persist()); } catch { /* ignore */ }
    return new IdbStore(db);
  } catch (e) {
    log('storage', 'IndexedDB unavailable, using memory: ' + (e?.message || e));
    return new MemoryStore();
  }
}

let markSeq = 0;
export const newId = prefix => prefix + '-' + Date.now().toString(36) + '-' + (markSeq++).toString(36) + Math.random().toString(36).slice(2, 6);

// Upgrades records written by the 0.2 prototype ({page, marks:[{page(1-based), note, excerpt}]}).
export function normalizeBook(b) {
  const pages = Array.isArray(b.pages) ? b.pages : [];
  const position = b.position || { page: b.page || 0, chunk: 0 };
  const marks = (b.marks || []).map(m => ({
    id: m.id || newId('m'),
    kind: m.kind || (m.note ? 'note' : 'mark'),
    page: m.id ? m.page : Math.max(0, (m.page || 1) - 1), // prototype stored 1-based pages
    chunk: m.chunk ?? 0,
    excerpt: m.excerpt || '',
    note: m.note || '',
    date: m.date || new Date().toISOString(),
  }));
  return { ...b, pages, position, marks };
}
