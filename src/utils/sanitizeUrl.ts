// Redact sensitive query parameters from URLs before logging
const SENSITIVE_PARAMS = ['api-key', 'apikey', 'key', 'token', 'password', 'secret', 'api_key'];

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of SENSITIVE_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    // Not a valid absolute URL — check for query string in relative URLs
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return url;

    const base = url.slice(0, qIndex);
    const query = url.slice(qIndex + 1);
    const redacted = query.replace(
      new RegExp(`((?:${SENSITIVE_PARAMS.join('|')})=)[^&]*`, 'gi'),
      '$1[REDACTED]'
    );
    return `${base}?${redacted}`;
  }
}
