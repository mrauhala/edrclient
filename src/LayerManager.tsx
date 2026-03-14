import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteIcon from '@mui/icons-material/Delete';
import LayersIcon from '@mui/icons-material/Layers';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import CollapsibleSection from './CollapsibleSection';

interface Layer {
  url: string;
  title: string;
  visible: boolean;
  labelProperty?: string;
  data?: any;
  apiKey?: string;
  apiKeyParam?: string;
}

interface LayerManagerProps {
  layers: Layer[];
  onLayersChange: (layers: Layer[]) => void;
}

const LayerManager: React.FC<LayerManagerProps> = ({ layers, onLayersChange }) => {
  const handleVisibilityToggle = (index: number) => {
    const updatedLayers = layers.map((layer, i) => 
      i === index ? { ...layer, visible: !layer.visible } : layer
    );
    onLayersChange(updatedLayers);
  };

  const handleDelete = (index: number) => {
    const updatedLayers = layers.filter((_, i) => i !== index);
    onLayersChange(updatedLayers);
  };

  if (layers.length === 0) {
    return null;
  }

  const visibleCount = layers.filter(l => l.visible).length;

  return (
    <CollapsibleSection
      title="Map Layers"
      icon={<LayersIcon color="primary" fontSize="small" />}
      chipLabel={`${visibleCount}/${layers.length}`}
      subtitle="Manage visible layers on the map"
      defaultOpen={true}
      sx={{ mb: 2 }}
    >
      <Box sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        backgroundColor: 'background.paper'
      }}>
        <List dense disablePadding>
            {layers.map((layer, index) => (
              <React.Fragment key={index}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    py: 1,
                    backgroundColor: layer.visible ? 'action.hover' : 'transparent',
                    '&:hover': {
                      backgroundColor: layer.visible ? 'action.selected' : 'action.hover',
                    },
                  }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title={layer.visible ? 'Hide layer' : 'Show layer'}>
                        <IconButton 
                          edge="end" 
                          size="small"
                          onClick={() => handleVisibilityToggle(index)}
                          color={layer.visible ? 'primary' : 'default'}
                        >
                          {layer.visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove layer">
                        <IconButton 
                          edge="end" 
                          size="small"
                          onClick={() => handleDelete(index)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: layer.visible ? 600 : 400,
                          color: layer.visible ? 'text.primary' : 'text.secondary'
                        }}
                      >
                        {layer.title}
                      </Typography>
                    }
                    secondary={
                      // Show URL for GeoJSON layers with real URLs
                      (layer.url && 
                       !layer.url.startsWith('selected-item-') && 
                       !layer.url.startsWith('collection-bbox') &&
                       !layer.url.startsWith('clicked-markers') &&
                       !layer.url.startsWith('selected-area') &&
                       !layer.url.startsWith('radius-circle')) ? (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                            maxWidth: '250px'
                          }}
                        >
                          {layer.url}
                        </Typography>
                      ) : layer.data?.type === 'internal' && layer.data?.layerType !== 'locations' ? (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'text.secondary',
                            fontStyle: 'italic'
                          }}
                        >
                          Map layer
                        </Typography>
                      ) : layer.data ? (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'text.secondary',
                            fontStyle: 'italic'
                          }}
                        >
                          Selected feature from items
                        </Typography>
                      ) : null
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
        </List>
      </Box>
    </CollapsibleSection>
  );
};

export default LayerManager;
