import {
  Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
// RouterLink is kept for the empty-state fallback link
import { QuoteService, QuoteResponse } from '../../core/services/quote.service';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { LogoLinkComponent } from '../../shared/logo/logo-link.component';

@Component({
  selector: 'app-result',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, LogoLinkComponent],
  template: `
    <main class="result">
      <div class="container">

        <!-- Logo -->
        <div class="result__logo no-print">
          <app-logo-link />
        </div>

        @if (quote()) {

          <!-- Summary bar -->
          <div class="result__summary-bar">
            <div class="result__summary-bar-inner">
              <div class="result__summary-left">
                <span class="result__check" aria-hidden="true">
                  <app-icon name="check-circle" [size]="28" />
                </span>
                <div>
                  <div class="result__project-title">{{ quote()!.projectTitle }}</div>
                  <div class="result__ref">{{ quote()!.offerteNr }} &nbsp;·&nbsp; Quote ID: {{ quote()!.quoteId }}</div>
                </div>
              </div>
              <div class="result__summary-right">
                <div class="result__price-range">
                  {{ formatPrice(quote()!.priceMin) }} – {{ formatPrice(quote()!.priceMax) }}
                </div>
                <div class="result__hours">
                  {{ quote()!.hoursMin }}–{{ quote()!.hoursMax }} uur · €{{ quote()!.hourlyRate }}/uur
                </div>
              </div>
            </div>
          </div>

          <!-- Action bar -->
          <div class="result__actions no-print">
            <button class="btn btn--primary" (click)="printOffer()">
              <app-icon name="file-text" [size]="16" />
              Opslaan als PDF
            </button>
            <a href="https://watsturen.nl/contact" class="btn btn--outline" target="_blank" rel="noopener noreferrer">
              <app-icon name="message-circle" [size]="16" />
              Direct contact
            </a>
          </div>

          <!-- Disclaimer -->
          <div class="result__disclaimer no-print">
            <span class="result__disclaimer-icon" aria-hidden="true">
              <app-icon name="alert-triangle" [size]="18" />
            </span>
            <p>
              <strong>Dit is een GenAI-gegenereerde indicatie.</strong>
              De bedragen zijn een startpunt voor een persoonlijk gesprek. Definitieve prijsafspraken worden gemaakt na een kick-off gesprek over de exacte scope.
            </p>
          </div>

          <!-- Full offer HTML rendered inline -->
          <div class="result__offerte-wrapper">
            <div class="result__offerte" [innerHTML]="sanitizedOfferteHtml()"></div>
          </div>

          <!-- Bottom actions -->
          <div class="result__actions result__actions--bottom no-print">
            <button class="btn btn--primary" (click)="printOffer()">
              <app-icon name="file-text" [size]="16" />
              Opslaan als PDF
            </button>
            <a href="https://watsturen.nl/contact" class="btn btn--outline" target="_blank" rel="noopener noreferrer">
              <app-icon name="message-circle" [size]="16" />
              Direct contact
            </a>
          </div>

        } @else {
          <div class="result__empty">
            <p>Geen offertedata gevonden.</p>
            <a routerLink="/upload" class="btn btn--primary">Brief uploaden</a>
          </div>
        }

      </div>
    </main>
  `,
  styles: [`
    :host { display: block; }

    .result {
      padding-block: var(--space-8);
      background: var(--color-bg);
      min-height: 100vh;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding-inline: var(--space-6);
    }

    /* ── Logo ── */
    .result__logo {
      margin-bottom: var(--space-5);
    }

    /* ── Summary bar ── */
    .result__summary-bar {
      background: var(--color-surface);
      border: 1px solid var(--color-border-hover);
      border-radius: var(--radius-xl);
      padding: var(--space-5) var(--space-6);
      margin-bottom: var(--space-4);
    }

    .result__summary-bar-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .result__summary-left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .result__check {
      display: inline-flex;
      color: var(--color-success);
      flex-shrink: 0;
    }

    .result__project-title {
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .result__ref {
      font-size: var(--text-xs);
      color: var(--color-text-subtle);
      margin-top: 2px;
    }

    .result__summary-right {
      text-align: right;
    }

    .result__price-range {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      color: var(--color-primary);
    }

    .result__hours {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    /* ── Action bar ── */
    .result__actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
      margin-bottom: var(--space-4);
      align-items: center;
    }

    .result__actions--bottom {
      margin-top: var(--space-6);
      margin-bottom: 0;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-5);
      border-radius: var(--radius-full);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      cursor: pointer;
      text-decoration: none;
      border: 2px solid transparent;
      line-height: 1.5;
      transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
    }

    .btn--primary {
      background: var(--color-primary);
      color: #fff;
      border-color: var(--color-primary);
      &:hover { background: var(--color-primary-end); border-color: var(--color-primary-end); }
    }

    .btn--outline {
      background: transparent;
      color: var(--color-text);
      border-color: var(--color-border-hover);
      &:hover { border-color: var(--color-primary); color: var(--color-primary); }
    }

    /* ── Disclaimer ── */
    .result__disclaimer {
      display: flex;
      gap: var(--space-3);
      align-items: flex-start;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      background: rgba(245, 158, 11, 0.06);
      border: 1px solid rgba(245, 158, 11, 0.25);
      margin-bottom: var(--space-5);
      font-size: var(--text-sm);
    }

    .result__disclaimer-icon {
      display: inline-flex;
      align-items: center;
      color: var(--color-warning);
      flex-shrink: 0;
      margin-top: 1px;
    }

    .result__disclaimer p {
      margin: 0;
      color: var(--color-text-muted);
    }

    /* ── Offer HTML wrapper ── */
    .result__offerte-wrapper {
      border-radius: var(--radius-xl);
      overflow: hidden;
    }

    /* The injected offer HTML has its own inline styles — we just need to
       ensure it renders at full width and the print button inside it is hidden
       (we have our own print button above). */
    .result__offerte {
      width: 100%;
    }

    /* Hide the fixed print button baked into the offer HTML —
       we have our own print button in the action bar above */
    .result__offerte ::ng-deep .print-btn {
      display: none !important;
    }

    /* ── Empty state ── */
    .result__empty {
      text-align: center;
      padding: var(--space-16) 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-6);
    }

    /* ── Print styles ── */
    @media print {
      .no-print { display: none !important; }
      .result { background: #fff; padding: 0; }
      .container { max-width: 100%; padding: 0; }
      .result__offerte-wrapper { border-radius: 0; }
    }

    /* ── Print: show logo in print output ── */
    @media print {
      .result__logo {
        display: block !important;
        margin-bottom: var(--space-4);
      }
    }
  `],
})
export class ResultComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly quoteService = inject(QuoteService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly quote = signal<QuoteResponse | null>(null);

  readonly sanitizedOfferteHtml = computed(() => {
    const html = this.quote()?.offerteHtml;
    if (!html) return '';
    // Remove the fixed print button from the embedded HTML — we have our own
    const cleaned = html.replace(/<button[^>]*class="print-btn[^"]*"[^>]*>.*?<\/button>/gs, '');
    return this.sanitizer.bypassSecurityTrustHtml(cleaned) as string;
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const nav = this.router.getCurrentNavigation();
      const state = nav?.extras?.state ?? history.state;
      const quoteData = state?.['quote'] as QuoteResponse | undefined;

      if (quoteData) {
        this.quote.set(quoteData);
      } else {
        this.router.navigate(['/upload']);
      }
    }
  }

  printOffer(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  formatPrice(amount: number): string {
    return this.quoteService.formatPrice(amount);
  }
}
