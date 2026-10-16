/**
 * Counting and checking of the typed project description, to help the visitor while typing.
 *
 * The SERVER is the authority and checks the same rules again (functions/src/quote/brief-input.ts).
 * Keep the limits and the cleaning below in sync with that file, so that the counter on the page
 * shows what the server will count.
 */

export const MAX_TYPED_TEXT_CHARS = 6000;
export const MIN_BRIEF_WORDS = 30;
export const MIN_DISTINCT_WORDS = 12;
export const MIN_LETTER_RATIO = 0.5;
/** Safety net on the textarea only (against pasting a huge text); the real limit is the one above. */
export const TEXTAREA_HARD_MAX_LENGTH = 12000;

const INVISIBLE_CHARS = new RegExp(
  '[\\u00AD\\u180E\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\uFEFF\\uFE00-\\uFE0F\\uFFF9-\\uFFFC' +
    '\\u{E0000}-\\u{E007F}\\u{E0100}-\\u{E01EF}]',
  'gu'
);
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const ODD_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/** Same cleaning as the server: NFC, no invisible or control characters, unified spaces and line endings. */
export function normalizeBriefText(raw: string): string {
  return raw
    .replace(LONE_SURROGATES, '')
    .normalize('NFC')
    .replace(/\r\n?|\u2028|\u2029/g, '\n')
    .replace(INVISIBLE_CHARS, '')
    .replace(CONTROL_CHARS, '')
    .replace(ODD_SPACES, ' ')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type BriefTextProblem = 'empty' | 'too-long' | 'too-short' | 'repetition' | 'unreadable';

export interface BriefTextCheck {
  /** The cleaned text: what is counted and what is sent. */
  text: string;
  /** Characters as a person counts them (code points). */
  chars: number;
  words: number;
  /** Undefined when the text is fine. */
  problem?: BriefTextProblem;
  message?: string;
}

export function checkBriefText(raw: string): BriefTextCheck {
  const text = normalizeBriefText(raw);
  const chars = Array.from(text).length;
  const wordList = text.split(/\s+/).filter(word => word.length > 0);
  const words = wordList.length;
  const base = { text, chars, words };

  if (chars === 0) {
    return { ...base, problem: 'empty', message: 'Typ of plak een beschrijving van je project.' };
  }
  if (chars > MAX_TYPED_TEXT_CHARS) {
    return {
      ...base,
      problem: 'too-long',
      message: `Je tekst is te lang (${chars} van maximaal ${MAX_TYPED_TEXT_CHARS} tekens). Kort hem in of splits je project op.`,
    };
  }
  if (words < MIN_BRIEF_WORDS) {
    return {
      ...base,
      problem: 'too-short',
      message: `Nog te kort om een zinvolle offerte te maken: schrijf minimaal ${MIN_BRIEF_WORDS} woorden (nu ${words}).`,
    };
  }
  if (new Set(wordList.map(word => word.toLowerCase())).size < MIN_DISTINCT_WORDS) {
    return {
      ...base,
      problem: 'repetition',
      message: 'Je tekst bevat te veel herhaling. Beschrijf in eigen woorden wat je wilt laten maken.',
    };
  }
  const visible = text.replace(/\s/g, '');
  const letters = (visible.match(/\p{L}/gu) ?? []).length;
  if (letters / visible.length < MIN_LETTER_RATIO) {
    return {
      ...base,
      problem: 'unreadable',
      message: 'Je tekst bevat te weinig leesbare tekst. Beschrijf je project in gewone zinnen.',
    };
  }
  return base;
}
