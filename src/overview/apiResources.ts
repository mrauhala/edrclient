import type { CapturedLoad, CapturedResponse } from '../api/capture';
import type { OpenApiState } from '../contexts/OpenApiContext';
import type { ValidationError, ValidationResult } from '../types/api';
import { formatBytes, formatDuration } from '../utils/formatResponse';
import { isProblem } from '../validation/severity';

export type ApiResourceKey = 'landingPage' | 'conformance' | 'openApi' | 'collections';

// One of the things an API is loaded from, and what came back for it
export interface ApiResource {
  key: ApiResourceKey;
  name: string;
  // Under the API, without the query. Null until it's known
  path: string | null;
  // What the status said, null if no response came or none was asked for
  status: number | null;
  // Time, size and what it holds, as far as they're known
  facts: string[];
  // Findings that count against it. Null until it's been checked
  issues: number | null;
  // What's going on instead of, or as well as, the above
  note: string | null;
  // What's opened from it. Null if there's nothing to show yet
  captured: CapturedResponse | null;
  findings: ValidationError[];
  schemaName: string | null;
}

export interface ApiResourceInputs {
  apiUrl: string;
  loading: boolean;
  captured: CapturedLoad;
  conformsTo: string[] | null;
  collectionCount: number;
  openApi: Pick<OpenApiState, 'status' | 'url' | 'description' | 'captured'>;
  validation: ValidationResult;
}

// Where it is under the API. Anywhere else, it says so
export function resourcePath(url: string, apiUrl: string): string {
  try {
    const target = new URL(url);
    const api = new URL(apiUrl);
    if (target.host !== api.host) return `${target.host}${target.pathname}`;
    const base = api.pathname.replace(/\/+$/, '');
    const path = target.pathname.replace(/\/+$/, '');
    if (path === base) return '/';
    return base && path.startsWith(`${base}/`) ? path.slice(base.length) : path;
  } catch {
    return url;
  }
}

// Which resource a finding is about, by the section it says it's from. Locations are a collection's, not the API's
function resourceOf({ section }: ValidationError): ApiResourceKey | null {
  const name = (section ?? '').toLowerCase();
  if (name.startsWith('landing') || name === 'unknown endpoint') return 'landingPage';
  if (name.startsWith('conformance')) return 'conformance';
  if (name === 'openapi') return 'openApi';
  if (name === 'locations') return null;
  // Links to the data, and a finding that doesn't say, are about the list of collections
  return 'collections';
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const schemaNames = (results: { schema: string }[] | undefined) => (results && results.length > 0 ? results.map(result => result.schema).join(', ') : null);

function answerFacts(capture: CapturedResponse | null | undefined, withSize: boolean): string[] {
  if (!capture?.response) return [];
  const { timeMs, sizeBytes } = capture.response;
  return withSize ? [formatDuration(timeMs), formatBytes(sizeBytes)] : [formatDuration(timeMs)];
}

const answered = (capture: CapturedResponse | null | undefined) => capture?.response != null && capture.response.status >= 200 && capture.response.status < 300;

const noteOf = (capture: CapturedResponse | null | undefined, inputs: ApiResourceInputs): string | null => {
  if (inputs.loading) return 'loading';
  if (!capture) return 'not requested';
  return capture.response ? null : 'no response';
};

export function apiResources(inputs: ApiResourceInputs): ApiResource[] {
  const { apiUrl, captured, conformsTo, collectionCount, openApi, validation } = inputs;
  const findingsOf = (key: ApiResourceKey) => (validation.errors ?? []).filter(finding => resourceOf(finding) === key);
  const issuesOf = (key: ApiResourceKey, capture: CapturedResponse | null | undefined) => (capture ? findingsOf(key).filter(isProblem).length : null);
  const pathOf = (capture: CapturedResponse | null | undefined) => (capture ? resourcePath(capture.url, apiUrl) : null);

  const landing = captured.landingPage;
  const conformance = captured.conformance;
  const collections = captured.collections;

  const paths = openApi.description?.doc.paths;
  const pathCount = paths && typeof paths === 'object' ? Object.keys(paths).length : 0;
  const openApiCapture = openApi.captured;
  // The check waits for the collections, so with none it never comes. It's over once it has reported
  const checking = openApi.status === 'ready' && collectionCount > 0 && !validation.openApiValidation;
  const openApiNote = inputs.loading || openApi.status === 'loading' ? 'loading'
    // Whether it links one is only known from a landing page
    : openApi.status === 'none' ? (answered(landing) ? 'not linked' : 'not requested')
      : checking ? 'checking'
        : openApiCapture && !openApiCapture.response ? 'no response'
          : openApi.status === 'error' && answered(openApiCapture) ? 'not a document'
            : null;

  return [
    {
      key: 'landingPage',
      name: 'Landing page',
      path: pathOf(landing),
      status: landing?.response?.status ?? null,
      facts: answerFacts(landing, true),
      issues: issuesOf('landingPage', landing),
      note: noteOf(landing, inputs),
      captured: landing ?? null,
      findings: findingsOf('landingPage'),
      schemaName: schemaNames(validation.landingPageValidation?.schemaResults),
    },
    {
      key: 'conformance',
      name: 'Conformance',
      path: pathOf(conformance),
      status: conformance?.response?.status ?? null,
      facts: [...answerFacts(conformance, false), ...(answered(conformance) && conformsTo ? [plural(conformsTo.length, 'class', 'classes')] : [])],
      issues: issuesOf('conformance', conformance),
      note: noteOf(conformance, inputs),
      captured: conformance ?? null,
      findings: findingsOf('conformance'),
      schemaName: schemaNames(validation.conformanceValidation?.schemaResults),
    },
    {
      key: 'openApi',
      name: 'OpenAPI',
      path: openApi.url ? resourcePath(openApi.url, apiUrl) : null,
      status: openApiCapture?.response?.status ?? null,
      facts: [...answerFacts(openApiCapture, true), ...(openApi.status === 'ready' ? [plural(pathCount, 'path')] : [])],
      issues: checking || inputs.loading || openApi.status === 'loading' ? null : issuesOf('openApi', openApiCapture),
      note: openApiNote,
      captured: openApiCapture,
      findings: findingsOf('openApi'),
      schemaName: schemaNames(validation.openApiValidation?.schemaResults),
    },
    {
      key: 'collections',
      name: 'Collections',
      path: pathOf(collections),
      status: collections?.response?.status ?? null,
      facts: [...answerFacts(collections, false), ...(answered(collections) ? [String(collectionCount)] : [])],
      issues: issuesOf('collections', collections),
      note: noteOf(collections, inputs),
      captured: collections ?? null,
      findings: findingsOf('collections'),
      schemaName: schemaNames(validation.collectionsValidation?.schemaResults),
    },
  ];
}
