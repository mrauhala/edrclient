import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { AuthCredentials } from '../types/api';
import { addApiKeyToUrl, getAxiosConfig } from './auth';
import { networkFailureMessage } from './httpErrors';
import { responseDetails, type ResponseDetails } from './sendRequest';

// What a request the app made by itself got back, so that it can be shown as it came. This adds no requests: it keeps
// what the requests being made anyway brought back.
export interface CapturedResponse {
  // As asked for, without the API key
  url: string;
  // Null when no response came: a network failure or CORS, which a browser can't tell apart
  response: ResponseDetails | null;
  // The server's own text, not one rebuilt from what was parsed. Null when no response came
  text: string | null;
  // What went wrong, when no response came
  failure: string | null;
}

export interface CapturedLoad {
  landingPage?: CapturedResponse;
  conformance?: CapturedResponse;
  collections?: CapturedResponse;
}

const HIDDEN_KEY = '[API key]';
// A key this short could match anything, and it isn't much of a secret
const SHORTEST_KEY = 4;

// A server can echo the key, typically in the links it gives back. It's for the wire, not for the screen
function withoutKey(text: string, auth?: AuthCredentials): string {
  const key = auth?.apiKey;
  if (!key || key.length < SHORTEST_KEY) return text;
  return text.split(key).join(HIDDEN_KEY).split(encodeURIComponent(key)).join(HIDDEN_KEY);
}

// axios keeps the text its parsed answer came from. Reading it throws for a response asked for as something else than text
function heldText(response: AxiosResponse<unknown>): string | undefined {
  try {
    return (response.request as XMLHttpRequest | undefined)?.responseText;
  } catch {
    return undefined;
  }
}

function originalText(response: AxiosResponse<unknown>): string {
  const held = heldText(response);
  if (typeof held === 'string') return held;
  const { data } = response;
  if (typeof data === 'string') return data;
  return data == null ? '' : JSON.stringify(data, null, 2);
}

function captured(url: string, target: string, response: AxiosResponse<unknown>, started: number, auth?: AuthCredentials): CapturedResponse {
  const timeMs = performance.now() - started;
  // Keeping a copy mustn't be able to break the load, or hide what really went wrong with it
  try {
    const text = originalText(response);
    const details = responseDetails(response, target, new TextEncoder().encode(text).length, timeMs);
    return {
      url,
      response: { ...details, headers: details.headers.map(header => ({ ...header, value: withoutKey(header.value, auth) })) },
      text: withoutKey(text, auth),
      failure: null,
    };
  } catch (error) {
    console.warn('Could not keep a copy of a response:', error);
    return { url, response: null, text: null, failure: 'A response came, but a copy of it could not be kept.' };
  }
}

// A GET like any other, also rejecting like any other, that tells what came back on the way
export async function capturedGet<T>(
  url: string,
  auth: AuthCredentials | undefined,
  signal: AbortSignal | undefined,
  record: (capture: CapturedResponse) => void,
  extra?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  const target = addApiKeyToUrl(url, auth);
  const config = getAxiosConfig(auth, signal);
  const started = performance.now();
  try {
    const response = await axios.get<T>(target, extra ? { ...config, ...extra, headers: { ...config.headers, ...extra.headers } } : config);
    record(captured(url, target, response, started, auth));
    return response;
  } catch (error) {
    const answer = (error as { response?: AxiosResponse<unknown> }).response;
    record(answer
      ? captured(url, target, answer, started, auth)
      : { url, response: null, text: null, failure: networkFailureMessage(error as { message?: string; code?: string }) });
    throw error;
  }
}
