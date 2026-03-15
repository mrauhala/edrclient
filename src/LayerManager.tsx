import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteIcon from '@mui/icons-material/Delete';
import LayersIcon from '@mui/icons-material/Layers';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Slider from '@mui/material/Slider';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import { useLayerManager } from './contexts/LayerManagerContext';

function getLayerTypeLabel(layer: { url: string; data?: any }): string {
  if (layer.data?.type === 'internal') {
    switch (layer.data.layerType) {
      case 'bbox': return 'Extent';
      case 'locations': return 'Locations';
      case 'markers': return 'Markers';
      case 'area': return 'Area';
      case 'radius': return 'Radius';
      default: return 'Map Layer';
    }
  }
  return 'GeoJSON';
}

const LayerManager: React.FC = () => {
  const { allMapLayers, handleLayerManagerChange } = useLayerManager();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const handleVisibilityToggle = (index: number) => {
    const updatedLayers = allMapLayers.map((layer, i) =>
      i === index ? { ...layer, visible: !layer.visible } : layer
    );
    handleLayerManagerChange(updatedLayers);
  };

  const handleDelete = (index: number) => {
    const updatedLayers = allMapLayers.filter((_, i) => i !== index);
    handleLayerManagerChange(updatedLayers);
  };

  const handleOpacityChange = (index: number, newOpacity: number) => {
    const updatedLayers = allMapLayers.map((layer, i) =>
      i === index ? { ...layer, opacity: newOpacity } : layer
    );
    handleLayerManagerChange(updatedLayers);
  };

  const layerCount = allMapLayers.length;

  return (
    <>
      <Tooltip title="Map Layers">
        <IconButton
          size="small"
          color="inherit"
          aria-label="map layers"
          onClick={handleOpen}
        >
          <Badge
            badgeContent={layerCount}
            color="secondary"
            invisible={layerCount === 0}
          >
            <LayersIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              maxHeight: 480,
            }
          }
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2">
            Map Layers ({layerCount})
          </Typography>
        </Box>
        {layerCount === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No layers on the map
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding sx={{ overflow: 'auto' }}>
            {allMapLayers.map((layer, index) => {
              const typeLabel = getLayerTypeLabel(layer);
              const opacity = layer.opacity ?? 1;
              return (
                <React.Fragment key={`${layer.url}-${index}`}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      py: 1,
                      px: 2,
                      backgroundColor: layer.visible ? 'action.hover' : 'transparent',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: layer.visible ? 600 : 400,
                            color: layer.visible ? 'text.primary' : 'text.secondary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {layer.title}
                        </Typography>
                      </Box>
                      <Chip
                        label={typeLabel}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', height: 20 }}
                      />
                      <Tooltip title={layer.visible ? 'Hide layer' : 'Show layer'}>
                        <IconButton
                          size="small"
                          onClick={() => handleVisibilityToggle(index)}
                          color={layer.visible ? 'primary' : 'default'}
                        >
                          {layer.visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove layer">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(index)}
                          color="error"
                          sx={{ ml: -0.5 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, pl: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 48 }}>
                        Opacity
                      </Typography>
                      <Slider
                        size="small"
                        value={opacity}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(_e, value) => handleOpacityChange(index, value as number)}
                        sx={{ flex: 1 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 28, textAlign: 'right' }}>
                        {Math.round(opacity * 100)}%
                      </Typography>
                    </Box>
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Popover>
    </>
  );
};

export default LayerManager;
