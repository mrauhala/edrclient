import type { ValidationError, ValidationResult } from '../types/api';

// Errors and warnings are problems; notes (info) are listed but don't count against the service
export const isProblem = (error: ValidationError) => (error.severity ?? 'error') !== 'info';

// A loaded service is valid when every section validated so far is, as getCollections() decides
// on load. Computed from the sections, so a section that's validated again replaces its old verdict.
export function allSectionsValid(result: ValidationResult): boolean {
  return [
    result.landingPageValidation,
    result.collectionsValidation,
    result.conformanceValidation,
    result.locationsValidation,
    result.openApiValidation,
  ].every(section => section?.isValid ?? true);
}
