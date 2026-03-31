import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { FeatureLink } from './types';

interface FeatureViewerLinksProps {
  links: FeatureLink[];
}

const FeatureViewerLinks: React.FC<FeatureViewerLinksProps> = ({ links }) => {
  if (links.length === 0) return null;

  // Group links by rel value
  const grouped = new Map<string, FeatureLink[]>();
  for (const link of links) {
    const rel = link.rel || 'related';
    const group = grouped.get(rel) || [];
    group.push(link);
    grouped.set(rel, group);
  }

  return (
    <Box mb={2}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Links
      </Typography>
      {Array.from(grouped.entries()).map(([rel, items]) => (
        <Box key={rel} sx={{ mb: 1 }}>
          {items.length > 1 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {rel}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {items.map((link, i) => (
              <Chip
                key={i}
                label={link.title || link.rel || 'Link'}
                component="a"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                clickable
                size="small"
                variant="outlined"
                icon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                sx={{ maxWidth: '100%' }}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default React.memo(FeatureViewerLinks);
