import React from 'react';
import { Alert, AlertTitle, Box, Collapse, List, ListItem, Typography, Chip, Divider } from '@mui/material';
import { ValidationResult } from './DataRetrievalAPI';

interface ValidationResultsProps {
  validation: ValidationResult;
  expanded: boolean;
}

const ValidationResults: React.FC<ValidationResultsProps> = ({ validation, expanded }) => {
  // Show schema information
  const schemaInfo = (
    <Box sx={{ mt: 1 }}>
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

  // Show landing page validation if available
  const landingPageValidation = validation.landingPageValidation ? (
    <Chip
      label={`Landing Page: ${validation.landingPageValidation.isValid ? 'Valid' : 'Invalid'}`}
      color={validation.landingPageValidation.isValid ? 'success' : 'warning'}
      size="small"
      sx={{ mr: 1, mb: 1 }}
    />
  ) : null;

  // Show collections validation if available
  const collectionsValidation = validation.collectionsValidation ? (
    <Chip
      label={`Collections: ${validation.collectionsValidation.isValid ? 'Valid' : 'Invalid'}`}
      color={validation.collectionsValidation.isValid ? 'success' : 'warning'}
      size="small"
      sx={{ mr: 1, mb: 1 }}
    />
  ) : null;

  // Show conformance validation if available
  const conformanceValidation = validation.conformanceValidation ? (
    <Chip
      label={`Conformance: ${validation.conformanceValidation.isValid ? 'Valid' : 'Invalid'}`}
      color={validation.conformanceValidation.isValid ? 'success' : 'warning'}
      size="small"
      sx={{ mr: 1, mb: 1 }}
    />
  ) : null;

  // If there are no errors or we've manually set isValid to true despite errors
  if (validation.isValid) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>Schema Status</AlertTitle>
        <Chip 
          label="API Response Loaded" 
          color="success" 
          size="small" 
          sx={{ mr: 1 }} 
        />
        {validation.errors && validation.errors.length > 0 ? (
          <Typography variant="caption" color="text.secondary">
            (Minor schema warnings ignored)
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Response structure looks good
          </Typography>
        )}
        
        <Box sx={{ mt: 1 }}>
          {landingPageValidation}
          {collectionsValidation}
          {conformanceValidation}
        </Box>
        {schemaInfo}
        
        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" gutterBottom>
            Loaded Schemas:
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
        <AlertTitle>Schema Notice</AlertTitle>
        The API response has some schema differences 
        <Typography variant="caption" color="text.secondary" display="block">
          Data is still being displayed
        </Typography>
        
        <Box sx={{ mt: 1 }}>
          {landingPageValidation}
          {collectionsValidation}
          {conformanceValidation}
        </Box>
        {schemaInfo}
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
          
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" gutterBottom>
            Loaded Schemas:
          </Typography>
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
    </Box>
  );
};

export default ValidationResults;