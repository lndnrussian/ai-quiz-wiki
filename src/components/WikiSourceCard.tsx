import React, { useState } from 'react';
import { WikiQuestion } from '../types';
import { ExternalLink, Bookmark, Check, Copy, BookOpen } from 'lucide-react';
import { sound } from '../utils/sound';

interface WikiSourceCardProps {
  question: WikiQuestion;
  isFavorite: boolean;
  onToggleFavorite: (question: WikiQuestion) => void;
}

export const WikiSourceCard: React.FC<WikiSourceCardProps> = ({
  question,
  isFavorite,
  onToggleFavorite,
}) => {
  const [copied, setCopied] = useState(false);
  const isChgk = question.sourceSystem === 'chgk' || Boolean(question.chgkMetadata);
  const chgk = question.chgkMetadata;

  const handleCopy = () => {
    sound.playClick();
    const sourceLabel = isChgk ? 'База «Что? Где? Когда?»' : 'Википедия';
    const text = `${sourceLabel}:\nВопрос: ${question.question}\nОтвет: ${question.correctAnswer}\n${
      chgk?.passCriteria ? `Зачёт: ${chgk.passCriteria}\n` : ''
    }${chgk?.authors ? `Автор: ${chgk.authors}\n` : ''}Ссылка: ${question.articleUrl}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="wiki-source-card"
      className="mt-8 border border-[#1A1A1A] bg-[#F9F7F2] p-5 sm:p-6 space-y-4 animate-fadeIn"
    >
      {/* Header: Editorial Fact Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#1A1A1A]/15">
        <div className="flex items-center gap-2 text-[#1A1A1A] font-bold text-xs uppercase tracking-[0.2em]">
          {isChgk ? (
            <>
              <span className="text-base">🦉</span>
              <span>Материалы вопроса «Что? Где? Когда?»</span>
            </>
          ) : (
            <>
              <BookOpen className="w-3.5 h-3.5" />
              <span>Энциклопедический факт</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            title="Скопировать вопрос и ответ"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>

          {/* Bookmark favorite button */}
          <button
            onClick={() => {
              sound.playClick();
              onToggleFavorite(question);
            }}
            className={`px-2.5 py-1 border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              isFavorite
                ? 'bg-[#1A1A1A] text-[#F9F7F2] border-[#1A1A1A]'
                : 'border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A]'
            }`}
            title={isFavorite ? 'Удалить из сохранённых' : 'Сохранить факт'}
          >
            <Bookmark className={`w-3 h-3 ${isFavorite ? 'fill-[#F9F7F2]' : ''}`} />
            <span>{isFavorite ? 'В закладках' : 'В закладки'}</span>
          </button>
        </div>
      </div>

      {/* ChGK Pass Criteria (Зачёт) if present */}
      {isChgk && chgk?.passCriteria && (
        <div className="bg-[#1A1A1A]/5 p-3 border-l-2 border-[#1A1A1A] text-xs font-sans text-[#1A1A1A]/90">
          <span className="font-bold font-mono uppercase text-[10px] tracking-wider text-[#1A1A1A] block mb-1">
            Критерии зачёта:
          </span>
          <span>{chgk.passCriteria}</span>
        </div>
      )}

      {/* Fact explanation / ChGK Comments */}
      <div className="font-serif text-sm sm:text-base leading-relaxed text-[#1A1A1A] italic bg-[#1A1A1A]/5 p-4 border-l-2 border-[#1A1A1A]">
        {chgk?.comments ? (
          <div>
            <span className="font-bold not-italic font-mono text-[10px] uppercase tracking-wider block mb-1 text-[#1A1A1A]/70">
              Комментарий редактора:
            </span>
            <span>{chgk.comments}</span>
          </div>
        ) : (
          question.explanation
        )}
      </div>

      {/* ChGK Authors and Sources */}
      {isChgk && (chgk?.authors || chgk?.sources) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans text-[#1A1A1A]/80 border-t border-[#1A1A1A]/10 pt-3">
          {chgk.authors && (
            <div>
              <span className="text-[10px] uppercase font-mono font-bold text-[#1A1A1A]/50 block">
                Автор вопроса:
              </span>
              <span className="font-medium text-[#1A1A1A]">{chgk.authors}</span>
            </div>
          )}
          {chgk.sources && (
            <div>
              <span className="text-[10px] uppercase font-mono font-bold text-[#1A1A1A]/50 block">
                Источники:
              </span>
              <span className="font-medium text-[#1A1A1A] line-clamp-2" title={chgk.sources}>
                {chgk.sources}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Primary Source Article / Tournament Details */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#1A1A1A]/15 text-xs">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-mono text-[#1A1A1A]/50">
            {isChgk ? 'Турнирный пакет в базе:' : 'Первоисточник:'}
          </div>
          <div className="font-bold text-[#1A1A1A] truncate max-w-sm font-serif text-sm">
            {question.articleTitle}
          </div>
        </div>

        <a
          href={question.articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => sound.playClick()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] font-bold uppercase tracking-wider text-[10px] transition-colors shrink-0"
        >
          <span>{isChgk ? 'Открыть на db.chgk.info' : 'Читать на Wikipedia'}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
