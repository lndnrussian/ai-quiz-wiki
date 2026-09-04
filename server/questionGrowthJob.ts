import fs from 'fs';
import path from 'path';
import cron, { ScheduledTask } from 'node-cron';
import { GoogleGenAI, Type } from '@google/genai';
import db from './db';
import { WikiQuestion, DifficultyLevel } from '../src/types';

const DATA_FILE = path.join(process.cwd(), 'data', 'generated-questions.json');
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

export interface GrowthJobStatus {
  enabled: boolean;
  schedule: string;
  batchSize: number;
  maxCallsPerRun: number;
  isRunning: boolean;
  lastRunAt: string | null;
  lastRunGeneratedCount: number;
  lastRunSkippedCount: number;
  lastRunCallsUsed: number;
  totalBankCount: number;
  lastError: string | null;
}

// Default schedule: Every Sunday at 03:00 AM server time
const DEFAULT_SCHEDULE = '0 3 * * 0';
// Default batch size: 40 questions (within 30-50 range)
const DEFAULT_BATCH_SIZE = 40;
// Default safety limit for background generation job (does NOT share counter with visitor live calls)
const DEFAULT_MAX_RUN_CALLS = 50;

const CATEGORIES = [
  'Видеоигры',
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

const DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'expert'];

// Fisher-Yates shuffle helper for true uniform randomness
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const TOPIC_SEARCH_QUERIES: Record<string, string[]> = {
  Видеоигры: [
    'Культовые компьютерные игры',
    'История компьютерных игр',
    'Игровая индустрия',
    'Игровые приставки',
    'Киберспорт',
    'Шутер от первого лица',
    'Ролевая игра (видеоигры)',
    'Nintendo',
    'Valve',
    'Blizzard Entertainment',
    'PlayStation',
    'Xbox',
  ],
  История: [
    'История России',
    'Древний Рим',
    'Древняя Греция',
    'Средние века',
    'Эпоха Возрождения',
    'Великая Отечественная война',
    'Российская империя',
    'СССР',
    'Французская революция',
    'Византийская империя',
    'Семилетняя война',
    'Эпоха великих географических открытий',
  ],
  Наука: [
    'Квантовая механика',
    'Периодическая система химических элементов',
    'Теория относительности',
    'Генетика',
    'Нобелевская премия',
    'Астрофизика',
    'Электродинамика',
    'Органическая химия',
    'Математический анализ',
    'Искусственный интеллект',
    'Термодинамика',
    'Теория струн',
  ],
  География: [
    'Столицы государств',
    'Крупнейшие реки мира',
    'Горные системы',
    'Озёра России',
    'Океаны',
    'Острова мира',
    'Пустыни мира',
    'Моря России',
    'Вулканы Земли',
    'Географические открытия',
    'Проливы мира',
    'Фьорд',
  ],
  Космос: [
    'Солнечная система',
    'Планеты земной группы',
    'Галактика Млечный Путь',
    'Черная дыра',
    'Пилотируемая космонавтика',
    'Программа Аполлон',
    'Международная космическая станция',
    'Сверхновая звезда',
    'Марсоход',
    'Космический телескоп Хаббл',
    'Джеймс Уэбб (телескоп)',
    'Квазар',
  ],
  Литература: [
    'Русская классическая литература',
    'Зарубежная классическая литература',
    'Поэзия Серебряного века',
    'Научная фантастика',
    'Нобелевская премия по литературе',
    'Драматургия',
    'Романтизм в литературе',
    'Реализм в литературе',
    'Антиутопия',
    'Сказки народов мира',
    'Золотой век русской литературы',
    'Эпос о Гильгамеше',
  ],
  Биология: [
    'Теория эволюции',
    'Млекопитающие',
    'Царство Растения',
    'Анатомия человека',
    'Генетический код',
    'Экология',
    'Микробиология',
    'Орнитология',
    'Морская биология',
    'Эндемики',
    'Нейробиология',
    'Иммунология',
  ],
  Искусство: [
    'Шедевры живописи',
    'Архитектура модерна',
    'Эпоха Возрождения (живопись)',
    'Импрессионизм',
    'Русский авангард',
    'Третьяковская галерея',
    'Эрмитаж',
    'Скульптура',
    'Барокко',
    'Классическая музыка',
    'Готическая архитектура',
    'Сюрреализм',
  ],
  Кино: [
    'Советский кинематограф',
    'Премия Оскар',
    'Классика мирового кино',
    'Культовые кинорежиссёры',
    'Анимация',
    'Каннский кинофестиваль',
    'Кинофантастика',
    'Немое кино',
    'Кинооператорское искусство',
    'Сценаристы',
    'Итальянский неореализм',
    'Французская новая волна',
  ],
  Спорт: [
    'Олимпийские игры',
    'Чемпионат мира по футболу',
    'История шахмат',
    'Формула-1',
    'Лёгкая атлетика',
    'Хоккей с шайбой',
    'Большой шлем (теннис)',
    'Баскетбол',
    'Фигурное катание',
    'Бокс',
    'Биатлон',
    'Тур де Франс',
  ],
  Мифология: [
    'Древнегреческая мифология',
    'Скандинавская мифология',
    'Славянская мифология',
    'Египетская мифология',
    'Шумеро-аккадская мифология',
    'Кельтская мифология',
    'Мифологические существа',
    'Олимпийские боги',
    'Легенды о короле Артуре',
    'Мифы древней Индии',
    'Ацтекская мифология',
    'Японская мифология',
  ],
};

