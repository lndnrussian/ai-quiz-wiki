import React from 'react';
import { Heart } from 'lucide-react';

interface SurvivalLivesProps {
  livesLeft: number;
  maxLives?: number;
  currentStreak: number;
}

export const SurvivalLives: React.FC<SurvivalLivesProps> = ({
  livesLeft,
  maxLives = 3,
}) => {
  return (
    <div id="survival-lives-bar" className="flex items-center justify-between gap-3 border border-[#1A1A1A] px-4 py-3 mb-6 bg-[#F9F7F2]">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
          Жизни:
        </span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: maxLives }).map((_, i) => {
            const isAlive = i < livesLeft;
            return (
              <Heart
                key={i}
                className={`w-4 h-4 transition-all ${
                  isAlive
                    ? 'text-[#1A1A1A] fill-[#1A1A1A]'
                    : 'text-[#1A1A1A]/30 fill-transparent'
                }`}
              />
            );
          })}
        </div>
      </div>

      <div className="text-[10px] uppercase font-mono tracking-widest text-[#1A1A1A]/70">
        Автоматическое нарастание сложности
      </div>
    </div>
  );
};
