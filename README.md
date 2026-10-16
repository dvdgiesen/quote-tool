# Quote Tool — watsturen.nl

AI-powered instant quote generator for web development projects.
Live at **[quote.watsturen.nl](https://quote.watsturen.nl)**

---

## What it does

Upload a project brief (PDF, Word, or plain text) and get a detailed price estimate in seconds. Google Gemini extracts project details, classifies complexity, and generates a formatted Dutch-language quote document — no manual input needed.

**Flow:**
1. Sign in (Google or email/password, email verification required)
2. Upload your project brief
3. Get a fixed price per phase, hour estimate, payment schedule, and downloadable HTML quote

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular 22 (standalone components, signals, SSR) |
| Backend | Firebase Cloud Functions v2 (Node 22, TypeScript 6) |
| AI | Google Gemini 2.5 Pro via `@google/generative-ai` |
| Auth | Firebase Authentication (Google + email/password) |
| Database | Firestore |
| File storage | Firebase Storage (signed URLs, 30-day expiry) |
| Email | Resend API |
| Security | Firebase App Check (reCAPTCHA Enterprise) |
| Hosting | Firebase App Hosting |
| Testing | Vitest 5 + jsdom 30 |

---

## Angular patterns used

- **Signals throughout** — `signal()`, `computed()`, `effect()` for all reactive state. No RxJS in components (except the auth guard's `toObservable()` for Firebase's async state).
- **Standalone components** — no NgModules anywhere.
- **New control flow** — `@if`, `@for`, `@switch` instead of structural directives.
- **`@defer`** — lazy-loaded heavy components (result page, icon sets).
- **Signal-based I/O** — `input()` and `output()` instead of `@Input()`/`@Output()` decorators.
- **SSR with selective rendering** — landing and auth pages are prerendered (static), upload and result pages use server rendering (auth-gated).
- **`inject()` function** — instead of constructor injection.

---

## Architecture

```
quote-tool/
├── projects/quote-tool/          # Angular 22 SSR app
│   └── src/app/
│       ├── features/
│       │   ├── landing/          # Public landing page
│       │   ├── auth/             # Sign in / sign up / email action
│       │   ├── upload/           # File upload + progress UI
│       │   └── result/           # Quote result + download
│       ├── core/
│       │   ├── guards/           # Auth guard (waits for Firebase state)
│       │   └── services/         # Firebase, Auth, Quote services
│       └── shared/
│           ├── icons/            # Self-contained SVG icon component
│           └── logo/             # Logo link component
└── functions/src/
    ├── quote/
    │   ├── quote.function.ts     # Cloud Function entry point (15-step pipeline)
    │   ├── extraction.ts         # Gemini structured extraction
    │   ├── pricing.ts            # Fixed price per phase + AI-efficiency factor
    │   ├── pricing-features.ts   # Feature catalogue (ids, hours, keyword fallback)
    │   ├── gemini-retry.ts       # Retry/backoff and error classification for Gemini
    │   ├── moderation.ts         # Pre-moderation check (cheap Gemini call)
    │   └── quote-generator.ts    # HTML quote document generator
    ├── contact/
    │   └── contact.function.ts   # Contact form Cloud Function
    └── shared/
        ├── brand-colors.ts       # Palette for e-mails and the HTML offer
        └── email.service.ts      # Resend email service (lazy init)
```

---

## Pricing model

The pricing engine (`functions/src/quote/pricing.ts`) is deterministic: the same brief gives (nearly) the same price. Gemini only *extracts* data from the brief; the price follows from fixed rules.

1. **Traditional hours** = base hours of the project type + hours of the features in the brief.
   - Features come from a fixed catalogue (`pricing-features.ts`, ~30 ids). Gemini picks the ids (an enum in the extraction schema), so an English brief prices the same as a Dutch one.
   - Gemini runs with `temperature: 0`.
2. **GenAI-efficiency discount** that grows with project size (interpolated curve):

   | Traditional hours | Factor | Discount |
   |---|---|---|
   | ≤ 30 h | 0.70 | 30% |
   | 100 h | 0.60 | 40% |
   | 250 h | 0.50 | 50% |
   | ≥ 500 h | 0.45 | 55% |

   Minimum 8 hours, rounded to blocks of 2 hours.
3. **Internal range**: maximum = minimum × 1.4 (40% overrun). It is stored with the quote but not shown to the client.
4. **Fixed price per phase**: the client pays the middle of the range (minimum + 20%), so phases that overrun and phases that underrun average out.
5. **Payment schedule per phase**: 30% when the phase starts, 70% on delivery.
6. Totals, phase subtotals, payment schedule and result screen always show the same numbers.

The size label (simple / medium / complex / enterprise) is derived from the hours and is display-only; it does not change the price.

This is a deliberate USP: lower prices for clients, and a concrete demonstration of GenAI value.

---

## Gemini errors & retries

Google answers with 503 ("high demand") now and then. All Gemini calls (moderation and extraction) go through `withGeminiRetry` (`gemini-retry.ts`):

- Transient errors (429, 500, 502, 503, 504, network resets) are retried with exponential backoff and jitter.
- Errors a retry cannot fix (402 empty credits, 400/401/403/404) are thrown immediately.
- When extraction still fails, the function returns `functions/unavailable` with a Dutch message. This is not the user's fault: it does not count as a failed attempt and does not use up the daily quote.

---

## Security model

### Firebase client config (`environment.ts`)

The Firebase config values are **intentionally public** — by design, per Google's documentation:

> "It is okay to include your Firebase config object in your version control system, including your API key."
> — [Firebase documentation](https://firebase.google.com/docs/projects/api-keys)

Security is enforced by:
- **Firebase Security Rules** — Firestore and Storage rules restrict read/write access
- **Firebase App Check** (reCAPTCHA Enterprise) — Cloud Functions reject requests without a valid token
- **Firebase Authentication** — users must be signed in and email-verified
- **Server-side rate limiting** — 1 quote/day, 3 failed attempts/day (Firestore counters)

### Actual secrets

`GEMINI_API_KEY` and `RESEND_API_KEY` live in **Firebase Secret Manager**, never committed to source control.

---

## Abuse prevention

| Layer | Implementation |
|---|---|
| Auth + email verification | Firebase Auth, `emailVerified` check in Cloud Function |
| 1 quote/day rate limit | `users/{uid}.lastQuoteAt` checked server-side |
| 3 failed attempts/day | `users/{uid}.failedAttemptCount` — resets on successful quote |
| File type + size validation | MIME type check + 5MB limit |
| Min word count (30 words) | Blocks trivially short uploads before calling Gemini |
| Pre-moderation | Cheap Gemini check before expensive extraction |
| Disposable email blocklist | Checked in contact function |
| Firebase App Check | reCAPTCHA Enterprise, `enforceAppCheck: true` |

---

## Local development

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Start Angular dev server
ng serve quote-tool

# Start Firebase emulators (Functions + Firestore + Auth)
firebase emulators:start
```

> **Note:** You need your own Firebase project and API keys to run this locally.

### Your own business details

Offers and e-mails show your business details (name, address, contact details, KvK and VAT number,
sender address). These are **not** in the source code: the code contains fictional example details
only (`Voorbeeld Webstudio`, `info@voorbeeld.example`).

```bash
cp functions/.env.example functions/.env   # then fill in your own details
```

Firebase loads `functions/.env` when you deploy (`firebase deploy --only functions`) and exposes the
values as `process.env`; `functions/.env` is ignored by git. A check that runs before every deploy
(`functions/check-company-env.cjs`) stops the deploy when `functions/.env` is missing, still contains
the example details, or when one of your real details ends up in the source code. The code that reads
the details is `functions/src/shared/company.ts`.
> Copy `projects/quote-tool/src/environments/environment.ts` and replace the values with your own Firebase config.

---

## How this was built

This project was developed with AI-assisted coding using [Cline](https://github.com/cline/cline), an open-source AI coding agent, paired with various large language models (initially Claude Sonnet 4.5, later others).

**What the AI does:**
- Generates code following project conventions and Angular best practices
- Handles refactoring (e.g., migrating `firebase-admin` v13 → v14, Angular 21 → 22)
- Plans and executes dependency upgrades with compatibility checks
- Writes and maintains documentation

**What the human does:**
- Architecture decisions and product direction
- Code review before every commit
- Deployment, domain configuration, Firebase console setup
- Client communication and business logic validation

The codebase is the result of iterative collaboration — the AI handles the implementation details while the human guides the architecture and validates the output.

---

## Live demo

**[quote.watsturen.nl](https://quote.watsturen.nl)** — try it with a real project brief.

---

## License

[MIT](LICENSE) © 2026 Dirk van der Giesen
