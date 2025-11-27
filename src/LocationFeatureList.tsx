import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import CancelIcon from '@mui/icons-material/Cancel';
import { 
  DataGrid, 
  GridColDef,
  Toolbar,
  QuickFilter,
  QuickFilterControl,
  QuickFilterClear,
} from '@mui/x-data-grid';

interface LocationFeatureListProps {
  features: any[] | null;
  onFeatureSelect?: (feature: any) => void;
}

interface LocationRow {
  id: string | number;
  name: string;
  featureId: string;
  latitude?: number;
  longitude?: number;
  originalFeature: any;
}

const LocationFeatureList: React.FC<LocationFeatureListProps> = ({ features, onFeatureSelect }) => {
  const [open, setOpen] = useState(false);

  if (!features || features.length === 0) {
    return null;
  }

  const handleToggle = () => {
    setOpen(!open);
  };

  // Transform features into rows for DataGrid
  const rows: LocationRow[] = useMemo(() => {
    return features.map((feature, index) => {
      const { id, properties } = feature;
      const name = properties?.name || properties?.title || `Feature ${index + 1}`;
      const coordinates = feature.geometry?.coordinates;
      
      return {
        id: id || `feature-${index}`,
        name: name,
        featureId: id || '',
        latitude: coordinates && feature.geometry?.type === 'Point' ? coordinates[1] : undefined,
        longitude: coordinates && feature.geometry?.type === 'Point' ? coordinates[0] : undefined,
        originalFeature: feature
      };
    });
  }, [features]);

  // Define columns for DataGrid
  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'featureId',
      headerName: 'ID',
      flex: 0.8,
      minWidth: 100,
    },
    {
      field: 'latitude',
      headerName: 'Lat',
      width: 80,
      valueFormatter: (value: number | undefined) => value ? value.toFixed(4) : '',
    },
    {
      field: 'longitude',
      headerName: 'Lon',
      width: 80,
      valueFormatter: (value: number | undefined) => value ? value.toFixed(4) : '',
    },
  ];

  const handleRowClick = (params: any) => {
    if (onFeatureSelect && params.row.originalFeature) {
      onFeatureSelect(params.row.originalFeature);
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
                placeholder="Search locations..."
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
    <Box sx={{ mt: 1 }}>
      <ListItemButton onClick={handleToggle} sx={{ pl: 0 }}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <LocationOnIcon color="primary" fontSize="small" />
        </ListItemIcon>
        <ListItemText 
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" fontWeight="medium">
                Location Features
              </Typography>
              <Chip 
                label={features.length} 
                size="small" 
                color="primary"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              Click to view and search location features
            </Typography>
          }
        />
        {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
      </ListItemButton>
      
      <Collapse in={open} timeout="auto" unmountOnExit>
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
                  sortModel: [{ field: 'name', sort: 'asc' }],
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
      </Collapse>
    </Box>
  );
};

export default LocationFeatureList;