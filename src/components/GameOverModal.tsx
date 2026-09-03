import React, { useEffect } from 'react';
import { UserAnswerRecord, GameMode } from '../types';
import { Trophy, RotateCcw, Sliders, ArrowRight, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/sound';

interface GameOverModalProps {
  isOpen: boolean;
  onRestart: () => void;
  onOpenSetup: () => void;
  onBackToEndless: () => void;
  gameMode: GameMode;
  sessionAnswers: UserAnswerRecord[];
  sessionStreak: number;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  onRestart,
  onOpenSetup,
  onBackToEndless,
  gameMode,
  sessionAnswers,
}) => {
  useEffect(() => {
    if (isOpen) {
      sound.playGameOver();
      const correctCount = sessionAnswers.filter((a) => a.isCorrect).length;
      if (correctCount >= 3) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#1A1A1A', '#555555', '#E5E1D8'],
        });
      }
    }
  }, [isOpen, sessionAnswers]);

  if (!isOpen) return null;

  const totalAnswered = sessionAnswers.length;
  const correctCount = sessionAnswers.filter((a) => a.isCorrect).length;
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
  const totalXpEarned = sessionAnswers.reduce((sum, a) => sum + (a.scoreEarned || 0), 0);

  const modeTitles: Record<GameMode, string> = {
    sprint: 'Спринт-раунд завершён',
    blitz: 'Блиц-раунд завершён',
    survival: 'Сессия выживания окончена',
    endless: 'Раунд завершён',
    topic: 'Тематический раунд окончен',
  };

  const getVerdict = () => {
    if (accuracy >= 90 && totalAnswered >= 3) return 'Гроссмейстер знаний русской Википедии!';
    if (accuracy >= 70) return 'Отличная эрудиция и кругозор!';
    if (accuracy >= 50) return 'Хороший результат, продолжайте расширять знания!';
    return 'Каждая ошибка — шаг к новому открытию!';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/75 backdrop-blur-xs animate-fadeIn">
      <div
        id="game-over-modal"
        className="w-full max-w-lg bg-[#F9F7F2] border border-[#1A1A1A] p-6 sm:p-8 shadow-2xl flex flex-col space-y-6 text-center max-h-[90vh]"
      >
        {/* Header Badge */}
        <div>
          <div className="w-12 h-12 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-6 h-6" />
          </div>
          <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-[#1A1A1A]/60 block mb-1">
            Итоги раунда
          </span>
          <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1A1A]">
            {modeTitles[gameMode] || 'Игра завершена'}
          </h3>
          <p className="text-xs font-serif italic text-[#1A1A1A]/80 mt-1">
            {getVerdict()}
          </p>
        </div>

        {/* Score & Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 border border-[#1A1A1A]">
            <div className="text-[9px] uppercase font-bold tracking-widest text-[#1A1A1A]/60">Верно</div>
            <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1">
              {correctCount} <span className="text-xs text-[#1A1A1A]/40 font-normal">/ {totalAnswered}</span>
            </div>
          </div>
          <div className="p-3.5 border border-[#1A1A1A]">
            <div className="text-[9px] uppercase font-bold tracking-widest text-[#1A1A1A]/60">Точность</div>
            <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1">
              {accuracy}%
            </div>
          </div>
          <div className="p-3.5 border border-[#1A1A1A]">
            <div className="text-[9px] uppercase font-bold tracking-widest text-[#1A1A1A]/60">Опыт XP</div>
            <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1">
              +{totalXpEarned}
            </div>
          </div>
        </div>

        {/* Session Question Review */}
        {sessionAnswers.length > 0 && (
          <div className="text-left flex-1 overflow-y-auto max-h-44 space-y-2 pr-1 border border-[#1A1A1A]/30 p-3 bg-[#1A1A1A]/3">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/60 mb-2">
              Протокол раунда:
            </div>
            {sessionAnswers.map((item, idx) => (
              <div
                key={idx}
                className="p-2 border-b border-[#1A1A1A]/15 last:border-b-0 flex items-start justify-between gap-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-serif font-bold text-[#1A1A1A] truncate">
                    {item.question.question}
                  </div>
                  <div className="text-[10px] font-mono text-[#1A1A1A]/70 mt-0.5">
                    Ответ: {item.userAnswer || '—'} | Прав.: {item.question.correctAnswer}
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase shrink-0">
                  {item.isCorrect ? '[✓]' : '[✕]'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={() => {
              sound.playClick();
              onRestart();
            }}
            className="w-full py-3 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] hover:bg-transparent hover:text-[#1A1A1A] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сыграть ещё раз</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onOpenSetup();
            }}
            className="w-full py-3 border border-[#1A1A1A] bg-[#1A1A1A]/10 hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Настроить раунд</span>
          </button>
        </div>
      </div>
    </div>
  );
};
