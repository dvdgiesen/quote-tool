/**
 * Recovery from a deploy that happened while a visitor had the site open.
 *
 * Every build gives its JavaScript files new names (main-ZZDHAUIT.js, chunk-Bo1eMKyl.js) and the old files
 * are gone after a deploy. Each page is a lazy chunk, only fetched on the first click to that page. A
 * visitor with an old tab open then clicks a link, the fetch gets a 404 and the router fails with a
 * NavigationError: the click does nothing until the page is reloaded. The fix is to do that reload for
 * them, to the page they asked for. A fresh index.html points at files that exist.
 */

/**
 * Messages of a failed dynamic `import()`, per browser:
 * - Chrome, Edge: "Failed to fetch dynamically imported module: https://.../chunk-X.js"
 * - Firefox: "error loading dynamically imported module: https://.../chunk-X.js"
 * - Safari: "Importing a module script failed."
 * - Webpack-style loaders: "Loading chunk 12 failed." / ChunkLoadError
 */
const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|ChunkLoadError/i;

export function isChunkLoadError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  return CHUNK_ERROR_PATTERN.test(message);
}

/** Session key that remembers the last recovery reload (`<url>|<time in ms>`), so a failure cannot loop. */
export const RELOAD_GUARD_KEY = 'watsturen:chunk-reload';

/** A second failure for the same URL within this time means the reload did not help. */
export const RELOAD_GUARD_MS = 30_000;

/**
 * Whether to reload for `url` now. Refuses when we already reloaded for the same URL a moment ago: the
 * reload did not fix it (the server is down, or the chunk is really missing), so the second failure is
 * left to the router instead of looping. After the window, a new deploy can be recovered from again in the
 * same tab. Takes a storage getter so it can be tested, and so a browser that blocks storage (reading
 * `sessionStorage` then throws) just does not reload.
 */
export function shouldReloadFor(
  url: string,
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'>,
  now: number = Date.now(),
): boolean {
  try {
    const storage = getStorage();
    const last = storage.getItem(RELOAD_GUARD_KEY) ?? '';
    const separator = last.lastIndexOf('|');
    const lastUrl = last.slice(0, separator);
    const lastTime = Number(last.slice(separator + 1));
    if (separator > -1 && lastUrl === url && now - lastTime < RELOAD_GUARD_MS) return false;
    storage.setItem(RELOAD_GUARD_KEY, `${url}|${now}`);
    return true;
  } catch {
    return false;
  }
}
