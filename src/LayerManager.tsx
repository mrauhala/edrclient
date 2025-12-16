import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteIcon from '@mui/icons-material/Delete';
import LayersIcon from '@mui/icons-material/Layers';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import ListItemButton from '@mui/material/ListItemButton';

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
  const [open, setOpen] = useState(true);

  const handleToggle = () => {
    setOpen(!open);
  };

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
    <Box sx={{ mb: 2 }}>
      <ListItemButton onClick={handleToggle} sx={{ pl: 0, pr: 1 }}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <LayersIcon color="primary" fontSize="small" />
        </ListItemIcon>
        <ListItemText 
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" fontWeight="medium">
                Map Layers
              </Typography>
              <Chip 
                label={`${visibleCount}/${layers.length}`}
                size="small" 
                color="primary"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              Manage visible layers on the map
            </Typography>
          }
        />
        {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
      </ListItemButton>
      
      <Collapse in={open} timeout="auto" unmountOnExit>
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
                      (layer.url && !layer.url.startsWith('selected-item-')) ? (
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
      </Collapse>
    </Box>
  );
};

export default LayerManager;
