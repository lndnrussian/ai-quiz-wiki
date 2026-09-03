import { AchievementDefinition, UserStats, UserAnswerRecord, UserAchievementRecord, UserProfile } from '../types';

export const AVATAR_OPTIONS = [
  { id: 'owl', label: 'Сова Мудрости', emoji: '🦉' },
  { id: 'scholar', label: 'Учёный', emoji: '🔬' },
  { id: 'astronaut', label: 'Космонавт', emoji: '🚀' },
  { id: 'chronicler', label: 'Летописец', emoji: '📜' },
  { id: 'grandmaster', label: 'Гроссмейстер', emoji: '👑' },
  { id: 'artist', label: 'Художник', emoji: '🎨' },
  { id: 'philosopher', label: 'Философ', emoji: '🏛️' },
  { id: 'bookworm', label: 'Книгочей', emoji: '📚' },
  { id: 'explorer', label: 'Первооткрыватель', emoji: '🧭' },
  { id: 'thinker', label: 'Мыслитель', emoji: '⚡' },
  { id: 'champion', label: 'Чемпион', emoji: '🏆' },
  { id: 'wizard', label: 'Магистр знаний', emoji: '🧙' },
];

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Progression & Milestones
  {
    id: 'first_step',
    title: 'Первый шаг',
    description: 'Ответить на свой первый вопрос в викторине',
    icon: 'Footprints',
    category: 'progression',
    rarity: 'common',
    xpReward: 25,
    maxProgress: 1,
    checkProgress: (stats) => Math.min(1, stats.totalAnswered),
  },
  {
    id: 'answers_10',
    title: 'Любознательный ум',
    description: 'Ответить на 10 вопросов энциклопедии',
    icon: 'Sparkles',
    category: 'progression',
    rarity: 'common',
    xpReward: 50,
    maxProgress: 10,
    checkProgress: (stats) => Math.min(10, stats.totalAnswered),
  },
  {
    id: 'answers_50',
    title: 'Знаток фактов',
    description: 'Ответить на 50 вопросов энциклопедии',
    icon: 'BookOpen',
    category: 'progression',
    rarity: 'rare',
    xpReward: 150,
    maxProgress: 50,
    checkProgress: (stats) => Math.min(50, stats.totalAnswered),
  },
  {
    id: 'answers_100',
    title: 'Ходячая энциклопедия',
    description: 'Ответить на 100 вопросов энциклопедии',
    icon: 'Library',
    category: 'progression',
    rarity: 'epic',
    xpReward: 300,
    maxProgress: 100,
    checkProgress: (stats) => Math.min(100, stats.totalAnswered),
  },

  // Streaks
  {
    id: 'streak_3',
    title: 'Разминка эрудита',
    description: 'Дать 3 правильных ответа подряд',
    icon: 'Flame',
    category: 'streak',
    rarity: 'common',
    xpReward: 30,
    maxProgress: 3,
    checkProgress: (stats) => Math.min(3, stats.bestStreak),
  },
  {
    id: 'streak_5',
    title: 'В ударе',
    description: 'Серия из 5 правильных ответов подряд',
    icon: 'Zap',
    category: 'streak',
    rarity: 'rare',
    xpReward: 75,
    maxProgress: 5,
    checkProgress: (stats) => Math.min(5, stats.bestStreak),
  },
  {
    id: 'streak_10',
    title: 'Неудержимый поток знаний',
    description: 'Серия из 10 правильных ответов подряд',
    icon: 'Award',
    category: 'streak',
    rarity: 'epic',
    xpReward: 200,
    maxProgress: 10,
    checkProgress: (stats) => Math.min(10, stats.bestStreak),
  },
  {
    id: 'streak_20',
    title: 'Легенда Википедии',
    description: 'Серия из 20 правильных ответов подряд',
    icon: 'Crown',
    category: 'streak',
    rarity: 'legendary',
    xpReward: 500,
    maxProgress: 20,
    checkProgress: (stats) => Math.min(20, stats.bestStreak),
  },

  // Mastery & Accuracy
  {
    id: 'master_open_5',
    title: 'Своим умом',
    description: 'Дать 5 верных ответов на открытые вопросы без подсказок',
    icon: 'PenTool',
    category: 'mastery',
    rarity: 'rare',
    xpReward: 100,
    maxProgress: 5,
    checkProgress: (stats) => {
      const openCorrect = stats.history.filter((h) => h.question.type === 'open_ended' && h.isCorrect).length;
      return Math.min(5, openCorrect);
    },
  },
  {
    id: 'master_open_15',
    title: 'Магистр формулировок',
    description: 'Дать 15 верных ответов на открытые вопросы',
    icon: 'Brain',
    category: 'mastery',
    rarity: 'epic',
    xpReward: 250,
    maxProgress: 15,
    checkProgress: (stats) => {
      const openCorrect = stats.history.filter((h) => h.question.type === 'open_ended' && h.isCorrect).length;
      return Math.min(15, openCorrect);
    },
  },
  {
    id: 'fast_thinker',
    title: 'Молниеносный ум',
    description: 'Ответить на вопрос быстрее чем за 4 секунды',
    icon: 'Timer',
    category: 'mastery',
    rarity: 'rare',
    xpReward: 100,
    maxProgress: 1,
    checkProgress: (stats, last) => {
      if (last && last.isCorrect && last.timeSpentSeconds <= 4) return 1;
      const hasFast = stats.history.some((h) => h.isCorrect && h.timeSpentSeconds <= 4);
      return hasFast ? 1 : 0;
    },
  },
  {
    id: 'accuracy_80',
    title: 'Снайпер фактов',
    description: 'Достичь точности 80% и выше (минимум 20 ответов)',
    icon: 'Target',
    category: 'mastery',
    rarity: 'epic',
    xpReward: 250,
    maxProgress: 1,
    checkProgress: (stats) => {
      if (stats.totalAnswered < 20) return 0;
      const acc = (stats.totalCorrect / stats.totalAnswered) * 100;
      return acc >= 80 ? 1 : 0;
    },
  },
  {
    id: 'expert_diff_5',
    title: 'Гроссмейстер сложности',
    description: 'Дать 5 верных ответов на вопросы уровня «Эксперт»',
    icon: 'Gem',
    category: 'mastery',
    rarity: 'legendary',
    xpReward: 400,
    maxProgress: 5,
    checkProgress: (stats) => {
      return Math.min(5, stats.byDifficulty.expert?.correct || 0);
    },
  },

  // Category & Topic Mastery
  {
    id: 'cat_science',
    title: 'Учёный секретарь',
    description: '5 правильных ответов в категории «Наука и открытия»',
    icon: 'Atom',
    category: 'topic',
    rarity: 'rare',
    xpReward: 100,
    maxProgress: 5,
    checkProgress: (stats) => Math.min(5, stats.byCategory['Наука']?.correct || stats.byCategory['Наука и открытия']?.correct || 0),
  },
  {
    id: 'cat_history',
    title: 'Летописец эпох',
    description: '5 правильных ответов в категории «История и эпохи»',
    icon: 'Landmark',
    category: 'topic',
    rarity: 'rare',
    xpReward: 100,
    maxProgress: 5,
    checkProgress: (stats) => Math.min(5, stats.byCategory['История']?.correct || stats.byCategory['История и эпохи']?.correct || 0),
  },
  {
    id: 'cat_geo',
    title: 'Кругосветный путешественник',
    description: '5 правильных ответов в категории «География и страны»',
    icon: 'Globe',
    category: 'topic',
    rarity: 'rare',
    xpReward: 100,
    maxProgress: 5,
    checkProgress: (stats) => Math.min(5, stats.byCategory['География']?.correct || stats.byCategory['География и страны']?.correct || 0),
  },
  {
    id: 'cat_space',
    title: 'Звёздный штурман',
    description: '5 правильных ответов в категории «Космос и астрономия»',
    icon: 'Rocket',
    category: 'topic',
    rarity: 'rare',
    xpReward: 100,
    maxProgress: 5,
    checkProgress: (stats) => Math.min(5, stats.byCategory['Космос']?.correct || stats.byCategory['Космос и астрономия']?.correct || 0),
  },
  {
    id: 'cat_lit',
    title: 'Литературный критик',
    description: '5 правильных ответов в категории «Литература и книги»',
    icon: 'BookMarked',
    category: 'topic',
    rarity: 'rare',
    xpReward: 100,
    maxProgress: 5,
    checkProgress: (stats) => Math.min(5, stats.byCategory['Литература']?.correct || stats.byCategory['Литература и книги']?.correct || 0),
  },
  {
    id: 'cat_art',
    title: 'Искусствовед',
    description: '5 правильных ответов в категории «Искусство и культура»',
    icon: 'Palette',
    category: 'topic',
    rarity: 'rare',
    xpReward: 100,
    maxProgress: 5,
    checkProgress: (stats) => Math.min(5, stats.byCategory['Искусство']?.correct || stats.byCategory['Искусство и культура']?.correct || 0),
  },
  {
    id: 'polymath',
    title: 'Человек Возрождения (Полимат)',
    description: 'Дать хотя бы по 2 правильных ответа в 5 различных категориях',
    icon: 'Compass',
    category: 'topic',
    rarity: 'epic',
    xpReward: 300,
    maxProgress: 5,
    checkProgress: (stats) => {
      const categoriesWith2 = Object.values(stats.byCategory).filter((c) => c.correct >= 2).length;
      return Math.min(5, categoriesWith2);
    },
  },

  // Bookmarks & High XP
  {
    id: 'bibliophile',
    title: 'Библиофил',
    description: 'Сохранить 3 интересные статьи Википедии в избранное',
    icon: 'Bookmark',
    category: 'progression',
    rarity: 'common',
    xpReward: 50,
    maxProgress: 3,
    checkProgress: (stats) => Math.min(3, stats.favorites.length),
  },
  {
    id: 'xp_1000',
    title: 'Эрудит первой гильдии',
    description: 'Заработать 1 000 очков опыта (XP)',
    icon: 'Star',
    category: 'progression',
    rarity: 'rare',
    xpReward: 150,
    maxProgress: 1000,
    checkProgress: (stats) => Math.min(1000, stats.xp),
  },
  {
    id: 'xp_5000',
    title: 'Академик Знаний',
    description: 'Заработать 5 000 очков опыта (XP)',
    icon: 'ShieldAlert',
    category: 'progression',
    rarity: 'legendary',
    xpReward: 500,
    maxProgress: 5000,
    checkProgress: (stats) => Math.min(5000, stats.xp),
  },
];

