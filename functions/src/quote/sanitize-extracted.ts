import type { ExtractedProjectData, ProjectType, Complexity, TechStackItem, ProjectPhase, MonthlyService } from './extraction';
import { FEATURE_IDS } from './pricing-features';

/**
 * Validates and cleans what the model returned, field by field.
 *
 * The model is steered by text from a visitor, so its answer is untrusted: even with a fixed JSON
 * schema the values can be too long, contain links or telephone numbers, or have the wrong type.
 * The offer shows these texts with the company name on them, and they are e-mailed, so they must
 * stay short, plain and free of contact details. HTML is escaped separately where it is output.
 */

const PROJECT_TYPES: readonly ProjectType[] = [
  'landing-page', 'brochure-site', 'web-app', 'e-commerce', 'api-integration', 'mobile-app', 'custom',
];
const COMPLEXITIES: readonly Complexity[] = ['simple', 'medium', 'complex', 'enterprise'];

const MAX = {
  title: 100, clientName: 80, timeline: 100, description: 500, targetAudience: 300, summary: 3000,
  feature: 120, techReq: 120, assumption: 400, tsRole: 60, tsTool: 80, tsReason: 300,
  phaseName: 80, phaseSubtitle: 100, phaseDuration: 40, deliverable: 200,
  service: 80, price: 40, note: 300,
} as const;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const URL_LIKE = /\b(?:https?:\/\/|ftp:\/\/|www\.)\S+/gi;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
/** Eight or more digits, with at most separators between them: telephone and bank numbers. */
const LONG_NUMBER = /\+?\d(?:[\s().-]?\d){7,}/g;

/** Plain, short text: no control characters, links, e-mail addresses or long numbers. */
export function cleanText(value: unknown, maxLength: number, keepNewlines = false): string {
  if (typeof value !== 'string') return '';
  let text = value
    .replace(CONTROL_CHARS, '')
    .replace(URL_LIKE, '')
    .replace(EMAIL_LIKE, '')
    .replace(LONG_NUMBER, '');
  text = keepNewlines
    ? text.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n')
    : text.replace(/\s+/g, ' ');
  return Array.from(text.trim()).slice(0, maxLength).join('');
}

/** An amount of money or a short phrase: letters, digits and a few signs, a few words at most. */
const PRICE_ALLOWED = /^[\p{L}\p{N} €±~.,\-–+*/()%]+$/u;

export function cleanPrice(value: unknown): string {
  const text = cleanText(value, MAX.price);
  if (!text || !PRICE_ALLOWED.test(text) || text.split(' ').length > 6) return 'Op aanvraag';
  return text;
}

function cleanList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => cleanText(item, maxLength))
    .filter(item => item.length > 0)
    .slice(0, maxItems);
}

function objectsOf(value: unknown, maxItems: number): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .slice(0, maxItems);
}

export function sanitizeExtractedData(input: unknown): ExtractedProjectData {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;

  const projectType = PROJECT_TYPES.includes(raw['projectType'] as ProjectType)
    ? (raw['projectType'] as ProjectType)
    : 'custom';
  const complexity = COMPLEXITIES.includes(raw['complexity'] as Complexity)
    ? (raw['complexity'] as Complexity)
    : 'medium';

  const techStack: TechStackItem[] = objectsOf(raw['techStack'], 10).map(item => ({
    role: cleanText(item['role'], MAX.tsRole),
    tool: cleanText(item['tool'], MAX.tsTool),
    reason: cleanText(item['reason'], MAX.tsReason),
  })).filter(item => item.tool.length > 0);

  const phases: ProjectPhase[] = objectsOf(raw['phases'], 4).map(item => ({
    name: cleanText(item['name'], MAX.phaseName),
    subtitle: cleanText(item['subtitle'], MAX.phaseSubtitle),
    deliverables: cleanList(item['deliverables'], 8, MAX.deliverable),
    duration: cleanText(item['duration'], MAX.phaseDuration),
  })).filter(item => item.name.length > 0 || item.deliverables.length > 0);

  const monthlyServices: MonthlyService[] = objectsOf(raw['monthlyServices'], 6).map(item => ({
    service: cleanText(item['service'], MAX.service),
    price: cleanPrice(item['price']),
    note: cleanText(item['note'], MAX.note),
  })).filter(item => item.service.length > 0);

  const data: ExtractedProjectData = {
    projectType,
    complexity,
    features: cleanList(raw['features'], 10, MAX.feature),
    timeline: cleanText(raw['timeline'], MAX.timeline) || 'Niet gespecificeerd',
    description: cleanText(raw['description'], MAX.description),
    targetAudience: cleanText(raw['targetAudience'], MAX.targetAudience),
    technicalRequirements: cleanList(raw['technicalRequirements'], 8, MAX.techReq),
    projectTitle: cleanText(raw['projectTitle'], MAX.title) || 'Project',
    clientName: cleanText(raw['clientName'], MAX.clientName),
    projectSummary: cleanText(raw['projectSummary'], MAX.summary, true),
    techStack,
    phases,
    assumptions: cleanList(raw['assumptions'], 8, MAX.assumption),
    monthlyServices,
  };

  // Absent stays absent: pricing then falls back to keyword matching. Present means: known ids only.
  if (Array.isArray(raw['featureIds'])) {
    data.featureIds = (raw['featureIds'] as unknown[])
      .filter((id): id is string => typeof id === 'string' && FEATURE_IDS.includes(id))
      .slice(0, 20);
  }

  return data;
}

/** False when the model found nothing to build a quote on (no features and no deliverables). */
export function hasUsableContent(data: ExtractedProjectData): boolean {
  const hasIds = (data.featureIds ?? []).length > 0;
  const hasFeatures = data.features.length > 0;
  const hasDeliverables = data.phases.some(phase => phase.deliverables.length > 0);
  return hasIds || hasFeatures || hasDeliverables;
}
