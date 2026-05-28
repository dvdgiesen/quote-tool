import type { ProjectType, Complexity, ExtractedProjectData, ProjectPhase } from './extraction';

const HOURLY_RATE = 65; // €65/hr

/**
 * AI-efficiency factor per complexity level.
 * Represents the fraction of traditional hours needed when using GenAI-assisted development.
 * simple: 50% discount → factor 0.50
 * medium: 42% discount → factor 0.58
 * complex: 35% discount → factor 0.65
 * enterprise: 28% discount → factor 0.72
 */
const AI_EFFICIENCY_FACTOR: Record<Complexity, number> = {
  simple:     0.50,
  medium:     0.58,
  complex:    0.65,
  enterprise: 0.72,
};

// Base hours per project type (min/max range)
const BASE_HOURS: Record<ProjectType, { min: number; max: number }> = {
  'landing-page':    { min: 8,   max: 20  },
  'brochure-site':   { min: 20,  max: 50  },
  'web-app':         { min: 40,  max: 120 },
  'e-commerce':      { min: 60,  max: 160 },
  'api-integration': { min: 16,  max: 48  },
  'mobile-app':      { min: 80,  max: 200 },
  'custom':          { min: 24,  max: 80  },
};

// Complexity multipliers
const COMPLEXITY_MULTIPLIER: Record<Complexity, number> = {
  simple:     0.7,
  medium:     1.0,
  complex:    1.6,
  enterprise: 2.5,
};

// Additional hours per feature keyword (case-insensitive matching)
const FEATURE_HOURS: Array<{ keywords: string[]; hours: { min: number; max: number } }> = [
  { keywords: ['authentication', 'login', 'sign in', 'sign up', 'auth', 'oauth'],       hours: { min: 8,  max: 16 } },
  { keywords: ['cms', 'content management', 'admin panel', 'dashboard'],                hours: { min: 12, max: 24 } },
  { keywords: ['payment', 'stripe', 'checkout', 'billing', 'subscription'],             hours: { min: 16, max: 32 } },
  { keywords: ['api', 'rest api', 'graphql', 'integration', 'webhook'],                 hours: { min: 8,  max: 20 } },
  { keywords: ['animation', 'gsap', 'motion', 'interactive'],                           hours: { min: 4,  max: 12 } },
  { keywords: ['search', 'filter', 'algolia', 'elasticsearch'],                         hours: { min: 8,  max: 20 } },
  { keywords: ['multilingual', 'i18n', 'internationalization', 'translation'],          hours: { min: 8,  max: 16 } },
  { keywords: ['email', 'newsletter', 'notification', 'sendgrid', 'mailchimp'],         hours: { min: 4,  max: 12 } },
  { keywords: ['map', 'google maps', 'mapbox', 'geolocation'],                          hours: { min: 6,  max: 16 } },
  { keywords: ['chat', 'real-time', 'websocket', 'messaging'],                          hours: { min: 16, max: 40 } },
  { keywords: ['upload', 'file upload', 'image upload', 'storage'],                     hours: { min: 4,  max: 12 } },
  { keywords: ['seo', 'sitemap', 'structured data', 'meta tags'],                       hours: { min: 4,  max: 8  } },
  { keywords: ['analytics', 'tracking', 'google analytics', 'reporting'],               hours: { min: 4,  max: 8  } },
  { keywords: ['social', 'social media', 'sharing', 'oauth social'],                    hours: { min: 4,  max: 10 } },
  { keywords: ['booking', 'calendar', 'scheduling', 'reservation'],                     hours: { min: 12, max: 28 } },
  { keywords: ['streaming', 'video', 'vimeo', 'mux', 'player'],                        hours: { min: 12, max: 24 } },
  { keywords: ['live', 'webrtc', 'video call', 'video room'],                           hours: { min: 16, max: 32 } },
  { keywords: ['ai', 'machine learning', 'openai', 'gemini', 'llm'],                   hours: { min: 12, max: 28 } },
  { keywords: ['role', 'permission', 'rbac', 'access control'],                         hours: { min: 8,  max: 16 } },
  { keywords: ['forum', 'community', 'discussion', 'thread'],                           hours: { min: 12, max: 24 } },
];

