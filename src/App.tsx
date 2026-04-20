/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Circle, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Briefcase,
  Home,
  CreditCard,
  Heart,
  MoreHorizontal,
  Trash2,
  CalendarDays,
  Repeat,
  Zap,
  Camera,
  X,
  Image as ImageIcon,
  LayoutGrid,
  Download,
  Upload,
  Settings
} from 'lucide-react';
import { 
  format, 
  addDays, 
  startOfToday, 
  isSameDay, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isToday,
  addMonths,
  subMonths,
  eachDayOfInterval,
  getDay,
  getDate,
  isAfter,
  startOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { AgendaItem, Category, RecurrenceType } from './types';
import { storage } from './lib/storage';

const CATEGORY_STYLES: Record<string, string> = {
  'Trabalho': '#007BFF',
  'Casa': '#FD7E14',
  'Pagamentos': '#28A745',
  'Saúde': '#DC3545',
  'Outros': '#6C757D',
};

const RECURRENCE_OPTIONS: { label: string; value: RecurrenceType }[] = [
  { label: 'Não repetir', value: 'none' },
  { label: 'Diário', value: 'daily' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Mensal', value: 'monthly' },
  { label: 'Seg-Sex', value: 'workdays' },
  { label: 'Seg-Sáb', value: 'mon-sat' },
];

export default function App() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>('');
  const [filterCategory, setFilterCategory] = useState<Category | 'Tudo'>('Tudo');
  const [selectedRecurrence, setSelectedRecurrence] = useState<RecurrenceType>('none');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedTime, setSelectedTime] = useState(format(new Date(), 'HH:mm'));
  const [activeTab, setActiveTab ] = useState<'list' | 'visual' | 'calendar'>('list');
  const [visualScope, setVisualScope] = useState<'day' | 'week' | 'all'>('day');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Edit/Delete Modals Mode
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<AgendaItem | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('');
  const [editRecurrence, setEditRecurrence] = useState<RecurrenceType>('none');
  const [editTime, setEditTime] = useState('');
  
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Load data on mount
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [savedItems, savedCats] = await Promise.all([
          storage.getItems(),
          Promise.resolve(storage.getCategories()),
        ]);

        if (!isMounted) return;
        setItems(savedItems);
        setCategories(savedCats);
        if (savedCats.length > 0) {
          setSelectedCategory(savedCats[0]);
        }
      } catch {
        if (!isMounted) return;
        alert('Nao foi possivel carregar os dados salvos neste dispositivo.');
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (settingsRef.current && !settingsRef.current.contains(target)) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('touchstart', closeOnOutsideClick);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('touchstart', closeOnOutsideClick);
    };
  }, [isSettingsOpen]);

  const saveItemsSafely = async (nextItems: AgendaItem[]) => {
    try {
      await storage.saveItems(nextItems);
    } catch {
      alert('Falha ao salvar. Faça um backup agora para evitar perdas.');
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (categories.includes(newCategoryName.trim())) {
      setNewCategoryName('');
      setIsAddingCategory(false);
      return;
    }
    const updated = [...categories, newCategoryName.trim()];
    setCategories(updated);
    storage.saveCategories(updated);
    if (categories.length === 0) {
      setSelectedCategory(newCategoryName.trim());
    }
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleExportBackup = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
      categories,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const filename = `agenda-mental-backup-${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { items?: unknown; categories?: unknown };

      if (!Array.isArray(parsed.items) || !Array.isArray(parsed.categories)) {
        throw new Error('Arquivo invalido');
      }

      const importedItems = (parsed.items as unknown[])
        .filter((value): value is AgendaItem => {
          if (!value || typeof value !== 'object') return false;
          const item = value as Partial<AgendaItem>;
          return (
            typeof item.id === 'string' &&
            typeof item.text === 'string' &&
            typeof item.timestamp === 'number' &&
            typeof item.category === 'string' &&
            typeof item.recurrence === 'string' &&
            Array.isArray(item.completedDates)
          );
        })
        .map((item) => ({ ...item, completedDates: item.completedDates || [] }));
      const importedCategories = parsed.categories.filter(
        (value): value is string => typeof value === 'string'
      );

      setItems(importedItems);
      setCategories(importedCategories);
      setSelectedCategory(importedCategories[0] || '');
      setFilterCategory('Tudo');
      storage.saveCategories(importedCategories);
      await saveItemsSafely(importedItems);
    } catch {
      alert('Backup invalido. Selecione um arquivo JSON gerado pelo sistema.');
    } finally {
      e.target.value = '';
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

  const compressImage = async (file: File): Promise<string> => {
    const sourceDataUrl = await readFileAsDataUrl(file);
    if (!sourceDataUrl) {
      throw new Error('Arquivo de imagem invalido');
    }

    // Em alguns celulares (HEIC/HEIF) o canvas pode falhar. Nesses casos, usa a imagem original.
    if (file.type.includes('heic') || file.type.includes('heif')) {
      return sourceDataUrl;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 380;
          const MAX_HEIGHT = 380;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else if (height >= width && height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(sourceDataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.65));
        } catch {
          resolve(sourceDataUrl);
        }
      };

      img.onerror = () => resolve(sourceDataUrl);
      img.src = sourceDataUrl;
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setPendingImage(compressed);
    } catch {
      alert('Nao foi possivel processar essa imagem no celular. Tente outra foto.');
    } finally {
      e.target.value = '';
    }
  };

  const deleteCategory = (cat: string) => {
    const updated = categories.filter(c => c !== cat);
    setCategories(updated);
    storage.saveCategories(updated);
    if (filterCategory === cat) setFilterCategory('Tudo');
    if (selectedCategory === cat) setSelectedCategory(updated[0] || '');
  };

  const handleAddItem = (isSpecificDay: boolean = false) => {
    if (!inputText.trim()) return;

    let finalTimestamp = Date.now();
    
    if (isSpecificDay) {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const scheduledDateWithTime = new Date(selectedDate);
      scheduledDateWithTime.setHours(hours, minutes, 0, 0);
      finalTimestamp = scheduledDateWithTime.getTime();
    }

    const newItem: AgendaItem = {
      id: crypto.randomUUID(),
      text: inputText,
      timestamp: finalTimestamp,
      category: selectedCategory,
      completedDates: [],
      scheduledDate: format(isSpecificDay ? selectedDate : new Date(), 'yyyy-MM-dd'),
      recurrence: selectedRecurrence,
      image: pendingImage || undefined,
    };

    const newItems = [...items, newItem];
    setItems(newItems);
    void saveItemsSafely(newItems);
    setInputText('');
    setPendingImage(null);
    // Reinicia o tempo para o momento atual para o próximo item
    setSelectedTime(format(new Date(), 'HH:mm'));
  };

  const toggleDone = (id: string) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const newItems = items.map(item => {
      if (item.id === id) {
        const isDone = item.completedDates?.includes(dateKey);
        const newCompletedDates = isDone 
          ? (item.completedDates || []).filter(d => d !== dateKey)
          : [...(item.completedDates || []), dateKey];
        return { ...item, completedDates: newCompletedDates };
      }
      return item;
    });
    setItems(newItems);
    void saveItemsSafely(newItems);
  };

  const deleteItem = (id: string, all: boolean = true) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    
    if (all) {
      const newItems = items.filter(item => item.id !== id);
      setItems(newItems);
      void saveItemsSafely(newItems);
    } else {
      const newItems = items.map(item => {
        if (item.id === id) {
          const exceptions = item.exceptionDates || [];
          return { ...item, exceptionDates: [...exceptions, dateKey] };
        }
        return item;
      });
      setItems(newItems);
      void saveItemsSafely(newItems);
    }
    setDeletingItem(null);
  };

  const handleUpdateItem = () => {
    if (!editingItem || !editText.trim()) return;

    const [hours, minutes] = editTime.split(':').map(Number);
    const updatedTimestamp = new Date(editingItem.timestamp);
    updatedTimestamp.setHours(hours, minutes);

    const newItems = items.map(item => {
      if (item.id === editingItem.id) {
        return {
          ...item,
          text: editText,
          category: editCategory,
          recurrence: editRecurrence,
          timestamp: updatedTimestamp.getTime()
        };
      }
      return item;
    });

    setItems(newItems);
    void saveItemsSafely(newItems);
    setEditingItem(null);
  };

  const checkItemVisibility = (item: AgendaItem, targetDate: Date) => {
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

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesDate = checkItemVisibility(item, selectedDate);
      const matchesCategory = filterCategory === 'Tudo' || item.category === filterCategory;
      return matchesDate && matchesCategory;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [items, selectedDate, filterCategory]);

  const selectedDateKey = useMemo(
    () => format(selectedDate, 'yyyy-MM-dd'),
    [selectedDate]
  );

  const visualWeekRange = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    return {
      start,
      end,
      days,
      startKey: format(start, 'yyyy-MM-dd'),
      endKey: format(end, 'yyyy-MM-dd'),
    };
  }, [selectedDate]);

  const visualItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = filterCategory === 'Tudo' || item.category === filterCategory;
      if (!matchesCategory) return false;

      if (visualScope === 'all') return true;
      if (visualScope === 'day') return checkItemVisibility(item, selectedDate);
      return visualWeekRange.days.some((day) => checkItemVisibility(item, day));
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [items, filterCategory, visualScope, selectedDate, visualWeekRange.days]);

  const isItemDoneInVisualScope = (item: AgendaItem): boolean => {
    const completedDates = item.completedDates || [];

    if (visualScope === 'all') {
      return completedDates.length > 0;
    }

    if (visualScope === 'week') {
      return completedDates.some((date) => (
        date >= visualWeekRange.startKey && date <= visualWeekRange.endKey
      ));
    }

    return completedDates.includes(selectedDateKey);
  };

  const visualSummary = useMemo(() => {
    const groupedByCategory: Record<string, AgendaItem[]> = {};
    let completed = 0;

    for (const item of visualItems) {
      if (isItemDoneInVisualScope(item)) {
        completed += 1;
      }

      if (!groupedByCategory[item.category]) {
        groupedByCategory[item.category] = [];
      }
      groupedByCategory[item.category].push(item);
    }

    const categoryCards = Object.entries(groupedByCategory)
      .map(([category, categoryItems]) => {
        const doneCount = categoryItems.filter((item) =>
          isItemDoneInVisualScope(item)
        ).length;

        return {
          category,
          items: categoryItems,
          doneCount,
          total: categoryItems.length,
        };
      })
      .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, 'pt-BR'));

    return {
      total: visualItems.length,
      completed,
      pending: visualItems.length - completed,
      categoryCards,
    };
  }, [visualItems, visualScope, selectedDateKey, visualWeekRange.startKey, visualWeekRange.endKey]);

  const handleCategoryFilterSelect = (category: string) => {
    setSelectedCategory(category);
    setFilterCategory((prev) => (prev === category ? 'Tudo' : category));
  };

  const hasItemsOnDay = (date: Date) => {
    return items.some(item => checkItemVisibility(item, date));
  };

  // Calendar rendering helpers
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  return (
    <div className="h-screen flex flex-col bg-bg text-ink selection:bg-highlight/20 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b-2 border-ink p-4 md:p-8 flex flex-col gap-4 z-30 shadow-sm flex-shrink-0">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatePresence initial={false}>
            {!isHeaderCollapsed && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4 md:space-y-6 mb-4"
              >
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-grow relative">
                    <input
                      type="text"
                      placeholder="Ex: Preciso ir ao médico às 14h"
                      className="w-full h-[50px] md:h-[60px] pl-4 md:pl-6 pr-12 text-lg md:text-xl bg-white border-2 border-ink rounded-sm outline-none placeholder:text-neutral-400"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddItem(false)}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {pendingImage && (
                        <div className="relative">
                          <img src={pendingImage} className="w-8 h-8 rounded-sm object-cover border border-ink" />
                          <button 
                            onClick={() => setPendingImage(null)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                          >
                            <X size={8} />
                          </button>
                        </div>
                      )}
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-2 rounded-sm transition-colors ${pendingImage ? 'text-highlight' : 'text-neutral-400 hover:text-ink'}`}
                      >
                        <Camera size={20} />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageChange} 
                        accept="image/*,image/heic,image/heif,image/jpeg,image/png,image/webp"
                        className="hidden" 
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddItem(false)}
                      className="flex-1 md:flex-none h-[50px] md:h-[60px] px-4 md:px-6 bg-ink text-white font-bold uppercase tracking-wider text-[11px] md:text-[13px] rounded-sm transition-all active:scale-95 border-2 border-ink"
                    >
                      Agora
                    </button>
                    <button
                      onClick={() => handleAddItem(true)}
                      className="flex-1 md:flex-none h-[50px] md:h-[60px] px-4 md:px-6 bg-white text-ink font-bold uppercase tracking-wider text-[11px] md:text-[13px] rounded-sm transition-all active:scale-95 border-2 border-ink hover:bg-neutral-50"
                    >
                      Agendar
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col md:flex-row md:items-center gap-4 py-2 border-t border-ink/5 pt-4">
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar flex-grow pr-4">
              <button 
                onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                className={`flex-shrink-0 p-2 border-2 border-ink rounded-sm transition-all ${isHeaderCollapsed ? 'bg-highlight text-white' : 'bg-white text-ink'}`}
                title={isHeaderCollapsed ? "Mostrar formulário" : "Ver apenas compromissos"}
              >
                <Plus size={16} className={`transition-transform duration-300 ${isHeaderCollapsed ? 'rotate-0' : 'rotate-45'}`} />
              </button>

              <button
                onClick={() => setFilterCategory('Tudo')}
                className={`text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 pb-1 ${
                  filterCategory === 'Tudo' 
                  ? 'text-ink border-highlight' 
                  : 'text-neutral-400 border-transparent hover:text-neutral-600'
                }`}
              >
                Tudo
              </button>
              {categories.map((cat) => (
                <div key={cat} className="group flex items-center gap-1">
                  <button
                    onClick={() => handleCategoryFilterSelect(cat)}
                    className={`text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 pb-1 ${
                      filterCategory === cat 
                      ? 'text-ink border-highlight' 
                      : 'text-neutral-400 border-transparent hover:text-neutral-600'
                    }`}
                  >
                    {cat}
                  </button>
                  <button 
                    onClick={() => deleteCategory(cat)}
                    className="opacity-0 group-hover:opacity-100 text-[8px] text-red-500 hover:text-red-700 transition-all font-black pb-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
              
              {isAddingCategory ? (
                <div className="flex items-center gap-2">
                  <input 
                    autoFocus
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    onBlur={() => !newCategoryName && setIsAddingCategory(false)}
                    placeholder="Nova..."
                    className="bg-neutral-50 border-b-2 border-ink text-[11px] font-bold uppercase outline-none px-1 w-20"
                  />
                  <button onClick={handleAddCategory} className="text-highlight font-black text-sm">✓</button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAddingCategory(true)}
                  className="text-neutral-300 hover:text-highlight transition-all"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              )}
            </div>

            <AnimatePresence>
              {!isHeaderCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 md:gap-4 overflow-x-auto no-scrollbar"
                >
                  <div className="flex items-center gap-2 bg-neutral-50 p-1.5 px-3 border border-border rounded-sm">
                    <Clock size={12} className="text-neutral-400" />
                    <input 
                      type="time" 
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="bg-transparent text-[11px] font-black border-none focus:ring-0 cursor-pointer p-0 h-auto"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 bg-neutral-50 p-1.5 px-3 border border-border rounded-sm whitespace-nowrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Repetir:</span>
                    <select 
                      value={selectedRecurrence}
                      onChange={(e) => setSelectedRecurrence(e.target.value as RecurrenceType)}
                      className="bg-transparent text-[11px] font-black uppercase tracking-widest border-none focus:ring-0 cursor-pointer p-0 h-auto appearance-none"
                    >
                      {RECURRENCE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0.5 bg-border min-h-full pb-24 lg:pb-0">
          {/* Main Content */}
        <section className={`bg-white p-6 md:p-10 space-y-8 ${activeTab === 'calendar' ? 'hidden lg:block' : 'block'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-ink uppercase">
              {format(selectedDate, 'eeee, d', { locale: ptBR })}
            </h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <span className="text-[10px] md:text-sm font-bold text-neutral-400 uppercase tracking-widest">
                {activeTab === 'visual' ? visualItems.length : filteredItems.length} Compromissos
              </span>

              <div className="flex items-center border border-border rounded-sm overflow-hidden">
                <button
                  onClick={() => setActiveTab('list')}
                  className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                    activeTab === 'list' ? 'bg-ink text-white' : 'bg-white text-neutral-500 hover:text-ink'
                  }`}
                >
                  <Clock size={12} />
                  Lista
                </button>
                <button
                  onClick={() => setActiveTab('visual')}
                  className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                    activeTab === 'visual' ? 'bg-highlight text-white' : 'bg-white text-neutral-500 hover:text-ink'
                  }`}
                >
                  <LayoutGrid size={12} />
                  Visual
                </button>
              </div>

              {filterCategory !== 'Tudo' && (
                <button
                  onClick={() => setFilterCategory('Tudo')}
                  className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border border-border rounded-sm text-neutral-500 hover:text-ink hover:border-ink transition-colors"
                >
                  Ver Tudo
                </button>
              )}

              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border rounded-sm transition-colors flex items-center gap-1.5 ${
                    isSettingsOpen
                      ? 'border-ink text-ink bg-neutral-50'
                      : 'border-border text-neutral-500 hover:text-ink hover:border-ink'
                  }`}
                  title="Opções"
                  aria-label="Abrir opções"
                >
                  <Settings size={13} />
                </button>

                {isSettingsOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-border rounded-sm shadow-lg z-40 p-1">
                    <button
                      onClick={() => {
                        handleExportBackup();
                        setIsSettingsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-neutral-600 hover:bg-neutral-50 hover:text-ink rounded-sm flex items-center gap-2"
                    >
                      <Download size={12} />
                      Backup
                    </button>
                    <button
                      onClick={() => {
                        backupInputRef.current?.click();
                        setIsSettingsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-neutral-600 hover:bg-neutral-50 hover:text-ink rounded-sm flex items-center gap-2"
                    >
                      <Upload size={12} />
                      Restaurar
                    </button>
                  </div>
                )}
              </div>
              <input
                ref={backupInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </div>
          </div>

          {activeTab === 'visual' ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center border border-border rounded-sm overflow-hidden">
                  <button
                    onClick={() => setVisualScope('day')}
                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      visualScope === 'day' ? 'bg-ink text-white' : 'bg-white text-neutral-500 hover:text-ink'
                    }`}
                  >
                    Dia
                  </button>
                  <button
                    onClick={() => setVisualScope('week')}
                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      visualScope === 'week' ? 'bg-ink text-white' : 'bg-white text-neutral-500 hover:text-ink'
                    }`}
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => setVisualScope('all')}
                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      visualScope === 'all' ? 'bg-ink text-white' : 'bg-white text-neutral-500 hover:text-ink'
                    }`}
                  >
                    Todos
                  </button>
                </div>

                {visualScope === 'week' && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    {format(visualWeekRange.start, 'd MMM', { locale: ptBR })} a {format(visualWeekRange.end, 'd MMM', { locale: ptBR })}
                  </span>
                )}
              </div>

              {visualItems.length === 0 ? (
                <div className="py-20 md:py-24 text-center border-2 border-dashed border-border rounded-sm">
                  <LayoutGrid className="mx-auto mb-4 text-neutral-200" size={40} />
                  <p className="text-neutral-400 font-bold uppercase text-[10px] tracking-widest">Sem itens para visualizar</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 border border-border rounded-sm bg-neutral-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Total</p>
                      <p className="text-2xl font-black text-ink">{visualSummary.total}</p>
                    </div>
                    <div className="p-4 border border-border rounded-sm bg-neutral-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Pendentes</p>
                      <p className="text-2xl font-black text-ink">{visualSummary.pending}</p>
                    </div>
                    <div className="p-4 border border-border rounded-sm bg-neutral-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Concluídos</p>
                      <p className="text-2xl font-black text-green-600">{visualSummary.completed}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {visualSummary.categoryCards.map((categoryCard) => {
                      const completionRate = categoryCard.total > 0
                        ? Math.round((categoryCard.doneCount / categoryCard.total) * 100)
                        : 0;

                      return (
                        <div
                          key={categoryCard.category}
                          className="p-4 border border-border rounded-sm bg-white shadow-sm"
                          style={{ borderLeft: `4px solid ${CATEGORY_STYLES[categoryCard.category] || '#343A40'}` }}
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                              <p className="text-sm font-black uppercase tracking-wider text-ink">
                                {categoryCard.category || 'Sem categoria'}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                {categoryCard.doneCount}/{categoryCard.total} concluídos
                              </p>
                            </div>
                            <span className="text-xs font-black text-highlight">{completionRate}%</span>
                          </div>

                          <div className="h-2 bg-neutral-100 rounded-full mb-4 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${completionRate}%`,
                                backgroundColor: CATEGORY_STYLES[categoryCard.category] || '#343A40',
                              }}
                            />
                          </div>

                          <div className="space-y-2">
                            {categoryCard.items.slice(0, 4).map((item) => {
                              const isDone = isItemDoneInVisualScope(item);
                              return (
                                <div key={item.id} className="flex items-center gap-2.5 p-2 border border-border rounded-sm">
                                  <span className="text-[11px] font-black text-highlight tabular-nums min-w-[42px]">
                                    {format(item.timestamp, 'HH:mm')}
                                  </span>
                                  <p className={`text-sm font-medium truncate flex-1 ${isDone ? 'line-through text-neutral-400' : 'text-ink'}`}>
                                    {item.text}
                                  </p>
                                  {isDone ? (
                                    <CheckCircle2 size={14} className="text-green-600" />
                                  ) : (
                                    <Circle size={14} className="text-neutral-300" />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {categoryCard.items.length > 4 && (
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                              +{categoryCard.items.length - 4} compromisso(s)
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.length === 0 ? (
                <div className="py-20 md:py-24 text-center border-2 border-dashed border-border rounded-sm">
                  <Clock className="mx-auto mb-4 text-neutral-200" size={40} />
                  <p className="text-neutral-400 font-bold uppercase text-[10px] tracking-widest">Lista vazia</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  {filteredItems.map((item) => {
                    const isDone = item.completedDates?.includes(selectedDateKey);
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={`flex flex-col md:grid md:grid-cols-[80px_1fr_120px] items-start md:items-center p-4 md:p-5 border border-border rounded-sm transition-all gap-3 md:gap-4 ${isDone ? 'opacity-40 grayscale' : 'bg-white hover:bg-neutral-50 shadow-sm md:shadow-none'}`}
                        style={!isDone ? { borderLeft: `4px solid ${CATEGORY_STYLES[item.category] || '#343A40'}` } : {}}
                      >
                        <div className="flex items-center justify-between w-full md:w-auto">
                          <span className="text-sm font-black text-highlight tabular-nums">
                            {format(item.timestamp, 'HH:mm')}
                          </span>
                          <div className="md:hidden text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                            {item.category}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 w-full">
                          <button 
                            onClick={() => toggleDone(item.id)}
                            className={`flex-shrink-0 w-6 h-6 border-2 border-ink rounded-sm flex items-center justify-center transition-colors ${isDone ? 'bg-ink' : 'bg-transparent'}`}
                          >
                            {isDone && <CheckCircle2 size={16} className="text-white" />}
                          </button>
                          
                          {item.image && (
                            <div 
                              className="relative group flex-shrink-0 cursor-zoom-in"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingImage(item.image!);
                              }}
                            >
                              <img 
                                src={item.image} 
                                className={`w-12 h-12 md:w-16 md:h-16 object-cover rounded-sm border-2 border-ink transition-all ${isDone ? 'grayscale opacity-50' : ''}`}
                                referrerPolicy="no-referrer"
                              />
                              {/* Expand icon purely decorational or for future full-screen view */}
                              <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-sm">
                                <ImageIcon size={14} className="text-white" />
                              </div>
                            </div>
                          )}

                          <p className={`text-base font-medium break-words overflow-hidden ${isDone ? 'line-through' : 'text-ink'}`}>
                            {item.text}
                          </p>
                        </div>

                        <div className="text-right w-full md:w-auto space-y-1 mt-2 md:mt-0 flex md:flex-col items-center md:items-end justify-between md:justify-end">
                          <div className="hidden md:block text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                            {item.category}
                          </div>
                          {item.recurrence !== 'none' && (
                            <div className="text-[9px] font-bold text-highlight uppercase tracking-[0.2em] flex items-center justify-end gap-1">
                              <Repeat size={10} />
                              {RECURRENCE_OPTIONS.find(o => o.value === item.recurrence)?.label}
                            </div>
                          )}
                          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-end gap-2 mt-2 md:mt-0">
                            <button 
                              onClick={() => {
                                setEditingItem(item);
                                setEditText(item.text);
                                setEditCategory(item.category);
                                setEditRecurrence(item.recurrence);
                                setEditTime(format(item.timestamp, 'HH:mm'));
                              }}
                              className="text-highlight hover:underline text-[10px] font-bold uppercase transition-colors"
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => {
                                if (item.recurrence === 'none') {
                                  deleteItem(item.id, true);
                                } else {
                                  setDeletingItem(item);
                                }
                              }}
                              className="text-red-500 hover:text-red-700 text-[10px] font-bold uppercase transition-colors"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          )}
        </section>

        {/* Side Panel / Mobile Calendar Tab */}
        <aside className={`bg-[#F1F3F5] p-6 md:p-10 flex-col gap-10 ${activeTab === 'calendar' ? 'flex' : 'hidden'} lg:flex`}>
          <div className="bg-white border border-border p-5 rounded-sm shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-neutral-100 rounded-sm border border-transparent hover:border-border transition-all"><ChevronLeft size={16} /></button>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-neutral-100 rounded-sm border border-transparent hover:border-border transition-all"><ChevronRight size={16} /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                <div key={`${day}-${index}`} className="h-8 flex items-center justify-center text-[10px] font-bold text-neutral-300">
                  {day}
                </div>
              ))}
              {monthDays.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                const hasItems = hasItemsOnDay(date);
                const isCurrentMonth = isSameDay(startOfMonth(date), startOfMonth(currentMonth));
                
                return (
                  <button
                    key={date.toString()}
                    onClick={() => {
                      setSelectedDate(date);
                      if (window.innerWidth < 1024) setActiveTab('list');
                    }}
                    className={`aspect-square flex items-center justify-center text-[11px] font-bold rounded-sm transition-all border ${
                      isSelected 
                        ? 'bg-ink text-white border-ink' 
                        : hasItems 
                          ? 'border-highlight text-highlight' 
                          : 'border-transparent text-ink hover:border-neutral-200'
                    } ${!isCurrentMonth ? 'opacity-20' : ''}`}
                  >
                    {format(date, 'd')}
                  </button>
                );
              })}
            </div>
            
            <button 
              onClick={() => {
                setSelectedDate(startOfToday());
                if (window.innerWidth < 1024) setActiveTab('list');
              }}
              className="w-full mt-4 p-3 border-2 border-ink bg-white text-ink text-[11px] font-black uppercase tracking-widest hover:bg-ink hover:text-white transition-all rounded-sm"
            >
              Hoje
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-neutral-400 uppercase tracking-widest">Informações</h4>
            <div className="p-5 bg-white border-2 border-ink rounded-sm space-y-3">
              <p className="text-[13px] leading-relaxed font-bold italic">
                Sua agenda é 100% privada e reside apenas neste dispositivo.
              </p>
              <div className="h-0.5 bg-ink w-full opacity-10" />
              <p className="text-[13px] leading-relaxed flex items-center gap-2 font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Sistema Operacional
              </p>
            </div>
          </div>
        </aside>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-ink p-3 grid grid-cols-3 lg:hidden z-40">
        <button 
          onClick={() => setActiveTab('list')}
          className={`flex flex-col items-center justify-center py-2 gap-1 transition-all ${activeTab === 'list' ? 'text-highlight' : 'text-neutral-400'}`}
        >
          <Clock size={20} className={activeTab === 'list' ? 'fill-highlight/10' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">Agenda</span>
        </button>
        <button 
          onClick={() => setActiveTab('visual')}
          className={`flex flex-col items-center justify-center py-2 gap-1 transition-all ${activeTab === 'visual' ? 'text-highlight' : 'text-neutral-400'}`}
        >
          <LayoutGrid size={20} className={activeTab === 'visual' ? 'fill-highlight/10' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">Visual</span>
        </button>
        <button 
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center justify-center py-2 gap-1 transition-all ${activeTab === 'calendar' ? 'text-highlight' : 'text-neutral-400'}`}
        >
          <CalendarDays size={20} className={activeTab === 'calendar' ? 'fill-highlight/10' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">Calendário</span>
        </button>
      </nav>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingItem(null)}
              className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white border-4 border-ink p-6 md:p-8 w-full max-w-md shadow-[10px_10px_0px_#000]"
            >
              <h3 className="text-xl font-black uppercase tracking-tighter mb-6">Editar Compromisso</h3>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Texto</label>
                  <input 
                    type="text" 
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full border-2 border-ink p-3 text-lg font-bold outline-none rounded-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-neutral-400">Hora</label>
                    <input 
                      type="time" 
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full border-2 border-ink p-2 font-bold outline-none rounded-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-neutral-400">Categoria</label>
                    <select 
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full border-2 border-ink p-2 font-bold outline-none rounded-sm"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Repetir</label>
                  <select 
                    value={editRecurrence}
                    onChange={(e) => setEditRecurrence(e.target.value as RecurrenceType)}
                    className="w-full border-2 border-ink p-2 font-bold outline-none rounded-sm"
                  >
                    {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setEditingItem(null)}
                  className="flex-1 p-3 border-2 border-ink font-bold uppercase text-sm hover:bg-neutral-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleUpdateItem}
                  className="flex-1 p-3 bg-ink text-white font-bold uppercase text-sm hover:opacity-90 transition-opacity"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingItem(null)}
              className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white border-4 border-ink p-6 md:p-8 w-full max-w-sm shadow-[10px_10px_0px_#000]"
            >
              <h3 className="text-xl font-black uppercase tracking-tighter mb-4 text-red-600">Excluir Compromisso</h3>
              <p className="text-sm font-medium mb-8 text-neutral-600">
                Este é um compromisso recorrente. Como deseja excluí-lo?
              </p>

              <div className="space-y-3">
                <button 
                  onClick={() => deleteItem(deletingItem.id, false)}
                  className="w-full p-4 border-2 border-ink font-bold uppercase text-[11px] tracking-widest hover:bg-neutral-50 transition-all flex items-center justify-between group"
                >
                  <span>Apenas desta data</span>
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => deleteItem(deletingItem.id, true)}
                  className="w-full p-4 bg-red-600 text-white border-2 border-ink font-bold uppercase text-[11px] tracking-widest hover:bg-red-700 transition-all flex items-center justify-between group shadow-[4px_4px_0px_#000]"
                >
                  <span>Todas as ocorrências</span>
                  <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={() => setDeletingItem(null)}
                  className="w-full p-4 text-neutral-400 font-bold uppercase text-[10px] tracking-widest hover:text-ink transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {viewingImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingImage(null)}
              className="absolute inset-0 bg-ink/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center"
            >
              <button 
                onClick={() => setViewingImage(null)}
                className="absolute -top-12 right-0 text-white hover:text-highlight transition-colors flex items-center gap-2 font-bold uppercase text-[10px] tracking-widest"
              >
                <X size={20} /> FECHAR
              </button>
              <img 
                src={viewingImage} 
                className="max-w-full max-h-full object-contain border-4 border-white shadow-[20px_20px_0px_#000] rounded-sm" 
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
