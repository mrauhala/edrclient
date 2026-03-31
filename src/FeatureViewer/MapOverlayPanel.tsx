import React from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Fade from '@mui/material/Fade';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

interface MapOverlayPanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const MapOverlayPanel: React.FC<MapOverlayPanelProps> = ({ open, onClose, children }) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  if (isDesktop) {
    return (
      <Fade in={open} timeout={{ enter: 150, exit: 100 }}>
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: { md: 420, lg: 460 },
            maxHeight: '70vh',
            overflow: 'auto',
            p: 2,
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          {children}
        </Paper>
      </Fade>
    );
  }

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      PaperProps={{
        sx: {
          maxHeight: '60vh',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          p: 2,
          pt: 1,
        },
      }}
    >
      {/* Drag handle */}
      <Box
        sx={{
          width: 32,
          height: 4,
          backgroundColor: 'grey.400',
          borderRadius: 2,
          mx: 'auto',
          mb: 1,
        }}
      />
      {children}
    </SwipeableDrawer>
  );
};

export default React.memo(MapOverlayPanel);
