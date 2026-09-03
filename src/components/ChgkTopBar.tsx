import React, { useState } from 'react';
import { ChgkMetadata } from '../types';
import { Clock, ExternalLink, ShieldCheck, HelpCircle, X, Volume2, AlertCircle } from 'lucide-react';
import { sound } from '../utils/sound';

interface ChgkTopBarProps {
  metadata?: ChgkMetadata;
  questionNumber: number;
  timerEnabled: boolean;
  secondsLeft: number;
  totalSeconds?: number;
  isAnswered: boolean;
  onTimeUp?: () => void;
}

export const ChgkTopBar: React.FC<ChgkTopBarProps> = ({
  metadata,
  questionNumber,
  timerEnabled,
  secondsLeft,
  totalSeconds = 60,
  isAnswered,
}) => {
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);

  const questionUrl = metadata?.questionUrl || metadata?.tournamentUrl || 'https://db.chgk.info';
  const tournamentTitle = metadata?.tournamentTitle || 'База вопросов «Что? Где? Когда?»';
  const qNum = metadata?.questionNumber || questionNumber;

  const percentLeft = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));
  const isUrgent = timerEnabled && !isAnswered && secondsLeft <= 10;

  return (
    <>
      <div
        id="chgk-top-navigation-bar"
        className="w-full bg-[#1A1A1A] text-[#F9F7F2] border border-[#1A1A1A] mb-4 p-3 sm:p-4 select-none animate-fadeIn"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Left: Tournament and Question Direct Link */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            {/* Owl Icon & Base Tag */}
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-[10px] bg-[#F9F7F2] text-[#1A1A1A] px-2 py-0.5 font-mono">
              <span>🦉</span>
              <span>db.chgk.info</span>
            </span>

            {/* Tournament Title & Question Number */}
            <div className="flex items-center gap-1.5 font-serif">
              <span className="font-bold text-sm text-[#F9F7F2] truncate max-w-[200px] sm:max-w-[320px]" title={tournamentTitle}>
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
              <span>Перейти к вопросу в базе</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Right: Clock Timer or Thoughtful Mode Badge & Copyright Button */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {timerEnabled ? (
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
                      : isAnswered
                      ? 'border-white/20 bg-white/5 text-[#F9F7F2]/60'
                      : 'border-white/30 bg-white/10 text-[#F9F7F2]'
                  }`}
                  title="Классическая минута обсуждения (60 секунд): сигнал за 10 секунд и финальный гонг"
                >
                  <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-red-400' : ''}`} />
                  <span>
                    {isAnswered ? 'Время зафиксировано' : `00:${String(secondsLeft).padStart(2, '0')}`}
                  </span>
                </div>
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

        {/* 60s Progress Bar (when timer is enabled) */}
        {timerEnabled && !isAnswered && (
          <div className="w-full bg-white/10 h-1 mt-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                isUrgent ? 'bg-red-400' : 'bg-[#F9F7F2]'
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
