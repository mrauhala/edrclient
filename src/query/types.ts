// What the query validation reports about the query being built. 'missing' issues tell the user
// what they still have to choose; the other severities describe values that are wrong or doubtful.
export type IssueSeverity = 'missing' | 'error' | 'warning' | 'info';

// Where a rule comes from: the EDR standard, the collection's own metadata, or the server's
// OpenAPI document
export type IssueSource = 'edr' | 'metadata' | 'openapi';

export interface QueryIssue {
  id: string; // `${source}:${field}:${rule}`, unique per query
  severity: IssueSeverity;
  source: IssueSource;
  field: string; // query parameter name ('coords', 'f', 'datetime', ...), 'query', or `dim:${id}`
  message: string;
  input?: 'map' | 'form'; // where the user fixes it
  pointer?: string; // for API docs issues: JSON pointer into the API definition
}

export type DimMode = 'individual' | 'range';

// A dimension selection as the builder holds it: a single value or a start/end range
export interface DimSelection {
  mode: DimMode;
  value: string;
  start: string;
  end: string;
}

export const SEVERITY_ORDER: Record<IssueSeverity, number> = { missing: 0, error: 1, warning: 2, info: 3 };
