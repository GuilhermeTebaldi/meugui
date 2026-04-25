/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Category = string;

export interface CategoryDefinition {
  label: string;
  iconName?: string; // Storing icon name as string for custom ones
  color?: string;
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'workdays' | 'mon-sat';

export interface AgendaItem {
  id: string;
  text: string;
  timestamp: number; 
  scheduledDate?: string; 
  category: Category;
  completedDates: string[]; // ISO date strings (yyyy-MM-dd)
  exceptionDates?: string[]; // ISO date strings to skip in recurring items
  recurrence: RecurrenceType;
  image?: string; // base64 string
}

export interface UserPreferences {
  categories: string[];
}

export interface NotesData {
  content: string;
  updatedAt: number | null;
}
