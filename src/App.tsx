import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  WikiQuestion,
  GameMode,
  DifficultyLevel,
  FormatFilter,
  UserProfile,
  UserAnswerRecord,
  AchievementDefinition,
  RoundCustomizationConfig,
} from './types';
import { Header } from './components/Header';
import { RoundSetupLobby } from './components/RoundSetupLobby';
import { GameControls } from './components/GameControls';
import { QuizCard } from './components/QuizCard';
import { ChgkTopBar } from './components/ChgkTopBar';
import { BlitzTimer } from './components/BlitzTimer';
import { SurvivalLives } from './components/SurvivalLives';
import { CategoryPickerModal } from './components/CategoryPickerModal';
import { ProfileModal } from './components/ProfileModal';
import { FavoritesModal } from './components/FavoritesModal';
import { GameOverModal } from './components/GameOverModal';
import { AchievementToast } from './components/AchievementToast';
import { SettingsModal } from './components/SettingsModal';
import {
  getActiveProfile,
  loadAllProfiles,
  recordAnswerInProfile,
  createNewProfile,
  switchActiveProfile,
  updateActiveProfile,
  deleteUserProfile,
  resetProfileStats,
  toggleFavoriteInProfile,
  updateGameModeBestScores,
  calculateUserRank,
  getUserApiKey,
  addSeenArticleTitles,
  resetSeenHistory,
} from './utils/storage';
import { sound } from './utils/sound';
import { Loader2, AlertCircle, RefreshCw, Sliders } from 'lucide-react';

function normalizeQuestionText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'.,!?:;()[\]{}\-\/\\—–\s]/g, '');
}

