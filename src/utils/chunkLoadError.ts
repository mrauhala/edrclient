// A lazy-loaded chunk that failed to load. After a deploy, a page loaded earlier asks for chunk files
// that no longer exist; retrying can't help (React caches the failed import), reloading gets the new
// build. Messages: Chrome, Firefox, Safari, and Vite's CSS preload.
const CHUNK_LOAD_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_ERROR.test(error.message);
}
