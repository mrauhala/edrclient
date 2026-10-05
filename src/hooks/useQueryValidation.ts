import { useMemo } from 'react';
import { useCollection } from '../contexts/CollectionContext';
import { useQueryValidationContext } from '../contexts/QueryValidationContext';
import { summarizeIssues, type IssueSummary } from '../query/validateQuery';
import type { QueryIssue } from '../query/types';
import type { QueryValidationState } from '../contexts/QueryValidationContext';

const NO_ISSUES: QueryIssue[] = [];

interface QueryValidation {
  active: boolean;
  issues: QueryIssue[];
  summary: IssueSummary;
  apiOperation: QueryValidationState['apiOperation'];
}

// Issues of the data query behind the current request URL, if the query builder made that URL
export function useQueryValidation(): QueryValidation {
  const { queryValidation } = useQueryValidationContext();
  const { collectionUrl } = useCollection();
  const active = !!queryValidation && queryValidation.url === collectionUrl;
  const issues = active ? queryValidation.issues : NO_ISSUES;
  const apiOperation = active ? queryValidation.apiOperation : null;
  return useMemo(() => ({ active, issues, summary: summarizeIssues(issues), apiOperation }), [active, issues, apiOperation]);
}
