import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import type { FeatureViewerProps } from './types';
import FeatureViewerHeader from './FeatureViewerHeader';
import FeatureViewerGeometry from './FeatureViewerGeometry';
import FeatureViewerMetadata from './FeatureViewerMetadata';
import FeatureViewerProperties from './FeatureViewerProperties';
import FeatureViewerLinks from './FeatureViewerLinks';
import MapOverlayPanel from './MapOverlayPanel';

const FeatureViewer: React.FC<FeatureViewerProps> = ({
  feature,
  onClose,
  variant,
  layout = 'overlay',
  metadata,
  onSelectLabelProperty,
  selectedLabelProperty,
}) => {
  const links = useMemo(() => feature?.links || [], [feature?.links]);

  if (!feature) return null;

  const content = (
    <Box>
      <FeatureViewerHeader
        variant={variant}
        onClose={onClose}
        showClose={layout === 'overlay'}
      />

      {/* Feature ID */}
      {feature.id != null && (
        <Box mb={2}>
          <Chip
            label={String(feature.id)}
            variant="outlined"
            size="small"
            sx={{ fontFamily: 'monospace' }}
          />
        </Box>
      )}

      {/* Geometry */}
      {feature.geometry && (
        <FeatureViewerGeometry geometry={feature.geometry} />
      )}

      {/* Collection Metadata */}
      {metadata && <FeatureViewerMetadata metadata={metadata} />}

      {/* Links */}
      {links.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <FeatureViewerLinks links={links} />
        </>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* Properties */}
      <FeatureViewerProperties
        properties={feature.properties}
        onSelectLabelProperty={onSelectLabelProperty}
        selectedLabelProperty={selectedLabelProperty}
      />
    </Box>
  );

  if (layout === 'inline') {
    return content;
  }

  return (
    <MapOverlayPanel open={true} onClose={onClose}>
      {content}
    </MapOverlayPanel>
  );
};

export default React.memo(FeatureViewer);
