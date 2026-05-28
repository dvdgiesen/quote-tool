import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp();
}

// Export all Cloud Functions
export { contact } from './contact/contact.function';
export { generateQuote } from './quote/quote.function';
