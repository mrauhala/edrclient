import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { formatCoordinates } from './types';

interface FeatureViewerGeometryProps {
  geometry: { type: string; coordinates?: unknown };
}

const FeatureViewerGeometry: React.FC<FeatureViewerGeometryProps> = ({ geometry }) => {
  return (
    <Box mb={2}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Geometry
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <Chip
          label={geometry.type}
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
          wordBreak: 'break-word',
        }}
      >
        {formatCoordinates(geometry.coordinates, geometry.type)}
      </Typography>
    </Box>
  );
};

export default React.memo(FeatureViewerGeometry);
