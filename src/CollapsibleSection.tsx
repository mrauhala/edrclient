import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { SxProps, Theme } from '@mui/material/styles';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  /** Optional count/badge label rendered as a small chip next to the title */
  chipLabel?: string | number;
  /** Secondary line below the title (list variant only) */
  subtitle?: string;
  defaultOpen?: boolean;
  /** 'list' renders a ListItemButton header; 'button' renders an outlined Button header */
  variant?: 'list' | 'button';
  /** Called once when the section transitions from closed to open */
  onOpen?: () => void;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  chipLabel,
  subtitle,
  defaultOpen = false,
  variant = 'list',
  onOpen,
  children,
  sx,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = () => {
    if (!open && onOpen) {
      onOpen();
    }
    setOpen(prev => !prev);
  };

  const chip = chipLabel !== undefined ? (
    <Chip
      label={chipLabel}
      size="small"
      color="primary"
      variant="outlined"
      sx={{ height: 20, fontSize: '0.7rem' }}
    />
  ) : null;

  const expandIcon = open
    ? <ExpandLess fontSize="small" />
    : <ExpandMore fontSize="small" />;

  return (
    <Box sx={sx}>
      {variant === 'list' ? (
        <ListItemButton onClick={handleToggle} sx={{ pl: 0, pr: 1 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            {icon}
          </ListItemIcon>
          <ListItemText
            primary={
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" fontWeight="medium">{title}</Typography>
                {chip}
              </Box>
            }
            secondary={subtitle ? (
              <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
            ) : undefined}
          />
          {expandIcon}
        </ListItemButton>
      ) : (
        <Button
          onClick={handleToggle}
          endIcon={expandIcon}
          variant="outlined"
          size="small"
          fullWidth
          sx={{ justifyContent: 'space-between', textTransform: 'none', pl: 0.5 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            <Typography variant="body2" fontWeight="medium">{title}</Typography>
            {chip}
          </Box>
        </Button>
      )}

      <Collapse in={open} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </Box>
  );
};

export default CollapsibleSection;
