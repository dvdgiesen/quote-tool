import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Firebase Admin SDK once
if (!getApps().length) {
  initializeApp();
}

// Export all Cloud Functions
export { contact } from './contact/contact.function';
export { generateQuote } from './quote/quote.function';
