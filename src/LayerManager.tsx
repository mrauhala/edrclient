import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import LayersIcon from '@mui/icons-material/Layers';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Slider from '@mui/material/Slider';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLayerManager } from './contexts/LayerManagerContext';
import type { GeoJsonLayer } from './contexts/GeoJsonLayerContext';

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

function layerId(layer: GeoJsonLayer, index: number): string {
  if (layer.data?.type === 'internal') return `internal:${layer.data.layerType}`;
  return `${layer.url}:${index}`;
}

interface SortableLayerItemProps {
  id: string;
  layer: GeoJsonLayer;
  index: number;
  onVisibilityToggle: (index: number) => void;
  onDelete: (index: number) => void;
  onOpacityChange: (index: number, opacity: number) => void;
  isFirst: boolean;
}

const SortableLayerItem: React.FC<SortableLayerItemProps> = ({
  id,
  layer,
  index,
  onVisibilityToggle,
  onDelete,
  onOpacityChange,
  isFirst,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeLabel = getLayerTypeLabel(layer);
  const opacity = layer.opacity ?? 1;

  return (
    <div ref={setNodeRef} style={style}>
      {!isFirst && <Divider />}
      <ListItem
        sx={{
          flexDirection: 'column',
          alignItems: 'stretch',
          py: 1,
          px: 1,
          pr: 2,
          backgroundColor: layer.visible ? 'action.hover' : 'transparent',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            {...attributes}
            {...listeners}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'grab',
              color: 'text.secondary',
              '&:active': { cursor: 'grabbing' },
              touchAction: 'none',
            }}
          >
            <DragIndicatorIcon fontSize="small" />
          </Box>
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
              onClick={() => onVisibilityToggle(index)}
              color={layer.visible ? 'primary' : 'default'}
            >
              {layer.visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove layer">
            <IconButton
              size="small"
              onClick={() => onDelete(index)}
              color="error"
              sx={{ ml: -0.5 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, pl: 3.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 48 }}>
            Opacity
          </Typography>
          <Slider
            size="small"
            value={opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(_e, value) => onOpacityChange(index, value as number)}
            sx={{ flex: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 28, textAlign: 'right' }}>
            {Math.round(opacity * 100)}%
          </Typography>
        </Box>
      </ListItem>
    </div>
  );
};

const LayerManager: React.FC = () => {
  const { allMapLayers, handleLayerManagerChange } = useLayerManager();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    // Reassign zIndex values based on new positions
    const reindexed = updatedLayers.map((layer, i) => ({
      ...layer,
      zIndex: updatedLayers.length - i,
    }));
    handleLayerManagerChange(reindexed);
  };

  const handleOpacityChange = (index: number, newOpacity: number) => {
    const updatedLayers = allMapLayers.map((layer, i) =>
      i === index ? { ...layer, opacity: newOpacity } : layer
    );
    handleLayerManagerChange(updatedLayers);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortableIds.indexOf(String(active.id));
    const newIndex = sortableIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the array
    const reordered = [...allMapLayers];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Reassign zIndex: first item = highest (top of stack)
    const reindexed = reordered.map((layer, i) => ({
      ...layer,
      zIndex: reordered.length - i,
    }));

    handleLayerManagerChange(reindexed);
  };

  const layerCount = allMapLayers.length;
  const sortableIds = allMapLayers.map((layer, index) => layerId(layer, index));

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
              width: 380,
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
              <List dense disablePadding sx={{ overflow: 'auto' }}>
                {allMapLayers.map((layer, index) => (
                  <SortableLayerItem
                    key={sortableIds[index]}
                    id={sortableIds[index]}
                    layer={layer}
                    index={index}
                    onVisibilityToggle={handleVisibilityToggle}
                    onDelete={handleDelete}
                    onOpacityChange={handleOpacityChange}
                    isFirst={index === 0}
                  />
                ))}
              </List>
            </SortableContext>
          </DndContext>
        )}
      </Popover>
    </>
  );
};

export default LayerManager;
