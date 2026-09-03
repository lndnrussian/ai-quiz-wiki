import React from 'react';
import { UserStats } from '../types';
import { calculateUserRank } from '../utils/storage';
import { X, Trophy, Flame, Check, BarChart2 } from 'lucide-react';
import { sound } from '../utils/sound';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  stats,
}) => {
  if (!isOpen) return null;

  const rank = calculateUserRank(stats.xp);
  const accuracy = stats.totalAnswered > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
    : 0;

  const diffNames: Record<string, string> = {
    easy: 'Лёгкий',
    medium: 'Средний',
    hard: 'Сложный',
    expert: 'Эксперт',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/70 backdrop-blur-xs animate-fadeIn">
      <div
        id="stats-modal"
        className="w-full max-w-2xl bg-[#F9F7F2] border border-[#1A1A1A] p-6 sm:p-8 max-h-[90vh] flex flex-col space-y-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#1A1A1A]">
          <div>
            <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-[#1A1A1A]/60 block mb-1">
              Архив результатов
            </span>
            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1A1A] leading-none">
              Статистика игрока
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

        <div className="overflow-y-auto space-y-6 pr-1 flex-1">
          {/* Level / Rank Hero Card */}
          <div className="p-5 border border-[#1A1A1A] bg-[#1A1A1A]/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] flex items-center justify-center font-mono font-black text-xl">
                {rank.level}
              </div>
              <div>
                <div className="text-[10px] text-[#1A1A1A]/60 font-bold uppercase tracking-widest">
                  Уровень {rank.level}
                </div>
                <div className="text-xl font-serif font-bold text-[#1A1A1A]">
                  {rank.title}
                </div>
                <div className="text-xs font-mono text-[#1A1A1A]/70">
                  {stats.xp.toLocaleString('ru-RU')} / {rank.nextLevelXp.toLocaleString('ru-RU')} XP
                </div>
              </div>
            </div>

            <div className="w-full sm:w-48">
              <div className="flex justify-between text-xs font-mono text-[#1A1A1A] mb-1">
                <span>Прогресс:</span>
                <span className="font-bold">{rank.progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-[#1A1A1A]/10 border border-[#1A1A1A]">
                <div
                  className="h-full bg-[#1A1A1A] transition-all"
                  style={{ width: `${rank.progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 border border-[#1A1A1A] text-center">
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/60">Всего ответов</div>
              <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1">{stats.totalAnswered}</div>
            </div>
            <div className="p-4 border border-[#1A1A1A] text-center">
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/60">Верных</div>
              <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1">{stats.totalCorrect}</div>
            </div>
            <div className="p-4 border border-[#1A1A1A] text-center">
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/60">Точность</div>
              <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1">{accuracy}%</div>
            </div>
            <div className="p-4 border border-[#1A1A1A] text-center">
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/60">Рекорд серии</div>
              <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1 flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 fill-[#1A1A1A]" />
                <span>{stats.bestStreak}</span>
              </div>
            </div>
          </div>

          {/* Breakdown by Difficulty */}
          <div className="p-5 border border-[#1A1A1A]">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-4 flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Точность по сложностям</span>
            </h4>

            <div className="space-y-3">
              {(['easy', 'medium', 'hard', 'expert'] as const).map((diff) => {
                const data = stats.byDifficulty[diff] || { answered: 0, correct: 0 };
                const pct = data.answered > 0 ? Math.round((data.correct / data.answered) * 100) : 0;
                return (
                  <div key={diff} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-bold text-[#1A1A1A]">{diffNames[diff]}</span>
                      <span className="text-[#1A1A1A]/70">
                        {data.correct} из {data.answered} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1A1A1A]/10 border border-[#1A1A1A]/30">
                      <div
                        className="h-full bg-[#1A1A1A] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Question History */}
          {stats.history.length > 0 && (
            <div className="p-5 border border-[#1A1A1A]">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-3">
                Журнал последних ответов
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {stats.history.slice(0, 10).map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3 border border-[#1A1A1A]/30 bg-[#F9F7F2] flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-serif font-bold text-[#1A1A1A] truncate max-w-sm sm:max-w-md">
                        {h.question.question}
                      </div>
                      <div className="text-[11px] font-mono text-[#1A1A1A]/70 mt-0.5">
                        Ответ: «{h.userAnswer || '—'}» | Прав.: {h.question.correctAnswer}
                      </div>
                    </div>
                    <div className="shrink-0 mt-0.5 font-bold font-mono text-xs">
                      {h.isCorrect ? (
                        <span className="text-[#1A1A1A] border border-[#1A1A1A] px-1.5 py-0.5 bg-[#1A1A1A] text-[#F9F7F2]">ВЕРНО</span>
                      ) : (
                        <span className="text-[#1A1A1A] border border-[#1A1A1A] px-1.5 py-0.5">НЕВЕРНО</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
