import { HandoutData, WikiQuestion } from '../types';

/**
 * Utility to parse and extract handouts (раздаточный материал), images (pic:),
 * and reader instructions ([чтецу: ...]) from tournament ChGK and quiz questions.
 */
export function parseQuestionHandout(rawText: string): HandoutData {
  const raw = (rawText || '').trim();
  const images: string[] = [];
  let textHandout: string | undefined = undefined;
  let rawHandoutSnippet: string | undefined = undefined;
  let cleanQ = raw;
  const readerNotes: string[] = [];

  // 1. Extract image URLs formatted as (pic: ...) or (picture: ...)
  const picRegex = /\((?:pic|picture):\s*([^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = picRegex.exec(raw)) !== null) {
    let url = match[1].trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Relative file path on db.chgk.info
      url = `https://db.chgk.info/images/library/${url}`;
    }
    if (!images.includes(url)) {
      images.push(url);
    }
  }

  // Also check for standalone URLs inside bracketed pics like [pic: ...]
  const bracketPicRegex = /\[(?:pic|picture):\s*([^\]]+)\]/gi;
  while ((match = bracketPicRegex.exec(raw)) !== null) {
    let url = match[1].trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://db.chgk.info/images/library/${url}`;
    }
    if (!images.includes(url)) {
      images.push(url);
    }
  }

  // 2. Extract reader / host cues like [чтецу: пауза], [Ведущему: 15 секунд]
  const noteRegex = /\[\s*(чтецу|ведущему|командам|игрокам)\s*:\s*([^\]]+)\]/gi;
  while ((match = noteRegex.exec(cleanQ)) !== null) {
    readerNotes.push(`${match[1]}: ${match[2].trim()}`);
  }
  // Remove reader notes from display text
  cleanQ = cleanQ.replace(noteRegex, ' ');

  // 3. Extract [Раздаточный материал: ...] or [Раздатка: ...]
  const bracketHandoutRegex = /\[\s*(?:раздаточный материал|раздатка)\s*:\s*([\s\S]*?)\s*\]/i;
  const bracketMatch = bracketHandoutRegex.exec(cleanQ);

  if (bracketMatch) {
    rawHandoutSnippet = bracketMatch[0];
    const innerContent = bracketMatch[1];
    // Strip inner (pic: ...) tags from textual content
    const innerWithoutPics = innerContent.replace(/\((?:pic|picture):\s*[^)]+\)/gi, '').trim();
    if (innerWithoutPics) {
      textHandout = innerWithoutPics;
    }
    // Remove the bracketed block from the question
    cleanQ = cleanQ.slice(0, bracketMatch.index) + ' ' + cleanQ.slice(bracketMatch.index + bracketMatch[0].length);
  } else {
    // Check for leading "Раздаточный материал: (pic: ...)" or "Раздаточный материал. ..."
    const leadMatch = cleanQ.match(/^(?:раздаточный материал|раздатка)[:.]\s*/i);
    if (leadMatch) {
      const rest = cleanQ.slice(leadMatch[0].length).trim();
      const picMatch = rest.match(/^\((?:pic|picture):\s*[^)]+\)\s*/i);
      if (picMatch) {
        rawHandoutSnippet = leadMatch[0] + picMatch[0];
        cleanQ = rest.slice(picMatch[0].length).trim();
      } else {
        // May have a physical handout mentioned or inline handout text
        // E.g. "Раздаточный материал. ПРОПУСК, 100110 Это заголовок..."
        const tokenMatch = rest.match(/^([A-ZА-Я0-9_*, —]+)[.!]?\s+(?=[А-ЯA-Z«])/);
        if (tokenMatch && tokenMatch[1].length < 40) {
          textHandout = tokenMatch[1].trim();
          rawHandoutSnippet = leadMatch[0] + tokenMatch[0];
          cleanQ = rest.slice(tokenMatch[0].length).trim();
        } else {
          // It was just a prefix like "Раздаточный материал. Автор вопроса описал..."
          rawHandoutSnippet = leadMatch[0];
          cleanQ = rest;
        }
      }
    }
  }

  // Remove any leftover (pic: ...) tags anywhere in the question string
  cleanQ = cleanQ.replace(/\((?:pic|picture):\s*[^)]+\)/gi, ' ');
  // Normalize multiple spaces and trim
  cleanQ = cleanQ.replace(/\s{2,}/g, ' ').trim();

  // If cleanQ ended up empty for any reason, fallback to original
  if (!cleanQ) {
    cleanQ = raw;
  }

  const hasHandoutMention = /раздат(?:ка|очный материал)/i.test(raw);
  const hasHandout = images.length > 0 || Boolean(textHandout) || hasHandoutMention;

  let type: HandoutData['type'] = 'none';
  if (images.length > 0 && textHandout) {
    type = 'mixed';
  } else if (images.length > 0) {
    type = 'image';
  } else if (textHandout) {
    type = 'text';
  } else if (hasHandout) {
    type = 'missing'; // Handout was used in tournament room physically, but no file attached in database
  }

  return {
    hasHandout,
    type,
    images,
    textHandout,
    cleanQuestion: cleanQ,
    readerNote: readerNotes.length > 0 ? readerNotes.join(' • ') : undefined,
    rawHandoutSnippet,
  };
}

/**
 * Returns handout data for a question (either from question.handout if present,
 * or dynamically parsed from question.question).
 */
export function getHandoutFromQuestion(q: WikiQuestion): HandoutData {
  if (q.handout) {
    return q.handout;
  }
  return parseQuestionHandout(q.question);
}
