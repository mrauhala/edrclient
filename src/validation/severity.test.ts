import { describe, expect, it } from 'vitest';
import { allSectionsValid, isProblem, problemCount } from './severity';
import type { ValidationResult } from '../types/api';

describe('isProblem', () => {
  it('counts errors (also without a severity) and warnings, not notes', () => {
    expect(isProblem({ message: 'x' })).toBe(true);
    expect(isProblem({ message: 'x', severity: 'warning' })).toBe(true);
    expect(isProblem({ message: 'x', severity: 'info' })).toBe(false);
  });
});

describe('allSectionsValid', () => {
  const section = (isValid: boolean) => ({ isValid, errors: null });

  it('is valid when every validated section is', () => {
    expect(allSectionsValid({ isValid: true, errors: null })).toBe(true);
    expect(allSectionsValid({ isValid: true, errors: null, landingPageValidation: section(true), openApiValidation: section(true) })).toBe(true);
    expect(allSectionsValid({ isValid: true, errors: null, landingPageValidation: section(true), openApiValidation: section(false) })).toBe(false);
  });

  it('takes a revalidated section\'s new verdict instead of the stored overall one', () => {
    const before: ValidationResult = { isValid: false, errors: null, landingPageValidation: section(true), openApiValidation: section(false) };
    expect(allSectionsValid({ ...before, openApiValidation: section(true) })).toBe(true);
  });
});

describe('problemCount', () => {
  it('counts the errors and warnings of every section, not notes, as the badge does', () => {
    const result: ValidationResult = {
      isValid: true,
      errors: [
        { message: 'empty temporal values', section: 'collections' },
        { message: 'conformance linked as data', section: 'conformance', severity: 'warning' },
        { message: 'features lack datetime', section: 'Locations' },
        { message: 'bbox marked optional', section: 'OpenAPI', severity: 'info' },
      ],
    };
    expect(problemCount(result)).toBe(3);
    expect(problemCount({ isValid: true, errors: null })).toBe(0);
  });
});
