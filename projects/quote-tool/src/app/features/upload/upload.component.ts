import {
  Component, ChangeDetectionStrategy, inject, signal, computed, effect, OnInit, PLATFORM_ID,
  ViewChild, ElementRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { doc, getDoc } from 'firebase/firestore';
import { AuthService } from '../../core/services/auth.service';
import { QuoteService } from '../../core/services/quote.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { LogoLinkComponent } from '../../shared/logo/logo-link.component';
import { PRIVACY_URL } from '../../shared/links';
import {
  MAX_TYPED_TEXT_CHARS, MIN_BRIEF_WORDS, TEXTAREA_HARD_MAX_LENGTH, checkBriefText,
} from './brief-text';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
/** The typed text survives a reload or an expired session; it is gone when the tab is closed. */
const DRAFT_KEY = 'quote-tool:draft-text';

type InputMode = 'text' | 'file';

@Component({
  selector: 'app-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LogoLinkComponent, ReactiveFormsModule],
  template: `
    <main class="upload">
      <div class="container container--xs">

        <!-- Logo -->
        <app-logo-link />

        <!-- Header -->
        <div class="upload__header">
          <span class="section-label">Stap 2 van 2</span>
          <h1>Vertel over je project</h1>
          <p>
            Typ of plak een beschrijving van je project, of upload een PDF, Word-document of tekstbestand.
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

          <!-- Choice: type text or upload a file -->
          <fieldset class="upload__mode">
            <legend class="sr-only">Hoe wil je je project doorgeven?</legend>
            <div class="upload__mode-options">
              @for (option of modeOptions; track option.value) {
                <label class="upload__mode-option" [class.upload__mode-option--active]="mode() === option.value">
                  <input
                    type="radio"
                    class="sr-only"
                    name="inputMode"
                    [value]="option.value"
                    [checked]="mode() === option.value"
                    [disabled]="loading()"
                    (change)="setMode(option.value)"
                  />
                  <span class="upload__mode-icon" aria-hidden="true"><app-icon [name]="option.icon" [size]="18" /></span>
                  <span>{{ option.label }}</span>
                </label>
              }
            </div>
          </fieldset>

          @if (mode() === 'file') {
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
                  aria-label="Bestand verwijderen"
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
          } @else {
          <!-- Typed or pasted text -->
          <div class="form-field upload__text-field">
            <label class="form-label" for="briefText">Beschrijf je project</label>
            <p class="upload__text-hint" id="briefTextHint">
              Schrijf in gewone woorden wat je wilt laten maken, voor wie het is en wat het moet kunnen.
              Minimaal {{ minWords }} woorden.
            </p>
            <textarea
              id="briefText"
              class="form-input upload__textarea"
              [class.form-input--error]="!!textError()"
              [formControl]="textControl"
              [readOnly]="loading()"
              [attr.maxlength]="textareaHardMax"
              [attr.aria-invalid]="textError() ? 'true' : null"
              aria-describedby="briefTextHint briefTextCount briefTextError"
              rows="10"
              lang="nl"
              spellcheck="true"
              autocapitalize="sentences"
              placeholder="Bijvoorbeeld: ik heb een bloemenwinkel en wil een website waar klanten boeketten kunnen bestellen en betalen. Ik wil zelf de prijzen kunnen aanpassen. Het moet er fris uitzien op de telefoon en over twee maanden klaar zijn."
              (blur)="onTextBlur()"
            ></textarea>
            <p class="upload__text-count" id="briefTextCount" [class.upload__text-count--over]="textCheck().problem === 'too-long'">
              {{ textCheck().chars }} / {{ maxTextChars }} tekens
              @if (wordsToGo() > 0) {
                &middot; nog {{ wordsToGo() }} {{ wordsToGo() === 1 ? 'woord' : 'woorden' }} nodig
              }
            </p>
            <!-- Announces only when the state changes (not on every key press) -->
            <p class="sr-only" aria-live="polite">{{ textStatus() }}</p>
            @if (textError()) {
              <p class="form-error" id="briefTextError">{{ textError() }}</p>
            }
          </div>
          }

          <!-- Submit button — becomes a progress bar while loading -->
          <button
            class="btn btn--primary btn--full upload__submit"
            [class.upload__submit--loading]="loading()"
            (click)="onSubmit()"
            [disabled]="!canSubmit()"
            [style.--progress]="loadingProgress() + '%'"
            [attr.aria-busy]="loading()"
            type="button"
          >
            <!-- Fill layer (progress bar background) -->
            @if (loading()) {
              <span class="upload__submit-fill" aria-hidden="true"></span>
            }
            <!-- Button label -->
            <span class="upload__submit-label">
              @if (loading()) {
                <span class="upload__submit-spinner" aria-hidden="true"></span>
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

        <!-- One place for the privacy statement: below the card, outside it -->
        <p class="upload__privacy">
          <a [href]="privacyUrl" target="_blank" rel="noopener noreferrer">Privacy: wat we bewaren en hoe lang</a>
        </p>

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
        background: var(--color-warning-soft);
        border: 1px solid var(--color-warning-border);
        color: var(--color-warning);
        p { color: var(--color-text-muted); }
      }

      &--error {
        background: var(--color-error-soft);
        border: 1px solid var(--color-error-border);
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

    /* Choice between typing and uploading: two native radio buttons styled as one segmented control */
    .upload__mode {
      border: 0;
      padding: 0;
      margin: 0 0 var(--space-6);
      min-width: 0;
    }

    .upload__mode-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-1);
      padding: var(--space-1);
      background: var(--color-surface-2);
      border-radius: var(--radius-lg);
    }

    .upload__mode-option {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      min-height: 44px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-muted);
      text-align: center;
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover { color: var(--color-text); }

      &--active {
        background: var(--color-surface);
        color: var(--color-primary);
        box-shadow: 0 1px 3px var(--color-border);
      }

      /* Keyboard focus lands on the visually hidden radio: show it on the label */
      &:has(input:focus-visible) {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      &:has(input:disabled) {
        cursor: not-allowed;
        opacity: 0.6;
      }
    }

    .upload__mode-icon {
      display: inline-flex;
      flex-shrink: 0;
    }

    .upload__text-field {
      margin-bottom: var(--space-6);
    }

    .upload__text-hint,
    .upload__text-count {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
      max-width: none;
    }

    .upload__text-count {
      color: var(--color-text-subtle);

      &--over { color: var(--color-error); font-weight: var(--font-semibold); }
    }

    /* 16px minimum: smaller text makes iOS zoom in when the field gets focus */
    .upload__textarea {
      min-height: 14rem;
      font-size: max(1rem, var(--text-base));
      line-height: 1.55;
      resize: vertical;
      font-family: inherit;
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
        background: var(--color-primary-faint);
      }

      &--has-file {
        border-style: solid;
        border-color: var(--color-primary);
        background: var(--color-primary-faint);
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
      background: var(--color-on-primary-soft);
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

    /* While loading the button is disabled, which normally dims it to 50% opacity.
       Keep it fully opaque so the spinner, message and progress fill stay clearly visible.
       Selector specificity is intentionally higher than the global .btn:disabled. */
    .upload__submit.upload__submit--loading:disabled {
      opacity: 1;
      cursor: progress;
    }

    /* Black spinner on a light disc: high contrast against the teal button */
    .upload__submit-spinner {
      display: inline-block;
      flex-shrink: 0;
      box-sizing: border-box;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--color-on-primary);
      border: 3px solid var(--color-on-primary);
      border-top-color: var(--palette-ink);
      border-right-color: var(--palette-ink);
      animation: upload-spin 0.8s linear infinite;
    }

    @keyframes upload-spin {
      to { transform: rotate(360deg); }
    }

    /* The global reduced-motion rule freezes animations; a spinner must keep turning
       (slowly) or it no longer signals that something is happening. */
    @media (prefers-reduced-motion: reduce) {
      .upload__submit-spinner {
        animation-duration: 2s !important;
        animation-iteration-count: infinite !important;
      }
    }

    /* Subtle shimmer on the fill while loading */
    .upload__submit--loading .upload__submit-fill::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-on-primary-faint) 50%,
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

    .upload__privacy {
      margin: var(--space-4) 0 0;
      text-align: center;
      font-size: var(--text-sm);
      max-width: none;

      a { color: var(--color-text-subtle); text-decoration: underline; }
      a:hover { color: var(--color-primary); }
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

  /** Text is the default: most visitors would rather type than make a document first. */
  readonly mode = signal<InputMode>('text');
  readonly modeOptions: { value: InputMode; label: string; icon: 'file-text' | 'upload' }[] = [
    { value: 'text', label: 'Tekst typen', icon: 'file-text' },
    { value: 'file', label: 'Bestand uploaden', icon: 'upload' },
  ];

  private readonly initialDraft = this.readDraft();
  readonly textControl = new FormControl<string>(this.initialDraft, { nonNullable: true });
  private readonly textValue = toSignal(this.textControl.valueChanges, { initialValue: this.initialDraft });
  /** Errors for the text field appear after leaving the field or trying to submit, not while typing. */
  private readonly textTouched = signal(false);

  readonly textCheck = computed(() => checkBriefText(this.textValue()));
  readonly wordsToGo = computed(() => Math.max(0, MIN_BRIEF_WORDS - this.textCheck().words));
  readonly textError = computed<string | null>(() => {
    const { problem, message } = this.textCheck();
    if (!problem || !message) return null;
    if (problem === 'too-long') return message;
    return this.textTouched() ? message : null;
  });
  /** Spoken by screen readers. A constant text per state, so it is not repeated on every key press. */
  readonly textStatus = computed(() => {
    const { problem, chars, words } = this.textCheck();
    if (problem === 'too-long') return 'Je tekst is te lang.';
    if (chars >= MAX_TYPED_TEXT_CHARS * 0.8) return 'Je tekst is bijna op de maximale lengte.';
    if (!problem && words >= MIN_BRIEF_WORDS) return 'Je tekst is lang genoeg.';
    return '';
  });

  /** Opens in a new tab, so the typed text stays on this page. */
  readonly privacyUrl = PRIVACY_URL;
  readonly maxTextChars = MAX_TYPED_TEXT_CHARS;
  readonly minWords = MIN_BRIEF_WORDS;
  readonly textareaHardMax = TEXTAREA_HARD_MAX_LENGTH;

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
    (this.mode() === 'file'
      ? !!this.selectedFile() && !this.fileError()
      : this.textCheck().problem === undefined) &&
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

    // Keep the typed text for this browser tab, so a reload or an expired session does not lose it
    effect(() => this.saveDraft(this.textValue()));
  }

  setMode(mode: InputMode): void {
    if (!this.loading()) this.mode.set(mode);
  }

  onTextBlur(): void {
    this.textTouched.set(true);
  }

  private readDraft(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    try {
      return sessionStorage.getItem(DRAFT_KEY) ?? '';
    } catch {
      return ''; // storage blocked (private mode, policy): just no draft
    }
  }

  private saveDraft(text: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (text) sessionStorage.setItem(DRAFT_KEY, text);
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore: the draft is a convenience
    }
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
    const mode = this.mode();
    const file = this.selectedFile();
    if (mode === 'text') this.textTouched.set(true);
    if (!this.canSubmit() || (mode === 'file' && !file)) return;
    // The text is sent exactly as it is counted: cleaned the same way the server does it
    const text = this.textCheck().text;

    this.loading.set(true);
    this.loadingProgress.set(0);
    this.error.set(null);

    // Each step: [message, target progress %, delay before next step (ms)]
    const steps: [string, number, number][] = [
      mode === 'text'
        ? ['Je tekst controleren...',    15, 2500]
        : ['Je brief uploaden...',        15, 2500],
      mode === 'text'
        ? ['Je beschrijving lezen...',   32, 3000]
        : ['Je document lezen...',        32, 3000],
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
      const quote = mode === 'text'
        ? await this.quoteService.generateQuoteFromText(text)
        : await this.quoteService.generateQuote(file!);
      if (mode === 'text') this.textControl.setValue(''); // the draft is no longer needed
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
        // Only the daily limit blocks the form; "too many attempts" shows the server message as it is
        if (message.includes('vandaag al een offerte')) this.isRateLimited.set(true);
        this.error.set(message || 'Je hebt vandaag al een offerte aangevraagd. Probeer het morgen opnieuw.');
      } else if (code === 'functions/aborted') {
        // Another request of this user is still running (double click, second tab)
        this.error.set(message || 'Er wordt al een offerte voor je gemaakt. Kijk ook in je mailbox.');
      } else if (code === 'functions/failed-precondition') {
        this.error.set('Verifieer je e-mailadres voordat je een offerte aanvraagt.');
      } else if (code === 'functions/unauthenticated') {
        this.error.set('Je sessie is verlopen. Log opnieuw in; je tekst blijft bewaard.');
      } else if (code === 'functions/deadline-exceeded') {
        this.error.set('Dit duurt langer dan verwacht. Kijk eerst in je mailbox: je offerte kan al onderweg zijn. Probeer het anders over een paar minuten opnieuw.');
      } else if (code === 'functions/unavailable') {
        // Gemini is busy or unavailable: not the user's fault, and it does not count as an attempt
        this.error.set(message || 'De offertetool is tijdelijk niet beschikbaar. Probeer het over een paar minuten opnieuw.');
      } else if (code === 'functions/invalid-argument' || code === 'functions/permission-denied') {
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
