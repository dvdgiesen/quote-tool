import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Protects routes that require authentication.
 * Waits for Firebase auth state to resolve before deciding,
 * then redirects to /auth if the user is not signed in.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for Firebase onAuthStateChanged to resolve (loading → false)
  // before making an auth decision. Without this, the guard fires while
  // user is still null (initial signal value) and always redirects to /auth.
  return toObservable(auth.loading).pipe(
    filter(loading => !loading),
    take(1),
    map(() => auth.isAuthenticated() ? true : router.createUrlTree(['/auth'])),
  );
};
