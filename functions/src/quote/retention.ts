/**
 * Retention rules: what is deleted, and when. Pure decisions only (no Firestore, no Storage), so
 * they can be tested. The scheduled function in `retention.function.ts` does the deleting.
 *
 * The privacy statement on the portfolio says "12 months". Keep that text and RETENTION_MONTHS
 * in sync.
 *
 * Rules
 *  - Quote (Firestore + its files in Storage): deleted 12 months after it was made, unless the
 *    owner marked it `converted` (it became an assignment: the administration rules take over).
 *  - moderationLog and contacts: deleted 12 months after they were written.
 *  - users/{uid}: deleted when the user has no quotes left and was not active for 12 months.
 *  - Firebase account: deleted when it has not signed in for 12 months and has no quotes left.
 *  - Files in Storage without a quote (a failed request leaves its brief behind): deleted after 12 months.
 */

export const RETENTION_MONTHS = 12;

/** Quote statuses that are never deleted automatically. */
export const KEEP_STATUSES: readonly string[] = ['converted'];

/** Moment before which everything counts as expired. Calendar months, in UTC. */
export function retentionCutoff(now: Date, months: number = RETENTION_MONTHS): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff;
}

export function isExpired(createdAtMs: number | undefined, cutoff: Date): boolean {
  return createdAtMs !== undefined && createdAtMs < cutoff.getTime();
}

/** A quote is deleted when it is old enough and not marked as an assignment. */
export function shouldDeleteQuote(
  quote: { submittedAtMs?: number; status?: string },
  cutoff: Date
): boolean {
  if (quote.status !== undefined && KEEP_STATUSES.includes(quote.status)) return false;
  return isExpired(quote.submittedAtMs, cutoff);
}

export interface UserActivity {
  /** `users/{uid}` fields, as milliseconds. */
  lastQuoteAtMs?: number;
  lastFailedAttemptAtMs?: number;
  /** From the Firebase account. */
  lastSignInMs?: number;
  createdMs?: number;
  /** Quotes of this user that are still there (after this run's deletions). */
  remainingQuotes: number;
}

/** Last sign of life of a user: the latest of sign-in, last quote and last blocked submission. */
export function lastActivityMs(user: UserActivity): number | undefined {
  const times = [user.lastSignInMs, user.lastQuoteAtMs, user.lastFailedAttemptAtMs, user.createdMs]
    .filter((ms): ms is number => typeof ms === 'number');
  return times.length > 0 ? Math.max(...times) : undefined;
}

/** A user (document and account) goes when it has no quotes left and has been inactive for the whole period. */
export function shouldDeleteUser(user: UserActivity, cutoff: Date): boolean {
  if (user.remainingQuotes > 0) return false;
  const last = lastActivityMs(user);
  // No date at all: leave it alone rather than delete something we cannot date
  return last !== undefined && last < cutoff.getTime();
}

/** Quote id from a Storage path (`briefs/{uid}/{quoteId}/...` or `quotes/{quoteId}/...`). */
export function quoteIdFromPath(path: string): string | undefined {
  const parts = path.split('/');
  if (parts[0] === 'briefs' && parts.length >= 4) return parts[2];
  if (parts[0] === 'quotes' && parts.length >= 3) return parts[1];
  return undefined;
}

/**
 * A file is an orphan when no quote document exists for it and it is old enough. The age check
 * matters: a request that is running right now has saved its brief but not yet its quote.
 */
export function isOrphanFile(
  file: { path: string; createdMs?: number },
  knownQuoteIds: ReadonlySet<string>,
  cutoff: Date
): boolean {
  const quoteId = quoteIdFromPath(file.path);
  if (!quoteId || knownQuoteIds.has(quoteId)) return false;
  return isExpired(file.createdMs, cutoff);
}
