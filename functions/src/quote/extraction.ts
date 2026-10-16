import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ResponseSchema } from '@google/generative-ai';
import * as mammoth from 'mammoth';
import { FEATURE_IDS, FEATURE_CATALOGUE_PROMPT } from './pricing-features';
import { withGeminiRetry } from './gemini-retry';

const genAI = new GoogleGenerativeAI(process.env['GEMINI_API_KEY'] ?? '');

export type ProjectType =
  | 'landing-page'
  | 'brochure-site'
  | 'web-app'
  | 'e-commerce'
  | 'api-integration'
  | 'mobile-app'
  | 'custom';

export type Complexity = 'simple' | 'medium' | 'complex' | 'enterprise';

export interface TechStackItem {
  role: string;       // e.g. "Frontend Framework"
  tool: string;       // e.g. "Angular (v17+)"
  reason: string;     // e.g. "TypeScript-first, scalable, enterprise-grade"
}

export interface ProjectPhase {
  name: string;         // e.g. "Fase 1 — MVP"
  subtitle: string;     // e.g. "Kern Platform"
  deliverables: string[]; // List of deliverables in this phase
  duration: string;     // e.g. "±3–4 maanden"
}

export interface MonthlyService {
  service: string;      // e.g. "Firebase (Blaze)"
  price: string;        // e.g. "€ 10 – 50"
  note: string;         // e.g. "Usage-based, free tier sufficient initially"
}

export interface ExtractedProjectData {
  // Core fields (used for pricing)
  projectType: ProjectType;
  complexity: Complexity;
  features: string[];
  /** Feature ids from the pricing catalogue (language independent). Absent in quotes created before this field existed. */
  featureIds?: string[];
  timeline: string;
  description: string;
  targetAudience: string;
  technicalRequirements: string[];

  // Extended fields (used for full offer document)
  projectTitle: string;           // Short title for the project
  clientName: string;             // Client name if mentioned, otherwise empty string
  projectSummary: string;         // 2-3 paragraph detailed project description
  techStack: TechStackItem[];     // Recommended tech stack with reasoning
  phases: ProjectPhase[];         // Project phases with deliverables
  assumptions: string[];          // Important assumptions and caveats (max 8)
  monthlyServices: MonthlyService[]; // Recurring hosting/service costs
}

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    projectType: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['landing-page', 'brochure-site', 'web-app', 'e-commerce', 'api-integration', 'mobile-app', 'custom'],
      description: 'The primary type of project. Use "custom" for a small internal tool or form with data storage (for example a web form that replaces an Excel sheet); use "web-app" only for a full application with accounts, several user groups or substantial business logic',
    },
    complexity: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['simple', 'medium', 'complex', 'enterprise'],
      description: 'Overall project complexity based on scope, features, and integrations',
    },
    features: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'List of specific features or functionalities mentioned (max 10)',
    },
    featureIds: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING, format: 'enum', enum: FEATURE_IDS },
      description: 'The catalogue ids of all features the brief asks for. Choose ONLY from the allowed ids, independent of the language of the brief. Each id at most once (except "other", max 3). Include features planned for a later phase too, as long as the brief asks for them. Only include what the brief mentions; NOT things the client says they do not need.',
    },
    timeline: {
      type: SchemaType.STRING,
      description: 'Desired timeline or deadline if mentioned, otherwise "Not specified"',
    },
    description: {
      type: SchemaType.STRING,
      description: 'A concise 1-2 sentence summary of the project',
    },
    targetAudience: {
      type: SchemaType.STRING,
      description: 'The intended users or target audience of the project',
    },
    technicalRequirements: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Specific technical requirements, integrations, or platforms mentioned (max 8)',
    },
    projectTitle: {
      type: SchemaType.STRING,
      description: 'A short, professional title for the project (e.g. "Poder di Awa — Educatieplatform")',
    },
    clientName: {
      type: SchemaType.STRING,
      description: 'The client or company name if mentioned in the brief, otherwise empty string',
    },
    projectSummary: {
      type: SchemaType.STRING,
      description: 'A detailed 2-3 paragraph project description suitable for a professional offer document. Describe what the project is, what it does, who it is for, and what makes it unique or ambitious.',
    },
    techStack: {
      type: SchemaType.ARRAY,
      description: 'Recommended technology stack for this project (max 10 items)',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          role: {
            type: SchemaType.STRING,
            description: 'The role or concern this technology addresses (e.g. "Frontend Framework", "Database", "Authentication")',
          },
          tool: {
            type: SchemaType.STRING,
            description: 'The specific technology or tool recommended (e.g. "Angular (v17+)", "Firebase Firestore")',
          },
          reason: {
            type: SchemaType.STRING,
            description: 'Brief reason why this technology is recommended for this project (1 sentence)',
          },
        },
        required: ['role', 'tool', 'reason'],
      },
    },
    phases: {
      type: SchemaType.ARRAY,
      description: 'Project phases. Use exactly 1 phase for small, simple projects (e.g. a form, a simple tool or a landing page); otherwise 2-4 phases',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: 'Phase name (e.g. "Fase 1 — MVP")',
          },
          subtitle: {
            type: SchemaType.STRING,
            description: 'Phase subtitle describing the focus (e.g. "Kern Platform")',
          },
          deliverables: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'List of concrete deliverables in this phase (4-8 items)',
          },
          duration: {
            type: SchemaType.STRING,
            description: 'Estimated duration for this phase (e.g. "±3–4 maanden")',
          },
        },
        required: ['name', 'subtitle', 'deliverables', 'duration'],
      },
    },
    assumptions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Important assumptions, caveats, and out-of-scope items for this project (max 8). Each item should start with a bold label like "Privacy/AVG:", "Content delivery:", "Design:", etc.',
    },
    monthlyServices: {
      type: SchemaType.ARRAY,
      description: 'Recommended recurring hosting and service costs (max 6 items)',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          service: {
            type: SchemaType.STRING,
            description: 'Service name (e.g. "Firebase (Blaze)", "Vimeo Pro")',
          },
          price: {
            type: SchemaType.STRING,
            description: 'Estimated monthly cost (e.g. "€ 10 – 50", "± € 20", "€ 0")',
          },
          note: {
            type: SchemaType.STRING,
            description: 'Brief explanation of what this service provides and when costs apply',
          },
        },
        required: ['service', 'price', 'note'],
      },
    },
  },
  required: [
    'projectType', 'complexity', 'features', 'featureIds', 'timeline', 'description',
    'targetAudience', 'technicalRequirements', 'projectTitle', 'clientName',
    'projectSummary', 'techStack', 'phases', 'assumptions', 'monthlyServices',
  ],
};

