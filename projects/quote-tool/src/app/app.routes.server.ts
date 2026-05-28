import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Landing page — can be prerendered (no auth required, no dynamic data)
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    // Auth page — can be prerendered (static form UI)
    path: 'auth',
    renderMode: RenderMode.Prerender,
  },
  {
    // Upload page — auth-guarded, must be server-rendered on demand
    path: 'upload',
    renderMode: RenderMode.Server,
  },
  {
    // Result page — auth-guarded + dynamic quote ID, must be server-rendered on demand
    path: 'result/:id',
    renderMode: RenderMode.Server,
  },
  {
    // Catch-all — redirects to landing (defined in app.routes.ts)
    path: '**',
    renderMode: RenderMode.Server,
  },
];
