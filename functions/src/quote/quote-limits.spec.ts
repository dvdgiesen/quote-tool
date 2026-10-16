import { describe, expect, it } from 'vitest';
import {
  MAX_ATTEMPTS_PER_DAY,
  MAX_FAILED_ATTEMPTS,
  SLOT_SECONDS,
  evaluateQuoteSlot,
} from './quote-limits';

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);
const at = (ms: number) => ({ toMillis: () => ms });

describe('evaluateQuoteSlot', () => {
  it('lets a new user through and claims the slot', () => {
    const v = evaluateQuoteSlot(undefined, NOW);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.next.inFlightUntilMs).toBe(NOW + SLOT_SECONDS * 1000);
      expect(v.next.attemptCount).toBe(1);
      expect(v.next.attemptWindowStartMs).toBe(NOW);
    }
  });

  it('refuses a second quote within 24 hours (text and file share the limit)', () => {
    const v = evaluateQuoteSlot({ lastQuoteAt: at(NOW - 2 * HOUR) }, NOW);
    expect(v).toMatchObject({ ok: false, reason: 'quote-limit' });
    if (!v.ok) expect(v.message).toContain('22 uur');
  });

  it('allows a quote again after 24 hours', () => {
    expect(evaluateQuoteSlot({ lastQuoteAt: at(NOW - 25 * HOUR) }, NOW).ok).toBe(true);
  });

  it('refuses after too many blocked submissions, until 24 hours have passed', () => {
    const blocked = { failedAttemptCount: MAX_FAILED_ATTEMPTS, lastFailedAttemptAt: at(NOW - HOUR) };
    expect(evaluateQuoteSlot(blocked, NOW)).toMatchObject({ ok: false, reason: 'failed-limit' });
    expect(evaluateQuoteSlot({ ...blocked, lastFailedAttemptAt: at(NOW - 25 * HOUR) }, NOW).ok).toBe(true);
  });

  it('refuses a second request while the first is still running', () => {
    const v = evaluateQuoteSlot({ inFlightUntil: at(NOW + 60_000) }, NOW);
    expect(v).toMatchObject({ ok: false, reason: 'in-flight' });
  });

  it('releases a slot that was never freed (crashed request) once it has expired', () => {
    expect(evaluateQuoteSlot({ inFlightUntil: at(NOW - 1) }, NOW).ok).toBe(true);
  });

  it('counts attempts and refuses when the daily maximum is reached', () => {
    const start = NOW - 3 * HOUR;
    const last = evaluateQuoteSlot({ attemptWindowStart: at(start), attemptCount: MAX_ATTEMPTS_PER_DAY - 1 }, NOW);
    expect(last.ok).toBe(true);
    if (last.ok) {
      expect(last.next.attemptCount).toBe(MAX_ATTEMPTS_PER_DAY);
      expect(last.next.attemptWindowStartMs).toBe(start);
    }
    const over = evaluateQuoteSlot({ attemptWindowStart: at(start), attemptCount: MAX_ATTEMPTS_PER_DAY }, NOW);
    expect(over).toMatchObject({ ok: false, reason: 'attempt-limit' });
  });

  it('starts a new attempt window after 24 hours', () => {
    const v = evaluateQuoteSlot({ attemptWindowStart: at(NOW - 25 * HOUR), attemptCount: MAX_ATTEMPTS_PER_DAY }, NOW);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.next.attemptCount).toBe(1);
  });

  it('never reports less than one hour remaining', () => {
    const v = evaluateQuoteSlot({ lastQuoteAt: at(NOW - 24 * HOUR + 1000) }, NOW);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toContain('1 uur');
  });
});
