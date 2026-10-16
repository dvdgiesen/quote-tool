/**
 * Validation and cleaning of what a visitor sends to `generateQuote`: a file or typed text.
 *
 * Pure functions only (no Firebase, no Gemini), so they can be unit tested and are shared by the
 * file path and the text path. The server is the authority: the website validates the same rules
 * only to help the visitor (keep `projects/quote-tool/.../brief-text.ts` in sync with the limits).
 */

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB, checked on the decoded data
/** Typed or pasted text, counted in characters (code points) after cleaning. */
export const MAX_TYPED_TEXT_CHARS = 6000;
/** Text read from a .txt or .docx file. Larger than typed text, but not unlimited (Gemini Pro costs money). */
export const MAX_FILE_TEXT_CHARS = 20000;
export const MIN_BRIEF_WORDS = 30;
export const MIN_DISTINCT_WORDS = 12;
/** Share of the non-space characters that must be letters. Rejects strings of digits and symbols. */
export const MIN_LETTER_RATIO = 0.5;

/** Typed text longer than this (UTF-16 units) is refused before any processing. */
const MAX_RAW_TEXT_LENGTH = MAX_TYPED_TEXT_CHARS * 4;
const MAX_FILE_NAME_LENGTH = 255;
const MAX_BASE64_LENGTH = Math.ceil(MAX_FILE_SIZE_BYTES / 3) * 4 + 8;

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

export type ParsedQuoteRequest =
  | { mode: 'text'; text: string }
  | { mode: 'file'; fileName: string; mimeType: AllowedMimeType; fileBase64: string };

function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Checks the shape of the request. `mode` is optional so that the website from before the text
 * option (which sends no `mode`) keeps working. The `fileSize` the browser sends is ignored: the
 * real size is checked on the decoded data.
 */
export function parseQuoteRequest(data: unknown): Checked<ParsedQuoteRequest> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, message: 'Ongeldig verzoek.' };
  }
  const body = data as Record<string, unknown>;
  const mode = body['mode'] ?? 'file';

  if (mode === 'text') {
    const text = body['text'];
    if (typeof text !== 'string' || text.length === 0) {
      return { ok: false, message: 'Typ of plak eerst een beschrijving van je project.' };
    }
    if (text.length > MAX_RAW_TEXT_LENGTH) {
      return {
        ok: false,
        message: `Je tekst is te lang. Maximaal ${MAX_TYPED_TEXT_CHARS} tekens. Kort hem in of splits je project op.`,
      };
    }
    return { ok: true, value: { mode: 'text', text } };
  }

  if (mode === 'file') {
    const { fileName, mimeType, fileBase64 } = body;
    if (typeof fileName !== 'string' || !fileName.trim() || typeof mimeType !== 'string' ||
        typeof fileBase64 !== 'string' || !fileBase64) {
      return { ok: false, message: 'Ontbrekende bestandsgegevens.' };
    }
    if (fileName.length > MAX_FILE_NAME_LENGTH) {
      return { ok: false, message: 'De bestandsnaam is te lang.' };
    }
    if (!isAllowedMimeType(mimeType)) {
      return { ok: false, message: 'Ongeldig bestandstype. Upload een PDF, Word-document of tekstbestand.' };
    }
    if (fileBase64.length > MAX_BASE64_LENGTH) {
      return { ok: false, message: 'Bestand is te groot. Maximale bestandsgrootte is 5 MB.' };
    }
    return { ok: true, value: { mode: 'file', fileName, mimeType, fileBase64 } };
  }

  return { ok: false, message: 'Ongeldig verzoek.' };
}

/** Checks the decoded bytes: size, and that the content looks like what the browser claimed. */
export function checkFileBuffer(buffer: Buffer, mimeType: AllowedMimeType): Checked<Buffer> {
  if (buffer.length === 0) {
    return { ok: false, message: 'Het bestand is leeg.' };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, message: 'Bestand is te groot. Maximale bestandsgrootte is 5 MB.' };
  }
  if (!fileMatchesMimeType(buffer, mimeType)) {
    return { ok: false, message: 'Het bestand lijkt niet van het opgegeven type te zijn. Controleer het bestand en probeer het opnieuw.' };
  }
  return { ok: true, value: buffer };
}

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte);
}