export default function App() {
  // Persistence & User Profiles State
  const [activeProfile, setActiveProfile] = useState<UserProfile>(getActiveProfile);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>(loadAllProfiles);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());

  // Newly Unlocked Achievement Toast
  const [unlockedAchievementToast, setUnlockedAchievementToast] = useState<AchievementDefinition | null>(null);

  // Game Flow State: 'lobby' (Pre-round customization) vs 'playing' (Active quiz arena)
  const [gameState, setGameState] = useState<'lobby' | 'playing'>('lobby');

  // Master Round Customization Config
  const [roundConfig, setRoundConfig] = useState<RoundCustomizationConfig>({
    gameMode: 'endless',
    difficulty: 'medium',
    formatFilter: 'all',
    selectedCategory: 'all',
    sprintQuestionCount: 10,
    blitzDurationSeconds: 60,
  });

  // Active Game State
  const gameMode = roundConfig.gameMode;
  const difficulty = roundConfig.difficulty;
  const formatFilter = roundConfig.formatFilter;
  const selectedCategory = roundConfig.selectedCategory;
  const sprintQuestionCount = roundConfig.sprintQuestionCount || 10;
  const blitzDurationSeconds = roundConfig.blitzDurationSeconds || 60;

  // Question State
  const [currentQuestion, setCurrentQuestion] = useState<WikiQuestion | null>(null);
  const [questionQueue, setQuestionQueue] = useState<WikiQuestion[]>([]);
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [usedArticleTitles, setUsedArticleTitles] = useState<string[]>(() => {
    return activeProfile.stats.history.map((h) => h.question.articleTitle).filter(Boolean);
  });
  const [recentCategories, setRecentCategories] = useState<string[]>([]);

  // Helper to get comprehensive list of all excluded titles (including persistent history across days)
  const getAllExcludedTitles = useCallback(() => {
    const fromState = usedArticleTitles;
    const fromQueue = questionQueue.map((q) => q.articleTitle);
    const fromCurrent = currentQuestion ? [currentQuestion.articleTitle] : [];
    const fromHistory = (activeProfile.stats.history || []).map((h) => h.question?.articleTitle);
    const fromSeenPersistent = activeProfile.stats.seenArticleTitles || [];
    return Array.from(new Set([...fromState, ...fromQueue, ...fromCurrent, ...fromHistory, ...fromSeenPersistent])).filter(Boolean);
  }, [usedArticleTitles, questionQueue, currentQuestion, activeProfile.stats.history, activeProfile.stats.seenArticleTitles]);

  // Helper to get comprehensive list of all excluded question IDs
  const getAllExcludedIds = useCallback(() => {
    const fromQueue = questionQueue.map((q) => q.id);
    const fromCurrent = currentQuestion ? [currentQuestion.id] : [];
    const fromHistory = (activeProfile.stats.history || []).map((h) => h.question?.id);
    return Array.from(new Set([...fromQueue, ...fromCurrent, ...fromHistory])).filter(Boolean);
  }, [questionQueue, currentQuestion, activeProfile.stats.history]);

  // Helper to get comprehensive list of all excluded question texts
  const getAllExcludedQuestionTexts = useCallback(() => {
    const fromQueue = questionQueue.map((q) => q.question);
    const fromCurrent = currentQuestion ? [currentQuestion.question] : [];
    const fromHistory = (activeProfile.stats.history || []).map((h) => h.question?.question);
    return Array.from(new Set([...fromQueue, ...fromCurrent, ...fromHistory])).filter(Boolean);
  }, [questionQueue, currentQuestion, activeProfile.stats.history]);

  // Current Question Answer State
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isEvaluatingOpen, setIsEvaluatingOpen] = useState<boolean>(false);
  const [openEvaluationResult, setOpenEvaluationResult] = useState<{ isCorrect: boolean; feedback: string; similarity: number } | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  // Background prefetching guards
  const isPrefetchingRef = useRef<boolean>(false);
  const prefetchCooldownUntilRef = useRef<number>(0);

  // Loading & Network States
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(false);
  const [isLoadingNext, setIsLoadingNext] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState<boolean>(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState<boolean>(false);
  const [isGameOverOpen, setIsGameOverOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Blitz Mode State
  const [blitzSecondsLeft, setBlitzSecondsLeft] = useState<number>(blitzDurationSeconds);
  const [isBlitzActive, setIsBlitzActive] = useState<boolean>(false);

  // ChGK 60-second Timer State
  const [chgkSecondsLeft, setChgkSecondsLeft] = useState<number>(60);

  // Survival Mode State
  const [survivalLives, setSurvivalLives] = useState<number>(3);

  // Session stats for current game round (for GameOver summary)
  const [sessionAnswers, setSessionAnswers] = useState<UserAnswerRecord[]>([]);

  const stats = activeProfile.stats;

  // Fetch Questions from API with anti-repetition exclusion & optional BYOK header
  const fetchQuestions = useCallback(
    async (
      diff: DifficultyLevel,
      fmt: FormatFilter,
      cat: string,
      count: number = 2,
      exclude: string[] = [],
      engine: 'wikipedia' | 'chgk' = roundConfig.engineSource || 'wikipedia',
      tournamentId: string = roundConfig.chgkTournamentId || 'random'
    ): Promise<WikiQuestion[]> => {
      try {
        const userKey = getUserApiKey();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (userKey) {
          headers['x-user-api-key'] = userKey;
        }

        const res = await fetch('/api/quiz/generate', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            difficulty: diff,
            format: fmt === 'all' ? 'random' : fmt,
            category: cat,
            count,
            excludeTitles: engine === 'chgk' ? [] : exclude,
            excludeIds: getAllExcludedIds(),
            engineSource: engine,
            chgkTournamentId: tournamentId,
          }),
        });

        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        return data.questions || [];
      } catch (err) {
        console.error('Failed to fetch quiz questions:', err);
        return [];
      }
    },
    [roundConfig.engineSource, roundConfig.chgkTournamentId, getAllExcludedIds]
  );

  // Reset answer states for next question
  const resetAnswerState = useCallback(() => {
    setIsAnswered(false);
    setSelectedOption(null);
    setIsEvaluatingOpen(false);
    setOpenEvaluationResult(null);
    setChgkSecondsLeft(60);
    questionStartTimeRef.current = Date.now();
  }, []);

  // Launch Round from Lobby
  const handleStartRound = async () => {
    setIsLoadingInitial(true);
    setNetworkError(null);
    resetAnswerState();
    setSessionAnswers([]);
    setQuestionNumber(1);
    prefetchCooldownUntilRef.current = 0;
    isPrefetchingRef.current = false;

    // Setup mode specific state
    if (gameMode === 'blitz') {
      setBlitzSecondsLeft(blitzDurationSeconds);
      setIsBlitzActive(true);
    } else {
      setIsBlitzActive(false);
    }

    if (gameMode === 'survival') {
      setSurvivalLives(3);
    }

    setGameState('playing');

    const currentExcludes = getAllExcludedTitles();
    const currentExcludeIds = new Set(getAllExcludedIds());
    const seenQuestionTexts = new Set(getAllExcludedQuestionTexts().map(normalizeQuestionText));
    const questions = await fetchQuestions(difficulty, formatFilter, selectedCategory, 3, currentExcludes);

    if (questions.length > 0) {
      const seenBatchQuestions = new Set<string>();
      const uniqueBatch: WikiQuestion[] = [];

      for (const q of questions) {
        const normQ = normalizeQuestionText(q.question);
        if (
          !seenQuestionTexts.has(normQ) &&
          !seenBatchQuestions.has(normQ) &&
          !currentExcludeIds.has(q.id)
        ) {
          if (normQ) seenBatchQuestions.add(normQ);
          uniqueBatch.push(q);
        }
      }

      // Safety fallback: if all were seen in history, take available questions
      const usableQuestions = uniqueBatch.length > 0 ? uniqueBatch : questions;

      if (usableQuestions.length > 0) {
        const [first, ...rest] = usableQuestions;
        setCurrentQuestion(first);
        setQuestionQueue(rest);
        const allFetchedTitles = usableQuestions.map((q) => q.articleTitle).filter(Boolean);
        setUsedArticleTitles((prev) => Array.from(new Set([...prev, ...allFetchedTitles])));
        
        const { profile: updatedP, allProfiles: updatedAll } = addSeenArticleTitles(allFetchedTitles);
        setActiveProfile(updatedP);
        setAllProfiles(updatedAll);

        if (first.category) setRecentCategories((prev) => [...prev.slice(-5), first.category]);
        questionStartTimeRef.current = Date.now();
        setNetworkError(null);
      } else {
        setNetworkError('Не удалось подобрать новые уникальные вопросы по выбранным параметрам. Попробуйте сменить категорию или сложность.');
      }
    } else {
      setNetworkError('Не удалось загрузить вопросы по выбранным параметрам. Попробуйте снова.');
    }
    setIsLoadingInitial(false);
  };

  // Background Prefetch Queue refill when queue is low
  useEffect(() => {
    if (
      gameState !== 'playing' ||
      questionQueue.length >= 2 ||
      isLoadingNext ||
      isLoadingInitial ||
      !currentQuestion ||
      isPrefetchingRef.current ||
      Date.now() < prefetchCooldownUntilRef.current
    ) {
      return;
    }

    isPrefetchingRef.current = true;
    const currentExcludes = getAllExcludedTitles();
    const currentExcludeIds = new Set(getAllExcludedIds());
    const seenQuestionTexts = new Set(getAllExcludedQuestionTexts().map(normalizeQuestionText));

    fetchQuestions(difficulty, formatFilter, selectedCategory, 2, currentExcludes)
      .then((newItems) => {
        if (newItems.length > 0) {
          const seenBatch = new Set<string>();

          const uniqueNew = newItems.filter((q) => {
            const normQ = normalizeQuestionText(q.question);
            const isExcluded =
              seenQuestionTexts.has(normQ) ||
              seenBatch.has(normQ) ||
              currentExcludeIds.has(q.id);

            if (!isExcluded) {
              if (normQ) seenBatch.add(normQ);
              return true;
            }
            return false;
          });

          if (uniqueNew.length > 0) {
            setQuestionQueue((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const existingQuestions = new Set(prev.map((p) => normalizeQuestionText(p.question)));

              const filtered = uniqueNew.filter(
                (u) =>
                  !existingIds.has(u.id) &&
                  !existingQuestions.has(normalizeQuestionText(u.question))
              );
              return [...prev, ...filtered];
            });

            const newTitles = uniqueNew.map((q) => q.articleTitle).filter(Boolean);
            setUsedArticleTitles((prev) => Array.from(new Set([...prev, ...newTitles])));
            const { profile: updatedP, allProfiles: updatedAll } = addSeenArticleTitles(newTitles);
            setActiveProfile(updatedP);
            setAllProfiles(updatedAll);
          } else {
            // No unique questions received; back off prefetch for 15 seconds to prevent runaway loop
            prefetchCooldownUntilRef.current = Date.now() + 15000;
          }
        } else {
          // Empty response; back off prefetch for 15 seconds
          prefetchCooldownUntilRef.current = Date.now() + 15000;
        }
      })
      .catch((err) => {
        console.warn('Background prefetch failed:', err);
        prefetchCooldownUntilRef.current = Date.now() + 15000;
      })
      .finally(() => {
        isPrefetchingRef.current = false;
      });
  }, [
    gameState,
    questionQueue.length,
    difficulty,
    formatFilter,
    selectedCategory,
    isLoadingNext,
    isLoadingInitial,
    currentQuestion?.id,
  ]);

  // Blitz Mode Countdown Timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (gameState === 'playing' && gameMode === 'blitz' && isBlitzActive && blitzSecondsLeft > 0) {
      timer = setInterval(() => {
        setBlitzSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsBlitzActive(false);
            setIsGameOverOpen(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameState, gameMode, isBlitzActive, blitzSecondsLeft]);

  // ChGK 60-Second Countdown Timer (when timer is enabled)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const isChgk = roundConfig.engineSource === 'chgk';
    const timerEnabled = roundConfig.chgkTimerEnabled ?? true;

    if (
      gameState === 'playing' &&
      isChgk &&
      timerEnabled &&
      !isAnswered &&
      chgkSecondsLeft > 0
    ) {
      timer = setInterval(() => {
        setChgkSecondsLeft((prev) => {
          if (prev <= 1) {
            // Final second expires -> majestic tournament gong ("Время!")
            sound.playGong();
            return 0;
          }
          if (prev === 11) {
            // Reached exactly 10 seconds remaining -> iconic double-beep warning
            sound.playChgk10sWarning();
            return 10;
          }
          if (prev <= 10 && prev > 1) {
            // Ticking for the final 9..1 seconds
            sound.playChgkTick(prev - 1);
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [
    gameState,
    roundConfig.engineSource,
    roundConfig.chgkTimerEnabled,
    isAnswered,
    chgkSecondsLeft,
  ]);

  // Handle ChGK timeout when 60s expires
  useEffect(() => {
    const isChgk = roundConfig.engineSource === 'chgk';
    const timerEnabled = roundConfig.chgkTimerEnabled ?? true;
    if (
      gameState === 'playing' &&
      isChgk &&
      timerEnabled &&
      chgkSecondsLeft === 0 &&
      !isAnswered &&
      currentQuestion
    ) {
      processAnswerOutcome(
        false,
        'Время вышло (60с)',
        `Время обсуждения вышло! Авторский ответ: ${currentQuestion.correctAnswer}`
      );
      setOpenEvaluationResult({
        isCorrect: false,
        feedback: `Время обсуждения вышло (60 секунд). Авторский ответ: ${currentQuestion.correctAnswer}`,
        similarity: 0,
      });
      setIsAnswered(true);
    }
  }, [
    chgkSecondsLeft,
    gameState,
    roundConfig.engineSource,
    roundConfig.chgkTimerEnabled,
    isAnswered,
    currentQuestion,
  ]);

  // Handle Mode Change in active game
  const handleSelectGameMode = (mode: GameMode) => {
    setRoundConfig((prev) => ({ ...prev, gameMode: mode }));
    setSessionAnswers([]);

    if (mode === 'blitz') {
      setBlitzSecondsLeft(blitzDurationSeconds);
      setIsBlitzActive(true);
    } else {
      setIsBlitzActive(false);
    }

    if (mode === 'survival') {
      setSurvivalLives(3);
    }
  };

  // Handle Filter Changes in active game
  const handleSelectDifficulty = (newDiff: DifficultyLevel) => {
    setRoundConfig((prev) => ({ ...prev, difficulty: newDiff }));
    setQuestionQueue([]);
  };

  const handleSelectFormat = async (newFmt: FormatFilter) => {
    setRoundConfig((prev) => ({ ...prev, formatFilter: newFmt }));
    setQuestionQueue([]);

    if (gameState === 'playing' && !isAnswered && currentQuestion) {
      const needsReload =
        (newFmt === 'multiple_choice' && currentQuestion.type !== 'multiple_choice') ||
        (newFmt === 'open_ended' && currentQuestion.type !== 'open_ended');

      if (needsReload) {
        setIsLoadingInitial(true);
        resetAnswerState();
        const currentExcludes = getAllExcludedTitles();
        const currentExcludeIds = new Set(getAllExcludedIds());
        const seenQuestionTexts = new Set(getAllExcludedQuestionTexts().map(normalizeQuestionText));
        const newItems = await fetchQuestions(difficulty, newFmt, selectedCategory, 2, currentExcludes);

        const uniqueItems = newItems.filter(
          (q) =>
            !seenQuestionTexts.has(normalizeQuestionText(q.question)) &&
            !currentExcludeIds.has(q.id)
        );

        const usableItems = uniqueItems.length > 0 ? uniqueItems : newItems;

        if (usableItems.length > 0) {
          const [nextQ, ...rest] = usableItems;
          setCurrentQuestion(nextQ);
          setQuestionQueue(rest);
          const newTitles = usableItems.map((q) => q.articleTitle).filter(Boolean);
          setUsedArticleTitles((prev) => Array.from(new Set([...prev, ...newTitles])));
          const { profile: updatedP, allProfiles: updatedAll } = addSeenArticleTitles(newTitles);
          setActiveProfile(updatedP);
          setAllProfiles(updatedAll);
          if (nextQ.category) setRecentCategories((prev) => [...prev.slice(-5), nextQ.category]);
          setNetworkError(null);
        }
        setIsLoadingInitial(false);
      }
    }
  };

  const handleSelectCategory = async (cat: string) => {
    const isSpecial = cat !== 'all';
    setRoundConfig((prev) => ({
      ...prev,
      selectedCategory: cat,
      gameMode: isSpecial && prev.gameMode === 'endless' ? 'topic' : prev.gameMode,
    }));
    setQuestionQueue([]);

    // If in playing state and question is not answered yet, load question for new category immediately
    if (gameState === 'playing' && !isAnswered) {
      setIsLoadingInitial(true);
      resetAnswerState();
      const currentExcludes = getAllExcludedTitles();
      const currentExcludeIds = new Set(getAllExcludedIds());
      const seenQuestionTexts = new Set(getAllExcludedQuestionTexts().map(normalizeQuestionText));
      const newItems = await fetchQuestions(difficulty, formatFilter, cat, 2, currentExcludes);

      const uniqueItems = newItems.filter(
        (q) =>
          !seenQuestionTexts.has(normalizeQuestionText(q.question)) &&
          !currentExcludeIds.has(q.id)
      );

      const usableItems = uniqueItems.length > 0 ? uniqueItems : newItems;

      if (usableItems.length > 0) {
        const [nextQ, ...rest] = usableItems;
        setCurrentQuestion(nextQ);
        setQuestionQueue(rest);
        const newTitles = usableItems.map((q) => q.articleTitle).filter(Boolean);
        setUsedArticleTitles((prev) => Array.from(new Set([...prev, ...newTitles])));
        const { profile: updatedP, allProfiles: updatedAll } = addSeenArticleTitles(newTitles);
        setActiveProfile(updatedP);
        setAllProfiles(updatedAll);
        if (nextQ.category) setRecentCategories((prev) => [...prev.slice(-5), nextQ.category]);
        setNetworkError(null);
      }
      setIsLoadingInitial(false);
    }
  };

  // Load next question or finish Sprint
  const loadNextQuestion = async () => {
    if (isLoadingNext || isLoadingInitial) return;

    // Check if Sprint round is completed
    if (gameMode === 'sprint' && questionNumber >= sprintQuestionCount) {
      setIsGameOverOpen(true);
      return;
    }

    if (questionQueue.length > 0) {
      resetAnswerState();
      setQuestionNumber((prev) => prev + 1);

      const [nextQ, ...rest] = questionQueue;
      setCurrentQuestion(nextQ);
      setQuestionQueue(rest);
      setUsedArticleTitles((prev) => Array.from(new Set([...prev, nextQ.articleTitle])));
      if (nextQ.category) setRecentCategories((prev) => [...prev.slice(-5), nextQ.category]);
      questionStartTimeRef.current = Date.now();
      setNetworkError(null);
    } else {
      setIsLoadingNext(true);
      try {
        const currentExcludes = getAllExcludedTitles();
        const currentExcludeIds = new Set(getAllExcludedIds());
        const seenQuestionTexts = new Set(getAllExcludedQuestionTexts().map(normalizeQuestionText));
        const newItems = await fetchQuestions(difficulty, formatFilter, selectedCategory, 2, currentExcludes);

        if (newItems.length > 0) {
          const seenBatch = new Set<string>();

          const uniqueNew = newItems.filter((q) => {
            const normQ = normalizeQuestionText(q.question);
            const isExcluded =
              seenQuestionTexts.has(normQ) ||
              seenBatch.has(normQ) ||
              currentExcludeIds.has(q.id);

            if (!isExcluded) {
              if (normQ) seenBatch.add(normQ);
              return true;
            }
            return false;
          });

          const candidates = uniqueNew.length > 0
            ? uniqueNew
            : newItems.filter((q) => q.id !== currentQuestion?.id && normalizeQuestionText(q.question) !== normalizeQuestionText(currentQuestion?.question || ''));
          const finalItems = candidates.length > 0 ? candidates : newItems;

          if (finalItems.length > 0) {
            resetAnswerState();
            setQuestionNumber((prev) => prev + 1);

            const [nextQ, ...rest] = finalItems;
            setCurrentQuestion(nextQ);
            setQuestionQueue(rest);
            const newTitles = finalItems.map((q) => q.articleTitle).filter(Boolean);
            setUsedArticleTitles((prev) => Array.from(new Set([...prev, ...newTitles])));
            const { profile: updatedP, allProfiles: updatedAll } = addSeenArticleTitles(newTitles);
            setActiveProfile(updatedP);
            setAllProfiles(updatedAll);
            if (nextQ.category) setRecentCategories((prev) => [...prev.slice(-5), nextQ.category]);
            questionStartTimeRef.current = Date.now();
            setNetworkError(null);
          } else {
            setNetworkError('Больше нет уникальных вопросов в выбранной категории. Попробуйте сменить категорию или сложность.');
          }
        } else {
          setNetworkError('Не удалось загрузить следующий вопрос. Попробуйте снова.');
        }
      } catch (err) {
        console.error('Failed to load next question:', err);
        setNetworkError('Ошибка при загрузке вопроса. Попробуйте снова.');
      } finally {
        setIsLoadingNext(false);
      }
    }
  };

  // Process Completed Answer (Score, Audio, Profile Stats & Achievements, Survival lives)
  const processAnswerOutcome = (
    isCorrect: boolean,
    userAnswerText: string,
    feedbackText?: string
  ) => {
    if (!currentQuestion) return;

    const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    const prevRank = calculateUserRank(activeProfile.stats.xp);

    // Audio effects
    if (isCorrect) {
      if (stats.currentStreak >= 2) {
        sound.playStreak();
      } else {
        sound.playCorrect();
      }
    } else {
      sound.playWrong();
    }

    // Calculate score
    let score = 0;
    if (isCorrect) {
      score = currentQuestion.difficulty === 'easy' ? 10 : currentQuestion.difficulty === 'medium' ? 20 : currentQuestion.difficulty === 'hard' ? 35 : 50;
      if (currentQuestion.type === 'open_ended') score += 10;
    }

    const answerRecord: UserAnswerRecord = {
      questionId: currentQuestion.id,
      question: currentQuestion,
      userAnswer: userAnswerText,
      isCorrect,
      timeSpentSeconds: timeSpent,
      timestamp: Date.now(),
      feedback: feedbackText,
      scoreEarned: score,
    };

    // Update profile storage and evaluate badges
    const { updatedProfile, allProfiles: updatedProfilesList, achievementResult } = recordAnswerInProfile(
      answerRecord,
      activeProfile
    );

    setActiveProfile(updatedProfile);
    setAllProfiles(updatedProfilesList);

    // Level up sound check
    const newRank = calculateUserRank(updatedProfile.stats.xp);
    if (newRank.level > prevRank.level) {
      setTimeout(() => sound.playLevelUp(), 400);
    }

    // Achievement unlock notification
    if (achievementResult.unlockedList.length > 0) {
      const topUnlock = achievementResult.unlockedList[0].achievement;
      setUnlockedAchievementToast(topUnlock);
      setTimeout(() => sound.playAchievement(), 200);
    }

    // Update current session answers
    setSessionAnswers((prev) => [...prev, answerRecord]);

    // Handle Survival Mode rules
    if (gameMode === 'survival') {
      if (!isCorrect) {
        const remaining = survivalLives - 1;
        setSurvivalLives(remaining);
        if (remaining <= 0) {
          const currentRoundScore = sessionAnswers.filter((a) => a.isCorrect).length;
          updateGameModeBestScores('survival', currentRoundScore, updatedProfile);
          setTimeout(() => {
            setIsGameOverOpen(true);
          }, 1200);
        }
      } else {
        // Ramp difficulty dynamically in survival
        const currentCorrectInSession = sessionAnswers.filter((a) => a.isCorrect).length + 1;
        if (currentCorrectInSession >= 9) handleSelectDifficulty('expert');
        else if (currentCorrectInSession >= 6) handleSelectDifficulty('hard');
        else if (currentCorrectInSession >= 3) handleSelectDifficulty('medium');
      }
    }
  };

  // Handle Multiple Choice Option Selection
  const handleSelectOption = (option: string) => {
    if (isAnswered || !currentQuestion) return;

    setSelectedOption(option);
    setIsAnswered(true);

    const isCorrect = option === currentQuestion.correctAnswer;
    processAnswerOutcome(isCorrect, option, isCorrect ? 'Верно!' : `Правильный ответ: ${currentQuestion.correctAnswer}`);
  };

  // Handle Open-Ended Answer Submission
  const handleSubmitOpenAnswer = async (userAnswer: string) => {
    if (isAnswered || !currentQuestion || isEvaluatingOpen) return;

    setIsEvaluatingOpen(true);

    try {
      const userKey = getUserApiKey();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userKey) {
        headers['x-user-api-key'] = userKey;
      }

      const res = await fetch('/api/quiz/evaluate-open', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: currentQuestion.question,
          correctAnswer: currentQuestion.correctAnswer,
          acceptableAnswers: currentQuestion.acceptableAnswers || [],
          userAnswer,
          articleTitle: currentQuestion.articleTitle,
        }),
      });

      const data = await res.json();
      const isCorrect = Boolean(data.isCorrect);

      setOpenEvaluationResult({
        isCorrect,
        feedback: data.feedback || (isCorrect ? 'Верно!' : `Правильный ответ: ${currentQuestion.correctAnswer}`),
        similarity: data.similarity || (isCorrect ? 1.0 : 0.0),
      });

      setIsAnswered(true);
      setIsEvaluatingOpen(false);

      processAnswerOutcome(isCorrect, userAnswer, data.feedback);
    } catch (err) {
      console.error('Error evaluating open answer:', err);
      const isCorrect = userAnswer.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
      setOpenEvaluationResult({
        isCorrect,
        feedback: isCorrect ? 'Верно!' : `Правильный ответ: ${currentQuestion.correctAnswer}`,
        similarity: isCorrect ? 1 : 0,
      });
      setIsAnswered(true);
      setIsEvaluatingOpen(false);
      processAnswerOutcome(isCorrect, userAnswer);
    }
  };

  // Handle user override on open question evaluation (Fair play)
  const handleOverrideOpenResult = (newIsCorrect: boolean) => {
    if (!currentQuestion || !openEvaluationResult) return;

    setOpenEvaluationResult({
      ...openEvaluationResult,
      isCorrect: newIsCorrect,
      feedback: newIsCorrect ? 'Засчитано игроком как верный ответ!' : 'Скорректировано на ошибку.',
    });

    if (newIsCorrect) {
      sound.playCorrect();
    } else {
      sound.playWrong();
    }
  };

  // Handle Favorites toggle
  const handleToggleFavorite = (q: WikiQuestion) => {
    const { updatedProfile, allProfiles: updatedList } = toggleFavoriteInProfile(q, activeProfile);
    setActiveProfile(updatedProfile);
    setAllProfiles(updatedList);
  };

  // Profile Management Handlers
  const handleSwitchProfile = (id: string) => {
    const { profile, allProfiles: list } = switchActiveProfile(id);
    setActiveProfile(profile);
    setAllProfiles(list);
  };

  const handleCreateProfile = (name: string, avatar: string) => {
    const { profile, allProfiles: list } = createNewProfile(name, avatar);
    setActiveProfile(profile);
    setAllProfiles(list);
  };

  const handleUpdateProfile = (data: Partial<UserProfile>) => {
    const { profile, allProfiles: list } = updateActiveProfile(data);
    setActiveProfile(profile);
    setAllProfiles(list);
  };

  const handleDeleteProfile = (id: string) => {
    const { activeProfile: newActive, allProfiles: list } = deleteUserProfile(id);
    setActiveProfile(newActive);
    setAllProfiles(list);
  };

  const handleResetStats = (id: string) => {
    const { profile, allProfiles: list } = resetProfileStats(id);
    setActiveProfile(profile);
    setAllProfiles(list);
  };

  // Handle Restart Round (GameOver modal)
  const handleRestartRound = () => {
    setIsGameOverOpen(false);
    handleStartRound();
  };

  // Handle Return to Setup / Lobby
  const handleOpenSetup = () => {
    setIsGameOverOpen(false);
    setGameState('lobby');
  };

  const handleBackToEndless = () => {
    setIsGameOverOpen(false);
    setRoundConfig((prev) => ({ ...prev, gameMode: 'endless' }));
    setIsBlitzActive(false);
    setSessionAnswers([]);
    handleStartRound();
  };

  const isCurrentFavorite = Boolean(
    currentQuestion &&
      stats.favorites.some(
        (f) => f.id === currentQuestion.id || f.articleTitle === currentQuestion.articleTitle
      )
  );

  return (
    <div className="min-h-screen bg-[#F9F7F2] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#1A1A1A] selection:text-[#F9F7F2]">
      {/* App Header with Active Player Profile Badge */}
      <Header
        activeProfile={activeProfile}
        isMuted={isMuted}
        onToggleMute={() => {
          const newMuted = sound.toggleMute();
          setIsMuted(newMuted);
        }}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
        onOpenSetup={() => setGameState(gameState === 'lobby' ? 'playing' : 'lobby')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isLobbyActive={gameState === 'lobby'}
      />

      {/* Main Content Arena */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col items-center">
        {/* Stage 1: Round Setup Lobby (Pre-Round Customization) */}
        {gameState === 'lobby' && (
          <RoundSetupLobby
            config={roundConfig}
            onChangeConfig={(newCfg) => setRoundConfig(newCfg)}
            onStartRound={handleStartRound}
            activeProfile={activeProfile}
            isLoading={isLoadingInitial}
          />
        )}

        {/* Stage 2: Active Quiz Game Arena */}
        {gameState === 'playing' && (
          <>
            {/* Game Controls & Quick Switchers */}
            <GameControls
              gameMode={gameMode}
              onSelectGameMode={handleSelectGameMode}
              difficulty={difficulty}
              onSelectDifficulty={handleSelectDifficulty}
              formatFilter={formatFilter}
              onSelectFormat={handleSelectFormat}
              selectedCategory={selectedCategory}
              onOpenCategoryPicker={() => setIsCategoryPickerOpen(true)}
              onOpenRoundSetup={handleOpenSetup}
              sprintQuestionCount={sprintQuestionCount}
              currentQuestionNumber={questionNumber}
              isLoading={isLoadingInitial || isLoadingNext}
              engineSource={roundConfig.engineSource || 'wikipedia'}
              chgkTimerEnabled={roundConfig.chgkTimerEnabled ?? true}
              onToggleChgkTimer={() => {
                setRoundConfig((prev) => ({
                  ...prev,
                  chgkTimerEnabled: !(prev.chgkTimerEnabled ?? true),
                }));
              }}
            />

            {/* Blitz Countdown Timer Bar */}
            {gameMode === 'blitz' && (
              <BlitzTimer
                secondsLeft={blitzSecondsLeft}
                totalSeconds={blitzDurationSeconds}
                isActive={isBlitzActive}
              />
            )}

            {/* Survival Lives Bar */}
            {gameMode === 'survival' && (
              <SurvivalLives
                livesLeft={survivalLives}
                maxLives={3}
                currentStreak={stats.currentStreak}
              />
            )}

            {/* ChGK Tournament Navigation & Clock Bar */}
            {roundConfig.engineSource === 'chgk' && currentQuestion && !isLoadingInitial && (
              <ChgkTopBar
                metadata={currentQuestion.chgkMetadata}
                questionNumber={questionNumber}
                timerEnabled={roundConfig.chgkTimerEnabled ?? true}
                secondsLeft={chgkSecondsLeft}
                totalSeconds={60}
                isAnswered={isAnswered}
                onTimeUp={() => {
                  if (!isAnswered && currentQuestion) {
                    processAnswerOutcome(
                      false,
                      'Время вышло (60с)',
                      `Время обсуждения вышло! Авторский ответ: ${currentQuestion.correctAnswer}`
                    );
                    setOpenEvaluationResult({
                      isCorrect: false,
                      feedback: `Время вышло (60 секунд). Авторский ответ: ${currentQuestion.correctAnswer}`,
                      similarity: 0,
                    });
                    setIsAnswered(true);
                  }
                }}
              />
            )}

            {/* Loading Spinner Skeleton */}
            {isLoadingInitial && (
              <div className="w-full border border-[#1A1A1A] bg-[#1A1A1A]/3 p-12 text-center flex flex-col items-center justify-center gap-4 my-6">
                <div className="w-10 h-10 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-serif font-bold text-[#1A1A1A]">
                    Генерируем вопросы по вашим параметрам...
                  </h3>
                  <p className="text-xs text-[#1A1A1A]/70 font-mono uppercase tracking-wider">
                    Режим: {gameMode} • Сложность: {difficulty} • Тема: {selectedCategory}
                  </p>
                </div>
              </div>
            )}

            {/* Network Error Card */}
            {networkError && !isLoadingInitial && (
              <div className="w-full border border-[#1A1A1A] bg-[#1A1A1A]/5 p-6 text-center my-6 flex flex-col items-center gap-3">
                <AlertCircle className="w-6 h-6 text-[#1A1A1A]" />
                <p className="text-sm font-serif italic font-bold text-[#1A1A1A]">{networkError}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartRound()}
                    className="px-5 py-2 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] hover:bg-transparent hover:text-[#1A1A1A] font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Повторить</span>
                  </button>
                  <button
                    onClick={handleOpenSetup}
                    className="px-5 py-2 border border-[#1A1A1A] bg-transparent text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>В меню настроек</span>
                  </button>
                </div>
              </div>
            )}

            {/* Active Quiz Card */}
            {!isLoadingInitial && currentQuestion && !networkError && (
              <QuizCard
                question={currentQuestion}
                questionNumber={questionNumber}
                isAnswered={isAnswered}
                selectedOption={selectedOption}
                onSelectOption={handleSelectOption}
                onSubmitOpenAnswer={handleSubmitOpenAnswer}
                onOverrideOpenResult={handleOverrideOpenResult}
                isEvaluatingOpen={isEvaluatingOpen}
                openEvaluationResult={openEvaluationResult}
                onNextQuestion={() => loadNextQuestion()}
                isLoadingNext={isLoadingNext}
                isFavorite={isCurrentFavorite}
                onToggleFavorite={handleToggleFavorite}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-[10px] uppercase font-mono tracking-widest text-[#1A1A1A]/60 border-t border-[#1A1A1A] mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Вики-Квиз • Интеллектуальная викторина русской Википедии</span>
          <span>Google Gemini AI • Открытые знания</span>
        </div>
      </footer>

      {/* Comprehensive User Profile & Achievements Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        activeProfile={activeProfile}
        allProfiles={allProfiles}
        onSwitchProfile={handleSwitchProfile}
        onCreateProfile={handleCreateProfile}
        onUpdateProfile={handleUpdateProfile}
        onDeleteProfile={handleDeleteProfile}
        onResetStats={handleResetStats}
      />

      {/* Bookmarks / Favorites Modal */}
      <FavoritesModal
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        favorites={stats.favorites}
        onRemoveFavorite={handleToggleFavorite}
        onPracticeFavorite={(q) => {
          setCurrentQuestion(q);
          resetAnswerState();
          setIsFavoritesOpen(false);
          setGameState('playing');
        }}
      />

      {/* Category Picker Modal */}
      <CategoryPickerModal
        isOpen={isCategoryPickerOpen}
        onClose={() => setIsCategoryPickerOpen(false)}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
      />

      {/* Game Over Modal (Sprint, Blitz & Survival) */}
      <GameOverModal
        isOpen={isGameOverOpen}
        onRestart={handleRestartRound}
        onOpenSetup={handleOpenSetup}
        onBackToEndless={handleBackToEndless}
        gameMode={gameMode}
        sessionAnswers={sessionAnswers}
        sessionStreak={stats.currentStreak}
      />

      {/* Settings & API Key Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProfile={activeProfile}
        onUpdateProfile={(updated) => {
          setActiveProfile(updated);
          setAllProfiles(loadAllProfiles());
        }}
      />

      {/* Achievement Unlocked Toast Banner */}
      <AchievementToast
        achievement={unlockedAchievementToast}
        onDismiss={() => setUnlockedAchievementToast(null)}
      />
    </div>
  );
}
