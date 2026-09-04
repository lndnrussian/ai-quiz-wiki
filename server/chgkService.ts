import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import db from './db';
import { WikiQuestion } from '../src/types';
import { parseQuestionHandout } from '../src/utils/handoutParser';

export interface RawChgkQuestion {
  id: string;
  tournamentTitle: string;
  tourId: string;
  tournamentUrl: string;
  questionUrl: string;
  questionNumber: number;
  question: string;
  answer: string;
  passCriteria?: string;
  comments?: string;
  sources?: string;
  authors?: string;
}

export interface ChgkTournamentInfo {
  id: string;
  title: string;
  description: string;
  year?: string;
  type: string;
}

export const CHGK_TOURNAMENTS: ChgkTournamentInfo[] = [
  {
    id: 'random',
    title: '🎲 Случайные турнирные вопросы',
    description: 'Микс вопросов из различных синхронов и кубков базы db.chgk.info',
    type: 'Сборный пакет',
  },
  {
    id: 'ovsch20.1_u',
    title: '🏆 ОВСЧ — Открытый всероссийский синхронный чемпионат',
    description: 'Классический эталонный синхрон высшей категории сложности',
    year: '2020',
    type: 'Синхрон',
  },
  {
    id: 'thanos20.1_u',
    title: '💎 Кубок Бесконечности (Камень Реальности)',
    description: 'Популярный турнирный цикл командных игр с остроумными ассоциациями',
    year: '2020',
    type: 'Кубок',
  },
  {
    id: 'malakh20_u',
    title: '📦 Малахитовая шкатулка',
    description: 'Уральский турнир с глубокими культурологическими и историческими вопросами',
    year: '2020',
    type: 'Синхрон',
  },
  {
    id: 'druz',
    title: '🦉 Пакет Александра Друзя',
    description: 'Золотая классика от магистра телеигры «Что? Где? Когда?»',
    year: 'Классика',
    type: 'Авторский пакет',
  },
  {
    id: 'potash',
    title: '🧠 Пакет Максима Поташева',
    description: 'Вопросы от магистра и четырехкратного обладателя «Хрустальной совы»',
    year: 'Классика',
    type: 'Авторский пакет',
  },
  {
    id: 'fizcup20_u',
    title: '⚛️ Кубок Физтеха по интеллектуальным играм',
    description: 'Турнир МФТИ с вопросами на логику, науку и нестандартное мышление',
    year: '2020',
    type: 'Студенческий кубок',
  },
  {
    id: 'zemli20.1_u',
    title: '🌍 Бесконечные земли: том I',
    description: 'Асинхронный турнир с широким кругозором и яркими сюжетами',
    year: '2020',
    type: 'Асинхрон',
  },
];

// In-memory cache for parsed tournaments
const tournamentCache = new Map<string, RawChgkQuestion[]>();

// Official User-Agent for external queries to db.chgk.info containing application name and contact
const CHGK_USER_AGENT =
  'WikiQuizApp/1.0 (https://ais-dev-pdh4u67tfy6jfhq5hmed5u-906541964448.asia-east1.run.app; contact: LndnRussian@gmail.com)';

// XML parser instance keeping string values unparsed so question text/dates are preserved
const xmlParser = new XMLParser({
  trimValues: true,
  parseTagValue: false,
  ignoreAttributes: false,
});

