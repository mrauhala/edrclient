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
  if (status === 429) return `Rate limited (429)${said} Wait a moment and try again.`;
  if (status >= 500) return detail ? `Server error (${status})${said}` : `Server error (${status}). The API returned an internal error.`;
  if (status >= 400) return `The server rejected the request (${status})${said}`;
  return null;
}
