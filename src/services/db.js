const DB_NAME = 'RabbitHoleDB';
const DB_VERSION = 1;
const TOPICS_STORE = 'topics';
const IMAGES_STORE = 'images';

let dbPromise = null;

function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store for topics
      if (!db.objectStoreNames.contains(TOPICS_STORE)) {
        const store = db.createObjectStore(TOPICS_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Store for images
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: 'query' });
      }
    };
  });

  return dbPromise;
}

export async function saveTopics(topics) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TOPICS_STORE, 'readwrite');
    const store = transaction.objectStore(TOPICS_STORE);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    topics.forEach(topic => {
      const topicToSave = {
        ...topic,
        createdAt: topic.createdAt || Date.now()
      };
      store.put(topicToSave);
    });
  });
}

export async function getTopics() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TOPICS_STORE, 'readonly');
    const store = transaction.objectStore(TOPICS_STORE);
    const index = store.index('createdAt');
    const request = index.getAll();

    request.onsuccess = () => {
      // Sort descending (newest first)
      const results = request.result.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveImage(query, blob) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGES_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    store.put({ query, blob, timestamp: Date.now() });
  });
}

export async function getImage(query) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGES_STORE, 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.get(query);

    request.onsuccess = () => {
      resolve(request.result ? request.result.blob : null);
    };
    request.onerror = () => reject(request.error);
  });
}

// Function to check if a specific topic id exists
export async function topicExists(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TOPICS_STORE, 'readonly');
    const store = transaction.objectStore(TOPICS_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}
