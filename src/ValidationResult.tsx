import React from 'react';
import { Alert, AlertTitle, Box, Collapse, List, ListItem, Typography, Chip, Divider, Paper } from '@mui/material';
import { ValidationResult } from './DataRetrievalAPI';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

interface ValidationResultsProps {
  validation: ValidationResult;
  expanded: boolean;
}

const ValidationResults: React.FC<ValidationResultsProps> = ({ validation, expanded }) => {
  // Helper function to render schema validation section
  const renderSchemaSection = (
    title: string,
    validationData?: {
      isValid: boolean;
      errors: any[] | null;
      schemaResults?: Array<{ schema: string; isValid: boolean }>;
    }
  ) => {
    if (!validationData) return null;

    return (
      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
          {title}
        </Typography>
        
        {validationData.schemaResults && validationData.schemaResults.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {validationData.schemaResults.map((result, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {result.isValid ? (
                  <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                ) : (
                  <ErrorIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                )}
                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                  {result.schema}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Chip
            label={validationData.isValid ? 'Valid' : 'Invalid'}
            color={validationData.isValid ? 'success' : 'warning'}
            size="small"
          />
        )}
      </Paper>
    );
  };

  // Show schema information
  const schemaInfo = (
    <Box sx={{ mt: 1, mb: 1 }}>
      <Chip 
        label={`Schema Types: ${validation.schemaCount || 0}`} 
        color="info" 
        size="small" 
        sx={{ mr: 1 }} 
      />
      {validation.schemaUrls && validation.schemaUrls.length > 0 && (
        <Chip 
          label={`Schema Files: ${validation.schemaUrls.length}`} 
          color="info" 
          size="small" 
          variant="outlined"
        />
      )}
    </Box>
  );

  // If there are no errors or we've manually set isValid to true despite errors
  if (validation.isValid) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>Schema Validation Status</AlertTitle>
        <Chip 
          label="API Response Loaded" 
          color="success" 
          size="small" 
          sx={{ mr: 1, mb: 1 }} 
        />
        {validation.errors && validation.errors.length > 0 ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            (Minor schema warnings ignored)
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Response structure looks good
          </Typography>
        )}
        
        {schemaInfo}
        
        <Box sx={{ mt: 2 }}>
          {renderSchemaSection('Landing Page', validation.landingPageValidation)}
          {renderSchemaSection('Collections', validation.collectionsValidation)}
          {renderSchemaSection('Conformance', validation.conformanceValidation)}
        </Box>
        
        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Loaded Schema Files:
          </Typography>
          <Box sx={{ maxHeight: '150px', overflow: 'auto' }}>
            <List dense>
              {validation.schemaUrls && validation.schemaUrls.map((url, index) => (
                <ListItem key={index} sx={{ py: 0 }}>
                  <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                    {index + 1}. {url}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </Box>
        </Collapse>
      </Alert>
    );
  }

  // If we have validation errors and isValid is explicitly false
  return (
    <Box sx={{ mb: 2 }}>
      <Alert severity="warning" sx={{ mb: 1 }}>
        <AlertTitle>Schema Validation Notice</AlertTitle>
        The API response has some schema differences 
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Data is still being displayed
        </Typography>
        
        {schemaInfo}
        
        <Box sx={{ mt: 2 }}>
          {renderSchemaSection('Landing Page', validation.landingPageValidation)}
          {renderSchemaSection('Collections', validation.collectionsValidation)}
          {renderSchemaSection('Conformance', validation.conformanceValidation)}
        </Box>
      </Alert>
      
      <Collapse in={expanded}>
        <Box sx={{ mt: 1, ml: 2, maxHeight: '200px', overflow: 'auto' }}>
          <Typography variant="subtitle2">Schema differences:</Typography>
          <List dense>
            {validation.errors && validation.errors.map((error, index) => (
              <ListItem key={index} sx={{ py: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {error.schema && (
                    <strong>[{error.schema}] </strong>
                  )}
                  {error.message}
                </Typography>
              </ListItem>
            )).slice(0, 10)}
            
            {validation.errors && validation.errors.length > 10 && (
              <ListItem>
                <Typography variant="caption" color="text.secondary">
                  ...and {validation.errors.length - 10} more errors
                </Typography>
              </ListItem>
            )}
          </List>
        </Box>
      </Collapse>
    </Box>
  );
};

export default ValidationResults;