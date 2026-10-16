import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { moderateContent, moderatePdf, ModerationUnreadableError } from './moderation';
import type { ModerationResponse } from './moderation';
import { extractProjectData, extractProjectDataFromPdf } from './extraction';
import { hasUsableContent } from './sanitize-extracted';
import { calculatePrice, HOURLY_RATE } from './pricing';
import { classifyGeminiError, describeError } from './gemini-retry';
import { generateOfferteHtml } from './quote-generator';
import { parseQuoteRequest } from './brief-input';
import type { ParsedQuoteRequest } from './brief-input';
import { readBriefSource } from './brief-source';
import { evaluateQuoteSlot } from './quote-limits';
import type { SlotVerdict, UserLimitData } from './quote-limits';
import { writeModerationLog } from './moderation-log';
import { isDisposableEmail } from '../shared/disposable-email';
import { offerNumber } from '../shared/company';
import {
  sendQuoteNotification,
  sendQuoteConfirmation,
} from '../shared/email.service';

/**
 * What the website sends. `mode` is optional: a request without it is a file upload, so the
 * website from before the text option keeps working against this function.
 * `fileSize` is still sent by older websites but ignored: the real size is checked on the data.
 */
export type QuoteRequest = ParsedQuoteRequest | { fileSize?: number };

export interface QuoteResponse {
  quoteId: string;
  offerteNr: string;
  projectTitle: string;
  projectType: string;
  complexity: string;
  description: string;
  targetAudience: string;
  timeline: string;
  features: string[];
  technicalRequirements: string[];
  /** Internal range the fixed price was derived from */
  hoursMin: number;
  hoursMax: number;
  priceMin: number;
  priceMax: number;
  /** Fixed total price (sum of the fixed phase prices): what the client sees */
  hoursFixed: number;
  priceFixed: number;
  currency: string;
  hourlyRate: number;
  // Full offer HTML for browser rendering
  offerteHtml: string;
  // Storage path of the saved HTML (for owner reference)
  offerteStoragePath: string;
  breakdown: {
    baseHours: { min: number; max: number };
    featureHours: { min: number; max: number };
    matchedFeatures: string[];
  };
}

const UNAVAILABLE_MESSAGE =
  'De offertetool is op dit moment tijdelijk niet beschikbaar. Probeer het over een paar minuten opnieuw, of neem direct contact op.';

/** True when a Gemini failure is on our side or Google's: the visitor can simply try again. */
function isOutage(err: unknown): boolean {
  const kind = classifyGeminiError(err);
  if (kind === 'billing' || kind === 'access') {
    // Needs action from the owner (credits empty, key revoked, model gone): make it visible in the logs
    console.error(`ACTION REQUIRED: Gemini ${kind} problem. Check billing / API key / model name in AI Studio.`);
  }
  return kind === 'busy' || kind === 'billing' || kind === 'access';
}

function slotError(verdict: Extract<SlotVerdict, { ok: false }>): HttpsError {
  // 'aborted' = a request of this user is already running; the website shows it without a daily-limit notice
  return new HttpsError(verdict.reason === 'in-flight' ? 'aborted' : 'resource-exhausted', verdict.message);
}

const BLOCKED_MESSAGE_FILE =
  'Je document lijkt geen projectbrief te zijn voor web- of app-ontwikkeling. Upload een document dat je software- of webontwikkelingsproject beschrijft.';
const BLOCKED_MESSAGE_TEXT =
  'Je tekst lijkt geen beschrijving van een web- of app-project te zijn. Beschrijf wat je wilt laten maken, voor wie het is en wat het moet kunnen.';
const TOO_VAGUE_MESSAGE =
  'Je beschrijving is nog te algemeen om er een offerte van te maken. Vertel wat je wilt laten maken, voor wie en wat het moet kunnen, en probeer het opnieuw.';

