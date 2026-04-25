/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgendaItem, NotesData } from '../types';

const LEGACY_ITEMS_KEY = 'agenda_mental_items';
const CATEGORIES_KEY = 'agenda_mental_categories';
const NOTES_KEY = 'agenda_mental_notes';
const NOTES_UPDATED_AT_KEY = 'agenda_mental_notes_updated_at';

const DB_NAME = 'agenda_mental_db';
const DB_VERSION = 1;
const STORE_NAME = 'agenda_store';
const ITEMS_RECORD_KEY = 'items';

const safeParseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const isValidAgendaItem = (value: unknown): value is AgendaItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AgendaItem>;
  return (
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    typeof item.timestamp === 'number' &&
    typeof item.category === 'string' &&
    Array.isArray(item.completedDates) &&
    typeof item.recurrence === 'string'
  );
};

const normalizeItems = (value: unknown): AgendaItem[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isValidAgendaItem).map((item) => ({
    ...item,
    completedDates: item.completedDates || [],
  }));
};

const isIndexedDbAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB indisponivel'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Falha ao abrir IndexedDB'));
    });
  }

  return dbPromise;
};

const readItemsFromDb = async (): Promise<AgendaItem[] | null> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(ITEMS_RECORD_KEY);

    request.onsuccess = () => {
      if (typeof request.result === 'undefined') {
        resolve(null);
        return;
      }
      resolve(normalizeItems(request.result));
    };
    request.onerror = () => reject(request.error || new Error('Falha ao ler itens do IndexedDB'));
  });
};

const writeItemsToDb = async (items: AgendaItem[]): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(items, ITEMS_RECORD_KEY);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Falha ao salvar itens no IndexedDB'));
    tx.onabort = () => reject(tx.error || new Error('Transacao abortada no IndexedDB'));
  });
};

const readLegacyItems = (): AgendaItem[] => {
  const parsed = safeParseJson<unknown>(localStorage.getItem(LEGACY_ITEMS_KEY), []);
  return normalizeItems(parsed);
};

export const storage = {
  getItems: async (): Promise<AgendaItem[]> => {
    try {
      const dbItems = await readItemsFromDb();
      if (dbItems !== null) {
        return dbItems;
      }
    } catch {
      // Fallback para localStorage
    }

    const legacyItems = readLegacyItems();

    if (legacyItems.length > 0) {
      try {
        await writeItemsToDb(legacyItems);
      } catch {
        // Se falhar migracao para IndexedDB, segue com fallback localStorage
      }
    }

    return legacyItems;
  },

  saveItems: async (items: AgendaItem[]): Promise<void> => {
    const normalizedItems = normalizeItems(items);

    try {
      await writeItemsToDb(normalizedItems);
      try {
        localStorage.setItem(LEGACY_ITEMS_KEY, JSON.stringify(normalizedItems));
      } catch {
        // Se exceder limite do localStorage, segue com IndexedDB
      }
      return;
    } catch {
      // Fallback para localStorage
    }

    try {
      localStorage.setItem(LEGACY_ITEMS_KEY, JSON.stringify(normalizedItems));
    } catch {
      throw new Error('Nao foi possivel salvar os itens localmente.');
    }
  },

  getCategories: (): string[] => {
    const data = safeParseJson<unknown>(localStorage.getItem(CATEGORIES_KEY), []);
    if (!Array.isArray(data)) return [];
    return data.filter((value): value is string => typeof value === 'string');
  },

  saveCategories: (categories: string[]) => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  },

  getNotes: (): NotesData => {
    const content = localStorage.getItem(NOTES_KEY) || '';
    const rawUpdatedAt = localStorage.getItem(NOTES_UPDATED_AT_KEY);
    const parsedUpdatedAt = rawUpdatedAt ? Number(rawUpdatedAt) : NaN;

    return {
      content,
      updatedAt: Number.isFinite(parsedUpdatedAt) ? parsedUpdatedAt : null,
    };
  },

  saveNotes: (notes: NotesData) => {
    localStorage.setItem(NOTES_KEY, notes.content);
    if (notes.updatedAt === null) {
      localStorage.removeItem(NOTES_UPDATED_AT_KEY);
      return;
    }
    localStorage.setItem(NOTES_UPDATED_AT_KEY, String(notes.updatedAt));
  },
};
