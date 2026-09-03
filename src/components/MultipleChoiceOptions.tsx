import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { sound } from '../utils/sound';

interface MultipleChoiceOptionsProps {
  options: string[];
  correctAnswer: string;
  selectedAnswer: string | null;
  onSelectOption: (option: string) => void;
  isAnswered: boolean;
  disabled?: boolean;
}

export const MultipleChoiceOptions: React.FC<MultipleChoiceOptionsProps> = ({
  options,
  correctAnswer,
  selectedAnswer,
  onSelectOption,
  isAnswered,
  disabled = false,
}) => {
  const letters = ['А', 'Б', 'В', 'Г'];
  const numberKeys = ['1', '2', '3', '4'];

  // Keyboard shortcut support (1-4 or numpad)
  useEffect(() => {
    if (isAnswered || disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const idx = numberKeys.indexOf(e.key);
      if (idx !== -1 && options[idx]) {
        e.preventDefault();
        sound.playClick();
        onSelectOption(options[idx]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, isAnswered, disabled, onSelectOption]);

  return (
    <div id="multiple-choice-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
      {options.map((option, index) => {
        const isSelected = selectedAnswer === option;
        const isCorrect = option === correctAnswer;

        let btnStyle = 'border border-[#1A1A1A] p-4 sm:p-5 text-left transition-all bg-transparent text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2]';
        let badgeStyle = 'border border-[#1A1A1A] text-[#1A1A1A] group-hover:border-[#F9F7F2] group-hover:text-[#F9F7F2]';
        let icon: React.ReactNode = null;

        if (isAnswered) {
          if (isCorrect) {
            btnStyle = 'bg-[#1A1A1A] text-[#F9F7F2] border border-[#1A1A1A] shadow-md';
            badgeStyle = 'bg-[#F9F7F2] text-[#1A1A1A] border-[#F9F7F2] font-bold';
            icon = <Check className="w-4 h-4 text-[#F9F7F2] shrink-0" />;
          } else if (isSelected && !isCorrect) {
            btnStyle = 'bg-[#1A1A1A]/10 border-2 border-[#1A1A1A] text-[#1A1A1A] line-through';
            badgeStyle = 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]';
            icon = <X className="w-4 h-4 text-[#1A1A1A] shrink-0" />;
          } else {
            btnStyle = 'border border-[#1A1A1A]/20 text-[#1A1A1A]/30 opacity-40 bg-transparent';
            badgeStyle = 'border-[#1A1A1A]/20 text-[#1A1A1A]/30';
          }
        }

        return (
          <button
            key={index}
            id={`quiz-option-${index}`}
            onClick={() => {
              if (!isAnswered && !disabled) {
                sound.playClick();
                onSelectOption(option);
              }
            }}
            disabled={isAnswered || disabled}
            className={`w-full group flex items-center justify-between transition-all select-none ${btnStyle}`}
          >
            <div className="flex items-center gap-4 min-w-0 pr-2">
              <span
                className={`w-7 h-7 flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-colors ${badgeStyle}`}
              >
                {letters[index] || index + 1}
              </span>
              <span className="text-base sm:text-lg font-medium tracking-tight break-words">
                {option}
              </span>
            </div>

            {icon}
          </button>
        );
      })}
    </div>
  );
};
