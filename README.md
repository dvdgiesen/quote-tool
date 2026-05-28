# Quote Tool — watsturen.nl

> An AI-powered instant quote generator built with Angular 19, Firebase, and Google Gemini.  
> Live at **[quote.watsturen.nl](https://quote.watsturen.nl)**

---

## What it does

Upload a project brief (PDF, Word, or plain text) and receive a detailed price estimate within seconds. The tool uses Google Gemini to extract project details, classify complexity, and generate a formatted Dutch-language quote document — all without any manual input.

**Flow:**
1. Sign in (Google or email/password, with email verification)
2. Upload your project brief
3. Receive a price range, hour estimate, feature breakdown, and a printable PDF quote

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular 19 (standalone components, signals, SSR) |
| Backend | Firebase Cloud Functions (Node 22, TypeScript) |
| AI | Google Gemini 2.0 Flash via `@google/genai` |
| Auth | Firebase Authentication (Google + email/password) |
| Database | Firestore (quote storage, rate limiting) |
| File storage | Firebase Storage |
| Email | Resend API |
| Security | Firebase App Check (reCAPTCHA Enterprise) |
| Hosting | Firebase App Hosting |

---

## Architecture

```
quote-tool/
├── projects/quote-tool/          # Angular 19 SSR app
│   └── src/app/
│       ├── features/
│       │   ├── landing/          # Public landing page
│       │   ├── auth/             # Sign in / sign up
│       │   ├── upload/           # File upload + progress UI
│       │   └── result/           # Quote result + print-to-PDF
│       ├── core/
│       │   ├── guards/           # Auth guard (waits for Firebase state)
│       │   └── services/         # Firebase, Auth, Quote services
│       └── shared/
│           ├── icons/            # Self-contained SVG icon component
│           └── logo/             # Logo link component
└── functions/src/
    ├── quote/
    │   ├── quote.function.ts     # Cloud Function entry point
    │   ├── extraction.ts         # Gemini document parsing
    │   ├── pricing.ts            # Hour/price calculation logic
    │   ├── moderation.ts         # Input validation
    │   └── quote-generator.ts    # HTML quote document generator
    ├── contact/
    │   └── contact.function.ts   # Contact form Cloud Function
    └── shared/
        └── email.service.ts      # Resend email service
```

---

## Security model

### Firebase client config (`environment.ts`)

The Firebase config values in `environment.ts` are **intentionally public** — this is by design and documented by Google:

> "It is okay to include your Firebase config object in your version control system, including your API key."  
> — [Firebase documentation](https://firebase.google.com/docs/projects/api-keys)

Security is enforced by:
- **Firebase Security Rules** — Firestore and Storage rules restrict read/write access
- **Firebase App Check** (reCAPTCHA Enterprise) — Cloud Functions reject requests without a valid App Check token
- **Firebase Authentication** — users must be signed in and email-verified to call the quote function

### Actual secrets

The real secrets (`GEMINI_API_KEY`, `RESEND_API_KEY`) live exclusively in **Firebase Secret Manager** and are never committed to source control. They are injected at runtime by Firebase App Hosting.

---

## Key design decisions

### Angular Signals throughout
All reactive state uses Angular's built-in `signal()` and `computed()` — no RxJS observables in components (except where the router guard requires it).

### Auth guard race condition fix
The `authGuard` uses `toObservable(auth.loading)` to wait for Firebase's `onAuthStateChanged` to resolve before making an auth decision. Without this, the guard fires while `user` is still `null` and always redirects to `/auth`.

### Progress bar on the submit button
The upload button doubles as a progress indicator — a CSS custom property (`--progress`) drives a fill layer that grows from 0% to 100% as the Cloud Function processes the document. This avoids a separate loading spinner component.

### Rate limiting
Users are limited to one quote per 24 hours. The limit is enforced server-side in the Cloud Function (Firestore `lastQuoteAt` timestamp) and checked client-side on page load for a better UX.

### SSR with selective rendering
- Landing and auth pages: `RenderMode.Prerender` (static)
- Upload and result pages: `RenderMode.Server` (auth-gated, dynamic)

---

## Local development

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Start Angular dev server
npm run dev:quote

# Start Firebase emulators (Functions + Firestore + Auth)
firebase emulators:start
```

> **Note:** You need your own Firebase project and API keys to run this locally.  
> Copy `projects/quote-tool/src/environments/environment.ts` and replace the values with your own Firebase config.

---

## Built with Claude Sonnet 4.5

This project was built in collaboration with [Claude Sonnet 4.5](https://www.anthropic.com/claude) as a demonstration of AI-assisted full-stack development. The entire codebase — from the Angular components to the Cloud Functions and Gemini prompt engineering — was developed iteratively with Claude.

---

## Live demo

**[quote.watsturen.nl](https://quote.watsturen.nl)** — try it with a real project brief.

Portfolio case study: **[watsturen.nl/projects/quote-tool](https://watsturen.nl/projects/quote-tool)**
