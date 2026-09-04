import React, { useState } from 'react';
import { ChgkMetadata } from '../types';
import { Clock, ExternalLink, ShieldCheck, HelpCircle, X, Volume2, AlertCircle, BookOpen, ArrowRight } from 'lucide-react';
import { sound } from '../utils/sound';

interface ChgkTopBarProps {
  metadata?: ChgkMetadata;
  questionNumber: number;
  timerEnabled: boolean;
  secondsLeft: number;
  totalSeconds?: number;
  isAnswered: boolean;
  onTimeUp?: () => void;
  phase?: 'reading' | 'discussion' | 'ended';
  readingSecondsLeft?: number;
  onSkipReading?: () => void;
  stickyTopOffset?: number;
}

export const ChgkTopBar: React.FC<ChgkTopBarProps> = ({
  metadata,
  questionNumber,
  timerEnabled,
  secondsLeft,
  totalSeconds = 60,
  isAnswered,
  onTimeUp,
  phase = 'discussion',
  readingSecondsLeft = 10,
  onSkipReading,
  stickyTopOffset = 58,
}) => {
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);

  const questionUrl = metadata?.questionUrl || metadata?.tournamentUrl || 'https://db.chgk.info';
  const tournamentTitle = metadata?.tournamentTitle || 'База вопросов «Что? Где? Когда?»';
  const qNum = metadata?.questionNumber || questionNumber;

  const isReading = timerEnabled && !isAnswered && phase === 'reading';
  const percentLeft = isReading
    ? Math.max(0, Math.min(100, (readingSecondsLeft / 10) * 100))
    : Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));

  const isUrgent = timerEnabled && !isAnswered && phase === 'discussion' && secondsLeft <= 10;

  // Ensure onTimeUp is invoked when discussion seconds reach 0 while unanswered
  React.useEffect(() => {
    if (timerEnabled && !isAnswered && phase === 'discussion' && secondsLeft <= 0 && onTimeUp) {
      onTimeUp();
    }
  }, [timerEnabled, isAnswered, phase, secondsLeft, onTimeUp]);

  return (
    <>
      <div
        id="chgk-top-navigation-bar"
        style={{ top: `${stickyTopOffset}px` }}
        className="w-full bg-[#1A1A1A] text-[#F9F7F2] border-2 border-[#1A1A1A] mb-4 p-2.5 sm:p-3.5 select-none animate-fadeIn sticky z-30 shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition-all"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Left: Tournament and Question Direct Link */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            {/* Owl Icon & Base Tag */}
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-[10px] bg-[#F9F7F2] text-[#1A1A1A] px-2 py-0.5 font-mono">
              <span>🦉</span>
              <span>db.chgk.info</span>
            </span>

            {/* Tournament Title & Question Number */}
            <div className="flex items-center gap-1.5 font-serif">
              <span className="font-bold text-sm text-[#F9F7F2] truncate max-w-[180px] sm:max-w-[300px]" title={tournamentTitle}>
                {tournamentTitle}
              </span>
              <span className="text-[#F9F7F2]/60">•</span>
              <span className="font-mono text-xs text-[#F9F7F2]/90">
                Вопрос №{qNum}
              </span>
            </div>

            {/* Direct Link to db.chgk.info */}
            <a
              id="chgk-direct-question-link"
              href={questionUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => sound.playClick()}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-[#F9F7F2]/80 hover:text-[#F9F7F2] underline underline-offset-2 hover:bg-white/10 px-1.5 py-0.5 transition-colors"
              title="Открыть этот вопрос непосредственно в официальной Базе db.chgk.info"
            >
              <span>В базу</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Right: Clock Timer or Thoughtful Mode Badge & Copyright Button */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            {timerEnabled ? (
              <div className="flex items-center gap-2">
                {isAnswered ? (
                  secondsLeft <= 0 ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 border border-red-500/50 bg-red-950/60 text-red-200 font-mono text-xs font-bold">
                      <Clock className="w-3.5 h-3.5 text-red-400" />
                      <span>Время вышло (00:00)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 border border-white/20 bg-white/5 text-[#F9F7F2]/60 font-mono text-xs">
                      <span>✓ Ответ дан (00:{String(secondsLeft).padStart(2, '0')})</span>
                    </div>
                  )
                ) : isReading ? (
                  /* Reading phase (10 seconds) */
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 border border-amber-400/80 bg-amber-950/80 text-amber-200 font-mono text-xs font-bold ring-1 ring-amber-400/40 animate-pulse"
                      title="Время на чтение вопроса (10 секунд). После этого автоматически начнется 60 секунд обсуждения."
                    >
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span>ЧТЕНИЕ: 00:{String(readingSecondsLeft).padStart(2, '0')}</span>
                    </div>

                    {onSkipReading && (
                      <button
                        onClick={() => {
                          sound.playClick();
                          onSkipReading();
                        }}
                        className="px-2 py-1 border border-amber-400/50 bg-amber-400/10 hover:bg-amber-400 hover:text-[#1A1A1A] text-amber-200 text-[11px] font-mono font-bold tracking-wide flex items-center gap-1 transition-colors"
                        title="Пропустить оставшиеся секунды чтения и сразу начать 60-секундное обсуждение"
                      >
                        <span>К минуте</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  /* 60-second discussion phase */
                  <div className="flex items-center gap-2">
                    {isUrgent && (
                      <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 bg-red-950 border border-red-500/60 text-[10px] font-mono font-bold text-red-300 uppercase tracking-wider animate-pulse">
                        <AlertCircle className="w-3 h-3 text-red-400" />
                        <span>Осталось 10 сек</span>
                      </span>
                    )}
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 border font-mono text-xs font-bold transition-all ${
                        isUrgent
                          ? 'border-red-400 bg-red-950 text-red-200 animate-pulse ring-1 ring-red-400/50'
                          : 'border-white/30 bg-white/10 text-[#F9F7F2]'
                      }`}
                      title="Классическая минута обсуждения (60 секунд): сигнал за 10 секунд и финальный гонг"
                    >
                      <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-red-400' : ''}`} />
                      <span>00:{String(secondsLeft).padStart(2, '0')}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 border border-white/20 bg-white/5 text-[11px] font-mono text-[#F9F7F2]/80"
                title="Режим игры без часов (без лимита времени)"
              >
                <span>⏳ Без часов (вдумчивый темп)</span>
              </div>
            )}

            {/* Copyright / License Info Button */}
            <button
              id="chgk-copyright-btn"
              onClick={() => {
                sound.playClick();
                setShowCopyrightModal(true);
              }}
              className="text-[11px] font-mono text-[#F9F7F2]/60 hover:text-[#F9F7F2] flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 transition-colors"
              title="Информация об авторских правах и лицензии db.chgk.info"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Лицензия</span>
            </button>
          </div>
        </div>

        {/* Progress Bar (reading phase: amber / discussion phase: standard/red) */}
        {timerEnabled && !isAnswered && (
          <div className="w-full bg-white/10 h-1 mt-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                isReading
                  ? 'bg-amber-400'
                  : isUrgent
                  ? 'bg-red-400'
                  : 'bg-[#F9F7F2]'
              }`}
              style={{ width: `${percentLeft}%` }}
            />
          </div>
        )}
      </div>

      {/* Copyright & Attribution Modal */}
      {showCopyrightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#F9F7F2] border-2 border-[#1A1A1A] p-6 sm:p-8 max-w-lg w-full text-[#1A1A1A] shadow-[8px_8px_0px_0px_#1A1A1A] relative">
            <button
              onClick={() => setShowCopyrightModal(false)}
              className="absolute top-4 right-4 p-1 text-[#1A1A1A] hover:bg-[#1A1A1A]/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🦉</span>
              <h3 className="font-serif font-black text-xl text-[#1A1A1A]">
                Лицензия и авторские права базы
              </h3>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-[#1A1A1A]/85 leading-relaxed font-sans">
              <p>
                Вопросы в этом режиме загружаются из официальной{' '}
                <a
                  href="https://db.chgk.info"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline text-[#1A1A1A]"
                >
                  Базы вопросов «Что? Где? Когда?» (db.chgk.info)
                </a>.
              </p>
              <div className="p-3 bg-[#1A1A1A]/5 border border-[#1A1A1A]/20 space-y-1.5 font-mono text-xs">
                <div className="font-bold text-[#1A1A1A]">Условия использования (db.chgk.info/copyright):</div>
                <ul className="list-disc pl-4 space-y-1 text-[#1A1A1A]/80">
                  <li>Исключительно некоммерческое использование для проведения интеллектуальных игр.</li>
                  <li>Обязательное указание источника: гиперссылка на <code>http://db.chgk.info</code>.</li>
                  <li>Текст вопросов, авторство, зачёт и комментарии публикуются без искажений.</li>
                </ul>
              </div>
              <p className="text-xs text-[#1A1A1A]/70">
                Приложение бережно сохраняет все оригинальные поля: имя автора, критерии зачёта, источники и комментарий редактора.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1A1A1A]/20 flex justify-between items-center">
              <a
                href="https://db.chgk.info/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono font-bold text-[#1A1A1A] underline flex items-center gap-1"
              >
                <span>Полный текст лицензии</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => setShowCopyrightModal(false)}
                className="px-4 py-2 bg-[#1A1A1A] text-[#F9F7F2] font-bold text-xs uppercase tracking-wider hover:bg-[#1A1A1A]/80 transition-colors"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
