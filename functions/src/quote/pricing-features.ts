import type { ProjectType, ExtractedProjectData } from './extraction';

/**
 * Feature catalogue for pricing.
 *
 * Primary route (language independent): Gemini picks feature ids from this catalogue
 * (`featureIds` in the extraction schema). The `description` is the instruction for Gemini.
 *
 * Fallback route (only when `featureIds` is missing): keyword matching on the extracted
 * texts, using `stems` (word start), `words` (whole word) and `tails` (unambiguous term that
 * may end a Dutch compound word). Short/ambiguous keywords belong in `words` only.
 */
export interface FeatureDef {
  id: string;
  /** Traditional (pre-AI) hours this feature adds. */
  hours: number;
  /** Instruction for the model: when does this feature apply? */
  description: string;
  stems?: string[];
  words?: string[];
  tails?: string[];
}

export const FEATURES: FeatureDef[] = [
  { id: 'auth', hours: 8, description: 'Personal user accounts: login, registration, social login (Google/Apple), password reset. NOT for one shared access code or password (use shared-access)',
    stems: ['inlog', 'login', 'sign in', 'sign up', 'registr', 'authenticat', 'oauth', 'gebruikersaccount', 'user account'], words: ['auth', 'sso'] },
  { id: 'shared-access', hours: 2, description: 'Access protected by one shared code or password for a whole team (no personal accounts)',
    stems: ['toegangscode', 'gedeelde code', 'gedeeld wachtwoord', 'access code', 'shared code', 'shared password'] },
  { id: 'roles', hours: 8, description: 'Different user roles or permissions (admin/member), moderation of users or content',
    stems: ['permission', 'rbac', 'access control', 'rechtenbeheer', 'gebruikersrol', 'gebruikersrechten', 'moderat', 'rollen'], words: ['role', 'roles', 'rol'] },
  { id: 'admin-panel', hours: 12, description: 'A separate back-office/admin area where the client manages content, products, users or submissions. Only when the brief asks for an admin or management environment; NOT for merely searching or downloading stored data',
    stems: ['content management', 'contentbeheer', 'admin panel', 'beheeromgeving', 'beheerpaneel', 'beheerscherm', 'beheerder', 'backoffice', 'back-office', 'dashboard'], words: ['cms', 'admin'] },
  { id: 'payments', hours: 16, description: 'Online payments: iDEAL, credit card, Stripe, Mollie, checkout',
    stems: ['payment', 'betaling', 'betalen', 'betaalmethode', 'stripe', 'mollie', 'checkout', 'afreken', 'creditcard', 'billing'], words: ['ideal', 'paypal'] },
  { id: 'subscriptions', hours: 12, description: 'Recurring payments or subscriptions',
    stems: ['subscription', 'recurring', 'terugkerende betaling'], tails: ['abonnement'] },
  { id: 'notifications', hours: 4, description: 'Transactional e-mails, push notifications, reminders, newsletters',
    stems: ['e-mail', 'email', 'newsletter', 'nieuwsbrief', 'notification', 'notificatie', 'pushnotificatie', 'sendgrid', 'mailchimp', 'bevestigingsmail', 'melding'], words: ['mail', 'mails', 'push'] },
  { id: 'search-filter', hours: 8, description: 'Search or filtering of data (products, members, forms)',
    stems: ['search', 'zoeken', 'zoekfunctie', 'doorzoek', 'filter', 'algolia', 'elasticsearch'] },
  { id: 'multilingual', hours: 8, description: 'More than one language in the interface or content',
    stems: ['multilingual', 'multi-language', 'multi language', 'meertalig', 'i18n', 'internationali', 'translation', 'vertaling', 'taalkeuze'] },
  { id: 'maps', hours: 6, description: 'Maps, locations on a map, geolocation, route planning',
    stems: ['google maps', 'mapbox', 'geolocation', 'kaartweergave', 'locatiekaart', 'kaart met', 'plattegrond', 'routeplanner'], words: ['map', 'maps'] },
  { id: 'chat', hours: 16, description: 'Chat, direct messages or other real-time messaging between users',
    stems: ['chat', 'real-time', 'realtime', 'websocket', 'messaging', 'berichten', 'direct message'] },
  { id: 'file-upload', hours: 4, description: 'Uploading and storing photos, files or attachments',
    stems: ['upload', "foto's toevoegen", 'foto toevoegen', 'bijlage', 'opslag', 'storage', 'bestandsopslag'] },
  { id: 'calendar-booking', hours: 12, description: 'Events with sign-up, booking, scheduling, reservations, appointments, calendar',
    stems: ['booking', 'calendar', 'scheduling', 'reservation', 'reservering', 'boeking', 'afspraak', 'agenda', 'kalender', 'evenement'], words: ['event', 'events'] },
  { id: 'video', hours: 12, description: 'Video playback or streaming (not live)',
    stems: ['streaming', 'video', 'vimeo', 'mux'], words: ['player'] },
  { id: 'live-video', hours: 16, description: 'Live video, video calls, live streaming, WebRTC',
    stems: ['webrtc', 'video call', 'videobellen', 'live stream', 'livestream', 'live chat'] },
  { id: 'ai', hours: 12, description: 'AI features: LLM, chatbot, recommendations, machine learning',
    stems: ['machine learning', 'openai', 'gemini', 'kunstmatige intelligentie', 'chatbot'], words: ['ai', 'llm', 'gpt'] },
  { id: 'community', hours: 12, description: 'Community features: groups, forum, discussions, member profiles visible to others',
    stems: ['forum', 'community', 'discussion', 'discussie', 'thread', 'gemeenschap'] },
  { id: 'export', hours: 8, description: 'Export or generation of Excel, PDF or CSV files',
    stems: ['export', 'xlsx'], words: ['pdf', 'csv'] },
  { id: 'analytics', hours: 4, description: 'Analytics, tracking, reports, statistics',
    stems: ['analytics', 'tracking', 'rapportage', 'statistiek', 'reporting'] },
  { id: 'social', hours: 4, description: 'Social media sharing or integration',
    stems: ['social media', 'sharing', 'delen via', 'sociale'], words: ['social'] },
  { id: 'animation', hours: 4, description: 'Custom animations or highly interactive elements',
    stems: ['animation', 'animatie', 'gsap', 'motion graphics', 'interactive', 'interactieve'] },
  { id: 'api-integration', hours: 8, description: 'Integration with an external system or API (ERP, CRM, accounting, Strava, webhooks)',
    stems: ['rest api', 'graphql', 'integration', 'integratie', 'webhook', 'koppeling', 'koppelen'], words: ['api', 'apis'] },
  { id: 'seo', hours: 4, description: 'Explicit SEO work: sitemap, structured data, meta tags',
    stems: ['sitemap', 'structured data', 'meta tags', 'zoekmachineoptimalisatie', 'vindbaarheid'], words: ['seo'] },

  // Risk features: easy to overlook, often underestimated
  { id: 'offline-sync', hours: 16, description: 'Must work offline or with poor connectivity and synchronise later',
    stems: ['offline', 'slecht bereik', 'poor connectivity', 'synchronis', 'sync'] },
  { id: 'calculations', hours: 8, description: 'Business logic: calculated fields, formulas, validations, status derived from values',
    stems: ['berekend', 'berekening', 'formule', 'calculat', 'formula'] },
  { id: 'exact-layout', hours: 8, description: 'Output must match an existing Excel/PDF/document layout exactly',
    stems: ['bestaand format', 'bestaande layout', 'zelfde format', 'existing format', 'existing template', 'exact layout'] },
  { id: 'app-store', hours: 8, description: 'Publication in the Apple App Store and/or Google Play',
    stems: ['app store', 'appstore', 'google play', 'testflight', 'store-publicatie'] },
  { id: 'custom-design', hours: 16, description: 'New UI/UX design needed (no existing design or style guide provided)',
    stems: ['ontwerp nodig', 'nieuw ontwerp', 'ui-ontwerp', 'ui/ux', 'ux design', 'huisstijl ontwikkelen', 'new design', 'custom design'] },
  { id: 'privacy', hours: 8, description: 'Privacy-sensitive data: only when the brief explicitly mentions GDPR/AVG, privacy, consent or deletion/export of personal data. Never add it on your own',
    stems: ['avg', 'gdpr', 'privacy', 'gegevens verwijderen', 'delete their data'] },
  { id: 'data-migration', hours: 8, description: 'Import or migration of existing data (Excel, old system, database)',
    stems: ['data migratie', 'datamigratie', 'data migration', 'import van', 'importeren', 'bestaande data'] },
];

