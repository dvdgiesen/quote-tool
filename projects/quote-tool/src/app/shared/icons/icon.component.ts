import {
  Component,
  input,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// =============================================================================
// ICON COMPONENT
// Renders consistent SVG icons across the quote tool.
//
// Two families:
//   • Tech brand icons  — SimpleIcons-style filled paths, each with its own
//     brand colour (muted slightly for the dark theme).
//   • UI line icons     — Lucide-style stroke icons, inherit currentColor.
//
// Usage:
//   <app-icon name="angular" />
//   <app-icon name="arrow-right" />
//   <app-icon name="check-circle" [size]="48" />
// =============================================================================

export type IconName =
  // ── Tech brand icons ──────────────────────────────────────────────────────
  | 'angular'
  | 'typescript'
  | 'firebase'
  | 'nodejs'
  | 'sass'
  | 'graphql'
  | 'github'
  | 'linkedin'
  | 'rxjs'
  | 'gsap'
  | 'mysql'
  | 'vitest'
  // ── UI line icons ─────────────────────────────────────────────────────────
  | 'arrow-right'
  | 'external-link'
  | 'check-circle'
  | 'lightbulb'
  | 'check'
  | 'code'
  | 'server'
  | 'database'
  | 'cloud'
  | 'cpu'
  | 'link'
  | 'euro'
  | 'list'
  | 'clock'
  | 'mail'
  | 'eye'
  | 'message-circle'
  | 'upload'
  | 'file'
  | 'file-text'
  | 'alert-triangle'
  | 'user'
  | 'x';

interface IconDef {
  viewBox?: string;
  markup: string;
  /** Brand fill colour. Absent = line icon (stroke-based, uses currentColor). */
  color?: string;
}

const ICONS: Record<IconName, IconDef> = {

  // ── Tech brand icons (SimpleIcons paths, fill-based) ─────────────────────

  angular: {
    color: '#dd0031',
    markup: `<path d="M16.712 17.711H7.288l-1.204 2.916L12 24l5.916-3.373-1.204-2.916ZM14.692 0l7.832 16.855.814-12.856L14.692 0ZM9.308 0 .662 3.999l.814 12.856L9.308 0Zm-.405 13.93h6.198L12 6.396 8.903 13.93Z"/>`,
  },

  typescript: {
    color: '#3178c6',
    markup: `<path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/>`,
  },

  firebase: {
    color: '#ffca28',
    markup: `<path d="M3.89 15.672L6.255.461A.542.542 0 0 1 7.27.288l2.543 4.771zm16.794 3.692l-2.25-14a.54.54 0 0 0-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 0 0 1.588 0zM14.3 7.147l-1.82-3.482a.542.542 0 0 0-.96 0L3.53 17.984z"/>`,
  },

  nodejs: {
    color: '#339933',
    markup: `<path d="M11.998 24a.845.845 0 0 1-.423-.113L8.042 21.73c-.632-.354-.323-.479-.115-.552.808-.28.972-.344 1.836-.833a.104.104 0 0 1 .1.007l2.7 1.604c.098.054.237.054.328 0l10.532-6.08c.098-.057.162-.17.162-.288V8.394c0-.12-.064-.233-.164-.295L12.91 2.026a.327.327 0 0 0-.327 0L2.051 8.1c-.1.06-.166.178-.166.296v12.163c0 .12.065.232.163.288l2.886 1.666c1.566.783 2.527-.14 2.527-1.073V9.405c0-.17.136-.31.306-.31h1.336c.168 0 .306.14.306.31v11.835c0 2.098-1.143 3.303-3.132 3.303-.612 0-1.094 0-2.44-.663L1.24 22.163A1.68 1.68 0 0 1 .41 20.7V8.536a1.68 1.68 0 0 1 .83-1.463L11.573.453a1.75 1.75 0 0 1 1.75 0l10.332 6.62a1.68 1.68 0 0 1 .83 1.463V20.7a1.68 1.68 0 0 1-.83 1.463l-10.332 6.62a.845.845 0 0 1-.425.113z"/>`,
  },

  sass: {
    color: '#cc6699',
    markup: `<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.144 19.166c-1.74.085-3.154-.876-3.232-2.185-.078-1.31 1.21-2.48 2.95-2.565.19-.01.38-.007.566.007-.23-.3-.437-.62-.617-.96-.9 1.24-2.04 1.97-3.07 1.97-1.27 0-1.95-.96-1.95-2.14 0-2.14 1.73-4.27 4.27-4.27.47 0 .9.08 1.28.22.38-1.04.57-2.04.57-2.04h1.27s-.2.97-.57 2.04c.38.14.72.34 1.01.59.29-.65.65-1.27 1.08-1.82l1.14.57c-.5.6-.9 1.27-1.2 1.98.3.44.5.94.6 1.47.1.53.1 1.07 0 1.6-.1.53-.3 1.04-.6 1.5-.3.46-.7.86-1.16 1.17-.46.31-.98.5-1.52.56z"/>`,
  },

  graphql: {
    color: '#e10098',
    markup: `<path d="M12 2.004a.998.998 0 0 0-.496.132L3.856 6.496a1 1 0 0 0-.504.868v8.272a1 1 0 0 0 .504.868l7.648 4.36a1 1 0 0 0 .992 0l7.648-4.36a1 1 0 0 0 .504-.868V7.364a1 1 0 0 0-.504-.868l-7.648-4.36A.998.998 0 0 0 12 2.004zm0 1.996 6.5 3.707v7.414L12 18.828l-6.5-3.707V7.707L12 4zm-1 3v2H9v2h2v2h2v-2h2V9h-2V7h-2z"/>`,
  },

  github: {
    color: '#f0f6fc',
    markup: `<path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>`,
  },

  linkedin: {
    color: '#0a66c2',
    markup: `<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>`,
  },

  rxjs: {
    color: '#b7178c',
    markup: `<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4c5.302 0 9.6 4.298 9.6 9.6s-4.298 9.6-9.6 9.6S2.4 17.302 2.4 12 6.698 2.4 12 2.4zm0 1.6a8 8 0 1 0 0 16A8 8 0 0 0 12 4zm-1 3h2v5.586l3.707 3.707-1.414 1.414L11 13.414V7z"/>`,
  },

  gsap: {
    color: '#88ce02',
    markup: `<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 8.5h-3v7h-1v-7h-3v-1h7v1zm-9.5 7l-2-8h1.1l1.4 6.1 1.4-6.1h1.1l-2 8z"/>`,
  },

  mysql: {
    color: '#4479a1',
    markup: `<path d="M12 3C7.46 3 3 4.86 3 8v8c0 3.14 4.46 5 9 5s9-1.86 9-5V8c0-3.14-4.46-5-9-5zm0 2c4.07 0 7 1.58 7 3s-2.93 3-7 3-7-1.58-7-3 2.93-3 7-3zm7 11c0 1.42-2.93 3-7 3s-7-1.58-7-3v-2.23C6.61 15.5 9.2 16 12 16s5.39-.5 7-1.23V14zm0-4c0 1.42-2.93 3-7 3s-7-1.58-7-3v-2.23C6.61 11.5 9.2 12 12 12s5.39-.5 7-1.23V10z"/>`,
  },

  vitest: {
    color: '#6e9f18',
    markup: `<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>`,
  },

  // ── UI line icons (Lucide-style, stroke-based) ────────────────────────────

  'arrow-right': {
    markup: `<line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="12 5 19 12 12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  'external-link': {
    markup: `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="15 3 21 3 21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  'check-circle': {
    markup: `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  lightbulb: {
    markup: `<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 22h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  check: {
    markup: `<polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  code: {
    markup: `<polyline points="16 18 22 12 16 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8 6 2 12 8 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  server: {
    markup: `<rect x="2" y="2" width="20" height="8" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="6" x2="6.01" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="18" x2="6.01" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  database: {
    markup: `<ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  cloud: {
    markup: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  cpu: {
    markup: `<rect x="4" y="4" width="16" height="16" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="9" y="9" width="6" height="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="1" x2="9" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="15" y1="1" x2="15" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="20" x2="9" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="15" y1="20" x2="15" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="20" y1="9" x2="23" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="20" y1="14" x2="23" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="9" x2="4" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="14" x2="4" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  link: {
    markup: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  euro: {
    markup: `<path d="M4 10h12M4 14h12M15 5a7 7 0 1 0 0 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  list: {
    markup: `<line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="3" y1="6" x2="3.01" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  clock: {
    markup: `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  mail: {
    markup: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22 6 12 13 2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  eye: {
    markup: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  'message-circle': {
    markup: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  upload: {
    markup: `<polyline points="16 16 12 12 8 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="12" x2="12" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  file: {
    markup: `<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13 2 13 9 20 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  'file-text': {
    markup: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="10 9 9 9 8 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  'alert-triangle': {
    markup: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  user: {
    markup: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  x: {
    markup: `<line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
};

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [innerHTML]="svgHtml()"></span>`,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  `],
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly size = input<number>(24);

  readonly svgHtml = computed<SafeHtml>(() => {
    const def = ICONS[this.name()] ?? ICONS['code'];
    const w = this.size();
    const viewBox = def.viewBox ?? '0 0 24 24';
    const fill = def.color ?? 'none';
    const opacity = def.color ? ' style="opacity:0.85"' : '';

    const svg = `<svg width="${w}" height="${w}" viewBox="${viewBox}" fill="${fill}" aria-hidden="true"${opacity}>${def.markup}</svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  });
}
