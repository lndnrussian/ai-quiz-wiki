import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'quiz.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS generated_questions (
    id TEXT PRIMARY KEY,
    question TEXT,
    type TEXT,
    options_json TEXT,
    correctAnswer TEXT,
    acceptableAnswers_json TEXT,
    explanation TEXT,
    articleTitle TEXT,
    articleUrl TEXT,
    articleExtract TEXT,
    thumbnailUrl TEXT,
    difficulty TEXT,
    category TEXT,
    pageviews INTEGER,
    popularityLabel TEXT,
    popularityTier TEXT,
    generatedAt INTEGER,
    normalizedQuestion TEXT UNIQUE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS chgk_questions (
    id TEXT PRIMARY KEY,
    tournamentTitle TEXT,
    tourId TEXT,
    tournamentUrl TEXT,
    questionUrl TEXT,
    questionNumber INTEGER,
    question TEXT,
    answer TEXT,
    passCriteria TEXT,
    comments TEXT,
    sources TEXT,
    authors TEXT
  );
`);

// Автоматический сидинг SQLite данными из JSON при пустых таблицах
function seedDatabaseIfEmpty() {
  try {
    // 1. Сидинг generated_questions
    const genCountRow = db.prepare('SELECT COUNT(*) AS count FROM generated_questions').get() as { count: number };
    if (genCountRow.count === 0) {
      const generatedPath = path.join(dataDir, 'generated-questions.json');
      if (fs.existsSync(generatedPath)) {
        try {
          const rawData = fs.readFileSync(generatedPath, 'utf-8');
          if (!rawData.trim()) {
            console.warn(`[db:seed] Файл ${generatedPath} пуст, сидинг generated_questions пропущен.`);
          } else {
            const questions = JSON.parse(rawData);
            if (Array.isArray(questions) && questions.length > 0) {
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

              let insertedCount = 0;
              const seedGenBatch = db.transaction((items: any[]) => {
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
                  if (info.changes > 0) insertedCount++;
                }
              });

              seedGenBatch(questions);
              console.log(`[db:seed] generated_questions: успешно засеяно ${insertedCount} записей.`);
            } else {
              console.warn(`[db:seed] В файле ${generatedPath} нет записей для сидинга.`);
            }
          }
        } catch (err) {
          console.warn(`[db:seed] Ошибка при чтении или парсинге ${generatedPath}:`, err);
        }
      } else {
        console.warn(`[db:seed] Файл ${generatedPath} не найден, сидинг generated_questions пропущен.`);
      }
    } else {
      console.log(`[db:seed] generated_questions: сидинг не требовался (в таблице уже есть ${genCountRow.count} записей).`);
    }

    // 2. Сидинг chgk_questions
    const chgkCountRow = db.prepare('SELECT COUNT(*) AS count FROM chgk_questions').get() as { count: number };
    if (chgkCountRow.count === 0) {
      const chgkPath = path.join(dataDir, 'chgk-catalog.json');
      if (fs.existsSync(chgkPath)) {
        try {
          const rawChgkData = fs.readFileSync(chgkPath, 'utf-8');
          if (!rawChgkData.trim()) {
            console.warn(`[db:seed] Файл ${chgkPath} пуст, сидинг chgk_questions пропущен.`);
          } else {
            const chgkQuestions = JSON.parse(rawChgkData);
            if (Array.isArray(chgkQuestions) && chgkQuestions.length > 0) {
              const insertChgk = db.prepare(`
                INSERT OR IGNORE INTO chgk_questions (
                  id, tournamentTitle, tourId, tournamentUrl, questionUrl,
                  questionNumber, question, answer, passCriteria, comments, sources, authors
                ) VALUES (
                  @id, @tournamentTitle, @tourId, @tournamentUrl, @questionUrl,
                  @questionNumber, @question, @answer, @passCriteria, @comments, @sources, @authors
                )
              `);

              let insertedCount = 0;
              const seedChgkBatch = db.transaction((items: any[]) => {
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
                  if (info.changes > 0) insertedCount++;
                }
              });

              seedChgkBatch(chgkQuestions);
              console.log(`[db:seed] chgk_questions: успешно засеяно ${insertedCount} записей.`);
            } else {
              console.warn(`[db:seed] В файле ${chgkPath} нет записей для сидинга.`);
            }
          }
        } catch (err) {
          console.warn(`[db:seed] Ошибка при чтении или парсинге ${chgkPath}:`, err);
        }
      } else {
        console.warn(`[db:seed] Файл ${chgkPath} не найден, сидинг chgk_questions пропущен.`);
      }
    } else {
      console.log(`[db:seed] chgk_questions: сидинг не требовался (в таблице уже есть ${chgkCountRow.count} записей).`);
    }
  } catch (err) {
    console.warn('[db:seed] Непредвиденная ошибка при сидинге базы данных:', err);
  }
}

seedDatabaseIfEmpty();

export default db;
