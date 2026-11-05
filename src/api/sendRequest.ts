import axios from 'axios';
import type { AuthCredentials } from '../types/api';
import { addApiKeyToUrl, getAxiosConfig } from './auth';

export interface ResponseHeader {
  name: string;
  value: string;
}

// What came back for a request, apart from its body
export interface ResponseDetails {
  status: number;
  // Empty over HTTP/2, which has no reason phrases
  statusText: string;
  // From sending the request to having the whole body, including any CORS preflight
  timeMs: number;
  // The body after the browser has decompressed it
  sizeBytes: number;
  // Only the headers the server exposes through CORS: the browser hides the rest
  headers: ResponseHeader[];
  contentType: string;
}

export interface ApiResponse extends ResponseDetails {
  body: ArrayBuffer;
}

// Sends a query. Any status the server answers with is a response, so a failure can be shown like a
// success. This rejects only when no response came: a network failure, CORS or an abort.
export async function sendRequest(url: string, auth?: AuthCredentials, signal?: AbortSignal): Promise<ApiResponse> {
  const config = getAxiosConfig(auth, signal);
  const started = performance.now();
  const response = await axios.get<ArrayBuffer>(addApiKeyToUrl(url, auth), {
    ...config,
    // Bytes, so that binary responses (image/png from OGC API Maps, etc.) survive intact
    responseType: 'arraybuffer',
    headers: { ...config.headers, Accept: '*/*' },
    validateStatus: () => true,
  });
  const timeMs = performance.now() - started;

  const headers = Object.entries(response.headers)
    .filter(([, value]) => value != null)
    .map(([name, value]) => ({ name, value: Array.isArray(value) ? value.join(', ') : String(value) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    status: response.status,
    statusText: response.statusText,
    timeMs,
    sizeBytes: response.data.byteLength,
    headers,
    contentType: headers.find(header => header.name === 'content-type')?.value ?? '',
    body: response.data,
  };
}
