import { useMemo } from 'react';
import { useCollection } from '../contexts/CollectionContext';
import { useQueryValidationContext } from '../contexts/QueryValidationContext';
import { summarizeIssues, type IssueSummary } from '../query/validateQuery';
import type { QueryIssue } from '../query/types';

const NO_ISSUES: QueryIssue[] = [];

// Issues of the data query behind the current request URL, if the query builder made that URL
export function useQueryValidation(): { active: boolean; issues: QueryIssue[]; summary: IssueSummary } {
  const { queryValidation } = useQueryValidationContext();
  const { collectionUrl } = useCollection();
  const active = !!queryValidation && queryValidation.url === collectionUrl;
  const issues = active ? queryValidation.issues : NO_ISSUES;
  return useMemo(() => ({ active, issues, summary: summarizeIssues(issues) }), [active, issues]);
}
