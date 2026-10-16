import { Injectable, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { FirebaseService } from './firebase.service';

/**
 * What the Cloud Function accepts: typed text or a file. The server checks everything again
 * (functions/src/quote/brief-input.ts); the size of a file is measured there, not sent from here.
 */
export type QuoteRequest =
  | { mode: 'text'; text: string }
  | { mode: 'file'; fileName: string; mimeType: string; fileBase64: string };

/**
 * The function may take up to 300 seconds (Gemini retries included). The Firebase default of
 * 70 seconds would show an error while the quote is still being made on the server.
 */
const CALLABLE_TIMEOUT_MS = 310_000;

export interface QuoteResponse {
  quoteId: string;
  offerteNr: string;
  projectTitle: string;
  projectType: string;
  complexity: string;
  description: string;
  targetAudience: string;
  timeline: string;
  features: string[];
  technicalRequirements: string[];
  /** Internal range the fixed price was derived from (not shown to the client) */
  hoursMin: number;
  hoursMax: number;
  priceMin: number;
  priceMax: number;
  /** Fixed total price (sum of the fixed phase prices) */
  hoursFixed: number;
  priceFixed: number;
  currency: string;
  hourlyRate: number;
  offerteHtml: string;
  offerteStoragePath: string;
  breakdown: {
    baseHours: { min: number; max: number };
    featureHours: { min: number; max: number };
    matchedFeatures: string[];
  };
}

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly firebase = inject(FirebaseService);

  /**
   * Converts a File to base64 string.
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix (e.g. "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Calls the generateQuote Cloud Function with the uploaded file.
   */
  async generateQuote(file: File): Promise<QuoteResponse> {
    return this.call({
      mode: 'file',
      fileName: file.name,
      mimeType: file.type,
      fileBase64: await this.fileToBase64(file),
    });
  }

  /**
   * Calls the generateQuote Cloud Function with typed or pasted text.
   */
  async generateQuoteFromText(text: string): Promise<QuoteResponse> {
    return this.call({ mode: 'text', text });
  }

  private async call(request: QuoteRequest): Promise<QuoteResponse> {
    const generateQuoteFn = httpsCallable<QuoteRequest, QuoteResponse>(
      this.firebase.functions,
      'generateQuote',
      { timeout: CALLABLE_TIMEOUT_MS }
    );
    const result = await generateQuoteFn(request);
    return result.data;
  }

  /**
   * Formats a price in EUR with Dutch locale formatting.
   */
  formatPrice(amount: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Returns a human-readable label for a project type.
   */
  getProjectTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'landing-page':    'Landing Page',
      'brochure-site':   'Brochure Website',
      'web-app':         'Web Applicatie',
      'e-commerce':      'E-commerce',
      'api-integration': 'API Integratie',
      'mobile-app':      'Mobiele App',
      'custom':          'Maatwerk Project',
    };
    return labels[type] ?? type;
  }

  /**
   * Returns a human-readable label for complexity.
   */
  getComplexityLabel(complexity: string): string {
    const labels: Record<string, string> = {
      simple:     'Eenvoudig',
      medium:     'Gemiddeld',
      complex:    'Complex',
      enterprise: 'Enterprise',
    };
    return labels[complexity] ?? complexity;
  }
}
