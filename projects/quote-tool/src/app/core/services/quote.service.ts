import { Injectable, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { FirebaseService } from './firebase.service';

export interface QuoteRequest {
  fileName: string;
  mimeType: string;
  fileBase64: string;
  fileSize: number;
}

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
  hoursMin: number;
  hoursMax: number;
  priceMin: number;
  priceMax: number;
  currency: string;
  hourlyRate: number;
  offerteHtml: string;
  offerteStoragePath: string;
  breakdown: {
    baseHours: { min: number; max: number };
    featureHours: { min: number; max: number };
    complexityMultiplier: number;
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
    const fileBase64 = await this.fileToBase64(file);

    const generateQuoteFn = httpsCallable<QuoteRequest, QuoteResponse>(
      this.firebase.functions,
      'generateQuote'
    );

    const result = await generateQuoteFn({
      fileName: file.name,
      mimeType: file.type,
      fileBase64,
      fileSize: file.size,
    });

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
