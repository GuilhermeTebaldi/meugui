import { format, parseISO, isSameDay, isAfter, startOfDay, getDay, getDate } from 'date-fns';
import { AgendaItem } from '../types';

export const checkItemVisibility = (item: AgendaItem, targetDate: Date) => {
    if (!item.scheduledDate) return false;
    
    const dateKey = format(targetDate, 'yyyy-MM-dd');
    if (item.exceptionDates?.includes(dateKey)) return false;

    const itemDate = parseISO(item.scheduledDate);
    
    // If it's none, just check if it's the exact same day
    if (item.recurrence === 'none') {
      return isSameDay(itemDate, targetDate);
    }

    // Only show if the target date is on or after the scheduled date
    if (isAfter(startOfDay(itemDate), startOfDay(targetDate)) && !isSameDay(itemDate, targetDate)) {
      return false;
    }

    if (item.recurrence === 'daily') return true;
    
    if (item.recurrence === 'weekly') {
      return getDay(itemDate) === getDay(targetDate);
    }
    
    if (item.recurrence === 'monthly') {
      return getDate(itemDate) === getDate(targetDate);
    }

    if (item.recurrence === 'workdays') {
      const day = getDay(targetDate);
      return day >= 1 && day <= 5;
    }

    if (item.recurrence === 'mon-sat') {
      const day = getDay(targetDate);
      return day >= 1 && day <= 6;
    }

    return false;
  };


export function getItemsForDay(items: readonly AgendaItem[], date: Date): AgendaItem[] {
  return items.filter(item => checkItemVisibility(item, date)).sort((a, b) => a.timestamp - b.timestamp);
}
