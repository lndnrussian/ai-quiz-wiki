import React, { useState } from 'react';
import { UserProfile, WikiQuestion } from '../types';
import { ACHIEVEMENTS, AVATAR_OPTIONS } from '../utils/achievements';
import { calculateUserRank, getTopicMastery } from '../utils/storage';
import {
  X,
  Trophy,
  Flame,
  Check,
  BarChart2,
  Award,
  User,
  Users,
  Plus,
  Trash2,
  Edit2,
  BookOpen,
  Sparkles,
  Zap,
  Target,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  Lock,
  Layers,
  Crown,
} from 'lucide-react';
import { sound } from '../utils/sound';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile: UserProfile;
  allProfiles: UserProfile[];
  onSwitchProfile: (id: string) => void;
  onCreateProfile: (name: string, avatar: string) => void;
  onUpdateProfile: (data: Partial<UserProfile>) => void;
  onDeleteProfile: (id: string) => void;
  onResetStats: (id: string) => void;
}

type TabType = 'overview' | 'badges' | 'topics' | 'difficulty' | 'history' | 'profiles';

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
  allProfiles,
  onSwitchProfile,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onResetStats,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(activeProfile.name);
  const [selectedAvatar, setSelectedAvatar] = useState(activeProfile.avatar);

  // New profile state
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileAvatar, setNewProfileAvatar] = useState('owl');
  const [showAddProfileForm, setShowAddProfileForm] = useState(false);

  if (!isOpen) return null;

  const stats = activeProfile.stats;
  const rank = calculateUserRank(stats.xp);
  const accuracy = stats.totalAnswered > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
    : 0;

  const unlockedBadgeIds = new Set(activeProfile.achievements.map((a) => a.id));
  const unlockedCount = activeProfile.achievements.length;
  const totalBadgesCount = ACHIEVEMENTS.length;

  const avatarObj = AVATAR_OPTIONS.find((a) => a.id === activeProfile.avatar) || AVATAR_OPTIONS[0];

  const diffNames: Record<string, string> = {
    easy: 'Лёгкий уровень',
    medium: 'Средний уровень',
    hard: 'Сложный уровень',
    expert: 'Уровень Эксперт',
  };

  const handleSaveName = () => {
    if (editedName.trim()) {
      onUpdateProfile({ name: editedName.trim(), avatar: selectedAvatar });
    }
    setIsEditingName(false);
    sound.playClick();
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    onCreateProfile(newProfileName.trim(), newProfileAvatar);
    setNewProfileName('');
    setShowAddProfileForm(false);
    sound.playAchievement();
  };

  // Standard Wikipedia categories to show in Topics tab
  const allCategoryKeys = [
    'История',
    'Наука',
    'География',
    'Космос',
    'Литература',
    'Биология',
    'Искусство',
    'Кино',
    'Спорт',
    'Мифология',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#1A1A1A]/75 backdrop-blur-xs animate-fadeIn">
      <div
        id="profile-modal"
        className="w-full max-w-3xl bg-[#F9F7F2] border border-[#1A1A1A] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="p-5 sm:p-6 border-b border-[#1A1A1A] flex items-center justify-between gap-4 bg-[#F9F7F2]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] flex items-center justify-center text-2xl shrink-0">
              {avatarObj.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#1A1A1A] leading-tight">
                  {activeProfile.name}
                </h3>
                <span className="text-[9px] uppercase tracking-widest font-mono font-bold px-1.5 py-0.5 bg-[#1A1A1A] text-[#F9F7F2]">
                  Ур. {rank.level}
                </span>
              </div>
              <p className="text-xs font-mono text-[#1A1A1A]/70 mt-0.5">
                {rank.title} • {stats.xp.toLocaleString('ru-RU')} XP
              </p>
            </div>
          </div>

          <button
            id="close-profile-modal-btn"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] transition-colors"
            title="Закрыть профиль"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 border-b border-[#1A1A1A] overflow-x-auto bg-[#1A1A1A]/5 shrink-0 py-2">
          {[
            { id: 'overview', label: 'Обзор', icon: User },
            { id: 'badges', label: `Значки (${unlockedCount}/${totalBadgesCount})`, icon: Trophy },
            { id: 'topics', label: 'Темы и знания', icon: Layers },
            { id: 'difficulty', label: 'Сложности', icon: BarChart2 },
            { id: 'history', label: 'История', icon: BookOpen },
            { id: 'profiles', label: `Игроки (${allProfiles.length})`, icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`profile-tab-${tab.id}`}
                onClick={() => {
                  sound.playClick();
                  setActiveTab(tab.id as TabType);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-mono tracking-wide border transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1A1A1A] text-[#F9F7F2] border-[#1A1A1A]'
                    : 'bg-transparent text-[#1A1A1A] border-transparent hover:border-[#1A1A1A]/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Profile Card & Level Progress */}
              <div className="p-5 border border-[#1A1A1A] bg-[#1A1A1A]/5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] flex items-center justify-center text-3xl">
                      {avatarObj.emoji}
                    </div>
                    <div>
                      {isEditingName ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            maxLength={24}
                            className="px-2 py-1 border border-[#1A1A1A] text-sm font-serif font-bold bg-[#F9F7F2] text-[#1A1A1A] focus:outline-none"
                          />
                          <button
                            onClick={handleSaveName}
                            className="px-2 py-1 bg-[#1A1A1A] text-[#F9F7F2] text-xs font-bold"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h4 className="text-xl font-serif font-bold text-[#1A1A1A]">
                            {activeProfile.name}
                          </h4>
                          <button
                            onClick={() => {
                              setIsEditingName(true);
                              setEditedName(activeProfile.name);
                              sound.playClick();
                            }}
                            className="p-1 text-[#1A1A1A]/50 hover:text-[#1A1A1A]"
                            title="Изменить имя"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="text-xs font-serif italic text-[#1A1A1A]/80">
                        {rank.title} (Ранг {rank.level})
                      </div>
                      <div className="text-[11px] font-mono text-[#1A1A1A]/60 mt-0.5">
                        {stats.xp.toLocaleString('ru-RU')} / {rank.nextLevelXp.toLocaleString('ru-RU')} XP
                      </div>
                    </div>
                  </div>

                  {/* Level progress bar */}
                  <div className="w-full sm:w-56">
                    <div className="flex justify-between text-xs font-mono text-[#1A1A1A] mb-1">
                      <span>До ранга {rank.level + 1}:</span>
                      <span className="font-bold">{rank.progressPercent}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#1A1A1A]/10 border border-[#1A1A1A]">
                      <div
                        className="h-full bg-[#1A1A1A] transition-all"
                        style={{ width: `${rank.progressPercent}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-right text-[#1A1A1A]/60 mt-1">
                      Осталось {(rank.nextLevelXp - stats.xp).toLocaleString('ru-RU')} XP
                    </div>
                  </div>
                </div>

                {/* Avatar quick picker during edit */}
                {isEditingName && (
                  <div className="mt-4 pt-4 border-t border-[#1A1A1A]/20">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/60 mb-2">
                      Выберите аватар игрока:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {AVATAR_OPTIONS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => {
                            setSelectedAvatar(av.id);
                            sound.playClick();
                          }}
                          className={`w-9 h-9 border flex items-center justify-center text-lg transition-all ${
                            selectedAvatar === av.id
                              ? 'border-[#1A1A1A] bg-[#1A1A1A] scale-105'
                              : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] bg-transparent'
                          }`}
                          title={av.label}
                        >
                          {av.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 4 Core Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 border border-[#1A1A1A] text-center bg-[#F9F7F2]">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/60">
                    Всего ответов
                  </div>
                  <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1">
                    {stats.totalAnswered}
                  </div>
                  <div className="text-[10px] text-[#1A1A1A]/60 mt-0.5">
                    {stats.totalCorrect} верных
                  </div>
                </div>

                <div className="p-4 border border-[#1A1A1A] text-center bg-[#F9F7F2]">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/60">
                    Точность
                  </div>
                  <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1">
                    {accuracy}%
                  </div>
                  <div className="text-[10px] text-[#1A1A1A]/60 mt-0.5">
                    от всех попыток
                  </div>
                </div>

                <div className="p-4 border border-[#1A1A1A] text-center bg-[#F9F7F2]">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/60">
                    Рекорд серии
                  </div>
                  <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1 flex items-center justify-center gap-1">
                    <Flame className="w-4 h-4 fill-[#1A1A1A]" />
                    <span>{stats.bestStreak}</span>
                  </div>
                  <div className="text-[10px] text-[#1A1A1A]/60 mt-0.5">
                    сейчас: {stats.currentStreak}
                  </div>
                </div>

                <div className="p-4 border border-[#1A1A1A] text-center bg-[#F9F7F2]">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/60">
                    Значки
                  </div>
                  <div className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1 flex items-center justify-center gap-1">
                    <Trophy className="w-4 h-4" />
                    <span>{unlockedCount}</span>
                  </div>
                  <div className="text-[10px] text-[#1A1A1A]/60 mt-0.5">
                    из {totalBadgesCount} наград
                  </div>
                </div>
              </div>

              {/* Highlights: Recent Achievements Showcase */}
              <div className="p-5 border border-[#1A1A1A]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Последние достижения</span>
                  </h4>
                  <button
                    onClick={() => {
                      sound.playClick();
                      setActiveTab('badges');
                    }}
                    className="text-[11px] font-mono font-bold text-[#1A1A1A] hover:underline"
                  >
                    Все значки →
                  </button>
                </div>

                {unlockedCount === 0 ? (
                  <p className="text-xs text-[#1A1A1A]/60 italic">
                    У вас пока нет разблокированных значков. Отвечайте на вопросы, чтобы заработать первые награды!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {ACHIEVEMENTS.filter((a) => unlockedBadgeIds.has(a.id))
                      .slice(0, 3)
                      .map((ach) => (
                        <div
                          key={ach.id}
                          className="p-3 border border-[#1A1A1A] bg-[#1A1A1A]/5 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] flex items-center justify-center shrink-0">
                            <Award className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-serif font-bold text-xs text-[#1A1A1A] truncate">
                              {ach.title}
                            </div>
                            <div className="text-[10px] text-[#1A1A1A]/70 truncate">
                              +{ach.xpReward} XP
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BADGES & ACHIEVEMENTS */}
          {activeTab === 'badges' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#1A1A1A]/20">
                <div className="text-xs font-mono text-[#1A1A1A]">
                  Открыто: <span className="font-bold">{unlockedCount}</span> из {totalBadgesCount} ({Math.round((unlockedCount / totalBadgesCount) * 100)}%)
                </div>

                <div className="flex items-center gap-1">
                  {(['all', 'unlocked', 'locked'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        sound.playClick();
                        setBadgeFilter(f);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-mono uppercase font-bold border transition-colors ${
                        badgeFilter === f
                          ? 'bg-[#1A1A1A] text-[#F9F7F2] border-[#1A1A1A]'
                          : 'bg-transparent text-[#1A1A1A] border-[#1A1A1A]/30 hover:border-[#1A1A1A]'
                      }`}
                    >
                      {f === 'all' ? 'Все' : f === 'unlocked' ? 'Полученные' : 'В процессе'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Badges Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACHIEVEMENTS.filter((ach) => {
                  const isUnlocked = unlockedBadgeIds.has(ach.id);
                  if (badgeFilter === 'unlocked') return isUnlocked;
                  if (badgeFilter === 'locked') return !isUnlocked;
                  return true;
                }).map((ach) => {
                  const isUnlocked = unlockedBadgeIds.has(ach.id);
                  const progress = ach.checkProgress(stats);
                  const progressPct = Math.min(100, Math.round((progress / ach.maxProgress) * 100));

                  const rarityBadge = {
                    common: 'Обычный',
                    rare: 'Редкий',
                    epic: 'Эпический',
                    legendary: 'Легендарный',
                  }[ach.rarity];

                  return (
                    <div
                      key={ach.id}
                      className={`p-4 border transition-all ${
                        isUnlocked
                          ? 'border-[#1A1A1A] bg-[#F9F7F2]'
                          : 'border-[#1A1A1A]/30 bg-[#1A1A1A]/5 opacity-75'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 border flex items-center justify-center shrink-0 ${
                            isUnlocked
                              ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                              : 'border-[#1A1A1A]/40 bg-transparent text-[#1A1A1A]/40'
                          }`}
                        >
                          {isUnlocked ? <Trophy className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="font-serif font-bold text-sm text-[#1A1A1A] truncate">
                              {ach.title}
                            </h5>
                            <span className="text-[9px] font-mono uppercase tracking-widest text-[#1A1A1A]/60 shrink-0">
                              {rarityBadge}
                            </span>
                          </div>

                          <p className="text-xs text-[#1A1A1A]/75 mt-0.5 leading-snug">
                            {ach.description}
                          </p>

                          {/* Progress bar or Unlocked status */}
                          <div className="mt-3">
                            {isUnlocked ? (
                              <div className="flex items-center justify-between text-[11px] font-mono text-[#1A1A1A] font-bold">
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Выполнено</span>
                                </span>
                                <span>+{ach.xpReward} XP</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-mono text-[#1A1A1A]/70">
                                  <span>Прогресс: {progress} / {ach.maxProgress}</span>
                                  <span>{progressPct}% (+{ach.xpReward} XP)</span>
                                </div>
                                <div className="w-full h-1.5 bg-[#1A1A1A]/10 border border-[#1A1A1A]/20">
                                  <div
                                    className="h-full bg-[#1A1A1A] transition-all"
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TOPICS & SUBJECT MASTERY */}
          {activeTab === 'topics' && (
            <div className="space-y-4">
              <div className="p-4 border border-[#1A1A1A] bg-[#1A1A1A]/5">
                <h4 className="font-serif font-bold text-base text-[#1A1A1A]">
                  Мастерство по темам русской Википедии
                </h4>
                <p className="text-xs text-[#1A1A1A]/70 mt-1">
                  Отвечайте на вопросы из различных категорий, чтобы повышать свой уровень мастерства от Бронзового знатока до Алмазного магистра.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allCategoryKeys.map((cat) => {
                  const data = stats.byCategory[cat] || { answered: 0, correct: 0 };
                  const mastery = getTopicMastery(data.correct);
                  const pct = data.answered > 0 ? Math.round((data.correct / data.answered) * 100) : 0;

                  return (
                    <div key={cat} className="p-4 border border-[#1A1A1A] bg-[#F9F7F2] space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-serif font-bold text-sm text-[#1A1A1A]">
                            {cat}
                          </div>
                          <div className="text-[10px] font-mono text-[#1A1A1A]/70 mt-0.5">
                            {data.correct} верных из {data.answered} ответов ({pct}%)
                          </div>
                        </div>

                        {/* Mastery Tier Pill */}
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]">
                            {mastery.label}
                          </span>
                          <div className="flex gap-0.5 mt-1 text-xs">
                            {[1, 2, 3, 4].map((star) => (
                              <span
                                key={star}
                                className={star <= mastery.stars ? 'text-[#1A1A1A]' : 'text-[#1A1A1A]/20'}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Progress bar towards next tier */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-[#1A1A1A]/70">
                          <span>
                            {mastery.tier === 'diamond'
                              ? 'Максимальный уровень мастерства'
                              : `До след. ранга: ${data.correct} / ${mastery.nextTierNeeded}`}
                          </span>
                          <span>{pct}% точность</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#1A1A1A]/10 border border-[#1A1A1A]/30">
                          <div
                            className="h-full bg-[#1A1A1A] transition-all"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((data.correct / Math.max(1, mastery.nextTierNeeded)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: DIFFICULTY LEVELS */}
          {activeTab === 'difficulty' && (
            <div className="space-y-5">
              <div className="p-4 border border-[#1A1A1A] bg-[#1A1A1A]/5">
                <h4 className="font-serif font-bold text-base text-[#1A1A1A]">
                  Прогресс по уровням сложности
                </h4>
                <p className="text-xs text-[#1A1A1A]/70 mt-1">
                  От базовых фактов до сложнейших академических нюансов энциклопедии.
                </p>
              </div>

              <div className="space-y-4">
                {(['easy', 'medium', 'hard', 'expert'] as const).map((diff) => {
                  const data = stats.byDifficulty[diff] || { answered: 0, correct: 0 };
                  const pct = data.answered > 0 ? Math.round((data.correct / data.answered) * 100) : 0;
                  const diffDesc = {
                    easy: 'Базовые термины, популярные персоны, столицы и ключевые открытия.',
                    medium: 'Исторические даты, географические особенности и сюжеты литературы.',
                    hard: 'Глубокие научные факты, редкие термины и малоизвестные события.',
                    expert: 'Академический уровень: сложнейшие статьи из глубин Википедии.',
                  }[diff];

                  return (
                    <div key={diff} className="p-4 border border-[#1A1A1A] bg-[#F9F7F2] space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm text-[#1A1A1A]">
                              {diffNames[diff]}
                            </span>
                            <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 border border-[#1A1A1A]">
                              {diff.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-[#1A1A1A]/70 mt-0.5">
                            {diffDesc}
                          </p>
                        </div>
                        <div className="text-right font-mono text-xs font-bold text-[#1A1A1A]">
                          {data.correct} из {data.answered} ({pct}%)
                        </div>
                      </div>

                      <div className="w-full h-2 bg-[#1A1A1A]/10 border border-[#1A1A1A]/30">
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
          )}

          {/* TAB 5: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#1A1A1A]/20">
                <span className="text-xs font-mono text-[#1A1A1A]">
                  Всего сохранено в журнале: {stats.history.length}
                </span>
              </div>

              {stats.history.length === 0 ? (
                <div className="p-8 border border-dashed border-[#1A1A1A]/30 text-center text-xs text-[#1A1A1A]/60 italic">
                  История ответов пока пуста. Начните викторину, чтобы сохранять журнал вопросов!
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {stats.history.map((h, idx) => (
                    <div
                      key={idx}
                      className="p-3 border border-[#1A1A1A]/40 bg-[#F9F7F2] flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-serif font-bold text-[#1A1A1A] leading-snug">
                          {h.question.question}
                        </div>
                        <div className="text-[11px] font-mono text-[#1A1A1A]/70 mt-1">
                          Ваш ответ: «{h.userAnswer || '—'}» • Верный: «{h.question.correctAnswer}»
                        </div>
                        <a
                          href={h.question.articleUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-[#1A1A1A] underline mt-1"
                        >
                          <span>Статья: {h.question.articleTitle}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      <div className="shrink-0 text-right">
                        {h.isCorrect ? (
                          <span className="px-2 py-0.5 bg-[#1A1A1A] text-[#F9F7F2] font-mono font-bold text-[10px]">
                            ВЕРНО
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 border border-[#1A1A1A] font-mono font-bold text-[10px]">
                            НЕВЕРНО
                          </span>
                        )}
                        <div className="text-[9px] font-mono text-[#1A1A1A]/50 mt-1">
                          {h.timeSpentSeconds} сек
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: MULTI-PROFILE MANAGEMENT */}
          {activeTab === 'profiles' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]/20">
                <div>
                  <h4 className="font-serif font-bold text-base text-[#1A1A1A]">
                    Профили игроков
                  </h4>
                  <p className="text-xs text-[#1A1A1A]/70">
                    Переключайтесь между игроками для индивидуального сохранения очков, значков и прогресса.
                  </p>
                </div>

                <button
                  id="add-new-profile-btn"
                  onClick={() => {
                    sound.playClick();
                    setShowAddProfileForm(!showAddProfileForm);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] text-[#F9F7F2] text-xs font-mono font-bold hover:bg-[#1A1A1A]/85 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Новый игрок</span>
                </button>
              </div>

              {/* Add New Profile Form */}
              {showAddProfileForm && (
                <form
                  onSubmit={handleCreateNew}
                  className="p-4 border-2 border-[#1A1A1A] bg-[#1A1A1A]/5 space-y-4 animate-fadeIn"
                >
                  <h5 className="font-serif font-bold text-sm text-[#1A1A1A]">
                    Создание нового профиля игрока
                  </h5>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-[#1A1A1A]/70 mb-1">
                      Имя или никнейм игрока
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Например: Александр, София, Эрудит"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      maxLength={24}
                      className="w-full px-3 py-2 border border-[#1A1A1A] bg-[#F9F7F2] text-[#1A1A1A] text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-[#1A1A1A]/70 mb-1.5">
                      Выберите аватар
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AVATAR_OPTIONS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => {
                            setNewProfileAvatar(av.id);
                            sound.playClick();
                          }}
                          className={`w-10 h-10 border flex items-center justify-center text-xl transition-all ${
                            newProfileAvatar === av.id
                              ? 'border-[#1A1A1A] bg-[#1A1A1A] scale-105'
                              : 'border-[#1A1A1A]/30 bg-transparent hover:border-[#1A1A1A]'
                          }`}
                          title={av.label}
                        >
                          {av.emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddProfileForm(false)}
                      className="px-3 py-1.5 border border-[#1A1A1A] text-xs font-mono font-bold hover:bg-[#1A1A1A]/10 transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#1A1A1A] text-[#F9F7F2] text-xs font-mono font-bold hover:bg-[#1A1A1A]/85 transition-colors"
                    >
                      Создать профиль
                    </button>
                  </div>
                </form>
              )}

              {/* Profiles List */}
              <div className="space-y-3">
                {allProfiles.map((p) => {
                  const isActive = p.id === activeProfile.id;
                  const pRank = calculateUserRank(p.stats.xp);
                  const pAvatar = AVATAR_OPTIONS.find((a) => a.id === p.avatar) || AVATAR_OPTIONS[0];

                  return (
                    <div
                      key={p.id}
                      className={`p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isActive
                          ? 'border-[#1A1A1A] bg-[#1A1A1A]/10 ring-1 ring-[#1A1A1A]'
                          : 'border-[#1A1A1A]/30 bg-[#F9F7F2] hover:border-[#1A1A1A]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] flex items-center justify-center text-2xl shrink-0">
                          {pAvatar.emoji}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm text-[#1A1A1A]">
                              {p.name}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.5 bg-[#1A1A1A] text-[#F9F7F2] text-[8px] font-mono uppercase tracking-widest font-bold">
                                Активен
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-[#1A1A1A]/70 mt-0.5">
                            {pRank.title} (Ур. {pRank.level}) • {p.stats.xp.toLocaleString('ru-RU')} XP • {p.achievements.length} значков
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {!isActive && (
                          <button
                            onClick={() => {
                              sound.playClick();
                              onSwitchProfile(p.id);
                            }}
                            className="px-3 py-1 bg-[#1A1A1A] text-[#F9F7F2] text-xs font-mono font-bold hover:bg-[#1A1A1A]/85 transition-colors"
                          >
                            Выбрать
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (window.confirm(`Сбросить очки и прогресс для игрока «${p.name}»?`)) {
                              onResetStats(p.id);
                              sound.playClick();
                            }
                          }}
                          className="p-1.5 border border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors"
                          title="Сбросить статистику игрока"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {allProfiles.length > 1 && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Удалить профиль «${p.name}»? Это действие необратимо.`)) {
                                onDeleteProfile(p.id);
                                sound.playClick();
                              }
                            }}
                            className="p-1.5 border border-[#1A1A1A]/30 hover:border-red-600 text-[#1A1A1A]/60 hover:text-red-600 transition-colors"
                            title="Удалить профиль"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-4 sm:p-5 border-t border-[#1A1A1A] flex items-center justify-between bg-[#F9F7F2]">
          <div className="text-[11px] font-mono text-[#1A1A1A]/60">
            Игрок: <span className="font-bold text-[#1A1A1A]">{activeProfile.name}</span>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-6 py-2 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] hover:bg-transparent hover:text-[#1A1A1A] font-bold text-xs uppercase tracking-widest transition-colors font-mono"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