/** Catalogue id for something that is none of the above. Each occurrence adds OTHER_FEATURE_HOURS (max 3). */
export const OTHER_FEATURE_ID = 'other';
const OTHER_FEATURE_HOURS = 6;
const OTHER_FEATURE_MAX = 3;

/** All ids Gemini may choose from (the enum in the extraction schema). */
export const FEATURE_IDS: string[] = [...FEATURES.map(f => f.id), OTHER_FEATURE_ID];

/** Prompt block that lists the catalogue for Gemini. */
export const FEATURE_CATALOGUE_PROMPT: string = FEATURES
  .map(f => `- ${f.id}: ${f.description}`)
  .concat(`- ${OTHER_FEATURE_ID}: a substantial feature that fits none of the above (use once per such feature, max 3)`)
  .join('\n');

/**
 * Features that are already part of the base hours of a project type.
 * A webshop without checkout, product admin and order e-mails is not a webshop,
 * so those hours are not added a second time.
 */
const INCLUDED_IN_BASE: Partial<Record<ProjectType, string[]>> = {
  'e-commerce':    ['payments', 'admin-panel', 'notifications'],
  'landing-page':  ['seo'],
  'brochure-site': ['seo'],
};

const WORD_START = '(?<![\\p{L}\\p{N}])';
const WORD_END = '(?![\\p{L}\\p{N}])';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMatcher(def: FeatureDef): RegExp {
  const parts = [
    ...(def.stems ?? []).map(s => WORD_START + escapeRegex(s)),
    ...(def.words ?? []).map(w => WORD_START + escapeRegex(w) + WORD_END),
    ...(def.tails ?? []).map(t => escapeRegex(t)),
  ];
  return new RegExp(parts.join('|'), 'u');
}

