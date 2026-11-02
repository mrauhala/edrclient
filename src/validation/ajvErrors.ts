import type { ErrorObject } from 'ajv';
import type { ValidationError } from '../types/api';

// Keywords that only say "a sub-schema failed"; the useful errors are the ones under them
const UMBRELLA_KEYWORDS = new Set(['oneOf', 'anyOf', 'if', 'then', 'else']);
const BRANCH = /\/(oneOf|anyOf)\/\d+\//;

// Make AJV's allErrors output readable: per instance path, drop umbrella errors when more specific
// ones exist (also at deeper paths) and unevaluatedProperties when other errors explain it, merge
// the 'required' errors of oneOf/anyOf branches into one "must have one of" error, drop duplicates,
// and cap the list ("+N more" as the last error).
export function condenseAjvErrors(errors: ErrorObject[], max = 200): ErrorObject[] {
  const byPath = new Map<string, ErrorObject[]>();
  errors.forEach(error => byPath.set(error.instancePath, [...(byPath.get(error.instancePath) ?? []), error]));
  const paths = [...byPath.keys()];

  const condensed: ErrorObject[] = [];
  for (const [path, group] of byPath) {
    const nonUmbrella = group.filter(error => !UMBRELLA_KEYWORDS.has(error.keyword));
    // unevaluatedProperties follows from another failure here: properties checked only by a failed
    // subschema count as unevaluated (a parameter without schema or content gets its examples flagged)
    const specific = nonUmbrella.some(error => error.keyword !== 'unevaluatedProperties')
      ? nonUmbrella.filter(error => error.keyword !== 'unevaluatedProperties')
      : nonUmbrella;
    if (specific.length === 0) {
      // Only umbrellas here: keep them unless a deeper path explains the failure
      if (!paths.some(other => other.startsWith(path + '/'))) condensed.push(...group.slice(0, 1));
      continue;
    }
    const branchRequired = specific.filter(error => error.keyword === 'required' && BRANCH.test(error.schemaPath));
    const rest = specific.filter(error => !branchRequired.includes(error));
    const alternatives = [...new Set(branchRequired.map(error => String(error.params.missingProperty)))];
    if (alternatives.length === 1) rest.push(branchRequired[0]);
    if (alternatives.length > 1) {
      rest.push({
        ...branchRequired[0],
        message: `must have one of: ${alternatives.join(', ')}`,
        params: { missingProperty: alternatives.join(' | ') },
      });
    }
    const seen = new Set<string>();
    rest.forEach(error => {
      const key = `${error.keyword}:${error.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        condensed.push(error);
      }
    });
  }

  if (condensed.length <= max) return condensed;
  return [
    ...condensed.slice(0, max),
    { instancePath: '', schemaPath: '', keyword: 'truncated', params: {}, message: `+${condensed.length - max} more errors not shown` },
  ];
}

const ARRAY_INDEX = /\/\d+(?=\/|$)/g;

export interface ArrayItemErrors {
  error: ErrorObject; // the first one, whose path can be navigated to
  genericPath: string; // the path with array indices as `*`
  array: string; // the array the items are in: the segment before the first `*`
  count: number;
}

// Errors repeated across the items of an array, once per kind: AJV reports a property missing
// from 22,972 location features 22,972 times (Meteogate's climate observations)
export function groupArrayItemErrors(errors: ErrorObject[]): ArrayItemErrors[] {
  const groups = new Map<string, ArrayItemErrors>();
  for (const error of errors) {
    const genericPath = error.instancePath.replace(ARRAY_INDEX, '/*');
    const key = `${genericPath}\u0000${error.keyword}\u0000${error.message}`;
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { error, genericPath, array: genericPath.split('/*')[0].split('/').pop() ?? '', count: 1 });
  }
  return [...groups.values()];
}

export function ajvErrorToValidationError(error: ErrorObject, extra: Partial<ValidationError> = {}): ValidationError {
  return {
    message: `${error.instancePath}: ${error.message}`,
    path: error.instancePath,
    keyword: error.keyword,
    params: error.params,
    type: 'schema',
    ...extra,
  };
}
