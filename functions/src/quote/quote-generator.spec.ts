import { describe, expect, it } from 'vitest';
import { generateOfferteHtml } from './quote-generator';
import { calculatePrice } from './pricing';
import type { ExtractedProjectData } from './extraction';

const EVIL = '<script>alert(1)</script><img src=x onerror=alert(2)>"onmouseover="alert(3)';

/** Every text field of the extracted data holds a script and an event handler. */
function evilData(): ExtractedProjectData {
  return {
    projectType: 'web-app',
    complexity: 'medium',
    features: [EVIL],
    featureIds: ['auth'],
    timeline: EVIL,
    description: EVIL,
    targetAudience: EVIL,
    technicalRequirements: [EVIL],
    projectTitle: EVIL,
    clientName: EVIL,
    projectSummary: `${EVIL}\n\n${EVIL}`,
    techStack: [{ role: EVIL, tool: EVIL, reason: EVIL }],
    phases: [{ name: EVIL, subtitle: EVIL, deliverables: [EVIL, EVIL], duration: EVIL }],
    assumptions: [EVIL],
    monthlyServices: [{ service: EVIL, price: EVIL, note: EVIL }],
  };
}

describe('generateOfferteHtml', () => {
  const data = evilData();
  const html = generateOfferteHtml({
    quoteId: 'abc12345def',
    extractedData: data,
    priceEstimate: calculatePrice(data),
    userName: EVIL,
    userEmail: 'x@example.com',
    generatedAt: new Date('2026-10-16T12:00:00Z'),
  });

  it('never outputs a raw script tag or image tag from the visitor or the model', () => {
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('"onmouseover="');
  });

  it('outputs the text escaped instead', () => {
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('has no script element at all (the only script-like thing is the print button handler)', () => {
    expect(html).not.toMatch(/<script/i);
  });
});
