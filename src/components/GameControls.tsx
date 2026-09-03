import React from 'react';
import { GameMode, DifficultyLevel, FormatFilter, RoundCustomizationConfig } from '../types';
import {
  Zap,
  Timer,
  Heart,
  Target,
  BookOpen,
  Layers,
  CheckSquare,
  MessageSquare,
  Compass,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { sound } from '../utils/sound';

interface GameControlsProps {
  gameMode: GameMode;
  onSelectGameMode: (mode: GameMode) => void;
  difficulty: DifficultyLevel;
  onSelectDifficulty: (diff: DifficultyLevel) => void;
  formatFilter: FormatFilter;
  onSelectFormat: (format: FormatFilter) => void;
  selectedCategory: string;
  onOpenCategoryPicker: () => void;
  onOpenRoundSetup: () => void;
  sprintQuestionCount?: number;
  currentQuestionNumber?: number;
  isLoading: boolean;
  engineSource?: 'wikipedia' | 'chgk';
  chgkTimerEnabled?: boolean;
  onToggleChgkTimer?: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  gameMode,
  onSelectGameMode,
  difficulty,
  onSelectDifficulty,
  formatFilter,
  onSelectFormat,
  selectedCategory,
  onOpenCategoryPicker,
  onOpenRoundSetup,
  sprintQuestionCount = 10,
  currentQuestionNumber = 1,
  isLoading,
  engineSource = 'wikipedia',
  chgkTimerEnabled = true,
  onToggleChgkTimer,
}) => {
  const modes: Array<{ id: GameMode; label: string; icon: React.ReactNode; desc: string }> = [
    { id: 'endless', label: 'Бесконечный', icon: <Zap className="w-3.5 h-3.5" />, desc: 'Непрерывный поток новых фактов' },
    { id: 'sprint', label: 'Спринт', icon: <Target className="w-3.5 h-3.5" />, desc: `${sprintQuestionCount} вопросов на раунд` },
    { id: 'blitz', label: 'Блиц-раунд', icon: <Timer className="w-3.5 h-3.5" />, desc: 'Игра на время с таймером' },
    { id: 'survival', label: '3 Жизни', icon: <Heart className="w-3.5 h-3.5" />, desc: 'Выживание с нарастающей сложностью' },
    { id: 'topic', label: 'По темам', icon: <Compass className="w-3.5 h-3.5" />, desc: 'Выбор конкретной категории' },
  ];

  const difficulties: Array<{ id: DifficultyLevel; label: string }> = [
    { id: 'easy', label: 'Лёгкий' },
    { id: 'medium', label: 'Средний' },
    { id: 'hard', label: 'Сложный' },
    { id: 'expert', label: 'Эксперт' },
  ];

  const formats: Array<{ id: FormatFilter; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'Микс', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'multiple_choice', label: '4 варианта', icon: <CheckSquare className="w-3.5 h-3.5" /> },
    { id: 'open_ended', label: 'Без вариантов', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  ];

  return (
    <div id="game-controls-panel" className="w-full border-b border-[#1A1A1A] pb-5 mb-8">
      {/* Top: Game Modes & Customize Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1A1A1A]/15">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/60">
            Режим игры:
          </span>
          {gameMode === 'sprint' && (
            <span className="text-[10px] font-mono font-bold bg-[#1A1A1A] text-[#F9F7F2] px-1.5 py-0.5">
              Вопрос {Math.min(currentQuestionNumber, sprintQuestionCount)} / {sprintQuestionCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {modes.map((m) => {
              const isActive = gameMode === m.id;
              return (
                <button
                  key={m.id}
                  id={`mode-btn-${m.id}`}
                  onClick={() => {
                    sound.playClick();
                    onSelectGameMode(m.id);
                  }}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all border ${
                    isActive
                      ? 'bg-[#1A1A1A] border-[#1A1A1A] text-[#F9F7F2]'
                      : 'bg-transparent border-[#1A1A1A]/30 text-[#1A1A1A] hover:border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2]'
                  }`}
                  title={m.desc}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Customize Lobby Button */}
          <button
            id="open-round-setup-btn"
            onClick={() => {
              sound.playClick();
              onOpenRoundSetup();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1A1A1A] bg-[#1A1A1A]/5 hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] font-bold text-xs uppercase tracking-wider transition-all shrink-0"
            title="Открыть полное меню кастомизации раунда перед игрой"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Настроить</span>
          </button>
        </div>
      </div>

      {/* Category selector bar if in topic mode */}
      {gameMode === 'topic' && engineSource !== 'chgk' && (
        <div className="py-3 border-b border-[#1A1A1A]/15 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 text-xs text-[#1A1A1A]">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]/60">Текущая тема:</span>
            <span className="font-serif font-bold text-sm bg-[#1A1A1A] text-[#F9F7F2] px-2 py-0.5">
              {selectedCategory === 'all' ? 'Случайные темы русской Википедии' : selectedCategory}
            </span>
          </div>
          <button
            id="choose-category-btn"
            onClick={() => {
              sound.playClick();
              onOpenCategoryPicker();
            }}
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] transition-colors"
          >
            Выбрать тему...
          </button>
        </div>
      )}

      {/* ChGK Mode Bar with In-game Clock Toggle */}
      {engineSource === 'chgk' && (
        <div className="py-2.5 px-3 bg-[#1A1A1A]/5 border-t border-[#1A1A1A]/15 flex flex-wrap items-center justify-between gap-2 text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-base">🦉</span>
            <span className="font-serif font-bold text-[#1A1A1A]">База «Что? Где? Когда?»</span>
            <span className="text-[10px] font-mono text-[#1A1A1A]/60">• db.chgk.info</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono font-bold text-[#1A1A1A]">
              {chgkTimerEnabled ? '⏱️ С часами (60 сек)' : '⏳ Без часов (без лимита)'}
            </span>
            {onToggleChgkTimer && (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onToggleChgkTimer();
                }}
                className="px-2.5 py-1 border border-[#1A1A1A]/40 hover:border-[#1A1A1A] bg-[#F9F7F2] text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
              >
                {chgkTimerEnabled ? 'Выключить часы' : 'Включить часы'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom: Difficulty & Format Filters */}
      <div className="pt-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Difficulty chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/60 mr-1">Сложность:</span>
          <div className="flex items-center gap-1.5">
            {difficulties.map((d) => {
              const isActive = difficulty === d.id;
              return (
                <button
                  key={d.id}
                  id={`difficulty-btn-${d.id}`}
                  onClick={() => {
                    sound.playClick();
                    onSelectDifficulty(d.id);
                  }}
                  disabled={isLoading || gameMode === 'survival'}
                  className={`px-2.5 py-1 text-xs font-bold tracking-tight transition-all border ${
                    isActive
                      ? 'bg-[#1A1A1A] border-[#1A1A1A] text-[#F9F7F2]'
                      : 'border-[#1A1A1A]/30 text-[#1A1A1A]/80 hover:border-[#1A1A1A]'
                  } ${gameMode === 'survival' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={gameMode === 'survival' ? 'В режиме выживания сложность повышается автоматически' : ''}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Format chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/60 mr-1">Формат:</span>
          <div className="flex items-center gap-1.5">
            {formats.map((f) => {
              const isActive = formatFilter === f.id;
              return (
                <button
                  key={f.id}
                  id={`format-btn-${f.id}`}
                  onClick={() => {
                    sound.playClick();
                    onSelectFormat(f.id);
                  }}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-tight transition-all border ${
                    isActive
                      ? 'bg-[#1A1A1A] border-[#1A1A1A] text-[#F9F7F2]'
                      : 'border-[#1A1A1A]/30 text-[#1A1A1A]/80 hover:border-[#1A1A1A]'
                  }`}
                >
                  {f.icon}
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
