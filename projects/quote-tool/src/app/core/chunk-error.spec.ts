import {
  isChunkLoadError,
  RELOAD_GUARD_KEY,
  RELOAD_GUARD_MS,
  shouldReloadFor,
} from './chunk-error';

describe('isChunkLoadError', () => {
  it('recognises a failed dynamic import in Chrome, Firefox and Safari', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://quote.watsturen.nl/chunk-Bo1eMKyl.js',
      'error loading dynamically imported module: https://quote.watsturen.nl/chunk-Bo1eMKyl.js',
      'Importing a module script failed.',
      'Loading chunk 12 failed.',
    ]) {
      expect(isChunkLoadError(new TypeError(message)), message).toBe(true);
    }
  });

  it('recognises a ChunkLoadError by name and a plain string', () => {
    const error = new Error('boom');
    error.name = 'ChunkLoadError';
    expect(isChunkLoadError(error)).toBe(true);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isChunkLoadError(new Error('Cannot match any routes. URL Segment: foo'))).toBe(false);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(isChunkLoadError({ message: 'Failed to fetch dynamically imported module' })).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('shouldReloadFor', () => {
  function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> & { values: Map<string, string> } {
    const values = new Map<string, string>();
    return {
      values,
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    };
  }

  it('reloads the first time for a URL and remembers it', () => {
    const storage = memoryStorage();
    expect(shouldReloadFor('/upload', () => storage, 1000)).toBe(true);
    expect(storage.values.get(RELOAD_GUARD_KEY)).toBe('/upload|1000');
  });

  it('does not reload twice for the same URL in a row (no reload loop)', () => {
    const storage = memoryStorage();
    expect(shouldReloadFor('/upload', () => storage, 1000)).toBe(true);
    expect(shouldReloadFor('/upload', () => storage, 1000 + RELOAD_GUARD_MS - 1)).toBe(false);
  });

  it('reloads again for the same URL once the window has passed (a later deploy)', () => {
    const storage = memoryStorage();
    expect(shouldReloadFor('/upload', () => storage, 1000)).toBe(true);
    expect(shouldReloadFor('/upload', () => storage, 1000 + RELOAD_GUARD_MS)).toBe(true);
  });

  it('reloads again for a different URL', () => {
    const storage = memoryStorage();
    expect(shouldReloadFor('/upload', () => storage, 1000)).toBe(true);
    expect(shouldReloadFor('/auth', () => storage, 1001)).toBe(true);
  });

  it('copes with a | in the URL', () => {
    const storage = memoryStorage();
    expect(shouldReloadFor('/auth/actie?q=a|b', () => storage, 1000)).toBe(true);
    expect(shouldReloadFor('/auth/actie?q=a|b', () => storage, 1001)).toBe(false);
  });

  it('does not reload when the storage is not available', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    expect(shouldReloadFor('/upload', blocked)).toBe(false);
  });
});
