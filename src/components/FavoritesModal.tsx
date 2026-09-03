import React from 'react';
import { WikiQuestion } from '../types';
import { X, Bookmark, Trash2, Play, ExternalLink } from 'lucide-react';
import { sound } from '../utils/sound';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: WikiQuestion[];
  onRemoveFavorite: (q: WikiQuestion) => void;
  onPracticeFavorite?: (q: WikiQuestion) => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  isOpen,
  onClose,
  favorites,
  onRemoveFavorite,
  onPracticeFavorite,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/70 backdrop-blur-xs animate-fadeIn">
      <div
        id="favorites-modal"
        className="w-full max-w-2xl bg-[#F9F7F2] border border-[#1A1A1A] p-6 sm:p-8 max-h-[90vh] flex flex-col space-y-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#1A1A1A]">
          <div>
            <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-[#1A1A1A]/60 block mb-1">
              Коллекция ({favorites.length})
            </span>
            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1A1A] leading-none">
              Сохранённые факты
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

        {/* Content */}
        <div className="overflow-y-auto space-y-4 my-2 pr-1 flex-1">
          {favorites.length === 0 ? (
            <div className="text-center py-14 px-4 space-y-3">
              <div className="w-12 h-12 border border-[#1A1A1A] flex items-center justify-center mx-auto text-[#1A1A1A]">
                <Bookmark className="w-6 h-6" />
              </div>
              <h4 className="font-serif font-bold text-[#1A1A1A] text-lg">Пока нет сохранённых заметок</h4>
              <p className="text-xs text-[#1A1A1A]/70 max-w-xs mx-auto leading-relaxed">
                Нажимайте на значок закладки после ответа на любой вопрос, чтобы сохранить энциклопедический факт.
              </p>
            </div>
          ) : (
            favorites.map((q) => (
              <div
                key={q.id}
                className="p-5 border border-[#1A1A1A] bg-[#1A1A1A]/3 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-[#F9F7F2] px-2 py-0.5 inline-block">
                      {q.category || 'Энциклопедия'}
                    </span>
                    <h5 className="font-serif font-bold text-base text-[#1A1A1A] leading-snug">
                      {q.question}
                    </h5>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onPracticeFavorite && (
                      <button
                        onClick={() => {
                          sound.playClick();
                          onPracticeFavorite(q);
                          onClose();
                        }}
                        className="px-2.5 py-1 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                        title="Тренировать вопрос"
                      >
                        <Play className="w-3 h-3" />
                        <span className="hidden sm:inline">Пройти</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        sound.playClick();
                        onRemoveFavorite(q);
                      }}
                      className="p-1 border border-[#1A1A1A]/40 hover:border-[#1A1A1A] text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs font-serif italic text-[#1A1A1A] bg-[#1A1A1A]/5 p-3 border-l-2 border-[#1A1A1A]">
                  {q.explanation}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1A1A1A]/15 text-[11px] font-mono">
                  <div className="text-[#1A1A1A]">
                    Ответ: <strong>{q.correctAnswer}</strong>
                  </div>
                  <a
                    href={q.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-[#1A1A1A]/40 hover:decoration-[#1A1A1A] text-[#1A1A1A]"
                  >
                    <span>{q.articleTitle}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#1A1A1A] flex justify-end">
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
