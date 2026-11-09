import {
  ApplicationConfig,
  PLATFORM_ID,
  inject,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  NavigationError,
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withNavigationErrorHandler,
  withPreloading,
} from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withNoIncrementalHydration,
} from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { isChunkLoadError, shouldReloadFor } from './core/chunk-error';
import { AuthService } from './core/services/auth.service';

/**
 * After a deploy, the lazy chunk of a page the visitor has not opened yet no longer exists, so the
 * navigation fails silently (see core/chunk-error.ts). Do a full page load of the requested URL:
 * that fetches the new index.html with file names that exist. Other navigation errors are only logged.
 */
function handleNavigationError(error: NavigationError): void {
  const platformId = inject(PLATFORM_ID);
  const document = inject(DOCUMENT);
  console.error('Navigation failed:', error.error);

  if (!isPlatformBrowser(platformId) || !isChunkLoadError(error.error)) return;

  const win = document.defaultView;
  if (win && shouldReloadFor(error.url, () => win.sessionStorage)) {
    win.location.assign(error.url);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Start reading the persisted Firebase Auth session from IndexedDB immediately on app boot,
    // in parallel with loading the initial route chunk, instead of waiting for AuthComponent to mount.
    provideEnvironmentInitializer(() => {
      inject(AuthService);
    }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(PreloadAllModules),
      withNavigationErrorHandler(handleNavigationError),
    ),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    provideHttpClient(withFetch()),
  ],
};
