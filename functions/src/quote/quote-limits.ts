/**
 * Per-user limits for `generateQuote`, as a pure decision so it can be tested without Firestore.
 *
 * The decision is made twice: once as a cheap peek before the expensive work, and once inside a
 * Firestore transaction that also claims the "slot" (`inFlightUntil`). The slot stops two
 * simultaneous requests (double click, two tabs) from both reaching Gemini before `lastQuoteAt`
 * is set. The attempt counter limits requests that cost Gemini calls but never end in a quote.
 */

export const RATE_LIMIT_HOURS = 24;
/** Max submissions the moderation blocked per 24 hours. */
export const MAX_FAILED_ATTEMPTS = 3;
/** Max requests per 24 hours that reached Gemini, whatever their outcome (Gemini outages are refunded). */
export const MAX_ATTEMPTS_PER_DAY = 5;
/** Function timeout (300 s) plus a margin: a crashed request releases its slot by itself. */
export const SLOT_SECONDS = 330;

const HOUR_MS = 60 * 60 * 1000;

interface HasMillis {
  toMillis(): number;
}

/** The fields of `users/{uid}` that matter here (Firestore Timestamps have `toMillis`). */
export interface UserLimitData {
  lastQuoteAt?: HasMillis;
  lastFailedAttemptAt?: HasMillis;
  failedAttemptCount?: number;
  inFlightUntil?: HasMillis;
  attemptWindowStart?: HasMillis;
  attemptCount?: number;
}

export type SlotRejection = 'quote-limit' | 'failed-limit' | 'attempt-limit' | 'in-flight';

export type SlotVerdict =
  | {
      ok: true;
      next: { inFlightUntilMs: number; attemptWindowStartMs: number; attemptCount: number };
    }
  | { ok: false; reason: SlotRejection; message: string };

function hoursLeft(sinceMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil(RATE_LIMIT_HOURS - (nowMs - sinceMs) / HOUR_MS));
}

export function evaluateQuoteSlot(user: UserLimitData | undefined, nowMs: number): SlotVerdict {
  const data = user ?? {};

  // 1. One successful quote per 24 hours (text and file together)
  if (data.lastQuoteAt) {
    const since = data.lastQuoteAt.toMillis();
    if ((nowMs - since) / HOUR_MS < RATE_LIMIT_HOURS) {
      return {
        ok: false,
        reason: 'quote-limit',
        message: `Je hebt vandaag al een offerte aangevraagd. Probeer het over ${hoursLeft(since, nowMs)} uur opnieuw.`,
      };
    }
  }

  // 2. Too many submissions that the moderation blocked
  if (data.lastFailedAttemptAt) {
    const since = data.lastFailedAttemptAt.toMillis();
    if ((nowMs - since) / HOUR_MS < RATE_LIMIT_HOURS && (data.failedAttemptCount ?? 0) >= MAX_FAILED_ATTEMPTS) {
      return {
        ok: false,
        reason: 'failed-limit',
        message: `Te veel ongeldige inzendingen vandaag. Probeer het over ${hoursLeft(since, nowMs)} uur opnieuw.`,
      };
    }
  }

  // 3. Another request of this user is still running
  if (data.inFlightUntil && data.inFlightUntil.toMillis() > nowMs) {
    return {
      ok: false,
      reason: 'in-flight',
      message: 'Er wordt al een offerte voor je gemaakt. Wacht even tot die klaar is en kijk ook in je mailbox.',
    };
  }

  // 4. Attempts per 24 hours (a window that starts at the first attempt)
  let windowStart = data.attemptWindowStart?.toMillis();
  let count = data.attemptCount ?? 0;
  if (windowStart === undefined || nowMs - windowStart >= RATE_LIMIT_HOURS * HOUR_MS) {
    windowStart = nowMs;
    count = 0;
  }
  if (count >= MAX_ATTEMPTS_PER_DAY) {
    return {
      ok: false,
      reason: 'attempt-limit',
      message: `Je hebt vandaag te veel pogingen gedaan. Probeer het over ${hoursLeft(windowStart, nowMs)} uur opnieuw.`,
    };
  }

  return {
    ok: true,
    next: {
      inFlightUntilMs: nowMs + SLOT_SECONDS * 1000,
      attemptWindowStartMs: windowStart,
      attemptCount: count + 1,
    },
  };
}
