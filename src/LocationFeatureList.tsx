import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import TextField from '@mui/material/TextField';
import CollapsibleSection from './CollapsibleSection';
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

  // Transform features into rows for DataGrid
  const rows: LocationRow[] = useMemo(() => {
    if (!features) return [];
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

  if (!features || features.length === 0) {
    return null;
  }

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
    <CollapsibleSection
      title="Location Features"
      icon={<LocationOnIcon color="primary" fontSize="small" />}
      chipLabel={features.length}
      subtitle="Click to view and search location features"
      sx={{ mt: 1 }}
    >
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
    </CollapsibleSection>
  );
};

export default LocationFeatureList;