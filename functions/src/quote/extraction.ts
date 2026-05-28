import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ResponseSchema } from '@google/generative-ai';
import * as mammoth from 'mammoth';

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
      description: 'The primary type of project',
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
      description: 'Project phases (2-4 phases recommended)',
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
    'projectType', 'complexity', 'features', 'timeline', 'description',
    'targetAudience', 'technicalRequirements', 'projectTitle', 'clientName',
    'projectSummary', 'techStack', 'phases', 'assumptions', 'monthlyServices',
  ],
};

const EXTRACTION_PROMPT = `Je bent een expert software-projectanalist en senior webontwikkelaar.
Analyseer de volgende projectbrief en extraheer gestructureerde informatie om een professioneel, gedetailleerd offertedocument te genereren.

Richtlijnen:
- Wees conservatief bij de complexiteitsbeoordeling — markeer alleen als "enterprise" als er duidelijke indicatoren zijn van zeer grote schaal, meerdere integraties of zeer complexe bedrijfslogica
- Adviseer een moderne, passende tech stack op basis van de projectvereisten (Angular, Firebase, etc. waar van toepassing)
- Verdeel het project in logische fasen (doorgaans 2-4 fasen), beginnend met een MVP
- Identificeer realistische aannames en mogelijke out-of-scope items die verduidelijkt moeten worden
- Stel realistische maandelijkse hosting-/servicekosten voor op basis van de aanbevolen tech stack
- Schrijf alle tekstvelden in het Nederlands, ongeacht de taal van het invoerdocument
- De projectTitle moet beknopt en professioneel zijn

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
    },
  });

  const prompt = EXTRACTION_PROMPT.replace('{DOCUMENT_TEXT}', documentText);
  const result = await model.generateContent(prompt);
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
    },
  });

  const promptText = `Je bent een expert software-projectanalist en senior webontwikkelaar.
Analyseer dit projectbriefdocument (${fileName}) en extraheer gestructureerde informatie om een professioneel, gedetailleerd offertedocument te genereren.

Richtlijnen:
- Wees conservatief bij de complexiteitsbeoordeling
- Adviseer een moderne, passende tech stack op basis van de projectvereisten
- Verdeel het project in logische fasen (doorgaans 2-4 fasen), beginnend met een MVP
- Identificeer realistische aannames en mogelijke out-of-scope items
- Stel realistische maandelijkse hosting-/servicekosten voor
- Schrijf alle tekstvelden in het Nederlands, ongeacht de taal van het invoerdocument

Extraheer alle informatie volgens het schema.`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: mimeType as 'application/pdf',
        data: fileBase64,
      },
    },
    promptText,
  ]);

  const text = result.response.text();
  const parsed = JSON.parse(text) as ExtractedProjectData;

  return { data: sanitizeExtractedData(parsed) };
}

/**
 * Sanitizes and caps array lengths in extracted data.
 */
function sanitizeExtractedData(parsed: ExtractedProjectData): ExtractedProjectData {
  if (parsed.features.length > 10) parsed.features = parsed.features.slice(0, 10);
  if (parsed.technicalRequirements.length > 8) parsed.technicalRequirements = parsed.technicalRequirements.slice(0, 8);
  if (parsed.techStack.length > 10) parsed.techStack = parsed.techStack.slice(0, 10);
  if (parsed.phases.length > 4) parsed.phases = parsed.phases.slice(0, 4);
  if (parsed.assumptions.length > 8) parsed.assumptions = parsed.assumptions.slice(0, 8);
  if (parsed.monthlyServices.length > 6) parsed.monthlyServices = parsed.monthlyServices.slice(0, 6);
  return parsed;
}
