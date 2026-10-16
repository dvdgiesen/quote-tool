import type { ProjectType, Complexity, ExtractedProjectData, ProjectPhase } from './extraction';
import { matchFeatures } from './pricing-features';

export const HOURLY_RATE = 65; // €65/hr

/** The maximum is the minimum plus 40% overrun. Applied to traditional and AI-assisted hours alike. */
export const RANGE_FACTOR = 1.4;

/**
 * The client gets a FIXED price per phase: the middle of the range (minimum + 20%).
 * Phases that run a bit over and phases that run a bit under then average out.
 */
export const FIXED_PRICE_FACTOR = 1.2;

/** Share of a phase that is invoiced when the phase starts; the rest on delivery. */
const PHASE_DEPOSIT_PCT = 30;

/** All hours are rounded to half-day blocks of 2 hours. */
const HOUR_STEP = 2;

/** Smallest engagement that is quoted (one working day). */
const MIN_HOURS = 8;

/** Share of a phase's hours for overhead items. */
const SETUP_SHARE = 0.08;            // first phase only
const TESTING_SHARE = 0.12;          // every phase
const COMPACT_OVERHEAD_SHARE = 0.20; // single-phase projects: setup + testing as one item

/**
 * AI-efficiency factor as a function of project size (traditional minimum hours).
 * Represents the fraction of traditional hours needed when using GenAI-assisted development.
 * GenAI is strongest on larger, more complex work (more boilerplate, more patterns to reuse),
 * so the discount GROWS with size. Small jobs keep a larger fixed human share
 * (talking to the client, deploying, acceptance), so they get the smallest discount.
 *
 * Piecewise linear between these points, so the price never jumps at a threshold
 * (a project of 149 hours must not cost more than one of 150 hours):
 *    <=  30 h → factor 0.70 (30% discount)
 *       100 h → factor 0.60 (40%)
 *       250 h → factor 0.50 (50%)
 *    >= 500 h → factor 0.45 (55%)
 */
const AI_FACTOR_CURVE: ReadonlyArray<readonly [hours: number, factor: number]> = [
  [30, 0.70],
  [100, 0.60],
  [250, 0.50],
  [500, 0.45],
];

function aiEfficiencyFor(traditionalHours: number): number {
  const first = AI_FACTOR_CURVE[0];
  const last = AI_FACTOR_CURVE[AI_FACTOR_CURVE.length - 1];
  if (traditionalHours <= first[0]) return first[1];
  if (traditionalHours >= last[0]) return last[1];
  for (let i = 1; i < AI_FACTOR_CURVE.length; i++) {
    const [h0, f0] = AI_FACTOR_CURVE[i - 1];
    const [h1, f1] = AI_FACTOR_CURVE[i];
    if (traditionalHours <= h1) return f0 + ((traditionalHours - h0) / (h1 - h0)) * (f1 - f0);
  }
  return last[1];
}

/**
 * Size class, derived from the traditional minimum hours. Display only (offer text, e-mails):
 * it does NOT change the price. The label from the model (`ExtractedProjectData.complexity`)
 * is ignored, because it varied between runs of the same brief.
 */
function complexityFor(traditionalHours: number): Complexity {
  if (traditionalHours < 50) return 'simple';
  if (traditionalHours < 150) return 'medium';
  if (traditionalHours < 350) return 'complex';
  return 'enterprise';
}

/**
 * Traditional (pre-AI) MINIMUM hours per project type.
 * The maximum is always `RANGE_FACTOR` × minimum.
 */
const BASE_HOURS: Record<ProjectType, number> = {
  'landing-page':    8,
  'brochure-site':   20,
  'web-app':         40,
  'e-commerce':      60,
  'api-integration': 16,
  'mobile-app':      80,
  'custom':          24,
};

// Note: the `complexity` label from the model is not used for pricing (it varied between runs of
// the same brief). Size follows from the hours instead, see aiEfficiencyFor() and complexityFor().

export interface BreakdownItem {
  label: string;
  hoursMin: number;
  hoursMax: number;
  priceMin: number;
  priceMax: number;
  /** Hours / price that make up the fixed phase price. */
  hoursFixed: number;
  priceFixed: number;
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
  /** The fixed price of this phase (what the client pays). */
  subtotalHoursFixed: number;
  subtotalPriceFixed: number;
}

