import { describe, expect, it } from 'vitest';
import {
  isOrphanFile,
  lastActivityMs,
  quoteIdFromPath,
  retentionCutoff,
  shouldDeleteQuote,
  shouldDeleteUser,
} from './retention';

const NOW = new Date('2026-10-16T12:00:00Z');
const CUTOFF = retentionCutoff(NOW);
const DAY = 24 * 60 * 60 * 1000;

describe('retentionCutoff', () => {
  it('is 12 calendar months back', () => {
    expect(CUTOFF.toISOString()).toBe('2025-10-16T12:00:00.000Z');
  });

  it('does not change the date it was given', () => {
    const now = new Date('2026-03-31T00:00:00Z');
    retentionCutoff(now);
    expect(now.toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });
});

describe('shouldDeleteQuote', () => {
  it('deletes a quote older than 12 months', () => {
    expect(shouldDeleteQuote({ submittedAtMs: CUTOFF.getTime() - DAY, status: 'pending' }, CUTOFF)).toBe(true);
  });

  it('keeps a quote younger than 12 months', () => {
    expect(shouldDeleteQuote({ submittedAtMs: CUTOFF.getTime() + DAY, status: 'pending' }, CUTOFF)).toBe(false);
  });

  it('keeps a quote that became an assignment, however old', () => {
    expect(shouldDeleteQuote({ submittedAtMs: 0, status: 'converted' }, CUTOFF)).toBe(false);
  });

  it('deletes an old quote with another status or none (older quotes)', () => {
    expect(shouldDeleteQuote({ submittedAtMs: 1000, status: 'rejected' }, CUTOFF)).toBe(true);
    expect(shouldDeleteQuote({ submittedAtMs: 1000 }, CUTOFF)).toBe(true);
  });

  it('never deletes a quote it cannot date', () => {
    expect(shouldDeleteQuote({ status: 'pending' }, CUTOFF)).toBe(false);
  });
});

describe('shouldDeleteUser', () => {
  const old = CUTOFF.getTime() - DAY;
  const recent = CUTOFF.getTime() + DAY;

  it('deletes a user without quotes who was inactive for the whole period', () => {
    expect(shouldDeleteUser({ lastSignInMs: old, lastQuoteAtMs: old, remainingQuotes: 0 }, CUTOFF)).toBe(true);
  });

  it('keeps a user who still has quotes (they follow the quotes)', () => {
    expect(shouldDeleteUser({ lastSignInMs: old, remainingQuotes: 1 }, CUTOFF)).toBe(false);
  });

  it('keeps a user who signed in recently, even without a quote', () => {
    expect(shouldDeleteUser({ lastSignInMs: recent, remainingQuotes: 0 }, CUTOFF)).toBe(false);
  });

  it('keeps a user whose last quote or last attempt is recent', () => {
    expect(shouldDeleteUser({ lastSignInMs: old, lastQuoteAtMs: recent, remainingQuotes: 0 }, CUTOFF)).toBe(false);
    expect(shouldDeleteUser({ lastSignInMs: old, lastFailedAttemptAtMs: recent, remainingQuotes: 0 }, CUTOFF)).toBe(false);
  });

  it('keeps a user it cannot date at all', () => {
    expect(shouldDeleteUser({ remainingQuotes: 0 }, CUTOFF)).toBe(false);
  });

  it('uses the latest sign of life', () => {
    expect(lastActivityMs({ lastSignInMs: 5, lastQuoteAtMs: 9, remainingQuotes: 0 })).toBe(9);
    expect(lastActivityMs({ remainingQuotes: 0 })).toBeUndefined();
  });
});

describe('orphan files', () => {
  const known = new Set(['abc']);

  it('reads the quote id from both storage paths', () => {
    expect(quoteIdFromPath('briefs/uid1/abc/brief.txt')).toBe('abc');
    expect(quoteIdFromPath('quotes/abc/offerte.html')).toBe('abc');
    expect(quoteIdFromPath('other/x')).toBeUndefined();
    expect(quoteIdFromPath('briefs/uid1')).toBeUndefined();
  });

  it('deletes an old file without a quote', () => {
    expect(isOrphanFile({ path: 'briefs/u/zzz/brief.txt', createdMs: CUTOFF.getTime() - DAY }, known, CUTOFF)).toBe(true);
  });

  it('keeps a file that belongs to a quote', () => {
    expect(isOrphanFile({ path: 'briefs/u/abc/brief.txt', createdMs: 1 }, known, CUTOFF)).toBe(false);
  });

  it('keeps a young file without a quote (a request may be running right now)', () => {
    expect(isOrphanFile({ path: 'briefs/u/zzz/brief.txt', createdMs: CUTOFF.getTime() + DAY }, known, CUTOFF)).toBe(false);
  });

  it('keeps a file it cannot date or place', () => {
    expect(isOrphanFile({ path: 'briefs/u/zzz/brief.txt' }, known, CUTOFF)).toBe(false);
    expect(isOrphanFile({ path: 'unknown/file', createdMs: 1 }, known, CUTOFF)).toBe(false);
  });
});
