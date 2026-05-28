import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User,
  AuthError,
} from 'firebase/auth';
import { FirebaseService } from './firebase.service';

export type AuthMode = 'sign-in' | 'sign-up';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebase = inject(FirebaseService);
  private readonly platformId = inject(PLATFORM_ID);

  // Reactive state
  readonly user = signal<User | null>(null);
  readonly loading = signal(true);

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isEmailVerified = computed(() => this.user()?.emailVerified ?? false);
  readonly displayName = computed(() => this.user()?.displayName ?? this.user()?.email?.split('@')[0] ?? '');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      onAuthStateChanged(this.firebase.auth, (user) => {
        this.user.set(user);
        this.loading.set(false);
      });
    } else {
      this.loading.set(false);
    }
  }

  /**
   * Sign in with Google popup.
   */
  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(this.firebase.auth, provider);
  }

  /**
   * Sign in with email and password.
   */
  async signInWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.firebase.auth, email, password);
  }

  /**
   * Create a new account with email and password, then send verification email.
   * ActionCodeSettings.url is the "Continue" destination after Firebase verifies
   * the email — brings the user back to the login page on our own domain.
   */
  async signUpWithEmail(email: string, password: string): Promise<void> {
    const credential = await createUserWithEmailAndPassword(
      this.firebase.auth,
      email,
      password
    );
    await sendEmailVerification(credential.user, {
      url: 'https://quote.watsturen.nl/auth',
      handleCodeInApp: false,
    });
  }

  /**
   * Resend email verification to the current user.
   */
  async resendVerificationEmail(): Promise<void> {
    const user = this.firebase.auth.currentUser;
    if (user && !user.emailVerified) {
      await sendEmailVerification(user, {
        url: 'https://quote.watsturen.nl/auth',
        handleCodeInApp: false,
      });
    }
  }

  /**
   * Reload the current user to pick up email verification status changes.
   */
  async reloadUser(): Promise<void> {
    const user = this.firebase.auth.currentUser;
    if (user) {
      await user.reload();
      this.user.set(this.firebase.auth.currentUser);
    }
  }

  /**
   * Sign out the current user.
   */
  async signOut(): Promise<void> {
    await signOut(this.firebase.auth);
    this.user.set(null);
  }

  /**
   * Returns a human-readable error message from a Firebase AuthError.
   */
  getErrorMessage(error: unknown): string {
    const code = (error as AuthError)?.code;
    const messages: Record<string, string> = {
      'auth/user-not-found':       'Geen account gevonden met dit e-mailadres.',
      'auth/wrong-password':       'Onjuist wachtwoord. Probeer het opnieuw.',
      'auth/invalid-credential':   'Ongeldig e-mailadres of wachtwoord.',
      'auth/email-already-in-use': 'Er bestaat al een account met dit e-mailadres.',
      'auth/weak-password':        'Wachtwoord moet minimaal 6 tekens bevatten.',
      'auth/invalid-email':        'Voer een geldig e-mailadres in.',
      'auth/too-many-requests':    'Te veel pogingen. Probeer het later opnieuw.',
      'auth/popup-closed-by-user': 'Inloggen geannuleerd.',
      'auth/network-request-failed': 'Netwerkfout. Controleer je internetverbinding.',
    };
    return messages[code] ?? 'Er is iets misgegaan. Probeer het opnieuw.';
  }
}
