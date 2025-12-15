import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Chip from '@mui/material/Chip';
import axios from 'axios';
import { AuthCredentials } from './DataRetrievalAPI';

interface ItemsTableProps {
  url: string;
  title?: string;
  getAuthCredentials: (url: string) => AuthCredentials | undefined;
}

interface FeatureItem {
  id?: string | number;
  type: string;
  properties?: Record<string, any>;
  geometry?: any;
}

interface FeatureCollection {
  type: string;
  features: FeatureItem[];
  numberMatched?: number;
  numberReturned?: number;
}

const ItemsTable: React.FC<ItemsTableProps> = ({ url, title, getAuthCredentials }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FeatureCollection | null>(null);

  const handleToggle = () => {
    if (!open && !data && !loading) {
      // Fetch data on first open
      fetchItems();
    }
    setOpen(!open);
  };

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const auth = getAuthCredentials(url);
      const headers: Record<string, string> = {};
      
      if (auth) {
        if (auth.username && auth.password) {
          const token = btoa(`${auth.username}:${auth.password}`);
          headers['Authorization'] = `Basic ${token}`;
        } else if (auth.bearerToken) {
          headers['Authorization'] = `Bearer ${auth.bearerToken}`;
        } else if (auth.apiKey && auth.apiKeyParam) {
          // API key will be added as URL parameter
        }
      }

      // Add API key to URL if provided
      let fetchUrl = url;
      if (auth?.apiKey && auth?.apiKeyParam) {
        const separator = url.includes('?') ? '&' : '?';
        fetchUrl = `${url}${separator}${auth.apiKeyParam}=${auth.apiKey}`;
      }

      const response = await axios.get(fetchUrl, { headers });
      
      if (response.data && (response.data.type === 'FeatureCollection' || response.data.type === 'Feature')) {
        setData(response.data.type === 'Feature' ? { type: 'FeatureCollection', features: [response.data] } : response.data);
      } else {
        setError('Invalid GeoJSON response');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  // Extract all unique property keys from features
  const getPropertyKeys = (): string[] => {
    if (!data || !data.features || data.features.length === 0) return [];
    
    const keysSet = new Set<string>();
    data.features.forEach(feature => {
      if (feature.properties) {
        Object.keys(feature.properties).forEach(key => keysSet.add(key));
      }
    });
    
    return Array.from(keysSet);
  };

  const propertyKeys = getPropertyKeys();

  return (
    <Box sx={{ mt: 1, mb: 1 }}>
      <Button
        onClick={handleToggle}
        endIcon={open ? <ExpandLess /> : <ExpandMore />}
        variant="outlined"
        size="small"
        fullWidth
        sx={{ justifyContent: 'space-between', textTransform: 'none' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">
            {title || 'Items'}
          </Typography>
          {data && (
            <Chip 
              label={`${data.features.length} items`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
      </Button>
      
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 1 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}
          
          {data && data.features && data.features.length > 0 && (
            <Box>
              {data.numberMatched !== undefined && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Showing {data.numberReturned || data.features.length} of {data.numberMatched} items
                </Typography>
              )}
              
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Type</TableCell>
                      {propertyKeys.map(key => (
                        <TableCell key={key} sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>
                          {key}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.features.map((feature, idx) => (
                      <TableRow 
                        key={feature.id || idx}
                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                      >
                        <TableCell>{feature.id || idx}</TableCell>
                        <TableCell>
                          <Chip 
                            label={feature.geometry?.type || 'Unknown'} 
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        {propertyKeys.map(key => (
                          <TableCell key={key}>
                            {feature.properties && feature.properties[key] !== undefined
                              ? typeof feature.properties[key] === 'object'
                                ? JSON.stringify(feature.properties[key])
                                : String(feature.properties[key])
                              : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          
          {data && data.features && data.features.length === 0 && (
            <Alert severity="info" sx={{ mt: 1 }}>
              No items found
            </Alert>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default ItemsTable;
