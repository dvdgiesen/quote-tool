/**
 * Brand colours for server-generated HTML (emails + offer document).
 *
 * CSS custom properties from the Angular apps are not available here, so the
 * palette lives in this file. Keep in sync with the `--palette-*` values in
 * projects/{portfolio,quote-tool}/src/styles/_tokens.scss and with
 * brand/generate-svgs.js. Palette: "Yacht club".
 */
export const BRAND = {
  // Palette
  cream: '#f2f0ef',
  gray: '#bbbdbc',
  teal: '#245f73',
  mahogany: '#733e24',
  ink: '#1b2a31',

  // Derived (matches the color-mix() tokens in _tokens.scss, pre-computed
  // because email clients do not support color-mix)
  surface: '#faf9f8',
  surface2: '#e8e6e4',
  tealDeep: '#1b4a5a',
  tealSoft: '#e4e8e7',
  muted: '#3f4f56',
  subtle: '#566268',
  onPrimary: '#faf9f8',
  border: '#d5d5d4',

  // Semantic
  success: '#2b7a57',
  warning: '#8f5a0a',
  error: '#b3342b',
} as const;
