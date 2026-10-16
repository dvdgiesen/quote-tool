import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import {
  isOrphanFile,
  retentionCutoff,
  shouldDeleteQuote,
  shouldDeleteUser,
} from './retention';
import { describeError } from './gemini-retry';

/**
 * Daily clean-up of personal data after the retention period (see retention.ts for the rules and
 * the privacy statement on the portfolio for the promise made to visitors).
 *
 * SAFE BY DEFAULT: without `RETENTION_MODE=delete` in functions/.env this only logs how many
 * records it WOULD delete. Check those numbers in the logs first, mark quotes you want to keep as
 * `converted`, then switch to delete mode and deploy again.
 *
 * Logs contain counts only: never text, names or e-mail addresses.
 */

const PAGE_SIZE = 100;
/** Per part and run: stay well inside the function timeout. The next day continues. */
const MAX_PER_RUN = 1000;
const TIME_BUDGET_MS = 450_000;

interface Counts {
  quotes: number;
  contacts: number;
  moderationLog: number;
  orphanFiles: number;
  userDocs: number;
  accounts: number;
  failures: number;
}

const isDeleteMode = (): boolean => process.env['RETENTION_MODE'] === 'delete';

const ms = (value: unknown): number | undefined =>
  value instanceof Timestamp ? value.toMillis() : undefined;

