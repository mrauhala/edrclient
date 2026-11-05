import { useMemo } from 'react';
import { useOpenApi } from '../contexts/OpenApiContext';
import { useRequestUrl } from '../contexts/RequestUrlContext';
import { addApiDocsIssues, summarizeIssues } from '../query/validateQuery';
import { checkQueryUrlAgainstOpenApi } from '../validation/openapi/checkQueryUrl';
import { useQueryValidation } from './useQueryValidation';

// What Fetch warns about: the form's issues, or for an edited URL what the API docs say of it. The
// form's issues are about what the form holds, which the edited URL may no longer be.
export function useRequestIssues() {
  const form = useQueryValidation();
  const { requestUrl, isEdited } = useRequestUrl();
  const { index: apiIndex } = useOpenApi();

  return useMemo(() => {
    if (!isEdited) return { issues: form.issues, summary: form.summary };
    const issues = apiIndex ? addApiDocsIssues(null, [], checkQueryUrlAgainstOpenApi(requestUrl, apiIndex)) : [];
    return { issues, summary: summarizeIssues(issues) };
  }, [isEdited, requestUrl, apiIndex, form.issues, form.summary]);
}
