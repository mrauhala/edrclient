import type { ResponseDetails, ResponseHeader } from './sendRequest';

// What the browser's own record of a request says about its size. It's kept apart from the response
// because it has to be read at once, and it's all zeros for another origin's response unless that
// sends Timing-Allow-Origin.
export interface WireTiming {
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

// The record is a short list, which the app's own files or a map's tiles can fill, after which new
// requests go unrecorded. Nothing else reads it, so it's emptied for each request.
export function makeRoomForWireTiming(): void {
  performance.setResourceTimingBufferSize(1000);
  performance.clearResourceTimings();
}

export function readWireTiming(url: string): WireTiming | null {
  const entry = performance.getEntriesByName(new URL(url).href).at(-1) as PerformanceResourceTiming | undefined;
  if (!entry) return null;
  const { transferSize, encodedBodySize, decodedBodySize } = entry;
  return transferSize === 0 && encodedBodySize === 0 && decodedBodySize === 0
    ? null
    : { transferSize, encodedBodySize, decodedBodySize };
}

const headerValue = (headers: ResponseHeader[], name: string) => headers.find(header => header.name.toLowerCase() === name)?.value;

export interface ResponseSizesView {
  requestUrl: number;
  bodyUnpacked: number;
  // null: hidden from the page
  bodyOnWire: number | null;
  // How many times smaller the body was on the wire; 1 for not at all, null if that's hidden
  compression: number | null;
  // As named by the server, which it has to expose
  encoding: string | null;
  fromCache: boolean | null;
}

// A browser's transferSize can't give the headers' size: it's the body plus a constant 300 bytes,
// whatever the headers were. So the headers' size isn't among these. Content-Length is the body as sent.
export function responseSizes(details: ResponseDetails): ResponseSizesView {
  const { requestUrlBytes, sizeBytes, headers, timing } = details;
  const declared = headerValue(headers, 'content-length') ?? '';
  const bodyOnWire = timing ? timing.encodedBodySize : /^\d+$/.test(declared) ? Number(declared) : null;
  const encoding = headerValue(headers, 'content-encoding') ?? null;
  return {
    requestUrl: requestUrlBytes,
    bodyUnpacked: sizeBytes,
    bodyOnWire,
    compression: bodyOnWire === null ? null : bodyOnWire > 0 && bodyOnWire < sizeBytes ? sizeBytes / bodyOnWire : 1,
    encoding,
    fromCache: timing ? timing.transferSize === 0 : null,
  };
}
