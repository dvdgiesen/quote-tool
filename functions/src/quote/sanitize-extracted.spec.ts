import { describe, expect, it } from 'vitest';
import { cleanPrice, cleanText, hasUsableContent, sanitizeExtractedData } from './sanitize-extracted';

const valid = {
  projectType: 'e-commerce',
  complexity: 'medium',
  features: ['Webshop', 'Betalen'],
  featureIds: ['payments', 'auth'],
  timeline: '2 maanden',
  description: 'Een webshop voor een bakkerij.',
  targetAudience: 'Klanten uit de buurt',
  technicalRequirements: ['iDEAL'],
  projectTitle: 'Bakkerij webshop',
  clientName: 'Bakkerij Jansen',
  projectSummary: 'Eerste alinea.\n\nTweede alinea.',
  techStack: [{ role: 'Frontend', tool: 'Angular', reason: 'Snel en stabiel' }],
  phases: [{ name: 'Fase 1', subtitle: 'Kern', deliverables: ['Webshop'], duration: '4 weken' }],
  assumptions: ['Teksten komen van de klant'],
  monthlyServices: [{ service: 'Hosting', price: '€ 10 – 50', note: 'Afhankelijk van gebruik' }],
};

describe('sanitizeExtractedData', () => {
  it('keeps valid data as it is', () => {
    const data = sanitizeExtractedData(valid);
    expect(data.projectType).toBe('e-commerce');
    expect(data.features).toEqual(['Webshop', 'Betalen']);
    expect(data.featureIds).toEqual(['payments', 'auth']);
    expect(data.projectSummary).toBe('Eerste alinea.\n\nTweede alinea.');
    expect(data.monthlyServices[0].price).toBe('€ 10 – 50');
  });

  it.each([null, undefined, 'tekst', 5, []])('survives a completely wrong answer: %s', input => {
    const data = sanitizeExtractedData(input);
    expect(data.projectType).toBe('custom');
    expect(data.features).toEqual([]);
    expect(data.phases).toEqual([]);
    expect(data.projectTitle).toBe('Project');
    expect(hasUsableContent(data)).toBe(false);
  });

  it('replaces an unknown project type and complexity', () => {
    const data = sanitizeExtractedData({ ...valid, projectType: 'gratis-alles', complexity: 'enorm' });
    expect(data.projectType).toBe('custom');
    expect(data.complexity).toBe('medium');
  });

  it('keeps only known feature ids and leaves them absent when the model sent none', () => {
    expect(sanitizeExtractedData({ ...valid, featureIds: ['payments', 'hack', 7, null] }).featureIds).toEqual(['payments']);
    const { featureIds: _omit, ...withoutIds } = valid;
    expect(sanitizeExtractedData(withoutIds).featureIds).toBeUndefined();
  });

  it('caps list lengths', () => {
    const many = Array.from({ length: 50 }, (_, i) => `item ${i}`);
    const data = sanitizeExtractedData({ ...valid, features: many, technicalRequirements: many, assumptions: many });
    expect(data.features).toHaveLength(10);
    expect(data.technicalRequirements).toHaveLength(8);
    expect(data.assumptions).toHaveLength(8);
  });

  it('caps the length of text fields', () => {
    const data = sanitizeExtractedData({ ...valid, projectTitle: 'x'.repeat(500), description: 'y'.repeat(5000) });
    expect(Array.from(data.projectTitle)).toHaveLength(100);
    expect(Array.from(data.description)).toHaveLength(500);
  });

  it('ignores items of the wrong type inside lists', () => {
    const data = sanitizeExtractedData({ ...valid, features: ['ok', 5, null, { a: 1 }, ''], techStack: ['x', 3, null] });
    expect(data.features).toEqual(['ok']);
    expect(data.techStack).toEqual([]);
  });

  it('removes links, e-mail addresses and long numbers from texts of the model', () => {
    const data = sanitizeExtractedData({
      ...valid,
      description: 'Bel 06 1234 5678 of mail naar boef@example.com of ga naar https://boef.example/korting en www.boef.example',
    });
    expect(data.description).not.toMatch(/@|https?:|www\.|\d{4}/);
    expect(data.description).toContain('Bel');
  });

  it('turns an odd price into "Op aanvraag" instead of showing it on the offer', () => {
    const data = sanitizeExtractedData({
      ...valid,
      monthlyServices: [{ service: 'Hosting', price: 'GRATIS! Bel nu voor een eeuwige korting van 100% op alles', note: '' }],
    });
    expect(data.monthlyServices[0].price).toBe('Op aanvraag');
  });

  it('passes HTML through as text: escaping is done where it is output', () => {
    const data = sanitizeExtractedData({ ...valid, projectTitle: '<script>alert(1)</script>' });
    expect(data.projectTitle).toBe('<script>alert(1)</script>');
  });
});

describe('cleanPrice', () => {
  it.each(['€ 10 – 50', '± € 15 / jaar', '€ 0*', 'Op aanvraag', '€10 – €50', 'vanaf ± € 36', '€ 25 (eenmalig)'])(
    'keeps a normal price: %s',
    price => expect(cleanPrice(price)).toBe(price)
  );

  it.each(['<b>€ 5</b>', '€ 5; DROP TABLE', 'https://x.example', '', 5, null])(
    'replaces a price that is not a plain amount: %s',
    price => expect(cleanPrice(price)).toBe('Op aanvraag')
  );
});

describe('cleanText', () => {
  it('removes control characters', () => {
    expect(cleanText('a\u0000b\u0007c', 10)).toBe('abc');
  });

  it('keeps line breaks only when asked', () => {
    expect(cleanText('a\nb', 10)).toBe('a b');
    expect(cleanText('a\nb', 10, true)).toBe('a\nb');
  });

  it('cuts on code points, not in the middle of an emoji', () => {
    expect(cleanText('\u{1F600}'.repeat(5), 3)).toBe('\u{1F600}'.repeat(3));
  });
});

describe('hasUsableContent', () => {
  it('is true when there is something to quote on', () => {
    expect(hasUsableContent(sanitizeExtractedData(valid))).toBe(true);
    expect(hasUsableContent(sanitizeExtractedData({ ...valid, features: [], featureIds: [], phases: [] }))).toBe(false);
  });
});
