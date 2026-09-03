import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import { comprehensiveFallbackQuestions } from './server/fallbackQuestions';
import { WikiQuestion } from './src/types';
import { questionGrowthJob } from './server/questionGrowthJob';
import {
  initializeChgkCatalog,
  CHGK_TOURNAMENTS,
  getChgkQuestions,
} from './server/chgkService';
import db from './server/db';

dotenv.config();

const PORT = 3000;

// Daily AI budget cap from environment variable (default: 700)
const MAX_DAILY_AI_CALLS = parseInt(process.env.MAX_DAILY_AI_CALLS || '700', 10);

// Helper to get current calendar date in US Pacific Time (America/Los_Angeles, e.g. '2026-09-01')
// Guarantees daily quota counter resets strictly at midnight Pacific Time
function getPacificDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

// In-memory tracker for daily AI calls, automatically resetting at midnight Pacific Time
interface DailyAiTracker {
  date: string; // 'YYYY-MM-DD' in America/Los_Angeles
  count: number;
}
let dailyAiUsage: DailyAiTracker = {
  date: getPacificDateString(),
  count: 0,
};

// In-memory pregenerated question bank
let pregeneratedBank: WikiQuestion[] = [];
function loadPregeneratedBank() {
  try {
    const rows = db.prepare('SELECT * FROM generated_questions').all() as any[];
    pregeneratedBank = rows.map((row) => {
      let options: string[] | undefined = undefined;
      if (row.options_json) {
        try {
          const parsed = JSON.parse(row.options_json);
          options = Array.isArray(parsed) ? parsed : undefined;
        } catch {
          options = undefined;
        }
      }

      let acceptableAnswers: string[] | undefined = undefined;
      if (row.acceptableAnswers_json) {
        try {
          const parsed = JSON.parse(row.acceptableAnswers_json);
          acceptableAnswers = Array.isArray(parsed) ? parsed : undefined;
        } catch {
          acceptableAnswers = undefined;
        }
      }

      const q: WikiQuestion = {
        id: row.id,
        question: row.question,
        type: row.type || 'multiple_choice',
        options,
        correctAnswer: row.correctAnswer,
        acceptableAnswers,
        explanation: row.explanation || '',
        articleTitle: row.articleTitle || '',
        articleUrl: row.articleUrl || '',
        articleExtract: row.articleExtract || undefined,
        thumbnailUrl: row.thumbnailUrl || undefined,
        difficulty: row.difficulty || 'medium',
        category: row.category || '',
        pageviews: row.pageviews ?? undefined,
        popularityLabel: row.popularityLabel || undefined,
        popularityTier: row.popularityTier || undefined,
        generatedAt: row.generatedAt ?? undefined,
      };
      return q;
    });
    console.log(`[Question Bank] Loaded ${pregeneratedBank.length} pregenerated questions from SQLite database.`);
  } catch (err) {
    console.error('[Question Bank] Failed to load generated_questions from SQLite:', err);
    pregeneratedBank = [];
  }
}
loadPregeneratedBank();

// Lazy initialization of Gemini client with server key
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Request AI helper: supports BYOK (Bring Your Own Key) and enforces server daily budget cap
function getAiClientForRequest(req: express.Request): {
  ai: GoogleGenAI | null;
  isCustomKey: boolean;
  quotaExceeded: boolean;
  dailyCount: number;
  maxDaily: number;
} {
  const userApiKey = req.headers['x-user-api-key'];
  if (typeof userApiKey === 'string' && userApiKey.trim().length > 10) {
    try {
      const customAi = new GoogleGenAI({
        apiKey: userApiKey.trim(),
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build-byok',
          },
        },
      });
      return {
        ai: customAi,
        isCustomKey: true,
        quotaExceeded: false,
        dailyCount: dailyAiUsage.count,
        maxDaily: MAX_DAILY_AI_CALLS,
      };
    } catch {
      // Fall through to server key if custom initialization fails
    }
  }

  // Check and reset daily counter if date changed (Pacific Time)
  const today = getPacificDateString();
  if (dailyAiUsage.date !== today) {
    dailyAiUsage = { date: today, count: 0 };
  }

  if (dailyAiUsage.count >= MAX_DAILY_AI_CALLS) {
    console.warn(`[AI Quota] Daily limit of ${MAX_DAILY_AI_CALLS} reached for ${today} (PT). Falling back to rule-based evaluation.`);
    return {
      ai: null,
      isCustomKey: false,
      quotaExceeded: true,
      dailyCount: dailyAiUsage.count,
      maxDaily: MAX_DAILY_AI_CALLS,
    };
  }

  const serverAi = getGemini();
  return {
    ai: serverAi,
    isCustomKey: false,
    quotaExceeded: false,
    dailyCount: dailyAiUsage.count,
    maxDaily: MAX_DAILY_AI_CALLS,
  };
}

// Record successful live AI call to maintain quota
function recordAiUsage(isCustomKey: boolean) {
  if (!isCustomKey) {
    const today = getPacificDateString();
    if (dailyAiUsage.date !== today) {
      dailyAiUsage = { date: today, count: 1 };
    } else {
      dailyAiUsage.count++;
    }
    console.log(`[AI Quota - PT] Live AI call #${dailyAiUsage.count}/${MAX_DAILY_AI_CALLS} recorded for ${dailyAiUsage.date} (America/Los_Angeles)`);
  }
}

// Supported Gemini models prioritizing gemini-2.5-flash-lite (highest free-tier daily quota)
const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

// Helper to execute generateContent with multi-model fallback and backoff retry
async function generateWithGeminiRetry(
  ai: GoogleGenAI,
  prompt: string,
  schemaConfig?: unknown
): Promise<string | null> {
  for (const modelName of GEMINI_MODELS) {
    try {
      const callPromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: schemaConfig as never,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Model call timeout')), 12000)
      );

      const response = await Promise.race([callPromise, timeoutPromise]);
      const text = response.text?.trim();
      if (text) {
        return text;
      }
    } catch {
      // Seamlessly proceed to next model in list
      continue;
    }
  }

  return null;
}

