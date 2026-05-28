import {
  Component, ChangeDetectionStrategy, inject, signal, computed, effect, OnInit, PLATFORM_ID,
  ViewChild, ElementRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { doc, getDoc } from 'firebase/firestore';
import { AuthService } from '../../core/services/auth.service';
import { QuoteService } from '../../core/services/quote.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { LogoLinkComponent } from '../../shared/logo/logo-link.component';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

@Component({
  selector: 'app-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LogoLinkComponent],
  template: `
    <main class="upload">
      <div class="container container--xs">

        <!-- Logo -->
        <app-logo-link />

        <!-- Header -->
        <div class="upload__header">
          <span class="section-label">Stap 2 van 2</span>
          <h1>Upload je brief</h1>
          <p>
            Upload een PDF, Word-document of tekstbestand met een beschrijving van je project.
            Onze GenAI leest het en genereert direct een prijsindicatie.
          </p>
        </div>

          <!-- Rate limit notice -->
          @if (isRateLimited()) {
            <div class="upload__notice upload__notice--warning">
              <span class="upload__notice-icon" aria-hidden="true"><app-icon name="clock" [size]="18" /></span>
              <div>
                <strong>Daglimiet bereikt</strong>
                <p>Je hebt vandaag al een offerte aangevraagd.
                  @if (rateLimitHoursRemaining() > 0) {
                    Je kunt over {{ rateLimitHoursRemaining() }} uur{{ rateLimitHoursRemaining() === 1 ? '' : '' }} opnieuw indienen.
                  } @else {
                    Je kunt morgen opnieuw indienen.
                  }
                </p>
              </div>
            </div>
          }

        <!-- Email verification notice -->
        @if (!isEmailVerified()) {
          <div class="upload__notice upload__notice--warning">
            <span class="upload__notice-icon" aria-hidden="true"><app-icon name="mail" [size]="18" /></span>
              <div>
                <strong>E-mail niet geverifieerd</strong>
                <p>Verifieer je e-mailadres voordat je een offerte aanvraagt.</p>
                <button class="upload__text-btn" (click)="resendVerification()">Verificatie-e-mail opnieuw versturen</button>
              </div>
          </div>
        }

        <!-- Upload form -->
        <div class="upload__card card">

          <!-- Drop zone -->
          <div
            class="upload__dropzone"
            [class.upload__dropzone--active]="isDragging()"
            [class.upload__dropzone--has-file]="selectedFile()"
            [class.upload__dropzone--error]="fileError()"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave()"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
            role="button"
            tabindex="0"
            (keydown.enter)="fileInput.click()"
            (keydown.space)="fileInput.click()"
            [attr.aria-label]="selectedFile() ? 'Bestand wijzigen: ' + selectedFile()!.name : 'Klik of sleep om je projectbrief te uploaden'"
          >
            <input
              #fileInput
              type="file"
              class="sr-only"
              accept=".pdf,.doc,.docx,.txt"
              (change)="onFileSelected($event)"
              aria-hidden="true"
            />

            @if (selectedFile()) {
              <div class="upload__file-info">
                <span class="upload__file-icon" aria-hidden="true">
                  <app-icon [name]="getFileIconName(selectedFile()!.type)" [size]="28" />
                </span>
                <div>
                  <p class="upload__file-name">{{ selectedFile()!.name }}</p>
                  <p class="upload__file-size">{{ formatFileSize(selectedFile()!.size) }}</p>
                </div>
                <button
                  class="upload__remove-btn"
                  (click)="removeFile($event)"
                  type="button"
                  aria-label="Remove file"
                >
                  <app-icon name="x" [size]="16" />
                </button>
              </div>
            } @else {
              <div class="upload__dropzone-content">
                <div class="upload__dropzone-icon" aria-hidden="true">
                  <app-icon name="upload" [size]="32" />
                </div>
                <p class="upload__dropzone-text">
                  <strong>Klik om te uploaden</strong> of sleep het bestand hierheen
                </p>
                <p class="upload__dropzone-hint">PDF, Word of platte tekst — max {{ maxSizeMb }}MB</p>
              </div>
            }
          </div>

          @if (fileError()) {
            <p class="form-error" style="margin-top: var(--space-2);">{{ fileError() }}</p>
          }

          <!-- Submit button — becomes a progress bar while loading -->
          <button
            class="btn btn--primary btn--full upload__submit"
            [class.upload__submit--loading]="loading()"
            (click)="onSubmit()"
            [disabled]="!canSubmit()"
            [style.--progress]="loadingProgress() + '%'"
            type="button"
          >
            <!-- Fill layer (progress bar background) -->
            @if (loading()) {
              <span class="upload__submit-fill" aria-hidden="true"></span>
            }
            <!-- Button label -->
            <span class="upload__submit-label">
              @if (loading()) {
                {{ loadingMessage() }}
              } @else {
                Genereer mijn indicatie
                <app-icon name="arrow-right" [size]="16" />
              }
            </span>
          </button>

          @if (error()) {
            <div class="upload__notice upload__notice--error" style="margin-top: var(--space-4);">
              <span class="upload__notice-icon" aria-hidden="true"><app-icon name="alert-triangle" [size]="18" /></span>
              <p>{{ error() }}</p>
            </div>
          }

          <!-- Tips -->
          <div class="upload__tips">
            <p class="upload__tips-title">
              <app-icon name="lightbulb" [size]="14" />
              Voor de beste indicatie, vermeld:
            </p>
            <ul class="upload__tips-list">
              @for (tip of tips; track tip) {
                <li>{{ tip }}</li>
              }
            </ul>
          </div>
        </div>

        <!-- Sign out -->
        <div class="upload__footer">
          <span class="upload__user">Ingelogd als {{ displayName() }}</span>
          <button class="btn btn--ghost" (click)="signOut()" type="button">Uitloggen</button>
        </div>

      </div>
    </main>
  `,
  styles: [`
    :host { display: block; }

    .upload {
      min-height: 100vh;
      padding-block: var(--space-16);
    }

    app-logo-link {
      display: block;
      margin-bottom: var(--space-6);
    }

    .upload__header {
      margin-bottom: var(--space-8);

      h1 { font-size: var(--text-4xl); margin-bottom: var(--space-3); }
      p  { font-size: var(--text-lg); }
    }

    .upload__notice {
      display: flex;
      gap: var(--space-3);
      align-items: flex-start;
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      margin-bottom: var(--space-6);
      font-size: var(--text-sm);

      p { margin: var(--space-1) 0 0; max-width: none; }

      &--warning {
        background: rgba(245, 158, 11, 0.08);
        border: 1px solid rgba(245, 158, 11, 0.25);
        color: var(--color-warning);
        p { color: var(--color-text-muted); }
      }

      &--error {
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.2);
        p { color: var(--color-error); max-width: none; }
      }
    }

    .upload__text-btn {
      margin-top: var(--space-2);
      color: var(--color-primary);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;

      &:hover { text-decoration: underline; }
    }

    .upload__card {
      padding: var(--space-8);
    }

    .upload__dropzone {
      border: 2px dashed var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-10);
      text-align: center;
      cursor: pointer;
      transition: all var(--transition-base);
      margin-bottom: var(--space-6);

      &:hover, &--active {
        border-color: var(--color-primary);
        background: rgba(99, 102, 241, 0.04);
      }

      &--has-file {
        border-style: solid;
        border-color: var(--color-primary);
        background: rgba(99, 102, 241, 0.04);
        padding: var(--space-6);
      }

      &--error {
        border-color: var(--color-error);
      }

      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
    }

    .upload__dropzone-icon {
      color: var(--color-text-subtle);
      margin: 0 auto var(--space-4);
      width: fit-content;
    }

    .upload__dropzone-text {
      color: var(--color-text);
      margin-bottom: var(--space-1);
      max-width: none;
    }

    .upload__dropzone-hint {
      font-size: var(--text-sm);
      color: var(--color-text-subtle);
      margin: 0;
      max-width: none;
    }

    .upload__file-info {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      text-align: left;
    }

    .upload__file-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--color-primary);
    }

    .upload__notice-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .upload__file-name {
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin: 0;
      max-width: none;
      word-break: break-all;
    }

    .upload__file-size {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
      max-width: none;
    }

    .upload__remove-btn {
      margin-left: auto;
      flex-shrink: 0;
      color: var(--color-text-muted);
      padding: var(--space-1);
      border-radius: var(--radius-sm);
      transition: color var(--transition-fast);

      &:hover { color: var(--color-error); }
    }

    .upload__submit {
      font-size: var(--text-lg);
      padding: var(--space-4);
      position: relative;
      overflow: hidden;
      isolation: isolate;
    }

    /* The fill layer that grows from left to right */
    .upload__submit-fill {
      position: absolute;
      inset: 0;
      right: auto;
      width: var(--progress, 0%);
      background: rgba(255, 255, 255, 0.18);
      transition: width 0.6s ease;
      z-index: 0;
      border-radius: inherit;
    }

    /* Keep label above the fill */
    .upload__submit-label {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    /* Subtle shimmer on the fill while loading */
    .upload__submit--loading .upload__submit-fill::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255,255,255,0.12) 50%,
        transparent 100%
      );
      animation: shimmer 1.8s ease-in-out infinite;
    }

    @keyframes shimmer {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .upload__tips {
      margin-top: var(--space-8);
      padding-top: var(--space-6);
      border-top: 1px solid var(--color-border);
    }

    .upload__tips-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin-bottom: var(--space-3);
      max-width: none;
    }

    .upload__tips-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      list-style: disc;
      padding-left: var(--space-5);

      li {
        font-size: var(--text-sm);
        color: var(--color-text-muted);
      }
    }

    .upload__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: var(--space-6);
    }

    .upload__user {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
  `],
})
export class UploadComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly quoteService = inject(QuoteService);
  private readonly firebase = inject(FirebaseService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  readonly displayName = this.authService.displayName;
  readonly isEmailVerified = this.authService.isEmailVerified;

  readonly selectedFile = signal<File | null>(null);
  readonly isDragging = signal(false);
  readonly fileError = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loadingMessage = signal('Je brief analyseren...');
  readonly error = signal<string | null>(null);
  readonly isRateLimited = signal(false);
  readonly rateLimitHoursRemaining = signal(0);
  readonly loadingProgress = signal(0);

  @ViewChild('fileInput') private fileInputRef!: ElementRef<HTMLInputElement>;

  readonly maxSizeMb = MAX_SIZE_MB;

  readonly canSubmit = computed(() =>
    !!this.selectedFile() &&
    !this.fileError() &&
    !this.loading() &&
    !this.isRateLimited() &&
    this.authService.isEmailVerified()
  );

  readonly tips = [
    'Projectdoelen en doelgroep',
    'Belangrijkste functies en functionaliteit',
    'Gewenste technologie of platform (indien van toepassing)',
    'Gewenste tijdlijn of deadline',
    'Eventuele koppelingen (betalingen, CMS, API\'s)',
  ];

  constructor() {
    // Reactively redirect to /auth once auth state resolves and user is not signed in.
    // Using effect() avoids the race condition of ngOnInit firing before
    // Firebase onAuthStateChanged has resolved the user signal.
    effect(() => {
      if (!this.authService.loading() && !this.authService.isAuthenticated()) {
        this.router.navigate(['/auth']);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // Wait for auth to resolve before checking Firestore
    // Poll until loading is false (auth state resolved)
    await new Promise<void>(resolve => {
      const check = () => {
        if (!this.authService.loading()) { resolve(); return; }
        setTimeout(check, 50);
      };
      check();
    });

    const uid = this.authService.user()?.uid;
    if (!uid) return;

    try {
      const userRef = doc(this.firebase.firestore, 'users', uid);
      const userSnap = await getDoc(userRef);
      const lastQuoteAt = userSnap.data()?.['lastQuoteAt']?.toDate?.() as Date | undefined;

      if (lastQuoteAt) {
        const hoursSince = (Date.now() - lastQuoteAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          const hoursRemaining = Math.ceil(24 - hoursSince);
          this.isRateLimited.set(true);
          this.rateLimitHoursRemaining.set(hoursRemaining);
        }
      }
    } catch {
      // Silently ignore — rate limit check is best-effort; backend enforces it anyway
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.validateAndSetFile(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.validateAndSetFile(file);
  }

  removeFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile.set(null);
    this.fileError.set(null);
    // Reset the native input value so the same file can be re-selected after removal
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }

  private validateAndSetFile(file: File): void {
    this.fileError.set(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      this.fileError.set('Ongeldig bestandstype. Upload een PDF, Word-document (.docx) of tekstbestand.');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      this.fileError.set(`Bestand is te groot. Maximale bestandsgrootte is ${MAX_SIZE_MB}MB.`);
      return;
    }

    this.selectedFile.set(file);
  }

  async onSubmit(): Promise<void> {
    const file = this.selectedFile();
    if (!file || !this.canSubmit()) return;

    this.loading.set(true);
    this.loadingProgress.set(0);
    this.error.set(null);

    // Each step: [message, target progress %, delay before next step (ms)]
    const steps: [string, number, number][] = [
      ['Je brief uploaden...',           15, 2500],
      ['Je document lezen...',           32, 3000],
      ['Projectdetails extraheren...',   62, 8000],
      ['Je indicatie berekenen...',      82, 6000],
      ['Je offerte afronden...',         94, 0],   // stays here until response
    ];

    let stepIndex = 0;
    let progressTimer: ReturnType<typeof setTimeout> | null = null;

    const runStep = () => {
      if (stepIndex >= steps.length) return;
      const [msg, progress, delay] = steps[stepIndex];
      this.loadingMessage.set(msg);
      this.loadingProgress.set(progress);
      stepIndex++;
      if (delay > 0 && isPlatformBrowser(this.platformId)) {
        progressTimer = setTimeout(runStep, delay);
      }
    };

    if (isPlatformBrowser(this.platformId)) {
      runStep();
    }

    try {
      const quote = await this.quoteService.generateQuote(file);
      if (progressTimer) clearTimeout(progressTimer);
      // Snap to 100% briefly before navigating
      this.loadingProgress.set(100);
      this.loadingMessage.set('Klaar!');
      await new Promise(r => setTimeout(r, 300));
      // Navigate to result page with quote data in state
      await this.router.navigate(['/result', quote.quoteId], {
        state: { quote },
      });
    } catch (err: unknown) {
      if (progressTimer) clearTimeout(progressTimer);
      // Firebase callable errors have a `code` property like "functions/invalid-argument"
      // and a `message` property with the human-readable text from the server.
      const code = (err as { code?: string })?.code ?? '';
      const message = (err as { message?: string })?.message ?? '';

      if (code === 'functions/resource-exhausted' || message.includes('already submitted')) {
        this.isRateLimited.set(true);
        this.error.set('Je hebt vandaag al een offerte aangevraagd. Probeer het morgen opnieuw.');
      } else if (code === 'functions/failed-precondition') {
        this.error.set('Verifieer je e-mailadres voordat je een offerte aanvraagt.');
      } else if (code === 'functions/invalid-argument') {
        // Show the human-readable message from the server directly
        this.error.set(message);
      } else {
        this.error.set('Er is iets misgegaan. Probeer het opnieuw of neem direct contact op.');
      }
    } finally {
      this.loading.set(false);
      this.loadingProgress.set(0);
      this.loadingMessage.set('Je brief analyseren...');
    }
  }

  async resendVerification(): Promise<void> {
    await this.authService.resendVerificationEmail();
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate(['/']);
  }

  getFileIconName(mimeType: string): 'file' | 'file-text' {
    if (mimeType === 'application/pdf') return 'file';
    return 'file-text';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
