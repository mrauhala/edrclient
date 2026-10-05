import type { QueryIssue } from '../../query/types';
import { matchOperation, type OperationIndex, type OperationMatch, type ResolvedParam } from './operationIndex';

// A request URL checked against the API definition. The issues name the parameter as their field
// and point into the document; they're warnings at most, since server documents are often loose.
export interface ApiDocsCheck {
  operation: OperationMatch | null;
  issues: QueryIssue[];
}

const MAX_LISTED = 5;

const listed = (values: string[]) =>
  values.slice(0, MAX_LISTED).join(', ') + (values.length > MAX_LISTED ? ` +${values.length - MAX_LISTED} more` : '');

const isNumber = (value: string) => value.trim() !== '' && isFinite(Number(value));

// Allowed as written, allowed in another letter case (which server may reject), or not allowed.
// Numbers compare by value: a level of 850.0 is the enum's 850.
function enumMatch(value: string, allowed: string[]): 'allowed' | 'not-allowed' | { caseOf: string } {
  if (allowed.includes(value)) return 'allowed';
  if (isNumber(value) && allowed.some(option => isNumber(option) && Number(option) === Number(value))) return 'allowed';
  const caseOf = allowed.find(option => option.toLowerCase() === value.toLowerCase());
  return caseOf ? { caseOf } : 'not-allowed';
}

// The values sent for a parameter: every repeat of the key, with comma lists split when the
// parameter is an array, or when only the items are in the enum (parameter-name=a,b typed string)
function sentValues(param: ResolvedParam, raw: string[]): string[] {
  return raw.flatMap(value => {
    const split = value.includes(',') && (param.isArray || enumMatch(value, param.enumValues ?? []) === 'not-allowed');
    return split ? value.split(',').map(part => part.trim()).filter(Boolean) : [value];
  });
}

// An object parameter with exploded properties (style form) accepts keys the document doesn't name
const acceptsAnyKey = (params: ResolvedParam[]) =>
  params.some(param => param.in === 'query' && param.schema?.type === 'object');

// Check a request URL against the GET operation the API definition gives for it
export function checkQueryUrlAgainstOpenApi(url: string, index: OperationIndex): ApiDocsCheck {
  const issues: QueryIssue[] = [];
  const add = (severity: 'warning' | 'info', field: string, rule: string, message: string, pointer: string) =>
    issues.push({ id: `openapi:${field}:${rule}`, severity, source: 'openapi', field, message, pointer });

  let search: URLSearchParams;
  try {
    search = new URL(url).searchParams;
  } catch {
    return { operation: null, issues };
  }
  const operation = matchOperation(index, url);
  if (!operation) {
    add('warning', 'query', 'no-operation', "The API docs don't describe this request", '/paths');
    return { operation, issues };
  }
  const { entry, pathParams } = operation;

  for (const param of entry.params) {
    if (param.in === 'path') {
      const value = pathParams[param.name];
      if (value !== undefined && param.enumValues && enumMatch(value, param.enumValues) === 'not-allowed') {
        add('warning', `path:${param.name}`, 'enum', `The API docs don't list "${value}" as a ${param.name}`, param.pointer);
      }
      continue;
    }
    if (param.in !== 'query') continue;

    const raw = search.getAll(param.name);
    if (raw.length === 0) {
      if (param.required) add('warning', param.name, 'required', `The API docs require ${param.name}, which the query doesn't set`, param.pointer);
      continue;
    }
    if (!param.enumValues) continue;
    const notAllowed: string[] = [];
    const otherCase: string[] = [];
    for (const value of sentValues(param, raw)) {
      const match = enumMatch(value, param.enumValues);
      if (match === 'not-allowed') notAllowed.push(value);
      else if (match !== 'allowed') otherCase.push(`${value} as ${match.caseOf}`);
    }
    if (notAllowed.length > 0) {
      add('warning', param.name, 'enum',
        `The API docs don't list ${listed(notAllowed)} for ${param.name} (they list ${listed(param.enumValues)})`, param.pointer);
    }
    if (otherCase.length > 0) {
      add('info', param.name, 'enum-case', `The API docs write ${param.name} ${listed(otherCase)}`, param.pointer);
    }
  }

  if (!acceptsAnyKey(entry.params)) {
    const declared = new Set(entry.params.filter(param => param.in === 'query').map(param => param.name));
    const undeclared = [...new Set(search.keys())].filter(name => !declared.has(name));
    if (undeclared.length > 0) {
      add('info', 'query', 'undeclared',
        `The API docs don't declare ${listed(undeclared)}: the server may ignore ${undeclared.length > 1 ? 'them' : 'it'}`, entry.pointer);
    }
  }
  return { operation, issues };
}
