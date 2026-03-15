import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { ValidationResult } from '../DataRetrievalAPI';

interface ValidationContextValue {
  validationResult: ValidationResult;
  setValidationResult: (result: ValidationResult) => void;
}

const ValidationContext = createContext<ValidationContextValue | null>(null);

export function ValidationProvider({ children }: { children: ReactNode }) {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: null,
  });

  const value = useMemo(
    () => ({ validationResult, setValidationResult }),
    [validationResult]
  );

  return (
    <ValidationContext.Provider value={value}>
      {children}
    </ValidationContext.Provider>
  );
}

export function useValidation(): ValidationContextValue {
  const context = useContext(ValidationContext);
  if (!context) {
    throw new Error('useValidation must be used within a ValidationProvider');
  }
  return context;
}