/** The MIME type comes from the browser, so check the first bytes too. */
export function fileMatchesMimeType(buffer: Buffer, mimeType: AllowedMimeType): boolean {
  const zip = startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
  switch (mimeType) {
    case 'application/pdf':
      return buffer.subarray(0, 1024).includes('%PDF-');
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return zip;
    case 'application/msword':
      return zip || startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0]);
    case 'text/plain':
      return !buffer.subarray(0, 8000).includes(0);
  }
}

/** The file extension is derived from the checked MIME type, never from the file name. */
export function extensionFor(mimeType: AllowedMimeType): string {
  switch (mimeType) {
    case 'application/pdf': return 'pdf';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'docx';
    case 'application/msword': return 'doc';
    case 'text/plain': return 'txt';
  }
}

// ── Text cleaning ───────────────────────────────────────────────────────────────

/** Zero-width, bidirectional, invisible-format, tag and variation-selector characters. */
const INVISIBLE_CHARS = new RegExp(
  '[\\u00AD\\u180E\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\uFEFF\\uFE00-\\uFE0F\\uFFF9-\\uFFFC' +
    '\\u{E0000}-\\u{E007F}\\u{E0100}-\\u{E01EF}]',
  'gu'
);
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const ODD_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/**
 * Cleans text from a visitor or a file before anything else sees it: Unicode NFC, no invisible or
 * control characters (a way to hide instructions), unified line endings and spaces. HTML or
 * markdown is NOT removed: it stays data, and is escaped where it is shown.
 */
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

/** A file name is only used for display: strip control characters and path parts, cap the length. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(CONTROL_CHARS, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(/[\\/]+/g, '_')
    .trim()
    .slice(0, 120);
  return cleaned || 'bestand';
}

/** Length in characters as a person counts them (code points), not UTF-16 units. */
export function countChars(text: string): number {
  return Array.from(text).length;
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(word => word.length > 0);
}

export interface BriefTextOptions {
  /** Where the text comes from: decides the limit and the wording of the messages. */
  source: 'typed' | 'file';
}

/**
 * Normalizes the text and checks length and quality, without calling Gemini. Everything this
 * refuses is the visitor's to fix, so it never counts as a failed attempt.
 */
export function prepareBriefText(raw: string, options: BriefTextOptions): Checked<string> {
  const typed = options.source === 'typed';
  const noun = typed ? 'tekst' : 'document';
  const text = normalizeBriefText(raw);
  const maxChars = typed ? MAX_TYPED_TEXT_CHARS : MAX_FILE_TEXT_CHARS;

  const chars = countChars(text);
  if (chars > maxChars) {
    return {
      ok: false,
      message: `Je ${noun} is te lang (${chars} van maximaal ${maxChars} tekens). Kort hem in of splits je project op.`,
    };
  }

  const words = splitWords(text);
  if (words.length < MIN_BRIEF_WORDS) {
    return {
      ok: false,
      message: typed
        ? `Je tekst is te kort om een zinvolle offerte te maken. Beschrijf je project in een paar zinnen (minimaal ${MIN_BRIEF_WORDS} woorden).`
        : 'Je document is te kort om een zinvolle offerte te genereren. Geef een uitgebreidere projectomschrijving (minimaal een paar alinea\'s).',
    };
  }

  const distinct = new Set(words.map(word => word.toLowerCase())).size;
  if (distinct < MIN_DISTINCT_WORDS) {
    return {
      ok: false,
      message: `Je ${noun} bevat te veel herhaling. Beschrijf in eigen woorden wat je wilt laten maken.`,
    };
  }

  const visible = text.replace(/\s/g, '');
  const letters = (visible.match(/\p{L}/gu) ?? []).length;
  if (visible.length === 0 || letters / visible.length < MIN_LETTER_RATIO) {
    return {
      ok: false,
      message: `Je ${noun} bevat te weinig leesbare tekst. Beschrijf je project in gewone zinnen.`,
    };
  }

  return { ok: true, value: text };
}

