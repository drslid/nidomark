/** Tiny IndexedDB cache of embedding vectors, keyed by model and text hash. */
const DB_NAME = 'nidomark';
const STORE = 'vectors';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getVectors(keys: string[]): Promise<(Float32Array | undefined)[]> {
  const db = await open();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const out = await Promise.all(
    keys.map((k) => new Promise<Float32Array | undefined>((resolve) => {
      const r = store.get(k);
      r.onsuccess = () => resolve(r.result instanceof Float32Array ? r.result : undefined);
      r.onerror = () => resolve(undefined);
    })),
  );
  db.close();
  return out;
}

export async function putVectors(entries: [string, Float32Array][]): Promise<void> {
  if (!entries.length) return;
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  for (const [k, v] of entries) store.put(v, k);
  await done(tx);
  db.close();
}

export async function clearVectors(): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await done(tx);
  db.close();
}

/** 53-bit string hash (cyrb53), enough to key a cache. */
export function hashText(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
