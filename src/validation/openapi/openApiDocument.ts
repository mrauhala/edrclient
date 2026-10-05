import type { ValidationError } from '../../types/api';
import type { ServiceDescription } from './loadServiceDescription';

// Open the API definition in the response viewer at a JSON pointer, highlighting the given findings
export function openApiDocumentAt(description: ServiceDescription, pointer: string, findings: ValidationError[] = []) {
  document.dispatchEvent(new CustomEvent('open-validation-response', {
    detail: {
      url: description.url,
      section: 'OpenAPI',
      scrollToPath: pointer,
      errors: findings,
      data: JSON.stringify(description.doc, null, 2),
    },
  }));
}
