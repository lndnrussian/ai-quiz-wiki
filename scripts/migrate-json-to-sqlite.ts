import fs from 'fs';
import path from 'path';
import db from '../server/db';

interface WikiQuestion {
  id: string;
  question: string;
  type?: string;
  options?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  explanation?: string;
  articleTitle?: string;
  articleUrl?: string;
  articleExtract?: string;
  thumbnailUrl?: string;
  difficulty?: string;
  category?: string;
  pageviews?: number;
  popularityLabel?: string;
  popularityTier?: string;
  generatedAt?: number;
}

interface RawChgkQuestion {
  id: string;
  tournamentTitle?: string;
  tourId?: string;
  tournamentUrl?: string;
  questionUrl?: string;
  questionNumber?: number;
  question: string;
  answer: string;
  passCriteria?: string;
  comments?: string;
  sources?: string;
  authors?: string;
}

function migrate() {
  console.log('🚀 Начинаем миграцию данных из JSON в SQLite (data/quiz.db)...\n');

  // 1. Миграция generated_questions
  const generatedPath = path.join(process.cwd(), 'data', 'generated-questions.json');
  let genTransferred = 0;
  let genSkipped = 0;

  if (fs.existsSync(generatedPath)) {
    const rawData = fs.readFileSync(generatedPath, 'utf-8');
    const questions: WikiQuestion[] = JSON.parse(rawData);

    const insertGen = db.prepare(`
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

    const migrateGenBatch = db.transaction((items: WikiQuestion[]) => {
      for (const q of items) {
        const normalized = (q.question || '').trim().toLowerCase();
        const info = insertGen.run({
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
          generatedAt: q.generatedAt ?? null,
          normalizedQuestion: normalized,
        });

        if (info.changes > 0) {
          genTransferred++;
        } else {
          genSkipped++;
        }
      }
    });

    migrateGenBatch(questions);
  } else {
    console.warn(`Файл ${generatedPath} не найден.`);
  }

  // 2. Миграция chgk_questions
  const chgkPath = path.join(process.cwd(), 'data', 'chgk-catalog.json');
  let chgkTransferred = 0;
  let chgkSkipped = 0;

  if (fs.existsSync(chgkPath)) {
    const rawChgkData = fs.readFileSync(chgkPath, 'utf-8');
    const chgkQuestions: RawChgkQuestion[] = JSON.parse(rawChgkData);

    const insertChgk = db.prepare(`
      INSERT OR IGNORE INTO chgk_questions (
        id, tournamentTitle, tourId, tournamentUrl, questionUrl,
        questionNumber, question, answer, passCriteria, comments, sources, authors
      ) VALUES (
        @id, @tournamentTitle, @tourId, @tournamentUrl, @questionUrl,
        @questionNumber, @question, @answer, @passCriteria, @comments, @sources, @authors
      )
    `);

    const migrateChgkBatch = db.transaction((items: RawChgkQuestion[]) => {
      for (const q of items) {
        const info = insertChgk.run({
          id: q.id,
          tournamentTitle: q.tournamentTitle ?? null,
          tourId: q.tourId ?? null,
          tournamentUrl: q.tournamentUrl ?? null,
          questionUrl: q.questionUrl ?? null,
          questionNumber: q.questionNumber ?? null,
          question: q.question ?? '',
          answer: q.answer ?? '',
          passCriteria: q.passCriteria ?? null,
          comments: q.comments ?? null,
          sources: q.sources ?? null,
          authors: q.authors ?? null,
        });

        if (info.changes > 0) {
          chgkTransferred++;
        } else {
          chgkSkipped++;
        }
      }
    });

    migrateChgkBatch(chgkQuestions);
  } else {
    console.warn(`Файл ${chgkPath} не найден.`);
  }

  // 3. Вывод результатов в консоль
  console.log('📊 Результаты миграции:');
  console.log(`- Таблица generated_questions:`);
  console.log(`    Перенесено записей: ${genTransferred}`);
  console.log(`    Пропущено (дубли):   ${genSkipped}`);
  console.log(`- Таблица chgk_questions:`);
  console.log(`    Перенесено записей: ${chgkTransferred}`);
  console.log(`    Пропущено (дубли):   ${chgkSkipped}`);
}

migrate();
