// =============================================================================
// FIREBASE CLIENT CONFIGURATION — SAFE TO COMMIT AND MAKE PUBLIC
// =============================================================================
//
// GitHub's secret scanner flags this as a "Google API Key" — it is NOT a secret.
//
// Firebase client config is INTENTIONALLY public. Google documents this clearly:
//
//   "It is okay to include your Firebase config object in your version control
//    system, including your API key. The API key for a Firebase Web App is not
//    a secret — it only identifies your Firebase project to Google's servers."
//
//   Source: https://firebase.google.com/docs/projects/api-keys
//
// This key cannot be used to access any backend resources on its own.
// Security is enforced by multiple layers:
//
//   1. Firebase Security Rules  — Firestore + Storage rules restrict all access
//   2. Firebase App Check       — Cloud Functions reject calls without a valid
//                                 reCAPTCHA Enterprise token (enforced server-side)
//   3. Firebase Authentication  — Users must be signed in + email-verified
//
// The REAL secrets (GEMINI_API_KEY, RESEND_API_KEY) live exclusively in
// Firebase Secret Manager and are NEVER committed to source control.
//
// =============================================================================

export const environment = {
  production: true,
  firebase: {
    apiKey:            'AIzaSyDdRt6us-4XgUU9sfM4o-Q6WI2HxPAXb3g',
    authDomain:        'watsturen-24f12.firebaseapp.com',
    projectId:         'watsturen-24f12',
    storageBucket:     'watsturen-24f12.firebasestorage.app',
    messagingSenderId: '622135956340',
    appId:             '1:622135956340:web:09b5782e29b632eef7d221',
  },
};
