import * as mammoth from 'mammoth';
import {
  checkFileBuffer,
  extensionFor,
  prepareBriefText,
  sanitizeFileName,
} from './brief-input';
import type { Checked, ParsedQuoteRequest } from './brief-input';

/**
 * What the rest of the pipeline works with, whether the visitor typed text or uploaded a file.
 * Everything after reading the brief (limits, moderation, extraction, price, offer, e-mail) is the
 * same for both, so there is exactly one pipeline.
 */
export interface BriefSource {
  inputMode: 'text' | 'file';
  /** Cleaned text, moderated and extracted as text. Absent for a PDF: Gemini reads the PDF itself. */
  text?: string;
  /** Re-encoded from the checked bytes (PDF only). Moderated and extracted by Gemini as a document. */
  pdfBase64?: string;
  /** What is saved in Storage: the typed text, or the original file. */
  storageBuffer: Buffer;
  contentType: string;
  ext: string;
  /** Safe to show and to store: a clean file name, or "Getypte tekst". */
  displayName: string;
}

export const TYPED_TEXT_DISPLAY_NAME = 'Getypte tekst';

const DOCX_READ_ERROR =
  'Het Word-document kon niet worden gelezen. Sla het op als PDF of tekstbestand en probeer het opnieuw.';

/**
 * Turns a checked request into a BriefSource. All checks here are about the visitor's input and
 * need no Gemini call, so a refusal never counts as a failed attempt.
 */
export async function readBriefSource(request: ParsedQuoteRequest): Promise<Checked<BriefSource>> {
  if (request.mode === 'text') {
    const prepared = prepareBriefText(request.text, { source: 'typed' });
    if (!prepared.ok) return prepared;
    return {
      ok: true,
      value: {
        inputMode: 'text',
        text: prepared.value,
        storageBuffer: Buffer.from(prepared.value, 'utf-8'),
        contentType: 'text/plain; charset=utf-8',
        ext: 'txt',
        displayName: TYPED_TEXT_DISPLAY_NAME,
      },
    };
  }

  const buffer = Buffer.from(request.fileBase64, 'base64');
  const checked = checkFileBuffer(buffer, request.mimeType);
  if (!checked.ok) return checked;

  const displayName = sanitizeFileName(request.fileName);
  const ext = extensionFor(request.mimeType);

  if (request.mimeType === 'application/pdf') {
    return {
      ok: true,
      value: {
        inputMode: 'file',
        pdfBase64: buffer.toString('base64'),
        storageBuffer: buffer,
        contentType: request.mimeType,
        ext,
        displayName,
      },
    };
  }

  let rawText: string;
  if (request.mimeType === 'text/plain') {
    rawText = buffer.toString('utf-8');
  } else {
    try {
      rawText = (await mammoth.extractRawText({ buffer })).value;
    } catch {
      return { ok: false, message: DOCX_READ_ERROR };
    }
  }

  const prepared = prepareBriefText(rawText, { source: 'file' });
  if (!prepared.ok) return prepared;

  return {
    ok: true,
    value: {
      inputMode: 'file',
      text: prepared.value,
      storageBuffer: buffer,
      contentType: request.mimeType,
      ext,
      displayName,
    },
  };
}