/** Rules for choosing featureIds, shared by the text and the PDF prompt. */
const FEATURE_SELECTION_RULES = `- Kies bij featureIds alleen uit onderstaande catalogus, ongeacht de taal van de brief.
- Neem een feature op als de brief erom vraagt, ook als die in een latere fase wordt gebouwd ("later graag"): elke feature die in een fase van de offerte zit moet in featureIds staan.
- Neem GEEN feature op die niet in de brief staat of die de klant niet nodig heeft ("geen koppeling nodig"). Kies "privacy" alleen als de brief AVG, privacy of persoonsgegevens noemt, "roles" alleen als er gebruikers met verschillende rechten zijn en "custom-design" alleen als er geen ontwerp of huisstijl is.
- Kies "admin-panel" alleen als de brief om een beheeromgeving, beheerpaneel of CMS vraagt. Zoeken in, bekijken of downloaden van opgeslagen gegevens is GEEN beheerpaneel (daarvoor zijn "search-filter" en "export" bedoeld).
- Kies "auth" alleen bij persoonlijke accounts (inloggen, registreren). Werkt het hele team met één gedeelde toegangscode of één wachtwoord, kies dan "shared-access" en NIET "auth".
- Let extra op de "risico"-features: offline werken, berekende velden, exacte opmaak van een bestaand document, app-store-publicatie, nieuw ontwerp, privacy/AVG en datamigratie.`;

const EXTRACTION_PROMPT = `Je bent een expert software-projectanalist en senior webontwikkelaar.
Analyseer de volgende projectbrief en extraheer gestructureerde informatie om een professioneel, gedetailleerd offertedocument te genereren.

Richtlijnen:
- Wees conservatief bij de complexiteitsbeoordeling — markeer alleen als "enterprise" als er duidelijke indicatoren zijn van zeer grote schaal, meerdere integraties of zeer complexe bedrijfslogica
- Adviseer een moderne, passende tech stack op basis van de projectvereisten (Angular, Firebase, etc. waar van toepassing)
- Verdeel het project in logische fasen (doorgaans 2-4 fasen), beginnend met een MVP. Gebruik bij een klein, eenvoudig project (bijvoorbeeld een formulier, een eenvoudige tool of een landingspagina) precies 1 fase
- Identificeer realistische aannames en mogelijke out-of-scope items die verduidelijkt moeten worden
- Stel realistische maandelijkse hosting-/servicekosten voor op basis van de aanbevolen tech stack
- Schrijf alle tekstvelden in het Nederlands, ongeacht de taal van het invoerdocument
- De projectTitle moet beknopt en professioneel zijn
${FEATURE_SELECTION_RULES}

Feature-catalogus:
${FEATURE_CATALOGUE_PROMPT}

Projectbrief:
---
{DOCUMENT_TEXT}
---

Extraheer alle informatie volgens het schema.`;

