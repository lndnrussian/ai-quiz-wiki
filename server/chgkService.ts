import fs from 'fs';
import path from 'path';
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

// Helper to clean HTML text
function cleanText(html: string): string {
  if (!html) return '';
  return html
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

// Parse HTML page of a tour from db.chgk.info
function parseQuestionsFromHtml(html: string, tourId: string, defaultTitle: string): RawChgkQuestion[] {
  const titleMatch = html.match(/<title>([^<|]+)/);
  const tournamentTitle = titleMatch ? cleanText(titleMatch[1]) : defaultTitle;

  const qBlocks = html.split(/<div class="question"/g).slice(1);
  const questions: RawChgkQuestion[] = [];

  for (const block of qBlocks) {
    const endDiv = block.indexOf('</div></div>');
    const content = endDiv !== -1 ? block.slice(0, endDiv + 12) : block;

    const qHeaderMatch = content.match(
      /<strong class="Question">\s*<a href="([^"]+)">Вопрос\s*(\d+)<\/a>\s*:<\/strong>([\s\S]*?)(?:<div|<p\s*class|<p>\s*<strong class="Answer")/i
    );
    if (!qHeaderMatch) continue;

    const qUrl = 'https://db.chgk.info' + qHeaderMatch[1];
    const qNum = parseInt(qHeaderMatch[2], 10);
    const qText = cleanText(qHeaderMatch[3]);

    const ansMatch = content.match(/<strong class="Answer">Ответ:<\/strong>([\s\S]*?)<\/p>/i);
    const answer = ansMatch ? cleanText(ansMatch[1]) : '';
    if (!qText || !answer) continue;

    const passMatch = content.match(/<strong class="PassCriteria">Зачёт:<\/strong>([\s\S]*?)<\/p>/i);
    const passCriteria = passMatch ? cleanText(passMatch[1]) : undefined;

    const comMatch = content.match(/<strong class="Comments">Комментарий:<\/strong>([\s\S]*?)<\/p>/i);
    const comments = comMatch ? cleanText(comMatch[1]) : undefined;

    const srcMatch = content.match(/<strong class="Sources">Источник\(и\):<\/strong>([\s\S]*?)<\/p>/i);
    const sources = srcMatch ? cleanText(srcMatch[1]) : undefined;

    const authMatch = content.match(/<strong class="Authors">Автор:<\/strong>([\s\S]*?)<\/p>/i);
    const authors = authMatch ? cleanText(authMatch[1]) : undefined;

    questions.push({
      id: `chgk_${tourId}_${qNum}`,
      tournamentTitle,
      tourId,
      tournamentUrl: `https://db.chgk.info/tour/${tourId}`,
      questionUrl: qUrl,
      questionNumber: qNum,
      question: qText,
      answer,
      passCriteria,
      comments,
      sources,
      authors,
    });
  }

  return questions;
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

// Fetch questions for a tournament (from cache or live db.chgk.info)
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

  // Try fetching live from db.chgk.info
  const targetId = tourId === 'random' ? 'ovsch20.1_u' : tourId;
  try {
    console.log(`[ChGK Service] Live fetching tournament from https://db.chgk.info/tour/${targetId}`);
    const tourMeta = CHGK_TOURNAMENTS.find((t) => t.id === targetId);
    const res = await fetch(`https://db.chgk.info/tour/${targetId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (res.ok) {
      const html = await res.text();
      const parsed = parseQuestionsFromHtml(html, targetId, tourMeta?.title || targetId);
      if (parsed.length > 0) {
        tournamentCache.set(targetId, parsed);
        console.log(`[ChGK Service] Successfully cached ${parsed.length} questions for ${targetId}`);
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[ChGK Service] Live fetch failed for ${targetId}:`, (err as Error).message);
  }

  // Fallback to all cached questions
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
