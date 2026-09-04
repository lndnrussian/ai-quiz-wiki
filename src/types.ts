export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

export type QuestionType = 'multiple_choice' | 'open_ended';

export type FormatFilter = 'all' | 'multiple_choice' | 'open_ended';

export type GameMode = 'endless' | 'blitz' | 'survival' | 'topic' | 'sprint';

export type QuizEngineSource = 'wikipedia' | 'chgk';

export interface ChgkMetadata {
  tournamentTitle?: string;
  tournamentUrl?: string;
  questionNumber?: number;
  tourNumber?: number;
  questionUrl?: string;
  authors?: string;
  passCriteria?: string;
  sources?: string;
  comments?: string;
  tourId?: string;
}

export interface HandoutData {
  hasHandout: boolean;
  type: 'image' | 'text' | 'mixed' | 'missing' | 'none';
  images: string[];
  textHandout?: string;
  cleanQuestion: string;
  readerNote?: string;
  rawHandoutSnippet?: string;
}

export interface RoundCustomizationConfig {
  engineSource: QuizEngineSource;
  gameMode: GameMode;
  difficulty: DifficultyLevel;
  formatFilter: FormatFilter;
  selectedCategory: string;
  sprintQuestionCount: number; // e.g. 5, 10, 15, 20
  blitzDurationSeconds: number; // e.g. 30, 60, 90, 120
  chgkTimerEnabled: boolean; // "опция с часами и без": true = 60s clock, false = untimed
  chgkTournamentId: string; // 'random', 'ovsch20.1_u', 'thanos20.1_u', etc.
  chgkFilterHandouts?: 'all' | 'text_only'; // 'all' allows handouts, 'text_only' filters out handouts
}

export interface WikiQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[]; // 4 options for multiple choice
  correctAnswer: string;
  acceptableAnswers?: string[]; // Additional synonyms/variations for open questions
  explanation: string;
  articleTitle: string;
  articleUrl: string;
  articleExtract?: string;
  thumbnailUrl?: string;
  difficulty: DifficultyLevel;
  category: string;
  pageviews?: number;
  popularityLabel?: string;
  popularityTier?: 'top_tier' | 'high' | 'medium' | 'niche';
  generatedAt?: number;
  sourceSystem?: QuizEngineSource;
  chgkMetadata?: ChgkMetadata;
  handout?: HandoutData;
}

export interface UserAnswerRecord {
  questionId: string;
  question: WikiQuestion;
  userAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
  timestamp: number;
  feedback?: string;
  scoreEarned: number;
}

export interface UserStats {
  totalAnswered: number;
  totalCorrect: number;
  currentStreak: number;
  bestStreak: number;
  xp: number;
  byDifficulty: Record<DifficultyLevel, { answered: number; correct: number }>;
  byCategory: Record<string, { answered: number; correct: number }>;
  favorites: WikiQuestion[];
  history: UserAnswerRecord[];
  seenArticleTitles?: string[];
  blitzBestScore?: number;
  survivalBestRounds?: number;
}

export interface UserAchievementRecord {
  id: string;
  unlockedAt: number;
  progress?: number;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  category: 'progression' | 'streak' | 'topic' | 'mastery' | 'mode';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
  maxProgress: number;
  checkProgress: (stats: UserStats, lastRecord?: UserAnswerRecord) => number;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string; // avatar identifier or icon
  createdAt: number;
  lastActiveAt: number;
  stats: UserStats;
  achievements: UserAchievementRecord[];
  selectedTitle?: string;
}

export interface EvaluateResponse {
  isCorrect: boolean;
  feedback: string;
  similarity: number;
}

export interface CategoryOption {
  id: string;
  label: string;
  iconName: string;
  description: string;
}
