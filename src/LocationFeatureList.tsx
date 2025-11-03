import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { useState } from 'react';

interface LocationFeatureListProps {
  features: any[] | null;
  onFeatureSelect?: (feature: any) => void;
}

const LocationFeatureList: React.FC<LocationFeatureListProps> = ({ features, onFeatureSelect }) => {
  const [open, setOpen] = useState(false);

  if (!features || features.length === 0) {
    return null;
  }

  const handleToggle = () => {
    setOpen(!open);
  };

  const handleFeatureClick = (feature: any) => {
    if (onFeatureSelect) {
      onFeatureSelect(feature);
    }
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
              Click to view available location features
            </Typography>
          }
        />
        {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
      </ListItemButton>
      
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding sx={{ maxHeight: 250, overflow: 'auto', backgroundColor: 'action.hover', borderRadius: 1 }}>
          {features.slice(0, 50).map((feature, index) => { // Limit to first 50 for performance
            const { id, properties } = feature;
            const name = properties?.name || properties?.title || `Feature ${index + 1}`;
            const coordinates = feature.geometry?.coordinates;
            
            return (
              <ListItem key={id || index} disablePadding>
                <ListItemButton 
                  sx={{ pl: 2, py: 0.5 }} 
                  onClick={() => handleFeatureClick(feature)}
                >
                  <ListItemText
                    primary={
                      <Typography variant="caption" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                        {name}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        {id && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            ID: {id}
                          </Typography>
                        )}
                        {coordinates && feature.geometry?.type === 'Point' && (
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            [{coordinates[1]?.toFixed(4)}, {coordinates[0]?.toFixed(4)}]
                          </Typography>
                        )}
                      </Box>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
          {features.length > 50 && (
            <ListItem>
              <ListItemText
                sx={{ pl: 4 }}
                secondary={
                  <Typography variant="caption" color="text.secondary" fontStyle="italic">
                    ... and {features.length - 50} more features
                  </Typography>
                }
              />
            </ListItem>
          )}
        </List>
      </Collapse>
    </Box>
  );
};

export default LocationFeatureList;