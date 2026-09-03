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

export default db;
