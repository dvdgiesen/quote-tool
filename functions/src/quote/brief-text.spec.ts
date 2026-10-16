import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_TEXT_CHARS,
  MAX_TYPED_TEXT_CHARS,
  countChars,
  normalizeBriefText,
  prepareBriefText,
} from './brief-input';

const GOOD =
  'Ik wil een website voor mijn bakkerij waar klanten hun bestelling kunnen plaatsen en betalen. ' +
  'Het moet werken op de telefoon, ik wil zelf de producten kunnen aanpassen en klanten krijgen een bevestiging per e-mail. ' +
  'Graag in de kleuren van mijn huisstijl en live binnen twee maanden.';

describe('normalizeBriefText', () => {
  it('removes control characters and turns tabs and line endings into plain ones', () => {
    expect(normalizeBriefText('a\u0000b\u0007c\td\r\ne\rf')).toBe('abc d\ne\nf');
  });

  it('removes zero-width, bidirectional and tag characters (hidden instructions)', () => {
    const tags = String.fromCodePoint(0xe0041, 0xe0042);
    expect(normalizeBriefText(`a\u200Bb\u202Ec\u2066d\uFEFFe${tags}f`)).toBe('abcdef');
  });

  it('removes variation selectors but keeps the emoji itself', () => {
    expect(normalizeBriefText('hoi \u2764\uFE0F')).toBe('hoi \u2764');
  });

  it('removes lone surrogates', () => {
    expect(normalizeBriefText('a\uD800b')).toBe('ab');
  });

  it('normalizes to NFC and unifies odd spaces', () => {
    expect(normalizeBriefText('e\u0301\u00A0x')).toBe('\u00E9 x');
  });

  it('collapses extra blank lines and spaces', () => {
    expect(normalizeBriefText('a   b\n\n\n\n\nc  ')).toBe('a b\n\nc');
  });

  it('keeps HTML, markdown and replacement patterns as plain data', () => {
    const text = '<b>vet</b> **x** $& $$ $\' {DOCUMENT_TEXT} ---';
    expect(normalizeBriefText(text)).toBe(text);
  });
});

describe('prepareBriefText', () => {
  it('accepts a normal brief', () => {
    expect(prepareBriefText(GOOD, { source: 'typed' }).ok).toBe(true);
  });

  it('refuses text under the minimum number of words', () => {
    expect(prepareBriefText('Ik wil een website voor mijn bedrijf met een webshop.', { source: 'typed' }).ok).toBe(false);
  });

  it('counts the minimum on cleaned text: hidden characters do not make words', () => {
    const padded = Array.from({ length: 40 }, () => '\u200B').join(' ');
    expect(prepareBriefText(padded, { source: 'typed' }).ok).toBe(false);
  });

  it('refuses repetition', () => {
    const repeated = Array.from({ length: 60 }, () => 'website').join(' ');
    expect(prepareBriefText(repeated, { source: 'typed' }).ok).toBe(false);
  });

  it('refuses text that is mostly digits and symbols', () => {
    const noise = Array.from({ length: 60 }, (_, i) => `#${i * 7919}${i}!!`).join(' ');
    expect(prepareBriefText(noise, { source: 'typed' }).ok).toBe(false);
  });

  it('accepts exactly the typed limit and refuses one character more', () => {
    const filler = Array.from({ length: 800 }, (_, i) => `woord${i}`).join(' ');
    const exact = Array.from(`${GOOD} ${filler}`).slice(0, MAX_TYPED_TEXT_CHARS).join('');
    expect(countChars(exact)).toBe(MAX_TYPED_TEXT_CHARS);
    expect(prepareBriefText(exact, { source: 'typed' }).ok).toBe(true);
    expect(prepareBriefText(`${exact}x`, { source: 'typed' }).ok).toBe(false);
  });

  it('counts emoji as one character each (code points), not two', () => {
    expect(countChars('\u{1F600}'.repeat(10))).toBe(10);
  });

  it('allows more text from a file than from the text field', () => {
    const words = Array.from({ length: 1500 }, (_, i) => `woord${i}`).join(' ');
    expect(countChars(words)).toBeGreaterThan(MAX_TYPED_TEXT_CHARS);
    expect(countChars(words)).toBeLessThan(MAX_FILE_TEXT_CHARS);
    expect(prepareBriefText(words, { source: 'typed' }).ok).toBe(false);
    expect(prepareBriefText(words, { source: 'file' }).ok).toBe(true);
  });

  it('works with right-to-left text and emoji in a brief', () => {
    expect(prepareBriefText(`${GOOD} \u05E9\u05DC\u05D5\u05DD \u{1F44B}`, { source: 'typed' }).ok).toBe(true);
  });
});
