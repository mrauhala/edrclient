import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LayersIcon from '@mui/icons-material/Layers';

interface GeoJsonFeatureViewerProps {
  feature: any | null;
  onClose: () => void;
  metadata?: {numberReturned?: number, numberMatched?: number};
  onSelectLabelProperty?: (propertyName: string) => void;
  selectedLabelProperty?: string;
}

const GeoJsonFeatureViewer: React.FC<GeoJsonFeatureViewerProps> = ({ feature, onClose, metadata, onSelectLabelProperty, selectedLabelProperty }) => {
  if (!feature) return null;

  const properties = feature.get ? feature.getProperties() : feature.properties || {};
  const geometry = feature.get ? feature.getGeometry() : feature.geometry;
  
  // Extract geometry information
  const geometryType = geometry?.getType ? geometry.getType() : geometry?.type || 'Unknown';
  const coordinates = geometry?.getCoordinates ? geometry.getCoordinates() : geometry?.coordinates;

  // Format coordinates based on geometry type
  const formatCoordinates = (coords: any, geomType: string) => {
    if (!coords) return 'N/A';
    
    if (geomType === 'Point') {
      // For OpenLayers Point in EPSG:3857, we need to transform back
      if (Array.isArray(coords) && coords.length === 2) {
        return `[${coords[1]?.toFixed(6)}, ${coords[0]?.toFixed(6)}]`;
      }
      return JSON.stringify(coords);
    } else if (geomType === 'LineString') {
      return `LineString with ${coords.length} points`;
    } else if (geomType === 'Polygon') {
      return `Polygon with ${coords[0]?.length || 0} vertices`;
    } else if (geomType === 'MultiPoint') {
      return `MultiPoint with ${coords.length} points`;
    } else if (geomType === 'MultiLineString') {
      return `MultiLineString with ${coords.length} linestrings`;
    } else if (geomType === 'MultiPolygon') {
      return `MultiPolygon with ${coords.length} polygons`;
    }
    return 'Complex geometry';
  };

  // Filter out internal OpenLayers properties
  const displayProperties = Object.entries(properties).filter(([key]) => 
    key !== 'geometry' && !key.startsWith('_')
  );

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 500,
        maxHeight: '80vh',
        overflow: 'auto',
        p: 2,
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <LayersIcon color="warning" />
          <Typography variant="h6" component="h3">
            GeoJSON Feature
          </Typography>
        </Box>
        <Box
          component="span"
          onClick={onClose}
          sx={{
            cursor: 'pointer',
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'text.secondary',
            lineHeight: 1,
            '&:hover': { color: 'text.primary' }
          }}
        >
          ×
        </Box>
      </Box>

      {/* Geometry Information */}
      <Box mb={2}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Geometry
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <Chip 
            label={geometryType} 
            size="small" 
            color="primary"
            variant="outlined"
          />
        </Box>
        <Typography 
          variant="body2" 
          sx={{ 
            fontFamily: 'monospace', 
            backgroundColor: 'action.hover', 
            p: 1, 
            borderRadius: 1,
            fontSize: '0.75rem',
            wordBreak: 'break-word'
          }}
        >
          {formatCoordinates(coordinates, geometryType)}
        </Typography>
      </Box>

      {/* Collection Metadata */}
      {metadata && (metadata.numberReturned !== undefined || metadata.numberMatched !== undefined) && (
        <Box mb={2}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Collection Info
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {metadata.numberReturned !== undefined && (
              <Chip 
                label={`Returned: ${metadata.numberReturned}`}
                size="small" 
                color="info"
                variant="outlined"
                sx={{ fontFamily: 'monospace' }}
              />
            )}
            {metadata.numberMatched !== undefined && (
              <Chip 
                label={`Matched: ${metadata.numberMatched}`}
                size="small" 
                color="info"
                variant="outlined"
                sx={{ fontFamily: 'monospace' }}
              />
            )}
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Properties Table */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Properties
        </Typography>
        {onSelectLabelProperty && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontStyle: 'italic' }}>
            Click a property name to use it as a map label
          </Typography>
        )}
        {displayProperties.length > 0 ? (
          <TableContainer sx={{ maxHeight: '50vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>
                    Property
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>
                    Value
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayProperties.map(([key, value]) => {
                  const isSelected = selectedLabelProperty === key;
                  const isStringOrNumber = typeof value === 'string' || typeof value === 'number';
                  
                  return (
                    <TableRow 
                      key={key}
                      sx={{ 
                        '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                        backgroundColor: isSelected ? 'rgba(255, 152, 0, 0.15)' : undefined,
                        '&:hover': isStringOrNumber && onSelectLabelProperty ? { 
                          backgroundColor: isSelected ? 'rgba(255, 152, 0, 0.25)' : 'action.selected',
                          cursor: 'pointer'
                        } : undefined
                      }}
                      onClick={() => {
                        if (isStringOrNumber && onSelectLabelProperty) {
                          onSelectLabelProperty(key);
                        }
                      }}
                    >
                      <TableCell 
                        component="th" 
                        scope="row"
                        sx={{ 
                          fontWeight: isSelected ? 'bold' : 'medium',
                          verticalAlign: 'top',
                          maxWidth: '120px',
                          wordBreak: 'break-word',
                          color: isSelected ? 'warning.main' : 'inherit'
                        }}
                      >
                        {key}
                        {isSelected && ' 🏷️'}
                      </TableCell>
                    <TableCell 
                      sx={{ 
                        fontFamily: typeof value === 'object' ? 'monospace' : 'inherit',
                        fontSize: '0.875rem',
                        wordBreak: 'break-word',
                        maxWidth: '220px'
                      }}
                    >
                      {value === null || value === undefined ? (
                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                          null
                        </Typography>
                      ) : typeof value === 'object' ? (
                        <pre style={{ 
                          margin: 0, 
                          fontSize: '0.75rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      ) : typeof value === 'boolean' ? (
                        <Chip 
                          label={String(value)} 
                          size="small"
                          color={value ? 'success' : 'default'}
                          variant="outlined"
                        />
                      ) : (
                        String(value)
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            No properties available
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default GeoJsonFeatureViewer;
