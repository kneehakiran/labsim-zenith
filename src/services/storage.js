// Local progress storage (offline-first). Uses IndexedDB, with a localStorage fallback.
// Accounts live on the server; this file keeps each student's attempts on the device so they can
// practise offline, and marks which ones the server already has.

const DB_NAME = 'labsim';
const DB_VERSION = 1;
const STORE_PROFILES = 'profiles';
const STORE_ATTEMPTS = 'attempts';

function hasIndexedDB() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROFILES)) db.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
        const store = db.createObjectStore(STORE_ATTEMPTS, { keyPath: 'id' });
        store.createIndex('profileId', 'profileId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  });
}

// ---- localStorage fallback ----
const lsGet = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};
const lsSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: progress just is not saved */
  }
};

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** attempt: { experiment, mode, score, components, mistakes: [{id, count}], truth, endedAt } */
export async function saveAttempt(profileId, attempt) {
  const record = { id: uid(), profileId, synced: false, ...attempt };
  if (hasIndexedDB()) {
    const db = await openDB();
    await tx(db, STORE_ATTEMPTS, 'readwrite', (s) => s.put(record));
  } else {
    lsSet(STORE_ATTEMPTS, [...lsGet(STORE_ATTEMPTS), record]);
  }
  return record;
}

export async function listAttempts(profileId) {
  let all;
  if (hasIndexedDB()) {
    const db = await openDB();
    all = await tx(db, STORE_ATTEMPTS, 'readonly', (s) => s.index('profileId').getAll(profileId));
  } else {
    all = lsGet(STORE_ATTEMPTS).filter((a) => a.profileId === profileId);
  }
  return all.sort((a, b) => (b.endedAt || '').localeCompare(a.endedAt || ''));
}

/** Aggregate for the student dashboard. */
export function summarizeAttempts(attempts) {
  const mistakes = {};
  for (const a of attempts) for (const m of a.mistakes || []) mistakes[m.id] = (mistakes[m.id] || 0) + m.count;
  const scores = attempts.map((a) => a.score);
  return {
    count: attempts.length,
    best: scores.length ? Math.max(...scores) : 0,
    average: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : 0,
    repeatedMistakes: Object.entries(mistakes)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function markAttemptSynced(attempt) {
  const record = { ...attempt, synced: true };
  if (hasIndexedDB()) {
    const db = await openDB();
    await tx(db, STORE_ATTEMPTS, 'readwrite', (s) => s.put(record));
  } else {
    lsSet(
      STORE_ATTEMPTS,
      lsGet(STORE_ATTEMPTS).map((a) => (a.id === attempt.id ? record : a)),
    );
  }
  return record;
}

export async function unsyncedAttempts(profileId) {
  return (await listAttempts(profileId)).filter((a) => !a.synced);
}

/** Store attempts that came from the server (for example after logging in on a new device). */
export async function upsertAttempt(record) {
  if (hasIndexedDB()) {
    const db = await openDB();
    await tx(db, STORE_ATTEMPTS, 'readwrite', (s) => s.put(record));
  } else {
    lsSet(STORE_ATTEMPTS, [...lsGet(STORE_ATTEMPTS).filter((a) => a.id !== record.id), record]);
  }
}

// Assignments are cached so a student still sees them when offline.
export const cacheAssignments = (list) => prefs.set('assignments', JSON.stringify(list));
export function cachedAssignments() {
  try {
    return JSON.parse(prefs.get('assignments', '[]'));
  } catch {
    return [];
  }
}

// Language and the signed-in session are tiny, so they live in localStorage.
export const prefs = {
  get(key, fallback = null) {
    try {
      return localStorage.getItem(`labsim.${key}`) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(`labsim.${key}`);
      else localStorage.setItem(`labsim.${key}`, value);
    } catch {
      /* ignore */
    }
  },
};
