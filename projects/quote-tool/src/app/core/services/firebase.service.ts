import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';
import { getFunctions, Functions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { environment } from '../../../environments/environment';

/**
 * No analytics on purpose: it set Google Analytics cookies on the first visit, before anyone had
 * chosen anything. The only browser storage left is what the tool needs: login and App Check.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private readonly platformId = inject(PLATFORM_ID);

  readonly app: FirebaseApp;
  readonly firestore: Firestore;
  readonly storage: FirebaseStorage;
  readonly auth: Auth;
  readonly functions: Functions;

  constructor() {
    this.app = getApps().length
      ? getApps()[0]
      : initializeApp(environment.firebase);

    this.firestore = getFirestore(this.app);
    this.storage = getStorage(this.app);
    this.auth = getAuth(this.app);
    this.functions = getFunctions(this.app, 'us-central1');

    if (isPlatformBrowser(this.platformId)) {
      // App Check with reCAPTCHA Enterprise — protects Cloud Function calls
      initializeAppCheck(this.app, {
        provider: new ReCaptchaEnterpriseProvider(
          '6LdDOfAsAAAAAJq32HmxRiO5cITlHFfKzxCvqWPm'
        ),
        isTokenAutoRefreshEnabled: true,
      });
    }
  }
}
