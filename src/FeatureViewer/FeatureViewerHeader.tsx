import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LayersIcon from '@mui/icons-material/Layers';

interface FeatureViewerHeaderProps {
  variant: 'location' | 'geojson';
  onClose: () => void;
  showClose?: boolean;
}

const FeatureViewerHeader: React.FC<FeatureViewerHeaderProps> = ({ variant, onClose, showClose = true }) => {
  const icon = variant === 'location'
    ? <LocationOnIcon color="primary" />
    : <LayersIcon color="warning" />;

  const title = variant === 'location' ? 'Location Feature' : 'GeoJSON Feature';

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
      <Box display="flex" alignItems="center" gap={1}>
        {icon}
        <Typography variant="h6" component="h3">
          {title}
        </Typography>
      </Box>
      {showClose && (
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close feature viewer"
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default React.memo(FeatureViewerHeader);
