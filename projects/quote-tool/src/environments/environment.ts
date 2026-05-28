// Firebase client-side configuration.
//
// ✅ These values are SAFE to commit and make public.
//
// Firebase client config is NOT a secret — it is intentionally public.
// It is embedded in every Firebase web app and visible in the browser.
// Security is enforced by:
//   • Firebase Security Rules (Firestore + Storage)
//   • Firebase App Check (reCAPTCHA Enterprise) on Cloud Functions
//   • Firebase Authentication (users must be signed in)
//
// See: https://firebase.google.com/docs/projects/api-keys
//
// The actual secrets (GEMINI_API_KEY, RESEND_API_KEY) live exclusively
// in Firebase Secret Manager and are never committed to source control.

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
