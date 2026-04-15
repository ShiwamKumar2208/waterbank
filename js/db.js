const DB_NAME = "waterbank";
const DB_VERSION = 1;
const STORE_NAME = "documents";

let db;

// Init DB
export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      db = e.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });

        store.createIndex("pinned", "pinned", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };

    request.onerror = () => reject("DB init failed");
  });
}

export function addDoc(doc) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.add(doc);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject("Add failed");
  });
}

export function getAllDocs() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Fetch failed");
  });
}

export function getPinnedDocs() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      const result = request.result.filter(doc => doc.pinned === true);
      resolve(result);
    };

    request.onerror = () => reject("Pinned fetch failed");
  });
}

export function togglePin(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const request = store.get(id);

    request.onsuccess = () => {
      const doc = request.result;
      doc.pinned = !doc.pinned;
      store.put(doc);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject("Toggle failed");
  });
}

export function deleteDoc(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject("Delete failed");
  });
}

export function updateDoc(doc) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.put(doc);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject("Update failed");
  });
}