// Helper to clean XML/HTML text and decode HTML entities while preserving image handouts
function cleanText(val: any): string {
  if (val == null) return '';
  let text = typeof val === 'string' ? val : String(val);
  // Decode HTML-encoded <img> tags if present
  text = text.replace(/&lt;img\s+[^&]*?src=["']([^"']+)["'][^&]*?&gt;/gi, ' (pic: $1) ');
  // Convert standard <img> tags to (pic: URL) so image handouts are preserved
  text = text.replace(/<img\s+[^>]*?src=["']([^"']+)["'][^>]*>/gi, ' (pic: $1) ');
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&shy;/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ParsedTournamentXml {
  tournamentTitle: string;
  questions: RawChgkQuestion[];
  childTourIds: string[];
}

// Parse official db.chgk.info tournament XML into RawChgkQuestion structure
function parseQuestionsFromXml(
  xml: string,
  tourId: string,
  defaultTitle: string,
  mainTournamentTitle?: string
): ParsedTournamentXml {
  try {
    const data = xmlParser.parse(xml);
    const tourNode = data.tournament || data.tour || {};
    const localTitle = cleanText(tourNode.Title);
    const tournamentTitle = mainTournamentTitle || localTitle || defaultTitle;

    const rawQuestions: any[] = tourNode.question
      ? Array.isArray(tourNode.question)
        ? tourNode.question
        : [tourNode.question]
      : [];

    const questions: RawChgkQuestion[] = [];

    for (const q of rawQuestions) {
      const qText = cleanText(q.Question);
      const aText = cleanText(q.Answer);
      if (!qText || !aText) continue;

      const qNum = parseInt(String(q.Number || '1'), 10) || 1;
      const parentTextId = cleanText(q.ParentTextId || q.parent_text_id || tourId);
      const qUrl = parentTextId
        ? `https://db.chgk.info/question/${parentTextId}/${qNum}`
        : `https://db.chgk.info/question/${tourId}/${qNum}`;

      const passCriteria = cleanText(q.PassCriteria) || undefined;
      const comments = cleanText(q.Comments) || undefined;
      const sources = cleanText(q.Sources) || undefined;
      const authors = cleanText(q.Authors) || undefined;

      const safeIdPart = (parentTextId || tourId).replace(/[^a-zA-Z0-9_]/g, '_');
      questions.push({
        id: `chgk_${safeIdPart}_${qNum}`,
        tournamentTitle,
        tourId,
        tournamentUrl: `https://db.chgk.info/tour/${tourId}`,
        questionUrl: qUrl,
        questionNumber: qNum,
        question: qText,
        answer: aText,
        passCriteria,
        comments,
        sources,
        authors,
      });
    }

    const rawTours: any[] = tourNode.tour
      ? Array.isArray(tourNode.tour)
        ? tourNode.tour
        : [tourNode.tour]
      : [];

    const childTourIds: string[] = rawTours
      .map((t: any) => cleanText(t.TextId))
      .filter((tId: string) => Boolean(tId));

    return { tournamentTitle, questions, childTourIds };
  } catch (err) {
    console.warn(`[ChGK Service] Error parsing XML for ${tourId}:`, err);
    return { tournamentTitle: defaultTitle, questions: [], childTourIds: [] };
  }
}

// Parse XML containing random questions from multiple tournaments (db.chgk.info /xml/random)
export function parseRandomChgkXml(xml: string): RawChgkQuestion[] {
  try {
    const data = xmlParser.parse(xml);
    const rootNode =
      data && typeof data === 'object'
        ? data.search || data.tournament || data.tour || data
        : {};

    const rawQuestions: any[] =
      rootNode && typeof rootNode === 'object' && rootNode.question
        ? Array.isArray(rootNode.question)
          ? rootNode.question
          : [rootNode.question]
        : [];

    const questions: RawChgkQuestion[] = [];

    for (let i = 0; i < rawQuestions.length; i++) {
      const q = rawQuestions[i];
      if (!q || typeof q !== 'object') continue;

      const qText = cleanText(q.Question || q.question);
      const aText = cleanText(q.Answer || q.answer);
      if (!qText || !aText) continue;

      const qNum = parseInt(String(q.Number || q.questionNumber || q.number || '1'), 10) || 1;

      // Determine tourId individually for this question
      let tourId = cleanText(
        q.TourId ||
        q.tourId ||
        q.ParentTextId ||
        q.parent_text_id ||
        q.tour_text_id ||
        q.Tour ||
        q.tour
      );

      // If tourId is not provided, try to extract from TextId (e.g., "ovsch20.1_u.1-1" -> "ovsch20.1_u.1")
      if (!tourId && q.TextId) {
        const textId = cleanText(q.TextId);
        const match = textId.match(/^([a-zA-Z0-9_.-]+?)(?:-\d+)?$/);
        if (match && match[1]) {
          tourId = match[1];
        }
      }

      if (!tourId) {
        tourId = 'random';
      }

      // Determine tournamentTitle individually for this question
      let tournamentTitle = cleanText(
        q.TournamentTitle ||
        q.tournamentTitle ||
        q.Tournament ||
        q.tournament ||
        q.TourTitle ||
        q.tourTitle ||
        q.TournamentName ||
        q.tournamentName ||
        q.Title ||
        q.title
      );

      if (!tournamentTitle) {
        const known = CHGK_TOURNAMENTS.find(
          (t) => t.id === tourId || (t.id !== 'random' && (tourId.startsWith(t.id) || t.id.startsWith(tourId)))
        );
        if (known) {
          tournamentTitle = known.title;
        } else if (tourId && tourId !== 'random') {
          tournamentTitle = `Турнир db.chgk.info (${tourId})`;
        } else {
          tournamentTitle = 'База «Что? Где? Когда?» (db.chgk.info)';
        }
      }

      const rawQId = cleanText(q.QuestionId || q.questionId);
      const id = rawQId
        ? `chgk_${rawQId}`
        : (tourId && tourId !== 'random'
            ? `chgk_${tourId}_${qNum}`
            : `chgk_rnd_${Date.now()}_${i + 1}`);

      const parentTextId = cleanText(q.ParentTextId || q.parent_text_id || tourId);
      const questionUrl =
        parentTextId && parentTextId !== 'random'
          ? `https://db.chgk.info/question/${parentTextId}/${qNum}`
          : (rawQId
              ? `https://db.chgk.info/question/${rawQId}`
              : (tourId && tourId !== 'random' ? `https://db.chgk.info/tour/${tourId}` : 'https://db.chgk.info'));

      const tournamentUrl =
        tourId && tourId !== 'random'
          ? `https://db.chgk.info/tour/${tourId}`
          : 'https://db.chgk.info';

      const passCriteria = cleanText(q.PassCriteria || q.passCriteria) || undefined;
      const comments = cleanText(q.Comments || q.comments) || undefined;
      const sources = cleanText(q.Sources || q.sources) || undefined;
      const authors = cleanText(q.Authors || q.authors) || undefined;

      questions.push({
        id,
        tournamentTitle,
        tourId,
        tournamentUrl,
        questionUrl,
        questionNumber: qNum,
        question: qText,
        answer: aText,
        passCriteria,
        comments,
        sources,
        authors,
      });
    }

    return questions;
  } catch (err) {
    console.warn('[ChGK Service] Error parsing random XML batch:', err);
    return [];
  }
}

// Load initial questions from SQLite chgk_questions table
export function initializeChgkCatalog() {
  try {
    tournamentCache.clear();
    const questions = db.prepare('SELECT * FROM chgk_questions').all() as RawChgkQuestion[];
    for (const q of questions) {
      if (!tournamentCache.has(q.tourId)) {
        tournamentCache.set(q.tourId, []);
      }
      tournamentCache.get(q.tourId)!.push(q);
    }
    console.log(`[ChGK Service] Loaded ${questions.length} questions across ${tournamentCache.size} tournaments into cache from SQLite.`);
  } catch (err) {
    console.error('[ChGK Service] Error loading questions from chgk_questions table:', err);
  }
}

// Helper to fetch with exponential backoff retry on network errors or 429/503 status
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries: number = 3): Promise<Response> {
  const delays = [500, 1500, 3000];
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status === 503) {
        if (attempt < maxRetries) {
          const delay = delays[attempt] ?? 3000;
          console.warn(`[ChGK Service] Received HTTP ${res.status} from ${url}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`HTTP ${res.status} when fetching ${url}`);
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = delays[attempt] ?? 3000;
        console.warn(`[ChGK Service] Error fetching ${url}: ${(err as Error).message}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

// Fetch questions for a tournament (from cache or live db.chgk.info XML export)
export async function getQuestionsForTournament(tourId: string): Promise<RawChgkQuestion[]> {
  if (tourId !== 'random' && tournamentCache.has(tourId) && (tournamentCache.get(tourId)?.length || 0) > 0) {
    return tournamentCache.get(tourId)!;
  }

  if (tourId === 'random') {
    // Collect all available cached questions
    const all: RawChgkQuestion[] = [];
    for (const qs of tournamentCache.values()) {
      all.push(...qs);
    }
    if (all.length > 0) {
      return all;
    }
  }

  // Try fetching live from official db.chgk.info XML export
  const targetId = tourId === 'random' ? 'ovsch20.1_u' : tourId;
  const tourMeta = CHGK_TOURNAMENTS.find((t) => t.id === targetId);
  const defaultTitle = tourMeta?.title || targetId;

  try {
    const xmlUrl = `https://db.chgk.info/tour/${targetId}/xml`;
    console.log(`[ChGK Service] Live fetching tournament XML from ${xmlUrl}`);

    const res = await fetchWithRetry(xmlUrl, {
      headers: {
        'User-Agent': CHGK_USER_AGENT,
        'Accept': 'application/xml, text/xml, */*',
      },
    });

    if (res.ok) {
      const xml = await res.text();
      const parsed = parseQuestionsFromXml(xml, targetId, defaultTitle);
      let questions = parsed.questions;

      // If top-level tournament has sub-tours and no direct questions, fetch child tours' XML
      if (questions.length === 0 && parsed.childTourIds.length > 0) {
        console.log(`[ChGK Service] Fetching ${parsed.childTourIds.length} sub-tours for ${targetId}...`);
        const subTourResults = await Promise.allSettled(
          parsed.childTourIds.map(async (childId) => {
            const childRes = await fetchWithRetry(`https://db.chgk.info/tour/${childId}/xml`, {
              headers: {
                'User-Agent': CHGK_USER_AGENT,
                'Accept': 'application/xml, text/xml, */*',
              },
            });
            if (!childRes.ok) return [];
            const childXml = await childRes.text();
            const childParsed = parseQuestionsFromXml(
              childXml,
              targetId,
              parsed.tournamentTitle,
              parsed.tournamentTitle
            );
            return childParsed.questions;
          })
        );

        for (const r of subTourResults) {
          if (r.status === 'fulfilled') {
            questions.push(...r.value);
          }
        }
      }

      if (questions.length > 0) {
        // Sort questions by questionNumber
        questions.sort((a, b) => a.questionNumber - b.questionNumber);
        tournamentCache.set(targetId, questions);

        // Persist into SQLite chgk_questions table (INSERT OR IGNORE)
        try {
          const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO chgk_questions (
              id, tournamentTitle, tourId, tournamentUrl, questionUrl,
              questionNumber, question, answer, passCriteria, comments, sources, authors
            ) VALUES (
              @id, @tournamentTitle, @tourId, @tournamentUrl, @questionUrl,
              @questionNumber, @question, @answer, @passCriteria, @comments, @sources, @authors
            )
          `);
          const insertBatch = db.transaction((items: RawChgkQuestion[]) => {
            for (const item of items) {
              insertStmt.run({
                id: item.id,
                tournamentTitle: item.tournamentTitle ?? null,
                tourId: item.tourId ?? null,
                tournamentUrl: item.tournamentUrl ?? null,
                questionUrl: item.questionUrl ?? null,
                questionNumber: item.questionNumber ?? null,
                question: item.question ?? '',
                answer: item.answer ?? '',
                passCriteria: item.passCriteria ?? null,
                comments: item.comments ?? null,
                sources: item.sources ?? null,
                authors: item.authors ?? null,
              });
            }
          });
          insertBatch(questions);
        } catch (dbErr) {
          console.warn('[ChGK Service] Error saving live questions to SQLite chgk_questions:', dbErr);
        }

        console.log(`[ChGK Service] Successfully cached and persisted ${questions.length} questions from XML for ${targetId}`);
        return questions;
      }
    } else {
      console.warn(`[ChGK Service] HTTP ${res.status} when fetching XML for ${targetId}`);
    }
  } catch (err) {
    console.warn(`[ChGK Service] Live XML fetch failed for ${targetId}:`, (err as Error).message);
  }

  // Fallback to all cached questions across all tournaments in tournamentCache
  const fallbackList: RawChgkQuestion[] = [];
  for (const qs of tournamentCache.values()) {
    fallbackList.push(...qs);
  }
  return fallbackList;
}

// Fetch a batch of random questions from multiple tournaments via db.chgk.info /xml/random
export async function getRandomChgkBatch(limit: number = 100): Promise<RawChgkQuestion[]> {
  const url = `https://db.chgk.info/xml/random/limit${limit}`;
  console.log(`[ChGK Service] Fetching random questions batch from ${url}`);

  try {
    const res = await fetchWithRetry(url, {
      headers: {
        'User-Agent': CHGK_USER_AGENT,
        'Accept': 'application/xml, text/xml, */*',
      },
    });

    if (!res.ok) {
      console.warn(`[ChGK Service] HTTP ${res.status} when fetching random questions from ${url}`);
      return [];
    }

    const xml = await res.text();
    const questions = parseRandomChgkXml(xml);

    if (questions.length > 0) {
      // Persist into SQLite chgk_questions table (INSERT OR IGNORE)
      try {
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO chgk_questions (
            id, tournamentTitle, tourId, tournamentUrl, questionUrl,
            questionNumber, question, answer, passCriteria, comments, sources, authors
          ) VALUES (
            @id, @tournamentTitle, @tourId, @tournamentUrl, @questionUrl,
            @questionNumber, @question, @answer, @passCriteria, @comments, @sources, @authors
          )
        `);
        const insertBatch = db.transaction((items: RawChgkQuestion[]) => {
          for (const item of items) {
            insertStmt.run({
              id: item.id,
              tournamentTitle: item.tournamentTitle ?? null,
              tourId: item.tourId ?? null,
              tournamentUrl: item.tournamentUrl ?? null,
              questionUrl: item.questionUrl ?? null,
              questionNumber: item.questionNumber ?? null,
              question: item.question ?? '',
              answer: item.answer ?? '',
              passCriteria: item.passCriteria ?? null,
              comments: item.comments ?? null,
              sources: item.sources ?? null,
              authors: item.authors ?? null,
            });
          }
        });
        insertBatch(questions);
      } catch (dbErr) {
        console.warn('[ChGK Service] Error saving random batch to SQLite chgk_questions:', dbErr);
      }

      // Add to in-memory cache
      for (const q of questions) {
        const tId = q.tourId || 'random';
        if (!tournamentCache.has(tId)) {
          tournamentCache.set(tId, []);
        }
        tournamentCache.get(tId)!.push(q);
      }

      console.log(`[ChGK Service] Successfully parsed, cached and persisted ${questions.length} questions from random batch`);
      return questions;
    } else {
      console.log(`[ChGK Service] Random XML batch returned 0 questions from ${url}. Falling back to replenishing from tournament rotation pool...`);
      const candidateTours = [
        'ovsch21.1_u',
        'km15_u',
        'disharm1_u',
        'pudali18_u',
        'okmar22_u',
        'unester09_u',
        'vosh20.1_u',
        'vosh21.1_u',
        'chgkr21_u',
        'letniy21_u',
        'krem21_u',
        'infobash21_u',
      ];

      const collected: RawChgkQuestion[] = [];
      for (const tId of candidateTours) {
        if (collected.length >= limit) break;
        try {
          const tQuestions = await getQuestionsForTournament(tId);
          if (tQuestions && tQuestions.length > 0) {
            collected.push(...tQuestions);
            console.log(`[ChGK Service] Replenished ${tQuestions.length} questions from tour ${tId} (total collected: ${collected.length})`);
          }
        } catch (e: any) {
          console.warn(`[ChGK Service] Failed fetching tour ${tId}:`, e?.message || e);
        }
      }
      return collected.slice(0, limit);
    }
  } catch (err) {
    console.warn(`[ChGK Service] Error fetching random questions batch from ${url}:`, (err as Error).message);
    return [];
  }
}

// Convert RawChgkQuestion into WikiQuestion format
export function formatChgkAsWikiQuestion(raw: RawChgkQuestion): WikiQuestion {
  const handout = parseQuestionHandout(raw.question);

  // Build acceptable answers array from answer and passCriteria
  const cleanAns = raw.answer.replace(/\.$/, '').trim();
  const acceptable = [cleanAns];
  if (raw.passCriteria) {
    // Add variations if separated by commas or quotes
    const cleanedPass = raw.passCriteria.replace(/^точный ответ\.?/i, '').trim();
    if (cleanedPass) {
      acceptable.push(cleanedPass);
    }
  }

  // Build explanation incorporating answer, pass criteria, comments, author and source
  let explanationParts: string[] = [];
  if (raw.comments) {
    explanationParts.push(raw.comments);
  }
  if (raw.passCriteria) {
    explanationParts.push(`Зачёт: ${raw.passCriteria}`);
  }
  if (raw.sources) {
    explanationParts.push(`Источник(и): ${raw.sources}`);
  }
  if (raw.authors) {
    explanationParts.push(`Автор: ${raw.authors}`);
  }

  const explanation = explanationParts.join('\n\n') || `Правильный ответ: ${raw.answer}`;

  return {
    id: raw.id,
    question: handout.cleanQuestion || raw.question,
    type: 'open_ended',
    correctAnswer: cleanAns,
    acceptableAnswers: acceptable,
    explanation,
    articleTitle: raw.tournamentTitle,
    articleUrl: raw.questionUrl || raw.tournamentUrl,
    articleExtract: raw.comments || raw.sources || raw.authors || 'База вопросов «Что? Где? Когда?» (db.chgk.info)',
    difficulty: 'hard', // ChGK questions are rigorous and stimulating
    category: 'Что? Где? Когда?',
    popularityTier: 'top_tier',
    popularityLabel: 'База «Что? Где? Когда?» (db.chgk.info)',
    generatedAt: Date.now(),
    sourceSystem: 'chgk',
    handout,
    chgkMetadata: {
      tournamentTitle: raw.tournamentTitle,
      tournamentUrl: raw.tournamentUrl,
      questionNumber: raw.questionNumber,
      questionUrl: raw.questionUrl,
      authors: raw.authors,
      passCriteria: raw.passCriteria,
      sources: raw.sources,
      comments: raw.comments,
      tourId: raw.tourId,
    },
  };
}

// Main function to get formatted questions for game session
export async function getChgkQuestions(
  tournamentId: string = 'random',
  count: number = 1,
  excludeIds: string[] = [],
  filterHandouts: 'all' | 'text_only' = 'all'
): Promise<WikiQuestion[]> {
  const rawList = await getQuestionsForTournament(tournamentId);
  const excludeSet = new Set(excludeIds);

  // Filter out already seen
  let available = rawList.filter((q) => !excludeSet.has(q.id));

  // If all were seen, reuse from rawList
  if (available.length === 0) {
    available = [...rawList];
  }

  // Filter out questions with handouts if requested
  if (filterHandouts === 'text_only') {
    const textOnly = available.filter((q) => {
      const h = parseQuestionHandout(q.question);
      return !h.hasHandout || h.type === 'none';
    });
    if (textOnly.length > 0) {
      available = textOnly;
    }
  }

  // Shuffle available questions
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  return selected.map(formatChgkAsWikiQuestion);
}
