import React, { useEffect } from 'react';
import { AchievementDefinition } from '../types';
import { Trophy, Sparkles, X } from 'lucide-react';
import { sound } from '../utils/sound';

interface AchievementToastProps {
  achievement: AchievementDefinition | null;
  onDismiss: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({ achievement, onDismiss }) => {
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  const rarityStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    common: { bg: 'bg-[#1A1A1A]', border: 'border-[#1A1A1A]', text: 'text-[#F9F7F2]', badge: 'ОБЫЧНЫЙ' },
    rare: { bg: 'bg-[#1A1A1A]', border: 'border-[#1A1A1A]', text: 'text-[#F9F7F2]', badge: 'РЕДКИЙ' },
    epic: { bg: 'bg-[#1A1A1A]', border: 'border-[#1A1A1A]', text: 'text-[#F9F7F2]', badge: 'ЭПИЧЕСКИЙ' },
    legendary: { bg: 'bg-[#1A1A1A]', border: 'border-[#1A1A1A]', text: 'text-[#F9F7F2]', badge: 'ЛЕГЕНДАРНЫЙ' },
  };

  const style = rarityStyles[achievement.rarity] || rarityStyles.common;

  return (
    <div
      id="achievement-unlock-toast"
      className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#F9F7F2] border-2 border-[#1A1A1A] p-4 shadow-2xl animate-bounce-subtle"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[8px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 bg-[#1A1A1A] text-[#F9F7F2]">
                Достижение разблокировано!
              </span>
              <span className="text-[8px] font-mono text-[#1A1A1A]/70 font-semibold">
                +{achievement.xpReward} XP
              </span>
            </div>
            <h4 className="font-serif font-bold text-sm text-[#1A1A1A] leading-tight">
              {achievement.title}
            </h4>
            <p className="text-xs text-[#1A1A1A]/75 mt-1 leading-snug">
              {achievement.description}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            sound.playClick();
            onDismiss();
          }}
          className="p-1 border border-transparent hover:border-[#1A1A1A] text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors"
          title="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