export interface AchievementUnlockResult {
  unlockedList: Array<{
    achievement: AchievementDefinition;
    unlockedAt: number;
  }>;
  updatedAchievements: UserAchievementRecord[];
  bonusXP: number;
}

/**
 * Checks if current profile stats qualify for any new achievements.
 */
export function evaluateAchievements(
  profile: UserProfile,
  lastRecord?: UserAnswerRecord
): AchievementUnlockResult {
  const currentUnlockedIds = new Set(profile.achievements.map((a) => a.id));
  const newlyUnlocked: Array<{ achievement: AchievementDefinition; unlockedAt: number }> = [];
  const updatedAchievements: UserAchievementRecord[] = [...profile.achievements];
  let bonusXP = 0;

  for (const ach of ACHIEVEMENTS) {
    const progress = ach.checkProgress(profile.stats, lastRecord);
    const isUnlocked = progress >= ach.maxProgress;

    if (isUnlocked && !currentUnlockedIds.has(ach.id)) {
      const now = Date.now();
      newlyUnlocked.push({ achievement: ach, unlockedAt: now });
      updatedAchievements.push({
        id: ach.id,
        unlockedAt: now,
        progress: ach.maxProgress,
      });
      currentUnlockedIds.add(ach.id);
      bonusXP += ach.xpReward;
    }
  }

  return {
    unlockedList: newlyUnlocked,
    updatedAchievements,
    bonusXP,
  };
}