/** Walks a query in pages ordered by `field`, so documents that are kept do not block the rest. */
async function* pages(base: Query, field: string, deadline: number): AsyncGenerator<QueryDocumentSnapshot[]> {
  let last: QueryDocumentSnapshot | undefined;
  let seen = 0;
  while (seen < MAX_PER_RUN && Date.now() < deadline) {
    let query = base.orderBy(field).limit(PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snapshot = await query.get();
    if (snapshot.empty) return;
    seen += snapshot.size;
    last = snapshot.docs[snapshot.docs.length - 1];
    yield snapshot.docs;
  }
}

async function deleteQuotes(cutoff: Date, apply: boolean, counts: Counts, deadline: number): Promise<void> {
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const base = db.collection('quotes').where('submittedAt', '<', Timestamp.fromDate(cutoff));

  for await (const docs of pages(base, 'submittedAt', deadline)) {
    for (const doc of docs) {
      const data = doc.data();
      const quote = { submittedAtMs: ms(data['submittedAt']), status: data['status'] as string | undefined };
      if (!shouldDeleteQuote(quote, cutoff)) continue;
      if (!apply) {
        counts.quotes++;
        continue;
      }
      try {
        // Files first, then the document: if a file cannot be removed the document stays and tomorrow retries
        const userId = typeof data['userId'] === 'string' ? data['userId'] : undefined;
        if (userId) await bucket.deleteFiles({ prefix: `briefs/${userId}/${doc.id}/` });
        await bucket.deleteFiles({ prefix: `quotes/${doc.id}/` });
        await doc.ref.delete();
        counts.quotes++;
      } catch (err) {
        counts.failures++;
        console.error(`Retention: deleting a quote failed: ${describeError(err)}`);
      }
    }
  }
}

/** Deletes documents older than the cutoff in batches. A dry run only counts. */
async function deleteOldDocuments(
  collection: 'contacts' | 'moderationLog',
  field: 'submittedAt' | 'createdAt',
  cutoff: Date,
  apply: boolean,
  deadline: number
): Promise<{ deleted: number; failures: number }> {
  const db = getFirestore();
  const expired = db.collection(collection).where(field, '<', Timestamp.fromDate(cutoff));

  if (!apply) {
    return { deleted: (await expired.count().get()).data().count, failures: 0 };
  }

  let deleted = 0;
  while (deleted < MAX_PER_RUN && Date.now() < deadline) {
    const snapshot = await expired.orderBy(field).limit(PAGE_SIZE).get();
    if (snapshot.empty) break;
    try {
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deleted += snapshot.size;
    } catch (err) {
      console.error(`Retention: deleting ${collection} failed: ${describeError(err)}`);
      return { deleted, failures: 1 };
    }
  }
  return { deleted, failures: 0 };
}

/** Files in Storage that belong to no quote: left behind by a request that failed after saving the brief. */
async function deleteOrphanFiles(cutoff: Date, apply: boolean, counts: Counts, deadline: number): Promise<void> {
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const quoteExists = new Map<string, boolean>();
  let handled = 0;

  for (const prefix of ['briefs/', 'quotes/']) {
    const quoteIdIndex = prefix === 'briefs/' ? 2 : 1;
    let query: { prefix: string; maxResults: number; autoPaginate: false; pageToken?: string } | undefined = {
      prefix, maxResults: 500, autoPaginate: false,
    };

    while (query && handled < MAX_PER_RUN * 5 && Date.now() < deadline) {
      const [files, nextQuery] = await bucket.getFiles(query);
      const next = nextQuery as { pageToken?: string } | null;
      query = next?.pageToken ? { ...query, pageToken: next.pageToken } : undefined;

      for (const file of files) {
        handled++;
        const created = file.metadata.timeCreated ? Date.parse(String(file.metadata.timeCreated)) : undefined;
        const quoteId = file.name.split('/')[quoteIdIndex];
        if (created === undefined || Number.isNaN(created) || !quoteId || created >= cutoff.getTime()) continue;

        if (!quoteExists.has(quoteId)) {
          quoteExists.set(quoteId, (await db.collection('quotes').doc(quoteId).get()).exists);
        }
        const known = new Set(quoteExists.get(quoteId) ? [quoteId] : []);
        if (!isOrphanFile({ path: file.name, createdMs: created }, known, cutoff)) continue;

        if (apply) {
          try {
            await file.delete();
          } catch (err) {
            counts.failures++;
            console.error(`Retention: deleting an orphan file failed: ${describeError(err)}`);
            continue;
          }
        }
        counts.orphanFiles++;
      }
    }
  }
}

/** Users (document and Firebase account) with no quotes left and no activity for the whole period. */
async function deleteInactiveUsers(cutoff: Date, apply: boolean, counts: Counts, deadline: number): Promise<void> {
  const db = getFirestore();
  const auth = getAuth();
  let pageToken: string | undefined;
  let seen = 0;

  do {
    if (Date.now() >= deadline || seen >= MAX_PER_RUN) return;
    const result = await auth.listUsers(PAGE_SIZE, pageToken);
    pageToken = result.pageToken;
    seen += result.users.length;

    for (const account of result.users) {
      const uid = account.uid;
      try {
        const remainingQuotes = (await db.collection('quotes').where('userId', '==', uid).count().get()).data().count;
        const userData = (await db.collection('users').doc(uid).get()).data() as DocumentData | undefined;
        const times = [account.metadata.lastSignInTime, account.metadata.lastRefreshTime, account.metadata.creationTime]
          .map(value => (value ? Date.parse(value) : NaN))
          .filter(value => !Number.isNaN(value));

        const remove = shouldDeleteUser(
          {
            lastSignInMs: times.length > 0 ? Math.max(...times) : undefined,
            lastQuoteAtMs: ms(userData?.['lastQuoteAt']),
            lastFailedAttemptAtMs: ms(userData?.['lastFailedAttemptAt']),
            remainingQuotes,
          },
          cutoff
        );
        if (!remove) continue;

        if (apply) {
          await db.collection('users').doc(uid).delete();
          await auth.deleteUser(uid);
        }
        counts.accounts++;
        if (userData) counts.userDocs++;
      } catch (err) {
        counts.failures++;
        console.error(`Retention: handling a user failed: ${describeError(err)}`);
      }
    }
  } while (pageToken);
}

export const retentionCleanup = onSchedule(
  {
    schedule: 'every day 03:30',
    timeZone: 'Europe/Amsterdam',
    timeoutSeconds: 540,
    memory: '512MiB',
    maxInstances: 1,
  },
  async () => {
    const apply = isDeleteMode();
    const cutoff = retentionCutoff(new Date());
    const deadline = Date.now() + TIME_BUDGET_MS;
    const counts: Counts = {
      quotes: 0, contacts: 0, moderationLog: 0, orphanFiles: 0, userDocs: 0, accounts: 0, failures: 0,
    };

    // Order matters: quotes first, so users are judged on the quotes that are left.
    // A dry run deletes nothing, so its user count can include users whose quotes a real run would remove first.
    await deleteQuotes(cutoff, apply, counts, deadline);

    const contacts = await deleteOldDocuments('contacts', 'submittedAt', cutoff, apply, deadline);
    counts.contacts = contacts.deleted;
    counts.failures += contacts.failures;

    const log = await deleteOldDocuments('moderationLog', 'createdAt', cutoff, apply, deadline);
    counts.moderationLog = log.deleted;
    counts.failures += log.failures;

    await deleteOrphanFiles(cutoff, apply, counts, deadline);
    await deleteInactiveUsers(cutoff, apply, counts, deadline);

    console.log(
      `Retention ${apply ? 'DELETED' : 'DRY RUN (would delete)'} before ${cutoff.toISOString()}: ${JSON.stringify(counts)}`
    );
    if (counts.failures > 0) console.error(`Retention: ${counts.failures} item(s) failed, they are retried tomorrow.`);
  }
);
