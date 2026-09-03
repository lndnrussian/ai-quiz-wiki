import React from 'react';
import { Sparkles, Flame, Volume2, VolumeX, Bookmark, Trophy, Sliders, Key } from 'lucide-react';
import { UserProfile } from '../types';
import { calculateUserRank } from '../utils/storage';
import { AVATAR_OPTIONS } from '../utils/achievements';
import { sound } from '../utils/sound';

interface HeaderProps {
  activeProfile: UserProfile;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenProfile: () => void;
  onOpenFavorites: () => void;
  onOpenSetup?: () => void;
  onOpenSettings?: () => void;
  isLobbyActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeProfile,
  isMuted,
  onToggleMute,
  onOpenProfile,
  onOpenFavorites,
  onOpenSetup,
  onOpenSettings,
  isLobbyActive = false,
}) => {
  const stats = activeProfile.stats;
  const rank = calculateUserRank(stats.xp);
  const avatarObj = AVATAR_OPTIONS.find((a) => a.id === activeProfile.avatar) || AVATAR_OPTIONS[0];

  return (
    <header id="main-header" className="w-full bg-[#F9F7F2] border-b border-[#1A1A1A] sticky top-0 z-40 select-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Brand & Masthead */}
        <div className="flex items-baseline gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-[#1A1A1A] text-[#F9F7F2] text-sm font-black tracking-tighter">
            В
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase leading-none font-sans text-[#1A1A1A]">
                Вики-Квиз
              </h1>
              <span className="text-[9px] uppercase tracking-[0.25em] font-bold px-1.5 py-0.5 border border-[#1A1A1A] text-[#1A1A1A]">
                Энциклопедия
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.25em] mt-1 text-[#1A1A1A]/70 font-semibold hidden sm:block">
              Интеллектуальная викторина русской Википедии
            </p>
          </div>
        </div>

        {/* User Profile, XP & Level Progress */}
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          {/* Setup / Lobby toggle button if in playing mode */}
          {onOpenSetup && (
            <button
              id="header-setup-btn"
              onClick={() => {
                sound.playClick();
                onOpenSetup();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 border font-bold text-xs uppercase tracking-wider transition-all ${
                isLobbyActive
                  ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                  : 'border-[#1A1A1A] bg-transparent text-[#1A1A1A] hover:bg-[#1A1A1A]/5'
              }`}
              title="Настройка раунда и параметров игры"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Параметры</span>
            </button>
          )}

          {/* User Profile Badge Button */}
          <button
            id="open-profile-btn"
            onClick={() => {
              sound.playClick();
              onOpenProfile();
            }}
            className="flex items-center gap-2.5 px-3 py-1.5 border border-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-all text-left group"
            title="Открыть профиль и достижения игрока"
          >
            <div className="w-7 h-7 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
              {avatarObj.emoji}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-bold text-xs text-[#1A1A1A] truncate max-w-[90px] sm:max-w-[120px]">
                  {activeProfile.name}
                </span>
                <span className="text-[8px] font-mono font-bold px-1 bg-[#1A1A1A] text-[#F9F7F2]">
                  Ур.{rank.level}
                </span>
              </div>
              <span className="text-[9px] font-mono text-[#1A1A1A]/70 font-semibold">
                {stats.xp.toLocaleString('ru-RU')} XP
              </span>
            </div>
          </button>

          {/* Quick Stats & Controls */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-[#1A1A1A]/20">
            {/* Streak Counter */}
            {stats.currentStreak > 0 && (
              <div
                id="streak-badge"
                className="flex items-center gap-1 px-2 py-1 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] font-mono text-xs font-bold"
                title="Серия правильных ответов"
              >
                <Flame className="w-3.5 h-3.5 fill-[#F9F7F2]" />
                <span>{stats.currentStreak}</span>
              </div>
            )}

            {/* Achievements & Badges quick button */}
            <button
              id="open-achievements-btn"
              onClick={() => {
                sound.playClick();
                onOpenProfile();
              }}
              className="p-1.5 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] transition-colors relative"
              title="Достижения и значки"
              aria-label="Достижения"
            >
              <Trophy className="w-3.5 h-3.5" />
              {activeProfile.achievements.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 bg-[#1A1A1A] text-[#F9F7F2] text-[8px] font-mono font-bold border border-[#F9F7F2]">
                  {activeProfile.achievements.length}
                </span>
              )}
            </button>

            {/* Bookmarks button */}
            <button
              id="open-favorites-btn"
              onClick={() => {
                sound.playClick();
                onOpenFavorites();
              }}
              className="p-1.5 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] transition-colors relative"
              title="Сохранённые факты"
              aria-label="Избранное"
            >
              <Bookmark className="w-3.5 h-3.5" />
              {stats.favorites.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 bg-[#1A1A1A] text-[#F9F7F2] text-[8px] font-mono font-bold border border-[#F9F7F2]">
                  {stats.favorites.length}
                </span>
              )}
            </button>

            {/* Settings & API Key */}
            {onOpenSettings && (
              <button
                id="open-settings-btn"
                onClick={() => {
                  sound.playClick();
                  onOpenSettings();
                }}
                className="p-1.5 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] transition-colors"
                title="Настройки, квота и API ключ"
                aria-label="Настройки"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Mute/Unmute sound */}
            <button
              id="toggle-sound-btn"
              onClick={() => {
                onToggleMute();
              }}
              className="p-1.5 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] transition-colors"
              title={isMuted ? 'Включить звук' : 'Выключить звук'}
              aria-label="Звук"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 opacity-50" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