export const generateQuote = onCall(
  {
    maxInstances: 5,
    timeoutSeconds: 300,
    memory: '512MiB',
    enforceAppCheck: true,
    secrets: ['GEMINI_API_KEY', 'RESEND_API_KEY'],
  },
  async (request): Promise<QuoteResponse> => {
    // --- Auth check ---
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Je moet ingelogd zijn om een offerte aan te vragen.');
    }

    const uid = request.auth.uid;
    const userEmail = request.auth.token.email ?? '';
    const userName = request.auth.token.name ?? userEmail.split('@')[0];
    const emailVerified = request.auth.token.email_verified ?? false;

    if (!emailVerified) {
      throw new HttpsError(
        'failed-precondition',
        'Verifieer je e-mailadres voordat je een offerte aanvraagt.'
      );
    }
    if (isDisposableEmail(userEmail)) {
      throw new HttpsError('permission-denied', 'Gebruik een echt e-mailadres om een offerte aan te vragen.');
    }

    // --- Shape of the request (no Gemini, no Firestore) ---
    const parsed = parseQuoteRequest(request.data);
    if (!parsed.ok) {
      throw new HttpsError('invalid-argument', parsed.message);
    }

    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    // --- Limits, first a cheap look so a visitor over the limit does no work at all ---
    const peek = evaluateQuoteSlot((await userRef.get()).data() as UserLimitData | undefined, Date.now());
    if (!peek.ok) throw slotError(peek);

    // --- Read the brief: size, type, cleaning, length and quality. Visitor's to fix, no Gemini yet ---
    const read = await readBriefSource(parsed.value);
    if (!read.ok) {
      throw new HttpsError('invalid-argument', read.message);
    }
    const source = read.value;

    // --- Claim the slot in a transaction: limits are checked again and, if they allow it, this
    // request is marked as running. A second request (double click, two tabs) is refused until
    // this one is done, and every request that reaches Gemini counts as an attempt.
    await db.runTransaction(async tx => {
      const verdict = evaluateQuoteSlot((await tx.get(userRef)).data() as UserLimitData | undefined, Date.now());
      if (!verdict.ok) throw slotError(verdict);
      tx.set(
        userRef,
        {
          inFlightUntil: Timestamp.fromMillis(verdict.next.inFlightUntilMs),
          attemptWindowStart: Timestamp.fromMillis(verdict.next.attemptWindowStartMs),
          attemptCount: verdict.next.attemptCount,
        },
        { merge: true }
      );
    });

    // A Gemini outage is not the visitor's fault: the attempt is given back
    let refundAttempt = false;
    const outage = (message: string): HttpsError => {
      refundAttempt = true;
      return new HttpsError('unavailable', message);
    };

    // Files saved for a request that does not end in a quote are removed again (see the catch below)
    let unfinishedFiles: string[] = [];

    try {
      // --- Pre-moderation on the whole brief (text, or the content of a PDF). NOT fail-open:
      // an error here means "try again later" ---
      let moderation: ModerationResponse;
      try {
        moderation = source.pdfBase64 !== undefined
          ? await moderatePdf(source.pdfBase64)
          : await moderateContent(source.text ?? '');
      } catch (err) {
        console.error(`Moderation failed (uid=${uid} mode=${source.inputMode}): ${describeError(err)}`);
        if (err instanceof ModerationUnreadableError) {
          // Could be provoked by a crafted text, so this attempt is not given back
          throw new HttpsError('unavailable', UNAVAILABLE_MESSAGE);
        }
        throw isOutage(err)
          ? outage(UNAVAILABLE_MESSAGE)
          : new HttpsError('unavailable', UNAVAILABLE_MESSAGE);
      }

      const inputSize = {
        inputMode: source.inputMode,
        bytes: source.storageBuffer.length,
        ...(source.text !== undefined ? { chars: Array.from(source.text).length } : {}),
      };

      if (moderation.result === 'blocked') {
        // Gemini was called, quota was used: counts as a failed attempt (max 3 per 24 hours)
        await userRef.set(
          {
            failedAttemptCount: FieldValue.increment(1),
            lastFailedAttemptAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await writeModerationLog({ userId: uid, result: 'blocked', reason: moderation.reason, ...inputSize });
        throw new HttpsError(
          'invalid-argument',
          source.inputMode === 'text' ? BLOCKED_MESSAGE_TEXT : BLOCKED_MESSAGE_FILE
        );
      }

      // --- Save the brief in Firebase Storage (typed text as brief.txt) ---
      const quoteId = db.collection('quotes').doc().id;
      const briefStoragePath = `briefs/${uid}/${quoteId}/brief.${source.ext}`;
      const bucket = getStorage().bucket();

      await bucket.file(briefStoragePath).save(source.storageBuffer, {
        metadata: {
          contentType: source.contentType,
          metadata: { uploadedBy: uid, originalName: source.displayName, quoteId, source: source.inputMode },
        },
      });
      unfinishedFiles = [briefStoragePath];

      // --- Extract project data with Gemini ---
      let extractedData;
      try {
        extractedData = source.pdfBase64 !== undefined
          ? await extractProjectDataFromPdf(source.pdfBase64)
          : await extractProjectData(source.text ?? '');
      } catch (err) {
        // Retries are already done inside extraction. Never log the error object: it can contain the brief.
        const kind = classifyGeminiError(err);
        console.error(`Gemini extraction failed (${kind}, uid=${uid} mode=${source.inputMode}): ${describeError(err)}`);
        if (isOutage(err)) {
          // Our side or Google's, not the visitor's: no failed attempt, the attempt is given back
          throw outage(UNAVAILABLE_MESSAGE);
        }
        // Unreadable or unexpected answer: could be provoked by a crafted text, so it stays an attempt
        throw new HttpsError(
          'internal',
          'Er ging iets mis bij het lezen van je beschrijving. Probeer het opnieuw, of neem direct contact op.'
        );
      }

      if (!hasUsableContent(extractedData)) {
        throw new HttpsError('invalid-argument', TOO_VAGUE_MESSAGE);
      }

      // --- Calculate price ---
      const priceEstimate = calculatePrice(extractedData);

      // --- Generate full HTML offer document ---
      const generatedAt = new Date();
      const offerteHtml = generateOfferteHtml({
        quoteId,
        extractedData,
        priceEstimate,
        userName,
        userEmail,
        generatedAt,
      });

      // --- Save HTML offer to Firebase Storage ---
      const offerteStoragePath = `quotes/${quoteId}/offerte.html`;
      await bucket.file(offerteStoragePath).save(Buffer.from(offerteHtml, 'utf-8'), {
        metadata: {
          contentType: 'text/html; charset=utf-8',
          metadata: { quoteId, generatedFor: userEmail, generatedAt: generatedAt.toISOString() },
        },
      });
      unfinishedFiles.push(offerteStoragePath);

      // --- Generate signed download URLs (valid 30 days) ---
      // The App Engine default service account (which Cloud Functions v2 runs as) has
      // the Service Account Token Creator role, granting it iam.serviceAccounts.signBlob.
      const signedUrlExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const [[briefSignedUrl], [offerteSignedUrl]] = await Promise.all([
        bucket.file(briefStoragePath).getSignedUrl({ action: 'read', expires: signedUrlExpiry }),
        bucket.file(offerteStoragePath).getSignedUrl({ action: 'read', expires: signedUrlExpiry }),
      ]);

      // --- Save quote to Firestore ---
      const offerteNr = offerNumber(quoteId);
      await db.collection('quotes').doc(quoteId).set({
        userId: uid,
        userEmail,
        userName,
        submittedAt: FieldValue.serverTimestamp(),
        briefStoragePath,
        offerteStoragePath,
        offerteNr,
        fileName: source.displayName,
        inputMode: source.inputMode,
        extractedData,
        priceRange: {
          min: priceEstimate.priceMin,
          max: priceEstimate.priceMax,
          currency: 'EUR',
          hoursMin: priceEstimate.hoursMin,
          hoursMax: priceEstimate.hoursMax,
          fixed: priceEstimate.priceFixed,
          hoursFixed: priceEstimate.hoursFixed,
        },
        phaseBreakdowns: priceEstimate.phaseBreakdowns,
        paymentSchedule: priceEstimate.paymentSchedule,
        breakdown: priceEstimate.breakdown,
        status: 'pending',
        moderationResult: moderation.result,
        ...(moderation.reason ? { moderationReason: moderation.reason } : {}),
      });

      unfinishedFiles = []; // the quote exists: its files are kept (until the retention period ends)

      // --- The quote exists: set lastQuoteAt and reset the failed attempt counter ---
      await userRef.set(
        {
          email: userEmail,
          displayName: userName,
          lastQuoteAt: FieldValue.serverTimestamp(),
          failedAttemptCount: 0,
        },
        { merge: true }
      );

      if (moderation.result === 'flagged') {
        await writeModerationLog({ userId: uid, result: 'flagged', reason: moderation.reason, quoteId, ...inputSize });
      }

      // --- Send notification emails (fire-and-forget) ---
      const emailPayload = {
        userName,
        userEmail,
        quoteId,
        offerteNr,
        projectTitle: extractedData.projectTitle,
        projectType: extractedData.projectType,
        complexity: priceEstimate.complexity,
        priceMin: priceEstimate.priceMin,
        priceMax: priceEstimate.priceMax,
        hoursMin: priceEstimate.hoursMin,
        hoursMax: priceEstimate.hoursMax,
        priceFixed: priceEstimate.priceFixed,
        hoursFixed: priceEstimate.hoursFixed,
        features: extractedData.features,
        briefStoragePath,
        offerteStoragePath,
        offerteHtml,
        briefSignedUrl,
        offerteSignedUrl,
        inputMode: source.inputMode,
        moderationResult: moderation.result,
        moderationReason: moderation.reason,
      };

      Promise.all([
        sendQuoteNotification(emailPayload),
        sendQuoteConfirmation(emailPayload),
      ]).catch(err => console.error(`Email sending failed: ${describeError(err)}`));

      // --- Return quote to client ---
      return {
        quoteId,
        offerteNr,
        projectTitle: extractedData.projectTitle,
        projectType: extractedData.projectType,
        complexity: priceEstimate.complexity,
        description: extractedData.description,
        targetAudience: extractedData.targetAudience,
        timeline: extractedData.timeline,
        features: extractedData.features,
        technicalRequirements: extractedData.technicalRequirements,
        hoursMin: priceEstimate.hoursMin,
        hoursMax: priceEstimate.hoursMax,
        priceMin: priceEstimate.priceMin,
        priceMax: priceEstimate.priceMax,
        hoursFixed: priceEstimate.hoursFixed,
        priceFixed: priceEstimate.priceFixed,
        currency: 'EUR',
        hourlyRate: HOURLY_RATE,
        offerteHtml,
        offerteStoragePath,
        breakdown: priceEstimate.breakdown,
      };
    } catch (err) {
      // No quote came out of this request: do not keep the visitor's text (or half an offer) in Storage
      if (unfinishedFiles.length > 0) {
        const bucket = getStorage().bucket();
        await Promise.all(
          unfinishedFiles.map(path =>
            bucket.file(path).delete({ ignoreNotFound: true }).catch(error => {
              console.error(`Removing an unfinished file failed (uid=${uid}): ${describeError(error)}`);
            })
          )
        );
      }
      throw err;
    } finally {
      // Release the slot, whatever happened. A crash that skips this releases itself after SLOT_SECONDS.
      try {
        await userRef.set(
          {
            inFlightUntil: FieldValue.delete(),
            ...(refundAttempt ? { attemptCount: FieldValue.increment(-1) } : {}),
          },
          { merge: true }
        );
      } catch (err) {
        console.error(`Releasing the quote slot failed (uid=${uid}): ${describeError(err)}`);
      }
    }
  }
);
