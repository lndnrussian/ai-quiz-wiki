import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { WikiQuestion } from '../src/types';

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

// Helper to clean XML/HTML text and decode HTML entities
function cleanText(val: any): string {
  if (val == null) return '';
  const text = typeof val === 'string' ? val : String(val);
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

      questions.push({
        id: `chgk_${tourId}_${qNum}`,
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

// Load initial questions from data/chgk-catalog.json if available
export function initializeChgkCatalog() {
  try {
    const catalogPath = path.join(process.cwd(), 'data', 'chgk-catalog.json');
    if (fs.existsSync(catalogPath)) {
      const content = fs.readFileSync(catalogPath, 'utf-8');
      const questions: RawChgkQuestion[] = JSON.parse(content);
      for (const q of questions) {
        if (!tournamentCache.has(q.tourId)) {
          tournamentCache.set(q.tourId, []);
        }
        tournamentCache.get(q.tourId)!.push(q);
      }
      console.log(`[ChGK Service] Loaded ${questions.length} questions across ${tournamentCache.size} tournaments into cache.`);
    }
  } catch (err) {
    console.error('[ChGK Service] Error loading chgk-catalog.json:', err);
  }
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

    const res = await fetch(xmlUrl, {
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
            const childRes = await fetch(`https://db.chgk.info/tour/${childId}/xml`, {
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
        console.log(`[ChGK Service] Successfully cached ${questions.length} questions from XML for ${targetId}`);
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

// Convert RawChgkQuestion into WikiQuestion format
export function formatChgkAsWikiQuestion(raw: RawChgkQuestion): WikiQuestion {
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
    question: raw.question,
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
  excludeIds: string[] = []
): Promise<WikiQuestion[]> {
  const rawList = await getQuestionsForTournament(tournamentId);
  const excludeSet = new Set(excludeIds);

  // Filter out already seen
  let available = rawList.filter((q) => !excludeSet.has(q.id));

  // If all were seen, reuse from rawList
  if (available.length === 0) {
    available = [...rawList];
  }

  // Shuffle available questions
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  return selected.map(formatChgkAsWikiQuestion);
}
