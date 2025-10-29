import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LocationOnIcon from '@mui/icons-material/LocationOn';

interface FeatureInfoProps {
  feature: any | null;
  onClose: () => void;
}

const FeatureInfo: React.FC<FeatureInfoProps> = ({ feature, onClose }) => {
  if (!feature) return null;

  const { id, properties, geometry } = feature;
  const coordinates = geometry?.coordinates;

  // Format coordinates based on geometry type
  const formatCoordinates = (coords: any, geomType: string) => {
    if (!coords) return 'N/A';
    
    if (geomType === 'Point') {
      return `[${coords[1]?.toFixed(4)}, ${coords[0]?.toFixed(4)}] (lat, lon)`;
    } else if (geomType === 'LineString') {
      return `${coords.length} points`;
    } else if (geomType === 'Polygon') {
      return `${coords[0]?.length} vertices`;
    }
    return JSON.stringify(coords);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 320,
        maxHeight: '60vh',
        overflow: 'auto',
        p: 2,
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <LocationOnIcon color="primary" />
          <Typography variant="h6" component="h3">
            Location Feature
          </Typography>
        </Box>
        <Box
          component="span"
          onClick={onClose}
          sx={{
            cursor: 'pointer',
            fontSize: '20px',
            fontWeight: 'bold',
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' }
          }}
        >
          ×
        </Box>
      </Box>

      {/* Feature ID */}
      {id && (
        <Box mb={2}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            ID
          </Typography>
          <Chip 
            label={id} 
            variant="outlined" 
            size="small" 
            sx={{ fontFamily: 'monospace' }}
          />
        </Box>
      )}

      {/* Feature Name */}
      {properties?.name && (
        <Box mb={2}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Name
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {properties.name}
          </Typography>
        </Box>
      )}

      {/* Coordinates */}
      <Box mb={2}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Coordinates ({geometry?.type || 'Unknown'})
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            fontFamily: 'monospace', 
            backgroundColor: 'grey.100', 
            p: 1, 
            borderRadius: 1,
            fontSize: '0.8rem'
          }}
        >
          {formatCoordinates(coordinates, geometry?.type)}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* All Properties */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          All Properties
        </Typography>
        {properties && Object.keys(properties).length > 0 ? (
          <Box sx={{ maxHeight: '200px', overflow: 'auto' }}>
            {Object.entries(properties).map(([key, value]) => (
              <Box key={key} mb={1}>
                <Typography 
                  variant="caption" 
                  component="div" 
                  color="text.secondary"
                  sx={{ fontWeight: 'bold' }}
                >
                  {key}:
                </Typography>
                <Typography 
                  variant="body2" 
                  component="div"
                  sx={{ 
                    ml: 1,
                    wordBreak: 'break-word',
                    fontFamily: typeof value === 'string' ? 'inherit' : 'monospace'
                  }}
                >
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            No properties available
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default FeatureInfo;