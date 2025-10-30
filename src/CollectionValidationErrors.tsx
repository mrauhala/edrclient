import React from 'react';
import { Alert, AlertTitle, Box, Typography, Collapse } from '@mui/material';
import { ValidationError } from './DataRetrievalAPI';

interface CollectionValidationErrorsProps {
  collectionId: string;
  errors: ValidationError[];
  section?: string;
  expanded?: boolean;
}

const CollectionValidationErrors: React.FC<CollectionValidationErrorsProps> = ({ 
  collectionId, 
  errors, 
  section,
  expanded = false 
}) => {
  // Filter errors for the specific section if provided
  const filteredErrors = section 
    ? errors.filter(error => error.section === section)
    : errors;

  if (filteredErrors.length === 0) {
    return null;
  }

  const getSeverity = (error: ValidationError) => {
    if (error.keyword === 'required') return 'error';
    if (error.keyword === 'type') return 'warning';
    return 'info';
  };

  const formatErrorMessage = (error: ValidationError) => {
    let message = error.message;
    
    // Clean up the path prefix for better readability
    if (message.startsWith(`/collections/${collectionId}/`)) {
      message = message.replace(`/collections/${collectionId}/`, '');
    }
    
    // Add context for specific validation types
    if (error.keyword === 'required' && error.schema?.required) {
      message += ` (Required fields: ${error.schema.required.join(', ')})`;
    }
    
    if (error.allowedValues) {
      message += ` (Allowed values: ${error.allowedValues.join(', ')})`;
    }
    
    return message;
  };

  return (
    <Box sx={{ mt: 1 }}>
      {filteredErrors.map((error, index) => (
        <Alert 
          key={index} 
          severity={getSeverity(error)} 
          sx={{ mb: 1, fontSize: '0.875rem' }}
        >
          <AlertTitle sx={{ fontSize: '0.875rem' }}>
            Schema Validation {section ? `(${section})` : ''}
          </AlertTitle>
          <Typography variant="caption" display="block">
            {formatErrorMessage(error)}
          </Typography>
          
          <Collapse in={expanded}>
            <Box sx={{ mt: 1, pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                <strong>Path:</strong> {error.path || 'root'}
              </Typography>
              {error.keyword && (
                <Typography variant="caption" color="text.secondary" display="block">
                  <strong>Rule:</strong> {error.keyword}
                </Typography>
              )}
              {error.data !== undefined && (
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  display="block"
                  sx={{ 
                    wordBreak: 'break-word',
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  <strong>Actual:</strong> {JSON.stringify(error.data)}
                </Typography>
              )}
            </Box>
          </Collapse>
        </Alert>
      ))}
    </Box>
  );
};

export default CollectionValidationErrors;