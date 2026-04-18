/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgendaItem } from '../types';

const STORAGE_KEY = 'agenda_mental_items';
const CATEGORIES_KEY = 'agenda_mental_categories';

export const storage = {
  getItems: (): AgendaItem[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveItems: (items: AgendaItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  },
  getCategories: (): string[] => {
    const data = localStorage.getItem(CATEGORIES_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveCategories: (categories: string[]) => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  },
  getPreferences: () => {
    const data = localStorage.getItem('agenda_mental_prefs');
    return data ? JSON.parse(data) : { lastCategory: '', lastRecurrence: 'none' };
  },
  savePreferences: (prefs: { lastCategory: string; lastRecurrence: string }) => {
    localStorage.setItem('agenda_mental_prefs', JSON.stringify(prefs));
  },
  addItem: (item: AgendaItem) => {
    const items = storage.getItems();
    items.push(item);
    storage.saveItems(items);
  },
  updateItem: (updatedItem: AgendaItem) => {
    const items = storage.getItems();
    const index = items.findIndex(i => i.id === updatedItem.id);
    if (index !== -1) {
      items[index] = updatedItem;
      storage.saveItems(items);
    }
  },
  deleteItem: (id: string) => {
    const items = storage.getItems().filter(i => i.id !== id);
    storage.saveItems(items);
  }
};
