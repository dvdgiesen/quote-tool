import {
  Component, ChangeDetectionStrategy, inject, signal, OnInit, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { LogoLinkComponent } from '../../shared/logo/logo-link.component';

/**
 * Handles all Firebase Auth email action links on our own domain (/auth/actie).
 * Firebase sends the user here with ?mode=...&oobCode=... query params.
 *
 * Supported modes:
 *   verifyEmail    — e-mailadres bevestigen na registratie
 *   resetPassword  — nieuw wachtwoord instellen na wachtwoord-reset aanvraag
 *   recoverEmail   — e-mailadres herstellen na ongewenste wijziging
 */

type ActionMode = 'verifyEmail' | 'resetPassword' | 'recoverEmail' | null;
type PageState =
  | 'loading'
  | 'verify-success'
  | 'verify-error'
  | 'reset-form'
  | 'reset-success'
  | 'reset-error'
  | 'recover-success'
  | 'recover-error'
  | 'invalid';

@Component({
  selector: 'app-auth-action',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, LogoLinkComponent],
  template: `
    <main class="action">
      <div class="container container--xs">

        <app-logo-link />

        <div class="action__card card">

          <!-- Laden -->
          @if (state() === 'loading') {
            <div class="action__center">
              <span class="action__spinner" aria-hidden="true"></span>
              <p class="action__muted">Even geduld…</p>
            </div>
          }

          <!-- E-mailadres bevestigd -->
          @if (state() === 'verify-success') {
            <div class="action__icon action__icon--success" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h1 class="action__title">E-mailadres bevestigd!</h1>
            <p class="action__body">
              Je account is geactiveerd. Je kunt nu inloggen en de offerte tool gebruiken.
            </p>
            <a routerLink="/auth" class="btn btn--primary btn--full action__cta">
              Inloggen
            </a>
          }

          <!-- E-mailverificatie mislukt -->
          @if (state() === 'verify-error') {
            <div class="action__icon action__icon--error" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h1 class="action__title">Verificatie mislukt</h1>
            <p class="action__body">
              De verificatielink is verlopen of al eerder gebruikt.
              Vraag een nieuwe verificatiemail aan via de inlogpagina.
            </p>
            <a routerLink="/auth" class="btn btn--primary btn--full action__cta">
              Terug naar inloggen
            </a>
          }

          <!-- Wachtwoord-reset formulier -->
          @if (state() === 'reset-form') {
            <h1 class="action__title">Nieuw wachtwoord instellen</h1>
            <p class="action__body">Kies een nieuw wachtwoord voor je account.</p>

            <form [formGroup]="resetForm" (ngSubmit)="onResetSubmit()" novalidate>
              <div class="form-field">
                <label for="new-password" class="form-label">Nieuw wachtwoord</label>
                <input
                  id="new-password"
                  type="password"
                  formControlName="password"
                  class="form-input"
                  [class.form-input--error]="isResetInvalid('password')"
                  placeholder="Minimaal 6 tekens"
                  autocomplete="new-password"
                />
                @if (isResetInvalid('password')) {
                  <span class="form-error">Wachtwoord moet minimaal 6 tekens bevatten</span>
                }
              </div>

              @if (resetError()) {
                <div class="action__notice action__notice--error" style="margin-top: var(--space-4);">
                  <p>{{ resetError() }}</p>
                </div>
              }

              <button
                type="submit"
                class="btn btn--primary btn--full"
                style="margin-top: var(--space-6);"
                [disabled]="resetLoading()"
              >
                @if (resetLoading()) {
                  <span class="action__spinner action__spinner--sm" aria-hidden="true"></span>
                  Opslaan…
                } @else {
                  Wachtwoord opslaan
                }
              </button>
            </form>
          }

          <!-- Wachtwoord-reset gelukt -->
          @if (state() === 'reset-success') {
            <div class="action__icon action__icon--success" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h1 class="action__title">Wachtwoord opgeslagen!</h1>
            <p class="action__body">
              Je wachtwoord is bijgewerkt. Je kunt nu inloggen met je nieuwe wachtwoord.
            </p>
            <a routerLink="/auth" class="btn btn--primary btn--full action__cta">
              Inloggen
            </a>
          }

          <!-- Wachtwoord-reset mislukt -->
          @if (state() === 'reset-error') {
            <div class="action__icon action__icon--error" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h1 class="action__title">Wachtwoord wijzigen mislukt</h1>
            <p class="action__body">
              De link is verlopen of al eerder gebruikt.
              Vraag een nieuwe wachtwoord-reset aan via de inlogpagina.
            </p>
            <a routerLink="/auth" class="btn btn--primary btn--full action__cta">
              Terug naar inloggen
            </a>
          }

          <!-- E-mailadres hersteld -->
          @if (state() === 'recover-success') {
            <div class="action__icon action__icon--success" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h1 class="action__title">E-mailadres hersteld</h1>
            <p class="action__body">
              Je e-mailadres is teruggezet naar het vorige adres. Log opnieuw in om door te gaan.
            </p>
            <a routerLink="/auth" class="btn btn--primary btn--full action__cta">
              Inloggen
            </a>
          }

          <!-- E-mailadres herstellen mislukt -->
          @if (state() === 'recover-error') {
            <div class="action__icon action__icon--error" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h1 class="action__title">Herstel mislukt</h1>
            <p class="action__body">
              De link is verlopen of al eerder gebruikt.
              Neem contact op als je hulp nodig hebt.
            </p>
            <a routerLink="/auth" class="btn btn--primary btn--full action__cta">
              Terug naar inloggen
            </a>
          }

          <!-- Ongeldige of ontbrekende link -->
          @if (state() === 'invalid') {
            <div class="action__icon action__icon--error" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h1 class="action__title">Ongeldige link</h1>
            <p class="action__body">
              Deze pagina kan alleen worden geopend via een link in een e-mail van Watsturen.
            </p>
            <a routerLink="/auth" class="btn btn--primary btn--full action__cta">
              Terug naar inloggen
            </a>
          }

        </div>
      </div>
    </main>
  `,
  styles: [`
    :host { display: block; }

    .action {
      min-height: 100vh;
      display: flex;
      align-items: center;
      padding-block: var(--space-16);
    }

    app-logo-link {
      display: block;
      margin-bottom: var(--space-4);
    }

    .action__card {
      padding: var(--space-10);
      text-align: center;
    }

    .action__center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
    }

    .action__muted {
      color: var(--color-text-muted);
    }

    .action__spinner {
      display: inline-block;
      width: 32px;
      height: 32px;
      border: 3px solid rgba(99, 102, 241, 0.2);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;

      &--sm {
        width: 16px;
        height: 16px;
        border-width: 2px;
        border-top-color: #fff;
        border-color: rgba(255,255,255,0.3);
        border-top-color: #fff;
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .action__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin-bottom: var(--space-6);

      &--success {
        background: rgba(34, 197, 94, 0.12);
        color: #22c55e;
      }

      &--error {
        background: rgba(239, 68, 68, 0.1);
        color: var(--color-error);
      }
    }

    .action__title {
      font-size: var(--text-3xl);
      margin-bottom: var(--space-3);
    }

    .action__body {
      color: var(--color-text-muted);
      margin-bottom: var(--space-8);
      max-width: 36ch;
      margin-inline: auto;
    }

    .action__cta {
      max-width: 240px;
      margin-inline: auto;
    }

    /* Reset form — left-align text */
    form {
      text-align: left;
    }

    .action__notice {
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      font-size: var(--text-sm);

      &--error {
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.2);
        color: var(--color-error);
        p { color: var(--color-error); margin: 0; max-width: none; }
      }
    }
  `],
})
export class AuthActionComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly fb = inject(FormBuilder);

  readonly state = signal<PageState>('loading');
  readonly resetLoading = signal(false);
  readonly resetError = signal<string | null>(null);

  private oobCode = '';

  readonly resetForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      // During SSR there are no query params — keep loading state.
      return;
    }

    const params = this.route.snapshot.queryParamMap;
    const mode = params.get('mode') as ActionMode;
    const oobCode = params.get('oobCode');

    if (!mode || !oobCode) {
      this.state.set('invalid');
      return;
    }

    this.oobCode = oobCode;

    switch (mode) {
      case 'verifyEmail':
        this.authService.applyEmailActionCode(oobCode)
          .then(() => this.state.set('verify-success'))
          .catch(() => this.state.set('verify-error'));
        break;

      case 'resetPassword':
        // Show the password input form — oobCode is applied on submit.
        this.state.set('reset-form');
        break;

      case 'recoverEmail':
        this.authService.applyEmailActionCode(oobCode)
          .then(() => this.state.set('recover-success'))
          .catch(() => this.state.set('recover-error'));
        break;

      default:
        this.state.set('invalid');
    }
  }

  isResetInvalid(field: string): boolean {
    const control = this.resetForm.get(field) as AbstractControl;
    return !!(control?.invalid && control?.touched);
  }

  async onResetSubmit(): Promise<void> {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.resetLoading.set(true);
    this.resetError.set(null);

    const { password } = this.resetForm.value;

    try {
      await this.authService.confirmPasswordReset(this.oobCode, password!);
      this.state.set('reset-success');
    } catch {
      this.resetError.set('De link is verlopen of al eerder gebruikt. Vraag een nieuwe wachtwoord-reset aan.');
      this.state.set('reset-error');
    } finally {
      this.resetLoading.set(false);
    }
  }
}
