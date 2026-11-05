import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeRoomForWireTiming, readWireTiming, responseSizes } from './responseSizes';
import type { ResponseDetails } from './sendRequest';

const details = (overrides: Partial<ResponseDetails>): ResponseDetails => ({
  status: 200, statusText: 'OK', timeMs: 10, sizeBytes: 4000, headers: [], contentType: 'application/json',
  requestUrlBytes: 50, timing: null, ...overrides,
});
const header = (name: string, value: string) => ({ name, value });

describe('responseSizes', () => {
  it('always knows the URL and the unpacked body', () => {
    expect(responseSizes(details({}))).toMatchObject({ requestUrl: 50, bodyUnpacked: 4000 });
  });

  it('has nothing else to go on without either header', () => {
    expect(responseSizes(details({}))).toMatchObject({ bodyOnWire: null, compression: null, encoding: null, fromCache: null });
  });

  it('takes the size on the wire from Content-Length', () => {
    expect(responseSizes(details({ headers: [header('content-length', '1000')] }))).toMatchObject({ bodyOnWire: 1000, compression: 4 });
  });

  it('prefers the browser\'s own record to Content-Length', () => {
    const view = responseSizes(details({ headers: [header('content-length', '1000')], timing: { transferSize: 800, encodedBodySize: 500, decodedBodySize: 4000 } }));
    expect(view).toMatchObject({ bodyOnWire: 500, compression: 8 });
  });

  it('calls a body as big on the wire as unpacked not compressed', () => {
    expect(responseSizes(details({ headers: [header('content-length', '4000')] })).compression).toBe(1);
  });

  it('calls a body bigger on the wire not compressed either', () => {
    expect(responseSizes(details({ headers: [header('content-length', '4100')] })).compression).toBe(1);
  });

  it('makes no ratio of nothing on the wire', () => {
    expect(responseSizes(details({ sizeBytes: 100, headers: [header('content-length', '0')] })).compression).toBe(1);
  });

  it('copes with an empty body', () => {
    expect(responseSizes(details({ sizeBytes: 0, headers: [header('content-length', '0')] }))).toMatchObject({ bodyOnWire: 0, compression: 1 });
  });

  it.each(['abc', '', '-1', '1.5'])('ignores a Content-Length of "%s"', value => {
    expect(responseSizes(details({ headers: [header('content-length', value)] })).bodyOnWire).toBeNull();
  });

  it('finds headers however they are written', () => {
    expect(responseSizes(details({ headers: [header('Content-Length', '1000'), header('Content-Encoding', 'gzip')] }))).toMatchObject({ bodyOnWire: 1000, encoding: 'gzip' });
  });

  it('names the encoding if the server exposes it, even with no size', () => {
    expect(responseSizes(details({ headers: [header('content-encoding', 'gzip')] }))).toMatchObject({ encoding: 'gzip', bodyOnWire: null, compression: null });
  });

  it('can tell whether it came from the cache only with the browser\'s record', () => {
    const timing = (transferSize: number) => ({ transferSize, encodedBodySize: 500, decodedBodySize: 4000 });
    expect(responseSizes(details({ timing: timing(0) })).fromCache).toBe(true);
    expect(responseSizes(details({ timing: timing(800) })).fromCache).toBe(false);
  });
});

describe('readWireTiming', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (entries: Partial<PerformanceResourceTiming>[]) => {
    const getEntriesByName = vi.fn(() => entries);
    vi.stubGlobal('performance', { getEntriesByName });
    return getEntriesByName;
  };

  it('reads the figures, of the latest request to that URL', () => {
    stub([{ transferSize: 1, encodedBodySize: 1, decodedBodySize: 1 }, { transferSize: 800, encodedBodySize: 500, decodedBodySize: 4000 }]);
    expect(readWireTiming('https://api.test/x')).toEqual({ transferSize: 800, encodedBodySize: 500, decodedBodySize: 4000 });
  });

  it('looks it up by the URL as the browser writes it', () => {
    const lookup = stub([]);
    readWireTiming('https://api.test/x?a=b c');
    expect(lookup).toHaveBeenCalledWith('https://api.test/x?a=b%20c');
  });

  it('counts all zeros as hidden, which is what another origin gets', () => {
    stub([{ transferSize: 0, encodedBodySize: 0, decodedBodySize: 0 }]);
    expect(readWireTiming('https://api.test/x')).toBeNull();
  });

  it('keeps a transfer size of 0 with a body, which means it came from the cache', () => {
    stub([{ transferSize: 0, encodedBodySize: 75, decodedBodySize: 4000 }]);
    expect(readWireTiming('https://api.test/x')).toEqual({ transferSize: 0, encodedBodySize: 75, decodedBodySize: 4000 });
  });

  it('has nothing for a request it has no record of', () => {
    stub([]);
    expect(readWireTiming('https://api.test/x')).toBeNull();
  });
});

describe('makeRoomForWireTiming', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('makes the record longer and empties it', () => {
    const setResourceTimingBufferSize = vi.fn();
    const clearResourceTimings = vi.fn();
    vi.stubGlobal('performance', { setResourceTimingBufferSize, clearResourceTimings });
    makeRoomForWireTiming();
    expect(setResourceTimingBufferSize).toHaveBeenCalledWith(1000);
    expect(clearResourceTimings).toHaveBeenCalled();
  });
});
