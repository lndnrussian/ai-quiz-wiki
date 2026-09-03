import {
  UserProfile,
  UserStats,
  UserAnswerRecord,
  WikiQuestion,
  DifficultyLevel,
} from '../types';
import { evaluateAchievements, AchievementUnlockResult } from './achievements';

const PROFILES_STORAGE_KEY = 'wikiquiz_profiles_v2';
const ACTIVE_PROFILE_KEY = 'wikiquiz_active_profile_id';
const LEGACY_STATS_KEY = 'wikiquiz_user_stats_v1';

export const defaultStats: UserStats = {
  totalAnswered: 0,
  totalCorrect: 0,
  currentStreak: 0,
  bestStreak: 0,
  xp: 0,
  byDifficulty: {
    easy: { answered: 0, correct: 0 },
    medium: { answered: 0, correct: 0 },
    hard: { answered: 0, correct: 0 },
    expert: { answered: 0, correct: 0 },
  },
  byCategory: {},
  favorites: [],
  history: [],
  seenArticleTitles: [],
  blitzBestScore: 0,
  survivalBestRounds: 0,
};

export const defaultProfile: UserProfile = {
  id: 'profile-default',
  name: 'Эрудит Википедии',
  avatar: 'owl',
  createdAt: Date.now(),
  lastActiveAt: Date.now(),
  stats: defaultStats,
  achievements: [],
  selectedTitle: 'Читатель Википедии',
};

/**
 * Loads all user profiles with automatic migration from legacy single-stats storage
 */
export function loadAllProfiles(): UserProfile[] {
  if (typeof window === 'undefined') return [defaultProfile];

  try {
    const rawProfiles = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (rawProfiles) {
      const parsed: UserProfile[] = JSON.parse(rawProfiles);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p) => ({
          ...defaultProfile,
          ...p,
          stats: {
            ...defaultStats,
            ...p.stats,
            byDifficulty: {
              ...defaultStats.byDifficulty,
              ...(p.stats?.byDifficulty || {}),
            },
            byCategory: p.stats?.byCategory || {},
            favorites: p.stats?.favorites || [],
            history: (p.stats?.history || []).slice(-100),
          },
          achievements: p.achievements || [],
        }));
      }
    }

    // Attempt legacy migration
    const legacyRaw = localStorage.getItem(LEGACY_STATS_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      const migratedProfile: UserProfile = {
        ...defaultProfile,
        id: `profile-${Date.now()}`,
        name: 'Главный игрок',
        avatar: 'owl',
        stats: {
          ...defaultStats,
          ...legacyParsed,
          byDifficulty: {
            ...defaultStats.byDifficulty,
            ...(legacyParsed.byDifficulty || {}),
          },
          byCategory: legacyParsed.byCategory || {},
          favorites: legacyParsed.favorites || [],
          history: (legacyParsed.history || []).slice(-100),
        },
      };

      // Run initial achievement evaluation on migrated stats
      const evalRes = evaluateAchievements(migratedProfile);
      migratedProfile.achievements = evalRes.updatedAchievements;
      migratedProfile.stats.xp += evalRes.bonusXP;

      saveAllProfiles([migratedProfile]);
      setActiveProfileId(migratedProfile.id);
      return [migratedProfile];
    }
  } catch (e) {
    console.error('Failed to load profiles:', e);
  }

  const initial = [defaultProfile];
  saveAllProfiles(initial);
  setActiveProfileId(defaultProfile.id);
  return initial;
}

export function saveAllProfiles(profiles: UserProfile[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Failed to save profiles:', e);
  }
}

export function getActiveProfileId(): string {
  if (typeof window === 'undefined') return defaultProfile.id;
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || defaultProfile.id;
  } catch {
    return defaultProfile.id;
  }
}

export function setActiveProfileId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  } catch (e) {
    console.error('Failed to set active profile id:', e);
  }
}

export function getActiveProfile(): UserProfile {
  const profiles = loadAllProfiles();
  const activeId = getActiveProfileId();
  const found = profiles.find((p) => p.id === activeId);
  return found || profiles[0] || defaultProfile;
}

