import {
  Component, ChangeDetectionStrategy, inject, signal, effect
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { AuthService, AuthMode } from '../../core/services/auth.service';
import { LogoLinkComponent } from '../../shared/logo/logo-link.component';

@Component({
  selector: 'app-auth',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LogoLinkComponent],
  template: `
    <main class="auth">
      <div class="container container--xs">

        <!-- Logo -->
        <app-logo-link />

        <!-- Stap indicator -->
        <span class="section-label">Stap 1 van 2</span>

        <div class="auth__card card">
          <h1 class="auth__title">
            @if (mode() === 'sign-in') { Welkom terug }
            @else { Account aanmaken }
          </h1>
          <p class="auth__subtitle">
            @if (mode() === 'sign-in') {
              Log in om de offerte tool te gebruiken.
            } @else {
              Maak een gratis account aan voor je directe prijsindicatie.
            }
          </p>

          <!-- Email verification notice -->
          @if (showVerificationNotice()) {
            <div class="auth__notice auth__notice--info">
              <svg class="auth__notice-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M2 7l10 7 10-7"/>
              </svg>
              <div>
                <strong>Controleer je inbox</strong>
                <p>We hebben een verificatielink gestuurd naar <strong>{{ verificationEmail() }}</strong>. Klik op de link om je e-mailadres te bevestigen en log daarna in.</p>
                <button class="auth__resend-btn" (click)="resendVerification()" [disabled]="resendLoading()">
                  @if (resendLoading()) { Versturen... } @else { E-mail opnieuw versturen }
                </button>
              </div>
            </div>
          }

          <!-- Google Sign-In -->
          <button
            class="auth__google-btn btn btn--outline btn--full"
            (click)="signInWithGoogle()"
            [disabled]="loading()"
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Doorgaan met Google
          </button>

          <div class="auth__divider">
            <span>of</span>
          </div>

          <!-- Email/Password form -->
          <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
            <div class="form-field">
              <label for="email" class="form-label">E-mailadres</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                class="form-input"
                [class.form-input--error]="isInvalid('email')"
                placeholder="jij@voorbeeld.nl"
                autocomplete="email"
              />
              @if (isInvalid('email')) {
                <span class="form-error">Geldig e-mailadres is vereist</span>
              }
            </div>

            <div class="form-field" style="margin-top: var(--space-4);">
              <label for="password" class="form-label">Wachtwoord</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                class="form-input"
                [class.form-input--error]="isInvalid('password')"
                [placeholder]="mode() === 'sign-up' ? 'Minimaal 6 tekens' : 'Jouw wachtwoord'"
                autocomplete="current-password"
              />
              @if (isInvalid('password')) {
                <span class="form-error">
                  @if (mode() === 'sign-up') { Wachtwoord moet minimaal 6 tekens bevatten }
                  @else { Wachtwoord is vereist }
                </span>
              }
            </div>

            @if (error()) {
              <div class="auth__notice auth__notice--error" style="margin-top: var(--space-4);">
                <span aria-hidden="true">⚠️</span>
                <p>{{ error() }}</p>
              </div>
            }

            <button
              type="submit"
              class="btn btn--primary btn--full"
              style="margin-top: var(--space-6);"
              [disabled]="loading()"
            >
              @if (loading()) {
                <span class="auth__spinner" aria-hidden="true"></span>
                @if (mode() === 'sign-in') { Inloggen... } @else { Account aanmaken... }
              } @else {
                @if (mode() === 'sign-in') { Inloggen } @else { Account aanmaken }
              }
            </button>
          </form>

          <!-- Toggle mode -->
          <p class="auth__toggle">
            @if (mode() === 'sign-in') {
              Nog geen account?
              <button class="auth__toggle-btn" (click)="toggleMode()" type="button">Maak er een aan</button>
            } @else {
              Al een account?
              <button class="auth__toggle-btn" (click)="toggleMode()" type="button">Inloggen</button>
            }
          </p>
        </div>

      </div>
    </main>
  `,
  styles: [`
    :host { display: block; }

    .auth {
      min-height: 100vh;
      display: flex;
      align-items: center;
      padding-block: var(--space-16);
    }

    app-logo-link {
      display: block;
      margin-bottom: var(--space-4);
    }

    .auth__card {
      padding: var(--space-10);
    }

    .auth__title {
      font-size: var(--text-3xl);
      margin-bottom: var(--space-2);
    }

    .auth__subtitle {
      margin-bottom: var(--space-8);
    }

    .auth__google-btn {
      width: 100%;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
    }

    .auth__divider {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-block: var(--space-6);
      color: var(--color-text-subtle);
      font-size: var(--text-sm);

      &::before, &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--color-border);
      }
    }

    .auth__notice {
      display: flex;
      gap: var(--space-3);
      align-items: flex-start;
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      margin-bottom: var(--space-6);
      font-size: var(--text-sm);

      p { margin: var(--space-1) 0 0; max-width: none; }

      &--info {
        background: rgba(99, 102, 241, 0.08);
        border: 1px solid rgba(99, 102, 241, 0.2);
      }

      &--error {
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.2);
        color: var(--color-error);
        p { color: var(--color-error); max-width: none; }
      }
    }

    .auth__notice-icon {
      flex-shrink: 0;
      margin-top: 1px;
      color: var(--color-primary);
    }

    .auth__resend-btn {
      margin-top: var(--space-2);
      color: var(--color-primary);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;

      &:hover { text-decoration: underline; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .auth__spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .auth__toggle {
      text-align: center;
      margin-top: var(--space-6);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      max-width: none;
    }

    .auth__toggle-btn {
      color: var(--color-primary);
      font-weight: var(--font-semibold);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      margin-left: var(--space-1);

      &:hover { text-decoration: underline; }
    }
  `],
})
export class AuthComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly mode = signal<AuthMode>('sign-in');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showVerificationNotice = signal(false);
  readonly verificationEmail = signal('');
  readonly resendLoading = signal(false);

  readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    // Reactively redirect to /upload once auth state resolves and user is verified.
    // Using effect() avoids the race condition of ngOnInit firing before
    // Firebase onAuthStateChanged has resolved the user signal.
    effect(() => {
      if (!this.authService.loading() &&
          this.authService.isAuthenticated() &&
          this.authService.isEmailVerified()) {
        this.router.navigate(['/upload']);
      }
    });
  }

  toggleMode(): void {
    this.mode.update(m => m === 'sign-in' ? 'sign-up' : 'sign-in');
    this.error.set(null);
    this.showVerificationNotice.set(false);
    this.form.reset();
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field) as AbstractControl;
    return !!(control?.invalid && control?.touched);
  }

  async signInWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.authService.signInWithGoogle();
      await this.router.navigate(['/upload']);
    } catch (err) {
      this.error.set(this.authService.getErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.value;

    try {
      if (this.mode() === 'sign-in') {
        await this.authService.signInWithEmail(email!, password!);
        // Check email verification
        if (!this.authService.isEmailVerified()) {
          this.showVerificationNotice.set(true);
          this.verificationEmail.set(email!);
          return;
        }
        await this.router.navigate(['/upload']);
      } else {
        await this.authService.signUpWithEmail(email!, password!);
        this.showVerificationNotice.set(true);
        this.verificationEmail.set(email!);
      }
    } catch (err) {
      this.error.set(this.authService.getErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async resendVerification(): Promise<void> {
    this.resendLoading.set(true);
    try {
      await this.authService.resendVerificationEmail();
    } finally {
      this.resendLoading.set(false);
    }
  }
}
