import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

interface FeatureViewerMetadataProps {
  metadata: { numberReturned?: number; numberMatched?: number };
}

const FeatureViewerMetadata: React.FC<FeatureViewerMetadataProps> = ({ metadata }) => {
  if (metadata.numberReturned === undefined && metadata.numberMatched === undefined) {
    return null;
  }

  return (
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
  );
};

export default React.memo(FeatureViewerMetadata);
