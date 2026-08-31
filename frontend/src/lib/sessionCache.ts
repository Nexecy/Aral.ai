import { ChatMessage, Flashcard, Notes } from './types';

/**
 * Crash-resilient cache for the active study workspace.
 *
 * Everything a session needs to be reconstructed after a reload, tab crash, or
 * offline drop is mirrored here: the document reference (and its raw blob), the
 * focus timer countdown, notes, generated flashcards, and the chat transcript.
 *
 * IndexedDB is the primary store because it can hold the document blob. When it
 * is unavailable (private mode, older embedded webviews, Capacitor edge cases)
 * we degrade to localStorage and simply skip the blob.
 */

const DB_NAME = 'aral_session_cache';
const DB_VERSION = 1;
const STATE_STORE = 'session_state';
const BLOB_STORE = 'document_blobs';
const LS_PREFIX = 'aral_session_state_';

/** Cached snapshots older than this are treated as abandoned, not recoverable. */
export const RECOVERY_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3;

export interface CachedSessionState {
  sessionId: string;
  title: string;
  documentId: string | null;
  documentName: string | null;
  /** Remote URL of the document; the blob mirror lives in the blob store. */
  fileUrl: string | null;
  hasBlob: boolean;
  viewMode: string;
  timerMode: string;
  timerSecondsLeft: number;
  timerRunning: boolean;
  focusSeconds: number;
  cardsReviewed: number;
  notes: Notes | null;
  flashcards: Flashcard[];
  chatMessages: ChatMessage[];
  /** False while the session is live; set true once the user cleanly exits. */
  finished: boolean;
  /** Owner of this snapshot — recovery never surfaces another account's cache. */
  userId: string | null;
  updatedAt: number;
}

export type CachedSessionPatch = Partial<Omit<CachedSessionState, 'sessionId'>>;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser() || !('indexedDB' in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function tx<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  run: (objectStore: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(store, mode);
      const request = run(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// ── localStorage fallback ────────────────────────────────────────────────────

function lsRead(sessionId: string): CachedSessionState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as CachedSessionState) : null;
  } catch {
    return null;
  }
}

function lsWrite(state: CachedSessionState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(LS_PREFIX + state.sessionId, JSON.stringify(state));
  } catch {
    // Quota exceeded — drop the chat transcript, which is the bulkiest field.
    try {
      window.localStorage.setItem(
        LS_PREFIX + state.sessionId,
        JSON.stringify({ ...state, chatMessages: state.chatMessages.slice(-10) })
      );
    } catch {
      /* give up silently; caching is best-effort */
    }
  }
}

function lsList(): CachedSessionState[] {
  if (!isBrowser()) return [];
  const out: CachedSessionState[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(LS_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      out.push(JSON.parse(raw) as CachedSessionState);
    }
  } catch {
    return out;
  }
  return out;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function emptySessionState(sessionId: string): CachedSessionState {
  return {
    sessionId,
    title: '',
    documentId: null,
    documentName: null,
    fileUrl: null,
    hasBlob: false,
    viewMode: 'split',
    timerMode: 'work',
    timerSecondsLeft: 0,
    timerRunning: false,
    focusSeconds: 0,
    cardsReviewed: 0,
    notes: null,
    flashcards: [],
    chatMessages: [],
    finished: false,
    userId: null,
    updatedAt: Date.now()
  };
}

export async function loadSessionState(sessionId: string): Promise<CachedSessionState | null> {
  const db = await openDb();
  if (db) {
    const record = await tx<CachedSessionState>(db, STATE_STORE, 'readonly', (s) => s.get(sessionId));
    if (record) return record;
  }
  return lsRead(sessionId);
}

/** Merge a partial update into the cached snapshot for a session. */
export async function saveSessionState(
  sessionId: string,
  patch: CachedSessionPatch
): Promise<void> {
  const existing = (await loadSessionState(sessionId)) || emptySessionState(sessionId);
  const next: CachedSessionState = {
    ...existing,
    ...patch,
    sessionId,
    updatedAt: Date.now()
  };

  const db = await openDb();
  if (db) {
    const ok = await tx(db, STATE_STORE, 'readwrite', (s) => s.put(next));
    if (ok !== null) return;
  }
  lsWrite(next);
}

export async function clearSessionState(sessionId: string): Promise<void> {
  const db = await openDb();
  if (db) {
    await tx(db, STATE_STORE, 'readwrite', (s) => s.delete(sessionId));
    await tx(db, BLOB_STORE, 'readwrite', (s) => s.delete(sessionId));
  }
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(LS_PREFIX + sessionId);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Sessions that were never cleanly exited, newest first. Used by the reload
 * recovery prompt.
 */
export async function listUnfinishedSessions(userId?: string | null): Promise<CachedSessionState[]> {
  const cutoff = Date.now() - RECOVERY_MAX_AGE_MS;
  let records: CachedSessionState[] = [];

  const db = await openDb();
  if (db) {
    const all = await tx<CachedSessionState[]>(db, STATE_STORE, 'readonly', (s) => s.getAll());
    if (all) records = all;
  }
  if (records.length === 0) records = lsList();

  return records
    .filter((r) => {
      if (!r || r.finished || r.updatedAt <= cutoff) return false;
      if (userId && r.userId && r.userId !== userId) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function cacheDocumentBlob(sessionId: string, blob: Blob): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const ok = await tx(db, BLOB_STORE, 'readwrite', (s) => s.put(blob, sessionId));
  return ok !== null;
}

export async function getDocumentBlob(sessionId: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return (await tx<Blob>(db, BLOB_STORE, 'readonly', (s) => s.get(sessionId))) || null;
}

/**
 * Trailing-edge debounce so high-frequency workspace updates (typing, timer
 * ticks, token streaming) collapse into one write.
 */
export function createDebouncedSaver(waitMs = 800) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: CachedSessionPatch = {};
  let pendingId: string | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pendingId) return;
    const id = pendingId;
    const patch = pending;
    pending = {};
    void saveSessionState(id, patch);
  };

  return {
    queue(sessionId: string, patch: CachedSessionPatch) {
      pendingId = sessionId;
      pending = { ...pending, ...patch };
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, waitMs);
    },
    flush,
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = {};
      pendingId = null;
    }
  };
}
