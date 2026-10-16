import { MAX_TYPED_TEXT_CHARS, checkBriefText, normalizeBriefText } from './brief-text';

const GOOD =
  'Ik wil een website voor mijn bakkerij waar klanten hun bestelling kunnen plaatsen en betalen. ' +
  'Het moet werken op de telefoon, ik wil zelf de producten kunnen aanpassen en klanten krijgen een bevestiging per e-mail. ' +
  'Graag in de kleuren van mijn huisstijl.';

describe('checkBriefText', () => {
  it('accepts a normal description and counts it', () => {
    const check = checkBriefText(GOOD);
    expect(check.problem).toBeUndefined();
    expect(check.words).toBeGreaterThanOrEqual(30);
    expect(check.chars).toBe(check.text.length);
  });

  it('reports an empty text', () => {
    expect(checkBriefText('   \n ').problem).toBe('empty');
  });

  it('reports a text that is too short and says how many words it has', () => {
    const check = checkBriefText('Ik wil een website voor mijn bakkerij.');
    expect(check.problem).toBe('too-short');
    expect(check.message).toContain('nu 7');
  });

  it('reports a text that is too long', () => {
    const words = Array.from({ length: 1500 }, (_, i) => `woord${i}`).join(' ');
    const check = checkBriefText(words);
    expect(check.problem).toBe('too-long');
  });

  it('counts hidden characters as nothing, like the server', () => {
    expect(checkBriefText('a\u200Bb\u202Ec').chars).toBe(3);
  });

  it('counts an emoji as one character', () => {
    expect(checkBriefText('\u{1F600}\u{1F600}').chars).toBe(2);
  });

  it('reports repetition and unreadable text', () => {
    expect(checkBriefText(Array.from({ length: 60 }, () => 'website').join(' ')).problem).toBe('repetition');
    expect(checkBriefText(Array.from({ length: 60 }, (_, i) => `#${i * 7919}${i}!!`).join(' ')).problem).toBe('unreadable');
  });

  it('allows exactly the maximum', () => {
    const filler = Array.from({ length: 800 }, (_, i) => `woord${i}`).join(' ');
    const exact = Array.from(`${GOOD} ${filler}`).slice(0, MAX_TYPED_TEXT_CHARS).join('');
    expect(checkBriefText(exact).problem).toBeUndefined();
    expect(checkBriefText(`${exact}x`).problem).toBe('too-long');
  });
});

describe('normalizeBriefText', () => {
  it('keeps replacement patterns and HTML as plain text', () => {
    expect(normalizeBriefText('<b>x</b> $& $$')).toBe('<b>x</b> $& $$');
  });

  it('unifies line endings and collapses blank lines', () => {
    expect(normalizeBriefText('a\r\n\r\n\r\n\r\nb')).toBe('a\n\nb');
  });
});
