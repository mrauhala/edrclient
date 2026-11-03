import { describe, expect, it } from 'vitest';
import { httpErrorMessage, isRetryableStatus, serverErrorDetail } from './httpErrors';

const bytes = (text: string) => new TextEncoder().encode(text).buffer;

describe('serverErrorDetail', () => {
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
