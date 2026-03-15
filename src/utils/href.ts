// Helper function to normalize href which can be a string or an object with language codes
// Returns the first available string value, or null if href is invalid
export function normalizeHref(href: string | { [lang: string]: string } | undefined): string | null {
  if (!href) {
    return null;
  }

  if (typeof href === 'string') {
    return href;
  }

  // If href is an object (e.g., {en: "...", fr: "..."}), return the first available value
  if (typeof href === 'object') {
    // Try common language codes first
    const preferredLangs = ['en', 'en-US', 'en-CA', 'fr', 'de', 'es'];
    for (const lang of preferredLangs) {
      if (href[lang]) {
        return href[lang];
      }
    }

    // If no preferred language found, return the first available value
    const values = Object.values(href);
    if (values.length > 0 && typeof values[0] === 'string') {
      return values[0];
    }
  }

  return null;
}
