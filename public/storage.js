let dbPromise;
export function openDB() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB)
        return reject(Error("IndexedDB unavailable; using memory."));
      const req = indexedDB.open("carbonqueue", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("workspace");
      req.onsuccess = () => {
        req.result.onversionchange = () => req.result.close();
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () =>
        reject(Error("Storage blocked by another tab. Close the older tab."));
    });
  return dbPromise;
}
export async function loadWorkspace() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readonly"),
      req = tx.objectStore("workspace").get("state");
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}
export async function storeWorkspace(state) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(state, "state");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error("Save aborted"));
  });
}