const MATCHERS = FEATURES.map(def => ({ def, regex: buildMatcher(def) }));

export interface FeatureMatch {
  /** Feature ids that add hours (`other` may occur more than once). */
  matched: string[];
  /** Sum of the traditional hours of all matched features. */
  hours: number;
  /** Where the ids came from. */
  source: 'model' | 'keywords';
}

/** Fallback: keyword matching on the extracted texts. The free-text summary is NOT scanned (negations). */
function matchByKeywords(data: ExtractedProjectData): string[] {
  const text = [
    ...data.features,
    ...data.technicalRequirements,
    data.description,
    ...(data.phases ?? []).flatMap(p => p.deliverables),
  ]
    .join(' \n ')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'");

  return MATCHERS.filter(({ regex }) => regex.test(text)).map(({ def }) => def.id);
}

/**
 * Determines which features add hours.
 * Uses the ids chosen by Gemini when present (language independent), otherwise keyword matching.
 */
export function matchFeatures(data: ExtractedProjectData): FeatureMatch {
  const fromModel = Array.isArray(data.featureIds);
  const raw = fromModel ? (data.featureIds as string[]) : matchByKeywords(data);
  const byId = new Map(FEATURES.map(f => [f.id, f]));
  const included = new Set(INCLUDED_IN_BASE[data.projectType] ?? []);

  const matched: string[] = [];
  let hours = 0;
  let others = 0;

  for (const id of raw) {
    if (id === OTHER_FEATURE_ID) {
      if (others < OTHER_FEATURE_MAX) {
        others++;
        matched.push(id);
        hours += OTHER_FEATURE_HOURS;
      }
      continue;
    }
    const def = byId.get(id);
    if (!def || included.has(id) || matched.includes(id)) continue;
    // Personal accounts already include access control: a shared code is not counted on top
    if (id === 'shared-access' && raw.includes('auth')) continue;
    matched.push(id);
    hours += def.hours;
  }

  return { matched, hours, source: fromModel ? 'model' : 'keywords' };
}

