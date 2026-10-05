import { derefLocal, pointerOf } from './refs';

type Json = Record<string, unknown>;

// A GET operation's parameter with $refs resolved
export interface ResolvedParam {
  name: string;
  in: string;
  required: boolean;
  schema?: Json;
  enumValues: string[] | null; // allowed values, from schema.enum, items.enum or anyOf/oneOf enums
  isArray: boolean;
  pointer: string; // JSON pointer to the parameter in the document
}

export interface OperationEntry {
  template: string; // the path as written in the document
  segments: string[];
  literalCount: number; // segments that aren't {templates}: more means a more specific path
  pointer: string; // JSON pointer to the GET operation
  params: ResolvedParam[];
}

export interface OperationIndex {
  docUrl: string;
  basePaths: string[]; // path prefixes from `servers`, '' for the host root
  entries: OperationEntry[];
}

export interface OperationMatch {
  entry: OperationEntry;
  pathParams: Record<string, string>;
  via: 'server' | 'suffix'; // 'suffix': matched only by ignoring the servers prefix
}

const splitPath = (path: string) => path.split('/').filter(Boolean);
const isTemplate = (segment: string) => /^\{[^}]+\}$/.test(segment);
const asObject = (value: unknown): Json | undefined => (value && typeof value === 'object' ? (value as Json) : undefined);

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// Path prefixes the paths are relative to. Relative server URLs resolve against the document's
// URL (DWD '/v1beta1'); no servers means the host root (MeteoCore writes /edr/... into the paths).
function serverBasePaths(doc: Json, docUrl: string): string[] {
  const servers = Array.isArray(doc.servers) && doc.servers.length > 0 ? doc.servers : [{ url: '/' }];
  const paths = servers.map(server => {
    const variables = asObject(asObject(server)?.variables) ?? {};
    const url = String(asObject(server)?.url ?? '/')
      .replace(/\{([^}]+)\}/g, (_, name: string) => String(asObject(variables[name])?.default ?? ''));
    try {
      return new URL(url, docUrl).pathname.replace(/\/+$/, '');
    } catch {
      return '';
    }
  });
  return [...new Set(paths)];
}

function enumInfo(doc: Json, rawSchema: unknown): { enumValues: string[] | null; isArray: boolean; schema?: Json } {
  const schema = asObject(derefLocal(doc, rawSchema));
  if (!schema) return { enumValues: null, isArray: false };
  const type = schema.type;
  const isArray = type === 'array' || (Array.isArray(type) && type.includes('array'));
  const items = isArray ? asObject(derefLocal(doc, schema.items)) : undefined;
  const direct = Array.isArray(schema.enum) ? schema.enum : Array.isArray(items?.enum) ? items!.enum as unknown[] : null;
  if (direct) return { enumValues: direct.filter(v => v !== null).map(String), isArray, schema };

  // anyOf/oneOf of enums (and null), e.g. FastAPI's optional parameters
  const members = (schema.anyOf ?? schema.oneOf) as unknown[] | undefined;
  if (Array.isArray(members)) {
    const options = members.map(member => asObject(derefLocal(doc, member))).filter((m): m is Json => !!m && m.type !== 'null');
    if (options.length > 0 && options.every(option => Array.isArray(option.enum))) {
      return { enumValues: options.flatMap(option => (option.enum as unknown[]).filter(v => v !== null).map(String)), isArray, schema };
    }
  }
  return { enumValues: null, isArray, schema };
}

function resolveParams(doc: Json, pathItem: Json, pathPointer: string, operation: Json, operationPointer: string): ResolvedParam[] {
  const byKey = new Map<string, ResolvedParam>();
  const add = (list: unknown, listPointer: string) => {
    if (!Array.isArray(list)) return;
    list.forEach((raw, i) => {
      const parameter = asObject(derefLocal(doc, raw));
      if (!parameter || typeof parameter.name !== 'string' || typeof parameter.in !== 'string') return;
      byKey.set(`${parameter.in}:${parameter.name}`, {
        name: parameter.name,
        in: parameter.in,
        required: parameter.required === true || parameter.in === 'path',
        ...enumInfo(doc, parameter.schema),
        pointer: `${listPointer}/parameters/${i}`,
      });
    });
  };
  add(pathItem.parameters, pathPointer); // operation parameters override path-level ones
  add(operation.parameters, operationPointer);
  return [...byKey.values()];
}

// Index the document's GET operations for matching request URLs
export function buildOperationIndex(description: { url: string; doc: Json }): OperationIndex {
  const { doc } = description;
  const entries: OperationEntry[] = [];
  for (const [template, rawItem] of Object.entries(asObject(doc.paths) ?? {})) {
    const pathItem = asObject(derefLocal(doc, rawItem));
    const get = asObject(pathItem?.get);
    if (!pathItem || !get) continue;
    const segments = splitPath(template);
    const pathPointer = pointerOf('paths', template);
    entries.push({
      template,
      segments,
      literalCount: segments.filter(segment => !isTemplate(segment)).length,
      pointer: `${pathPointer}/get`,
      params: resolveParams(doc, pathItem, pathPointer, get, `${pathPointer}/get`),
    });
  }
  return { docUrl: description.url, basePaths: serverBasePaths(doc, description.url), entries };
}

function matchSegments(entry: OperationEntry, segments: string[]): Record<string, string> | null {
  if (entry.segments.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < segments.length; i++) {
    const expected = entry.segments[i];
    if (isTemplate(expected)) params[expected.slice(1, -1)] = segments[i];
    else if (expected !== segments[i]) return null;
  }
  return params;
}

function bestMatch(entries: OperationEntry[], segments: string[]) {
  let best: { entry: OperationEntry; pathParams: Record<string, string> } | null = null;
  for (const entry of entries) {
    const pathParams = matchSegments(entry, segments);
    if (pathParams && (!best || entry.literalCount > best.entry.literalCount)) best = { entry, pathParams };
  }
  return best;
}

// The GET operation describing a request URL: the most specific path under a servers prefix,
// else (marked 'suffix') the most specific path matching the end of the URL path
export function matchOperation(index: OperationIndex, url: string): OperationMatch | null {
  let segments: string[];
  try {
    segments = splitPath(new URL(url).pathname).map(decodeSegment);
  } catch {
    return null;
  }
  for (const base of index.basePaths) {
    const baseSegments = splitPath(base);
    if (baseSegments.every((segment, i) => segments[i] === segment)) {
      const match = bestMatch(index.entries, segments.slice(baseSegments.length));
      if (match) return { ...match, via: 'server' };
    }
  }
  let suffix: OperationMatch | null = null;
  for (let start = 1; start < segments.length && !suffix; start++) {
    const match = bestMatch(index.entries, segments.slice(start));
    if (match) suffix = { ...match, via: 'suffix' };
  }
  return suffix;
}