// Text normalization & similarity algorithms for deduplication
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»""''„“`.,\/#!$%\^&\*;:{}=\-_`~()?—–\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWordTokens(text: string): Set<string> {
  const words = normalizeText(text).split(' ').filter((w) => w.length > 2);
  return new Set(words);
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function bigramDiceSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0;

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.slice(i, i + 2);
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const [bg, count1] of b1) {
    if (b2.has(bg)) {
      intersection += Math.min(count1, b2.get(bg)!);
    }
  }
  const total = (s1.length - 1) + (s2.length - 1);
  return (2 * intersection) / total;
}

export function findSimilarQuestion(
  targetQ: WikiQuestion,
  existingList: WikiQuestion[]
): { isSimilar: boolean; match?: WikiQuestion; reason?: string } {
  const normTargetQ = normalizeText(targetQ.question);
  const targetTokens = getWordTokens(targetQ.question);
  const normTargetAns = normalizeText(targetQ.correctAnswer || '');

  for (const item of existingList) {
    const normItemQ = normalizeText(item.question);

    if (normTargetQ === normItemQ) {
      return { isSimilar: true, match: item, reason: 'Exact question match' };
    }

    const dice = bigramDiceSimilarity(targetQ.question, item.question);
    if (dice >= 0.72) {
      return { isSimilar: true, match: item, reason: `High text similarity (${Math.round(dice * 100)}%)` };
    }

    const itemTokens = getWordTokens(item.question);
    const jaccard = jaccardSimilarity(targetTokens, itemTokens);
    if (jaccard >= 0.65) {
      return { isSimilar: true, match: item, reason: `High word overlap (${Math.round(jaccard * 100)}%)` };
    }

    const normItemAns = normalizeText(item.correctAnswer || '');
    if (normTargetAns && normItemAns && normTargetAns === normItemAns) {
      if (jaccard >= 0.45 || dice >= 0.50) {
        return {
          isSimilar: true,
          match: item,
          reason: `Same answer with question overlap (${Math.round((jaccard || dice) * 100)}%)`,
        };
      }
    }
  }

  return { isSimilar: false };
}

