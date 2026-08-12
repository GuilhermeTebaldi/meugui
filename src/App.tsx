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
  Search,
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
  FileText,
  Download,
  Upload,
  Settings,
  AlertTriangle,
  Languages
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
import { ptBR, it } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { AgendaItem, Category, RecurrenceType } from './types';
import { storage } from './lib/storage';

type Language = 'pt' | 'it';

const LANGUAGE_STORAGE_KEY = 'agenda_mental_language';

const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'pt';
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'it' ? 'it' : 'pt';
};

const TRANSLATIONS = {
  pt: {
    recurrence: { none: 'Não repetir', daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', workdays: 'Seg-Sex', monSat: 'Seg-Sáb' },
    alerts: { load: 'Nao foi possivel carregar os dados salvos neste dispositivo.', save: 'Falha ao salvar. Faça um backup agora para evitar perdas.', notes: 'Nao foi possivel salvar o bloco de notas neste dispositivo.', invalidBackup: 'Backup invalido. Selecione um arquivo JSON gerado pelo sistema.', invalidImage: 'Nao foi possivel abrir essa foto no navegador. No iPhone, ajuste a camera para Mais Compativel/JPEG ou escolha uma foto JPG/PNG.' },
    placeholders: { task: 'Ex: Preciso ir ao médico às 14h', newCategory: 'Nova...', search: 'Pesquisar marcações do dia...', notes: 'Escreva suas notas aqui...' },
    titles: { addNow: 'Registrar agora', addNowDisabled: 'O botão Agora só funciona no dia atual', collapseOpen: 'Mostrar formulário', collapseClose: 'Ver apenas compromissos', options: 'Opções', openOptions: 'Abrir opções', clearSearch: 'Limpar pesquisa', today: 'Dia atual', completedOnDay: 'Tarefas concluídas neste dia' },
    ui: { all: 'Tudo', now: 'Agora', today: 'Hoje', schedule: 'Agendar', repeat: 'Repetir:', notesTitle: 'Bloco de Notas', privateNotes: 'Notas', appointments: ' notas', list: 'Lista', visual: 'Visual', notes: 'Notas', calendar: 'Calendário', seeAll: 'Ver Tudo', backup: 'Backup', restore: 'Restaurar', language: 'Linguagem', portuguese: 'Português', italian: 'Italiano', searchTopic: 'Tópico: Marcações do dia', results: 'resultado(s)', noResults: 'Nenhuma marcação encontrada.', showing: 'Mostrando', of: 'de', freeNotes: 'Espaço livre para anotações rápidas.', chars: 'chars', lastUpdate: 'Ultima atualizacao:', noUpdate: 'Sem atualizacao', day: 'Dia', week: 'Semana', total: 'Total', pending: 'Pendentes', completed: 'Concluídos', noVisualItems: 'Sem itens para visualizar', uncategorized: 'Sem categoria', completedLower: 'concluídos', noCategoryItems: 'Sem marcações nesta categoria.', emptyList: 'Lista vazia', info: 'Informações', privacy: 'Sua agenda é 100% privada e reside apenas neste dispositivo.', operational: 'Sistema Operacional', agenda: 'Agenda', edit: 'Editar', delete: 'Excluir', close: 'FECHAR', doneAt: 'Feito às', timeConnector: 'às' },
    editModal: { title: 'Editar Compromisso', text: 'Texto', time: 'Hora', category: 'Categoria', repeat: 'Repetir', cancel: 'Cancelar', save: 'Salvar' },
    undoModal: { eyebrow: 'Desfazer conclusão', title: 'Perder horário salvo?', beforeDate: 'Esta tarefa foi marcada como feita em', afterDate: 'Ao desfazer, esse horário será apagado.', keep: 'Manter', undo: 'Desfazer' },
    deleteModal: { title: 'Excluir Compromisso', single: 'Tem certeza que deseja excluir este compromisso?', recurring: 'Este é um compromisso recorrente. Como deseja excluí-lo?', cancel: 'Cancelar', delete: 'Excluir', onlyThisDate: 'Apenas desta data', allOccurrences: 'Todas as ocorrências' },
    searchTerms: { done: 'concluido concluída concluido done feito', pending: 'pendente aberta' },
    weekdays: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
    dateRangeSeparator: 'a',
  },
  it: {
    recurrence: { none: 'Non ripetere', daily: 'Giornaliero', weekly: 'Settimanale', monthly: 'Mensile', workdays: 'Lun-Ven', monSat: 'Lun-Sab' },
    alerts: { load: 'Non è stato possibile caricare i dati salvati su questo dispositivo.', save: 'Salvataggio non riuscito. Crea subito un backup per evitare perdite.', notes: 'Non è stato possibile salvare il blocco note su questo dispositivo.', invalidBackup: 'Backup non valido. Seleziona un file JSON generato dal sistema.', invalidImage: 'Non è stato possibile aprire questa foto nel browser. Su iPhone, imposta la fotocamera su Massima compatibilità/JPEG oppure scegli una foto JPG/PNG.' },
    placeholders: { task: 'Es: Devo andare dal medico alle 14:00', newCategory: 'Nuova...', search: 'Cerca le voci del giorno...', notes: 'Scrivi qui le tue note...' },
    titles: { addNow: 'Registra adesso', addNowDisabled: 'Il pulsante Adesso funziona solo nel giorno corrente', collapseOpen: 'Mostra modulo', collapseClose: 'Mostra solo impegni', options: 'Opzioni', openOptions: 'Apri opzioni', clearSearch: 'Cancella ricerca', today: 'Giorno corrente', completedOnDay: 'Attività completate in questo giorno' },
    ui: { all: 'Tutto', now: 'Adesso', today: 'Oggi', schedule: 'Programma', repeat: 'Ripeti:', notesTitle: 'Blocco Note', privateNotes: 'Note private', appointments: 'Impegni', list: 'Lista', visual: 'Visuale', notes: 'Note', calendar: 'Calendario', seeAll: 'Vedi Tutto', backup: 'Backup', restore: 'Ripristina', language: 'Lingua', portuguese: 'Portoghese', italian: 'Italiano', searchTopic: 'Argomento: Voci del giorno', results: 'risultato/i', noResults: 'Nessuna voce trovata.', showing: 'Mostrando', of: 'di', freeNotes: 'Spazio libero per annotazioni rapide.', chars: 'caratteri', lastUpdate: 'Ultimo aggiornamento:', noUpdate: 'Nessun aggiornamento', day: 'Giorno', week: 'Settimana', total: 'Totale', pending: 'In sospeso', completed: 'Completati', noVisualItems: 'Nessun elemento da visualizzare', uncategorized: 'Senza categoria', completedLower: 'completati', noCategoryItems: 'Nessuna voce in questa categoria.', emptyList: 'Lista vuota', info: 'Informazioni', privacy: 'La tua agenda è privata al 100% e resta solo su questo dispositivo.', operational: 'Sistema operativo', agenda: 'Agenda', edit: 'Modifica', delete: 'Elimina', close: 'CHIUDI', doneAt: 'Fatto alle', timeConnector: 'alle' },
    editModal: { title: 'Modifica Impegno', text: 'Testo', time: 'Ora', category: 'Categoria', repeat: 'Ripeti', cancel: 'Annulla', save: 'Salva' },
    undoModal: { eyebrow: 'Annulla completamento', title: "Perdere l'orario salvato?", beforeDate: 'Questa attività è stata segnata come fatta il', afterDate: 'Se annulli, questo orario verrà cancellato.', keep: 'Mantieni', undo: 'Annulla' },
    deleteModal: { title: 'Elimina Impegno', single: 'Sei sicuro di voler eliminare questo impegno?', recurring: 'Questo è un impegno ricorrente. Come vuoi eliminarlo?', cancel: 'Annulla', delete: 'Elimina', onlyThisDate: 'Solo questa data', allOccurrences: 'Tutte le occorrenze' },
    searchTerms: { done: 'completato completata concluso fatta fatto done', pending: 'in sospeso aperta' },
    weekdays: ['D', 'L', 'M', 'M', 'G', 'V', 'S'],
    dateRangeSeparator: 'a',
  },
} as const;

const CATEGORY_STYLES: Record<string, string> = {
  'Trabalho': '#007BFF',
  'Casa': '#FD7E14',
  'Pagamentos': '#28A745',
  'Saúde': '#DC3545',
  'Outros': '#6C757D',
};

const RECURRENCE_OPTIONS: { labelKey: keyof typeof TRANSLATIONS.pt.recurrence; value: RecurrenceType }[] = [
  { labelKey: 'none', value: 'none' },
  { labelKey: 'daily', value: 'daily' },
  { labelKey: 'weekly', value: 'weekly' },
  { labelKey: 'monthly', value: 'monthly' },
  { labelKey: 'workdays', value: 'workdays' },
  { labelKey: 'monSat', value: 'mon-sat' },
];

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getCompletionTimestamp = (item: AgendaItem, dateKey: string): number | null => {
  const timestamp = item.completedAtByDate?.[dateKey];
  return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null;
};

export default function App() {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const t = TRANSLATIONS[language];
  const dateLocale = language === 'it' ? it : ptBR;

  const getRecurrenceLabel = (value: RecurrenceType): string => {
    const option = RECURRENCE_OPTIONS.find((item) => item.value === value);
    return option ? t.recurrence[option.labelKey] : '';
  };

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
  const [activeTab, setActiveTab ] = useState<'list' | 'visual' | 'calendar' | 'notes'>('list');
  const [visualScope, setVisualScope] = useState<'day' | 'week' | 'all'>('day');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesUpdatedAt, setNotesUpdatedAt] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  // Edit/Delete Modals Mode
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<AgendaItem | null>(null);
  const [undoingCompletion, setUndoingCompletion] = useState<{
    item: AgendaItem;
    dateKey: string;
    dateLabel: string;
    completedAtLabel: string | null;
  } | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('');
  const [editRecurrence, setEditRecurrence] = useState<RecurrenceType>('none');
  const [editTime, setEditTime] = useState('');
  
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language === 'it' ? 'it' : 'pt-BR';
  }, [language]);

  // Load data on mount
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [savedItems, savedCats, savedNotes] = await Promise.all([
          storage.getItems(),
          Promise.resolve(storage.getCategories()),
          Promise.resolve(storage.getNotes()),
        ]);

        if (!isMounted) return;
        setItems(savedItems);
        setCategories(savedCats);
        setNotes(savedNotes.content);
        setNotesUpdatedAt(savedNotes.updatedAt);
        if (savedCats.length > 0) {
          setSelectedCategory(savedCats[0]);
        }
      } catch {
        if (!isMounted) return;
        alert(t.alerts.load);
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
      alert(t.alerts.save);
    }
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextContent = e.target.value;
    const nextUpdatedAt = nextContent.trim() ? Date.now() : null;

    setNotes(nextContent);
    setNotesUpdatedAt(nextUpdatedAt);

    try {
      storage.saveNotes({ content: nextContent, updatedAt: nextUpdatedAt });
    } catch {
      alert(t.alerts.notes);
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
      version: 2,
      exportedAt: new Date().toISOString(),
      items,
      categories,
      notes: {
        content: notes,
        updatedAt: notesUpdatedAt,
      },
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
      const parsed = JSON.parse(text) as { items?: unknown; categories?: unknown; notes?: unknown };

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
        .map((item) => {
          const completedAtByDate = item.completedAtByDate && typeof item.completedAtByDate === 'object'
            ? Object.fromEntries(
                Object.entries(item.completedAtByDate).filter((entry): entry is [string, number] => (
                  typeof entry[0] === 'string' &&
                  typeof entry[1] === 'number' &&
                  Number.isFinite(entry[1])
                ))
              )
            : undefined;

          return {
            ...item,
            completedDates: item.completedDates || [],
            completedAtByDate,
          };
        });
      const importedCategories = parsed.categories.filter(
        (value): value is string => typeof value === 'string'
      );
      const importedNotes = (() => {
        if (typeof parsed.notes === 'string') {
          return {
            content: parsed.notes,
            updatedAt: parsed.notes.trim() ? Date.now() : null,
          };
        }

        if (!parsed.notes || typeof parsed.notes !== 'object') {
          return { content: '', updatedAt: null as number | null };
        }

        const notesRecord = parsed.notes as { content?: unknown; updatedAt?: unknown };
        const content = typeof notesRecord.content === 'string' ? notesRecord.content : '';
        const updatedAt = typeof notesRecord.updatedAt === 'number' && Number.isFinite(notesRecord.updatedAt)
          ? notesRecord.updatedAt
          : (content.trim() ? Date.now() : null);

        return { content, updatedAt };
      })();

      setItems(importedItems);
      setCategories(importedCategories);
      setSelectedCategory(importedCategories[0] || '');
      setFilterCategory('Tudo');
      setNotes(importedNotes.content);
      setNotesUpdatedAt(importedNotes.updatedAt);
      storage.saveCategories(importedCategories);
      storage.saveNotes(importedNotes);
      await saveItemsSafely(importedItems);
    } catch {
      alert(t.alerts.invalidBackup);
    } finally {
      e.target.value = '';
    }
  };

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 720;
          const MAX_HEIGHT = 720;
          let width = img.width;
          let height = img.height;

          if (!width || !height) {
            throw new Error('Imagem sem dimensoes validas');
          }

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
            throw new Error('Canvas indisponivel');
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          if (!dataUrl.startsWith('data:image/jpeg')) {
            throw new Error('Falha ao converter imagem');
          }
          resolve(dataUrl);
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Formato de imagem nao suportado'));
      };
      img.src = objectUrl;
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setPendingImage(compressed);
    } catch {
      alert(t.alerts.invalidImage);
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
    if (!isSpecificDay && !isToday(selectedDate)) return;

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
      completedAtByDate: {},
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
    const itemToToggle = items.find((item) => item.id === id);
    const isCurrentlyDone = itemToToggle?.completedDates?.includes(dateKey);

    if (isCurrentlyDone && itemToToggle) {
      const completedAt = getCompletionTimestamp(itemToToggle, dateKey);
      setUndoingCompletion({
        item: itemToToggle,
        dateKey,
        dateLabel: format(selectedDate, 'dd/MM/yy'),
        completedAtLabel: completedAt ? format(completedAt, 'HH:mm') : null,
      });
      return;
    }

    const newItems = items.map(item => {
      if (item.id === id) {
        const newCompletedDates = [...(item.completedDates || []), dateKey];
        const completedAtByDate = { ...(item.completedAtByDate || {}) };
        completedAtByDate[dateKey] = Date.now();

        return { ...item, completedDates: newCompletedDates, completedAtByDate };
      }
      return item;
    });
    setItems(newItems);
    void saveItemsSafely(newItems);
  };

  const confirmUndoCompletion = () => {
    if (!undoingCompletion) return;

    const { item: undoingItem, dateKey } = undoingCompletion;
    const newItems = items.map(item => {
      if (item.id === undoingItem.id) {
        const completedAtByDate = { ...(item.completedAtByDate || {}) };
        delete completedAtByDate[dateKey];

        return {
          ...item,
          completedDates: (item.completedDates || []).filter(d => d !== dateKey),
          completedAtByDate,
        };
      }
      return item;
    });

    setItems(newItems);
    setUndoingCompletion(null);
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

  const visualCategoryTimeline = useMemo(() => {
    const categoryDayMap: Record<string, Record<string, {
      dayDate: Date;
      entries: Array<{ item: AgendaItem; isDone: boolean }>;
    }>> = {};

    for (const item of visualItems) {
      const occurrenceDates: Date[] = [];

      if (visualScope === 'day') {
        if (checkItemVisibility(item, selectedDate)) {
          occurrenceDates.push(selectedDate);
        }
      } else if (visualScope === 'week') {
        for (const day of visualWeekRange.days) {
          if (checkItemVisibility(item, day)) {
            occurrenceDates.push(day);
          }
        }
      } else {
        const fallbackDate = new Date(item.timestamp);
        const baseDate = item.scheduledDate ? parseISO(item.scheduledDate) : fallbackDate;
        const validDate = Number.isNaN(baseDate.getTime()) ? fallbackDate : baseDate;
        occurrenceDates.push(validDate);
      }

      for (const occurrenceDate of occurrenceDates) {
        const dayKey = format(occurrenceDate, 'yyyy-MM-dd');

        if (!categoryDayMap[item.category]) {
          categoryDayMap[item.category] = {};
        }
        if (!categoryDayMap[item.category][dayKey]) {
          categoryDayMap[item.category][dayKey] = {
            dayDate: occurrenceDate,
            entries: [],
          };
        }

        const isDone = visualScope === 'all'
          ? (item.completedDates?.length || 0) > 0
          : (item.completedDates || []).includes(dayKey);

        categoryDayMap[item.category][dayKey].entries.push({ item, isDone });
      }
    }

    const timeline: Record<string, Array<{
      dayKey: string;
      dayDate: Date;
      entries: Array<{ item: AgendaItem; isDone: boolean }>;
    }>> = {};

    for (const [category, dayMap] of Object.entries(categoryDayMap)) {
      timeline[category] = Object.entries(dayMap)
        .map(([dayKey, data]) => ({
          dayKey,
          dayDate: data.dayDate,
          entries: [...data.entries].sort((a, b) => a.item.timestamp - b.item.timestamp),
        }))
        .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    }

    return timeline;
  }, [visualItems, visualScope, selectedDate, visualWeekRange.days]);

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
      .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, language === 'it' ? 'it-IT' : 'pt-BR'));

    return {
      total: visualItems.length,
      completed,
      pending: visualItems.length - completed,
      categoryCards,
    };
  }, [visualItems, visualScope, selectedDateKey, visualWeekRange.startKey, visualWeekRange.endKey, language]);

  const openAgendaForDate = (date: Date) => {
    const safeDate = startOfDay(date);
    setSelectedDate(safeDate);
    setCurrentMonth(safeDate);
    setFilterCategory('Tudo');
    setActiveTab('list');
  };

  const openAgendaForItem = (itemId: string, date: Date) => {
    openAgendaForDate(date);
    setSearchQuery('');
    setFocusedItemId(itemId);
  };

  const normalizedSearchQuery = useMemo(
    () => normalizeSearchText(searchQuery.trim()),
    [searchQuery]
  );

  const searchAgendaResults = useMemo(() => {
    if (!normalizedSearchQuery) return [];

    return items
      .filter((item) => checkItemVisibility(item, selectedDate))
      .map((item) => {
        const referenceDate = selectedDate;
        const referenceDateKey = format(selectedDate, 'yyyy-MM-dd');
        const recurrenceLabel = getRecurrenceLabel(item.recurrence);
        const isDoneOnReferenceDate = (item.completedDates || []).includes(referenceDateKey);
        const completedAt = getCompletionTimestamp(item, referenceDateKey);
        const searchIndex = normalizeSearchText(
          [
            item.text,
            item.category,
            recurrenceLabel,
            format(referenceDate, 'dd/MM/yy'),
            format(item.timestamp, 'HH:mm'),
            completedAt ? `${t.ui.doneAt} ${format(completedAt, 'HH:mm')}` : '',
            isDoneOnReferenceDate ? t.searchTerms.done : t.searchTerms.pending,
          ].join(' ')
        );

        if (!searchIndex.includes(normalizedSearchQuery)) {
          return null;
        }

        return {
          id: item.id,
          text: item.text,
          category: item.category,
          recurrenceLabel,
          isDoneOnReferenceDate,
          referenceDate,
          timestamp: item.timestamp,
          referenceDateLabel: format(referenceDate, 'dd/MM/yy'),
          timeLabel: format(item.timestamp, 'HH:mm'),
          completedAtLabel: completedAt ? format(completedAt, 'HH:mm') : null,
        };
      })
      .filter((result): result is {
        id: string;
        text: string;
        category: string;
        recurrenceLabel: string;
        isDoneOnReferenceDate: boolean;
        referenceDate: Date;
        timestamp: number;
        referenceDateLabel: string;
        timeLabel: string;
        completedAtLabel: string | null;
      } => result !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [items, normalizedSearchQuery, selectedDate, language]);

  const visibleAgendaResults = useMemo(
    () => searchAgendaResults.slice(0, 12),
    [searchAgendaResults]
  );

  const handleCategoryFilterSelect = (category: string) => {
    setSelectedCategory(category);
    setFilterCategory((prev) => (prev === category ? 'Tudo' : category));
  };

  const hasItemsOnDay = (date: Date) => {
    return items.some(item => checkItemVisibility(item, date));
  };

  const hasCompletedItemsOnDay = (date: Date) => {
    const dayKey = format(date, 'yyyy-MM-dd');
    return items.some((item) => item.completedDates?.includes(dayKey));
  };

  const isSelectedDateToday = isToday(selectedDate);

  useEffect(() => {
    if (!focusedItemId || activeTab !== 'list') return;

    const targetId = `agenda-item-${focusedItemId}`;
    const scrollTimer = window.setTimeout(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);

    const clearHighlightTimer = window.setTimeout(() => {
      setFocusedItemId((current) => (current === focusedItemId ? null : current));
    }, 2600);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [focusedItemId, activeTab, filteredItems.length]);

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
                      placeholder={t.placeholders.task}
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
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="hidden" 
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddItem(false)}
                      disabled={!isSelectedDateToday}
                      className={`flex-1 md:flex-none h-[50px] md:h-[60px] px-4 md:px-6 font-bold uppercase tracking-wider text-[11px] md:text-[13px] rounded-sm border-2 transition-all ${
                        isSelectedDateToday
                          ? 'bg-ink text-white border-ink active:scale-95'
                          : 'bg-neutral-100 text-neutral-300 border-neutral-200 cursor-not-allowed'
                      }`}
                      title={isSelectedDateToday ? t.titles.addNow : t.titles.addNowDisabled}
                    >
                      {t.ui.now}
                    </button>
                    <button
                      onClick={() => handleAddItem(true)}
                      className="flex-1 md:flex-none h-[50px] md:h-[60px] px-4 md:px-6 bg-white text-ink font-bold uppercase tracking-wider text-[11px] md:text-[13px] rounded-sm transition-all active:scale-95 border-2 border-ink hover:bg-neutral-50"
                    >
                      {t.ui.schedule}
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
                title={isHeaderCollapsed ? t.titles.collapseOpen : t.titles.collapseClose}
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
                {t.ui.all}
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
                    placeholder={t.placeholders.newCategory}
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
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t.ui.repeat}</span>
                    <select 
                      value={selectedRecurrence}
                      onChange={(e) => setSelectedRecurrence(e.target.value as RecurrenceType)}
                      className="bg-transparent text-[11px] font-black uppercase tracking-widest border-none focus:ring-0 cursor-pointer p-0 h-auto appearance-none"
                    >
                      {RECURRENCE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{t.recurrence[opt.labelKey]}</option>
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
        <div className={`max-w-6xl mx-auto min-h-full pb-24 lg:pb-0 ${activeTab === 'notes' ? '' : 'grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0.5 bg-border'}`}>
          {/* Main Content */}
        <section className={`bg-white p-6 md:p-10 space-y-8 ${activeTab === 'calendar' ? 'hidden lg:block' : 'block'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-ink uppercase min-w-0 break-words">
              {activeTab === 'notes' ? t.ui.notesTitle : format(selectedDate, 'eeee, dd/MM/yy', { locale: dateLocale })}
            </h1>
            <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto md:max-w-[70%] overflow-x-auto overflow-y-visible no-scrollbar flex-nowrap justify-start md:justify-end pb-2 md:pb-0">
              <span className="text-[10px] md:text-sm font-bold text-neutral-400 uppercase tracking-widest whitespace-nowrap flex-shrink-0">
                {activeTab === 'notes'
                  ? t.ui.privateNotes
                  : `${activeTab === 'visual' ? visualItems.length : filteredItems.length} ${t.ui.appointments}`}
              </span>

              <div className="flex items-center border border-border rounded-sm overflow-hidden flex-shrink-0">
                <button
                  onClick={() => setActiveTab('list')}
                  className={`px-2.5 md:px-3 py-2 text-[10px] font-black uppercase tracking-wider md:tracking-widest transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'list' ? 'bg-ink text-white' : 'bg-white text-neutral-500 hover:text-ink'
                  }`}
                >
                  <Clock size={12} />
                  {t.ui.list}
                </button>
                <button
                  onClick={() => setActiveTab('visual')}
                  className={`px-2.5 md:px-3 py-2 text-[10px] font-black uppercase tracking-wider md:tracking-widest transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'visual' ? 'bg-highlight text-white' : 'bg-white text-neutral-500 hover:text-ink'
                  }`}
                >
                  <LayoutGrid size={12} />
                  {t.ui.visual}
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`px-2.5 md:px-3 py-2 text-[10px] font-black uppercase tracking-wider md:tracking-widest transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'notes' ? 'bg-ink text-white' : 'bg-white text-neutral-500 hover:text-ink'
                  }`}
                >
                  <FileText size={12} />
                  {t.ui.notes}
                </button>
              </div>

              {activeTab !== 'notes' && filterCategory !== 'Tudo' && (
                <button
                  onClick={() => setFilterCategory('Tudo')}
                  className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider md:tracking-widest border border-border rounded-sm text-neutral-500 hover:text-ink hover:border-ink transition-colors whitespace-nowrap flex-shrink-0"
                >
                  {t.ui.seeAll}
                </button>
              )}

              <div className="relative flex-shrink-0" ref={settingsRef}>
                <button
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border rounded-sm transition-colors flex items-center gap-1.5 ${
                    isSettingsOpen
                      ? 'border-ink text-ink bg-neutral-50'
                      : 'border-border text-neutral-500 hover:text-ink hover:border-ink'
                  }`}
                  title={t.titles.options}
                  aria-label={t.titles.openOptions}
                >
                  <Settings size={13} />
                </button>

                {isSettingsOpen && (
                  <div className="fixed left-4 right-4 top-24 md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-56 bg-white border border-border rounded-sm shadow-lg z-50 p-1 max-h-[calc(100vh-7rem)] overflow-y-auto">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">
                        <Languages size={12} />
                        {t.ui.language}
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => setLanguage('pt')}
                          className={`px-2 py-1.5 text-[8px] font-black uppercase tracking-wider border rounded-sm transition-colors truncate ${
                            language === 'pt'
                              ? 'bg-ink text-white border-ink'
                              : 'bg-white text-neutral-500 border-border hover:text-ink'
                          }`}
                        >
                          {t.ui.portuguese}
                        </button>
                        <button
                          onClick={() => setLanguage('it')}
                          className={`px-2 py-1.5 text-[8px] font-black uppercase tracking-wider border rounded-sm transition-colors truncate ${
                            language === 'it'
                              ? 'bg-ink text-white border-ink'
                              : 'bg-white text-neutral-500 border-border hover:text-ink'
                          }`}
                        >
                          {t.ui.italian}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleExportBackup();
                        setIsSettingsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-neutral-600 hover:bg-neutral-50 hover:text-ink rounded-sm flex items-center gap-2"
                    >
                      <Download size={12} />
                      {t.ui.backup}
                    </button>
                    <button
                      onClick={() => {
                        backupInputRef.current?.click();
                        setIsSettingsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-neutral-600 hover:bg-neutral-50 hover:text-ink rounded-sm flex items-center gap-2"
                    >
                      <Upload size={12} />
                      {t.ui.restore}
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

          <div className="mb-6 space-y-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.placeholders.search}
                className="w-full h-11 pl-10 pr-10 border-2 border-border rounded-sm text-sm font-medium outline-none focus:border-ink"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-ink"
                  title={t.titles.clearSearch}
                  aria-label={t.titles.clearSearch}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {normalizedSearchQuery && (
              <div className="grid grid-cols-1 gap-3">
                <div className="border border-border rounded-sm p-3 bg-neutral-50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                      {t.ui.searchTopic}
                    </p>
                    <span className="text-[10px] font-bold text-neutral-400">
                      {searchAgendaResults.length} {t.ui.results}
                    </span>
                  </div>

                  {visibleAgendaResults.length === 0 ? (
                    <p className="text-sm text-neutral-400">{t.ui.noResults}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {visibleAgendaResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => openAgendaForItem(result.id, result.referenceDate)}
                          className="w-full text-left p-2 rounded-sm border border-transparent hover:border-border hover:bg-white transition-colors"
                        >
                          <p className={`text-sm break-words ${result.isDoneOnReferenceDate ? 'text-neutral-400 line-through' : 'text-ink'}`}>
                            {result.text}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mt-1">
                            {result.referenceDateLabel} • {result.timeLabel} • {result.category}
                            {result.recurrenceLabel ? ` • ${result.recurrenceLabel}` : ''}
                            {result.completedAtLabel ? ` • ${t.ui.doneAt} ${result.completedAtLabel}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchAgendaResults.length > visibleAgendaResults.length && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      {t.ui.showing} {visibleAgendaResults.length} {t.ui.of} {searchAgendaResults.length}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {activeTab === 'notes' ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-neutral-500">
                {t.ui.freeNotes}
              </p>
              <textarea
                value={notes}
                onChange={handleNotesChange}
                placeholder={t.placeholders.notes}
                className="w-full flex-1 min-h-[62vh] md:min-h-[70vh] resize-y border-2 border-border rounded-sm p-4 md:p-5 text-base leading-relaxed text-ink outline-none focus:border-ink"
              />
              <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                <span>{notes.length} {t.ui.chars}</span>
                <span className="text-right">
                  {notesUpdatedAt
                    ? `${t.ui.lastUpdate} ${format(notesUpdatedAt, 'dd/MM/yyyy HH:mm')}`
                    : t.ui.noUpdate}
                </span>
              </div>
            </div>
          ) : activeTab === 'visual' ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center border border-border rounded-sm overflow-hidden">
                  <button
                    onClick={() => setVisualScope('day')}
                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      visualScope === 'day' ? 'bg-ink text-white' : 'bg-white text-neutral-500 hover:text-ink'
                    }`}
                  >
                    {t.ui.day}
                  </button>
                  <button
                    onClick={() => setVisualScope('week')}
                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      visualScope === 'week' ? 'bg-ink text-white' : 'bg-white text-neutral-500 hover:text-ink'
                    }`}
                  >
                    {t.ui.week}
                  </button>
                  <button
                    onClick={() => setVisualScope('all')}
                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      visualScope === 'all' ? 'bg-ink text-white' : 'bg-white text-neutral-500 hover:text-ink'
                    }`}
                  >
                    {t.ui.all}
                  </button>
                </div>

                {visualScope === 'week' && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    {format(visualWeekRange.start, 'dd/MM/yy')} {t.dateRangeSeparator} {format(visualWeekRange.end, 'dd/MM/yy')}
                  </span>
                )}
              </div>

              {visualItems.length === 0 ? (
                <div className="py-20 md:py-24 text-center border-2 border-dashed border-border rounded-sm">
                  <LayoutGrid className="mx-auto mb-4 text-neutral-200" size={40} />
                  <p className="text-neutral-400 font-bold uppercase text-[10px] tracking-widest">{t.ui.noVisualItems}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 border border-border rounded-sm bg-neutral-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">{t.ui.total}</p>
                      <p className="text-2xl font-black text-ink">{visualSummary.total}</p>
                    </div>
                    <div className="p-4 border border-border rounded-sm bg-neutral-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">{t.ui.pending}</p>
                      <p className="text-2xl font-black text-ink">{visualSummary.pending}</p>
                    </div>
                    <div className="p-4 border border-border rounded-sm bg-neutral-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">{t.ui.completed}</p>
                      <p className="text-2xl font-black text-green-600">{visualSummary.completed}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {visualSummary.categoryCards.map((categoryCard) => {
                      const completionRate = categoryCard.total > 0
                        ? Math.round((categoryCard.doneCount / categoryCard.total) * 100)
                        : 0;
                      const dayGroups = visualCategoryTimeline[categoryCard.category] || [];

                      return (
                        <div
                          key={categoryCard.category}
                          className="p-4 border border-border rounded-sm bg-white shadow-sm"
                          style={{ borderLeft: `4px solid ${CATEGORY_STYLES[categoryCard.category] || '#343A40'}` }}
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                              <p className="text-sm font-black uppercase tracking-wider text-ink">
                                {categoryCard.category || t.ui.uncategorized}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                {categoryCard.doneCount}/{categoryCard.total} {t.ui.completedLower}
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

                          <div className="mt-3 pt-3 border-t border-border space-y-3">
                            {dayGroups.length === 0 ? (
                              <p className="text-[11px] font-bold text-neutral-400">{t.ui.noCategoryItems}</p>
                            ) : (
                              dayGroups.map((group) => (
                                <div key={`${categoryCard.category}-${group.dayKey}`} className="space-y-1.5">
                                  <button
                                    onClick={() => openAgendaForDate(group.dayDate)}
                                    className="text-[12px] font-black text-neutral-600 hover:text-ink hover:underline transition-colors"
                                  >
                                    {t.ui.day} {format(group.dayDate, 'dd/MM/yy')}
                                  </button>
                                  <div className="space-y-1.5">
                                    {group.entries.map((entry) => (
                                      <button
                                        key={`${entry.item.id}-${group.dayKey}`}
                                        onClick={() => openAgendaForDate(group.dayDate)}
                                        className="w-full flex items-start gap-2 text-left p-1.5 rounded-sm hover:bg-neutral-50 transition-colors"
                                      >
                                        {entry.isDone ? (
                                          <CheckCircle2 size={13} className="text-green-600 mt-0.5 flex-shrink-0" />
                                        ) : (
                                          <Circle size={13} className="text-neutral-300 mt-0.5 flex-shrink-0" />
                                        )}
                                        <span className="min-w-0">
                                          <span
                                            className={`block text-sm break-words ${entry.isDone ? 'line-through text-neutral-400' : 'text-ink'}`}
                                          >
                                            - {entry.item.text}
                                          </span>
                                          {entry.isDone && getCompletionTimestamp(entry.item, group.dayKey) && (
                                            <span className="block mt-0.5 text-[10px] font-bold uppercase tracking-widest text-green-600">
                                              {t.ui.doneAt} {format(getCompletionTimestamp(entry.item, group.dayKey)!, 'HH:mm')}
                                            </span>
                                          )}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
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
                  <p className="text-neutral-400 font-bold uppercase text-[10px] tracking-widest">{t.ui.emptyList}</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  {filteredItems.map((item) => {
                    const isDone = item.completedDates?.includes(selectedDateKey);
                    const completedAt = getCompletionTimestamp(item, selectedDateKey);
                    const isFocused = focusedItemId === item.id;
                    return (
                      <motion.div
                        id={`agenda-item-${item.id}`}
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={`flex flex-col md:grid md:grid-cols-[80px_1fr_120px] items-start md:items-center p-4 md:p-5 border border-border rounded-sm transition-all gap-3 md:gap-4 ${isDone ? 'opacity-40 grayscale' : 'bg-white hover:bg-neutral-50 shadow-sm md:shadow-none'} ${isFocused ? 'ring-2 ring-highlight ring-offset-2 ring-offset-white' : ''}`}
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
                              {getRecurrenceLabel(item.recurrence)}
                            </div>
                          )}
                          {isDone && completedAt && (
                            <div className="text-[9px] font-bold text-green-600 uppercase tracking-[0.2em] flex items-center justify-end gap-1">
                              <CheckCircle2 size={10} />
                              {t.ui.doneAt} {format(completedAt, 'HH:mm')}
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
                              {t.ui.edit}
                            </button>
                            <button 
                              onClick={() => setDeletingItem(item)}
                              className="text-red-500 hover:text-red-700 text-[10px] font-bold uppercase transition-colors"
                            >
                              {t.ui.delete}
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
        <aside className={`bg-[#F1F3F5] p-6 md:p-10 flex-col gap-10 ${activeTab === 'calendar' ? 'flex' : 'hidden'} ${activeTab === 'notes' ? '' : 'lg:flex'}`}>
          <div className="bg-white border border-border p-5 rounded-sm shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
                {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-neutral-100 rounded-sm border border-transparent hover:border-border transition-all"><ChevronLeft size={16} /></button>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-neutral-100 rounded-sm border border-transparent hover:border-border transition-all"><ChevronRight size={16} /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {t.weekdays.map((day, index) => (
                <div key={`${day}-${index}`} className="h-8 flex items-center justify-center text-[10px] font-bold text-neutral-300">
                  {day}
                </div>
              ))}
              {monthDays.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                const hasItems = hasItemsOnDay(date);
                const hasCompleted = hasCompletedItemsOnDay(date);
                const isCurrentDay = isToday(date);
                const isCurrentMonth = isSameDay(startOfMonth(date), startOfMonth(currentMonth));
                
                return (
                  <button
                    key={date.toString()}
                    onClick={() => {
                      setSelectedDate(date);
                      if (window.innerWidth < 1024) setActiveTab('list');
                    }}
                    className={`aspect-square relative flex items-center justify-center text-[11px] font-bold rounded-sm transition-all border ${
                      isSelected 
                        ? 'bg-ink text-white border-ink' 
                        : hasItems 
                          ? 'border-highlight text-highlight' 
                          : 'border-transparent text-ink hover:border-neutral-200'
                    } ${!isCurrentMonth ? 'opacity-20' : ''}`}
                  >
                    {isCurrentDay && (
                      <span
                        className={`absolute inset-0 flex items-center justify-center text-[26px] font-black leading-none pointer-events-none ${
                          isSelected ? 'text-white/35' : 'text-ink/30'
                        }`}
                        title={t.titles.today}
                      >
                        X
                      </span>
                    )}
                    <span className="relative z-10">{format(date, 'd')}</span>
                    {hasCompleted && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-green-300' : 'bg-green-600'}`}
                          title={t.titles.completedOnDay}
                        />
                      </span>
                    )}
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
              {t.ui.today}
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-neutral-400 uppercase tracking-widest">{t.ui.info}</h4>
            <div className="p-5 bg-white border-2 border-ink rounded-sm space-y-3">
              <p className="text-[13px] leading-relaxed font-bold italic">
                {t.ui.privacy}
              </p>
              <div className="h-0.5 bg-ink w-full opacity-10" />
              <p className="text-[13px] leading-relaxed flex items-center gap-2 font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {t.ui.operational}
              </p>
            </div>
          </div>
        </aside>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-ink p-3 grid grid-cols-4 lg:hidden z-40">
        <button 
          onClick={() => setActiveTab('list')}
          className={`flex flex-col items-center justify-center py-2 gap-1 transition-all ${activeTab === 'list' ? 'text-highlight' : 'text-neutral-400'}`}
        >
          <Clock size={20} className={activeTab === 'list' ? 'fill-highlight/10' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.ui.agenda}</span>
        </button>
        <button 
          onClick={() => setActiveTab('visual')}
          className={`flex flex-col items-center justify-center py-2 gap-1 transition-all ${activeTab === 'visual' ? 'text-highlight' : 'text-neutral-400'}`}
        >
          <LayoutGrid size={20} className={activeTab === 'visual' ? 'fill-highlight/10' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.ui.visual}</span>
        </button>
        <button 
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center justify-center py-2 gap-1 transition-all ${activeTab === 'calendar' ? 'text-highlight' : 'text-neutral-400'}`}
        >
          <CalendarDays size={20} className={activeTab === 'calendar' ? 'fill-highlight/10' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.ui.calendar}</span>
        </button>
        <button 
          onClick={() => setActiveTab('notes')}
          className={`flex flex-col items-center justify-center py-2 gap-1 transition-all ${activeTab === 'notes' ? 'text-highlight' : 'text-neutral-400'}`}
        >
          <FileText size={20} className={activeTab === 'notes' ? 'fill-highlight/10' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.ui.notes}</span>
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
              <h3 className="text-xl font-black uppercase tracking-tighter mb-6">{t.editModal.title}</h3>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-neutral-400">{t.editModal.text}</label>
                  <input 
                    type="text" 
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full border-2 border-ink p-3 text-lg font-bold outline-none rounded-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-neutral-400">{t.editModal.time}</label>
                    <input 
                      type="time" 
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full border-2 border-ink p-2 font-bold outline-none rounded-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-neutral-400">{t.editModal.category}</label>
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
                  <label className="text-[10px] font-bold uppercase text-neutral-400">{t.editModal.repeat}</label>
                  <select 
                    value={editRecurrence}
                    onChange={(e) => setEditRecurrence(e.target.value as RecurrenceType)}
                    className="w-full border-2 border-ink p-2 font-bold outline-none rounded-sm"
                  >
                    {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{t.recurrence[o.labelKey]}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setEditingItem(null)}
                  className="flex-1 p-3 border-2 border-ink font-bold uppercase text-sm hover:bg-neutral-50 transition-colors"
                >
                  {t.editModal.cancel}
                </button>
                <button 
                  onClick={handleUpdateItem}
                  className="flex-1 p-3 bg-ink text-white font-bold uppercase text-sm hover:opacity-90 transition-opacity"
                >
                  {t.editModal.save}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Undo Completion Confirmation Modal */}
      <AnimatePresence>
        {undoingCompletion && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUndoingCompletion(null)}
              className="absolute inset-0 bg-ink/65 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="undo-completion-title"
              className="relative bg-white border-4 border-ink p-6 md:p-8 w-full max-w-sm shadow-[10px_10px_0px_#000] rounded-sm"
            >
              <div className="w-12 h-12 border-2 border-ink bg-yellow-100 flex items-center justify-center rounded-sm shadow-[4px_4px_0px_#000] mb-5">
                <AlertTriangle size={24} className="text-yellow-700" />
              </div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-2">
                {t.undoModal.eyebrow}
              </p>
              <h3 id="undo-completion-title" className="text-xl font-black uppercase tracking-tighter mb-3 text-ink">
                {t.undoModal.title}
              </h3>
              <p className="text-sm font-medium leading-relaxed text-neutral-600 mb-4">
                {t.undoModal.beforeDate} {undoingCompletion.dateLabel}
                {undoingCompletion.completedAtLabel ? ` ${t.ui.timeConnector} ${undoingCompletion.completedAtLabel}` : ''}.
                {t.undoModal.afterDate}
              </p>
              <div className="p-3 border border-border bg-neutral-50 rounded-sm mb-7">
                <p className="text-sm font-bold text-ink break-words">
                  {undoingCompletion.item.text}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setUndoingCompletion(null)}
                  className="flex-1 p-3 border-2 border-ink font-bold uppercase text-sm hover:bg-neutral-50 transition-colors rounded-sm"
                >
                  {t.undoModal.keep}
                </button>
                <button
                  onClick={confirmUndoCompletion}
                  className="flex-1 p-3 bg-red-600 text-white border-2 border-ink font-bold uppercase text-sm hover:bg-red-700 transition-colors shadow-[4px_4px_0px_#000] rounded-sm"
                >
                  {t.undoModal.undo}
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
              <h3 className="text-xl font-black uppercase tracking-tighter mb-4 text-red-600">{t.deleteModal.title}</h3>
              <p className="text-sm font-medium mb-8 text-neutral-600">
                {deletingItem.recurrence === 'none'
                  ? t.deleteModal.single
                  : t.deleteModal.recurring}
              </p>

              {deletingItem.recurrence === 'none' ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingItem(null)}
                    className="flex-1 p-3 border-2 border-ink font-bold uppercase text-sm hover:bg-neutral-50 transition-colors"
                  >
                    {t.deleteModal.cancel}
                  </button>
                  <button
                    onClick={() => deleteItem(deletingItem.id, true)}
                    className="flex-1 p-3 bg-red-600 text-white border-2 border-ink font-bold uppercase text-sm hover:bg-red-700 transition-colors shadow-[4px_4px_0px_#000]"
                  >
                    {t.deleteModal.delete}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button 
                    onClick={() => deleteItem(deletingItem.id, false)}
                    className="w-full p-4 border-2 border-ink font-bold uppercase text-[11px] tracking-widest hover:bg-neutral-50 transition-all flex items-center justify-between group"
                  >
                    <span>{t.deleteModal.onlyThisDate}</span>
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={() => deleteItem(deletingItem.id, true)}
                    className="w-full p-4 bg-red-600 text-white border-2 border-ink font-bold uppercase text-[11px] tracking-widest hover:bg-red-700 transition-all flex items-center justify-between group shadow-[4px_4px_0px_#000]"
                  >
                    <span>{t.deleteModal.allOccurrences}</span>
                    <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                  </button>
                  <button 
                    onClick={() => setDeletingItem(null)}
                    className="w-full p-4 text-neutral-400 font-bold uppercase text-[10px] tracking-widest hover:text-ink transition-colors"
                  >
                    {t.deleteModal.cancel}
                  </button>
                </div>
              )}
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
                <X size={20} /> {t.ui.close}
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
