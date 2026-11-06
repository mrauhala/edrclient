// Fields that carry what went wrong: `detail` of FastAPI and RFC 7807 problem documents, the
// `description` of OGC API exceptions, `message` of Spring and many others; `title` and `error` name
// the status more often than they explain it, so they come last
const DETAIL_KEYS = ['detail', 'description', 'message', 'title', 'error'];
const MAX_LENGTH = 300;

const clip = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_LENGTH ? `${flat.slice(0, MAX_LENGTH)}…` : flat;
};

// What the server says went wrong, from an error response's body (bytes, text or parsed JSON):
// Meteogate answers a position off its stations with 404 {"detail":"The query returned no stations"}.
// Undefined for web pages and bodies that don't say.
export function serverErrorDetail(data: unknown): string | undefined {
  let body: unknown = data;
  let text: string | undefined;
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) text = new TextDecoder().decode(data);
  else if (typeof data === 'string') text = data;
  if (text !== undefined) {
    // Bytes that aren't text, like an image, have nothing to quote
    if (text.includes('\0')) return undefined;
    try {
      body = JSON.parse(text);
    } catch {
      const plain = text.trim();
      return plain && !plain.startsWith('<') ? clip(plain) : undefined;
    }
  }
  if (!body || typeof body !== 'object') return undefined;
  const fields = body as Record<string, unknown>;
  for (const key of DETAIL_KEYS) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim()) return clip(value);
  }
  // FastAPI's validation errors: detail: [{ loc, msg }]
  if (Array.isArray(fields.detail)) {
    const messages = fields.detail
      .map(item => (item as { msg?: unknown } | null)?.msg)
      .filter((msg): msg is string => typeof msg === 'string');
    if (messages.length > 0) return clip(messages.join('; '));
  }
  return undefined;
}

// A detail that only names the status, like Meteogate's {"detail":"Not Found"}, explains nothing
const REASON_PHRASE = /^(bad request|unauthorized|forbidden|not found|method not allowed|too many requests|internal server error|bad gateway|service unavailable|gateway timeout)\.?$/i;

// A message for an HTTP error status, with the server's own explanation when it gives one. Null for
// statuses that aren't errors.
export function httpErrorMessage(status: number, serverDetail?: string): string | null {
  const detail = serverDetail && !REASON_PHRASE.test(serverDetail.trim()) ? serverDetail : undefined;
  const said = detail ? `: ${/[.!?]$/.test(detail) ? detail : `${detail}.`}` : '.';
  if (status === 401 || status === 403) return `Authentication failed (${status})${said} Check your credentials in Settings (S).`;
  if (status === 404) return detail ? `Not found (404)${said}` : 'Endpoint not found (404). Verify the query URL is correct.';
  // DMI already says "Please try again later"
  if (status === 429) return `Too many requests (429)${said}${detail && /try again/i.test(detail) ? '' : ' Wait a moment and try again.'}`;
  if (status >= 500) return detail ? `Server error (${status})${said}` : `Server error (${status}). The API returned an internal error.`;
  if (status >= 400) return `The server rejected the request (${status})${said}`;
  return null;
}

// Statuses after which the same request may well succeed: a timeout, too many requests or a failure on
// the server's side. DMI answers 429 "Server is busy" without a Retry-After header, also when its
// whole service is overloaded rather than the client sending too much
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export const isRetryableStatus = (status: number) => RETRYABLE_STATUSES.has(status);

export const isSuccessStatus = (status: number) => status >= 200 && status < 300;

// What to say about a response that isn't a success, from its status and body. Null for a success.
export function httpFailure(status: number, body: unknown): { message: string; retryable: boolean } | null {
  if (isSuccessStatus(status)) return null;
  return {
    message: httpErrorMessage(status, serverErrorDetail(body)) ?? `The server answered with status ${status}.`,
    retryable: isRetryableStatus(status),
  };
}

// What to say when no response came: a browser can't tell a network failure from CORS
export function networkFailureMessage(error: { message?: string; code?: string }): string {
  const message = error.message ?? '';
  if (message.includes('CORS') || message.includes('Access-Control-Allow-Origin') || message.includes('cross-origin')) {
    return 'CORS blocked. Your API must include the Access-Control-Allow-Origin header for this origin.';
  }
  if (error.code === 'ERR_NETWORK' || message.includes('Network Error') || message.includes('Failed to fetch')) {
    return 'Network error. The API may be unreachable or blocking cross-origin requests (CORS).';
  }
  return message || 'Failed to fetch data';
}

