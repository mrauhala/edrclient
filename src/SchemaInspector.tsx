import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import axios from 'axios';

const SchemaInspector: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [schemaUrl, setSchemaUrl] = useState('https://beta.schemas.opengis.net/ogcapi/common/part2/0.1/collections/openapi/schemas/collections.json');
  const [loading, setLoading] = useState(false);
  const [schemaData, setSchemaData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Function to find all schema references
  const findAllReferences = (schema: any) => {
    const refs: string[] = [];
    
    function traverse(obj: any) {
      if (!obj || typeof obj !== 'object') return;
      
      for (const key in obj) {
        if (key === '$ref' || key === '$href') {
          refs.push(obj[key]);
        }
        
        if (typeof obj[key] === 'object') {
          traverse(obj[key]);
        }
      }
    }
    
    traverse(schema);
    return refs;
  };
  
  const handleOpen = () => {
    setOpen(true);
  };
  
  const handleClose = () => {
    setOpen(false);
  };
  
  const handleSchemaUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSchemaUrl(event.target.value);
  };
  
  const handleFetchSchema = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(schemaUrl);
      setSchemaData(response.data);
      
      // Note: Schema loaded for inspection (validation uses EDR compliance checking)
      console.log(`Schema loaded for inspection: ${schemaUrl}`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error fetching schema');
      setSchemaData(null);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLoadReference = async (reference: string) => {
    try {
      setLoading(true);
      
      // Calculate absolute URL if it's relative
      let absoluteUrl = reference;
      if (!reference.startsWith('http')) {
        const baseUrl = schemaUrl.substring(0, schemaUrl.lastIndexOf('/') + 1);
        absoluteUrl = new URL(reference, baseUrl).toString();
      }
      
      // Load referenced schema for inspection
      console.log(`Loading referenced schema: ${absoluteUrl}`);
      
      // Fetch it to display
      const response = await axios.get(absoluteUrl);
      setSchemaData(response.data);
      setSchemaUrl(absoluteUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${reference}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <Button variant="outlined" onClick={handleOpen} sx={{ mt: 2 }}>
        Schema Inspector
      </Button>
      
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle>Schema Inspector</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              label="Schema URL"
              value={schemaUrl}
              onChange={handleSchemaUrlChange}
              fullWidth
              sx={{ mb: 1 }}
            />
            <Button
              variant="contained"
              onClick={handleFetchSchema}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Fetch Schema'}
            </Button>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {schemaData && (
            <>
              <Typography variant="h6" gutterBottom>
                Schema References:
              </Typography>
              <Box sx={{ mb: 2 }}>
                {findAllReferences(schemaData).map((ref, index) => (
                  <Button
                    key={index}
                    variant="outlined"
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                    onClick={() => handleLoadReference(ref)}
                  >
                    {ref}
                  </Button>
                ))}
                {findAllReferences(schemaData).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No references found in this schema.
                  </Typography>
                )}
              </Box>
              
              <Typography variant="h6" gutterBottom>
                Schema Content:
              </Typography>
              <Box 
                sx={{ 
                  backgroundColor: '#f5f5f5',
                  padding: 2,
                  borderRadius: 1,
                  maxHeight: '400px',
                  overflow: 'auto'
                }}
              >
                <pre>{JSON.stringify(schemaData, null, 2)}</pre>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SchemaInspector;