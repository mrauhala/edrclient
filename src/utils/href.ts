// Validate that a URL uses a safe protocol (http/https or relative)
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  // Relative URLs are safe
  if (trimmed.startsWith('/') || trimmed.startsWith('.') || !trimmed.includes(':')) {
    return true;
  }
  // Only allow http and https protocols
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // If URL parsing fails, it's likely a relative URL
    return true;
  }
}

// Helper function to normalize href which can be a string or an object with language codes
// Returns the first available string value, or null if href is invalid or uses an unsafe protocol
export function normalizeHref(href: string | { [lang: string]: string } | undefined): string | null {
  if (!href) {
    return null;
  }

  if (typeof href === 'string') {
    return isSafeUrl(href) ? href : null;
  }

  // If href is an object (e.g., {en: "...", fr: "..."}), return the first available value
  if (typeof href === 'object') {
    // Try common language codes first
    const preferredLangs = ['en', 'en-US', 'en-CA', 'fr', 'de', 'es'];
    for (const lang of preferredLangs) {
      if (href[lang] && isSafeUrl(href[lang])) {
        return href[lang];
      }
    }

    // If no preferred language found, return the first available safe value
    const values = Object.values(href);
    if (values.length > 0 && typeof values[0] === 'string' && isSafeUrl(values[0])) {
      return values[0];
    }
  }

  return null;
}