/**
 * Uses Gemini 2.5 Pro with structured output to extract full project data from a brief.
 * Returns a typed ExtractedProjectData object including all fields for the offer document.
 */
export async function extractProjectData(documentText: string): Promise<ExtractedProjectData> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0, // as repeatable as possible: the price depends on these choices
    },
  });

  const prompt = EXTRACTION_PROMPT.replace('{DOCUMENT_TEXT}', documentText);
  const result = await withGeminiRetry(() => model.generateContent(prompt), { label: 'extraction' });
  const text = result.response.text();
  const parsed = JSON.parse(text) as ExtractedProjectData;

  return sanitizeExtractedData(parsed);
}

/**
 * Extracts project data from a binary file (PDF/DOCX) using Gemini's native file understanding.
 * - PDF: sent as inlineData (Gemini 2.5 Pro supports PDF natively)
 * - DOCX/DOC: text extracted with mammoth first, then passed as plain text
 *
 * Returns both the extracted data AND the raw text (for DOCX) so the caller
 * can reuse it for moderation without double-extracting.
 */
export async function extractProjectDataFromFile(
  fileBase64: string,
  mimeType: string,
  fileName: string
): Promise<{ data: ExtractedProjectData; extractedText?: string }> {
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword';

  // DOCX/DOC: extract text with mammoth, then use the text-based extraction path
  if (isDocx) {
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const { value: extractedText } = await mammoth.extractRawText({ buffer: fileBuffer });
    if (!extractedText.trim()) {
      throw new Error('Could not extract text from the Word document. Please try saving as PDF.');
    }
    const data = await extractProjectData(extractedText);
    return { data, extractedText };
  }

  // PDF: send as inlineData (supported by Gemini 2.5 Pro)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0, // as repeatable as possible: the price depends on these choices
    },
  });

  const promptText = `Je bent een expert software-projectanalist en senior webontwikkelaar.
Analyseer dit projectbriefdocument (${fileName}) en extraheer gestructureerde informatie om een professioneel, gedetailleerd offertedocument te genereren.

Richtlijnen:
- Wees conservatief bij de complexiteitsbeoordeling
- Adviseer een moderne, passende tech stack op basis van de projectvereisten
- Verdeel het project in logische fasen (doorgaans 2-4 fasen), beginnend met een MVP. Gebruik bij een klein, eenvoudig project (bijvoorbeeld een formulier, een eenvoudige tool of een landingspagina) precies 1 fase
- Identificeer realistische aannames en mogelijke out-of-scope items
- Stel realistische maandelijkse hosting-/servicekosten voor
- Schrijf alle tekstvelden in het Nederlands, ongeacht de taal van het invoerdocument
${FEATURE_SELECTION_RULES}

Feature-catalogus:
${FEATURE_CATALOGUE_PROMPT}

Extraheer alle informatie volgens het schema.`;

  const result = await withGeminiRetry(
    () =>
      model.generateContent([
        {
          inlineData: {
            mimeType: mimeType as 'application/pdf',
            data: fileBase64,
          },
        },
        promptText,
      ]),
    { label: 'extraction-pdf' }
  );

  const text = result.response.text();
  const parsed = JSON.parse(text) as ExtractedProjectData;

  return { data: sanitizeExtractedData(parsed) };
}

/**
 * Sanitizes and caps array lengths in extracted data.
 */
function sanitizeExtractedData(parsed: ExtractedProjectData): ExtractedProjectData {
  if (parsed.features.length > 10) parsed.features = parsed.features.slice(0, 10);
  if (Array.isArray(parsed.featureIds)) {
    // Keep only known ids, whatever the model returned
    parsed.featureIds = parsed.featureIds.filter(id => FEATURE_IDS.includes(id)).slice(0, 20);
  }
  if (parsed.technicalRequirements.length > 8) parsed.technicalRequirements = parsed.technicalRequirements.slice(0, 8);
  if (parsed.techStack.length > 10) parsed.techStack = parsed.techStack.slice(0, 10);
  if (parsed.phases.length > 4) parsed.phases = parsed.phases.slice(0, 4);
  if (parsed.assumptions.length > 8) parsed.assumptions = parsed.assumptions.slice(0, 8);
  if (parsed.monthlyServices.length > 6) parsed.monthlyServices = parsed.monthlyServices.slice(0, 6);
  return parsed;
}
