import React, { useState, useEffect, useRef } from 'react';
import { Send, HelpCircle, Check, X, Loader2 } from 'lucide-react';
import { sound } from '../utils/sound';

interface OpenAnswerInputProps {
  correctAnswer: string;
  acceptableAnswers?: string[];
  isAnswered: boolean;
  isEvaluating: boolean;
  onSubmitAnswer: (answer: string) => void;
  onOverrideResult?: (isCorrect: boolean) => void;
  evaluationResult?: { isCorrect: boolean; feedback: string; similarity: number } | null;
  disabled?: boolean;
}

export const OpenAnswerInput: React.FC<OpenAnswerInputProps> = ({
  correctAnswer,
  isAnswered,
  isEvaluating,
  onSubmitAnswer,
  onOverrideResult,
  evaluationResult,
  disabled = false,
}) => {
  const [userText, setUserText] = useState('');
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on question load
  useEffect(() => {
    setUserText('');
    setShowHint(false);
    if (!isAnswered && !disabled) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [correctAnswer, isAnswered, disabled]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userText.trim() || isAnswered || isEvaluating || disabled) return;
    sound.playClick();
    onSubmitAnswer(userText.trim());
  };

  const handleGiveUp = () => {
    if (isAnswered || isEvaluating || disabled) return;
    sound.playClick();
    onSubmitAnswer('— Не знаю —');
  };

  const firstLetter = correctAnswer.trim().charAt(0).toUpperCase();
  const wordCount = correctAnswer.trim().split(/\s+/).length;

  return (
    <div id="open-answer-container" className="my-6 space-y-4">
      {!isAnswered ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              id="open-answer-input"
              type="text"
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              disabled={isAnswered || isEvaluating || disabled}
              placeholder="Введите точный ответ на русском языке..."
              className="w-full px-5 py-4 pr-32 bg-transparent border border-[#1A1A1A] text-[#1A1A1A] placeholder-[#1A1A1A]/40 text-lg font-serif italic outline-none transition-all focus:ring-1 focus:ring-[#1A1A1A]"
              autoComplete="off"
              spellCheck="false"
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              <button
                type="submit"
                id="submit-open-answer-btn"
                disabled={!userText.trim() || isEvaluating || disabled}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all border border-[#1A1A1A] ${
                  userText.trim() && !isEvaluating
                    ? 'bg-[#1A1A1A] text-[#F9F7F2] hover:bg-transparent hover:text-[#1A1A1A]'
                    : 'bg-[#1A1A1A]/10 text-[#1A1A1A]/40 cursor-not-allowed border-transparent'
                }`}
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Проверка...</span>
                  </>
                ) : (
                  <>
                    <span>Ответить</span>
                    <Send className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Hint & Give up helpers */}
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            <div className="flex items-center gap-2">
              {!showHint ? (
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className="text-[#1A1A1A]/70 hover:text-[#1A1A1A] flex items-center gap-1 transition-colors text-[11px] font-bold uppercase tracking-wider underline decoration-[#1A1A1A]/30"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Открыть подсказку</span>
                </button>
              ) : (
                <div className="text-[#1A1A1A] bg-[#1A1A1A]/5 px-3 py-1 border border-[#1A1A1A] flex items-center gap-2 text-xs font-mono">
                  <span>
                    Начинается на: <strong>«{firstLetter}»</strong> ({wordCount === 1 ? '1 слово' : `${wordCount} слова`})
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleGiveUp}
              className="text-[#1A1A1A]/50 hover:text-[#1A1A1A] text-[11px] uppercase tracking-wider font-semibold transition-colors"
            >
              Сдаться
            </button>
          </div>
        </form>
      ) : (
        /* Answered State with Assessment */
        <div className="space-y-4 animate-fadeIn">
          <div
            className={`p-5 border ${
              evaluationResult?.isCorrect
                ? 'border-[#1A1A1A] bg-[#1A1A1A]/5'
                : 'border-[#1A1A1A] bg-[#1A1A1A]/5'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 flex items-center justify-center border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] text-xs font-bold font-mono">
                  {evaluationResult?.isCorrect ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm uppercase tracking-wider text-[#1A1A1A]">
                    {evaluationResult?.isCorrect ? 'Ответ принят' : 'Неточный ответ'}
                  </h4>
                  <p className="text-xs text-[#1A1A1A]/80 mt-0.5">
                    {evaluationResult?.feedback || (evaluationResult?.isCorrect ? 'Правильный ответ.' : 'Ознакомьтесь с фактом ниже.')}
                  </p>
                </div>
              </div>

              {/* User Answer */}
              <div className="text-right text-xs shrink-0">
                <span className="text-[#1A1A1A]/50 uppercase tracking-wider text-[10px] block font-mono">Ваш ответ:</span>
                <span className="font-serif italic font-bold text-sm text-[#1A1A1A] max-w-[160px] truncate block">
                  «{userText || '—'}»
                </span>
              </div>
            </div>

            {/* Canonical Answer & Override */}
            <div className="mt-4 pt-3 border-t border-[#1A1A1A]/20 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#1A1A1A]/60 font-mono">
                  Канонический ответ:
                </span>
                <strong className="font-serif font-bold text-base text-[#1A1A1A]">
                  {correctAnswer}
                </strong>
              </div>

              {onOverrideResult && (
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                  <span className="text-[#1A1A1A]/50">Оценка:</span>
                  {!evaluationResult?.isCorrect ? (
                    <button
                      onClick={() => onOverrideResult(true)}
                      className="px-2 py-0.5 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] font-bold transition-colors"
                      title="Засчитать ответ как верный"
                    >
                      Я был прав
                    </button>
                  ) : (
                    <button
                      onClick={() => onOverrideResult(false)}
                      className="px-2 py-0.5 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] font-bold transition-colors"
                      title="Засчитать как неверный"
                    >
                      Ошибся
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
