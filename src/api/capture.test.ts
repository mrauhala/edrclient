import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturedGet, type CapturedResponse } from './capture';

afterEach(() => vi.restoreAllMocks());

const URL_ = 'https://a.example/api?f=json';
const answer = (text: string, extra: object = {}) => ({
  data: JSON.parse(text),
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json', etag: 'x' },
  request: { responseText: text },
  ...extra,
});

async function capture(respond: () => Promise<unknown>, auth?: Parameters<typeof capturedGet>[1], extra?: Parameters<typeof capturedGet>[4]) {
  const get = vi.spyOn(axios, 'get').mockImplementation(respond as never);
  let kept: CapturedResponse | undefined;
  const outcome = await capturedGet(URL_, auth, undefined, c => { kept = c; }, extra).catch((error: unknown) => error);
  return { kept: kept!, outcome, get };
}

describe('capturedGet', () => {
  it('keeps the text as the server sent it, not one rebuilt from what was parsed', async () => {
    const text = '{\n  "b":   1,\n  "a": 2\n}';
    const { kept } = await capture(async () => answer(text));
    expect(kept.text).toBe(text);
    expect(kept.failure).toBeNull();
  });

  it('gives back the response as axios gave it', async () => {
    const response = answer('{}');
    const { outcome } = await capture(async () => response);
    expect(outcome).toBe(response);
  });

  it('keeps the status, type and headers', async () => {
    const { kept } = await capture(async () => answer('{}'));
    expect(kept.response?.status).toBe(200);
    expect(kept.response?.statusText).toBe('OK');
    expect(kept.response?.contentType).toBe('application/json');
    expect(kept.response?.headers.map(header => header.name)).toEqual(['content-type', 'etag']);
  });

  it('measures the text in bytes', async () => {
    const { kept } = await capture(async () => answer('{"a":"ää"}'));
    expect(kept.response?.sizeBytes).toBe(12);
  });

  it('measures the time from asking to having it', async () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValueOnce(100).mockReturnValueOnce(350);
    const { kept } = await capture(async () => answer('{}'));
    expect(kept.response?.timeMs).toBe(250);
  });

  it('makes one request', async () => {
    const { get } = await capture(async () => answer('{}'));
    expect(get).toHaveBeenCalledTimes(1);
  });

  describe('an API key', () => {
    const auth = { apiKey: 'sekret key', apiKeyParam: 'k' };

    it('goes on the wire but not in the URL it keeps', async () => {
      const { kept, get } = await capture(async () => answer('{}'), auth);
      expect(get.mock.calls[0][0]).toContain('k=sekret');
      expect(kept.url).toBe(URL_);
    });

    it('is taken out of what the server echoes, plain or encoded', async () => {
      const text = JSON.stringify({ a: 'x?k=sekret key', b: 'x?k=sekret%20key' });
      const { kept } = await capture(async () => answer(text), auth);
      expect(kept.text).not.toContain('sekret');
      expect(kept.text?.match(/\[API key\]/g)).toHaveLength(2);
    });

    it('is taken out of the headers too', async () => {
      const { kept } = await capture(async () => answer('{}', { headers: { link: '<x?k=sekret key>' } }), auth);
      expect(kept.response?.headers[0].value).toBe('<x?k=[API key]>');
    });

    it('stays out of the URL it keeps of an error status', async () => {
      const failing = Object.assign(new Error('Request failed with status code 500'), { response: answer('{}', { status: 500 }) });
      const { kept, get } = await capture(async () => { throw failing; }, auth);
      expect(get.mock.calls[0][0]).toContain('k=sekret');
      expect(kept.url).toBe(URL_);
    });

    it('stays out of the URL it keeps when no response came', async () => {
      const { kept, get } = await capture(async () => { throw new Error('Network Error'); }, auth);
      expect(get.mock.calls[0][0]).toContain('k=sekret');
      expect(kept.url).toBe(URL_);
    });

    it('leaves the text alone with a key too short to tell from anything else', async () => {
      const { kept } = await capture(async () => answer('{"name":"abc"}'), { apiKey: 'abc', apiKeyParam: 'k' });
      expect(kept.text).toBe('{"name":"abc"}');
    });

    it('leaves the text alone without one', async () => {
      const { kept } = await capture(async () => answer('{"name":"[API key]"}'));
      expect(kept.text).toBe('{"name":"[API key]"}');
    });
  });

  describe('an error status', () => {
    const failing = () => Object.assign(new Error('Request failed with status code 500'), { response: answer('{"detail":"down"}', { status: 500, statusText: 'Oops' }) });

    it('keeps what came back, and rejects with the same error', async () => {
      const error = failing();
      const { kept, outcome } = await capture(async () => { throw error; });
      expect(outcome).toBe(error);
      expect(kept.response?.status).toBe(500);
      expect(kept.text).toBe('{"detail":"down"}');
      expect(kept.failure).toBeNull();
    });
  });

  describe('no response', () => {
    it('says so, and rejects with the same error', async () => {
      const error = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
      const { kept, outcome } = await capture(async () => { throw error; });
      expect(outcome).toBe(error);
      expect(kept.response).toBeNull();
      expect(kept.text).toBeNull();
      expect(kept.failure).toMatch(/^Network error/);
      expect(kept.url).toBe(URL_);
    });
  });

  describe('without the text axios keeps', () => {
    it('takes a string as it is', async () => {
      const { kept } = await capture(async () => ({ data: 'plain', status: 200, statusText: '', headers: {} }));
      expect(kept.text).toBe('plain');
    });

    it('writes out what was parsed', async () => {
      const { kept } = await capture(async () => ({ data: { a: 1 }, status: 200, statusText: '', headers: {} }));
      expect(kept.text).toBe('{\n  "a": 1\n}');
    });

    it('has an empty text for an empty answer', async () => {
      const { kept } = await capture(async () => ({ data: null, status: 204, statusText: '', headers: {} }));
      expect(kept.text).toBe('');
    });
  });

  describe('a response it cannot keep', () => {
    const strange = { get data() { return {}; }, status: 200, statusText: '', headers: null, request: { get responseText() { throw new Error('InvalidStateError'); } } };

    it('still gives the load its answer', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { outcome, kept } = await capture(async () => strange);
      expect(outcome).toBe(strange);
      expect(kept.response).toBeNull();
      expect(kept.failure).toMatch(/could not be kept/);
    });

    it('still rejects with what really went wrong', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } });
      const { outcome, kept } = await capture(async () => { throw error; });
      expect(outcome).toBe(error);
      expect(kept.failure).toMatch(/could not be kept/);
    });

    it('reads what axios parsed when it cannot read the text', async () => {
      const unreadable = { data: { a: 1 }, status: 200, statusText: '', headers: {}, request: { get responseText() { throw new Error('InvalidStateError'); } } };
      const { kept } = await capture(async () => unreadable);
      expect(kept.text).toBe('{\n  "a": 1\n}');
    });
  });

  describe('what else it is asked for', () => {
    it('goes to axios along with the credentials', async () => {
      const { get } = await capture(async () => answer('{}'), { bearerToken: 'tok' }, { responseType: 'text', headers: { Accept: 'x/y' } });
      const config = get.mock.calls[0][1]!;
      expect(config.responseType).toBe('text');
      expect(config.headers).toEqual({ Authorization: 'Bearer tok', Accept: 'x/y' });
    });

    it('is nothing added when there is none', async () => {
      const { get } = await capture(async () => answer('{}'));
      expect(get.mock.calls[0][1]).toEqual({});
    });
  });
});
