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
  AlertTriangle
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
  const [activeTab, setActiveTab ] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);

  // Edit/Delete Modals Mode
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<AgendaItem | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('');
  const [editRecurrence, setEditRecurrence] = useState<RecurrenceType>('none');
  const [editTime, setEditTime] = useState('');
  
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data on mount
  useEffect(() => {
    const savedItems = storage.getItems();
    const savedCats = storage.getCategories();
    const prefs = storage.getPreferences();
    
    setItems(savedItems);
    setCategories(savedCats);
    if (savedCats.length > 0) {
      setSelectedCategory(prefs.lastCategory || savedCats[0]);
    }
    setSelectedRecurrence(prefs.lastRecurrence || 'none');
  }, []);

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (categories.includes(newCategoryName.trim())) {
      setNewCategoryName('');
      return;
    }
    const updated = [...categories, newCategoryName.trim()];
    setCategories(updated);
    storage.saveCategories(updated);
    if (!selectedCategory) {
      setSelectedCategory(newCategoryName.trim());
    }
    setNewCategoryName('');
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file);
      setPendingImage(compressed);
    }
  };

  const deleteCategory = (cat: string) => {
    const updated = categories.filter(c => c !== cat);
    setCategories(updated);
    storage.saveCategories(updated);
    if (filterCategory === cat) setFilterCategory('Tudo');
    if (selectedCategory === cat) setSelectedCategory(updated[0] || '');
    setCategoryToDelete(null);
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
    storage.saveItems(newItems);
    storage.savePreferences({ lastCategory: selectedCategory, lastRecurrence: selectedRecurrence });
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
    storage.saveItems(newItems);
  };

  const deleteItem = (id: string, all: boolean = true) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    
    if (all) {
      const newItems = items.filter(item => item.id !== id);
      setItems(newItems);
      storage.saveItems(newItems);
    } else {
      const newItems = items.map(item => {
        if (item.id === id) {
          const exceptions = item.exceptionDates || [];
          return { ...item, exceptionDates: [...exceptions, dateKey] };
        }
        return item;
      });
      setItems(newItems);
      storage.saveItems(newItems);
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
    storage.saveItems(newItems);
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
    <div className="h-screen flex flex-col bg-bg text-ink selection:bg-accent/20 overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-highlight/5 blur-[120px] rounded-full animate-pulse [animation-delay:2s]" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex h-full overflow-hidden flex-col md:flex-row">
        
        {/* Sidebar Navigation - Glass Rail (Desktop) */}
        <nav className="hidden md:flex w-20 glass border-r border-black/5 flex-col items-center py-8 gap-8 flex-shrink-0">
          <div className="w-12 h-12 bg-white border border-black/5 rounded-2xl flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
            <Zap size={24} className="text-accent" />
          </div>
          
          <div className="flex flex-col gap-4 mt-8">
            <button 
              onClick={() => setActiveTab('list')}
              className={`p-3 rounded-2xl transition-all duration-500 ${activeTab === 'list' ? 'bg-accent/10 text-accent ring-1 ring-accent/20' : 'text-black/30 hover:text-black/60'}`}
            >
              <Clock size={24} />
            </button>
            <button 
              onClick={() => setActiveTab('calendar')}
              className={`p-3 rounded-2xl transition-all duration-500 ${activeTab === 'calendar' ? 'bg-highlight/10 text-highlight ring-1 ring-highlight/20' : 'text-black/30 hover:text-black/60'}`}
            >
              <CalendarDays size={24} />
            </button>
          </div>

          <div className="mt-auto flex flex-col gap-6 items-center">
            <div className="w-1 h-12 bg-gradient-to-b from-transparent via-black/5 to-transparent rounded-full" />
            <button className="text-black/10 hover:text-accent transition-colors">
              <MoreHorizontal size={20} />
            </button>
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-grow flex flex-col overflow-hidden relative">
          
          {/* Top Bar - Functional Glass */}
          <header className="h-16 md:h-20 flex items-center justify-between px-6 md:px-12 border-b border-black/5 glass backdrop-blur-3xl z-20">
            <div className="flex items-center gap-4 md:gap-6">
              <h2 className="font-display font-black text-lg md:text-xl tracking-tight uppercase text-black/80">
                {format(selectedDate, 'eeee, dd', { locale: ptBR })}
              </h2>
              <div className="h-4 w-[1px] bg-black/10 hidden md:block" />
              <div className="hidden md:flex items-center gap-4 overflow-x-auto no-scrollbar max-w-[400px]">
                <button
                  onClick={() => setFilterCategory('Tudo')}
                  className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${filterCategory === 'Tudo' ? 'text-accent' : 'text-black/30 hover:text-black/60'}`}
                >
                  Global
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${filterCategory === cat ? 'text-highlight' : 'text-black/30 hover:text-black/60'}`}
                  >
                    {cat}
                  </button>
                ))}
                
                <button 
                  onClick={() => setIsManageCategoriesOpen(true)} 
                  className="text-black/20 hover:text-accent transition-all flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span className="text-[8px] font-black uppercase tracking-widest hidden lg:block">Manage Sectors</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Mobile Category Toggle */}
              <div className="flex md:hidden items-center gap-2">
                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value)} 
                  className="bg-black/5 border-none text-[10px] font-black uppercase tracking-widest rounded-lg px-3 py-2 outline-none"
                >
                  <option value="Tudo">Global</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button 
                  onClick={() => setIsManageCategoriesOpen(true)} 
                  className="p-2 text-black/20 hover:text-accent"
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>
              
              <div className="hidden lg:flex flex-col items-end">
                <span className="text-[8px] font-black text-black/20 uppercase tracking-[0.3em]">Status</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-accent font-bold">ACTIVE_NODE</span>
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(0,209,255,1)]" />
                </div>
              </div>
            </div>
          </header>

          {/* List/Calendar View Container */}
          <div className="flex-grow overflow-y-auto no-scrollbar relative">
            <div className="max-w-[1600px] mx-auto px-4 md:px-12 py-8 md:py-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 relative">
                
                {/* Timeline Column */}
                <div className={`lg:col-span-4 space-y-8 pb-32 ${activeTab === 'list' ? 'block' : 'hidden lg:block'}`}>
                  <div className="flex items-end justify-between border-b border-black/5 pb-4">
                    <div>
                      <h1 className="font-display font-black text-3xl md:text-5xl uppercase tracking-tighter text-black/90">
                        Timeline
                      </h1>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        <span className="font-mono text-[9px] text-black/20 uppercase tracking-[0.2em]">
                          {filteredItems.length} SEQUENCES ACTIVE
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:gap-4">
                    {filteredItems.length === 0 ? (
                      <div className="py-24 md:py-32 flex flex-col items-center justify-center glass-card rounded-[2rem] border border-dashed border-black/5">
                        <Zap size={40} className="text-black/5 mb-4" />
                        <p className="text-black/30 font-mono text-[9px] tracking-[0.3em] uppercase">Ready for transmission...</p>
                      </div>
                    ) : (
                      <AnimatePresence mode="popLayout" initial={false}>
                        {filteredItems.map((item) => {
                          const isDone = item.completedDates?.includes(format(selectedDate, 'yyyy-MM-dd'));
                          return (
                            <motion.div
                              key={item.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              className={`group relative p-4 md:p-6 glass-card rounded-2xl border transition-all duration-300 ${isDone ? 'opacity-30' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                              style={{ borderColor: !isDone ? `${CATEGORY_STYLES[item.category] || 'rgba(0,0,0,0.05)'}22` : undefined }}
                            >
                              <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <button 
                                      onClick={() => toggleDone(item.id)}
                                      className={`w-8 h-8 rounded-xl border border-black/5 flex items-center justify-center transition-all duration-500 ${isDone ? 'bg-accent text-white border-accent shadow-[0_8px_15px_rgba(0,209,255,0.2)]' : 'bg-white hover:border-accent/30'}`}
                                    >
                                      <CheckCircle2 size={isDone ? 20 : 16} className={isDone ? 'text-white' : 'text-black/5'} />
                                    </button>
                                    <span className="font-mono text-lg font-bold tracking-tight text-accent">
                                      {format(item.timestamp, 'HH:mm')}
                                    </span>
                                  </div>
                                  <span className="text-[8px] font-black text-black/20 uppercase tracking-widest px-2 py-1 bg-black/5 rounded-md">
                                    {item.category || 'System'}
                                  </span>
                                </div>

                                <div className="flex-grow min-w-0">
                                  <p className={`text-base font-semibold tracking-tight leading-tight ${isDone ? 'line-through text-black/20' : 'text-black/80'}`}>
                                    {item.text}
                                  </p>
                                  {item.recurrence !== 'none' && (
                                    <div className="mt-2 flex items-center gap-1">
                                      <Repeat size={10} className="text-highlight/50" />
                                      <span className="text-[8px] font-bold text-highlight/50 uppercase tracking-widest">
                                        {RECURRENCE_OPTIONS.find(o => o.value === item.recurrence)?.label}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {item.image && (
                                  <div 
                                    className="relative cursor-zoom-in rounded-xl overflow-hidden group/img border-4 border-white shadow-md"
                                    onClick={() => setViewingImage(item.image!)}
                                  >
                                    <img src={item.image} className="w-full h-32 object-cover transition-transform duration-700 group-hover/img:scale-110" referrerPolicy="no-referrer" />
                                  </div>
                                )}

                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                  <button 
                                    onClick={() => {
                                      setEditingItem(item);
                                      setEditText(item.text);
                                      setEditCategory(item.category);
                                      setEditRecurrence(item.recurrence);
                                      setEditTime(format(item.timestamp, 'HH:mm'));
                                    }}
                                    className="p-2 text-black/20 hover:text-highlight transition-colors"
                                  >
                                    <Plus size={18} className="rotate-45" /> 
                                  </button>
                                  <button 
                                    onClick={() => item.recurrence === 'none' ? deleteItem(item.id) : setDeletingItem(item)}
                                    className="p-2 text-black/20 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                </div>

                {/* Matrix / Calendar Column */}
                <div className={`lg:col-span-8 space-y-8 pb-32 ${activeTab === 'calendar' ? 'block' : 'hidden lg:block'}`}>
                  {/* Subtle Divider for desktop */}
                  <div className="hidden lg:block absolute left-[33%] top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/5 to-transparent pointer-events-none" />
                  
                  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                      <h1 className="font-display font-black text-3xl md:text-6xl uppercase tracking-tighter text-black/90">Matrix</h1>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-highlight" />
                        <span className="font-mono text-[9px] text-black/20 uppercase tracking-[0.4em]">Spatial_Array Coordination</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 glass p-1.5 rounded-2xl border border-black/5 shadow-sm">
                       <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 text-black/30 hover:text-black transition-colors"><ChevronLeft size={20} /></button>
                       <span className="px-3 font-display font-bold text-sm md:text-base uppercase tracking-tight min-w-[140px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                       <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 text-black/30 hover:text-black transition-colors"><ChevronRight size={20} /></button>
                    </div>
                  </header>

                  <div className="glass-card rounded-[3rem] p-6 md:p-12 border border-black/5 relative overflow-hidden shadow-2xl bg-white/50">
                    <div className="grid grid-cols-7 gap-2 md:gap-4 relative z-10">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                        <div key={d} className="font-mono text-[8px] md:text-[10px] text-black/20 font-black uppercase text-center tracking-widest">{d}</div>
                      ))}
                      {monthDays.map((date) => {
                        const isSelected = isSameDay(date, selectedDate);
                        const hasItems = hasItemsOnDay(date);
                        const isCurrentMonth = isSameDay(startOfMonth(date), startOfMonth(currentMonth));
                        const isTdy = isToday(date);
                        
                        return (
                          <button
                            key={date.toString()}
                            onClick={() => {
                              setSelectedDate(date);
                              if (window.innerWidth < 1024) setActiveTab('list');
                            }}
                            className={`group relative aspect-square flex flex-col items-center justify-center rounded-[2rem] transition-all duration-500 ${isSelected ? 'bg-black text-white shadow-2xl scale-110' : 'hover:bg-black/5'} ${!isCurrentMonth ? 'opacity-10' : 'opacity-100'}`}
                          >
                            <span className={`text-base md:text-3xl font-display font-black ${isSelected ? 'text-white' : isTdy ? 'text-accent' : 'text-black/60'}`}>{format(date, 'd')}</span>
                            {hasItems && (
                              <div className={`w-1.5 h-1.5 rounded-full mt-2 transition-colors ${isSelected ? 'bg-accent' : 'bg-highlight/40'}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <button 
                      onClick={() => { setSelectedDate(startOfToday()); if (window.innerWidth < 1024) setActiveTab('list'); }}
                      className="mt-8 md:mt-12 w-full py-4 glass hover:bg-black/5 text-black/30 font-display font-bold uppercase tracking-[0.4em] text-[10px] transition-all duration-300 rounded-[2rem] border border-black/5"
                    >
                      Reset Core Time
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Bottom Navigation */}
          <nav className="md:hidden h-20 glass border-t border-black/5 px-6 flex items-center justify-between z-40">
            <button 
              onClick={() => setActiveTab('list')}
              className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'list' ? 'text-accent' : 'text-black/30'}`}
            >
              <div className={`w-12 h-1 px-4 mb-1 rounded-full transition-all ${activeTab === 'list' ? 'bg-accent' : 'bg-transparent'}`} />
              <Clock size={20} />
              <span className="text-[8px] font-black uppercase tracking-tighter">Timeline</span>
            </button>
            
            <button 
               onClick={() => {
                  const input = document.querySelector('input[placeholder="New Protocol..."]');
                  if (input) (input as HTMLInputElement).focus();
               }}
               className="relative -mt-10 group"
            >
              <div className="absolute inset-0 bg-accent blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="w-16 h-16 bg-black rounded-3xl flex items-center justify-center shadow-2xl border-[6px] border-white relative z-10 transition-transform active:scale-90">
                 <Zap size={24} className="text-accent fill-accent" />
              </div>
            </button>

            <button 
              onClick={() => setActiveTab('calendar')}
              className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'calendar' ? 'text-highlight' : 'text-black/30'}`}
            >
              <div className={`w-12 h-1 px-4 mb-1 rounded-full transition-all ${activeTab === 'calendar' ? 'bg-highlight' : 'bg-transparent'}`} />
              <CalendarDays size={20} />
              <span className="text-[8px] font-black uppercase tracking-tighter">Matrix</span>
            </button>
          </nav>

          {/* Liquid Command Center - Floating Input */}
          <div className="fixed bottom-24 md:absolute md:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 md:px-6 z-40">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-[9px] font-black text-black/40 uppercase tracking-[0.2em]">Neural Input_V2</span>
              <span className="text-[9px] font-black text-accent uppercase tracking-[0.2em] animate-pulse">Connection Stable</span>
            </div>
            <motion.div 
              layout
              className="glass border border-black/5 rounded-[2rem] p-2 flex flex-col gap-1 shadow-[0_20px_60px_rgba(0,0,0,0.1)]"
            >
              <div className="flex items-center h-14 md:h-16 px-4 md:px-6 relative">
                <input
                  type="text"
                  placeholder="New Protocol..."
                  className="flex-grow bg-transparent text-lg font-semibold outline-none placeholder:text-black/10 text-black/80"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem(true)}
                />
                
                <div className="flex items-center gap-2">
                  {pendingImage && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="relative">
                      <img src={pendingImage} className="w-10 h-10 rounded-xl object-cover ring-2 ring-accent shadow-sm" />
                      <button onClick={() => setPendingImage(null)} className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full p-1 border border-white text-white shadow-sm"><X size={8}/></button>
                    </motion.div>
                  )}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 rounded-xl transition-all duration-300 ${pendingImage ? 'text-accent' : 'text-black/20 hover:text-black/40'}`}
                  >
                    <Camera size={22} />
                  </button>
                  <button
                    onClick={() => handleAddItem(true)}
                    className="h-10 md:h-12 w-10 md:w-12 bg-black text-white rounded-full flex items-center justify-center transition-all duration-300 hover:bg-accent active:scale-95 shadow-md group"
                  >
                    <Plus size={24} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
                  </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
              </div>

              <div className="flex items-center justify-between px-4 pb-1 border-t border-black/5 pt-1">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-black/20 hover:text-accent transition-colors cursor-pointer relative">
                    <Clock size={11} />
                    <input type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="bg-transparent border-none p-0 text-[10px] font-black font-mono focus:ring-0 w-12 cursor-pointer" title="Sincronização Temporal" />
                  </div>
                  <div className="flex items-center gap-2 text-black/20 hover:text-highlight transition-colors cursor-pointer">
                    <Repeat size={11} />
                    <select value={selectedRecurrence} onChange={(e) => setSelectedRecurrence(e.target.value as RecurrenceType)} className="bg-transparent border-none p-0 text-[10px] font-black uppercase tracking-widest focus:ring-0 appearance-none pointer-events-auto" title="Frequência de Protocolo">
                      {RECURRENCE_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-white text-black">{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 text-black/20 hover:text-accent transition-colors cursor-pointer">
                    <Briefcase size={11} />
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-transparent border-none p-0 text-[10px] font-black uppercase tracking-widest focus:ring-0 appearance-none pointer-events-auto" title="Setor de Alocação">
                      {categories.map(cat => <option key={cat} value={cat} className="bg-white text-black">{cat}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </main>
      </div>

      {/* Futuristic Modals */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingItem(null)} className="absolute inset-0 bg-black/50 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white/90 backdrop-blur-2xl border border-black/5 p-8 rounded-[2.5rem] w-full max-w-lg shadow-[0_20px_80px_rgba(0,0,0,0.15)]">
              <h3 className="font-display font-black text-2xl uppercase tracking-widest mb-8 text-black/80">Modify Entry</h3>
              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase text-black/20 tracking-widest ml-1">Transmission Data</label>
                  <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full bg-black/5 border border-black/5 p-4 text-xl font-medium outline-none rounded-2xl focus:border-accent transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase text-black/20 tracking-widest ml-1">Temporal Sync</label>
                    <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full bg-black/5 border border-black/5 p-3 font-mono text-lg font-bold outline-none rounded-2xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase text-black/20 tracking-widest ml-1">Protocol Type</label>
                    <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as Category)} className="w-full bg-black/5 border border-black/5 p-3 font-mono text-sm font-bold outline-none rounded-2xl text-accent">
                      {categories.map(c => <option key={c} value={c} className="bg-white text-black">{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase text-black/20 tracking-widest ml-1">Recurrence Protocol</label>
                  <select value={editRecurrence} onChange={(e) => setEditRecurrence(e.target.value as RecurrenceType)} className="w-full bg-black/5 border border-black/5 p-3 font-mono text-sm font-bold outline-none rounded-2xl text-accent">
                    {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-white text-black">{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4 mt-10">
                <button onClick={() => setEditingItem(null)} className="flex-1 py-4 glass hover:bg-black/5 text-black/40 font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl border border-black/5 transition-all">Abort</button>
                <button onClick={handleUpdateItem} className="flex-1 py-4 bg-black text-white font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl shadow-xl hover:bg-accent transition-all">Execute</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingItem(null)} className="absolute inset-0 bg-black/50 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white/90 backdrop-blur-2xl border border-black/5 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl">
              <h3 className="font-display font-black text-2xl uppercase tracking-widest mb-4 text-red-500">Erase Protocol</h3>
              <p className="text-xs font-medium mb-10 text-black/40 leading-relaxed font-mono uppercase tracking-widest">Target confirmed for decommissioning. Select radius:</p>
              <div className="space-y-4">
                <button onClick={() => deleteItem(deletingItem.id, false)} className="w-full py-5 glass border-black/5 text-black/80 font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl hover:bg-black/5 transition-all flex items-center justify-between px-8">
                  <span>Single Synchronized Instance</span>
                  <ChevronRight size={14} />
                </button>
                <button onClick={() => deleteItem(deletingItem.id, true)} className="w-full py-5 bg-red-500/10 border border-red-500/20 text-red-600 font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-between px-8 text-shadow-none">
                  <span>Total Timeline Deletion</span>
                  <Trash2 size={14} />
                </button>
                <button onClick={() => setDeletingItem(null)} className="w-full py-4 text-black/20 font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl">Abort</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {categoryToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCategoryToDelete(null)} className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative glass-card border-black p-10 rounded-[2.5rem] w-full max-w-sm text-center shadow-2xl z-10">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle className="text-accent" size={24} />
              </div>
              <h3 className="font-display font-black text-2xl uppercase tracking-widest mb-4 text-black/80">Tem certeza que deseja excluir?</h3>
              <p className="text-[10px] font-medium mb-10 text-black/40 leading-relaxed uppercase tracking-widest">
                A categoria <span className="text-accent">"{categoryToDelete}"</span> será removida.
                Protocolos vinculados serão mantidos na Timeline Global.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setCategoryToDelete(null)} className="flex-1 py-4 glass text-black/40 font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl border-black/5 hover:bg-black/5 transition-all">Abort</button>
                <button onClick={() => deleteCategory(categoryToDelete)} className="flex-1 py-4 bg-accent text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-lg hover:bg-black transition-all">Confirm</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isManageCategoriesOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsManageCategoriesOpen(false)} className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative glass-card border-black p-8 rounded-[2.5rem] w-full max-w-lg shadow-[0_20px_80px_rgba(0,0,0,0.1)] z-10 flex flex-col h-[70vh] md:h-auto md:max-h-[80vh]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-display font-black text-2xl uppercase tracking-tighter text-black/90">Gerenciar Setores</h3>
                  <p className="text-[10px] font-mono text-black/30 uppercase tracking-widest">Protocol Architecture v4.0</p>
                </div>
                <button onClick={() => setIsManageCategoriesOpen(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X size={20} /></button>
              </div>

              <div className="flex-grow overflow-y-auto no-scrollbar mb-8 space-y-2 pr-2">
                {categories.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-black/5 rounded-3xl flex flex-col items-center justify-center">
                    <AlertTriangle size={32} className="text-black/10 mb-2" />
                    <p className="text-[10px] font-black text-black/20 uppercase tracking-widest">Nenhum setor ativo</p>
                  </div>
                ) : (
                  categories.map(cat => (
                    <div key={cat} className="flex items-center justify-between p-4 bg-black/5 rounded-2xl hover:bg-black/10 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_STYLES[cat] || '#00D1FF' }} />
                        <span className="font-bold uppercase tracking-widest text-xs">{cat}</span>
                      </div>
                      <button 
                        onClick={() => { setCategoryToDelete(cat); }}
                        className="p-2 text-black/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-auto pt-6 border-t border-black/5">
                <div className="flex items-end gap-3">
                  <div className="flex-grow space-y-2">
                    <label className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] ml-2">Novo Setor</label>
                    <input 
                      type="text" 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                      placeholder="NOME DO PROTOCOLO..."
                      className="w-full bg-white border border-black/10 p-4 rounded-2xl outline-none focus:border-accent font-bold uppercase text-sm tracking-widest shadow-sm text-black"
                    />
                  </div>
                  <button 
                    onClick={handleAddCategory}
                    className="h-[52px] w-[52px] bg-black text-white rounded-2xl flex items-center justify-center hover:bg-accent transition-all active:scale-95 shadow-lg"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setViewingImage(null)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/90 backdrop-blur-2xl" />
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center">
              <button 
                onClick={() => setViewingImage(null)}
                className="absolute -top-16 right-0 text-black/40 hover:text-accent transition-colors flex items-center gap-2 font-mono text-[10px] tracking-[0.5em] uppercase"
              >
                <X size={20} /> Close Stream
              </button>
              <img src={viewingImage} className="max-w-full max-h-full object-contain rounded-3xl border-8 border-white shadow-2xl" referrerPolicy="no-referrer" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
