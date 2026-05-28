import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { moderateContent } from './moderation';
import { extractProjectData, extractProjectDataFromFile } from './extraction';
import { calculatePrice } from './pricing';
import { generateOfferteHtml } from './quote-generator';
import {
  sendQuoteNotification,
  sendQuoteConfirmation,
} from '../shared/email.service';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const RATE_LIMIT_HOURS = 24;
const MIN_CONTENT_WORDS = 30; // Minimum words for a valid brief
const MAX_FAILED_ATTEMPTS = 3; // Max invalid submissions per 24h before blocking

export interface QuoteRequest {
  fileName: string;
  mimeType: string;
  fileBase64: string; // base64-encoded file content
  fileSize: number;
}

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
  hoursMin: number;
  hoursMax: number;
  priceMin: number;
  priceMax: number;
  currency: string;
  hourlyRate: number;
  // Full offer HTML for browser rendering
  offerteHtml: string;
  // Storage path of the saved HTML (for owner reference)
  offerteStoragePath: string;
  breakdown: {
    baseHours: { min: number; max: number };
    featureHours: { min: number; max: number };
    complexityMultiplier: number;
    matchedFeatures: string[];
  };
}

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

    const { fileName, mimeType, fileBase64, fileSize } = request.data as QuoteRequest;

    // --- File validation ---
    if (!fileName || !mimeType || !fileBase64) {
      throw new HttpsError('invalid-argument', 'Ontbrekende bestandsgegevens.');
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new HttpsError(
        'invalid-argument',
        'Ongeldig bestandstype. Upload een PDF, Word-document of tekstbestand.'
      );
    }
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new HttpsError(
        'invalid-argument',
        'Bestand is te groot. Maximale bestandsgrootte is 5 MB.'
      );
    }

    const db = admin.firestore();
    const storage = admin.storage();

    // --- Rate limit checks (single Firestore read for both) ---
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    // 1. Successful quote rate limit (1 per 24h)
    if (userData?.['lastQuoteAt']) {
      const lastQuoteAt = (userData['lastQuoteAt'] as admin.firestore.Timestamp).toDate();
      const hoursSinceLastQuote = (Date.now() - lastQuoteAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastQuote < RATE_LIMIT_HOURS) {
        const hoursRemaining = Math.ceil(RATE_LIMIT_HOURS - hoursSinceLastQuote);
        throw new HttpsError(
          'resource-exhausted',
          `Je hebt vandaag al een offerte aangevraagd. Probeer het over ${hoursRemaining} uur opnieuw.`
        );
      }
    }

    // 2. Failed attempt rate limit (max 3 invalid submissions per 24h)
    // This prevents abuse via repeated uploads of non-brief documents that
    // pass file validation but burn Gemini quota during moderation.
    if (userData?.['lastFailedAttemptAt']) {
      const lastFailedAt = (userData['lastFailedAttemptAt'] as admin.firestore.Timestamp).toDate();
      const hoursSinceLastFailed = (Date.now() - lastFailedAt.getTime()) / (1000 * 60 * 60);
      const failedCount = (userData['failedAttemptCount'] as number) ?? 0;
      if (hoursSinceLastFailed < RATE_LIMIT_HOURS && failedCount >= MAX_FAILED_ATTEMPTS) {
        const hoursRemaining = Math.ceil(RATE_LIMIT_HOURS - hoursSinceLastFailed);
        throw new HttpsError(
          'resource-exhausted',
          `Te veel ongeldige inzendingen vandaag. Probeer het over ${hoursRemaining} uur opnieuw.`
        );
      }
    }

    // Helper: increment failed attempt counter and then throw the given error.
    const rejectWithFailedAttempt = async (message: string): Promise<never> => {
      await userRef.set(
        {
          failedAttemptCount: admin.firestore.FieldValue.increment(1),
          lastFailedAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      throw new HttpsError('invalid-argument', message);
    };

    // --- Decode file ---
    const fileBuffer = Buffer.from(fileBase64, 'base64');

    const isDocx =
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword';

    // --- Determine moderation text ---
    let moderationText: string;
    let preExtractedDocxText: string | undefined;

    if (mimeType === 'text/plain') {
      moderationText = fileBuffer.toString('utf-8');
    } else if (isDocx) {
      const mammoth = await import('mammoth');
      const { value: docxText } = await mammoth.extractRawText({ buffer: fileBuffer });
      preExtractedDocxText = docxText;
      moderationText = docxText;
    } else {
      // PDF: use filename as hint — Gemini will validate content during extraction
      moderationText = `File: ${fileName} (PDF document)`;
    }

    // --- Word count check (before moderation) ---
    const wordCount = moderationText.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < MIN_CONTENT_WORDS && mimeType !== 'application/pdf') {
      throw new HttpsError(
        'invalid-argument',
        'Je document is te kort om een zinvolle offerte te genereren. Geef een uitgebreidere projectomschrijving (minimaal een paar alinea\'s).'
      );
    }

    // --- Pre-moderation check ---
    const moderation = await moderateContent(moderationText.slice(0, 2000));

    if (moderation.result === 'blocked') {
      await rejectWithFailedAttempt(
        'Je document lijkt geen projectbrief te zijn voor web- of app-ontwikkeling. Upload een document dat je software- of webontwikkelingsproject beschrijft.'
      );
    }

    // --- Upload brief to Firebase Storage ---
    const quoteId = db.collection('quotes').doc().id;
    const ext = fileName.split('.').pop() ?? 'bin';
    const briefStoragePath = `briefs/${uid}/${quoteId}/brief.${ext}`;
    const bucket = storage.bucket();

    await bucket.file(briefStoragePath).save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        metadata: { uploadedBy: uid, originalName: fileName, quoteId },
      },
    });

    // --- Extract project data with Gemini ---
    let extractedData;

    if (mimeType === 'text/plain') {
      extractedData = await extractProjectData(fileBuffer.toString('utf-8'));
    } else if (isDocx && preExtractedDocxText) {
      extractedData = await extractProjectData(preExtractedDocxText);
    } else {
      const result = await extractProjectDataFromFile(fileBase64, mimeType, fileName);
      extractedData = result.data;
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

    // --- Generate signed download URLs (valid 30 days) ---
    const signedUrlExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const [[briefSignedUrl], [offerteSignedUrl]] = await Promise.all([
      bucket.file(briefStoragePath).getSignedUrl({ action: 'read', expires: signedUrlExpiry }),
      bucket.file(offerteStoragePath).getSignedUrl({ action: 'read', expires: signedUrlExpiry }),
    ]);

    // --- Save quote to Firestore ---
    const offerteNr = `WS-${quoteId.slice(0, 8).toUpperCase()}`;
    const quoteData = {
      userId: uid,
      userEmail,
      userName,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      briefStoragePath,
      offerteStoragePath,
      offerteNr,
      fileName,
      extractedData,
      priceRange: {
        min: priceEstimate.priceMin,
        max: priceEstimate.priceMax,
        currency: 'EUR',
        hoursMin: priceEstimate.hoursMin,
        hoursMax: priceEstimate.hoursMax,
      },
      phaseBreakdowns: priceEstimate.phaseBreakdowns,
      paymentSchedule: priceEstimate.paymentSchedule,
      breakdown: priceEstimate.breakdown,
      status: 'pending',
      moderationResult: moderation.result,
    };

    await db.collection('quotes').doc(quoteId).set(quoteData);

    // --- Update user record ---
    await userRef.set(
      {
        email: userEmail,
        displayName: userName,
        lastQuoteAt: admin.firestore.FieldValue.serverTimestamp(),
        failedAttemptCount: 0,
      },
      { merge: true }
    );

    // --- Send notification emails (fire-and-forget) ---
    const emailPayload = {
      userName,
      userEmail,
      quoteId,
      offerteNr,
      projectTitle: extractedData.projectTitle,
      projectType: extractedData.projectType,
      complexity: extractedData.complexity,
      priceMin: priceEstimate.priceMin,
      priceMax: priceEstimate.priceMax,
      hoursMin: priceEstimate.hoursMin,
      hoursMax: priceEstimate.hoursMax,
      features: extractedData.features,
      briefStoragePath,
      offerteStoragePath,
      offerteHtml,
      briefSignedUrl,
      offerteSignedUrl,
    };

    Promise.all([
      sendQuoteNotification(emailPayload),
      sendQuoteConfirmation(emailPayload),
    ]).catch(err => console.error('Email sending failed:', err));

    // --- Return quote to client ---
    return {
      quoteId,
      offerteNr,
      projectTitle: extractedData.projectTitle,
      projectType: extractedData.projectType,
      complexity: extractedData.complexity,
      description: extractedData.description,
      targetAudience: extractedData.targetAudience,
      timeline: extractedData.timeline,
      features: extractedData.features,
      technicalRequirements: extractedData.technicalRequirements,
      hoursMin: priceEstimate.hoursMin,
      hoursMax: priceEstimate.hoursMax,
      priceMin: priceEstimate.priceMin,
      priceMax: priceEstimate.priceMax,
      currency: 'EUR',
      hourlyRate: 65,
      offerteHtml,
      offerteStoragePath,
      breakdown: priceEstimate.breakdown,
    };
  }
);
