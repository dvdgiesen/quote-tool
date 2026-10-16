import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_TYPED_TEXT_CHARS,
  checkFileBuffer,
  extensionFor,
  fileMatchesMimeType,
  parseQuoteRequest,
  sanitizeFileName,
} from './brief-input';

const GOOD = 'Ik wil een website voor mijn bakkerij waar klanten hun bestelling kunnen plaatsen en betalen.';

describe('parseQuoteRequest', () => {
  it('treats a request without mode as a file upload (old website keeps working)', () => {
    const r = parseQuoteRequest({ fileName: 'a.txt', mimeType: 'text/plain', fileBase64: 'aGk=', fileSize: 2 });
    expect(r.ok && r.value.mode).toBe('file');
  });

  it('accepts text mode', () => {
    expect(parseQuoteRequest({ mode: 'text', text: GOOD })).toEqual({ ok: true, value: { mode: 'text', text: GOOD } });
  });

  it.each([null, undefined, 'tekst', 42, [], true])('rejects a body that is not an object: %s', body => {
    expect(parseQuoteRequest(body).ok).toBe(false);
  });

  it('rejects an unknown mode', () => {
    expect(parseQuoteRequest({ mode: 'html', text: GOOD }).ok).toBe(false);
  });

  it.each([undefined, null, 123, {}, ['x'], ''])('rejects text that is not a non-empty string: %s', text => {
    expect(parseQuoteRequest({ mode: 'text', text }).ok).toBe(false);
  });

  it('refuses enormous text before any processing', () => {
    expect(parseQuoteRequest({ mode: 'text', text: 'a'.repeat(MAX_TYPED_TEXT_CHARS * 4 + 1) }).ok).toBe(false);
  });

  it('rejects a file with a disallowed type', () => {
    expect(parseQuoteRequest({ fileName: 'x.exe', mimeType: 'application/x-msdownload', fileBase64: 'aGk=' }).ok).toBe(false);
  });

  it('rejects a file without a name or data', () => {
    expect(parseQuoteRequest({ mimeType: 'text/plain', fileBase64: 'aGk=' }).ok).toBe(false);
    expect(parseQuoteRequest({ fileName: 'a.txt', mimeType: 'text/plain', fileBase64: '' }).ok).toBe(false);
  });

  it('ignores the fileSize sent by the browser', () => {
    expect(parseQuoteRequest({ fileName: 'a.txt', mimeType: 'text/plain', fileBase64: 'aGk=', fileSize: -5 }).ok).toBe(true);
  });

  it('rejects base64 data that is clearly over the limit', () => {
    const r = parseQuoteRequest({ fileName: 'a.txt', mimeType: 'text/plain', fileBase64: 'A'.repeat(MAX_FILE_SIZE_BYTES * 2) });
    expect(r.ok).toBe(false);
  });
});

describe('file checks', () => {
  it('checks the real size of the decoded data', () => {
    expect(checkFileBuffer(Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 97), 'text/plain').ok).toBe(false);
  });

  it('rejects an empty file', () => {
    expect(checkFileBuffer(Buffer.alloc(0), 'text/plain').ok).toBe(false);
  });

  it('checks the first bytes against the claimed type', () => {
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    expect(fileMatchesMimeType(Buffer.from('%PDF-1.7 ...'), 'application/pdf')).toBe(true);
    expect(fileMatchesMimeType(Buffer.from('MZ not a pdf'), 'application/pdf')).toBe(false);
    expect(fileMatchesMimeType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0]), docx)).toBe(true);
    expect(fileMatchesMimeType(Buffer.from('plain'), docx)).toBe(false);
    expect(fileMatchesMimeType(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), 'application/msword')).toBe(true);
    expect(fileMatchesMimeType(Buffer.from([104, 105, 0, 1]), 'text/plain')).toBe(false);
  });

  it('derives the extension from the checked type, never from the file name', () => {
    expect(extensionFor('application/pdf')).toBe('pdf');
    expect(extensionFor('text/plain')).toBe('txt');
  });

  it('cleans a file name that is only used for display', () => {
    expect(sanitizeFileName('../../etc/pass\u0000wd\u202E.txt')).toBe('.._.._etc_passwd.txt');
    expect(sanitizeFileName('\u0000\u200B')).toBe('bestand');
    expect(sanitizeFileName('a'.repeat(500)).length).toBe(120);
  });
});
