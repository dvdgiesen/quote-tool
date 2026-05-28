import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sendContactNotification, sendContactConfirmation } from '../shared/email.service';

// Disposable email domain blocklist
const BLOCKED_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net',
  'guerrillamail.org', 'spam4.me', 'trashmail.com', 'trashmail.me',
  'dispostable.com', 'maildrop.cc', 'spamgourmet.com', 'fakeinbox.com',
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? BLOCKED_DOMAINS.has(domain) : false;
}

export const contact = onRequest(
  {
    cors: [
      'https://watsturen.nl',
      'https://www.watsturen.nl',
      'https://portfolio--watsturen-24f12.europe-west4.hosted.app',
      'http://localhost:4200',
    ],
    maxInstances: 10,
    timeoutSeconds: 30,
    secrets: ['RESEND_API_KEY'],
  },
  async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { name, email, subject, message } = req.body as {
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
    };

    // --- Validation ---
    if (!name?.trim() || name.trim().length < 2) {
      res.status(400).json({ error: 'Naam is vereist (min. 2 tekens)' });
      return;
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Geldig e-mailadres is vereist' });
      return;
    }
    if (isDisposableEmail(email.trim())) {
      res.status(400).json({ error: 'Gebruik een echt e-mailadres' });
      return;
    }
    if (!subject?.trim() || subject.trim().length < 3) {
      res.status(400).json({ error: 'Onderwerp is vereist (min. 3 tekens)' });
      return;
    }
    if (!message?.trim() || message.trim().length < 20) {
      res.status(400).json({ error: 'Bericht is vereist (min. 20 tekens)' });
      return;
    }
    if (message.trim().length > 5000) {
      res.status(400).json({ error: 'Bericht is te lang (max. 5000 tekens)' });
      return;
    }

    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    };

    try {
      // Save to Firestore
      const db = admin.firestore();
      await db.collection('contacts').add({
        ...payload,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        ip: req.ip ?? null,
      });

      // Send emails in parallel
      await Promise.all([
        sendContactNotification(payload),
        sendContactConfirmation(payload),
      ]);

      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Contact function error:', err);
      res.status(500).json({ error: 'Verzenden mislukt. Probeer het opnieuw.' });
    }
  }
);
