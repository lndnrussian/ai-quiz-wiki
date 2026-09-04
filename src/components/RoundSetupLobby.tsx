import React, { useState, useEffect } from 'react';
import {
  GameMode,
  DifficultyLevel,
  FormatFilter,
  RoundCustomizationConfig,
  UserProfile,
} from '../types';
import {
  Zap,
  Timer,
  Heart,
  Target,
  Compass,
  CheckSquare,
  MessageSquare,
  Layers,
  Sparkles,
  Play,
  Sliders,
  BookOpen,
  Search,
  Check,
  Flame,
  Award,
  Plus,
  Trash2,
  Clock,
  Hourglass,
  ExternalLink,
  ShieldCheck,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { sound } from '../utils/sound';
import { loadCustomTopics, addCustomTopic, removeCustomTopic } from '../utils/storage';

import { DEFAULT_WIKI_CATEGORIES, WikiCategoryItem } from '../constants/categories';

interface RoundSetupLobbyProps {
  config: RoundCustomizationConfig;
  onChangeConfig: (config: RoundCustomizationConfig) => void;
  onStartRound: () => void;
  activeProfile: UserProfile;
  isLoading?: boolean;
}

type CategoryItem = WikiCategoryItem;

export const RoundSetupLobby: React.FC<RoundSetupLobbyProps> = ({
  config,
  onChangeConfig,
  onStartRound,
  activeProfile,
  isLoading = false,
}) => {
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_WIKI_CATEGORIES);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [searchCatQuery, setSearchCatQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchCategories = async (retries = 2) => {
      try {
        const res = await fetch('/api/wiki/categories');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setCategories(data);
        }
      } catch (err) {
        if (retries > 0) {
          setTimeout(() => {
            if (isMounted) {
              fetchCategories(retries - 1);
            }
          }, 1000);
        } else {
          console.warn('Wiki categories: utilizing curated default topics', err);
        }
      }
    };

    fetchCategories();
    setCustomTopics(loadCustomTopics());

    return () => {
      isMounted = false;
    };
  }, []);

  const updateConfig = (partial: Partial<RoundCustomizationConfig>) => {
    onChangeConfig({
      ...config,
      ...partial,
    });
  };

  const gameModes: Array<{
    id: GameMode;
    label: string;
    badge: string;
    icon: React.ReactNode;
    desc: string;
    details: string;
  }> = [
    {
      id: 'endless',
      label: 'Бесконечный',
      badge: 'Свободный темп',
      icon: <Zap className="w-4 h-4" />,
      desc: 'Непрерывное исследование фактов русской Википедии',
      details: 'Без таймера и ограничений по жизням',
    },
    {
      id: 'sprint',
      label: 'Спринт-раунд',
      badge: 'Фиксированный раунд',
      icon: <Target className="w-4 h-4" />,
      desc: 'Серия вопросов с итоговым счётом и медалью',
      details: `${config.sprintQuestionCount || 10} вопросов на раунд`,
    },
    {
      id: 'blitz',
      label: 'Блиц на время',
      badge: 'На скорость',
      icon: <Timer className="w-4 h-4" />,
      desc: 'Ответьте на максимум вопросов за отведённое время',
      details: `${config.blitzDurationSeconds || 60} секунд на весь раунд`,
    },
    {
      id: 'survival',
      label: '3 Жизни',
      badge: 'Хардкор',
      icon: <Heart className="w-4 h-4" />,
      desc: 'Игра до 3 ошибок с нарастающей сложностью',
      details: 'Сложность растёт с каждым успехом',
    },
    {
      id: 'topic',
      label: 'По конкретной теме',
      badge: 'Фокус знаний',
      icon: <Compass className="w-4 h-4" />,
      desc: 'Углублённое погружение в выбранную рубрику или статью',
      details: config.selectedCategory === 'all' ? 'Все категории' : config.selectedCategory,
    },
  ];

  const difficultyLevels: Array<{
    id: DifficultyLevel;
    label: string;
    desc: string;
    xpBonus: string;
  }> = [
    {
      id: 'easy',
      label: 'Лёгкий',
      desc: 'Топ-статьи Википедии: базовые факты, культовые фигуры и фундаментальные открытия',
      xpBonus: '+10 XP / вопрос',
    },
    {
      id: 'medium',
      label: 'Средний',
      desc: 'Высокая популярность: сбалансированная эрудиция, история и ключевые концепции',
      xpBonus: '+20 XP / вопрос',
    },
    {
      id: 'hard',
      label: 'Сложный',
      desc: 'Средняя и нишевая известность: глубокие детали, контекст и специальные термины',
      xpBonus: '+35 XP / вопрос',
    },
    {
      id: 'expert',
      label: 'Эксперт',
      desc: 'Специализированные статьи: академические нюансы и редкие взаимосвязи для знатоков',
      xpBonus: '+50 XP / вопрос',
    },
  ];

  const formatOptions: Array<{
    id: FormatFilter;
    label: string;
    icon: React.ReactNode;
    desc: string;
    badge: string;
  }> = [
    {
      id: 'all',
      label: 'Микс форматов',
      icon: <Layers className="w-4 h-4" />,
      desc: 'Гармоничное сочетание тестов с вариантами и открытых вопросов',
      badge: 'Рекомендуется',
    },
    {
      id: 'multiple_choice',
      label: '4 Варианта ответа',
      icon: <CheckSquare className="w-4 h-4" />,
      desc: 'Классический выбор одного верного варианта из четырех',
      badge: 'Тестовый режим',
    },
    {
      id: 'open_ended',
      label: 'Без вариантов (текст)',
      icon: <MessageSquare className="w-4 h-4" />,
      desc: 'Ввод ответа своими словами с интеллектуальной AI-проверкой смысла',
      badge: '+10 XP бонус',
    },
  ];

  const chgkTournaments = [
    {
      id: 'random',
      title: '🎲 Случайные турнирные вопросы',
      description: 'Микс вопросов из различных синхронов и кубков базы db.chgk.info',
      badge: 'Сборный пакет',
    },
    {
      id: 'ovsch20.1_u',
      title: '🏆 ОВСЧ — Открытый всероссийский синхронный чемпионат',
      description: 'Классический эталонный синхрон высшей категории сложности',
      badge: 'Синхрон 2020',
    },
    {
      id: 'thanos20.1_u',
      title: '💎 Кубок Бесконечности (Камень Реальности)',
      description: 'Популярный турнирный цикл командных игр с остроумными ассоциациями',
      badge: 'Кубок 2020',
    },
    {
      id: 'malakh20_u',
      title: '📦 Малахитовая шкатулка',
      description: 'Уральский турнир с глубокими культурологическими и историческими вопросами',
      badge: 'Синхрон 2020',
    },
    {
      id: 'druz',
      title: '🦉 Пакет Александра Друзя',
      description: 'Золотая классика от магистра телеигры «Что? Где? Когда?»',
      badge: 'Авторский',
    },
    {
      id: 'potash',
      title: '🧠 Пакет Максима Поташева',
      description: 'Вопросы от магистра и обладателя «Хрустальной совы»',
      badge: 'Авторский',
    },
    {
      id: 'fizcup20_u',
      title: '⚛️ Кубок Физтеха по интеллектуальным играм',
      description: 'Турнир МФТИ с вопросами на логику, науку и нестандартное мышление',
      badge: 'Кубок МФТИ',
    },
    {
      id: 'zemli20.1_u',
      title: '🌍 Бесконечные земли: том I',
      description: 'Асинхронный турнир с широким кругозором и яркими сюжетами',
      badge: 'Асинхрон',
    },
  ];

  const quickPresets = [
    {
      title: 'ЧГК (С часами 60с)',
      tag: 'ЧГК Таймер',
      config: {
        engineSource: 'chgk' as const,
        chgkTimerEnabled: true,
        chgkTournamentId: 'random',
        gameMode: 'endless' as GameMode,
        formatFilter: 'open_ended' as FormatFilter,
        difficulty: 'hard' as DifficultyLevel,
      },
    },
    {
      title: 'ЧГК (Без часов)',
      tag: 'ЧГК Релакс',
      config: {
        engineSource: 'chgk' as const,
        chgkTimerEnabled: false,
        chgkTournamentId: 'random',
        gameMode: 'endless' as GameMode,
        formatFilter: 'open_ended' as FormatFilter,
        difficulty: 'hard' as DifficultyLevel,
      },
    },
    {
      title: 'Классический Вики-Квиз',
      tag: 'Википедия',
      config: {
        engineSource: 'wikipedia' as const,
        gameMode: 'endless' as GameMode,
        difficulty: 'medium' as DifficultyLevel,
        formatFilter: 'all' as FormatFilter,
        selectedCategory: 'all',
      },
    },
    {
      title: 'Блиц Википедии 60с',
      tag: 'Скорость',
      config: {
        engineSource: 'wikipedia' as const,
        gameMode: 'blitz' as GameMode,
        difficulty: 'medium' as DifficultyLevel,
        formatFilter: 'multiple_choice' as FormatFilter,
        selectedCategory: 'all',
        blitzDurationSeconds: 60,
      },
    },
    {
      title: '3 Жизни: Выживание',
      tag: 'Хардкор',
      config: {
        engineSource: 'wikipedia' as const,
        gameMode: 'survival' as GameMode,
        difficulty: 'medium' as DifficultyLevel,
        formatFilter: 'all' as FormatFilter,
        selectedCategory: 'all',
      },
    },
  ];

  const handleApplyCustomTopic = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTopicInput.trim();
    if (!trimmed) return;
    sound.playClick();
    const updated = addCustomTopic(trimmed);
    setCustomTopics(updated);
    updateConfig({
      selectedCategory: trimmed,
      gameMode: config.gameMode === 'endless' ? 'topic' : config.gameMode,
    });
    setCustomTopicInput('');
    setIsCategoryDropdownOpen(false);
  };

  const handleRemoveCustomTopic = (topicToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    const updated = removeCustomTopic(topicToRemove);
    setCustomTopics(updated);
    if (config.selectedCategory.toLowerCase() === topicToRemove.toLowerCase()) {
      updateConfig({ selectedCategory: 'all' });
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.label.toLowerCase().includes(searchCatQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchCatQuery.toLowerCase())
  );

  return (
    <div id="round-setup-lobby" className="w-full max-w-4xl mx-auto flex flex-col space-y-8 animate-fadeIn">
      {/* Top Banner / Masthead */}
      <div className="border border-[#1A1A1A] bg-[#F9F7F2] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] bg-[#1A1A1A] text-[#F9F7F2] px-2 py-0.5 font-mono">
              Лобби раунда
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/60">
              Настройка параметров игры
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-serif font-black tracking-tight text-[#1A1A1A]">
            Кастомизация викторины
          </h2>
          <p className="text-xs sm:text-sm text-[#1A1A1A]/70 font-sans max-w-xl">
            Выберите желаемый режим игры, уровень сложности, формат вопросов и тематику русской Википедии перед началом раунда.
          </p>
        </div>

        {/* Start Game Action Button */}
        <div className="w-full sm:w-auto shrink-0">
          <button
            id="start-round-btn-top"
            onClick={() => {
              sound.playClick();
              onStartRound();
            }}
            disabled={isLoading}
            className="w-full sm:w-auto px-8 py-4 border-2 border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] hover:bg-transparent hover:text-[#1A1A1A] font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-[4px_4px_0px_0px_#1A1A1A] hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-x-1 active:translate-y-1 disabled:opacity-50"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Начать раунд</span>
          </button>
        </div>
      </div>

      {/* Quick Presets Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/60 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#1A1A1A]" />
            Готовые пресеты викторины
          </span>
          <span className="text-[10px] font-mono text-[#1A1A1A]/50">Быстрый выбор в один клик</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {quickPresets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                sound.playClick();
                updateConfig(p.config);
              }}
              className="p-3 border border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-left bg-[#1A1A1A]/2 hover:bg-[#1A1A1A] hover:text-[#F9F7F2] transition-all group flex flex-col justify-between h-full"
            >
              <span className="text-[9px] font-mono font-bold uppercase text-[#1A1A1A]/60 group-hover:text-[#F9F7F2]/80">
                {p.tag}
              </span>
              <span className="font-serif font-bold text-xs leading-tight mt-1 group-hover:text-[#F9F7F2]">
                {p.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Engine Source Selection: Wikipedia vs ChGK Database */}
      <div className="border-2 border-[#1A1A1A] p-6 sm:p-7 bg-[#F9F7F2] space-y-4 shadow-[4px_4px_0px_0px_#1A1A1A]/10">
        <div className="flex items-center justify-between border-b border-[#1A1A1A]/15 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-[#1A1A1A] text-[#F9F7F2] font-mono text-xs font-bold flex items-center justify-center">
              ★
            </span>
            <h3 className="font-serif font-bold text-lg text-[#1A1A1A]">
              Источник вопросов викторины
            </h3>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#1A1A1A]/60">
            База знаний
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Wikipedia */}
          <button
            type="button"
            id="engine-source-wikipedia"
            onClick={() => {
              sound.playClick();
              updateConfig({ engineSource: 'wikipedia' });
            }}
            className={`p-5 border text-left transition-all flex flex-col justify-between gap-3 relative ${
              (config.engineSource || 'wikipedia') === 'wikipedia'
                ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[3px_3px_0px_0px_#1A1A1A]'
                : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A]/3'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 border text-base ${
                    (config.engineSource || 'wikipedia') === 'wikipedia'
                      ? 'border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A]'
                      : 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                  }`}
                >
                  🎓
                </div>
                <div>
                  <h4 className="font-serif font-bold text-base leading-tight">
                    Русская Википедия
                  </h4>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider ${
                      (config.engineSource || 'wikipedia') === 'wikipedia'
                        ? 'text-[#F9F7F2]/70'
                        : 'text-[#1A1A1A]/60'
                    }`}
                  >
                    Энциклопедические факты & AI
                  </span>
                </div>
              </div>
              {(config.engineSource || 'wikipedia') === 'wikipedia' && (
                <div className="w-5 h-5 border border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>

            <p
              className={`text-xs leading-relaxed ${
                (config.engineSource || 'wikipedia') === 'wikipedia'
                  ? 'text-[#F9F7F2]/80'
                  : 'text-[#1A1A1A]/70'
              }`}
            >
              Широкий кругозор по статьям Википедии с калибровкой сложности и поддержкой разнообразных тем и форматов.
            </p>
          </button>

          {/* Option 2: What? Where? When? (db.chgk.info) */}
          <button
            type="button"
            id="engine-source-chgk"
            onClick={() => {
              sound.playClick();
              updateConfig({
                engineSource: 'chgk',
                formatFilter: 'open_ended',
                chgkTimerEnabled: config.chgkTimerEnabled ?? true,
                chgkTournamentId: config.chgkTournamentId || 'random',
              });
            }}
            className={`p-5 border text-left transition-all flex flex-col justify-between gap-3 relative ${
              config.engineSource === 'chgk'
                ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[3px_3px_0px_0px_#1A1A1A]'
                : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A]/3'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 border text-base ${
                    config.engineSource === 'chgk'
                      ? 'border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A]'
                      : 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                  }`}
                >
                  🦉
                </div>
                <div>
                  <h4 className="font-serif font-bold text-base leading-tight">
                    База «Что? Где? Когда?»
                  </h4>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider ${
                      config.engineSource === 'chgk'
                        ? 'text-[#F9F7F2]/70'
                        : 'text-[#1A1A1A]/60'
                    }`}
                  >
                    db.chgk.info • Вопросы знатоков
                  </span>
                </div>
              </div>
              {config.engineSource === 'chgk' && (
                <div className="w-5 h-5 border border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>

            <p
              className={`text-xs leading-relaxed ${
                config.engineSource === 'chgk'
                  ? 'text-[#F9F7F2]/80'
                  : 'text-[#1A1A1A]/70'
              }`}
            >
              Подлинные турнирные вопросы спортивного ЧГК с авторскими зачётами, комментариями и прямой ссылкой на первоисточник.
            </p>
          </button>
        </div>
      </div>

      {/* CHGK CONFIGURATION PANEL */}
      {config.engineSource === 'chgk' ? (
        <div className="space-y-8 animate-fadeIn">
          {/* ChGK Step 1: Clock Option ("Опция с часами и без") */}
          <div className="border border-[#1A1A1A] p-6 sm:p-7 bg-[#F9F7F2] space-y-4">
            <div className="flex items-center justify-between border-b border-[#1A1A1A]/15 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-[#1A1A1A] text-[#F9F7F2] font-mono text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="font-serif font-bold text-lg text-[#1A1A1A]">
                  Режим времени знатоков (С часами или без)
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#1A1A1A]/60">
                Тайминг ЧГК
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: With Clocks (60s) */}
              <button
                type="button"
                id="chgk-mode-with-clocks"
                onClick={() => {
                  sound.playClick();
                  updateConfig({ chgkTimerEnabled: true });
                }}
                className={`p-5 border text-left transition-all flex flex-col justify-between gap-3 relative ${
                  (config.chgkTimerEnabled ?? true)
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[3px_3px_0px_0px_#1A1A1A]'
                    : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A]/3'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 border ${
                        (config.chgkTimerEnabled ?? true)
                          ? 'border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A]'
                          : 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-base leading-tight">
                        ⏱️ С часами (60 секунд)
                      </h4>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider ${
                          (config.chgkTimerEnabled ?? true) ? 'text-[#F9F7F2]/70' : 'text-[#1A1A1A]/60'
                        }`}
                      >
                        Классическая минута обсуждения
                      </span>
                    </div>
                  </div>
                  {(config.chgkTimerEnabled ?? true) && (
                    <div className="w-5 h-5 border border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A] flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                <p
                  className={`text-xs ${
                    (config.chgkTimerEnabled ?? true) ? 'text-[#F9F7F2]/80' : 'text-[#1A1A1A]/70'
                  }`}
                >
                  Ровно 60 секунд на взятие вопроса: звуковой сигнал за 10 секунд до конца, отсчёт и финальный гонг («Время!»).
                </p>

                <div
                  className={`pt-2 border-t text-[10px] font-mono font-bold uppercase tracking-wider ${
                    (config.chgkTimerEnabled ?? true)
                      ? 'border-[#F9F7F2]/20 text-emerald-300'
                      : 'border-[#1A1A1A]/10 text-[#1A1A1A]/60'
                  }`}
                >
                  +15 XP бонус за скорость
                </div>
              </button>

              {/* Option B: Without Clocks */}
              <button
                type="button"
                id="chgk-mode-without-clocks"
                onClick={() => {
                  sound.playClick();
                  updateConfig({ chgkTimerEnabled: false });
                }}
                className={`p-5 border text-left transition-all flex flex-col justify-between gap-3 relative ${
                  config.chgkTimerEnabled === false
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[3px_3px_0px_0px_#1A1A1A]'
                    : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A]/3'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 border ${
                        config.chgkTimerEnabled === false
                          ? 'border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A]'
                          : 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                      }`}
                    >
                      <Hourglass className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-base leading-tight">
                        ⏳ Без часов (вдумчивый темп)
                      </h4>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider ${
                          config.chgkTimerEnabled === false ? 'text-[#F9F7F2]/70' : 'text-[#1A1A1A]/60'
                        }`}
                      >
                        Без ограничения по времени
                      </span>
                    </div>
                  </div>
                  {config.chgkTimerEnabled === false && (
                    <div className="w-5 h-5 border border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A] flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                <p
                  className={`text-xs ${
                    config.chgkTimerEnabled === false ? 'text-[#F9F7F2]/80' : 'text-[#1A1A1A]/70'
                  }`}
                >
                  Неограниченное время на вопрос. Спокойно обдумывайте логические ходы и раскручивайте формулировки знатоков в комфортном темпе.
                </p>

                <div
                  className={`pt-2 border-t text-[10px] font-mono font-bold uppercase tracking-wider ${
                    config.chgkTimerEnabled === false
                      ? 'border-[#F9F7F2]/20 text-[#F9F7F2]/90'
                      : 'border-[#1A1A1A]/10 text-[#1A1A1A]/60'
                  }`}
                >
                  Стандартный опыт (10 XP)
                </div>
              </button>
            </div>
          </div>

          {/* ChGK Step 2: Tournament Package Selection */}
          <div className="border border-[#1A1A1A] p-6 sm:p-7 bg-[#F9F7F2] space-y-4">
            <div className="flex items-center justify-between border-b border-[#1A1A1A]/15 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-[#1A1A1A] text-[#F9F7F2] font-mono text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="font-serif font-bold text-lg text-[#1A1A1A]">
                  Турнирный пакет базы db.chgk.info
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#1A1A1A]/60">
                Пакеты вопросов
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {chgkTournaments.map((t) => {
                const isSelected = (config.chgkTournamentId || 'random') === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      updateConfig({ chgkTournamentId: t.id });
                    }}
                    className={`p-4 border text-left transition-all flex flex-col justify-between gap-3 relative ${
                      isSelected
                        ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[3px_3px_0px_0px_#1A1A1A]'
                        : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A]/3'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border ${
                            isSelected
                              ? 'border-white/30 text-white/90 bg-white/10'
                              : 'border-[#1A1A1A]/20 text-[#1A1A1A]/70 bg-[#1A1A1A]/5'
                          }`}
                        >
                          {t.badge}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 stroke-[3] text-[#F9F7F2]" />
                        )}
                      </div>
                      <h4 className="font-serif font-bold text-sm leading-tight pt-1">
                        {t.title}
                      </h4>
                    </div>

                    <p
                      className={`text-[11px] leading-snug ${
                        isSelected ? 'text-[#F9F7F2]/80' : 'text-[#1A1A1A]/70'
                      }`}
                    >
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ChGK Step 3: Handouts & Visual Material Preference */}
          <div className="border border-[#1A1A1A] p-6 sm:p-7 bg-[#F9F7F2] space-y-4">
            <div className="flex items-center justify-between border-b border-[#1A1A1A]/15 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-[#1A1A1A] text-[#F9F7F2] font-mono text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="font-serif font-bold text-lg text-[#1A1A1A]">
                  Раздаточные материалы и иллюстрации
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#1A1A1A]/60">
                Фильтр раздаток
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: All questions with handouts */}
              <button
                type="button"
                id="chgk-handouts-all"
                onClick={() => {
                  sound.playClick();
                  updateConfig({ chgkFilterHandouts: 'all' });
                }}
                className={`p-5 text-left border transition-all relative flex flex-col justify-between ${
                  (config.chgkFilterHandouts || 'all') === 'all'
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[2px_2px_0px_#1A1A1A]'
                    : 'border-[#1A1A1A]/30 bg-transparent text-[#1A1A1A] hover:border-[#1A1A1A]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-widest font-mono flex items-center gap-2 ${
                        (config.chgkFilterHandouts || 'all') === 'all'
                          ? 'text-[#F9F7F2]'
                          : 'text-[#1A1A1A]'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>Все вопросы</span>
                    </span>
                    {(config.chgkFilterHandouts || 'all') === 'all' && (
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-[#F9F7F2] text-[#1A1A1A] font-bold">
                        Включено
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs leading-relaxed ${
                      (config.chgkFilterHandouts || 'all') === 'all'
                        ? 'text-[#F9F7F2]/80'
                        : 'text-[#1A1A1A]/70'
                    }`}
                  >
                    Включает вопросы с графическими иллюстрациями, текстовыми цитатами, возможностью зума и прямыми ссылками на хостинг.
                  </p>
                </div>
              </button>

              {/* Option 2: Text-only questions */}
              <button
                type="button"
                id="chgk-handouts-text-only"
                onClick={() => {
                  sound.playClick();
                  updateConfig({ chgkFilterHandouts: 'text_only' });
                }}
                className={`p-5 text-left border transition-all relative flex flex-col justify-between ${
                  config.chgkFilterHandouts === 'text_only'
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[2px_2px_0px_#1A1A1A]'
                    : 'border-[#1A1A1A]/30 bg-transparent text-[#1A1A1A] hover:border-[#1A1A1A]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-widest font-mono flex items-center gap-2 ${
                        config.chgkFilterHandouts === 'text_only'
                          ? 'text-[#F9F7F2]'
                          : 'text-[#1A1A1A]'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Только текстовые вопросы</span>
                    </span>
                    {config.chgkFilterHandouts === 'text_only' && (
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-[#F9F7F2] text-[#1A1A1A] font-bold">
                        Выбрано
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs leading-relaxed ${
                      config.chgkFilterHandouts === 'text_only'
                        ? 'text-[#F9F7F2]/80'
                        : 'text-[#1A1A1A]/70'
                    }`}
                  >
                    Исключает вопросы, требующие раздаточных картинок или карточек. Подходит для быстрой игры без картинок.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* ChGK Rules & Copyright Attribution Info Banner */}
          <div className="border border-[#1A1A1A] bg-[#1A1A1A]/5 p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span className="font-serif font-bold text-xs text-[#1A1A1A] uppercase tracking-wider">
                  Лицензирование и авторские права (db.chgk.info)
                </span>
              </div>
              <a
                href="https://db.chgk.info/copyright"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sound.playClick()}
                className="text-[11px] font-mono text-[#1A1A1A] underline flex items-center gap-1 hover:opacity-80"
              >
                <span>Условия лицензии</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-[#1A1A1A]/80 leading-relaxed">
              Вопросы получены из базы <strong>db.chgk.info</strong> и используются в некоммерческих игровых целях.
              Все авторские права авторов вопросов и редакторов сохранены. В интерфейсе игры всегда доступна
              прямая ссылка на страницу вопроса в базе знатоков, авторский зачёт и комментарий.
            </p>
          </div>
        </div>
      ) : (
        /* STANDARD WIKIPEDIA CONFIGURATION STEPS (1-4) */
        <>
          {/* Step 1: Game Mode Selection */}
          <div className="border border-[#1A1A1A] p-6 sm:p-7 bg-[#F9F7F2] space-y-4">
            <div className="flex items-center justify-between border-b border-[#1A1A1A]/15 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-[#1A1A1A] text-[#F9F7F2] font-mono text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="font-serif font-bold text-lg text-[#1A1A1A]">
                  Режим игры (Game Mode)
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#1A1A1A]/60">
                Выберите правила раунда
              </span>
            </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {gameModes.map((m) => {
            const isSelected = config.gameMode === m.id;
            return (
              <button
                key={m.id}
                id={`lobby-mode-btn-${m.id}`}
                onClick={() => {
                  sound.playClick();
                  updateConfig({ gameMode: m.id });
                }}
                className={`p-4 border text-left transition-all flex flex-col justify-between gap-3 relative ${
                  isSelected
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[3px_3px_0px_0px_#1A1A1A]'
                    : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A]/3'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 border ${
                        isSelected ? 'border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A]' : 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                      }`}
                    >
                      {m.icon}
                    </div>
                    <span className="font-serif font-bold text-base leading-tight">
                      {m.label}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 border border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A] flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                <p className={`text-xs ${isSelected ? 'text-[#F9F7F2]/80' : 'text-[#1A1A1A]/70'}`}>
                  {m.desc}
                </p>

                <div
                  className={`pt-2 border-t text-[10px] font-mono font-bold uppercase tracking-wider ${
                    isSelected ? 'border-[#F9F7F2]/20 text-[#F9F7F2]/90' : 'border-[#1A1A1A]/10 text-[#1A1A1A]/60'
                  }`}
                >
                  {m.badge} • {m.details}
                </div>
              </button>
            );
          })}
        </div>

        {/* Additional configuration sub-panel for Sprint / Blitz */}
        {config.gameMode === 'sprint' && (
          <div className="p-4 border border-[#1A1A1A] bg-[#1A1A1A]/3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/60">
                Длина спринт-раунда
              </span>
              <p className="text-xs text-[#1A1A1A]">
                Сколько вопросов задать в этом раунде до подсчёта итогового рейтинга:
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[5, 10, 15, 20].map((num) => {
                const isCur = (config.sprintQuestionCount || 10) === num;
                return (
                  <button
                    key={num}
                    onClick={() => {
                      sound.playClick();
                      updateConfig({ sprintQuestionCount: num });
                    }}
                    className={`px-3 py-1.5 text-xs font-mono font-bold border transition-all ${
                      isCur
                        ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                        : 'border-[#1A1A1A]/40 text-[#1A1A1A] hover:border-[#1A1A1A]'
                    }`}
                  >
                    {num} вопр.
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {config.gameMode === 'blitz' && (
          <div className="p-4 border border-[#1A1A1A] bg-[#1A1A1A]/3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/60">
                Длительность блица
              </span>
              <p className="text-xs text-[#1A1A1A]">
                Сколько секунд дать на быстрые непрерывные ответы:
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[30, 60, 90, 120].map((sec) => {
                const isCur = (config.blitzDurationSeconds || 60) === sec;
                return (
                  <button
                    key={sec}
                    onClick={() => {
                      sound.playClick();
                      updateConfig({ blitzDurationSeconds: sec });
                    }}
                    className={`px-3 py-1.5 text-xs font-mono font-bold border transition-all ${
                      isCur
                        ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                        : 'border-[#1A1A1A]/40 text-[#1A1A1A] hover:border-[#1A1A1A]'
                    }`}
                  >
                    {sec} сек
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Difficulty Selection */}
      <div className="border border-[#1A1A1A] p-6 sm:p-7 bg-[#F9F7F2] space-y-4">
        <div className="flex items-center justify-between border-b border-[#1A1A1A]/15 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-[#1A1A1A] text-[#F9F7F2] font-mono text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h3 className="font-serif font-bold text-lg text-[#1A1A1A]">
              Уровень сложности (Difficulty)
            </h3>
          </div>
          {config.gameMode === 'survival' ? (
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#1A1A1A]/60 bg-[#1A1A1A]/5 px-2 py-0.5 border border-[#1A1A1A]/20">
              В выживании нарастает автоматически
            </span>
          ) : (
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#1A1A1A]/60">
              Выберите глубину вопросов
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {difficultyLevels.map((d) => {
            const isSelected = config.difficulty === d.id;
            const isDisabled = config.gameMode === 'survival';
            return (
              <button
                key={d.id}
                id={`lobby-diff-btn-${d.id}`}
                disabled={isDisabled}
                onClick={() => {
                  sound.playClick();
                  updateConfig({ difficulty: d.id });
                }}
                className={`p-4 border text-left transition-all flex flex-col justify-between gap-2.5 relative ${
                  isSelected
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[3px_3px_0px_0px_#1A1A1A]'
                    : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A]/3'
                } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif font-bold text-base leading-tight">
                    {d.label}
                  </span>
                  {isSelected && (
                    <div className="w-4 h-4 border border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                <p className={`text-xs ${isSelected ? 'text-[#F9F7F2]/80' : 'text-[#1A1A1A]/70'}`}>
                  {d.desc}
                </p>

                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                    isSelected ? 'text-[#F9F7F2]/90' : 'text-[#1A1A1A]/60'
                  }`}
                >
                  {d.xpBonus}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 3: Question Format Selection */}
      <div className="border border-[#1A1A1A] p-6 sm:p-7 bg-[#F9F7F2] space-y-4">
        <div className="flex items-center justify-between border-b border-[#1A1A1A]/15 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-[#1A1A1A] text-[#F9F7F2] font-mono text-xs font-bold flex items-center justify-center">
              3
            </span>
            <h3 className="font-serif font-bold text-lg text-[#1A1A1A]">
              Формат ответов (Format)
            </h3>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#1A1A1A]/60">
            Тип проверки знаний
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {formatOptions.map((f) => {
            const isSelected = config.formatFilter === f.id;
            return (
              <button
                key={f.id}
                id={`lobby-format-btn-${f.id}`}
                onClick={() => {
                  sound.playClick();
                  updateConfig({ formatFilter: f.id });
                }}
                className={`p-4 border text-left transition-all flex flex-col justify-between gap-3 relative ${
                  isSelected
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[3px_3px_0px_0px_#1A1A1A]'
                    : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A]/3'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 border ${
                        isSelected ? 'border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A]' : 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                      }`}
                    >
                      {f.icon}
                    </div>
                    <span className="font-serif font-bold text-sm leading-tight">
                      {f.label}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 border border-[#F9F7F2] bg-[#F9F7F2] text-[#1A1A1A] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                <p className={`text-xs ${isSelected ? 'text-[#F9F7F2]/80' : 'text-[#1A1A1A]/70'}`}>
                  {f.desc}
                </p>

                <div
                  className={`pt-2 border-t text-[10px] font-mono font-bold uppercase tracking-wider ${
                    isSelected ? 'border-[#F9F7F2]/20 text-[#F9F7F2]/90' : 'border-[#1A1A1A]/10 text-[#1A1A1A]/60'
                  }`}
                >
                  {f.badge}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 4: Knowledge Sphere & Category Picker */}
      <div className="border border-[#1A1A1A] p-6 sm:p-7 bg-[#F9F7F2] space-y-4">
        <div className="flex items-center justify-between border-b border-[#1A1A1A]/15 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-[#1A1A1A] text-[#F9F7F2] font-mono text-xs font-bold flex items-center justify-center">
              4
            </span>
            <h3 className="font-serif font-bold text-lg text-[#1A1A1A]">
              Тематика знаний (Topic / Category)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#1A1A1A]/60">
              Текущая:
            </span>
            <span className="text-xs font-serif font-bold bg-[#1A1A1A] text-[#F9F7F2] px-2.5 py-0.5">
              {config.selectedCategory === 'all'
                ? 'Все категории Википедии'
                : config.selectedCategory}
            </span>
          </div>
        </div>

        {/* Custom topic prompt bar */}
        <form onSubmit={handleApplyCustomTopic} className="flex gap-2">
          <input
            type="text"
            value={customTopicInput}
            onChange={(e) => setCustomTopicInput(e.target.value)}
            placeholder="Задайте любую тему (например: Древний Египет, Квантовая физика, Лев Толстой, Астрономия)..."
            className="flex-1 px-4 py-2.5 bg-transparent border border-[#1A1A1A] text-xs sm:text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/40 outline-none font-serif italic"
          />
          <button
            type="submit"
            disabled={!customTopicInput.trim()}
            className="px-5 py-2.5 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] hover:bg-transparent hover:text-[#1A1A1A] disabled:opacity-40 font-bold text-xs uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Применить тему</span>
          </button>
        </form>

        {/* User-created Custom Topics Section */}
        {customTopics.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-[#1A1A1A]/10">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#1A1A1A]/70">
              <span className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-[#1A1A1A]" />
                Ваши сохранённые темы ({customTopics.length}):
              </span>
              <span className="text-[9px] text-[#1A1A1A]/50">Нажмите для выбора темы</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {customTopics.map((topic) => {
                const isSelected = config.selectedCategory.toLowerCase() === topic.toLowerCase();
                return (
                  <div
                    key={topic}
                    onClick={() => {
                      sound.playClick();
                      updateConfig({
                        selectedCategory: topic,
                        gameMode: config.gameMode === 'endless' ? 'topic' : config.gameMode,
                      });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif font-bold border transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] shadow-[2px_2px_0px_0px_#1A1A1A]'
                        : 'border-[#1A1A1A]/40 text-[#1A1A1A] bg-transparent hover:border-[#1A1A1A] hover:bg-[#1A1A1A]/5'
                    }`}
                  >
                    <BookOpen className="w-3 h-3 shrink-0 opacity-70" />
                    <span>{topic}</span>
                    {isSelected && (
                      <span className="text-[8px] uppercase font-mono font-bold border border-[#F9F7F2] px-1">
                        Выбрано
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveCustomTopic(topic, e)}
                      title="Удалить эту тему из сохраненных"
                      className={`ml-1 p-0.5 opacity-40 group-hover:opacity-100 hover:text-red-500 transition-opacity ${
                        isSelected ? 'text-[#F9F7F2] hover:text-red-300' : 'text-[#1A1A1A] hover:text-red-600'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Curated Categories Chips */}
        <div className="space-y-2 pt-1 border-t border-[#1A1A1A]/10">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#1A1A1A]/60">
            <span>Популярные разделы русской Википедии:</span>
            {config.selectedCategory !== 'all' && (
              <button
                onClick={() => {
                  sound.playClick();
                  updateConfig({ selectedCategory: 'all' });
                }}
                className="underline hover:text-[#1A1A1A]"
              >
                Сбросить на «Все категории»
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                sound.playClick();
                updateConfig({ selectedCategory: 'all' });
              }}
              className={`px-3 py-1.5 text-xs font-serif font-bold border transition-all ${
                config.selectedCategory === 'all'
                  ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                  : 'border-[#1A1A1A]/30 text-[#1A1A1A] hover:border-[#1A1A1A]'
              }`}
            >
              🌐 Все категории (Энциклопедический микс)
            </button>
            {categories.map((c) => {
              const isSelected = config.selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    sound.playClick();
                    updateConfig({
                      selectedCategory: c.id,
                      gameMode: config.gameMode === 'endless' ? 'topic' : config.gameMode,
                    });
                  }}
                  className={`px-3 py-1.5 text-xs font-serif font-bold border transition-all ${
                    isSelected
                      ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2]'
                      : 'border-[#1A1A1A]/30 text-[#1A1A1A] hover:border-[#1A1A1A]'
                  }`}
                  title={c.description}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  )}

      {/* Summary Blueprint & Master Start Button */}
      <div className="border-2 border-[#1A1A1A] bg-[#1A1A1A] text-[#F9F7F2] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[6px_6px_0px_0px_#1A1A1A]/20">
        <div className="space-y-2">
          <span className="text-[9px] uppercase tracking-[0.25em] font-mono font-bold text-[#F9F7F2]/70 block">
            Сводка конфигурации раунда
          </span>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {config.engineSource === 'chgk' ? (
              <>
                <span className="px-2.5 py-1 bg-[#F9F7F2] text-[#1A1A1A] font-bold uppercase">
                  🦉 Что? Где? Когда? (db.chgk.info)
                </span>
                <span className="px-2.5 py-1 border border-[#F9F7F2]/40 text-[#F9F7F2] font-bold">
                  {(config.chgkTimerEnabled ?? true) ? '⏱️ С часами (60 сек)' : '⏳ Без часов (без лимита)'}
                </span>
                <span className="px-2.5 py-1 border border-[#F9F7F2]/40 text-[#F9F7F2] font-bold truncate max-w-[280px]">
                  {chgkTournaments.find((t) => t.id === (config.chgkTournamentId || 'random'))?.title || 'Случайный пакет'}
                </span>
                <span className="px-2.5 py-1 border border-[#F9F7F2]/40 text-[#F9F7F2] font-bold">
                  Ввод знатоков
                </span>
                <span className="px-2.5 py-1 border border-[#F9F7F2]/40 text-[#F9F7F2] font-bold">
                  {config.chgkFilterHandouts === 'text_only' ? '📄 Только текст' : '🖼️ С раздатками'}
                </span>
              </>
            ) : (
              <>
                <span className="px-2.5 py-1 bg-[#F9F7F2] text-[#1A1A1A] font-bold uppercase">
                  {gameModes.find((m) => m.id === config.gameMode)?.label || config.gameMode}
                </span>
                <span className="px-2.5 py-1 border border-[#F9F7F2]/40 text-[#F9F7F2] font-bold">
                  Сложность: {difficultyLevels.find((d) => d.id === config.difficulty)?.label || config.difficulty}
                </span>
                <span className="px-2.5 py-1 border border-[#F9F7F2]/40 text-[#F9F7F2] font-bold">
                  Формат: {formatOptions.find((f) => f.id === config.formatFilter)?.label || config.formatFilter}
                </span>
                <span className="px-2.5 py-1 border border-[#F9F7F2]/40 text-[#F9F7F2] font-bold">
                  Тема: {config.selectedCategory === 'all' ? 'Все разделы' : config.selectedCategory}
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-[#F9F7F2]/70 font-sans mt-1">
            Игрок: <strong className="text-[#F9F7F2]">{activeProfile.name}</strong> • Опыт:{' '}
            <strong className="text-[#F9F7F2]">{activeProfile.stats.xp} XP</strong>
          </p>
        </div>

        <button
          id="start-round-btn-bottom"
          onClick={() => {
            sound.playClick();
            onStartRound();
          }}
          disabled={isLoading}
          className="w-full md:w-auto px-10 py-5 bg-[#F9F7F2] text-[#1A1A1A] hover:bg-[#E5E1D8] font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shrink-0 font-sans cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Запустить викторину</span>
        </button>
      </div>
    </div>
  );
};
