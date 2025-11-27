import React, { useMemo } from 'react';
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
import { DataGrid, GridColDef, GridToolbarQuickFilter, GridToolbarContainer } from '@mui/x-data-grid';
import { useState } from 'react';

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

  // Custom toolbar with quick filter
  const CustomToolbar = () => {
    return (
      <GridToolbarContainer>
        <GridToolbarQuickFilter 
          sx={{ flex: 1, p: 1 }}
          placeholder="Search locations..."
          variant="outlined"
          size="small"
        />
      </GridToolbarContainer>
    );
  };

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
        <Box sx={{ height: 550, width: '100%', backgroundColor: 'background.paper', borderRadius: 1 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            disableMultipleRowSelection
            onRowClick={handleRowClick}
            slots={{
              toolbar: CustomToolbar,
            }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 500 },
              },
            }}
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
      </Collapse>
    </Box>
  );
};

export default LocationFeatureList;