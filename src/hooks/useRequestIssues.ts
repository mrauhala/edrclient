import { useMemo } from 'react';
import { useCollection } from '../contexts/CollectionContext';
import { useOpenApi } from '../contexts/OpenApiContext';
import { useRequestUrl } from '../contexts/RequestUrlContext';
import { isForCollection } from '../query/parseQueryUrl';
import { addApiDocsIssues, summarizeIssues } from '../query/validateQuery';
import { checkQueryUrlAgainstOpenApi } from '../validation/openapi/checkQueryUrl';
import { useQueryValidation } from './useQueryValidation';

// What the Send button warns about: the form's issues, and for an edited URL what the API docs say of it. If
// the URL is for something other than the open collection, what the form holds has no bearing on it.
export function useRequestIssues() {
  const form = useQueryValidation();
  const { requestUrl, isEdited } = useRequestUrl();
  const { index: apiIndex } = useOpenApi();
  const { selectedCollection } = useCollection();

  return useMemo(() => {
    if (!isEdited) return { issues: form.issues, summary: form.summary };
    const fromDocs = apiIndex ? addApiDocsIssues(null, [], checkQueryUrlAgainstOpenApi(requestUrl, apiIndex)) : [];
    const fromForm = selectedCollection && isForCollection(requestUrl, selectedCollection)
      ? form.issues.filter(issue => issue.source !== 'openapi')
      : [];
    const issues = [...fromForm, ...fromDocs];
    return { issues, summary: summarizeIssues(issues) };
  }, [isEdited, requestUrl, apiIndex, selectedCollection, form.issues, form.summary]);
}