export interface PriceEstimate {
  // Totals — always equal to the sum of the phase breakdowns.
  // min/max is the internal range; the client pays hoursFixed / priceFixed.
  hoursMin: number;
  hoursMax: number;
  priceMin: number;
  priceMax: number;
  hoursFixed: number;
  priceFixed: number;
  currency: 'EUR';
  hourlyRate: number;

  /** Size class derived from the hours (display only, not the label from the model) */
  complexity: Complexity;

  // Phase-based breakdown
  phaseBreakdowns: PhaseBreakdown[];

  // Payment schedule per phase (amounts add up exactly to priceFixed).
  // `percentage` is the share of that phase's fixed price.
  paymentSchedule: Array<{
    moment: string;
    description: string;
    percentage: number;
    amount: number;
  }>;

  // GenAI efficiency info (for display in the offer)
  aiEfficiency: {
    factor: number;          // e.g. 0.60 for medium
    discountPct: number;     // e.g. 40 for medium
    traditionalHoursMin: number;
    traditionalHoursMax: number;
    traditionalHoursFixed: number;
    savedHoursMin: number;
    savedHoursMax: number;
    savedHoursFixed: number;
    savedAmountMin: number;
    savedAmountMax: number;
    savedAmountFixed: number;
  };

  // How the traditional hours were built (shape kept for the client app and Firestore)
  breakdown: {
    baseHours: { min: number; max: number };
    featureHours: { min: number; max: number };
    matchedFeatures: string[];
  };
}

function roundToStep(hours: number): number {
  return Math.round(hours / HOUR_STEP) * HOUR_STEP;
}

/**
 * Calculates a price estimate based on extracted project data.
 *
 * 1. Traditional minimum hours = base hours of the project type + feature hours
 * 2. Traditional maximum hours = minimum × 1.4
 * 3. AI-efficiency factor (bigger discount for bigger projects, see AI_FACTOR_CURVE) is applied to both
 * 4. The fixed price is the middle of the AI-assisted range (minimum × 1.2)
 * 5. The phase breakdown distributes exactly these totals — it never adds hours of its own
 */
export function calculatePrice(data: ExtractedProjectData): PriceEstimate {
  const baseMin = BASE_HOURS[data.projectType];
  const { matched, hours: featureHoursMin } = matchFeatures(data);

  // Traditional (pre-AI) hours: project type + features. The size label from the model is not used.
  const traditionalRawMin = baseMin + featureHoursMin;
  const traditionalHoursMin = roundToStep(traditionalRawMin);
  const traditionalHoursMax = roundToStep(traditionalRawMin * RANGE_FACTOR);
  const traditionalHoursFixed = roundToStep(traditionalRawMin * FIXED_PRICE_FACTOR);

  // AI-assisted hours
  const aiEfficiencyFactor = aiEfficiencyFor(traditionalRawMin);
  const complexity = complexityFor(traditionalRawMin);
  const discountPct = Math.round((1 - aiEfficiencyFactor) * 100);

  const rawMin = Math.max(MIN_HOURS, traditionalRawMin * aiEfficiencyFactor);
  const hoursMin = roundToStep(rawMin);
  const hoursMax = roundToStep(rawMin * RANGE_FACTOR);
  const hoursFixed = roundToStep(rawMin * FIXED_PRICE_FACTOR);

  const priceMin = hoursMin * HOURLY_RATE;
  const priceMax = hoursMax * HOURLY_RATE;
  const priceFixed = hoursFixed * HOURLY_RATE;

  const savedHoursMin = Math.max(0, traditionalHoursMin - hoursMin);
  const savedHoursMax = Math.max(0, traditionalHoursMax - hoursMax);
  const savedHoursFixed = Math.max(0, traditionalHoursFixed - hoursFixed);

  const phaseBreakdowns = generatePhaseBreakdowns(data, hoursMin, hoursMax, hoursFixed);

  return {
    hoursMin,
    hoursMax,
    priceMin,
    priceMax,
    hoursFixed,
    priceFixed,
    currency: 'EUR',
    hourlyRate: HOURLY_RATE,
    complexity,
    phaseBreakdowns,
    paymentSchedule: buildPaymentSchedule(phaseBreakdowns),
    aiEfficiency: {
      factor: aiEfficiencyFactor,
      discountPct,
      traditionalHoursMin,
      traditionalHoursMax,
      traditionalHoursFixed,
      savedHoursMin,
      savedHoursMax,
      savedHoursFixed,
      savedAmountMin: savedHoursMin * HOURLY_RATE,
      savedAmountMax: savedHoursMax * HOURLY_RATE,
      savedAmountFixed: savedHoursFixed * HOURLY_RATE,
    },
    breakdown: {
      baseHours: { min: baseMin, max: roundToStep(baseMin * RANGE_FACTOR) },
      featureHours: { min: featureHoursMin, max: roundToStep(featureHoursMin * RANGE_FACTOR) },
      matchedFeatures: matched,
    },
  };
}