export function createNewProfile(name: string, avatar: string = 'owl'): { profile: UserProfile; allProfiles: UserProfile[] } {
  const profiles = loadAllProfiles();
  const trimmedName = name.trim() || `Игрок ${profiles.length + 1}`;
  const newProfile: UserProfile = {
    ...defaultProfile,
    id: `profile-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: trimmedName,
    avatar: avatar || 'owl',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    stats: { ...defaultStats },
    achievements: [],
    selectedTitle: 'Читатель Википедии',
  };

  const updatedProfiles = [...profiles, newProfile];
  saveAllProfiles(updatedProfiles);
  setActiveProfileId(newProfile.id);
  return { profile: newProfile, allProfiles: updatedProfiles };
}

export function updateActiveProfile(updatedData: Partial<UserProfile>): { profile: UserProfile; allProfiles: UserProfile[] } {
  const profiles = loadAllProfiles();
  const activeId = getActiveProfileId();

  let activeIndex = profiles.findIndex((p) => p.id === activeId);
  if (activeIndex === -1) activeIndex = 0;

  const current = profiles[activeIndex] || defaultProfile;
  const updated: UserProfile = {
    ...current,
    ...updatedData,
    lastActiveAt: Date.now(),
  };

  const updatedProfiles = [...profiles];
  updatedProfiles[activeIndex] = updated;
  saveAllProfiles(updatedProfiles);

  return { profile: updated, allProfiles: updatedProfiles };
}

export function deleteUserProfile(profileId: string): { activeProfile: UserProfile; allProfiles: UserProfile[] } {
  const profiles = loadAllProfiles();
  if (profiles.length <= 1) {
    // Reset the only profile instead of leaving zero profiles
    const resetOnly: UserProfile = {
      ...defaultProfile,
      id: profiles[0].id,
      name: profiles[0].name,
      avatar: profiles[0].avatar,
      stats: { ...defaultStats },
      achievements: [],
    };
    saveAllProfiles([resetOnly]);
    return { activeProfile: resetOnly, allProfiles: [resetOnly] };
  }

  const remaining = profiles.filter((p) => p.id !== profileId);
  saveAllProfiles(remaining);

  const activeId = getActiveProfileId();
  const newActive = activeId === profileId ? remaining[0] : remaining.find((p) => p.id === activeId) || remaining[0];
  setActiveProfileId(newActive.id);

  return { activeProfile: newActive, allProfiles: remaining };
}

export function switchActiveProfile(profileId: string): { profile: UserProfile; allProfiles: UserProfile[] } {
  setActiveProfileId(profileId);
  const profiles = loadAllProfiles();
  const selected = profiles.find((p) => p.id === profileId) || profiles[0];
  return { profile: selected, allProfiles: profiles };
}

export function resetProfileStats(profileId: string): { profile: UserProfile; allProfiles: UserProfile[] } {
  const profiles = loadAllProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) return { profile: defaultProfile, allProfiles: profiles };

  const resetTarget: UserProfile = {
    ...target,
    stats: { ...defaultStats },
    achievements: [],
    lastActiveAt: Date.now(),
  };

  const updatedList = profiles.map((p) => (p.id === profileId ? resetTarget : p));
  saveAllProfiles(updatedList);

  return { profile: resetTarget, allProfiles: updatedList };
}

/**
 * Record an answer for a specific user profile and check for new achievements
 */
export function recordAnswerInProfile(
  record: UserAnswerRecord,
  currentProfile: UserProfile
): {
  updatedProfile: UserProfile;
  allProfiles: UserProfile[];
  achievementResult: AchievementUnlockResult;
} {
  const prevStats = currentProfile.stats;
  const isCorrect = record.isCorrect;
  const newCurrentStreak = isCorrect ? prevStats.currentStreak + 1 : 0;
  const newBestStreak = Math.max(prevStats.bestStreak, newCurrentStreak);

  // Calculate XP based on difficulty and streak bonus
  let baseXP = 0;
  if (isCorrect) {
    switch (record.question.difficulty) {
      case 'easy': baseXP = 10; break;
      case 'medium': baseXP = 20; break;
      case 'hard': baseXP = 35; break;
      case 'expert': baseXP = 50; break;
    }
    // Bonus for open-ended questions
    if (record.question.type === 'open_ended') {
      baseXP += 10;
    }
    // Streak multiplier
    if (newCurrentStreak >= 10) baseXP *= 2;
    else if (newCurrentStreak >= 5) baseXP = Math.round(baseXP * 1.5);
    else if (newCurrentStreak >= 3) baseXP = Math.round(baseXP * 1.25);
  }

  const diffKey = record.question.difficulty;
  const catKey = record.question.category || 'Общие знания';

  const updatedByDiff = {
    ...prevStats.byDifficulty,
    [diffKey]: {
      answered: (prevStats.byDifficulty[diffKey]?.answered || 0) + 1,
      correct: (prevStats.byDifficulty[diffKey]?.correct || 0) + (isCorrect ? 1 : 0),
    },
  };

  const updatedByCat = {
    ...prevStats.byCategory,
    [catKey]: {
      answered: (prevStats.byCategory[catKey]?.answered || 0) + 1,
      correct: (prevStats.byCategory[catKey]?.correct || 0) + (isCorrect ? 1 : 0),
    },
  };

  const updatedStats: UserStats = {
    ...prevStats,
    totalAnswered: prevStats.totalAnswered + 1,
    totalCorrect: prevStats.totalCorrect + (isCorrect ? 1 : 0),
    currentStreak: newCurrentStreak,
    bestStreak: newBestStreak,
    xp: prevStats.xp + baseXP,
    byDifficulty: updatedByDiff,
    byCategory: updatedByCat,
    history: [record, ...prevStats.history.slice(0, 99)],
    seenArticleTitles: Array.from(
      new Set([...(prevStats.seenArticleTitles || []), record.question.articleTitle].filter(Boolean))
    ).slice(-1500),
  };

  // Construct draft profile
  const draftProfile: UserProfile = {
    ...currentProfile,
    stats: updatedStats,
    lastActiveAt: Date.now(),
  };

  // Evaluate achievements
  const achievementResult = evaluateAchievements(draftProfile, record);
  draftProfile.achievements = achievementResult.updatedAchievements;
  draftProfile.stats.xp += achievementResult.bonusXP;

  // Save to storage
  const { profile: finalProfile, allProfiles } = updateActiveProfile(draftProfile);

  return {
    updatedProfile: finalProfile,
    allProfiles,
    achievementResult,
  };
}

/**
 * Register newly fetched question titles so they persist across sessions
 */
export function addSeenArticleTitles(titles: string[]): { profile: UserProfile; allProfiles: UserProfile[] } {
  const current = getActiveProfile();
  const existing = current.stats.seenArticleTitles || [];
  const updatedSeen = Array.from(new Set([...existing, ...titles].filter(Boolean))).slice(-1500);
  const updated: UserProfile = {
    ...current,
    stats: {
      ...current.stats,
      seenArticleTitles: updatedSeen,
    },
  };
  return updateActiveProfile(updated);
}

/**
 * Reset seen questions history for fresh variety cycle
 */
export function resetSeenHistory(profileId: string): { profile: UserProfile; allProfiles: UserProfile[] } {
  const profiles = loadAllProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) return { profile: defaultProfile, allProfiles: profiles };

  const updated: UserProfile = {
    ...target,
    stats: {
      ...target.stats,
      seenArticleTitles: [],
    },
  };

  const updatedList = profiles.map((p) => (p.id === profileId ? updated : p));
  saveAllProfiles(updatedList);
  return { profile: updated, allProfiles: updatedList };
}

export function toggleFavoriteInProfile(
  question: WikiQuestion,
  profile: UserProfile
): { updatedProfile: UserProfile; allProfiles: UserProfile[] } {
  const exists = profile.stats.favorites.some((f) => f.id === question.id || f.articleTitle === question.articleTitle);
  const newFavorites = exists
    ? profile.stats.favorites.filter((f) => f.id !== question.id && f.articleTitle !== question.articleTitle)
    : [question, ...profile.stats.favorites];

  const updatedStats: UserStats = {
    ...profile.stats,
    favorites: newFavorites,
  };

  const draft: UserProfile = {
    ...profile,
    stats: updatedStats,
  };

  // Check if bibliophile achievement is unlocked
  const achRes = evaluateAchievements(draft);
  draft.achievements = achRes.updatedAchievements;
  draft.stats.xp += achRes.bonusXP;

  const res = updateActiveProfile(draft);
  return { updatedProfile: res.profile, allProfiles: res.allProfiles };
}

export function updateGameModeBestScores(
  mode: 'blitz' | 'survival',
  score: number,
  profile: UserProfile
): { updatedProfile: UserProfile; allProfiles: UserProfile[] } {
  const currentBest = mode === 'blitz' ? (profile.stats.blitzBestScore || 0) : (profile.stats.survivalBestRounds || 0);
  if (score <= currentBest) return { updatedProfile: profile, allProfiles: loadAllProfiles() };

  const updatedStats: UserStats = {
    ...profile.stats,
    ...(mode === 'blitz' ? { blitzBestScore: score } : { survivalBestRounds: score }),
  };

  const res = updateActiveProfile({ ...profile, stats: updatedStats });
  return { updatedProfile: res.profile, allProfiles: res.allProfiles };
}

export function calculateUserRank(xp: number): {
  title: string;
  level: number;
  nextLevelXp: number;
  progressPercent: number;
  currentLevelBaseXp: number;
} {
  const ranks = [
    { level: 1, title: 'Читатель Википедии', requiredXp: 0 },
    { level: 2, title: 'Любознательный', requiredXp: 100 },
    { level: 3, title: 'Эрудит', requiredXp: 300 },
    { level: 4, title: 'Знаток фактов', requiredXp: 650 },
    { level: 5, title: 'Магистр знаний', requiredXp: 1200 },
    { level: 6, title: 'Исследователь Википедии', requiredXp: 2000 },
    { level: 7, title: 'Профессор фактов', requiredXp: 3200 },
    { level: 8, title: 'Архивариус', requiredXp: 5000 },
    { level: 9, title: 'Академик Википедии', requiredXp: 8000 },
    { level: 10, title: 'Хранитель Знаний', requiredXp: 12000 },
    { level: 11, title: 'Легенда Энциклопедии', requiredXp: 20000 },
  ];

  let currentRank = ranks[0];
  let nextRank = ranks[1];

  for (let i = ranks.length - 1; i >= 0; i--) {
    if (xp >= ranks[i].requiredXp) {
      currentRank = ranks[i];
      nextRank = ranks[i + 1] || {
        level: currentRank.level + 1,
        title: 'Легенда Энциклопедии',
        requiredXp: Math.round(currentRank.requiredXp * 1.5),
      };
      break;
    }
  }

  const range = nextRank.requiredXp - currentRank.requiredXp;
  const currentProgress = xp - currentRank.requiredXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentProgress / Math.max(1, range)) * 100)));

  return {
    title: currentRank.title,
    level: currentRank.level,
    nextLevelXp: nextRank.requiredXp,
    currentLevelBaseXp: currentRank.requiredXp,
    progressPercent,
  };
}

/**
 * Topic mastery calculation (Bronze, Silver, Gold, Diamond)
 */
export function getTopicMastery(correctCount: number): {
  tier: 'none' | 'bronze' | 'silver' | 'gold' | 'diamond';
  label: string;
  stars: number;
  nextTierNeeded: number;
} {
  if (correctCount >= 25) {
    return { tier: 'diamond', label: 'Алмазный мастер', stars: 4, nextTierNeeded: 25 };
  }
  if (correctCount >= 15) {
    return { tier: 'gold', label: 'Золотой знаток', stars: 3, nextTierNeeded: 25 };
  }
  if (correctCount >= 7) {
    return { tier: 'silver', label: 'Серебряный эрудит', stars: 2, nextTierNeeded: 15 };
  }
  if (correctCount >= 3) {
    return { tier: 'bronze', label: 'Бронзовый читатель', stars: 1, nextTierNeeded: 7 };
  }
  return { tier: 'none', label: 'Новичок темы', stars: 0, nextTierNeeded: 3 };
}

const CUSTOM_TOPICS_KEY = 'wikiquiz_custom_topics_v1';

export const DEFAULT_SUGGESTED_TOPICS = [
  'Древний Рим',
  'Космонавтика',
  'Русская классическая литература',
  'Квантовая физика',
  'Архитектура модерна',
  'Мировая мифология',
];

/**
 * Load custom user topics from localStorage
 */
export function loadCustomTopics(): string[] {
  if (typeof window === 'undefined') return DEFAULT_SUGGESTED_TOPICS;
  try {
    const raw = localStorage.getItem(CUSTOM_TOPICS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
      }
    }
  } catch (e) {
    console.error('Failed to load custom topics:', e);
  }
  return DEFAULT_SUGGESTED_TOPICS;
}

/**
 * Save custom user topics to localStorage
 */
export function saveCustomTopics(topics: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_TOPICS_KEY, JSON.stringify(topics));
  } catch (e) {
    console.error('Failed to save custom topics:', e);
  }
}

/**
 * Add a new custom topic and return updated list
 */
export function addCustomTopic(topic: string): string[] {
  const trimmed = topic.trim();
  if (!trimmed) return loadCustomTopics();

  const current = loadCustomTopics();
  // Filter out any existing case-insensitive duplicate so the new/recently used one comes first
  const filtered = current.filter((t) => t.toLowerCase() !== trimmed.toLowerCase());
  const updated = [trimmed, ...filtered].slice(0, 30); // keep up to 30 custom topics

  saveCustomTopics(updated);
  return updated;
}

/**
 * Delete a custom topic and return updated list
 */
export function removeCustomTopic(topic: string): string[] {
  const current = loadCustomTopics();
  const updated = current.filter((t) => t.toLowerCase() !== topic.trim().toLowerCase());
  saveCustomTopics(updated);
  return updated;
}

export const USER_API_KEY_STORAGE_KEY = 'wikiquiz_user_gemini_api_key';

/**
 * Get the optional user-provided Gemini API key from localStorage
 */
export function getUserApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (localStorage.getItem(USER_API_KEY_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Save user Gemini API key to localStorage
 */
export function saveUserApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (key && key.trim()) {
      localStorage.setItem(USER_API_KEY_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to save user API key:', e);
  }
}

/**
 * Remove user Gemini API key
 */
export function clearUserApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear user API key:', e);
  }
}

