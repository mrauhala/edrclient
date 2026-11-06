import { describe, expect, it } from 'vitest';
import { httpErrorMessage, networkFailureMessage, httpFailure, isRetryableStatus, isSuccessStatus, serverErrorDetail } from './httpErrors';

const bytes = (text: string) => new TextEncoder().encode(text).buffer;

describe('serverErrorDetail', () => {
  it('has nothing to quote from a body that is not text, like an image', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    expect(serverErrorDetail(png.buffer)).toBeUndefined();
  });

  it('reads detail from a FastAPI body, as the bytes the data fetch receives (Meteogate)', () => {
    expect(serverErrorDetail(bytes('{"detail":"The query returned no stations"}'))).toBe('The query returned no stations');
  });

  it('prefers detail over title in a problem document (FMI)', () => {
    expect(serverErrorDetail(bytes('{\n  "title" : "An error occurred",\n  "detail" : "No matching parameter names given!"\n}')))
      .toBe('No matching parameter names given!');
  });

  it('reads OGC API exceptions, Spring errors and FastAPI validation errors', () => {
    expect(serverErrorDetail({ code: 'InvalidParameterValue', description: 'Invalid bbox' })).toBe('Invalid bbox');
    // DMI's 429
    expect(serverErrorDetail('{"timestamp":"2026-11-02T22:40:45.245+00:00","status":429,"error":"Too Many Requests","message":"Server is busy. Please try again later."}'))
      .toBe('Server is busy. Please try again later.');
    expect(serverErrorDetail({ detail: [{ loc: ['query', 'coords'], msg: 'Field required' }, { msg: 'Invalid datetime' }] }))
      .toBe('Field required; Invalid datetime');
  });

  it('takes short plain text, flattened and clipped, but not web pages', () => {
    expect(serverErrorDetail(bytes('  Unknown\n parameter name  '))).toBe('Unknown parameter name');
    expect(serverErrorDetail('x'.repeat(400))).toBe(`${'x'.repeat(300)}…`);
    expect(serverErrorDetail(bytes('<!DOCTYPE html><html><body>Not Found</body></html>'))).toBeUndefined();
  });

  it('finds nothing in bodies that do not say', () => {
    expect(serverErrorDetail(bytes('{"code":404}'))).toBeUndefined();
    expect(serverErrorDetail(bytes(''))).toBeUndefined();
    expect(serverErrorDetail(undefined)).toBeUndefined();
  });
});

describe('httpErrorMessage', () => {
  it("gives the server's explanation instead of guessing", () => {
    expect(httpErrorMessage(404, 'The query returned no stations')).toBe('Not found (404): The query returned no stations.');
    expect(httpErrorMessage(400, 'No matching parameter names given!')).toBe('The server rejected the request (400): No matching parameter names given!');
    expect(httpErrorMessage(500, 'Database unavailable')).toBe('Server error (500): Database unavailable.');
  });

  it('keeps advice that still applies', () => {
    expect(httpErrorMessage(401, 'Invalid API key')).toBe('Authentication failed (401): Invalid API key. Check your credentials in Settings (S).');
    expect(httpErrorMessage(429, 'Quota of 100 requests per minute exceeded')).toBe('Too many requests (429): Quota of 100 requests per minute exceeded. Wait a moment and try again.');
    expect(httpErrorMessage(429)).toBe('Too many requests (429). Wait a moment and try again.');
  });

  it("doesn't repeat advice the server already gives", () => {
    expect(httpErrorMessage(429, 'Server is busy. Please try again later.')).toBe('Too many requests (429): Server is busy. Please try again later.');
  });

  it('falls back to the advice when the server only names the status, or says nothing', () => {
    expect(httpErrorMessage(404, 'Not Found')).toBe('Endpoint not found (404). Verify the query URL is correct.');
    expect(httpErrorMessage(404)).toBe('Endpoint not found (404). Verify the query URL is correct.');
    expect(httpErrorMessage(503)).toBe('Server error (503). The API returned an internal error.');
    expect(httpErrorMessage(400)).toBe('The server rejected the request (400).');
  });

  it('is null for statuses that are not errors', () => {
    expect(httpErrorMessage(304)).toBeNull();
  });
});

describe('isRetryableStatus', () => {
  it('offers a retry after rate limits, timeouts and failures on the server', () => {
    // DMI's rate limit: 429 {"message":"Server is busy. Please try again later."}, no Retry-After
    for (const status of [408, 425, 429, 500, 502, 503, 504]) expect(isRetryableStatus(status), String(status)).toBe(true);
  });

  it("doesn't when the request itself is wrong, or the server can't do it", () => {
    for (const status of [400, 401, 403, 404, 405, 406, 413, 422, 501]) expect(isRetryableStatus(status), String(status)).toBe(false);
  });
});

describe('isSuccessStatus', () => {
  it('is true for 2xx only', () => {
    expect([199, 200, 204, 299, 300, 304, 400, 500].filter(isSuccessStatus)).toEqual([200, 204, 299]);
  });
});

describe('httpFailure', () => {
  it('is null for a success', () => {
    expect(httpFailure(200, bytes('{"detail":"ignored"}'))).toBeNull();
  });

  it("says what the server said, and that retrying won't help a bad request", () => {
    expect(httpFailure(400, bytes('{"code":"BadRequest","description":"Unknown parameter nope"}'))).toEqual({
      message: 'The server rejected the request (400): Unknown parameter nope.',
      retryable: false,
    });
  });

  it('offers a retry after a failure on the server side', () => {
    expect(httpFailure(503, bytes(''))).toEqual({
      message: 'Server error (503). The API returned an internal error.',
      retryable: true,
    });
  });

  it("names a status that is neither a success nor an error", () => {
    expect(httpFailure(304, bytes(''))).toEqual({ message: 'The server answered with status 304.', retryable: false });
  });
});

describe('networkFailureMessage', () => {
  it('says what to do about CORS, however the browser words it', () => {
    for (const message of ['CORS error', 'No Access-Control-Allow-Origin header', 'blocked cross-origin']) {
      expect(networkFailureMessage({ message })).toMatch(/^CORS blocked/);
    }
  });

  it('says a network failure may be either, since a browser cannot tell them apart', () => {
    expect(networkFailureMessage({ message: 'Network Error' })).toMatch(/^Network error.*CORS/);
    expect(networkFailureMessage({ message: 'Failed to fetch' })).toMatch(/^Network error/);
    expect(networkFailureMessage({ message: 'something', code: 'ERR_NETWORK' })).toMatch(/^Network error/);
  });

  it('passes on anything else', () => {
    expect(networkFailureMessage({ message: 'timeout of 100ms exceeded' })).toBe('timeout of 100ms exceeded');
    expect(networkFailureMessage({})).toBe('Failed to fetch data');
  });
});

