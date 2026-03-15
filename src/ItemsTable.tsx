import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import CollapsibleSection from './CollapsibleSection';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import CancelIcon from '@mui/icons-material/Cancel';
import ListIcon from '@mui/icons-material/List';
import axios from 'axios';
import KeywordChips from './KeywordChips';
import { useService } from './contexts/ServiceContext';
import { getAxiosConfig, addApiKeyToUrl } from './api/auth';
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
  onFeatureClick?: (feature: FeatureItem) => void;
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
  originalFeature: FeatureItem;
  [key: string]: any;
}

const ItemsTable: React.FC<ItemsTableProps> = ({ url, title, onFeatureClick }) => {
  const { getAuthCredentials } = useService();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FeatureCollection | null>(null);

  const handleOpen = () => {
    if (!data && !loading) {
      fetchItems();
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const auth = getAuthCredentials(url);

      // Build URL with limit and API key
      const urlObj = new URL(url);
      urlObj.searchParams.set('limit', '2000');
      const fetchUrl = addApiKeyToUrl(urlObj.toString(), auth);

      const response = await axios.get(fetchUrl, getAxiosConfig(auth));
      
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
        originalFeature: feature,
      };
      
      // Add all properties as columns
      if (feature.properties) {
        Object.keys(feature.properties).forEach(key => {
          const value = feature.properties![key];
          row[key] = (key === 'keywords' && Array.isArray(value))
            ? value
            : typeof value === 'object' ? JSON.stringify(value) : value;
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
        ...(key === 'keywords' ? {
          renderCell: (params) =>
            Array.isArray(params.value)
              ? <KeywordChips keywords={params.value as string[]} />
              : String(params.value ?? ''),
        } : {}),
      });
    });
    
    return cols;
  }, [propertyKeys]);

  const handleRowClick = (params: any) => {
    if (onFeatureClick && params.row.originalFeature) {
      onFeatureClick(params.row.originalFeature);
    }
  };

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
    <CollapsibleSection
      title={title || 'Items'}
      icon={<ListIcon fontSize="small" color="primary" />}
      chipLabel={data ? `${data.features.length} items` : undefined}
      variant="button"
      onOpen={handleOpen}
      sx={{ mt: 1, mb: 1 }}
    >
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
                    onRowClick={handleRowClick}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      '& .MuiDataGrid-cell:hover': {
                        cursor: 'pointer',
                      },
                      '& .MuiDataGrid-row:hover': {
                        backgroundColor: 'action.hover',
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
    </CollapsibleSection>
  );
};

export default ItemsTable;
