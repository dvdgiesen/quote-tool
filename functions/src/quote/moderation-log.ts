import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { ModerationResult } from './moderation';

/**
 * Logbook of submissions the moderation blocked or flagged (Firestore collection `moderationLog`).
 *
 * Why: a blocked submission leaves nothing else behind (no quote, no e-mail), so without this the
 * owner cannot see that someone tried something, how often, or why it was refused.
 *
 * Privacy: the text the visitor typed or uploaded is deliberately NOT stored here, only the
 * user id, the size and the reason the moderator gave. That keeps the log free of personal data
 * written in the brief. The collection can only be read in the Firebase console (firestore.rules).
 */
export interface ModerationLogEntry {
  userId: string;
  inputMode: 'text' | 'file';
  result: Exclude<ModerationResult, 'clean'>;
  reason?: string;
  /** Characters of the text; absent for a PDF. */
  chars?: number;
  bytes: number;
  /** Set when the submission went on to become a quote (flagged only). */
  quoteId?: string;
}

/** Never throws: a failing log write must not break a visitor's request. */
export async function writeModerationLog(entry: ModerationLogEntry): Promise<void> {
  try {
    await getFirestore().collection('moderationLog').add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Writing moderationLog failed:', err instanceof Error ? err.name : typeof err);
  }
}