// Fisher-Yates shuffle helper for true uniform randomness
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Append newly generated questions to pregeneratedBank and persist to SQLite
function appendToPregeneratedBank(newQuestions: WikiQuestion[]) {
  if (!newQuestions || newQuestions.length === 0) return;
  try {
    const existingTitles = new Set(pregeneratedBank.map((q) => normalizeTopicString(q.articleTitle)));
    const existingQuestions = new Set(pregeneratedBank.map((q) => normalizeTopicString(q.question)));
    const toAdd: WikiQuestion[] = [];

    for (const q of newQuestions) {
      const normT = normalizeTopicString(q.articleTitle);
      const normQ = normalizeTopicString(q.question);
      if (normT && normQ && !existingTitles.has(normT) && !existingQuestions.has(normQ)) {
        existingTitles.add(normT);
        existingQuestions.add(normQ);
        toAdd.push(q);
      }
    }

    if (toAdd.length > 0) {
      pregeneratedBank.push(...toAdd);

      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO generated_questions (
          id, question, type, options_json, correctAnswer, acceptableAnswers_json,
          explanation, articleTitle, articleUrl, articleExtract, thumbnailUrl,
          difficulty, category, pageviews, popularityLabel, popularityTier,
          generatedAt, normalizedQuestion
        ) VALUES (
          @id, @question, @type, @options_json, @correctAnswer, @acceptableAnswers_json,
          @explanation, @articleTitle, @articleUrl, @articleExtract, @thumbnailUrl,
          @difficulty, @category, @pageviews, @popularityLabel, @popularityTier,
          @generatedAt, @normalizedQuestion
        )
      `);

      const insertTransaction = db.transaction((items: WikiQuestion[]) => {
        for (const q of items) {
          const norm = (q.question || '').toLowerCase().trim();
          insertStmt.run({
            id: q.id,
            question: q.question,
            type: q.type || 'multiple_choice',
            options_json: JSON.stringify(q.options || []),
            correctAnswer: q.correctAnswer,
            acceptableAnswers_json: JSON.stringify(q.acceptableAnswers || []),
            explanation: q.explanation ?? null,
            articleTitle: q.articleTitle ?? null,
            articleUrl: q.articleUrl ?? null,
            articleExtract: q.articleExtract ?? null,
            thumbnailUrl: q.thumbnailUrl ?? null,
            difficulty: q.difficulty ?? null,
            category: q.category ?? null,
            pageviews: q.pageviews ?? null,
            popularityLabel: q.popularityLabel ?? null,
            popularityTier: q.popularityTier ?? null,
            generatedAt: q.generatedAt ?? Date.now(),
            normalizedQuestion: norm,
          });
        }
      });

      insertTransaction(toAdd);
      console.log(`[Question Bank] Saved ${toAdd.length} fresh generated questions to SQLite database. Total bank size: ${pregeneratedBank.length}`);
    }
  } catch (err) {
    console.error('[Question Bank] Failed to append new questions:', err);
  }
}

// Normalize strings for reliable deduplication comparison
function normalizeTopicString(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[«»"'.,!?:;()[\]{}]/g, '')
    .trim();
}

// Russian Stop Words & Filler Words to prevent false positive leak detections
const RUSSIAN_STOP_WORDS = new Set([
  'в', 'на', 'с', 'по', 'из', 'о', 'об', 'от', 'до', 'к', 'за', 'при', 'для', 'у', 'под', 'над', 'перед', 'со', 'ко',
  'как', 'кто', 'что', 'где', 'когда', 'какой', 'какая', 'какое', 'какие', 'каком', 'какую', 'каких', 'каким', 'какими', 'какого', 'какому',
  'чем', 'кому', 'чему', 'кем', 'кого', 'чего', 'ком', 'чём',
  'это', 'этот', 'эта', 'эти', 'этом', 'этих', 'этой', 'этого', 'этому', 'этим', 'этими', 'тот', 'та', 'то', 'те',
  'год', 'года', 'году', 'годов', 'годе', 'годах', 'век', 'века', 'веке', 'веков', 'веках',
  'первый', 'первая', 'первое', 'первые', 'первого', 'первому', 'первым', 'первом',
  'второй', 'третий', 'один', 'одна', 'одно', 'одни', 'два', 'три', 'четыре', 'пять',
  'все', 'весь', 'вся', 'всё', 'всей', 'всех', 'всего', 'всему', 'всем', 'всеми',
  'был', 'была', 'было', 'были', 'быть', 'стал', 'стала', 'стало', 'стали',
  'назван', 'названа', 'названо', 'названы', 'название', 'названия', 'названии',
  'является', 'являлся', 'являлась', 'являлось', 'являются',
  'самый', 'самая', 'самое', 'самые', 'самым', 'самой', 'самых', 'самого', 'самому',
  'также', 'тоже', 'после', 'через', 'между', 'около', 'время', 'времени',
  'город', 'страна', 'река', 'море', 'остров', 'книга', 'фильм', 'роман', 'автор', 'ученый', 'учёный',
  'человек', 'объект', 'явление', 'процесс', 'элемент', 'планета', 'звезда', 'закон', 'теория', 'принцип',
  'орган', 'часть', 'вид', 'форма', 'тип', 'группа', 'число', 'метр', 'километр', 'градус', 'секунда', 'минута', 'час',
  'а', 'но', 'и', 'или', 'да', 'нет', 'не', 'ни', 'же', 'ли', 'бы', 'то'
]);

// Strip common Russian inflectional endings to get a stem for comparison
function extractRussianStem(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/g, '');
  if (w.length <= 3) return w;

  return w
    .replace(/(ейший|ейшая|ейшее|ейшие|ейшего|ейшему|ейшим|ейшем)$/, '')
    .replace(/(ческий|ческая|ческое|ческие|ческого|ческому|ческом|ческих|ческими)$/, '')
    .replace(/(овский|овская|овское|овские|овского|овскому|овском|овских|овскими)$/, '')
    .replace(/(евский|евская|евское|евские|евского|евскому|евском|евских|евскими)$/, '')
    .replace(/(инский|инская|инское|инские|инского|инскому|инском|инских|инскими)$/, '')
    .replace(/(ирован|ировал|ировать|ированная|ированное|ированные)$/, '')
    .replace(/(истый|истая|истое|истые|истого|истому|истом|истых)$/, '')
    .replace(/(ский|ская|ское|ские|ского|скому|ском|ских|скими)$/, '')
    .replace(/(ный|ная|ное|ные|ного|ному|ном|ных|ными|ным|ной)$/, '')
    .replace(/(ый|ий|ая|яя|ое|ее|ые|ие|ого|его|ому|ему|ым|им|ом|ем|ой|ей|ью|ых|их|ами|ями|ях|ах)$/, '')
    .replace(/(ов|ев|ей|ам|ям|а|я|у|ю|е|и|ы|о)$/, '');
}

// Check if a question leaks the answer or key stems of the answer
function detectAnswerLeak(
  question: string,
  correctAnswer: string,
  acceptableAnswers?: string[]
): { hasLeak: boolean; leakingToken?: string; reason?: string } {
  if (!question || !correctAnswer) return { hasLeak: false };

  const normalizedQuestion = question.toLowerCase().replace(/ё/g, 'е');
  const questionWords = normalizedQuestion
    .replace(/[«»"'.,!?:;()[\]{}\-\/\\—–]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const questionStems = questionWords
    .filter((w) => !RUSSIAN_STOP_WORDS.has(w) && w.length >= 3)
    .map((w) => ({ word: w, stem: extractRussianStem(w) }));

  const answerPhrases = [correctAnswer, ...(acceptableAnswers || [])];

  for (const phrase of answerPhrases) {
    if (!phrase) continue;
    const cleanPhrase = phrase.toLowerCase().replace(/ё/g, 'е').trim();

    // 1. Direct multi-word phrase check
    const cleanNoPunct = cleanPhrase.replace(/[«»"'.,!?:;()[\]{}\-\/\\—–]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanNoPunct.length >= 4 && !RUSSIAN_STOP_WORDS.has(cleanNoPunct)) {
      const cleanQNoPunct = ` ${normalizedQuestion.replace(/[«»"'.,!?:;()[\]{}\-\/\\—–]/g, ' ').replace(/\s+/g, ' ')} `;
      if (cleanQNoPunct.includes(` ${cleanNoPunct} `)) {
        return {
          hasLeak: true,
          leakingToken: cleanNoPunct,
          reason: `Exact answer phrase "${cleanNoPunct}" was found in question text.`,
        };
      }
    }

    // 2. Token & stem comparison
    const answerTokens = cleanPhrase
      .replace(/[«»"'.,!?:;()[\]{}\-\/\\—–]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !RUSSIAN_STOP_WORDS.has(w));

    for (const token of answerTokens) {
      if (/^\d+$/.test(token)) {
        const numRegex = new RegExp(`\\b${token}\\b`);
        if (numRegex.test(normalizedQuestion)) {
          return {
            hasLeak: true,
            leakingToken: token,
            reason: `Numeric token "${token}" was found in question text.`,
          };
        }
        continue;
      }

      // Check direct word match
      const exactWordMatch = questionWords.find(
        (qw) => qw === token && !RUSSIAN_STOP_WORDS.has(qw)
      );
      if (exactWordMatch) {
        return {
          hasLeak: true,
          leakingToken: token,
          reason: `Direct answer word "${token}" was found in question text.`,
        };
      }

      // Check root stem matching
      const answerStem = extractRussianStem(token);
      if (answerStem.length >= 4 && !RUSSIAN_STOP_WORDS.has(answerStem)) {
        for (const qs of questionStems) {
          if (qs.word === token) {
            return {
              hasLeak: true,
              leakingToken: token,
              reason: `Direct word match "${token}".`,
            };
          }

          if (
            (qs.stem.length >= 4 && (qs.stem === answerStem || qs.stem.startsWith(answerStem) || answerStem.startsWith(qs.stem))) ||
            (qs.word.length >= 5 && qs.word.includes(answerStem))
          ) {
            if (qs.stem.length >= 4 && answerStem.length >= 4) {
              return {
                hasLeak: true,
                leakingToken: token,
                reason: `Root stem "${answerStem}" of answer "${token}" matches word "${qs.word}" in question.`,
              };
            }
          }
        }
      }
    }
  }

  return { hasLeak: false };
}

// Topic Registry for multilingual synonym mapping and targeted Russian Wikipedia queries
interface TopicDefinition {
  canonicalName: string;
  synonyms: string[];
  wikiSearchQueries: string[];
}

const TOPIC_REGISTRY: TopicDefinition[] = [
  {
    canonicalName: 'Видеоигры',
    synonyms: ['videogames', 'video games', 'videogame', 'video game', 'видеоигры', 'игры', 'гейминг', 'gaming', 'компьютерные игры', 'геймдев', 'game dev', 'consoles', 'консоли', 'playstation', 'nintendo', 'xbox', 'steam'],
    wikiSearchQueries: [
      'Культовые видеоигры', 'История компьютерных игр', 'Индустрия компьютерных игр', 'Игровая приставка',
      'Киберспорт', 'Шутер от первого лица', 'Ролевая игра (видеоигры)', 'Nintendo', 'Valve',
      'Blizzard Entertainment', 'PlayStation', 'Xbox', 'Minecraft', 'The Witcher (серия игр)',
      'Grand Theft Auto', 'Half-Life (серия игр)', 'The Legend of Zelda', 'Стратегия в реальном времени'
    ],
  },
  {
    canonicalName: 'Кино',
    synonyms: ['cinema', 'movies', 'movie', 'films', 'film', 'кино', 'фильмы', 'кинематограф', 'актеры', 'режиссеры', 'голливуд', 'театр'],
    wikiSearchQueries: [
      'Кинематограф', 'История кино', 'Шедевры мирового кино', 'Режиссёр', 'Премия Оскар',
      'Советский кинематограф', 'Золотой век Голливуда', 'Каннский кинофестиваль', 'Научно-фантастический фильм',
      'Французская новая волна', 'Кинотрилогия', 'Фильм-нуар', 'Анимация', 'Культовый фильм'
    ],
  },
  {
    canonicalName: 'Космос',
    synonyms: ['space', 'astronomy', 'universe', 'космос', 'астрономия', 'вселенная', 'планеты', 'космонавтика', 'галактики', 'звезды'],
    wikiSearchQueries: [
      'Солнечная система', 'Астрономия', 'Космонавтика', 'Галактика Млечный Путь', 'Черная дыра',
      'Пилотируемая космонавтика', 'Программа Аполлон', 'Международная космическая станция',
      'Сверхновая звезда', 'Марсоход', 'Космический телескоп Хаббл', 'Джеймс Уэбб (телескоп)',
      'Квазар', 'Нейтронная звезда', 'Планеты земной группы', 'Экзопланета', 'Туманность'
    ],
  },
  {
    canonicalName: 'История',
    synonyms: ['history', 'история', 'исторический', 'древний мир', 'средневековье', 'войны', 'эпохи', 'правители', 'империи'],
    wikiSearchQueries: [
      'История России', 'Всемирная история', 'Древний Рим', 'Древняя Греция', 'Средние века',
      'Эпоха Возрождения', 'Великая Отечественная война', 'Российская империя', 'СССР',
      'Французская революция', 'Византийская империя', 'Семилетняя война', 'Эпоха великих географических открытий',
      'Древний Египет', 'Первая мировая война', 'Реформация', 'Крестовые походы', 'Киевская Русь'
    ],
  },
  {
    canonicalName: 'Наука',
    synonyms: ['science', 'physics', 'chemistry', 'math', 'наука', 'физика', 'химия', 'математика', 'открытия', 'изобретения', 'технологии'],
    wikiSearchQueries: [
      'История науки', 'Квантовая механика', 'Периодическая система химических элементов',
      'Теория относительности', 'Генетика', 'Нобелевская премия', 'Астрофизика', 'Электродинамика',
      'Органическая химия', 'Математический анализ', 'Искусственный интеллект', 'Термодинамика',
      'Теория струн', 'Эволюционная биология', 'Нанотехнологии'
    ],
  },
  {
    canonicalName: 'География',
    synonyms: ['geography', 'countries', 'capitals', 'география', 'страны', 'города', 'столицы', 'океаны', 'горы', 'карты'],
    wikiSearchQueries: [
      'Столицы государств', 'Крупнейшие реки мира', 'Горные системы', 'Озёра мира', 'Океаны',
      'Острова мира', 'Пустыни мира', 'Моря России', 'Вулканы Земли', 'Географические открытия',
      'Проливы мира', 'Фьорд', 'Государства мира', 'Географические полюса', 'Архипелаг', 'Водопады'
    ],
  },
  {
    canonicalName: 'Литература',
    synonyms: ['literature', 'books', 'writers', 'литература', 'книги', 'писатели', 'романы', 'поэзия', 'поэты'],
    wikiSearchQueries: [
      'Русская классическая литература', 'Зарубежная классическая литература', 'Поэзия Серебряного века',
      'Научная фантастика', 'Нобелевская премия по литературе', 'Драматургия', 'Романтизм в литературе',
      'Реализм в литературе', 'Антиутопия', 'Сказки народов мира', 'Золотой век русской литературы',
      'Эпос', 'Эпоха Просвещения', 'Детективный роман'
    ],
  },
  {
    canonicalName: 'Биология',
    synonyms: ['biology', 'animals', 'plants', 'nature', 'биология', 'животные', 'растения', 'природа', 'эволюция', 'анатомия', 'медицина'],
    wikiSearchQueries: [
      'Теория эволюции', 'Млекопитающие', 'Царство Растения', 'Анатомия человека', 'Генетический код',
      'Экология', 'Микробиология', 'Орнитология', 'Царство Грибы', 'Энтомология', 'Морская биология',
      'Физиология человека', 'Клетка (биология)', 'Фотосинтез'
    ],
  },
  {
    canonicalName: 'Искусство',
    synonyms: ['art', 'painting', 'sculpture', 'искусство', 'живопись', 'художники', 'скульптура', 'музеи', 'архитектура'],
    wikiSearchQueries: [
      'История живописи', 'Шедевры искусства', 'Эрмитаж', 'Импрессионизм', 'Архитектура барокко',
      'Скульптура', 'Русский авангард', 'Ренессанс', 'Сюрреализм', 'Лувр', 'Третьяковская галерея',
      'Модернизм', 'Готическая архитектура'
    ],
  },
  {
    canonicalName: 'Спорт',
    synonyms: ['sport', 'sports', 'football', 'olympics', 'спорт', 'футбол', 'олимпийские игры', 'чемпионаты', 'хоккей', 'баскетбол'],
    wikiSearchQueries: [
      'Олимпийские игры', 'Чемпионат мира по футболу', 'История спорта', 'Легкая атлетика',
      'Хоккей с шайбой', 'Баскетбол', 'Формула-1', 'Шахматы', 'Теннис', 'Зимние Олимпийские игры',
      'Рекорды в спорте', 'Плавание (спорт)', 'Биатлон'
    ],
  },
  {
    canonicalName: 'Мифология',
    synonyms: ['mythology', 'myths', 'legends', 'мифология', 'мифы', 'легенды', 'боги', 'фольклор', 'сказания'],
    wikiSearchQueries: [
      'Древнегреческая мифология', 'Скандинавская мифология', 'Славянская мифология', 'Египетская мифология',
      'Кельтская мифология', 'Мифические существа', 'Индуистская мифология', 'Японская мифология',
      'Пантеон богов', 'Легенды о короле Артуре', 'Эпос о Гильгамеше'
    ],
  },
];

// Helper to resolve user topic inputs (including English and localized terms)
function resolveTopic(inputTopic?: string): { isAll: boolean; canonicalName: string; searchQueries: string[] } {
  if (!inputTopic || inputTopic === 'all' || inputTopic === 'Случайная' || inputTopic.trim() === '') {
    return { isAll: true, canonicalName: 'all', searchQueries: [] };
  }

  const rawLower = inputTopic.toLowerCase().trim();

  // Find exact match or synonym in registry
  for (const reg of TOPIC_REGISTRY) {
    if (reg.canonicalName.toLowerCase() === rawLower) {
      return { isAll: false, canonicalName: reg.canonicalName, searchQueries: reg.wikiSearchQueries };
    }
    for (const syn of reg.synonyms) {
      if (syn === rawLower || rawLower.includes(syn) || syn.includes(rawLower)) {
        return { isAll: false, canonicalName: reg.canonicalName, searchQueries: reg.wikiSearchQueries };
      }
    }
  }

  // Custom user topic (e.g. "Древний Рим", "Гарри Поттер", "Аниме", etc.)
  return {
    isAll: false,
    canonicalName: inputTopic.trim(),
    searchQueries: [inputTopic.trim(), `${inputTopic.trim()} в культуре`, `История ${inputTopic.trim()}`],
  };
}

// Check if a question is related to any excluded title (strict matching without destructive substring false-positives)
function isQuestionExcluded(
  q: { articleTitle: string; question: string; correctAnswer: string },
  excludeTitles: string[]
): boolean {
  if (!excludeTitles || excludeTitles.length === 0) return false;

  const cleanTitle = normalizeTopicString(q.articleTitle);
  const cleanQ = normalizeTopicString(q.question);
  const cleanAns = normalizeTopicString(q.correctAnswer);

  for (const exc of excludeTitles) {
    const cleanExc = normalizeTopicString(exc);
    if (!cleanExc || cleanExc.length < 2) continue;

    // 1. Exact match with article title
    if (cleanTitle === cleanExc) return true;

    // 2. Exact match with question text
    if (cleanQ === cleanExc) return true;

    // 3. Exact match with correct answer
    if (cleanAns === cleanExc) return true;

    // 4. Substantial prefix or suffix match on title (at least 5 characters)
    if (cleanExc.length >= 5) {
      if (cleanTitle.startsWith(cleanExc) || cleanTitle.endsWith(cleanExc)) {
        return true;
      }
    }
  }

  return false;
}

// Fetch genuine Russian Wikipedia random articles or topic search with popularity rating & safe timeout
const DIVERSE_SEARCH_DOMAINS = [
  'История мира',
  'Физика',
  'Астрономия и космонавтика',
  'Биология и животные',
  'Классическая литература',
  'Живопись и художники',
  'Архитектурные памятники',
  'Химия и элементы',
  'Мифология народов мира',
  'Кинематограф и режиссеры',
  'Столицы и страны мира',
  'Великие изобретения',
  'Музыка и композиторы',
  'Анатомия человека',
  'Компьютерные игры',
  'Древний мир',
  'Океаны и моря',
  'Спорт и олимпийские игры',
];

interface WikiFetchedArticle {
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
  pageviews: number;
  popularityTier: 'top_tier' | 'high' | 'medium' | 'niche';
  popularityLabel: string;
}

async function fetchWikiArticles(
  category?: string,
  count: number = 3,
  excludeTitles: string[] = [],
  difficulty: string = 'medium'
): Promise<WikiFetchedArticle[]> {
  const articles: WikiFetchedArticle[] = [];

  try {
    const resolved = resolveTopic(category);
    const isAllOrRandom = resolved.isAll;

    // Pick distinct queries with true randomization
    let queries: string[] = [];
    if (isAllOrRandom) {
      queries = shuffleArray(DIVERSE_SEARCH_DOMAINS).slice(0, Math.max(count, 3));
    } else {
      queries = shuffleArray(resolved.searchQueries).slice(0, Math.max(count, 3));
    }

    for (const q of queries) {
      try {
        const searchTerms = encodeURIComponent(q);
        const limit = isAllOrRandom ? 4 : Math.max(count * 2, 6);
        const randomOffset = Math.floor(Math.random() * 8);
        const wikiApiUrl = `https://ru.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${searchTerms}&gsroffset=${randomOffset}&gsrlimit=${limit}&prop=extracts|pageimages|info|pageviews&inprop=url&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=500&pvipdays=30&format=json&origin=*`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const res = await fetch(wikiApiUrl, {
          headers: {
            'User-Agent': 'WikiQuizRussianApp/1.0 (https://ai.studio; mailto:contact@example.com)',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const pages = data.query?.pages;
          if (pages) {
            for (const key of Object.keys(pages)) {
              const p = pages[key];
              if (
                p.extract &&
                p.extract.length > 80 &&
                !p.title.includes('Список') &&
                !p.title.includes('Категория:')
              ) {
                // Ensure article isn't in exclusion list
                if (!isQuestionExcluded({ articleTitle: p.title, question: '', correctAnswer: '' }, excludeTitles)) {
                  // Compute 30-day pageviews count
                  let monthlyViews = 0;
                  if (p.pageviews && typeof p.pageviews === 'object') {
                    const viewValues = Object.values(p.pageviews as Record<string, unknown>);
                    monthlyViews = viewValues.reduce<number>(
                      (sum, val) => sum + (typeof val === 'number' ? val : Number(val) || 0),
                      0
                    );
                  }

                  // Determine popularity tier and friendly label
                  let popularityTier: 'top_tier' | 'high' | 'medium' | 'niche' = 'medium';
                  let popularityLabel = 'Умеренная известность';

                  if (monthlyViews >= 15000) {
                    popularityTier = 'top_tier';
                    popularityLabel = `Топ-статья Википедии (~${Math.round(monthlyViews / 1000)}k просм/мес)`;
                  } else if (monthlyViews >= 4000) {
                    popularityTier = 'high';
                    popularityLabel = `Высокая популярность (~${Math.round(monthlyViews / 1000)}k просм/мес)`;
                  } else if (monthlyViews >= 1000) {
                    popularityTier = 'medium';
                    popularityLabel = `Средняя известность (~${monthlyViews} просм/мес)`;
                  } else {
                    popularityTier = 'niche';
                    popularityLabel = 'Специализированная статья';
                  }

                  articles.push({
                    title: p.title,
                    extract: p.extract.slice(0, 1000),
                    url: p.fullurl || `https://ru.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
                    thumbnail: p.thumbnail?.source,
                    pageviews: monthlyViews,
                    popularityTier,
                    popularityLabel,
                  });
                }
              }
            }
          }
        }
      } catch {
        // Continue to next domain query
      }
    }

    // Sort articles to match difficulty calibration:
    // Easy: prioritize top_tier / highest views
    // Medium: balanced high / medium views
    // Hard: medium / niche views
    // Expert: specialized depth
    if (articles.length > 1) {
      if (difficulty === 'easy') {
        articles.sort((a, b) => b.pageviews - a.pageviews);
      } else if (difficulty === 'medium') {
        // Mix top and high articles
        articles.sort((a, b) => 0.5 - Math.random());
      } else if (difficulty === 'hard') {
        articles.sort((a, b) => a.pageviews - b.pageviews);
      }
    }
  } catch {
    // Gracefully handle network timeouts without throwing
  }

  return articles;
}

// Function to ensure exactly 4 valid multiple-choice options with the correct answer
function ensureMultipleChoiceOptions(
  correctAnswer: string,
  category: string,
  existingOptions?: string[]
): string[] {
  let opts: string[] = [];
  if (existingOptions && Array.isArray(existingOptions)) {
    opts = existingOptions.map((o) => String(o || '').trim()).filter((o) => o.length > 0);
  }

  // Ensure correct answer is included
  if (!opts.some((o) => o.toLowerCase() === correctAnswer.toLowerCase())) {
    opts.unshift(correctAnswer);
  }

  // Remove duplicates while keeping case
  const seen = new Set<string>();
  const uniqueOpts: string[] = [];
  for (const o of opts) {
    const lower = o.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueOpts.push(o);
    }
  }

  // If we already have 4 or more options, return first 4 shuffled
  if (uniqueOpts.length >= 4) {
    return uniqueOpts.slice(0, 4).sort(() => 0.5 - Math.random());
  }

  // Look in the curated questions pool for options belonging to the exact same category
  const matchingQuestions = [...comprehensiveFallbackQuestions, ...pregeneratedBank].filter(
    (q) => q.category === category && q.correctAnswer.toLowerCase() !== correctAnswer.toLowerCase()
  );

  for (const c of matchingQuestions) {
    if (uniqueOpts.length >= 4) break;
    if (c.options && Array.isArray(c.options)) {
      for (const opt of c.options) {
        if (uniqueOpts.length >= 4) break;
        const optClean = opt.trim();
        if (optClean && !seen.has(optClean.toLowerCase()) && optClean.toLowerCase() !== correctAnswer.toLowerCase()) {
          seen.add(optClean.toLowerCase());
          uniqueOpts.push(optClean);
        }
      }
    }
  }

  // Fallback if somehow still not 4
  const backupDistractors = ['Альтернативный вариант', 'Другой вариант', 'Дополнительный вариант'];
  for (const backup of backupDistractors) {
    if (uniqueOpts.length >= 4) break;
    if (!seen.has(backup.toLowerCase())) {
      seen.add(backup.toLowerCase());
      uniqueOpts.push(backup);
    }
  }

  return uniqueOpts.slice(0, 4).sort(() => 0.5 - Math.random());
}

// Function to strictly convert any question to the requested format (multiple_choice or open_ended)
function formatQuestionToRequestedType(
  q: WikiQuestion,
  format: string
): WikiQuestion {
  if (format === 'multiple_choice') {
    const opts = ensureMultipleChoiceOptions(q.correctAnswer, q.category, q.options);
    return {
      ...q,
      type: 'multiple_choice',
      options: opts,
    };
  }

  if (format === 'open_ended') {
    return {
      ...q,
      type: 'open_ended',
      options: undefined,
    };
  }

  return q;
}

// Function to pick from curated questions ensuring domain diversity, strictly NO duplicates, NO answer leakage, and STRICT format and topic adherence
function getCuratedQuestions(
  category: string,
  format: string,
  difficulty: string,
  count: number,
  excludeTitles: string[] = []
): WikiQuestion[] {
  const resolved = resolveTopic(category);
  const isAll = resolved.isAll;
  const targetCategory = resolved.canonicalName;

  // Helper matching category by exact canonical label, synonym, or keyword in text
  const matchesCat = (q: typeof comprehensiveFallbackQuestions[0]) => {
    if (isAll) return true;
    const qCatLower = (q.category || '').toLowerCase();
    const targetLower = targetCategory.toLowerCase();

    if (qCatLower === targetLower || qCatLower.includes(targetLower) || targetLower.includes(qCatLower)) {
      return true;
    }

    // Check if question text, answer, or article mentions keywords of this topic
    const searchString = `${q.category} ${q.articleTitle} ${q.question} ${q.correctAnswer} ${(q.options || []).join(' ')}`.toLowerCase();
    for (const syn of resolved.searchQueries) {
      if (searchString.includes(syn.toLowerCase())) {
        return true;
      }
    }

    return false;
  };

  // Helper matching format strictly
  const matchesFormat = (qType: string) => {
    if (format === 'multiple_choice') return qType === 'multiple_choice';
    if (format === 'open_ended') return qType === 'open_ended';
    return true; // random / all
  };

  // Prioritized difficulty tiers for gradual, non-jarring adaptation:
  // Expert NEVER drops to easy/medium. Hard NEVER drops to easy. Easy NEVER elevates to hard/expert.
  const difficultyTiers = getDifficultyCandidateTiers(difficulty);
  let pool: typeof comprehensiveFallbackQuestions = [];

  // Stage 1: Try prioritized difficulty tiers with exact category and format
  for (const allowedDiffs of difficultyTiers) {
    const candidates = comprehensiveFallbackQuestions.filter((q) => {
      if (isQuestionExcluded(q, excludeTitles)) return false;
      if (detectAnswerLeak(q.question, q.correctAnswer, q.acceptableAnswers).hasLeak) return false;
      if (!matchesCat(q)) return false;
      if (!matchesFormat(q.type)) return false;
      if (!allowedDiffs.includes(q.difficulty || 'medium')) return false;
      return true;
    });

    if (candidates.length > 0) {
      pool = candidates;
      if (pool.length >= count) break;
    }
  }

  // Stage 2: If pool still insufficient for specific category, relax format within allowed difficulty tier
  if (pool.length < count) {
    for (const allowedDiffs of difficultyTiers) {
      const candidates = comprehensiveFallbackQuestions.filter((q) => {
        if (isQuestionExcluded(q, excludeTitles)) return false;
        if (detectAnswerLeak(q.question, q.correctAnswer, q.acceptableAnswers).hasLeak) return false;
        if (!matchesCat(q)) return false;
        if (!allowedDiffs.includes(q.difficulty || 'medium')) return false;
        return true;
      });
      if (candidates.length > 0) {
        pool = candidates;
        if (pool.length >= count) break;
      }
    }
  }

  // Stage 3: If 'all' was requested and pool still empty, select across categories within allowed difficulty tier
  if (pool.length === 0 && isAll) {
    for (const allowedDiffs of difficultyTiers) {
      const candidates = comprehensiveFallbackQuestions.filter((q) => {
        if (isQuestionExcluded(q, excludeTitles)) return false;
        if (detectAnswerLeak(q.question, q.correctAnswer, q.acceptableAnswers).hasLeak) return false;
        if (!matchesFormat(q.type)) return false;
        if (!allowedDiffs.includes(q.difficulty || 'medium')) return false;
        return true;
      });
      if (candidates.length > 0) {
        pool = candidates;
        break;
      }
    }
  }

  // Absolute fallback if pool is still empty
  if (pool.length === 0) {
    pool = comprehensiveFallbackQuestions;
  }

  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  const selected: typeof comprehensiveFallbackQuestions = [];
  const usedCategories = new Set<string>();

  for (const item of shuffled) {
    if (selected.length >= count) break;
    // Enforce distinct categories for variety when in 'all' mode
    if (isAll && !usedCategories.has(item.category)) {
      selected.push(item);
      usedCategories.add(item.category);
    } else if (!isAll) {
      selected.push(item);
    }
  }

  // Fill remainder if needed
  for (const item of shuffled) {
    if (selected.length >= count) break;
    if (!selected.some((s) => s.id === item.id || s.articleTitle === item.articleTitle)) {
      selected.push(item);
    }
  }

  return selected.slice(0, count).map((q) => {
    // Strictly format each item so multiple_choice always has 4 options
    const formatted = formatQuestionToRequestedType(q, format);
    return {
      ...formatted,
      id: `curated-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      category: !isAll ? targetCategory : formatted.category,
    };
  });
}

// Helper returning prioritized difficulty tiers for gradual, non-jarring adaptation
function getDifficultyCandidateTiers(requestedDifficulty: string): string[][] {
  switch (requestedDifficulty) {
    case 'expert':
      // 1. Expert only
      // 2. Hard only (never medium or easy!)
      return [['expert'], ['hard']];
    case 'hard':
      // 1. Hard only
      // 2. Expert or Medium (never easy!)
      return [['hard'], ['expert', 'medium']];
    case 'medium':
      // 1. Medium only
      // 2. Hard or Easy
      return [['medium'], ['hard', 'easy']];
    case 'easy':
      // 1. Easy only
      // 2. Medium only (never hard or expert!)
      return [['easy'], ['medium']];
    default:
      return [['easy', 'medium', 'hard', 'expert']];
  }
}

// Retrieve questions from the pregenerated question bank (data/generated-questions.json)
function getQuestionsFromBank(
  category: string = 'all',
  format: string = 'random',
  difficulty: string = 'medium',
  count: number = 1,
  excludeTitles: string[] = []
): WikiQuestion[] {
  if (pregeneratedBank.length === 0) return [];

  const excludeSet = new Set(excludeTitles.map((t) => normalizeTopicString(t)));
  const isAllCat = !category || category === 'all' || category === 'Случайные темы';
  const resolved = resolveTopic(category);
  const difficultyTiers = getDifficultyCandidateTiers(difficulty);

  let pool: WikiQuestion[] = [];

  // Filter candidates systematically using prioritized difficulty tiers
  for (const allowedDiffs of difficultyTiers) {
    const candidates = pregeneratedBank.filter((q) => {
      if (isQuestionExcluded(q, excludeTitles)) return false;
      if (excludeSet.has(normalizeTopicString(q.articleTitle))) return false;
      if (detectAnswerLeak(q.question, q.correctAnswer, q.acceptableAnswers).hasLeak) return false;

      // Category filter
      if (!isAllCat) {
        const qCatNorm = (q.category || '').toLowerCase();
        const targetNorm = resolved.canonicalName.toLowerCase();
        if (!qCatNorm.includes(targetNorm) && !targetNorm.includes(qCatNorm)) {
          return false;
        }
      }

      // Format filter
      if (format === 'multiple_choice' && q.type !== 'multiple_choice') return false;
      if (format === 'open_ended' && q.type !== 'open_ended') return false;

      // Difficulty filter adhering strictly to current tier
      if (!allowedDiffs.includes(q.difficulty || 'medium')) return false;

      return true;
    });

    if (candidates.length > 0) {
      pool = candidates;
      if (pool.length >= count) break;
    }
  }

  // Step 3: If category was 'all', ensure variety across topics
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  const selected: WikiQuestion[] = [];
  const usedCategories = new Set<string>();

  for (const item of shuffled) {
    if (selected.length >= count) break;
    if (isAllCat && item.category && !usedCategories.has(item.category)) {
      selected.push(item);
      usedCategories.add(item.category);
    } else if (!isAllCat) {
      selected.push(item);
    }
  }

  // Fill remaining slots if any
  for (const item of shuffled) {
    if (selected.length >= count) break;
    if (!selected.some((s) => s.articleTitle === item.articleTitle || s.question === item.question)) {
      selected.push(item);
    }
  }

  return selected.slice(0, count).map((q) => {
    const formatted = formatQuestionToRequestedType(q, format);
    return {
      ...formatted,
      id: `bank-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      category: !isAllCat ? resolved.canonicalName : formatted.category,
    };
  });
}

async function startServer() {
  const app = express();

  // Trust proxy for Cloud Run reverse proxy layer to ensure accurate client IP detection
  app.set('trust proxy', 1);

  app.use(express.json());

  // Health check endpoint (explicitly unmetered and served before rate limiters)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Strict rate limiter for expensive AI endpoints: /api/quiz/generate and /api/quiz/evaluate-open
  // Maximum 20 requests per IP per 5 minutes
  const aiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    message: { error: 'Слишком много запросов, попробуйте позже' },
    handler: (req, res) => {
      res.status(429).json({ error: 'Слишком много запросов, попробуйте позже' });
    },
  });

  // Softer rate limiter for other API routes: 60 requests per IP per 5 minutes
  const generalApiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    message: { error: 'Слишком много запросов, попробуйте позже' },
    handler: (req, res) => {
      res.status(429).json({ error: 'Слишком много запросов, попробуйте позже' });
    },
    skip: (req) => {
      const url = req.originalUrl || req.url || '';
      return (
        url.includes('/api/health') ||
        url.includes('/api/wiki/categories') ||
        url.includes('/api/chgk/tournaments') ||
        url.includes('/api/quiz/quota-status') ||
        url.includes('/api/quiz/generate') ||
        url.includes('/api/quiz/evaluate-open')
      );
    },
  });

  // Apply strict rate limiter to AI generation & evaluation endpoints
  app.use('/api/quiz/generate', aiLimiter);
  app.use('/api/quiz/evaluate-open', aiLimiter);

  // Apply softer rate limiter to all other /api routes
  app.use('/api', generalApiLimiter);

  // Quota status endpoint (for UI / monitoring, resetting at midnight Pacific Time)
  app.get('/api/quiz/quota-status', (req, res) => {
    const today = getPacificDateString();
    if (dailyAiUsage.date !== today) {
      dailyAiUsage = { date: today, count: 0 };
    }
    res.json({
      dailyCount: dailyAiUsage.count,
      maxDaily: MAX_DAILY_AI_CALLS,
      date: dailyAiUsage.date,
      timeZone: 'America/Los_Angeles (Pacific Time)',
      remaining: Math.max(0, MAX_DAILY_AI_CALLS - dailyAiUsage.count),
      isBankActive: pregeneratedBank.length > 0,
      bankQuestionCount: pregeneratedBank.length,
    });
  });

  // Background question growth scheduler status endpoint
  app.get('/api/bank/status', (req, res) => {
    const status = questionGrowthJob.getStatus();
    res.json(status);
  });

  // Manual trigger endpoint for question growth batch (protected by ADMIN_SECRET_KEY)
  app.post('/api/bank/trigger-growth', async (req, res) => {
    const adminKeyHeader = req.headers['x-admin-key'];
    const configuredSecret = process.env.ADMIN_SECRET_KEY;

    if (!configuredSecret || !adminKeyHeader || adminKeyHeader !== configuredSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestedBatchSize = req.body.batchSize ? parseInt(req.body.batchSize, 10) : undefined;
    const requestedMaxCalls = req.body.maxCalls ? parseInt(req.body.maxCalls, 10) : undefined;
    
    // Run generation batch asynchronously
    questionGrowthJob.runGenerationBatch(requestedBatchSize, requestedMaxCalls)
      .then((result) => {
        loadPregeneratedBank();
        console.log('[Question Bank] Pregenerated bank reloaded after growth batch.');
      })
      .catch((err) => {
        console.error('[Question Bank] Error in growth batch run:', err);
      });

    res.json({
      message: 'Background question growth batch triggered',
      status: questionGrowthJob.getStatus(),
    });
  });

  // Wikipedia topics list
  app.get('/api/wiki/categories', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const categories = [
      { id: 'all', label: 'Случайные темы', iconName: 'Sparkles', description: 'Вопросы по всей русскоязычной Википедии' },
      { id: 'Видеоигры', label: 'Видеоигры и гейминг', iconName: 'Gamepad2', description: 'Культовые франшизы, студии, персонажи и история гейминга' },
      { id: 'История', label: 'История и эпохи', iconName: 'Landmark', description: 'Великие цивилизации, правители, войны и мирные договоры' },
      { id: 'Наука', label: 'Наука и открытия', iconName: 'Atom', description: 'Физика, химия, математика и великие изобретения' },
      { id: 'География', label: 'География и страны', iconName: 'Globe', description: 'Города, горы, реки, океаны и столицы мира' },
      { id: 'Космос', label: 'Космос и астрономия', iconName: 'Rocket', description: 'Планеты, звёзды, чёрные дыры и исследование Вселенной' },
      { id: 'Литература', label: 'Литература и книги', iconName: 'BookOpen', description: 'Классические и современные произведения, авторы и сюжеты' },
      { id: 'Биология', label: 'Биология и природа', iconName: 'Dna', description: 'Животные, растения, анатомия человека и эволюция' },
      { id: 'Искусство', label: 'Искусство и культура', iconName: 'Palette', description: 'Живопись, скульптура, архитектура и шедевры' },
      { id: 'Кино', label: 'Кино и театр', iconName: 'Film', description: 'Режиссёры, культовые фильмы, премии и постановки' },
      { id: 'Спорт', label: 'Спорт и рекорды', iconName: 'Trophy', description: 'Олимпийские игры, чемпионы и легендарные матчи' },
      { id: 'Мифология', label: 'Мифы и легенды', iconName: 'Scroll', description: 'Древние боги, предания и фольклор народов мира' },
    ];
    res.json(categories);
  });

  // ChGK tournaments list & copyright info
  app.get('/api/chgk/tournaments', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
      tournaments: CHGK_TOURNAMENTS,
      copyright: {
        source: 'База вопросов «Что? Где? Когда?» (db.chgk.info)',
        licenseUrl: 'https://db.chgk.info/copyright',
        notice: 'Использование вопросов регулируется лицензией db.chgk.info (некоммерческое использование, сохранение авторства, ссылки на источник).',
      },
    });
  });

  // ChGK questions generation/retrieval endpoint
  app.post('/api/chgk/questions', async (req, res) => {
    try {
      const { tournamentId = 'random', count = 1, excludeIds = [] } = req.body;
      const questions = await getChgkQuestions(tournamentId, count, excludeIds);
      res.json({
        questions,
        source: 'db.chgk.info',
        copyrightNotice: 'Вопросы предоставлены базой db.chgk.info. Все авторские права сохранены.',
      });
    } catch (err) {
      console.error('[ChGK API] Error fetching questions:', err);
      res.status(500).json({ error: 'Failed to load ChGK questions' });
    }
  });

  // Generate quiz questions
  app.post('/api/quiz/generate', async (req, res) => {
    const {
      difficulty = 'medium',
      format = 'random',
      category = 'all',
      count = 1,
      excludeTitles = [],
      excludeIds = [],
      engineSource = 'wikipedia',
      chgkTournamentId = 'random',
    } = req.body;

    // Handle ChGK questions mode directly
    if (engineSource === 'chgk') {
      try {
        const combinedExcludes = [...(excludeIds || []), ...(excludeTitles || [])];
        const questions = await getChgkQuestions(chgkTournamentId, count, combinedExcludes);
        return res.json({
          questions,
          source: 'db.chgk.info',
        });
      } catch (chgkErr) {
        console.error('[Quiz Generator] ChGK retrieval error, falling back:', chgkErr);
      }
    }

    const resolved = resolveTopic(category);
    const { ai, isCustomKey, quotaExceeded } = getAiClientForRequest(req);

    // 1. PRIMARY FAST STRATEGY: Serve from pre-generated question bank if enough UNUSED items exist
    const bankItems = !isCustomKey
      ? getQuestionsFromBank(category, format, difficulty, count, excludeTitles)
      : [];

    if (bankItems.length >= count) {
      return res.json({
        questions: bankItems,
        source: 'pregenerated_bank',
      });
    }

    // 2. DYNAMIC GENERATION STRATEGY: If bank does not have enough unseen questions, generate brand-new ones with Gemini from Wikipedia
    const neededFromAi = count - bankItems.length;
    const initialExcludes = [...excludeTitles, ...bankItems.map((b) => b.articleTitle)];

    // If AI is offline or daily server budget cap reached, fallback to curated dataset
    if (!ai || quotaExceeded) {
      const items = getCuratedQuestions(category, format, difficulty, neededFromAi, initialExcludes);
      const combined = [...bankItems, ...items].slice(0, count);
      return res.json({
        questions: combined,
        source: bankItems.length > 0 ? 'pregenerated_bank' : 'curated_offline_dataset',
      });
    }

    try {
      // Fetch authentic Wikipedia articles with popularity rating as factual context
      const wikiArticles = await fetchWikiArticles(category, Math.max(neededFromAi * 2, 4), initialExcludes, difficulty);
      const wikiContext = wikiArticles
        .map(
          (a, i) =>
            `[Статья ${i + 1}]: "${a.title}" (${a.popularityLabel}, Рейтинг: ${a.popularityTier})\nВыдержка: ${a.extract}\nСсылка: ${a.url}`
        )
        .join('\n\n');

      // Calibrated difficulty levels based on Wikipedia popularity and cognitive accessibility
      const difficultyGuidelines: Record<string, string> = {
        easy: 'Легкий уровень (Популярные статьи Википедии): Вопрос опирается на широко известные базовые факты, культовые франшизы, главных героев, мировые столицы или фундаментальные открытия. Вопрос должен быть понятен любому человеку с общим кругозором без заучивания мелких цифр или сносок.',
        medium: 'Средний уровень (Хорошая эрудиция): Вопрос опирается на популярные и средне-популярные статьи Википедии. Проверяет понимание сути, создателей, исторических эпох, сюжетов и открытий. Вопрос интересный, сбалансированный и познавательный.',
        hard: 'Сложный уровень (Глубокие знания): Вопрос по специализированным статьям и деталям. Требует глубокого понимания предмета, сопоставления фактов и контекста, но ответ остаётся логичным и выводимым из контекста.',
        expert: 'Экспертный уровень / Гроссмейстер: Вопрос для подлинных знатоков. Касается академических терминов, технологических или исторических связей, но обязан быть интересным и проверяемым (НЕ спрашивай случайные номера сносок или точные секунды).',
      };

      const isMultipleChoiceReq = format === 'multiple_choice';
      const isOpenEndedReq = format === 'open_ended';

      const formatInstruction = isMultipleChoiceReq
        ? 'КАТЕГОРИЧЕСКОЕ ТРЕБОВАНИЕ: ВСЕ вопросы ДОЛЖНЫ БЫТЬ С 4 ВАРИАНТАМИ ОТВЕТА (type: "multiple_choice", массив options из ровно 4 правдоподобных уникальных вариантов на русском языке, один из которых в точности совпадает с correctAnswer). ОТКРЫТЫЕ ВОПРОСЫ (open_ended) СТРОГО ЗАПРЕЩЕНЫ!'
        : isOpenEndedReq
        ? 'КАТЕГОРИЧЕСКОЕ ТРЕБОВАНИЕ: ВСЕ вопросы ДОЛЖНЫ БЫТЬ ОТКРЫТЫМИ БЕЗ ВАРИАНТОВ (type: "open_ended", options не указывать, поле acceptableAnswers содержит список допустимых синонимов и вариантов написания). ВОПРОСЫ С ВАРИАНТАМИ СТРОГО ЗАПРЕЩЕНЫ!'
        : 'Случайно распредели форматы: часть вопросов должна быть с 4 вариантами (type: "multiple_choice"), а часть — открытыми без вариантов (type: "open_ended").';

      const topicInstruction = resolved.isAll
        ? 'Каждый вопрос должен представлять совершенно разную тему (Наука, История, Литература, География, Космос, Биология, Видеоигры, Искусство, Кино, Мифология, Спорт).'
        : `СТРОЖАЙШЕЕ ТРЕБОВАНИЕ К ТЕМАТИКЕ (CRITICAL TOPIC INTEGRITY): Пользователь выбрал тему "${resolved.canonicalName}". ВСЕ ${count} вопросов ОБЯЗАНЫ быть СТРОГО И ИСКЛЮЧИТЕЛЬНО по теме "${resolved.canonicalName}" (включая её историю, культовые произведения/игры/открытия, создателей, ключевые термины и концепции). Категорически ЗАПРЕЩЕНО отклоняться в биологию, географию или другие не относящиеся к "${resolved.canonicalName}" темы!`;

      const prompt = `Ты — ведущий интеллектуальной викторины "ВикиВикторина" по материалам русской Википедии.
Сгенерируй ровно ${count} уникальных вопросов на русском языке.

${topicInstruction}

СТРОЖАЙШЕЕ ПРАВИЛО ЕДИНСТВЕННОСТИ И ОДНОЗНАЧНОСТИ ОТВЕТА В ВЫБОРЕ ИЗ 4 ВАРИАНТОВ (CRITICAL SINGLE-ANSWER UNIQUENESS & DISAMBIGUATION MANDATE):
1. В КАЖДОМ вопросе с 4 вариантами (multiple_choice) текст вопроса ОБЯЗАН содержать ТОЧНЫЙ, УНИКАЛЬНЫЙ ИДЕНТИФИЦИРУЮЩИЙ ПРИЗНАК (конкретное название картины/книги/игры/фильма в кавычках, точный год события, уникальное научное открытие, специфический закон, авторство конкретного шедевра или неповторимую деталь), который делает ПРАВИЛЬНЫМ СТРОГО ОДИН ВАРИАНТ, а ВСЕ ОСТАЛЬНЫЕ 3 ВАРИАНТА — СТРОГО И ЗАВЕДОМО НЕВЕРНЫМИ для этого факта!
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ общие родовые и двусмысленные вопросы, под которые подходят несколько вариантов из списка:
   - ❌ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО: «Какой советский художник творил в стиле соцреализма?» (Все 4 предложенных художника творили в стиле соцреализма! Вопрос не имеет единственного ответа и вызывает возмущение игрока!)
   - ✅ ПРАВИЛЬНО: «Какой советский художник написал монументальное полотно «Оборона Севастополя» в 1942 году?» (Подходит ТОЛЬКО Александр Дейнека, а остальные три художника эту картину НЕ писали!)
   - ❌ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО: «Кто из этих писателей писал рассказы о Великой Отечественной войне?» (Все 4 писателя писали о войне!)
   - ✅ ПРАВИЛЬНО: «Кто является автором военной повести «А зори здесь тихие...»?» (Подходит ТОЛЬКО Борис Васильев!)
   - ❌ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО: «Какой учёный исследовал ядерную физику в СССР?» (Все 4 варианта — физики-ядерщики!)
   - ✅ ПРАВИЛЬНО: «Какой советский физик возглавлял лабораторию №2 и научное руководство советским атомным проектом создания первой атомной бомбы РДС-1?» (Подходит ТОЛЬКО Игорь Курчатов!)
   - ❌ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО: «Какая планета находится в Солнечной системе?» (Все 4 — планеты Солнечной системы!)
   - ✅ ПРАВИЛЬНО: «Какая планета Солнечной системы является шестой от Солнца и обладает самой заметной гигантской системой колец?» (Подходит ТОЛЬКО Сатурн!)
   - ❌ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО: «Какая игра была популярна в 1990-е годы?»
   - ✅ ПРАВИЛЬНО: «В какой культовой игре 1998 года от Valve главным героем выступает физик-теоретик Гордон Фримен с монтировкой?» (Подходит ТОЛЬКО Half-Life!)
3. ТРЕБОВАНИЕ К 4 ВАРИАНТАМ (options) И КАЧЕСТВУ ДИСТРАКТОРОВ (DISTRACTOR HOMOGENEITY & PLAUSIBILITY):
   - Все 4 варианта ДОЛЖНЫ принадлежать к одному и тому же узкому понятийному классу, жанру или эпохе, чтобы дистракторы были правдоподобными, а правильный ответ не становился очевидным методом исключения:
     * Если вопрос про пьесу Шекспира («Гамлет»), все 3 неправильных варианта ОБЯЗАНЫ быть ДРУГИМИ известными пьесами Шекспира («Макбет», «Отелло», «Король Лир»). КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО ставить в варианты романы Толстого, Достоевского или произведения других авторов/эпох!
     * Если вопрос про художника Возрождения, все 4 варианта — художники Возрождения.
     * Если вопрос про древнегреческого бога, все 4 варианта — древнегреческие боги (не смешивать со скандинавскими или египетскими).
     * Если вопрос про год события, все 4 варианта — близкие годы одного периода/века.
     * Если вопрос про советского полководца ВОВ, все 4 варианта — советские полководцы ВОВ.
     * Если вопрос про космический телескоп или аппарат, все 4 варианта — аппараты того же типа.
   - Категорически запрещены разнородные дистракторы (например: 1 пьеса, 2 романа и 1 фильм), делающие вопрос тривиально простым.
   - При этом относительно конкретного названия, года или уникального факта, заданного в вопросе, ПРАВИЛЬНЫМ ДОЛЖЕН БЫТЬ СТРОГО 1 ВАРИАНТ (correctAnswer), а остальные 3 — однозначно НЕВЕРНЫМИ.
   - Перед генерацией ОБЯЗАТЕЛЬНО проверь: «Не может ли игрок возразить, что один из неправильных вариантов ТОЖЕ сделал/написал/открыл то, о чем спрашивается?» Если есть хоть малейшее сомнение — добавь в вопрос точное название произведения, год или ключевое отличие!

СТРОЖАЙШИЙ ЗАПРЕТ ПОВТОРОВ И СВЯЗАННЫХ ВОПРОСОВ (CRITICAL ANTI-REPETITION MANDATE):
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать статьи, темы, авторов, книги, ученых, персоналий или исторические события, которые уже встречались в викторине!
ИСКЛЮЧЕННЫЕ СТАТЬИ И ТЕМЫ (НЕ ИСПОЛЬЗОВАТЬ):
${excludeTitles.length > 0 ? excludeTitles.join(', ') : 'пока нет'}

2. Если статья, произведение, игра, ученый или персонаж уже упоминались, ЗАПРЕЩЕНО повторно задавать по ним любые вопросы!
${resolved.isAll ? '3. В рамках одного раунда КАЖДЫЙ вопрос ОБЯЗАН быть из совершенно иной, не связанной сферы знаний.' : ''}

СТРОЖАЙШИЙ ЗАПРЕТ СПОЙЛЕРОВ И УТЕЧЕК В ТЕКСТЕ ВОПРОСА (CRITICAL ANTI-SPOILER MANDATE):
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО включать в текст вопроса (поле question) правильный ответ (correctAnswer), любые ключевые слова из него, либо однокоренные слова!
   - Если ответ "Тетрис", в вопросе НЕЛЬЗЯ писать "в игре Тетрис" или "падающие тетрамино-фигуры".
   - Если ответ "Сатурн", в вопросе НЕЛЬЗЯ писать "планета Сатурн" или "сатурнианские кольца".
   - Если ответ "Сверхпроводимость", НЕЛЬЗЯ писать "Какое явление сверхпроводимости..." (пиши "Какое физическое свойство полного исчезновения сопротивления...").
   - Если ответ "Minecraft", в вопросе НЕЛЬЗЯ писать "в игре Майнкрафт" (пиши "в популярной игре-песочнице с кубическим миром от Маркуса Перссона").
2. Если ответом является фамилия или имя создателя, писателя, учёного (например, "Хидэо Кодзима", "Алексей Пажитнов", "Исаак Ньютон", "Юрий Гагарин"), в тексте вопроса КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО называть эту фамилию или имя!
3. Вопрос должен проверять эрудицию игрока, а не делать ответ тривиальным из-за случайного упоминания корней ответа в вопросе.

ТРЕБОВАНИЯ:
1. Язык: грамотный, литературный русский язык.
2. Сложность: ${difficulty.toUpperCase()} (${difficultyGuidelines[difficulty] || difficultyGuidelines.medium}).
3. Категория: ${resolved.isAll ? 'Разные темы' : resolved.canonicalName}.
4. Формат: ${formatInstruction}
5. Достоверность: Вопрос должен опираться на факты из Википедии. Укажи точное название статьи (articleTitle) и ссылку (articleUrl).
6. Для multiple_choice: ровно 4 варианта в options. Поле correctAnswer должно в точности совпадать с одним из вариантов. Варианты должны быть правдоподобными.
7. Для open_ended: однозначный ответ (acceptableAnswers — список допустимых синонимов и вариантов написания).
8. Объяснение (explanation): 2-3 предложения интересного познавательного комментария к факту.

${wikiContext ? `Реальные статьи Википедии для контекста (используй их по возможности с учётом их популярности):\n${wikiContext}` : ''}

Верни массив JSON по схеме.`;

      const allowedTypeEnums = isMultipleChoiceReq
        ? ['multiple_choice']
        : isOpenEndedReq
        ? ['open_ended']
        : ['multiple_choice', 'open_ended'];

      const schemaConfig = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: 'Текст вопроса на русском языке' },
              type: { type: Type.STRING, enum: allowedTypeEnums },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Ровно 4 варианта ответа для multiple_choice',
              },
              correctAnswer: { type: Type.STRING, description: 'Правильный ответ' },
              acceptableAnswers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Синонимы и варианты написания правильного ответа',
              },
              explanation: { type: Type.STRING, description: 'Познавательное объяснение факта на русском' },
              articleTitle: { type: Type.STRING, description: 'Название статьи в русской Википедии' },
              articleUrl: { type: Type.STRING, description: 'Ссылка на статью в русской Википедии' },
              articleExtract: { type: Type.STRING, description: 'Краткая выдержка из статьи Википедии' },
              thumbnailUrl: { type: Type.STRING, description: 'URL изображения если релевантно' },
              difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard', 'expert'] },
              category: { type: Type.STRING, description: 'Категория темы' },
            },
            required: ['question', 'type', 'correctAnswer', 'explanation', 'articleTitle', 'articleUrl', 'difficulty', 'category'],
          },
        },
      };

      const text = await generateWithGeminiRetry(ai, prompt, schemaConfig);

      if (!text) {
        // Fallback gracefully without error
        const items = getCuratedQuestions(category, format, difficulty, count, excludeTitles);
        return res.json({
          questions: items,
          source: 'curated_resilient_fallback',
        });
      }

      let parsedQuestions = JSON.parse(text);
      if (!Array.isArray(parsedQuestions)) {
        parsedQuestions = [parsedQuestions];
      }

      // Track titles seen during this batch to prevent intra-batch duplicates
      const seenTitlesInBatch = new Set<string>();
      const accumulatedExclude = [...excludeTitles];

      // Enrich with unique IDs, validate options, and perform anti-repetition replacement
      const finalized = [];

      for (let idx = 0; idx < parsedQuestions.length; idx++) {
        const q = parsedQuestions[idx];
        const title = (q.articleTitle as string) || '';
        const correct = String(q.correctAnswer || '').trim();

        // Deduplication & Anti-leakage checks
        const isDuplicate =
          isQuestionExcluded({ articleTitle: title, question: q.question, correctAnswer: correct }, accumulatedExclude) ||
          seenTitlesInBatch.has(normalizeTopicString(title));

        const leakCheck = detectAnswerLeak(q.question, correct, q.acceptableAnswers);
        const hasLeak = leakCheck.hasLeak;

        if (isDuplicate || hasLeak) {
          if (hasLeak) {
            console.warn(`[Anti-Leak Filter] Filtered out leaking question: "${q.question}" for answer "${correct}". Reason: ${leakCheck.reason}`);
          }
          // Replace seamlessly with a guaranteed unique, non-leaking curated question
          const replacement = getCuratedQuestions(category, format, difficulty, 1, accumulatedExclude);
          if (replacement.length > 0) {
            const rep = replacement[0];
            finalized.push(rep);
            seenTitlesInBatch.add(normalizeTopicString(rep.articleTitle));
            accumulatedExclude.push(rep.articleTitle);
            continue;
          }
        }

        seenTitlesInBatch.add(normalizeTopicString(title));
        accumulatedExclude.push(title);

        const matchingWiki = wikiArticles.find(
          (w) => w.title.toLowerCase() === title.toLowerCase() || title.toLowerCase().includes(w.title.toLowerCase())
        );

        // Determine strict question type respecting user format request
        let qType: 'multiple_choice' | 'open_ended';
        if (isMultipleChoiceReq) {
          qType = 'multiple_choice';
        } else if (isOpenEndedReq) {
          qType = 'open_ended';
        } else {
          qType = q.type === 'multiple_choice' ? 'multiple_choice' : 'open_ended';
        }

        let options: string[] | undefined = undefined;
        if (qType === 'multiple_choice') {
          options = ensureMultipleChoiceOptions(
            correct,
            resolved.isAll ? (q.category as string) || 'Общие знания' : resolved.canonicalName,
            q.options as string[] | undefined
          );
        }

        const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
        const finalUrl = (q.articleUrl as string) || (title ? `https://ru.wikipedia.org/wiki/${encodedTitle}` : 'https://ru.wikipedia.org/');

        finalized.push({
          id: `wiki-q-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          question: q.question,
          type: qType,
          options: qType === 'multiple_choice' ? options : undefined,
          correctAnswer: correct,
          acceptableAnswers: Array.isArray(q.acceptableAnswers) && q.acceptableAnswers.length > 0 ? q.acceptableAnswers : [correct],
          explanation: q.explanation || 'Подробная информация доступна в статье Википедии.',
          articleTitle: title || 'Статья Википедии',
          articleUrl: finalUrl,
          articleExtract: q.articleExtract || matchingWiki?.extract || undefined,
          thumbnailUrl: (q.thumbnailUrl as string) || matchingWiki?.thumbnail || undefined,
          difficulty: (q.difficulty as string) || difficulty,
          category: resolved.isAll ? (q.category as string) || 'Общие знания' : resolved.canonicalName,
          pageviews: matchingWiki?.pageviews,
          popularityLabel: matchingWiki?.popularityLabel,
          popularityTier: matchingWiki?.popularityTier,
          generatedAt: Date.now(),
        });
      }

        if (finalized.length > 0) {
          recordAiUsage(isCustomKey);
          appendToPregeneratedBank(finalized);
        }

        const combined = [...bankItems, ...finalized].slice(0, count);
        return res.json({
          questions: combined,
          source: 'gemini_ai_wiki',
        });
      } catch (genErr) {
        console.warn('[Quiz Generator] Live Gemini generation failed, serving fallback:', genErr);
        // Graceful fallback from curated collection
        const items = getCuratedQuestions(category, format, difficulty, neededFromAi, initialExcludes);
        const combined = [...bankItems, ...items].slice(0, count);
        return res.json({
          questions: combined,
          source: 'curated_resilient_fallback',
        });
      }
  });

  // Evaluate open-ended text answers in Russian (with live AI call quota management & graceful fallback)
  app.post('/api/quiz/evaluate-open', async (req, res) => {
    try {
      const { question, correctAnswer, acceptableAnswers = [], userAnswer, articleTitle } = req.body;

      if (!userAnswer || typeof userAnswer !== 'string' || userAnswer.trim().length === 0) {
        return res.json({
          isCorrect: false,
          feedback: 'Ответ не введен.',
          similarity: 0,
        });
      }

      const cleanUser = userAnswer.trim().toLowerCase();
      const cleanCorrect = String(correctAnswer).trim().toLowerCase();

      // Quick exact / substring check in Russian first (0 AI tokens)
      const allAcceptables = [cleanCorrect, ...(acceptableAnswers || []).map((a: string) => a.trim().toLowerCase())];

      const exactMatch = allAcceptables.some((acc) => {
        if (cleanUser === acc) return true;
        const strippedUser = cleanUser.replace(/["'«».,!?-]/g, '').trim();
        const strippedAcc = acc.replace(/["'«».,!?-]/g, '').trim();
        return strippedUser === strippedAcc || (strippedUser.length > 3 && strippedAcc.includes(strippedUser)) || (strippedAcc.length > 3 && strippedUser.includes(strippedAcc));
      });

      if (exactMatch) {
        return res.json({
          isCorrect: true,
          feedback: 'Абсолютно точно!',
          similarity: 1.0,
        });
      }

      // Check for AI client (BYOK user key or server quota)
      const { ai, isCustomKey, quotaExceeded } = getAiClientForRequest(req);

      if (ai && !quotaExceeded) {
        const evalPrompt = `Ты — судья русскоязычной викторины.
Оцени ответ игрока на открытый вопрос.

Вопрос: "${question}"
Ожидаемый правильный ответ: "${correctAnswer}"
${acceptableAnswers && acceptableAnswers.length > 0 ? `Допустимые варианты: ${acceptableAnswers.join(', ')}` : ''}
${articleTitle ? `Тема статьи Википедии: ${articleTitle}` : ''}
Ответ игрока: "${userAnswer}"

КРИТЕРИИ:
1. Засчитывай (isCorrect: true), если игрок назвал правильную суть (фамилию без имени, правильный синоним, опечатку в 1-2 буквы, другой падеж, аббревиатуру вроде "РФ" = "Россия" или "МКС").
2. Считай неверным (isCorrect: false), если назван другой человек или объект.
3. feedback: краткий комментарий (1 предложение).
4. similarity: от 0.0 до 1.0.`;

        const schemaConfig = {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isCorrect: { type: Type.BOOLEAN, description: 'Засчитан ли ответ' },
              feedback: { type: Type.STRING, description: 'Краткий комментарий' },
              similarity: { type: Type.NUMBER, description: 'Коэффициент сходства' },
            },
            required: ['isCorrect', 'feedback', 'similarity'],
          },
        };

        const text = await generateWithGeminiRetry(ai, evalPrompt, schemaConfig);
        if (text) {
          recordAiUsage(isCustomKey);
          const result = JSON.parse(text);
          return res.json({
            isCorrect: Boolean(result.isCorrect),
            feedback: result.feedback || (result.isCorrect ? 'Верно!' : `Правильный ответ: ${correctAnswer}`),
            similarity: typeof result.similarity === 'number' ? result.similarity : result.isCorrect ? 1.0 : 0.0,
          });
        }
      }

      // Robust Rule-based Fuzzy Evaluation fallback (Levenshtein + word stems) when quota is reached or offline
      const strippedUser = cleanUser.replace(/["'«».,!?-]/g, '').trim();
      const strippedCorrect = cleanCorrect.replace(/["'«».,!?-]/g, '').trim();
      const userStem = extractRussianStem(strippedUser);
      const correctStem = extractRussianStem(strippedCorrect);

      const isStemMatch = userStem.length >= 3 && (correctStem.startsWith(userStem) || userStem.startsWith(correctStem));
      const isSub = (strippedUser.length >= 3 && strippedCorrect.includes(strippedUser)) || (strippedCorrect.length >= 3 && strippedUser.includes(strippedCorrect));
      const isMatch = isStemMatch || isSub;

      return res.json({
        isCorrect: isMatch,
        feedback: isMatch ? 'Ответ зачтен!' : `Правильный ответ: ${correctAnswer}`,
        similarity: isMatch ? 0.9 : 0.2,
      });
    } catch {
      // Fallback matching
      const cleanUser = String(req.body.userAnswer || '').trim().toLowerCase();
      const cleanCorrect = String(req.body.correctAnswer || '').trim().toLowerCase();
      const isSub = cleanUser.length > 2 && (cleanCorrect.includes(cleanUser) || cleanUser.includes(cleanCorrect));

      return res.json({
        isCorrect: isSub,
        feedback: isSub ? 'Ответ зачтен!' : `Правильный ответ: ${req.body.correctAnswer}`,
        similarity: isSub ? 0.8 : 0.2,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WikiQuiz Russian server running on port ${PORT}`);
    // Initialize ChGK question catalog from cache
    initializeChgkCatalog();
    // Initialize background question growth scheduler with in-memory bank reload callback
    questionGrowthJob.init(() => {
      loadPregeneratedBank();
    });
  });
}

startServer();