export interface BreakdownItem {
  label: string;
  hoursMin: number;
  hoursMax: number;
  priceMin: number;
  priceMax: number;
}

export interface PhaseBreakdown {
  phaseName: string;
  phaseSubtitle: string;
  duration: string;
  items: BreakdownItem[];
  subtotalHoursMin: number;
  subtotalHoursMax: number;
  subtotalPriceMin: number;
  subtotalPriceMax: number;
}

export interface PriceEstimate {
  // Totals
  hoursMin: number;
  hoursMax: number;
  priceMin: number;
  priceMax: number;
  currency: 'EUR';
  hourlyRate: number;

  // Phase-based breakdown (new)
  phaseBreakdowns: PhaseBreakdown[];

  // Payment schedule
  paymentSchedule: Array<{
    moment: string;
    description: string;
    percentage: number;
    amount: number;
  }>;

  // GenAI efficiency info (for display in the offer)
  aiEfficiency: {
    factor: number;          // e.g. 0.58 for medium
    discountPct: number;     // e.g. 42 for medium
    traditionalHoursMin: number;
    traditionalHoursMax: number;
    savedHoursMin: number;
    savedHoursMax: number;
    savedAmountMin: number;
    savedAmountMax: number;
  };

  // Legacy breakdown (kept for compatibility)
  breakdown: {
    baseHours: { min: number; max: number };
    featureHours: { min: number; max: number };
    complexityMultiplier: number;
    matchedFeatures: string[];
  };
}

/**
 * Calculates a price estimate based on extracted project data.
 * Generates both a total estimate and a phase-by-phase breakdown.
 */
