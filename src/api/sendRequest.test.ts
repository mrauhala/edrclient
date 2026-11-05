import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendRequest } from './sendRequest';

const URL_ = 'https://api.example.com/collections/a/position?coords=POINT(1%202)';
const bytes = (text: string) => new TextEncoder().encode(text).buffer;

// Answer every request as given, with the request's arguments left on the spy
const answer = (response: Partial<{ data: ArrayBuffer; status: number; statusText: string; headers: Record<string, unknown> }> = {}) =>
  vi.spyOn(axios, 'get').mockResolvedValue({ data: bytes('{}'), status: 200, statusText: '', headers: {}, ...response });

afterEach(() => vi.restoreAllMocks());

describe('sendRequest', () => {
  it('gives the status, time, size, sorted headers, content type and body', async () => {
    answer({
      data: bytes('{"type":"Coverage"}'),
      status: 200,
      statusText: 'OK',
      headers: { 'x-b': '2', 'content-type': 'application/vnd.cov+json', 'x-a': '1' },
    });
    vi.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(3230);

    const { body, ...details } = await sendRequest(URL_);

    expect(details).toEqual({
      status: 200,
      statusText: 'OK',
      timeMs: 2230,
      sizeBytes: 19,
      headers: [
        { name: 'content-type', value: 'application/vnd.cov+json' },
        { name: 'x-a', value: '1' },
        { name: 'x-b', value: '2' },
      ],
      contentType: 'application/vnd.cov+json',
    });
    expect(new TextDecoder().decode(body)).toBe('{"type":"Coverage"}');
  });

  it('treats any status as a response, so a failure keeps its body', async () => {
    const get = answer({ data: bytes('{"code":"BadRequest"}'), status: 400 });

    const response = await sendRequest(URL_);

    expect(response.status).toBe(400);
    expect(new TextDecoder().decode(response.body)).toBe('{"code":"BadRequest"}');
    const validateStatus = get.mock.calls[0][1]?.validateStatus;
    for (const status of [200, 304, 400, 404, 500]) expect(validateStatus?.(status)).toBe(true);
  });

  it('rejects when no response came', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('Network Error'));
    await expect(sendRequest(URL_)).rejects.toThrow('Network Error');
  });

  it('asks for bytes of any type, and passes the abort signal on', async () => {
    const get = answer();
    const { signal } = new AbortController();

    await sendRequest(URL_, undefined, signal);

    const config = get.mock.calls[0][1];
    expect(config?.responseType).toBe('arraybuffer');
    expect(config?.headers).toEqual({ Accept: '*/*' });
    expect(config?.signal).toBe(signal);
  });

  it('sends a custom Authorization header', async () => {
    const get = answer();
    await sendRequest(URL_, { customAuthHeader: 'Token abc' });
    expect(get.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Token abc', Accept: '*/*' });
  });

  it('sends a bearer token', async () => {
    const get = answer();
    await sendRequest(URL_, { bearerToken: 'abc' });
    expect(get.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer abc', Accept: '*/*' });
  });

  it('sends basic auth', async () => {
    const get = answer();
    await sendRequest(URL_, { username: 'me', password: 'secret' });
    expect(get.mock.calls[0][1]?.auth).toEqual({ username: 'me', password: 'secret' });
  });

  it('adds an API key to the URL', async () => {
    const get = answer();
    await sendRequest('https://api.example.com/items', { apiKey: 'abc', apiKeyParam: 'token' });
    expect(get.mock.calls[0][0]).toBe('https://api.example.com/items?token=abc');
  });

  it('leaves out empty headers and joins repeated ones', async () => {
    answer({ headers: { 'x-empty': null, 'x-repeated': ['a', 'b'] } });
    const { headers } = await sendRequest(URL_);
    expect(headers).toEqual([{ name: 'x-repeated', value: 'a, b' }]);
  });

  it('has an empty content type when the server sends none', async () => {
    answer();
    expect((await sendRequest(URL_)).contentType).toBe('');
  });
});
