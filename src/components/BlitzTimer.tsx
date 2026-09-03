import React, { useEffect } from 'react';
import { Timer } from 'lucide-react';
import { sound } from '../utils/sound';

interface BlitzTimerProps {
  secondsLeft: number;
  totalSeconds: number;
  isActive: boolean;
}

export const BlitzTimer: React.FC<BlitzTimerProps> = ({
  secondsLeft,
  totalSeconds,
  isActive,
}) => {
  const percentage = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));
  const isUrgent = secondsLeft <= 10;

  // Subtle tick sound on critical time
  useEffect(() => {
    if (isActive && isUrgent && secondsLeft > 0) {
      sound.playTick();
    }
  }, [secondsLeft, isUrgent, isActive]);

  return (
    <div id="blitz-timer-container" className="w-full border border-[#1A1A1A] p-3.5 mb-6 bg-[#F9F7F2]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
          <Timer className="w-3.5 h-3.5" />
          <span>Блиц-таймер</span>
        </div>
        <div
          className={`font-mono font-bold text-sm px-2.5 py-0.5 border ${
            isUrgent
              ? 'bg-[#1A1A1A] text-[#F9F7F2] border-[#1A1A1A] animate-pulse'
              : 'border-[#1A1A1A] text-[#1A1A1A]'
          }`}
        >
          {secondsLeft} с
        </div>
      </div>

      <div className="w-full h-2 bg-[#1A1A1A]/10 border border-[#1A1A1A] overflow-hidden">
        <div
          className="h-full bg-[#1A1A1A] transition-all duration-1000 ease-linear"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