export function calculatePrice(data: ExtractedProjectData): PriceEstimate {
  const base = BASE_HOURS[data.projectType];
  const multiplier = COMPLEXITY_MULTIPLIER[data.complexity];

  // Combine all text for feature matching
  const allText = [
    ...data.features,
    ...data.technicalRequirements,
    data.description,
    data.projectSummary ?? '',
  ].join(' ').toLowerCase();

  let featureHoursMin = 0;
  let featureHoursMax = 0;
  const matchedFeatures: string[] = [];

  for (const featureDef of FEATURE_HOURS) {
    const matched = featureDef.keywords.some(kw => allText.includes(kw));
    if (matched) {
      featureHoursMin += featureDef.hours.min;
      featureHoursMax += featureDef.hours.max;
      matchedFeatures.push(featureDef.keywords[0]);
    }
  }

  // Apply complexity multiplier to get traditional (pre-AI) hours
  const traditionalRawMin = (base.min + featureHoursMin) * multiplier;
  const traditionalRawMax = (base.max + featureHoursMax) * multiplier;
  const traditionalHoursMin = Math.round(traditionalRawMin / 4) * 4;
  const traditionalHoursMax = Math.round(traditionalRawMax / 4) * 4;

  // Apply AI-efficiency factor (complexity-dependent discount)
  const aiEfficiencyFactor = AI_EFFICIENCY_FACTOR[data.complexity];
  const discountPct = Math.round((1 - aiEfficiencyFactor) * 100);

  const rawHoursMin = traditionalRawMin * aiEfficiencyFactor;
  const rawHoursMax = traditionalRawMax * aiEfficiencyFactor;

  // Round to nearest 4 hours (half-day blocks)
  const hoursMin = Math.round(rawHoursMin / 4) * 4;
  const hoursMax = Math.round(rawHoursMax / 4) * 4;

  const priceMin = hoursMin * HOURLY_RATE;
  const priceMax = hoursMax * HOURLY_RATE;

  // Compute savings for display in the offer
  // Use raw (pre-rounding) values so the math is consistent, then round
  const savedHoursMin = Math.round((traditionalRawMin - rawHoursMin) / 4) * 4;
  const savedHoursMax = Math.round((traditionalRawMax - rawHoursMax) / 4) * 4;

  // Generate phase-based breakdown from extracted phases
  const phaseBreakdowns = generatePhaseBreakdowns(data, hoursMin, hoursMax);

  // Payment schedule based on minimum price
  const paymentSchedule = [
    { moment: 'Bij akkoord offerte', description: 'Aanbetaling / projectstart', percentage: 30, amount: Math.round(priceMin * 0.30) },
    { moment: 'Oplevering Fase 1 (MVP)', description: 'Na acceptatie MVP', percentage: 35, amount: Math.round(priceMin * 0.35) },
    { moment: 'Oplevering Fase 2', description: 'Na acceptatie volgende fase', percentage: 20, amount: Math.round(priceMin * 0.20) },
    { moment: 'Eindoplevering', description: 'Na finale acceptatie volledig platform', percentage: 15, amount: Math.round(priceMin * 0.15) },
  ];

  // Adjust payment schedule if only 2 phases
  const adjustedPaymentSchedule = data.phases.length <= 2
    ? [
        { moment: 'Bij akkoord offerte', description: 'Aanbetaling / projectstart', percentage: 30, amount: Math.round(priceMin * 0.30) },
        { moment: 'Oplevering Fase 1 (MVP)', description: 'Na acceptatie MVP', percentage: 40, amount: Math.round(priceMin * 0.40) },
        { moment: 'Eindoplevering', description: 'Na finale acceptatie volledig platform', percentage: 30, amount: Math.round(priceMin * 0.30) },
      ]
    : paymentSchedule;

  return {
    hoursMin,
    hoursMax,
    priceMin,
    priceMax,
    currency: 'EUR',
    hourlyRate: HOURLY_RATE,
    phaseBreakdowns,
    paymentSchedule: adjustedPaymentSchedule,
    aiEfficiency: {
      factor: aiEfficiencyFactor,
      discountPct,
      traditionalHoursMin,
      traditionalHoursMax,
      savedHoursMin,
      savedHoursMax,
      savedAmountMin: savedHoursMin * HOURLY_RATE,
      savedAmountMax: savedHoursMax * HOURLY_RATE,
    },
    breakdown: {
      baseHours: base,
      featureHours: { min: featureHoursMin, max: featureHoursMax },
      complexityMultiplier: multiplier,
      matchedFeatures,
    },
  };
}

/**
 * Distributes total hours across phases based on the extracted phase structure.
 * Each phase gets a proportional share of the total hours, with setup/testing items added.
 */
function generatePhaseBreakdowns(
  data: ExtractedProjectData,
  totalHoursMin: number,
  totalHoursMax: number
): PhaseBreakdown[] {
  const phases = data.phases;

  if (!phases || phases.length === 0) {
    // Fallback: single phase with all hours
    return [{
      phaseName: 'Fase 1 — Volledig Project',
      phaseSubtitle: 'Ontwikkeling & Oplevering',
      duration: data.timeline !== 'Not specified' ? data.timeline : '±3–6 maanden',
      items: buildPhaseItems(data.features, totalHoursMin, totalHoursMax),
      subtotalHoursMin: totalHoursMin,
      subtotalHoursMax: totalHoursMax,
      subtotalPriceMin: totalHoursMin * HOURLY_RATE,
      subtotalPriceMax: totalHoursMax * HOURLY_RATE,
    }];
  }

  // Distribute hours proportionally across phases
  // Phase 1 (MVP) gets ~50% of hours, remaining phases split the rest
  const phaseWeights = getPhaseWeights(phases.length);

  return phases.map((phase, index) => {
    const weight = phaseWeights[index];
    const phaseHoursMin = Math.round((totalHoursMin * weight) / 4) * 4;
    const phaseHoursMax = Math.round((totalHoursMax * weight) / 4) * 4;

    const items = buildPhaseItemsFromDeliverables(
      phase,
      phaseHoursMin,
      phaseHoursMax,
      index === 0 // first phase gets setup item
    );

    const subtotalHoursMin = items.reduce((sum, item) => sum + item.hoursMin, 0);
    const subtotalHoursMax = items.reduce((sum, item) => sum + item.hoursMax, 0);

    return {
      phaseName: phase.name,
      phaseSubtitle: phase.subtitle,
      duration: phase.duration,
      items,
      subtotalHoursMin,
      subtotalHoursMax,
      subtotalPriceMin: subtotalHoursMin * HOURLY_RATE,
      subtotalPriceMax: subtotalHoursMax * HOURLY_RATE,
    };
  });
}