/**
 * Distributes `total` hours over `weights` in blocks of HOUR_STEP.
 * The result always adds up exactly to `total` (largest-remainder method).
 * When there are enough blocks, every entry gets at least one block (no 0-hour items).
 */
function distribute(total: number, weights: number[]): number[] {
  const units = Math.round(total / HOUR_STEP);
  const guaranteed = units >= weights.length ? 1 : 0;
  const spread = units - guaranteed * weights.length;
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const exact = weights.map(w => (w / weightSum) * spread);
  const result = exact.map(value => Math.floor(value) + guaranteed);
  let remainder = units - result.reduce((s, n) => s + n, 0);

  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; remainder > 0; i = (i + 1) % byFraction.length, remainder--) {
    result[byFraction[i].index]++;
  }
  return result.map(n => n * HOUR_STEP);
}

/**
 * Splits the total hours across the phases (weighted by number of deliverables)
 * and each phase across its items. No hours are added: the sums equal the totals.
 *
 * Single-phase projects (small jobs) use a compact route: no per-phase setup and
 * testing blocks, just one overhead item for setup, testing and delivery.
 */
function generatePhaseBreakdowns(
  data: ExtractedProjectData,
  totalHoursMin: number,
  totalHoursMax: number,
  totalHoursFixed: number
): PhaseBreakdown[] {
  const phases: ProjectPhase[] = data.phases && data.phases.length > 0
    ? data.phases
    : [{
        name: 'Fase 1 — Volledig project',
        subtitle: 'Ontwikkeling & oplevering',
        duration: data.timeline && data.timeline !== 'Not specified' ? data.timeline : '±3–6 maanden',
        deliverables: data.features.length > 0 ? data.features : ['Oplevering volledig project'],
      }];

  const compact = phases.length === 1;
  const weights = phases.map(p => Math.min(Math.max(p.deliverables.length, 1), 6));
  const phaseHoursMin = distribute(totalHoursMin, weights);
  const phaseHoursMax = distribute(totalHoursMax, weights);
  const phaseHoursFixed = distribute(totalHoursFixed, weights);

  return phases.map((phase, index) => {
    const items = buildPhaseItems(
      phase,
      { min: phaseHoursMin[index], max: phaseHoursMax[index], fixed: phaseHoursFixed[index] },
      index === 0,
      compact
    );

    return {
      phaseName: phase.name,
      phaseSubtitle: phase.subtitle,
      duration: phase.duration,
      items,
      subtotalHoursMin: items.reduce((sum, item) => sum + item.hoursMin, 0),
      subtotalHoursMax: items.reduce((sum, item) => sum + item.hoursMax, 0),
      subtotalPriceMin: items.reduce((sum, item) => sum + item.priceMin, 0),
      subtotalPriceMax: items.reduce((sum, item) => sum + item.priceMax, 0),
      subtotalHoursFixed: items.reduce((sum, item) => sum + item.hoursFixed, 0),
      subtotalPriceFixed: items.reduce((sum, item) => sum + item.priceFixed, 0),
    };
  });
}

/**
 * Builds the items of one phase: optional setup, the deliverables, and testing.
 * Overhead is a percentage of the phase, so it shrinks together with the AI discount.
 */
