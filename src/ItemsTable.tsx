import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import CancelIcon from '@mui/icons-material/Cancel';
import ListIcon from '@mui/icons-material/List';
import axios from 'axios';
import { AuthCredentials } from './DataRetrievalAPI';
import { 
  DataGrid, 
  GridColDef,
  Toolbar,
  QuickFilter,
  QuickFilterControl,
  QuickFilterClear,
} from '@mui/x-data-grid';

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

interface ItemRow {
  id: string | number;
  geometryType: string;
  [key: string]: any;
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
  const propertyKeys = useMemo(() => {
    if (!data || !data.features || data.features.length === 0) return [];
    
    const keysSet = new Set<string>();
    data.features.forEach(feature => {
      if (feature.properties) {
        Object.keys(feature.properties).forEach(key => keysSet.add(key));
      }
    });
    
    return Array.from(keysSet);
  }, [data]);

  // Transform features into rows for DataGrid
  const rows: ItemRow[] = useMemo(() => {
    if (!data || !data.features) return [];
    
    return data.features.map((feature, index) => {
      const row: ItemRow = {
        id: feature.id || `feature-${index}`,
        geometryType: feature.geometry?.type || 'Unknown',
      };
      
      // Add all properties as columns
      if (feature.properties) {
        Object.keys(feature.properties).forEach(key => {
          const value = feature.properties![key];
          row[key] = typeof value === 'object' ? JSON.stringify(value) : value;
        });
      }
      
      return row;
    });
  }, [data]);

  // Define columns for DataGrid
  const columns: GridColDef[] = useMemo(() => {
    const cols: GridColDef[] = [
      {
        field: 'id',
        headerName: 'ID',
        width: 120,
        flex: 0.5,
      },
      {
        field: 'geometryType',
        headerName: 'Geometry',
        width: 120,
        renderCell: (params) => (
          <Chip 
            label={params.value} 
            size="small"
            variant="outlined"
            color="primary"
          />
        ),
      },
    ];
    
    // Add columns for each property
    propertyKeys.forEach(key => {
      cols.push({
        field: key,
        headerName: key,
        flex: 1,
        minWidth: 150,
      });
    });
    
    return cols;
  }, [propertyKeys]);

  // Custom toolbar with QuickFilter
  function CustomToolbar() {
    return (
      <Toolbar>
        <QuickFilter>
          <QuickFilterControl
            render={({ ref, ...controlProps }, state) => (
              <TextField
                {...controlProps}
                inputRef={ref}
                placeholder="Search items..."
                size="small"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: state.value ? (
                      <InputAdornment position="end">
                        <QuickFilterClear
                          edge="end"
                          size="small"
                          aria-label="Clear search"
                        >
                          <CancelIcon fontSize="small" />
                        </QuickFilterClear>
                      </InputAdornment>
                    ) : null,
                    ...controlProps.slotProps?.input,
                  },
                  ...controlProps.slotProps,
                }}
              />
            )}
          />
        </QuickFilter>
      </Toolbar>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1 }}>
      <Button
        onClick={handleToggle}
        endIcon={open ? <ExpandLess /> : <ExpandMore />}
        variant="outlined"
        size="small"
        fullWidth
        sx={{ 
          justifyContent: 'space-between', 
          textTransform: 'none',
          pl: 0.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ListIcon fontSize="small" color="primary" />
          <Typography variant="body2" fontWeight="medium">
            {title || 'Items'}
          </Typography>
          {data && (
            <Chip 
              label={`${data.features.length} items`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
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
          
          {data && data.features && (
            <Box>
              {data.numberMatched !== undefined && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Showing {data.numberReturned || data.features.length} of {data.numberMatched} items
                </Typography>
              )}
              
              <Box sx={{ backgroundColor: 'background.paper', borderRadius: 1 }}>
                <Box sx={{ height: 520, width: '100%' }}>
                  <DataGrid
                    rows={rows}
                    columns={columns}
                    slots={{
                      toolbar: CustomToolbar,
                    }}
                    showToolbar
                    initialState={{
                      pagination: {
                        paginationModel: { pageSize: 10 },
                      },
                      sorting: {
                        sortModel: [{ field: 'id', sort: 'asc' }],
                      },
                    }}
                    pageSizeOptions={[10, 25, 50, 100]}
                    disableMultipleRowSelection
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      '& .MuiDataGrid-cell:hover': {
                        cursor: 'default',
                      },
                    }}
                    density="compact"
                  />
                </Box>
              </Box>
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
