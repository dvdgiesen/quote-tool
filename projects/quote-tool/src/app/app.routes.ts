import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
  {
    path: 'landing',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
    title: 'Instant Quote Tool — watsturen.nl',
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/auth.component').then(m => m.AuthComponent),
    title: 'Sign in — Quote Tool',
  },
  {
    path: 'upload',
    loadComponent: () =>
      import('./features/upload/upload.component').then(m => m.UploadComponent),
    canActivate: [authGuard],
    title: 'Upload your brief — Quote Tool',
  },
  {
    path: 'result/:id',
    loadComponent: () =>
      import('./features/result/result.component').then(m => m.ResultComponent),
    canActivate: [authGuard],
    title: 'Your estimate — Quote Tool',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