// Read current bank from SQLite
export function readExistingBank(): WikiQuestion[] {
  try {
    const rows = db.prepare('SELECT * FROM generated_questions').all() as any[];
    return rows.map((row) => {
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
  } catch (err) {
    console.warn('⚠️ [Question Growth Job] Warning: Could not read generated_questions from SQLite:', err);
    return [];
  }
}

// Safe helper to append newly generated questions without replacement
export function appendAndSaveQuestions(newItems: WikiQuestion[]): { added: number; skipped: number; total: number } {
  const currentBank = readExistingBank();
  if (newItems.length === 0) {
    return { added: 0, skipped: 0, total: currentBank.length };
  }

  const existingList = [...currentBank];
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

  let addedCount = 0;
  let skippedCount = 0;

  const insertTransaction = db.transaction((items: WikiQuestion[]) => {
    for (const q of items) {
      const norm = (q.question || '').toLowerCase().trim();
      if (!norm) {
        skippedCount++;
        continue;
      }

      const simCheck = findSimilarQuestion(q, existingList);
      if (simCheck.isSimilar) {
        skippedCount++;
        continue;
      }

      const info = insertStmt.run({
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

      if (info.changes > 0) {
        addedCount++;
        existingList.push(q);
      } else {
        skippedCount++;
      }
    }
  });

  insertTransaction(newItems);

  const totalRow = db.prepare('SELECT COUNT(*) as count FROM generated_questions').get() as { count: number } | undefined;
  const total = totalRow ? totalRow.count : currentBank.length + addedCount;

  console.log(
    `💾 [Question Bank Storage] Appended ${addedCount} questions (skipped ${skippedCount} similar). Total bank: ${total}`
  );

  return { added: addedCount, skipped: skippedCount, total };
}

// Wikipedia article summary fetcher
async function fetchWikiArticleSummary(title: string): Promise<{ title: string; extract: string; url: string } | null> {
  try {
    const searchUrl = `https://ru.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      title
    )}&limit=1&namespace=0&format=json`;
    const sRes = await fetch(searchUrl, { headers: { 'User-Agent': 'WikiQuizGenerator/2.0' } });
    const sData = (await sRes.json()) as [string, string[], string[], string[]];
    const actualTitle = sData[1]?.[0] || title;

    const pageUrl = `https://ru.wikipedia.org/w/api.php?action=query&prop=extracts|pageviews&exintro=1&explaintext=1&titles=${encodeURIComponent(
      actualTitle
    )}&format=json&redirects=1`;
    const pRes = await fetch(pageUrl, { headers: { 'User-Agent': 'WikiQuizGenerator/2.0' } });
    const pData = (await pRes.json()) as { query?: { pages?: Record<string, { title: string; extract?: string }> } };
    const pages = pData.query?.pages;
    if (!pages) return null;

    const firstPage = Object.values(pages)[0];
    if (!firstPage || !firstPage.extract || firstPage.extract.length < 50) return null;

    return {
      title: firstPage.title,
      extract: firstPage.extract.slice(0, 1400),
      url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(firstPage.title.replace(/ /g, '_'))}`,
    };
  } catch (err) {
    console.warn(`[Wiki fetch] Failed for ${title}:`, err);
    return null;
  }
}

// Module state for monitoring and job control
class QuestionGrowthJobManager {
  private isRunning: boolean = false;
  private lastRunAt: string | null = null;
  private lastRunGeneratedCount: number = 0;
  private lastRunSkippedCount: number = 0;
  private lastRunCallsUsed: number = 0;
  private lastError: string | null = null;
  private cronTask: ScheduledTask | null = null;
  private onBankUpdated?: () => void;

  public init(onBankUpdatedCallback?: () => void) {
    this.onBankUpdated = onBankUpdatedCallback;

    const scheduleExpr = process.env.QUESTION_BANK_GROWTH_SCHEDULE || DEFAULT_SCHEDULE;
    const batchSize = parseInt(process.env.QUESTION_BANK_BATCH_SIZE || String(DEFAULT_BATCH_SIZE), 10);
    const maxRunCalls = parseInt(process.env.QUESTION_BANK_MAX_RUN_CALLS || String(DEFAULT_MAX_RUN_CALLS), 10);

    if (!cron.validate(scheduleExpr)) {
      console.error(`❌ [Question Growth Scheduler] Invalid cron expression: "${scheduleExpr}". Using default "${DEFAULT_SCHEDULE}"`);
    }

    const effectiveSchedule = cron.validate(scheduleExpr) ? scheduleExpr : DEFAULT_SCHEDULE;

    console.log(`🕒 [Question Growth Scheduler] Scheduled auto-growth job configured:`);
    console.log(`   - Cron Schedule: "${effectiveSchedule}"`);
    console.log(`   - Target Batch Size: ${batchSize} questions per run`);
    console.log(`   - Dedicated Run Safety Cap: ${maxRunCalls} AI calls (independent of live traffic)`);

    this.cronTask = cron.schedule(effectiveSchedule, async () => {
      console.log(`\n⏰ [Question Growth Scheduler] Triggered scheduled batch generation at ${new Date().toISOString()}...`);
      await this.runGenerationBatch(batchSize, maxRunCalls);
    });
  }

  public getStatus(): GrowthJobStatus {
    const scheduleExpr = process.env.QUESTION_BANK_GROWTH_SCHEDULE || DEFAULT_SCHEDULE;
    const batchSize = parseInt(process.env.QUESTION_BANK_BATCH_SIZE || String(DEFAULT_BATCH_SIZE), 10);
    const maxRunCalls = parseInt(process.env.QUESTION_BANK_MAX_RUN_CALLS || String(DEFAULT_MAX_RUN_CALLS), 10);
    const currentBank = readExistingBank();

    return {
      enabled: Boolean(process.env.GEMINI_API_KEY),
      schedule: scheduleExpr,
      batchSize,
      maxCallsPerRun: maxRunCalls,
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastRunGeneratedCount: this.lastRunGeneratedCount,
      lastRunSkippedCount: this.lastRunSkippedCount,
      lastRunCallsUsed: this.lastRunCallsUsed,
      totalBankCount: currentBank.length,
      lastError: this.lastError,
    };
  }

  public async runGenerationBatch(targetBatchSize?: number, maxRunCallsLimit?: number): Promise<{
    generated: number;
    skipped: number;
    callsUsed: number;
    totalBank: number;
  }> {
    if (this.isRunning) {
      console.warn('⚠️ [Question Growth Job] Job is already running. Skipping concurrent execution.');
      const current = readExistingBank();
      return { generated: 0, skipped: 0, callsUsed: 0, totalBank: current.length };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ [Question Growth Job] GEMINI_API_KEY is not set. Cannot run scheduled generation.');
      this.lastError = 'GEMINI_API_KEY is missing';
      const current = readExistingBank();
      return { generated: 0, skipped: 0, callsUsed: 0, totalBank: current.length };
    }

    const batchSize = targetBatchSize || parseInt(process.env.QUESTION_BANK_BATCH_SIZE || String(DEFAULT_BATCH_SIZE), 10);
    const maxCalls = maxRunCallsLimit || parseInt(process.env.QUESTION_BANK_MAX_RUN_CALLS || String(DEFAULT_MAX_RUN_CALLS), 10);

    this.isRunning = true;
    this.lastError = null;
    let scheduledAiCallsCount = 0; // Dedicated run accounting - separate from visitor live quota
    let totalGeneratedInRun = 0;
    let totalSkippedInRun = 0;

    console.log(`🚀 [Question Growth Job] Starting background run (target: ${batchSize} questions, safety cap: ${maxCalls} AI calls)...`);

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build-growth-job',
          },
        },
      });

      // Shuffle categories & queries to maintain topic variety across weekly runs
      const shuffledCategories = shuffleArray(CATEGORIES);

      outerLoop:
      for (const category of shuffledCategories) {
        if (totalGeneratedInRun >= batchSize || scheduledAiCallsCount >= maxCalls) {
          break outerLoop;
        }

        const queries = shuffleArray(TOPIC_SEARCH_QUERIES[category] || []);

        for (const query of queries) {
          if (totalGeneratedInRun >= batchSize || scheduledAiCallsCount >= maxCalls) {
            break outerLoop;
          }

          try {
            const article = await fetchWikiArticleSummary(query);
            if (!article) continue;

            const queryBatch: WikiQuestion[] = [];
            const selectedDifficulties = shuffleArray(DIFFICULTIES).slice(0, 2);

            for (const diff of selectedDifficulties) {
              if (totalGeneratedInRun >= batchSize || scheduledAiCallsCount >= maxCalls) {
                break outerLoop;
              }

              const prompt = `Ты — эксперт русской Википедии и составитель элитарной интеллектуальной викторины.
Составь 2 уникальных вопроса по статье:
Заголовок: "${article.title}"
Категория: "${category}"
Сложность: "${diff}"
Фрагмент статьи:
${article.extract}

СТРОЖАЙШИЕ ПРАВИЛА:
1. СТРОГО 1 вопрос с выбором из 4 вариантов (multiple_choice, ровно 4 варианта в options, один из которых correctAnswer).
2. СТРОГО 1 открытый вопрос (open_ended).
3. ПРАВИЛО ОДНОЗНАЧНОСТИ И ОДНОРОДНОСТИ: В вопросе с 4 вариантами ОБЯЗАТЕЛЬНО укажи уникальный признак (название произведения в кавычках, точный год, имя персонажа или закон), чтобы правильным был СТРОГО ОДИН вариант, а остальные 3 — заведомо ложными, но из ТОЙ ЖЕ предметной области / эпохи / жанра (однородные дистракторы).
4. ЗАПРЕТ УТЕЧКИ: В тексте вопроса КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО называть ответ!
5. Ответы и вопросы должны быть на чистом русском языке.`;

              // Increment dedicated scheduled call counter
              scheduledAiCallsCount++;

              const res = await ai.models.generateContent({
                model: GEMINI_MODEL,
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.ARRAY,
                    description: 'Список из 2 вопросов по статье Википедии',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ['multiple_choice', 'open_ended'] },
                        options: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: '4 однородных варианта для multiple_choice или пустой массив для open_ended',
                        },
                        correctAnswer: { type: Type.STRING },
                        acceptableAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
                        explanation: { type: Type.STRING },
                      },
                      required: ['question', 'type', 'correctAnswer', 'explanation'],
                    },
                  },
                },
              });

              const text = res.text;
              if (text) {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) {
                  for (const q of parsed) {
                    if (!q.question || !q.correctAnswer) continue;
                    let opts = Array.isArray(q.options) ? q.options.filter((o: any) => typeof o === 'string' && o.trim().length > 0) : [];
                    if (q.type === 'multiple_choice' && opts.length >= 2 && !opts.includes(q.correctAnswer)) {
                      opts.unshift(q.correctAnswer);
                    }

                    const item: WikiQuestion = {
                      id: `growth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      question: q.question.trim(),
                      type: q.type === 'multiple_choice' ? 'multiple_choice' : 'open_ended',
                      options: q.type === 'multiple_choice' ? opts.slice(0, 4) : undefined,
                      correctAnswer: q.correctAnswer.trim(),
                      acceptableAnswers: Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : [q.correctAnswer.trim()],
                      category,
                      difficulty: diff,
                      explanation: q.explanation || `Факт из статьи Википедии: «${article.title}»`,
                      articleUrl: article.url,
                      articleTitle: article.title,
                      generatedAt: Date.now(),
                    };

                    queryBatch.push(item);
                  }
                }
              }

              // Pause between background calls to avoid bursts
              await new Promise((r) => setTimeout(r, 1200));
            }

            // Append & dedupe batch incrementally
            if (queryBatch.length > 0) {
              const resAppend = appendAndSaveQuestions(queryBatch);
              totalGeneratedInRun += resAppend.added;
              totalSkippedInRun += resAppend.skipped;

              // Notify in-memory bank update
              if (this.onBankUpdated) {
                this.onBankUpdated();
              }
            }
          } catch (err) {
            console.warn(`  ⚠️ [Question Growth Job] Error on query "${query}":`, err);
          }
        }
      }

      const finalBank = readExistingBank();
      this.lastRunAt = new Date().toISOString();
      this.lastRunGeneratedCount = totalGeneratedInRun;
      this.lastRunSkippedCount = totalSkippedInRun;
      this.lastRunCallsUsed = scheduledAiCallsCount;

      console.log(`\n🎉 [Question Growth Job] RUN COMPLETED:`);
      console.log(`   - Generated & Appended: ${totalGeneratedInRun} new questions`);
      console.log(`   - Skipped Similar/Duplicate: ${totalSkippedInRun} questions`);
      console.log(`   - AI Calls Used: ${scheduledAiCallsCount} (dedicated run budget)`);
      console.log(`   - Current Total in Bank: ${finalBank.length} questions in ${DATA_FILE}`);

      return {
        generated: totalGeneratedInRun,
        skipped: totalSkippedInRun,
        callsUsed: scheduledAiCallsCount,
        totalBank: finalBank.length,
      };
    } catch (error: any) {
      console.error('❌ [Question Growth Job] Unhandled error during generation run:', error);
      this.lastError = error?.message || String(error);
      const finalBank = readExistingBank();
      return {
        generated: totalGeneratedInRun,
        skipped: totalSkippedInRun,
        callsUsed: scheduledAiCallsCount,
        totalBank: finalBank.length,
      };
    } finally {
      this.isRunning = false;
    }
  }
}

export const questionGrowthJob = new QuestionGrowthJobManager();
