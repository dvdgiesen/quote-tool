/**
 * Retry and error classification for Gemini calls.
 *
 * Why: Google answers with 503 ("high demand") now and then. Such errors are short-lived, so a
 * visitor should not see a failure for something a second attempt solves.
 */

/** HTTP statuses that are worth another attempt. */
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

export type GeminiFailureKind =
  | 'busy'     // overloaded / rate limited / network hiccup: try again later
  | 'billing'  // 402: prepaid credits depleted (owner has to act)
  | 'access'   // 400/401/403/404: invalid key, no access, model gone (owner has to act)
  | 'other';

/**
 * HTTP status of a Gemini SDK error. Read from the `status` field instead of using
 * `instanceof GoogleGenerativeAIFetchError`: that check silently fails when two copies of the
 * SDK are loaded (bundling, duplicate dependency), and a missed 503 would mean no retry.
 */
function statusOf(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}

/** True for errors where no HTTP answer arrived (connection reset, DNS, timeout). */
function isNetworkError(err: unknown): boolean {
  return (
    err instanceof Error &&
    statusOf(err) === undefined &&
    /fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket/i.test(err.message)
  );
}

export function classifyGeminiError(err: unknown): GeminiFailureKind {
  const status = statusOf(err);
  if (status !== undefined) {
    if (TRANSIENT_STATUS.has(status)) return 'busy';
    if (status === 402) return 'billing';
    if ([400, 401, 403, 404].includes(status)) return 'access';
    return 'other';
  }
  return isNetworkError(err) ? 'busy' : 'other';
}

/**
 * Short description of an error that is safe to log: the error name and HTTP status only.
 * Never log the error object or its message: a JSON syntax error quotes the model output, and an
 * API error can echo parts of the request, and both can contain the visitor's text.
 */
export function describeError(err: unknown): string {
  const name = err instanceof Error ? err.name : typeof err;
  const status = statusOf(err);
  return status === undefined ? name : `${name} status=${status}`;
}

export interface RetryOptions {
  /** Total number of attempts, including the first one. */
  attempts?: number;
  /** Wait before the second attempt; doubles each time (plus up to 25% random jitter). */
  baseDelayMs?: number;
  /** Name for the log line. */
  label?: string;
  /** Replaceable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Runs `fn` and retries on transient Gemini errors (503, 429, 5xx, network).
 * Errors that a retry cannot fix (402 billing, 400/403/404 access) are thrown immediately.
 * The last error is thrown unchanged, so callers can still classify it.
 */
export async function withGeminiRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 4, baseDelayMs = 2000, label = 'gemini', sleep = defaultSleep } = options;

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const kind = classifyGeminiError(err);
      if (kind !== 'busy' || attempt >= attempts) throw err;

      const delay = Math.round(baseDelayMs * 2 ** (attempt - 1) * (1 + Math.random() * 0.25));
      console.warn(`${label}: attempt ${attempt}/${attempts} failed (${statusOf(err) ?? 'network'}), retrying in ${delay} ms`);
      await sleep(delay);
    }
  }
}
