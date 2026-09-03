import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2, BookOpen, Sparkles, Check } from 'lucide-react';
import { sound } from '../utils/sound';
import { loadCustomTopics, addCustomTopic, removeCustomTopic } from '../utils/storage';
import { DEFAULT_WIKI_CATEGORIES, WikiCategoryItem } from '../constants/categories';

type CategoryOption = WikiCategoryItem;

interface CategoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
  isOpen,
  onClose,
  selectedCategory,
  onSelectCategory,
}) => {
  const [categories, setCategories] = useState<CategoryOption[]>(DEFAULT_WIKI_CATEGORIES);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customTopic, setCustomTopic] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchCategories = async (retries = 2) => {
      try {
        const res = await fetch('/api/wiki/categories');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setCategories(data);
        }
      } catch (err) {
        if (retries > 0) {
          setTimeout(() => {
            if (isMounted) {
              fetchCategories(retries - 1);
            }
          }, 1000);
        } else {
          console.warn('Wiki categories modal: utilizing curated default topics', err);
        }
      }
    };

    if (isOpen) {
      fetchCategories();
      setCustomTopics(loadCustomTopics());
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTopic.trim();
    if (!trimmed) return;
    sound.playClick();
    const updated = addCustomTopic(trimmed);
    setCustomTopics(updated);
    onSelectCategory(trimmed);
    setCustomTopic('');
    onClose();
  };

  const handleRemoveCustom = (topicToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    const updated = removeCustomTopic(topicToRemove);
    setCustomTopics(updated);
    if (selectedCategory === topicToRemove) {
      onSelectCategory('all');
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomTopics = customTopics.filter((t) =>
    t.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/70 backdrop-blur-xs animate-fadeIn">
      <div
        id="category-picker-modal"
        className="w-full max-w-3xl bg-[#F9F7F2] border-2 border-[#1A1A1A] p-6 sm:p-8 shadow-2xl max-h-[90vh] flex flex-col space-y-5"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#1A1A1A]">
          <div>
            <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-[#1A1A1A]/60 block mb-1">
              Каталог тем и рубрик
            </span>
            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1A1A] leading-none">
              Темы русской Википедии
            </h3>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Custom Article / Topic Search Input */}
        <div className="space-y-3">
          <form onSubmit={handleApplyCustom} className="flex gap-2">
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Введите любую тему (например: Древний Рим, Квантовая физика, Достоевский)..."
              className="flex-1 px-4 py-2.5 bg-transparent border border-[#1A1A1A] text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/40 outline-none font-serif italic"
            />
            <button
              type="submit"
              disabled={!customTopic.trim()}
              className="px-5 py-2.5 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] hover:bg-transparent hover:text-[#1A1A1A] disabled:opacity-40 font-bold text-xs uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Использовать тему</span>
            </button>
          </form>

          {/* Quick search filter for categories */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#1A1A1A]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Фильтр по названию или описанию..."
              className="w-full pl-10 pr-4 py-2 bg-transparent border border-[#1A1A1A]/40 text-xs text-[#1A1A1A] placeholder-[#1A1A1A]/40 outline-none"
            />
          </div>
        </div>

        {/* Scrollable Topics Area */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-5 my-2">
          {/* Custom / User Created Topics Section */}
          {filteredCustomTopics.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/70 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#1A1A1A]" />
                  Пользовательские темы ({filteredCustomTopics.length}):
                </span>
                <span className="text-[9px] font-mono text-[#1A1A1A]/50">Добавлены вами</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filteredCustomTopics.map((topic) => {
                  const isSelected = selectedCategory.toLowerCase() === topic.toLowerCase();
                  return (
                    <div
                      key={topic}
                      onClick={() => {
                        sound.playClick();
                        onSelectCategory(topic);
                        onClose();
                      }}
                      className={`p-3 border text-left transition-all flex items-center justify-between gap-2 cursor-pointer group ${
                        isSelected
                          ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                          : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A]/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="font-serif font-bold text-xs truncate">
                          {topic}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isSelected && (
                          <span className="text-[8px] uppercase font-mono font-bold border border-[#F9F7F2] px-1 py-0.2">
                            Выбрано
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleRemoveCustom(topic, e)}
                          title="Удалить эту тему"
                          className={`p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity ${
                            isSelected ? 'text-[#F9F7F2]/70 hover:text-red-300' : 'text-[#1A1A1A]/50 hover:text-red-600'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Curated Categories Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/70">
                Категории русской Википедии:
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredCategories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      sound.playClick();
                      onSelectCategory(cat.id);
                      onClose();
                    }}
                    className={`p-4 border text-left transition-all flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                        : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A]/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-serif font-bold text-base leading-tight">
                        {cat.label}
                      </span>
                      {isSelected && (
                        <span className="text-[9px] uppercase font-mono font-bold border border-[#F9F7F2] px-1.5 py-0.5">
                          Выбрано
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${isSelected ? 'text-[#F9F7F2]/80' : 'text-[#1A1A1A]/70'}`}>
                      {cat.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#1A1A1A] flex items-center justify-between gap-2">
          <button
            onClick={() => {
              sound.playClick();
              onSelectCategory('all');
              onClose();
            }}
            className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] underline decoration-[#1A1A1A]/40 hover:decoration-[#1A1A1A]"
          >
            Сбросить на случайные темы
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-6 py-2 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] hover:bg-transparent hover:text-[#1A1A1A] font-bold text-xs uppercase tracking-widest transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