/**
 * Returns weight distribution across phases.
 * Phase 1 (MVP) always gets the largest share.
 */
function getPhaseWeights(numPhases: number): number[] {
  switch (numPhases) {
    case 1: return [1.0];
    case 2: return [0.60, 0.40];
    case 3: return [0.50, 0.30, 0.20];
    case 4: return [0.45, 0.25, 0.20, 0.10];
    default: return Array(numPhases).fill(1 / numPhases);
  }
}

/**
 * Builds breakdown items from a phase's deliverables, distributing hours evenly.
 */
function buildPhaseItemsFromDeliverables(
  phase: ProjectPhase,
  phaseHoursMin: number,
  phaseHoursMax: number,
  includeSetup: boolean
): BreakdownItem[] {
  const items: BreakdownItem[] = [];

  // Add project setup for first phase
  if (includeSetup) {
    items.push({
      label: 'Projectsetup, architectuur & CI/CD',
      hoursMin: 8,
      hoursMax: 12,
    } as BreakdownItem);
  }

  // Distribute remaining hours across deliverables
  const deliverables = phase.deliverables.slice(0, 6); // max 6 deliverable items
  const setupHoursMin = includeSetup ? 8 : 0;
  const setupHoursMax = includeSetup ? 12 : 0;
  const remainingMin = Math.max(phaseHoursMin - setupHoursMin, 8);
  const remainingMax = Math.max(phaseHoursMax - setupHoursMax, 12);

  const perDeliverableMin = Math.round(remainingMin / deliverables.length / 4) * 4;
  const perDeliverableMax = Math.round(remainingMax / deliverables.length / 4) * 4;

  for (const deliverable of deliverables) {
    items.push({
      label: deliverable,
      hoursMin: Math.max(perDeliverableMin, 4),
      hoursMax: Math.max(perDeliverableMax, 8),
    } as BreakdownItem);
  }

  // Add testing item
  items.push({
    label: `Testing, bugfixing & deployment ${phase.name.split('—')[0].trim()}`,
    hoursMin: 8,
    hoursMax: 12,
  } as BreakdownItem);

  // Calculate prices
  return items.map(item => ({
    ...item,
    priceMin: item.hoursMin * HOURLY_RATE,
    priceMax: item.hoursMax * HOURLY_RATE,
  }));
}

/**
 * Fallback: builds items from features list when no phases are available.
 */
function buildPhaseItems(
  features: string[],
  hoursMin: number,
  hoursMax: number
): BreakdownItem[] {
  const items: BreakdownItem[] = [
    { label: 'Projectsetup & architectuur', hoursMin: 8, hoursMax: 12, priceMin: 8 * HOURLY_RATE, priceMax: 12 * HOURLY_RATE },
  ];

  const featureItems = features.slice(0, 5);
  const perFeatureMin = Math.round((hoursMin - 20) / featureItems.length / 4) * 4;
  const perFeatureMax = Math.round((hoursMax - 20) / featureItems.length / 4) * 4;

  for (const feature of featureItems) {
    items.push({
      label: feature,
      hoursMin: Math.max(perFeatureMin, 4),
      hoursMax: Math.max(perFeatureMax, 8),
      priceMin: Math.max(perFeatureMin, 4) * HOURLY_RATE,
      priceMax: Math.max(perFeatureMax, 8) * HOURLY_RATE,
    });
  }

  items.push({ label: 'Testing, bugfixing & deployment', hoursMin: 8, hoursMax: 12, priceMin: 8 * HOURLY_RATE, priceMax: 12 * HOURLY_RATE });

  return items;
}