function buildPhaseItems(
  phase: ProjectPhase,
  hours: { min: number; max: number; fixed: number },
  isFirstPhase: boolean,
  compact: boolean
): BreakdownItem[] {
  const { min: hoursMin, max: hoursMax, fixed: hoursFixed } = hours;
  const entries: Array<{ label: string; weight: number }> = [];
  const phaseLabel = phase.name.split('—')[0].trim();
  const deliverables = phase.deliverables.length > 0 ? phase.deliverables : ['Oplevering'];

  // Never create more items than there are blocks of HOUR_STEP hours in the phase
  const minUnits = Math.round(Math.min(hoursMin, hoursMax) / HOUR_STEP);

  // Tiny phase: a single item, no separate overhead lines
  if (minUnits < 2) {
    return [{
      label: `${deliverables.join(', ')} (incl. testing)`,
      hoursMin,
      hoursMax,
      priceMin: hoursMin * HOURLY_RATE,
      priceMax: hoursMax * HOURLY_RATE,
      hoursFixed,
      priceFixed: hoursFixed * HOURLY_RATE,
    }];
  }

  const setupWeight = !compact && isFirstPhase && minUnits >= 4 ? SETUP_SHARE : 0;
  const testingWeight = compact ? COMPACT_OVERHEAD_SHARE : TESTING_SHARE;
  const deliverableWeight = 1 - setupWeight - testingWeight;

  const overheadCount = (setupWeight > 0 ? 1 : 0) + 1;
  const maxDeliverables = Math.max(1, Math.min(6, minUnits - overheadCount));
  const shown = deliverables.slice(0, maxDeliverables);
  if (deliverables.length > shown.length) {
    shown[shown.length - 1] = [shown[shown.length - 1], ...deliverables.slice(shown.length)].join(', ');
  }

  if (setupWeight > 0) {
    entries.push({ label: 'Projectsetup, architectuur & CI/CD', weight: setupWeight });
  }
  for (const label of shown) {
    entries.push({ label, weight: deliverableWeight / shown.length });
  }
  entries.push({
    label: compact ? 'Setup, testing & oplevering' : `Testing, bugfixing & deployment ${phaseLabel}`,
    weight: testingWeight,
  });

  const weights = entries.map(e => e.weight);
  const itemHoursMin = distribute(hoursMin, weights);
  const itemHoursMax = distribute(hoursMax, weights);
  const itemHoursFixed = distribute(hoursFixed, weights);

  return entries.map((entry, i) => ({
    label: entry.label,
    hoursMin: itemHoursMin[i],
    hoursMax: itemHoursMax[i],
    priceMin: itemHoursMin[i] * HOURLY_RATE,
    priceMax: itemHoursMax[i] * HOURLY_RATE,
    hoursFixed: itemHoursFixed[i],
    priceFixed: itemHoursFixed[i] * HOURLY_RATE,
  }));
}

/**
 * Payment schedule on the FIXED price, per phase: a deposit when the phase starts and the
 * remainder on delivery of that phase. The delivery row is the remainder, so each phase
 * adds up exactly to its fixed price and the schedule to the total.
 * Because every phase has a fixed price, the client only commits to (and pays for) the
 * phase that is running.
 */
function buildPaymentSchedule(phases: PhaseBreakdown[]): PriceEstimate['paymentSchedule'] {
  const rows: PriceEstimate['paymentSchedule'] = [];

  phases.forEach((phase, index) => {
    const label = phase.phaseName.split('—')[0].trim() || `Fase ${index + 1}`;
    const deposit = Math.round((phase.subtotalPriceFixed * PHASE_DEPOSIT_PCT) / 100);

    rows.push({
      moment: index === 0 ? `Bij akkoord offerte (start ${label})` : `Start ${label}`,
      description: index === 0 ? 'Aanbetaling / projectstart' : 'Aanbetaling bij start van de fase',
      percentage: PHASE_DEPOSIT_PCT,
      amount: deposit,
    });
    rows.push({
      moment: `Oplevering ${label}`,
      description: 'Na acceptatie van de fase',
      percentage: 100 - PHASE_DEPOSIT_PCT,
      amount: phase.subtotalPriceFixed - deposit,
    });
  });

  return rows;
}

